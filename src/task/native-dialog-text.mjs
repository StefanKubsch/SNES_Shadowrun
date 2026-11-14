import { taskStop } from './plan.mjs';
import { fitListWindow, listTextIds } from '../data/menu-layout.mjs';
import { TOPICS } from '../data/topics.mjs';
import {
  requestWindowUpload,
  runTaskMenuCompose,
  requestWindowUploadSequence,
  menuComposeSequence,
} from './native-menu-compose.mjs';
import { setTextCursor } from './native-list-prerequisites.mjs';
import { printText, printTextSequence } from './native-text-compose.mjs';
import { openWindow, f963Sequence } from './native-window-open.mjs';
import { releaseWindow } from './native-render-compose.mjs';
import { releaseWindowJsrSequence } from '../game/window-release.mjs';
import {
  segmentSequence,
  dialogCallBody,
  drainNativeSequence,
} from './native-call-continuation.mjs';
import { appendScriptTask } from './task-append.mjs';

import { DIALOG_END, TOPIC_FLAGS, TOPIC_LIST, WRAM } from './wram.mjs';
import { NIBBLE_MASK, BYTE_MASK, WORD_MASK } from '../constants/bits.mjs';
import { CODE_BANK, WRAM_BANK } from '../constants/memory-map.mjs';
import { FLAG_ZERO, FLAG_CARRY, FLAG_MEMORY_8BIT, FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';

const DP_DIALOG_RECORD = 0x11;
const DP_TOPIC_TASK_ARGUMENT = 0x26;
const DP_TOPICS_REMAINING = 0x20;
const DP_TOPIC_KEY = 0x1d;
const DP_DIALOG_WORK_WORD = 0x23;
const DP_TOPIC_SHIFT_FLAGS = 0x24;
const DP_DIALOG_TEXT_WINDOW = 0x14;
const DP_CURSOR_ROW = 0x4;
const DIALOG_RECORD_FIRST_ENTRY = 0x4;
const DIALOG_RECORD_END = 0xf8;
const DIALOG_FALLBACK_KEY = 0xfffd;
const DP_DIALOG_MENU_WINDOW = 0x17;
const TOPIC_MENU_BUFFER = 0x154;
const DP_TOPIC_WINDOW = 0x1a;
const DP_MENU_ROW = 4;
const DP_MENU_VISIBLE_ROWS = 6;
const DP_MENU_TOKENS = 8;
const DP_MENU_TOKEN_BANK = 10;
const DP_WINDOW_COLUMNS = 4;
const DP_WINDOW_ROWS = 6;
const DP_WINDOW_ATTRIBUTES = 8;
const DIALOG_MENU_ROW = 4;
const DIALOG_MENU_ROWS = 3;
const DIALOG_MENU_TOKENS = 0x920d;
const TOPIC_WINDOW_COLUMN = 6;
const TOPIC_WINDOW_ROW = 15;
const TOPIC_WINDOW_COLUMNS = 14;
const TOPIC_WINDOW_ROWS = 11;
const TOPIC_MENU_VISIBLE_ROWS = 9;

// Text and choice of the dialog $936C. h from dialogAccess (native-dialog-support.mjs); events is the
// shared observation set. The called routines have their own proofs; tests may replace them.
// Standard routine objects; only these are replaced by their sequences.
const STANDARD_TEXT_ROUTINES = new WeakSet();
export const dialogTextRoutines = (events) =>
  standard({
    request: (a) => requestWindowUpload(a, events, false),
    cursor: (a) => setTextCursor(a, events, false),
    text: (a) => printText(a, events, false),
    menu: (a) => runTaskMenuCompose(a, events, 0x80a6c7, false),
    allocate: (a) => {
      const p = openWindow(
        a,
        {
          mode: events.mode,
          interruptEvents: events,
          values: Object.freeze((events.values ?? []).slice(events.waitIndex)),
        },
        false,
        true,
      );
      events.waitIndex += p.waitObservationsUsed;
      events.waitEvents.push(...p.waitEvents);
      return p;
    },
    release: (a) => releaseWindow(a, events, false),
    // Topic action: JSR $C34A (append a task, proven equations) and JSR $C1CA (immediate visit of the
    // new head task) as a nested scheduler round via events.round (VM: NativeCalls.round). Without a
    // round the limit stays open. Further observations of the round are appended to the native's set.
    topic: (h) => {
      if (!events.round)
        taskStop('task_dialog_topic_visit_open', {
          pc: 0x8091ca,
          append: 0x80c34a,
          visit: 0x80c1ca,
        });
      dialogTopic(
        (a) => appendScriptTask(a, false),
        () => {
          const more = events.round(0x80c1ca);
          if (more?.wait?.length)
            events.values = Object.freeze([...(events.values ?? []), ...more.wait]);
          if (more?.input?.length)
            events.inputs = Object.freeze([...(events.inputs ?? []), ...more.input]);
        },
      )(h);
    },
  });
// Whether routines are the standard ones (not a test's replacements).
export const isStandardTextRoutines = (routines) => STANDARD_TEXT_ROUTINES.has(routines);
function standard(routines) {
  STANDARD_TEXT_ROUTINES.add(routines);
  return routines;
}
// The callee body: its own sequence for the standard routines, else one segment.
export const textBodies = (h, events, routines) => {
  const sequences = STANDARD_TEXT_ROUTINES.has(routines) ? dialogTextSequences(events) : null;
  return (name) => () =>
    sequences ? sequences[name](h.a) : segmentSequence(() => routines[name](h.a));
};

// The same routines as resumable sequences; cursor FAAC stays one segment.
export const dialogTextSequences = (events) => ({
  request: (a) => requestWindowUploadSequence(a, events, false),
  cursor: (a) => segmentSequence(() => setTextCursor(a, events, false)),
  text: (a) => printTextSequence(a, events, false),
  menu: (a) => menuComposeSequence(a, events, 0x80a6c7, false),
  allocate: function* (a) {
    const p = yield* f963Sequence(
      a,
      {
        mode: events.mode,
        interruptEvents: events,
        values: Object.freeze((events.values ?? []).slice(events.waitIndex)),
      },
      false,
    );
    yield () => {
      events.waitIndex += p.waitObservationsUsed;
      events.waitEvents.push(...p.waitEvents);
    };
    return p;
  },
  release: (a) => releaseWindowJsrSequence(a, events),
});

// The same topic action as a sequence: C34A one segment, C1CA a pausable round (NativeCalls nestedRound).
export function* dialogTopicSequence(h, events) {
  const { ctx } = h;
  yield () => {
    h.load(h.read(h.indirect(DP_DIALOG_RECORD, ctx.y)));
    h.index('x', ctx.a);
    h.load(h.dp(DP_TOPIC_TASK_ARGUMENT));
    h.dpWrite(0, ctx.a);
  };
  yield* dialogCallBody(h, 0x8091d1, 0x80c34a, () =>
    segmentSequence(() => appendScriptTask(h.a, false)),
  );
  yield* dialogCallBody(h, 0x8091d4, 0x80c1ca, function* () {
    yield { continuation: events.nestedRound(0x80c1ca) };
  });
}
// Topic action with the given append (C34A) and visit (C1CA): action word [11],Y to X, DP26 to DP00.
export const dialogTopic = (append, visit) => (h) => {
  const { ctx } = h;
  h.load(h.read(h.indirect(DP_DIALOG_RECORD, ctx.y)));
  h.index('x', ctx.a);
  h.load(h.dp(DP_TOPIC_TASK_ARGUMENT));
  h.dpWrite(0, ctx.a);
  h.call(0x8091d1, 0x80c34a, () => append(h.a));
  h.call(0x8091d4, 0x80c1ca, () => visit(h.a));
};
// 80:908C (BYTE A): number of topic IDs from the flag byte (low nibble); each ID from [11],Y is inserted into
// the value-sorted list 7E3CA3 (end FF) with flags 7E3CD6; existing IDs stay.
function runTopicsAdd(h) {
  const { ctx } = h;
  h.load(ctx.a & NIBBLE_MASK);
  h.index('y', ctx.y + 1);
  h.cmp(0);
  if (!(ctx.status & FLAG_ZERO)) {
    h.dpWrite(DP_TOPICS_REMAINING, ctx.a);
    do {
      h.load(h.read(h.indirect(DP_DIALOG_RECORD, ctx.y)));
      h.dpWrite(DP_TOPIC_KEY, ctx.a);
      h.index('y', ctx.y + 1);
      h.index('x', 0);
      let insert = false;
      for (;;) {
        h.load(h.read(WRAM + TOPIC_LIST + ctx.x));
        h.cmp(BYTE_MASK);
        if (ctx.status & FLAG_ZERO) {
          insert = true;
          break;
        }
        h.cmp(h.dp(DP_TOPIC_KEY));
        if (ctx.status & FLAG_ZERO) break;
        if (ctx.status & FLAG_CARRY) {
          insert = true;
          break;
        }
        h.index('x', ctx.x + 1);
      }
      if (insert) {
        h.load(h.read(WRAM + TOPIC_LIST + ctx.x));
        h.xba();
        h.load(h.read(WRAM + TOPIC_FLAGS + ctx.x));
        h.dpWrite(DP_DIALOG_WORK_WORD, ctx.a);
        h.load(h.dp(DP_TOPIC_KEY));
        h.write(WRAM + TOPIC_LIST + ctx.x, ctx.a);
        h.load(0);
        h.write(WRAM + TOPIC_FLAGS + ctx.x, ctx.a);
        h.index('x', ctx.x + 1);
        for (;;) {
          h.load(h.read(WRAM + TOPIC_LIST + ctx.x));
          h.xba();
          h.write(WRAM + TOPIC_LIST + ctx.x, ctx.a);
          h.cmp(BYTE_MASK);
          if (ctx.status & FLAG_ZERO) break;
          h.load(h.read(WRAM + TOPIC_FLAGS + ctx.x));
          h.dpWrite(DP_TOPIC_SHIFT_FLAGS, ctx.a);
          h.load(h.dp(DP_DIALOG_WORK_WORD));
          h.write(WRAM + TOPIC_FLAGS + ctx.x, ctx.a);
          h.load(h.dp(DP_TOPIC_SHIFT_FLAGS));
          h.dpWrite(DP_DIALOG_WORK_WORD, ctx.a);
          h.index('x', ctx.x + 1);
        }
      }
    } while (h.modify(DP_TOPICS_REMAINING, 'dec', true) !== 0);
  }
  return h.rts();
}
// 80:9178: dialog text for key A (FFFF greeting, FFFE Talk, otherwise a topic): request window DP14
// (FA67), cursor (FAAC), look up the entry in record [11] from Y=4 (end F8: back at FFFD, otherwise
// again with FFFD). Hit: topic IDs via 908C, text via FE69; flag bit 7 skips the action word
// before it and runs the topic action.
export function showDialogText(h, events, routines = dialogTextRoutines(events)) {
  return drainNativeSequence(showDialogTextSequence(h, events, routines));
}
export function* showDialogTextSequence(h, events, routines = dialogTextRoutines(events)) {
  const { ctx } = h,
    body = textBodies(h, events, routines);
  for (;;) {
    yield () => {
      h.dpWrite(DP_TOPIC_KEY, ctx.a, 2);
      h.load(h.dp(DP_DIALOG_TEXT_WINDOW));
      h.dpWrite(0, ctx.a);
    };
    yield* dialogCallBody(h, 0x80917e, 0x80fa67, body('request'));
    yield () => {
      h.dpWrite(2, 0, 2);
      h.dpWrite(DP_CURSOR_ROW, 0, 2);
    };
    yield* dialogCallBody(h, 0x809185, 0x80faac, body('cursor'));
    let found = false,
      missing = false;
    yield () => {
      h.sep(FLAG_MEMORY_8BIT);
      h.index('y', DIALOG_RECORD_FIRST_ENTRY);
      for (;;) {
        h.load(h.read(h.indirect(DP_DIALOG_RECORD, ctx.y)));
        h.cmp(DIALOG_RECORD_END);
        if (ctx.status & FLAG_ZERO) break;
        h.index('y', ctx.y + 1);
        h.cmp(h.dp(DP_TOPIC_KEY));
        if (ctx.status & FLAG_ZERO) {
          h.index('y', ctx.y + 1);
          h.load(h.read(h.indirect(DP_DIALOG_RECORD, ctx.y)));
          h.pha();
          h.call(0x8091ae, 0x80908c, () => runTopicsAdd(h));
          h.pla();
          h.asl();
          h.rep(FLAG_MEMORY_8BIT);
          h.php();
          h.phy();
          const action = (ctx.status & FLAG_CARRY) !== 0;
          if (action) {
            h.index('y', ctx.y + 1);
            h.index('y', ctx.y + 1);
          }
          h.load(h.read(h.indirect(DP_DIALOG_RECORD, ctx.y)));
          h.dpWrite(2, ctx.a);
          h.load(h.dp(DP_DIALOG_TEXT_WINDOW));
          h.dpWrite(0, ctx.a);
          found = true;
          return;
        }
        h.rep(FLAG_MEMORY_8BIT);
        h.load(h.read(h.indirect(DP_DIALOG_RECORD, ctx.y)) & BYTE_MASK);
        h.dpWrite(DP_DIALOG_WORK_WORD, ctx.a);
        h.load(ctx.y);
        ctx.status &= ~FLAG_CARRY;
        h.adc(h.dp(DP_DIALOG_WORK_WORD));
        h.index('y', ctx.a);
        h.sep(FLAG_MEMORY_8BIT);
      }
      h.rep(FLAG_MEMORY_8BIT);
      h.load(DIALOG_FALLBACK_KEY);
      h.cmp(h.dp(DP_TOPIC_KEY));
      missing = Boolean(ctx.status & FLAG_ZERO);
    };
    if (found) {
      yield* dialogCallBody(h, 0x8091c3, 0x80fe69, body('text'));
      // The topic action owns a nested scheduler round: with the standard routines and a pausable
      // round (events.nestedRound) the visit pauses like any wait, otherwise it stays synchronous.
      let action = false;
      yield () => {
        h.ply();
        h.plp();
        action = Boolean(ctx.status & FLAG_CARRY);
      };
      if (action) {
        if (events.nestedRound && STANDARD_TEXT_ROUTINES.has(routines))
          yield* dialogTopicSequence(h, events);
        else yield () => routines.topic(h);
      }
      let result;
      yield () => {
        result = h.rts();
      };
      return result;
    }
    if (missing) {
      let result;
      yield () => {
        result = h.rts();
      };
      return result;
    }
  }
}
// 80:91E2: main menu of the dialog (Exit/Talk/Ask about, list 80:920D) in window DP17 via A6C7;
// cancel (FFFF) sets $1D63.
export function chooseDialogAction(h, events, routines = dialogTextRoutines(events)) {
  return drainNativeSequence(chooseDialogActionSequence(h, events, routines));
}
export function* chooseDialogActionSequence(h, events, routines = dialogTextRoutines(events)) {
  const { ctx } = h,
    body = textBodies(h, events, routines);
  yield () => {
    h.load(h.dp(DP_DIALOG_MENU_WINDOW));
    h.dpWrite(0, ctx.a);
    for (const [o, v] of [
      [2, 2],
      [DP_MENU_ROW, DIALOG_MENU_ROW],
      [DP_MENU_VISIBLE_ROWS, DIALOG_MENU_ROWS],
      [DP_MENU_TOKENS, DIALOG_MENU_TOKENS],
      [DP_MENU_TOKEN_BANK, CODE_BANK],
    ]) {
      h.load(v);
      h.dpWrite(o, ctx.a);
    }
  };
  yield* dialogCallBody(h, 0x8091ff, 0x80a6c7, body('menu'));
  let result;
  yield () => {
    h.load(h.dp(0));
    h.cmp(WORD_MASK);
    if (ctx.status & FLAG_ZERO) h.write(h.abs(DIALOG_END), ctx.a);
    result = h.rts();
  };
  return result;
}
// 80:9215: topic choice: texts of the IDs from 7E3CA3 without a flag in 7E3CD6 (tokens 8D:8000) to $0154,
// window via F963, menu A6C7, release FA3E. Result DP00: FFFF without topics or on cancel, otherwise
// the list index of the chosen topic.
export function chooseDialogTopic(h, events, routines = dialogTextRoutines(events)) {
  return drainNativeSequence(chooseDialogTopicSequence(h, events, routines));
}
export function* chooseDialogTopicSequence(h, events, routines = dialogTextRoutines(events)) {
  const { ctx } = h,
    body = textBodies(h, events, routines);
  let none = false,
    result;
  yield () => {
    const empty = () => {
      h.load(WORD_MASK);
      h.dpWrite(0, ctx.a);
      result = h.rts();
      none = true;
    };
    h.load(h.read(WRAM + TOPIC_LIST) & BYTE_MASK);
    h.cmp(BYTE_MASK);
    if (ctx.status & FLAG_ZERO) return empty();
    h.index('x', 0);
    h.index('y', ctx.x);
    for (;;) {
      h.load(h.read(WRAM + TOPIC_LIST + ctx.x) & BYTE_MASK);
      h.cmp(BYTE_MASK);
      if (ctx.status & FLAG_ZERO) break;
      h.dpWrite(DP_DIALOG_WORK_WORD, ctx.a);
      h.load(h.read(WRAM + TOPIC_FLAGS + ctx.x) & BYTE_MASK);
      if (ctx.status & FLAG_ZERO) {
        h.phx();
        h.load(h.dp(DP_DIALOG_WORK_WORD));
        h.asl();
        h.index('x', ctx.a);
        h.load(h.read(0x8d8000 + ctx.x));
        h.write(h.abs(TOPIC_MENU_BUFFER) + ctx.y, ctx.a);
        h.plx();
        h.index('y', ctx.y + 1);
        h.index('y', ctx.y + 1);
      }
      h.index('x', ctx.x + 1);
    }
    h.cpy(0);
    if (ctx.status & FLAG_ZERO) return empty();
    h.load(0);
    h.write(h.abs(TOPIC_MENU_BUFFER) + ctx.y, ctx.a);
    for (const [o, v] of [
      [0, TOPIC_WINDOW_COLUMN],
      [2, TOPIC_WINDOW_ROW],
      [DP_WINDOW_COLUMNS, TOPIC_WINDOW_COLUMNS],
      [DP_WINDOW_ROWS, TOPIC_WINDOW_ROWS],
      [DP_WINDOW_ATTRIBUTES, 0],
    ]) {
      h.load(v);
      h.dpWrite(o, ctx.a);
    }
  };
  if (none) return result;
  if (h.a.mem?.language)
    fitListWindow(h.a.mem, h, listTextIds(h.a.mem, WRAM + TOPIC_MENU_BUFFER, TOPICS));
  yield* dialogCallBody(h, 0x809278, 0x80f963, body('allocate'));
  yield () => {
    h.load(h.dp(0));
    h.dpWrite(DP_TOPIC_WINDOW, ctx.a);
    for (const [o, v] of [
      [2, 1],
      [DP_MENU_ROW, 0],
      [DP_MENU_VISIBLE_ROWS, TOPIC_MENU_VISIBLE_ROWS],
      [DP_MENU_TOKENS, TOPIC_MENU_BUFFER],
      [DP_MENU_TOKEN_BANK, WRAM_BANK],
    ]) {
      h.load(v);
      h.dpWrite(o, ctx.a);
    }
  };
  yield* dialogCallBody(h, 0x809298, 0x80a6c7, body('menu'));
  yield () => {
    h.push(h.dp(0, 2), 2);
    h.load(h.dp(DP_TOPIC_WINDOW));
    h.dpWrite(0, ctx.a);
  };
  yield* dialogCallBody(h, 0x8092a1, 0x80fa3e, body('release'));
  yield () => {
    h.index('y', h.pull(2));
    h.cpy(WORD_MASK);
    if (ctx.status & FLAG_ZERO) {
      h.write(h.abs(DIALOG_END), ctx.y);
      h.dpWrite(0, ctx.y);
      result = h.rts();
      return;
    }
    h.index('x', 0);
    for (;;) {
      h.load(h.read(WRAM + TOPIC_FLAGS + ctx.x) & BYTE_MASK);
      if (ctx.status & FLAG_ZERO) {
        h.index('y', ctx.y - 1);
        if (ctx.status & FLAG_NEGATIVE) break;
      }
      h.index('x', ctx.x + 1);
    }
    h.dpWrite(0, ctx.x);
    result = h.rts();
  };
  return result;
}
