import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { advancePaletteCycles } from './palette-cycles-equations.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';

const DEFAULT_MAX_WORK = 1000000;
const MINIMUM_STACK_BYTES = 3;

// Manual ROM-derived producer. This call does not advance a frame or run DMA.
export function prepareRender8076({
  data,
  bank = null,
  status = null,
  x = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
} = {}) {
  if ((x !== null && !isWord(x)) || (y !== null && !isWord(y)))
    throw Error('Invalid render palette update context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    MINIMUM_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  try {
    return view.finish(advancePaletteCycles(view, { bank, status, y }, { work: 0, maxWork }));
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}
