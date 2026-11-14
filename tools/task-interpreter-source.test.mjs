import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {cpuToOffset} from './rom.mjs';
import {taskInterpreterSource} from './task-interpreter-source.mjs';

// Every task opcode analyzer that previously read the C1CA report, directly
// or through task-control-source.mjs.
const names = ['push', 'consumers', 'updates', 'bit-logic', 'negate-shifts', 'truth', 'compare-gates',
  'carry-compare', 'carry-sign-gates', 'complement-sign-gates', 'local-reads', 'local-writes',
  'sign-extension', 'state-reads', 'state-writes', 'script-bridge',
  'jump-zero', 'jump-nonzero', 'jump', 'call-local', 'return-local'];
const denied = 'analysis/render-c1ca.json';
let invocation = 0;

test('Interpreter source matches the retained C1CA windows and dispatch fields', async () => {
  const rom = await fs.promises.readFile('Shadowrun (E).smc');
  const report = JSON.parse(await fs.promises.readFile(denied, 'utf8'));
  const source = taskInterpreterSource(rom);
  assert.equal(source.rom_sha256, report.rom_sha256);
  for (const window of source.windows) assert.deepEqual(window, report.windows.find(w => w.name === window.name));
  assert.deepEqual(source.dispatch.opcode_source, report.dispatch.opcode_source);
  assert.deepEqual(source.dispatch.all_byte_opcode_targets, report.dispatch.all_byte_opcode_targets);
  source.windows.length = 0; source.dispatch.all_byte_opcode_targets[0].target = 'changed';
  assert.deepEqual(taskInterpreterSource(rom).dispatch.all_byte_opcode_targets, report.dispatch.all_byte_opcode_targets);
  for (const at of [0x80F2B4, 0x80F3B4, 0x80F378, 0x80F392, 0x80C1F9]) {
    const changed = Buffer.from(rom); changed[cpuToOffset(at, changed.length)] ^= 1;
    assert.throws(() => taskInterpreterSource(changed), /Wrong European ROM revision/);
  }
});

for (const name of names) {
  test(`task ${name}: emits identical JSON and assembly without reading the C1CA report`, async t => {
    const readFile = fs.promises.readFile, writes = [];
    const paths = [`analysis/render-task-${name}.json`, `analysis/render-task-${name}.asm.txt`];
    const originals = new Map(await Promise.all(paths.map(async path => [path, await readFile(path)])));
    t.mock.method(fs.promises, 'readFile', async (path, ...args) => {
      assert.notEqual(String(path), denied, 'Cyclic C1CA report read');
      return readFile(path, ...args);
    });
    t.mock.method(fs.promises, 'writeFile', async (path, data) => {
      assert.ok(paths.includes(path), 'Unexpected output: ' + path);
      writes.push({path, bytes: Buffer.from(data)});
    });
    t.mock.method(console, 'log', () => {});
    syncBuiltinESMExports();
    t.after(() => {t.mock.restoreAll(); syncBuiltinESMExports();});
    await import(new URL(`./analyze-render-task-${name}.mjs?interpreter-test=${invocation++}`, import.meta.url));
    assert.deepEqual(writes.map(write => write.path), paths);
    for (const write of writes) assert.deepEqual(write.bytes, originals.get(write.path));
  });
}
