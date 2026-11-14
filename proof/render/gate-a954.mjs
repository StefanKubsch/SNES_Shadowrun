import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { textHelperAccess, textHelperResult, textNZ } from './text-helper-access.mjs';
import { renderOutputBytes } from './output-budget.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import { BANK_SIZE, WORD_MASK } from '../../src/constants/bits.mjs';
import { NMI_JOB_LISTS } from '../../src/task/wram.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const GATE_STACK_BYTES = 3;

export function prepareRenderA954({
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
    throw Error('Invalid render A954 context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    GATE_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((address) => WRAM_BASE + address),
  );
  try {
    return view.finish(
      renderA954(
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

// Exact INC WORD DBR:1562/RTL data operation. No CPU/stack execution or
// implicit gate initialization. Only an outer owner finishes/commits the view.
export function renderA954(view, context, budget) {
  const operations = [],
    address = context.bank * BANK_SIZE + NMI_JOB_LISTS;
  let phase = 'source';
  budget.outputBytes ??= 0;
  try {
    const previous = textHelperAccess(view, budget, operations, phase).read(address);
    const value = (previous + 1) & WORD_MASK;
    phase = 'increment';
    renderOutputBytes(budget, 2);
    textHelperAccess(view, budget, operations, phase).write(address, value);
    return textHelperResult(
      {
        bank: context.bank,
        status: textNZ(context.status, value),
        a: context.a ?? null,
        x: context.x ?? null,
        y: context.y ?? null,
      },
      budget,
      operations,
      {
        outcome: 'gate_increment_prepared',
        previous,
        value,
        outputBytes: budget.outputBytes,
        minimumStackBytes: GATE_STACK_BYTES,
      },
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, caller: 'A954', phase };
  }
}
