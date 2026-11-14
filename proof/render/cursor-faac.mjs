import { WRAM_BASE, CODE_BANK_BASE } from '../../src/constants/memory-map.mjs';
import { WRMPYA, WRMPYB, RDMPYL } from '../../src/constants/hardware-registers.mjs';
import {
  WINDOW_COLUMNS,
  WINDOW_TILE_START,
  WINDOW_CURSOR_TILE,
  WINDOW_CURSOR_PIXEL,
} from '../../src/task/wram.mjs';
import { BYTE_MASK, WORD_MASK } from '../../src/constants/bits.mjs';
const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const CURSOR_STACK_BYTES = 5;
const ROW_ARGUMENT = 4;

import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import {
  textHelperAccess,
  textHelperResult,
  textNZ,
  textArithmeticFlags,
} from './text-helper-access.mjs';

export function prepareRenderFAAC({
  data,
  bank = null,
  status = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  ioMode = null,
  ioRead4216 = null,
} = {}) {
  if (
    (y !== null && !isWord(y)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (ioRead4216 !== null && (!Array.isArray(ioRead4216) || !Array.from(ioRead4216).every(isWord)))
  )
    throw Error('Invalid render FAAC context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    CURSOR_STACK_BYTES,
  );
  if (entry) return entry;
  if (y === null) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => WRAM_BASE + v),
  );
  try {
    return view.finish(
      renderFAAC(
        view,
        { bank, status, y, ioMode, ioRead4216 },
        { work: 0, maxWork, maxOutputBytes, outputBytes: 0 },
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Fixed original cursor calculation, one shared overlay. Local DBR80 makes
// 4202/4203/4216 actual MMIO even when the incoming DBR is physical WRAM.
// The second ADC inherits the first carry; hardware multiplication is external.
export function renderFAAC(view, context, budget) {
  const operations = [],
    byteOperations = [];
  const shared = {
    read(address) {
      const value = view.read(address);
      byteOperations.push(Object.freeze({ kind: 'read', address, value, bytes: 1 }));
      return value;
    },
    write(address, value) {
      view.write(address, value);
      byteOperations.push(Object.freeze({ kind: 'write', address, value, bytes: 1 }));
    },
  };
  const io = textHelperAccess(shared, budget, operations, 'cursorFAAC');
  const counts = context.observations ?? { resultReads: 0 };
  const x = io.read(0),
    row = io.read(ROW_ARGUMENT, 1);
  io.request('write', CODE_BANK_BASE + WRMPYA, row, 1, context.ioMode);
  const width = io.read(WRAM_BASE + WINDOW_COLUMNS + x, 1),
    multiplier = (width - 2) & BYTE_MASK;
  io.request('write', CODE_BANK_BASE + WRMPYB, multiplier, 1, context.ioMode);
  const position = io.read(WRAM_BASE + WINDOW_TILE_START + x),
    delta = io.read(2);
  const firstSum = position + delta,
    intermediate = firstSum & WORD_MASK;
  let status = textArithmeticFlags(
    context.status,
    position,
    delta,
    intermediate,
    firstSum > WORD_MASK,
  );
  const result = io.request(
    'read',
    CODE_BANK_BASE + RDMPYL,
    context.ioRead4216?.[counts.resultReads],
    2,
    context.ioMode,
  );
  counts.resultReads++;
  const sum = intermediate + result + (status & 1),
    cursor = sum & WORD_MASK;
  status = textArithmeticFlags(status, intermediate, result, cursor, sum > WORD_MASK);
  io.write(WRAM_BASE + WINDOW_CURSOR_TILE + x, cursor);
  io.write(WRAM_BASE + WINDOW_CURSOR_PIXEL + x, 0);
  // LDA0 affects NZ, then original PLB replaces NZ with the entry-bank byte.
  status = textNZ(status, context.bank, 1);
  return textHelperResult(
    { a: 0, x, y: context.y, bank: context.bank, status },
    budget,
    operations,
    {
      outcome: 'cursor_prepared',
      row,
      width,
      multiplier,
      position,
      delta,
      intermediate,
      result,
      cursor,
      resultReads: counts.resultReads,
      outputBytes: budget.outputBytes ?? 0,
      byteAccesses: byteOperations.length,
      byteOperations: Object.freeze(byteOperations),
    },
  );
}
