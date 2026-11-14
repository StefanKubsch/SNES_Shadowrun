import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderB0A1 } from './counter-b0a1.mjs';
import { render8EFE } from './window-8efe.mjs';
import { textHelperAccess, textHelperResult, textNZ } from './text-helper-access.mjs';
import { renderOutputBytes } from './output-budget.mjs';
import {
  WRAM_BASE,
  WRAM_BANK,
  WRAM_HIGH_BANK,
  BANK_WITHOUT_IO,
} from '../../src/constants/memory-map.mjs';
import { BANK_SIZE, WORD_MASK } from '../../src/constants/bits.mjs';
import { DIALOG_HDMA_TABLE, HDMAEN_SHADOW, TMW_SHADOW } from '../../src/task/wram.mjs';
import {
  W12SEL,
  WBGLOG,
  A1T0L,
  DMAP0,
  BBAD0,
  A1B0,
} from '../../src/constants/hardware-registers.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const TRANSFER_STACK_BYTES = 6;
const HDMA_TABLE_LAST_BYTE = 15;
const INITIAL_LAYER_COUNTDOWN = 15;
const DIALOG_WINDOW_SELECTION = 0x2222;
const WINDOW_HDMA_TARGET = 0x26;
const WINDOW_SWEEP_END = 0x21;
const WINDOW_SWEEP_STEP = 3;

export function prepareRender8F3A({
  data,
  bank = null,
  status = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  ioMode = null,
  waitMode = null,
  waitRead1C76 = null,
} = {}) {
  if (
    (y !== null && !isWord(y)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (waitMode !== null && waitMode !== 'record-observations') ||
    (waitRead1C76 !== null &&
      (!Array.isArray(waitRead1C76) || !Array.from(waitRead1C76).every(isWord)))
  )
    throw Error('Invalid render 8F3A context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    TRANSFER_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((address) => WRAM_BASE + address),
  );
  try {
    return view.finish(
      render8F3A(
        view,
        { bank, status, y, ioMode, waitMode, waitRead1C76 },
        { work: 0, maxWork, outputBytes: 0, maxOutputBytes },
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Fixed table and eleven actual B0A1/8EFE calls on one fresh provider. The
// chronological observations are external evidence, not a clock or callback.
export function render8F3A(view, context, budget) {
  const operations = [],
    observations = context.observations ?? {},
    iterations = [],
    base = context.bank * BANK_SIZE;
  let phase = 'prefix',
    a = DIALOG_HDMA_TABLE,
    status = context.status,
    x;
  budget.outputBytes ??= 0;
  const access = () => textHelperAccess(view, budget, operations, phase);
  const write = (offset, value, bytes = 2) => {
    renderOutputBytes(budget, bytes);
    access().write(base + offset, value, bytes);
  };
  const setup = (offset, value, bytes = 2) => {
    if (context.bank === WRAM_BANK || context.bank === WRAM_HIGH_BANK) write(offset, value, bytes);
    else if (!(context.bank & BANK_WITHOUT_IO))
      access().request('write', base + offset, value, bytes, context.ioMode);
    else throw { renderBoundary: true, reason: 'render_address_required', address: base + offset };
  };
  try {
    setup(W12SEL, DIALOG_WINDOW_SELECTION);
    setup(WBGLOG, 0);
    setup(A1T0L, DIALOG_HDMA_TABLE);
    phase = 'table';
    for (x = HDMA_TABLE_LAST_BYTE; x >= 0; x--)
      write(DIALOG_HDMA_TABLE + x, access().read(0x808f87 + x, 1), 1);
    phase = 'publish';
    setup(DMAP0, 1, 1);
    setup(BBAD0, WINDOW_HDMA_TARGET, 1);
    setup(A1B0, WRAM_BANK, 1);
    phase = 'gate';
    const gate = access().read(base + HDMAEN_SHADOW, 1);
    write(HDMAEN_SHADOW, gate | 1, 1);
    phase = 'countdown';
    write(TMW_SHADOW, INITIAL_LAYER_COUNTDOWN);
    status = textNZ(status, 2); // WORD LDX0002 before first B0A1.
    for (x = 2; x < WINDOW_SWEEP_END; x += WINDOW_SWEEP_STEP) {
      phase = 'counterWait';
      const wait = renderB0A1(view, { ...context, status, x, observations }, budget);
      for (const operation of wait.operations) operations.push(operation);
      phase = 'window';
      const helper = render8EFE(view, { ...context, status: wait.status, a: wait.a, x }, budget);
      for (const operation of helper.operations) operations.push(operation);
      a = helper.a;
      const next = x + WINDOW_SWEEP_STEP,
        difference = (next - WINDOW_SWEEP_END) & WORD_MASK;
      status = textNZ((helper.status & ~1) | Number(next >= WINDOW_SWEEP_END), difference);
      iterations.push(
        Object.freeze({
          x,
          baseline: wait.baseline,
          observed: wait.observed,
          polls: wait.polls,
          a,
        }),
      );
    }
    return textHelperResult(
      { bank: context.bank, status, a, x, y: context.y ?? null },
      budget,
      operations,
      {
        outcome: 'dialog_transfer_prepared',
        iterations: Object.freeze(iterations),
        counterPolls: observations.counterPolls,
        outputBytes: budget.outputBytes,
        minimumStackBytes: TRANSFER_STACK_BYTES,
      },
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw {
      ...error,
      calleeCaller: error.caller ?? null,
      caller: '8F3A',
      compositionPhase: phase,
      iteration: iterations.length,
    };
  }
}
