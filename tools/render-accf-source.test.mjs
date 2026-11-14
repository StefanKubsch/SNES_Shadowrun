import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile('Shadowrun (E).smc');
const report = JSON.parse(await readFile('analysis/render-accf-native.json', 'utf8'));
const map = new Map();
for (let pc = 0x81ACCF; pc < 0x81AD92;) { const i = decode(rom, pc, { e: 0, m: 0, x: 0 }); map.set(pc, i); pc = i.next; }
const at = (pc, op, operand) => {
  const i = map.get(pc); assert.equal(i.mnemonic, op);
  if (operand !== undefined) assert.equal(i.target ?? i.value, operand); return i;
};
test('ACCF original195 bytes/97 instructions and six stack bytes are independently pinned', () => {
  const bytes = rom.subarray(cpuToOffset(0x81ACCF, rom.length), cpuToOffset(0x81AD92, rom.length));
  assert.equal(createHash('sha256').update(rom).digest('hex'), report.romSha256);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '7b1e231f5be2f3e765f02d5b621fd40baa5b190448ab60a94464d32b6bb30d9e');
  assert.equal(report.source.machine_bytes, bytes.toString('hex').toUpperCase()); assert.equal(map.size, 97);
  const p = proveWordStack(map, 0x81ACCF, 'RTL', { measureStack: true }); assert.deepEqual(p, report.stackProof);
  assert.equal(p.minimum_protected_stack_bytes, 6); assert.equal(p.external_return_assumptions, 0);
});
test('ACCF setup orders first output before width and height reads and retains unconditional loops', () => {
  at(0x81ACCF, 'PHB'); at(0x81ACD0, 'PEA', 0x7E7E); at(0x81ACD5, 'STX', 0xCF);
  at(0x81ACD7, 'LDA', 0x7E2080); at(0x81ACDD, 'LDA', 0x7E2180); at(0x81ACE3, 'LDA', 0x7E2000);
  assert.equal(at(0x81ACEF, 'STA', 0x23A0).mode, 'absy'); at(0x81ACF4, 'LDA', 0x7E2020);
  at(0x81ACF8, 'DEC'); at(0x81ACF9, 'DEC'); at(0x81ACFA, 'STA', 0xC6); at(0x81ACFC, 'TAX');
  at(0x81AD08, 'BNE', 0x81ACFD); at(0x81AD14, 'LDA', 0x7E2040); at(0x81AD62, 'BNE', 0x81AD1B);
  at(0x81AD77, 'LDX', 0xC6); at(0x81AD84, 'BNE', 0x81AD79);
});
test('ACCF middle uses one OR then independent A/D2 increments and fresh inclusive wrap test', () => {
  at(0x81AD32, 'LDA', 0xD2); at(0x81AD34, 'ORA', 0xC9); at(0x81AD36, 'STA', 0x23A0);
  at(0x81AD39, 'INC'); at(0x81AD3A, 'INC', 0xD2); at(0x81AD3E, 'DEC', 0xCC); at(0x81AD40, 'BNE', 0x81AD36);
  at(0x81AD4A, 'PHX'); at(0x81AD4B, 'LDX', 0xCF); at(0x81AD4D, 'SEC'); at(0x81AD50, 'SBC', 0x7E2060);
  at(0x81AD54, 'CMP', 0x7E20A0); at(0x81AD58, 'BCC', 0x81AD60); at(0x81AD5A, 'LDA', 0x7E2060); at(0x81AD60, 'PLX');
  at(0x81AD64, 'CLC'); at(0x81AD67, 'ADC', 0x40); at(0x81AD89, 'ORA', 0xC9);
  at(0x81AD8B, 'STA', 0x23A0); at(0x81AD8E, 'LDX', 0xCF); at(0x81AD90, 'PLB'); at(0x81AD91, 'RTL');
});
