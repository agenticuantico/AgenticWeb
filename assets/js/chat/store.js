/**
 * Persistencia de chats y del espacio de trabajo.
 *  - Invitado: localStorage (solo en este dispositivo).
 *  - Con cuenta: Firestore users/{uid}/chats/{chatId} y users/{uid}/private/workspace,
 *    con caché local. Si Firestore no responde, sigue funcionando en local.
 *  - Incógnito: nunca se guarda.
 *  - Fase 2: con cuenta, la MEMORIA y los PROYECTOS (y a qué proyecto va cada chat) viven en el servidor (D1, por
 *    usuario). La primera vez se importa una sola vez lo que había en el dispositivo. Si el servidor no responde, se
 *    sigue con la copia local como antes. Los métodos addMemory/editMemory/… son la única forma de cambiarlos.
 */
import { getStore } from '../firebase.js';

const LS_CHATS = 'ac.chats.v2';
const LS_WS = 'ac.ws.v2';
const MAX_LOCAL = 60;

export const DEFAULT_WS = () => ({ projects: [], instructions: '', memoryOn: true, memory: [], customAgents: [], skills: [], connectorsWanted: [], voiceAuto: true });

function readLS(k, d) { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } }
function writeLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }

/** Limpia un chat para guardarlo (sin blobs ni URLs temporales; tamaño acotado). */
export function serializeChat(c) {
  return {
    id: c.id, title: String(c.title || 'Conversación').slice(0, 120), createdAt: c.createdAt, updatedAt: c.updatedAt,
    projectId: c.projectId || null, pinned: !!c.pinned, mode: c.mode || 'fast', agents: (c.agents || []).slice(0, 8),
    messages: (c.messages || []).slice(-200).map((m) => ({
      id: m.id, role: m.role, content: String(m.content || '').slice(0, 60000), at: m.at,
      kind: m.kind || 'text',
      voice: m.voice ? { duration: m.voice.duration, peaks: (m.voice.peaks || []).slice(0, 48), transcript: String(m.voice.transcript || '').slice(0, 4000) } : null,
      attachments: (m.attachments || []).map((a) => ({ name: a.name, kind: a.kind, size: a.size })).slice(0, 10),
      agent: m.agent ? { id: m.agent.id, name: m.agent.name, color: m.agent.color } : null,
      steps: m.steps ? m.steps.slice(0, 30).map((s) => ({ id: s.id, title: s.title, status: s.status, phase: s.phase })) : null,
      site: m.site && m.site.id ? { id: m.site.id, previewUrl: m.site.previewUrl, zipUrl: m.site.zipUrl, meta: m.site.meta, brief: m.site.brief } : null,
      artifacts: m.artifacts ? m.artifacts.slice(0, 4).map((a) => ({ name: a.name, mime: a.mime, content: String(a.content || '').slice(0, 120000) })) : null
    }))
  };
}

export class ChatStore {
  constructor() {
    this.uid = null;
    this.chats = readLS(LS_CHATS, []);
    this.ws = { ...DEFAULT_WS(), ...readLS(LS_WS, {}) };
    this.listeners = new Set();
    this.remoteOk = false;
    this.serverOk = false;
    this._timers = new Map();
    // El área «Tu cuenta» cambia memoria/proyectos directo en el servidor: al avisar, se vuelve a leer.
    if (typeof document !== 'undefined') document.addEventListener('workspace:refresh', () => { if (this.uid) this.syncServer(); });
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach((fn) => fn(this)); }

  list() { return [...this.chats].sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt)); }
  get(id) { return this.chats.find((c) => c.id === id) || null; }

  /** Conecta la cuenta: trae chats remotos y sube una vez los locales de invitado. */
  async attachUser(uid) {
    this.uid = uid;
    if (!uid) { this.remoteOk = false; this.serverOk = false; this.chats = readLS(LS_CHATS, []); this.emit(); return; }
    try {
      const { fs, db } = await getStore();
      const q = fs.query(fs.collection(db, 'users', uid, 'chats'), fs.orderBy('updatedAt', 'desc'), fs.limit(100));
      const snap = await fs.getDocs(q);
      const remote = snap.docs.map((d) => d.data());
      const wsSnap = await fs.getDoc(fs.doc(db, 'users', uid, 'private', 'workspace'));
      this.remoteOk = true;
      const ids = new Set(remote.map((c) => c.id));
      const guest = this.chats.filter((c) => !ids.has(c.id) && !c.uploaded);
      this.chats = [...remote, ...guest];
      if (wsSnap.exists()) this.ws = { ...DEFAULT_WS(), ...wsSnap.data() };
      else await this.saveWorkspace();
      for (const c of guest) this.save(c, { immediate: true });
    } catch (e) {
      console.warn('[chats] sincronización no disponible:', e && e.code);
      this.remoteOk = false;
    }
    this.emit();
    await this.syncServer();
  }

  /* ---------- Memoria y proyectos en el servidor (Fase 2) ---------- */
  async _api(path, body) {
    const { call } = await import('../account/api.js');
    return call(path, body === undefined ? {} : { method: 'POST', body });
  }
  /** Trae memoria y proyectos del servidor (e importa una vez lo local). Sin servidor, queda la copia local. */
  async syncServer() {
    this.serverOk = false;
    if (!this.uid) return false;
    try {
      let w = await this._api('/api/workspace');
      if (!w.importedAt) {
        const chats = {};
        for (const c of this.chats) if (c.projectId) chats[c.id] = c.projectId;
        const r = await this._api('/api/workspace/import', { memoryOn: this.ws.memoryOn !== false, memory: this.ws.memory || [], projects: this.ws.projects || [], chats });
        w = r.workspace;
      }
      this._applyServer(w);
      this.serverOk = true;
    } catch (e) { console.warn('[workspace] servidor no disponible:', e && e.code); }
    this.emit();
    return this.serverOk;
  }
  _applyServer(w) {
    this.ws.memoryOn = w.memoryOn !== false;
    this.ws.memory = (w.memory || []).map((m) => ({ id: m.id, text: m.text, at: m.createdAt, source: m.source }));
    this.ws.projects = (w.projects || []).map((p) => ({ id: p.id, name: p.name, description: p.description || '' }));
    const map = w.chats || {};
    for (const c of this.chats) {
      const pid = map[c.id] || null;
      if ((c.projectId || null) !== pid) { c.projectId = pid; this._persistLocal(); }
    }
    writeLS(LS_WS, this.ws);
  }
  /** Guarda memoria/proyectos: servidor si hay cuenta y responde; si no, como antes (dispositivo/Firestore). */
  async _local() { await this.saveWorkspace(); }

  async addMemory(text, source = 'manual') {
    const t = String(text || '').trim();
    if (!t) return null;
    if (this.serverOk) {
      const r = await this._api('/api/memory', { text: t, source });
      if (!this.ws.memory.some((m) => m.id === r.memory.id)) this.ws.memory.push({ id: r.memory.id, text: r.memory.text, at: r.memory.createdAt, source: r.memory.source });
      writeLS(LS_WS, this.ws); this.emit(); return r.memory;
    }
    const m = { id: 'mem' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: t.slice(0, 300), at: Date.now() };
    this.ws.memory.push(m); await this._local(); return m;
  }
  async editMemory(id, text) {
    const t = String(text || '').trim();
    if (this.serverOk) await this._api(`/api/memory/${encodeURIComponent(id)}/edit`, { text: t });
    const m = this.ws.memory.find((x) => x.id === id); if (m) m.text = t;
    if (this.serverOk) { writeLS(LS_WS, this.ws); this.emit(); } else await this._local();
  }
  async deleteMemory(id) {
    if (this.serverOk) await this._api(`/api/memory/${encodeURIComponent(id)}/delete`, {});
    this.ws.memory = this.ws.memory.filter((x) => x.id !== id);
    if (this.serverOk) { writeLS(LS_WS, this.ws); this.emit(); } else await this._local();
  }
  async clearMemory() {
    if (this.serverOk) await this._api('/api/memory/clear', {});
    this.ws.memory = [];
    if (this.serverOk) { writeLS(LS_WS, this.ws); this.emit(); } else await this._local();
  }
  async setMemoryOn(on) {
    if (this.serverOk) await this._api('/api/workspace/settings', { memoryOn: !!on });
    this.ws.memoryOn = !!on;
    if (this.serverOk) { writeLS(LS_WS, this.ws); this.emit(); } else await this._local();
  }
  async addProject(name, description = '') {
    const n = String(name || '').trim().slice(0, 60);
    if (!n) return null;
    if (this.serverOk) {
      const r = await this._api('/api/projects', { name: n, description });
      this.ws.projects.push({ id: r.project.id, name: r.project.name, description: r.project.description || '' });
      writeLS(LS_WS, this.ws); this.emit(); return r.project;
    }
    const p = { id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: n, description };
    this.ws.projects.push(p); await this._local(); return p;
  }
  async editProject(id, name, description = '') {
    const n = String(name || '').trim().slice(0, 60);
    if (this.serverOk) await this._api(`/api/projects/${encodeURIComponent(id)}/edit`, { name: n, description });
    const p = this.ws.projects.find((x) => x.id === id); if (p) { p.name = n; p.description = description; }
    if (this.serverOk) { writeLS(LS_WS, this.ws); this.emit(); } else await this._local();
  }
  /** Borra el proyecto: sus chats quedan sin proyecto (no se borran). */
  async deleteProject(id) {
    if (this.serverOk) await this._api(`/api/projects/${encodeURIComponent(id)}/delete`, {});
    this.ws.projects = this.ws.projects.filter((x) => x.id !== id);
    for (const c of this.chats) if (c.projectId === id) { c.projectId = null; this.save(c); }
    if (this.serverOk) { writeLS(LS_WS, this.ws); this.emit(); } else await this._local();
  }
  /** Mueve un chat a un proyecto (o lo saca con null). */
  async setChatProject(chat, projectId) {
    if (this.serverOk) await this._api('/api/projects/assign', { chatId: chat.id, projectId: projectId || null, title: chat.title });
    chat.projectId = projectId || null;
    this.save(chat);
  }

  save(chat, { immediate = false } = {}) {
    if (!chat || chat.incognito) return;
    chat.updatedAt = Date.now();
    if (!this.get(chat.id)) this.chats.unshift(chat);
    this._persistLocal();
    if (this.uid && this.remoteOk) {
      clearTimeout(this._timers.get(chat.id));
      const run = async () => {
        try {
          const { fs, db } = await getStore();
          await fs.setDoc(fs.doc(db, 'users', this.uid, 'chats', chat.id), serializeChat(chat));
          chat.uploaded = true;
        } catch (e) { console.warn('[chats] no se pudo sincronizar', e && e.code); }
      };
      if (immediate) run(); else this._timers.set(chat.id, setTimeout(run, 1200));
    }
    this.emit();
  }

  async remove(id) {
    this.chats = this.chats.filter((c) => c.id !== id);
    this._persistLocal();
    if (this.uid && this.remoteOk) {
      try { const { fs, db } = await getStore(); await fs.deleteDoc(fs.doc(db, 'users', this.uid, 'chats', id)); } catch {}
    }
    this.emit();
  }

  async clearAll() {
    const ids = this.chats.map((c) => c.id);
    this.chats = [];
    this._persistLocal();
    if (this.uid && this.remoteOk) {
      try { const { fs, db } = await getStore(); const b = fs.writeBatch(db); ids.slice(0, 450).forEach((id) => b.delete(fs.doc(db, 'users', this.uid, 'chats', id))); await b.commit(); } catch {}
    }
    this.emit();
  }

  _persistLocal() {
    const keep = this.list().slice(0, MAX_LOCAL).map((c) => ({ ...serializeChat(c), uploaded: c.uploaded }));
    if (!writeLS(LS_CHATS, keep)) writeLS(LS_CHATS, keep.slice(0, 15));
  }

  async saveWorkspace() {
    writeLS(LS_WS, this.ws);
    if (this.uid && this.remoteOk !== false) {
      try {
        const { fs, db } = await getStore();
        // Con el servidor activo, memoria y proyectos viven en D1: el resto del espacio se guarda sin pisar esos campos.
        if (this.serverOk) {
          const { memory, projects, memoryOn, ...rest } = JSON.parse(JSON.stringify(this.ws));
          await fs.setDoc(fs.doc(db, 'users', this.uid, 'private', 'workspace'), rest, { merge: true });
        } else await fs.setDoc(fs.doc(db, 'users', this.uid, 'private', 'workspace'), JSON.parse(JSON.stringify(this.ws)));
      } catch (e) { console.warn('[workspace] no se pudo sincronizar', e && e.code); }
    }
    this.emit();
  }

  /* ---------- Compartir (solo lectura) ---------- */
  async share(chat, owner) {
    const { fs, db } = await getStore();
    const id = chat.shareId || crypto.getRandomValues(new Uint32Array(3)).reduce((a, n) => a + n.toString(36), '').slice(0, 18);
    const data = serializeChat(chat);
    await fs.setDoc(fs.doc(db, 'shares', id), {
      ownerUid: owner.uid, title: data.title, createdAt: fs.serverTimestamp(),
      messages: data.messages.map((m) => ({ role: m.role, content: m.content, agent: m.agent, kind: m.kind, transcript: m.voice ? m.voice.transcript : null })).slice(-120)
    });
    chat.shareId = id;
    this.save(chat);
    return `${location.origin}/compartido/?id=${id}`;
  }
  async unshare(chat) {
    if (!chat.shareId) return;
    const { fs, db } = await getStore();
    await fs.deleteDoc(fs.doc(db, 'shares', chat.shareId));
    chat.shareId = null;
    this.save(chat);
  }

  /* ---------- Automatizaciones (se ejecutan cuando el servidor esté activo) ---------- */
  async listAutomations() {
    if (!this.uid) return readLS('ac.auto.v1', []);
    try {
      const { fs, db } = await getStore();
      const s = await fs.getDocs(fs.collection(db, 'users', this.uid, 'automations'));
      return s.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch { return readLS('ac.auto.v1', []); }
  }
  async saveAutomation(a) {
    const clean = { title: String(a.title).slice(0, 120), prompt: String(a.prompt).slice(0, 4000), schedule: a.schedule, time: a.time, active: a.active !== false, createdAt: a.createdAt || Date.now(), status: 'esperando-servidor' };
    if (!this.uid) { const l = readLS('ac.auto.v1', []).filter((x) => x.id !== a.id); l.push({ id: a.id, ...clean }); writeLS('ac.auto.v1', l); return; }
    const { fs, db } = await getStore();
    await fs.setDoc(fs.doc(db, 'users', this.uid, 'automations', a.id), clean);
  }
  async deleteAutomation(id) {
    if (!this.uid) { writeLS('ac.auto.v1', readLS('ac.auto.v1', []).filter((x) => x.id !== id)); return; }
    const { fs, db } = await getStore();
    await fs.deleteDoc(fs.doc(db, 'users', this.uid, 'automations', id));
  }
}
