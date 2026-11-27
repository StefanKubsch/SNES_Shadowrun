import { readStateByte, writeStateByte } from '../state/objects.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';
// The script natives' arguments and result for lifted callees (game state only, user
// decision 2026-11-17). Register-level test callers add the native's RTS with leafRts
// (tools/register-forms/leaf-return.mjs).
// No ROM instructions are decoded or dispatched by this module.

// Script arguments arrive as consecutive words at the start of the direct page
// (workspace filled by runTaskScriptArguments in script-arguments.mjs).
export const FIRST_ARGUMENT = 0;
export const SECOND_ARGUMENT = 2;
export const THIRD_ARGUMENT = 4;
export const FOURTH_ARGUMENT = 6;

// For lifted script natives (game state only): a script argument word from the WRAM
// words at 0 (the original's direct page; the dispatcher in src/script/natives.mjs
// enters every native with D = 0, so no register is checked here), and the result word
// in place of the first argument.
export function leafArgument(a, offset) {
  const { wram } = a.mem;
  return readStateByte(wram, offset) | (readStateByte(wram, offset + 1) << BYTE_BITS);
}
export function setLeafResult(a, value) {
  setLeafWord(a, FIRST_ARGUMENT, value);
}
// An argument word of the direct page at 0 replaced (as some natives leave one).
export function setLeafWord(a, offset, value) {
  const { wram } = a.mem;
  writeStateByte(wram, offset, value & BYTE_MASK);
  writeStateByte(wram, offset + 1, (value >>> BYTE_BITS) & BYTE_MASK);
}
// The end of a native: script calls return their result through the shared argument
// word; there is no CPU context or return word to consume.
export function finishLeaf(a) {
  return leafArgument(a, FIRST_ARGUMENT);
}
