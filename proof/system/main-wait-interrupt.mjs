// Register-level waits with explicit interrupt steps that only the dialog, start
// menu and main loop references call: the random-state wait 81:B0A1 and the input
// read 80:9E1A. The game waits and reads input through its lifted code.
import { CODE_BANK } from '../../src/constants/memory-map.mjs';
import {
  WAIT_CODE_BANK,
  drainWait,
  interruptStep,
  lagFree,
  waitEntry,
} from '../../src/system/main-wait-interrupt.mjs';

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
