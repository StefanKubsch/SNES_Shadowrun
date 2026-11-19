// Drawing the text buffer into a window (lifted from 80:FB39 with the cursor geometry
// 81:ADBA, 81:AE14 and 81:AE4D, the mask close 81:AEC8 and the upload requests 81:AEF4
// and 81:AEFC; register-level versions in proof/replay/native-text-compose.mjs and
// native-text-prerequisites.mjs, which the other callers still use).
//
// The text buffer 7E:21A0 (ending with 0) is drawn into the window in the direct page
// word 00 at its text cursor (a tile and a pixel offset within it), glyph by glyph with
// the widths 81:AC0C and the 8 x 8 glyphs 95:F2D0. The pixels go through a mask buffer
// of two 8 x 8 tiles (7E:2AE0, the text tile and the next), which is uploaded to the
// window's tile in video memory (request 7E:01FA) whenever a line breaks and at the end;
// at the start the window's tile is read back into it (request 7E:01FC). Words wrap: a
// word that does not fit the rest of the line moves to the next line (a space at the
// line's start is skipped), as do lines past the window's bottom, which start over at
// its top. The window style (7E:2140) chooses bold (wider glyphs), shifted rows (styles
// 20, 40, 60), underlining (10) and capitals (80); | toggles bold within a text.
//
// The geometry divides the cursor tile's distance from the window's first text tile by
// the window's columns less two on the hardware divider and multiplies on the hardware
// multiplier, through the port as in the original (Book I 2-15-1). A text of the language
// (src/data/language.mjs) leaves out glyphs that no longer fit their line.
//
// Registers (user decision 2026-11-17): the routine works in the direct page words A2
// to D2 with plain values; it leaves no registers. Of the original's working registers
// only X is carried from one step to the next, because a line break with nothing drawn
// takes its window from the index X still holds (a character, glyph row or mask index),
// as the original does. The upload requests run below the frames of
// their two JSLs, and their waits see the request word's sign, as the original; with the
// lag-free frame model they are lifted, otherwise (recorded observations, the function
// tests) the register-level requests run through their frames. With recorded interrupts
// inside a glyph (the Mesen cold boot replay) the register-level routine runs. The frames
// of the calls that do not wait (geometry, mask) and the routine's own pushes are not
// reproduced.
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { nmiAtBranch } from '../system/frame-wait.mjs';
import {
  TEXT_BUFFER,
  TEXT_BUFFER_BYTES,
  TEXT_BUFFER_READBACK,
  TEXT_BUFFER_UPLOAD,
  TEXT_BUFFER_VRAM_ADDRESS,
  TEXT_CHARACTER_INDEX,
  TEXT_COMPOSE_STYLE,
  TEXT_GLYPH_BITS,
  TEXT_GLYPH_HIGH,
  TEXT_GLYPH_ROW,
  TEXT_INITIAL_MASK,
  TEXT_LINE_PIXELS,
  TEXT_MASK_BUFFER,
  TEXT_PENDING_BYTES,
  TEXT_PIXEL_OFFSET,
  TEXT_WORD_STATE,
  TEXT_WORK_WORD,
  WINDOW_COLUMNS,
  WINDOW_CURSOR_PIXEL,
  WINDOW_CURSOR_TILE,
  WINDOW_LEFT_PIXEL,
  WINDOW_ROWS,
  WINDOW_STYLE,
  WINDOW_TILE_START,
} from '../data/wram.mjs';
import {
  RDDIVL,
  RDMPYL,
  WRDIVB,
  WRDIVL,
  WRMPYA,
  WRMPYB,
} from '../constants/hardware-registers.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { FLAG_MEMORY_8BIT, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const DP_WINDOW = 0x00,
  // The geometry's line width and position in pixels.
  DP_LINE_WIDTH = 0xbd,
  DP_LINE_POSITION = 0xc0;
const GLYPH_WIDTHS = 0x81ac0c,
  GLYPHS = 0x95f2d0,
  // Masks of the bits left of a pixel offset, and of a glyph's width.
  OFFSET_MASKS = 0x81ac8d,
  WIDTH_MASKS = 0x81ac9d;
const BORDER_COLUMNS = 2,
  RESERVED_ROWS = 4,
  TILE_PIXELS = 8,
  PIXEL_MASK = 7,
  PIXEL_SHIFT = 3,
  TILE_BYTE_SHIFT = 4,
  VRAM_TEXT_TILES = 0x5000,
  MASK_TILE_BYTES = 0x10,
  MASK_LAST_WORD = 0x0e,
  MASK_WORDS = 8,
  MASK_LOOP_END = 0xfffe,
  // Pending bytes step back one tile less one word (SBC 0F with the carry clear).
  TILE_STEP_BACK = 0x10,
  EMPTY_WORD_WIDTH = 5,
  GLYPH_LAST_ROW = 7,
  ROW_SHIFT_BOUNDARY = 5,
  // A glyph index whose underline row is not drawn.
  UNDERLINE_SKIP = 0x107;
const STYLE_BOLD = 0x08,
  STYLE_WIDER = 0x68,
  STYLE_UNDERLINE = 0x10,
  STYLE_SHIFT_ALL = 0x60,
  STYLE_SHIFT_LOW = 0x20,
  STYLE_SHIFT_HIGH = 0x40;
const SPACE = 0x20,
  STYLE_TOGGLE = 0x7c,
  STYLE_PLACEHOLDER = 0x1a,
  LOWER_FIRST = 0x61,
  LOWER_END = 0x7b,
  UPPER_MASK = 0x5f;
// The upload requests: the JSL sites in FB39, the request routines, their JSL sites of
// the wait loops and the branches back to the loops' loads.
const READBACK = Object.freeze({
    name: 'AEFC',
    site: 0x80fb5b,
    target: 0x81aefc,
    request: TEXT_BUFFER_READBACK,
    waitSite: 0x81aeff,
    branch: 0x81accc,
  }),
  LINE_UPLOAD = Object.freeze({
    name: 'AEF4',
    site: 0x80fbdf,
    target: 0x81aef4,
    request: TEXT_BUFFER_UPLOAD,
    waitSite: 0x81aef7,
    branch: 0x81acc6,
  }),
  END_UPLOAD = Object.freeze({ ...LINE_UPLOAD, site: 0x80fd7b });
const JSL_LAST_BYTE = 3,
  REQUEST_BANK = 0x81;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const romWord = (mem, at) => mem.read8(at) | (mem.read8(at + 1) << BYTE_BITS);
const swap = (value) => ((value & BYTE_MASK) << BYTE_BITS) | (value >>> BYTE_BITS);

// The text drawing's state: memory, port, and the index the original keeps in X from
// one step to the next (see breakLine).
function textState(h) {
  const { mem, wram, port } = sceneRuntime(h);
  return { mem, wram, port, x: 0 };
}
// LSR of a word count times (count 1 to 65535), as the original's loop with DEY.
const shiftRight = (value, count) => (count < WORD_BITS ? value >>> count : 0);
const field = (wram, table, x) => word(wram, table + x);
const byteField = (wram, table, x) => wram[table + x];

// The cursor tile's distance from the window's first text tile, divided by the text
// columns on the divider (started here; the sites are the dividend's and divisor's).
function divideDistance(wram, port, x, dividendSite, divisorSite) {
  const distance =
    (field(wram, WINDOW_CURSOR_TILE, x) - field(wram, WINDOW_TILE_START, x)) & WORD_MASK;
  port.write(WRDIVL, distance, 2, dividendSite);
  port.write(
    WRDIVB,
    (byteField(wram, WINDOW_COLUMNS, x) - BORDER_COLUMNS) & BYTE_MASK,
    1,
    divisorSite,
  );
}
// Three ASL of a product word and the cursor pixel, added with the carry of the shifts
// (the product's bit 13): the cursor's pixel position on its line.
function linePixel(wram, x, product) {
  const carry = (product >>> (WORD_BITS - PIXEL_SHIFT)) & 1;
  return (
    (((product << PIXEL_SHIFT) & WORD_MASK) + field(wram, WINDOW_CURSOR_PIXEL, x) + carry) &
    WORD_MASK
  );
}

// 81:ADBA: a cursor left of the window's left text pixel moves right to it.
function alignCursor(wram, port, x) {
  divideDistance(wram, port, x, 0x81adc9, 0x81add4);
  const behind =
    linePixel(wram, x, port.read(RDMPYL, 2, 0x81addd)) - field(wram, WINDOW_LEFT_PIXEL, x);
  if (behind >= 0) return;
  const step = -behind & WORD_MASK,
    pixel = ((step & PIXEL_MASK) + field(wram, WINDOW_CURSOR_PIXEL, x)) & WORD_MASK,
    carry = pixel >= TILE_PIXELS ? 1 : 0;
  setWord(wram, WINDOW_CURSOR_PIXEL + x, pixel & PIXEL_MASK);
  setWord(
    wram,
    WINDOW_CURSOR_TILE + x,
    (step >>> PIXEL_SHIFT) + field(wram, WINDOW_CURSOR_TILE, x) + carry,
  );
}
// 81:AE14: the pixels left on the cursor's line.
function lineRest(wram, port, x) {
  const distance =
    (field(wram, WINDOW_CURSOR_TILE, x) - field(wram, WINDOW_TILE_START, x)) & WORD_MASK;
  port.write(WRDIVL, distance, 2, 0x81ae23);
  const columns = (field(wram, WINDOW_COLUMNS, x) - BORDER_COLUMNS) & WORD_MASK;
  port.write(WRDIVB, columns & BYTE_MASK, 1, 0x81ae2e);
  setWord(wram, DP_LINE_WIDTH, columns << PIXEL_SHIFT);
  setWord(wram, DP_LINE_POSITION, linePixel(wram, x, port.read(RDMPYL, 2, 0x81ae39)));
  return (word(wram, DP_LINE_WIDTH) - word(wram, DP_LINE_POSITION)) & WORD_MASK;
}
// 81:AE4D: the cursor moves to the start of the next line, or of the window's first
// line past its last.
function newLine(wram, port, x) {
  divideDistance(wram, port, x, 0x81ae5c, 0x81ae67);
  // The last line before the reserved rows.
  const last = (byteField(wram, WINDOW_ROWS, x) - RESERVED_ROWS) & BYTE_MASK;
  if (last < port.read(RDDIVL, 1, 0x81ae73)) port.write(WRMPYA, 0, 1, 0x81ae78);
  else port.write(WRMPYA, (port.read(RDDIVL, 1, 0x81ae7d) + 1) & BYTE_MASK, 1, 0x81ae81);
  port.write(
    WRMPYB,
    (byteField(wram, WINDOW_COLUMNS, x) - BORDER_COLUMNS) & BYTE_MASK,
    1,
    0x81ae8a,
  );
  setWord(
    wram,
    WINDOW_CURSOR_TILE + x,
    field(wram, WINDOW_TILE_START, x) + port.read(RDMPYL, 2, 0x81ae94),
  );
  setWord(wram, WINDOW_CURSOR_PIXEL + x, 0);
}
// 81:AEC8: close the mask at the pixel offset (a partly drawn tile counts) and note the
// bytes to upload.
function closeMask(mem, wram) {
  let bytes = word(wram, TEXT_PENDING_BYTES);
  const offset = word(wram, TEXT_PIXEL_OFFSET);
  if (offset !== 0) {
    bytes = (bytes + MASK_TILE_BYTES) & WORD_MASK;
    setWord(wram, TEXT_PENDING_BYTES, bytes);
    setWord(wram, TEXT_WORK_WORD, romWord(mem, OFFSET_MASKS + ((offset << 1) & WORD_MASK)));
    for (let n = 0, y = bytes; n < MASK_WORDS; n++, y = (y - 2) & WORD_MASK) {
      const at = TEXT_MASK_BUFFER - 2 + y;
      setWord(wram, at, word(wram, at) | word(wram, TEXT_WORK_WORD));
    }
  }
  setWord(wram, TEXT_BUFFER_BYTES, bytes);
}
// The window's text tile at the cursor, in video memory (7E:020E).
function cursorAddress(wram, x) {
  setWord(
    wram,
    TEXT_BUFFER_VRAM_ADDRESS,
    (field(wram, WINDOW_CURSOR_TILE, x) << PIXEL_SHIFT) + VRAM_TEXT_TILES,
  );
}
// The mask rows: the bits left of the pixel offset kept, the others cleared (and at the
// start ANDed with the read-back tile).
function maskRows(wram, x, initial) {
  const offset = field(wram, WINDOW_CURSOR_PIXEL, x);
  setWord(wram, TEXT_PIXEL_OFFSET, offset);
  let mask = WORD_MASK;
  if (offset !== 0) {
    mask = shiftRight(mask, offset);
    setWord(wram, TEXT_WORK_WORD, mask);
    mask &= swap(mask);
  }
  mask ^= WORD_MASK;
  if (initial) setWord(wram, TEXT_INITIAL_MASK, mask);
  for (let at = MASK_LAST_WORD; at >= 0; at -= 2)
    setWord(
      wram,
      TEXT_MASK_BUFFER + at,
      initial ? word(wram, TEXT_MASK_BUFFER + at) & word(wram, TEXT_INITIAL_MASK) : mask,
    );
}
// The next word's width (from the character index to a space or the end) against the
// pixels left on the line: true when it does not fit. X keeps the word's last character
// (its glyph index).
function measureWord(s) {
  const { mem, wram } = s;
  setWord(wram, TEXT_WORK_WORD, 0);
  setWord(wram, TEXT_WORD_STATE, 0);
  for (let y = word(wram, TEXT_CHARACTER_INDEX); ;) {
    const ch = wram[TEXT_BUFFER + y];
    if (ch === 0 || ch === SPACE) break;
    if (ch === STYLE_TOGGLE) {
      wram[TEXT_COMPOSE_STYLE] |= STYLE_BOLD;
      wram[TEXT_BUFFER + y] = STYLE_PLACEHOLDER;
      continue;
    }
    y = (y + 1) & WORD_MASK;
    s.x = ch;
    if (wram[TEXT_COMPOSE_STYLE] & STYLE_BOLD)
      wram[TEXT_WORK_WORD] = (wram[TEXT_WORK_WORD] + 1) & BYTE_MASK;
    wram[TEXT_WORK_WORD] = (mem.read8(GLYPH_WIDTHS + ch) + wram[TEXT_WORK_WORD]) & BYTE_MASK;
  }
  return (word(wram, TEXT_WORK_WORD) || EMPTY_WORD_WIDTH) >= word(wram, TEXT_LINE_PIXELS);
}
// One character step: 'measure' after a word (its bold ends), 'end', or 'glyph' with the
// character (capitals with style 80) in s.character.
function nextCharacter(s) {
  const { wram } = s,
    capitals = (wram[TEXT_COMPOSE_STYLE] & BYTE_SIGN) !== 0;
  const endBold = () => {
    wram[TEXT_COMPOSE_STYLE] &= ~STYLE_BOLD;
    return 'measure';
  };
  if (wram[TEXT_WORD_STATE] & BYTE_SIGN) return endBold();
  s.x = word(wram, TEXT_CHARACTER_INDEX);
  let ch = wram[TEXT_BUFFER + s.x];
  if (ch === 0) return 'end';
  if (ch === SPACE) {
    if (wram[TEXT_WORD_STATE]) return endBold();
    wram[TEXT_WORD_STATE] = (wram[TEXT_WORD_STATE] - 1) & BYTE_MASK;
  } else wram[TEXT_WORD_STATE] = (wram[TEXT_WORD_STATE] + 1) & BYTE_MASK;
  s.x = (s.x + 1) & WORD_MASK;
  setWord(wram, TEXT_CHARACTER_INDEX, s.x);
  if (capitals && ch >= LOWER_FIRST && ch < LOWER_END) ch &= UPPER_MASK;
  s.character = ch;
  return 'glyph';
}
// Whether a glyph row is shifted one pixel: every second row (style 60), the lower (20)
// or the upper rows (40).
function shiftedRow(style, row) {
  if ((style & STYLE_SHIFT_ALL) === STYLE_SHIFT_ALL) return (row & 1) === 0;
  if (style & STYLE_SHIFT_LOW) return row < ROW_SHIFT_BOUNDARY;
  if (style & STYLE_SHIFT_HIGH) return row >= ROW_SHIFT_BOUNDARY;
  return false;
}
// Draw the glyph of character at the pixel offset into the mask, row by row from the
// bottom, and move the offset (and the pending bytes past a tile). X ends past the
// glyph's rows.
function drawGlyph(s, character) {
  const { mem, wram } = s;
  setWord(wram, TEXT_WORK_WORD, romWord(mem, GLYPH_WIDTHS + character) & BYTE_MASK);
  if (word(wram, TEXT_COMPOSE_STYLE) & STYLE_WIDER)
    setWord(wram, TEXT_WORK_WORD, word(wram, TEXT_WORK_WORD) + 1);
  let x = (character << PIXEL_SHIFT) & WORD_MASK;
  wram[TEXT_GLYPH_ROW] = GLYPH_LAST_ROW;
  do {
    const style = wram[TEXT_COMPOSE_STYLE],
      row = wram[TEXT_GLYPH_ROW];
    let bits = mem.read8(GLYPHS + x);
    if (style & STYLE_BOLD) bits |= bits << 1;
    wram[TEXT_GLYPH_BITS] = bits & BYTE_MASK;
    if (shiftedRow(style, row)) wram[TEXT_GLYPH_BITS] = (wram[TEXT_GLYPH_BITS] << 1) & BYTE_MASK;
    if (style & STYLE_UNDERLINE && row === 0 && x !== UNDERLINE_SKIP)
      wram[TEXT_GLYPH_BITS] = BYTE_MASK;
    wram[TEXT_GLYPH_HIGH] = 0;
    // The row's bits in the high byte, moved left past a narrow glyph's width, with the
    // bits past its width set, and moved right to the pixel offset.
    let pixels = swap(word(wram, TEXT_GLYPH_BITS));
    const width = word(wram, TEXT_WORK_WORD);
    if (width !== TILE_PIXELS) {
      const count = (TILE_PIXELS - width) & WORD_MASK;
      pixels = count < WORD_BITS ? (pixels << count) & WORD_MASK : 0;
    }
    pixels ^= romWord(mem, WIDTH_MASKS + ((width << 1) & WORD_MASK));
    const offset = word(wram, TEXT_PIXEL_OFFSET);
    if (offset !== 0) pixels = shiftRight(pixels, offset);
    let y = word(wram, TEXT_PENDING_BYTES);
    wram[TEXT_MASK_BUFFER + MASK_TILE_BYTES + y] = pixels & BYTE_MASK;
    wram[TEXT_MASK_BUFFER + y] = (pixels >>> BYTE_BITS) | wram[TEXT_MASK_BUFFER + y];
    y = (y + 1) & WORD_MASK;
    wram[TEXT_MASK_BUFFER + y] = BYTE_MASK;
    wram[TEXT_MASK_BUFFER + MASK_TILE_BYTES + y] = BYTE_MASK;
    setWord(wram, TEXT_PENDING_BYTES, y + 1);
    x = (x + 1) & WORD_MASK;
    wram[TEXT_GLYPH_ROW] = (wram[TEXT_GLYPH_ROW] - 1) & BYTE_MASK;
  } while (!(wram[TEXT_GLYPH_ROW] & BYTE_SIGN));
  s.x = x;
  const width = word(wram, TEXT_WORK_WORD),
    offset = (word(wram, TEXT_PIXEL_OFFSET) + width) & WORD_MASK;
  setWord(wram, TEXT_LINE_PIXELS, word(wram, TEXT_LINE_PIXELS) - width);
  setWord(wram, TEXT_PIXEL_OFFSET, offset & PIXEL_MASK);
  // Within the tile the pending bytes step back to its start.
  if (offset < TILE_PIXELS)
    setWord(wram, TEXT_PENDING_BYTES, word(wram, TEXT_PENDING_BYTES) - TILE_STEP_BACK);
}

// Push the frame of a JSL at site (in the running bank) and pull it again.
function pushLongFrame(h, site) {
  const { ctx, a } = h;
  a.write(ctx.s, ctx.programBank);
  ctx.s = (ctx.s - 1) & WORD_MASK;
  a.pushWord((site + JSL_LAST_BYTE) & WORD_MASK);
}
function pullLongFrame(h) {
  h.a.pullWord();
  h.ctx.s = (h.ctx.s + 1) & WORD_MASK;
}
// An upload request (81:AEF4 or 81:AEFC) as FB39 calls it with JSL: the request word
// counts up and the wait loop runs until the NMI has taken it. The request's own JSL
// frame lies only in free stack bytes and is not reproduced (game state only, user
// decision 2026-11-17); the wait keeps its frame.
function* requestUpload(h, events, wram, request) {
  const { ctx } = h;
  yield () => {
    ctx.programBank = REQUEST_BANK;
    setWord(wram, request.request, word(wram, request.request) + 1);
    pushLongFrame(h, request.waitSite);
  };
  // The wait's branch sees the request word's sign in 16-bit mode.
  for (let value; (value = word(wram, request.request)) !== 0;) {
    const status =
      (ctx.status & ~(FLAG_MEMORY_8BIT | FLAG_ZERO | FLAG_NEGATIVE)) |
      (value & WORD_SIGN ? FLAG_NEGATIVE : 0);
    yield* nmiAtBranch(h, events, request.branch, status);
  }
  yield () => {
    pullLongFrame(h);
    ctx.programBank = request.site >>> WORD_BITS;
  };
}

// Draw the text buffer into the window (80:FB39), a sequence for a native call
// continuation: h the caller's access (direct page 0, data bank 7E), events its frame
// events.
export function* drawTextBufferSequence(h, events) {
  const s = textState(h),
    { mem, wram, port } = s;
  const pendingMask = () => (word(wram, TEXT_PENDING_BYTES) | word(wram, TEXT_PIXEL_OFFSET)) !== 0;
  yield () => {
    s.x = word(wram, DP_WINDOW);
    alignCursor(wram, port, s.x);
    setWord(wram, TEXT_LINE_PIXELS, lineRest(wram, port, s.x));
    setWord(wram, TEXT_COMPOSE_STYLE, field(wram, WINDOW_STYLE, s.x));
    setWord(wram, TEXT_PENDING_BYTES, 0);
    cursorAddress(wram, s.x);
  };
  yield* requestUpload(h, events, wram, READBACK);
  yield () => {
    maskRows(wram, s.x, true);
    // The mask loop counts X down past 0.
    s.x = MASK_LOOP_END;
    setWord(wram, TEXT_CHARACTER_INDEX, 0);
  };
  // A line break: the mask uploaded if anything is drawn, the cursor on the next line; a
  // space at its start is skipped (then the next word is measured again). With nothing
  // drawn, the window is the index left in X by the step before (as the original).
  function* breakLine() {
    let pending, space;
    yield () => {
      pending = pendingMask();
      if (!pending) return;
      closeMask(mem, wram);
      setWord(wram, TEXT_PENDING_BYTES, 0);
      s.x = word(wram, DP_WINDOW);
    };
    if (pending) yield* requestUpload(h, events, wram, LINE_UPLOAD);
    yield () => {
      newLine(wram, port, s.x);
      alignCursor(wram, port, s.x);
      cursorAddress(wram, s.x);
      setWord(wram, TEXT_LINE_PIXELS, lineRest(wram, port, s.x));
      maskRows(wram, s.x, false);
      s.x = word(wram, TEXT_CHARACTER_INDEX);
      space = wram[TEXT_BUFFER + s.x] === SPACE;
      if (!space) return;
      s.x = (s.x + 1) & WORD_MASK;
      setWord(wram, TEXT_CHARACTER_INDEX, s.x);
    };
    return space;
  }
  // Text language: a glyph that no longer fits its line is left out.
  const overflows = () =>
    mem.read8(GLYPH_WIDTHS + s.character) + (wram[TEXT_COMPOSE_STYLE] & STYLE_WIDER ? 1 : 0) >
    word(wram, TEXT_LINE_PIXELS);
  let measure = true;
  for (;;) {
    if (measure) {
      let wide;
      yield () => {
        wide = measureWord(s);
      };
      if (wide && (yield* breakLine())) continue;
    }
    let action;
    yield () => {
      action = nextCharacter(s);
    };
    if (action === 'end') break;
    measure = action === 'measure';
    if (measure) continue;
    if (mem.language && overflows()) continue;
    yield () => drawGlyph(s, s.character);
  }
  let pending;
  yield () => {
    pending = pendingMask();
    if (!pending) return;
    closeMask(mem, wram);
    // The cursor moves past the pending tiles; a half tile (bit 3, the carry of the
    // shifts) counts as one more.
    const bytes = word(wram, TEXT_PENDING_BYTES),
      half = (bytes >>> (TILE_BYTE_SHIFT - 1)) & 1;
    s.x = word(wram, DP_WINDOW);
    setWord(
      wram,
      WINDOW_CURSOR_TILE + s.x,
      (bytes >>> TILE_BYTE_SHIFT) + field(wram, WINDOW_CURSOR_TILE, s.x) + half,
    );
    setWord(wram, WINDOW_CURSOR_PIXEL + s.x, word(wram, TEXT_PIXEL_OFFSET));
  };
  if (pending) yield* requestUpload(h, events, wram, END_UPLOAD);
  let result;
  yield () => {
    // The original returns with a 16-bit accumulator.
    h.ctx.status &= ~FLAG_MEMORY_8BIT;
    result = h.rts();
  };
  return result;
}
