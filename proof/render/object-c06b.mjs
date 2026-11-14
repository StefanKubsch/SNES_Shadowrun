import {
  WRAM_BASE,
  WRAM_BANK,
  WRAM_HIGH_BANK,
  BANK_WITHOUT_IO,
} from '../../src/constants/memory-map.mjs';
import { BANK_SIZE, BYTE_BITS, BYTE_MASK } from '../../src/constants/bits.mjs';
import {
  GLOVE_LIMIT_KIND,
  GLOVE_SCREEN_X,
  GLOVE_KIND,
  GLOVE_SCREEN_Y,
} from '../../src/task/wram.mjs';
import {
  A1T0L,
  A1B0,
  BBAD0,
  VMAINC,
  DMAP0,
  VMADDL,
  DAS0L,
  MDMAEN,
  OAMADDL,
  OAMDATA,
} from '../../src/constants/hardware-registers.mjs';
import { isWord } from '../script/runtime.mjs';
import { FLAG_NEGATIVE } from '../../src/constants/cpu-flags.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';

const DEFAULT_MAX_WORK = 1000000;
const SPELL_GLOVE = 0xfffd;
const WEAPON_GLOVE = 0xfffe;
const WEAPON_TILES_OFFSET = 0xfb78;
const SPELL_TILES_OFFSET = 0xfc78;
const ACTION_TILES_OFFSET = 0xfbf8;
const GLOVE_TILES_BANK = 0x8d;
const VRAM_DATA_PORT = 0x18;
const VRAM_INCREMENT_AFTER_HIGH = 0x80;
const TILE_TRANSFER_BYTES = 0x40;
const SECOND_TILE_VRAM_WORD = 0x100;
const HIDDEN_GLOVE_Y = 0xf0;
const GLOVE_OAM_ATTRIBUTES = 0x30;
const STATUS_NZC = 131;
const OVERFLOW_FLAG_SHIFT = 6;

// ROM-derived manual request plan; channel advance and OAM writes remain
// ordered metadata in system banks. No device or frame execution.
export function prepareRenderC06B({
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
    throw Error('Invalid render object context');
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
    return view.finish(renderC06B(view, { bank, status, y, ioMode }, { work: 0, maxWork }));
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Inner operation shares the outer owner's byte overlay and work budget.
// Only the outer owner can finish and commit this result.
export function renderC06B(view, { bank, status, y = null, ioMode = null }, budget) {
  let phase = 'gate',
    gate,
    sourceOffset = null,
    x;
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
  const read = (offset, bytes = 2) => {
    tick();
    const address = base + offset;
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
  try {
    gate = read(GLOVE_LIMIT_KIND);
    const carry = gate === 0 ? status & 1 : Number(gate >= SPELL_GLOVE);
    if (gate !== 0) {
      phase = 'transfer';
      sourceOffset =
        gate === WEAPON_GLOVE
          ? WEAPON_TILES_OFFSET
          : gate === SPELL_GLOVE
            ? SPELL_TILES_OFFSET
            : ACTION_TILES_OFFSET;
      register(A1T0L, sourceOffset);
      register(A1B0, GLOVE_TILES_BANK, 1);
      register(BBAD0, VRAM_DATA_PORT, 1);
      register(VMAINC, VRAM_INCREMENT_AFTER_HIGH, 1);
      register(DMAP0, 1, 1);
      register(VMADDL, 0);
      register(DAS0L, TILE_TRANSFER_BYTES);
      register(MDMAEN, 1, 1);
      register(VMADDL, SECOND_TILE_VRAM_WORD);
      register(DAS0L, TILE_TRANSFER_BYTES);
      register(MDMAEN, 1, 1);
      phase = 'clear';
      write(GLOVE_LIMIT_KIND, 0);
    }
    phase = 'oam';
    register(OAMADDL, 0);
    register(OAMDATA, read(GLOVE_SCREEN_X, 1), 1);
    x = read(GLOVE_KIND);
    if (x === 0) register(OAMDATA, HIDDEN_GLOVE_Y, 1);
    else {
      register(OAMDATA, read(GLOVE_SCREEN_Y, 1), 1);
      register(OAMDATA, 0, 1);
      register(OAMDATA, GLOVE_OAM_ATTRIBUTES, 1);
    }
    const finalStatus = (status & ~STATUS_NZC) | carry | (x === 0 ? FLAG_NEGATIVE : 0);
    return {
      handled: true,
      outcome: gate === 0 ? 'oam_prepared' : 'transfer_oam_prepared',
      a: x === 0 ? HIDDEN_GLOVE_Y : GLOVE_OAM_ATTRIBUTES,
      x,
      y,
      bank,
      status: finalStatus,
      carry,
      overflow: (finalStatus >>> OVERFLOW_FLAG_SHIFT) & 1,
      gate,
      sourceOffset,
      work: budget.work,
      operations: Object.freeze(operations),
      ioWrites: Object.freeze(ioWrites),
    };
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase };
  }
}
