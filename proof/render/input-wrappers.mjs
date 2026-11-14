import { BYTE_MASK } from '../../src/constants/bits.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import { FLAG_MEMORY_8BIT, FLAG_INDEX_8BIT } from '../../src/constants/cpu-flags.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { render9E0B } from './input-9e0b.mjs';
import { render9E1A } from './input-9e1a.mjs';

const DEFAULT_MAX_WORK = 1000000;
const WORD_REGISTER_MASK = FLAG_MEMORY_8BIT | FLAG_INDEX_8BIT;
const WRAPPER_STACK_BYTES = 6;
const OVERFLOW_FLAG_SHIFT = 6;

function prepareWrapper(
  wrapper,
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
    ioRead4212 = null,
    ioRead4218 = null,
  } = {},
) {
  if (
    (status !== null && (!Number.isInteger(status) || status < 0 || status > BYTE_MASK)) ||
    (x !== null && !isWord(x)) ||
    (y !== null && !isWord(y)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (ioRead4212 !== null &&
      (!Array.isArray(ioRead4212) || !Array.from(ioRead4212).every(isWord))) ||
    (ioRead4218 !== null && !isWord(ioRead4218))
  )
    throw Error('Invalid input wrapper context');
  // REP30 temporarily clears M/X; PHP still owns the complete original P.
  const entry = renderEntryBoundary(
    {
      data,
      bank,
      status: status === null ? null : status & ~WORD_REGISTER_MASK,
      emulation,
      directPage,
      stackWindow,
      maxWork,
    },
    WRAPPER_STACK_BYTES,
  );
  if (entry) return entry;
  if (status & FLAG_INDEX_8BIT && ((x !== null && x > BYTE_MASK) || (y !== null && y > BYTE_MASK)))
    return { handled: false, reason: 'render_index_width_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  try {
    const context = { bank, status, x, y, ioMode, ioRead4212, ioRead4218 },
      budget = { work: 0, maxWork };
    return view.finish((wrapper === 'F290' ? renderF290 : renderF298)(view, context, budget));
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

export const prepareRenderF290 = (context) => prepareWrapper('F290', context);
export const prepareRenderF298 = (context) => prepareWrapper('F298', context);

// These manual wrappers are independent operations. Their order in a test
// composition is synthetic, never a replacement for the original mainloop.
function wrapInput(view, context, budget, wrapper, child) {
  try {
    const result = child(
      view,
      { ...context, status: context.status & ~WORD_REGISTER_MASK },
      budget,
    );
    return {
      ...result,
      outcome: 'input_wrapper_prepared',
      wrapper,
      childOutcome: result.outcome,
      childStatus: result.status,
      status: context.status,
      carry: context.status & 1,
      overflow: (context.status >>> OVERFLOW_FLAG_SHIFT) & 1,
    };
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, wrapper };
  }
}
export const renderF290 = (view, context, budget) =>
  wrapInput(view, context, budget, 'F290', render9E0B);
export const renderF298 = (view, context, budget) =>
  wrapInput(view, context, budget, 'F298', render9E1A);
