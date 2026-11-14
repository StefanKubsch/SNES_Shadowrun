// The port's own data bank (user decision 2026-11-04, docs/SAVING.md): new
// content for quality-of-life options that the original cartridge does not
// hold, kept apart from the original data package. It is mapped read-only at
// $A0:8000 (src/vm/memory.mjs), a bank the 1 MiB LoROM does not use, and
// installed only when an option needs it, so the original game never sees it.
//
// Texts use the original Huffman format with the original tree at 9D:8000
// (src/data/texts.mjs) and are decoded by the unchanged decoder 80:FE69. A
// text pointer in the original addresses only banks 9D/9E, so port texts get
// reserved ids below 057C: those point into the tree itself (9D:8000..857B)
// and are never the start of an original text. FE69 redirects exactly these
// ids to their address in this bank (portTextAddress).
import { PORT_BANK, VmFault } from '../vm/memory.mjs';
import { TEXT_TREE, NODE_BYTES, readTextTree, textEncoder } from './texts.mjs';
import { BYTE_MASK, BYTE_BITS, WORD_BITS } from '../constants/bits.mjs';

export const PORT_BASE = (PORT_BANK << WORD_BITS) | 0x8000;
const TREE_END = 0x057c;

// Original text ids used by the bed menu 80:CDD6 (item list 80:CE65).
export const TEXT_EXIT = 0x7088,
  TEXT_SAVE_GAME_1 = 0x7411,
  TEXT_SAVE_GAME_2 = 0x7419;
export const PORT_TEXTS = Object.freeze([
  Object.freeze({ id: 0x0100, text: 'Save game 3' }),
  Object.freeze({ id: 0x0101, text: 'Save game 4' }),
]);
// The four-slot item list for 80:A6C7, in the order of 80:CE65.
const SAVE_MENU_ITEMS = [TEXT_EXIT, TEXT_SAVE_GAME_1, TEXT_SAVE_GAME_2, 0x0100, 0x0101, 0];

// Builds the bank from the original tree (read16 reads a CPU word).
// Layout: the item list at 8000, then each text, followed by two zero bytes
// because the bit reader 81:AF04 reads whole words.
export function buildPortExtension(read16) {
  const tree = readTextTree(read16);
  if (tree.length * NODE_BYTES > TREE_END)
    throw new VmFault('port_text_ids_overlap_tree', TEXT_TREE);
  const encode = textEncoder(tree),
    bytes = [],
    texts = new Map();
  for (const item of SAVE_MENU_ITEMS) bytes.push(item & BYTE_MASK, item >> BYTE_BITS);
  for (const { id, text } of PORT_TEXTS) {
    if (id === 0 || id >= TREE_END) throw new VmFault('port_text_id_required');
    texts.set(id, PORT_BASE + bytes.length);
    bytes.push(...encode(text), 0, 0);
  }
  return Object.freeze({
    bytes: Uint8Array.from(bytes),
    texts,
    saveMenuItems: PORT_BASE,
  });
}

// Maps the bank into memory (VmMemory) and keeps the text addresses there.
export function installPortExtension(memory) {
  const extension = buildPortExtension((at) => memory.read16(at));
  memory.extension = extension.bytes;
  memory.portTexts = extension.texts;
  return extension;
}

// The address of a port text id for FE69, or null (original text or no bank).
export const portTextAddress = (memory, id) => memory?.portTexts?.get(id) ?? null;
