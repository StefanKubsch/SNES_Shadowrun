import { WRAM_BASE, WRAM_HIGH_BANK } from '../../src/constants/memory-map.mjs';
import { BANK_SIZE, WORD_MASK } from '../../src/constants/bits.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderOutputBytes } from './output-budget.mjs';
import { textHelperAccess, textHelperResult, textNZ } from './text-helper-access.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const ROW_COPY_STACK_BYTES = 3;
const SOURCE_LAST_BYTE = 0x5a4f;
const DESTINATION_LAST_BYTE = 0x624f;
const COPY_ROWS = 7;
const ROW_BYTES = 256;
const STATUS_CV = 65;
const COPIED_BYTES = 1792;

export function prepareRender8F20({
  data,
  bank = null,
  status = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
} = {}) {
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    ROW_COPY_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => WRAM_BASE + v),
  );
  try {
    return view.finish(
      render8F20(view, { bank, status }, { work: 0, maxWork, outputBytes: 0, maxOutputBytes }),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Source-specific seven-row byte algorithm, no CPU/stack execution. Each
// descending read sees the shared outer overlay, including earlier writes.
// Only that caller finishes/commits; incoming A/X/Y are overwritten by source.
export function render8F20(view, context, budget) {
  const operations = [];
  let x = SOURCE_LAST_BYTE,
    y = DESTINATION_LAST_BYTE,
    pass = 0,
    phase = 'rowCopy';
  budget.outputBytes ??= 0;
  try {
    for (pass = 1; pass <= COPY_ROWS; pass++) {
      phase = 'row' + pass;
      y -= ROW_BYTES;
      const access = textHelperAccess(view, budget, operations, phase);
      for (let remaining = ROW_BYTES; remaining > 0; remaining--) {
        const value = access.read(WRAM_HIGH_BANK * BANK_SIZE + x, 1);
        renderOutputBytes(budget, 1);
        access.write(WRAM_HIGH_BANK * BANK_SIZE + y, value, 1);
        x--;
        y--;
      }
    }
    // Final CPX equality gives C1, last SBC V0, PLB replaces N/Z from the
    // restored entryDBR BYTE. No entryP restoration or flags from final A.
    const status = textNZ((context.status & ~STATUS_CV) | 1, context.bank, 1);
    return textHelperResult(
      { a: WORD_MASK, x, y, bank: context.bank, status },
      budget,
      operations,
      {
        outcome: 'dialog_rows_prepared',
        passes: COPY_ROWS,
        copiedBytes: COPIED_BYTES,
        outputBytes: budget.outputBytes,
        minimumStackBytes: ROW_COPY_STACK_BYTES,
      },
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, caller: '8F20', phase, pass };
  }
}
