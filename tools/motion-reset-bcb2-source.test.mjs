import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuLabel, cpuToOffset } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/motion-reset-bcb2.json', import.meta.url), 'utf8'));
const windows = [
  ['resetBCB2', 0x80BCB2, 0x80BCBE, 5, '53c72aa64846b83a5f7d8ccde17ecf65dc033003901d85657433987c3629506e'],
  ['releaseBE5B', 0x80BE5B, 0x80BE6D, 7, 'b35afc2357383a75cc5b52198e17dd612b684c0238d4cee47c1758fc568680a6'],
  ['removeFA3E', 0x80FA3E, 0x80FA67, 19, 'b327ff7f8ee14970bc39549326c7b88593ddb127caf07974f1f7940b4367a5d6'],
  ['renderAD92', 0x81AD92, 0x81ADBA, 16, 'de7bc7c4cb91717e27a7b7b0eab421495a009b497cb012cf56ff6b0713c35b13'],
  ['renderPrefixA9B2', 0x81A9B2, 0x81A9C0, 5, '87a230c1d1c1a3f0340231ce762de22dc5a12b7e0ad734fe1a2816f675912863'],
  ['callerA4BF', 0x80A4DD, 0x80A4E7, 3, '9674629fd1fa435a99323df3dce1f18004e78640bd3bc439076431f9d3cebf98'],
];
// Fixed WORD widths, independently of the analyzer's selected windows and graph.
const maps = new Map(windows.map(([name, start, end]) => {
  const map = new Map();
  for (let pc = start; pc < end;) {
    const i = decode(rom, pc, { e: 0, m: 0, x: 0 });
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
const instructions = name => [...maps.get(name).values()];

test('Reset source pins 125 body/prefix bytes and 10 caller bytes with six independent digests', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  for (const [name, start, end, count, sha256] of windows) {
    const raw = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), sha256); assert.equal(maps.get(name).size, count);
    assert.deepEqual(report.windows.find(w => w.name === name), { name, entry: cpuLabel(start), end_exclusive: cpuLabel(end),
      covered_bytes: end - start, instruction_count: count, sha256, machine_bytes: raw.toString('hex').toUpperCase() });
  }
  assert.equal(report.source_bytes, 125); assert.equal(report.caller_bytes, 10); assert.equal(report.transitive_return_proven, false);
});

test('Native A5 and 97 retain original pointers and different argument/return profiles', () => {
  const profiles = [{ id: '97', cpu_address: '80:FA3E', rom_offset: '007A3E', argument_words: 1, return_bytes: 0 },
    { id: 'A5', cpu_address: '80:BCB2', rom_offset: '003CB2', argument_words: 0, return_bytes: 2 }];
  assert.deepEqual(report.native_profiles, profiles);
  for (const p of profiles) {
    const id = Number.parseInt(p.id, 16);
    assert.equal(rom.readUInt16LE(0x157B8 + 2 * id), Number.parseInt(p.cpu_address.slice(3), 16));
    assert.equal(rom[0x15A4C + id], p.argument_words); assert.equal(rom[0x15970 + id], p.return_bytes);
  }
});

test('BCB2 clears 01D8 before its signed gate; BE5B writes resets only after FA3E returns', () => {
  at('resetBCB2', 0x80BCB2, 'STZ', 0x1D8); at('resetBCB2', 0x80BCB5, 'LDA', 0x1DA);
  at('resetBCB2', 0x80BCB8, 'BMI', undefined, 0x80BCBD);
  at('resetBCB2', 0x80BCBA, 'JSR', undefined, 0x80BE5B); at('resetBCB2', 0x80BCBD, 'RTS');
  assert.deepEqual(instructions('resetBCB2').map(i => i.mnemonic), ['STZ', 'LDA', 'BMI', 'JSR', 'RTS']);
  at('releaseBE5B', 0x80BE5B, 'LDA', 0x1DC); at('releaseBE5B', 0x80BE5E, 'STA', 0);
  at('releaseBE5B', 0x80BE60, 'JSR', undefined, 0x80FA3E); at('releaseBE5B', 0x80BE63, 'LDA', 0xFFFF);
  at('releaseBE5B', 0x80BE66, 'STA', 0x1DA); at('releaseBE5B', 0x80BE69, 'STA', 0x1DE); at('releaseBE5B', 0x80BE6C, 'RTS');
  assert.match(report.reset.inactive_return, /A=loaded01DA/); assert.match(report.reset.order, /includingzero/);
  assert.match(report.reset.active, /OnlyafterFA3E andrender actually return/);
});

test('FA3E zeroes the table before the tail comparison and both paths reach the render call', () => {
  at('removeFA3E', 0x80FA3E, 'LDX', 0); at('removeFA3E', 0x80FA40, 'LDA', 0);
  assert.equal(at('removeFA3E', 0x80FA43, 'STA', 0x226).mode, 'absx');
  at('removeFA3E', 0x80FA46, 'CPX', 0x204); at('removeFA3E', 0x80FA49, 'BNE', undefined, 0x80FA62);
  at('removeFA3E', 0x80FA62, 'JSL', undefined, 0x81AD92); at('removeFA3E', 0x80FA66, 'RTS');
  const expected = [[0x80FA49, 'BNE', 0x80FA62], [0x80FA4D, 'BMI', 0x80FA54],
    [0x80FA52, 'BEQ', 0x80FA4B], [0x80FA62, 'JSL', 0x81AD92]];
  assert.deepEqual(report.local_graphs.find(g => g.name === 'removeFA3E').edges,
    expected.map(([from, kind, to]) => ({ from: cpuLabel(from), kind, to: cpuLabel(to) })));
  assert.match(report.remove.first_write, /No alignment,capacity,occupancy,sign ornegativehandle guard/);
  assert.match(report.remove.not_tail, /no0212\/0204 writes;render still called/);
});

test('Tail scan tests the second DEX and reads the projection at cursor plus two, including empty tail', () => {
  for (const pc of [0x80FA4B, 0x80FA4C, 0x80FA5D, 0x80FA5E]) at('removeFA3E', pc, 'DEX');
  at('removeFA3E', 0x80FA4D, 'BMI', undefined, 0x80FA54); at('removeFA3E', 0x80FA4F, 'LDA', 0x226);
  at('removeFA3E', 0x80FA52, 'BEQ', undefined, 0x80FA4B);
  at('removeFA3E', 0x80FA54, 'INX'); at('removeFA3E', 0x80FA55, 'INX');
  assert.equal(at('removeFA3E', 0x80FA56, 'LDA', 0x7E2060).mode, 'longx');
  at('removeFA3E', 0x80FA5A, 'STA', 0x212); at('removeFA3E', 0x80FA5F, 'STX', 0x204);
  assert.match(report.remove.tail_scan, /Odd offsets are not rejected/);
  assert.match(report.remove.projection, /projection2060 isstillread and0204 becomesFFFE/);
  assert.match(report.remove.projection, /maycross7E to7F/);
});

test('AD92 always runs its first and final render calls, with fresh unsigned inclusive loop bounds', () => {
  at('renderAD92', 0x81AD92, 'JSL', undefined, 0x81A9B2); at('renderAD92', 0x81AD96, 'LDA', 0x204);
  at('renderAD92', 0x81AD99, 'BMI', undefined, 0x81ADB5); at('renderAD92', 0x81AD9B, 'LDX', 0);
  at('renderAD92', 0x81AD9E, 'CPX', 0x200); at('renderAD92', 0x81ADA1, 'BCC', undefined, 0x81ADAC);
  at('renderAD92', 0x81ADA3, 'LDA', 0x226); at('renderAD92', 0x81ADA6, 'BEQ', undefined, 0x81ADAC);
  at('renderAD92', 0x81ADA8, 'JSL', undefined, 0x81ACCF); at('renderAD92', 0x81ADAC, 'INX'); at('renderAD92', 0x81ADAD, 'INX');
  at('renderAD92', 0x81ADAE, 'CPX', 0x204); at('renderAD92', 0x81ADB1, 'BCC', undefined, 0x81AD9E);
  at('renderAD92', 0x81ADB3, 'BEQ', undefined, 0x81AD9E); at('renderAD92', 0x81ADB5, 'JSL', undefined, 0x81ACB5);
  at('renderAD92', 0x81ADB9, 'RTL');
  assert.deepEqual(instructions('renderAD92').filter(i => i.mnemonic === 'JSL').map(i => i.target), [0x81A9B2, 0x81ACCF, 0x81ACB5]);
  assert.match(report.render_wrapper.loop, /0200\/0204 reread eachiteration,notcached/);
  assert.match(report.render_wrapper.loop, /CalleeX\/globalmutations andwrap\/termination remain explicit boundaries/);
});

test('A9B2 prefix pins PHB and the real first copy inputs without claiming a full stack or DBR return', () => {
  at('renderPrefixA9B2', 0x81A9B2, 'PHB'); at('renderPrefixA9B2', 0x81A9B3, 'LDA', 0x1FE);
  at('renderPrefixA9B2', 0x81A9B6, 'LDY', 0x1F4); at('renderPrefixA9B2', 0x81A9B9, 'LDX', 0x23A0);
  at('renderPrefixA9B2', 0x81A9BC, 'JSL', undefined, 0x809F49);
  assert.deepEqual(instructions('renderPrefixA9B2').map(i => i.mnemonic), ['PHB', 'LDA', 'LDY', 'LDX', 'JSL']);
  assert.match(report.render_wrapper.prefix, /PHB isnotmatched locally inthisprefix/);
  assert.ok(instructions('renderAD92').every(i => !['STA', 'STX', 'STY', 'STZ', 'PHA', 'PHB', 'PHX', 'PHY'].includes(i.mnemonic)));
});

test('Caller keeps B0AC, BCB2, destructive C1A6 order; local graphs do not prove render returns', () => {
  at('callerA4BF', 0x80A4DD, 'JSL', undefined, 0x81B0AC);
  at('callerA4BF', 0x80A4E1, 'JSR', undefined, 0x80BCB2); at('callerA4BF', 0x80A4E4, 'JSR', undefined, 0x80C1A6);
  const graphSpecs = [['resetBCB2', 5, 2, '80:BCBD'], ['releaseBE5B', 7, 1, '80:BE6C'],
    ['removeFA3E', 19, 4, '80:FA66'], ['renderAD92', 16, 8, '81:ADB9']];
  for (const [name, count, edges, ret] of graphSpecs) {
    const g = report.local_graphs.find(g => g.name === name);
    assert.equal(g.reachable_local_instructions, count); assert.equal(g.edges.length, edges); assert.deepEqual(g.return_sites, [ret]);
    assert.ok(instructions(name).every(i => !['REP', 'SEP', 'PLP', 'PLB', 'PLD', 'XCE', 'TCD', 'SED'].includes(i.mnemonic)));
  }
  assert.equal(report.transitive_return_proven, false);
  assert.match(report.boundaries[0], /native9F49/);
  assert.match(report.boundaries[1], /No nativeA5\/97 binding/);
});
