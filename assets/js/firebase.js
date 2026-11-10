/**
 * Carga perezosa de Firebase (autoalojado en /assets/vendor/firebase/).
 * Nada de Firebase se descarga hasta que una función lo necesita.
 */
import { CONFIG } from './config.js';

let appP, authP, storeP, rtdbP;

export function getFirebase() {
  if (!appP) {
    appP = import('/assets/vendor/firebase/core.js').then((fb) => {
      const app = fb.getApps().length ? fb.getApp() : fb.initializeApp(CONFIG.FIREBASE);
      return { fb, app };
    });
  }
  return appP;
}
export function getAuthApi() {
  if (!authP) {
    authP = getFirebase().then(({ fb, app }) => {
      const auth = fb.getAuth(app);
      auth.languageCode = 'es';
      return { fb, auth };
    });
  }
  return authP;
}
export function getStore() {
  if (!storeP) storeP = Promise.all([getFirebase(), import('/assets/vendor/firebase/store.js')]).then(([{ app }, fs]) => ({ fs, db: fs.getFirestore(app) }));
  return storeP;
}
export function getRtdb() {
  if (!rtdbP) rtdbP = Promise.all([getFirebase(), import('/assets/vendor/firebase/rtdb.js')]).then(([{ app }, rt]) => ({ rt, db: rt.getDatabase(app, CONFIG.FIREBASE.databaseURL) }));
  return rtdbP;
}

/** Mensajes de error amables (sin detalles técnicos). */
export function friendlyError(e) {
  const code = (e && (e.code || e.message)) || '';
  const map = {
    'auth/invalid-email': 'El correo no es válido.',
    'auth/missing-password': 'Ingresa tu contraseña.',
    'auth/weak-password': 'La contraseña es muy débil: usa al menos 8 caracteres con letras y números.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Prueba ingresar o recuperar la contraseña.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'Correo o contraseña incorrectos.',
    'auth/user-disabled': 'Esta cuenta está suspendida. Escríbenos desde el formulario de contacto.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos y vuelve a intentar.',
    'auth/network-request-failed': 'No hay conexión con el servicio de cuentas. Revisa tu internet.',
    'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
    'auth/cancelled-popup-request': 'Se canceló el inicio con Google.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Te redirigimos para continuar.',
    'auth/unauthorized-domain': 'Este dominio todavía no está autorizado para iniciar sesión.',
    'auth/operation-not-allowed': 'Este método de ingreso no está habilitado todavía.',
    'auth/requires-recent-login': 'Por seguridad, vuelve a iniciar sesión y repite la acción.',
    'auth/account-exists-with-different-credential': 'Ese correo ya está registrado con otro método. Ingresa con correo y contraseña.',
    'permission-denied': 'El servicio de datos todavía no está habilitado para esta acción.',
    'unavailable': 'El servicio de datos no responde. Prueba en un momento.'
  };
  for (const [k, v] of Object.entries(map)) if (code.includes(k)) return v;
  return 'No pudimos completar la acción. Prueba de nuevo en un momento.';
}
