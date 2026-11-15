import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

// src holds exactly the shipped game: every module there is reached by a static
// import chain from the page, worker or audio worklet entry, and none of them
// imports from proof/. Proof models used only by tools and tests live in proof/
// (user decision 2026-11-01).
const entries = [
  'src/browser/start.mjs',
  'src/browser/game-worker.mjs',
  'src/browser/audio-worklet.mjs',
];
const importPattern =
  /(?:(?:import|export)\s[^'";]*?from\s*|import\s*\(\s*|import\s+|new URL\(\s*)(['"])(\.{1,2}\/[^'"]+)\1/g;
const local = (path) => relative(process.cwd(), path).split('\\').join('/');
function modules(directory) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...modules(path));
    else if (entry.name.endsWith('.mjs')) found.push(local(path));
  }
  return found;
}
function imports(file) {
  return [...readFileSync(file, 'utf8').matchAll(importPattern)].map((m) =>
    local(resolve(dirname(file), m[2])),
  );
}

test('every src module is loaded by the game and none imports proof code', () => {
  const reached = new Set(entries),
    pending = [...entries],
    proofImports = [],
    missing = [];
  while (pending.length) {
    const file = pending.pop();
    for (const target of imports(file)) {
      if (target.startsWith('proof/')) proofImports.push(`${file} -> ${target}`);
      else if (!existsSync(target)) missing.push(`${file} -> ${target}`);
      else if (!reached.has(target)) (reached.add(target), pending.push(target));
    }
  }
  assert.deepEqual(proofImports, [], 'game modules must not import proof/');
  assert.deepEqual(missing, [], 'game imports resolve');
  const unreached = modules('src').filter((file) => !reached.has(file));
  assert.deepEqual(unreached, [], 'modules the game never loads belong in proof/');
});

test('atomic task plan APIs belong in proof modules', () => {
  const planApi = /\b(?:prepareTask\w*|commitTaskPlan|isLatestCommittedTaskPlan)\b/;
  for (const file of modules('src')) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(
      /\bexport\s+(?:function\s+([\w$]+)|(?:const|let|var)\s+([\w$]+)|\{([^}]+)\})/g,
    )) {
      assert.doesNotMatch(match[1] ?? match[2] ?? match[3], planApi, file);
    }
  }
});
