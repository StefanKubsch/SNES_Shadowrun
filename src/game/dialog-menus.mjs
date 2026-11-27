// The dialog's main menu and topic choice (docs/READABLE-GAME.md, dialog pilot).
//
// The main menu lists Exit, Talk and Ask about in the dialog's menu window, from its
// fourth row. A cancel ends the dialog. It returns the chosen row.
//
// The topic choice lists the names of the known topics that are not hidden. Without such
// a topic it returns NO_CHOICE. Otherwise it opens a window for the list (14 x 11 cells
// at column 6, row 15; another text language may widen it), shows nine rows of it and
// releases the window again. A cancel ends the dialog; otherwise it returns the chosen
// topic's place in the list of known topics.
import { drawTextBuffer } from './text-draw.mjs';
import { chooseFromList, NO_CHOICE } from './menu-choice.mjs';
import { translatedListWindow } from '../data/menu-layout.mjs';
import { openWindowAt } from './window-open.mjs';
import { releaseWindowAt } from './window-release.mjs';
import { dialogContent } from '../content/dialogs.mjs';
import { dialogState, NONE, TOPIC_LIST_END } from '../state/dialog.mjs';

export { NO_CHOICE };
const MAIN_MENU = Object.freeze({ column: 2, row: 4, visibleRows: 3 }),
  TOPIC_WINDOW = Object.freeze({ left: 6, top: 15, columns: 14, rows: 11 }),
  TOPIC_MENU = Object.freeze({ column: 1, row: 0, visibleRows: 9 });

// The dialog's main menu; returns the chosen row.
export function* chooseDialogAction(h, events, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    state = dialogState(mem);
  const row = yield* chooseFromList(h, events, renderBuffer, {
    ...MAIN_MENU,
    window: state.menuWindow,
    items: dialogContent(mem).menu,
  });
  if (row === NO_CHOICE) yield () => (state.endWord = NONE);
  return row;
}

// The places of the known topics that are not hidden.
function shownTopics(state) {
  const places = [];
  for (let place = 0; state.topic(place) !== TOPIC_LIST_END; place++)
    if (!state.topicFlag(place)) places.push(place);
  return places;
}

// The dialog's topic choice; returns the chosen topic's place in the known topics.
export function* chooseDialogTopic(h, events, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    state = dialogState(mem),
    { topicNames } = dialogContent(mem);
  const places = shownTopics(state);
  if (!places.length) return NO_CHOICE;
  const items = places.map((place) => topicNames[state.topic(place)]);
  const shape = mem.language ? translatedListWindow(mem, TOPIC_WINDOW, items) : TOPIC_WINDOW;
  const window = yield* openWindowAt(h, events, [shape.left, shape.top, shape.columns, shape.rows]);
  const row = yield* chooseFromList(h, events, renderBuffer, { ...TOPIC_MENU, window, items });
  yield* releaseWindowAt(h, events, window);
  if (row === NO_CHOICE) {
    yield () => (state.endWord = NONE);
    return NO_CHOICE;
  }
  return places[row];
}
