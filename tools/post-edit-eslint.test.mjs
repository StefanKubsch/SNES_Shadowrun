// ESLint check of the shared post-edit hook (tools/hooks/post-edit.mjs):
// the HEAD comparison and the Claude Code and Codex adapters.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findLintIssues } from './hooks/post-edit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = path.join(ROOT, 'tools', 'hooks', 'post-edit.mjs');
const CLAUDE_FEEDBACK_EXIT = 2;
const UNCHANGED_LINE = 3,
  CHANGED_LINE = 7;

const unused = (name, line) => ({
  ruleId: 'no-unused-vars',
  message: `'${name}' is defined but never used.`,
  line,
});

test('Findings on unchanged lines are reported only when HEAD has fewer of that kind', () => {
  const old = unused('OLD', UNCHANGED_LINE),
    fresh = unused('FRESH', UNCHANGED_LINE),
    changed = unused('OLD', CHANGED_LINE);
  const headKeys = new Map([[`${old.ruleId}|${old.message}`, 1]]);
  const onlyLines = new Set([CHANGED_LINE]);
  const lines = (messages) =>
    findLintIssues({ lint: { messages, headKeys }, onlyLines }).map((f) => f.line);
  assert.deepEqual(lines([old]), []);
  assert.deepEqual(lines([old, fresh]), [UNCHANGED_LINE]);
  assert.deepEqual(lines([changed]), [CHANGED_LINE]);
  assert.deepEqual(lines([{ ...old, fatal: true, ruleId: null }]), [UNCHANGED_LINE]);
  assert.deepEqual(findLintIssues({ lint: null, onlyLines }), []);
});

function runHook(file, args = []) {
  const payload = args.includes('--codex')
    ? {
        tool_input: { command: `*** Begin Patch\n*** Add File: ${file}\n*** End Patch` },
        cwd: ROOT,
      }
    : { tool_input: { file_path: file } };
  return spawnSync(process.execPath, [HOOK, ...args], {
    cwd: ROOT,
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
}

test('Both hook adapters report ESLint findings of a new file and pass a clean one', () => {
  const file = path.join(ROOT, 'proof', `.post-edit-eslint-${process.pid}.mjs`);
  try {
    writeFileSync(file, "import { join } from 'node:path';\nexport const ANSWER = 42;\n");
    const claude = runHook(file);
    assert.equal(claude.status, CLAUDE_FEEDBACK_EXIT);
    assert.match(claude.stderr, /ESLint:\n.*:1 {2}no-unused-vars {2}'join'/);
    const codex = runHook(path.relative(ROOT, file), ['--codex']);
    assert.equal(codex.status, 0);
    const decision = JSON.parse(codex.stdout);
    assert.equal(decision.decision, 'block');
    assert.match(decision.reason, /no-unused-vars/);
    writeFileSync(file, 'export const ANSWER = 42;\n');
    const clean = runHook(file);
    assert.equal(clean.status, 0);
    assert.equal(clean.stderr, '');
  } finally {
    rmSync(file, { force: true });
  }
});
