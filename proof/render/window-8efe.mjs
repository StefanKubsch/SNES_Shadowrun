import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { textHelperAccess, textHelperResult } from './text-helper-access.mjs';
import { renderOutputBytes } from './output-budget.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import {
  BANK_SIZE,
  BYTE_MASK,
  HEX_RADIX,
  WORD_HEX_DIGITS,
  HIGH_BYTE_MASK,
} from '../../src/constants/bits.mjs';
import {
  LEFT_WINDOW_RIGHT_EDGE,
  RIGHT_WINDOW_RIGHT_EDGE,
  LEFT_WINDOW_LEFT_EDGE,
  RIGHT_WINDOW_LEFT_EDGE,
} from '../../src/task/wram.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const WINDOW_STACK_BYTES = 4;
// Original BYTE addends; second/third retain the preceding carry chain.
const FIRST_EDGE_BIAS = 0x39;
const SECOND_EDGE_BIAS = 0xc5;
const THIRD_EDGE_BIAS = 0x3b;
const LAST_EDGE_BIAS = 0xc7;

export function prepareRender8EFE({
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
} = {}) {
  if ([a, x, y].some((value) => value !== null && !isWord(value)))
    throw Error('Invalid render 8EFE context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    WINDOW_STACK_BYTES,
  );
  if (entry) return entry;
  if (a === null || x === null) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((address) => WRAM_BASE + address),
  );
  try {
    return view.finish(
      render8EFE(
        view,
        { bank, status, a, x, y },
        { work: 0, maxWork, outputBytes: 0, maxOutputBytes },
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Source-specific BYTE arithmetic with PHP/PLP restoration, including the
// hidden high A. No stack or CPU execution; outer caller owns the commit.
export function render8EFE(view, context, budget) {
  const operations = [],
    base = context.bank * BANK_SIZE,
    low = context.x & BYTE_MASK;
  let phase = '0149';
  budget.outputBytes ??= 0;
  try {
    if (!isWord(context.a) || !isWord(context.x))
      throw { renderBoundary: true, reason: 'render_entry_required' };
    const first = low + FIRST_EDGE_BIAS,
      second = low + SECOND_EDGE_BIAS + Number(first > BYTE_MASK),
      inverse = low ^ BYTE_MASK;
    const third = inverse + THIRD_EDGE_BIAS + Number(second > BYTE_MASK),
      last = (inverse + LAST_EDGE_BIAS) & BYTE_MASK;
    for (const [offset, value] of [
      [LEFT_WINDOW_RIGHT_EDGE, first],
      [RIGHT_WINDOW_RIGHT_EDGE, second],
      [LEFT_WINDOW_LEFT_EDGE, third],
      [RIGHT_WINDOW_LEFT_EDGE, last],
    ]) {
      phase = offset.toString(HEX_RADIX).toUpperCase().padStart(WORD_HEX_DIGITS, '0');
      renderOutputBytes(budget, 1);
      textHelperAccess(view, budget, operations, phase).write(base + offset, value, 1);
    }
    return textHelperResult(
      { ...context, a: (context.a & HIGH_BYTE_MASK) | last },
      budget,
      operations,
      {
        outcome: 'window_bytes_prepared',
        outputBytes: budget.outputBytes,
        minimumStackBytes: WINDOW_STACK_BYTES,
      },
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, caller: '8EFE', phase };
  }
}
