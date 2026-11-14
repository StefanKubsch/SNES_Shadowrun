import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-a98e.json', import.meta.url), 'utf8'));
const windows = [
  ['objectRequestA98E', 0x81A98E, 0x81A9B2, 14, '1268df78438cbeb285651bdc83ab3a77f3fcc71e3ec52ef179edcf217fce9b11'],
  ['callbackCallC172', 0x80C172, 0x80C176, 1, '65f1c55781ca6da18eb5abf54f5ded1c1c81ed99699e0ab0ebd17a16346886c1'],
  ['initializeA779', 0x81A779, 0x81A7FB, 56, '7916bd94e2312014cfc6486fea6a7465622389d6e16bd2eea4ea2466263eb4d3'],
  ['gateIncrementA954', 0x81A954, 0x81A958, 2, '8dae4a16e8b1334cc47a0b132b15f9d2c934f3732b2d9d26199c3d78d597b0a2'],
  ['selectedGateClearA772', 0x81A772, 0x81A775, 1, '8603163497943ae57852fd7a537bbc497f7a06d29afb40e926e8ef5d37b981a9'],
  ['selectedBufferClear902E', 0x80902E, 0x80904F, 16, 'd0d72d9099229eb5733f7e79fd74f0a2a764d60ebeb9f676848e2900dcc7fbb1'],
  ['selectedBufferWriterB158', 0x80B158, 0x80B16D, 11, '3c0ab48d8c7c53b0b097dc7050ec6917c089224b2b85ba178bd2b073cb4654c7'],
  ['selectedBufferWriterB793', 0x80B793, 0x80B7BA, 18, 'fa27535c72b892e860694b32f0d889ea3dc91ec0916a5b9e613fd42ab62a48e1'],
];
const instructions = new Map();
for (const [, lo, hi] of windows) for (let pc = lo; pc < hi;) {
  const m = Number(pc >= 0x81A9A7 && pc < 0x81A9AE || pc >= 0x81A789 && pc < 0x81A79A
    || pc >= 0x81A7A8 && pc < 0x81A7CB || pc >= 0x809030 && pc < 0x809041
    || pc >= 0x80B15A && pc < 0x80B16D || pc >= 0x80B795 && pc < 0x80B7BA);
  const i = decode(rom, pc, { e: 0, m, x: 0 });
  assert.ok(i.next <= hi); instructions.set(pc, i); pc = i.next;
}
const range = (lo, hi) => [...instructions.values()].filter(i => i.cpu >= lo && i.cpu < hi);
const at = (pc, op, value, target) => {
  const i = instructions.get(pc); assert.ok(i, cpuLabel(pc)); assert.equal(i.mnemonic, op);
  if (value !== undefined) assert.equal(i.value, value);
  if (target !== undefined) assert.equal(i.target, target);
  return i;
};

test('A98E source, callback, initializer and selected bufferwriters have independent literal ROM pins', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), report.rom_sha256);
  for (const [name, lo, hi, count, sha256] of windows) {
    const raw = rom.subarray(cpuToOffset(lo, rom.length), cpuToOffset(hi, rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), sha256); assert.equal(range(lo, hi).length, count);
    assert.deepEqual(report.windows.find(w => w.name === name), { name, entry: cpuLabel(lo), end_exclusive: cpuLabel(hi),
      covered_bytes: hi - lo, instruction_count: count, sha256, machine_bytes: raw.toString('hex').toUpperCase() });
  }
  assert.equal(report.code_bytes, 36); assert.equal(report.instruction_count, 14);
  assert.equal(report.owner_body_bytes, 134); assert.equal(report.owner_excerpt_bytes, 96);
});

test('A98E has one fresh WORDgate and all nonzero values choose identical fixed request path', () => {
  const load = at(0x81A98E, 'LDA', 0x1562); assert.equal(load.mode, 'abs'); assert.equal(load.state.m, 0);
  at(0x81A991, 'BEQ', undefined, 0x81A9B1);
  assert.deepEqual(range(0x81A98E, 0x81A9B2).filter(i => i.target !== undefined).map(i => i.mnemonic), ['BEQ']);
  assert.ok(!range(0x81A98E, 0x81A9B2).some(i => ['AND', 'BIT', 'CMP', 'ADC', 'SBC', 'LDX', 'LDY'].includes(i.mnemonic)));
  assert.match(report.gate, /including8000\/FFFF/);
});

test('A98E four ordered stores use full WORD constants before BYTE04 and late WORDgateclear', () => {
  assert.deepEqual(range(0x81A98E, 0x81A9B2).filter(i => ['STA', 'STZ'].includes(i.mnemonic)).map(i => [i.mnemonic, i.value, i.state.m]),
    [['STA', 0x4322, 0], ['STA', 0x4325, 0], ['STA', 0x2102, 0], ['STA', 0x420B, 1], ['STZ', 0x1562, 0]]);
  at(0x81A993, 'LDA', 0x3D08); at(0x81A999, 'LDA', 0x220); at(0x81A99F, 'LDA', 0x8000);
  at(0x81A9A7, 'LDA', 4); at(0x81A9A9, 'STA', 0x420B); at(0x81A9AE, 'STZ', 0x1562);
  assert.match(report.active.requests, /no conditional device-completion check/);
});

test('A98E active A8004 retains WORD high80 with BYTE N0/Z0; STZ/REP preserve result and C/V', () => {
  at(0x81A9A5, 'SEP', 32); at(0x81A9AC, 'REP', 32);
  assert.equal(at(0x81A9A7, 'LDA', 4).state.m, 1); assert.equal(at(0x81A9AE, 'STZ', 0x1562).state.m, 0);
  assert.deepEqual(range(0x81A99F, 0x81A9B2).map(i => i.mnemonic), ['LDA', 'STA', 'SEP', 'LDA', 'STA', 'REP', 'STZ', 'RTL']);
  assert.ok(!range(0x81A98E, 0x81A9B2).some(i => ['CLC', 'SEC', 'CLV', 'PLP', 'PLB', 'PLD', 'PHX', 'PHY'].includes(i.mnemonic)));
  assert.match(report.active.returns, /A8004\/N0\/Z0/); assert.match(report.active.returns, /do not modifyA\/N\/Z/);
});

test('A98E local graph closes all14 instructions, no calls/pushes and WORD RTL under intact stack', () => {
  const map = new Map(range(0x81A98E, 0x81A9B2).map(i => [i.cpu, i]));
  assert.deepEqual(proveWordStack(map, 0x81A98E), report.graph.proof);
  assert.equal(report.graph.proof.reachable_instructions, 14); assert.deepEqual(report.graph.calls, []);
  assert.deepEqual(report.graph.proof.returns, [{ at: '81:A9B1', m: 0, x: 0, dbr: 'entry' }]);
  assert.equal(report.graph.actual_transfer_completion_proven, false);
});

test('A98E does not read bufferbytes or channelstate; selected setup establishes mode00/bank7E afterward', () => {
  const body = range(0x81A98E, 0x81A9B2);
  assert.deepEqual(body.filter(i => i.mnemonic === 'LDA' && !i.mode.startsWith('imm')).map(i => i.value), [0x1562]);
  assert.ok(!body.some(i => [0x4320, 0x4321, 0x4324, 0x3D08].includes(i.value) && ['STA', 'STZ'].includes(i.mnemonic)));
  at(0x81A793, 'LDA', 4); at(0x81A795, 'STA', 0x4321); at(0x81A79A, 'LDA', 0x220);
  at(0x81A7A0, 'LDA', 0xA7FB); at(0x81A7A8, 'LDA', 0x81); at(0x81A7AD, 'LDA', 8);
  at(0x81A7BC, 'STA', 0x420B); at(0x81A7BF, 'LDA', 0); at(0x81A7C1, 'STA', 0x4320);
  at(0x81A7C4, 'LDA', 0x7E); at(0x81A7C6, 'STA', 0x4324);
  assert.equal(0x3D08 + 0x220 - 1, 0x3F27); assert.equal(report.owners.requested_range.bytes, 544);
  assert.match(report.owners.requested_range.qualification, /metadata, not original bytes/);
});

test('Full A779 initializer and A954 increment close structurally without assuming caller/device returns', () => {
  for (const [j, lo, hi] of [[0, 0x81A779, 0x81A7FB], [1, 0x81A954, 0x81A958]])
    assert.deepEqual(proveWordStack(new Map(range(lo, hi).map(i => [i.cpu, i])), lo), report.owners.proofs[j].proof);
  at(0x81A7D1, 'STA', 0x82); at(0x81A7D6, 'STA', 0x0D1C); at(0x81A7DC, 'STA', 0x0D1E);
  at(0x81A7E6, 'STA', 0x0E); at(0x81A7F3, 'STA', 0x1564); at(0x81A7FA, 'RTL');
  at(0x81A954, 'INC', 0x1562); at(0x81A772, 'STZ', 0x1562);
  assert.match(report.owners.channel_setup, /not ported here as an isolated channelsetter/);
});

test('Selected bufferclear writes only128 F0 bytes and32 zero bytes, not a blank544-byte source', () => {
  at(0x80902E, 'SEP', 32); at(0x809030, 'LDA', 0xF0); at(0x809032, 'LDX', 0x1FD);
  assert.equal(at(0x809035, 'STA', 0x7E3D08).state.m, 1);
  assert.deepEqual(range(0x809039, 0x80903D).map(i => i.mnemonic), Array(4).fill('DEX'));
  at(0x80903D, 'BPL', undefined, 0x809035); at(0x80903F, 'REP', 32);
  at(0x809041, 'LDX', 0x1E); at(0x809044, 'LDA', 0); at(0x809047, 'STA', 0x7E3F08);
  at(0x80904D, 'BPL', undefined, 0x809047);
  const bytes = Array.from({ length: 128 }, (_, n) => 0x3D08 + 0x1FD - n * 4);
  assert.equal(bytes.at(-1), 0x3D09); assert.ok(!bytes.includes(0x3D08)); assert.equal(bytes.length + 32, 160);
  assert.match(report.owners.clear_excerpt, /does not clear all544/);
});

test('Selected bufferwriters use long7E bytewrites and shared DP84 without full graph/native binding', () => {
  for (const pc of [0x80B15A, 0x80B162, 0x80B797, 0x80B79F, 0x80B7A6, 0x80B7B3]) {
    const i = at(pc, 'STA', 0x7E3D08); assert.equal(i.mode, 'longx'); assert.equal(i.state.m, 1); assert.equal(i.state.x, 0);
  }
  at(0x80B169, 'STX', 0x84); at(0x80B7B8, 'STX', 0x84);
  at(0x80B7AB, 'LDA', 0x0E); at(0x80B7AD, 'AND', 0xC0); at(0x80B7AF, 'ORA', 0x2C); at(0x80B7B1, 'ORA', 0x35);
  assert.match(report.owners.writer_excerpts, /fullspritewriter graph/); assert.match(report.owners.lifecycle, /Manual render provider stays separate/);
});

test('A98E exact selected caller and rawpatterns leave four further callbackcallees and realwaits open', () => {
  at(0x80C172, 'JSL', undefined, 0x81A98E); assert.deepEqual(report.caller.raw_patterns.jslA98E, ['80:C172']);
  assert.deepEqual(report.caller.raw_patterns.inc1562, ['81:A954']);
  assert.deepEqual(report.caller.raw_patterns.stz1562, ['81:A772', '81:A9AE']);
  assert.deepEqual(report.caller.raw_patterns.longBufferStore, ['80:9035', '80:B15A', '80:B162', '80:B797', '80:B79F', '80:B7A6', '80:B7B3']);
  assert.deepEqual(report.caller.remaining_after, ['80:8FBA', '80:9E0B', '80:C06B', '81:B0D1']);
  assert.match(report.caller.qualification, /no allwriter/); assert.match(report.boundaries[0], /native atomicA98E/);
});
