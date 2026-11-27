// The dialog's texts (docs/READABLE-GAME.md, dialog pilot).
//
// A text key is a topic number or one of the named keys: the greeting, the talk text and
// the fallback. The dialog looks up the first entry of its record that answers the key
// (comparing the key's low byte, as the original does). The text window is cleared first
// and its cursor put at the top left. The entry adds its topics to the known topics and
// shows its text; an entry with a script then starts that script for the dialog partner
// and runs it at once. Without an entry for the key the fallback entry answers, and
// without a fallback entry nothing is shown.
//
// The known topics stay sorted and end with TOPIC_LIST_END: a new topic is inserted
// before the first larger one, the topics after it move up one place with their flags,
// and a topic already known stays where it is. The list has no capacity check, as in the
// original (docs/BUGFIXES.md, keyword overflow).
import { clearWindowText } from './window-open.mjs';
import { setTextCursorAt } from './window-text.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { printTextIn } from './text-print.mjs';
import { appendScript } from '../script/task-api.mjs';
import { scriptVisitSequence } from '../system/script-visit.mjs';
import { taskStop } from '../system/task-stop.mjs';
import { dialogContent, FALLBACK, GREETING, TALK } from '../content/dialogs.mjs';
import { textOfNumber } from '../content/texts.mjs';
import { dialogState, TOPIC_LIST_END } from '../state/dialog.mjs';
import { FIRST_ARGUMENT, leafArgument, setLeafWord } from '../system/native-leaf-support.mjs';

// The keys as the callers pass them.
export const GREETING_KEY = 0xffff,
  TALK_KEY = 0xfffe,
  FALLBACK_KEY = 0xfffd;
const KEY_BYTE = 0xff;
// The byte each named key compares as.
const NAMED_KEYS = { [GREETING]: 0xff, [TALK]: 0xfe, [FALLBACK]: 0xfd };
const keyByte = (key) => NAMED_KEYS[key] ?? key;

// Insert a topic into the known topics, unless it is known already.
function learnTopic(state, topic) {
  let place = 0;
  for (; ; place++) {
    const known = state.topic(place);
    if (known !== TOPIC_LIST_END && known === topic) return;
    if (known === TOPIC_LIST_END || known > topic) break;
  }
  // Move the rest up one place with their flags, the end marker last.
  let moved = state.topic(place),
    movedFlag = state.topicFlag(place);
  state.setTopic(place, topic);
  state.setTopicFlag(place, 0);
  while (moved !== TOPIC_LIST_END) {
    place++;
    const next = state.topic(place),
      nextFlag = state.topicFlag(place);
    state.setTopic(place, moved);
    state.setTopicFlag(place, movedFlag);
    moved = next;
    movedFlag = nextFlag;
  }
  state.setTopic(place + 1, TOPIC_LIST_END);
}

// Show the dialog's text for a key in the dialog's text window.
export function* showDialogText(h, events, renderBuffer = drawTextBuffer, key, dialog) {
  const { mem } = h.a,
    state = dialogState(mem);
  for (;;) {
    const window = state.textWindow;
    yield* clearWindowText(h, events, window);
    yield () => setTextCursorAt(h, window);
    const entry = dialog.entries.find((e) => keyByte(e.key) === (key & KEY_BYTE));
    if (!entry) {
      if (key === FALLBACK_KEY) return;
      key = FALLBACK_KEY;
      continue;
    }
    yield () => {
      for (const topic of entry.topics) learnTopic(state, topic);
    };
    yield* printTextIn(h, events, renderBuffer, state.textWindow, entry.text);
    if (entry.script !== null) yield* startDialogScript(h, events, entry.script);
    return;
  }
}

// Start a dialog entry's script for the dialog partner and run it at once.
export function* startDialogScript(h, events, script) {
  yield () => {
    if (!events.nestedHeadVisit && !events.headVisit && !events.nestedRound && !events.round)
      taskStop('task_dialog_topic_visit_open', { script });
    // The partner is the script's argument.
    setLeafWord(h.a, FIRST_ARGUMENT, dialogState(h.a.mem).partner);
  };
  yield () => appendScript(h.a, script);
  yield* scriptVisitSequence(events, 'task_dialog_topic_visit_open', (more) => {
    if (more?.wait?.length) events.values = Object.freeze([...(events.values ?? []), ...more.wait]);
    if (more?.input?.length)
      events.inputs = Object.freeze([...(events.inputs ?? []), ...more.input]);
  });
}

// The script natives that print a text by number (first argument) into the dialog's text
// window: one at the window's cursor, the other into the cleared window from its top left.
export function* printWindowTextSequence(h, events, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    text = textOfNumber(mem, leafArgument(h.a, FIRST_ARGUMENT));
  yield* printTextIn(h, events, renderBuffer, dialogState(mem).textWindow, text);
}
export function* printTopicTextSequence(h, events, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    text = textOfNumber(mem, leafArgument(h.a, FIRST_ARGUMENT)),
    window = dialogState(mem).textWindow;
  yield* clearWindowText(h, events, window);
  yield () => setTextCursorAt(h, window);
  yield* printTextIn(h, events, renderBuffer, window, text);
}

// The record of a dialog number.
export const dialogRecord = (mem, number) => dialogContent(mem).dialogs[number];
