import { jakeState } from '../state/jake.mjs';
import { readStateByte, writeStateByte } from '../state/objects.mjs';
// The skills and notes submenus of the status screen (lifted from 80:E834 and 80:E8C8;
// register-level versions in proof/replay/native-status-screen.mjs).
//
// Skills (80:E834): the runner's six skill bytes (record bytes 0 to 5 at the long
// pointer DP F9) that are not zero, each with its name (80:E8BC) and value, in a window
// at 0D, 0C with 0F columns and two rows more than skills (its number in 1F50). After a
// key (80:F953) Select ends the status screen (7E:1D63 FFFF); the window is released.
// Without skills nothing happens.
//
// Notes (80:E8C8): a runner other than Jake shows "Datajack" in a window at 11, 10
// with 0C columns and three rows when it has one (1F56). Jake's window has four rows
// plus one per cyberware (dermal armour 7E:3C18, skillsoft 3C05, wired reflexes 3C19):
// the head computer title, "Datajack" and the cyberware from row 2. A key ends both.
// The callees (window 80:F963, cursor 80:FAAC, text 80:FE69, number 80:FD80, key wait
// 80:F953, release 80:FA3E) compose directly through their original frames.
//
// Registers (user decision 2026-11-17): game state only; no callee takes a register
// input and no register values are left.
import { segmentSequence } from '../system/sequence-runner.mjs';
import { openWindow } from './window-open.mjs';
import { releaseWindowSequence } from './window-release.mjs';
import { setTextCursor, printNumber } from './window-text.mjs';
import { printText } from './text-print.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { waitForConfirmKey } from './confirm-key.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import {
  NOTES_WINDOW,
  SKILL_NAMES,
  TEXT_DATAJACK,
  TEXT_DERMAL_ARMOUR,
  TEXT_HEAD_COMPUTER,
  TEXT_SKILLSOFT,
  TEXT_WIRED_REFLEXES,
  translatedSkillWindow,
} from '../system/native-status-screen.mjs';
import {
  DIALOG_END,
  DP_CURSOR_ROW,
  DP_MEMBER_RECORD,
  DP_MEMBER_RECORD_BANK,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  MEMBER_DATAJACK,
  MEMBER_NUMBER,
  PAD_PRESSED,
  PAD_SELECT,
  STATUS_SUBMENU_WINDOW,
} from '../data/wram.mjs';
import { JAKE_OBJECT_NUMBER, SKILL_COUNT } from '../data/runners.mjs';
import { fitListWindow } from '../data/menu-layout.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

// The skills window's extra rows; the first cyberware row of Jake's notes.
const SKILL_EXTRA_ROWS = 2,
  DATAJACK_ROW = 1,
  ENDED = WORD_MASK;
// Jake's cyberware: its flag byte and text.
const CYBERWARE = Object.freeze([
  ['dermalArmour', TEXT_DERMAL_ARMOUR],
  ['skillsoft', TEXT_SKILLSOFT],
  ['wiredReflexes', TEXT_WIRED_REFLEXES],
]);

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
// A byte of the runner's record (long pointer DP F9).
function recordByte(mem, offset) {
  const { wram } = mem,
    record =
      word(wram, DP_MEMBER_RECORD) | (readStateByte(wram, DP_MEMBER_RECORD_BANK) << WORD_BITS);
  return mem.read8((record + offset) & LONG_MASK);
}
// Skillsoft and Leadership intentionally share the original saved byte.
const cyberware = (mem, name) =>
  name === 'skillsoft' ? jakeState(mem).skills.leadership : jakeState(mem)[name];
// The window's place, size and plain attributes in the direct page.
function setWindow(h, { left, top, columns }, rows) {
  const { wram } = h.a.mem;
  if (rows !== undefined) setWord(wram, DP_WINDOW_ROWS, rows);
  setWord(wram, DP_WINDOW_LEFT, left);
  setWord(wram, DP_WINDOW_TOP, top);
  setWord(wram, DP_WINDOW_COLUMNS, columns);
  setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
}

// 80:E834: the skills, composing live callees directly, for lifted callers without the
// JSR frame (the confirm key keeps its own).
export function* skills(h, events, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    { wram } = mem,
    window = translatedSkillWindow(h.a.mem);
  let known = 0;
  yield () => {
    for (let skill = 0; skill < SKILL_COUNT; skill++) if (recordByte(mem, skill)) known++;
    if (known) setWindow(h, window, known + SKILL_EXTRA_ROWS);
  };
  if (!known) return;
  yield* openWindow(h, events);
  yield () => {
    setDataBankWord(mem, STATUS_SUBMENU_WINDOW, 0, word(wram, 0));
    setWord(wram, DP_CURSOR_ROW, 0);
  };
  for (let skill = 0; skill < SKILL_COUNT; skill++) {
    let value;
    yield () => {
      value = recordByte(mem, skill);
    };
    if (value) {
      let name;
      yield () => {
        name = dataBankWord(mem, SKILL_NAMES, skill << 1);
        setWord(wram, 2, 0);
      };
      yield* segmentSequence(() => setTextCursor(h));
      yield () => setWord(wram, 2, name);
      yield* printText(h, events, renderBuffer);
      yield () => setWord(wram, 2, window.valueColumn);
      yield* segmentSequence(() => setTextCursor(h));
      yield () => {
        setWord(wram, DP_CURSOR_ROW, (word(wram, DP_CURSOR_ROW) + 1) & WORD_MASK);
        setWord(wram, 2, value);
      };
      yield* printNumber(h, events, renderBuffer);
    }
  }
  yield* waitForConfirmKey(h, events);
  yield () => {
    if (word(wram, PAD_PRESSED) & PAD_SELECT) setWord(wram, DIALOG_END, ENDED);
    setWord(wram, 0, dataBankWord(mem, STATUS_SUBMENU_WINDOW));
  };
  yield* releaseWindowSequence(h, events);
}

// 80:E8C8: the notes (see above), for lifted callers without the JSR frame (the confirm
// key keeps its own).
export function* notes(h, events, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    { wram } = mem;
  const text = function* (value) {
    yield () => setWord(wram, 2, value);
    yield* printText(h, events, renderBuffer);
  };
  let jake, datajack;
  yield () => {
    jake = dataBankWord(mem, MEMBER_NUMBER) === JAKE_OBJECT_NUMBER;
    if (jake) {
      let rows = NOTES_WINDOW.jakeRows;
      for (const [flag] of CYBERWARE) if (cyberware(mem, flag)) rows++;
      setWindow(h, NOTES_WINDOW, rows);
      fitListWindow(mem, [TEXT_HEAD_COMPUTER, TEXT_DATAJACK, ...CYBERWARE.map(([, id]) => id)], {
        column: 0,
      });
      return;
    }
    datajack = dataBankWord(mem, MEMBER_DATAJACK);
    if (!datajack) return;
    setWindow(h, NOTES_WINDOW, NOTES_WINDOW.runnerRows);
    fitListWindow(mem, [TEXT_DATAJACK], { column: 0 });
  };
  if (!jake) {
    if (!datajack) return;
    yield* openWindow(h, events);
    yield* text(TEXT_DATAJACK);
    yield* waitForConfirmKey(h, events);
    yield* releaseWindowSequence(h, events);
    return;
  }
  yield* openWindow(h, events);
  yield* text(TEXT_HEAD_COMPUTER);
  yield () => {
    setWord(wram, 2, 0);
    setWord(wram, DP_CURSOR_ROW, DATAJACK_ROW);
  };
  yield* segmentSequence(() => setTextCursor(h));
  yield* text(TEXT_DATAJACK);
  // The cyberware rows count from the datajack's.
  yield () => setWord(wram, DP_CURSOR_ROW, DATAJACK_ROW);
  for (const [flag, id] of CYBERWARE) {
    let fitted;
    yield () => {
      fitted = cyberware(mem, flag);
      if (!fitted) return;
      setWord(wram, 2, 0);
      setWord(wram, DP_CURSOR_ROW, (word(wram, DP_CURSOR_ROW) + 1) & WORD_MASK);
    };
    if (!fitted) continue;
    yield* segmentSequence(() => setTextCursor(h));
    yield* text(id);
  }
  yield* waitForConfirmKey(h, events);
  yield* releaseWindowSequence(h, events);
}
