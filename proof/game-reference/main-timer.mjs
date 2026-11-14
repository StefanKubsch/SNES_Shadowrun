// Register-level reference of the main loop's time limit 80:E270 (moved from
// src/task/main-loop-upkeep.mjs). The lifted version is src/game/time-limit.mjs.
import { MAIN_UPKEEP_ROUTINES } from '../../src/task/main-loop-upkeep.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  nativeCallSequence,
} from '../../src/task/native-call-continuation.mjs';
import {
  TIMER,
  TIMER_FRAMES,
  DP_WINDOW_LEFT,
  DP_WINDOW_TOP,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_ROWS,
  DP_WINDOW_ATTRIBUTES,
  DP_NOTICE_TEXT,
  DP_NOTICE_FRAMES,
  DP_SOUND_EFFECT,
  DP_SOUND_LEVEL,
  DP_SOUND_VOICE,
  DP_CURSOR_ROW,
} from '../../src/task/wram.mjs';
import { BYTE_MASK, WORD_MASK } from '../../src/constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO, FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';

// E270: one timer hour lasts DD4 frames; its notice 08/02/11/04 shows text 4 for B4
// frames, then the hours ("hour"/"hours before your Cortex bomb goes off."). In the last
// hour a warning sound 26 at level FF on voices 7 plays every 20 frames below E10, else
// every 40 frames.
const FRAMES_PER_TIMER_HOUR = 0xdd4,
  TIMER_NOTICE = Object.freeze({ left: 8, top: 2, columns: 0x11, rows: 4, text: 4, frames: 0xb4 }),
  TEXT_LAST_HOUR = 0x7446,
  TEXT_HOURS = 0x742f,
  WARNING_FAST_BELOW = 0xe10,
  WARNING_FAST_MASK = 0x1f,
  WARNING_SLOW_MASK = 0x3f,
  WARNING_SOUND = 0x26,
  WARNING_SOUND_LEVEL = BYTE_MASK,
  WARNING_SOUND_VOICES = 7;

// $80:E270: remaining time, notice and warning sound. The text and sound helpers remain their own contracts.
export function updateTimeLimit(h, events, routines = MAIN_UPKEEP_ROUTINES) {
  return drainNativeSequence(mainTimerSequence(h, events, routines));
}
function* mainTimerSequence(h, events, routines) {
  const { ctx } = h,
    call = (pc, target) => nativeCallSequence(h, events, routines, pc, target);
  let path, result;
  yield () => {
    h.load(h.read(h.abs(TIMER)));
    if (ctx.status & FLAG_NEGATIVE) {
      path = 'return';
      return;
    }
    h.load(ctx.a | h.read(h.abs(TIMER_FRAMES)));
    if (ctx.status & FLAG_ZERO) {
      path = 'return';
      return;
    }
    h.load(h.read(h.abs(TIMER_FRAMES)));
    if (ctx.status & FLAG_ZERO) {
      h.load(FRAMES_PER_TIMER_HOUR);
      h.write(h.abs(TIMER_FRAMES), ctx.a);
      for (const [o, v] of [
        [DP_WINDOW_LEFT, TIMER_NOTICE.left],
        [DP_WINDOW_TOP, TIMER_NOTICE.top],
        [DP_WINDOW_COLUMNS, TIMER_NOTICE.columns],
        [DP_WINDOW_ROWS, TIMER_NOTICE.rows],
        [DP_WINDOW_ATTRIBUTES, 0],
        [DP_NOTICE_TEXT, TIMER_NOTICE.text],
        [DP_NOTICE_FRAMES, TIMER_NOTICE.frames],
      ]) {
        h.load(v);
        h.dpWrite(o, ctx.a);
      }
      path = 'notice';
      return;
    }
    h.load(ctx.a - 1);
    h.write(h.abs(TIMER_FRAMES), ctx.a);
    h.load(h.read(h.abs(TIMER)));
    let fast = false;
    if (ctx.status & FLAG_ZERO) {
      h.load(h.read(h.abs(TIMER_FRAMES)));
      h.cmp(WARNING_FAST_BELOW);
      fast = !(ctx.status & FLAG_CARRY);
    }
    if (!fast) h.load(h.read(h.abs(TIMER_FRAMES)));
    h.load(ctx.a & (fast ? WARNING_FAST_MASK : WARNING_SLOW_MASK));
    if (!(ctx.status & FLAG_ZERO)) {
      path = 'return';
      return;
    }
    for (const [o, v] of [
      [0, WORD_MASK],
      [DP_SOUND_LEVEL, WARNING_SOUND_LEVEL],
      [DP_SOUND_VOICE, WARNING_SOUND_VOICES],
      [DP_SOUND_EFFECT, WARNING_SOUND],
    ]) {
      h.load(v);
      h.dpWrite(o, ctx.a);
    }
    path = 'sound';
  };
  if (path === 'notice') {
    yield* call(0x80e2ab, 0x80fec1);
    yield () => {
      h.dpWrite(0, ctx.a);
      h.dpWrite(2, 0);
      h.dpWrite(DP_CURSOR_ROW, 0);
    };
    yield* call(0x80e2b4, 0x80faac);
    yield () => {
      h.load(h.read(h.abs(TIMER)));
      h.dpWrite(2, ctx.a);
      h.load(ctx.a - 1);
      h.write(h.abs(TIMER), ctx.a);
    };
    yield* call(0x80e2c0, 0x80fd80);
    yield () => {
      h.load(h.read(h.abs(TIMER)));
      h.load(ctx.status & FLAG_ZERO ? TEXT_LAST_HOUR : TEXT_HOURS);
      h.dpWrite(2, ctx.a);
    };
    yield* call(0x80e2d2, 0x80fe69);
  } else if (path === 'sound') yield* call(0x80e30b, 0x80c46e);
  yield () => {
    result = h.rts();
  };
  return result;
}

export const MAIN_TIMER_REFERENCE_ENTRIES = [[0x80e270, updateTimeLimit]];
// The reference waits through its callees; its continuation is found by its run
// function, as the lifted entry holds the target.
NATIVE_CALL_CONTINUATIONS.set(updateTimeLimit, {
  run: updateTimeLimit,
  create: ({ h, events, routines = MAIN_UPKEEP_ROUTINES }) =>
    new NativeCallContinuation(h.a, mainTimerSequence(h, events, routines)),
});
