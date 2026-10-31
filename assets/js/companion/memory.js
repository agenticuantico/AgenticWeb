/**
 * Memoria de largo plazo de la Compañera (solo con cuenta y con permiso explícito).
 *  users/{uid}/companion_memory/{id}: { kind, text, createdAt, updatedAt, source }
 *  users/{uid}/private/companion:     { optIn, lastCallAt, usage: { day, seconds } }
 */
import { getStore } from '../firebase.js';

export const LIMIT_MIN = { gratis: 10, pro: 120, empresa: 300 };

export async function getSettings(uid) {
  if (!uid) return localSettings();
  try {
    const { fs, db } = await getStore();
    const s = await fs.getDoc(fs.doc(db, 'users', uid, 'private', 'companion'));
    return s.exists() ? s.data() : {};
  } catch { return localSettings(); }
}
export async function saveSettings(uid, patch) {
  if (!uid) { const cur = localSettings(); localStorage.setItem('ac.companion', JSON.stringify({ ...cur, ...patch })); return; }
  const { fs, db } = await getStore();
  await fs.setDoc(fs.doc(db, 'users', uid, 'private', 'companion'), patch, { merge: true });
}
function localSettings() { try { return JSON.parse(localStorage.getItem('ac.companion') || '{}'); } catch { return {}; } }

export async function listMemory(uid) {
  if (!uid) return [];
  const { fs, db } = await getStore();
  const s = await fs.getDocs(fs.query(fs.collection(db, 'users', uid, 'companion_memory'), fs.orderBy('updatedAt', 'desc'), fs.limit(200)));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function addFacts(uid, facts, existing = []) {
  if (!uid || !facts.length) return 0;
  const { fs, db } = await getStore();
  const b = fs.writeBatch(db);
  let n = 0;
  for (const f of facts) {
    const same = existing.find((e) => e.kind === f.kind && (e.kind === 'nombre' || e.text.toLowerCase() === f.text.toLowerCase()));
    if (same) { b.update(fs.doc(db, 'users', uid, 'companion_memory', same.id), { text: f.text.slice(0, 200), updatedAt: fs.serverTimestamp() }); }
    else { b.set(fs.doc(fs.collection(db, 'users', uid, 'companion_memory')), { kind: f.kind, text: f.text.slice(0, 200), source: f.source || 'llamada', createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp() }); n++; }
  }
  await b.commit();
  return n;
}
export async function updateMemory(uid, id, text) {
  const { fs, db } = await getStore();
  await fs.updateDoc(fs.doc(db, 'users', uid, 'companion_memory', id), { text: String(text).slice(0, 200), updatedAt: fs.serverTimestamp() });
}
export async function deleteMemory(uid, id) {
  const { fs, db } = await getStore();
  await fs.deleteDoc(fs.doc(db, 'users', uid, 'companion_memory', id));
}
export async function deleteAllMemory(uid) {
  const items = await listMemory(uid);
  const { fs, db } = await getStore();
  const b = fs.writeBatch(db);
  items.slice(0, 450).forEach((m) => b.delete(fs.doc(db, 'users', uid, 'companion_memory', m.id)));
  await b.commit();
}

/** Uso diario (límite suave en el cliente; el servidor lo hace cumplir cuando está activo). */
export function usageToday() {
  const day = new Date().toLocaleDateString('en-CA');
  try { const u = JSON.parse(localStorage.getItem('ac.callUsage') || '{}'); return u.day === day ? u.seconds : 0; } catch { return 0; }
}
export function addUsage(seconds) {
  const day = new Date().toLocaleDateString('en-CA');
  const cur = usageToday();
  try { localStorage.setItem('ac.callUsage', JSON.stringify({ day, seconds: cur + Math.round(seconds) })); } catch {}
}
