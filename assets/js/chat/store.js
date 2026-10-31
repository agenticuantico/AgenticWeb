/**
 * Persistencia de chats y del espacio de trabajo.
 *  - Invitado: localStorage (solo en este dispositivo).
 *  - Con cuenta: Firestore users/{uid}/chats/{chatId} y users/{uid}/private/workspace,
 *    con caché local. Si Firestore no responde, sigue funcionando en local.
 *  - Incógnito: nunca se guarda.
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
    this._timers = new Map();
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach((fn) => fn(this)); }

  list() { return [...this.chats].sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt)); }
  get(id) { return this.chats.find((c) => c.id === id) || null; }

  /** Conecta la cuenta: trae chats remotos y sube una vez los locales de invitado. */
  async attachUser(uid) {
    this.uid = uid;
    if (!uid) { this.remoteOk = false; this.chats = readLS(LS_CHATS, []); this.emit(); return; }
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
        await fs.setDoc(fs.doc(db, 'users', this.uid, 'private', 'workspace'), JSON.parse(JSON.stringify(this.ws)));
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
