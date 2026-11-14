import { taskStop } from './plan.mjs';
import { taskTextAccess } from './native-text-prerequisites.mjs';
import { waitForRandomStateChange } from './native-frame-wait.mjs';
import { readInput } from './native-input-apu.mjs';
import { validateTaskActionsOptions } from './native-actions.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { ObservedWaitContinuation } from './main-wait-interrupt.mjs';
import {
  observedContinuation,
  drainNativeSequence,
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
} from './native-call-continuation.mjs';
import { PAD_HELD, PAD_PRESSED } from './wram.mjs';
import { FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { WORD_MASK, WORD_BITS, LONG_WRAP, BANK_WRAP } from '../constants/bits.mjs';
import { CODE_BANK, CODE_BANK_BASE } from '../constants/memory-map.mjs';

const JSR_RETURN_OFFSET = 2,
  JSL_RETURN_OFFSET = 3;
const JSR_BYTES = 3,
  JSL_BYTES = 4;
// F95D accepts B, Y, Select, A or X from the newly pressed word.
const INPUT_WAIT_BUTTONS = 0xe0c0;
export { validateTaskActionsOptions as validateTaskInputWaitOptions };
// 80:F953: wait for a confirming key (B, Y, Select, A or X).
export function waitForConfirmKey(a, options, outerReturn = true, allowRemaining = false) {
  return drainNativeSequence(waitForConfirmKeySequence(a, options, outerReturn, allowRemaining));
}
// The same caller segments over finite budgets: with an interrupt set the
// counter wait B0A1 and the input edge 9E1A pause inside their own frames.
export function* waitForConfirmKeySequence(a, options, outerReturn, allowRemaining) {
  if (a.ctx.d !== 0 || a.ctx.programBank !== CODE_BANK) taskStop('task_input_wait_entry_required');
  const h = taskTextAccess(a),
    { ctx } = h,
    calls = [],
    waitEvents = [];
  let waitIndex = 0,
    inputIndex = 0,
    iterations = 0;
  const interrupts =
    options.interruptEvents?.interrupts !== undefined ? options.interruptEvents : null;
  const call = function* (pc, target, long, body) {
    let bank;
    yield () => {
      bank = ctx.programBank;
      if (long) h.pushByte(bank, 'F953-JSL-bank');
      a.pushWord(
        (pc + (long ? JSL_RETURN_OFFSET : JSR_RETURN_OFFSET)) & WORD_MASK,
        'F953-inner-return',
      );
      ctx.programBank = target >>> WORD_BITS;
      ctx.pc = target & WORD_MASK;
    };
    const p = yield* body();
    yield () => {
      if (
        p.rawReturnWord !== ((pc + (long ? JSL_RETURN_OFFSET : JSR_RETURN_OFFSET)) & WORD_MASK) ||
        ctx.programBank !== bank ||
        ctx.pc !== ((pc + (long ? JSL_BYTES : JSR_BYTES)) & WORD_MASK)
      )
        taskStop('task_native_helper_return_required', {
          pc,
          raw: p.rawReturnWord,
          bank: ctx.programBank,
        });
      if (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT))
        taskStop('task_input_wait_return_mode_required');
      calls.push(
        Object.freeze({ pc, target, rawReturnWord: p.rawReturnWord, returnTarget: p.returnTarget }),
      );
    };
    return p;
  };
  const segment = function* (run) {
    let result;
    yield () => {
      result = run();
    };
    return result;
  };
  do {
    iterations++;
    const p = yield* call(0x80f953, 0x81b0a1, true, () =>
      interrupts
        ? observedWait(a, interrupts, 0x81b0a1)
        : segment(() =>
            waitForRandomStateChange(
              a,
              {
                ...options,
                waitObservations: Object.freeze((options.waitObservations ?? []).slice(waitIndex)),
              },
              false,
              true,
            ),
          ),
    );
    waitIndex += p.waitObservationsUsed ?? 0;
    waitEvents.push(...(p.waitEvents ?? []));
    yield* call(0x80f957, 0x809e1a, false, () =>
      interrupts
        ? observedWait(a, interrupts, 0x809e1a)
        : segment(() => {
            if (options.inputMode === 'record-observations') {
              const address = h.abs(PAD_HELD),
                o = options.inputObservations?.[inputIndex];
              if (!o || o.pc !== 0x809e1a || o.address !== address || o.width !== 2)
                taskStop('task_input_observation_required', {
                  pc: 0x809e1a,
                  address,
                  width: 2,
                  observationIndex: inputIndex,
                });
              inputIndex++;
              a.writeWord(address, o.value, LONG_WRAP, 'F953-observed-input-writer');
            }
            return readInput(a, false);
          }),
    );
    yield () => {
      h.load(h.read(h.abs(PAD_PRESSED)));
      h.load(ctx.a & INPUT_WAIT_BUTTONS);
    };
  } while (ctx.status & FLAG_ZERO);
  let result;
  yield () => {
    if (!allowRemaining && waitIndex !== (options.waitObservations?.length ?? 0))
      taskStop('task_wait_observation_unused', { observationIndex: waitIndex });
    if (!allowRemaining && inputIndex !== (options.inputObservations?.length ?? 0))
      taskStop('task_input_observation_unused', { observationIndex: inputIndex });
    const rawReturnWord = a.readWord(
      (ctx.s + 1) & WORD_MASK,
      BANK_WRAP,
      'F953-outer-RTS',
      outerReturn,
    );
    ctx.s = (ctx.s + 2) & WORD_MASK;
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    result = {
      rawReturnWord,
      returnTarget: CODE_BANK_BASE | ctx.pc,
      returnTargetExecuted: false,
      dynamicDispatchExecuted: false,
      frontier: 'observed-outer-RTS-target',
      iterations,
      calls: Object.freeze(calls),
      waitEvents: Object.freeze(waitEvents),
      waitObservationsUsed: waitIndex,
      inputObservationsUsed: inputIndex,
      fullTaskBinding: false,
      scope: 'manual-original-A3-counter-and-fresh-input-normal-graph-not-automatic-frames',
    };
  };
  return result;
}
function* observedWait(a, events, root) {
  return yield { continuation: new ObservedWaitContinuation(dialogAccess(a), events, root) };
}
// The scheduler's native bridge owns this continuation between work budgets.
export const createWaitForConfirmKey = (a, options) =>
  observedContinuation(a, {
    sequence: waitForConfirmKeySequence(a, options, false, false),
    finish: (result) => result,
  });
// Table adapter: the caller's shared observation indices advance after the real return.
function* waitForConfirmKeyAdapterSequence(h, e) {
  const slice = (values, index) =>
    values === null ? null : Object.freeze((values ?? []).slice(index));
  const p = yield* waitForConfirmKeySequence(
    h.a,
    {
      interruptEvents: e,
      waitMode: e.mode,
      waitObservations: slice(e.values, e.waitIndex),
      inputMode: e.inputMode,
      inputObservations: slice(e.inputs, e.inputIndex),
    },
    false,
    true,
  );
  yield () => {
    e.waitIndex += p.waitObservationsUsed;
    e.inputIndex += p.inputObservationsUsed;
    e.waitEvents.push(...p.waitEvents);
  };
  return p;
}
export const waitForConfirmKeyAdapter = (h, e) =>
  drainNativeSequence(waitForConfirmKeyAdapterSequence(h, e));
NATIVE_CALL_CONTINUATIONS.set(0x80f953, {
  run: waitForConfirmKeyAdapter,
  create: ({ h, events }) =>
    new NativeCallContinuation(h.a, waitForConfirmKeyAdapterSequence(h, events)),
});
