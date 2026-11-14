import { BYTE_MASK, BYTE_BITS, WORD_SIGN, BANK_SIZE } from '../../src/constants/bits.mjs';
import {
  WRAM_BASE,
  WRAM_BANK,
  WRAM_HIGH_BANK,
  BANK_WITHOUT_IO,
} from '../../src/constants/memory-map.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';
import { HVBJOY, STDCNTRL1L } from '../../src/constants/hardware-registers.mjs';
import { PAD_HELD } from '../../src/task/wram.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';

const DEFAULT_MAX_WORK = 1000000;
const STATUS_NZ = FLAG_NEGATIVE | FLAG_ZERO;
const OVERFLOW_FLAG_SHIFT = 6;
const PAD_HELD_HIGH = PAD_HELD + 1;

// A manual per-call read transcript is evidence supplied by its owner,
// never a device simulation, clock or automatic browser input provider.
export function prepareRender9E0B({
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
  ioRead4212 = null,
  ioRead4218 = null,
} = {}) {
  if (
    (x !== null && !isWord(x)) ||
    (y !== null && !isWord(y)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (ioRead4212 !== null &&
      (!Array.isArray(ioRead4212) || !Array.from(ioRead4212).every(isWord))) ||
    (ioRead4218 !== null && !isWord(ioRead4218))
  )
    throw Error('Invalid render input context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    2,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  try {
    return view.finish(
      render9E0B(
        view,
        { bank, status, x, y, ioMode, ioRead4212, ioRead4218 },
        { work: 0, maxWork },
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// The outer owner retains all earlier effects if successful, and discards
// the shared plan at any boundary. No independently applicable inner plan.
export function render9E0B(
  view,
  { bank, status, x = null, y = null, ioMode = null, ioRead4212 = null, ioRead4218 = null },
  budget,
) {
  let phase = 'poll',
    polls = 0;
  const base = bank * BANK_SIZE,
    operations = [],
    ioReads = [];
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const record = (kind, space, address, value) => {
    const event = Object.freeze({ kind, space, phase, address, value, bytes: 2 });
    operations.push(event);
    if (space === 'io') ioReads.push(event);
    return value;
  };
  const read = (offset, supplied) => {
    tick();
    const address = base + offset;
    if (bank === WRAM_BANK || bank === WRAM_HIGH_BANK)
      return record(
        'read',
        'data',
        address,
        view.read(address) | (view.read(address + 1) << BYTE_BITS),
      );
    if (bank & BANK_WITHOUT_IO)
      throw { renderBoundary: true, reason: 'render_address_required', address };
    if (ioMode !== 'record-requests')
      throw { renderBoundary: true, reason: 'render_io_context_required', address };
    if (supplied === null)
      throw { renderBoundary: true, reason: 'render_io_read_required', address };
    return record('read', 'io', address, supplied);
  };
  try {
    let poll;
    do {
      poll = read(HVBJOY, ioRead4212?.[polls] ?? null);
      polls++;
    } while (poll & 1);
    phase = 'capture';
    const a = read(STDCNTRL1L, ioRead4218);
    phase = 'store';
    tick();
    view.write(base + PAD_HELD, a & BYTE_MASK);
    view.write(base + PAD_HELD_HIGH, a >>> BYTE_BITS);
    record('write', 'data', base + PAD_HELD, a);
    const finalStatus =
      (status & ~STATUS_NZ) | (a === 0 ? FLAG_ZERO : 0) | (a & WORD_SIGN ? FLAG_NEGATIVE : 0);
    return {
      handled: true,
      outcome: 'input_prepared',
      a,
      x,
      y,
      bank,
      status: finalStatus,
      carry: finalStatus & 1,
      overflow: (finalStatus >>> OVERFLOW_FLAG_SHIFT) & 1,
      polls,
      work: budget.work,
      operations: Object.freeze(operations),
      ioReads: Object.freeze(ioReads),
      ioWrites: Object.freeze([]),
    };
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase };
  }
}
