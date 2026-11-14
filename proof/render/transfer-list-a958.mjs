import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import {
  WRAM_BASE,
  WRAM_BANK,
  WRAM_HIGH_BANK,
  BANK_WITHOUT_IO,
} from '../../src/constants/memory-map.mjs';
import {
  BANK_SIZE,
  BYTE_BITS,
  BYTE_MASK,
  WORD_SIGN,
  WORD_MASK,
  HIGH_BYTE_MASK,
} from '../../src/constants/bits.mjs';
import {
  NMI_JOB_LISTS,
  DP_VRAM_UPLOAD_INDEX,
  VRAM_UPLOAD_SOURCES,
  VRAM_UPLOAD_BYTES,
  VRAM_UPLOAD_ADDRESSES,
  VRAM_UPLOAD_BANKS,
} from '../../src/task/wram.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';
import {
  A1T1L,
  DAS1L,
  VMADDL,
  VMAINC,
  A1B1,
  MDMAEN,
} from '../../src/constants/hardware-registers.mjs';

const DEFAULT_MAX_WORK = 1000000;
const TRANSFER_STACK_BYTES = 3;
const OVERFLOW_FLAG_SHIFT = 6;
const STATUS_NZ = FLAG_NEGATIVE | FLAG_ZERO;
const LIST_VRAM_INCREMENT = 0x80;

// Complete local A958 data/request algorithm; shared bank 00 DP82 cursor,
// fresh table reads and retained high A. No CPU, DMA or interrupt execution.
export function prepareRenderA958({
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
    throw Error('Invalid render transfer list context');
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
    return view.finish(renderA958(view, { bank, status, x, y, ioMode }, { work: 0, maxWork }));
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Outer owners share byte aliases and budget; only their finish creates
// a commit payload. Later boundaries discard all earlier effects.
export function renderA958(view, { bank, status, x = null, y = null, ioMode = null }, budget) {
  let phase = 'gates',
    gate = null,
    cursor = null,
    iterations = 0;
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
  const read = (address, bytes = 2) => {
    tick();
    return record(
      'read',
      'data',
      address,
      view.read(address) | (bytes === 2 ? view.read(address + 1) << BYTE_BITS : 0),
      bytes,
    );
  };
  const write = (address, value, bytes = 2) => {
    tick();
    view.write(address, value & BYTE_MASK);
    if (bytes === 2) view.write(address + 1, value >>> BYTE_BITS);
    record('write', 'data', address, value, bytes);
  };
  const register = (offset, value, bytes = 2) => {
    const address = base + offset;
    if (bank === WRAM_BANK || bank === WRAM_HIGH_BANK) write(address, value, bytes);
    else if (!(bank & BANK_WITHOUT_IO)) {
      tick();
      if (ioMode !== 'record-requests')
        throw { renderBoundary: true, reason: 'render_io_context_required', address };
      record('write', 'io', address, value, bytes);
    } else throw { renderBoundary: true, reason: 'render_address_required', address };
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
    cursor,
    iterations,
    work: budget.work,
    operations: Object.freeze(operations),
    ioWrites: Object.freeze(ioWrites),
  });
  try {
    gate = read(base + NMI_JOB_LISTS);
    if (gate === 0) return result('gate_1562_zero', 0, (status & ~STATUS_NZ) | 2);
    // DP addressing always uses bank 00, including DBR 7F. No cursor read
    // on zero 1562, no table/register/write requirements on negative 82.
    cursor = x = read(DP_VRAM_UPLOAD_INDEX);
    if (x >= WORD_SIGN)
      return result('cursor_82_negative', gate, (status & ~STATUS_NZ) | FLAG_NEGATIVE);
    phase = 'records';
    let target;
    do {
      register(A1T1L, read(base + VRAM_UPLOAD_SOURCES + x));
      register(DAS1L, VRAM_UPLOAD_BYTES);
      target = read(base + VRAM_UPLOAD_ADDRESSES + x);
      register(VMADDL, target);
      register(VMAINC, LIST_VRAM_INCREMENT, 1);
      register(A1B1, read(base + VRAM_UPLOAD_BANKS + x, 1), 1);
      register(MDMAEN, 2, 1);
      iterations++;
      x = (x - 2) & WORD_MASK;
    } while (x < WORD_SIGN);
    phase = 'cursor';
    write(DP_VRAM_UPLOAD_INDEX, x);
    // Final DEX supplies N1/Z0. BYTE LDA02 retains the last target's
    // high A; STX/REP do not replace either N/Z or C/V/I/Y/DBR/D.
    return result(
      'requests_prepared',
      (target & HIGH_BYTE_MASK) | 2,
      (status & ~STATUS_NZ) | FLAG_NEGATIVE,
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase };
  }
}
