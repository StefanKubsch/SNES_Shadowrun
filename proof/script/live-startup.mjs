// Address-dispatched live startup retained as the differential reference. Recorded boot replays
// use proof/replay/main-startup.mjs with the register-level sound transfer.
import { taskStop } from '../../src/system/task-stop.mjs';
import { dialogAccess } from '../../src/system/native-dialog-support.mjs';
import { FRONTEND_ROUTINES, MAIN_OWNER_ENTRY } from './live-frontend.mjs';
import { lagFree } from '../../src/system/main-wait-interrupt.mjs';
import { bootScreensSequence } from '../frontend-caller/boot-screens.mjs';
import { nativeCallSequence } from '../system/native-call-sequences.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
} from '../../src/system/native-call-continuation.mjs';
import { CODE_BANK, CODE_BANK_PAIR } from '../../src/constants/memory-map.mjs';
import { FLAG_DECIMAL, FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT } from '../../src/constants/cpu-flags.mjs';
export const MAIN_STARTUP_ENTRY = 0xa133;

function* runBootScreensSequence(h, events, routines) {
  yield () => h.php();
  yield* nativeCallSequence(h, events, routines, 0x80a15d, 0x81e7bc, true);
  let result;
  yield () => {
    h.push(CODE_BANK_PAIR, 2);
    h.plb();
    h.plb();
    h.plp();
    result = h.rts();
  };
  return result;
}
function runBootScreens(h, events, routines = MAIN_STARTUP_ROUTINES) {
  return drainNativeSequence(runBootScreensSequence(h, events, routines));
}
export function runBootScreensLifted(h, events) {
  if (!lagFree(events)) taskStop('game_lag_free_required');
  return drainNativeSequence(bootScreensSequence(h, events));
}
for (const [run, sequence] of [
  [runBootScreens, runBootScreensSequence],
  [runBootScreensLifted, bootScreensSequence],
])
  NATIVE_CALL_CONTINUATIONS.set(run, {
    run,
    create: ({ h, events, routines = MAIN_STARTUP_ROUTINES }) =>
      new NativeCallContinuation(h.a, sequence(h, events, routines)),
  });
export const MAIN_STARTUP_ROUTINES = new Map([
  ...FRONTEND_ROUTINES,
  [0x81e839, (h) => h.rtl()],
  [0x81e7bc, runBootScreensLifted],
  [0x80a15c, runBootScreens],
]);
export class MainStartupContinuation extends NativeCallContinuation {
  constructor(a, events, routines = MAIN_STARTUP_ROUTINES) {
    super(a, mainStartupSequence(a, events, routines));
  }
}
function* mainStartupSequence(a, events, routines) {
  const { ctx } = a;
  if (
    ctx.programBank !== CODE_BANK ||
    ctx.pc !== MAIN_STARTUP_ENTRY ||
    ctx.d !== 0 ||
    ctx.bank !== CODE_BANK ||
    ctx.status & (FLAG_DECIMAL | FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('main_startup_entry_required', { pc: ctx.pc });
  yield* nativeCallSequence(dialogAccess(a), events, routines, 0x80a133, 0x80a15c);
  yield () => {
    dialogAccess(a).load(1);
    ctx.pc = MAIN_OWNER_ENTRY;
  };
  return ctx.pc;
}
