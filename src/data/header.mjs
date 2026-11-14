// The cartridge header and interrupt vectors 80:FFC0 to FFFF (docs/ROM-FREE.md,
// step 2). Header fields after Book I, "ROM Registration Data" (PDF 32 to 35,
// printed 1-2-14 to 1-2-20): title FFC0 (21 ASCII bytes, unused ones 20),
// map mode FFD5, cartridge type FFD6, ROM size FFD7, RAM size FFD8,
// destination FFD9; this older header has the maker code at FFDA instead of
// 33, then the version FFDB, the checksum complement FFDC and the checksum
// FFDE. The vectors FFE0 to FFFF are the native and emulation entries of the
// 65816 (NMI, IRQ and ABORT in SnesDevManualCPU.pdf, PDF 5; COP, BRK and
// RESET by the CPU standard, BRK and RESET proven in the port).
import { VmFault } from '../vm/memory.mjs';
import { romWriter } from './rom-bytes.mjs';
import { BYTE_MASK, BYTE_BITS, HEX_RADIX } from '../constants/bits.mjs';
import { CODE_BANK_BASE } from '../constants/memory-map.mjs';

export const HEADER = 0x80ffc0,
  HEADER_END = 0x810000;
const FIELDS = [
  ['map_mode', 0xffd5, 1],
  ['cartridge_type', 0xffd6, 1],
  ['rom_size', 0xffd7, 1],
  ['ram_size', 0xffd8, 1],
  ['destination', 0xffd9, 1],
  ['maker', 0xffda, 1],
  ['version', 0xffdb, 1],
  ['complement', 0xffdc, 2],
  ['checksum', 0xffde, 2],
];
const VECTORS = [
  'unused_ffe0',
  'unused_ffe2',
  'cop',
  'brk',
  'abort',
  'nmi',
  'unused_ffec',
  'irq',
  'unused_fff0',
  'unused_fff2',
  'emulation_cop',
  'unused_fff6',
  'emulation_abort',
  'emulation_nmi',
  'reset',
  'emulation_irq',
];
const TITLE = 0xffc0,
  TITLE_LENGTH = 21,
  TITLE_PAD = 0x20,
  VECTOR_TABLE = 0xffe0;
const hex = (v, width) =>
  v
    .toString(HEX_RADIX)
    .toUpperCase()
    .padStart(2 * width, '0');

export function readHeader(read8) {
  const at = (a) => read8(CODE_BANK_BASE | a),
    word = (a) => at(a) | (at(a + 1) << BYTE_BITS);
  const title = String.fromCharCode(
    ...Array.from({ length: TITLE_LENGTH }, (_, k) => at(TITLE + k)),
  ).replace(/ +$/, '');
  const fields = Object.fromEntries(
    FIELDS.map(([name, a, width]) => [name, hex(width === 1 ? at(a) : word(a), width)]),
  );
  return {
    title,
    ...fields,
    vectors: Object.fromEntries(
      VECTORS.map((name, k) => [name, hex(word(VECTOR_TABLE + 2 * k), 2)]),
    ),
  };
}

export function placeHeader(rom, present, header) {
  const write = romWriter(rom, present, 'header_layout_changed'),
    put = (a, v) => write(CODE_BANK_BASE | a, v);
  const title = header?.title;
  if (typeof title !== 'string' || title.length > TITLE_LENGTH || /[^\x20-\x7E]/.test(title))
    throw new VmFault('header_value_required', HEADER);
  for (let k = 0; k < TITLE_LENGTH; k++)
    put(TITLE + k, k < title.length ? title.charCodeAt(k) : TITLE_PAD);
  const value = (v, width, a) => {
    if (!new RegExp(`^[0-9A-F]{${2 * width}}$`).test(v ?? ''))
      throw new VmFault('header_value_required', CODE_BANK_BASE | a);
    const n = parseInt(v, HEX_RADIX);
    for (let b = 0; b < width; b++) put(a + b, (n >> (BYTE_BITS * b)) & BYTE_MASK);
  };
  for (const [name, a, width] of FIELDS) value(header[name], width, a);
  if (Object.keys(header.vectors ?? {}).join() !== VECTORS.join())
    throw new VmFault('header_layout_changed', 0x80ffe0);
  VECTORS.forEach((name, k) => value(header.vectors[name], 2, VECTOR_TABLE + 2 * k));
}
