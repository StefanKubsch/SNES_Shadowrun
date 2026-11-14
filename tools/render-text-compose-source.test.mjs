import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile('Shadowrun (E).smc');
const report = JSON.parse(await readFile('analysis/render-text-compose-native.json', 'utf8'));
const regions = [
  [0x80FE69, 0x80FEC1, 43, '0555ec706bcf599f09c8709a5fce70fc0fa34f33555dfe3a2efa207de6e2907a'],
  [0x80FB39, 0x80FD80, 283, '264a8d19c932719562f1bc1b688b05b74f5399799ea192d8d8c50c31121d1deb'],
];
const map = new Map();
for (const w of report.sources) {
  const state = { e: 0, m: 0, x: 0 }, end = parseInt(w.end_exclusive.replace(':', ''), 16);
  for (let pc = parseInt(w.entry.replace(':', ''), 16); pc < end;) {
    if (pc === 0x80FC5F) state.m = 1;
    const i = decode(rom, pc, state); map.set(pc, i); pc = i.next;
    if (['REP', 'SEP'].includes(i.mnemonic) && i.value & 32) state.m = Number(i.mnemonic === 'SEP');
  }
}
const at = (pc, op, operand) => {
  const i = map.get(pc); assert.equal(i.mnemonic, op);
  if (operand !== undefined) assert.equal(i.target ?? i.value, operand); return i;
};
test('671 new originalbytes/326instructions and both closed graph/stackproofs are independently pinned', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  assert.equal(map.size, 492); assert.equal(report.sources.reduce((n, w) => n + w.covered_bytes, 0), 1016);
  for (const [entry, end, count, hash] of regions) {
    const raw = rom.subarray(cpuToOffset(entry, rom.length), cpuToOffset(end, rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash);
    const w = report.sources.find(w => parseInt(w.entry.replace(':', ''), 16) === entry);
    assert.equal(w.machine_bytes, raw.toString('hex').toUpperCase()); assert.equal(w.sha256, hash);
    assert.equal([...map.keys()].filter(pc => pc >= entry && pc < end).length, count);
  }
  for (const [i, [entry, visited, stack]] of [[0x80FE69, 492, 12], [0x80FB39, 436, 9]].entries()) {
    const p = proveWordStack(map, entry, 'RTS', { measureStack: true, widthJoins: new Set([0x80FC36]) });
    assert.deepEqual(p, report.stackProofs[i]); assert.equal(p.reachable_instructions, visited);
    assert.equal(p.minimum_protected_stack_bytes, stack); assert.equal(p.external_return_assumptions, 0);
    assert.ok(p.returns.every(r => r.m === 0 && r.x === 0 && r.dbr === 'entry'));
  }
});
test('FE69 original pointerbank, dictionary WORD lookup, both XBA/newlines and7E nested composer are pinned', () => {
  at(0x80FE6A, 'LDA', 0x9DFF); at(0x80FE6D, 'STA', 0xD0); at(0x80FE6F, 'LDA', 2);
  at(0x80FE71, 'BPL', 0x80FE75); at(0x80FE73, 'INC', 0xD0); at(0x80FE78, 'STA', 0xCF);
  at(0x80FE7A, 'PEA', 0x7E7E); at(0x80FE8C, 'TAX'); at(0x80FE8D, 'JSL', 0x81AF04);
  at(0x80FE93, 'INX'); at(0x80FE94, 'INX'); at(0x80FE95, 'LDA', 0x9D8000);
  at(0x80FE9B, 'AND', 0x7F7F); at(0x80FE9E, 'XBA'); at(0x80FEA9, 'XBA');
  at(0x80FEA1, 'CMP', 10); at(0x80FEAC, 'CMP', 10); at(0x80FEB7, 'STZ', 0x21A0);
  assert.equal(map.get(0x80FEB7).state.m, 1); at(0x80FEBC, 'JSR', 0x80FB39); at(0x80FEBF, 'PLB');
});
test('FB39 word measure/reset, unreloaded line index and WORD second-byte reads precede their masks', () => {
  at(0x80FB39, 'LDX', 0); at(0x80FB3B, 'JSL', 0x81ADBA); at(0x80FB3F, 'JSL', 0x81AE14);
  at(0x80FB5B, 'JSL', 0x81AEFC); at(0x80FBA6, 'TSB', 0xAE); at(0x80FBAA, 'STA', 0x21A0);
  assert.equal(at(0x80FBBE, 'ADC', 0xBA).state.m, 1);
  at(0x80FBCD, 'CMP', 0xA8); at(0x80FBCF, 'BCC', 0x80FC36);
  at(0x80FBD5, 'BEQ', 0x80FBE3); at(0x80FBDD, 'LDX', 0); at(0x80FBE3, 'JSL', 0x81AE4D);
  assert.equal(at(0x80FC25, 'LDA', 0x21A0).state.m, 0); at(0x80FC28, 'AND', 255);
  at(0x80FC36, 'SEP', 32); at(0x80FC3A, 'TAY'); at(0x80FC53, 'PLP'); at(0x80FC58, 'TRB', 0xAE);
  assert.equal(at(0x80FC5F, 'DEC', 0xA5).state.m, 1);
  at(0x80FC6A, 'PLP'); assert.equal(at(0x80FC7D, 'LDA', 0x81AC0C).state.m, 0);
  at(0x80FC81, 'AND', 255); at(0x80FC8D, 'INC', 0xBA);
});
test('FB39 original glyph styles, fullwidth/mask indexes and retained Carry final cursor are pinned', () => {
  at(0x80FC9C, 'TAY'); at(0x80FCA1, 'LDA', 0x95F2D0); at(0x80FCA6, 'ORA', 0x95F2D0);
  at(0x80FCAC, 'TYA'); at(0x80FCB3, 'LDA', 0xB1); at(0x80FCC3, 'CMP', 5);
  at(0x80FCE1, 'CPX', 0x107); at(0x80FCEE, 'LDA', 0xB4); at(0x80FCF0, 'XBA');
  at(0x80FCF1, 'LDY', 0xBA); at(0x80FCF8, 'ASL'); at(0x80FCFA, 'CPY', 8);
  at(0x80FD03, 'ASL'); at(0x80FD06, 'EOR', 0x81AC9D); at(0x80FD0B, 'LDY', 0xB7);
  at(0x80FD1A, 'XBA'); at(0x80FD1B, 'ORA', 0x2AE0); at(0x80FD4F, 'SBC', 15);
  at(0x80FD61, 'JSL', 0x81AEC8); for (let pc = 0x80FD67; pc <= 0x80FD6A; pc++) at(pc, 'LSR');
  at(0x80FD6B, 'LDX', 0); at(0x80FD6D, 'ADC', 0x7E20C0); at(0x80FD7B, 'JSL', 0x81AEF4);
  assert.equal([...map.values()].some(i => i.cpu > 0x80FD6A && i.cpu < 0x80FD6D && i.mnemonic === 'CLC'), false);
});
