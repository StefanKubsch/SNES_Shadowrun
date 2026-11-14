import { BYTE_MASK, BYTE_SIGN, BANK_SIZE, HIGH_BYTE_MASK } from '../../src/constants/bits.mjs';
import {
  WRAM_BASE,
  WRAM_BANK,
  WRAM_HIGH_BANK,
  BANK_WITHOUT_IO,
} from '../../src/constants/memory-map.mjs';
import { INIDISP, TM, TS, TMW, HDMAEN } from '../../src/constants/hardware-registers.mjs';
import { FLAG_NEGATIVE } from '../../src/constants/cpu-flags.mjs';
import {
  INIDISP_SHADOW,
  TM_SHADOW,
  TS_SHADOW,
  TMW_SHADOW,
  HDMAEN_SHADOW,
} from '../../src/task/wram.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { render8949 } from './pretransfer-8949.mjs';
import { renderA9E1 } from './a9e1.mjs';
import { render999A } from './palette-999a.mjs';
import { render80C4 } from './palette-80c4.mjs';
import { renderA919 } from './palette-list-a919.mjs';
import { renderA958 } from './transfer-list-a958.mjs';
import { renderA98E } from './object-buffer-a98e.mjs';
import { render8FBA } from './transfer-palette-8fba.mjs';
import { render9E0B } from './input-9e0b.mjs';
import { renderC06B } from './object-c06b.mjs';
import { renderB0D1 } from './fade-b0d1.mjs';

const DEFAULT_MAX_WORK = 1000000;
const OVERFLOW_FLAG_SHIFT = 6;
const CALLBACK_STACK_BYTES = 6;
const FORCED_BLANK = 0x80;
const STATUS_NZ = 130;

const callees = [
  ['8949', render8949],
  ['A9E1', renderA9E1],
  ['999A', render999A],
  ['80C4', render80C4],
  ['A919', renderA919],
  ['A958', renderA958],
  ['A98E', renderA98E],
  ['8FBA', render8FBA],
  ['9E0B', render9E0B],
  ['C06B', renderC06B],
  ['B0D1', renderB0D1],
];

export function prepareRenderC152({
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
  ioRead213A = null,
  ioRead4212 = null,
  ioRead4218 = null,
} = {}) {
  if (
    (x !== null && !isWord(x)) ||
    (y !== null && !isWord(y)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (ioRead213A !== null &&
      (!Number.isInteger(ioRead213A) || ioRead213A < 0 || ioRead213A > BYTE_MASK)) ||
    (ioRead4212 !== null &&
      (!Array.isArray(ioRead4212) || !Array.from(ioRead4212).every(isWord))) ||
    (ioRead4218 !== null && !isWord(ioRead4218))
  )
    throw Error('Invalid render callback context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    CALLBACK_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  try {
    return view.finish(
      renderC152(
        view,
        { bank, status, x, y, ioMode, ioRead213A, ioRead4212, ioRead4218 },
        { work: 0, maxWork },
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// One chronological overlay and budget. Only the outer owner can finish
// and commit; this manual callback is not an NMI or frame step.
export function renderC152(view, context, budget) {
  let phase = 'prologue',
    callee = null,
    state = { ...context },
    a = null;
  const base = context.bank * BANK_SIZE,
    operations = [],
    calls = [];
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const record = (kind, space, address, value) => {
    operations.push(Object.freeze({ kind, space, phase, address, value, bytes: 1, callee: null }));
    return value;
  };
  const read = (offset) => {
    tick();
    return record('read', 'data', base + offset, view.read(base + offset));
  };
  const register = (offset, value) => {
    tick();
    const address = base + offset,
      bank = context.bank;
    if (bank === WRAM_BANK || bank === WRAM_HIGH_BANK) {
      view.write(address, value);
      record('write', 'data', address, value);
    } else if (!(bank & BANK_WITHOUT_IO)) {
      if (context.ioMode !== 'record-requests')
        throw { renderBoundary: true, reason: 'render_io_context_required', address };
      record('write', 'io', address, value);
    } else throw { renderBoundary: true, reason: 'render_address_required', address };
  };
  try {
    register(INIDISP, FORCED_BLANK);
    state.status = (state.status & ~STATUS_NZ) | FLAG_NEGATIVE;
    for (const [name, fn] of callees) {
      callee = name;
      phase = 'callee';
      const before = budget.work,
        result = fn(view, state, budget);
      a = result.a;
      state = { ...state, status: result.status, x: result.x, y: result.y };
      for (const event of result.operations)
        operations.push(Object.freeze({ ...event, callee: name }));
      calls.push(
        Object.freeze({
          callee: name,
          outcome: result.outcome,
          a,
          x: state.x,
          y: state.y,
          status: state.status,
          workBefore: before,
          workAfter: budget.work,
          work: budget.work - before,
          operationCount: result.operations.length,
        }),
      );
    }
    callee = null;
    phase = 'tail';
    for (const [source, target] of [
      [INIDISP_SHADOW, INIDISP],
      [TM_SHADOW, TM],
      [TS_SHADOW, TS],
      [TMW_SHADOW, TMW],
      [HDMAEN_SHADOW, HDMAEN],
    ]) {
      const value = read(source);
      a = (a & HIGH_BYTE_MASK) | value;
      state.status = (state.status & ~STATUS_NZ) | (value & BYTE_SIGN) | (value === 0 ? 2 : 0);
      register(target, value);
    }
    return {
      handled: true,
      outcome: 'callback_prepared',
      a,
      x: state.x,
      y: state.y,
      bank: context.bank,
      status: state.status,
      carry: state.status & 1,
      overflow: (state.status >>> OVERFLOW_FLAG_SHIFT) & 1,
      work: budget.work,
      operations: Object.freeze(operations),
      calls: Object.freeze(calls),
      ioReads: Object.freeze(operations.filter((e) => e.space === 'io' && e.kind === 'read')),
      ioWrites: Object.freeze(operations.filter((e) => e.space === 'io' && e.kind === 'write')),
    };
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase: callee === null ? phase : error.phase, callee };
  }
}
