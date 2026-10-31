// Pruebas del runner de agentes: node --test agents/runner/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathAllowed, hasSecret, unsafeWebContent, pickRoles, parsePlan, applyChanges, callModel, ModelsUnavailable, ROLES } from './run-agents.mjs';

test('rutas permitidas y bloqueadas', () => {
  assert.equal(pathAllowed('brain/journal/2026-10-31.md', 'dev'), true);
  assert.equal(pathAllowed('docs/nuevo.md', 'dev'), true);
  assert.equal(pathAllowed('.github/workflows/x.yml', 'dev'), false);
  assert.equal(pathAllowed('worker-v2/wrangler.toml', 'dev'), false);
  assert.equal(pathAllowed('.env', 'dev'), false);
  assert.equal(pathAllowed('../fuera.md', 'dev'), false);
  assert.equal(pathAllowed('index.html', 'web'), true);
  assert.equal(pathAllowed('CNAME', 'web'), false);
  assert.equal(pathAllowed('agents-status.json', 'web'), false);
  assert.equal(pathAllowed('app/engine.js', 'web'), false);
});

test('detecta secretos y datos bloqueados', () => {
  assert.equal(hasSecret('token ghp_' + 'a'.repeat(30)), true);
  assert.equal(hasSecret('-----BEGIN RSA PRIVATE KEY-----'), true);
  assert.equal(hasSecret('tel +54 291 ' + '419-' + '4238'), true);
  assert.equal(hasSecret('Texto normal sobre AgentiCuántico'), false);
  assert.equal(unsafeWebContent('<p onclick="x()">'), true);
  assert.equal(unsafeWebContent('<p aria-label="Hola">Hola</p>'), false);
});

test('rotación de roles', () => {
  const a = pickRoles(0, 2).map((r) => r.id), b = pickRoles(1, 2).map((r) => r.id);
  assert.equal(a.length, 2); assert.notDeepEqual(a, b);
  const all = new Set(); for (let i = 0; i < 4; i++) pickRoles(i, 2).forEach((r) => all.add(r.id));
  assert.equal(all.size, ROLES.length);
  assert.deepEqual(pickRoles(5, 2, 'frontend').map((r) => r.id), ['frontend']);
});

test('parsea el plan JSON (también con cercas de código)', () => {
  const p = parsePlan('```json\n{"title":"T","summary":"S","changes":[{"action":"create","path":"docs/a.md","content":"x"}]}\n```');
  assert.equal(p.title, 'T'); assert.equal(p.changes.length, 1);
});

test('aplica ediciones y creaciones con reglas', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ag-'));
  mkdirSync(join(dir, 'docs'));
  writeFileSync(join(dir, 'docs', 'a.md'), 'Hola mundo cruel\n');
  const t = applyChanges([{ action: 'edit', path: 'docs/a.md', find: 'mundo cruel', replace: 'mundo amable' }, { action: 'create', path: 'docs/b.md', content: '# B' }], { kind: 'dev', root: dir, maxFiles: 3 });
  assert.deepEqual(t, ['docs/a.md', 'docs/b.md']);
  assert.equal(readFileSync(join(dir, 'docs', 'a.md'), 'utf8'), 'Hola mundo amable\n');
  assert.throws(() => applyChanges([{ action: 'create', path: '.github/workflows/x.yml', content: 'x' }], { kind: 'dev', root: dir }), /no permitida/);
  assert.throws(() => applyChanges([{ action: 'edit', path: 'docs/a.md', find: 'no existe este texto', replace: 'x' }], { kind: 'dev', root: dir }), /0 veces/);
  assert.throws(() => applyChanges([{ action: 'create', path: 'docs/c.md', content: 'ghp_' + 'b'.repeat(30) }], { kind: 'dev', root: dir }), /seguridad/);
  assert.throws(() => applyChanges([1, 2, 3, 4].map((i) => ({ action: 'create', path: `docs/z${i}.md`, content: 'x' })), { kind: 'dev', root: dir, maxFiles: 3 }), /demasiados/);
});

test('GitHub Models no disponible se informa sin fallar', async () => {
  const fetchFn = async () => new Response('{"error":{"code":"unauthorized"}}', { status: 401 });
  await assert.rejects(() => callModel([{ role: 'user', content: 'hola' }], { fetchFn, retries: 0 }), (e) => e instanceof ModelsUnavailable && e.status === 401);
  const plain = async () => new Response('OK', { status: 200, headers: { 'content-type': 'text/plain' } });
  await assert.rejects(() => callModel([{ role: 'user', content: 'hola' }], { fetchFn: plain, retries: 0 }), (e) => e instanceof ModelsUnavailable && /text\/plain/.test(e.detail));
  let n = 0; const fallback = async (url) => { n++; return /azure/.test(url) ? new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":1}' } }] }), { status: 200 }) : new Response('OK', { status: 200 }); };
  assert.equal(await callModel([{ role: 'user', content: 'hola' }], { fetchFn: fallback, retries: 0 }), '{"ok":1}'); assert.equal(n, 2);
  const down = async (url) => { if (/azure/.test(url)) throw new TypeError('fetch failed'); return new Response('OK', { status: 200 }); };
  await assert.rejects(() => callModel([{ role: 'user', content: 'hola' }], { fetchFn: down, retries: 0 }), (e) => e instanceof ModelsUnavailable && /fetch failed/.test(e.detail));
  const ok = async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"title":"x","summary":"y","changes":[]}' } }] }), { status: 200 });
  assert.match(await callModel([{ role: 'user', content: 'hola' }], { fetchFn: ok }), /"title"/);
});

test('estado público: mezcla ejecución y PRs sin datos privados', async () => {
  const { merge } = await import('./update-status.mjs');
  const now = Date.parse('2026-10-31T18:00:00Z');
  const run = { at: '2026-10-31T17:00:00Z', roles: [{ role: 'frontend', status: 'pr-opened', title: 'Mejorar foco visible', at: '2026-10-31T17:00:00Z', pr: 'https://github.com/agenticuantico/AgenticDev/pull/3' }, { role: 'backend', status: 'models-unavailable', at: '2026-10-31T17:00:00Z' }] };
  const prs = [{ title: '[Diseñador Web] Ajustar espaciado', created_at: '2026-10-31T16:00:00Z', state: 'open', html_url: 'https://github.com/agenticuantico/AgenticWeb/pull/7', labels: [{ name: 'agente/disenador-web' }] }];
  const s = merge({ agents: [] }, run, prs, now);
  assert.equal(s.agents.length, 8);
  const fe = s.agents.find((a) => a.id === 'frontend');
  assert.equal(fe.status, 'activo'); assert.equal(fe.pr, null); // PR privada: no se publica el enlace
  assert.match(fe.last_activity, /Mejorar foco visible/);
  assert.equal(s.agents.find((a) => a.id === 'backend').status, 'espera');
  const dw = s.agents.find((a) => a.id === 'disenador-web');
  assert.equal(dw.status, 'revision'); assert.equal(dw.pr, 'https://github.com/agenticuantico/AgenticWeb/pull/7');
});
