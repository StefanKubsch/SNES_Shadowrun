// The dialog's texts (lifted from 80:9178 with the topic add 80:908C; register-level
// versions in src/task/native-dialog-text.mjs stay the reference).
//
// A text key comes in A: FFFF the greeting, FFFE the talk text, otherwise a topic
// number. The dialog's text window (the direct page word 14) is cleared (80:FA67) and
// its cursor set to its top left (80:FAAC). The dialog record (the long pointer in the
// direct page 11 to 13) holds entries from byte 4 on, ended by F8: a key byte, a flag
// byte and words. An entry with the key (its low byte) adds the flag byte's low nibble
// of topic numbers that follow to the topic list (80:908C); a flag byte with its top bit
// set has an action word after them. The text word follows; it is printed (80:FE69) and
// then the action runs: a script task appended with the action word (80:C34A) and run
// at once (80:C1CA). Without an entry for the key the text of key FFFD is shown, and
// without one for FFFD nothing.
//
// The topic add keeps the topic list 7E:3CA3 sorted (ended by FF): a new topic is
// inserted before the first larger one with a clear flag (7E:3CD6), the rest moves up
// one place with its flags; a topic already there stays.
//
// The callees come from the dialog's text routines with the original's A, X and Y: for
// the standard ones the lifted request (window-open.mjs), cursor (window-text.mjs) and
// text (text-print.mjs, its text buffer 80:FB39 from the table the caller passes), else
// a test's replacements. The routine works with an
// 8-bit accumulator in the search as the original: byte loads keep A's high byte, XBA
// swaps the bytes. It pushes the flag byte around the topic add, and its status and Y
// around the text (PLP restores the status with the carry of the action bit, which the
// routine leaves); the topic add's own frame is pushed and pulled as the original.
import { dialogCallBody, segmentSequence } from '../task/native-call-continuation.mjs';
import { requestTileClearSequence } from './window-open.mjs';
import { setTextCursorRoutine } from './window-text.mjs';
import { printTextSequence } from './text-print.mjs';
import {
  dialogTopicSequence,
  isStandardTextRoutines,
  textBodies,
} from '../task/native-dialog-text.mjs';
import { TOPIC_FLAGS, TOPIC_LIST } from '../task/wram.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_OVERFLOW,
  FLAG_ZERO,
} from '../constants/cpu-flags.mjs';

const DP_WINDOW = 0x00,
  DP_TEXT = 0x02,
  DP_CURSOR_ROW = 0x04,
  DP_RECORD = 0x11,
  DP_TEXT_WINDOW = 0x14,
  DP_TOPIC_KEY = 0x1d,
  DP_TOPICS_LEFT = 0x20,
  DP_ENTRY_BYTES = 0x23,
  DP_MOVED_FLAGS = 0x24;
const FIRST_ENTRY = 4,
  RECORD_END = 0xf8,
  FALLBACK_KEY = 0xfffd,
  LIST_END = BYTE_MASK,
  TOPIC_COUNT_MASK = 0x0f,
  ACTION_WORD_BYTES = 2;
// Original call sites and callees.
const REQUEST_CALL = [0x80917e, 0x80fa67],
  CURSOR_CALL = [0x809185, 0x80faac],
  TOPICS_SITE = 0x8091ae,
  TEXT_CALL = [0x8091c3, 0x80fe69],
  JSR_LAST_BYTE = 2;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
// The record's byte or word at y (the long pointer in the direct page 11 to 13).
const recordAt = (wram, y) =>
  ((word(wram, DP_RECORD) | (wram[DP_RECORD + 2] << WORD_BITS)) + y) & LONG_MASK;
const recordByte = (mem, wram, y) => mem.read8(recordAt(wram, y));
const recordWord = (mem, wram, y) => {
  const at = recordAt(wram, y);
  return mem.read8(at) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
};

// The accumulator with an 8-bit view: byte loads keep the high byte, XBA swaps.
class Accumulator {
  constructor(value) {
    this.value = value;
  }
  get low() {
    return this.value & BYTE_MASK;
  }
  byte(value) {
    this.value = (this.value & ~BYTE_MASK & WORD_MASK) | (value & BYTE_MASK);
    return this.low;
  }
  swap() {
    this.value = ((this.value & BYTE_MASK) << BYTE_BITS) | (this.value >>> BYTE_BITS);
  }
}

// The topic add (80:908C) with an 8-bit accumulator: the flag byte's low nibble of topic
// numbers from the record at y on. Returns the X and Y it leaves (its flags are replaced
// by the caller's PLA and ASL).
function addTopics(mem, wram, acc, x, y) {
  acc.byte(acc.low & TOPIC_COUNT_MASK);
  y = (y + 1) & WORD_MASK;
  if (acc.low === 0) return { x, y };
  wram[DP_TOPICS_LEFT] = acc.low;
  do {
    const key = acc.byte(recordByte(mem, wram, y));
    wram[DP_TOPIC_KEY] = key;
    y = (y + 1) & WORD_MASK;
    x = 0;
    let insert = false;
    for (; ; x = (x + 1) & WORD_MASK) {
      const topic = acc.byte(wram[TOPIC_LIST + x]);
      // The list end first (a key FF is inserted there), then an equal topic stays.
      if (topic !== LIST_END && topic === key) break;
      if (topic === LIST_END || topic > key) {
        insert = true;
        break;
      }
    }
    if (!insert) continue;
    // Insert the key here; the topics after it move up one place with their flags.
    acc.byte(wram[TOPIC_LIST + x]);
    acc.swap();
    wram[DP_ENTRY_BYTES] = acc.byte(wram[TOPIC_FLAGS + x]);
    wram[TOPIC_LIST + x] = acc.byte(wram[DP_TOPIC_KEY]);
    wram[TOPIC_FLAGS + x] = acc.byte(0);
    for (;;) {
      x = (x + 1) & WORD_MASK;
      acc.byte(wram[TOPIC_LIST + x]);
      acc.swap();
      wram[TOPIC_LIST + x] = acc.low;
      if (acc.low === LIST_END) break;
      wram[DP_MOVED_FLAGS] = acc.byte(wram[TOPIC_FLAGS + x]);
      wram[TOPIC_FLAGS + x] = acc.byte(wram[DP_ENTRY_BYTES]);
      wram[DP_ENTRY_BYTES] = acc.byte(wram[DP_MOVED_FLAGS]);
    }
  } while ((wram[DP_TOPICS_LEFT] = (wram[DP_TOPICS_LEFT] - 1) & BYTE_MASK) !== 0);
  return { x, y };
}

// The entry for the key in the direct page word 1D: the search over the record with the
// registers the original leaves. Returns found (with the action bit), or missing.
function searchEntry(h, acc) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  let y = FIRST_ENTRY;
  for (;;) {
    const key = acc.byte(recordByte(mem, wram, y));
    if (key === RECORD_END) {
      ctx.y = y;
      return { found: false };
    }
    y = (y + 1) & WORD_MASK;
    if (key === wram[DP_TOPIC_KEY]) {
      y = (y + 1) & WORD_MASK;
      return { found: true, y };
    }
    // Skip the entry: its length byte added to the index (16-bit ADC with the carry of
    // the key comparison cleared).
    const length = recordWord(mem, wram, y) & BYTE_MASK;
    setWord(wram, DP_ENTRY_BYTES, length);
    const sum = y + length,
      result = sum & WORD_MASK;
    flag(ctx, FLAG_CARRY, sum > WORD_MASK);
    flag(ctx, FLAG_OVERFLOW, ~(y ^ length) & (y ^ result) & WORD_SIGN);
    acc.value = result;
    y = result;
  }
}

// The callee bodies: the lifted request, cursor and text for the standard routines
// (with a table for 80:FB39), else those of the text routines.
function liftedBodies(h, events, routines, drawRoutines) {
  if (!drawRoutines || !isStandardTextRoutines(routines)) return textBodies(h, events, routines);
  const lifted = {
    request: () => requestTileClearSequence(h, events),
    cursor: () => segmentSequence(() => setTextCursorRoutine(h)),
    text: () => printTextSequence(h, events, drawRoutines),
  };
  return (name) => lifted[name];
}

// Show the dialog text for the key in A (80:9178), a sequence for a native call
// continuation: routines the dialog's text routines.
export function* showDialogTextSequence(h, events, routines, drawRoutines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem,
    body = liftedBodies(h, events, routines, drawRoutines),
    call = ([site, target], name) => dialogCallBody(h, site, target, body(name));
  for (;;) {
    yield () => {
      setWord(wram, DP_TOPIC_KEY, ctx.a);
      ctx.a = word(wram, DP_TEXT_WINDOW);
      setWord(wram, DP_WINDOW, ctx.a);
    };
    yield* call(REQUEST_CALL, 'request');
    yield () => {
      setWord(wram, DP_TEXT, 0);
      setWord(wram, DP_CURSOR_ROW, 0);
    };
    yield* call(CURSOR_CALL, 'cursor');
    let entry;
    yield () => {
      const acc = new Accumulator(ctx.a);
      entry = searchEntry(h, acc);
      if (!entry.found) {
        // CMP #FFFD with the key.
        ctx.a = FALLBACK_KEY;
        const key = word(wram, DP_TOPIC_KEY),
          difference = (FALLBACK_KEY - key) & WORD_MASK;
        flag(ctx, FLAG_CARRY, FALLBACK_KEY >= key);
        flag(ctx, FLAG_NEGATIVE, difference & WORD_SIGN);
        flag(ctx, FLAG_ZERO, difference === 0);
        entry.missing = key === FALLBACK_KEY;
        return;
      }
      // The flag byte, pushed around the topic add (JSR with its frame).
      let y = entry.y;
      const flags = acc.byte(recordByte(mem, wram, y));
      h.pushByte(flags);
      h.a.pushWord((TOPICS_SITE + JSR_LAST_BYTE) & WORD_MASK);
      const added = addTopics(mem, wram, acc, ctx.x, y);
      h.a.pullWord();
      ctx.x = added.x;
      y = added.y;
      h.ctx.s = (h.ctx.s + 1) & WORD_MASK;
      // PLA, ASL: the action bit in the carry; REP, PHP, PHY.
      acc.byte(flags << 1);
      const action = (flags & BYTE_SIGN) !== 0,
        status =
          (ctx.status &
            ~(FLAG_CARRY | FLAG_NEGATIVE | FLAG_ZERO | FLAG_MEMORY_8BIT | FLAG_INDEX_8BIT)) |
          (action ? FLAG_CARRY : 0) |
          (acc.low & BYTE_SIGN ? FLAG_NEGATIVE : 0) |
          (acc.low === 0 ? FLAG_ZERO : 0);
      ctx.status = status;
      h.pushByte(status);
      h.a.pushWord(y);
      if (action) y = (y + ACTION_WORD_BYTES) & WORD_MASK;
      ctx.y = y;
      setWord(wram, DP_TEXT, recordWord(mem, wram, y));
      ctx.a = word(wram, DP_TEXT_WINDOW);
      setWord(wram, DP_WINDOW, ctx.a);
    };
    if (entry.found) {
      yield* call(TEXT_CALL, 'text');
      let action = false;
      yield () => {
        ctx.y = h.a.pullWord();
        ctx.s = (ctx.s + 1) & WORD_MASK;
        ctx.status = h.a.read(ctx.s);
        action = (ctx.status & FLAG_CARRY) !== 0;
      };
      if (action) {
        if (events.nestedRound && isStandardTextRoutines(routines))
          yield* dialogTopicSequence(h, events);
        else yield () => routines.topic(h);
      }
      break;
    }
    if (entry.missing) break;
  }
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// The script natives that print a text number (first argument) into the dialog's text
// window, sequences that end with the native's RTS: 80:935B prints it, 80:933A first
// clears the window's text tiles (80:FA67) and sets its cursor to the top left (80:FAAC),
// with the number pushed around them. drawRoutines is the table for 80:FB39.
const TEXT_NUMBERS = 0x80d9b8,
  TOPIC_TEXT = { request: [0x809341, 0x80fa67], cursor: [0x809348, 0x80faac] },
  TOPIC_TEXT_CALL = [0x809357, 0x80fe69],
  MODAL_TEXT_CALL = [0x809368, 0x80fe69];
function* printTextNumber(h, events, drawRoutines, number, [site, target]) {
  const { mem } = h.a,
    { wram } = mem;
  yield () => {
    const at = (TEXT_NUMBERS + ((number << 1) & WORD_MASK)) & LONG_MASK;
    setWord(wram, DP_TEXT, mem.read8(at) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS));
    setWord(wram, DP_WINDOW, word(wram, DP_TEXT_WINDOW));
  };
  yield* dialogCallBody(h, site, target, () => printTextSequence(h, events, drawRoutines));
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
// 80:935B: the text number printed at the window's cursor.
export function printWindowTextSequence(h, events, drawRoutines) {
  return printTextNumber(h, events, drawRoutines, word(h.a.mem.wram, 0), MODAL_TEXT_CALL);
}
// 80:933A: the window cleared, the cursor at its top left, the text number printed.
export function* printTopicTextSequence(h, events, drawRoutines) {
  const { wram } = h.a.mem,
    number = word(wram, 0);
  yield () => {
    h.a.pushWord(number);
    setWord(wram, DP_WINDOW, word(wram, DP_TEXT_WINDOW));
  };
  yield* dialogCallBody(h, ...TOPIC_TEXT.request, () => requestTileClearSequence(h, events));
  yield () => {
    setWord(wram, DP_TEXT, 0);
    setWord(wram, DP_CURSOR_ROW, 0);
  };
  yield* dialogCallBody(h, ...TOPIC_TEXT.cursor, () =>
    segmentSequence(() => setTextCursorRoutine(h)),
  );
  yield () => h.a.pullWord();
  return yield* printTextNumber(h, events, drawRoutines, number, TOPIC_TEXT_CALL);
}
