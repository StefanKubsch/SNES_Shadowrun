import { taskStop } from './task-stop.mjs';
import { BYTE_BITS, BANK_WRAP, BYTE_MASK, WORD_MASK } from '../constants/bits.mjs';
import { CODE_BANK_BASE } from '../constants/memory-map.mjs';
// The script natives' arguments, result and outer return for lifted callees (game state
// only, user decision 2026-11-17). The register accessor of the register-level leaf
// references (leafAccess, leaf) lives in proof/system/native-leaf-support.mjs.
// No ROM instructions are decoded or dispatched by this module.

// Script arguments arrive as consecutive words at the start of the direct page
// (workspace filled by runTaskScriptArguments in script-arguments.mjs).
export const FIRST_ARGUMENT = 0;
export const SECOND_ARGUMENT = 2;
export const THIRD_ARGUMENT = 4;
export const FOURTH_ARGUMENT = 6;

// For lifted script natives (game state only): a script argument word from the direct
// page at 0, and the result word in place of the first argument.
export function leafArgument(a, offset) {
  if (a.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  const { wram } = a.mem;
  return wram[offset] | (wram[offset + 1] << BYTE_BITS);
}
export function setLeafResult(a, value) {
  setLeafWord(a, FIRST_ARGUMENT, value);
}
// An argument word of the direct page at 0 replaced (as some natives leave one).
export function setLeafWord(a, offset, value) {
  const { wram } = a.mem;
  wram[offset] = value & BYTE_MASK;
  wram[offset + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
}
export function finishLeaf(a, outerReturn = true) {
  const rawReturnWord = a.readWord(
    (a.ctx.s + 1) & WORD_MASK,
    BANK_WRAP,
    'leaf-outer-RTS',
    outerReturn,
  );
  a.ctx.s = (a.ctx.s + 2) & WORD_MASK;
  a.ctx.pc = (rawReturnWord + 1) & WORD_MASK;
  return {
    rawReturnWord,
    returnTarget: CODE_BANK_BASE | a.ctx.pc,
    frontier: 'observed-outer-RTS-target',
    scope: 'manual-source-specific-native-leaf-return-target-not-executed',
    dynamicDispatchExecuted: false,
    returnTargetExecuted: false,
  };
}
