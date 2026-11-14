import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/motion-helper-c9e0.json', import.meta.url), 'utf8'));
const prior = JSON.parse(await readFile(new URL('../analysis/slot-actions.json', import.meta.url), 'utf8'));
const mode = { e: 0, m: 0, x: 0 };
const windows = [
  [0x80C9E0, 0x80C9F1, '205ef9421df45d8128bf9b25956b1cb5fac035bb05c4a95dd89cb92c46b8dc20'],
  [0x80C84D, 0x80C913, '0f71d52dd51ad1fd11e291c3aef90ee0795386f8455d89b82f6cf9a72d5a1f1b'],
  [0x80C913, 0x80C9E0, '05831587d7ab5e9356da0144557b004164241e9f0c9cc71b5f08bd197fb3e33a'],
  [0x80C80C, 0x80C84D, '6f19fe9608efa11efe153ed60758245272d8a99184f4a28735e8e316c3cdb4c1'],
  [0x80AAAF, 0x80AB0A, 'e895d73069085b829b0b607e41098ce904fe1b64448ff050902ec00bc2839d7a'],
  [0x80A985, 0x80AA4C, 'a0cca355e81f04e9727e3e2e5b6c56a15b2bbacfb937d2e761660c15eb1539f4'],
];
const decodeWindow = (start, end) => {
  const map = new Map(); let state = { ...mode };
  for (let pc = start; pc < end;) {
    const i = decode(rom, pc, state); assert.ok(i.next <= end); map.set(pc, i); pc = i.next;
    if (['REP', 'SEP'].includes(i.mnemonic)) { assert.equal(i.value, 0x20); state = { ...state, m: i.mnemonic === 'SEP' ? 1 : 0 }; }
  }
  assert.equal([...map.values()].at(-1).next, end); return map;
};
const routines = windows.map(([start, end]) => decodeWindow(start, end));
const all = new Map(routines.flatMap(r => [...r]));
const checkWindow = (source, start, end, digest) => {
  const raw = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
  assert.equal(createHash('sha256').update(raw).digest('hex'), digest);
  assert.deepEqual(source, { entry: cpuLabel(start), end_exclusive: cpuLabel(end), covered_bytes: raw.length,
    sha256: digest, machine_bytes: raw.toString('hex').toUpperCase() });
};
const ins = (pc, mnemonic, value, target) => {
  const i = all.get(pc); assert.ok(i); assert.equal(i.mnemonic, mnemonic);
  if (value !== undefined) assert.equal(i.value, value);
  if (target !== undefined) assert.equal(i.target, target);
  return i;
};

test('Complete C9E0 graph pins775 bytes,70 edges and seven calls including unchanged6A/A985 sources', () => {
  windows.forEach(([start, end, digest], index) => checkWindow(report.routines[index], start, end, digest));
  assert.equal(report.routines.reduce((n, r) => n + r.covered_bytes, 0), 775);
  const edges = [...all.values()].filter(i => i.target !== undefined);
  assert.equal(edges.length, 70);
  assert.deepEqual(report.edges, edges.map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })));
  for (const i of edges) assert.ok(all.has(i.target));
  assert.deepEqual(edges.filter(i => i.mnemonic === 'JSR').map(i => [i.cpu, i.target]), [
    [0x80C9E9, 0x80C84D], [0x80C9ED, 0x80C913], [0x80C858, 0x80C80C], [0x80C8A6, 0x80AAAF],
    [0x80C91F, 0x80C80C], [0x80C990, 0x80AAAF], [0x80AADA, 0x80A985],
  ]);
  // Reconstruct the previously covered windows from overlapping source listings.
  for (const [name, index] of [['native_6A', 4], ['helper_A985', 5]]) {
    const [start, end] = windows[index]; const covered = new Map();
    const coverage = prior.coverage.find(c => c.name === name);
    assert.equal(coverage.byte_length, end - start);
    for (const block of prior.source_blocks) {
      const raw = Buffer.from(block.machine_bytes, 'hex'), entry = Number.parseInt(block.entry, 16);
      for (let j = 0; j < raw.length; j++) if (entry + j >= start && entry + j < end) {
        if (covered.has(entry + j)) assert.equal(covered.get(entry + j), raw[j]);
        covered.set(entry + j, raw[j]);
      }
    }
    assert.equal(covered.size, end - start);
    assert.equal(Buffer.from(Array.from({ length: end - start }, (_, i) => covered.get(start + i))).toString('hex').toUpperCase(), report.routines[index].machine_bytes);
  }
});

test('Every C9E0 instruction has reachable CFG, balanced local stack and word-mode return; DBR/D stay inherited', () => {
  // Abstract stack and width verification only; no register/memory execution.
  for (const [index, routine] of routines.entries()) {
    const pending = [[windows[index][0], [], 0]], seen = new Map(), returns = [];
    while (pending.length) {
      const [pc, incoming, incomingM] = pending.pop(), signature = { stack: incoming, m: incomingM };
      if (seen.has(pc)) { assert.deepEqual(seen.get(pc), signature); continue; }
      seen.set(pc, signature); const i = routine.get(pc); assert.ok(i);
      assert.equal(i.state.m, incomingM); assert.equal(i.state.e, 0); assert.equal(i.state.x, 0);
      assert.equal(['PLP', 'XCE', 'TCD', 'PLD', 'PLB', 'PHB', 'SED', 'JSL', 'JML', 'RTI'].includes(i.mnemonic), false);
      const stack = [...incoming]; let nextM = incomingM;
      if (i.mnemonic === 'PHY') stack.push('directionWORD');
      if (i.mode === 'sr') { assert.equal(i.value, 1); assert.equal(stack.at(-1), 'directionWORD'); assert.equal(incomingM, 0); }
      if (i.mnemonic === 'PLA') { assert.equal(incomingM, 0); assert.equal(stack.pop(), 'directionWORD'); }
      if (['REP', 'SEP'].includes(i.mnemonic)) {
        assert.equal(index, 4); assert.equal(i.value, 0x20);
        assert.equal(pc, i.mnemonic === 'SEP' ? 0x80AAEA : 0x80AAFA); nextM = i.mnemonic === 'SEP' ? 1 : 0;
      }
      if (i.mnemonic === 'RTS') { assert.equal(incomingM, 0); assert.deepEqual(stack, []); returns.push(pc); continue; }
      if (i.mnemonic === 'JSR') { assert.equal(incomingM, 0); assert.ok(windows.some(([start]) => start === i.target)); pending.push([i.next, stack, nextM]); }
      else if (['JMP', 'BRA'].includes(i.mnemonic)) pending.push([i.target, stack, nextM]);
      else if (i.mode === 'rel8') pending.push([i.next, stack, nextM], [i.target, stack, nextM]);
      else pending.push([i.next, stack, nextM]);
    }
    assert.equal(seen.size, routine.size); assert.ok(returns.length > 0);
  }
  ins(0x80AAAF, 'LDX', 0); // 6A reloads original slot.
  ins(0x80A985, 'LDY', 0); ins(0x80A994, 'TYX'); ins(0x80A9B9, 'TYX'); // A985 restores slot after its table-index X.
  assert.equal([...routines[5].values()].filter(i => ['LDY', 'TAY', 'INY'].includes(i.mnemonic) && i.cpu < 0x80A9B9).length, 1);
});

test('C80C pins conditional target reads, sign words, two wrapped magnitudes and wrapped unsigned distance', () => {
  assert.deepEqual([...routines[3].values()].filter(i => ['STA', 'STZ'].includes(i.mnemonic)).map(i => [i.mnemonic, i.value]),
    [['STZ', 0xA8], ['STZ', 0xAB], ['STA', 0xA8], ['STA', 0xA2], ['STA', 0xAB], ['STA', 0xA5]]);
  ins(0x80C810, 'LDA', 0x7E4190); ins(0x80C814, 'BNE', undefined, 0x80C81E);
  ins(0x80C816, 'LDA', 0x7E41E8); ins(0x80C81A, 'TAY'); ins(0x80C81B, 'LDA', 0x0E28);
  ins(0x80C81E, 'SEC'); ins(0x80C81F, 'SBC', 0x0E28); ins(0x80C822, 'BPL', undefined, 0x80C82A);
  ins(0x80C826, 'EOR', 0xFFFF); ins(0x80C829, 'INC');
  ins(0x80C82C, 'LDA', 0x7E4190); ins(0x80C830, 'BNE', undefined, 0x80C837);
  ins(0x80C832, 'LDA', 0x0E80); ins(0x80C837, 'LDA', 0x7E41E8);
  ins(0x80C83B, 'SEC'); ins(0x80C83C, 'SBC', 0x0E80); ins(0x80C83F, 'BPL', undefined, 0x80C847);
  ins(0x80C843, 'EOR', 0xFFFF); ins(0x80C846, 'INC'); ins(0x80C849, 'CLC'); ins(0x80C84A, 'ADC', 0xA2);
  // Static word arithmetic examples, not a CPU interpreter or invented scene.
  assert.equal(((0x8000 ^ 0xFFFF) + 1) & 0xFFFF, 0x8000);
  assert.equal((0x8000 + 0x8000) & 0xFFFF, 0); // Original distance cutoff can see zero after wrap.
  assert.equal((0 - 1) & 0xFFFF, 0xFFFF);
  assert.deepEqual(report.side_effects.own_scratch_words, ['A2', 'A5', 'A8', 'AB']);
});

test('C84D pins dispatch, timer early return, prior collision flag, axis threshold and stop-task traversal', () => {
  ins(0x80C9E4, 'AND', 1); ins(0x80C9E7, 'BEQ', undefined, 0x80C9ED);
  ins(0x80C851, 'DEC'); ins(0x80C852, 'STA', 0x7E40E0); ins(0x80C856, 'BNE', undefined, 0x80C8CE);
  ins(0x80C85B, 'CMP', 0x10); ins(0x80C85E, 'BCS', undefined, 0x80C863); ins(0x80C860, 'JMP', undefined, 0x80C8F3);
  ins(0x80C863, 'LDA', 0x1458); ins(0x80C866, 'AND', 8); ins(0x80C869, 'BNE', undefined, 0x80C8CF);
  ins(0x80C86B, 'LDA', 2); ins(0x80C86E, 'STA', 0x7E40E0);
  ins(0x80C87D, 'CMP', 0x0C); ins(0x80C880, 'BCC', undefined, 0x80C8E1);
  ins(0x80C892, 'CMP', 0x0C); ins(0x80C895, 'BCC', undefined, 0x80C8E1);
  ins(0x80C8CF, 'LDA', 0x1E); ins(0x80C8D2, 'STA', 0x7E40E0);
  ins(0x80C8DD, 'BEQ', undefined, 0x80C897); ins(0x80C8DF, 'BRA', undefined, 0x80C882);
  ins(0x80C8E5, 'EOR', 2); ins(0x80C8E8, 'STA', 0x7E4138);
  ins(0x80C8EF, 'BEQ', undefined, 0x80C882); ins(0x80C8F1, 'BRA', undefined, 0x80C897);
  ins(0x80C8F3, 'STZ', 0x0D20); ins(0x80C8F6, 'STZ', 0x0D78);
  ins(0x80C8F9, 'LDY', 0x1350); ins(0x80C8FC, 'BMI', undefined, 0x80C8CE);
  ins(0x80C8FE, 'LDA', 0x0BA2); ins(0x80C901, 'BPL', undefined, 0x80C909);
  ins(0x80C903, 'LDA', 0x0372); ins(0x80C906, 'TAY'); ins(0x80C907, 'BRA', undefined, 0x80C8FE);
  ins(0x80C909, 'LDA', 0x0C62); ins(0x80C90C, 'ORA', 4); ins(0x80C90F, 'STA', 0x0C62);
  assert.equal(rom.subarray(0x48FE, 0x4913).toString('hex'), rom.subarray(0x49CB, 0x49E0).toString('hex')); // Byte-identical task loop; no sentinel/cycle test after link.
});

test('C913 pins inclusive direction priority, asymmetric6A gate and stack direction independent of clobbered workspace', () => {
  ins(0x80C917, 'DEC'); ins(0x80C918, 'STA', 0x7E40E0); ins(0x80C91C, 'BEQ', undefined, 0x80C91F);
  ins(0x80C922, 'CMP', 0x10); ins(0x80C927, 'JMP', undefined, 0x80C9C0);
  ins(0x80C92A, 'LDA', 0xA5); ins(0x80C92C, 'LSR'); ins(0x80C92D, 'CMP', 0xA2); ins(0x80C92F, 'BCS', undefined, 0x80C966);
  ins(0x80C931, 'LDA', 0xA2); ins(0x80C933, 'LSR'); ins(0x80C934, 'CMP', 0xA5); ins(0x80C936, 'BCS', undefined, 0x80C958);
  assert.deepEqual([0x80C940, 0x80C945, 0x80C94E, 0x80C953, 0x80C95C, 0x80C961, 0x80C96A].map(pc => ins(pc, 'LDY').value), [5, 7, 3, 1, 6, 2, 4]);
  ins(0x80C96F, 'TAY'); ins(0x80C970, 'STX', 0); ins(0x80C972, 'STY', 2); ins(0x80C974, 'PHY');
  ins(0x80C979, 'BEQ', undefined, 0x80C984); ins(0x80C97B, 'LSR'); ins(0x80C97C, 'LSR');
  assert.equal(ins(0x80C97D, 'CMP', 1).mode, 'sr'); ins(0x80C97F, 'BEQ', undefined, 0x80C990);
  ins(0x80C981, 'LDY', 0xFFFF); assert.equal(ins(0x80C984, 'LDA', 1).mode, 'sr');
  ins(0x80C986, 'SEC'); ins(0x80C987, 'ROL'); ins(0x80C988, 'ASL'); ins(0x80C989, 'STA', 0x7E4138);
  ins(0x80C98D, 'TYA'); ins(0x80C98E, 'BMI', undefined, 0x80C993); ins(0x80C990, 'JSR', undefined, 0x80AAAF);
  ins(0x80C993, 'PLA'); ins(0x80C994, 'ASL'); ins(0x80C995, 'TAY');
  ins(0x80C996, 'LDA', 0x1038); ins(0x80C999, 'CMP', 2); ins(0x80C99C, 'BEQ', undefined, 0x80C9AC);
  ins(0x80C9B8, 'LDA', 2); ins(0x80C9BB, 'STA', 0x7E40E0);
  ins(0x80C8A5, 'PHY'); ins(0x80C8A6, 'JSR', undefined, 0x80AAAF); ins(0x80C8A9, 'PLA');
});

test('C9E0 pins tables with inherited DBR, byte6A accesses, callee writes and caller flags-clear after return', () => {
  const digests = ['f5e37669458cda34ef98a0aa3ebf4c61071d2e94fda583c85762f55d1fe0147a', 'bfa04036c76731555b5c53ef195dff02113b76d5efd7b3d66fc74425292a4bf2',
    '9e9cefd67eabfbd02fef09fdf3339290ba7562d9ad9e6844fa1dab33563ed258', '72ac780683b05a18d0ef6a81b334b64c73d523eaa265a317cd9e3ea8df165c18'];
  const tableWords = [[0, 2, 2, 2, 0, 0xFFFE, 0xFFFE, 0xFFFE], [2, 2, 0, 0xFFFE, 0xFFFE, 0xFFFE, 0, 2],
    [0, 3, 4, 3, 0, 0xFFFD, 0xFFFC, 0xFFFD], [4, 3, 0, 0xFFFD, 0xFFFC, 0xFFFD, 0, 3]];
  report.tables.forEach(({ words, ...source }, i) => {
    checkWindow(source, 0x80C7CC + i * 16, 0x80C7DC + i * 16, digests[i]); assert.deepEqual(words, tableWords[i]);
  });
  assert.equal(report.tables.length, 4);
  assert.deepEqual([...all.values()].filter(i => i.mode === 'absy' && i.value >= 0xC7CC && i.value <= 0xC7FC).map(i => i.value),
    [0xC7CC, 0xC7DC, 0xC7EC, 0xC7FC, 0xC7CC, 0xC7DC, 0xC7EC, 0xC7FC]);
  assert.match(report.entry_contract, /DBR7E would select high WRAM/);
  for (const [pc, width] of [[0x80AAEC, 1], [0x80AAEF, 1], [0x80AAF1, 2], [0x80AAF5, 1], [0x80AAF7, 1], [0x80A9BD, 2], [0x80A9ED, 2]]) {
    assert.equal(report.accesses.find(a => a.from === cpuLabel(pc)).width_bytes, width);
  }
  ins(0x80AAB6, 'BEQ', undefined, 0x80AB09); ins(0x80AAC0, 'BEQ', undefined, 0x80AAC7); ins(0x80AAC5, 'BCC', undefined, 0x80AADF);
  ins(0x80AACD, 'BEQ', undefined, 0x80AB09); ins(0x80AAD2, 'STA', 2); ins(0x80AAD7, 'STA', 0x1038);
  ins(0x80A99D, 'ASL'); ins(0x80A99E, 'ADC', 0x8CED8A); ins(0x80A9AD, 'LDA', 0); ins(0x80A9B1, 'ADC', 8); // No CLC between pointer ADCs.
  assert.equal([...routines[5].values()].some(i => i.mnemonic === 'CLC' && i.cpu >= 0x80A99D && i.cpu <= 0x80A9B1), false);
  const writes = [...routines[0].values(), ...routines[1].values(), ...routines[2].values(), ...routines[3].values()].filter(i => ['STA', 'STX', 'STY', 'STZ'].includes(i.mnemonic));
  assert.deepEqual([...new Set(writes.map(i => i.value))].sort((a, b) => a - b), [0, 2, 0xA2, 0xA5, 0xA8, 0xAB, 0x0C62, 0x0D20, 0x0D78, 0x7E40E0, 0x7E4138]);
  checkWindow(report.caller_windows[0], 0x80AB26, 0x80AB38, '0e8f7f22baff22f6ad7ca092e5b7b978e53577dc63789137b71bdebac9f5d87a');
  const caller = decodeWindow(0x80AB26, 0x80AB38);
  assert.equal(caller.get(0x80AB2A).target, 0x80AB2F); assert.equal(caller.get(0x80AB2C).target, 0x80C9E0);
  assert.equal(caller.get(0x80AB2F).value, 0x1458); assert.equal(caller.get(0x80AB32).value, 0xFFF7); assert.equal(caller.get(0x80AB35).value, 0x1458);
  assert.deepEqual(report.caller_edges, [...caller.values()].filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })));
});
