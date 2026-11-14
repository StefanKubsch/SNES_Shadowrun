import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { wordWaitAccess, renderWordWait } from './word-wait.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import { TEXT_MAP_UPLOAD } from '../../src/task/wram.mjs';
import { BANK_SIZE, WORD_MASK } from '../../src/constants/bits.mjs';

const DEFAULT_MAX_WORK = 1000000;
const REQUEST_STACK_BYTES = 6;
const WAIT_STACK_BYTES = 3;

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
    waitRead01F8 = null,
  } = {},
) {
  if (
    (x !== null && !isWord(x)) ||
    (y !== null && !isWord(y)) ||
    (waitMode !== null && waitMode !== 'record-observations') ||
    (waitRead01F8 !== null &&
      (!Array.isArray(waitRead01F8) || !Array.from(waitRead01F8).every(isWord)))
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
      run(view, { bank, status, x, y, waitMode, waitRead01F8 }, { work: 0, maxWork }),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

export const prepareRenderACB5 = (context) => prepare(renderACB5, REQUEST_STACK_BYTES, context);
export const prepareRenderACAF = (context) => prepare(renderACAF, WAIT_STACK_BYTES, context);
export const renderACAF = (view, context, budget) =>
  renderWordWait(view, context, budget, TEXT_MAP_UPLOAD, context.waitRead01F8 ?? null);

export function renderACB5(view, context, budget) {
  const operations = [],
    io = wordWaitAccess(view, budget, operations, 'request');
  const address = context.bank * BANK_SIZE + TEXT_MAP_UPLOAD;
  try {
    const requestCounter = (io.read(address) + 1) & WORD_MASK;
    io.write(address, requestCounter);
    const wait = renderACAF(view, context, budget);
    for (const operation of wait.operations) operations.push(operation);
    return {
      ...wait,
      outcome: 'request_wait_prepared',
      requestCounter,
      operations: Object.freeze(operations),
    };
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { phase: 'request', ...error };
  }
}
