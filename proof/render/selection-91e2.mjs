import { DIALOG_END } from '../../src/task/wram.mjs';
import { BYTE_MASK, WORD_MASK, BANK_SIZE } from '../../src/constants/bits.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderA6C7 } from './menu-a6a5.mjs';
import { textHelperAccess, textHelperResult, textNZ } from './text-helper-access.mjs';
import { renderOutputBytes } from './output-budget.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const CHOICE_STACK_BYTES = 22;
const INITIAL_ARGUMENT = 0x17;
const CHOICE_COLUMN = 4;
const ROW_ARGUMENT = 4;
const ROWS_ARGUMENT = 6;
const CHOICE_VISIBLE_ROWS = 3;
const TEXT_POINTER_ARGUMENT = 8;
const CHOICE_TEXT_POINTER = 0x920d;
const TEXT_BANK_ARGUMENT = 10;
const CHOICE_TEXT_BANK = 0x80;

const isByte = (value) => Number.isInteger(value) && value >= 0 && value <= BYTE_MASK;
export function prepareRender91E2({
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
  ioRead4214Word = null,
  ioRead4216Byte = null,
  ioRead4214 = null,
  ioRead4216 = null,
  ioRead4217 = null,
  ioRead2140 = null,
  waitRead01F6 = null,
  waitRead01FA = null,
  waitRead01FC = null,
  waitRead1C76 = null,
} = {}) {
  if (
    [x, y].some((value) => value !== null && !isWord(value)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (waitMode !== null && waitMode !== 'record-observations') ||
    [ioRead4214Word, ioRead4216, waitRead01F6, waitRead01FA, waitRead01FC, waitRead1C76].some(
      (values) => values !== null && (!Array.isArray(values) || !Array.from(values).every(isWord)),
    ) ||
    [ioRead4216Byte, ioRead4214, ioRead4217, ioRead2140].some(
      (values) => values !== null && (!Array.isArray(values) || !Array.from(values).every(isByte)),
    )
  )
    throw Error('Invalid render 91E2 context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    CHOICE_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((address) => WRAM_BASE + address),
  );
  try {
    return view.finish(
      render91E2(
        view,
        {
          bank,
          status,
          x,
          y,
          ioMode,
          waitMode,
          ioRead4214Word,
          ioRead4216Byte,
          ioRead4214,
          ioRead4216,
          ioRead4217,
          ioRead2140,
          waitRead01F6,
          waitRead01FA,
          waitRead01FC,
          waitRead1C76,
          stackBytes: stackWindow[1] - stackWindow[0] + 1,
        },
        { work: 0, maxWork, maxOutputBytes, outputBytes: 0 },
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Fixed original choice algorithm with actual inner menu, fresh DP bytes and
// returned DBR. Only the outer owner finishes/commits; no CPU/stack execution.
export function render91E2(view, context, budget) {
  const operations = [],
    observations = context.observations ?? {};
  const r = {
    a: 0,
    x: context.x ?? null,
    y: context.y ?? null,
    bank: context.bank,
    status: context.status,
  };
  let phase = 'prefix';
  budget.outputBytes ??= 0;
  const access = () => textHelperAccess(view, budget, operations, 'choice91E2:' + phase);
  const load = (value) => {
    r.a = value;
    r.status = textNZ(r.status, value);
  };
  const write = (address) => {
    renderOutputBytes(budget, 2);
    access().write(address, r.a);
  };
  try {
    load(access().read(INITIAL_ARGUMENT));
    const initial = r.a;
    write(0);
    for (const [address, value] of [
      [2, 2],
      [ROW_ARGUMENT, CHOICE_COLUMN],
      [ROWS_ARGUMENT, CHOICE_VISIBLE_ROWS],
      [TEXT_POINTER_ARGUMENT, CHOICE_TEXT_POINTER],
      [TEXT_BANK_ARGUMENT, CHOICE_TEXT_BANK],
    ]) {
      load(value);
      write(address);
    }
    phase = 'menu';
    const before = Object.freeze({ ...r });
    const menu = renderA6C7(
      view,
      {
        ...context,
        ...r,
        observations,
        stackBytes: (context.stackBytes ?? CHOICE_STACK_BYTES) - 2,
      },
      budget,
    );
    for (const operation of menu.operations) operations.push(operation);
    Object.assign(r, { a: menu.a, x: menu.x, y: menu.y, bank: menu.bank, status: menu.status });
    const after = Object.freeze({ ...r });
    phase = 'result';
    load(access().read(0));
    r.status = textNZ((r.status & ~1) | Number(r.a === WORD_MASK), (r.a - WORD_MASK) & WORD_MASK);
    const cancelled = r.a === WORD_MASK;
    if (cancelled) {
      phase = 'cancel';
      write(r.bank * BANK_SIZE + DIALOG_END);
    }
    return textHelperResult(r, budget, operations, {
      outcome: cancelled ? 'choice_cancelled' : 'choice_returned',
      initial,
      selection: r.a,
      menuOutcome: menu.outcome,
      menuSelection: menu.selection,
      minimumStackBytes: CHOICE_STACK_BYTES,
      outputBytes: budget.outputBytes,
      ...observations,
      calls: Object.freeze([Object.freeze({ name: 'A6C7', before, after })]),
      menuCalls: menu.calls,
      menuByteOperations: menu.byteOperations,
    });
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, calleeCaller: error.caller ?? null, caller: '91E2', compositionPhase: phase };
  }
}
