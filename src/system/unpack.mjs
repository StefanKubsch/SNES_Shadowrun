// The unpacker (lifted from 80:9E9B-A032; register-level versions in
// src/task/native-unpack-body.mjs and native-unpack.mjs; format in
// src/data/lz.mjs). A stream starts with its output length and the offset of
// its bit stream; literal bytes follow from byte 4. Gamma-coded lengths
// alternate literal runs and references to earlier output (at least three
// bytes, overlap allowed); after a reference one bit chooses another reference
// or a literal run. Unpacking ends once the output count reaches the length, so
// the last run or copy may write past it, as in the original.
//
// The original keeps its state in the direct page (7E:00DB-00F2) and sets every
// field before it reads it; the lifted unpacker keeps it in locals. The long entries
// (unpackLong) leave it there afterwards, as the original: later game code does not
// read it, but the Mesen oracle compares the direct page.
import { decodeOnce, tableEntries } from '../data/named-tables.mjs';
import { languageStreamSource } from '../data/language.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const LONG_MASK = 0xffffff,
  WRAM_STREAM_BANK = 0x7e,
  BANK_SHIFT = 16,
  BIT_STREAM_FIELD = 2,
  // The bit stream offset counts from the field after it.
  BIT_STREAM_BASE = 2,
  LITERALS = 4,
  WORD_BITS_COUNT = 16,
  // A reference copies its gamma value plus two bytes.
  REFERENCE_EXTRA = 2,
  // 80:9E7E unpacks 128 bytes.
  FIXED_LENGTH = 0x80;

const bitLengths = (mem) =>
  decodeOnce(mem, 'lz_bit_lengths', (image) => tableEntries(image, 'lz_bit_lengths'));

// Unpack the stream at source (long address) into bank outputBank from offset start.
// Returns the offset after the last byte written.
export const unpack = (mem, source, outputBank, start) =>
  unpackWithState(mem, source, outputBank, start).cursor;

// The unpacker's run: limit is the output length (the stream's first word unless
// given). Returns the final state, the original's direct page fields.
function unpackWithState(mem, source, outputBank, start, length = null) {
  const read = (offset) => mem.read8((source + offset) & LONG_MASK),
    readWord = (offset) => read(offset) | (read(offset + 1) << BYTE_BITS),
    write = (offset, value) => mem.write8((outputBank << BANK_SHIFT) | (offset & WORD_MASK), value),
    lengths = bitLengths(mem);
  const limit = length ?? readWord(0);
  let bitStream = (readWord(BIT_STREAM_FIELD) + BIT_STREAM_BASE) & WORD_MASK,
    literal = LITERALS,
    cursor = start,
    count = 0,
    bitsLeft = 0,
    bits = 0,
    // The last run: the literal count, or for a reference its gamma value plus one.
    lastRun = 0,
    // The original's Y at the end: the literal offset after a literal run, the cursor
    // after a reference (its MVN steps Y along the output); its X: the cursor after a
    // literal run, the copy's source after a reference (the MVN steps X along it).
    endIndex = 0,
    endSource = 0;
  // Bits come in stream order: each word is read with its first byte on top, the
  // highest bit first.
  const nextBit = () => {
    if (--bitsLeft < 0) {
      bitsLeft = WORD_BITS_COUNT - 1;
      const value = readWord(bitStream);
      bits = ((value & BYTE_MASK) << BYTE_BITS) | (value >>> BYTE_BITS);
      bitStream = (bitStream + 2) & WORD_MASK;
    }
    const bit = (bits & WORD_SIGN) !== 0;
    bits = (bits << 1) & WORD_MASK;
    return bit;
  };
  // A gamma code: from 1, while a 0 bit follows append the next bit.
  const gamma = () => {
    let value = 1;
    while (!nextBit()) value = ((value << 1) | Number(nextBit())) & WORD_MASK;
    return value;
  };
  const advance = (bytes) => {
    count = (count + bytes) & WORD_MASK;
    return count >= limit;
  };
  // A reference: an absolute output position with as many bits as the count needs.
  const reference = () => {
    const high = count >>> BYTE_BITS;
    let width = high !== 0 ? lengths[high] + BYTE_BITS : lengths[count & BYTE_MASK];
    let position = 0;
    do {
      position = ((position << 1) | Number(nextBit())) & WORD_MASK;
      width = (width - 1) & WORD_MASK;
    } while (width !== 0);
    let from = (position + start) & WORD_MASK;
    const bytes = gamma() + REFERENCE_EXTRA;
    lastRun = (bytes - 1) & WORD_MASK;
    for (let n = 0; n < bytes; n++) {
      write(cursor, mem.read8((outputBank << BANK_SHIFT) | from));
      from = (from + 1) & WORD_MASK;
      cursor = (cursor + 1) & WORD_MASK;
    }
    endIndex = cursor;
    endSource = from;
    return advance(bytes);
  };
  let afterReference = false;
  for (;;) {
    if (afterReference && nextBit()) {
      if (reference()) break;
      continue;
    }
    // Literals go out as words, then one byte for an odd run. A word written at
    // offset FFFF puts its second byte into the next bank, as absolute indexed
    // stores do. A run of 0 (the gamma value wraps) still copies one byte: the
    // original takes its single-byte path whenever the run has no whole word.
    const run = gamma(),
      words = run >>> 1;
    lastRun = run;
    for (let n = 0; n < words; n++) {
      // The word is read whole before it is written (the source may overlap).
      const at = (outputBank << BANK_SHIFT) | cursor,
        low = read(literal),
        high = read(literal + 1);
      mem.write8(at, low);
      mem.write8((at + 1) & LONG_MASK, high);
      literal = (literal + 2) & WORD_MASK;
      cursor = (cursor + 2) & WORD_MASK;
    }
    if (words === 0 || run & 1) {
      write(cursor, read(literal));
      literal = (literal + 1) & WORD_MASK;
      cursor = (cursor + 1) & WORD_MASK;
    }
    endIndex = literal;
    endSource = cursor;
    if (advance(run)) break;
    if (reference()) break;
    afterReference = true;
  }
  return {
    limit,
    cursor,
    bitStream,
    literal,
    count,
    lastRun,
    bitsLeft,
    bits,
    endIndex,
    endSource,
  };
}

// The direct page fields of the original (7E:00DB-00F2): the output limit, start and
// cursor, the source pointer and its bank word, the bit stream and literal offsets,
// the output count, the last run, the literal words left, the bits left and the bit
// buffer.
const DP_LIMIT = 0xdb,
  DP_START = 0xdd,
  DP_CURSOR = 0xdf,
  DP_SOURCE = 0xe1,
  DP_SOURCE_BANK = 0xe3,
  DP_BIT_STREAM = 0xe5,
  DP_LITERAL = 0xe7,
  DP_COUNT = 0xe9,
  DP_RUN = 0xeb,
  DP_LITERAL_WORDS = 0xed,
  DP_BITS_LEFT = 0xef,
  DP_BITS = 0xf1;

// The long entries of the unpacker, as the original's callers pass the stream: the
// pointer (A) and the bank word (Y, its low byte the bank) of the stream, the output
// offset (X). 80:9F49 unpacks into bank 7E and reads the translation of the stream
// when the language has one (src/data/language.mjs); 80:9E7E does the same for 128
// bytes, whatever the stream's length word says; 80:9F69 unpacks into bank 7F and
// reads the stream as it is. Each leaves the direct page fields as the original.
// Returns the index register Y the original leaves (unpackLongRegisters also A, the
// output length it pulls at the end, and X).
export const UNPACK_7E = Object.freeze({ outputBank: WRAM_STREAM_BANK, translated: true }),
  UNPACK_FIXED_7E = Object.freeze({ ...UNPACK_7E, length: FIXED_LENGTH }),
  UNPACK_7F = Object.freeze({ outputBank: WRAM_STREAM_BANK + 1, translated: false });
export const unpackLong = (mem, pointer, bankWord, start, form) =>
  unpackLongRegisters(mem, pointer, bankWord, start, form).y;
export function unpackLongRegisters(
  mem,
  pointer,
  bankWord,
  start,
  { outputBank, translated, length },
) {
  const { wram } = mem,
    setWord = (at, value) => {
      wram[at] = value & BYTE_MASK;
      wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
    };
  let source = ((bankWord & BYTE_MASK) << BANK_SHIFT) | pointer;
  if (translated) {
    const target = languageStreamSource(mem, source);
    // A translated stream replaces the pointer and the whole bank word.
    if (target !== source) [source, bankWord] = [target, target >>> BANK_SHIFT];
  }
  const state = unpackWithState(mem, source, outputBank, start, length);
  for (const [at, value] of [
    [DP_LIMIT, state.limit],
    [DP_START, start],
    [DP_CURSOR, state.cursor],
    [DP_SOURCE, source],
    [DP_SOURCE_BANK, bankWord],
    [DP_BIT_STREAM, state.bitStream],
    [DP_LITERAL, state.literal],
    [DP_COUNT, state.count],
    [DP_RUN, state.lastRun],
    // Every literal run counts its words down to zero.
    [DP_LITERAL_WORDS, 0],
    [DP_BITS_LEFT, state.bitsLeft],
    [DP_BITS, state.bits],
  ])
    setWord(at, value);
  return { a: state.limit, x: state.endSource, y: state.endIndex };
}

// The stream form (80:9F4D, long form 80:F2A0): into bank 7E, reading the
// translation of the stream when the language has one (src/data/language.mjs).
export const unpackStream = (mem, source, start) =>
  unpack(mem, languageStreamSource(mem, source), WRAM_STREAM_BANK, start);
