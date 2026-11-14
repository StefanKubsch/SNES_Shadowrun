// Palettes (docs/ROM-FREE.md, step 2), ranges in analysis/rom-palettes.json:
// the tables from which $80:999A (8C:F624 + 32 n) and $81:A919 (8D:F1BA + 16 n)
// send 30 bytes each by DMA to CGRAM ($2122) (src/task/main-game-nmi.mjs), from
// the first block on. The first table ends before the first word with bit 15
// (8C:FF62), the second at 8D:FB78, where the OBJ data sent to VRAM by 80:C06B
// begins (analysis/rom-vram.json). Plus the other DMA sources from ROM seen in
// all live tests. A colour is a BGR555 word (Book I, CGRAM data): bits 0-4 red,
// 5-9 green, 10-14 blue. Native form assets/vm-palettes.json: address and
// colours as four-digit hex words per range, lossless.
import { VmFault } from '../vm/memory.mjs';
import { romWriter } from './rom-bytes.mjs';
import { BYTE_MASK, BYTE_BITS, HEX_RADIX, WORD_HEX_DIGITS } from '../constants/bits.mjs';
import { COLOUR_MASK } from '../constants/ppu.mjs';

export function readPalettes(read8, ranges) {
  return ranges.map(([cpu, length]) => {
    if (length & 1) throw new VmFault('palette_length_required', cpu);
    const colors = [];
    for (let i = 0; i < length; i += 2)
      colors.push(
        (read8(cpu + i) | (read8(cpu + i + 1) << BYTE_BITS))
          .toString(HEX_RADIX)
          .toUpperCase()
          .padStart(WORD_HEX_DIGITS, '0'),
      );
    return { cpu, colors };
  });
}

export function placePalettes(rom, present, { palettes }) {
  const put = romWriter(rom, present, 'palette_layout_changed');
  for (const { address, colors } of palettes) {
    const cpu = parseInt(address.replace(':', ''), HEX_RADIX);
    colors.forEach((hex, i) => {
      const value = parseInt(hex, HEX_RADIX);
      if (!/^[0-9A-F]{4}$/.test(hex) || value > COLOUR_MASK)
        throw new VmFault('palette_color_required', cpu + 2 * i);
      for (const [n, byte] of [
        [0, value & BYTE_MASK],
        [1, value >> BYTE_BITS],
      ]) {
        put(cpu + 2 * i + n, byte);
      }
    });
  }
}
