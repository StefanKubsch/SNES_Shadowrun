import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-a919.json', import.meta.url), 'utf8'));
const windows = [
  ['paletteListA919', 0x81A919, 0x81A954, 31, '866063e7ac09857126708488a5643656ebae5d957fe9909c2fe4eeaf594e2de4'],
  ['callbackCallC16A', 0x80C16A, 0x80C16E, 1, '27d3a6e7e55783fb2328675f48745605e3fb799f3ae66920cbdf60ec57e212aa'],
  ['listAppendAB0A', 0x80AB0A, 0x80AB26, 15, '51b51a9df2e222fbafe6ce9903cd19d0a03e73c3e37d7a6a415d8cf37177f6a9'],
  ['listResetA840', 0x81A840, 0x81A919, 73, '1d011c93c518e385031b1a21f33f7e74aa38fa468d2e3bf1d7ded5853b292eb7'],
  ['selectedCountClear9415', 0x809415, 0x809418, 1, '636006eb2ac245143ca4e0af227b4f4e106b1079a29e65eacd6b7dada473ef9d'],
  ['selectedCountClearE4C2', 0x80E4C2, 0x80E4C5, 1, '636006eb2ac245143ca4e0af227b4f4e106b1079a29e65eacd6b7dada473ef9d'],
  ['selectedGateClearA772', 0x81A772, 0x81A775, 1, '8603163497943ae57852fd7a537bbc497f7a06d29afb40e926e8ef5d37b981a9'],
  ['selectedAppendCallB23D', 0x80B23D, 0x80B240, 1, 'a62934079e64747a016bd620aa69ca3f681ca265410bd79032bc9d67d27433bb'],
  ['selectedAppendCallB8F1', 0x80B8F1, 0x80B8F4, 1, 'a62934079e64747a016bd620aa69ca3f681ca265410bd79032bc9d67d27433bb'],
];
const instructions = new Map();
for (const [, lo, hi] of windows) for (let pc = lo; pc < hi;) {
  const i = decode(rom, pc, { e: 0, m: Number(pc >= 0x81A93A && pc < 0x81A94F), x: 0 });
  assert.ok(i.next <= hi); instructions.set(pc, i); pc = i.next;
}
const range = (lo, hi) => [...instructions.values()].filter(i => i.cpu >= lo && i.cpu < hi);
const at = (pc, op, value, target) => {
  const i = instructions.get(pc); assert.ok(i, cpuLabel(pc)); assert.equal(i.mnemonic, op);
  if (value !== undefined) assert.equal(i.value, value);
  if (target !== undefined) assert.equal(i.target, target);
  return i;
};

test('A919 original body/caller and complete selected listwriters have independent literal byte pins', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), report.rom_sha256);
  for (const [name, lo, hi, count, sha256] of windows) {
    const raw = rom.subarray(cpuToOffset(lo, rom.length), cpuToOffset(hi, rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), sha256); assert.equal(range(lo, hi).length, count);
    assert.deepEqual(report.windows.find(w => w.name === name), { name, entry: cpuLabel(lo), end_exclusive: cpuLabel(hi),
      covered_bytes: hi - lo, instruction_count: count, sha256, machine_bytes: raw.toString('hex').toUpperCase() });
  }
  assert.equal(report.code_bytes, 59); assert.equal(report.instruction_count, 31);
  assert.equal(report.owner_body_bytes, 245); assert.equal(report.owner_excerpt_bytes, 15);
});

test('A919 early gates use LDA1562 then LDY17D4 with distinct A/Y/flag return sources and no clears', () => {
  at(0x81A919, 'LDA', 0x1562); at(0x81A91C, 'BEQ', undefined, 0x81A953);
  at(0x81A91E, 'LDY', 0x17D4); at(0x81A921, 'BEQ', undefined, 0x81A953);
  assert.equal(at(0x81A91E, 'LDY').state.x, 0);
  assert.match(report.gates.second, /original1562 WORD inA/); assert.match(report.gates.second, /even A8000/);
  assert.ok(!range(0x81A919, 0x81A954).some(i => i.mnemonic === 'STZ' || i.mnemonic === 'STA' && [0x17D4, 0x1562].includes(i.value)));
});

test('A919 firstvisit is unconditional after two WORDdecrements and continuation uses signed BPL', () => {
  at(0x81A923, 'DEY'); at(0x81A924, 'DEY'); at(0x81A94F, 'DEY'); at(0x81A950, 'DEY');
  at(0x81A951, 'BPL', undefined, 0x81A925);
  assert.deepEqual(range(0x81A923, 0x81A925).map(i => i.mnemonic), ['DEY', 'DEY']);
  // Independent modular halfword distance to the first negative postvisit.
  for (let count = 0; count <= 65535; count++) {
    const start = (count - 2) & 65535;
    const distance = (((start - 2) & 65535) & 0x8000) ? 1 : Math.floor(((start - 2) & 65535) / 2) + 2;
    const n = count === 0 ? 0 : distance;
    assert.equal(n, count === 0 ? 0 : count >= 2 && count <= 0x8003 ? Math.floor(count / 2) : 1);
    if (n) { assert.ok(((start - n * 2) & 65535) >= 32768); if (n > 1) assert.ok(((start - (n - 1) * 2) & 65535) < 32768); }
  }
  assert.deepEqual(report.loop.counts.map(c => [c.count, c.nominalIterations]),
    [[0, 0], [1, 1], [2, 1], [3, 1], [0x7FFF, 16383], [0x8000, 16384], [0x8001, 16384], [0x8002, 16385], [0x8003, 16385], [0x8004, 1], [0xFFFF, 1]]);
});

test('A919 pointer uses four WORDshifts and inputbit12 Carry with no CLC or pointer clamp', () => {
  const load = at(0x81A925, 'LDA', 0x17D6); assert.equal(load.mode, 'absy'); assert.equal(load.state.m, 0);
  assert.deepEqual(range(0x81A928, 0x81A92C).map(i => [i.mnemonic, i.state.m]), Array(4).fill(['ASL', 0]));
  at(0x81A92C, 'ADC', 0xF1BA); at(0x81A92F, 'STA', 0x4342);
  for (let value = 0; value <= 65535; value++) {
    const carry = value >>> 12 & 1, shifted = (value & 0xFFF) << 4;
    assert.equal((shifted + 0xF1BA + carry) & 65535, (value * 16 + 0xF1BA + carry) % 65536);
  }
  assert.equal(report.loop.pointers.find(v => v.value === 0x1000).pointer, 0xF1BB);
});

test('A919 BYTE paletteindex uses lowY bit5 Carry and ADC81, independently of the preceding WORDADC', () => {
  at(0x81A932, 'LDA', 0x1E); at(0x81A938, 'SEP', 32); assert.equal(at(0x81A93A, 'TYA').state.m, 1);
  assert.deepEqual(range(0x81A93B, 0x81A93E).map(i => [i.mnemonic, i.state.m]), Array(3).fill(['ASL', 1]));
  assert.equal(at(0x81A93E, 'ADC', 0x81).state.m, 1);
  assert.ok(!range(0x81A919, 0x81A954).some(i => ['CLC', 'SEC', 'CLV'].includes(i.mnemonic)));
  for (let y = 0; y < 65536; y++) {
    const index = ((y & 31) * 8 + 129 + (y >>> 5 & 1)) % 256;
    assert.equal(index, ((y * 8) % 256 + 129 + Math.floor(y / 32) % 2) % 256);
  }
  assert.equal(report.loop.indexes.find(i => i.y === 0x20).index, 0x82);
  assert.equal(report.loop.indexes.find(i => i.y === 0x10).index, 1);
});

test('A919 preserves exactly five requeststores pervisit without tails, countclear or source reads', () => {
  assert.deepEqual(range(0x81A919, 0x81A954).filter(i => i.mnemonic === 'STA').map(i => [i.value, i.state.m]),
    [[0x4342, 0], [0x4345, 0], [0x2121, 1], [0x4344, 1], [0x420B, 1]]);
  at(0x81A943, 'LDA', 0x8D); at(0x81A948, 'LDA', 0x10); at(0x81A94D, 'REP', 32); at(0x81A953, 'RTL');
  assert.equal(range(0x81A919, 0x81A954).filter(i => i.mnemonic === 'LDA' && !i.mode.startsWith('imm')).length, 2);
  assert.match(report.loop.requests, /No channel4 mode\/target/);
});

test('A919 active return carries A0010 but N1/Z0 from last WORDDEY and C/V from BYTEADC', () => {
  assert.deepEqual(range(0x81A943, 0x81A954).map(i => i.mnemonic), ['LDA', 'STA', 'LDA', 'STA', 'REP', 'DEY', 'DEY', 'BPL', 'RTL']);
  assert.equal(at(0x81A94F, 'DEY').state.x, 0);
  assert.match(report.returns, /WORDA0010 with N1\/Z0/); assert.match(report.returns, /C\/V fromlastBYTEindexADC/);
  const oddLarge = report.loop.indexes.find(i => i.y === 0xFFFD); assert.equal(oddLarge.carry, 1); assert.equal(oddLarge.overflow, 1);
});

test('A919 and complete AB0A/A840 writers have structural WORD/DBR/stack returns without external assumptions', () => {
  const map = (lo, hi) => new Map(range(lo, hi).map(i => [i.cpu, i]));
  assert.deepEqual(proveWordStack(map(0x81A919, 0x81A954), 0x81A919), report.graph.proof);
  assert.equal(report.graph.proof.reachable_instructions, 31); assert.deepEqual(report.graph.calls, []);
  for (const [j, lo, hi, op] of [[0, 0x80AB0A, 0x80AB26, 'RTS'], [1, 0x81A840, 0x81A919, 'RTL']])
    assert.deepEqual(proveWordStack(map(lo, hi), lo, op), report.owners.proofs[j].proof);
  assert.equal(report.graph.actual_transfer_completion_proven, false);
});

test('AB0A append deduplicates signedmarkers, shares scratch6B and increases byteoffset by2 without capacityguards', () => {
  at(0x80AB0A, 'ASL'); at(0x80AB0B, 'TAX'); at(0x80AB0C, 'LDA', 0x17E6); at(0x80AB0F, 'BPL', undefined, 0x80AB25);
  at(0x80AB11, 'LDA', 0x17D4); at(0x80AB14, 'STA', 0x17E6); at(0x80AB17, 'STX', 0x6B);
  at(0x80AB19, 'TAX'); at(0x80AB1A, 'LDA', 0x6B); at(0x80AB1C, 'STA', 0x17D6);
  at(0x80AB1F, 'TXA'); at(0x80AB20, 'INX'); at(0x80AB21, 'INX'); at(0x80AB22, 'STX', 0x17D4);
  assert.ok(!range(0x80AB0A, 0x80AB26).some(i => ['CMP', 'CPX', 'JSR', 'JSL'].includes(i.mnemonic)));
  assert.equal(at(0x80B23D, 'JSR', undefined, 0x80AB0A).length, 3); at(0x80B8F1, 'JSR', undefined, 0x80AB0A);
});

test('A840 reset clears count and70 markers but does not initialize the eight initial listWORDs', () => {
  at(0x81A840, 'STZ', 0x17D4); at(0x81A843, 'LDA', 0xFFFF);
  assert.deepEqual(range(0x81A846, 0x81A918).map(i => [i.mnemonic, i.value]),
    Array.from({ length: 70 }, (_, i) => ['STA', 0x17E6 + i * 2]));
  assert.equal(0x17E6 - 0x17D6, 16);
  at(0x809415, 'STZ', 0x17D4); at(0x80E4C2, 'STZ', 0x17D4); at(0x81A772, 'STZ', 0x1562);
  assert.match(report.owners.reset, /Does not hydrate list17D6/); assert.match(report.owners.selected, /completecaller\/DBR\/mode lifecycle not supplied/);
});

test('A919 indexed words may cross banks and physicalregisterwrites must remain visible to later records', () => {
  assert.equal(0x7E17D6 + 0xE829, 0x7EFFFF); assert.equal(0x7E17D6 + 0xE829 + 1, 0x7F0000);
  assert.equal(0x7F17D6 + 0xFFFF, 0x8017D5);
  for (const [y, address] of [[0x2B70, 0x4346], [0x2B6E, 0x4344], [0x2B6C, 0x4342]]) assert.equal(0x17D6 + y, address);
  assert.match(report.aliases, /now8D\/1E/); assert.match(report.loop.record, /No lowWORDwrap/);
  assert.deepEqual(report.manufacturer.sections, ['3.5', '3.5.4', '7.3', '7.20', '7.23']);
});

test('A919 rawwriter/caller hints stay qualified and leave six remaining callbackcallees and liveowners open', () => {
  at(0x80C16A, 'JSL', undefined, 0x81A919);
  assert.deepEqual(report.caller.raw_patterns, { jslA919: ['80:C16A'], stz17D4: ['80:9415', '80:E4C2', '81:A840'],
    stx17D4: ['80:AB22'], indexedListStore: ['80:AB1C'], jsrAB0A: ['80:B23D', '80:B8F1'] });
  assert.equal(report.caller.remaining_after.length, 6); assert.equal(report.caller.remaining_after[0], '81:A958');
  assert.match(report.caller.qualification, /no allwriter/); assert.match(report.owners.lifecycle, /remains separate from slot\/task\/MotionData/);
  assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
});
