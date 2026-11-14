import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { slotTargetIndex, calculateSlotTargetMotion } from '../proof/state/slot-target-motion.mjs';
import { disassembleBlock } from './disassemble.mjs';

const calculate = (recordWords = [0,0,0], currentWords = [0,0,0]) => calculateSlotTargetMotion({ recordWords, currentWords });
const modulo = n => ((n % 65536n) + 65536n) % 65536n;

test('All65536 target indices retain the first SBC borrow, with independent bigint arithmetic and explicit wrap examples', () => {
  for (let n = 0; n <= 65535; n++) {
    const word = BigInt(n);const shifted = modulo(8n * word);
    const expected = modulo(modulo(shifted - word) - word - (shifted < word ? 1n : 0n) + 1n);
    assert.equal(slotTargetIndex(n), Number(expected));
  }
  assert.equal(slotTargetIndex(0), 1);assert.equal(slotTargetIndex(0x2000), 0xC000);assert.equal(slotTargetIndex(0xFFFF), 0xFFFA);
});

test('All65536 wrapped differences and original scaled record words retain exact sign and magnitude words', () => {
  for (let word = 0; word <= 65535; word++) {
    const current = calculate([0,0,0], [word,word,word]);const difference = (65536 - word) % 65536;
    const negative = difference >= 32768;
    const magnitude = negative ? (65536 - difference) % 65536 : difference;
    assert.equal(current.scratchWords.A2, magnitude);assert.equal(current.scratchWords.A5, magnitude);
    assert.equal(current.scratchWords.A8, negative ? 65535 : 0);assert.equal(current.scratchWords.AE, negative ? 65535 : 0);
    const record = calculate([word,word,word]);
    assert.equal(record.scratchWords.B4, (word * 4) % 65536);assert.equal(record.scratchWords.BA, (word * 4) % 65536);
  }
});

test('Zero distance, positive/negative motion and the final third-column half-word addition match explicit cases', () => {
  assert.deepEqual(calculate().fields, { '0D20': 0, '0D78': 0, '0DD0': 0 });assert.equal(calculate().value, 1);
  assert.deepEqual(calculate([4,0,0]).fields, { '0D20': 16, '0D78': 0, '0DD0': 0 });
  assert.deepEqual(calculate([0,0,0], [1,0,0]).fields, { '0D20': 0xFFFF, '0D78': 0, '0DD0': 0 });
  assert.deepEqual(calculate([0,0,8]).fields, { '0D20': 0, '0D78': 0, '0DD0': 17 });
  assert.deepEqual(calculate([0,0,0], [0,0,32]).fields, { '0D20': 0, '0D78': 0, '0DD0': 0xFFF1 });
});

test('Full divisor0100 with low-byte zero produces manufacturerFFFF quotients and source postprocessing, not an exception', () => {
  const result = calculate([1024,0,0]);assert.equal(result.value, 0x100);
  assert.equal(result.scratchWords.B1, 0x80);
  assert.deepEqual(result.fields, { '0D20': 0, '0D78': 0, '0DD0': 0x80 });
  const negative = calculate([0,0,0], [4096,0,0]);assert.deepEqual(negative.fields, result.fields);
});

test('The ADC carry and word sign boundary preserve original results instead of signed JS division', () => {
  const carried = calculate([0,0,0], [0x8000,0xFFE1,0x8000]);
  assert.equal(carried.value, 2);assert.deepEqual(carried.fields, { '0D20': 0xC000, '0D78': 15, '0DD0': 0xC001 });
  const boundary = calculate([0,0,0], [0x8000,0,0x8000]);
  assert.equal(boundary.value, 1);assert.deepEqual(boundary.fields, { '0D20': 0x7FFF, '0D78': 0, '0DD0': 0x7FFF });
});

test('Calculation rejects missing, sparse and nonword operands and never changes caller arrays', () => {
  for (const words of [undefined, [], [0,0], [0,0,0,0], new Array(3), [0,-1,0], [0,65536,0]]) {
    assert.throws(() => calculateSlotTargetMotion({ recordWords: words, currentWords: [0,0,0] }), /Invalid/);
    assert.throws(() => calculateSlotTargetMotion({ recordWords: [0,0,0], currentWords: words }), /Invalid/);
  }
  for (const word of [-1,65536,null,1.5]) assert.throws(() => slotTargetIndex(word), /Invalid/);
  const record = Object.freeze([1,2,3]);const current = Object.freeze([4,5,6]);calculate(record,current);
  assert.deepEqual(record,[1,2,3]);assert.deepEqual(current,[4,5,6]);
});

test('Actual division wait sequences provide completed-read bounds without a runtime CPU or device model', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  const block = disassembleBlock(rom, 0x808D95, { e:0,m:0,x:0 }, 256);
  const bounds = [[0x808DE9,0x808DF2,17],[0x808E07,0x808E0F,15],[0x808E24,0x808E2C,15]];
  for (const [start,end,cycles] of bounds) {
    const sequence = block.instructions.filter(i => i.cpu >= start && i.cpu < end);
    const count = sequence.reduce((total, i) => total + (i.mnemonic === 'REP' ? 3 : i.mode === 'dp' ? 4 : 2), 0);
    assert.equal(count, cycles);
    // Three absolute-EOR fetch cycles precede the low-byte data read.
    assert.ok(count + 3 >= 16);assert.equal(block.instructions.find(i=>i.cpu===end).operand,'$4214');
  }
  assert.equal(rom[0x639F],0xD8); // Original reset CLD, binary game arithmetic.
});
