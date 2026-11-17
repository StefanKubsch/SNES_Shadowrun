import { taskStop } from './task-stop.mjs';
import { runObservedNmi, ObservedNmiContinuation } from './nmi-call.mjs';
import { NativeCallContinuation } from './native-call-continuation.mjs';
import { finishTextDmaObservations } from './main-dma-readback.mjs';
import { LagFreeFrames } from '../vm/frame-events.mjs';
import { WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

const NMI = Object.freeze({ nmi: true }),
  NO_NMI = Object.freeze({ nmi: false });
export const lagFree = (events) =>
  events?.interrupts instanceof LagFreeFrames ? events.interrupts : null;
// One interrupt step at pc: an explicit record for every reached instruction (nmi:false
// is an observed absence, not elapsed time), or a LagFreeFrames source that delivers
// an NMI only at a blocking loop branch.
export function takeInterruptStep(h, events, pc) {
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
export function checkInterruptReturn(ctx, before, pc) {
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

export function finishInterruptObservations(events) {
  if (!lagFree(events) && events.interruptIndex !== events.interrupts.length)
    taskStop('wait_interrupt_observation_unused', { observationIndex: events.interruptIndex });
  finishTextDmaObservations(events);
}
