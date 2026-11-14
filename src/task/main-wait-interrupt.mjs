import {
  SCENE_BRIGHTNESS,
  TEXT_MAP_UPLOAD,
  TEXT_TILE_UPLOAD,
  TEXT_BUFFER_UPLOAD,
  TEXT_BUFFER_READBACK,
} from './wram.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';
import { taskStop } from './plan.mjs';
import { runObservedNmi, ObservedNmiContinuation } from './observed-nmi.mjs';
import { NativeCallContinuation, drainNativeSequence } from './native-call-continuation.mjs';
import { finishTextDmaObservations } from './main-dma-readback.mjs';
import { NativeWaitContinuation } from './native-wait-continuation.mjs';
import { LagFreeFrames } from '../vm/frame-events.mjs';
import { FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { WORD_BITS, WORD_MASK, BANK_SIZE } from '../constants/bits.mjs';

const WAIT_CODE_BANK = 0x81;
// LDA abs / BNE / RTL, or INC abs / JSL wait / RTL.
const ABSOLUTE_INSTRUCTION_BYTES = 3,
  WORD_WAIT_RETURN_OFFSET = 5;
const REQUEST_WAIT_RETURN_WORD_OFFSET = 6,
  REQUEST_WAIT_RESUME_OFFSET = 7;

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
// Instruction steps are taken where every reached instruction is recorded
// (startupInterrupts) or where lag-free frames may deliver an NMI.
export const steppedInterrupts = (events) => !!events?.startupInterrupts || !!lagFree(events);
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
const entry = (h, bank) => {
  const { ctx } = h;
  if (
    ctx.e !== 0 ||
    ctx.d !== 0 ||
    ctx.programBank !== bank ||
    ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('wait_interrupt_entry_required');
};

// $81:B0A1: saved long WORD baseline, fresh CMP, BEQ, actual RTL.
export function waitForRandomStateChangeWithInterrupts(h, events) {
  entry(h, WAIT_CODE_BANK);
  return drainWait(h, 0x81b0a1, (pc) => interruptStep(h, events, pc));
}

function drainWait(h, root, beforeInstruction) {
  h.ctx.pc = root & WORD_MASK;
  const wait = new NativeWaitContinuation(h.a, root);
  wait.run(Infinity, { beforeInstruction });
  return wait.result;
}

// $80:9E1A: every read is fresh, including the two reads of 01CA used to
// compute the edge and the later copy. An NMI may occur between any two.
export function readInputWithInterrupts(h, events) {
  entry(h, CODE_BANK);
  return drainWait(h, 0x809e1a, (pc) => interruptStep(h, events, pc));
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

const wordWaits = new Map([
  [0x81acaf, TEXT_MAP_UPLOAD],
  [0x81acbd, TEXT_TILE_UPLOAD],
  [0x81acc3, TEXT_BUFFER_UPLOAD],
  [0x81acc9, TEXT_BUFFER_READBACK],
]);
const wordRequests = new Map([
  [0x81acb5, 0x81acaf],
  [0x81aef4, 0x81acc3],
  [0x81aefc, 0x81acc9],
]);
// The original LDA/BNE/RTL graph. No external writer is injected. A zero
// already in memory can return without an NMI; unchanged polls require records.
export function runInterruptWordWait(h, events, pc) {
  return drainNativeSequence(wordWaitSequence(h, events, pc));
}
export class WordWaitContinuation extends NativeCallContinuation {
  constructor(h, events, pc) {
    super(h.a, wordWaitSequence(h, events, pc));
  }
}
function* wordWaitSequence(h, events, pc) {
  entry(h, WAIT_CODE_BANK);
  const offset = wordWaits.get(pc);
  if (offset === undefined) taskStop('wait_interrupt_word_entry_required', { pc });
  let polls = 0,
    again;
  do {
    yield { continuation: new InterruptStepContinuation(h, events, pc) };
    yield () => {
      h.load(h.read(h.abs(offset)));
      polls++;
    };
    yield {
      continuation: new InterruptStepContinuation(h, events, pc + ABSOLUTE_INSTRUCTION_BYTES),
    };
    yield () => {
      again = !(h.ctx.status & FLAG_ZERO);
    };
  } while (again);
  yield { continuation: new InterruptStepContinuation(h, events, pc + WORD_WAIT_RETURN_OFFSET) };
  let rawReturnWord;
  yield () => {
    rawReturnWord = h.rtl();
  };
  return {
    rawReturnWord,
    returnBank: h.ctx.programBank,
    returnTarget: h.ctx.programBank * BANK_SIZE + h.ctx.pc,
    outcome: 'wait_complete',
    polls,
    waitObservationsUsed: 0,
    nmiWords: 0,
  };
}
export function runInterruptRequestWait(h, events, pc) {
  return drainNativeSequence(requestWaitSequence(h, events, pc));
}
export class RequestWaitContinuation extends NativeCallContinuation {
  constructor(h, events, pc) {
    super(h.a, requestWaitSequence(h, events, pc));
  }
}
function* requestWaitSequence(h, events, pc) {
  entry(h, WAIT_CODE_BANK);
  const target = wordRequests.get(pc);
  if (target === undefined) taskStop('wait_interrupt_word_entry_required', { pc });
  let requestCounter, rawReturnWord;
  yield { continuation: new InterruptStepContinuation(h, events, pc) };
  yield () => {
    requestCounter = h.modify(h.abs(wordWaits.get(target)), 'inc');
  };
  yield { continuation: new InterruptStepContinuation(h, events, pc + ABSOLUTE_INSTRUCTION_BYTES) };
  yield () => {
    h.pushByte(h.ctx.programBank);
    h.a.pushWord((pc + REQUEST_WAIT_RETURN_WORD_OFFSET) & WORD_MASK);
    h.ctx.pc = target & WORD_MASK;
  };
  const result = yield { continuation: new WordWaitContinuation(h, events, target) };
  yield () => {
    if (
      result.rawReturnWord !== ((pc + REQUEST_WAIT_RETURN_WORD_OFFSET) & WORD_MASK) ||
      h.ctx.programBank !== WAIT_CODE_BANK ||
      h.ctx.pc !== ((pc + REQUEST_WAIT_RESUME_OFFSET) & WORD_MASK)
    )
      taskStop('task_native_helper_return_required', {
        pc: pc + ABSOLUTE_INSTRUCTION_BYTES,
        target,
        bank: h.ctx.programBank,
        returnPc: h.ctx.pc,
      });
  };
  yield { continuation: new InterruptStepContinuation(h, events, pc + REQUEST_WAIT_RESUME_OFFSET) };
  yield () => {
    rawReturnWord = h.rtl();
  };
  return {
    ...result,
    rawReturnWord,
    returnBank: h.ctx.programBank,
    returnTarget: h.ctx.programBank * BANK_SIZE + h.ctx.pc,
    outcome: 'request_wait_prepared',
    requestCounter,
  };
}
