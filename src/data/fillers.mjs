// Filler bytes (docs/ROM-FREE.md, step 2): unknown runs of one repeated byte
// value with a structural reason and no reader. Three kinds:
// - script_end: one byte 56 (script opcode end) right behind a script whose
//   last decoded instruction is the unconditional jump 48 (table scripts and
//   unreferenced scripts, src/data/orphan-scripts.mjs). The interpreter
//   never reaches it; it stays part of the original layout.
// - bank_end: FF up to the last byte of a bank.
// - zero_run / ff_run: any other run of only 00 or only FF between data.
// Other single bytes and mixed runs stay unknown. Native form
// assets/vm-fillers.json: address, length, value and kind per run.
import { VmFault } from '../vm/memory.mjs';
import { decodeScript } from '../script/codec.mjs';
import { OPCODE } from '../script/opcodes.mjs';
import { romAddress, romWriter } from './rom-bytes.mjs';
import { WORD_MASK, BANK_SIZE } from '../constants/bits.mjs';

const FILLER_KINDS = ['script_end', 'bank_end', 'zero_run', 'ff_run'];
const SCRIPT_END = OPCODE.END,
  FILL_FF = 0xff;

// CPU addresses right behind every script whose last decoded instruction is
// the jump 48; scripts: [{address, bytecode}] with the header at address.
export function scriptJumpEnds(scripts) {
  const ends = new Set();
  for (const { address, bytecode } of scripts) {
    const last = decodeScript(Uint8Array.from(bytecode)).instructions.reduce((a, b) =>
      b.pc > a.pc ? b : a,
    );
    if (last.opcode === OPCODE.JUMP && last.nextPc === bytecode.length)
      ends.add(address + 2 + bytecode.length);
  }
  return ends;
}

// scriptEnds: the result of scriptJumpEnds.
export function fillerKind(read8, start, length, scriptEnds) {
  const value = read8(start);
  for (let i = 1; i < length; i++) if (read8(start + i) !== value) return null;
  if (length === 1 && value === SCRIPT_END && scriptEnds.has(start)) return 'script_end';
  if (value === FILL_FF && ((start + length) & WORD_MASK) === 0) return 'bank_end';
  if (value === 0x00) return 'zero_run';
  if (value === FILL_FF) return 'ff_run';
  return null;
}

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
