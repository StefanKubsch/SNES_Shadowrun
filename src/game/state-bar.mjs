// Jake's state bar in the window map (lifted from 81:AF1F; register-level version in
// src/task/native-bar-tiles.mjs, which its other callers still use).
//
// The bar sits in three rows of the window map buffer, drawn from the right end
// leftwards. Its frame is one segment per 20 points of Jake's maximum (the low byte
// of 7E:3C00): a fixed right cap, the segments and a left end tile that shows
// whether the maximum leaves a remainder. The middle row then shows the current
// value s (the byte at 7E:0002 plus the ROM word 8D:B8D2): the segments above s,
// rounded up, get their own tile, and the column at the edge a partial tile from
// the table 81:B026 (src/data/tables.mjs, bar_remainder_tiles).
//
// The divisions run on the hardware divider through the port, as in the original
// (Book I 2-15-1: unsigned 16/8, quotient 4214, remainder 4216; on another
// platform: Math.floor(a / 20) and a % 20). The original loop counts are kept,
// wrap-around included: a maximum below 20 gives a quotient 0, which the frame loop
// counts as 65536 segments, and a value above the maximum gives a negative
// difference that the middle loop counts down from up to 65535. Their writes run on
// from bank 7E into 7F, as in the original.
import { DIALOG_WINDOW, GROUP_INDEX, JAKE_COUNT_MAX, WINDOW_MAP_BUFFER } from '../task/wram.mjs';
import { WRDIVL, WRDIVB, RDDIVL, RDMPYL } from '../constants/hardware-registers.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

// Positions in the window map buffer: the caps of the right end and the rightmost
// segment column of the top, middle and bottom row.
const TOP_CAP = WINDOW_MAP_BUFFER + 0x7c,
  MIDDLE_CAP = WINDOW_MAP_BUFFER + 0xbc,
  BOTTOM_CAP = WINDOW_MAP_BUFFER + 0xfc,
  TOP_ROW = WINDOW_MAP_BUFFER + 0x66,
  MIDDLE_ROW = WINDOW_MAP_BUFFER + 0xa6,
  BOTTOM_ROW = WINDOW_MAP_BUFFER + 0xe6,
  FIRST_COLUMN = 0x14;
// Tile words: the right caps, a frame segment per row, the left end with and without
// a remainder, and a middle row segment above the current value.
const CAP_TILES = [0x6c04, 0x6c07, 0xec04],
  SEGMENT_TILES = [0x2c05, 0x2c10, 0xac05],
  REMAINDER_END_TILES = [0x2c06, 0x2c15, 0xac06],
  EVEN_END_TILES = [0x2c04, 0x2c07, 0xac04],
  ABOVE_VALUE_TILE = 0x2c08;
// One segment per 20 points; the current value is rounded up by 19, or by 9 when the
// maximum leaves a remainder.
const SEGMENT_POINTS = 20,
  ROUND_UP = 19,
  PARTIAL_ROUND_UP = 9,
  // Values below 11 under a maximum with a remainder take their partial tile 11
  // entries further in the table.
  SMALL_VALUE = 11,
  SMALL_VALUE_TABLE_BIAS = 11;
// The ROM word that locates the current value (at 7E:0002 plus it), and the
// partial tiles.
const VALUE_POINTER = 0x8db8d2,
  VALUE_BASE = 2,
  PARTIAL_TILES = 0x81b026;
// The original keeps s and the maximum's quotient and remainder in the direct page
// words A8, A2 and A5 (the caller's direct page is 0).
const DP_VALUE = 0xa8,
  DP_QUOTIENT = 0xa2,
  DP_REMAINDER = 0xa5;
// Original instructions of the divider accesses, the sites of the device model.
const FRAME_DIVISION = [0x81af32, 0x81af39],
  MAXIMUM_DIVISION = [0x81afab, 0x81afb2],
  VALUE_DIVISION = [0x81afd9, 0x81afe0],
  FRAME_QUOTIENT_SITE = 0x81af56,
  FRAME_REMAINDER_SITE = 0x81af73,
  MAXIMUM_QUOTIENT_SITE = 0x81afc9,
  MAXIMUM_REMAINDER_SITE = 0x81afce,
  VALUE_QUOTIENT_SITE = 0x81afec,
  SMALL_REMAINDER_SITE = 0x81b009,
  REMAINDER_SITE = 0x81b016;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const readWord = (mem, at) => mem.read8(at) | (mem.read8(at + 1) << BYTE_BITS);

// Start the division of dividend by 20 on the hardware divider.
function divide(port, dividend, [dividendSite, divisorSite]) {
  port.write(WRDIVL, dividend, 2, dividendSite);
  port.write(WRDIVB, SEGMENT_POINTS, 1, divisorSite);
}
// Write the tile of each row at column x, step x one word left, count times (0 counts
// as 65536); columns wrap at 16 bits, so writes can land in bank 7F. Returns x.
function drawColumns(wram, rows, tiles, x, count) {
  do {
    rows.forEach((row, n) => setWord(wram, row + x, tiles[n]));
    x = (x - 2) & WORD_MASK;
    count = (count - 1) & WORD_MASK;
  } while (count !== 0);
  return x;
}

// Draw Jake's state bar into the window map buffer (81:AF1F); nothing without a
// dialog window or with an empty group. m: {mem, wram, port}. Returns the index
// registers the original leaves when it draws the bar (Y the maximum's remainder, as in
// direct page A5; X the column after the segments above the value) with the carry and
// overflow of its last arithmetic, otherwise undefined (X, Y and the flags unchanged).
export function drawJakeStateBar({ mem, wram, port }) {
  if (word(wram, DIALOG_WINDOW) === 0) return;
  if (word(wram, GROUP_INDEX) & WORD_SIGN) return;
  const rows = [TOP_ROW, MIDDLE_ROW, BOTTOM_ROW];
  // The frame: the caps, one segment per 20 points of the maximum, the left end.
  divide(port, wram[JAKE_COUNT_MAX], FRAME_DIVISION);
  [TOP_CAP, MIDDLE_CAP, BOTTOM_CAP].forEach((at, n) => setWord(wram, at, CAP_TILES[n]));
  const segments = port.read(RDDIVL, 2, FRAME_QUOTIENT_SITE);
  let x = drawColumns(wram, rows, SEGMENT_TILES, FIRST_COLUMN, segments);
  const end = port.read(RDMPYL, 2, FRAME_REMAINDER_SITE) ? REMAINDER_END_TILES : EVEN_END_TILES;
  rows.forEach((row, n) => setWord(wram, row + x, end[n]));
  // The maximum is divided again (its byte read again: a frame of 65536 segments
  // overwrites it), then the current value s rounded up.
  divide(port, wram[JAKE_COUNT_MAX], MAXIMUM_DIVISION);
  const value = wram[VALUE_BASE + readWord(mem, VALUE_POINTER)];
  setWord(wram, DP_VALUE, value);
  const maximumSegments = port.read(RDDIVL, 2, MAXIMUM_QUOTIENT_SITE);
  setWord(wram, DP_QUOTIENT, maximumSegments);
  const maximumRest = port.read(RDMPYL, 2, MAXIMUM_REMAINDER_SITE);
  setWord(wram, DP_REMAINDER, maximumRest);
  divide(port, value + (maximumRest ? PARTIAL_ROUND_UP : ROUND_UP), VALUE_DIVISION);
  // The middle row: the segments above the value, from the right end.
  x = FIRST_COLUMN;
  const valueSegments = port.read(RDDIVL, 2, VALUE_QUOTIENT_SITE),
    above = (maximumSegments - valueSegments) & WORD_MASK;
  // The subtraction's carry and overflow, which the original leaves unless the small
  // value's table addition follows.
  let carry = maximumSegments >= valueSegments,
    overflow = ((maximumSegments ^ valueSegments) & (maximumSegments ^ above) & WORD_SIGN) !== 0;
  if (above !== 0) x = drawColumns(wram, [MIDDLE_ROW], [ABOVE_VALUE_TILE], x, above);
  // The partial tile at the next column, by the value's remainder.
  let entry;
  if (maximumRest === 0) {
    if (value === 0) return { x, y: maximumRest, carry, overflow };
    entry = port.read(RDMPYL, 2, REMAINDER_SITE);
  } else if (value < SMALL_VALUE) {
    const rest = port.read(RDMPYL, 2, SMALL_REMAINDER_SITE);
    entry = (rest + SMALL_VALUE_TABLE_BIAS) & WORD_MASK;
    overflow = (~(rest ^ SMALL_VALUE_TABLE_BIAS) & (rest ^ entry) & WORD_SIGN) !== 0;
  } else entry = port.read(RDMPYL, 2, REMAINDER_SITE);
  // The table offset is the entry doubled (ASL: its top bit is the carry).
  carry = (entry & WORD_SIGN) !== 0;
  setWord(wram, MIDDLE_ROW + x, readWord(mem, PARTIAL_TILES + ((entry * 2) & WORD_MASK)));
  return { x, y: maximumRest, carry, overflow };
}
