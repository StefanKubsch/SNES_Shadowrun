import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { wordWaitAccess, renderWordWait } from './word-wait.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import { TEXT_BUFFER_UPLOAD, TEXT_BUFFER_READBACK } from '../../src/task/wram.mjs';
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
    waitRead01FA = null,
    waitRead01FC = null,
  } = {},
) {
  if (
    [x, y].some((v) => v !== null && !isWord(v)) ||
    (waitMode !== null && waitMode !== 'record-observations') ||
    [waitRead01FA, waitRead01FC].some(
      (v) => v !== null && (!Array.isArray(v) || !Array.from(v).every(isWord)),
    )
  )
    throw Error('Invalid render text wait context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    stackBytes,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => WRAM_BASE + v),
  );
  try {
    return view.finish(
      run(view, { bank, status, x, y, waitMode, waitRead01FA, waitRead01FC }, { work: 0, maxWork }),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}
export const prepareRenderAEF4 = (context) => prepare(renderAEF4, REQUEST_STACK_BYTES, context);
export const prepareRenderAEFC = (context) => prepare(renderAEFC, REQUEST_STACK_BYTES, context);
export const prepareRenderACC3 = (context) => prepare(renderACC3, WAIT_STACK_BYTES, context);
export const prepareRenderACC9 = (context) => prepare(renderACC9, WAIT_STACK_BYTES, context);
export const renderACC3 = (view, context, budget) =>
  renderWordWait(view, context, budget, TEXT_BUFFER_UPLOAD, context.waitRead01FA ?? null);
export const renderACC9 = (view, context, budget) =>
  renderWordWait(view, context, budget, TEXT_BUFFER_READBACK, context.waitRead01FC ?? null);

function request(view, context, budget, offset, wait) {
  const operations = [],
    io = wordWaitAccess(view, budget, operations, 'request'),
    address = context.bank * BANK_SIZE + offset;
  try {
    const requestCounter = (io.read(address) + 1) & WORD_MASK;
    io.write(address, requestCounter);
    const result = wait(view, context, budget);
    for (const event of result.operations) operations.push(event);
    return {
      ...result,
      outcome: 'request_wait_prepared',
      requestCounter,
      operations: Object.freeze(operations),
    };
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { phase: 'request', ...error };
  }
}
export const renderAEF4 = (view, context, budget) =>
  request(view, context, budget, TEXT_BUFFER_UPLOAD, renderACC3);
export const renderAEFC = (view, context, budget) =>
  request(view, context, budget, TEXT_BUFFER_READBACK, renderACC9);
