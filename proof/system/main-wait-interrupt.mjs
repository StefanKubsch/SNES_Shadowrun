// Register-level waits with explicit interrupt steps that only the dialog, start
// menu, main loop and word wait references call: the entry check, the random-state
// wait 81:B0A1, the input read 80:9E1A, the frame wait 81:EEBB, observed wait
// graphs and the cutscene fade poll. The game waits and reads input through its
// lifted code.
import { CODE_BANK } from '../../src/constants/memory-map.mjs';
import {
  InterruptStepContinuation,
  lagFree,
  takeInterruptStep,
  checkInterruptReturn,
} from '../../src/system/main-wait-interrupt.mjs';
import {
  NativeCallContinuation,
  drainNativeSequence,
} from '../../src/system/native-call-continuation.mjs';
import { NativeWaitContinuation } from './native-wait-continuation.mjs';
import { taskStop } from '../../src/system/task-stop.mjs';
import { SCENE_BRIGHTNESS } from '../../src/data/wram.mjs';
import { WORD_MASK } from '../../src/constants/bits.mjs';
import { FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';

// Original wait bank of these routines.
export const WAIT_CODE_BANK = 0x81;

// A wait owns its register snapshot while its interrupt owns the live context.
// The original instruction executes only after the complete NMI/RTI returns.
export class ObservedWaitContinuation extends NativeCallContinuation {
  constructor(h, events, root) {
    super(h.a, observedWaitSequence(h, events, root));
  }
}
function* observedWaitSequence(h, events, root) {
  const wait = new NativeWaitContinuation(h.a, root);
  while (!wait.done) {
    yield { continuation: new InterruptStepContinuation(h, events, wait.pc) };
    yield () => wait.run(1);
  }
  return wait.result;
}
// Runs the original wait graph from root with a step hook before each instruction.
export function drainWait(h, root, beforeInstruction) {
  h.ctx.pc = root & WORD_MASK;
  const wait = new NativeWaitContinuation(h.a, root);
  wait.run(Infinity, { beforeInstruction });
  return wait.result;
}

// $81:EEBB: PHP/SEP20, then either a BYTE hardware poll or a saved BYTE
// counter comparison. Preserve the high accumulator byte and the caller's P.
export function waitForFrameWithInterrupts(h, events) {
  const { ctx } = h;
  if (ctx.e !== 0 || ctx.d !== 0 || ctx.programBank !== WAIT_CODE_BANK)
    taskStop('wait_interrupt_entry_required');
  return drainWait(h, 0x81eebb, (pc) => interruptStep(h, events, pc)).rawReturnWord;
}

// Inline $81:CF4C/CF4F in CDF8. An interrupt after LDA restores its BYTE
// flags, so BNE still uses that LDA even if D479 changed 11A3 in the meantime.
// Fall through to CF51 with the original caller frame and high A intact.
export class FadePollContinuation extends NativeCallContinuation {
  constructor(h, events) {
    super(h.a, interruptFadeSequence(h, events));
  }
}
function* interruptFadeSequence(h, events) {
  const { ctx } = h;
  if (
    ctx.e !== 0 ||
    ctx.d !== 0 ||
    ctx.programBank !== WAIT_CODE_BANK ||
    !(ctx.status & FLAG_MEMORY_8BIT)
  )
    taskStop('wait_interrupt_entry_required');
  let again;
  do {
    yield { continuation: new InterruptStepContinuation(h, events, 0x81cf4c) };
    yield () => h.load(h.read(h.abs(SCENE_BRIGHTNESS), 1));
    yield { continuation: new InterruptStepContinuation(h, events, 0x81cf4f) };
    yield () => {
      again = !(ctx.status & FLAG_ZERO);
    };
  } while (again);
}

import { runObservedNmi } from '../../src/system/nmi-call.mjs';

// The synchronous interrupt step of the register-level waits: an explicit record for
// every reached instruction in these wait/input routines.
// nmi:false is an observed absence, not elapsed time. Device reads use the
// accessor's existing chronological IO stream. No counter/input values are injected.
// A LagFreeFrames source instead delivers an NMI only at a blocking loop branch.
export function interruptStep(h, events, pc) {
  const o = takeInterruptStep(h, events, pc);
  if (o.nmi) {
    const before = { ...h.ctx },
      frames = lagFree(events);
    frames?.enterNmi();
    runObservedNmi(h.a, events, events.interruptRoutines);
    frames?.leaveNmi();
    checkInterruptReturn(h.ctx, before, pc);
  }
}

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
