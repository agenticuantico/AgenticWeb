/**
 * Pricing cards renderer shared by the landing page and /app/ plans view.
 * Prices come from config.js (PRICING). No amounts are hard-coded here.
 */
import { PRICING, arsPrice, formatPrice } from './config.js';

const FEATURES = { free: 3, pro: 4, empresa: 4 };
const CURRENCY_KEY = 'ac.currency';

export function getCurrency() {
  try { const c = localStorage.getItem(CURRENCY_KEY); if (c === 'ARS' || c === 'USD') return c; } catch { /* ignore */ }
  return PRICING.DEFAULT_CURRENCY;
}
export function setCurrency(c) { try { localStorage.setItem(CURRENCY_KEY, c); } catch { /* ignore */ } }

export function priceFor(plan, currency) {
  return currency === 'ARS' ? arsPrice(plan) : plan.usd;
}

/**
 * @param {HTMLElement} el container
 * @param {object} o { t, lang, currency, mode: 'site'|'app', currentPlan, onCheckout(planId, provider) }
 */
export function renderPricing(el, o) {
  const { t, lang, currency, mode = 'site', currentPlan = 'free', onCheckout } = o;
  el.innerHTML = '';
  for (const plan of PRICING.PLANS) {
    const card = document.createElement('article');
    card.className = 'plan' + (plan.featured ? ' is-featured' : '');
    card.dataset.plan = plan.id;
    const amount = priceFor(plan, currency);
    const otherCur = currency === 'ARS' ? 'USD' : 'ARS';
    const otherAmt = priceFor(plan, otherCur);
    const priceTxt = plan.usd === 0 ? formatPrice(0, currency, lang) : formatPrice(amount, currency, lang);
    const feats = Array.from({ length: FEATURES[plan.id] || 3 }, (_, i) => t(`plan.${plan.id}.f${i + 1}`));
    card.innerHTML = `
      ${plan.featured ? `<span class="plan-badge"></span>` : ''}
      <h3></h3>
      <p class="plan-desc"></p>
      <div class="plan-price"><strong data-price></strong><span></span></div>
      <p class="plan-alt"></p>
      <ul></ul>
      <div class="plan-actions"></div>`;
    if (plan.featured) card.querySelector('.plan-badge').textContent = t('pricing.popular');
    card.querySelector('h3').textContent = plan.name;
    card.querySelector('.plan-desc').textContent = t(`plan.${plan.id}.desc`);
    card.querySelector('[data-price]').textContent = priceTxt;
    card.querySelector('.plan-price span').textContent = `${currency} ${t('pricing.perMonth')}`;
    card.querySelector('.plan-alt').textContent = plan.usd === 0 ? t('pricing.forever') : `≈ ${formatPrice(otherAmt, otherCur, lang)} ${otherCur}`;
    const ul = card.querySelector('ul');
    feats.forEach((f) => { const li = document.createElement('li'); li.textContent = f; ul.appendChild(li); });
    const actions = card.querySelector('.plan-actions');

    if (mode === 'site') {
      const a = document.createElement('a');
      a.className = 'btn ' + (plan.featured ? 'btn-primary' : 'btn-ghost');
      a.href = `/app/#/plans?plan=${plan.id}`;
      a.textContent = plan.usd === 0 ? t('pricing.startFree') : t('pricing.choose', { plan: plan.name });
      actions.appendChild(a);
    } else {
      actions.className = 'plan-actions plan-actions-app';
      if (plan.usd === 0) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn btn-ghost';
        b.textContent = currentPlan === 'free' ? t('pricing.current') : t('pricing.startFree');
        b.disabled = currentPlan === 'free';
        actions.appendChild(b);
      } else if (currentPlan === plan.id) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-ghost'; b.disabled = true; b.textContent = t('pricing.current'); actions.appendChild(b);
      } else {
        const mp = document.createElement('button');
        mp.type = 'button'; mp.className = 'btn btn-mp'; mp.dataset.provider = 'mercadopago';
        mp.textContent = t('pricing.payMP', { amount: formatPrice(arsPrice(plan), 'ARS', lang) });
        const pp = document.createElement('button');
        pp.type = 'button'; pp.className = 'btn btn-pp'; pp.dataset.provider = 'paypal';
        pp.textContent = t('pricing.payPP', { amount: formatPrice(plan.usd, 'USD', lang) });
        [mp, pp].forEach((b) => b.addEventListener('click', () => onCheckout && onCheckout(plan.id, b.dataset.provider, b)));
        // Show the provider matching the selected currency first.
        if (currency === 'USD') actions.append(pp, mp); else actions.append(mp, pp);
      }
    }
    el.appendChild(card);
  }
}

export function mountCurrencyToggle(root, onChange) {
  if (!root) return;
  const btns = [...root.querySelectorAll('[data-currency]')];
  const set = (c) => { btns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.currency === c))); };
  set(getCurrency());
  btns.forEach((b) => b.addEventListener('click', () => { setCurrency(b.dataset.currency); set(b.dataset.currency); onChange(b.dataset.currency); }));
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const cur = getCurrency(); const next = cur === 'ARS' ? 'USD' : 'ARS';
    setCurrency(next); set(next); onChange(next); root.querySelector(`[data-currency="${next}"]`).focus();
  });
}
