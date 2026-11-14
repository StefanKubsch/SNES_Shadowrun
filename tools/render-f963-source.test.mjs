import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile('Shadowrun (E).smc');
const report = JSON.parse(await readFile('analysis/render-f963-native.json', 'utf8'));
const regions = [[0x80F963, 0x80FA3E], [0x80FA67, 0x80FA89], [0x81ACBD, 0x81ACC3],
  [0x81ACCF, 0x81AD92], [0x81ACB5, 0x81ACBD], [0x81ACAF, 0x81ACB5]];
const map = new Map();
for (const [entry, end] of regions) {
  const state = { e: 0, m: 0, x: 0 };
  for (let pc = entry; pc < end;) {
    const i = decode(rom, pc, state); map.set(pc, i); pc = i.next;
    if (['REP', 'SEP'].includes(i.mnemonic) && i.value & 32) state.m = Number(i.mnemonic === 'SEP');
  }
}
const at = (pc, op, operand, mode) => {
  const i = map.get(pc); assert.equal(i.mnemonic, op);
  if (operand !== undefined) assert.equal(i.target ?? i.value, operand);
  if (mode !== undefined) assert.equal(i.mode, mode); return i;
};
test('F963 independently pins219 originalbytes/95instructions and closed eight-byte stack', () => {
  const raw = rom.subarray(cpuToOffset(0x80F963, rom.length), cpuToOffset(0x80FA3E, rom.length));
  assert.equal(raw.length, 219); assert.equal(createHash('sha256').update(raw).digest('hex'),
    '575759f8219c696e508a78ae51f53d31b0c0b8fb3cfbfc3a9e1236736087c5c5');
  assert.equal(createHash('sha256').update(rom).digest('hex'), report.romSha256);
  assert.equal(report.source.machine_bytes, raw.toString('hex').toUpperCase());
  for (const w of report.dependencies) {
    const first = cpuToOffset(parseInt(w.entry.replace(':', ''), 16), rom.length);
    const bytes = rom.subarray(first, first + w.covered_bytes);
    assert.equal(w.machine_bytes, bytes.toString('hex').toUpperCase());
    assert.equal(w.sha256, createHash('sha256').update(bytes).digest('hex'));
  }
  assert.equal([...map.keys()].filter(pc => pc >= 0x80F963 && pc < 0x80FA3E).length, 95);
  const proof = proveWordStack(map, 0x80F963, 'RTS', { measureStack: true });
  assert.deepEqual(proof, report.stackProof); assert.equal(proof.external_return_assumptions, 0);
  assert.equal(proof.minimum_protected_stack_bytes, 8); assert.equal(proof.reachable_instructions, map.size);
});
test('F963 source capacity gate preserves A/workspace and geometry retains signed decrement and ASLcarry', () => {
  at(0x80F963, 'LDX', 0x204); at(0x80F966, 'INX'); at(0x80F967, 'INX'); at(0x80F968, 'CPX', 0x20);
  at(0x80F96B, 'BCC', 0x80F970); at(0x80F96D, 'JMP', 0x80FA3D); at(0x80FA3D, 'RTS');
  at(0x80F970, 'STX', 0x204); at(0x80F973, 'LDA', 0); at(0x80F975, 'DEC'); at(0x80F976, 'BPL', 0x80F97F);
  at(0x80F983, 'SBC', 4); at(0x80F985, 'CMP', 0); at(0x80F987, 'BCS', 0x80F98B);
  at(0x80F98D, 'DEC'); at(0x80F98E, 'BPL', 0x80F997); at(0x80F99B, 'SBC', 6);
  at(0x80F99D, 'CMP', 2); at(0x80F99F, 'BCS', 0x80F9A3);
  for (let pc = 0x80F9A5; pc <= 0x80F9A9; pc++) at(pc, 'ASL');
  at(0x80F9AA, 'ADC', 0); at(0x80F9AC, 'ASL'); at(0x80F9AD, 'STA', 0x7E2000);
  at(0x80F9DF, 'LDA', 0x226, 'absx'); at(0x80F9E2, 'DEC'); at(0x80F9E3, 'STA', 0x226, 'absx');
});
test('F963 source orders BYTE writes before two distinct WORDreads then FA67/ACCF/ACB5', () => {
  at(0x80F9E6, 'SEP', 0x20); assert.equal(at(0x80F9E8, 'LDA', 4).state.m, 1);
  at(0x80F9EC, 'STA', 0x211B); at(0x80F9EF, 'STZ', 0x211B);
  at(0x80F9F2, 'LDA', 6); at(0x80F9F6, 'STA', 0x211C); at(0x80F9F9, 'REP', 0x20);
  at(0x80F9FB, 'LDA', 0x212); at(0x80F9FE, 'STA', 0); at(0x80FA00, 'CLC');
  assert.equal(at(0x80FA01, 'LDA', 0x2134).state.m, 0); at(0x80FA04, 'STA', 0x7E20A0);
  at(0x80FA08, 'ADC', 0x212); at(0x80FA0B, 'STA', 0x212); at(0x80FA0E, 'CMP', 0x2400);
  at(0x80FA11, 'BCC', 0x80FA1F); at(0x80FA13, 'CLC'); at(0x80FA14, 'LDA', 0x2027);
  at(0x80FA17, 'STA', 0); at(0x80FA19, 'ADC', 0x2134); at(0x80FA1C, 'STA', 0x212);
  at(0x80FA1F, 'LDA', 0); at(0x80FA21, 'STA', 0x7E2060); at(0x80FA25, 'STA', 0x7E2080);
  at(0x80FA29, 'STA', 0x7E20C0); at(0x80FA2D, 'LDA', 0x204); at(0x80FA30, 'STA', 0);
  at(0x80FA32, 'JSR', 0x80FA67); at(0x80FA35, 'JSL', 0x81ACCF); at(0x80FA39, 'JSL', 0x81ACB5);
});
