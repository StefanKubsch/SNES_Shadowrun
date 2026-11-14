// Scripts from their decoded form (assets/scripts.json, docs/SCRIPT-LANGUAGE.md)
// into the ROM address view (docs/ROM-FREE.md, step 2). Per script: header of
// local bytes and stack head (read by the task allocator), followed by the bytecode at
// its address. The seven tables (read sites in tools/scripts.mjs: $80:C2C8
// to $80:C2DB, $80:F4A9, $80:F4D6, $80:F500, $80:F51D) arise from the fields
// per script and native.
// layout: section scripts of the package manifest with the CPU addresses of the
// tables, of each script and of each native.
import { VmFault } from '../vm/memory.mjs';
import { romOffset } from './rom-bytes.mjs';
import { BYTE_MASK, BYTE_BITS, WORD_BITS } from '../constants/bits.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';

// Writes all script bytes to rom and marks them in present.
export function placeScripts(rom, present, layout, bundle) {
  const { tables, scriptAddresses, nativeAddresses } = layout,
    scripts = bundle.scripts,
    natives = bundle.nativeFunctions;
  if (scripts.length !== scriptAddresses.length || natives.length !== nativeAddresses.length)
    throw new VmFault('cartridge_scripts_required');
  const put = (cpu, value) => {
    const o = romOffset(cpu);
    rom[o] = value;
    present[o] = 1;
  };
  for (let id = 0; id < scripts.length; id++) {
    const s = scripts[id],
      cpu = scriptAddresses[id];
    if (s.id !== id) throw new VmFault('cartridge_scripts_required');
    put(cpu, s.localBytes);
    put(cpu + 1, s.stackHeaderBytes);
    for (let i = 0; i < s.bytecode.length; i++) put(cpu + 2 + i, s.bytecode[i]);
    put(tables.scriptBanks + id, cpu >>> WORD_BITS);
    put(tables.scriptPointers + 2 * id, cpu & BYTE_MASK);
    put(tables.scriptPointers + 2 * id + 1, (cpu >>> BYTE_BITS) & BYTE_MASK);
    put(tables.scriptReturnBytes + id, s.returnBytes);
    put(tables.scriptArgumentBytes + id, s.argumentBytes);
  }
  for (let id = 0; id < natives.length; id++) {
    const n = natives[id],
      cpu = nativeAddresses[id];
    // The native pointers are 16 bits; the dispatch $80:F52F jumps into bank $80.
    if (n.id !== id || cpu >>> WORD_BITS !== CODE_BANK)
      throw new VmFault('cartridge_scripts_required');
    put(tables.nativePointers + 2 * id, cpu & BYTE_MASK);
    put(tables.nativePointers + 2 * id + 1, (cpu >>> BYTE_BITS) & BYTE_MASK);
    put(tables.nativeReturnBytes + id, n.returnBytes);
    put(tables.nativeArgumentWords + id, n.argumentWords);
  }
}
