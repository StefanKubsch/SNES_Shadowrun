// The register compatibility code is gone from the game (docs/REGISTER-COMPAT-BOUNDARY.md,
// 2026-11-27): no src module installs or looks up register-level entries, and the
// register forms used by the frozen tests live in tools/register-forms. The browser
// entries reach nothing in tools/. The live-loop contract keeps the same clean graph, so
// its run from power-on into the main loop proves that live play needs no register form.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

test('the browser game graph reaches nothing in tools/', () => {
  const graph = importGraph(['src/browser/game-worker.mjs', 'src/browser/start.mjs']);
  assert.ok(graph.size > 100, 'the graph reaches the game');
  for (const [file, from] of graph)
    assert.ok(!/^tools\//.test(file), `${file} is imported by ${from}`);
});

test('the live-loop contract runs without register forms', () => {
  const graph = importGraph(['tools/live-loop-services.test.mjs']);
  for (const [file, from] of graph)
    assert.ok(!/^tools\/register-forms\//.test(file), `${file} is imported by ${from}`);
});

test('no src module keeps a register compatibility hook', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'src/system/register-compat.mjs')), false);
  const sources = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.mjs')) sources.push(file);
    }
  };
  walk(path.join(ROOT, 'src'));
  for (const file of sources)
    assert.doesNotMatch(
      fs.readFileSync(file, 'utf8'),
      /\b(?:registerCompat|recordedCallBody|recordedRoutine)\b/,
      file,
    );
});
