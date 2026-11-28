import { findRunnerIndex } from '../content/runners.mjs';
import { textId } from '../content/member-menus.mjs';
import { memberMenuState } from '../state/member-menu.mjs';
import { partyState } from '../state/party.mjs';
import { readStateByte, writeStateByte } from '../state/objects.mjs';
// One row per participating member, with health and magic and their maxima.
// The leader-only mode limits the display to its first row.
import { openWindowAt } from './window-open.mjs';
import {
  releaseWindowSequence,
  releaseNoticeWindowsSequence,
  putGloveAwaySequence,
} from './window-release.mjs';
import { setTextCursorAt, printNumber } from './window-text.mjs';
import { printText } from './text-print.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { waitForConfirmKey } from './confirm-key.mjs';
import { TEXT_SLASH } from '../system/native-status-screen.mjs';
import { STATE_COUNT } from '../data/actors.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK } from '../constants/bits.mjs';
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
// The member at the group's word index: its runner (from the last; none leaves FFFE)
// with name and record, its state count and its magic maximum, and its cursor row.
function prepareMember(mem, member) {
  const { wram } = mem;
  setWord(wram, DP_PARTY_MEMBER, member);
  const slot = partyState(mem).member(member / 2).slot,
    number = partyState(mem).member(member / 2).number;
  const state = memberMenuState(mem);
  state.runnerIndex = findRunnerIndex(mem, number);
  state.recordPosition = 0;
  setWord(wram, DP_PARTY_NAME, textId(state.details.name));
  const record = objectWord(mem, 'record', slot);
  memberMenuState(mem).health = readStateByte(wram, STATE_COUNT + record);
  // Ten times the magic byte.
  setWord(wram, DP_MAGIC_MAXIMUM, (memberMenuState(mem).stats.magic * MAGIC_FACTOR) & WORD_MASK);
  setWord(wram, 2, 0);
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
  let rows = PARTY_WINDOW.baseRows;
  if (!partyState(mem).leaderOnly) {
    const last = partyState(mem).lastIndex;
    rows = ((last >>> 1) + PARTY_WINDOW.baseRows + (last & 1)) & WORD_MASK;
  }
  memberMenuState(mem).window = yield* openWindowAt(h, events, [
    PARTY_WINDOW.left,
    PARTY_WINDOW.top,
    PARTY_WINDOW.columns,
    rows,
  ]);
  yield* withArgument(TEXT_PARTY_STATUS, () => printText(h, events, renderBuffer));
  let member = 0,
    more;
  const cursor = function* (column = 0) {
    yield () => setTextCursorAt(h, memberMenuState(mem).window, column, (member >>> 1) + FIRST_ROW);
  };
  do {
    yield () => prepareMember(mem, member);
    yield* cursor();
    yield* withArgument(
      () => word(wram, DP_PARTY_NAME),
      () => printText(h, events, renderBuffer),
    );
    yield* cursor(COLUMNS.count);
    yield* withArgument(
      () => memberMenuState(mem).health,
      () => printNumber(h, events, renderBuffer),
    );
    yield* cursor(COLUMNS.countSlash);
    yield* withArgument(TEXT_SLASH, () => printText(h, events, renderBuffer));
    yield () => {
      const maximum = memberMenuState(mem).stats.maxHealth;
      memberMenuState(mem).recordPosition = 1;
      setWord(wram, 2, maximum);
    };
    yield* printNumber(h, events, renderBuffer);
    yield* cursor(COLUMNS.magic);
    yield* withArgument(
      () => memberMenuState(mem).resources.magicPoints,
      () => printNumber(h, events, renderBuffer),
    );
    yield* cursor(COLUMNS.magicSlash);
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
  yield () => setWord(wram, 0, memberMenuState(mem).window);
  yield* releaseWindowSequence(h, events);
}
