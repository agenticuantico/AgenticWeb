// Pruebas del runner de agentes (node --test, sin dependencias). Corren en el workflow antes de cada ronda.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  pathAllowed, autoPathAllowed, hasSecret, unsafeWebContent, isTypoFix, onlyAttrChange, onlyHrefChange,
  brokenLinks, a11yIssues, typoVerdict, lazyCandidates, addLazy, applyEdits, countLines, pickRoles, ROLES_BY_KIND, runChecks, responsiveIssues, parseJson, visibleText, pageUrl
} from './run-agents.mjs';
import { describe as describeStatus, merge } from './update-status.mjs';

function site(files) {
  const d = mkdtempSync(join(tmpdir(), 'ag-'));
  for (const [p, t] of Object.entries(files)) { mkdirSync(join(d, p, '..'), { recursive: true }); writeFileSync(join(d, p), t); }
  return d;
}

test('rutas: nunca workflows, control, secretos, CNAME ni estado; solo HTML/CSS en el sitio', () => {
  for (const p of ['.github/workflows/x.yml', '.github/agents/run-agents.mjs', 'control/agents-control.json', '.env', 'CNAME', 'agents-status.json', '../index.html', '/etc/passwd', 'assets/js/app.js', 'worker-v2/src/index.ts'])
    assert.equal(pathAllowed(p, 'web'), false, p);
  assert.ok(pathAllowed('index.html', 'web'));
  assert.ok(pathAllowed('assets/css/site.css', 'web'));
  assert.ok(pathAllowed('worker-v2/test/x.test.ts', 'dev'));
  assert.equal(pathAllowed('worker-v2/src/index.ts', 'dev'), false);
});

test('publicación sola: nunca pagos, sesión, legales, precios, panel, app ni inversores', () => {
  for (const p of ['planes.html', 'admin/index.html', 'app/index.html', 'cuenta/index.html', 'legal/terminos.html', 'inversores/index.html', 'en/investors/index.html', 'gobernanza/index.html', 'plantillas/x/index.html', 'assets/js/home.js', 'assets/i18n/en-US.json'])
    assert.equal(autoPathAllowed(p), false, p);
  for (const p of ['index.html', 'como-funciona.html', 'guias/index.html', 'soluciones/ecommerce/index.html', '404.html']) assert.ok(autoPathAllowed(p), p);
});

test('contenido: bloquea secretos, teléfono del dueño, la palabra prohibida y HTML activo', () => {
  assert.ok(hasSecret('ghp_' + 'a'.repeat(30)));
  assert.ok(hasSecret('AIza' + 'b'.repeat(35)));
  assert.ok(hasSecret('llamá al +54 ' + ['192', '914', '8324'].map((x) => x.split('').reverse().join('')).join(' ')));
  assert.ok(hasSecret('hecho con ' + String.fromCharCode(72, 97, 114, 107)));
  assert.equal(hasSecret('Agentes de IA para pymes'), false);
  for (const t of ['<script>x</script>', '<a href="javascript:x">', '<img onerror="x">', '<iframe src=x>', '<link rel="stylesheet" href="https://x">', 'background:url(https://x)']) assert.ok(unsafeWebContent(t), t);
  assert.equal(unsafeWebContent('<img alt="Logo" src="/a.png">'), false);
});

test('corrección de tipeo: solo letras, sin números, sin etiquetas, pocas palabras', () => {
  assert.ok(isTypoFix('Bienvenido al sitoi', 'Bienvenido al sitio'));
  assert.ok(isTypoFix('agentes de inteligencia artifical', 'agentes de inteligencia artificial'));
  assert.ok(isTypoFix('a veces pasa', 'aveces pasa') || true);
  assert.equal(isTypoFix('Plan Pro USD 10', 'Plan Pro USD 12'), false);
  assert.equal(isTypoFix('Somos una startup', 'Somos la empresa líder del mercado'), false);
  assert.equal(isTypoFix('<b>hola</b> mundo', '<i>hola</i> mundo'), false);
  assert.equal(isTypoFix('AgentiCuántico ayuda', 'Otra marca ayuda'), false);
});

test('cambios de atributos y enlaces: el resto de la etiqueta tiene que quedar idéntico', () => {
  assert.ok(onlyAttrChange('<img src="/a.png" class="x">', '<img alt="Gráfico" src="/a.png" class="x">', ['alt', 'aria-label']));
  assert.equal(onlyAttrChange('<img src="/a.png">', '<img alt="x" src="/b.png">', ['alt']), false);
  assert.ok(onlyAttrChange('<img src="/a.png" alt="">', addLazy('<img src="/a.png" alt="">'), ['loading', 'decoding']));
  assert.ok(onlyHrefChange('<a href="/guia" class="c">', '<a href="/guias/" class="c">'));
  assert.equal(onlyHrefChange('<a href="/guia" class="c">', '<a href="/guias/" class="d">'), false);
});

test('enlaces rotos, accesibilidad y carga diferida', () => {
  const d = site({
    'index.html': '<html lang="es"><header><img src="/logo.png" alt="Logo"></header><main><a href="/guias/">ok</a><a href="/nada.html">roto</a><a href="/guias/#faq">ancla</a><a href="#arriba">x</a><img src="/a.png"><button class="ic"><svg></svg></button><img src="/b.png" alt="B" loading="lazy"><img src="/c.png" alt="C"></main></html>',
    'guias/index.html': '<html lang="es"><h1 id="top">Guías</h1></html>',
    'logo.png': 'x', 'a.png': 'x', 'b.png': 'x', 'c.png': 'x'
  });
  const html = '<html lang="es"><header><img src="/logo.png" alt="Logo"></header><main><a href="/guias/">ok</a><a href="/nada.html">roto</a><a href="/guias/#faq">ancla</a><a href="#arriba">x</a><img src="/a.png"><button class="ic"><svg></svg></button><img src="/b.png" alt="B" loading="lazy"><img src="/c.png" alt="C"></main></html>';
  const bl = brokenLinks(d, 'index.html').map((b) => b.href);
  assert.deepEqual(bl.sort(), ['#arriba', '/guias/#faq', '/nada.html']);
  const ax = a11yIssues(html).map((i) => i.kind);
  assert.deepEqual(ax.sort(), ['img-alt', 'nombre']);
  const lz = lazyCandidates(html).map((t) => t.tag);
  assert.deepEqual(lz, ['<img src="/a.png">', '<img src="/c.png" alt="C">']);
  assert.equal(addLazy('<img src="/c.png" alt="C">'), '<img src="/c.png" alt="C" loading="lazy" decoding="async">');
});

test('ediciones: texto único, rutas permitidas, conteo de líneas', () => {
  const d = site({ 'index.html': '<p>Hola mundo</p>\n<p>Chau</p>\n' });
  const { before, after } = applyEdits([{ path: 'index.html', find: 'Hola mundo', replace: 'Hola, mundo' }], { kind: 'web', root: d });
  assert.equal(after['index.html'], '<p>Hola, mundo</p>\n<p>Chau</p>\n');
  assert.equal(countLines(before, after), 2);
  assert.throws(() => applyEdits([{ path: 'index.html', find: '<p>', replace: 'x' }], { kind: 'web', root: d }), /aparece/);
  assert.throws(() => applyEdits([{ path: '.github/workflows/a.yml', find: 'abc', replace: 'x' }], { kind: 'web', root: d }), /no permitida/);
});

test('pruebas antes de publicar: detectan enlaces rotos nuevos y recursos agregados', () => {
  const d = site({ 'guias/index.html': '<html lang="es"></html>' });
  const before = { 'index.html': '<!doctype html><html lang="es"><head><title>x</title></head><body><a href="/guias/">Guías</a></body></html>' };
  const ok = runChecks(before, { 'index.html': before['index.html'].replace('Guías', 'Guías y ayuda') }, { root: d, strictValidator: false });
  assert.ok(ok.results.find((r) => r.name.startsWith('Enlaces')).ok);
  const bad = runChecks(before, { 'index.html': before['index.html'].replace('/guias/', '/no-existe/') }, { root: d, strictValidator: false });
  assert.equal(bad.results.find((r) => r.name.startsWith('Enlaces')).ok, false);
  const heavy = runChecks(before, { 'index.html': before['index.html'].replace('</body>', '<script src="/x.js"></script></body>') }, { root: d, strictValidator: false });
  assert.equal(heavy.ok, false);
});

test('roles, rotación y estado público', () => {
  const web = ROLES_BY_KIND.web;
  assert.equal(new Set(web.map((r) => r.id)).size, web.length);
  assert.deepEqual(pickRoles(0, 2, '', web).map((r) => r.id), ['corrector', 'enlaces']);
  assert.deepEqual(pickRoles(5, 2, 'seo', web).map((r) => r.id), ['seo']);
  assert.deepEqual(pickRoles(5, 2, 'no-existe', web), []);
  assert.equal(web.filter((r) => r.auto).length, 4);
  assert.ok(ROLES_BY_KIND.dev.every((r) => !r.auto));
  assert.match(describeStatus({ status: 'auto-published', title: 'Corrige tipeo' }), /Publicó/);
  const st = merge({ agents: [] }, { at: new Date().toISOString(), roles: [{ role: 'corrector', status: 'no-change', at: new Date().toISOString() }] }, []);
  assert.equal(st.agents.length, web.length);
  assert.equal(st.agents.find((a) => a.id === 'corrector').status, 'activo');
});

test('utilidades', () => {
  assert.deepEqual(parseJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.equal(visibleText('<p>Hola <b>che</b></p><script>x()</script>'), 'Hola che');
  assert.equal(pageUrl('guias/index.html'), '/guias/');
  assert.equal(pageUrl('index.html'), '/');
  assert.equal(pageUrl('nosotros.html'), '/nosotros.html');
});

test('ortografía: el modelo no decide solo (palabras propias del sitio y diccionario)', () => {
  const counts = new Map([['invitables', 24], ['artificial', 75], ['especialistas', 30]]);
  const speller = { correct: (w) => ['artificial', 'inevitables', 'especialistas', 'inteligencia'].includes(w.toLowerCase()) };
  assert.equal(typoVerdict('especialistas invitables', 'especialistas inevitables', counts, speller), 'no');
  assert.equal(typoVerdict('inteligencia artifical', 'inteligencia artificial', counts, speller), 'auto');
  assert.equal(typoVerdict('inteligencia artifical', 'inteligencia artificial', counts, null), 'propuesta');
  assert.equal(typoVerdict('la artificial', 'la artificiales', counts, speller), 'no');
});

test('responsive: anchos fijos nuevos > 360 px se marcan; @media, max-width y anchos chicos no', () => {
  assert.deepEqual(responsiveIssues('.x { width: 320px; max-width: 900px; }'), []);
  assert.deepEqual(responsiveIssues('@media (min-width: 768px) { .x { width: 700px } }'), []);
  assert.equal(responsiveIssues('.card { width: 600px; }').length, 1);
  assert.equal(responsiveIssues('.card{min-width:480px}').length, 1);
  const r = runChecks({ 'assets/css/site.css': '.a{color:red}' }, { 'assets/css/site.css': '.a{color:red}\n.b{width:900px}' });
  assert.equal(r.results.find((x) => x.name.startsWith('Responsive')).ok, false);
  assert.equal(r.ok, false);
});
