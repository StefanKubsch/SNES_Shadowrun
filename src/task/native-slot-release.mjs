import { withInterruptEvents } from './observed-native-events.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { taskStop } from './plan.mjs';
import { FIRST_ARGUMENT, leafAccess, finishLeaf } from './native-leaf-support.mjs';
import { runReleaseWindowCall } from '../game/window-release.mjs';
import { af1fRegisters } from './native-bar-tiles.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import {
  observedContinuation,
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  nativeCallSequence,
} from './native-call-continuation.mjs';
import { BANK_WRAP, WORD_MASK, LONG_MASK } from '../constants/bits.mjs';
import { FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';
import { WRAM, NOTICE_WINDOWS, NOTICE_WINDOW_LAST, WINDOW_FIRST_INDEX } from './wram.mjs';
export { af1fRegisters as clearFF79Registers };
// 80:FF79: release every notice window. The notice window slots are visited from the last
// down; each used slot (not negative) passes its window as the first argument to a real JSR
// FA3E (window release) and is set to FFFF; finally the first window index is cleared.
// Actual mixed helper frames on the caller's private overlay.
export function releaseNoticeWindows(a, events, outerReturn = true) {
  return drainNativeSequence(releaseNoticeWindowsSequence(a, events, outerReturn));
}
function* releaseNoticeWindowsSequence(a, events, outerReturn) {
  let visits = 0,
    result;
  const calls = [],
    h = leafAccess(a),
    dh = dialogAccess(a);
  yield () => h.index('x', NOTICE_WINDOW_LAST);
  do {
    yield () => {
      visits++;
      h.load(h.longRead(WRAM + NOTICE_WINDOWS + h.ctx.x));
    };
    if (!(h.ctx.status & FLAG_NEGATIVE)) {
      yield () => {
        a.writeWord(FIRST_ARGUMENT, h.ctx.a, BANK_WRAP, 'FF79-slot-DP00');
        a.pushWord(h.ctx.x, 'FF79-PHX');
      };
      const released = yield* nativeCallSequence(dh, events, CLEAR_ROUTINES, 0x80ff85, 0x80fa3e);
      yield () => {
        calls.push(Object.freeze(released));
        h.index('x', a.pullWord('FF79-PLX-fresh'));
        h.load(WORD_MASK);
        h.longWrite(WRAM + NOTICE_WINDOWS + h.ctx.x, h.ctx.a);
      };
    }
    yield () => {
      h.index('x', (h.ctx.x - 1) & WORD_MASK);
      h.index('x', (h.ctx.x - 1) & WORD_MASK);
    };
  } while (!(h.ctx.status & FLAG_NEGATIVE));
  yield () => {
    h.longWrite(h.abs(WINDOW_FIRST_INDEX), 0); // STZ preserves the actual A/N/Z/C/V from the loop.
    result = {
      ...finishLeaf(a, outerReturn),
      outcome: 'slot_clear_complete',
      visits,
      calls: Object.freeze(calls),
    };
  };
  return result;
}
export const releaseNoticeWindowsAdapter = (h, e) => releaseNoticeWindows(h.a, e, false);
const CLEAR_ROUTINES = new Map([[0x80fa3e, runReleaseWindowCall]]);
NATIVE_CALL_CONTINUATIONS.set(0x80ff79, {
  run: releaseNoticeWindowsAdapter,
  create: ({ h, events }) =>
    new NativeCallContinuation(h.a, releaseNoticeWindowsSequence(h.a, events, false)),
});
export function validateNoticeReleaseOptions(options) {
  const { waitMode = null, waitObservations = null } = options ?? {};
  if (waitMode !== null && waitMode !== 'record-observations')
    return { handled: false, reason: 'task_wait_mode_required' };
  if (
    waitObservations !== null &&
    (!Array.isArray(waitObservations) ||
      !Object.isFrozen(waitObservations) ||
      !Array.from(waitObservations).every(
        (o) =>
          o &&
          Object.isFrozen(o) &&
          o.pc === 0x81acaf &&
          Number.isInteger(o.address) &&
          o.address >= 0 &&
          o.address <= LONG_MASK &&
          o.width === 2 &&
          Number.isInteger(o.value) &&
          o.value >= 0 &&
          o.value <= WORD_MASK,
      ))
  )
    return { handled: false, reason: 'task_wait_observations_required' };
  return null;
}
// lifted (optional): the lifted release's sequence (h, events), which runs instead with
// lag-free frames (the live game); recorded waits replay the register-level release.
function observeReleaseNoticeWindows(
  a,
  options,
  outerReturn,
  allowRemainingWaitObservations,
  lifted = null,
) {
  const invalid = validateNoticeReleaseOptions(options);
  if (invalid) taskStop(invalid.reason);
  const events = withInterruptEvents(
    {
      mode: options?.waitMode ?? null,
      values: options?.waitObservations ?? null,
      waitIndex: 0,
      waitEvents: [],
    },
    options,
  );
  const finish = (result) => {
    if (!allowRemainingWaitObservations && events.waitIndex !== (events.values?.length ?? 0))
      taskStop('task_wait_observation_unused', { observationIndex: events.waitIndex });
    return {
      ...result,
      waitObservationsUsed: events.waitIndex,
      waitEvents: Object.freeze(events.waitEvents),
    };
  };
  const sequence =
    lifted !== null && lagFree(events)
      ? lifted(dialogAccess(a), events)
      : releaseNoticeWindowsSequence(a, events, outerReturn);
  return { sequence, finish };
}
export function releaseNoticeWindowsObserved(
  a,
  options,
  outerReturn = true,
  allowRemainingWaitObservations = false,
  lifted = null,
) {
  const { sequence, finish } = observeReleaseNoticeWindows(
    a,
    options,
    outerReturn,
    allowRemainingWaitObservations,
    lifted,
  );
  return finish(drainNativeSequence(sequence));
}
// The scheduler's native bridge owns this continuation between work budgets.
export function createReleaseNoticeWindowsObserved(a, options, lifted = null) {
  return observedContinuation(a, observeReleaseNoticeWindows(a, options, false, false, lifted));
}
