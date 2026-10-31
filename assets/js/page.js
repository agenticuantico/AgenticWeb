/** Bootstrap for secondary pages (legal, 404): i18n + language selector + PWA. */
import { createI18n, mountLangSwitcher } from './i18n.js';

document.documentElement.classList.add('js');
const i18n = createI18n();
(async () => {
  await i18n.setLang(i18n.lang, { persist: false });
  mountLangSwitcher(document.querySelector('[data-lang-switcher]'), i18n);
})();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
