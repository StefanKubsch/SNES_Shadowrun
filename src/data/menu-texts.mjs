// Menu texts of bank 81 (docs/ROM-FREE.md, step 2). $81:D531 writes the text
// at DBR:Y to the tilemap 7E:86A9 + X until a 00: character c becomes the word
// at 7E:46A8 + 2 (c - 20), ORed with 2400 and XORed with DP 18
// (src/task/main-frontend-text.mjs). Its callers load Y with a fixed address
// (LDY #) in bank 81, DBR = 81 (PHK/PLB): 81:D571 (copyright line), E399/E3A3/
// E3AD (main menu), E405/E414/E420 (saved games), E45E to E49C (options, two
// texts per setting). The texts lie in four runs between code: 81:D582 to
// 81:D59E, 81:E3B2 to 81:E3DA, 81:E425 to 81:E446, 81:E4A1 to 81:E50C.
// D531 reads a word at the terminator and so the first code byte after a run
// (81:D59E, kept as code_kept).
// Native form assets/vm-menu-texts.json: per text its address and the ASCII
// text. A text keeps its address because the LDY operands in the code point
// to it; a text of another length is refused (menu_text_layout_changed).
import { VmFault } from '../vm/memory.mjs';
import { romOffset } from './rom-bytes.mjs';
import { WORD_MASK, HEX_RADIX, WORD_BITS, WORD_HEX_DIGITS } from '../constants/bits.mjs';

export const MENU_TEXT_RUNS = [
  [0x81d582, 0x81d59e],
  [0x81e3b2, 0x81e3da],
  [0x81e425, 0x81e446],
  [0x81e4a1, 0x81e50c],
];
const label = (cpu) =>
  `${(cpu >>> WORD_BITS).toString(HEX_RADIX).toUpperCase()}:${(cpu & WORD_MASK).toString(HEX_RADIX).toUpperCase().padStart(WORD_HEX_DIGITS, '0')}`;
const printable = (text) => typeof text === 'string' && /^[\x20-\x7E]+$/.test(text);

export function readMenuTexts(read8) {
  const texts = [];
  for (const [start, end] of MENU_TEXT_RUNS) {
    for (let p = start; p < end;) {
      let q = p;
      while (q < end && read8(q)) q++;
      const text = String.fromCharCode(...Array.from({ length: q - p }, (_, i) => read8(p + i)));
      if (q >= end || !printable(text)) throw new VmFault('menu_text_layout_required', p);
      texts.push({ address: label(p), text });
      p = q + 1;
    }
  }
  return texts;
}

export function placeMenuTexts(rom, present, { texts }) {
  let n = 0;
  for (const [start, end] of MENU_TEXT_RUNS) {
    for (let p = start; p < end; n++) {
      const t = texts?.[n];
      if (!t || t.address !== label(p)) throw new VmFault('menu_text_layout_changed', p);
      if (!printable(t.text)) throw new VmFault('menu_text_required', p);
      for (const value of [...t.text].map((c) => c.charCodeAt(0)).concat(0)) {
        const o = romOffset(p);
        if (p >= end || present[o]) throw new VmFault('menu_text_layout_changed', p);
        rom[o] = value;
        present[o] = 1;
        p++;
      }
    }
  }
  if (n !== texts.length) throw new VmFault('menu_text_layout_changed');
}
