import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/motion-gate-8000.json', import.meta.url), 'utf8'));
const windows = [
  ['gate8000', 0x808000, 0x8080B2, 103, '0db7c9ac942f718e6a6815897136c7f6c5a92aff21da8a81f6da4651da2c9517'],
  ['caller', 0x8096C3, 0x8096D3, 6, '47cbf29a8d8eef967d6f87220af6b1741fa569f2cf51e15893d66d08d91706f5'],
  ['rootAppend', 0x80C34A, 0x80C366, 11, '9956f7144b0b6c29202dfa6667fac828e926c950132c1b4522d09c1d59b0265f'],
  ['transitionPrefix', 0x80A4BF, 0x80A4D4, 9, '8375960f037d4a54fdbd35e9a888d87ac05d7ac24758d1102ce1ba02e42d9a76'],
];
const maps = new Map(windows.map(([name, entry, end]) => {
  const map = new Map();
  for (let pc = entry; pc < end;) { const i = decode(rom, pc, { e: 0, m: 0, x: 0 }); assert.ok(i.next <= end); map.set(pc, i); pc = i.next; }
  return [name, map];
}));
const at = (name, pc, op, value, target) => {
  const i = maps.get(name).get(pc); assert.ok(i, cpuLabel(pc)); assert.equal(i.mnemonic, op);
  if (value !== undefined) assert.equal(i.value, value);
  if (target !== undefined) assert.equal(i.target, target);
  return i;
};
const gate = (pc, ...rest) => at('gate8000', pc, ...rest);

test('Gate8000 pins178 local bytes and65 separate caller/helper prefix bytes with fixed independent digests', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  for (const [name, start, end, count, sha256] of windows) {
    const raw = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), sha256);
    assert.equal(maps.get(name).size, count);
    assert.deepEqual(report.windows.find(w => w.name === name), { name, entry: cpuLabel(start), end_exclusive: cpuLabel(end),
      covered_bytes: end - start, instruction_count: count, sha256, machine_bytes: raw.toString('hex').toUpperCase() });
  }
  assert.equal(report.gate_bytes, 178); assert.equal(report.reachable_local_instructions, 103);
  assert.equal(report.transitive_return_proven, false);
});

test('All22 local edges and three JSRs are explicit; onlyC34A/A4BF leave the complete local graph', () => {
  const edges = [...maps.get('gate8000').values()].filter(i => i.target !== undefined).map(i => [i.cpu & 0xFFFF, i.mnemonic, i.target]);
  const expected = [[0x8003, 'BMI', 0x80803F], [0x8025, 'BEQ', 0x80802F], [0x8029, 'JSR', 0x80803B],
    [0x802C, 'BCC', 0x80802F], [0x8037, 'BEQ', 0x80801F], [0x803D, 'BPL', 0x808041],
    [0x8045, 'BCC', 0x808076], [0x804D, 'BCC', 0x80807D], [0x8055, 'BCC', 0x808084],
    [0x805D, 'BCC', 0x80808B], [0x8065, 'BCC', 0x808092], [0x806D, 'BCS', 0x808099],
    [0x8074, 'BRA', 0x80803B], [0x807B, 'BRA', 0x80803B], [0x8082, 'BRA', 0x80803B],
    [0x8089, 'BRA', 0x80803B], [0x8090, 'BRA', 0x80803B], [0x8097, 'BRA', 0x80803B],
    [0x809D, 'BNE', 0x8080AB], [0x80A5, 'JSR', 0x80C34A], [0x80A9, 'BRA', 0x80803B], [0x80AD, 'JSR', 0x80A4BF]];
  assert.deepEqual(edges, expected);
  assert.deepEqual(report.edges, expected.map(([from, kind, to]) => ({ from: cpuLabel(0x800000 + from), kind, to: cpuLabel(to) })));
  assert.deepEqual(report.calls, [{ from: '80:8029', to: '80:803B', local: true },
    { from: '80:80A5', to: '80:C34A', local: false }, { from: '80:80AD', to: '80:A4BF', local: false }]);
  for (const i of maps.get('gate8000').values()) assert.ok(!['REP', 'SEP', 'PLB', 'PLP', 'PLD', 'XCE', 'TCD', 'SED', 'JSL', 'JML', 'JMP'].includes(i.mnemonic));
});

test('Negative pointer goes straight to Carry0 with no9D or slot reads; nonnegative route stores logical quarter coordinates', () => {
  gate(0x808000, 'LDY', 0x0CC2); gate(0x808003, 'BMI', undefined, 0x80803F);
  gate(0x80803F, 'CLC'); gate(0x808040, 'RTS');
  for (const [pc, field, scratch] of [[0x808005, 0x0E28, 0x0E], [0x80800C, 0x0E80, 0x11], [0x808013, 0x0ED8, 0x14]]) {
    assert.equal(gate(pc, 'LDA', field).mode, 'absy'); gate(pc + 3, 'LSR'); gate(pc + 4, 'LSR');
    assert.equal(gate(pc + 5, 'STA', scratch).state.m, 0);
  }
  assert.deepEqual(report.direct_word_writes.map(w => [w.address, w.instruction, w.width_bytes]),
    [[0x0E, 'STA', 2], [0x11, 'STA', 2], [0x14, 'STA', 2], [0x17, 'STZ', 2], [0x1A, 'STA', 2], [0x17, 'STA', 2], [0x1A, 'DEC', 2]]);
});

test('Two count-prefixed groups read header WORDs before masking the byte and decrement each count before record reads', () => {
  gate(0x80801A, 'LDY', 0); gate(0x80801D, 'STZ', 0x17);
  const header = gate(0x80801F, 'LDA', 0x9D); assert.equal(header.mode, 'dily'); assert.equal(header.state.m, 0);
  gate(0x808021, 'INY'); gate(0x808022, 'AND', 0xFF); gate(0x808025, 'BEQ', undefined, 0x80802F);
  gate(0x808027, 'STA', 0x1A); gate(0x808029, 'JSR', undefined, 0x80803B);
  gate(0x80802F, 'LDA', 0x17); gate(0x808031, 'INC'); gate(0x808032, 'STA', 0x17);
  gate(0x808034, 'CMP', 1); gate(0x808037, 'BEQ', undefined, 0x80801F); gate(0x808039, 'CLC');
  gate(0x80803B, 'DEC', 0x1A); gate(0x80803D, 'BPL', undefined, 0x808041);
  assert.match(report.groups, /high byte.*still read/); assert.match(report.groups, /preserved scratch/);
});

test('Record bounds are unsigned inclusive and all six mismatch skips inherit zero Carry withoutCLC', () => {
  for (const [pc, scratch] of [[0x808041, 0x0E], [0x808049, 0x11], [0x808051, 0x14]]) {
    gate(pc, 'LDA', scratch); assert.equal(gate(pc + 2, 'CMP', 0x9D).mode, 'dily'); gate(pc + 4, 'BCC');
  }
  for (const [pc, scratch] of [[0x808059, 0x0E], [0x808061, 0x11], [0x808069, 0x14]]) {
    assert.equal(gate(pc, 'LDA', 0x9D).mode, 'dily'); gate(pc + 2, 'CMP', scratch);
    gate(pc + 4, pc === 0x808069 ? 'BCS' : 'BCC');
  }
  for (const [pc, increment] of [[0x808076, 14], [0x80807D, 12], [0x808084, 10],
    [0x80808B, 8], [0x808092, 6], [0x80806F, 4]]) {
    gate(pc, 'TYA'); gate(pc + 1, 'ADC', increment); gate(pc + 4, 'TAY'); gate(pc + 5, 'BRA', undefined, 0x80803B);
  }
  assert.match(report.records.skips, /Carry0.*withoutCLC/);
});

test('Firstgroup matching actions pass raw scriptID to rootappend and saveY; wrapper has no immediate task visit', () => {
  gate(0x808099, 'INY'); gate(0x80809A, 'INY'); gate(0x80809B, 'LDA', 0x17);
  gate(0x80809D, 'BNE', undefined, 0x8080AB); gate(0x80809F, 'LDA', 0x9D); gate(0x8080A1, 'TAX');
  gate(0x8080A2, 'INY'); gate(0x8080A3, 'INY'); gate(0x8080A4, 'PHY');
  gate(0x8080A5, 'JSR', undefined, 0x80C34A); gate(0x8080A8, 'PLY'); gate(0x8080A9, 'BRA', undefined, 0x80803B);
  const rootCalls = [...maps.get('rootAppend').values()].filter(i => i.mnemonic === 'JSR');
  assert.deepEqual(rootCalls.map(i => i.target), [0x80C2C8]);
  at('rootAppend', 0x80C34D, 'LDA', 0x24C); at('rootAppend', 0x80C362, 'STA', 0x24C);
  at('rootAppend', 0x80C365, 'RTS'); assert.match(report.actions.first_group, /No immediateC1CA/);
});

test('Secondgroup action entersA4BF; prefix writes shared2DE2 and table86 with lastASL carry before unresolvedA44D', () => {
  gate(0x8080AB, 'LDA', 0x9D); gate(0x8080AD, 'JSR', undefined, 0x80A4BF);
  gate(0x8080B0, 'SEC'); gate(0x8080B1, 'RTS');
  at('transitionPrefix', 0x80A4BF, 'STA', 0x7E2DE2);
  for (const pc of [0x80A4C3, 0x80A4C4, 0x80A4C5]) at('transitionPrefix', pc, 'ASL');
  at('transitionPrefix', 0x80A4C6, 'ADC', 0x7E2DE2); at('transitionPrefix', 0x80A4CA, 'TAX');
  at('transitionPrefix', 0x80A4CB, 'LDA', 0x8D929D); at('transitionPrefix', 0x80A4CF, 'STA', 0x86);
  at('transitionPrefix', 0x80A4D1, 'JSR', undefined, 0x80A44D);
  assert.match(report.actions.transition_prefix, /bit13.*noCLC/);
  assert.match(report.actions.transition_prefix, /no A4BF final return proven/);
});

test('Four localRTS sites and caller Carry gates remain distinct from an unproved transitive return or frame', () => {
  assert.deepEqual([...maps.get('gate8000').values()].filter(i => i.mnemonic === 'RTS').map(i => cpuLabel(i.cpu)),
    ['80:802E', '80:803A', '80:8040', '80:80B1']);
  gate(0x80802C, 'BCC', undefined, 0x80802F); gate(0x80802E, 'RTS');
  at('caller', 0x8096C3, 'JSR', undefined, 0x808000); at('caller', 0x8096C6, 'BCS', undefined, 0x8096AB);
  at('caller', 0x8096C8, 'JSR', undefined, 0x80CC4B); at('caller', 0x8096CB, 'BCS', undefined, 0x8096AB);
  at('caller', 0x8096CD, 'JSR', undefined, 0x80DE94); at('caller', 0x8096D0, 'JSR', undefined, 0x80AFC4);
  assert.match(report.returns.conditional, /No complete all-path gate return claim/);
  assert.match(report.scope, /No native gate,CPU execution/);
});
