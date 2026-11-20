// Spending magic points (lifted from the script native 80:8B43; register-level version
// in proof/replay/native-combat.mjs, which recorded waits replay).
//
// The member shown in the menus (7E:1F60, a word index) pays the amount of the first
// argument's low byte from its magic points (one byte per runner from 7E:3C96). Enough
// points: they are paid and the result is FFFF. Too few: the notice "not enough magic"
// (text 1, a window at 0B/14 of 19 columns and 3 rows, one second) and the result 0.
// Game state only (user decision 2026-11-17): no register values are left; the notice
// takes no register input.
import { showNotice } from './notice-show.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import {
  DP_NOTICE_FRAMES,
  DP_NOTICE_TEXT,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  MAGIC_POINTS,
  MEMBER_INDEX,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK } from '../constants/bits.mjs';

const NOTICE = { left: 0x0b, top: 0x14, columns: 0x13, rows: 3, text: 1, frames: 0x3c },
  PAID = WORD_MASK,
  NOT_PAID = 0;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// 80:8B43, ending with the native's RTS and composing its notice directly.
export function* spendMagicPointsSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const { wram } = h.a.mem;
  let paid = false;
  yield () => {
    const at = MAGIC_POINTS + (word(wram, MEMBER_INDEX) >>> 1),
      left = wram[at] - wram[0];
    paid = left >= 0;
    if (paid) {
      wram[at] = left;
      setWord(wram, 0, PAID);
      return;
    }
    for (const [offset, value] of [
      [DP_WINDOW_LEFT, NOTICE.left],
      [DP_WINDOW_TOP, NOTICE.top],
      [DP_WINDOW_COLUMNS, NOTICE.columns],
      [DP_WINDOW_ROWS, NOTICE.rows],
      [DP_WINDOW_ATTRIBUTES, 0],
      [DP_NOTICE_TEXT, NOTICE.text],
      [DP_NOTICE_FRAMES, NOTICE.frames],
    ])
      setWord(wram, offset, value);
  };
  if (!paid) {
    yield* showNotice(h, events, renderBuffer);
    yield () => setWord(wram, 0, NOT_PAID);
  }
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
