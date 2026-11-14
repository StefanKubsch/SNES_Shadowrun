import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import {
  WRAM_BASE,
  WRAM_BANK,
  WRAM_HIGH_BANK,
  BANK_WITHOUT_IO,
} from '../../src/constants/memory-map.mjs';
import { BANK_SIZE, BYTE_BITS, BYTE_MASK, WORD_SIGN } from '../../src/constants/bits.mjs';
import {
  MAP_UPLOAD_HELD,
  NMI_JOB_LISTS,
  MAP_COLUMN_UPLOAD,
  MAP_COLUMN_BG1,
  MAP_LINE_BYTES,
  MAP_COLUMN_VRAM_BG1,
  MAP_COLUMN_BG2,
  MAP_COLUMN_VRAM_BG2,
  MAP_ROW_UPLOAD,
  MAP_ROW_BG1,
  MAP_ROW_VRAM_BG1,
  MAP_ROW_BG2,
  MAP_ROW_VRAM_BG2,
  CAMERA_X,
  CAMERA_Y,
} from '../../src/task/wram.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO, FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';
import {
  A1T3L,
  DAS3L,
  VMADDL,
  VMAINC,
  MDMAEN,
  BG1HOFS,
  BG2HOFS,
  BG1VOFS,
  BG2VOFS,
} from '../../src/constants/hardware-registers.mjs';

const DEFAULT_MAX_WORK = 1000000;
const PRETRANSFER_STACK_BYTES = 3;
const OVERFLOW_FLAG_SHIFT = 6;
const STATUS_NZ = FLAG_NEGATIVE | FLAG_ZERO;
const STATUS_NZC = STATUS_NZ | FLAG_CARRY;
// Literal request bytes of 8949; no device operation is executed here.
const COLUMN_VRAM_INCREMENT = 0x81;
const ROW_VRAM_INCREMENT = 0x80;
const MAP_DMA_CHANNEL_MASK = 8;

// Full local 8949 request plan. Reached stores are metadata in I/O banks,
// actual owned bytes in 7E/7F. No channel/device or scroll latch executes.
export function prepareRender8949({
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
    throw Error('Invalid render pretransfer context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    PRETRANSFER_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  try {
    return view.finish(render8949(view, { bank, status, x, y, ioMode }, { work: 0, maxWork }));
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Shared-view algorithm for a future callback owner. Only the outer
// finished plan may commit; missing later parameters roll back all clears.
export function render8949(view, { bank, status, x = null, y = null, ioMode = null }, budget) {
  let phase = 'gates';
  const operations = [],
    ioWrites = [];
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const record = (kind, space, offset, value, bytes) => {
    const event = Object.freeze({
      kind,
      space,
      phase,
      address: bank * BANK_SIZE + offset,
      value,
      bytes,
    });
    operations.push(event);
    if (space === 'io') ioWrites.push(event);
    return value;
  };
  const read = (offset) => {
    tick();
    const address = bank * BANK_SIZE + offset;
    return record(
      'read',
      'data',
      offset,
      view.read(address) | (view.read(address + 1) << BYTE_BITS),
      2,
    );
  };
  const write = (offset, value, bytes = 2) => {
    tick();
    const address = bank * BANK_SIZE + offset;
    view.write(address, value & BYTE_MASK);
    if (bytes === 2) view.write(address + 1, value >>> BYTE_BITS);
    record('write', 'data', offset, value, bytes);
  };
  const register = (offset, value, bytes = 2) => {
    if (bank === WRAM_BANK || bank === WRAM_HIGH_BANK) write(offset, value, bytes);
    else if (!(bank & BANK_WITHOUT_IO)) {
      tick();
      const address = bank * BANK_SIZE + offset;
      if (ioMode !== 'record-requests')
        throw { renderBoundary: true, reason: 'render_io_context_required', address };
      record('write', 'io', offset, value, bytes);
    } else
      throw {
        renderBoundary: true,
        reason: 'render_address_required',
        address: bank * BANK_SIZE + offset,
      };
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
    work: budget.work,
    operations: Object.freeze(operations),
    ioWrites: Object.freeze(ioWrites),
  });
  try {
    const firstGate = read(MAP_UPLOAD_HELD);
    if (firstGate !== 0)
      return result(
        'gate_0CD8_nonzero',
        firstGate,
        (status & ~STATUS_NZ) | (firstGate & WORD_SIGN ? FLAG_NEGATIVE : 0),
      );
    if (read(NMI_JOB_LISTS) === 0) return result('gate_1562_zero', 0, (status & ~STATUS_NZ) | 2);
    phase = '0CD0';
    if (read(MAP_COLUMN_UPLOAD) !== 0) {
      register(A1T3L, MAP_COLUMN_BG1);
      register(DAS3L, MAP_LINE_BYTES);
      register(VMADDL, read(MAP_COLUMN_VRAM_BG1));
      register(VMAINC, COLUMN_VRAM_INCREMENT, 1);
      register(MDMAEN, MAP_DMA_CHANNEL_MASK, 1);
      register(A1T3L, MAP_COLUMN_BG2);
      register(DAS3L, MAP_LINE_BYTES);
      register(VMADDL, read(MAP_COLUMN_VRAM_BG2));
      // The second sequence reuses 2115 without another write.
      register(MDMAEN, MAP_DMA_CHANNEL_MASK, 1);
      write(MAP_COLUMN_UPLOAD, 0);
    }
    phase = '0CD6';
    if (read(MAP_ROW_UPLOAD) !== 0) {
      register(A1T3L, MAP_ROW_BG1);
      register(DAS3L, MAP_LINE_BYTES);
      register(VMADDL, read(MAP_ROW_VRAM_BG1));
      register(VMAINC, ROW_VRAM_INCREMENT, 1);
      register(MDMAEN, MAP_DMA_CHANNEL_MASK, 1);
      register(A1T3L, MAP_ROW_BG2);
      register(DAS3L, MAP_LINE_BYTES);
      register(VMADDL, read(MAP_ROW_VRAM_BG2));
      register(MDMAEN, MAP_DMA_CHANNEL_MASK, 1);
      write(MAP_ROW_UPLOAD, 0);
    }
    phase = 'scroll_0CC4';
    const horizontal = read(CAMERA_X) >>> 2;
    for (const offset of [BG1HOFS, BG2HOFS]) {
      register(offset, horizontal & BYTE_MASK, 1);
      register(offset, 0, 1);
    }
    phase = 'scroll_0CC6';
    const verticalSource = read(CAMERA_Y),
      vertical = verticalSource >>> 2;
    for (const offset of [BG1VOFS, BG2VOFS]) {
      register(offset, vertical & BYTE_MASK, 1);
      register(offset, 0, 1);
    }
    // The last WORD LSR sets C from source bit 1, N = 0, Z from the full
    // WORD result. BYTE stores/SEP/REP/STZ never recalculate N/Z from lowA.
    return result(
      'requests_prepared',
      vertical,
      (status & ~STATUS_NZC) | ((verticalSource >>> 1) & 1) | (vertical === 0 ? 2 : 0),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase };
  }
}
