import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';
import { inspectScriptTables } from './scripts.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/motion-prefix-writers.json', import.meta.url), 'utf8'));
// Independent fixed source windows and instruction-width intervals, not the analyzer's tracker.
const windows = [
  ['reset88', 0x80DE7E, 0x80DE94, 8, '2df28f4d95d70f5e1f6d493c0eac4585cc5e78f08aaf8bd4a84da44e393c5d8d'],
  ['initializer', 0x81891A, 0x818949, 18, '56f29fe7a8bd65c0547ca3f7a2e3722ee511a454e27063c3049e36364fd6752d'],
  ['starter', 0x80881C, 0x808840, 14, '2ee6377891b0e655c36914c8747d5a8f7f844370d4cc3a233b5d6e782a727a7c'],
  ['audioSelected', 0x80C46E, 0x80C4B3, 28, 'ce0aef528b83978bd42e83f7eca36565f48f0ee212846c2f42fd109ff3cc2e92'],
  ['multiply', 0x80C416, 0x80C461, 38, '7fb47acd393f216dfa9128685feddfe2a01cbd93f7c2814cd6841b264e703bc3'],
  ['apuHandshake', 0x81F007, 0x81F024, 15, 'ea46b86b724dbd5b6dbc861317cc51dbf4a39776940179f193f961e331110cb8'],
  ['starterCaller', 0x808772, 0x808778, 3, '8eed674249bc3558b873c34d1c2cdf5d1c50d27d3284025c7d7abe7c7948debb'],
  ['initCaller', 0x809642, 0x809652, 4, 'd2824b408a505bc2578dd14b6999c416fad073024a1161832dc703ad42d41c70'],
  ['renderBoundary', 0x81AD92, 0x81AD96, 1, '5620e3f6415eefef26330a7edd034f729122bd56fb44d8ae4b450b4eb6589c06'],
];
const maps = new Map();
for (const [name, start, end] of windows) {
  const instructions = new Map();
  for (let pc = start; pc < end;) {
    const m = Number((pc >= 0x818937 && pc <= 0x818946) || (pc >= 0x80C447 && pc <= 0x80C45D) || (pc >= 0x81F00A && pc <= 0x81F022));
    const i = decode(rom, pc, { e: 0, m, x: 0 }); assert.ok(i.next <= end); instructions.set(pc, i); pc = i.next;
  }
  maps.set(name, instructions);
}
const at = (name, pc, op, value, target) => {
  const i = maps.get(name).get(pc); assert.ok(i, cpuLabel(pc)); assert.equal(i.mnemonic, op);
  if (value !== undefined) assert.equal(i.value, value);
  if (target !== undefined) assert.equal(i.target, target);
  return i;
};
const writes = name => [...maps.get(name).values()].filter(i => ['STA', 'STZ', 'STX', 'STY'].includes(i.mnemonic));

test('Selected writer source pins278 body/helper bytes,22 caller bytes,4 render bytes and independent digests', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  assert.equal(report.source_bytes, 278); assert.equal(report.windows.length, windows.length);
  for (const [name, start, end, count, digest] of windows) {
    const raw = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), digest);
    assert.equal(maps.get(name).size, count);
    assert.deepEqual(report.windows.find(w => w.name === name), { name, entry: cpuLabel(start), end_exclusive: cpuLabel(end),
      covered_bytes: end - start, instruction_count: count, sha256: digest, machine_bytes: raw.toString('hex').toUpperCase() });
  }
});

test('Native88 pointer and zero-argument/return ABI anchor the complete reset, excluding adjacentDE94', () => {
  const native = inspectScriptTables(rom).native_functions.find(n => n.id === '88');
  assert.deepEqual(native, { id: '88', cpu_address: '80:DE7E', rom_offset: '005E7E', argument_words: 0, return_bytes: 0 });
  assert.equal(rom.readUInt16LE(0x158C8), 0xDE7E); assert.equal(rom[0x15AD4], 0); assert.equal(rom[0x159F8], 0);
  assert.deepEqual(report.native88.table_rom_offsets, { pointer: 0x158C8, arguments: 0x15AD4, returns: 0x159F8 });
  at('reset88', 0x80DE93, 'RTS'); assert.equal(maps.get('reset88').has(0x80DE94), false);
  assert.deepEqual([...maps.get('reset88').values()].map(i => i.mnemonic), ['LDA', 'STA', 'STZ', 'STZ', 'STZ', 'STZ', 'STZ', 'RTS']);
});

test('Reset88 requires all six odd WORD writes in order, preserves holes and never writes pointer or movement', () => {
  at('reset88', 0x80DE7E, 'LDA', 0xFFFF);
  const expected = [[0x1D5B, 0xFFFF], [0x1D5D, 0], [0x1D5F, 0], [0x1D65, 0], [0x1D6B, 0], [0x1D6D, 0]];
  assert.deepEqual(writes('reset88').map(i => [i.value, i.mnemonic === 'STA' ? 0xFFFF : 0]), expected);
  assert.deepEqual(report.reset.ordered_word_writes, expected);
  const touched = new Set();
  for (const i of writes('reset88')) { assert.equal(i.state.m, 0); assert.equal(i.mode, 'abs'); touched.add(i.value); touched.add(i.value + 1); }
  assert.equal(touched.size, 12); assert.ok(touched.has(0x1D66));
  for (const byte of [0x1D61, 0x1D62, 0x1D63, 0x1D64, 0x1D67, 0x1D68, 0x1D69, 0x1D6A, 0x0CC2, 0x0D20, 0x0D78]) assert.equal(touched.has(byte), false);
  assert.match(report.reset.returns, /AFFFF\/N1\/Z0/); assert.match(report.reset.returns, /Carry\/V/);
});

test('Initializer891A provesFFFF pointer and seven zero WORDs, then only three BYTE DMA configuration writes', () => {
  const wordWrites = writes('initializer').filter(i => i.state.m === 0), byteWrites = writes('initializer').filter(i => i.state.m === 1);
  assert.deepEqual(wordWrites.map(i => [i.value, i.mnemonic === 'STA' ? 0xFFFF : 0]), report.initializer.ordered_word_writes);
  assert.deepEqual(wordWrites.map(i => i.value), [0x0CC2, 0x0CC4, 0x0CC6, 0x0CC8, 0x0CCA, 0x0CD0, 0x0CD6, 0x0CD8]);
  at('initializer', 0x81891A, 'LDA', 0xFFFF); at('initializer', 0x818935, 'SEP', 0x20);
  at('initializer', 0x818937, 'LDA', 1); at('initializer', 0x81893C, 'LDA', 0x18); at('initializer', 0x818941, 'LDA', 0x7E);
  assert.deepEqual(byteWrites.map(i => i.value), [0x4330, 0x4331, 0x4334]);
  assert.deepEqual(report.initializer.ordered_byte_writes, [[0x4330, 1], [0x4331, 0x18], [0x4334, 0x7E]]);
  at('initializer', 0x818946, 'REP', 0x20); assert.equal(at('initializer', 0x818948, 'RTL').state.m, 0);
  assert.equal(writes('initializer').some(i => [0x1D65, 0x420B].includes(i.value)), false);
  assert.match(report.initializer.returns, /A=FF7E,N0\/Z0/); assert.match(report.initializer.contract, /direct7E would be WRAM/);
});

test('Starter equality gate precedes all scratch writes and counter11 followsC46E, before unproved render', () => {
  at('starter', 0x80881C, 'CPY', 0x0CC2); at('starter', 0x80881F, 'BNE', undefined, 0x80883F);
  at('starter', 0x808821, 'STY', 0); at('starter', 0x808823, 'LDA', 0xFF); at('starter', 0x808826, 'STA', 4);
  at('starter', 0x808828, 'LDA', 7); at('starter', 0x80882B, 'STA', 6);
  at('starter', 0x80882D, 'LDA', 0x20); at('starter', 0x808830, 'STA', 2);
  at('starter', 0x808832, 'JSR', undefined, 0x80C46E); at('starter', 0x808835, 'LDA', 11);
  assert.equal(at('starter', 0x808838, 'STA', 0x1D65).state.m, 0);
  at('starter', 0x80883B, 'JSL', undefined, 0x81AD92); at('starter', 0x80883F, 'RTS');
  assert.deepEqual(writes('starter').map(i => i.value), [0, 4, 6, 2, 0x1D65]);
  assert.deepEqual(report.starter.workspace_word_writes, [[0, 'incoming Y'], [4, 0xFF], [6, 7], [2, 0x20]]);
  assert.equal(report.starter.counter_value, 11); assert.match(report.starter.gate, /no sign,alignment,capacity/);
});

test('Fixed starter table0012 bypassesF130 for every cache WORD and06=7 forbids early return with saved WORD', () => {
  assert.equal(rom.readUInt16LE(0x44D3), 0x12); assert.deepEqual(report.table, {
    cpu_address: '80:C4D3', base: '80:C4B3', index: 0x20, width_bytes: 2, value: 0x12, machine_bytes: '1200' });
  at('audioSelected', 0x80C46E, 'PHK'); at('audioSelected', 0x80C46F, 'PLB');
  at('audioSelected', 0x80C470, 'LDY', 2); at('audioSelected', 0x80C472, 'LDA', 0xC4B3);
  at('audioSelected', 0x80C479, 'BEQ', undefined, 0x80C487); at('audioSelected', 0x80C47B, 'CMP', 0x8000);
  at('audioSelected', 0x80C47E, 'BCC', undefined, 0x80C487); at('audioSelected', 0x80C483, 'JSL', undefined, 0x81F130);
  // Compare is unsigned and independent of decimal mode; equality bypasses the second comparison.
  for (let cached = 0; cached <= 0xFFFF; cached++) assert.ok(cached === 0x12 || 0x12 < 0x8000);
  at('audioSelected', 0x80C493, 'LDX', 6); at('audioSelected', 0x80C495, 'BEQ', undefined, 0x80C4B2);
  assert.equal(7 === 0, false); at('audioSelected', 0x80C4A6, 'PLA'); at('audioSelected', 0x80C4B2, 'RTS');
  assert.deepEqual(report.starter.excluded_audio_sites, ['80:C480', '80:C483']);
  assert.equal(report.starter.excluded_zero_index_edge, '80:C495 -> 80:C4B2');
});

test('All selectedC46E return paths balance WORD/localbank stack and only call completeC416/F007 helpers', () => {
  const source = maps.get('audioSelected'), pending = [[0x80C46E, 0]], reached = new Set(); let returns = 0;
  while (pending.length) {
    const [pc, stack] = pending.pop(), i = source.get(pc); assert.ok(i); reached.add(pc);
    let after = stack;
    if (i.mnemonic === 'PHK') after++;
    if (i.mnemonic === 'PLB') after--;
    if (i.mnemonic === 'PHA') after += i.state.m ? 1 : 2;
    if (i.mnemonic === 'PLA') after -= i.state.m ? 1 : 2;
    assert.ok(after >= 0);
    if (i.mnemonic === 'RTS') { assert.equal(after, 0); assert.equal(i.state.m, 0); returns++; continue; }
    if (['JSR', 'JSL'].includes(i.mnemonic)) assert.ok([0x80C416, 0x81F007].includes(i.target));
    if (pc === 0x80C47E) { pending.push([i.target, after]); continue; }
    if (pc !== 0x80C495 && i.mode === 'rel8') pending.push([i.target, after]);
    pending.push([i.next, after]);
  }
  assert.equal(returns, 4); assert.equal(reached.size, 26); assert.equal(reached.has(0x80C483), false);
  at('audioSelected', 0x80C4A7, 'ORA', 0xFF00); at('audioSelected', 0x80C4AA, 'TAX');
  assert.match(report.starter.selected_audio_proof, /DBR80/); assert.match(report.starter.selected_audio_proof, /not prove arbitrary C46E/);
});

test('C416 hardware helper has complete closed CFG, balanced BYTE stack and no workspace06/status/DBR mutation', () => {
  const source = maps.get('multiply'), pending = [[0x80C416, 0]], reached = new Set(); let returns = 0;
  while (pending.length) {
    const [pc, stack] = pending.pop(), i = source.get(pc); assert.ok(i); reached.add(pc);
    const after = stack + (i.mnemonic === 'PHA' ? 1 : i.mnemonic === 'PLA' ? -1 : 0); assert.ok(after >= 0);
    if (i.mnemonic === 'RTS') { assert.equal(after, 0); assert.equal(i.state.m, 0); returns++; continue; }
    if (i.target !== undefined) pending.push([i.target, after]);
    if (i.mnemonic !== 'BRA') pending.push([i.next, after]);
  }
  assert.equal(reached.size, 38); assert.ok(returns > 1);
  assert.equal([...source.values()].some(i => ['JSR', 'JSL', 'PLB', 'PLD', 'TCD', 'PLP', 'XCE'].includes(i.mnemonic)), false);
  assert.deepEqual(writes('multiply').map(i => [i.value, i.state.m]), [[0x4202, 0], [0x4203, 1], [0x4203, 1]]);
  assert.equal(at('multiply', 0x80C44D, 'PHA').state.m, 1); assert.equal(at('multiply', 0x80C453, 'PLA').state.m, 1);
  at('multiply', 0x80C45D, 'REP', 0x20); at('multiply', 0x80C45F, 'TAX'); assert.match(report.helpers.multiply, /Hardware multiplication\/result and flags are not evaluated/);
});

test('F007 acknowledgement loop cannot be replaced by success; PHP/PLP restores WORD mode whileSTX staysWORD', () => {
  at('apuHandshake', 0x81F007, 'PHP'); at('apuHandshake', 0x81F008, 'SEP', 0x20);
  at('apuHandshake', 0x81F00B, 'LDA', 0x1CE4); at('apuHandshake', 0x81F00E, 'CMP', 0x2140);
  at('apuHandshake', 0x81F011, 'BNE', undefined, 0x81F00E);
  assert.equal(at('apuHandshake', 0x81F013, 'STX', 0x2142).state.x, 0);
  at('apuHandshake', 0x81F022, 'PLP'); assert.equal(at('apuHandshake', 0x81F023, 'RTL').state.m, 0);
  assert.deepEqual(writes('apuHandshake').map(i => i.value), [0x2142, 0x2141, 0x2140, 0x1CE4]);
  assert.equal([...maps.get('apuHandshake').values()].some(i => ['JSR', 'JSL', 'PLB', 'PLD', 'TCD', 'STA'].includes(i.mnemonic) && i.mode === 'dp'), false);
  assert.match(report.helpers.apu, /loop may not terminate/); assert.match(report.starter.selected_audio_proof, /If all reached APU acknowledgements return/);
});

test('Direct callers and first render call are pinned but no complete startup/lifecycle/render return is claimed', () => {
  at('starterCaller', 0x808772, 'JSR', undefined, 0x80881C); at('starterCaller', 0x808775, 'REP', 0x20);
  for (const [pc, target] of [[0x809642, 0x81891A], [0x809646, 0x818CB9], [0x80964A, 0x81A840], [0x80964E, 0x81A772]]) at('initCaller', pc, 'JSL', undefined, target);
  at('renderBoundary', 0x81AD92, 'JSL', undefined, 0x81A9B2);
  assert.match(report.scope, /not an exhaustive writer inventory/); assert.match(report.scope, /no native initialization supplied/);
  assert.match(report.starter.render_boundary, /No claim that1D65 remains11/);
  assert.match(report.initializer.caller, /not complete startup/);
  assert.match(report.boundaries[0], /atomic six-WORD reset/); assert.match(report.boundaries[0], /do not set0CC2 or start11 implicitly/);
});
