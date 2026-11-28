// Dispatch the selected glove action to the object's current waiting task.
import { gloveState } from '../state/glove.mjs';
import { talk } from './dialog-talk.mjs';
import { chooseAction } from './action-menu.mjs';
import { takePad } from '../system/live-input-calls.mjs';
import { putGloveAwaySequence } from './window-release.mjs';
import { showNotice } from './notice-show.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { segmentSequence } from '../system/sequence-runner.mjs';
import { PAD_B, PAD_L, PAD_R } from '../data/wram.mjs';
import { sendEvents, tasksOf, waitingTask } from '../script/task-api.mjs';
import { WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
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

export function* gloveActionSequence(h, events, renderBuffer = drawTextBuffer) {
  const { wram } = h.a.mem,
    glove = gloveState(h.a.mem),
    tasks = tasksOf(h.a);
  let path = 'return',
    object = 0,
    accepted = 0,
    action = 0;
  yield () => {
    if (glove.aimingWeapon | glove.aimingSpell) return;
    if (glove.targetTag & WORD_SIGN) return;
    const buttons = glove.pressed & GLOVE_BUTTONS;
    if (!buttons) return;
    glove.actionOverride = 0;
    object = glove.targetObject;
    const task = lowObjectWord(wram, 'task', object);
    if (task & WORD_SIGN) return;
    glove.actionScratch = buttons;
    const offer = tasks.wait(waitingTask(tasks, task));
    if (buttons === PAD_B && offer & OFFER_WAIT_BITS)
      glove.actionOverride = offer & OFFERED_ACTIONS;
    const { dx, near } = reach(wram, glove.player, object);
    glove.actionScratch = dx;
    if (near) glove.actionOverride = 0;
    else if (glove.actionOverride === 0) {
      glove.windows.opening.left = NOTICE.left;
      glove.windows.opening.top = NOTICE.top;
      glove.windows.opening.columns = NOTICE.columns;
      glove.windows.opening.rows = NOTICE.rows;
      glove.windows.opening.attributes = 0;
      glove.notices.textNumber = NOTICE.text;
      glove.notices.frames = NOTICE.frames;
      path = 'notice';
      return;
    }
    // The task is looked up again, as the original does.
    const again = lowObjectWord(wram, 'task', object);
    if (again & WORD_SIGN) return;
    accepted = tasks.wait(waitingTask(tasks, again)) & ACCEPTED_ACTIONS;
    if (!accepted) return;
    const pressed = glove.pressed;
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
    };
    if (dialog) {
      yield* talk(h, events, renderBuffer, object, dialog);
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
