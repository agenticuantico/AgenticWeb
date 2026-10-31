/**
 * Cuentas: Firebase Authentication (correo+contraseña con verificación, o Google) + perfil en Firestore.
 */
import { CONFIG } from './config.js';
import { getAuthApi, getStore, friendlyError } from './firebase.js';

const SESSION_FLAG = 'ac.session';
export const TERMS_VERSION = '2026-10-31';

function markSession(on) { try { on ? localStorage.setItem(SESSION_FLAG, '1') : localStorage.removeItem(SESSION_FLAG); } catch {} }
export function mightBeSignedIn() { try { return localStorage.getItem(SESSION_FLAG) === '1'; } catch { return false; } }

/** Observa la sesión. Si force=false y nunca hubo sesión en este dispositivo, no descarga Firebase. */
export async function watchUser(cb, { force = false } = {}) {
  if (!force && !mightBeSignedIn()) { cb(null); return () => {}; }
  try {
    const { fb, auth } = await getAuthApi();
    return fb.onAuthStateChanged(auth, (u) => { markSession(!!u); cb(u); });
  } catch (e) {
    console.warn('[auth] no disponible', e && e.code);
    cb(null);
    return () => {};
  }
}

export async function currentUser() {
  const { auth } = await getAuthApi();
  if (auth.currentUser) return auth.currentUser;
  return new Promise((res) => { const off = auth.onAuthStateChanged((u) => { off(); res(u); }); });
}

export async function signUpEmail({ name, email, password, country }) {
  const { fb, auth } = await getAuthApi();
  const cred = await fb.createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name) await fb.updateProfile(cred.user, { displayName: name.trim().slice(0, 80) });
  try { await fb.sendEmailVerification(cred.user, { url: CONFIG.SITE_URL + '/cuenta/?verificado=1' }); } catch (e) { console.warn('[auth] verificación', e.code); }
  markSession(true);
  const profile = await ensureUserDoc(cred.user, { provider: 'password', name, country, termsAcceptedAt: new Date().toISOString(), termsVersion: TERMS_VERSION });
  return { user: cred.user, profile };
}

export async function signInEmail(email, password) {
  const { fb, auth } = await getAuthApi();
  const cred = await fb.signInWithEmailAndPassword(auth, email.trim(), password);
  markSession(true);
  const profile = await ensureUserDoc(cred.user, {});
  return { user: cred.user, profile };
}

export async function resetPassword(email) {
  const { fb, auth } = await getAuthApi();
  await fb.sendPasswordResetEmail(auth, email.trim(), { url: CONFIG.SITE_URL + '/cuenta/' });
}

export async function resendVerification() {
  const { fb, auth } = await getAuthApi();
  if (auth.currentUser) await fb.sendEmailVerification(auth.currentUser, { url: CONFIG.SITE_URL + '/cuenta/?verificado=1' });
}

/**
 * "Continuar con Google". Pide solo los permisos básicos (perfil y correo).
 * Devuelve { user, isNewUser, granted } para mostrar una confirmación clara.
 */
export async function signInGoogle({ termsAccepted = false, country } = {}) {
  const { fb, auth } = await getAuthApi();
  const provider = new fb.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  let cred;
  try {
    cred = await fb.signInWithPopup(auth, provider);
  } catch (e) {
    if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
      sessionStorage.setItem('ac.googleRedirect', JSON.stringify({ termsAccepted, country }));
      await fb.signInWithRedirect(auth, provider);
      return null; // la página se va a redirigir
    }
    throw e;
  }
  return finishGoogle(fb, cred, { termsAccepted, country });
}

/** Completa un ingreso con Google que volvió por redirección. */
export async function completeGoogleRedirect() {
  const { fb, auth } = await getAuthApi();
  const cred = await fb.getRedirectResult(auth).catch(() => null);
  if (!cred) return null;
  let opts = {};
  try { opts = JSON.parse(sessionStorage.getItem('ac.googleRedirect') || '{}'); sessionStorage.removeItem('ac.googleRedirect'); } catch {}
  return finishGoogle(fb, cred, opts);
}

async function finishGoogle(fb, cred, { termsAccepted, country }) {
  const info = fb.getAdditionalUserInfo(cred) || {};
  markSession(true);
  const extra = { provider: 'google', country };
  if (termsAccepted || info.isNewUser) { extra.termsAcceptedAt = new Date().toISOString(); extra.termsVersion = TERMS_VERSION; }
  const profile = await ensureUserDoc(cred.user, extra);
  return {
    user: cred.user,
    isNewUser: !!info.isNewUser || !!(profile && profile._created),
    granted: ['Nombre y foto de perfil de Google', 'Dirección de correo (verificada por Google)'],
    profile
  };
}

export async function signOutUser() {
  const { fb, auth } = await getAuthApi();
  await fb.signOut(auth);
  markSession(false);
}

/** Crea o actualiza users/{uid}. Si Firestore no está disponible (reglas sin publicar), no rompe el ingreso. */
export async function ensureUserDoc(user, extra = {}) {
  try {
    const { fs, db } = await getStore();
    const ref = fs.doc(db, 'users', user.uid);
    const snap = await fs.getDoc(ref);
    const providerId = (user.providerData[0] && user.providerData[0].providerId) || 'password';
    if (!snap.exists()) {
      const data = {
        name: (extra.name || user.displayName || '').slice(0, 80),
        email: user.email || '',
        photo: user.photoURL || '',
        provider: providerId === 'google.com' ? 'google' : 'password',
        createdAt: fs.serverTimestamp(),
        lastSeen: fs.serverTimestamp(),
        plan: 'gratis',
        planStatus: 'active',
        renewsAt: null,
        expiresAt: null,
        country: (extra.country || guessCountry()).slice(0, 2).toUpperCase(),
        termsAcceptedAt: extra.termsAcceptedAt || null,
        termsVersion: extra.termsVersion || null
      };
      await fs.setDoc(ref, data);
      countSignup(fs, db).catch(() => {});
      return { ...data, _created: true };
    }
    const patch = { lastSeen: fs.serverTimestamp() };
    if (user.photoURL && snap.data().photo !== user.photoURL) patch.photo = user.photoURL;
    if (extra.termsAcceptedAt && !snap.data().termsAcceptedAt) { patch.termsAcceptedAt = extra.termsAcceptedAt; patch.termsVersion = extra.termsVersion; }
    await fs.updateDoc(ref, patch).catch(() => {});
    return { ...snap.data(), ...patch };
  } catch (e) {
    console.warn('[auth] perfil no disponible:', e && e.code);
    return null;
  }
}

async function countSignup(fs, db) {
  const day = new Date().toISOString().slice(0, 10);
  await fs.setDoc(fs.doc(db, 'stats_daily', day), { signups: fs.increment(1) }, { merge: true });
}

export async function getProfile(uid) {
  try {
    const { fs, db } = await getStore();
    const s = await fs.getDoc(fs.doc(db, 'users', uid));
    return s.exists() ? s.data() : null;
  } catch (e) { return { _error: friendlyError(e) }; }
}

/** Administrador = existe admins/{uid} (las reglas solo permiten leerlo a su dueño). */
export async function isAdmin(user) {
  if (!user) return false;
  try {
    const { fs, db } = await getStore();
    const s = await fs.getDoc(fs.doc(db, 'admins', user.uid));
    return s.exists();
  } catch { return false; }
}

/**
 * Alta inicial del dueño: crea admins/{uid} y config/adminBootstrap en una sola escritura.
 * Las reglas lo permiten UNA vez y solo si el token de Firebase trae el correo de Google verificado
 * de la cuenta dueña. También registra el rol en Realtime Database (/admins/{uid}) para la presencia.
 */
export async function bootstrapOwner(user) {
  const { fs, db } = await getStore();
  const b = fs.writeBatch(db);
  b.set(fs.doc(db, 'admins', user.uid), { role: 'owner', email: user.email, createdAt: fs.serverTimestamp() });
  b.set(fs.doc(db, 'config', 'adminBootstrap'), { uid: user.uid, at: fs.serverTimestamp() });
  await b.commit();
  try {
    const { getRtdb } = await import('./firebase.js');
    const { rt, db: rdb } = await getRtdb();
    await rt.set(rt.ref(rdb, 'admins/' + user.uid), true);
  } catch (e) { console.warn('[admin] RTDB', e && e.code); }
}

export function guessCountry() {
  const l = (navigator.language || 'es-AR').split('-')[1];
  return (l && /^[A-Za-z]{2}$/.test(l) ? l : 'AR').toUpperCase();
}

export { friendlyError };
