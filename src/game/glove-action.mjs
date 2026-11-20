import { readStateByte, writeStateByte } from '../state/objects.mjs';
import { talk } from './dialog-talk.mjs';
import { chooseAction } from './action-menu.mjs';
import { takePad } from '../system/live-input-calls.mjs';
import { putGloveAwaySequence } from './window-release.mjs';
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
// The notice, glove release, action menu, dialog and pad word compose directly
// through their original frames; the notice, the menu, the dialog and the
// input wait for the NMI. The menu takes the accepted actions as a parameter and
// returns the chosen one, and the menu and the dialog run above the object slot the
// original pushes. The push of the passed action around its task search is not
// reproduced: nothing waits there, and the glove release's frame overwrites it.
// Registers (user decision 2026-11-17): game state only; the routine leaves no A, X, Y
// or flags (the main loop's scheduler round 80:C1E3 reads none). The object, player and task fields are read in bank
// 80 below 2000, as the original reads them; a slot or task index past it stops at
// object_slot_required or task_slot_required, and a task chain that never ends (the
// original would hang) at task_chain_required.
import { showNotice } from './notice-show.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import { segmentSequence } from '../system/native-call-continuation.mjs';
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
  PAD_B,
  PAD_L,
  PAD_PRESSED,
  PAD_R,
  PLAYER_OBJECT,
} from '../data/wram.mjs';
import { sendEvents, tasksOf, waitingTask } from '../script/task-api.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { lowObjectWord, objectWordIn } from '../state/objects.mjs';

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
  NOTICE = Object.freeze({ left: 2, top: 2, columns: 0x0c, rows: 3, text: 0, frames: 0x3c });
// The direct page word the original keeps the pressed buttons in, then the x distance;
// the dialog's object and record.
const DP_SCRATCH = 0x6b,
  DP_DIALOG_OBJECT = 0x00,
  DP_DIALOG_RECORD = 0x02;

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
// The distance of two objects in one field, taken without sign (a word).
const distance = (wram, field, from, to) => {
  const a = lowObjectWord(wram, field, from),
    b = lowObjectWord(wram, field, to),
    d = (a - b) & WORD_MASK;
  return d & WORD_SIGN ? -d & WORD_MASK : d;
};
// Near: the x and y distances below A1 together and the height distance below 81.
// Returns the x distance and whether the object is near.
function reach(wram, player, object) {
  const dx = distance(wram, 'x', player, object),
    dy = distance(wram, 'y', player, object);
  if (((dx + dy) & WORD_MASK) >= ACTION_REACH) return { dx, near: false };
  return { dx, near: distance(wram, 'height', player, object) < HEIGHT_REACH };
}

// Pass a glove action on to the object's task (80:BF3B), a sequence for a native call
// continuation: h the main loop's access (direct page 0, data bank 80), events its
// frame events and renderBuffer the text renderer. The main loop runs it without its JSR
// frame; the RTS form for register-level callers is gloveActionJsr in
// proof/caller/jsr-forms.mjs.
export function* gloveActionSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const { wram } = h.a.mem,
    tasks = tasksOf(h.a);
  let path = 'return',
    object = 0,
    accepted = 0,
    action = 0;
  yield () => {
    if (word(wram, AIMING_WEAPON) | word(wram, AIMING_SPELL)) return;
    if (word(wram, GLOVE_TARGET_TAG) & WORD_SIGN) return;
    const buttons = word(wram, PAD_PRESSED) & GLOVE_BUTTONS;
    if (!buttons) return;
    setWord(wram, ACTION_MENU_OVERRIDE, 0);
    object = word(wram, GLOVE_TARGET_OBJECT);
    const task = lowObjectWord(wram, 'task', object);
    if (task & WORD_SIGN) return;
    setWord(wram, DP_SCRATCH, buttons);
    const offer = tasks.wait(waitingTask(tasks, task));
    if (buttons === PAD_B && offer & OFFER_WAIT_BITS)
      setWord(wram, ACTION_MENU_OVERRIDE, offer & OFFERED_ACTIONS);
    const { dx, near } = reach(wram, word(wram, PLAYER_OBJECT), object);
    setWord(wram, DP_SCRATCH, dx);
    if (near) setWord(wram, ACTION_MENU_OVERRIDE, 0);
    else if (word(wram, ACTION_MENU_OVERRIDE) === 0) {
      setWord(wram, DP_WINDOW_LEFT, NOTICE.left);
      setWord(wram, DP_WINDOW_TOP, NOTICE.top);
      setWord(wram, DP_WINDOW_COLUMNS, NOTICE.columns);
      setWord(wram, DP_WINDOW_ROWS, NOTICE.rows);
      setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
      setWord(wram, DP_NOTICE_TEXT, NOTICE.text);
      setWord(wram, DP_NOTICE_FRAMES, NOTICE.frames);
      path = 'notice';
      return;
    }
    // The task is looked up again, as the original does.
    const again = lowObjectWord(wram, 'task', object);
    if (again & WORD_SIGN) return;
    accepted = tasks.wait(waitingTask(tasks, again)) & ACCEPTED_ACTIONS;
    if (!accepted) return;
    const pressed = word(wram, PAD_PRESSED);
    if (pressed & PAD_B) {
      // The original keeps the object slot on the stack over the menu and the dialog;
      // that word lies only in free stack bytes, and object stays in its local.
      path = 'menu';
      return;
    }
    path = 'pass';
    if (pressed & PAD_L) action = accepted & L_ACTIONS;
    else {
      const bits = accepted & R_ACTIONS;
      action = bits === R_NO_ACTION ? 0 : bits;
    }
  };
  if (path === 'notice') {
    yield* showNotice(h, events, renderBuffer);
    yield* putGloveAwaySequence(h, events);
    yield* segmentSequence(() => takePad(h, events));
  }
  if (path === 'menu') {
    const choice = {};
    yield* chooseAction(h, events, renderBuffer, accepted, choice);
    let dialog = 0;
    yield () => {
      action = choice.action;
      if (!(action & TALK_ACTION)) return;
      // The dialog record is read in bank 7E (a long read).
      dialog = objectWordIn(wram, 'dialog', object);
      if (!dialog) {
        action = ACTION_WITHOUT_DIALOG;
        return;
      }
      setWord(wram, DP_DIALOG_OBJECT, object);
      setWord(wram, DP_DIALOG_RECORD, dialog);
    };
    if (dialog) {
      yield* talk(h, events, renderBuffer);
      yield () => {
        action = 0;
      };
    }
    path = 'pass';
  }
  if (path === 'pass') {
    yield () => {
      const task = lowObjectWord(wram, 'task', object);
      if (task & WORD_SIGN) {
        path = 'return';
        return;
      }
      sendEvents(tasks, task, action);
    };
    if (path === 'pass') {
      yield* putGloveAwaySequence(h, events);
      yield* segmentSequence(() => takePad(h, events));
    }
  }
}
