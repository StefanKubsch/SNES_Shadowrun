// Register-level reference of the main loop's glove action 80:BF3B (moved from
// src/task/main-loop-upkeep.mjs). The lifted version is src/game/glove-action.mjs.
import { MAIN_UPKEEP_ROUTINES } from '../../src/task/main-loop-upkeep.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  nativeCallSequence,
} from '../../src/task/native-call-continuation.mjs';
import { DP_SCRATCH } from '../../src/task/native-member-spell-menu.mjs';
import { GLOVE_REACH, OUT_OF_REACH_NOTICE } from '../../src/task/native-glove-target.mjs';
import { sec, clc } from '../../src/task/status-flags.mjs';
import {
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  OBJECT_DIALOG,
  OBJECT_TASK,
  PAD_PRESSED,
  PLAYER_OBJECT,
  WRAM,
  OBJECT_X,
  OBJECT_Y,
  OBJECT_HEIGHT,
  AIMING_WEAPON,
  AIMING_SPELL,
  ACTION_MENU_OVERRIDE,
  PAD_B,
  PAD_L,
  PAD_R,
  DP_WINDOW_LEFT,
  DP_WINDOW_TOP,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_ROWS,
  DP_WINDOW_ATTRIBUTES,
  DP_NOTICE_TEXT,
  DP_NOTICE_FRAMES,
} from '../../src/task/wram.mjs';
import { TASK_PREVIOUS, TASK_WAIT, TASK_EVENTS } from '../../src/vm/layout.mjs';
import { WORD_MASK } from '../../src/constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO, FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';

// BF3B: task wait masks of the glove target's waiting task. When B alone was pressed
// (DP6B holds the pressed B, L and R bits: 8000) and the task waits for 6002, its 6682
// bits are offered through the action menu override;
// 67F2 bits make the glove action pass on. B selects the action menu; L passes 0080,
// otherwise the 0610 bits unless exactly 0600. Actions need a summed distance below A1.
const ONLY_B_PRESSED = PAD_B,
  OFFER_WAIT_BITS = 0x6002,
  OFFERED_ACTION_BITS = 0x6682,
  GLOVE_ACTION_BITS = 0x67f2,
  L_ACTION_BIT = 0x80,
  OTHER_ACTION_BITS = 0x610,
  NO_OTHER_ACTION = 0x600,
  ACTION_REACH = 0xa1,
  ACTION_DIALOG_BIT = 2,
  ACTION_WITHOUT_DIALOG = 2;
const RELEASE_BUTTONS = PAD_B | PAD_L | PAD_R;
// The same out-of-reach notice as 9C40, with its top row 2 set here.
const ACTION_NOTICE = Object.freeze({ ...OUT_OF_REACH_NOTICE, top: 2 });

// $80:BF3B: pass a new glove action on to the real task; reuse the menu and dialog.
// Notice, glove release, input, actions 99EB and dialog 936C own their own continuations.
export function passGloveActionToTask(h, events, routines = MAIN_UPKEEP_ROUTINES) {
  return drainNativeSequence(mainGloveActionSequence(h, events, routines));
}
// Original routine $80:BF3B.
function* mainGloveActionSequence(h, events, routines) {
  const { ctx } = h,
    call = (pc, target) => nativeCallSequence(h, events, routines, pc, target),
    negative = () => Boolean(ctx.status & FLAG_NEGATIVE);
  const rootTask = () => {
    h.index('x', h.read(h.abs(OBJECT_TASK) + ctx.y));
    if (negative()) return false;
    for (;;) {
      h.load(h.read(h.abs(TASK_WAIT) + ctx.x));
      if (!negative()) return true;
      h.load(h.read(h.abs(TASK_PREVIOUS) + ctx.x));
      h.index('x', ctx.a);
    }
  };
  const distance = (offset) => {
    sec(h);
    h.load(h.read(h.abs(offset) + ctx.x));
    h.sbc(h.read(h.abs(offset) + ctx.y));
    if (negative()) {
      h.load(ctx.a ^ WORD_MASK);
      h.load(ctx.a + 1);
    }
  };
  let path, result;
  yield () => {
    path = (() => {
      h.load(h.read(h.abs(AIMING_WEAPON)));
      h.load(ctx.a | h.read(h.abs(AIMING_SPELL)));
      if (!(ctx.status & FLAG_ZERO)) return 'return';
      h.load(h.read(h.abs(GLOVE_TARGET_TAG)));
      if (negative()) return 'return';
      h.load(h.read(h.abs(PAD_PRESSED)) & RELEASE_BUTTONS);
      if (ctx.status & FLAG_ZERO) return 'return';
      h.write(h.abs(ACTION_MENU_OVERRIDE), 0);
      h.index('y', h.read(h.abs(GLOVE_TARGET_OBJECT)));
      // The pressed buttons are kept in DP6B while the chain is followed.
      h.index('x', h.read(h.abs(OBJECT_TASK) + ctx.y));
      if (negative()) return 'return';
      h.dpWrite(DP_SCRATCH, ctx.a);
      for (;;) {
        h.load(h.read(h.abs(TASK_WAIT) + ctx.x));
        if (!negative()) break;
        h.load(h.read(h.abs(TASK_PREVIOUS) + ctx.x));
        h.index('x', ctx.a);
      }
      h.load(h.dp(DP_SCRATCH));
      h.cmp(ONLY_B_PRESSED);
      if (ctx.status & FLAG_ZERO) {
        h.load(h.read(h.abs(TASK_WAIT) + ctx.x) & OFFER_WAIT_BITS);
        if (!(ctx.status & FLAG_ZERO)) {
          h.load(h.read(h.abs(TASK_WAIT) + ctx.x) & OFFERED_ACTION_BITS);
          h.write(h.abs(ACTION_MENU_OVERRIDE), ctx.a);
        }
      }
      h.index('x', h.read(h.abs(PLAYER_OBJECT)));
      distance(OBJECT_X);
      h.dpWrite(DP_SCRATCH, ctx.a);
      distance(OBJECT_Y);
      clc(h);
      h.adc(h.dp(DP_SCRATCH));
      h.cmp(ACTION_REACH);
      let near = !(ctx.status & FLAG_CARRY);
      if (near) {
        distance(OBJECT_HEIGHT);
        h.cmp(GLOVE_REACH);
        near = !(ctx.status & FLAG_CARRY);
      }
      if (near) h.write(h.abs(ACTION_MENU_OVERRIDE), 0);
      else {
        h.load(h.read(h.abs(ACTION_MENU_OVERRIDE)));
        if (ctx.status & FLAG_ZERO) {
          for (const [o, v] of [
            [DP_WINDOW_LEFT, ACTION_NOTICE.left],
            [DP_WINDOW_TOP, ACTION_NOTICE.top],
            [DP_WINDOW_COLUMNS, ACTION_NOTICE.columns],
            [DP_WINDOW_ROWS, ACTION_NOTICE.rows],
            [DP_WINDOW_ATTRIBUTES, 0],
          ]) {
            h.load(v);
            h.dpWrite(o, ctx.a);
          }
          h.dpWrite(DP_NOTICE_TEXT, 0);
          h.load(ACTION_NOTICE.frames);
          h.dpWrite(DP_NOTICE_FRAMES, ctx.a);
          return 'notice';
        }
      }
      if (!rootTask()) return 'return';
      h.load(ctx.a & GLOVE_ACTION_BITS);
      if (ctx.status & FLAG_ZERO) return 'return';
      h.index('x', ctx.a);
      h.load(h.read(h.abs(PAD_PRESSED)));
      h.bit(PAD_B);
      if (ctx.status & FLAG_ZERO) {
        h.bit(PAD_L);
        if (!(ctx.status & FLAG_ZERO)) h.load(ctx.x & L_ACTION_BIT);
        else {
          h.load(ctx.x & OTHER_ACTION_BITS);
          h.cmp(NO_OTHER_ACTION);
          if (ctx.status & FLAG_ZERO) h.load(0);
        }
        return 'chain';
      }
      h.load(ctx.x);
      h.phy();
      return 'action';
    })();
  };
  if (path === 'notice') {
    yield* call(0x80bfde, 0x80fec1);
    yield* call(0x80bfe1, 0x80bcb2);
    yield* call(0x80bfe4, 0x809e1a);
  }
  if (path === 'action') {
    yield* call(0x80c00b, 0x8099eb);
    let dialog = false;
    yield () => {
      h.ply();
      h.bit(ACTION_DIALOG_BIT);
      if (!(ctx.status & FLAG_ZERO)) {
        h.phx();
        h.index('x', ctx.y);
        h.load(h.read(WRAM + OBJECT_DIALOG + ctx.x));
        h.plx();
        h.cmp(0);
        if (ctx.status & FLAG_ZERO) h.load(ACTION_WITHOUT_DIALOG);
        else {
          h.phy();
          h.dpWrite(0, ctx.y);
          h.dpWrite(2, ctx.a);
          dialog = true;
        }
      }
    };
    if (dialog) {
      yield* call(0x80c032, 0x80936c);
      yield () => {
        h.ply();
        h.load(0);
      };
    }
    path = 'chain';
  }
  if (path === 'chain') {
    // Preserve the selected action while following the chain again, as the original PHA/PLA do.
    yield () => {
      h.index('x', h.read(h.abs(OBJECT_TASK) + ctx.y));
      if (negative()) {
        path = 'return';
        return;
      }
      h.pha();
      for (;;) {
        h.load(h.read(h.abs(TASK_WAIT) + ctx.x));
        if (!negative()) break;
        h.load(h.read(h.abs(TASK_PREVIOUS) + ctx.x));
        h.index('x', ctx.a);
      }
      h.pla();
      h.load(ctx.a | h.read(h.abs(TASK_EVENTS) + ctx.x));
      h.write(h.abs(TASK_EVENTS) + ctx.x, ctx.a);
    };
    if (path === 'chain') {
      yield* call(0x80c064, 0x80bcb2);
      yield* call(0x80c067, 0x809e1a);
    }
  }
  yield () => {
    result = h.rts();
  };
  return result;
}

export const MAIN_GLOVE_ACTION_REFERENCE_ENTRIES = [[0x80bf3b, passGloveActionToTask]];
// The reference waits through its callees; its continuation is found by its run
// function, as the lifted entry holds the target.
NATIVE_CALL_CONTINUATIONS.set(passGloveActionToTask, {
  run: passGloveActionToTask,
  create: ({ h, events, routines = MAIN_UPKEEP_ROUTINES }) =>
    new NativeCallContinuation(h.a, mainGloveActionSequence(h, events, routines)),
});
