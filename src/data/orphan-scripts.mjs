// Unreferenced scripts (docs/ROM-FREE.md, step 2): event bytecode in the
// script banks that no entry of the script tables (tools/scripts.mjs) names
// and no call_script reaches, because call_script takes a table ID. Two forms:
// - headed: two header bytes (locals, stack header) and a script whose
//   control flow is fully covered and ends with end or the jump 48. Nothing
//   in the ROM holds their addresses as a table entry; they look like
//   scripts that were removed from the tables.
// - tail: bytes right behind the final end of a table script, decoded in
//   that script's frame (jump targets are relative to its bytecode start).
//   9C:E720 behind script 33D uses its locals 3 to 6, and its loop jump
//   lands on an instruction only in that frame.
// No reader is claimed; the bytes stay in the original layout. Native form
// assets/vm-orphan-scripts.json: header and bytecode per script, the owning
// script, entry PC and bytecode per tail. The game places the bytes as they are; the
// scan and the bytecode checks are tools/orphan-script-scan.mjs.
import { VmFault } from '../vm/memory.mjs';
import { romAddress, romWriter } from './rom-bytes.mjs';
import { WORD_MASK, BANK_SIZE, BYTE_VALUES } from '../constants/bits.mjs';

// scriptLayout: section scripts of the package manifest; bundle: scripts.json.
export function placeOrphanScripts(rom, present, { scripts, tails }, scriptLayout, bundle) {
  if (!Array.isArray(scripts) || !Array.isArray(tails)) throw new VmFault('orphan_layout_changed');
  const cpuOf = (address) => romAddress(address) ?? 0;
  const put = romWriter(rom, present, 'orphan_layout_changed');
  for (const { address, localBytes, stackHeaderBytes, bytecode } of scripts) {
    const cpu = cpuOf(address),
      code = Uint8Array.from(bytecode ?? []);
    try {
      if (
        !cpu ||
        (cpu & WORD_MASK) + 2 + code.length > BANK_SIZE ||
        !(
          localBytes >= 0 &&
          localBytes < BYTE_VALUES &&
          stackHeaderBytes >= 0 &&
          stackHeaderBytes < BYTE_VALUES
        )
      )
        throw 0;
    } catch {
      throw new VmFault('orphan_script_required', cpu);
    }
    put(cpu, localBytes);
    put(cpu + 1, stackHeaderBytes);
    code.forEach((v, i) => put(cpu + 2 + i, v));
  }
  for (const { address, script, entry, bytecode } of tails) {
    const cpu = cpuOf(address),
      code = Uint8Array.from(bytecode ?? []),
      owner = bundle.scripts[script];
    try {
      if (
        !cpu ||
        !owner ||
        owner.bytecode.length !== entry ||
        scriptLayout.scriptAddresses[script] + 2 + entry !== cpu ||
        (cpu & WORD_MASK) + code.length > BANK_SIZE
      )
        throw 0;
    } catch {
      throw new VmFault('orphan_script_required', cpu);
    }
    code.forEach((v, i) => put(cpu + i, v));
  }
}
