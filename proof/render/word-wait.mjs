import {
  BYTE_MASK,
  BYTE_BITS,
  WORD_MASK,
  LONG_MASK,
  BANK_SIZE,
} from '../../src/constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';

const STATUS_NZ = FLAG_NEGATIVE | FLAG_ZERO;
const OVERFLOW_FLAG_SHIFT = 6;
// Shared data access for the source-verified WORD counter waits. An external
// observation changes the same overlay as native stores; no clock is advanced.
export function wordWaitAccess(view, budget, operations, phase) {
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const raw = (address) => view.read(address) | (view.read((address + 1) & LONG_MASK) << BYTE_BITS);
  const record = (kind, space, address, value) => {
    operations.push(Object.freeze({ kind, space, phase, address, value, bytes: 2 }));
    return value;
  };
  const store = (address, value) => {
    view.write(address, value & BYTE_MASK);
    view.write((address + 1) & LONG_MASK, value >>> BYTE_BITS);
  };
  return {
    read(address) {
      tick();
      return record('read', 'data', address, raw(address));
    },
    write(address, value) {
      tick();
      value &= WORD_MASK;
      store(address, value);
      record('write', 'data', address, value);
    },
    poll(address, sample) {
      const current = raw(address);
      if (sample !== undefined && sample !== current) {
        tick();
        store(address, sample);
        record('write', 'external', address, sample);
      }
      tick();
      return record('read', 'data', address, raw(address));
    },
  };
}

// The two wrappers select their literal source offset and transcript. This
// shared algorithm represents only LDA WORD / BNE / RTL, with intact entry.
export function renderWordWait(
  view,
  { bank, status, x = null, y = null, waitMode = null },
  budget,
  offset,
  samples,
) {
  const address = bank * BANK_SIZE + offset,
    operations = [],
    io = wordWaitAccess(view, budget, operations, 'wait');
  let polls = 0,
    a;
  try {
    do {
      if (samples !== null) {
        if (waitMode !== 'record-observations')
          throw { renderBoundary: true, reason: 'render_wait_context_required', address };
        if (polls >= samples.length)
          throw { renderBoundary: true, reason: 'render_wait_read_required', address };
      }
      a = io.poll(address, samples?.[polls]);
      polls++;
    } while (a !== 0);
    const flags = (status & ~STATUS_NZ) | FLAG_ZERO;
    return {
      handled: true,
      outcome: 'wait_clear_observed',
      a,
      x,
      y,
      bank,
      status: flags,
      carry: flags & 1,
      overflow: (flags >>> OVERFLOW_FLAG_SHIFT) & 1,
      polls,
      work: budget.work,
      operations: Object.freeze(operations),
      ioWrites: Object.freeze([]),
    };
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase: 'wait', polls };
  }
}
