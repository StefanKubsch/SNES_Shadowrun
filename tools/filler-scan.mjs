// The scan for filler bytes (src/data/fillers.mjs, docs/ROM-FREE.md step 2): the script
// ends behind a final jump and the kind of a run of one byte value.
import { decodeScript } from './script-codec.mjs';
import { OPCODE } from './script-opcodes.mjs';
import { SCRIPT_END, FILL_FF } from '../src/data/fillers.mjs';
import { WORD_MASK } from '../src/constants/bits.mjs';

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
