// Texts (docs/ROM-FREE.md, step 2): dialog and term texts lie in the
// ROM as a Huffman bit stream, decoded by $80:FE69 (src/task/native-text-compose.mjs)
// with the bit reader $81:AF04 (src/task/native-text-prerequisites.mjs):
// - Tree from $9D:8000: node i at offset 4*i, two words for bit 0 and bit 1.
//   A word without bit 15 is the offset of the child node, with bit 15 a leaf:
//   first character in bits 8-14, second in bits 0-6 (0 = none), bit 7 = second
//   character present. FE69 outputs the high character first, then the low one.
// - Text: starts at a byte address in bank $9D or $9E; AF04 reads words
//   and outputs their bits with the highest bit of the first byte first, that is
//   a byte stream in read order. Character 10 ends the text.
// - In the original the texts follow each other without gaps: the next one starts at
//   the byte after the last used bit; the remaining bits are zero, and every
//   character pair with its own leaf is encoded as a pair (encoder below, checked
//   byte for byte for all texts in tools/build-cartridge.mjs).
// Format of assets/vm-texts.json: tree = node list, child = node index or
// leaf as a string (1-2 characters); texts = {address, text} in memory order.
import { VmFault } from '../vm/memory.mjs';
import { romWriter } from './rom-bytes.mjs';
import { BYTE_MASK, BYTE_BITS, HEX_RADIX, WORD_BITS, BYTE_SIGN } from '../constants/bits.mjs';

export const TEXT_TREE = 0x9d8000,
  TEXT_END = 10;
// Tree node: two words (bit 0, bit 1). A leaf has bit 15 set, the first
// character in bits 8-14 and the second in bits 0-6 with bit 7 as its flag.
export const NODE_BYTES = 4;
const LEAF = 0x8000,
  CHARACTER_MASK = 0x7f,
  SECOND_CHARACTER = 0x80;
// Guard against a text without an end character: no text is near 4 KiB.
const TEXT_BITS_LIMIT = 0x8000;
const leafWord = (s) =>
  LEAF | (s.charCodeAt(0) << BYTE_BITS) | (s.length > 1 ? s.charCodeAt(1) | SECOND_CHARACTER : 0);
const leafText = (v) =>
  String.fromCharCode((v >> BYTE_BITS) & CHARACTER_MASK) +
  (v & CHARACTER_MASK ? String.fromCharCode(v & CHARACTER_MASK) : '');

// Tree from the ROM (read16 reads a word at a CPU address).
export function readTextTree(read16) {
  const nodes = [];
  for (let i = 0, count = 1; i < count; i++) {
    const node = [0, 1].map((b) => read16(TEXT_TREE + NODE_BYTES * i + 2 * b));
    for (const v of node)
      if (!(v & LEAF)) {
        if (v % NODE_BYTES)
          throw new VmFault('text_tree_layout_required', TEXT_TREE + NODE_BYTES * i);
        count = Math.max(count, v / NODE_BYTES + 1);
      }
    nodes.push(node.map((v) => (v & LEAF ? leafText(v) : v / NODE_BYTES)));
  }
  return nodes;
}

// One text at cpu: string without the end character, and the length in bytes.
export function readText(read8, tree, cpu) {
  let text = '',
    bits = 0;
  for (;;) {
    let node = 0,
      child;
    do {
      const byte = read8(cpu + Math.floor(bits / BYTE_BITS)),
        bit = (byte >> (BYTE_BITS - 1 - (bits % BYTE_BITS))) & 1;
      bits++;
      child = tree[node][bit];
      node = child;
      if (bits > TEXT_BITS_LIMIT) throw new VmFault('text_end_required', cpu);
    } while (typeof child === 'number');
    if (child.charCodeAt(0) === TEXT_END) break;
    text += child[0];
    if (child.length > 1) {
      if (child.charCodeAt(1) === TEXT_END) break;
      text += child[1];
    }
  }
  return { text, length: Math.ceil(bits / BYTE_BITS) };
}

// Encoder: codes per leaf, a greedy character pair before single characters.
export function textEncoder(tree) {
  const codes = new Map();
  const walk = (node, prefix) =>
    tree[node].forEach((c, b) =>
      typeof c === 'number' ? walk(c, prefix + b) : codes.set(c, prefix + b),
    );
  walk(0, '');
  return (text) => {
    const chars = text + String.fromCharCode(TEXT_END);
    let bits = '';
    for (let i = 0; i < chars.length;) {
      const pair = codes.get(chars.slice(i, i + 2)),
        code = pair ?? codes.get(chars[i]);
      if (code === undefined) throw new VmFault('text_character_required');
      bits += code;
      i += pair !== undefined && i + 1 < chars.length ? 2 : 1;
    }
    const bytes = new Uint8Array(Math.ceil(bits.length / BYTE_BITS));
    for (let n = 0; n < bits.length; n++)
      if (bits[n] === '1') bytes[Math.floor(n / BYTE_BITS)] |= BYTE_SIGN >> (n % BYTE_BITS);
    return bytes;
  };
}

// Writes the tree and texts to rom and marks them in present. Each text
// must start at its address and may not overwrite a byte already in use:
// the pointers to texts sit in scripts and tables and
// are not moved.
export function placeTexts(rom, present, { tree, texts }) {
  const put = romWriter(rom, present, 'text_layout_changed');
  tree.forEach((node, i) =>
    node.forEach((c, b) => {
      const v = typeof c === 'number' ? NODE_BYTES * c : leafWord(c);
      put(TEXT_TREE + NODE_BYTES * i + 2 * b, v & BYTE_MASK);
      put(TEXT_TREE + NODE_BYTES * i + 2 * b + 1, v >> BYTE_BITS);
    }),
  );
  const encode = textEncoder(tree);
  let next = null;
  for (const { address, text } of texts) {
    const cpu = parseInt(address.replace(':', ''), HEX_RADIX);
    if (next !== null && next >>> WORD_BITS === cpu >>> WORD_BITS && cpu !== next)
      throw new VmFault('text_layout_changed', cpu);
    const bytes = encode(text);
    for (let i = 0; i < bytes.length; i++) put(cpu + i, bytes[i]);
    next = cpu + bytes.length;
  }
}
