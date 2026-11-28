import { partyState } from '../state/party.mjs';
import { readStateByte, writeStateByte } from '../state/objects.mjs';
// The party status (lifted from 80:ED3C, which the player control 80:E014 calls on
// Select; register-level version in proof/replay/native-player-control.mjs).
//
// The glove is put away (80:BCB2) and the notice windows released (80:FF79). A window
// at 01, 01 with 1E columns opens (80:F963): five rows while only the leader takes part
// (7E:1D6B), otherwise five plus half the group's last index (7E:2DE6) with that
// halving's carry. Under the title "PARTY STATUS" each member of the group gets a row
// (from row 2, one per member): the name, the state count and its maximum (the record
// byte 5) and the magic points and their maximum (ten times the record's magic byte).
// After a key (80:F953) the window is released (80:FA3E). The callees compose through their
// original frames, each with its own callees.
//
// Registers (user decision 2026-11-17): game state only; no callee takes a register
// input and no register values are left.
import { segmentSequence } from '../system/sequence-runner.mjs';
import { openWindow } from './window-open.mjs';
import {
  releaseWindowSequence,
  releaseNoticeWindowsSequence,
  putGloveAwaySequence,
} from './window-release.mjs';
import { setTextCursor, printNumber } from './window-text.mjs';
import { printText } from './text-print.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { waitForConfirmKey } from './confirm-key.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import { TEXT_SLASH } from '../system/native-status-screen.mjs';
import {
  DP_CURSOR_ROW,
  DP_MEMBER_RECORD,
  DP_MEMBER_RECORD_BANK,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  MAGIC_POINTS,
  MEMBER_INDEX,
  MEMBER_STATE_COUNT,
  STATUS_WINDOW,
} from '../data/wram.mjs';
import {
  RECORD_COUNT_MAX,
  RECORD_MAGIC,
  RUNNER_LAST_INDEX,
  RUNNER_NAMES,
  RUNNER_OBJECT_NUMBERS,
  RUNNER_RECORD_BANKS,
  RUNNER_RECORD_POINTERS,
} from '../data/runners.mjs';
import { STATE_COUNT } from '../data/actors.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { objectWord } from '../state/objects.mjs';

// The window, its title and the members' columns; the member's word index and name
// and the magic maximum in the direct page.
const PARTY_WINDOW = Object.freeze({ left: 1, top: 1, columns: 0x1e, baseRows: 5 }),
  TEXT_PARTY_STATUS = 0x74f9,
  COLUMNS = Object.freeze({ count: 0x0b, countSlash: 0x0e, magic: 0x14, magicSlash: 0x17 }),
  DP_PARTY_MEMBER = 0x0e,
  DP_PARTY_NAME = 0x0a,
  DP_MAGIC_MAXIMUM = 8,
  FIRST_ROW = 2,
  MAGIC_FACTOR = 10;
const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
// A byte of the member's record (long pointer DP F9) at offset.
const recordByte = (mem, offset) => {
  const { wram } = mem,
    record =
      word(wram, DP_MEMBER_RECORD) | (readStateByte(wram, DP_MEMBER_RECORD_BANK) << WORD_BITS);
  return mem.read8((record + offset) & LONG_MASK);
};

// The member at the group's word index: its runner (from the last; none leaves FFFE)
// with name and record, its state count and its magic maximum, and its cursor row.
function prepareMember(mem, member) {
  const { wram } = mem;
  setWord(wram, DP_PARTY_MEMBER, member);
  const slot = partyState(mem).member(member / 2).slot,
    number = partyState(mem).member(member / 2).number;
  let runner = RUNNER_LAST_INDEX;
  while (number !== dataBankWord(mem, RUNNER_OBJECT_NUMBERS, runner)) {
    runner = (runner - 2) & WORD_MASK;
    if (runner & WORD_SIGN) break;
  }
  setWord(wram, MEMBER_INDEX, runner);
  setWord(wram, DP_PARTY_NAME, dataBankWord(mem, RUNNER_NAMES, runner));
  setWord(wram, DP_MEMBER_RECORD, dataBankWord(mem, RUNNER_RECORD_POINTERS, runner));
  writeStateByte(
    wram,
    DP_MEMBER_RECORD_BANK,
    dataBankWord(mem, RUNNER_RECORD_BANKS, runner) & BYTE_MASK,
  );
  const record = objectWord(mem, 'record', slot);
  setDataBankWord(mem, MEMBER_STATE_COUNT, 0, readStateByte(wram, STATE_COUNT + record));
  // Ten times the magic byte.
  setWord(wram, DP_MAGIC_MAXIMUM, (recordByte(mem, RECORD_MAGIC) * MAGIC_FACTOR) & WORD_MASK);
  setWord(wram, 2, 0);
  setWord(wram, DP_CURSOR_ROW, (member >>> 1) + FIRST_ROW);
}

// 80:ED3C: the party status (see above) for lifted callers, without the JSR frame (the
// caller's return word lies only in free stack bytes).
export function* partyStatus(h, events, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    { wram } = mem;
  // DP 02 gets value before a lifted callee, which runs without a JSR frame.
  const withArgument = function* (value, body) {
    yield () => setWord(wram, 2, typeof value === 'function' ? value() : value);
    yield* body();
  };
  yield* putGloveAwaySequence(h, events);
  yield* releaseNoticeWindowsSequence(h, events);
  yield () => {
    setWord(wram, DP_WINDOW_LEFT, PARTY_WINDOW.left);
    setWord(wram, DP_WINDOW_TOP, PARTY_WINDOW.top);
    setWord(wram, DP_WINDOW_COLUMNS, PARTY_WINDOW.columns);
    let rows = PARTY_WINDOW.baseRows;
    if (!partyState(mem).leaderOnly) {
      const last = partyState(mem).lastIndex;
      rows = ((last >>> 1) + PARTY_WINDOW.baseRows + (last & 1)) & WORD_MASK;
    }
    setWord(wram, DP_WINDOW_ROWS, rows);
    setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
  };
  yield* openWindow(h, events);
  yield () => setDataBankWord(mem, STATUS_WINDOW, 0, word(wram, 0));
  yield* withArgument(TEXT_PARTY_STATUS, () => printText(h, events, renderBuffer));
  let member = 0,
    more;
  do {
    yield () => prepareMember(mem, member);
    yield* segmentSequence(() => setTextCursor(h));
    yield* withArgument(
      () => word(wram, DP_PARTY_NAME),
      () => printText(h, events, renderBuffer),
    );
    yield* withArgument(COLUMNS.count, () => segmentSequence(() => setTextCursor(h)));
    yield* withArgument(
      () => dataBankWord(mem, MEMBER_STATE_COUNT),
      () => printNumber(h, events, renderBuffer),
    );
    yield* withArgument(COLUMNS.countSlash, () => segmentSequence(() => setTextCursor(h)));
    yield* withArgument(TEXT_SLASH, () => printText(h, events, renderBuffer));
    yield () => {
      // The count's maximum; the record pointer's low word steps on by one.
      const maximum = recordByte(mem, RECORD_COUNT_MAX);
      setWord(wram, DP_MEMBER_RECORD, (word(wram, DP_MEMBER_RECORD) + 1) & WORD_MASK);
      setWord(wram, 2, maximum);
    };
    yield* printNumber(h, events, renderBuffer);
    yield* withArgument(COLUMNS.magic, () => segmentSequence(() => setTextCursor(h)));
    yield* withArgument(
      () => readStateByte(wram, MAGIC_POINTS + (dataBankWord(mem, MEMBER_INDEX) >>> 1)),
      () => printNumber(h, events, renderBuffer),
    );
    yield* withArgument(COLUMNS.magicSlash, () => segmentSequence(() => setTextCursor(h)));
    yield* withArgument(TEXT_SLASH, () => printText(h, events, renderBuffer));
    yield* withArgument(
      () => word(wram, DP_MAGIC_MAXIMUM),
      () => printNumber(h, events, renderBuffer),
    );
    yield () => {
      const next = (word(wram, DP_PARTY_MEMBER) + 1) & WORD_MASK;
      member = (next + 1) & WORD_MASK;
      more = next < partyState(mem).lastIndex && partyState(mem).leaderOnly === 0;
    };
  } while (more);
  yield* waitForConfirmKey(h, events);
  yield () => setWord(wram, 0, dataBankWord(mem, STATUS_WINDOW));
  yield* releaseWindowSequence(h, events);
}
