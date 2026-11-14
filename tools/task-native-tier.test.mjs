import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { decodeTaskWindows } from './task-partial-source.mjs';
import { proveLeafSource } from './task-native-leaf-source.mjs';
import { tierRootSpecs } from './task-native-tier-specs.mjs';
import { taskLeafFixture } from './task-native-leaf-fixtures.mjs';
import { prepareTaskNativeCB3C as query } from '../proof/task/native-cb3c.mjs';
import { prepareTaskNative9DEC as increment } from '../proof/task/native-9dec.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { prepared, commit, unchangedFailure } from './task-native-test-support.mjs';
import { omitBodyBytes as omit, bodyWord as word } from './task-script-body-fixtures.mjs';
const { bytes } = inspectRom(await readFile('Shadowrun (E).smc'));
test('C7 and26 whole original graphs pin every instruction, BYTE join and separate metadata highs', async () => {
  for (const s of tierRootSpecs) {
    const { map } = decodeTaskWindows(bytes, s.windows),
      p = proveLeafSource(map, s);
    assert.equal(p.reachable_instructions, map.size);
    assert.equal(p.minimum_protected_stack_bytes, 2);
    assert.equal(p.external_return_assumptions, 0);
    assert.deepEqual(
      p,
      JSON.parse(await readFile(`analysis/render-task-${s.name}.json`)).proofs[0],
    );
    for (const [pc, i] of map) {
      const changed = new Map(map);
      changed.set(pc, { ...i, raw: [i.raw[0] ^ 1, ...i.raw.slice(1)] });
      assert.throws(() => proveLeafSource(changed, s));
    }
    for (const a of s.anchors)
      assert.equal(
        bytes
          .subarray(cpuToOffset(a.start, bytes.length), cpuToOffset(a.start, bytes.length) + 2)
          .toString('hex')
          .toUpperCase(),
        a.hex,
      );
  }
});
test('C7 reads actual full source WORD before mask, including high and Longcarry; null reads DP02 without invented guard', () => {
  const f = taskLeafFixture(0x80cb3c);
  sampleWord(f.data, 0, 65535);
  sampleWord(f.data, 0x8eb01f, 65535);
  sampleWord(f.data, 0x7f0001, 0xab80);
  const p = prepared(query, f);
  assert.equal(p.outputContext.a, 128);
  assert.ok(p.readAddresses.includes(0x7f0002));
  unchangedFailure(query, omit(f, 0x7f0002), {}, 'render_source_required');
  commit(query, f);
  assert.equal(word(f.data, 0), 128);
  const z = taskLeafFixture(0x80cb3c);
  sampleWord(z.data, 0x8db030, 0);
  sampleWord(z.data, 2, 0xcdbe);
  commit(query, z);
  assert.equal(word(z.data, 0), 0xbe);
});
test('26 BYTE wrap precedes CMP7, highA survives, actual ADC overflow and CMP/LDA flags survive REP', () => {
  for (const [old, delta] of [
    [0, 0],
    [5, 1],
    [6, 1],
    [127, 1],
    [128, 128],
    [250, 10],
    [255, 1],
    [255, 255],
  ]) {
    const f = taskLeafFixture(0x809dec),
      g = omit(f, 0x7e0403, 3);
    g.data.seed(0x7e0402, [old]);
    g.data.seed(2, [delta]);
    const p = commit(increment, g),
      wrapped = (old + delta) & 255,
      next = wrapped >= 7 ? 6 : wrapped;
    assert.equal(g.data.readByte(0x7e0402).value, next);
    assert.equal(p.outputContext.a, 0x400 | next);
    assert.equal(p.outputContext.status & 0x30, 0);
    assert.equal(p.outputContext.status & 1, Number(wrapped >= 7));
    assert.equal(p.outputContext.status & 0x82, wrapped >= 7 ? 0 : 128);
    assert.equal(p.outputContext.status & 64, (old ^ wrapped) & (delta ^ wrapped) & 128 ? 64 : 0);
    assert.equal(p.readAddresses.includes(0x7e0403), false);
    assert.equal(p.readAddresses.includes(0x7e0003), false);
  }
  const zero = taskLeafFixture(0x809dec);
  sampleWord(zero.data, 0x8db030, 0);
  assert.equal(prepared(increment, omit(zero, 2, 3, 0x7e0402)).outputBytes, 0);
});
