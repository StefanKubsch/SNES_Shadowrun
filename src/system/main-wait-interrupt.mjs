import { SCENE_BRIGHTNESS } from '../data/wram.mjs';
import { taskStop } from './task-stop.mjs';
import { runObservedNmi, ObservedNmiContinuation } from './nmi-call.mjs';
import { NativeCallContinuation, drainNativeSequence } from './native-call-continuation.mjs';
import { finishTextDmaObservations } from './main-dma-readback.mjs';
import { NativeWaitContinuation } from './native-wait-continuation.mjs';
import { LagFreeFrames } from '../vm/frame-events.mjs';
import { FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

export const WAIT_CODE_BANK = 0x81;

// An explicit record for every reached instruction in these wait/input routines.
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
const NMI = Object.freeze({ nmi: true }),
  NO_NMI = Object.freeze({ nmi: false });
export const lagFree = (events) =>
  events?.interrupts instanceof LagFreeFrames ? events.interrupts : null;
function takeInterruptStep(h, events, pc) {
  const frames = lagFree(events);
  if (frames) {
    const { ctx } = h;
    ctx.programBank = pc >>> WORD_BITS;
    ctx.pc = pc & WORD_MASK;
    // Instant text (src/game/instant-text.mjs): a serviced text wait needs no NMI.
    if (frames.textWait?.(h, events, ctx.status, pc)) return NO_NMI;
    const samples = frames.audioSamples;
    // Audio time at a sound driver wait without NMI is host progress as well.
    if (!frames.nmiAt(ctx.status, pc)) {
      if (frames.audioSamples !== samples) h.a.resetAccessBudget?.(h.a.entry);
      return NO_NMI;
    }
    // A live frame is host progress: a Native waiting for input over many
    // frames is no runaway loop. The guard applies again within each frame.
    h.a.resetAccessBudget?.(h.a.entry);
    return NMI;
  }
  const index = events?.interruptIndex ?? 0,
    o = events?.interrupts?.[index];
  if (
    !Array.isArray(events?.interrupts) ||
    !Object.isFrozen(events.interrupts) ||
    !o ||
    !Object.isFrozen(o) ||
    o.pc !== pc ||
    typeof o.nmi !== 'boolean'
  )
    taskStop('wait_interrupt_observation_required', { pc, observationIndex: index });
  const { ctx } = h;
  ctx.programBank = pc >>> WORD_BITS;
  ctx.pc = pc & WORD_MASK;
  events.interruptIndex = index + 1;
  return o;
}
function checkInterruptReturn(ctx, before, pc) {
  // Stack aliases can change the real RTI result. Keep those effects but never
  // continue these fixed equations from a different instruction/register state.
  for (const key of Object.keys(before))
    if (ctx[key] !== before[key])
      taskStop('wait_interrupt_return_required', {
        pc,
        key,
        expected: before[key],
        actual: ctx[key],
      });
}

const observedCall = (h, e, r) => runObservedNmi(h.a, e, r);
const interruptContinuations = new Map([
  [
    0x00c112,
    {
      run: observedCall,
      create: ({ h, events, routines }) => new ObservedNmiContinuation(h.a, events, routines),
    },
  ],
]);

// Consume one explicit boundary record once. While its NMI is paused the
// interrupted wait must not execute or consume a second record for that PC.
export class InterruptStepContinuation extends NativeCallContinuation {
  constructor(h, events, pc) {
    super(h.a, interruptSequence(h, events, pc), interruptContinuations);
  }
}
function* interruptSequence(h, events, pc) {
  let o, before;
  const frames = lagFree(events);
  yield () => {
    o = takeInterruptStep(h, events, pc);
    if (o.nmi) {
      before = { ...h.ctx };
      frames?.enterNmi();
    }
  };
  if (o.nmi) {
    yield { target: 0x00c112, run: observedCall, h, events, routines: events.interruptRoutines };
    yield () => {
      frames?.leaveNmi();
      checkInterruptReturn(h.ctx, before, pc);
    };
  }
}

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
export function finishInterruptObservations(events) {
  if (!lagFree(events) && events.interruptIndex !== events.interrupts.length)
    taskStop('wait_interrupt_observation_unused', { observationIndex: events.interruptIndex });
  finishTextDmaObservations(events);
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
export function runInterruptFadePoll(h, events) {
  return drainNativeSequence(interruptFadeSequence(h, events));
}
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
