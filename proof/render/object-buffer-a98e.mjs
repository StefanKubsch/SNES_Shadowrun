import {
  WRAM_BASE,
  WRAM_BANK,
  WRAM_HIGH_BANK,
  BANK_WITHOUT_IO,
} from '../../src/constants/memory-map.mjs';
import { BANK_SIZE, BYTE_MASK, BYTE_BITS } from '../../src/constants/bits.mjs';
import { NMI_JOB_LISTS, OAM_BUFFER } from '../../src/task/wram.mjs';
import { A1T2L, DAS2L, OAMADDL, MDMAEN } from '../../src/constants/hardware-registers.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';

const DEFAULT_MAX_WORK = 1000000;
const NMI_JOB_LISTS_HIGH = NMI_JOB_LISTS + 1;
const TRANSFER_STACK_BYTES = 3;
const OVERFLOW_FLAG_SHIFT = 6;
const STATUS_NZ = 0x82;
const OAM_UPLOAD_BYTES = 0x220;
const OAM_ADDRESS_WORD = 0x8000;
const DMA_CHANNEL_MASK = 4;
const RETURN_ACCUMULATOR = 0x8004;

// Full localA98E request algorithm, including late WORDgateclear and
// retained A8004/BYTE flags. No CPU, DMA, object latch or interrupt execution.
export function prepareRenderA98E({
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
} = {}) {
  if (
    (x !== null && !isWord(x)) ||
    (y !== null && !isWord(y)) ||
    (ioMode !== null && ioMode !== 'record-requests')
  )
    throw Error('Invalid render object buffer context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    TRANSFER_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  try {
    return view.finish(renderA98E(view, { bank, status, x, y, ioMode }, { work: 0, maxWork }));
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Shared-view operation for an explicit outer owner; only an outer
// finish may create a commit payload. Later boundaries discard all requests.
export function renderA98E(view, { bank, status, x = null, y = null, ioMode = null }, budget) {
  let phase = 'gate',
    gate;
  const base = bank * BANK_SIZE,
    operations = [],
    ioWrites = [];
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const record = (kind, space, address, value, bytes) => {
    const event = Object.freeze({ kind, space, phase, address, value, bytes });
    operations.push(event);
    if (space === 'io') ioWrites.push(event);
    return value;
  };
  const write = (offset, value, bytes = 2) => {
    tick();
    const address = base + offset;
    view.write(address, value & BYTE_MASK);
    if (bytes === 2) view.write(address + 1, value >>> BYTE_BITS);
    record('write', 'data', address, value, bytes);
  };
  const register = (offset, value, bytes = 2) => {
    if (bank === WRAM_BANK || bank === WRAM_HIGH_BANK) write(offset, value, bytes);
    else if (!(bank & BANK_WITHOUT_IO)) {
      tick();
      const address = base + offset;
      if (ioMode !== 'record-requests')
        throw { renderBoundary: true, reason: 'render_io_context_required', address };
      record('write', 'io', address, value, bytes);
    } else
      throw { renderBoundary: true, reason: 'render_address_required', address: base + offset };
  };
  const result = (outcome, a, finalStatus) => ({
    handled: true,
    outcome,
    a,
    x,
    y,
    bank,
    status: finalStatus,
    carry: finalStatus & 1,
    overflow: (finalStatus >>> OVERFLOW_FLAG_SHIFT) & 1,
    gate,
    work: budget.work,
    operations: Object.freeze(operations),
    ioWrites: Object.freeze(ioWrites),
  });
  try {
    tick();
    gate = record(
      'read',
      'data',
      base + NMI_JOB_LISTS,
      view.read(base + NMI_JOB_LISTS) | (view.read(base + NMI_JOB_LISTS_HIGH) << BYTE_BITS),
      2,
    );
    if (gate === 0) return result('gate_1562_zero', 0, (status & ~STATUS_NZ) | 2);
    phase = 'request';
    register(A1T2L, OAM_BUFFER);
    register(DAS2L, OAM_UPLOAD_BYTES);
    register(OAMADDL, OAM_ADDRESS_WORD);
    register(MDMAEN, DMA_CHANNEL_MASK, 1);
    phase = 'clear';
    write(NMI_JOB_LISTS, 0);
    // BYTE LDA04 retains highA80 from WORD LDA8000 and sets N0/Z0.
    // Neither REP20 nor STZWORD1562 changes A/N/Z or incoming C/V/I.
    return result('request_prepared', RETURN_ACCUMULATOR, status & ~STATUS_NZ);
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase };
  }
}
