// Skill values and cyberware notes of the selected runner. Leadership retains
// its original second use as the Skillsoft note; it is not a separate flag.
import { memberMenuState } from '../state/member-menu.mjs';
import { memberMenuContent } from '../content/member-menus.mjs';
import { jakeState } from '../state/jake.mjs';
import { writeStateWord } from '../state/objects.mjs';
import { openWindowAt } from './window-open.mjs';
import { releaseWindowAt } from './window-release.mjs';
import { setTextCursorAt, printNumber } from './window-text.mjs';
import { printText } from './text-print.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { waitForConfirmKey } from './confirm-key.mjs';
import {
  NOTES_WINDOW,
  TEXT_DATAJACK,
  TEXT_DERMAL_ARMOUR,
  TEXT_HEAD_COMPUTER,
  TEXT_SKILLSOFT,
  TEXT_WIRED_REFLEXES,
  translatedSkillWindow,
} from '../system/native-status-screen.mjs';
import { JAKE_OBJECT_NUMBER } from '../data/runners.mjs';
import { translatedListWindow } from '../data/menu-layout.mjs';
import { WORD_MASK } from '../constants/bits.mjs';

const CYBERWARE = Object.freeze([
  ['dermalArmour', TEXT_DERMAL_ARMOUR],
  ['skillsoft', TEXT_SKILLSOFT],
  ['wiredReflexes', TEXT_WIRED_REFLEXES],
]);
const cyberware = (mem, name) =>
  name === 'skillsoft' ? jakeState(mem).skills.leadership : jakeState(mem)[name];
function* text(h, events, renderBuffer, value) {
  yield () => writeStateWord(h.a.mem.wram, 2, value);
  yield* printText(h, events, renderBuffer);
}
function* cursor(h, window, column, row) {
  yield () => setTextCursorAt(h, window, column, row);
}
export function* skills(h, events, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    state = memberMenuState(mem),
    definitions = memberMenuContent(mem).skills,
    shape = translatedSkillWindow(mem);
  let known;
  yield () => {
    known = definitions.filter(({ field }) => state.stats.skills[field] !== 0).length;
  };
  if (!known) return;
  const window = yield* openWindowAt(h, events, [shape.left, shape.top, shape.columns, known + 2]);
  yield () => {
    state.submenuWindow = window;
  };
  let row = 0;
  for (const skill of definitions) {
    let value;
    yield () => {
      value = state.stats.skills[skill.field];
    };
    if (!value) continue;
    yield* cursor(h, window, 0, row);
    yield* text(h, events, renderBuffer, skill.text);
    yield* cursor(h, window, shape.valueColumn, row);
    yield () => writeStateWord(mem.wram, 2, value);
    row++;
    yield* printNumber(h, events, renderBuffer);
  }
  yield* waitForConfirmKey(h, events);
  yield () => {
    if (state.selectPressed) state.endWord = WORD_MASK;
  };
  yield* releaseWindowAt(h, events, state.submenuWindow);
}
export function* notes(h, events, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    state = memberMenuState(mem);
  let jake, rows;
  yield () => {
    jake = state.number === JAKE_OBJECT_NUMBER;
    if (!jake && !state.datajack) return;
    rows = jake
      ? NOTES_WINDOW.jakeRows + CYBERWARE.filter(([name]) => cyberware(mem, name)).length
      : NOTES_WINDOW.runnerRows;
  };
  if (rows === undefined) return;
  const ids = jake
      ? [TEXT_HEAD_COMPUTER, TEXT_DATAJACK, ...CYBERWARE.map(([, id]) => id)]
      : [TEXT_DATAJACK],
    shape = mem.language
      ? translatedListWindow(mem, NOTES_WINDOW, ids, { column: 0 })
      : NOTES_WINDOW,
    window = yield* openWindowAt(h, events, [shape.left, shape.top, shape.columns, rows]);
  if (jake) {
    yield* text(h, events, renderBuffer, TEXT_HEAD_COMPUTER);
    yield* cursor(h, window, 0, 1);
  }
  yield* text(h, events, renderBuffer, TEXT_DATAJACK);
  if (jake) {
    let row = 1;
    for (const [name, id] of CYBERWARE) {
      let fitted;
      yield () => {
        fitted = cyberware(mem, name);
      };
      if (!fitted) continue;
      yield* cursor(h, window, 0, ++row);
      yield* text(h, events, renderBuffer, id);
    }
  }
  yield* waitForConfirmKey(h, events);
  yield* releaseWindowAt(h, events, window);
}
