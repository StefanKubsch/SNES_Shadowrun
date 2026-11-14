import {
  WRAM_BASE,
  WRAM_HIGH_BANK,
  WRAM_BANK,
  BANK_WITHOUT_IO,
} from '../../src/constants/memory-map.mjs';
import { BANK_SIZE, WORD_SIGN } from '../../src/constants/bits.mjs';
import { PORTRAIT_DMA_REQUEST } from '../../src/task/wram.mjs';
import {
  DAS0L,
  A1T0L,
  A1B0,
  BBAD0,
  VMAINC,
  DMAP0,
} from '../../src/constants/hardware-registers.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { textHelperAccess, textHelperResult, textNZ } from './text-helper-access.mjs';
import { wordWaitAccess } from './word-wait.mjs';
import { renderOutputBytes } from './output-budget.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const UPLOAD_BYTES = 0x1000;
const UPLOAD_SOURCE_OFFSET = 0x5250;
const VRAM_DATA_PORT = 0x18;
const VRAM_INCREMENT_AFTER_HIGH = 0x80;

export function prepareRender8FF5({
  data,
  bank = null,
  status = null,
  x = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  ioMode = null,
  waitMode = null,
  waitRead0140 = null,
} = {}) {
  if (
    (x !== null && !isWord(x)) ||
    (y !== null && !isWord(y)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (waitMode !== null && waitMode !== 'record-observations') ||
    (waitRead0140 !== null &&
      (!Array.isArray(waitRead0140) || !Array.from(waitRead0140).every(isWord)))
  )
    throw Error('Invalid render 8FF5 context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    2,
  );
  if (entry) return entry;
  if (x === null) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  try {
    return view.finish(
      render8FF5(
        view,
        { bank, status, x, y, ioMode, waitMode, waitRead0140 },
        { work: 0, maxWork, outputBytes: 0, maxOutputBytes },
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Source-specific setup/publication/signed poll, no transfer execution. A is
// overwritten; X is a required full WORD. Only the outer owner finishes/commits.
export function render8FF5(
  view,
  {
    bank,
    status,
    x,
    y = null,
    ioMode = null,
    waitMode = null,
    waitRead0140 = null,
    observations = {},
  },
  budget,
) {
  const base = bank * BANK_SIZE,
    address = base + PORTRAIT_DMA_REQUEST,
    operations = [];
  let phase = 'setup',
    polls = 0,
    a;
  budget.outputBytes ??= 0;
  observations.waitPolls0140 ??= 0;
  try {
    if (!isWord(x)) throw { renderBoundary: true, reason: 'render_entry_required' };
    const setup = textHelperAccess(view, budget, operations, phase);
    for (const [offset, value, bytes] of [
      [DAS0L, UPLOAD_BYTES, 2],
      [A1T0L, UPLOAD_SOURCE_OFFSET, 2],
      [A1B0, WRAM_HIGH_BANK, 1],
      [BBAD0, VRAM_DATA_PORT, 1],
      [VMAINC, VRAM_INCREMENT_AFTER_HIGH, 1],
      [DMAP0, 1, 1],
    ]) {
      if (bank === WRAM_BANK || bank === WRAM_HIGH_BANK) {
        renderOutputBytes(budget, bytes);
        setup.write(base + offset, value, bytes);
      } else if (!(bank & BANK_WITHOUT_IO))
        setup.request('write', base + offset, value, bytes, ioMode);
      else
        throw { renderBoundary: true, reason: 'render_address_required', address: base + offset };
    }
    phase = 'publish';
    renderOutputBytes(budget, 2);
    wordWaitAccess(view, budget, operations, phase).write(address, x);
    phase = 'wait';
    const wait = wordWaitAccess(view, budget, operations, phase);
    do {
      if (waitRead0140 !== null) {
        if (waitMode !== 'record-observations')
          throw { renderBoundary: true, reason: 'render_wait_context_required', address };
        if (observations.waitPolls0140 >= waitRead0140.length)
          throw { renderBoundary: true, reason: 'render_wait_read_required', address };
      }
      a = wait.poll(address, waitRead0140?.[observations.waitPolls0140]);
      observations.waitPolls0140++;
      polls++;
    } while (!(a & WORD_SIGN));
    return textHelperResult({ a, x, y, bank, status: textNZ(status, a) }, budget, operations, {
      outcome: 'setup_negative_wait_observed',
      polls,
      waitPolls0140: observations.waitPolls0140,
      outputBytes: budget.outputBytes,
      minimumStackBytes: 2,
    });
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, caller: '8FF5', phase, polls };
  }
}
