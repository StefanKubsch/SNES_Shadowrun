import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const source = JSON.parse(await readFile(new URL('../analysis/render-80c4.json', import.meta.url)));
const instructions = new Map();
for (let pc = 0x818076; pc < 0x8180C4;) {
  const i = decode(rom, pc, { e: 0, m: 0, x: 0 }); instructions.set(pc, i); pc = i.next;
}
const at = (pc, op, operand) => {
  const i = instructions.get(pc); assert.equal(i.mnemonic, op);
  if (operand !== undefined) assert.equal(i.target ?? i.value, operand);
  return i;
};

test('8076 original WORD body closes all34 instructions with no calls, pushes or DBR changes', () => {
  assert.equal(instructions.size, 34);
  assert.deepEqual(proveWordStack(instructions, 0x818076), source.owners.proofs.find(p => p.name === 'requestAdvance8076').proof);
  assert.ok(![...instructions.values()].some(i => /^(JS|PH|PL)|^(SEP|REP|TCD|XCE|SED)$/.test(i.mnemonic)));
});

test('8076 source zero gate exits entire body; noevent writes full sum then CPX4 selects nextslot or final NZC', () => {
  at(0x818076, 'LDX', 0); at(0x818079, 'LDA', 0x1CBE); at(0x81807C, 'BEQ', 0x8180C3);
  at(0x81807E, 'CLC'); at(0x81807F, 'ADC', 0x1CC2); at(0x818082, 'BIT', 128);
  assert.equal(at(0x818082, 'BIT').mode, 'immM'); at(0x818085, 'BEQ', 0x8180B9);
  at(0x8180B9, 'STA', 0x1CC2); at(0x8180BC, 'INX'); at(0x8180BD, 'INX');
  at(0x8180BE, 'CPX', 4); at(0x8180C1, 'BNE', 0x818079); at(0x8180C3, 'RTL');
});

test('8076 source direction is signedWORD; forward tests equality only and reverse reads count only at indexzero', () => {
  at(0x818087, 'AND', 127); at(0x81808A, 'STA', 0x1CC2); at(0x81808D, 'LDA', 0x1CC6);
  at(0x818090, 'BMI', 0x8180A0); at(0x818092, 'LDA', 0x1CD6); at(0x818095, 'INC');
  at(0x818096, 'CMP', 0x1CD2); at(0x818099, 'BNE', 0x8180A9); at(0x81809B, 'LDA', 0);
  at(0x8180A0, 'LDA', 0x1CD6); at(0x8180A3, 'BNE', 0x8180A8);
  at(0x8180A5, 'LDA', 0x1CD2); at(0x8180A8, 'DEC'); at(0x8180A9, 'STA', 0x1CD6);
});

test('8076 source writes index before ASL/ADC and pointer before TXA/selection, then returns without pendingguard', () => {
  assert.equal(instructions.get(0x8180AC).next, 0x8180AD);
  at(0x8180AC, 'ASL'); at(0x8180AD, 'ADC', 0x1CCE); at(0x8180B0, 'STA', 0x1CDA);
  at(0x8180B3, 'TXA'); at(0x8180B4, 'STA', 0x1CDC); at(0x8180B7, 'BRA', 0x8180C3);
  assert.deepEqual([...instructions.values()].filter(i => i.mnemonic === 'STA').map(i => [i.value, i.mode]),
    [[0x1CC2, 'absx'], [0x1CD6, 'absx'], [0x1CDA, 'abs'], [0x1CDC, 'abs'], [0x1CC2, 'absx']]);
  assert.ok(![...instructions.values()].some(i => i.mnemonic === 'LDA' && i.value === 0x1CDA));
});
