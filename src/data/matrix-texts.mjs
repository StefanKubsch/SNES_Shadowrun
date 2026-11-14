// Matrix texts of bank 81 (docs/ROM-FREE.md, step 2): 81:C515 to CDB2.
// - 81:C515 six list pointers; C39F takes the word for the matrix screen
//   1D90 (src/matrix/matrix-text.mjs). A list at C521 to C538 is a count
//   byte and one long text pointer (word, bank) per entry; C39F hands each
//   one to 81:B282, the text queue of the matrix.
// - 81:C539 to CDB2 22 texts in a row, each ending with 00. B2D1 prints
//   them: bytes from 20 on are characters (tile map 7E:FFC0), 01 to 1F
//   commands through the table 81:B370 (only 01 to 06 exist): 01 to 03 set
//   the palette (cmd - 1) << 10 (B37E), 04 starts a new line (B389), 05 n
//   waits n (B3BC), 06 steps one character back (B3C8). The matrix setup
//   prints C62E and copies the first 16 bytes of the text C60D to
//   7F:0140; src/matrix/matrix-world.mjs prints eight more by address.
// Native form assets/vm-matrix-texts.json: the lists as text addresses and
// each text as a string, with "\n" for 04, {palette n} for 01 to 03,
// {wait n} for 05 n, {back} for 06 and {xHH} for any other byte below 20,
// above 7E or "{". Every text keeps its address (matrix_layout_changed).
import { VmFault } from '../vm/memory.mjs';
import { hex, label, romWriter, wordReader } from './rom-bytes.mjs';
import {
  BYTE_BITS,
  HEX_RADIX,
  WORD_BITS,
  BANK_MASK,
  BYTE_HEX_DIGITS,
  BYTE_MASK,
  LONG_BYTES,
} from '../constants/bits.mjs';

export const MATRIX_LISTS = 0x81c515,
  MATRIX_TEXTS = 0x81c539,
  MATRIX_END = 0x81cdb2;
const LIST_COUNT = 6;
// Text bytes: 00 end, 01-03 palette (cmd - 1), 04 new line, 05 n wait, 06 back,
// characters from 20 to 7E except "{" (7B), which starts a token in the JSON.
const TEXT_END = 0,
  PALETTE_FIRST = 1,
  PALETTE_LAST = 3,
  NEW_LINE = 4,
  WAIT = 5,
  BACK = 6,
  FIRST_CHARACTER = 0x20,
  LAST_CHARACTER = 0x7e,
  TOKEN_START = 0x7b,
  LINE_FEED = 10;
// List entry: one long text pointer after the count byte.
const LIST_ENTRY = 1,
  LIST_ENTRY_BYTES = LONG_BYTES;
const address = (text) =>
  /^([0-9A-F]{2}):([0-9A-F]{4})$/.test(text ?? '')
    ? parseInt(text.replace(':', ''), HEX_RADIX)
    : null;

function decodeMatrixText(read8, at) {
  let text = '';
  for (;;) {
    const b = read8(at++);
    if (b === TEXT_END) return { text, length: at };
    if (b === NEW_LINE) text += '\n';
    else if (b >= PALETTE_FIRST && b <= PALETTE_LAST) text += `{palette ${b - PALETTE_FIRST}}`;
    else if (b === WAIT) text += `{wait ${read8(at++)}}`;
    else if (b === BACK) text += '{back}';
    else if (b < FIRST_CHARACTER || b > LAST_CHARACTER || b === TOKEN_START)
      text += `{x${hex(b, BYTE_HEX_DIGITS)}}`;
    else text += String.fromCharCode(b);
  }
}

export function encodeMatrixText(text) {
  const bytes = [];
  for (let k = 0; k < text.length;) {
    const token =
      /^\{(?<name>palette [0-2]|wait (?<wait>\d{1,3})|back|x(?<code>[0-9A-F]{2}))\}/.exec(
        text.slice(k),
      );
    if (token) {
      const { name, wait, code } = token.groups;
      if (wait !== undefined) {
        if (+wait > BYTE_MASK) return null;
        bytes.push(WAIT, +wait);
      } else if (code !== undefined) bytes.push(parseInt(code, HEX_RADIX));
      else if (name === 'back') bytes.push(BACK);
      else bytes.push(+name.slice(-1) + PALETTE_FIRST);
      k += token[0].length;
      continue;
    }
    const c = text.charCodeAt(k++);
    if (c === LINE_FEED) bytes.push(NEW_LINE);
    else if (c >= FIRST_CHARACTER && c <= LAST_CHARACTER && c !== TOKEN_START) bytes.push(c);
    else return null;
  }
  return [...bytes, TEXT_END];
}

export function readMatrixTexts(read8) {
  const word = wordReader(read8);
  const texts = [];
  let at = MATRIX_TEXTS;
  while (at < MATRIX_END) {
    const { text, length } = decodeMatrixText(read8, at);
    texts.push({ address: label(at), text });
    at = length;
  }
  if (at !== MATRIX_END) throw new VmFault('matrix_layout_changed', MATRIX_END);
  at = MATRIX_LISTS + 2 * LIST_COUNT;
  const lists = Array.from({ length: LIST_COUNT }, (_, n) => {
    if (((MATRIX_LISTS & BANK_MASK) | word(MATRIX_LISTS + 2 * n)) !== at)
      throw new VmFault('matrix_layout_changed', MATRIX_LISTS + 2 * n);
    const entries = Array.from({ length: read8(at) }, (_, k) => {
      const entry = at + LIST_ENTRY + LIST_ENTRY_BYTES * k;
      return label((read8(entry + 2) << WORD_BITS) | word(entry));
    });
    at += LIST_ENTRY + LIST_ENTRY_BYTES * entries.length;
    return entries;
  });
  if (at !== MATRIX_TEXTS) throw new VmFault('matrix_layout_changed', at);
  return { lists, texts };
}

export function placeMatrixTexts(rom, present, { lists, texts }) {
  const put = romWriter(rom, present, 'matrix_layout_changed');
  if (lists?.length !== LIST_COUNT || !Array.isArray(texts))
    throw new VmFault('matrix_layout_changed', MATRIX_LISTS);
  const starts = new Set();
  let at = MATRIX_TEXTS;
  for (const t of texts) {
    if (address(t?.address) !== at) throw new VmFault('matrix_layout_changed', at);
    const bytes = typeof t.text === 'string' ? encodeMatrixText(t.text) : null;
    if (!bytes) throw new VmFault('matrix_text_required', at);
    starts.add(t.address);
    bytes.forEach((v, k) => put(at + k, v));
    at += bytes.length;
  }
  if (at !== MATRIX_END) throw new VmFault('matrix_layout_changed', at);
  at = MATRIX_LISTS + 2 * LIST_COUNT;
  lists.forEach((entries, n) => {
    put(MATRIX_LISTS + 2 * n, at);
    put(MATRIX_LISTS + 2 * n + 1, at >> BYTE_BITS);
    if (
      !Array.isArray(entries) ||
      entries.length > BYTE_MASK ||
      !entries.every((e) => starts.has(e))
    )
      throw new VmFault('matrix_text_required', at);
    put(at, entries.length);
    entries.forEach((e, k) => {
      const a = address(e),
        entry = at + LIST_ENTRY + LIST_ENTRY_BYTES * k;
      put(entry, a);
      put(entry + 1, a >> BYTE_BITS);
      put(entry + 2, a >> WORD_BITS);
    });
    at += LIST_ENTRY + LIST_ENTRY_BYTES * entries.length;
  });
  if (at !== MATRIX_TEXTS) throw new VmFault('matrix_layout_changed', at);
}
