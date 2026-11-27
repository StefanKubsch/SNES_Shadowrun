// Filler bytes (docs/ROM-FREE.md, step 2): unknown runs of one repeated byte
// value with a structural reason and no reader. Three kinds:
// - script_end: one byte 56 (script opcode end) right behind a script whose
//   last decoded instruction is the unconditional jump 48 (table scripts and
//   unreferenced scripts, src/data/orphan-scripts.mjs). The interpreter
//   never reaches it; it stays part of the original layout.
// - bank_end: FF up to the last byte of a bank.
// - zero_run / ff_run: any other run of only 00 or only FF between data.
// Other single bytes and mixed runs stay unknown. Native form
// assets/vm-fillers.json: address, length, value and kind per run. The scan that
// finds them is tools/filler-scan.mjs.
import { VmFault } from '../vm/memory.mjs';
import { romAddress, romWriter } from './rom-bytes.mjs';
import { WORD_MASK, BANK_SIZE } from '../constants/bits.mjs';

export const FILLER_KINDS = ['script_end', 'bank_end', 'zero_run', 'ff_run'];
// The script opcode end; FF fills.
export const SCRIPT_END = 0x56,
  FILL_FF = 0xff;

export function placeFillers(rom, present, { fillers }) {
  const put = romWriter(rom, present, 'filler_layout_changed');
  if (!Array.isArray(fillers)) throw new VmFault('filler_layout_changed');
  for (const { address, length, value, kind } of fillers) {
    const cpu = romAddress(address) ?? 0;
    if (
      !cpu ||
      !Number.isInteger(length) ||
      length < 1 ||
      (cpu & WORD_MASK) + length > BANK_SIZE ||
      !FILLER_KINDS.includes(kind) ||
      value !== (kind === 'script_end' ? SCRIPT_END : kind === 'zero_run' ? 0 : FILL_FF) ||
      (kind === 'script_end' && length !== 1) ||
      (kind === 'bank_end' && ((cpu + length) & WORD_MASK) !== 0)
    )
      throw new VmFault('filler_value_required', cpu);
    for (let i = 0; i < length; i++) put(cpu + i, value);
  }
}
