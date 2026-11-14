import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-999a.json', import.meta.url), 'utf8'));
const windows = [
  ['paletteRequest999A', 0x80999A, 0x8099EB, 40, 'c90a0be74ae4dbcc7c22e80cfa125f5d2ff78f9e38d975c93af68832d4bb1643'],
  ['callbackPrefixC152', 0x80C152, 0x80C166, 7, '0cd435aa13c56e79c0b5d137b6db83e87a14a9bf0e9a0e43b726285992f65e0f'],
];
// Independent literal mode regions, rather than the analyzer's REP/SEP tracking.
const byteRegions = [[0x8099BC, 0x8099D0], [0x8099D6, 0x8099E7], [0x80C154, 0x80C15B]];
const instructions = new Map();
for (const [, start, end] of windows) for (let pc = start; pc < end;) {
  const i = decode(rom, pc, { e: 0, m: Number(byteRegions.some(([lo, hi]) => pc >= lo && pc < hi)), x: 0 });
  assert.ok(i.next <= end); instructions.set(pc, i); pc = i.next;
}
const range = (start, end) => [...instructions.values()].filter(i => i.cpu >= start && i.cpu < end);
const at = (pc, op, value, target) => {
  const i = instructions.get(pc); assert.ok(i, cpuLabel(pc)); assert.equal(i.mnemonic, op);
  if (value !== undefined) assert.equal(i.value, value);
  if (target !== undefined) assert.equal(i.target, target);
  return i;
};

test('999A source pins the entire local body and separately the selected caller prefix', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), report.rom_sha256);
  for (const [name, start, end, count, sha256] of windows) {
    const bytes = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256);
    assert.equal(range(start, end).length, count);
    assert.deepEqual(report.windows.find(w => w.name === name), { name, entry: cpuLabel(start), end_exclusive: cpuLabel(end),
      covered_bytes: end - start, instruction_count: count, sha256, machine_bytes: bytes.toString('hex').toUpperCase() });
  }
  assert.equal(report.code_bytes, 81); assert.equal(report.caller_bytes, 20);
  assert.equal(report.instruction_count, 40); assert.equal(report.caller_instruction_count, 7);
});

test('999A early gates reach RTS directly and never clear the pending flag on a zero count', () => {
  at(0x80999A, 'LDA', 0xD0E); at(0x80999D, 'BEQ', undefined, 0x8099EA);
  at(0x80999F, 'LDA', 0xD10); at(0x8099A2, 'BEQ', undefined, 0x8099EA);
  assert.equal(at(0x80999A, 'LDA').state.m, 0);
  assert.equal(at(0x80999F, 'LDA').state.m, 0);
  assert.ok(range(0x80999A, 0x8099A4).every(i => ['LDA', 'BEQ'].includes(i.mnemonic)));
  assert.deepEqual(report.gates.order, ['WORD0D0E', 'WORD0D10']);
  assert.match(report.gates.effects, /without clearing0D0E/);
});

test('999A doubles the nonzero count as a WORD and enters before two WORD decrements', () => {
  at(0x8099A4, 'ASL'); assert.equal(at(0x8099A5, 'TAY').state.m, 0);
  at(0x8099D0, 'DEY'); at(0x8099D1, 'DEY'); at(0x8099D2, 'BNE', undefined, 0x8099A6);
  assert.equal(at(0x8099D0, 'DEY').state.x, 0);
  // Algebraic counter proof for every input, without memory or instruction execution.
  for (let count = 0; count <= 65535; count++) {
    const y = (count << 1) & 65535;
    const visits = count === 0 ? 0 : y === 0 ? 32768 : y / 2;
    assert.equal(visits, count === 0 ? 0 : (count % 32768 || 32768));
    if (visits) { assert.equal((y - visits * 2) & 65535, 0); assert.equal((y - (visits - 1) * 2) & 65535, 2); }
  }
  assert.deepEqual(report.loop.counts.map(c => [c.count, c.initialY, c.nominalIterations]),
    [[0, 0, 0], [1, 2, 1], [32767, 65534, 32767], [32768, 0, 32768], [32769, 2, 1], [65535, 65534, 32767]]);
});

test('999A pointer uses bit11 Carry from five WORD shifts, with no inserted CLC or clamp', () => {
  const load = at(0x8099A6, 'LDA', 0xCFE); assert.equal(load.mode, 'absy'); assert.equal(load.state.m, 0);
  assert.deepEqual(range(0x8099A9, 0x8099AE).map(i => [i.mnemonic, i.state.m]), Array(5).fill(['ASL', 0]));
  at(0x8099AE, 'ADC', 0xF624); at(0x8099B1, 'STA', 0x4342);
  for (let record = 0; record <= 65535; record++) {
    // Independent binary decomposition of the shifted-out five-bit group.
    const shifted = (record & 0x7FF) << 5, carry = (record >>> 11) & 1;
    assert.equal((shifted + 0xF624 + carry) & 65535, (record * 32 + 0xF624 + carry) % 65536);
  }
  for (const [record, pointer] of [[0, 0xF624], [1, 0xF644], [0x7FF, 0xF604], [0x800, 0xF625], [0xFFFF, 0xF605]])
    assert.equal(report.loop.pointers.find(p => p.value === record).pointer, pointer);
  assert.equal(report.loop.pointers.find(p => p.value === 0x400).overflow, 1);
  assert.equal(report.loop.pointers.find(p => p.value === 0x800).shiftCarry, 1);
});

test('999A preserves the exact five register stores and BYTE palette index formula per visit', () => {
  at(0x8099B4, 'LDA', 0x1E); at(0x8099B7, 'STA', 0x4345); at(0x8099BA, 'SEP', 32);
  assert.equal(at(0x8099BC, 'TYA').state.m, 1);
  assert.deepEqual(range(0x8099BD, 0x8099C1).map(i => [i.mnemonic, i.state.m]), [['ASL', 1], ['ASL', 1], ['ASL', 1], ['INC', 1]]);
  at(0x8099C4, 'LDA', 0x8C); at(0x8099C9, 'LDA', 0x10); at(0x8099CE, 'REP', 32);
  assert.deepEqual(range(0x8099A6, 0x8099D0).filter(i => i.mnemonic === 'STA').map(i => [i.value, i.state.m]),
    [[0x4342, 0], [0x4345, 0], [0x2121, 1], [0x4344, 1], [0x420B, 1]]);
  for (let y = 0; y <= 65535; y += 2) assert.equal((((y & 255) << 3) + 1) & 255, (y * 8 + 1) % 256);
  assert.ok(!range(0x80999A, 0x8099EB).some(i => [0x4340, 0x4341].includes(i.value)));
});

test('999A tail reads two separate fresh BYTEs and only then clears the WORD pending flag', () => {
  at(0x8099D4, 'SEP', 32); at(0x8099D6, 'STZ', 0x2121);
  at(0x8099D9, 'LDA', 0xD12); at(0x8099DC, 'STA', 0x2122);
  at(0x8099DF, 'LDA', 0xD13); at(0x8099E2, 'STA', 0x2122); at(0x8099E5, 'REP', 32);
  assert.equal(at(0x8099E7, 'STZ', 0xD0E).state.m, 0); at(0x8099EA, 'RTS');
  assert.deepEqual(range(0x8099D6, 0x8099E5).map(i => i.state.m), [1, 1, 1, 1, 1]);
  assert.deepEqual(report.tail.order, ['BYTE2121=00', 'BYTEread0D12', 'BYTE2122=0D12', 'BYTEread0D13', 'BYTE2122=0D13', 'REP20', 'WORDclear0D0E', 'RTS99EA']);
});

test('999A active return retains zero accumulator highbyte but N/Z from the last BYTE read', () => {
  const active = range(0x8099BA, 0x8099EB);
  assert.ok(!active.some(i => ['XBA', 'PLP', 'PLA', 'TSC', 'TDC', 'CLC', 'SEC', 'CLV'].includes(i.mnemonic)));
  assert.deepEqual(range(0x8099CE, 0x8099EB).filter(i => i.mnemonic === 'LDA').map(i => [i.value, i.state.m]), [[0xD12, 1], [0xD13, 1]]);
  // Last nominal visit is Y2; its last BYTE shift emits Carry0, preserved through the tail.
  assert.equal((2 * 4 >>> 7) & 1, 0);
  assert.match(report.tail.registers, /A0080 hasN1 despite WORDreturn/);
  assert.match(report.tail.registers, /V from final pointerADC/);
  assert.match(report.tail.registers, /I preserved/);
});

test('999A full local graph closes all modes at RTS without callees or local stack pushes', () => {
  assert.deepEqual(proveWordStack(instructions, 0x80999A, 'RTS'), report.local_graph.proof);
  assert.equal(report.local_graph.proof.reachable_instructions, 40);
  assert.deepEqual(report.local_graph.proof.returns, [{ at: '80:99EA', m: 0, x: 0, dbr: 'entry' }]);
  assert.deepEqual(report.local_graph.edges, [{ from: '80:999D', kind: 'BEQ', to: '80:99EA' },
    { from: '80:99A2', kind: 'BEQ', to: '80:99EA' }, { from: '80:99D2', kind: 'BNE', to: '80:99A6' }]);
  assert.deepEqual(report.local_graph.calls, []);
  assert.ok(!range(0x80999A, 0x8099EB).some(i => /^(PH|PL)|^(JSR|JSL|TCD|TCS|SED|XCE)$/.test(i.mnemonic)));
  assert.equal(report.local_graph.actual_transfer_termination_proven, false);
});

test('999A selected caller is an instruction-valid JSR after8949/A9E1, with eight remaining callees', () => {
  at(0x80C152, 'SEP', 32); at(0x80C154, 'LDA', 0x80); at(0x80C156, 'STA', 0x2100);
  at(0x80C159, 'REP', 32); at(0x80C15B, 'JSL', undefined, 0x818949);
  at(0x80C15F, 'JSL', undefined, 0x81A9E1); at(0x80C163, 'JSR', undefined, 0x80999A);
  assert.deepEqual(report.caller.remaining_after, ['81:80C4', '81:A919', '81:A958', '81:A98E', '80:8FBA', '80:9E0B', '80:C06B', '81:B0D1']);
  assert.deepEqual(report.caller.scan.raw_jsr_candidates, ['80:C163']);
  assert.match(report.caller.scan.qualification, /no indirect\/reachability\/allcallsite proof/);
  assert.match(report.caller.order, /Actual NMI sets DBR00/);
});

test('999A bankcarry and live aliases remain explicit source and byte ownership boundaries', () => {
  for (const [y, address] of [[0x10, 0xD0E], [0x12, 0xD10], [0x14, 0xD12], [0x3646, 0x4344], [0x3644, 0x4342]])
    assert.equal(0xCFE + y, address);
  assert.equal(0x7E0CFE + 0xF302, 0x7F0000); // Indexed addition, no low-WORD truncation.
  assert.match(report.ownership.addressing, /real|may cross bank/);
  assert.match(report.ownership.aliases, /no immutable independent record copy/);
  assert.match(report.ownership.device, /no channel4 mode\/target init/);
  assert.deepEqual(report.manufacturer.sections, ['3.5.4', '7.3', '7.20', '7.23']);
  assert.match(report.scope, /native999A atomic plan supplied separately/);
  assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
});
