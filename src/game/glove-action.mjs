// The action glove's buttons on an object (lifted from 80:BF3B; register-level
// reference in proof/game-reference/main-glove-action.mjs).
//
// While neither the crosshair nor the spell glove aims and the glove points at an
// object with a task, a newly pressed B, L or R passes an action on to the task that
// actually waits: the object's task, or while that one waits for a child task (a
// negative wait mask), the child it follows to. Its wait mask names the actions it
// accepts (67F2 bits).
//
// The object must be near the player figure: the distances in x and y (each taken
// without sign) below A1 together and the height distance below 81 (the glove's
// reach). When B alone was pressed and the waiting task waits for 6002 bits, its
// 6682 bits are offered to the action menu (7E:1FA6) instead; then the action passes
// on whatever the distance. An object out of reach without such an offer shows the
// out-of-reach notice (2, 2, C x 3, text 0, 3C frames), releases the glove and waits
// for the input to change.
//
// B opens the action menu 80:99EB with the accepted actions; an action with bit 1
// talks to the object through its dialog record (7E:4450) with 80:936C, if it has
// one (the action then passes on as none), else passes on as 2. L passes on the 80
// bit of the accepted actions, R its 0610 bits unless they are exactly 0600. The
// action is ORed into the task's event bits (it ends the wait), then the glove is
// released (80:BCB2) and the input waits for a change (80:9E1A).
//
// The callees run through their frames from the routine table: the notice, the glove
// release, the action menu, the dialog and the pad word lifted (src/game/main-upkeep.mjs
// binds them); the notice, the menu, the dialog and the
// input wait for the NMI. Each gets the A, X and Y the
// original passes (the menu reads the actions from A), and the menu and the dialog run
// above the object slot the original pushes. The push of the passed action around its
// task search is not reproduced: nothing waits there, and the glove release's frame
// overwrites it. X and Y are left as the original leaves them where no callee runs
// last (src/game/main-upkeep.mjs). The object, player and task fields are read in bank
// 80 below 2000, as the original reads them; a slot or task index past it stops at
// object_slot_required or task_slot_required, and a task chain that never ends (the
// original would hang) at task_chain_required.
import { taskStop } from '../task/plan.mjs';
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import {
  ACTION_MENU_OVERRIDE,
  AIMING_SPELL,
  AIMING_WEAPON,
  DP_NOTICE_FRAMES,
  DP_NOTICE_TEXT,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  OBJECT_DIALOG,
  OBJECT_HEIGHT,
  OBJECT_TASK,
  OBJECT_X,
  OBJECT_Y,
  PAD_B,
  PAD_L,
  PAD_PRESSED,
  PAD_R,
  PLAYER_OBJECT,
} from '../task/wram.mjs';
import { TASK_EVENTS, TASK_PREVIOUS, TASK_WAIT } from '../vm/layout.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const GLOVE_BUTTONS = PAD_B | PAD_L | PAD_R,
  OFFER_WAIT_BITS = 0x6002,
  OFFERED_ACTIONS = 0x6682,
  ACCEPTED_ACTIONS = 0x67f2,
  L_ACTIONS = 0x80,
  R_ACTIONS = 0x610,
  R_NO_ACTION = 0x600,
  ACTION_REACH = 0xa1,
  HEIGHT_REACH = 0x81,
  TALK_ACTION = 2,
  ACTION_WITHOUT_DIALOG = 2,
  NOTICE = Object.freeze({ left: 2, top: 2, columns: 0x0c, rows: 3, text: 0, frames: 0x3c }),
  LOW_WRAM_END = 0x2000,
  CHAIN_LIMIT = 0x10000;
// The direct page word the original keeps the pressed buttons in, then the x distance;
// the dialog's object and record.
const DP_SCRATCH = 0x6b,
  DP_DIALOG_OBJECT = 0x00,
  DP_DIALOG_RECORD = 0x02;
// Original call sites and callees.
const CALL = Object.freeze({
  notice: [0x80bfde, 0x80fec1],
  noticeRelease: [0x80bfe1, 0x80bcb2],
  noticeInput: [0x80bfe4, 0x809e1a],
  menu: [0x80c00b, 0x8099eb],
  dialog: [0x80c032, 0x80936c],
  release: [0x80c064, 0x80bcb2],
  input: [0x80c067, 0x809e1a],
});

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
// A word of a table in bank 80 below 2000 (the original's data bank reaches WRAM only there).
const lowField = (wram, base, index, reason) => {
  if (base + index + 1 >= LOW_WRAM_END) taskStop(reason, { base, index });
  return word(wram, base + index);
};
// The status flags: the main loop's scheduler round 80:C1E3 follows this routine and
// starts with the A and the flags it leaves, so where no callee runs last they are
// left as the original leaves them. flag(ctx, bit, set) sets one; sign and zero follow
// a loaded word.
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const signAndZero = (ctx, value) => {
  flag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
  flag(ctx, FLAG_ZERO, value === 0);
};
// The distance of two objects in one field, taken without sign (a word), and the
// overflow of the subtraction.
const distance = (wram, field, from, to) => {
  const a = lowField(wram, field, from, 'object_slot_required'),
    b = lowField(wram, field, to, 'object_slot_required'),
    d = (a - b) & WORD_MASK;
  return {
    value: d & WORD_SIGN ? -d & WORD_MASK : d,
    overflow: ((a ^ b) & (a ^ d) & WORD_SIGN) !== 0,
  };
};
// Near: the x and y distances below A1 together and the height distance below 81.
// Returns the x distance and, when near, the height distance and the overflow of its
// subtraction, which the original leaves with a clear carry.
function reach(wram, player, object) {
  const dx = distance(wram, OBJECT_X, player, object),
    dy = distance(wram, OBJECT_Y, player, object);
  if (((dx.value + dy.value) & WORD_MASK) >= ACTION_REACH) return { dx, near: false };
  const height = distance(wram, OBJECT_HEIGHT, player, object);
  return { dx, near: height.value < HEIGHT_REACH, height: height.value, overflow: height.overflow };
}
// The task that actually waits: from a task, the children it waits for.
function waitingTask(wram, task) {
  for (let step = 0; step < CHAIN_LIMIT; step++) {
    if (!(lowField(wram, TASK_WAIT, task, 'task_slot_required') & WORD_SIGN)) return task;
    task = lowField(wram, TASK_PREVIOUS, task, 'task_slot_required');
  }
  return taskStop('task_chain_required', { task });
}

// Pass a glove action on to the object's task (80:BF3B), a sequence for a native call
// continuation: h the main loop's access (direct page 0, data bank 80), events its
// frame events, routines the table of the register-level callees.
export function* gloveActionSequence(h, events, routines) {
  const { ctx } = h,
    { wram } = h.a.mem,
    call = ([site, target]) => nativeCallSequence(h, events, routines, site, target);
  let path = 'return';
  yield () => {
    // Each return leaves A and its sign and zero as the original.
    const exit = (a, loaded = a) => {
      ctx.a = a;
      signAndZero(ctx, loaded);
    };
    const aiming = word(wram, AIMING_WEAPON) | word(wram, AIMING_SPELL);
    if (aiming) return exit(aiming);
    const tag = word(wram, GLOVE_TARGET_TAG);
    if (tag & WORD_SIGN) return exit(tag);
    const buttons = word(wram, PAD_PRESSED) & GLOVE_BUTTONS;
    if (!buttons) return exit(0);
    setWord(wram, ACTION_MENU_OVERRIDE, 0);
    const object = word(wram, GLOVE_TARGET_OBJECT);
    ctx.y = object;
    const task = lowField(wram, OBJECT_TASK, object, 'object_slot_required');
    ctx.x = task;
    if (task & WORD_SIGN) return exit(buttons, task);
    setWord(wram, DP_SCRATCH, buttons);
    const offer = lowField(wram, TASK_WAIT, waitingTask(wram, task), 'task_slot_required');
    if (buttons === PAD_B && offer & OFFER_WAIT_BITS)
      setWord(wram, ACTION_MENU_OVERRIDE, offer & OFFERED_ACTIONS);
    const player = word(wram, PLAYER_OBJECT);
    ctx.x = player;
    const { dx, near, overflow, height } = reach(wram, player, object);
    setWord(wram, DP_SCRATCH, dx.value);
    // Only a near object can return without a callee (no accepted actions) with the
    // carry and overflow of its distances; out of reach the object has offered actions,
    // which are accepted ones, so a callee runs last.
    if (near) {
      flag(ctx, FLAG_CARRY, false);
      flag(ctx, FLAG_OVERFLOW, overflow);
    }
    // A holds the height distance when near, else the offered actions.
    let a = height;
    if (near) setWord(wram, ACTION_MENU_OVERRIDE, 0);
    else if ((a = word(wram, ACTION_MENU_OVERRIDE)) === 0) {
      setWord(wram, DP_WINDOW_LEFT, NOTICE.left);
      setWord(wram, DP_WINDOW_TOP, NOTICE.top);
      setWord(wram, DP_WINDOW_COLUMNS, NOTICE.columns);
      setWord(wram, DP_WINDOW_ROWS, NOTICE.rows);
      setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
      setWord(wram, DP_NOTICE_TEXT, NOTICE.text);
      setWord(wram, DP_NOTICE_FRAMES, NOTICE.frames);
      ctx.a = NOTICE.frames;
      path = 'notice';
      return;
    }
    // The task is looked up again, as the original does.
    const again = lowField(wram, OBJECT_TASK, object, 'object_slot_required');
    ctx.x = again;
    if (again & WORD_SIGN) return exit(a, again);
    const waiting = waitingTask(wram, again);
    ctx.x = waiting;
    const accepted = lowField(wram, TASK_WAIT, waiting, 'task_slot_required') & ACCEPTED_ACTIONS;
    if (!accepted) return exit(0);
    ctx.x = accepted;
    const pressed = word(wram, PAD_PRESSED);
    if (pressed & PAD_B) {
      ctx.a = accepted;
      h.a.pushWord(ctx.y);
      path = 'menu';
      return;
    }
    path = 'pass';
    if (pressed & PAD_L) ctx.a = accepted & L_ACTIONS;
    else {
      const bits = accepted & R_ACTIONS;
      ctx.a = bits === R_NO_ACTION ? 0 : bits;
    }
  };
  if (path === 'notice') {
    yield* call(CALL.notice);
    yield* call(CALL.noticeRelease);
    yield* call(CALL.noticeInput);
  }
  if (path === 'menu') {
    // The menu returns the chosen action in A.
    yield* call(CALL.menu);
    let dialog = 0;
    yield () => {
      ctx.y = h.a.pullWord();
      if (!(ctx.a & TALK_ACTION)) return;
      // The dialog record is read in bank 7E (a long read).
      dialog = word(wram, OBJECT_DIALOG + ctx.y);
      // The original compares the record with 0, which sets the carry.
      flag(ctx, FLAG_CARRY, true);
      if (!dialog) {
        ctx.a = ACTION_WITHOUT_DIALOG;
        return;
      }
      h.a.pushWord(ctx.y);
      setWord(wram, DP_DIALOG_OBJECT, ctx.y);
      setWord(wram, DP_DIALOG_RECORD, dialog);
      ctx.a = dialog;
    };
    if (dialog) {
      yield* call(CALL.dialog);
      yield () => {
        ctx.y = h.a.pullWord();
        ctx.a = 0;
      };
    }
    path = 'pass';
  }
  if (path === 'pass') {
    yield () => {
      const action = ctx.a,
        task = lowField(wram, OBJECT_TASK, ctx.y, 'object_slot_required');
      ctx.x = task;
      if (task & WORD_SIGN) {
        signAndZero(ctx, task);
        path = 'return';
        return;
      }
      const waiting = waitingTask(wram, task);
      ctx.x = waiting;
      ctx.a = lowField(wram, TASK_EVENTS, waiting, 'task_slot_required') | action;
      setWord(wram, TASK_EVENTS + waiting, ctx.a);
    };
    if (path === 'pass') {
      yield* call(CALL.release);
      yield* call(CALL.input);
    }
  }
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
