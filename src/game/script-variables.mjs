// The script variables (lifted from the script natives 80:CC07, 80:CC10, 80:CC19 and
// 80:CC26; register-level references in proof/game-reference/script-variables.mjs).
//
// The scripts keep their words at 7E:3BBB, two bytes each, addressed by a byte offset
// (an offset near FFFF reaches bank 7F, as the original's long index does).
import { SCRIPT_VARIABLES, WRAM } from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK } from '../constants/bits.mjs';

const address = (offset) => (WRAM + SCRIPT_VARIABLES + offset) & LONG_MASK;

// 80:CC07: the script variable at the byte offset.
export function scriptVariable(mem, offset) {
  const at = address(offset);
  return mem.read8(at) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
}
// 80:CC10: the script variable at the byte offset set to value.
export function storeScriptVariable(mem, offset, value) {
  const at = address(offset);
  mem.write8(at, value & BYTE_MASK);
  mem.write8((at + 1) & LONG_MASK, (value >>> BYTE_BITS) & BYTE_MASK);
}
// 80:CC19: bits set in the script variable at the byte offset.
export const setVariableBits = (mem, offset, bits) =>
  storeScriptVariable(mem, offset, scriptVariable(mem, offset) | bits);
// 80:CC26: only these bits kept in the script variable at the byte offset.
export const keepVariableBits = (mem, offset, bits) =>
  storeScriptVariable(mem, offset, scriptVariable(mem, offset) & bits);
