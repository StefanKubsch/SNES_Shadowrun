// Register-level waits with explicit interrupt steps that only the dialog, start
// menu, main loop and word wait references call: the entry check, the random-state
// wait 81:B0A1, the input read 80:9E1A and the synchronous fade poll. The game
// waits and reads input through its lifted code.
import { CODE_BANK } from '../../src/constants/memory-map.mjs';
import {
  WAIT_CODE_BANK,
  FadePollContinuation,
  drainWait,
  interruptStep,
  lagFree,
} from '../../src/system/main-wait-interrupt.mjs';
import { drainNativeSequence } from '../../src/system/native-call-continuation.mjs';
import { taskStop } from '../../src/system/task-stop.mjs';
import { FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT } from '../../src/constants/cpu-flags.mjs';

// Native-mode WORD entry at direct page 0 in the given code bank.
export const waitEntry = (h, bank) => {
  const { ctx } = h;
  if (
    ctx.e !== 0 ||
    ctx.d !== 0 ||
    ctx.programBank !== bank ||
    ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('wait_interrupt_entry_required');
};

// Instruction steps are taken where every reached instruction is recorded
// (startupInterrupts) or where lag-free frames may deliver an NMI.
export const steppedInterrupts = (events) => !!events?.startupInterrupts || !!lagFree(events);

// $81:B0A1: saved long WORD baseline, fresh CMP, BEQ, actual RTL.
export function waitForRandomStateChangeWithInterrupts(h, events) {
  waitEntry(h, WAIT_CODE_BANK);
  return drainWait(h, 0x81b0a1, (pc) => interruptStep(h, events, pc));
}

// $80:9E1A: every read is fresh, including the two reads of 01CA used to
// compute the edge and the later copy. An NMI may occur between any two.
export function readInputWithInterrupts(h, events) {
  waitEntry(h, CODE_BANK);
  return drainWait(h, 0x809e1a, (pc) => interruptStep(h, events, pc));
}

// The fade poll 81:CF4C/CF4F of the cutscene, drained synchronously for the
// interrupt comparisons; the cutscene runs it as a FadePollContinuation.
export function runInterruptFadePoll(h, events) {
  return drainNativeSequence(new FadePollContinuation(h, events).sequence);
}
