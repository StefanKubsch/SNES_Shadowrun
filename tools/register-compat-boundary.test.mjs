// The register-level compatibility entries stay outside the live import graph
// (docs/REGISTER-COMPAT-BOUNDARY.md). The browser entries reach none of them, and
// neither proof/ nor tools/. The live-loop contract keeps the same clean graph, so
// its run from power-on into the main loop proves that live play never needs an
// installed compatibility entry.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerCompat, installRegisterCompat } from '../src/system/register-compat.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTER_MODULES = [
  'src/system/nmi-call.mjs',
  'src/system/native-dialog-support.mjs',
  'src/system/main-wait-interrupt.mjs',
  'src/system/native-call-continuation.mjs',
];
const SPECIFIER =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

// Static relative imports from the entries, with the importer of each module.
function importGraph(entries) {
  const parent = new Map();
  const visit = (file, from) => {
    if (parent.has(file)) return;
    parent.set(file, from);
    for (const m of fs.readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (!spec.startsWith('.')) continue;
      const next = path.resolve(path.dirname(file), spec);
      if (fs.existsSync(next)) visit(next, file);
    }
  };
  for (const entry of entries) visit(path.resolve(ROOT, entry), null);
  const rel = (file) => path.relative(ROOT, file).replaceAll('\\', '/');
  return new Map([...parent].map(([file, from]) => [rel(file), from && rel(from)]));
}

function assertClean(entries) {
  const graph = importGraph(entries);
  assert.ok(graph.size > 100, 'the graph reaches the game');
  for (const [file, from] of graph) {
    assert.ok(!REGISTER_MODULES.includes(file), `${file} is imported by ${from}`);
    assert.ok(!/^(proof|tools)\//.test(file), `${file} is imported by ${from}`);
  }
  assert.ok(graph.has('src/system/register-compat.mjs'), 'live modules keep the hook');
}

test('the browser game graph contains no register compatibility module', () => {
  assertClean(['src/browser/game-worker.mjs', 'src/browser/start.mjs']);
});

test('the live-loop contract runs without installed compatibility entries', () => {
  const graph = importGraph(['tools/live-loop-services.test.mjs']);
  graph.delete('tools/live-loop-services.test.mjs');
  graph.delete('tools/cartridge-harness.mjs');
  for (const [file, from] of graph) {
    assert.ok(!REGISTER_MODULES.includes(file), `${file} is imported by ${from}`);
    assert.ok(!/^proof\//.test(file), `${file} is imported by ${from}`);
  }
});

test('a missing compatibility entry stops, an installed one is returned', () => {
  assert.throws(() => registerCompat('boundaryProbe'), { reason: 'register_compat_required' });
  const probe = () => 'probe';
  installRegisterCompat({ boundaryProbe: probe });
  assert.equal(registerCompat('boundaryProbe'), probe);
});
