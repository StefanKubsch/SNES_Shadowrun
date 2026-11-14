import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { BYTE_MASK, WORD_MASK, WORD_SIGN } from '../../src/constants/bits.mjs';
import { WRAM_BASE, CODE_BANK_BASE } from '../../src/constants/memory-map.mjs';
import {
  RDMPYL,
  RDDIVL,
  WRDIVL,
  WRDIVB,
  WRMPYA,
  WRMPYB,
} from '../../src/constants/hardware-registers.mjs';
import {
  WINDOW_CURSOR_TILE,
  WINDOW_TILE_START,
  WINDOW_CURSOR_PIXEL,
  WINDOW_COLUMNS,
  WINDOW_LEFT_PIXEL,
  WINDOW_ROWS,
  WINDOW_TILE_INITIAL,
} from '../../src/task/wram.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO, FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';

const DEFAULT_MAX_WORK = 1000000;
const GEOMETRY_STACK_BYTES = 6;
const NEWLINE_STACK_BYTES = 7;
const TEXT_TILE_PIXEL_SHIFT = 3;
const TEXT_TILE_CARRY_SHIFT = 13;
const DP_LINE_WIDTH = 0xbd;
const DP_LINE_POSITION = 0xc0;
const TEXT_PIXEL_MASK = 7;
const TEXT_TILE_PIXELS = 8;
const NEWLINE_RESERVED_ROWS = 4;
const STATUS_NZC = FLAG_NEGATIVE | FLAG_ZERO | FLAG_CARRY;

import {
  textHelperAccess,
  textHelperResult,
  textArithmeticFlags,
  textNZ,
} from './text-helper-access.mjs';

function prepare(
  run,
  stackBytes,
  {
    data,
    bank = null,
    status = null,
    x = null,
    y = null,
    emulation = null,
    directPage = null,
    stackWindow = null,
    maxWork = DEFAULT_MAX_WORK,
    ioMode = null,
    ioRead4214 = null,
    ioRead4216 = null,
  } = {},
) {
  if (
    [x, y].some((v) => v !== null && !isWord(v)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (ioRead4216 !== null &&
      (!Array.isArray(ioRead4216) || !Array.from(ioRead4216).every(isWord))) ||
    (ioRead4214 !== null &&
      (!Array.isArray(ioRead4214) ||
        !Array.from(ioRead4214).every((v) => Number.isInteger(v) && v >= 0 && v <= BYTE_MASK)))
  )
    throw Error('Invalid render text geometry context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    stackBytes,
  );
  if (entry) return entry;
  if (x === null) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => WRAM_BASE + v),
  );
  try {
    return view.finish(
      run(view, { bank, status, x, y, ioMode, ioRead4214, ioRead4216 }, { work: 0, maxWork }),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

export const prepareRenderADBA = (context) => prepare(renderADBA, GEOMETRY_STACK_BYTES, context);
export const prepareRenderAE14 = (context) => prepare(renderAE14, GEOMETRY_STACK_BYTES, context);
export const prepareRenderAE4D = (context) => prepare(renderAE4D, NEWLINE_STACK_BYTES, context);

function geometry(
  view,
  { bank, status, x, y = null, ioMode = null, ioRead4214 = null, ioRead4216 = null },
  budget,
  kind,
) {
  const operations = [],
    io = textHelperAccess(view, budget, operations, kind);
  let a,
    quotientReads = 0,
    resultReads = 0,
    adjusted = false,
    newlineReset = false;
  const load = (value) => {
    a = value;
    status = textNZ(status, a);
    return a;
  };
  const add = (left, right, carry) => {
    const sum = left + right + carry,
      value = sum & WORD_MASK;
    status = textArithmeticFlags(status, left, right, value, sum > WORD_MASK);
    return load(value);
  };
  const subtract = (left, right) => {
    const value = (left - right) & WORD_MASK;
    status = textArithmeticFlags(status, left, right, value, left >= right, true);
    return load(value);
  };
  // All three helpers select DBR 80 locally. Even entry DBR 7E/7F uses actual
  // MMIO requests here; restored DBR only owns final PLB BYTE N/Z.
  const storeRegister = (offset, value, bytes) =>
    io.request('write', CODE_BANK_BASE + offset, value, bytes, ioMode);
  const result = () =>
    io.request('read', CODE_BANK_BASE + RDMPYL, ioRead4216?.[resultReads++], 2, ioMode);
  const quotient = () =>
    io.request('read', CODE_BANK_BASE + RDDIVL, ioRead4214?.[quotientReads++], 1, ioMode);
  const cursor = WRAM_BASE + WINDOW_CURSOR_TILE + x,
    base = WRAM_BASE + WINDOW_TILE_START + x,
    offset = WRAM_BASE + WINDOW_CURSOR_PIXEL + x;
  try {
    subtract(io.read(cursor), io.read(base));
    storeRegister(WRDIVL, a, 2);
    if (kind === 'AE14') {
      load((io.read(WRAM_BASE + WINDOW_COLUMNS + x) - 2) & WORD_MASK);
      storeRegister(WRDIVB, a & BYTE_MASK, 1);
      load((a << TEXT_TILE_PIXEL_SHIFT) & WORD_MASK);
      io.write(DP_LINE_WIDTH, a);
      const remainder = result();
      add(
        (remainder << TEXT_TILE_PIXEL_SHIFT) & WORD_MASK,
        io.read(offset),
        (remainder >>> TEXT_TILE_CARRY_SHIFT) & 1,
      );
      io.write(DP_LINE_POSITION, a);
      subtract(io.read(DP_LINE_WIDTH), io.read(DP_LINE_POSITION));
    } else if (kind === 'ADBA') {
      storeRegister(WRDIVB, (io.read(WRAM_BASE + WINDOW_COLUMNS + x, 1) - 2) & BYTE_MASK, 1);
      const remainder = result();
      add(
        (remainder << TEXT_TILE_PIXEL_SHIFT) & WORD_MASK,
        io.read(offset),
        (remainder >>> TEXT_TILE_CARRY_SHIFT) & 1,
      );
      subtract(a, io.read(WRAM_BASE + WINDOW_LEFT_PIXEL + x));
      if (!(status & 1)) {
        adjusted = true;
        const magnitude = -a & WORD_MASK;
        add(magnitude & TEXT_PIXEL_MASK, io.read(offset), 0);
        const carry = a >= TEXT_TILE_PIXELS ? 1 : 0;
        load(a & TEXT_PIXEL_MASK);
        io.write(offset, a);
        // PHP/PLP preserves CMP carry across the three shifts of magnitude.
        add(magnitude >>> TEXT_TILE_PIXEL_SHIFT, io.read(cursor), carry);
        io.write(cursor, a);
      }
    } else {
      storeRegister(WRDIVB, (io.read(WRAM_BASE + WINDOW_COLUMNS + x, 1) - 2) & BYTE_MASK, 1);
      const height = io.read(WRAM_BASE + WINDOW_ROWS + x, 1),
        threshold = (height - NEWLINE_RESERVED_ROWS) & BYTE_MASK;
      const first = quotient();
      newlineReset = threshold < first;
      storeRegister(WRMPYA, newlineReset ? 0 : (quotient() + 1) & BYTE_MASK, 1);
      storeRegister(WRMPYB, (io.read(WRAM_BASE + WINDOW_COLUMNS + x, 1) - 2) & BYTE_MASK, 1);
      // LDA-base precedes the fresh MMIO read. No inferred division/product.
      const initial = io.read(base);
      add(initial, result(), 0);
      io.write(cursor, a);
      io.write(offset, 0);
      const limit = io.read(WRAM_BASE + WINDOW_TILE_INITIAL + x),
        difference = (a - limit) & WORD_MASK;
      status =
        (status & ~STATUS_NZC) |
        (a >= limit ? 1 : 0) |
        (difference === 0 ? 2 : 0) |
        (difference & WORD_SIGN ? FLAG_NEGATIVE : 0);
      // Equal invokes AE4C, whose entire source is RTL: no extra effects.
    }
    status = textNZ(status, bank, 1);
    return textHelperResult({ a, x, y, bank, status }, budget, operations, {
      outcome: 'text_geometry_prepared',
      helper: kind,
      adjusted,
      newlineReset,
      quotientReads,
      resultReads,
    });
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase: kind };
  }
}
export const renderADBA = (view, context, budget) => geometry(view, context, budget, 'ADBA');
export const renderAE14 = (view, context, budget) => geometry(view, context, budget, 'AE14');
export const renderAE4D = (view, context, budget) => geometry(view, context, budget, 'AE4D');
