import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { BYTE_MASK, BANK_SIZE, BYTE_BITS } from '../../src/constants/bits.mjs';
import {
  WRAM_BASE,
  WRAM_BANK,
  WRAM_HIGH_BANK,
  BANK_WITHOUT_IO,
} from '../../src/constants/memory-map.mjs';
import { APU_COMMAND_TOKEN } from '../../src/task/wram.mjs';
import { APUIO0, APUIO2, APUIO1 } from '../../src/constants/hardware-registers.mjs';

const DEFAULT_MAX_WORK = 1000000;
const APU_STACK_BYTES = 4;
const OVERFLOW_FLAG_SHIFT = 6;

const validSamples = (v) =>
  v === null ||
  (Array.isArray(v) && Array.from(v).every((n) => Number.isInteger(n) && n >= 0 && n <= BYTE_MASK));
export function prepareRenderF007({
  data,
  bank = null,
  status = null,
  a = null,
  x = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
  ioMode = null,
  ioRead2140 = null,
} = {}) {
  if (
    (a !== null && !isWord(a)) ||
    (x !== null && !isWord(x)) ||
    (y !== null && !isWord(y)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    !validSamples(ioRead2140)
  )
    throw Error('Invalid APU request context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    APU_STACK_BYTES,
  );
  if (entry) return entry;
  if (a === null || x === null) return { handled: false, reason: 'render_apu_context_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((n) => WRAM_BASE + n),
  );
  try {
    return view.finish(
      renderF007(view, { bank, status, a, x, y, ioMode, ioRead2140 }, { work: 0, maxWork }),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Ordered transcript only; successful planning never acknowledges a device
// or starts browser audio. Inner operation has no separate commit payload.
export function renderF007(
  view,
  { bank, status, a, x, y = null, ioMode = null, ioRead2140 = null },
  budget,
) {
  let phase = 'token',
    polls = 0;
  const base = bank * BANK_SIZE,
    operations = [],
    ioReads = [],
    ioWrites = [];
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const record = (kind, space, address, value, bytes) => {
    const event = Object.freeze({ kind, space, phase, address, value, bytes });
    operations.push(event);
    if (space === 'io') (kind === 'read' ? ioReads : ioWrites).push(event);
    return value;
  };
  const physical = bank === WRAM_BANK || bank === WRAM_HIGH_BANK;
  const ioContext = (address) => {
    if (bank & BANK_WITHOUT_IO)
      throw { renderBoundary: true, reason: 'render_address_required', address };
    if (ioMode !== 'record-requests')
      throw { renderBoundary: true, reason: 'render_io_context_required', address };
  };
  const readData = (offset) => {
    tick();
    const address = base + offset;
    return record('read', 'data', address, view.read(address), 1);
  };
  const writeData = (offset, value, bytes) => {
    tick();
    const address = base + offset;
    view.write(address, value & BYTE_MASK);
    if (bytes === 2) view.write(address + 1, value >>> BYTE_BITS);
    record('write', 'data', address, value, bytes);
  };
  const deviceWrite = (offset, value, bytes) => {
    if (physical) return writeData(offset, value, bytes);
    tick();
    const address = base + offset;
    ioContext(address);
    record('write', 'io', address, value, bytes);
  };
  try {
    const token = readData(APU_COMMAND_TOKEN);
    phase = 'poll';
    let sample;
    do {
      if (physical) sample = readData(APUIO0);
      else {
        tick();
        const address = base + APUIO0;
        ioContext(address);
        sample = ioRead2140?.[polls] ?? null;
        if (sample === null)
          throw { renderBoundary: true, reason: 'render_io_read_required', address };
        record('read', 'io', address, sample, 1);
      }
      polls++;
    } while (sample !== token);
    const nextToken = (token + 1) & BYTE_MASK,
      command = a & BYTE_MASK;
    phase = 'parameter';
    deviceWrite(APUIO2, x, 2);
    phase = 'command';
    deviceWrite(APUIO1, command, 1);
    phase = 'acknowledge';
    deviceWrite(APUIO0, nextToken, 1);
    phase = 'store';
    writeData(APU_COMMAND_TOKEN, nextToken, 1);
    return {
      handled: true,
      outcome: 'apu_requests_prepared',
      a: (command << BYTE_BITS) | nextToken,
      x,
      y,
      bank,
      status,
      carry: status & 1,
      overflow: (status >>> OVERFLOW_FLAG_SHIFT) & 1,
      token,
      nextToken,
      command,
      polls,
      work: budget.work,
      operations: Object.freeze(operations),
      ioReads: Object.freeze(ioReads),
      ioWrites: Object.freeze(ioWrites),
    };
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase };
  }
}
