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
import { dialogCallBody, segmentSequence } from '../system/native-call-continuation.mjs';
import { openWindow } from './window-open.mjs';
import { releaseWindowSequence } from './window-release.mjs';
import { setTextCursorRoutine, printNumberSequence } from './window-text.mjs';
import { printText } from './text-print.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import { waitForConfirmKeySequence } from './confirm-key.mjs';
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
  JAKE_DERMAL_ARMOUR,
  JAKE_SKILLSOFT,
  JAKE_WIRED_REFLEXES,
  MEMBER_DATAJACK,
  MEMBER_NUMBER,
  PAD_PRESSED,
  PAD_SELECT,
  STATUS_SUBMENU_WINDOW,
} from '../data/wram.mjs';
import { JAKE_OBJECT_NUMBER, SKILL_COUNT } from '../data/runners.mjs';
import { fitListWindow } from '../data/menu-layout.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

const CURSOR = 0x80faac,
  NUMBER = 0x80fd80,
  CONFIRM_KEY = 0x80f953,
  RELEASE_WINDOW = 0x80fa3e;
// The skills window's extra rows; the first cyberware row of Jake's notes.
const SKILL_EXTRA_ROWS = 2,
  DATAJACK_ROW = 1,
  ENDED = WORD_MASK;
// Jake's cyberware: its flag byte, text and the cursor call site.
const CYBERWARE = Object.freeze([
  [JAKE_DERMAL_ARMOUR, TEXT_DERMAL_ARMOUR, 0x80e966],
  [JAKE_SKILLSOFT, TEXT_SKILLSOFT, 0x80e97e],
  [JAKE_WIRED_REFLEXES, TEXT_WIRED_REFLEXES, 0x80e996],
]);

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
function* returnSequence(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
// A byte of the runner's record (long pointer DP F9).
function recordByte(mem, offset) {
  const { wram } = mem,
    record = word(wram, DP_MEMBER_RECORD) | (wram[DP_MEMBER_RECORD_BANK] << WORD_BITS);
  return mem.read8((record + offset) & LONG_MASK);
}
// The window's place, size and plain attributes in the direct page.
function setWindow(h, { left, top, columns }, rows) {
  const { wram } = h.a.mem;
  if (rows !== undefined) setWord(wram, DP_WINDOW_ROWS, rows);
  setWord(wram, DP_WINDOW_LEFT, left);
  setWord(wram, DP_WINDOW_TOP, top);
  setWord(wram, DP_WINDOW_COLUMNS, columns);
  setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
}

// 80:E834: skills compose live callees directly and end with their RTS.
export function* skillsSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const { mem } = h.a,
    { wram } = mem,
    window = translatedSkillWindow(h.a.mem);
  let known = 0;
  yield () => {
    for (let skill = 0; skill < SKILL_COUNT; skill++) if (recordByte(mem, skill)) known++;
    if (known) setWindow(h, window, known + SKILL_EXTRA_ROWS);
  };
  if (!known) return yield* returnSequence(h);
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
      yield* dialogCallBody(h, 0x80e882, CURSOR, () =>
        segmentSequence(() => setTextCursorRoutine(h)),
      );
      yield () => setWord(wram, 2, name);
      yield* printText(h, events, renderBuffer);
      yield () => setWord(wram, 2, window.valueColumn);
      yield* dialogCallBody(h, 0x80e890, CURSOR, () =>
        segmentSequence(() => setTextCursorRoutine(h)),
      );
      yield () => {
        setWord(wram, DP_CURSOR_ROW, (word(wram, DP_CURSOR_ROW) + 1) & WORD_MASK);
        setWord(wram, 2, value);
      };
      yield* dialogCallBody(h, 0x80e898, NUMBER, () =>
        printNumberSequence(h, events, renderBuffer),
      );
    }
  }
  yield* dialogCallBody(h, 0x80e8a2, CONFIRM_KEY, () => waitForConfirmKeySequence(h, events));
  yield () => {
    if (word(wram, PAD_PRESSED) & PAD_SELECT) setWord(wram, DIALOG_END, ENDED);
    setWord(wram, 0, dataBankWord(mem, STATUS_SUBMENU_WINDOW));
  };
  yield* dialogCallBody(h, 0x80e8b8, RELEASE_WINDOW, () =>
    (function* () {
      yield* releaseWindowSequence(h, events);
      return yield* returnSequence(h);
    })(),
  );
  return yield* returnSequence(h);
}

// 80:E8C8: the notes (see above). A sequence that ends with its RTS.
export function* notesSequence(h, events, renderBuffer = drawTextBufferSequence) {
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
      for (const [flag] of CYBERWARE) if (wram[flag]) rows++;
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
    if (!datajack) return yield* returnSequence(h);
    yield* openWindow(h, events);
    yield* text(TEXT_DATAJACK);
    yield* dialogCallBody(h, 0x80e8f9, CONFIRM_KEY, () => waitForConfirmKeySequence(h, events));
    yield* dialogCallBody(h, 0x80e8fc, RELEASE_WINDOW, () =>
      (function* () {
        yield* releaseWindowSequence(h, events);
        return yield* returnSequence(h);
      })(),
    );
    return yield* returnSequence(h);
  }
  yield* openWindow(h, events);
  yield* text(TEXT_HEAD_COMPUTER);
  yield () => {
    setWord(wram, 2, 0);
    setWord(wram, DP_CURSOR_ROW, DATAJACK_ROW);
  };
  yield* dialogCallBody(h, 0x80e949, CURSOR, () => segmentSequence(() => setTextCursorRoutine(h)));
  yield* text(TEXT_DATAJACK);
  // The cyberware rows count from the datajack's.
  yield () => setWord(wram, DP_CURSOR_ROW, DATAJACK_ROW);
  for (const [flag, id, cursorPc] of CYBERWARE) {
    let fitted;
    yield () => {
      fitted = wram[flag];
      if (!fitted) return;
      setWord(wram, 2, 0);
      setWord(wram, DP_CURSOR_ROW, (word(wram, DP_CURSOR_ROW) + 1) & WORD_MASK);
    };
    if (!fitted) continue;
    yield* dialogCallBody(h, cursorPc, CURSOR, () =>
      segmentSequence(() => setTextCursorRoutine(h)),
    );
    yield* text(id);
  }
  yield* dialogCallBody(h, 0x80e9a1, CONFIRM_KEY, () => waitForConfirmKeySequence(h, events));
  yield* dialogCallBody(h, 0x80e9a4, RELEASE_WINDOW, () =>
    (function* () {
      yield* releaseWindowSequence(h, events);
      return yield* returnSequence(h);
    })(),
  );
  return yield* returnSequence(h);
}
