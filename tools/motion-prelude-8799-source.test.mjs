import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/motion-prelude-8799.json', import.meta.url), 'utf8'));
const motion = JSON.parse(await readFile(new URL('../analysis/slot-motion.json', import.meta.url), 'utf8'));
const mode = { e: 0, m: 0, x: 0 };
const windows = [
  [0x818799, 0x818861, 'b6a3a773f12dbcc485ffddc2405e6bcaa837e7f23526e403ecd5595895036025'],
  [0x8180F7, 0x8183FB, '068a96f422ce59fccf0591bead0199e4f23add9655880b4f4b21a64a692c4c8d'],
  [0x81846E, 0x8184CF, 'a02f9a7931112d7b2687837c31b721ceeb8aad458868145e2a6d2f6943837d85'],
];
const readWindow = (start, end) => {
  const map = new Map();
  for (let pc = start; pc < end;) {
    const i = decode(rom, pc, mode); assert.ok(i.next <= end); map.set(pc, i); pc = i.next;
  }
  assert.equal([...map.values()].at(-1).next, end); return map;
};
const routines = windows.map(([start, end]) => readWindow(start, end));
const all = new Map(routines.flatMap(r => [...r]));
const caller = readWindow(0x80AFC4, 0x80AFFC);
const ins = (pc, mnemonic, value, target) => {
  const i = all.get(pc) ?? caller.get(pc); assert.ok(i); assert.equal(i.mnemonic, mnemonic);
  if (value !== undefined) assert.equal(i.value, value);
  if (target !== undefined) assert.equal(i.target, target);
  return i;
};
const checkWindow = (source, start, end, digest) => {
  const raw = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
  assert.equal(createHash('sha256').update(raw).digest('hex'), digest);
  assert.deepEqual(source, { entry: cpuLabel(start), end_exclusive: cpuLabel(end), covered_bytes: raw.length,
    sha256: digest, machine_bytes: raw.toString('hex').toUpperCase() });
};

test('Complete8799 graph pins1069 bytes,13 edges,two calls and unchanged56-byte AFC4 caller', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), report.rom_sha256);
  windows.forEach(([start, end, digest], i) => checkWindow(report.routines[i], start, end, digest));
  assert.equal(report.routines.reduce((n, r) => n + r.covered_bytes, 0), 1069);
  const edges = [...all.values()].filter(i => i.target !== undefined);
  assert.equal(edges.length, 13);
  assert.deepEqual(report.edges, edges.map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })));
  for (const i of edges) assert.ok(all.has(i.target));
  assert.deepEqual(edges.filter(i => ['JSR', 'JSL'].includes(i.mnemonic)).map(i => [i.cpu, i.target]), [[0x81879F, 0x8180F7], [0x818840, 0x81846E]]);
  assert.equal([...all.values()].some(i => ['ind', 'indx', 'dil', 'dily', 'siy'].includes(i.mode)), false);
  checkWindow(report.caller_windows[0], 0x80AFC4, 0x80AFFC, '6b50cea385aeeb8e71d6dd79714bffa17930077aa70acfde2b580615bd5b2850');
  assert.equal(report.caller_windows[0].machine_bytes, motion.caller.machine_bytes);
  assert.equal(report.caller_windows[0].sha256, motion.caller.sha256);
});

test('Every prelude path has balanced BYTE/WORD local stack and RTL with incoming DBR restored and unchanged widths/D', () => {
  // Symbolic control-flow/stack proof only; no CPU or memory execution.
  for (const [index, routine] of routines.entries()) {
    const initialBank = index === 0 ? 'incomingDBR' : '7E';
    const pending = [[windows[index][0], [], initialBank]], seen = new Map(); let returns = 0;
    while (pending.length) {
      const [pc, incoming, incomingBank] = pending.pop(), signature = { stack: incoming, bank: incomingBank };
      if (seen.has(pc)) { assert.deepEqual(seen.get(pc), signature); continue; }
      seen.set(pc, signature); const i = routine.get(pc); assert.ok(i); assert.deepEqual(i.state, mode);
      assert.equal(['REP', 'SEP', 'PLP', 'XCE', 'TCD', 'PLD', 'SED', 'RTS', 'RTI', 'BRK', 'COP'].includes(i.mnemonic), false);
      const stack = [...incoming]; let bank = incomingBank;
      if (i.mnemonic === 'PHB') { assert.equal(pc, 0x818799); stack.push(bank); }
      if (i.mnemonic === 'PEA') { assert.equal(i.value, 0x7E7E); stack.push('7E', '7E'); }
      if (i.mnemonic === 'PLB') { bank = stack.pop(); assert.ok(bank); }
      if (i.mnemonic === 'PHX') { assert.equal(pc, 0x8187CB); stack.push('cursorHigh', 'cursorLow'); }
      if (i.mnemonic === 'PLY') { assert.equal(pc, 0x81884F); assert.equal(stack.pop(), 'cursorLow'); assert.equal(stack.pop(), 'cursorHigh'); }
      if (['abs', 'absx', 'absy'].includes(i.mode) && !['JMP', 'JSL'].includes(i.mnemonic)) assert.equal(bank, '7E');
      if (i.mnemonic === 'RTL') { assert.deepEqual(stack, []); assert.equal(bank, initialBank); returns++; continue; }
      if (i.mnemonic === 'JSL') {
        assert.equal(bank, '7E'); assert.ok(windows.some(([start]) => start === i.target)); pending.push([i.next, stack, bank]);
      } else if (['JMP', 'BRA'].includes(i.mnemonic)) pending.push([i.target, stack, bank]);
      else if (i.mode === 'rel8') pending.push([i.next, stack, bank], [i.target, stack, bank]);
      else pending.push([i.next, stack, bank]);
    }
    assert.equal(seen.size, routine.size); assert.equal(returns, 1);
  }
  ins(0x8184CC, 'LDX', 0x4D); // Record index restored by callee.
  ins(0x81884F, 'PLY'); ins(0x818857, 'TYX'); // Active cursor restored separately.
});

test('80F7 unconditionally resets exactly256 second heads before DEAA/A0 and negative active-list return, preserving first list', () => {
  ins(0x8180F7, 'LDA', 0xFFFF);
  const reset = [...routines[1].values()];
  assert.equal(reset.length, 258); assert.equal(reset.at(-1).mnemonic, 'RTL');
  assert.deepEqual(reset.slice(1, -1).map(i => [i.mnemonic, i.mode, i.value]), Array.from({ length: 256 }, (_, j) => ['STA', 'abs', 0xE0AC + j * 2]));
  ins(0x81879F, 'JSL', undefined, 0x8180F7); ins(0x8187A3, 'LDA', 0xDEAA); ins(0x8187A6, 'STA', 0xA0);
  ins(0x8187A8, 'LDX', 0x14B0); ins(0x8187AB, 'BPL', undefined, 0x8187B0); ins(0x8187AD, 'JMP', undefined, 0x81885F);
  assert.equal([...all.values()].some(i => ['STA', 'STX', 'STZ'].includes(i.mnemonic) && [0xDEAA, 0xDEAC].includes(i.value)), false);
  assert.equal(reset.slice(1, -1).some(i => i.value === 0xDF8E), false);
  assert.match(report.reset_80F7.order, /before DEAA read or14B0/);
  const read = report.accesses.find(a => a.from === '81:87A3');
  assert.equal(read.operation, 'read'); assert.match(read.bank_contract, /DBR7E.*WRAM/);
});

test('Prelude gates0100 then nonzero43A0, independently of0400, and descends original active list with exact conditional source order', () => {
  ins(0x8187B0, 'LDA', 0x0A74); ins(0x8187B3, 'STA', 0x20); ins(0x8187B5, 'LDY', 0x14B2);
  ins(0x8187B8, 'LDA', 0x1458); ins(0x8187BB, 'AND', 0x100); ins(0x8187BE, 'BNE', undefined, 0x8187C3);
  ins(0x8187C0, 'JMP', undefined, 0x818858); ins(0x8187C3, 'LDA', 0x43A0); ins(0x8187C6, 'BNE', undefined, 0x8187CB);
  ins(0x8187C8, 'JMP', undefined, 0x818858); ins(0x8187CB, 'PHX'); ins(0x8187CC, 'LDX', 0x20);
  assert.deepEqual([...routines[0].values()].filter(i => i.mode === 'absy' && ['LDA', 'ADC'].includes(i.mnemonic)).map(i => i.value),
    [0x1458, 0x43A0, 0x0E28, 0x4240, 0x0E80, 0x42F0, 0x0ED8, 0x43A0, 0x4298, 0x4348, 0x14B2]);
  ins(0x818858, 'DEX'); ins(0x818859, 'DEX'); ins(0x81885A, 'BMI', undefined, 0x81885F); ins(0x81885C, 'JMP', undefined, 0x8187B5);
  for (let word = 0; word < 65536; word++) {
    assert.equal(!!(word & 0x100), !!((word ^ 0x400) & 0x100));
    if (!(word & 0x8000)) {
      const count = Math.floor(word / 2) + 1;
      assert.equal((word - count * 2) & 0xFFFF, word & 1 ? 0xFFFF : 0xFFFE);
    }
  }
  for (let last = 0; last <= 0x56; last += 2) assert.equal(last / 2 + 1 <= 44, true);
});

test('Six record WORDs, logical quarters, wrapped extents, corner encoding and odd WORD metadata are source-pinned', () => {
  const recordWrites = [...routines[0].values()].filter(i => i.mnemonic === 'STA' && i.mode === 'absx');
  assert.deepEqual(recordWrites.map(i => [i.cpu, i.value]), [[0x8187D9, 0xE2AC], [0x8187F0, 0xE2AE], [0x818805, 0xE2B0], [0x81880C, 0xE2B6], [0x818815, 0xE2B2], [0x818827, 0xE2B4]]);
  assert.deepEqual(report.records.write_order, [0, 1, 2, 5, 3, 4]);
  assert.deepEqual([...routines[0].values()].filter(i => ['ADC', 'CLC'].includes(i.mnemonic)).map(i => [i.mnemonic, i.value]),
    [['CLC', 0], ['ADC', 0x4240], ['CLC', 0], ['ADC', 0x42F0], ['CLC', 0], ['ADC', 0x43A0], ['CLC', 0], ['ADC', 0x1A], ['CLC', 0], ['ADC', 0x1D], ['CLC', 0], ['ADC', 12]]);
  for (const pc of [0x8187D1, 0x8187D2, 0x8187E8, 0x8187E9, 0x818803, 0x818804, 0x81884C, 0x81884D]) ins(pc, 'LSR');
  ins(0x8187DC, 'AND', 0x3C0); ins(0x8187DF, 'ASL'); ins(0x8187E0, 'ASL'); ins(0x8187E1, 'ASL'); ins(0x8187E2, 'XBA');
  ins(0x8187F6, 'AND', 0x3C0); ins(0x8187F9, 'LSR');
  for (let word = 0; word < 65536; word++) {
    const shifted = (word & 0x3C0) << 3;
    const swapped = (shifted >>> 8) | ((shifted & 255) << 8);
    assert.equal(swapped, (word & 0x3C0) >>> 5);
    assert.ok((swapped | ((word & 0x3C0) >>> 1)) <= 0x1FE);
    assert.equal((word + 0xFFFF) & 0xFFFF, (word - 1) & 0xFFFF);
  }
  ins(0x818840, 'JSL', undefined, 0x81846E); ins(0x818846, 'ADC', 12); ins(0x818849, 'STA', 0x20);
  ins(0x818850, 'LDA', 0x14B2); ins(0x818853, 'STA', 0x7FE214);
  for (let index = 0; index < 44; index++) {
    const record = 0xA74 + index * 12;
    assert.equal(record >>> 2, 0x29D + index * 3);
    assert.equal((record >>> 1) & 1, 0); // Last wrapper LSR fixes Carry0 on bounded record progression.
  }
  assert.equal((0x7FE214 + (0xA74 >>> 2)) & 1, 1);
  assert.match(report.records.metadata, /odd address/);
});

test('846E prepends nodes in exact1/2/4 corner order, restores record X and derives Carry from CPY rather than assumed success', () => {
  ins(0x81846E, 'STX', 0x4D); ins(0x818470, 'LDX', 0xA0);
  for (const [first, record, next, head, inc1, inc2] of [
    [0x818472, 0x818476, 0x81847C, 0x818480, 0x818483, 0x818484],
    [0x818489, 0x81848D, 0x818493, 0x818497, 0x81849A, 0x81849B],
    [0x8184A4, 0x8184A8, 0x8184AE, 0x8184B2, 0x8184B5, 0x8184B6],
    [0x8184B7, 0x8184BB, 0x8184C1, 0x8184C5, 0x8184C8, 0x8184C9],
  ]) {
    ins(first, 'LDY'); ins(record, 'STA', 0xEF3C); ins(next - 3, 'LDA', 0xE0AC);
    ins(next, 'STA', 0xF79C); ins(head - 1, 'TXA'); ins(head, 'STA', 0xE0AC); ins(inc1, 'INX'); ins(inc2, 'INX');
  }
  ins(0x818485, 'CPY', 0x53); ins(0x818487, 'BEQ', undefined, 0x8184CA);
  ins(0x81849C, 'CPY', 0x56); ins(0x81849E, 'BEQ', undefined, 0x8184CA);
  ins(0x8184A0, 'CPY', 0x59); ins(0x8184A2, 'BEQ', undefined, 0x8184CA);
  ins(0x8184CA, 'STX', 0xA0); ins(0x8184CC, 'LDX', 0x4D); ins(0x8184CE, 'RTL');
  assert.deepEqual([...routines[2].values()].filter(i => i.mnemonic === 'LDY').map(i => i.value), [0x50, 0x53, 0x56, 0x59]);
  // Exhaustive16^4 cell combinations of the source's disjoint encoded bitfields.
  // Arithmetic set/order check, not an instruction interpreter or original scene.
  for (let h0 = 0; h0 < 16; h0++) for (let h1 = 0; h1 < 16; h1++) for (let v0 = 0; v0 < 16; v0++) for (let v1 = 0; v1 < 16; v1++) {
    const a = h0 * 2 | v0 * 32, b = h1 * 2 | v1 * 32, c = h1 * 2 | v0 * 32, d = h0 * 2 | v1 * 32;
    const selected = a === b ? [a] : b === c || b === d ? [a, b] : [a, b, c, d];
    const unique = new Set([a, b, c, d]);
    assert.deepEqual(new Set(selected), unique); assert.equal(selected.length, unique.size);
    assert.ok([1, 2, 4].includes(selected.length));
    assert.equal(selected.some(i => i & 1 || i > 0x1FE), false);
    const carry = selected.length < 4 ? 1 : Number(b >= d);
    if (selected.length === 4) assert.equal(carry, Number(h1 >= h0));
  }
  assert.match(report.returns.helper_846E, /Carry comes from last CPY/);
  assert.match(report.returns.wrapper, /Carry is bit1/);
});

test('Prelude aliases actual motion byte tables and shared scratch without task/workspace/slot writes; caller reloads list and still needs postpass and gates', async () => {
  const writes = [...all.values()].filter(i => ['STA', 'STX'].includes(i.mnemonic));
  const dp = [...new Set(writes.filter(i => i.mode === 'dp').map(i => i.value))];
  assert.deepEqual(dp, [0xA0, 0x20, 0x1A, 0x3E, 0x1D, 0x44, 0x50, 0x41, 0x47, 0x53, 0x56, 0x59, 0x4D]);
  assert.deepEqual(report.side_effects.scratch_words, dp.map(v => v.toString(16).toUpperCase()));
  assert.deepEqual(report.side_effects.shared_search_scratch, ['1A', '1D', '20', '3E']);
  ins(0x81881F, 'STA', 0x41);
  assert.match(report.side_effects.byte_alias, /high byte of WORD DP40/);
  assert.equal(dp.some(v => v < 0x10 || [0x6B, 0x68, 0xA2, 0xA5, 0xA8, 0xAB].includes(v)), false);
  assert.equal(writes.some(i => i.mode !== 'dp' && i.value < 0xE0AC), false);
  const old = JSON.parse(await readFile(new URL('../analysis/motion-helper-8133.json', import.meta.url), 'utf8'));
  assert.equal(old.rom_sha256, report.rom_sha256);
  const search = readWindow(0x8185FE, 0x818701);
  for (const [pc, mnemonic, operand] of [[0x8185FE, 'LDY', 0xEF3C], [0x818679, 'LDA', 0xF79C], [0x8186F0, 'LDX', 0xE0AC]]) {
    assert.equal(search.get(pc).mnemonic, mnemonic); assert.equal(search.get(pc).value, operand);
  }
  ins(0x80AFC4, 'JSL', undefined, 0x818799); ins(0x80AFC8, 'LDY', 0x14B0); ins(0x80AFCB, 'BMI', undefined, 0x80AFFB);
  ins(0x80AFD3, 'BIT', 0x400); ins(0x80AFD9, 'JSR', undefined, 0x80AB26);
  ins(0x80AFE4, 'STA', 0x40); ins(0x80AFF4, 'JSR', undefined, 0x80AC2F);
  assert.deepEqual([...caller.values()].filter(i => ['BCC', 'BCS', 'TAX', 'TAY', 'TYX', 'TXA'].includes(i.mnemonic)), []);
  assert.equal(rom.subarray(0x16C6, 0x16D3).toString('hex'), 'b0e3204bccb0de2094de20c4af');
  assert.match(report.entry_contract, /does not establish DBR00\/80/);
  assert.match(report.boundaries[0], /explicit7E:DEAA source/);
});
