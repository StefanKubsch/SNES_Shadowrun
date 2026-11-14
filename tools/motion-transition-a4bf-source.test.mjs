import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuLabel, cpuToOffset } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/motion-transition-a4bf.json', import.meta.url), 'utf8'));
const oldPointer = JSON.parse(await readFile(new URL('../analysis/target-pointer.json', import.meta.url), 'utf8'));
const windows = [
  ['transitionA4BF', 0x80A4BF, 0x80A5DB, 118, '3e6f461737370ee8373ffcc983ad080b3abb6fc12061715267133812d3303214'],
  ['bankA44D', 0x80A44D, 0x80A464, 12, 'a63597c72e4c33aaad01ddcbc71d61949f7d28165d3377dfad244da42865ccac'],
  ['timeWait', 0x81B0A1, 0x81B0AC, 4, '376af3db14eef310efd1740299d9f2496c59cd205dbc14e15e2a9786bcd8f076'],
  ['timeSet', 0x81B0AC, 0x81B0BD, 8, '9385011b40eea624aee558c702f288c55886edda102d5dce02417a2751fafeb9'],
  ['timeReset', 0x81B0BD, 0x81B0C7, 4, 'f680b037769671488b57ebcdae1079bd2e7eb31d2f7e37e174125ff96b238fa7'],
  ['gateCaller', 0x8080AB, 0x8080B2, 4, '24fa480ef8e03701905312019e753c56485c33d0eb9595dfb5913183b421c88a'],
];
// Width intervals fixed independently of the analyzer's REP/SEP tracker.
const maps = new Map(windows.map(([name, start, end]) => {
  const map = new Map();
  for (let pc = start; pc < end;) {
    const i = decode(rom, pc, { e: 0, m: Number(pc >= 0x80A450 && pc <= 0x80A461), x: 0 });
    assert.ok(i.next <= end); map.set(pc, i); pc = i.next;
  }
  return [name, map];
}));
const at = (name, pc, op, value, target) => {
  const i = maps.get(name).get(pc); assert.ok(i, cpuLabel(pc)); assert.equal(i.mnemonic, op);
  if (value !== undefined) assert.equal(i.value, value);
  if (target !== undefined) assert.equal(i.target, target);
  return i;
};
const body = (pc, ...rest) => at('transitionA4BF', pc, ...rest);
const calls = [[0xA4D1, 'JSR', 0x80A44D], [0xA4DD, 'JSL', 0x81B0AC], [0xA4E1, 'JSR', 0x80BCB2],
  [0xA4E4, 'JSR', 0x80C1A6], [0xA506, 'JSL', 0x81EF94], [0xA518, 'JSL', 0x81A117],
  [0xA51C, 'JSL', 0x81B0BD], [0xA520, 'JSL', 0x81B0A1], [0xA524, 'JSL', 0x818861],
  [0xA528, 'JSR', 0x80FF79], [0xA52B, 'JSL', 0x81A772], [0xA54B, 'JSR', 0x80A2FA],
  [0xA54E, 'JSR', 0x80A3B6], [0xA551, 'JSR', 0x80A464], [0xA554, 'JSL', 0x819AE6],
  [0xA558, 'JSL', 0x818D05], [0xA55C, 'JSL', 0x818BD9], [0xA580, 'JSL', 0x81EF47],
  [0xA584, 'JSL', 0x818756], [0xA588, 'JSR', 0x808511], [0xA5C3, 'JSR', 0x80BABB],
  [0xA5C9, 'JSL', 0x81AD92], [0xA5D6, 'JSL', 0x81B0AC]];

test('A4BF source pins345 body/helper bytes and7 caller bytes with six independent fixed digests', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  for (const [name, start, end, count, sha256] of windows) {
    const raw = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), sha256); assert.equal(maps.get(name).size, count);
    assert.deepEqual(report.windows.find(w => w.name === name), { name, entry: cpuLabel(start), end_exclusive: cpuLabel(end),
      covered_bytes: end - start, instruction_count: count, sha256, machine_bytes: raw.toString('hex').toUpperCase() });
  }
  assert.equal(report.source_bytes, 345); assert.equal(report.caller_bytes, 7); assert.equal(report.transitive_return_proven, false);
});

test('Complete local A4BF graph pins30 edges and all23 calls in order,without promoting external returns', () => {
  const actual = [...maps.get('transitionA4BF').values()].filter(i => ['JSR', 'JSL'].includes(i.mnemonic));
  assert.deepEqual(actual.map(i => [i.cpu & 0xFFFF, i.mnemonic, i.target]), calls);
  const graph = report.local_graphs.find(g => g.name === 'transitionA4BF');
  assert.equal(graph.reachable_local_instructions, 118); assert.equal(graph.edges.length, 30);
  assert.deepEqual(graph.calls, calls.map(([site, kind, target]) => ({ from: cpuLabel(0x800000 + site), kind, to: cpuLabel(target) })));
  assert.deepEqual(graph.return_sites, ['80:A5DA']); assert.equal(report.unresolved_call_sites.length, 18);
  for (const i of maps.get('transitionA4BF').values()) assert.ok(!['REP', 'SEP', 'PLP', 'PLB', 'PLD', 'XCE', 'TCD', 'SED'].includes(i.mnemonic));
});

test('A44D matches prior pointer source and proves six BYTE writes,balanced mode and no calls with explicit binaryADC', () => {
  const bank = [...maps.get('bankA44D').values()];
  assert.equal(oldPointer.source_blocks.find(b => b.entry === '80A44D').machine_bytes,
    Buffer.concat(bank.map(i => i.raw)).toString('hex').toUpperCase());
  at('bankA44D', 0x80A44D, 'ASL'); at('bankA44D', 0x80A44E, 'SEP', 0x20);
  at('bankA44D', 0x80A450, 'LDA', 0x99); at('bankA44D', 0x80A452, 'ADC', 0);
  assert.deepEqual(bank.filter(i => i.mnemonic === 'STA').map(i => [i.value, i.state.m]),
    [[0x88, 1], [0xCDC, 1], [0x9F, 1], [0x9C, 1], [0xF5, 1], [0xFE, 1]]);
  at('bankA44D', 0x80A461, 'REP', 0x20); assert.equal(at('bankA44D', 0x80A463, 'RTS').state.m, 0);
  assert.ok(bank.every(i => i.target === undefined)); assert.match(report.bank_helper.returns, /Decimal flag0 explicit/);
});

test('Selection preserves finalASL carry and WORD86 bit15 is set only after provedA44D return', () => {
  body(0x80A4BF, 'STA', 0x7E2DE2);
  for (const pc of [0x80A4C3, 0x80A4C4, 0x80A4C5]) body(pc, 'ASL');
  body(0x80A4C6, 'ADC', 0x7E2DE2); body(0x80A4CA, 'TAX'); body(0x80A4CB, 'LDA', 0x8D929D);
  body(0x80A4CF, 'STA', 0x86); body(0x80A4D1, 'JSR', undefined, 0x80A44D);
  body(0x80A4D4, 'LDA', 0x8000); body(0x80A4D7, 'TSB', 0x86);
  assert.match(report.selection, /same2DE2 owner asnative56/);
});

test('B0AC tests incomingN afterSTA rather than loadedA sign; both caller LDA values prove their local path', () => {
  at('timeSet', 0x81B0AC, 'STA', 0x1C6); at('timeSet', 0x81B0AF, 'BPL', undefined, 0x81B0B5);
  at('timeSet', 0x81B0B1, 'EOR', 0xFFFF); at('timeSet', 0x81B0B4, 'INC'); at('timeSet', 0x81B0B5, 'CLC');
  at('timeSet', 0x81B0B6, 'ADC', 8); at('timeSet', 0x81B0B9, 'STA', 0x1C8); at('timeSet', 0x81B0BC, 'RTL');
  body(0x80A4DA, 'LDA', 0xFFFE); body(0x80A4DD, 'JSL', undefined, 0x81B0AC);
  body(0x80A5D3, 'LDA', 2); body(0x80A5D6, 'JSL', undefined, 0x81B0AC);
  assert.match(report.time_helpers.set, /incomingN.*STA doesnotupdateflags/);
  assert.match(report.time_helpers.set, /No inferred absolute-value contract/);
});

test('B0BD writes distinct01C6/01BC WORDs; B0A1 rereads longcounter until change and never fabricates progress', () => {
  at('timeReset', 0x81B0BD, 'STZ', 0x1C6); at('timeReset', 0x81B0C0, 'LDA', 0x80);
  at('timeReset', 0x81B0C3, 'STA', 0x1BC); at('timeReset', 0x81B0C6, 'RTL');
  at('timeWait', 0x81B0A1, 'LDA', 0x7E1C76); at('timeWait', 0x81B0A5, 'CMP', 0x7E1C76);
  at('timeWait', 0x81B0A9, 'BEQ', undefined, 0x81B0A5); at('timeWait', 0x81B0AB, 'RTL');
  assert.match(report.time_helpers.wait, /No counterwrite,difference,catchup,timerduration/);
});

test('First conditional gate and header retain real WORD reads,zero decrement wrap and original reset/wait order', () => {
  body(0x80A4E1, 'JSR', undefined, 0x80BCB2); body(0x80A4E4, 'JSR', undefined, 0x80C1A6);
  body(0x80A4E7, 'LDA', 0x1FD6); body(0x80A4EA, 'BIT', 2); body(0x80A4ED, 'BEQ', undefined, 0x80A506);
  body(0x80A4EF, 'LDA', 0x1FB0); body(0x80A4F2, 'BPL', undefined, 0x80A506);
  body(0x80A4F4, 'LDY', 1); assert.equal(body(0x80A4F7, 'LDA', 0x86).state.m, 0);
  body(0x80A4F9, 'AND', 0xFF); body(0x80A4FC, 'CMP', 0xFF); body(0x80A4FF, 'BEQ', undefined, 0x80A50A);
  body(0x80A501, 'CMP', 0x1CDE); body(0x80A504, 'BEQ', undefined, 0x80A50A);
  body(0x80A50A, 'LDY', 2); body(0x80A50D, 'LDA', 0x86); body(0x80A50F, 'DEC'); body(0x80A510, 'STA', 0xCDA);
  body(0x80A513, 'LDA', 0x86); body(0x80A515, 'AND', 0xFF);
  assert.match(report.sequence.header, /nozero guard \(0->FFFF\)/);
});

test('Savedindex/table field reads and second gate pin four WORDwrites and all branch targets without data meaning', () => {
  body(0x80A4D9, 'PHX'); body(0x80A52F, 'PLX');
  body(0x80A530, 'LDA', 0x8D929F); body(0x80A534, 'AND', 0xFF); body(0x80A537, 'STA', 0x11);
  for (const [read, table, store, field] of [[0x80A539, 0x8D92A0, 0x80A53D, 0x14],
    [0x80A53F, 0x8D92A2, 0x80A543, 0x17], [0x80A545, 0x8D92A4, 0x80A549, 0x1A]]) {
    body(read, 'LDA', table); body(store, 'STA', field);
  }
  body(0x80A560, 'LDA', 0x1FD6); body(0x80A563, 'AND', 2); body(0x80A566, 'BEQ', undefined, 0x80A580);
  body(0x80A568, 'LDA', 0x1CDE); body(0x80A56B, 'CMP', 0xFFFF); body(0x80A56E, 'BNE', undefined, 0x80A584);
  body(0x80A570, 'LDY', 1); body(0x80A573, 'LDA', 0x86); body(0x80A575, 'AND', 0xFF);
  body(0x80A578, 'CMP', 0xFF); body(0x80A57B, 'BNE', undefined, 0x80A580); body(0x80A57D, 'LDA', 0x1FCA);
});

test('Three pointercount blocks use14,14,6 strides,completeWORD reads and balanced localWORD stacks', () => {
  for (const [read, pointer, push, shiftEnd, subtract, add, write, output, pop] of [
    [0x80A58B, 0x9D, 0x80A591, 0x80A594, 0x80A596, 0x80A599, 0x80A59B, 0xF3, 0x80A59D],
    [0x80A59E, 0xF3, 0x80A5A4, 0x80A5A7, 0x80A5A9, 0x80A5AC, 0x80A5AE, 0xF3, 0x80A5B0],
    [0x80A5B1, 0xF3, 0x80A5B7, 0x80A5BA, 0x80A5BB, 0x80A5BE, 0x80A5C0, 0xFC, 0x80A5C2],
  ]) {
    assert.equal(body(read, 'LDA', pointer).state.m, 0); body(read + 2, 'AND', 0xFF); body(read + 5, 'ASL');
    body(push, 'PHA');
    const shifts = [...maps.get('transitionA4BF').values()].filter(i => i.cpu > push && i.cpu <= shiftEnd);
    assert.equal(shifts.filter(i => i.mnemonic === 'ASL').length, output === 0xFC ? 2 : 3);
    body(subtract, 'SBC', 1); body(add - 1, 'SEC'); body(add, 'ADC', pointer); body(write, 'STA', output); body(pop, 'PLA');
  }
  assert.match(report.sequence.pointers, /Third uses6\*n\+1/);
  assert.deepEqual([...maps.get('transitionA4BF').values()].filter(i => ['PHX', 'PLX', 'PHA', 'PLA'].includes(i.mnemonic)).map(i => i.mnemonic),
    ['PHX', 'PLX', 'PHA', 'PLA', 'PHA', 'PLA', 'PHA', 'PLA']);
});

test('Render-separated1D61 WORDwrites and finalgateSEC require actual calleereturn; no full transition return is claimed', () => {
  body(0x80A5C3, 'JSR', undefined, 0x80BABB); body(0x80A5C6, 'STZ', 0x1D61);
  body(0x80A5C9, 'JSL', undefined, 0x81AD92); body(0x80A5CD, 'LDA', 0xFFFF);
  body(0x80A5D0, 'STA', 0x1D61); body(0x80A5DA, 'RTS');
  at('gateCaller', 0x8080AB, 'LDA', 0x9D); at('gateCaller', 0x8080AD, 'JSR', undefined, 0x80A4BF);
  at('gateCaller', 0x8080B0, 'SEC'); at('gateCaller', 0x8080B1, 'RTS');
  assert.equal(report.direct_writes.length, 13); assert.ok(report.direct_writes.every(w => w.width_bytes === 2));
  assert.match(report.sequence.final, /no unconditionallastvalueFFFF orfinalreturn guaranteed/);
  assert.match(report.scope, /full A4BF return remain unproved/);
});
