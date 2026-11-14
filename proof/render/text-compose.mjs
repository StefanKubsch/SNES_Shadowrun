import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderAF04 } from './text-width-fadd.mjs';
import { renderADBA, renderAE14, renderAE4D } from './text-geometry.mjs';
import { renderAEC8 } from './text-mask-aec8.mjs';
import { renderAEF4, renderAEFC } from './request-aef4.mjs';
import { textHelperAccess, textHelperResult, textNZ } from './text-helper-access.mjs';
import {
  BYTE_MASK,
  WORD_MASK,
  BYTE_BITS,
  WORD_SIGN,
  BANK_SIZE,
  LONG_MASK,
  BYTE_SIGN,
  WORD_BITS,
} from '../../src/constants/bits.mjs';
import { WRAM_BASE, WRAM_BANK } from '../../src/constants/memory-map.mjs';
import {
  HUFFMAN_TEXT_END,
  TEXT_POINTER_BANK_SEED,
  HUFFMAN_CHARACTER_PAIR_MASK,
} from '../../src/task/native-text-compose.mjs';
import {
  TEXT_BUFFER,
  TEXT_SOURCE_BANK_WORD,
  TEXT_SOURCE_POINTER,
  TEXT_BITS_REMAINING,
  TEXT_COMPOSE_STYLE,
  WINDOW_CURSOR_TILE,
  TEXT_BUFFER_VRAM_ADDRESS,
  WINDOW_CURSOR_PIXEL,
  TEXT_PIXEL_OFFSET,
  TEXT_WORK_WORD,
  TEXT_INITIAL_MASK,
  TEXT_MASK_BUFFER,
  TEXT_WORD_STATE,
  TEXT_CHARACTER_INDEX,
  TEXT_LINE_PIXELS,
  TEXT_PENDING_BYTES,
  TEXT_GLYPH_ROW,
  TEXT_GLYPH_BITS,
  TEXT_GLYPH_HIGH,
  WINDOW_STYLE,
} from '../../src/task/wram.mjs';
import {
  FLAG_MEMORY_8BIT,
  FLAG_OVERFLOW,
  FLAG_NEGATIVE,
  FLAG_CARRY,
} from '../../src/constants/cpu-flags.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const DECODE_STACK_BYTES = 12;
const COMPOSE_STACK_BYTES = 9;
const BYTE_TOP_BIT_SHIFT = 7;
const WORD_TOP_BIT_SHIFT = 15;
const STATUS_CV = FLAG_CARRY | FLAG_OVERFLOW;
// Original composition values, matching the named native glyph equations.
const TEXT_MASK_BYTES = 0x10;
const GLYPH_BOLD_STYLE = 0x8;
const TEXT_TILE_VRAM_START = 0x5000;
const EMPTY_WORD_WIDTH = 0x5;
const GLYPH_LAST_ROW = 0x7;
const GLYPH_ROW_SHIFT_STYLES = 0x60;
const GLYPH_SHIFT_LOW_ROW_INDICES = 0x20;
const GLYPH_ROW_SHIFT_BOUNDARY = 0x5;
const GLYPH_SHIFT_HIGH_ROW_INDICES = 0x40;
const GLYPH_UNDERLINE_STYLE = 0x10;
const GLYPH_UNDERLINE_SKIP_INDEX = 0x107;
const GLYPH_ROW_PIXELS = 0x8;
const GLYPH_PIXEL_MASK = 0x7;
const GLYPH_EXTRA_STYLE = 0x68;
const TEXT_MASK_ADVANCE_SUBTRAHEND = 0xf;
const TEXT_MASK_LAST_WORD = 0xe;
const CHARACTER_SPACE = 0x20;
const CHARACTER_STYLE_TOGGLE = 0x7c;
const CHARACTER_STYLE_PLACEHOLDER = 0x1a;
const CHARACTER_LOWERCASE_FIRST = 0x61;
const CHARACTER_LOWERCASE_END = 0x7b;
const CHARACTER_UPPERCASE_MASK = 0x5f;

function prepare(
  run,
  stackBytes,
  {
    data,
    bank = null,
    status = null,
    emulation = null,
    directPage = null,
    stackWindow = null,
    maxWork = DEFAULT_MAX_WORK,
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
    ioMode = null,
    ioRead4214 = null,
    ioRead4216 = null,
    waitMode = null,
    waitRead01FA = null,
    waitRead01FC = null,
  } = {},
) {
  if (
    (ioMode !== null && ioMode !== 'record-requests') ||
    (waitMode !== null && waitMode !== 'record-observations') ||
    [ioRead4216, waitRead01FA, waitRead01FC].some(
      (v) => v !== null && (!Array.isArray(v) || !Array.from(v).every(isWord)),
    ) ||
    (ioRead4214 !== null &&
      (!Array.isArray(ioRead4214) ||
        !Array.from(ioRead4214).every((v) => Number.isInteger(v) && v >= 0 && v <= BYTE_MASK)))
  )
    throw Error('Invalid render text composition context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    stackBytes,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => WRAM_BASE + v),
  );
  try {
    return view.finish(
      run(
        view,
        { bank, status, ioMode, ioRead4214, ioRead4216, waitMode, waitRead01FA, waitRead01FC },
        { work: 0, maxWork, maxOutputBytes, outputBytes: 0 },
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}
export const prepareRenderFE69 = (context) => prepare(renderFE69, DECODE_STACK_BYTES, context);
export const prepareRenderFB39 = (context) => prepare(renderFB39, COMPOSE_STACK_BYTES, context);

const observations = () => ({ quotientReads: 0, resultReads: 0, pollsFA: 0, pollsFC: 0 });
const append = (operations, result) => {
  for (const event of result.operations) operations.push(event);
};
function output(budget, bytes) {
  budget.outputBytes = (budget.outputBytes ?? 0) + bytes;
  if (budget.outputBytes > budget.maxOutputBytes)
    throw { renderBoundary: true, reason: 'render_output_budget_required' };
}

// FE69's fixed dictionary traversal and emission algorithm. DBR 7E is local;
// all bit reads and the complete composer share this view and outer budget.
export function renderFE69(view, context, budget) {
  const operations = [],
    io = textHelperAccess(view, budget, operations, 'decodeFE69');
  const counts = context.observations ?? observations(),
    entryBank = context.bank;
  let status = context.status,
    a,
    x,
    y = 0,
    bits = 0,
    characters = 0;
  const wordLoad = (value) => {
    a = value & WORD_MASK;
    status = textNZ(status, a);
  };
  const swap = () => {
    a = (a >>> BYTE_BITS) | ((a & BYTE_MASK) << BYTE_BITS);
    status = textNZ(status, a & BYTE_MASK, 1);
  };
  const newline = () => {
    const low = a & BYTE_MASK;
    status = textNZ(
      (status & ~1) | (low >= HUFFMAN_TEXT_END ? 1 : 0),
      (low - HUFFMAN_TEXT_END) & BYTE_MASK,
      1,
    );
    return low === HUFFMAN_TEXT_END;
  };
  const emit = (value) => {
    output(budget, 1);
    io.write(WRAM_BASE + TEXT_BUFFER + y, value, 1);
  };
  io.write(TEXT_SOURCE_BANK_WORD, TEXT_POINTER_BANK_SEED);
  wordLoad(io.read(2));
  if (a & WORD_SIGN) {
    const next = (io.read(TEXT_SOURCE_BANK_WORD) + 1) & WORD_MASK;
    io.write(TEXT_SOURCE_BANK_WORD, next);
    status = textNZ(status, next);
  }
  wordLoad(a | WORD_SIGN);
  io.write(TEXT_SOURCE_POINTER, a);
  status = textNZ(status, WRAM_BANK, 1);
  io.write(WRAM_BASE + TEXT_BITS_REMAINING, 0);
  status |= FLAG_MEMORY_8BIT;
  status = textNZ(status, y);
  decode: for (;;) {
    status &= ~FLAG_MEMORY_8BIT;
    wordLoad(0);
    do {
      x = a;
      status = textNZ(status, x);
      const bit = renderAF04(view, { bank: WRAM_BANK, status, a, x, y }, budget);
      append(operations, bit);
      status = bit.status;
      bits++;
      if (bit.carry) {
        x = (x + 2) & WORD_MASK;
        status = textNZ(status, x);
      }
      wordLoad(io.read(0x9d8000 + x));
    } while (!(a & WORD_SIGN));
    wordLoad(a & HUFFMAN_CHARACTER_PAIR_MASK);
    swap();
    status |= FLAG_MEMORY_8BIT;
    if (newline()) break;
    emit(a);
    characters++;
    y = (y + 1) & WORD_MASK;
    status = textNZ(status, y);
    swap();
    if (!(a & BYTE_MASK)) continue;
    if (newline()) break decode;
    emit(a);
    characters++;
    y = (y + 1) & WORD_MASK;
    status = textNZ(status, y);
  }
  x = y;
  status = textNZ(status, x);
  emit(0);
  status &= ~FLAG_MEMORY_8BIT;
  const composed = renderFB39(
    view,
    { ...context, bank: WRAM_BANK, status, observations: counts },
    budget,
  );
  append(operations, composed);
  status = textNZ(composed.status, entryBank, 1);
  return textHelperResult(
    { a: composed.a, x: composed.x, y: composed.y, bank: entryBank, status },
    budget,
    operations,
    {
      outcome: 'text_decoded_composed',
      bits,
      characters,
      glyphs: composed.glyphs,
      rows: composed.rows,
      newlines: composed.newlines,
      outputBytes: budget.outputBytes,
      ...counts,
    },
  );
}

// FB39's source-specific word measurement, line transition and eight-row
// glyph algorithm. No opcode dispatch, calculated MMIO result or clock.
export function renderFB39(view, context, budget) {
  const operations = [],
    io = textHelperAccess(view, budget, operations, 'composeFB39');
  const counts = context.observations ?? observations(),
    base = context.bank * BANK_SIZE;
  const absolute = (offset, index = 0) => (base + offset + index) & LONG_MASK;
  const r = { a: 0, x: 0, y: 0, bank: context.bank, status: context.status };
  let glyphs = 0,
    rows = 0,
    newlines = 0;
  const size = () => (r.status & FLAG_MEMORY_8BIT ? 1 : 2);
  const mask = () => (size() === 1 ? BYTE_MASK : WORD_MASK);
  const value = () => r.a & mask();
  const load = (n) => {
    const m = mask();
    r.a = (r.a & ~m) | (n & m);
    r.status = textNZ(r.status, r.a & m, size());
    return r.a & m;
  };
  const loadX = (n) => {
    r.x = n & WORD_MASK;
    r.status = textNZ(r.status, r.x);
  };
  const loadY = (n) => {
    r.y = n & WORD_MASK;
    r.status = textNZ(r.status, r.y);
  };
  const swap = () => {
    r.a = (r.a >>> BYTE_BITS) | ((r.a & BYTE_MASK) << BYTE_BITS);
    r.status = textNZ(r.status, r.a & BYTE_MASK, 1);
  };
  const cmp = (left, right, bytes = size()) => {
    const m = bytes === 1 ? BYTE_MASK : WORD_MASK;
    r.status = textNZ((r.status & ~1) | (left >= right ? 1 : 0), (left - right) & m, bytes);
  };
  const arithmetic = (right, subtract = false) => {
    const left = value(),
      carry = r.status & 1,
      m = mask(),
      sign = size() === 1 ? BYTE_SIGN : WORD_SIGN;
    const sum = subtract ? left - right - (1 - carry) : left + right + carry,
      next = sum & m;
    r.status =
      (r.status & ~STATUS_CV) |
      ((subtract ? sum >= 0 : sum > m) ? 1 : 0) |
      ((subtract ? left ^ right : ~(left ^ right)) & (left ^ next) & sign ? FLAG_OVERFLOW : 0);
    load(next);
  };
  const left = () => {
    const n = value();
    r.status = (r.status & ~1) | (n >>> (size() === 1 ? BYTE_TOP_BIT_SHIFT : WORD_TOP_BIT_SHIFT));
    load(n << 1);
  };
  const right = () => {
    const n = value();
    r.status = (r.status & ~1) | (n & 1);
    load(n >>> 1);
  };
  const shiftedRight = (count) => {
    if (!count) return;
    // The source's repeated LSR/DEY has no data access. Retain the final
    // Carry and DEY N/Z even for all 65535 full WORD counts.
    const n = r.a;
    r.status = (r.status & ~1) | (count <= WORD_BITS ? (n >>> (count - 1)) & 1 : 0);
    load(count < WORD_BITS ? n >>> count : 0);
    loadY(0);
  };
  const change = (address, delta, bytes = size()) => {
    const next = (io.read(address, bytes) + delta) & (bytes === 1 ? BYTE_MASK : WORD_MASK);
    io.write(address, next, bytes);
    r.status = textNZ(r.status, next, bytes);
    return next;
  };
  const styleBits = (set) => {
    load(GLYPH_BOLD_STYLE);
    const old = io.read(TEXT_COMPOSE_STYLE, 1);
    r.status = (r.status & ~2) | ((old & GLYPH_BOLD_STYLE) === 0 ? 2 : 0);
    io.write(TEXT_COMPOSE_STYLE, set ? old | GLYPH_BOLD_STYLE : old & ~GLYPH_BOLD_STYLE, 1);
  };
  const emit = (address, n, bytes = size()) => {
    output(budget, bytes);
    io.write(address, n, bytes);
  };
  const call = (run, kind = null) => {
    const result = run(
      view,
      {
        ...context,
        ...r,
        ioRead4214: context.ioRead4214?.slice(counts.quotientReads) ?? null,
        ioRead4216: context.ioRead4216?.slice(counts.resultReads) ?? null,
        waitRead01FA: context.waitRead01FA?.slice(counts.pollsFA) ?? null,
        waitRead01FC: context.waitRead01FC?.slice(counts.pollsFC) ?? null,
      },
      budget,
    );
    append(operations, result);
    Object.assign(r, { a: result.a, x: result.x, y: result.y, status: result.status });
    counts.quotientReads += result.quotientReads ?? 0;
    counts.resultReads += result.resultReads ?? 0;
    if (kind === 'FA') counts.pollsFA += result.polls;
    if (kind === 'FC') counts.pollsFC += result.polls;
    if (run === renderAEC8) output(budget, result.visits * 2);
  };
  const cursorRequest = () => {
    load(io.read(WRAM_BASE + WINDOW_CURSOR_TILE + r.x));
    left();
    left();
    left();
    r.status &= ~1;
    arithmetic(TEXT_TILE_VRAM_START);
    io.write(absolute(TEXT_BUFFER_VRAM_ADDRESS), r.a);
  };
  const maskRows = (initial) => {
    load(io.read(WRAM_BASE + WINDOW_CURSOR_PIXEL + r.x));
    io.write(TEXT_PIXEL_OFFSET, r.a);
    loadY(r.a);
    const saved = r.status;
    load(WORD_MASK);
    r.status = saved;
    if (r.y) {
      shiftedRight(r.y);
      io.write(TEXT_WORK_WORD, r.a);
      swap();
      load(r.a & io.read(TEXT_WORK_WORD));
    }
    load(r.a ^ WORD_MASK);
    if (initial) io.write(TEXT_INITIAL_MASK, r.a);
    loadX(TEXT_MASK_LAST_WORD);
    do {
      if (initial) load(io.read(absolute(TEXT_MASK_BUFFER, r.x)) & io.read(TEXT_INITIAL_MASK));
      emit(absolute(TEXT_MASK_BUFFER, r.x), r.a);
      loadX(r.x - 2);
    } while (!(r.status & FLAG_NEGATIVE));
  };
  const measure = () => {
    io.write(TEXT_WORK_WORD, 0);
    io.write(TEXT_WORD_STATE, 0);
    load(0);
    r.status |= FLAG_MEMORY_8BIT;
    loadY(io.read(TEXT_CHARACTER_INDEX));
    for (;;) {
      load(io.read(absolute(TEXT_BUFFER, r.y), 1));
      if (!value()) break;
      cmp(value(), CHARACTER_SPACE);
      if (r.status & 2) break;
      cmp(value(), CHARACTER_STYLE_TOGGLE);
      if (r.status & 2) {
        styleBits(true);
        load(CHARACTER_STYLE_PLACEHOLDER);
        emit(absolute(TEXT_BUFFER, r.y), value(), 1);
        continue;
      }
      loadY(r.y + 1);
      loadX(r.a);
      load(io.read(TEXT_COMPOSE_STYLE, 1));
      load(value() & GLYPH_BOLD_STYLE);
      if (value()) change(TEXT_WORK_WORD, 1);
      r.status &= ~1;
      load(io.read(0x81ac0c + r.x, 1));
      arithmetic(io.read(TEXT_WORK_WORD, 1));
      io.write(TEXT_WORK_WORD, value(), 1);
    }
    r.status &= ~FLAG_MEMORY_8BIT;
    load(io.read(TEXT_WORK_WORD));
    if (!r.a) load(EMPTY_WORD_WIDTH);
    cmp(r.a, io.read(TEXT_LINE_PIXELS));
  };
  const line = () => {
    newlines++;
    load(io.read(TEXT_PENDING_BYTES));
    load(r.a | io.read(TEXT_PIXEL_OFFSET));
    if (r.a) {
      call(renderAEC8);
      io.write(TEXT_PENDING_BYTES, 0);
      loadX(io.read(0));
      call(renderAEF4, 'FA');
    }
    // No unconditional index reload here: FBE3 receives the original X.
    call(renderAE4D);
    call(renderADBA);
    cursorRequest();
    call(renderAE14);
    io.write(TEXT_LINE_PIXELS, r.a);
    maskRows(false);
    loadX(io.read(TEXT_CHARACTER_INDEX));
    load(io.read(absolute(TEXT_BUFFER, r.x)));
    load(r.a & BYTE_MASK);
    cmp(r.a, CHARACTER_SPACE);
    if (r.status & 2) {
      loadX(r.x + 1);
      io.write(TEXT_CHARACTER_INDEX, r.x);
      return true;
    }
    return false;
  };
  const glyph = () => {
    r.status &= ~FLAG_MEMORY_8BIT;
    load(r.a & BYTE_MASK);
    loadX(r.a);
    load(io.read(0x81ac0c + r.x));
    load(r.a & BYTE_MASK);
    io.write(TEXT_WORK_WORD, r.a);
    load(io.read(TEXT_COMPOSE_STYLE));
    load(r.a & GLYPH_EXTRA_STYLE);
    if (r.a) change(TEXT_WORK_WORD, 1);
    load(r.x);
    left();
    left();
    left();
    loadX(r.a);
    r.status |= FLAG_MEMORY_8BIT;
    load(GLYPH_LAST_ROW);
    io.write(TEXT_GLYPH_ROW, value(), 1);
    do {
      load(io.read(TEXT_COMPOSE_STYLE, 1));
      loadY(r.a);
      load(value() & GLYPH_BOLD_STYLE);
      if (value()) {
        load(io.read(0x95f2d0 + r.x, 1));
        left();
      }
      load(value() | io.read(0x95f2d0 + r.x, 1));
      io.write(TEXT_GLYPH_BITS, value(), 1);
      load(r.y);
      load(value() & GLYPH_ROW_SHIFT_STYLES);
      cmp(value(), GLYPH_ROW_SHIFT_STYLES);
      let shift = false;
      if (r.status & 2) {
        load(io.read(TEXT_GLYPH_ROW, 1));
        right();
        shift = !(r.status & 1);
      } else {
        load(r.y);
        load(value() & GLYPH_SHIFT_LOW_ROW_INDICES);
        if (value()) {
          load(io.read(TEXT_GLYPH_ROW, 1));
          cmp(value(), GLYPH_ROW_SHIFT_BOUNDARY);
          shift = !(r.status & 1);
        } else {
          load(r.y);
          load(value() & GLYPH_SHIFT_HIGH_ROW_INDICES);
          if (value()) {
            load(io.read(TEXT_GLYPH_ROW, 1));
            cmp(value(), GLYPH_ROW_SHIFT_BOUNDARY);
            shift = Boolean(r.status & 1);
          }
        }
      }
      if (shift) {
        const old = io.read(TEXT_GLYPH_BITS, 1),
          next = (old << 1) & BYTE_MASK;
        io.write(TEXT_GLYPH_BITS, next, 1);
        r.status = textNZ((r.status & ~1) | (old >>> BYTE_TOP_BIT_SHIFT), next, 1);
      }
      load(r.y);
      load(value() & GLYPH_UNDERLINE_STYLE);
      if (value()) {
        load(io.read(TEXT_GLYPH_ROW, 1));
        if (!value()) {
          cmp(r.x, GLYPH_UNDERLINE_SKIP_INDEX, 2);
          if (!(r.status & 2)) {
            load(BYTE_MASK);
            io.write(TEXT_GLYPH_BITS, value(), 1);
          }
        }
      }
      io.write(TEXT_GLYPH_HIGH, 0, 1);
      r.status &= ~FLAG_MEMORY_8BIT;
      load(io.read(TEXT_GLYPH_BITS));
      swap();
      loadY(io.read(TEXT_WORK_WORD));
      cmp(r.y, GLYPH_ROW_PIXELS, 2);
      if (r.y !== GLYPH_ROW_PIXELS) {
        const shifts = (GLYPH_ROW_PIXELS - r.y) & WORD_MASK;
        load(shifts < WORD_BITS ? r.a << shifts : 0);
        loadY(GLYPH_ROW_PIXELS);
        cmp(r.y, GLYPH_ROW_PIXELS, 2);
      }
      const glyphX = r.x,
        glyphA = r.a;
      load(io.read(TEXT_WORK_WORD));
      left();
      loadX(r.a);
      load(glyphA);
      load(r.a ^ io.read(0x81ac9d + r.x));
      loadX(glyphX);
      loadY(io.read(TEXT_PIXEL_OFFSET));
      shiftedRight(r.y);
      r.status |= FLAG_MEMORY_8BIT;
      loadY(io.read(TEXT_PENDING_BYTES));
      emit(absolute(TEXT_MASK_BUFFER + TEXT_MASK_BYTES, r.y), value(), 1);
      swap();
      load(value() | io.read(absolute(TEXT_MASK_BUFFER, r.y), 1));
      emit(absolute(TEXT_MASK_BUFFER, r.y), value(), 1);
      loadY(r.y + 1);
      load(BYTE_MASK);
      emit(absolute(TEXT_MASK_BUFFER, r.y), value(), 1);
      emit(absolute(TEXT_MASK_BUFFER + TEXT_MASK_BYTES, r.y), value(), 1);
      loadY(r.y + 1);
      io.write(TEXT_PENDING_BYTES, r.y);
      loadX(r.x + 1);
      change(TEXT_GLYPH_ROW, -1);
      rows++;
    } while (!(r.status & FLAG_NEGATIVE));
    r.status &= ~FLAG_MEMORY_8BIT;
    r.status |= 1;
    load(io.read(TEXT_LINE_PIXELS));
    arithmetic(io.read(TEXT_WORK_WORD), true);
    io.write(TEXT_LINE_PIXELS, r.a);
    r.status &= ~1;
    load(io.read(TEXT_PIXEL_OFFSET));
    arithmetic(io.read(TEXT_WORK_WORD));
    cmp(r.a, GLYPH_ROW_PIXELS);
    load(r.a & GLYPH_PIXEL_MASK);
    io.write(TEXT_PIXEL_OFFSET, r.a);
    if (!(r.status & 1)) {
      load(io.read(TEXT_PENDING_BYTES));
      arithmetic(TEXT_MASK_ADVANCE_SUBTRAHEND, true);
      io.write(TEXT_PENDING_BYTES, r.a);
    }
    r.status |= FLAG_MEMORY_8BIT;
    glyphs++;
  };
  loadX(io.read(0));
  call(renderADBA);
  call(renderAE14);
  io.write(TEXT_LINE_PIXELS, r.a);
  load(io.read(WRAM_BASE + WINDOW_STYLE + r.x));
  io.write(TEXT_COMPOSE_STYLE, r.a);
  io.write(TEXT_PENDING_BYTES, 0);
  cursorRequest();
  call(renderAEFC, 'FC');
  maskRows(true);
  io.write(TEXT_CHARACTER_INDEX, 0);
  let needsMeasure = true;
  for (;;) {
    if (needsMeasure) {
      measure();
      if (r.status & 1 && line()) continue;
    }
    r.status |= FLAG_MEMORY_8BIT;
    load(io.read(TEXT_COMPOSE_STYLE, 1));
    loadY(r.a);
    left();
    load(io.read(TEXT_WORD_STATE, 1));
    if (value() & FLAG_NEGATIVE) {
      styleBits(false);
      r.status &= ~FLAG_MEMORY_8BIT;
      needsMeasure = true;
      continue;
    }
    loadX(io.read(TEXT_CHARACTER_INDEX));
    load(io.read(absolute(TEXT_BUFFER, r.x), 1));
    if (!value()) break;
    const saved = r.status;
    cmp(value(), CHARACTER_SPACE);
    if (r.status & 2) {
      load(io.read(TEXT_WORD_STATE, 1));
      if (value()) {
        r.status = saved;
        styleBits(false);
        r.status &= ~FLAG_MEMORY_8BIT;
        needsMeasure = true;
        continue;
      }
      change(TEXT_WORD_STATE, -1);
      load(CHARACTER_SPACE);
    } else change(TEXT_WORD_STATE, 1);
    loadX(r.x + 1);
    io.write(TEXT_CHARACTER_INDEX, r.x);
    r.status = saved;
    if (r.status & 1) {
      cmp(value(), CHARACTER_LOWERCASE_FIRST);
      if (r.status & 1) {
        cmp(value(), CHARACTER_LOWERCASE_END);
        if (!(r.status & 1)) load(value() & CHARACTER_UPPERCASE_MASK);
      }
    }
    glyph();
    needsMeasure = false;
  }
  r.status &= ~FLAG_MEMORY_8BIT;
  load(io.read(TEXT_PENDING_BYTES));
  load(r.a | io.read(TEXT_PIXEL_OFFSET));
  if (r.a) {
    call(renderAEC8);
    load(io.read(TEXT_PENDING_BYTES));
    right();
    right();
    right();
    right();
    loadX(io.read(0));
    arithmetic(io.read(WRAM_BASE + WINDOW_CURSOR_TILE + r.x));
    io.write(WRAM_BASE + WINDOW_CURSOR_TILE + r.x, r.a);
    load(io.read(TEXT_PIXEL_OFFSET));
    io.write(WRAM_BASE + WINDOW_CURSOR_PIXEL + r.x, r.a);
    call(renderAEF4, 'FA');
  }
  return textHelperResult(r, budget, operations, {
    outcome: 'text_composed',
    glyphs,
    rows,
    newlines,
    outputBytes: budget.outputBytes ?? 0,
    ...counts,
  });
}
