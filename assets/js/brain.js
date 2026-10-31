/**
 * Public FAQ "brain": keyword/intent matching over a local knowledge JSON.
 * Contains PUBLIC information only. The real agentic brain is private and
 * lives in a separate backend.
 */
import { PRICING, arsPrice } from './config.js';

const cache = new Map();

/** Fills {pro_usd}/{pro_ars}/... placeholders from config.js so answers never drift from prices. */
function fillPrices(text, lang) {
  const nf = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-AR', { maximumFractionDigits: 0 });
  return text.replace(/\{(\w+)_(usd|ars)\}/g, (m, id, cur) => {
    const plan = PRICING.PLANS.find((p) => p.id === id);
    if (!plan) return m;
    return nf.format(cur === 'usd' ? plan.usd : arsPrice(plan));
  });
}

export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function loadKnowledge(lang) {
  if (cache.has(lang)) return cache.get(lang);
  const res = await fetch(`/assets/data/knowledge.${lang}.json`);
  if (!res.ok) throw new Error(`knowledge ${lang}: HTTP ${res.status}`);
  const kb = await res.json();
  kb.intents.forEach((it) => { it._kw = it.keywords.map(normalize); it.answer = fillPrices(it.answer, lang); });
  cache.set(lang, kb);
  return kb;
}

/** Returns {id, text, suggestions, score}. */
export function answer(kb, question) {
  const q = normalize(question);
  const tokens = new Set(q.split(' ').filter((w) => w.length > 1));
  let best = null, bestScore = 0;
  for (const it of kb.intents) {
    let score = 0;
    for (const kw of it._kw) {
      if (kw.includes(' ')) { if (q.includes(kw)) score += 3; continue; }
      if (tokens.has(kw)) { score += 2; continue; }
      if (kw.length >= 5) { for (const t of tokens) { if (t.length >= 4 && (t.startsWith(kw.slice(0, 5)) || kw.startsWith(t.slice(0, 5)))) { score += 1; break; } } }
    }
    score *= it.weight || 1;
    if (score > bestScore) { bestScore = score; best = it; }
  }
  if (!best || bestScore < 1) {
    return { id: 'fallback', text: kb.fallback, suggestions: kb.suggestions.slice(0, 3), score: 0 };
  }
  return { id: best.id, text: best.answer, suggestions: (best.followups || kb.suggestions).slice(0, 3), score: bestScore };
}
