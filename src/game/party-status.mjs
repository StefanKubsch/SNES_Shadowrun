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
import { dialogCallBody, segmentSequence } from '../system/native-call-continuation.mjs';
import { openWindow } from './window-open.mjs';
import {
  releaseWindowJsrSequence,
  releaseNoticeWindowsCallSequence,
  putGloveAwayCallSequence,
} from './window-release.mjs';
import { setTextCursorRoutine, printNumberSequence } from './window-text.mjs';
import { printText } from './text-print.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import { waitForConfirmKeySequence } from './confirm-key.mjs';
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
  GROUP_INDEX,
  GROUP_LEADER_ONLY,
  GROUP_NUMBERS,
  GROUP_SLOTS,
  MAGIC_POINTS,
  MEMBER_INDEX,
  MEMBER_STATE_COUNT,
  OBJECT_RECORD,
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
// The callees and their call sites (the cursor, text and number per member in order).
const PUT_GLOVE_AWAY = [0x80ed3c, 0x80bcb2],
  RELEASE_NOTICES = [0x80ed3f, 0x80ff79],
  CONFIRM_KEY = [0x80ee4b, 0x80f953],
  RELEASE_WINDOW = [0x80ee53, 0x80fa3e],
  CURSOR = 0x80faac,
  NUMBER = 0x80fd80;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
// A byte of the member's record (long pointer DP F9) at offset.
const recordByte = (mem, offset) => {
  const { wram } = mem,
    record = word(wram, DP_MEMBER_RECORD) | (wram[DP_MEMBER_RECORD_BANK] << WORD_BITS);
  return mem.read8((record + offset) & LONG_MASK);
};

// The member at the group's word index: its runner (from the last; none leaves FFFE)
// with name and record, its state count and its magic maximum, and its cursor row.
function prepareMember(mem, member) {
  const { wram } = mem;
  setWord(wram, DP_PARTY_MEMBER, member);
  const slot = dataBankWord(mem, GROUP_SLOTS, member),
    number = word(wram, GROUP_NUMBERS + member);
  let runner = RUNNER_LAST_INDEX;
  while (number !== dataBankWord(mem, RUNNER_OBJECT_NUMBERS, runner)) {
    runner = (runner - 2) & WORD_MASK;
    if (runner & WORD_SIGN) break;
  }
  setWord(wram, MEMBER_INDEX, runner);
  setWord(wram, DP_PARTY_NAME, dataBankWord(mem, RUNNER_NAMES, runner));
  setWord(wram, DP_MEMBER_RECORD, dataBankWord(mem, RUNNER_RECORD_POINTERS, runner));
  wram[DP_MEMBER_RECORD_BANK] = dataBankWord(mem, RUNNER_RECORD_BANKS, runner) & BYTE_MASK;
  const record = dataBankWord(mem, OBJECT_RECORD, slot);
  setDataBankWord(mem, MEMBER_STATE_COUNT, 0, wram[STATE_COUNT + record]);
  // Ten times the magic byte.
  setWord(wram, DP_MAGIC_MAXIMUM, (recordByte(mem, RECORD_MAGIC) * MAGIC_FACTOR) & WORD_MASK);
  setWord(wram, 2, 0);
  setWord(wram, DP_CURSOR_ROW, (member >>> 1) + FIRST_ROW);
}

// 80:ED3C: the party status (see above). A sequence that ends with its RTS.
export function* partyStatusSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const { mem } = h.a,
    { wram } = mem;
  // DP 02 gets value before a callee at pc.
  const argument = function* (value, pc, target, body) {
    yield () => setWord(wram, 2, typeof value === 'function' ? value() : value);
    yield* dialogCallBody(h, pc, target, body);
  };
  // The argument in the direct page word 02 for a lifted callee without a JSR frame.
  const withArgument = function* (value, body) {
    yield () => setWord(wram, 2, typeof value === 'function' ? value() : value);
    yield* body();
  };
  yield* dialogCallBody(h, ...PUT_GLOVE_AWAY, () => putGloveAwayCallSequence(h, events));
  yield* dialogCallBody(h, ...RELEASE_NOTICES, () => releaseNoticeWindowsCallSequence(h, events));
  yield () => {
    setWord(wram, DP_WINDOW_LEFT, PARTY_WINDOW.left);
    setWord(wram, DP_WINDOW_TOP, PARTY_WINDOW.top);
    setWord(wram, DP_WINDOW_COLUMNS, PARTY_WINDOW.columns);
    let rows = PARTY_WINDOW.baseRows;
    if (!dataBankWord(mem, GROUP_LEADER_ONLY)) {
      const last = word(wram, GROUP_INDEX);
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
    yield* dialogCallBody(h, 0x80edcf, CURSOR, () =>
      segmentSequence(() => setTextCursorRoutine(h)),
    );
    yield* withArgument(
      () => word(wram, DP_PARTY_NAME),
      () => printText(h, events, renderBuffer),
    );
    yield* argument(COLUMNS.count, 0x80edde, CURSOR, () =>
      segmentSequence(() => setTextCursorRoutine(h)),
    );
    yield* argument(
      () => dataBankWord(mem, MEMBER_STATE_COUNT),
      0x80ede6,
      NUMBER,
      () => printNumberSequence(h, events, renderBuffer),
    );
    yield* argument(COLUMNS.countSlash, 0x80edee, CURSOR, () =>
      segmentSequence(() => setTextCursorRoutine(h)),
    );
    yield* withArgument(TEXT_SLASH, () => printText(h, events, renderBuffer));
    yield () => {
      // The count's maximum; the record pointer's low word steps on by one.
      const maximum = recordByte(mem, RECORD_COUNT_MAX);
      setWord(wram, DP_MEMBER_RECORD, (word(wram, DP_MEMBER_RECORD) + 1) & WORD_MASK);
      setWord(wram, 2, maximum);
    };
    yield* dialogCallBody(h, 0x80ee05, NUMBER, () => printNumberSequence(h, events, renderBuffer));
    yield* argument(COLUMNS.magic, 0x80ee0d, CURSOR, () =>
      segmentSequence(() => setTextCursorRoutine(h)),
    );
    yield* argument(
      () => wram[MAGIC_POINTS + (dataBankWord(mem, MEMBER_INDEX) >>> 1)],
      0x80ee1e,
      NUMBER,
      () => printNumberSequence(h, events, renderBuffer),
    );
    yield* argument(COLUMNS.magicSlash, 0x80ee26, CURSOR, () =>
      segmentSequence(() => setTextCursorRoutine(h)),
    );
    yield* withArgument(TEXT_SLASH, () => printText(h, events, renderBuffer));
    yield* argument(
      () => word(wram, DP_MAGIC_MAXIMUM),
      0x80ee35,
      NUMBER,
      () => printNumberSequence(h, events, renderBuffer),
    );
    yield () => {
      const next = (word(wram, DP_PARTY_MEMBER) + 1) & WORD_MASK;
      member = (next + 1) & WORD_MASK;
      more = next < word(wram, GROUP_INDEX) && dataBankWord(mem, GROUP_LEADER_ONLY) === 0;
    };
  } while (more);
  yield* dialogCallBody(h, ...CONFIRM_KEY, () => waitForConfirmKeySequence(h, events));
  yield () => setWord(wram, 0, dataBankWord(mem, STATUS_WINDOW));
  yield* dialogCallBody(h, ...RELEASE_WINDOW, () => releaseWindowJsrSequence(h.a, events));
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
