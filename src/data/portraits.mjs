// Dialog portraits (docs/ROM-FREE.md, step 2). 80:936C (src/task/
// native-dialog.mjs) takes the word at 80:94F7 + 2 n for dialog n, a dialog
// record in bank 8D; the long pointer at its start names the portrait record
// ([F6]; also 80:F254 through 1F54 and Jake's dialogs 4E/4F through 7E:3C17).
// A portrait record is 33 bytes: the long pointer of a packed stream that
// 80:9F6D unpacks to 7F:5250 (64 OBJ characters, 4 bpp; 80:8F20 spreads the
// rows of eight, 80:8FF5 sends them to VRAM), then 15 colours that the NMI
// 80:8FBA sends by DMA from [F6] + 3 (0x1E bytes) to CGRAM from colour [$142]
// (91 or A1; src/task/main-game-nmi.mjs).
// The table has 139 words: it ends where code begins at 80:960D, no code
// bound is known, and all 139 name distinct dialog records whose portrait
// records are distinct too. The records lie back to back in reverse dialog
// order in five runs (81:FF7F, 84:FF0E, 85:FDB6, 87:FFB4, 89:C1AA to the
// stream 89:CFD8). Records are named by address in the dialog records, so
// each keeps its address (portrait_layout_changed); the streams are in
// assets/vm-lz.json (format obj4).
// Native form assets/vm-portraits.json: per record in address order the
// address, the stream address and the 15 colours as hex words.
import { VmFault } from '../vm/memory.mjs';
import { hex, label, requireRomAddress, romWriter, wordReader } from './rom-bytes.mjs';
import {
  WORD_MASK,
  BYTE_MASK,
  BYTE_BITS,
  HEX_RADIX,
  WORD_BITS,
  BANK_SIZE,
  WORD_HEX_DIGITS,
  LONG_BYTES,
} from '../constants/bits.mjs';
import { LOROM_OFFSET } from '../constants/memory-map.mjs';

export const DIALOG_TABLE = 0x8094f7,
  DIALOGS = 139,
  PORTRAIT_SIZE = 33,
  DIALOG_BANK_BASE = 0x8d0000;
const PORTRAIT_COLOURS = 15,
  PORTRAIT_COLOURS_START = LONG_BYTES;
const parse = (text, at) => requireRomAddress(text, 'portrait_value_required', at);

export function readPortraits(read8) {
  const word = wordReader(read8),
    long = (cpu) => word(cpu) | (read8(cpu + 2) << WORD_BITS);
  const records = new Set();
  for (let n = 0; n < DIALOGS; n++) {
    const record = long(DIALOG_BANK_BASE | word(DIALOG_TABLE + 2 * n));
    if (
      records.has(record) ||
      (record & WORD_MASK) < LOROM_OFFSET ||
      (record & WORD_MASK) + PORTRAIT_SIZE > BANK_SIZE
    )
      throw new VmFault('portrait_record_required', record);
    records.add(record);
  }
  return [...records]
    .sort((a, b) => a - b)
    .map((address) => ({
      address: label(address),
      stream: label(long(address)),
      colors: Array.from({ length: PORTRAIT_COLOURS }, (_, k) =>
        hex(word(address + PORTRAIT_COLOURS_START + 2 * k), WORD_HEX_DIGITS),
      ),
    }));
}

export const portraitStreams = (read8) => [
  ...new Set(readPortraits(read8).map((p) => parse(p.stream))),
];

// Palette ranges (CGRAM probe) inside a record stay with the record.
export function outsidePortraits(read8, ranges) {
  const records = readPortraits(read8).map((p) => parse(p.address));
  return ranges.filter(([cpu, length]) => {
    const record = records.find((r) => cpu < r + PORTRAIT_SIZE && cpu + length > r);
    if (record === undefined) return true;
    if (cpu >= record + PORTRAIT_COLOURS_START && cpu + length <= record + PORTRAIT_SIZE)
      return false;
    throw new VmFault('portrait_palette_overlap', cpu);
  });
}

export function placePortraits(rom, present, { portraits }) {
  const put = romWriter(rom, present, 'portrait_layout_changed');
  if (portraits?.length !== DIALOGS) throw new VmFault('portrait_layout_changed', DIALOG_TABLE);
  for (const p of portraits) {
    const address = parse(p.address, DIALOG_TABLE),
      stream = parse(p.stream, address);
    if (
      p.colors?.length !== PORTRAIT_COLOURS ||
      p.colors.some((c) => !/^[0-9A-F]{4}$/.test(c ?? ''))
    )
      throw new VmFault('portrait_value_required', address);
    const bytes = [
      stream & BYTE_MASK,
      (stream >> BYTE_BITS) & BYTE_MASK,
      stream >> WORD_BITS,
      ...p.colors.flatMap((c) => [
        parseInt(c, HEX_RADIX) & BYTE_MASK,
        parseInt(c, HEX_RADIX) >> BYTE_BITS,
      ]),
    ];
    if ((address & WORD_MASK) + PORTRAIT_SIZE > BANK_SIZE)
      throw new VmFault('portrait_layout_changed', address);
    bytes.forEach((v, i) => {
      put(address + i, v);
    });
  }
}
