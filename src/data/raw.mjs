// The last bytes in original form (docs/ROM-FREE.md, step 2). The code of
// banks 80 and 81 is absent from the package: the port runs its own
// routines and reads the ROM only for data. Two kinds of bytes stay:
// - code_bytes: code that a data reader touches. A word read at the end of a
//   data range also reads the first code byte behind it (the menu text
//   reader 81:D531 at a terminator, 81:D59E), so the first byte of code
//   behind every data range is kept, with every code byte the live runs
//   read (analysis/rom-reads.json). The read byte can be the high byte of a
//   terminator word or an explicitly copied byte, not just its low byte.
//   Transitions between two code classes do not need a data read margin.
// - unread: data with no known reader, kept as it is, each with a note why
//   it is not decoded.
// Native form assets/vm-raw.json: runs as address and hex bytes. A run must
// land on absent bytes (raw_layout_changed).
import { VmFault } from '../vm/memory.mjs';
import { requireRomAddress, romWriter } from './rom-bytes.mjs';
import { WORD_MASK, HEX_RADIX, BANK_SIZE } from '../constants/bits.mjs';

export const RAW_KINDS = ['code_bytes', 'unread'];
const parse = (text, at) => requireRomAddress(text, 'raw_value_required', at);

export function placeRaw(rom, present, raw) {
  const put = romWriter(rom, present, 'raw_layout_changed');
  for (const kind of RAW_KINDS) {
    if (!Array.isArray(raw?.[kind])) throw new VmFault('raw_layout_changed');
    for (const run of raw[kind]) {
      const address = parse(run.address);
      if (
        !/^([0-9A-F]{2})+$/.test(run.hex ?? '') ||
        (address & WORD_MASK) + run.hex.length / 2 > BANK_SIZE
      )
        throw new VmFault('raw_value_required', address);
      if (kind === 'unread' && !run.note) throw new VmFault('raw_value_required', address);
      for (let i = 0; i < run.hex.length / 2; i++) {
        put(address + i, parseInt(run.hex.slice(2 * i, 2 * i + 2), HEX_RADIX));
      }
    }
  }
}
