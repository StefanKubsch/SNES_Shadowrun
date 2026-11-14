// Packed data of the unpacker $80:9F49/$80:9F4D/$80:9E7E (docs/ROM-FREE.md,
// docs/reference/render-routines.md#entpacker, port: src/task/native-unpack.mjs). A stream
// from the data start d (9E7E: pointer + 2; 9F49/9F4D: after the length word):
// - Word at d: offset of the bit stream from d; literal bytes from d + 2.
// - Bit stream: words, highest bit of the first byte first (like the texts).
// - First a literal run, then always a reference; after a reference one
//   bit chooses: 0 = literal run, 1 = another reference. End as soon as the output
//   reaches the length.
// - Lengths as a gamma code: start value 1; while bit 0 follows, the next
//   bit is appended; bit 1 ends. Literal run = value, reference = value + 2.
// - Reference: absolute output position with bitsFor(output length so far) bits
//   (table $80:A033, index high byte + 8 or low byte); copy byte by byte,
//   overlap allowed.
// Decomposition (tokens): [n] = literal run, [position, length] = reference.
import { VmFault } from '../vm/memory.mjs';
// A reference copies at least three bytes (gamma value + 2).
const MIN_REFERENCE = 3;
const INT32_HIGH_BIT = 31;
import { BYTE_MASK, WORD_MASK, BYTE_BITS, BANK_SIZE, BYTE_SIGN } from '../constants/bits.mjs';

// bitTable(n) reads byte n of the table $80:A033.
export const lzBits = (bitTable) => (count) =>
  count >> BYTE_BITS
    ? BYTE_BITS + bitTable((count >> BYTE_BITS) & BYTE_MASK)
    : bitTable(count & BYTE_MASK);

// read8(i) reads byte i from d. Returns the output, the decomposition and the length in bytes.
export function lzDecode(read8, length, bitsFor) {
  const bitStart = read8(0) | (read8(1) << BYTE_BITS);
  let literal = 2,
    used = 0;
  const bit = () => {
    const b =
      (read8(bitStart + Math.floor(used / BYTE_BITS)) >> (BYTE_BITS - 1 - (used % BYTE_BITS))) & 1;
    used++;
    return b;
  };
  const gamma = () => {
    let a = 1;
    while (!bit()) a = ((a << 1) | bit()) & WORD_MASK;
    return a;
  };
  const out = [],
    tokens = [];
  for (let isLiteral = true; ;) {
    if (isLiteral) {
      const n = gamma();
      tokens.push([n]);
      for (let i = 0; i < n; i++) out.push(read8(literal++));
    } else {
      const width = bitsFor(out.length);
      let position = 0;
      for (let i = 0; i < width; i++) position = ((position << 1) | bit()) & WORD_MASK;
      const n = gamma() + 2;
      tokens.push([position, n]);
      for (let i = 0; i < n; i++) out.push(out[position + i]);
    }
    if (out.length >= length) break;
    if (out.length > BANK_SIZE) throw new VmFault('lz_length_required');
    isLiteral = isLiteral ? false : !bit();
  }
  return {
    data: Uint8Array.from(out.slice(0, length)),
    tokens,
    byteLength: Math.max(literal, bitStart + Math.ceil(used / BYTE_BITS)),
  };
}

// Checks whether tokens produce data (literals come from data).
function fits(data, tokens) {
  let at = 0,
    before = 0;
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k],
      literal = t.length === 1;
    if (literal ? k > 0 && tokens[k - 1].length === 1 : k === 0) return false;
    before = at;
    if (literal) {
      if (t[0] < 1 || at + t[0] > data.length) return false;
      at += t[0];
      continue;
    }
    const [position, n] = t;
    if (n < MIN_REFERENCE || position >= at) return false;
    for (let i = 0; i < n; i++)
      if (at + i < data.length && data[position + i] !== data[at + i]) return false;
    at += n;
  }
  // The unpacker ends after the token that reaches the length.
  return tokens.length > 0 && before < data.length && at >= data.length;
}

// Greedy decomposition for changed data: longest match, on a tie the latest.
function greedy(data) {
  const best = (at) => {
    let length = 0,
      position = 0;
    for (let s = 0; s < at; s++) {
      let n = 0;
      while (at + n < data.length && data[s + n] === data[at + n]) n++;
      if (n >= length && n > 0) {
        length = n;
        position = s;
      }
    }
    return [length, position];
  };
  const tokens = [];
  for (let at = 0; at < data.length;) {
    let run = 1;
    while (at + run < data.length && best(at + run)[0] < MIN_REFERENCE) run++;
    tokens.push([run]);
    at += run;
    while (at < data.length) {
      const [n, position] = best(at);
      if (n < MIN_REFERENCE) break;
      tokens.push([position, n]);
      at += n;
    }
    if (at < data.length && tokens.at(-1).length === 1) throw new VmFault('lz_reference_required');
  }
  return tokens;
}

// Packs data; tokens (stored decomposition of the original) apply if they
// produce data, otherwise greedy. Result: bytes from d.
export function lzEncode(data, tokens, bitsFor) {
  const parse = tokens && fits(data, tokens) ? tokens : greedy(data);
  const literals = [],
    bits = [];
  const put = (value, width) => {
    for (let i = width - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  const gamma = (value) => {
    const width = INT32_HIGH_BIT - Math.clz32(value);
    for (let i = width - 1; i >= 0; i--) bits.push(0, (value >> i) & 1);
    bits.push(1);
  };
  let at = 0;
  parse.forEach((t, k) => {
    if (t.length === 1) {
      if (k > 0) bits.push(0);
      gamma(t[0]);
      for (let i = 0; i < t[0]; i++) literals.push(data[at + i]);
      at += t[0];
    } else {
      if (k > 0 && parse[k - 1].length === 2) bits.push(1);
      put(t[0], bitsFor(at));
      gamma(t[1] - 2);
      at += t[1];
    }
  });
  const bitStart = 2 + literals.length,
    bytes = new Uint8Array(bitStart + Math.ceil(bits.length / BYTE_BITS));
  bytes[0] = bitStart & BYTE_MASK;
  bytes[1] = bitStart >> BYTE_BITS;
  bytes.set(literals, 2);
  for (let n = 0; n < bits.length; n++)
    if (bits[n]) bytes[bitStart + Math.floor(n / BYTE_BITS)] |= BYTE_SIGN >> (n % BYTE_BITS);
  return bytes;
}
