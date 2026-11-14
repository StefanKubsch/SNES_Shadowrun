import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import { WINDOW_LEFT_PIXEL, WINDOW_COLUMNS, WINDOW_WIDTH_PIXELS } from '../../src/task/wram.mjs';
import { WORD_SIGN, WORD_MASK } from '../../src/constants/bits.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const DIMENSION_ARGUMENT = 4;

import {
  textHelperAccess,
  textHelperResult,
  textNZ,
  textArithmeticFlags,
} from './text-helper-access.mjs';

export function prepareRenderFA92({
  data,
  bank = null,
  status = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
} = {}) {
  if (y !== null && !isWord(y)) throw Error('Invalid render FA92 context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    2,
  );
  if (entry) return entry;
  if (y === null) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => WRAM_BASE + v),
  );
  try {
    return view.finish(
      renderFA92(view, { bank, status, y }, { work: 0, maxWork, outputBytes: 0, maxOutputBytes }),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Source-specific fixed-long WORD fields. No CPU dispatch, inferred buffer
// validity or scene ownership. Only the outer caller finishes/commits the view.
export function renderFA92(view, context, budget) {
  const r = { bank: context.bank, status: context.status, y: context.y };
  const operations = [];
  let phase = 'index';
  budget.outputBytes ??= 0;
  const access = () => textHelperAccess(view, budget, operations, phase);
  const load = (value) => {
    r.a = value;
    r.status = textNZ(r.status, value);
  };
  try {
    r.x = access().read(0);
    r.status = textNZ(r.status, r.x);
    phase = 'firstField';
    load(access().read(2));
    const firstWord = r.a;
    access().write(WRAM_BASE + WINDOW_LEFT_PIXEL + r.x, r.a);
    phase = 'secondField';
    load(access().read(DIMENSION_ARGUMENT));
    const inputWord = r.a;
    const relative = inputWord === 0 || Boolean(inputWord & WORD_SIGN);
    let dimension = null;
    if (relative) {
      phase = 'dimension';
      r.status &= ~1;
      dimension = access().read(WRAM_BASE + WINDOW_COLUMNS + r.x);
      const total = inputWord + dimension;
      r.a = total & WORD_MASK;
      r.status = textArithmeticFlags(r.status, inputWord, dimension, r.a, total > WORD_MASK);
      load((r.a - 1) & WORD_MASK);
      load((r.a - 1) & WORD_MASK);
    }
    phase = 'secondStore';
    access().write(WRAM_BASE + WINDOW_WIDTH_PIXELS + r.x, r.a);
    return textHelperResult(r, budget, operations, {
      outcome: 'buffer_fields_prepared',
      firstWord,
      inputWord,
      relative,
      dimension,
      minimumStackBytes: 2,
      outputBytes: budget.outputBytes,
    });
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, caller: 'FA92', phase };
  }
}
