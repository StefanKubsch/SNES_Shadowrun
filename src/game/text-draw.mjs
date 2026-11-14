// Drawing the text buffer into a window (lifted from 80:FB39 with the cursor geometry
// 81:ADBA, 81:AE14 and 81:AE4D, the mask close 81:AEC8 and the upload requests 81:AEF4
// and 81:AEFC; register-level versions in src/task/native-text-compose.mjs and
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
// Registers: the routine works in the direct page words A2 to D2 and leaves X, Y, the
// carry and the overflow as the original, A 0 with zero set and sign clear. The upload
// requests wait for the NMI with the original's X, Y, carry and overflow, and run below
// the frames of their two JSLs, with A the request word, as the original; with the
// lag-free frame model they are lifted, otherwise (recorded observations, the function
// tests) the register-level requests run through their frames. With recorded interrupts
// inside a glyph (the Mesen cold boot replay) the register-level routine runs. The frames
// of the calls that do not wait (geometry, mask) and the routine's own pushes are not
// reproduced.
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { lagFree } from '../task/main-wait-interrupt.mjs';
import { nmiAtBranch } from '../system/frame-wait.mjs';
import {
  drawTextBufferSequence as drawTextBufferReference,
  textRequestWaitSequence,
} from '../task/native-text-compose.mjs';
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
  WINDOW_TILE_INITIAL,
  WINDOW_TILE_START,
} from '../task/wram.mjs';
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
import {
  FLAG_CARRY,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_OVERFLOW,
  FLAG_ZERO,
} from '../constants/cpu-flags.mjs';

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

// The registers the routine leaves: a (16 bits; byte operations keep the high byte),
// x, y, the carry c and the overflow v.
class Registers {
  constructor(ctx) {
    this.a = ctx.a;
    this.x = ctx.x;
    this.y = ctx.y;
    this.c = (ctx.status & FLAG_CARRY) !== 0;
    this.v = (ctx.status & FLAG_OVERFLOW) !== 0;
  }
  byte(value) {
    this.a = (this.a & ~BYTE_MASK) | (value & BYTE_MASK);
    return value & BYTE_MASK;
  }
  // ADC and SBC of 16-bit words (subtraction with the carry as no borrow).
  add(left, right, carry) {
    const sum = left + right + (carry ? 1 : 0),
      result = sum & WORD_MASK;
    this.c = sum > WORD_MASK;
    this.v = (~(left ^ right) & (left ^ result) & WORD_SIGN) !== 0;
    this.a = result;
    return result;
  }
  subtract(left, right, carry) {
    const difference = left - right - (carry ? 0 : 1),
      result = difference & WORD_MASK;
    this.c = difference >= 0;
    this.v = ((left ^ right) & (left ^ result) & WORD_SIGN) !== 0;
    this.a = result;
    return result;
  }
  // Three ASL of a word: the carry is its bit 13.
  shiftTile(value) {
    this.c = ((value >>> (WORD_BITS - PIXEL_SHIFT)) & 1) !== 0;
    this.a = (value << PIXEL_SHIFT) & WORD_MASK;
    return this.a;
  }
  // LSR of A count times (count 1 to 65535), as the original's loop with DEY.
  shiftRight(count) {
    const old = this.a;
    this.c = count <= WORD_BITS && ((old >>> (count - 1)) & 1) !== 0;
    this.a = count < WORD_BITS ? old >>> count : 0;
    this.y = 0;
  }
  store(ctx) {
    ctx.a = this.a;
    ctx.x = this.x;
    ctx.y = this.y;
    ctx.status = this.c ? ctx.status | FLAG_CARRY : ctx.status & ~FLAG_CARRY;
    ctx.status = this.v ? ctx.status | FLAG_OVERFLOW : ctx.status & ~FLAG_OVERFLOW;
  }
}

// The text drawing's state: memory, port and registers, with the window in r.x.
function textState(h) {
  const { mem, wram, port } = sceneRuntime(h);
  return { mem, wram, port, r: new Registers(h.ctx) };
}
const field = (wram, table, x) => word(wram, table + x);
const byteField = (wram, table, x) => wram[table + x];

// The cursor tile's distance from the window's first text tile, divided by the text
// columns on the divider (started here; the sites are the dividend's and divisor's).
function divideDistance({ wram, port, r }, dividendSite, divisorSite) {
  const x = r.x;
  r.subtract(field(wram, WINDOW_CURSOR_TILE, x), field(wram, WINDOW_TILE_START, x), true);
  port.write(WRDIVL, r.a, 2, dividendSite);
  r.byte(byteField(wram, WINDOW_COLUMNS, x) - BORDER_COLUMNS);
  port.write(WRDIVB, r.a & BYTE_MASK, 1, divisorSite);
}

// 81:ADBA: a cursor left of the window's left text pixel moves right to it.
function alignCursor(s) {
  const { wram, port, r } = s,
    x = r.x;
  divideDistance(s, 0x81adc9, 0x81add4);
  r.shiftTile(port.read(RDMPYL, 2, 0x81addd));
  r.add(r.a, field(wram, WINDOW_CURSOR_PIXEL, x), r.c);
  r.subtract(r.a, field(wram, WINDOW_LEFT_PIXEL, x), true);
  if (r.c) return;
  const step = -r.a & WORD_MASK;
  r.add(step & PIXEL_MASK, field(wram, WINDOW_CURSOR_PIXEL, x), false);
  const carry = r.a >= TILE_PIXELS;
  setWord(wram, WINDOW_CURSOR_PIXEL + x, r.a & PIXEL_MASK);
  setWord(
    wram,
    WINDOW_CURSOR_TILE + x,
    r.add(step >>> PIXEL_SHIFT, field(wram, WINDOW_CURSOR_TILE, x), carry),
  );
}
// 81:AE14: the pixels left on the cursor's line (in A).
function lineRest(s) {
  const { wram, port, r } = s,
    x = r.x;
  r.subtract(field(wram, WINDOW_CURSOR_TILE, x), field(wram, WINDOW_TILE_START, x), true);
  port.write(WRDIVL, r.a, 2, 0x81ae23);
  const columns = (field(wram, WINDOW_COLUMNS, x) - BORDER_COLUMNS) & WORD_MASK;
  port.write(WRDIVB, columns & BYTE_MASK, 1, 0x81ae2e);
  setWord(wram, DP_LINE_WIDTH, r.shiftTile(columns));
  r.shiftTile(port.read(RDMPYL, 2, 0x81ae39));
  setWord(wram, DP_LINE_POSITION, r.add(r.a, field(wram, WINDOW_CURSOR_PIXEL, x), r.c));
  r.subtract(word(wram, DP_LINE_WIDTH), word(wram, DP_LINE_POSITION), true);
}
// 81:AE4D: the cursor moves to the start of the next line, or of the window's first
// line past its last.
function newLine(s) {
  const { wram, port, r } = s,
    x = r.x;
  divideDistance(s, 0x81ae5c, 0x81ae67);
  // The last line before the reserved rows (its carry and overflow are replaced below).
  const last = r.byte(byteField(wram, WINDOW_ROWS, x) - RESERVED_ROWS);
  if (last < port.read(RDDIVL, 1, 0x81ae73)) port.write(WRMPYA, 0, 1, 0x81ae78);
  else port.write(WRMPYA, r.byte(port.read(RDDIVL, 1, 0x81ae7d) + 1), 1, 0x81ae81);
  r.byte(byteField(wram, WINDOW_COLUMNS, x) - BORDER_COLUMNS);
  port.write(WRMPYB, r.a & BYTE_MASK, 1, 0x81ae8a);
  const tile = r.add(field(wram, WINDOW_TILE_START, x), port.read(RDMPYL, 2, 0x81ae94), false);
  setWord(wram, WINDOW_CURSOR_TILE + x, tile);
  setWord(wram, WINDOW_CURSOR_PIXEL + x, 0);
  r.c = tile >= field(wram, WINDOW_TILE_INITIAL, x);
}
// 81:AEC8: close the mask at the pixel offset (a partly drawn tile counts) and note the
// bytes to upload.
function closeMask({ mem, wram, r }) {
  r.a = word(wram, TEXT_PENDING_BYTES);
  r.x = word(wram, TEXT_PIXEL_OFFSET);
  if (r.x !== 0) {
    setWord(wram, TEXT_PENDING_BYTES, r.add(r.a, MASK_TILE_BYTES, false));
    r.y = r.a;
    r.c = (r.x & WORD_SIGN) !== 0;
    r.x = (r.x << 1) & WORD_MASK;
    setWord(wram, TEXT_WORK_WORD, romWord(mem, OFFSET_MASKS + r.x));
    for (let n = 0; n < MASK_WORDS; n++) {
      const at = TEXT_MASK_BUFFER - 2 + r.y;
      setWord(wram, at, word(wram, at) | word(wram, TEXT_WORK_WORD));
      r.y = (r.y - 2) & WORD_MASK;
    }
    r.x = 0;
    r.a = word(wram, TEXT_PENDING_BYTES);
  }
  setWord(wram, TEXT_BUFFER_BYTES, r.a);
}
// The window's text tile at the cursor, in video memory (7E:020E).
function cursorAddress({ wram, r }) {
  r.shiftTile(field(wram, WINDOW_CURSOR_TILE, r.x));
  setWord(wram, TEXT_BUFFER_VRAM_ADDRESS, r.add(r.a, VRAM_TEXT_TILES, false));
}
// The mask rows: the bits left of the pixel offset kept, the others cleared (and at the
// start ANDed with the read-back tile).
function maskRows({ wram, r }, initial) {
  const offset = field(wram, WINDOW_CURSOR_PIXEL, r.x);
  setWord(wram, TEXT_PIXEL_OFFSET, offset);
  r.y = offset;
  r.a = WORD_MASK;
  if (offset !== 0) {
    r.shiftRight(offset);
    setWord(wram, TEXT_WORK_WORD, r.a);
    r.a = swap(r.a) & r.a;
  }
  r.a ^= WORD_MASK;
  if (initial) setWord(wram, TEXT_INITIAL_MASK, r.a);
  for (let x = MASK_LAST_WORD; x >= 0; x -= 2) {
    if (initial) r.a = word(wram, TEXT_MASK_BUFFER + x) & word(wram, TEXT_INITIAL_MASK);
    setWord(wram, TEXT_MASK_BUFFER + x, r.a);
  }
  // The loop counts X down past 0.
  r.x = MASK_LOOP_END;
}
// The next word's width (from the character index to a space or the end) against the
// pixels left on the line: the carry set when it does not fit.
function measureWord({ mem, wram, r }) {
  setWord(wram, TEXT_WORK_WORD, 0);
  setWord(wram, TEXT_WORD_STATE, 0);
  r.a = 0;
  r.y = word(wram, TEXT_CHARACTER_INDEX);
  for (;;) {
    const ch = r.byte(wram[TEXT_BUFFER + r.y]);
    if (ch === 0 || ch === SPACE) break;
    if (ch === STYLE_TOGGLE) {
      wram[TEXT_COMPOSE_STYLE] |= STYLE_BOLD;
      wram[TEXT_BUFFER + r.y] = r.byte(STYLE_PLACEHOLDER);
      continue;
    }
    r.y = (r.y + 1) & WORD_MASK;
    r.x = r.a;
    if (wram[TEXT_COMPOSE_STYLE] & STYLE_BOLD)
      wram[TEXT_WORK_WORD] = (wram[TEXT_WORK_WORD] + 1) & BYTE_MASK;
    const glyph = mem.read8(GLYPH_WIDTHS + r.x),
      sum = glyph + wram[TEXT_WORK_WORD],
      width = sum & BYTE_MASK;
    r.c = sum > BYTE_MASK;
    r.v = (~(glyph ^ wram[TEXT_WORK_WORD]) & (glyph ^ width) & BYTE_SIGN) !== 0;
    r.byte(width);
    wram[TEXT_WORK_WORD] = width;
  }
  r.a = word(wram, TEXT_WORK_WORD) || EMPTY_WORD_WIDTH;
  r.c = r.a >= word(wram, TEXT_LINE_PIXELS);
  return r.c;
}
// One character step: 'measure' after a word (its bold ends), 'end', or 'glyph' with the
// character in A's low byte (capitals with style 80).
function nextCharacter({ wram, r }) {
  const style = r.byte(wram[TEXT_COMPOSE_STYLE]);
  r.y = r.a;
  r.c = (style & BYTE_SIGN) !== 0;
  r.byte(style << 1);
  const endBold = () => {
    r.byte(STYLE_BOLD);
    wram[TEXT_COMPOSE_STYLE] &= ~STYLE_BOLD;
    return 'measure';
  };
  if (r.byte(wram[TEXT_WORD_STATE]) & BYTE_SIGN) return endBold();
  r.x = word(wram, TEXT_CHARACTER_INDEX);
  let ch = r.byte(wram[TEXT_BUFFER + r.x]);
  if (ch === 0) return 'end';
  const capitals = r.c;
  if (ch === SPACE) {
    if (r.byte(wram[TEXT_WORD_STATE])) {
      r.c = capitals;
      return endBold();
    }
    wram[TEXT_WORD_STATE] = (wram[TEXT_WORD_STATE] - 1) & BYTE_MASK;
    ch = r.byte(SPACE);
  } else wram[TEXT_WORD_STATE] = (wram[TEXT_WORD_STATE] + 1) & BYTE_MASK;
  r.x = (r.x + 1) & WORD_MASK;
  setWord(wram, TEXT_CHARACTER_INDEX, r.x);
  r.c = capitals;
  if (capitals) {
    r.c = ch >= LOWER_FIRST;
    if (r.c) {
      r.c = ch >= LOWER_END;
      if (!r.c) r.byte(ch & UPPER_MASK);
    }
  }
  return 'glyph';
}
// Draw the glyph of the character in A's low byte at the pixel offset into the mask,
// row by row from the bottom, and move the offset (and the pending bytes past a tile).
function drawGlyph({ mem, wram, r }) {
  r.a &= BYTE_MASK;
  r.x = r.a;
  setWord(wram, TEXT_WORK_WORD, romWord(mem, GLYPH_WIDTHS + r.x) & BYTE_MASK);
  r.a = word(wram, TEXT_COMPOSE_STYLE) & STYLE_WIDER;
  if (r.a) setWord(wram, TEXT_WORK_WORD, word(wram, TEXT_WORK_WORD) + 1);
  r.x = r.shiftTile(r.x);
  r.byte(GLYPH_LAST_ROW);
  wram[TEXT_GLYPH_ROW] = GLYPH_LAST_ROW;
  do {
    const style = r.byte(wram[TEXT_COMPOSE_STYLE]),
      row = () => wram[TEXT_GLYPH_ROW];
    r.y = r.a;
    let bits = mem.read8(GLYPHS + r.x);
    if (style & STYLE_BOLD) {
      r.c = (bits & BYTE_SIGN) !== 0;
      bits = (bits << 1) | bits;
    }
    wram[TEXT_GLYPH_BITS] = r.byte(bits);
    let shift = false;
    // Shifted rows: every second (60), the lower (20) or the upper ones (40); A is
    // replaced before it is read.
    if ((style & STYLE_SHIFT_ALL) === STYLE_SHIFT_ALL) {
      r.c = (row() & 1) !== 0;
      shift = !r.c;
    } else {
      r.c = false;
      if (style & STYLE_SHIFT_LOW) {
        r.c = row() >= ROW_SHIFT_BOUNDARY;
        shift = !r.c;
      } else if (style & STYLE_SHIFT_HIGH) {
        r.c = row() >= ROW_SHIFT_BOUNDARY;
        shift = r.c;
      }
    }
    if (shift) {
      r.c = (wram[TEXT_GLYPH_BITS] & BYTE_SIGN) !== 0;
      wram[TEXT_GLYPH_BITS] = (wram[TEXT_GLYPH_BITS] << 1) & BYTE_MASK;
    }
    r.byte(style & STYLE_UNDERLINE);
    if (style & STYLE_UNDERLINE) {
      r.byte(row());
      if (row() === 0) {
        r.c = r.x >= UNDERLINE_SKIP;
        if (r.x !== UNDERLINE_SKIP) wram[TEXT_GLYPH_BITS] = r.byte(BYTE_MASK);
      }
    }
    wram[TEXT_GLYPH_HIGH] = 0;
    r.a = swap(word(wram, TEXT_GLYPH_BITS));
    r.y = word(wram, TEXT_WORK_WORD);
    r.c = r.y >= TILE_PIXELS;
    if (r.y !== TILE_PIXELS) {
      const count = (TILE_PIXELS - r.y) & WORD_MASK;
      r.a = count < WORD_BITS ? (r.a << count) & WORD_MASK : 0;
      r.y = TILE_PIXELS;
      r.c = true;
    }
    const width = word(wram, TEXT_WORK_WORD);
    r.c = (width & WORD_SIGN) !== 0;
    r.a ^= romWord(mem, WIDTH_MASKS + ((width << 1) & WORD_MASK));
    r.y = word(wram, TEXT_PIXEL_OFFSET);
    if (r.y !== 0) r.shiftRight(r.y);
    r.y = word(wram, TEXT_PENDING_BYTES);
    wram[TEXT_MASK_BUFFER + MASK_TILE_BYTES + r.y] = r.a & BYTE_MASK;
    r.a = swap(r.a);
    wram[TEXT_MASK_BUFFER + r.y] = r.byte(r.a | wram[TEXT_MASK_BUFFER + r.y]);
    r.y = (r.y + 1) & WORD_MASK;
    r.byte(BYTE_MASK);
    wram[TEXT_MASK_BUFFER + r.y] = BYTE_MASK;
    wram[TEXT_MASK_BUFFER + MASK_TILE_BYTES + r.y] = BYTE_MASK;
    r.y = (r.y + 1) & WORD_MASK;
    setWord(wram, TEXT_PENDING_BYTES, r.y);
    r.x = (r.x + 1) & WORD_MASK;
    wram[TEXT_GLYPH_ROW] = (wram[TEXT_GLYPH_ROW] - 1) & BYTE_MASK;
  } while (!(wram[TEXT_GLYPH_ROW] & BYTE_SIGN));
  const width = word(wram, TEXT_WORK_WORD);
  setWord(wram, TEXT_LINE_PIXELS, r.subtract(word(wram, TEXT_LINE_PIXELS), width, true));
  r.add(word(wram, TEXT_PIXEL_OFFSET), width, false);
  r.c = r.a >= TILE_PIXELS;
  setWord(wram, TEXT_PIXEL_OFFSET, (r.a &= PIXEL_MASK));
  if (!r.c)
    setWord(
      wram,
      TEXT_PENDING_BYTES,
      r.subtract(word(wram, TEXT_PENDING_BYTES), TILE_STEP_BACK - 1, false),
    );
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
// counts up and the wait loop runs until the NMI has taken it. The registers of r go
// in; A is 0 afterwards with zero set and sign clear.
function* requestUpload(h, events, s, request) {
  const { ctx } = h,
    { wram, r } = s;
  yield () => r.store(ctx);
  if (!lagFree(events)) {
    yield* textRequestWaitSequence(
      h.a,
      events,
      request.name,
      request.site,
      request.site + JSL_LAST_BYTE + 1,
      request.target,
    );
  } else {
    yield () => {
      pushLongFrame(h, request.site);
      ctx.programBank = REQUEST_BANK;
      setWord(wram, request.request, word(wram, request.request) + 1);
      pushLongFrame(h, request.waitSite);
    };
    for (let value; (value = word(wram, request.request)) !== 0;) {
      ctx.a = value;
      const status =
        (ctx.status & ~(FLAG_MEMORY_8BIT | FLAG_ZERO | FLAG_NEGATIVE)) |
        (value & WORD_SIGN ? FLAG_NEGATIVE : 0);
      yield* nmiAtBranch(h, events, request.branch, status);
    }
    yield () => {
      pullLongFrame(h);
      pullLongFrame(h);
      ctx.programBank = request.site >>> WORD_BITS;
    };
  }
  yield () => {
    r.a = 0;
    ctx.status = (ctx.status | FLAG_ZERO) & ~FLAG_NEGATIVE;
  };
}

// Draw the text buffer into the window (80:FB39), a sequence for a native call
// continuation: h the caller's access (direct page 0, data bank 7E), events its frame
// events.
export function* drawTextBufferSequence(h, events) {
  if (events?.startupInterrupts) return yield* drawTextBufferReference(h.a, events, false);
  const s = textState(h),
    { mem, wram, r } = s;
  yield () => {
    r.x = word(wram, DP_WINDOW);
    alignCursor(s);
    lineRest(s);
    setWord(wram, TEXT_LINE_PIXELS, r.a);
    r.a = field(wram, WINDOW_STYLE, r.x);
    setWord(wram, TEXT_COMPOSE_STYLE, r.a);
    setWord(wram, TEXT_PENDING_BYTES, 0);
    cursorAddress(s);
  };
  yield* requestUpload(h, events, s, READBACK);
  yield () => {
    maskRows(s, true);
    setWord(wram, TEXT_CHARACTER_INDEX, 0);
  };
  // A line break: the mask uploaded if anything is drawn, the cursor on the next line; a
  // space at its start is skipped (then the next word is measured again).
  function* breakLine() {
    let pending, space;
    yield () => {
      r.a = word(wram, TEXT_PENDING_BYTES) | word(wram, TEXT_PIXEL_OFFSET);
      pending = r.a !== 0;
      if (!pending) return;
      closeMask(s);
      setWord(wram, TEXT_PENDING_BYTES, 0);
      r.x = word(wram, DP_WINDOW);
    };
    if (pending) yield* requestUpload(h, events, s, LINE_UPLOAD);
    yield () => {
      newLine(s);
      alignCursor(s);
      cursorAddress(s);
      lineRest(s);
      setWord(wram, TEXT_LINE_PIXELS, r.a);
      maskRows(s, false);
      r.x = word(wram, TEXT_CHARACTER_INDEX);
      r.a = wram[TEXT_BUFFER + r.x];
      r.c = r.a >= SPACE;
      space = r.a === SPACE;
      if (!space) return;
      r.x = (r.x + 1) & WORD_MASK;
      setWord(wram, TEXT_CHARACTER_INDEX, r.x);
    };
    return space;
  }
  // Text language: a glyph that no longer fits its line is left out.
  const overflows = () =>
    mem.read8(GLYPH_WIDTHS + (r.a & BYTE_MASK)) + (wram[TEXT_COMPOSE_STYLE] & STYLE_WIDER ? 1 : 0) >
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
    yield () => drawGlyph(s);
  }
  let pending;
  yield () => {
    r.a = word(wram, TEXT_PENDING_BYTES) | word(wram, TEXT_PIXEL_OFFSET);
    pending = r.a !== 0;
    if (!pending) return;
    closeMask(s);
    r.a = word(wram, TEXT_PENDING_BYTES);
    r.c = ((r.a >>> (TILE_BYTE_SHIFT - 1)) & 1) !== 0;
    r.a >>>= TILE_BYTE_SHIFT;
    r.x = word(wram, DP_WINDOW);
    setWord(wram, WINDOW_CURSOR_TILE + r.x, r.add(r.a, field(wram, WINDOW_CURSOR_TILE, r.x), r.c));
    r.a = word(wram, TEXT_PIXEL_OFFSET);
    setWord(wram, WINDOW_CURSOR_PIXEL + r.x, r.a);
  };
  if (pending) yield* requestUpload(h, events, s, END_UPLOAD);
  let result;
  yield () => {
    const { ctx } = h;
    r.a = 0;
    r.store(ctx);
    ctx.status = (ctx.status | FLAG_ZERO) & ~(FLAG_NEGATIVE | FLAG_MEMORY_8BIT);
    result = h.rts();
  };
  return result;
}
