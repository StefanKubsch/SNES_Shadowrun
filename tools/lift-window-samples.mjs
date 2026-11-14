// Window samples shared by the lift function tests (tools/lift-function-harness.mjs):
// the window map source of window style 0, recorded upload polls, and random window
// tables with the glove's name window and the notice slots.
import {
  WINDOW_ACTIVE,
  WINDOW_ATTRIBUTES,
  WINDOW_COLUMNS,
  WINDOW_FIRST_INDEX,
  WINDOW_LAST_INDEX,
  WINDOW_MAP_OFFSET,
  WINDOW_ROWS,
  WINDOW_TILE_COUNT,
  WINDOW_TILE_INITIAL,
  WINDOW_TILE_START,
  WINDOW_MAP_SOURCE,
  WINDOW_MAP_SOURCE_BANK,
  TEXT_MAP_UPLOAD,
  GLOVE_NAME_WINDOW,
  GLOVE_TARGET_TAG,
  NOTICE_WINDOWS,
} from '../src/task/wram.mjs';

// The window list's inputs on both sides: the window map of window style 0 (80:FFAD:
// its colours, then the map) and one recorded poll of the text map upload wait 81:ACAF
// that finds the upload done, for each redraw: the glove's name window, four notice
// windows and the list itself.
const WINDOW_STYLE_0 = 0x80ffad,
  STYLE_COLOURS = 3,
  STYLE_COLOURS_BANK = 5,
  STYLE_COLOUR_BYTES = 6;
export function windowMapSource(wram, mem) {
  const bank = mem.read8(WINDOW_STYLE_0 + STYLE_COLOURS_BANK),
    at =
      ((mem.read8(WINDOW_STYLE_0 + STYLE_COLOURS) |
        (mem.read8(WINDOW_STYLE_0 + STYLE_COLOURS + 1) << 8)) +
        STYLE_COLOUR_BYTES) &
      0xffff;
  wram[WINDOW_MAP_SOURCE_BANK] = bank;
  wram[WINDOW_MAP_SOURCE_BANK + 1] = 0;
  wram[WINDOW_MAP_SOURCE] = at & 0xff;
  wram[WINDOW_MAP_SOURCE + 1] = at >>> 8;
}
const UPLOAD_POLLS = 6;
export const uploadEvents = () => ({
  calls: [],
  mode: 'record-observations',
  values: Array.from({ length: UPLOAD_POLLS }, () => ({
    pc: 0x81acaf,
    address: 0x800000 | TEXT_MAP_UPLOAD,
    width: 2,
    value: 0,
  })),
  waitIndex: 0,
  waitEvents: [],
});

// Up to eight windows with game-sized borders (3 to 20 columns, 3 to 10 rows) and tile
// ranges, some inactive or below the first index; or none.
export function windowTables(wram, rnd, pick) {
  const put = (at, value) => {
    wram[at] = value & 0xff;
    wram[at + 1] = (value >>> 8) & 0xff;
  };
  put(WINDOW_LAST_INDEX, pick([0xffff, 2 * rnd(8)]));
  put(WINDOW_FIRST_INDEX, pick([0, 0, 2 * rnd(4)]));
  for (let x = 0; x < 16; x += 2) {
    const start = 0x40 + rnd(0x100);
    put(WINDOW_ACTIVE + x, pick([0, 1, rnd(0x10000)]));
    put(WINDOW_COLUMNS + x, 3 + rnd(18));
    put(WINDOW_ROWS + x, 3 + rnd(8));
    put(WINDOW_MAP_OFFSET + x, 2 * rnd(0x200));
    put(WINDOW_TILE_START + x, start);
    put(WINDOW_TILE_INITIAL + x, start + rnd(0x20));
    put(WINDOW_TILE_COUNT + x, 1 + rnd(0x40));
    put(WINDOW_ATTRIBUTES + x, pick([0x2000, 0x2400, rnd(0x10000)]));
  }
  // The windows the entry releases: the glove's name window (with a target or none)
  // and the notice slots (used or not), the last window often among them.
  const last = wram[WINDOW_LAST_INDEX] | (wram[WINDOW_LAST_INDEX + 1] << 8),
    window = () => pick([2 * rnd(8), last & 0xe]);
  put(GLOVE_TARGET_TAG, pick([0xffff, rnd(0x8000), 0x8000 | rnd(0x8000)]));
  put(GLOVE_NAME_WINDOW, window());
  for (let x = 0; x < 8; x += 2) put(NOTICE_WINDOWS + x, pick([0xffff, window(), window()]));
}
