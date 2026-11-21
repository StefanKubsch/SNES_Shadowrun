import { readStateByte, writeStateByte } from '../state/objects.mjs';
// The dialog's texts (lifted from 80:9178 with the topic add 80:908C; register-level
// versions in proof/replay/native-dialog-text.mjs stay the reference).
//
// A text key comes as a parameter (A in the original): FFFF the greeting, FFFE the talk text, otherwise a topic
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
// Clearing, cursor, text and task actions compose directly with the original
// arguments; the task append takes the action's script as a parameter. The search and
// the topic add keep the original's 8-bit accumulator as a local: byte loads keep its
// high byte, XBA swaps the bytes, so the high byte carries the topics moved up. The
// flag byte the original pushes around the topic add, the topic add's JSR frame, the
// status and text position it pushes around the text and the text number 80:933A
// pushes around the clearing lie only in free stack bytes and are kept in locals (game
// state only, user decision 2026-11-17).
//
// Registers (user decision 2026-11-17): game state only; the routine leaves no A, X, Y
// or flags.
import { dialogCallBody, segmentSequence } from '../system/native-call-continuation.mjs';
import { requestTileClear } from './window-open.mjs';
import { setTextCursor } from './window-text.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import { printText } from './text-print.mjs';
import { appendScriptCall } from '../script/task-api.mjs';
import { scriptVisitCallSequence } from '../system/script-visit.mjs';
import { taskStop } from '../system/task-stop.mjs';
import { TOPIC_FLAGS, TOPIC_LIST } from '../data/wram.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
} from '../constants/bits.mjs';

const DP_WINDOW = 0x00,
  DP_TEXT = 0x02,
  DP_CURSOR_ROW = 0x04,
  DP_RECORD = 0x11,
  DP_DIALOG_OBJECT = 0x26,
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

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
// The record's byte or word at y (the long pointer in the direct page 11 to 13).
const recordAt = (wram, y) =>
  ((word(wram, DP_RECORD) | (readStateByte(wram, DP_RECORD + 2) << WORD_BITS)) + y) & LONG_MASK;
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
// numbers from the record at y on. Returns the record index past them.
function addTopics(mem, wram, acc, y) {
  acc.byte(acc.low & TOPIC_COUNT_MASK);
  y = (y + 1) & WORD_MASK;
  if (acc.low === 0) return y;
  let x;
  writeStateByte(wram, DP_TOPICS_LEFT, acc.low);
  do {
    const key = acc.byte(recordByte(mem, wram, y));
    writeStateByte(wram, DP_TOPIC_KEY, key);
    y = (y + 1) & WORD_MASK;
    x = 0;
    let insert = false;
    for (; ; x = (x + 1) & WORD_MASK) {
      const topic = acc.byte(readStateByte(wram, TOPIC_LIST + x));
      // The list end first (a key FF is inserted there), then an equal topic stays.
      if (topic !== LIST_END && topic === key) break;
      if (topic === LIST_END || topic > key) {
        insert = true;
        break;
      }
    }
    if (!insert) continue;
    // Insert the key here; the topics after it move up one place with their flags.
    acc.byte(readStateByte(wram, TOPIC_LIST + x));
    acc.swap();
    writeStateByte(wram, DP_ENTRY_BYTES, acc.byte(readStateByte(wram, TOPIC_FLAGS + x)));
    writeStateByte(wram, TOPIC_LIST + x, acc.byte(readStateByte(wram, DP_TOPIC_KEY)));
    writeStateByte(wram, TOPIC_FLAGS + x, acc.byte(0));
    for (;;) {
      x = (x + 1) & WORD_MASK;
      acc.byte(readStateByte(wram, TOPIC_LIST + x));
      acc.swap();
      writeStateByte(wram, TOPIC_LIST + x, acc.low);
      if (acc.low === LIST_END) break;
      writeStateByte(wram, DP_MOVED_FLAGS, acc.byte(readStateByte(wram, TOPIC_FLAGS + x)));
      writeStateByte(wram, TOPIC_FLAGS + x, acc.byte(readStateByte(wram, DP_ENTRY_BYTES)));
      writeStateByte(wram, DP_ENTRY_BYTES, acc.byte(readStateByte(wram, DP_MOVED_FLAGS)));
    }
  } while (
    writeStateByte(wram, DP_TOPICS_LEFT, (readStateByte(wram, DP_TOPICS_LEFT) - 1) & BYTE_MASK) !==
    0
  );
  return y;
}

// The entry for the key in the direct page word 1D: the search over the record. Returns
// found with the index past the key, or not found.
function searchEntry(mem, wram, acc) {
  let y = FIRST_ENTRY;
  for (;;) {
    const key = acc.byte(recordByte(mem, wram, y));
    if (key === RECORD_END) return { found: false };
    y = (y + 1) & WORD_MASK;
    if (key === readStateByte(wram, DP_TOPIC_KEY)) return { found: true, y: (y + 1) & WORD_MASK };
    // Skip the entry: its length byte added to the index (16-bit, the carry cleared).
    const length = recordWord(mem, wram, y) & BYTE_MASK;
    setWord(wram, DP_ENTRY_BYTES, length);
    y = (y + length) & WORD_MASK;
    acc.value = y;
  }
}

// Show the dialog text for the key (80:9178, A in the original) for lifted callers,
// without the JSR frame (the caller's return word lies only in free stack bytes); an
// optional text renderer.
export function* showDialogText(h, events, renderBuffer = drawTextBufferSequence, key) {
  const { mem } = h.a,
    { wram } = mem;
  for (;;) {
    yield () => {
      setWord(wram, DP_TOPIC_KEY, key);
      setWord(wram, DP_WINDOW, word(wram, DP_TEXT_WINDOW));
    };
    yield* requestTileClear(h, events);
    yield () => {
      setWord(wram, DP_TEXT, 0);
      setWord(wram, DP_CURSOR_ROW, 0);
    };
    yield* segmentSequence(() => setTextCursor(h));
    let entry,
      action = false,
      at;
    yield () => {
      // The 8-bit accumulator's high byte carries the topics moved up in the topic add.
      const acc = new Accumulator(key);
      entry = searchEntry(mem, wram, acc);
      if (!entry.found) {
        entry.missing = word(wram, DP_TOPIC_KEY) === FALLBACK_KEY;
        key = FALLBACK_KEY;
        return;
      }
      // The flag byte, kept over the topic add.
      let y = entry.y;
      const flags = acc.byte(recordByte(mem, wram, y));
      y = addTopics(mem, wram, acc, y);
      // The action bit; the text position is kept over the text.
      action = (flags & BYTE_SIGN) !== 0;
      at = y;
      if (action) y = (y + ACTION_WORD_BYTES) & WORD_MASK;
      setWord(wram, DP_TEXT, recordWord(mem, wram, y));
      setWord(wram, DP_WINDOW, word(wram, DP_TEXT_WINDOW));
    };
    if (entry.found) {
      yield* printText(h, events, renderBuffer);
      if (action) yield* dialogTopicSequence(h, events, at);
      break;
    }
    if (entry.missing) break;
  }
}

// Topic actions keep their append call and argument chronology: the
// script is the record's word at the position given, the object goes to the direct
// page word 00 as the script's argument.
export function* dialogTopicSequence(h, events, at) {
  const { mem } = h.a,
    { wram } = mem;
  let script;
  yield () => {
    if (!events.nestedRound && !events.round)
      taskStop('task_dialog_topic_visit_open', {
        pc: 0x8091ca,
        append: 0x80c34a,
        visit: 0x80c1ca,
      });
    script = recordWord(mem, wram, at);
    setWord(wram, DP_WINDOW, word(wram, DP_DIALOG_OBJECT));
  };
  yield* dialogCallBody(h, 0x8091d1, 0x80c34a, () =>
    segmentSequence(() => appendScriptCall(h.a, script)),
  );
  yield* scriptVisitCallSequence(h, events, 0x8091d4, 'task_dialog_topic_visit_open', (more) => {
    if (more?.wait?.length) events.values = Object.freeze([...(events.values ?? []), ...more.wait]);
    if (more?.input?.length)
      events.inputs = Object.freeze([...(events.inputs ?? []), ...more.input]);
  });
}

// The script natives that print a text number (first argument) into the dialog's text
// window, sequences that end with the native's RTS: 80:935B prints it, 80:933A first
// clears the window's text tiles (80:FA67) and sets its cursor to the top left (80:FAAC),
// with the number pushed around them. renderBuffer is the text-buffer renderer sequence.
const TEXT_NUMBERS = 0x80d9b8;
function* printTextNumber(h, events, renderBuffer, number, outerReturn) {
  const { mem } = h.a,
    { wram } = mem;
  yield () => {
    const at = (TEXT_NUMBERS + ((number << 1) & WORD_MASK)) & LONG_MASK;
    setWord(wram, DP_TEXT, mem.read8(at) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS));
    setWord(wram, DP_WINDOW, word(wram, DP_TEXT_WINDOW));
  };
  yield* printText(h, events, renderBuffer);
  let result;
  yield () => {
    if (outerReturn) result = h.rts();
  };
  return result;
}
// 80:935B: the text number printed at the window's cursor.
export function printWindowTextSequence(
  h,
  events,
  renderBuffer = drawTextBufferSequence,
  outerReturn = true,
) {
  return printTextNumber(h, events, renderBuffer, word(h.a.mem.wram, 0), outerReturn);
}
// 80:933A: the window cleared, the cursor at its top left, the text number printed.
export function* printTopicTextSequence(
  h,
  events,
  renderBuffer = drawTextBufferSequence,
  outerReturn = true,
) {
  const { wram } = h.a.mem,
    number = word(wram, 0);
  yield () => setWord(wram, DP_WINDOW, word(wram, DP_TEXT_WINDOW));
  yield* requestTileClear(h, events);
  yield () => {
    setWord(wram, DP_TEXT, 0);
    setWord(wram, DP_CURSOR_ROW, 0);
  };
  yield* segmentSequence(() => setTextCursor(h));
  return yield* printTextNumber(h, events, renderBuffer, number, outerReturn);
}
