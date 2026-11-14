import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { wordWaitAccess, renderWordWait } from './word-wait.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import {
  TEXT_TILE_UPLOAD,
  WINDOW_TILE_START,
  TEXT_TILE_UPLOAD_ADDRESS,
  WINDOW_TILE_COUNT,
  TEXT_TILE_UPLOAD_BYTES,
} from '../../src/task/wram.mjs';
import { BANK_SIZE, WORD_MASK, WORD_SIGN } from '../../src/constants/bits.mjs';
import { FLAG_OVERFLOW, FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';

const DEFAULT_MAX_WORK = 1000000;
const REQUEST_STACK_BYTES = 5;
const WAIT_STACK_BYTES = 3;
const STATUS_CV = FLAG_CARRY | FLAG_OVERFLOW;
// Original tile pointer and byte-count arithmetic, including shifted-out carries.
const TILE_POINTER_SHIFT = 3;
const TILE_POINTER_CARRY_SHIFT = 13;
const TILE_POINTER_ADDEND = 0x4fff;
const UPLOAD_SIZE_SHIFT = 4;
const UPLOAD_SIZE_CARRY_SHIFT = 12;

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
    waitMode = null,
    waitRead01F6 = null,
  } = {},
) {
  if (
    (x !== null && !isWord(x)) ||
    (y !== null && !isWord(y)) ||
    (waitMode !== null && waitMode !== 'record-observations') ||
    (waitRead01F6 !== null &&
      (!Array.isArray(waitRead01F6) || !Array.from(waitRead01F6).every(isWord)))
  )
    throw Error('Invalid render request wait context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    stackBytes,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  try {
    return view.finish(
      run(view, { bank, status, x, y, waitMode, waitRead01F6 }, { work: 0, maxWork }),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

export const prepareRenderFA67 = (context) => prepare(renderFA67, REQUEST_STACK_BYTES, context);
export const prepareRenderACBD = (context) => prepare(renderACBD, WAIT_STACK_BYTES, context);

export const renderACBD = (view, context, budget) =>
  renderWordWait(view, context, budget, TEXT_TILE_UPLOAD, context.waitRead01F6 ?? null);

export function renderFA67(
  view,
  { bank, status, y = null, waitMode = null, waitRead01F6 = null },
  budget,
) {
  const operations = [],
    io = wordWaitAccess(view, budget, operations, 'request'),
    base = bank * BANK_SIZE;
  try {
    const x = io.read(0),
      position = io.read(WRAM_BASE + WINDOW_TILE_START + x),
      left = (position << TILE_POINTER_SHIFT) & WORD_MASK;
    const sum = left + TILE_POINTER_ADDEND + ((position >>> TILE_POINTER_CARRY_SHIFT) & 1),
      pointer = sum & WORD_MASK;
    const overflow = Boolean(~(left ^ TILE_POINTER_ADDEND) & (left ^ pointer) & WORD_SIGN);
    io.write(base + TEXT_TILE_UPLOAD_ADDRESS, pointer);
    const height = io.read(WRAM_BASE + WINDOW_TILE_COUNT + x),
      size = (height << UPLOAD_SIZE_SHIFT) & WORD_MASK;
    io.write(base + TEXT_TILE_UPLOAD_BYTES, size);
    const requestCounter = (io.read(base + TEXT_TILE_UPLOAD) + 1) & WORD_MASK;
    io.write(base + TEXT_TILE_UPLOAD, requestCounter);
    // The fourth size ASL overrides C; INC and all wait LDAs preserve V/C.
    const flags =
      (status & ~STATUS_CV) |
      ((height >>> UPLOAD_SIZE_CARRY_SHIFT) & 1) |
      (overflow ? FLAG_OVERFLOW : 0);
    const wait = renderACBD(view, { bank, status: flags, x, y, waitMode, waitRead01F6 }, budget);
    for (const operation of wait.operations) operations.push(operation);
    return {
      ...wait,
      outcome: 'request_wait_prepared',
      pointer,
      size,
      requestCounter,
      operations: Object.freeze(operations),
    };
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { phase: 'request', ...error };
  }
}
