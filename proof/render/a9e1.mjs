import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';

// Manual request ledger, not a transfer executor. Every reached read sees
// the shared ordered byte view; only the complete outer plan can commit.
export function prepareRenderA9E1({
  data,
  bank = null,
  status = null,
  x = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = 1000000,
  ioMode = null,
  ioRead213A = null,
} = {}) {
  if (
    (x !== null && !isWord(x)) ||
    (y !== null && !isWord(y)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (ioRead213A !== null && (!Number.isInteger(ioRead213A) || ioRead213A < 0 || ioRead213A > 255))
  )
    throw Error('Invalid render request context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    3,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => 0x7e0000 + a),
  );
  try {
    return view.finish(
      renderA9E1(view, { bank, status, x, y, ioMode, ioRead213A }, { work: 0, maxWork }),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Shared-view algorithm for a future initializer plan. No private commit
// payload, inferred I/O read value, device effect or interrupt is created.
export function renderA9E1(
  view,
  { bank, status, x = null, y = null, ioMode = null, ioRead213A = null },
  budget,
) {
  let phase = '01F6',
    a = 0;
  const operations = [],
    ioRequests = [];
  const fail = (reason, address) => {
    throw { renderBoundary: true, reason, address, phase };
  };
  const tick = () => {
    if (++budget.work > budget.maxWork) fail('render_work_budget_required');
  };
  const record = (kind, space, offset, value, bytes) => {
    const event = Object.freeze({
      kind,
      space,
      phase,
      address: bank * 0x10000 + offset,
      value,
      bytes,
    });
    operations.push(event);
    if (space === 'io') ioRequests.push(event);
    return value;
  };
  const read = (offset, bytes = 2) => {
    tick();
    const address = bank * 0x10000 + offset;
    const value = view.read(address) | (bytes === 2 ? view.read(address + 1) << 8 : 0);
    return record('read', 'data', offset, value, bytes);
  };
  const write = (offset, value, bytes = 2) => {
    tick();
    const address = bank * 0x10000 + offset;
    view.write(address, value & 255);
    if (bytes === 2) view.write(address + 1, value >>> 8);
    record('write', 'data', offset, value, bytes);
  };
  const io = (kind, offset, value, bytes) => {
    tick();
    const address = bank * 0x10000 + offset;
    if (ioMode !== 'record-requests') fail('render_io_context_required', address);
    if (kind === 'read' && value === null) fail('render_io_read_required', address);
    return record(kind, 'io', offset, value, bytes);
  };
  const storeRegister = (offset, value, bytes = 2) => {
    if (bank === 0x7e || bank === 0x7f) write(offset, value, bytes);
    else if (!(bank & 0x40)) io('write', offset, value, bytes);
    else fail('render_address_required', bank * 0x10000 + offset);
  };
  const load = (value, bytes = 2) => {
    a = bytes === 2 ? value : (a & 0xff00) | value;
    status =
      (status & ~0x82) | (value === 0 ? 2 : 0) | (value & (bytes === 2 ? 0x8000 : 0x80) ? 0x80 : 0);
    return a;
  };
  try {
    if (load(read(0x1f6)) !== 0) {
      storeRegister(0x4362, load(0xac8c));
      const size = load(read(0x20c));
      if (size >= 0x1401) {
        write(0x20c, size - 0x1400);
        load(0x1400);
      } else write(0x1f6, 0);
      storeRegister(0x4365, a);
      const destination = load(read(0x20a));
      storeRegister(0x2116, a);
      const sum = destination + 0xa00,
        next = sum & 0xffff;
      status =
        (status & ~0x41) |
        (sum > 0xffff ? 1 : 0) |
        (~(destination ^ 0xa00) & (destination ^ next) & 0x8000 ? 0x40 : 0);
      load(next);
      write(0x20a, a);
      storeRegister(0x2115, load(0x80, 1) & 255, 1);
      storeRegister(0x420b, load(0x40, 1) & 255, 1);
    }
    phase = '01F8';
    if (load(read(0x1f8)) !== 0) {
      storeRegister(0x4372, load(0x23a0));
      storeRegister(0x4375, load(0x740));
      storeRegister(0x2116, load(0x7800));
      storeRegister(0x2115, load(0x80, 1) & 255, 1);
      storeRegister(0x420b, load(0x80, 1) & 255, 1);
      write(0x1f8, 0);
    }
    phase = '01FA';
    if (load(read(0x1fa)) !== 0) {
      storeRegister(0x4372, load(0x2ae0));
      storeRegister(0x4375, load(read(0x210)));
      storeRegister(0x2116, load(read(0x20e)));
      storeRegister(0x2115, load(0x80, 1) & 255, 1);
      storeRegister(0x420b, load(0x80, 1) & 255, 1);
      write(0x1fa, 0);
    }
    phase = '01FC';
    if (load(read(0x1fc)) !== 0) {
      storeRegister(0x2116, load(read(0x20e)));
      storeRegister(0x4355, load(0x10));
      storeRegister(0x4352, load(0x2ae0));
      storeRegister(0x2115, load(0x80, 1) & 255, 1);
      load(bank === 0x7e || bank === 0x7f ? read(0x213a, 1) : io('read', 0x213a, ioRead213A, 1), 1);
      storeRegister(0x420b, load(0x20, 1) & 255, 1);
      write(0x1fc, 0);
    }
    return {
      handled: true,
      outcome: 'requests_prepared',
      a,
      x,
      y,
      bank,
      status,
      carry: status & 1,
      overflow: (status >>> 6) & 1,
      work: budget.work,
      operations: Object.freeze(operations),
      ioRequests: Object.freeze(ioRequests),
      ioWrites: Object.freeze(ioRequests.filter((r) => r.kind === 'write')),
    };
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase };
  }
}
