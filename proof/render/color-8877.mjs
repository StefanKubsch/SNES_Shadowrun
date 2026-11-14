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
  BYTE_SIGN,
  WORD_MASK,
  HIGH_BYTE_MASK,
} from '../../src/constants/bits.mjs';
import { COLOUR_REQUEST, COLOUR_PHASE } from '../../src/task/wram.mjs';
import { COLDATA, CGADSUB } from '../../src/constants/hardware-registers.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';

const DEFAULT_MAX_WORK = 1000000;
const COLOUR_STACK_BYTES = 3;
const STATUS_NZ = 0x82;
const OVERFLOW_FLAG_SHIFT = 6;
const RESET_REQUEST_MASK = 0x7ffc;
const ALL_COLOUR_COMPONENTS = 0xe0;
const FLASH_COLOUR = 0xe5;
const FLASH_MATH = 0xe3;
const SLOW_RAMP_MASK = 4;
const FAST_PHASE_STEP = 0x40;
const OVERFLOW_BIT = 64;
const SLOW_PHASE_STEP = 0x10;
const STATUS_CV = 0x41;
const PHASE_MASK = 511;
const RAMP_TABLE = 0xd3d1;
const FAST_RAMP_SHIFT = 3;
const SLOW_RAMP_SHIFT = 4;
const RED_COMPONENT = 0x20;
const GREEN_BLUE_COMPONENTS = 0xc0;
const RAMP_MATH = 0x23;
const FAST_RAMP_STOP = 0x180;

// Manual data/request plan, derived from full local8877 source. This call
// is not an elapsed frame; no PPU registers, interrupts or clocks execute.
export function prepareRender8877({
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
    throw Error('Invalid render color context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    COLOUR_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  try {
    return view.finish(render8877(view, { bank, status, x, y, ioMode }, { work: 0, maxWork }));
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Only the outer owner may finish/commit this shared view.
export function render8877(view, { bank, status, x = null, y = null, ioMode = null }, budget) {
  let phase = 'gate',
    gate,
    phaseWord = null,
    tableByte = null;
  let outX = x,
    flags = status;
  const base = bank * BANK_SIZE,
    operations = [],
    ioWrites = [];
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const record = (kind, space, offset, value, bytes) => {
    const event = Object.freeze({ kind, space, phase, address: base + offset, value, bytes });
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
      offset,
      view.read(address) | (bytes === 2 ? view.read(address + 1) << BYTE_BITS : 0),
      bytes,
    );
  };
  const write = (offset, value, bytes = 2) => {
    tick();
    view.write(base + offset, value & BYTE_MASK);
    if (bytes === 2) view.write(base + offset + 1, value >>> BYTE_BITS);
    record('write', 'data', offset, value, bytes);
  };
  const register = (offset, value) => {
    if (bank === WRAM_BANK || bank === WRAM_HIGH_BANK) write(offset, value, 1);
    else if (!(bank & BANK_WITHOUT_IO)) {
      tick();
      if (ioMode !== 'record-requests')
        throw {
          renderBoundary: true,
          reason: 'render_io_context_required',
          address: base + offset,
        };
      record('write', 'io', offset, value, 1);
    } else
      throw { renderBoundary: true, reason: 'render_address_required', address: base + offset };
  };
  const nz = (value, sign = WORD_SIGN) => {
    flags = (flags & ~STATUS_NZ) | (value === 0 ? 2 : 0) | (value & sign ? BYTE_SIGN : 0);
  };
  const result = (outcome, a) => ({
    handled: true,
    outcome,
    a,
    x: outX,
    y,
    bank,
    status: flags,
    carry: flags & 1,
    overflow: (flags >>> OVERFLOW_FLAG_SHIFT) & 1,
    gate,
    phaseWord,
    tableByte,
    work: budget.work,
    operations: Object.freeze(operations),
    ioWrites: Object.freeze(ioWrites),
  });
  const clear = (mask) => {
    phase = 'flag_clear';
    const fresh = read(COLOUR_REQUEST);
    flags = (flags & ~2) | (fresh & mask ? 0 : 2);
    write(COLOUR_REQUEST, fresh & (WORD_MASK ^ mask));
  };
  try {
    gate = read(COLOUR_REQUEST);
    nz(gate);
    if (gate & WORD_SIGN) {
      phase = 'reset';
      const masked = gate & RESET_REQUEST_MASK;
      write(COLOUR_REQUEST, masked);
      register(COLDATA, ALL_COLOUR_COMPONENTS);
      register(CGADSUB, 0);
      nz(ALL_COLOUR_COMPONENTS, BYTE_SIGN);
      return result('reset_prepared', (masked & HIGH_BYTE_MASK) | ALL_COLOUR_COMPONENTS);
    }
    if (gate === 0) return result('gate_zero', 0);
    if (gate & 1) {
      phase = 'one_shot';
      register(COLDATA, FLASH_COLOUR);
      register(CGADSUB, FLASH_MATH);
      nz(1);
      clear(1);
      return result('one_shot_prepared', 1);
    }
    const mask = gate & 2 ? 2 : gate & SLOW_RAMP_MASK ? SLOW_RAMP_MASK : 0;
    if (!mask) {
      flags = (flags & ~2) | 2;
      return result('no_active_mask', gate);
    }
    phase = mask === 2 ? 'ramp2' : 'ramp4';
    const old = read(COLOUR_PHASE),
      increment = mask === 2 ? FAST_PHASE_STEP : SLOW_PHASE_STEP,
      sum = old + increment;
    const wrapped = sum & WORD_MASK;
    flags =
      (flags & ~STATUS_CV) |
      (sum > WORD_MASK ? 1 : 0) |
      (~(old ^ increment) & (old ^ wrapped) & WORD_SIGN ? OVERFLOW_BIT : 0);
    phaseWord = wrapped & PHASE_MASK;
    write(COLOUR_PHASE, phaseWord);
    outX = phaseWord;
    tableByte = read(RAMP_TABLE + outX, 1);
    const shifts = mask === 2 ? FAST_RAMP_SHIFT : SLOW_RAMP_SHIFT,
      shifted = tableByte >>> shifts;
    flags = (flags & ~1) | ((tableByte >>> (shifts - 1)) & 1);
    let low = shifted;
    if (shifted !== 0) {
      low--;
      flags = (flags & ~STATUS_CV) | 1;
    } // Positive BYTE-SBC1 has C1/V0.
    register(COLDATA, low | (mask === 2 ? ALL_COLOUR_COMPONENTS : RED_COMPONENT));
    if (mask === SLOW_RAMP_MASK) register(COLDATA, GREEN_BLUE_COMPONENTS);
    register(CGADSUB, RAMP_MATH);
    if (mask === 2) {
      phase = 'phase_compare';
      const fresh = read(COLOUR_PHASE),
        difference = (fresh - FAST_RAMP_STOP) & WORD_MASK;
      nz(difference);
      flags = (flags & ~1) | (fresh >= FAST_RAMP_STOP ? 1 : 0);
      if (fresh === FAST_RAMP_STOP) {
        nz(2);
        clear(2);
        return result('ramp2_stopped', 2);
      }
      return result('ramp2_prepared', fresh);
    }
    phase = 'gate_reload';
    const fresh = read(COLOUR_REQUEST);
    nz(fresh);
    return result('ramp4_prepared', fresh);
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase };
  }
}
