import {
  LONG_MASK,
  BYTE_BITS,
  WORD_MASK,
  BYTE_MASK,
  WORD_SIGN,
  BYTE_SIGN,
} from '../../src/constants/bits.mjs';
import {
  FLAG_NEGATIVE,
  FLAG_OVERFLOW,
  FLAG_ZERO,
  FLAG_CARRY,
} from '../../src/constants/cpu-flags.mjs';

const STATUS_NZ = FLAG_NEGATIVE | FLAG_ZERO;
const STATUS_CV = FLAG_CARRY | FLAG_OVERFLOW;
const OVERFLOW_FLAG_SHIFT = 6;
// Ordered data access for the fixed text helper algorithms. This is a manual
// request ledger; it does not compute hardware results or execute instructions.
export function textHelperAccess(view, budget, operations, phase) {
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const record = (kind, space, address, value, bytes) => {
    operations.push(Object.freeze({ kind, space, phase, address, value, bytes }));
    return value;
  };
  return {
    read(address, bytes = 2) {
      tick();
      return record(
        'read',
        'data',
        address,
        view.read(address) | (bytes === 2 ? view.read((address + 1) & LONG_MASK) << BYTE_BITS : 0),
        bytes,
      );
    },
    write(address, value, bytes = 2) {
      tick();
      value &= bytes === 2 ? WORD_MASK : BYTE_MASK;
      view.write(address, value & BYTE_MASK);
      if (bytes === 2) view.write((address + 1) & LONG_MASK, value >>> BYTE_BITS);
      record('write', 'data', address, value, bytes);
    },
    request(kind, address, value, bytes, mode) {
      tick();
      if (mode !== 'record-requests')
        throw { renderBoundary: true, reason: 'render_io_context_required', address };
      if (kind === 'read' && value === undefined)
        throw { renderBoundary: true, reason: 'render_io_read_required', address };
      return record(kind, 'io', address, value, bytes);
    },
  };
}

export const textNZ = (status, value, bytes = 2) =>
  (status & ~STATUS_NZ) |
  (value === 0 ? 2 : 0) |
  (value & (bytes === 2 ? WORD_SIGN : BYTE_SIGN) ? FLAG_NEGATIVE : 0);
export const textArithmeticFlags = (status, left, right, value, carry, subtract = false) =>
  textNZ(
    (status & ~STATUS_CV) |
      (carry ? 1 : 0) |
      ((subtract ? left ^ right : ~(left ^ right)) & (left ^ value) & WORD_SIGN
        ? FLAG_OVERFLOW
        : 0),
    value,
  );
export function textHelperResult(context, budget, operations, fields) {
  const requests = operations.filter((event) => event.space === 'io');
  return {
    handled: true,
    ...context,
    ...fields,
    carry: context.status & 1,
    overflow: (context.status >>> OVERFLOW_FLAG_SHIFT) & 1,
    work: budget.work,
    operations: Object.freeze(operations),
    ioRequests: Object.freeze(requests),
    ioWrites: Object.freeze(requests.filter((event) => event.kind === 'write')),
  };
}
