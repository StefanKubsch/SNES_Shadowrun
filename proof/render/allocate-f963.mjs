import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderFA67 } from './request-fa67.mjs';
import { renderACCF } from './entry-accf.mjs';
import { renderACB5 } from './request-acb5.mjs';
import {
  WRAM_BASE,
  WRAM_BANK,
  WRAM_HIGH_BANK,
  BANK_WITHOUT_IO,
} from '../../src/constants/memory-map.mjs';
import {
  BANK_SIZE,
  LONG_MASK,
  BYTE_BITS,
  WORD_MASK,
  BYTE_MASK,
  WORD_SIGN,
} from '../../src/constants/bits.mjs';
import {
  WINDOW_LAST_INDEX,
  WINDOW_MAP_OFFSET,
  WINDOW_COLUMNS,
  WINDOW_WIDTH_PIXELS,
  WINDOW_ROWS,
  WINDOW_ATTRIBUTES,
  WINDOW_ACTIVE,
  WINDOW_NEXT_TILE,
  WINDOW_TILE_COUNT,
  WINDOW_TILE_START,
  WINDOW_TILE_INITIAL,
  WINDOW_CURSOR_TILE,
  WINDOW_CURSOR_PIXEL,
  WINDOW_LEFT_PIXEL,
  WINDOW_STYLE,
} from '../../src/task/wram.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO, FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';
import { M7A, M7B, MPYL } from '../../src/constants/hardware-registers.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const ALLOCATION_STACK_BYTES = 8;
const OVERFLOW_FLAG_SHIFT = 6;
const STATUS_NZC = FLAG_NEGATIVE | FLAG_ZERO | FLAG_CARRY;
const WIDTH_ARGUMENT = 4;
const HEIGHT_ARGUMENT = 6;
const ATTRIBUTES_ARGUMENT = 8;
const WINDOW_INDEX_END = 0x20;
const MAXIMUM_COLUMN = 0x1f;
const MAXIMUM_ROW = 0x1b;
const MAP_ROW_SHIFT = 5;
const MAP_ROW_CARRY_SHIFT = 11;
const TILE_PIXEL_SHIFT = 3;
const TILE_ALLOCATION_END = 0x2400;
const TILE_ALLOCATION_RESTART = 0x2027;
// These four array entries are cleared by the original allocation routine.
// No additional meaning is assigned to its otherwise unnamed offset 2160.
const ALLOCATION_CLEAR_OFFSETS = [WINDOW_CURSOR_PIXEL, WINDOW_LEFT_PIXEL, WINDOW_STYLE, 0x2160];

export function prepareRenderF963({
  data,
  bank = null,
  status = null,
  a = null,
  x = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  ioMode = null,
  ioRead2134 = null,
  waitMode = null,
  waitRead01F6 = null,
  waitRead01F8 = null,
} = {}) {
  if (
    [a, x, y].some((v) => v !== null && !isWord(v)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (waitMode !== null && waitMode !== 'record-observations') ||
    [ioRead2134, waitRead01F6, waitRead01F8].some(
      (v) => v !== null && (!Array.isArray(v) || !Array.from(v).every(isWord)),
    )
  )
    throw Error('Invalid render allocation context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    ALLOCATION_STACK_BYTES,
  );
  if (entry) return entry;
  if (a === null) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => WRAM_BASE + v),
  );
  try {
    return view.finish(
      renderF963(
        view,
        { bank, status, a, y, ioMode, ioRead2134, waitMode, waitRead01F6, waitRead01F8 },
        { work: 0, maxWork, maxOutputBytes },
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Source-derived data algorithm. All three callees share this overlay and
// budget; only the outer owner may finish or commit it. No MMIO calculation.
export function renderF963(
  view,
  {
    bank,
    status,
    a,
    y = null,
    ioMode = null,
    ioRead2134 = null,
    waitMode = null,
    waitRead01F6 = null,
    waitRead01F8 = null,
  },
  budget,
) {
  let phase = 'capacity',
    productReads = 0;
  const operations = [],
    ioRequests = [],
    base = bank * BANK_SIZE;
  const fail = (reason, address) => {
    throw { renderBoundary: true, reason, address };
  };
  const tick = () => {
    if (++budget.work > budget.maxWork) fail('render_work_budget_required');
  };
  const record = (kind, space, address, value, bytes) => {
    const event = Object.freeze({ kind, space, phase, address, value, bytes });
    operations.push(event);
    if (space === 'io') ioRequests.push(event);
    return value;
  };
  const read = (address, bytes = 2) => {
    tick();
    return record(
      'read',
      'data',
      address,
      view.read(address) | (bytes === 2 ? view.read((address + 1) & LONG_MASK) << BYTE_BITS : 0),
      bytes,
    );
  };
  const write = (address, value, bytes = 2) => {
    tick();
    value &= bytes === 2 ? WORD_MASK : BYTE_MASK;
    view.write(address, value & BYTE_MASK);
    if (bytes === 2) view.write((address + 1) & LONG_MASK, value >>> BYTE_BITS);
    record('write', 'data', address, value, bytes);
  };
  const register = (kind, offset, value, bytes) => {
    const address = base + offset;
    if (bank === WRAM_BANK || bank === WRAM_HIGH_BANK) {
      if (kind === 'read') {
        const result = read(address, bytes);
        productReads++;
        return result;
      }
      return write(address, value, bytes);
    }
    if (bank & BANK_WITHOUT_IO) fail('render_address_required', address);
    tick();
    if (ioMode !== 'record-requests') fail('render_io_context_required', address);
    if (kind === 'read') {
      if (ioRead2134 === null || productReads >= ioRead2134.length)
        fail('render_io_read_required', address);
      value = ioRead2134[productReads++];
    }
    return record(kind, 'io', address, value, bytes);
  };
  const append = (result) => {
    for (const event of result.operations) operations.push(event);
    return result;
  };
  try {
    const x = (read(base + WINDOW_LAST_INDEX) + 2) & WORD_MASK;
    const difference = (x - WINDOW_INDEX_END) & WORD_MASK;
    status =
      (status & ~STATUS_NZC) |
      (x >= WINDOW_INDEX_END ? 1 : 0) |
      (difference === 0 ? 2 : 0) |
      (difference & WORD_SIGN ? FLAG_NEGATIVE : 0);
    if (x >= WINDOW_INDEX_END)
      return {
        handled: true,
        outcome: 'capacity_end',
        a,
        x,
        y,
        bank,
        status,
        carry: status & 1,
        overflow: (status >>> OVERFLOW_FLAG_SHIFT) & 1,
        work: budget.work,
        outputBytes: 0,
        operations: Object.freeze(operations),
        ioRequests: Object.freeze([]),
        ioWrites: Object.freeze([]),
      };
    phase = 'geometry';
    write(base + WINDOW_LAST_INDEX, x);
    // DEC/BPL tests the wrapping decremented WORD, not signed position.
    const clamp = (position, extent, maximum) => {
      const old = read(position);
      if ((old - 1) & WORD_MASK & WORD_SIGN) write(position, 1);
      else {
        const limit = (maximum - read(extent)) & WORD_MASK;
        if (limit < read(position)) write(position, limit);
      }
    };
    clamp(0, WIDTH_ARGUMENT, MAXIMUM_COLUMN);
    clamp(2, HEIGHT_ARGUMENT, MAXIMUM_ROW);
    const row = read(2),
      left = (row << MAP_ROW_SHIFT) & WORD_MASK;
    a = ((left + read(0) + ((row >>> MAP_ROW_CARRY_SHIFT) & 1)) << 1) & WORD_MASK;
    write(WRAM_BASE + WINDOW_MAP_OFFSET + x, a);
    a = read(WIDTH_ARGUMENT);
    write(WRAM_BASE + WINDOW_COLUMNS + x, a);
    write(WRAM_BASE + WINDOW_WIDTH_PIXELS + x, ((a - 2) << TILE_PIXEL_SHIFT) & WORD_MASK);
    write(WRAM_BASE + WINDOW_ROWS + x, read(HEIGHT_ARGUMENT));
    write(WRAM_BASE + WINDOW_ATTRIBUTES + x, read(ATTRIBUTES_ARGUMENT));
    for (const offset of ALLOCATION_CLEAR_OFFSETS) write(WRAM_BASE + offset + x, 0);
    write(base + WINDOW_ACTIVE + x, read(base + WINDOW_ACTIVE + x) - 1);
    phase = 'multiply';
    register('write', M7A, (read(WIDTH_ARGUMENT, 1) - 2) & BYTE_MASK, 1);
    register('write', M7A, 0, 1);
    register('write', M7B, (read(HEIGHT_ARGUMENT, 1) - 2) & BYTE_MASK, 1);
    a = read(base + WINDOW_NEXT_TILE);
    write(0, a);
    a = register('read', MPYL, null, 2);
    write(WRAM_BASE + WINDOW_TILE_COUNT + x, a);
    a = (a + read(base + WINDOW_NEXT_TILE)) & WORD_MASK;
    write(base + WINDOW_NEXT_TILE, a);
    const wrapped = a >= TILE_ALLOCATION_END;
    if (wrapped) {
      write(0, TILE_ALLOCATION_RESTART);
      a = (TILE_ALLOCATION_RESTART + register('read', MPYL, null, 2)) & WORD_MASK;
      write(base + WINDOW_NEXT_TILE, a);
    }
    a = read(0);
    for (const offset of [WINDOW_TILE_START, WINDOW_TILE_INITIAL, WINDOW_CURSOR_TILE])
      write(WRAM_BASE + offset + x, a);
    a = read(base + WINDOW_LAST_INDEX);
    write(0, a);
    phase = 'FA67';
    const request = append(renderFA67(view, { bank, status, y, waitMode, waitRead01F6 }, budget));
    phase = 'ACCF';
    const entry = append(renderACCF(view, request, budget));
    phase = 'ACB5';
    const transfer = append(renderACB5(view, { ...entry, waitMode, waitRead01F8 }, budget));
    return {
      ...transfer,
      outcome: 'allocation_prepared',
      allocationIndex: x,
      wrapped,
      productReads,
      outputBytes: entry.outputBytes,
      requestPolls: request.polls,
      transferPolls: transfer.polls,
      operations: Object.freeze(operations),
      ioRequests: Object.freeze(ioRequests),
      ioWrites: Object.freeze(ioRequests.filter((event) => event.kind === 'write')),
    };
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { phase, ...error };
  }
}
