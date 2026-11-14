import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readdir, utimes } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { processTempDir, pruneTempDirs, testTempDir } from './temp-dir.mjs';

test('pruning keeps the newest directories of one prefix and nothing else', async (t) => {
  const root = await testTempDir(t, 'snes-prune-test-');
  const names = ['log-a', 'log-b', 'log-c', 'log-d', 'other-a'];
  for (const [index, name] of names.entries()) {
    await mkdir(join(root, name));
    const time = new Date(Date.UTC(2026, 0, 1 + index));
    await utimes(join(root, name), time, time);
  }
  assert.equal(await pruneTempDirs('log-', 2, root), 2);
  assert.deepEqual((await readdir(root)).sort(), ['log-c', 'log-d', 'other-a']);
  assert.equal(await pruneTempDirs('log-', 2, root), 0);
});

test('a test directory is removed after its test and a process directory is shared', async (t) => {
  let dir;
  await t.test('inner', async (inner) => {
    dir = await testTempDir(inner, 'snes-temp-test-');
    assert.ok(existsSync(dir));
  });
  assert.equal(existsSync(dir), false);
  const shared = processTempDir('snes-temp-process-test-');
  assert.equal(processTempDir('snes-temp-process-test-'), shared);
  assert.notEqual(processTempDir('snes-temp-other-test-'), shared);
});
