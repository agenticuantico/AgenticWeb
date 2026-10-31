/**
 * Static checks, no dependencies: node tools/check.mjs
 * - JSON files parse; i18n dictionaries have identical keys in es-AR / en / pt-BR
 * - every data-i18n key used in HTML exists
 * - commercial mailto is exact; CNAME is correct
 * - no secrets or private data patterns in the public repo
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const check = (name, cond, info = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? ' — ' + info : ''}`); if (!cond) failed++; };
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  if (['node_modules', '.git'].includes(e.name)) return [];
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : [p];
});
const files = walk(ROOT);
const rel = (f) => path.relative(ROOT, f);

for (const f of files.filter((f) => /\.(json|webmanifest)$/.test(f))) {
  try { JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { check(`valid JSON ${rel(f)}`, false, e.message); }
}
for (const dir of ['assets/i18n', 'app/i18n']) {
  const d = Object.fromEntries(['es-AR', 'en', 'pt-BR'].map((l) => [l, JSON.parse(fs.readFileSync(path.join(ROOT, dir, `${l}.json`), 'utf8'))]));
  const base = Object.keys(d['es-AR']).sort().join('|');
  check(`${dir}: same keys in es-AR/en/pt-BR`, Object.values(d).every((x) => Object.keys(x).sort().join('|') === base));
}
const siteKeys = new Set([...Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/i18n/es-AR.json'), 'utf8'))), ...Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'app/i18n/es-AR.json'), 'utf8')))]);
for (const f of files.filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(f, 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map((m) => m[1]);
  const attrKeys = [...html.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap((m) => m[1].split(';').map((p) => p.split(':')[1]));
  const missing = [...keys, ...attrKeys].filter((k) => !siteKeys.has(k));
  check(`${rel(f)}: all i18n keys exist`, missing.length === 0, missing.join(', '));
  const mailtos = [...html.matchAll(/href="(mailto:[^"]*subject[^"]*)"/g)].map((m) => m[1]);
  check(`${rel(f)}: commercial mailto exact`, mailtos.every((m) => m === 'mailto:agenticuantico@gmail.com?subject=Consulta%20Comercial'));
}
check('CNAME', fs.readFileSync(path.join(ROOT, 'CNAME'), 'utf8').trim() === 'agenticuantico.dev.ar');

const FORBIDDEN = [
  [/sk-[A-Za-z0-9_-]{20,}/, 'OpenAI-style key'], [/APP_USR-[0-9a-f-]{20,}/i, 'Mercado Pago token'], [/TEST-\d{10,}/, 'Mercado Pago test token'],
  [/xi-api-key\s*[:=]\s*['"][A-Za-z0-9]{16,}/i, 'ElevenLabs key'], [/AKIA[0-9A-Z]{16}/, 'AWS key'], [/ghp_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'], [/\+?54\s?9?\s?\d{3}\s?\d{3}[\s-]?\d{4}/, 'Argentine phone number']
];
const textFiles = files.filter((f) => /\.(html|js|mjs|css|json|md|txt|xml|yml|yaml|py|webmanifest|svg)$/.test(f) && !f.includes('/vendor/'));
for (const [re, label] of FORBIDDEN) {
  const hits = textFiles.filter((f) => !f.endsWith('tools/check.mjs') && re.test(fs.readFileSync(f, 'utf8'))).map(rel);
  check(`no ${label} in repo`, hits.length === 0, hits.join(', '));
}
console.log(failed ? `\n${failed} check(s) failed` : '\nAll static checks passed');
process.exit(failed ? 1 : 0);
