import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderAA9C } from './aa9c.mjs';
import { renderA9E1 } from './a9e1.mjs';

// Complete local AB2C initializer, with one view/budget/commit owner.
// Requests describe reached stores only; no channel or device executes.
export function prepareRenderAB2C({
  data,
  bank = null,
  status = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = 1000000,
  maxOutputBytes = 65536,
  ioMode = null,
  divisionMode = null,
} = {}) {
  if (
    (y !== null && !isWord(y)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (divisionMode !== null && divisionMode !== 'stable-native')
  )
    throw Error('Invalid render initializer context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    24,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => 0x7e0000 + a),
  );
  const budget = { work: 0, maxWork, maxOutputBytes },
    ioWrites = [],
    operations = [];
  let phase = 'channel0_tiles';
  const tick = () => {
    if (++budget.work > maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const record = (kind, space, address, value, bytes) => {
    const event = Object.freeze({ kind, space, phase, address, value, bytes });
    operations.push(event);
    return event;
  };
  const read = (offset, bytes = 2) => {
    tick();
    const address = bank * 0x10000 + offset;
    const value = view.read(address) | (bytes === 2 ? view.read(address + 1) << 8 : 0);
    record('read', 'data', address, value, bytes);
    return value;
  };
  const writeAddress = (address, value, bytes = 2) => {
    tick();
    view.write(address, value & 255);
    if (bytes === 2) view.write(address + 1, value >>> 8);
    record('write', 'data', address, value, bytes);
  };
  const write = (offset, value, bytes = 2) => writeAddress(bank * 0x10000 + offset, value, bytes);
  const register = (offset, value, bytes = 1) => {
    const address = bank * 0x10000 + offset;
    if (bank === 0x7e || bank === 0x7f) writeAddress(address, value, bytes);
    else if (!(bank & 0x40)) {
      tick();
      if (ioMode !== 'record-requests')
        throw { renderBoundary: true, reason: 'render_io_context_required', address };
      ioWrites.push(Object.freeze({ phase, address, value, bytes }));
      record('write', 'io', address, value, bytes);
    } else throw { renderBoundary: true, reason: 'render_address_required', address };
  };
  try {
    register(0x2116, 0x5000, 2);
    register(0x4305, 0x170, 2);
    register(0x4302, 0xf160, 2);
    for (const [offset, value] of [
      [0x4304, 0x95],
      [0x4301, 0x18],
      [0x2115, 0x80],
      [0x4300, 1],
      [0x420b, 1],
    ])
      register(offset, value);
    phase = 'channel0_palette';
    register(0x4305, 0x30, 2);
    register(0x4302, 0xf140, 2);
    for (const [offset, value] of [
      [0x4304, 0x95],
      [0x2121, 0],
      [0x4301, 0x22],
      [0x4300, 0],
      [0x420b, 1],
    ])
      register(offset, value);
    phase = 'channel_setup';
    for (const [offset, value] of [
      [0x4370, 1],
      [0x4360, 9],
      [0x4350, 0x81],
      [0x4371, 0x18],
      [0x4361, 0x18],
      [0x4351, 0x39],
      [0x4374, 0x7e],
      [0x4364, 0x81],
      [0x4354, 0x7e],
      [0x2130, 2],
      [0x2131, 0x37],
    ])
      register(offset, value);
    phase = 'tables';
    write(0x1be, read(0x1be, 1) | 4, 1);
    for (let offset = 0x1e; offset >= 0; offset -= 2) write(0x226 + offset, 0);
    write(0x214, 0xffff);
    for (let offset = 6; offset >= 0; offset -= 2) writeAddress(0x7e0216 + offset, 0xffff);
    // LDA0 before JSL: N0/Z1; earlier setup never changes C/V/I.
    phase = 'loader';
    const loader = renderAA9C(
      view,
      { request: 0, bank, status: (status & ~0x82) | 2, x: 0xfffe, y, ioMode, divisionMode },
      budget,
    );
    if (!loader.handled)
      throw {
        ...loader,
        renderBoundary: true,
        phase: 'loader',
        innerPhase: loader.phase,
        helperPhase: loader.innerPhase,
      };
    ioWrites.push(...loader.ioWrites);
    phase = 'post_loader';
    write(0x212, 0x2027);
    for (const offset of [0x1f8, 0x1f6, 0x1fa, 0x1fc, 0x200, 0x202]) write(offset, 0);
    write(0x204, 0xfffe);
    const pending = (read(0x1f8) + 1) & 0xffff;
    write(0x1f8, pending);
    phase = 'initial_request';
    // LDAFFFE then INC01F8 set N/Z; C/V survive from loader. A9E1
    // overwrites A immediately and preserves X/Y from the real loader.
    const requests = renderA9E1(
      view,
      {
        bank,
        status: (loader.status & ~0x82) | (pending === 0 ? 2 : 0) | (pending & 0x8000 ? 0x80 : 0),
        x: loader.x,
        y: loader.y,
        ioMode,
      },
      budget,
    );
    ioWrites.push(
      ...requests.ioWrites.map(({ phase: innerPhase, address, value, bytes }) =>
        Object.freeze({ phase: `initial_request/${innerPhase}`, address, value, bytes }),
      ),
    );
    return view.finish({
      handled: true,
      outcome: 'initialized',
      a: requests.a,
      x: requests.x,
      y: requests.y,
      bank,
      status: requests.status,
      carry: requests.carry,
      overflow: requests.overflow,
      work: budget.work,
      loader: Object.freeze(loader),
      requests: Object.freeze(requests),
      operations: Object.freeze(operations),
      ioWrites: Object.freeze(ioWrites),
    });
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, handled, ...result } = error;
    return {
      ...result,
      handled: false,
      phase,
      ...(error.phase && error.phase !== phase ? { innerPhase: error.phase } : {}),
    };
  }
}
