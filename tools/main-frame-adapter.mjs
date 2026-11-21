// Compatibility entry for existing caller comparisons and external adapters.
// Live game and attract control flow use game/frame-loop.mjs directly.
import { taskStop } from '../src/system/task-stop.mjs';
import { dialogAccess } from '../src/system/native-dialog-support.mjs';
import { lagFree } from '../src/system/main-wait-interrupt.mjs';
import { frameWaitCallSequence } from '../src/system/live-input-calls.mjs';
import { NativeCallContinuation, dialogCallBody } from '../src/system/native-call-continuation.mjs';
import { CODE_BANK, CODE_BANK_BASE } from '../src/constants/memory-map.mjs';
import { update, endOfFrame } from '../src/game/frame-loop.mjs';
export const MAIN_LOOP_RESUME = 0x96c3; // return from the round
export const MAIN_LOOP_ROUND = 0x96c0; // JSR $C1E3
const MAIN_LOOP_START = 0x96ab; // first pass after 9688
const FRAME_WAIT = 0x81b0a1;
const MAIN_LOOP_EXIT_PC = 0x96ec,
  MAIN_LOOP_RELOAD_PC = 0x96f2;
export function* mainLoopSequence(a, events, returnToOwner = false) {
  const { ctx } = a;
  if (ctx.programBank !== CODE_BANK || ![MAIN_LOOP_RESUME, MAIN_LOOP_START].includes(ctx.pc))
    taskStop('main_loop_entry_required', { pc: ctx.pc });
  const h = dialogAccess(a);
  if (!lagFree(events)) taskStop('game_lag_free_required');
  if (ctx.pc !== MAIN_LOOP_START) {
    const reason = yield* update(h, events);
    if (reason) {
      if (returnToOwner) return h.rts();
      taskStop('main_loop_exit', {
        pc: reason === 'exit' ? MAIN_LOOP_EXIT_PC : MAIN_LOOP_RELOAD_PC,
      });
    }
  }
  yield* endOfFrame(h, events, function* () {
    yield* dialogCallBody(
      h,
      CODE_BANK_BASE | MAIN_LOOP_START,
      FRAME_WAIT,
      () => frameWaitCallSequence(h, events),
      true,
    );
  });
  ctx.pc = MAIN_LOOP_ROUND;
  return ctx.pc;
}

export class MainLoopContinuation extends NativeCallContinuation {
  constructor(a, { events = null, returnToOwner = false } = {}) {
    super(a, mainLoopSequence(a, events, returnToOwner));
  }
}
