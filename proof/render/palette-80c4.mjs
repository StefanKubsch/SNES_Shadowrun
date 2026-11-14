import { BYTE_MASK, BYTE_BITS, BANK_SIZE } from '../../src/constants/bits.mjs';
import {
  WRAM_BASE,
  WRAM_BANK,
  WRAM_HIGH_BANK,
  BANK_WITHOUT_IO,
} from '../../src/constants/memory-map.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';
import {
  A1T0L,
  DAS0L,
  DMAP0,
  CGADD,
  A1B0,
  MDMAEN,
} from '../../src/constants/hardware-registers.mjs';
import {
  PALETTE_REQUEST_POINTER,
  PALETTE_REQUEST_SLOT,
  PALETTE_BYTES,
  PALETTE_DIRECTION,
} from '../../src/task/wram.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';

const DEFAULT_MAX_WORK = 1000000;
const MINIMUM_STACK_BYTES = 3;
const STATUS_NZ = FLAG_NEGATIVE | FLAG_ZERO;
const OVERFLOW_FLAG_SHIFT = 6;
const PALETTE_DMA_CONTROL_WORD = 0x2200;
const PALETTE_SOURCE_BANK = 0x8b;

// Complete local 80C4 data/request algorithm. No CPU, channel, palette
// latch or interrupt execution. Full X addresses retain bank carry and aliases.
export function prepareRender80C4({
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
    throw Error('Invalid render palette context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    MINIMUM_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  try {
    return view.finish(render80C4(view, { bank, status, x, y, ioMode }, { work: 0, maxWork }));
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Inner operation for an explicitly supplied larger atomic owner. Only
// its outer owner can finish/commit the common byte view and budget.
export function render80C4(view, { bank, status, x = null, y = null, ioMode = null }, budget) {
  let phase = 'gate',
    pointer = null,
    size = null,
    palette = null,
    paletteAddress = null;
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
  const result = (outcome) => ({
    handled: true,
    outcome,
    a: 0,
    x,
    y,
    bank,
    status: (status & ~STATUS_NZ) | FLAG_ZERO,
    carry: status & 1,
    overflow: (status >>> OVERFLOW_FLAG_SHIFT) & 1,
    pointer,
    size,
    palette,
    paletteAddress,
    work: budget.work,
    operations: Object.freeze(operations),
    ioWrites: Object.freeze(ioWrites),
  });
  try {
    pointer = read(base + PALETTE_REQUEST_POINTER);
    if (pointer === 0) return result('gate_1CDA_zero');
    phase = 'setup';
    register(A1T0L, pointer);
    x = read(base + PALETTE_REQUEST_SLOT);
    // Source 80D0 is absolute, not indexed: even X2 reads first size.
    size = read(base + PALETTE_BYTES);
    register(DAS0L, size);
    register(DMAP0, PALETTE_DMA_CONTROL_WORD);
    phase = 'palette';
    paletteAddress = base + PALETTE_DIRECTION + x;
    palette = read(paletteAddress, 1);
    register(CGADD, palette, 1);
    register(A1B0, PALETTE_SOURCE_BANK, 1);
    register(MDMAEN, 1, 1);
    phase = 'clear';
    write(PALETTE_REQUEST_POINTER, 0);
    // Final WORD LDA 0000 defines A/N/Z; C/V/I/Y/DBR/D remain intact.
    return result('requests_prepared');
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase };
  }
}
