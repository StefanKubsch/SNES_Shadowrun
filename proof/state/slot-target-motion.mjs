import { BYTE_MASK, WORD_MASK, WORD_SIGN } from '../../src/constants/bits.mjs';
import { isWord } from '../script/runtime.mjs';

const TARGET_INDEX_SCALE = 8;
const AXIS_COUNT = 3;
const COORDINATE_SCALE = 4;
const TARGET_DISTANCE_SHIFT = 4;

export function slotTargetIndex(word) {
  if (!isWord(word)) throw new Error('Invalid slot target index');
  const shifted = (word * TARGET_INDEX_SCALE) & WORD_MASK;
  const first = (shifted - word) & WORD_MASK;
  return (first - word - (shifted < word ? 1 : 0) + 1) & WORD_MASK;
}

// The specific D9/8D95 game calculation, using completed unsigned division.
// No instruction execution, device state, register bus or timing simulation.
export function calculateSlotTargetMotion({ recordWords, currentWords } = {}) {
  for (const words of [recordWords, currentWords])
    if (
      !Array.isArray(words) ||
      words.length !== AXIS_COUNT ||
      Array.from(words).some((word) => !isWord(word))
    )
      throw new Error('Invalid slot target words');
  const targets = recordWords.map((word) => (word * COORDINATE_SCALE) & WORD_MASK);
  const differences = targets.map((word, index) => (word - currentWords[index]) & WORD_MASK);
  const signs = differences.map((word) => (word & WORD_SIGN ? WORD_MASK : 0));
  const magnitudes = differences.map((word, index) => (signs[index] ? -word & WORD_MASK : word));
  // CLC / ADC A2 / ADC A5: the second addition includes the first carry.
  const firstSum = magnitudes[2] + magnitudes[0];
  const sum = ((firstSum & WORD_MASK) + magnitudes[1] + (firstSum > WORD_MASK ? 1 : 0)) & WORD_MASK;
  const value = Math.max(1, sum >>> TARGET_DISTANCE_SHIFT);
  const divisorByte = value & BYTE_MASK;
  const half = value >>> 1;
  const results = magnitudes.map((magnitude, index) => {
    const quotient = divisorByte === 0 ? WORD_MASK : Math.floor(magnitude / divisorByte);
    const signed = signs[index] ^ quotient;
    return (signed + (signed & WORD_SIGN ? 1 : 0)) & WORD_MASK;
  });
  return {
    value,
    fields: { '0D20': results[0], '0D78': results[1], '0DD0': (results[2] + half) & WORD_MASK },
    scratchWords: {
      A2: magnitudes[0],
      A5: magnitudes[1],
      A8: signs[0],
      AB: signs[1],
      AE: signs[2],
      B1: half,
      B4: targets[0],
      B7: targets[1],
      BA: targets[2],
    },
  };
}
