// Texts by number (docs/READABLE-GAME.md): scripts and natives name many texts by a
// number; this gives the text id the printer takes. Built once per game memory with the
// data modules' table reader until phase 4 loads it from the assets.
import { readTables } from '../data/tables.mjs';
import { textPointerWord } from '../data/rom-bytes.mjs';
import { BYTE_BITS, LONG_MASK, WORD_MASK } from '../constants/bits.mjs';

const cache = new WeakMap();
// Where the table lies, for numbers past its end (the original reads the words beyond).
const TEXT_NUMBER_TABLE = 0x80d9b8;

function build(mem) {
  const table = readTables((at) => mem.read8(at)).find((t) => t.name === 'text_numbers');
  return Object.freeze(
    table.values.map((label) => {
      if (!label) return 0;
      const [bank, offset] = label.split(':');
      return textPointerWord(bank, offset);
    }),
  );
}

// The text id of a text number.
export function textOfNumber(mem, number) {
  let texts = cache.get(mem);
  if (!texts) cache.set(mem, (texts = build(mem)));
  if (number < texts.length) return texts[number];
  const at = (TEXT_NUMBER_TABLE + ((number << 1) & WORD_MASK)) & LONG_MASK;
  return mem.read8(at) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
}
