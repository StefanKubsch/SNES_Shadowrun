import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile('Shadowrun (E).smc');
const report = JSON.parse(await readFile('analysis/render-fa67-native.json', 'utf8'));
const map = new Map();
for (const [lo, hi] of [[0x80FA67, 0x80FA89], [0x81ACBD, 0x81ACC3]])
  for (let pc = lo; pc < hi;) { const i = decode(rom, pc, { e: 0, m: 0, x: 0 }); map.set(pc, i); pc = i.next; }

test('FA67/ACBD original40 bytes/19 instructions are independently hash-pinned', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), report.romSha256);
  for (const [lo, hi, hash] of [
    [0x80FA67, 0x80FA89, '23fba8656c6da6c25b590f6e1ce1f9d5407439e1c762031deaf5a420db058ae2'],
    [0x81ACBD, 0x81ACC3, '5e994a7e4330cd0a700c749ea167899d2c125cb442cb0b3c9b014d0752ce4104'],
  ]) {
    const bytes = rom.subarray(cpuToOffset(lo, rom.length), cpuToOffset(hi, rom.length));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
    assert.equal(report.sources.find(w => parseInt(w.entry.replace(':', ''), 16) === lo).machine_bytes, bytes.toString('hex').toUpperCase());
  }
  assert.equal(map.size, 19);
});

test('FA67 preserves literal shift Carry, ADC immediate, fixed long tables and request order', () => {
  const expected = [
    [0x80FA67, 'LDX', 0], [0x80FA69, 'LDA', 0x7E2060],
    [0x80FA6D, 'ASL'], [0x80FA6E, 'ASL'], [0x80FA6F, 'ASL'], [0x80FA70, 'ADC', 0x4FFF],
    [0x80FA73, 'STA', 0x20A], [0x80FA76, 'LDA', 0x7E20A0],
    [0x80FA7A, 'ASL'], [0x80FA7B, 'ASL'], [0x80FA7C, 'ASL'], [0x80FA7D, 'ASL'],
    [0x80FA7E, 'STA', 0x20C], [0x80FA81, 'INC', 0x1F6], [0x80FA84, 'JSL', 0x81ACBD], [0x80FA88, 'RTS'],
  ];
  for (const [pc, op, operand] of expected) {
    const i = map.get(pc); assert.equal(i.mnemonic, op);
    if (operand !== undefined) assert.equal(i.target ?? i.value, operand);
  }
  assert.equal(map.get(0x80FA69).mode, 'longx'); assert.equal(map.get(0x80FA76).mode, 'longx');
});

test('ACBD full WORD loop and native stack contract close with no external return assumptions', () => {
  assert.equal(map.get(0x81ACBD).mnemonic, 'LDA'); assert.equal(map.get(0x81ACBD).value, 0x1F6);
  assert.equal(map.get(0x81ACC0).mnemonic, 'BNE'); assert.equal(map.get(0x81ACC0).target, 0x81ACBD);
  assert.equal(map.get(0x81ACC2).mnemonic, 'RTL');
  const root = proveWordStack(map, 0x80FA67, 'RTS', { measureStack: true });
  assert.deepEqual(root, report.stackProof); assert.equal(root.minimum_protected_stack_bytes, 5);
  const wait = proveWordStack(map, 0x81ACBD, 'RTL', { measureStack: true });
  assert.equal(wait.minimum_protected_stack_bytes, 3); assert.equal(wait.external_return_assumptions, 0);
});
