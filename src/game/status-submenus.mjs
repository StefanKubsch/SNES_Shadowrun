// The skills and notes submenus of the status screen (lifted from 80:E834 and 80:E8C8;
// register-level versions in src/task/native-status-screen.mjs).
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
// 80:F953, release 80:FA3E) run through their frames from the routine table.
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
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
} from '../task/native-status-screen.mjs';
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
} from '../task/wram.mjs';
import { JAKE_OBJECT_NUMBER, SKILL_COUNT } from '../data/runners.mjs';
import { fitListWindow } from '../data/menu-layout.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const OPEN_WINDOW = 0x80f963,
  CURSOR = 0x80faac,
  TEXT = 0x80fe69,
  NUMBER = 0x80fd80,
  CONFIRM_KEY = 0x80f953,
  RELEASE_WINDOW = 0x80fa3e;
// The skills window's extra rows; the first cyberware row of Jake's notes.
const SKILL_EXTRA_ROWS = 2,
  DATAJACK_ROW = 1,
  ENDED = WORD_MASK;
// Jake's cyberware: its flag byte, text and the cursor and text call sites.
const CYBERWARE = Object.freeze([
  [JAKE_DERMAL_ARMOUR, TEXT_DERMAL_ARMOUR, [0x80e966, 0x80e96e]],
  [JAKE_SKILLSOFT, TEXT_SKILLSOFT, [0x80e97e, 0x80e986]],
  [JAKE_WIRED_REFLEXES, TEXT_WIRED_REFLEXES, [0x80e996, 0x80e99e]],
]);

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const setFlag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const setSignZero = (ctx, value) => {
  setFlag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
  setFlag(ctx, FLAG_ZERO, value === 0);
};
const load = (ctx, value) => {
  ctx.a = value;
  setSignZero(ctx, value);
};
const call = (h, events, routines, pc, target) =>
  nativeCallSequence(h, events, routines, pc, target, false, false);
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
// The window's place, size and plain attributes in the direct page; leaves A 0.
function setWindow(h, { left, top, columns }, rows) {
  const { wram } = h.a.mem;
  if (rows !== undefined) setWord(wram, DP_WINDOW_ROWS, rows);
  setWord(wram, DP_WINDOW_LEFT, left);
  setWord(wram, DP_WINDOW_TOP, top);
  setWord(wram, DP_WINDOW_COLUMNS, columns);
  setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
  load(h.ctx, 0);
}

// 80:E834: the skills (see above). A sequence that ends with its RTS.
export function* skillsSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem,
    window = translatedSkillWindow(h);
  let known = 0;
  yield () => {
    for (let skill = 0; skill < SKILL_COUNT; skill++) if (recordByte(mem, skill)) known++;
    // The count compares leave Y past the skills, zero for none and the carry.
    ctx.x = known;
    ctx.y = SKILL_COUNT;
    if (!known) ctx.a = 0;
    setSignZero(ctx, known);
    setFlag(ctx, FLAG_CARRY, true);
    if (!known) return;
    ctx.x = known + SKILL_EXTRA_ROWS;
    setWindow(h, window, ctx.x);
  };
  if (!known) return yield* returnSequence(h);
  yield* call(h, events, routines, 0x80e863, OPEN_WINDOW);
  yield () => {
    setDataBankWord(mem, STATUS_SUBMENU_WINDOW, 0, word(wram, 0));
    setWord(wram, DP_CURSOR_ROW, 0);
  };
  for (let skill = 0; skill < SKILL_COUNT; skill++) {
    let value;
    yield () => {
      value = recordByte(mem, skill);
      ctx.y = skill;
      load(ctx, value);
    };
    if (value) {
      let name;
      yield () => {
        ctx.x = skill << 1;
        name = dataBankWord(mem, SKILL_NAMES, ctx.x);
        load(ctx, name);
        setFlag(ctx, FLAG_CARRY, false);
        setWord(wram, 2, 0);
      };
      yield* call(h, events, routines, 0x80e882, CURSOR);
      yield () => {
        load(ctx, name);
        setWord(wram, 2, name);
      };
      yield* call(h, events, routines, 0x80e888, TEXT);
      yield () => {
        load(ctx, window.valueColumn);
        setWord(wram, 2, window.valueColumn);
      };
      yield* call(h, events, routines, 0x80e890, CURSOR);
      yield () => {
        setWord(wram, DP_CURSOR_ROW, (word(wram, DP_CURSOR_ROW) + 1) & WORD_MASK);
        load(ctx, value);
        setWord(wram, 2, value);
      };
      yield* call(h, events, routines, 0x80e898, NUMBER);
      yield () => {
        ctx.y = skill;
      };
    }
  }
  yield () => {
    // The last compare: Y past the skills.
    ctx.y = SKILL_COUNT;
    setSignZero(ctx, 0);
    setFlag(ctx, FLAG_CARRY, true);
  };
  yield* call(h, events, routines, 0x80e8a2, CONFIRM_KEY);
  yield () => {
    if (word(wram, PAD_PRESSED) & PAD_SELECT) setWord(wram, DIALOG_END, ENDED);
    const window = dataBankWord(mem, STATUS_SUBMENU_WINDOW);
    load(ctx, window);
    setWord(wram, 0, window);
  };
  yield* call(h, events, routines, 0x80e8b8, RELEASE_WINDOW);
  return yield* returnSequence(h);
}

// 80:E8C8: the notes (see above). A sequence that ends with its RTS.
export function* notesSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  const text = function* (pc, value) {
    yield () => {
      load(ctx, value);
      setWord(wram, 2, value);
    };
    yield* call(h, events, routines, pc, TEXT);
  };
  let jake, datajack;
  yield () => {
    const number = dataBankWord(mem, MEMBER_NUMBER);
    setFlag(ctx, FLAG_CARRY, number >= JAKE_OBJECT_NUMBER);
    jake = number === JAKE_OBJECT_NUMBER;
    if (jake) {
      ctx.x = NOTES_WINDOW.jakeRows;
      for (const [flag] of CYBERWARE) if (wram[flag]) ctx.x++;
      setWindow(h, NOTES_WINDOW, ctx.x);
      fitListWindow(mem, h, [TEXT_HEAD_COMPUTER, TEXT_DATAJACK, ...CYBERWARE.map(([, id]) => id)], {
        column: 0,
      });
      return;
    }
    datajack = dataBankWord(mem, MEMBER_DATAJACK);
    load(ctx, datajack);
    if (!datajack) return;
    setWindow(h, NOTES_WINDOW, NOTES_WINDOW.runnerRows);
    fitListWindow(mem, h, [TEXT_DATAJACK], { column: 0 });
  };
  if (!jake) {
    if (!datajack) return yield* returnSequence(h);
    yield* call(h, events, routines, 0x80e8ee, OPEN_WINDOW);
    yield* text(0x80e8f6, TEXT_DATAJACK);
    yield* call(h, events, routines, 0x80e8f9, CONFIRM_KEY);
    yield* call(h, events, routines, 0x80e8fc, RELEASE_WINDOW);
    return yield* returnSequence(h);
  }
  yield* call(h, events, routines, 0x80e937, OPEN_WINDOW);
  yield* text(0x80e93f, TEXT_HEAD_COMPUTER);
  yield () => {
    setWord(wram, 2, 0);
    load(ctx, DATAJACK_ROW);
    setWord(wram, DP_CURSOR_ROW, DATAJACK_ROW);
  };
  yield* call(h, events, routines, 0x80e949, CURSOR);
  yield* text(0x80e951, TEXT_DATAJACK);
  // The cyberware rows count from the datajack's (A is loaded again by the flags).
  yield () => setWord(wram, DP_CURSOR_ROW, DATAJACK_ROW);
  for (const [flag, id, [cursorPc, textPc]] of CYBERWARE) {
    let fitted;
    yield () => {
      fitted = wram[flag];
      load(ctx, fitted);
      if (!fitted) return;
      setWord(wram, 2, 0);
      const row = (word(wram, DP_CURSOR_ROW) + 1) & WORD_MASK;
      // The row's increment leaves it positive and not zero, as the flag's load did.
      setWord(wram, DP_CURSOR_ROW, row);
    };
    if (!fitted) continue;
    yield* call(h, events, routines, cursorPc, CURSOR);
    yield* text(textPc, id);
  }
  yield* call(h, events, routines, 0x80e9a1, CONFIRM_KEY);
  yield* call(h, events, routines, 0x80e9a4, RELEASE_WINDOW);
  return yield* returnSequence(h);
}
