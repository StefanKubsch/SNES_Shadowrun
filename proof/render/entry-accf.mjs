import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderOutputBytes } from './output-budget.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import {
  LONG_MASK,
  BYTE_BITS,
  WORD_MASK,
  BYTE_MASK,
  WORD_SIGN,
} from '../../src/constants/bits.mjs';
import {
  WINDOW_MAP_BUFFER,
  WINDOW_TILE_INITIAL,
  WINDOW_ATTRIBUTES,
  WINDOW_MAP_OFFSET,
  WINDOW_COLUMNS,
  WINDOW_ROWS,
  WINDOW_TILE_START,
  WINDOW_TILE_COUNT,
} from '../../src/task/wram.mjs';
import {
  FLAG_OVERFLOW,
  FLAG_NEGATIVE,
  FLAG_CARRY,
  FLAG_ZERO,
} from '../../src/constants/cpu-flags.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const ENTRY_STACK_BYTES = 6;
const STATUS_CV = FLAG_CARRY | FLAG_OVERFLOW;
const STATUS_NZ = FLAG_NEGATIVE | FLAG_ZERO;
const OVERFLOW_FLAG_SHIFT = 6;
// ACCF reuses these direct-page words; every read retains its original alias.
const MAP_ROW_OFFSET = 0xc3;
const INTERIOR_COLUMNS = 0xc6;
const TILE_ATTRIBUTES = 0xc9;
const REMAINING_COLUMNS = 0xcc;
const SAVED_WINDOW_INDEX = 0xcf;
const NEXT_TILE = 0xd2;
const MAP_ROW_BYTES = 0x40;
// Border tile words from the original routine, before caller attributes.
const TOP_LEFT_TILE = 0x2001;
const TOP_EDGE_TILE = 0x2002;
const TOP_RIGHT_TILE = 0x6001;
const LEFT_EDGE_TILE = 0x2003;
const RIGHT_EDGE_TILE = 0x6003;
const BOTTOM_LEFT_TILE = 0xa001;
const BOTTOM_EDGE_TILE = 0xa002;
const BOTTOM_RIGHT_TILE = 0xe001;

export function prepareRenderACCF({
  data,
  bank = null,
  status = null,
  x = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
} = {}) {
  if ((x !== null && !isWord(x)) || (y !== null && !isWord(y)))
    throw Error('Invalid render entry context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    ENTRY_STACK_BYTES,
  );
  if (entry) return entry;
  if (x === null) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  try {
    return view.finish(renderACCF(view, { bank, status, x }, { work: 0, maxWork, maxOutputBytes }));
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Manual data producer. The caller owns the shared byte overlay and commit.
export function renderACCF(view, { bank, status, x }, budget) {
  let phase = 'setup',
    a = 0,
    y = 0,
    flags = status,
    outputBytes = 0;
  let topVisits = 0,
    rows = 0,
    cells = 0,
    bottomVisits = 0,
    resets = 0;
  const operations = [];
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const record = (kind, address, value) => {
    operations.push(Object.freeze({ kind, space: 'data', phase, address, value, bytes: 2 }));
    return value;
  };
  const read = (address) => {
    tick();
    return record(
      'read',
      address,
      view.read(address) | (view.read((address + 1) & LONG_MASK) << BYTE_BITS),
    );
  };
  const write = (address, value) => {
    tick();
    value &= WORD_MASK;
    view.write(address, value & BYTE_MASK);
    view.write((address + 1) & LONG_MASK, value >>> BYTE_BITS);
    record('write', address, value);
  };
  const emit = () => {
    outputBytes += 2;
    if (outputBytes > budget.maxOutputBytes)
      throw { renderBoundary: true, reason: 'render_output_budget_required' };
    renderOutputBytes(budget, 2);
    // Native absolute-indexed addressing carries into the next data bank;
    // Y itself remains a wrapping WORD. WDC datasheet sections3.5 and7.3.
    write(WRAM_BASE + WINDOW_MAP_BUFFER + y, a);
  };
  const advance = () => {
    y = (y + 2) & WORD_MASK;
  };
  const rowBase = () => {
    const left = read(MAP_ROW_OFFSET),
      sum = left + MAP_ROW_BYTES;
    a = sum & WORD_MASK;
    flags =
      (flags & ~STATUS_CV) |
      (sum > WORD_MASK ? 1 : 0) |
      (~(left ^ MAP_ROW_BYTES) & (left ^ a) & WORD_SIGN ? FLAG_OVERFLOW : 0);
    write(MAP_ROW_OFFSET, a);
    y = a;
  };
  const cap = (value) => {
    a = value | read(TILE_ATTRIBUTES);
    emit();
  };
  try {
    write(SAVED_WINDOW_INDEX, x);
    a = read(WRAM_BASE + WINDOW_TILE_INITIAL + x);
    write(NEXT_TILE, a);
    a = read(WRAM_BASE + WINDOW_ATTRIBUTES + x);
    write(TILE_ATTRIBUTES, a);
    a = read(WRAM_BASE + WINDOW_MAP_OFFSET + x);
    write(MAP_ROW_OFFSET, a);
    y = a;
    phase = 'top';
    cap(TOP_LEFT_TILE);
    advance();
    a = (read(WRAM_BASE + WINDOW_COLUMNS + x) - 2) & WORD_MASK;
    write(INTERIOR_COLUMNS, a);
    x = a;
    do {
      cap(TOP_EDGE_TILE);
      topVisits++;
      advance();
      x = (x - 1) & WORD_MASK;
    } while (x !== 0);
    cap(TOP_RIGHT_TILE);
    x = read(SAVED_WINDOW_INDEX);
    a = (read(WRAM_BASE + WINDOW_ROWS + x) - 2) & WORD_MASK;
    x = a;
    do {
      phase = 'middle';
      rows++;
      rowBase();
      cap(LEFT_EDGE_TILE);
      advance();
      a = read(INTERIOR_COLUMNS);
      write(REMAINING_COLUMNS, a);
      a = read(NEXT_TILE) | read(TILE_ATTRIBUTES);
      let remaining;
      do {
        emit();
        cells++;
        a = (a + 1) & WORD_MASK;
        write(NEXT_TILE, read(NEXT_TILE) + 1);
        advance();
        remaining = (read(REMAINING_COLUMNS) - 1) & WORD_MASK;
        write(REMAINING_COLUMNS, remaining);
      } while (remaining !== 0);
      cap(RIGHT_EDGE_TILE);
      phase = 'wrap';
      const savedRows = x;
      x = read(SAVED_WINDOW_INDEX);
      a = (read(NEXT_TILE) - read(WRAM_BASE + WINDOW_TILE_START + x)) & WORD_MASK;
      if (a >= read(WRAM_BASE + WINDOW_TILE_COUNT + x)) {
        a = read(WRAM_BASE + WINDOW_TILE_START + x);
        write(NEXT_TILE, a);
        resets++;
      }
      x = (savedRows - 1) & WORD_MASK;
    } while (x !== 0);
    phase = 'bottom';
    rowBase();
    cap(BOTTOM_LEFT_TILE);
    advance();
    x = read(INTERIOR_COLUMNS);
    do {
      cap(BOTTOM_EDGE_TILE);
      bottomVisits++;
      advance();
      x = (x - 1) & WORD_MASK;
    } while (x !== 0);
    cap(BOTTOM_RIGHT_TILE);
    x = read(SAVED_WINDOW_INDEX);
    // PLB determines final BYTE N/Z; final bottom ADC determines C/V.
    flags = (flags & ~STATUS_NZ) | (bank & FLAG_NEGATIVE) | (bank === 0 ? 2 : 0);
    return {
      handled: true,
      outcome: 'entry_prepared',
      a,
      x,
      y,
      bank,
      status: flags,
      carry: flags & 1,
      overflow: (flags >>> OVERFLOW_FLAG_SHIFT) & 1,
      outputBytes,
      topVisits,
      rows,
      cells,
      bottomVisits,
      resets,
      work: budget.work,
      operations: Object.freeze(operations),
      ioWrites: Object.freeze([]),
    };
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase };
  }
}
