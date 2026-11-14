import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset } from './rom.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';
const rom = await readFile('Shadowrun (E).smc');
const report = JSON.parse(await readFile('analysis/render-be6d-native.json', 'utf8'));
const map = new Map();
for (const w of report.sources) {
  const state = { e: 0, m: w.name === 'widthByteFB2A' ? 1 : 0, x: 0 };
  const end = parseInt(w.end_exclusive.replace(':', ''), 16);
  for (let pc = parseInt(w.entry.replace(':', ''), 16); pc < end;) {
    if (pc === 0x80FC5F) state.m = 1;
    const i = decode(rom, pc, state); map.set(pc, i); pc = i.next;
    for (const [bit, name] of [[32, 'm'], [16, 'x']])
      if (['REP', 'SEP'].includes(i.mnemonic) && i.value & bit) state[name] = Number(i.mnemonic === 'SEP');
  }
}
const at = (pc, op, operand) => {
  const i = map.get(pc); assert.ok(i); assert.equal(i.mnemonic, op);
  if (operand !== undefined) assert.equal(i.target ?? i.value, operand); return i;
};
test('native BE6D/BCBE pins619 original callerbytes/275 instructions and all2835/1318 transitive bytes', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  for (const [start, end, count, hash] of [[0x80BE6D, 0x80BF3B, 85, '82d3e8dc2b7231d4a290bfe0ab391f8f8a68ed43dda3b71bb1658ed8996d124a'],
    [0x80BCBE, 0x80BE5B, 190, '0ce54d30d0eeddbab0e855f2b804c06be6edb1c3d3844e574f79928d7ed99b32']]) {
    const raw = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash);
    assert.equal([...map.keys()].filter(pc => pc >= start && pc < end).length, count);
  }
  assert.equal(map.size, 1318); assert.equal(report.sources.reduce((n, w) => n + w.covered_bytes, 0), 2835);
  for (const w of report.sources) {
    const start = parseInt(w.entry.replace(':', ''), 16), end = parseInt(w.end_exclusive.replace(':', ''), 16);
    const raw = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), w.sha256); assert.equal(raw.toString('hex').toUpperCase(), w.machine_bytes);
  }
});
test('closed native32/30-byte stack proofs preserve actual WORD and DBR returns without external assumptions', () => {
  for (const [i, [entry, size]] of [[0x80BE6D, 32], [0x80BCBE, 30]].entries()) {
    const p = proveWordStack(map, entry, 'RTS', { measureStack: true, widthJoins: new Set([0x80FAF2, 0x80FC36]) });
    assert.deepEqual(p, report.stackProofs[i]); assert.equal(p.minimum_protected_stack_bytes, size);
    assert.equal(p.external_return_assumptions, 0); assert.ok(p.returns.every(r => r.m === 0 && r.x === 0 && r.dbr === 'entry'));
  }
});
test('original selection/release order pins fresh scratch after reset, saved text, capacity fallthrough and highbank fallback', () => {
  for (const [pc, op, operand] of [[0x80BDB5, 'PHX'], [0x80BDB6, 'JSR', 0x80BE5B], [0x80BDB9, 'PLX'],
    [0x80BDBB, 'LDA', 0x14], [0x80BDBD, 'SBC', 0xE], [0x80BDC3, 'LDA', 0x17], [0x80BDC5, 'SBC', 0x11],
    [0x80BDCA, 'LDA', 0x7E3F28], [0x80BDEF, 'LDA', 0x809782], [0x80BE05, 'PHA'],
    [0x80BE06, 'JSR', 0x80FADD], [0x80BE29, 'JSR', 0x80F963], [0x80BE2C, 'LDA', 0],
    [0x80BE31, 'PLA'], [0x80BE32, 'STA', 2], [0x80BE34, 'JSR', 0x80FE69],
    [0x80BE60, 'JSR', 0x80FA3E], [0x80FA62, 'JSL', 0x81AD92], [0x80BE63, 'LDA', 65535]]) at(pc, op, operand);
  assert.equal(at(0x80BDEF, 'LDA').mode, 'longx'); assert.equal(0x809782 + 0xFFFE, 0x819780);
  assert.equal(at(0x80BE2C, 'LDA').cpu, at(0x80BE29, 'JSR').next);
});
test('original held and tracking paths pin firstbit priority, carried arithmetic and the first store before second failure', () => {
  for (const [pc, op, operand] of [[0x80BE7E, 'BCS', 0x80BE9B], [0x80BEA3, 'ADC', 47], [0x80BE8B, 'SBC', 48],
    [0x80BEB9, 'BCS', 0x80BED6], [0x80BEDE, 'ADC', 47], [0x80BEC6, 'SBC', 48],
    [0x80BF25, 'LDA', 0x1CA], [0x80BD69, 'ROR'], [0x80BD6B, 'ROR'],
    [0x80BE3E, 'CMP', 255], [0x80BE44, 'STA', 0x1D4], [0x80BE4D, 'CMP', 255],
    [0x80BE50, 'BCS', 0x80BE57], [0x80BE57, 'JSR', 0x80BE5B]]) at(pc, op, operand);
  assert.ok(0x80BE44 < 0x80BE4D);
});
