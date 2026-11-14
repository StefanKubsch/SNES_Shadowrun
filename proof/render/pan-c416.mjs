import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import {
  BYTE_MASK,
  BANK_SIZE,
  LONG_MASK,
  WORD_MASK,
  BYTE_BITS,
} from '../../src/constants/bits.mjs';
import {
  WRAM_BASE,
  WRAM_BANK,
  WRAM_HIGH_BANK,
  BANK_WITHOUT_IO,
} from '../../src/constants/memory-map.mjs';
import { RDMPYH, WRMPYA, WRMPYB } from '../../src/constants/hardware-registers.mjs';
import { FLAG_NEGATIVE, FLAG_MEMORY_8BIT } from '../../src/constants/cpu-flags.mjs';
import { OBJECT_Y, OBJECT_X, CAMERA_X } from '../../src/task/wram.mjs';

const DEFAULT_MAX_WORK = 1000000;
const PAN_STACK_BYTES = 3;
// Original neutral pan, position addend and seven-bit complementary multiplier.
const PAN_CENTER = 128;
const POSITION_BIAS = 0x600;
const PAN_COMPLEMENT_MASK = 127;

import {
  textHelperAccess,
  textHelperResult,
  textNZ,
  textArithmeticFlags,
} from './text-helper-access.mjs';

export function prepareRenderC416({
  data,
  bank = null,
  status = null,
  a = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
  ioMode = null,
  ioRead4217 = null,
} = {}) {
  if (
    [a, y].some((v) => v !== null && !isWord(v)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (ioRead4217 !== null &&
      (!Array.isArray(ioRead4217) ||
        !Array.from(ioRead4217).every((v) => Number.isInteger(v) && v >= 0 && v <= BYTE_MASK)))
  )
    throw Error('Invalid render C416 context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    PAN_STACK_BYTES,
  );
  if (entry) return entry;
  if (a === null || y === null) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => WRAM_BASE + v),
  );
  try {
    return view.finish(
      renderC416(view, { bank, status, a, y, ioMode, ioRead4217 }, { work: 0, maxWork }),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Original source-specific position/pan parameter calculation and request
// ledger. Both BYTE 4217 results remain actual observations; NOPs imply no clock.
export function renderC416(view, context, budget) {
  const operations = [],
    byteOperations = [];
  const shared = {
    read(address) {
      const value = view.read(address);
      byteOperations.push(Object.freeze({ kind: 'read', address, value, bytes: 1 }));
      return value;
    },
    write(address, value) {
      view.write(address, value);
      byteOperations.push(Object.freeze({ kind: 'write', address, value, bytes: 1 }));
    },
  };
  const io = textHelperAccess(shared, budget, operations, 'panC416');
  const counts = context.observations ?? {};
  counts.panResultReads ??= 0;
  const r = { a: context.a, x: 0, y: context.y, bank: context.bank, status: context.status };
  const absolute = (offset) => (context.bank * BANK_SIZE + offset) & LONG_MASK;
  const physical = context.bank === WRAM_BANK || context.bank === WRAM_HIGH_BANK;
  const register = (kind, offset, value, bytes) => {
    if (physical)
      return kind === 'read'
        ? io.read(absolute(offset), bytes)
        : io.write(absolute(offset), value, bytes);
    if (context.bank & BANK_WITHOUT_IO)
      throw { renderBoundary: true, reason: 'render_address_required', address: absolute(offset) };
    return io.request(kind, absolute(offset), value, bytes, context.ioMode);
  };
  const result = () => {
    const value = register('read', RDMPYH, context.ioRead4217?.[counts.panResultReads], 1);
    if (!physical) counts.panResultReads++;
    return value;
  };
  const load = (value, bytes = 2) => {
    const mask = bytes === 1 ? BYTE_MASK : WORD_MASK;
    r.a = (r.a & ~mask) | (value & mask);
    r.status = textNZ(r.status, r.a & mask, bytes);
  };
  const arithmetic = (right, subtract) => {
    const left = r.a,
      carry = r.status & 1;
    const sum = subtract ? left - right - (1 - carry) : left + right + carry;
    r.a = sum & WORD_MASK;
    r.status = textArithmeticFlags(
      r.status,
      left,
      right,
      r.a,
      subtract ? sum >= 0 : sum > WORD_MASK,
      subtract,
    );
  };
  const shift = (bytes) => {
    const value = r.a & (bytes === 1 ? BYTE_MASK : WORD_MASK);
    r.status = (r.status & ~1) | (value & 1);
    load(value >>> 1, bytes);
  };
  const operand = r.a;
  register('write', WRMPYA, operand, 2);
  load(PAN_CENTER);
  r.x = io.read(0);
  r.status = textNZ(r.status, r.x);
  const positionUsed = !(r.status & FLAG_NEGATIVE);
  let signedClamp = false,
    borrowClamp = false,
    upperClamp = false;
  if (positionUsed) {
    load(io.read(absolute(OBJECT_Y + r.x)));
    r.status |= 1;
    arithmetic(io.read(absolute(OBJECT_X + r.x)), true);
    r.status &= ~1;
    arithmetic(POSITION_BIAS, false);
    if (r.status & FLAG_NEGATIVE) {
      signedClamp = true;
      load(0);
    }
    r.status |= 1;
    arithmetic(io.read(absolute(CAMERA_X)), true);
    if (!(r.status & 1)) {
      borrowClamp = true;
      load(0);
    } else {
      shift(2);
      shift(2);
      r.status = textNZ((r.status & ~1) | Number(r.a >= BYTE_MASK), (r.a - BYTE_MASK) & WORD_MASK);
      if (r.status & 1) {
        upperClamp = true;
        load(BYTE_MASK);
      }
    }
  }
  const pan = r.a;
  r.status |= FLAG_MEMORY_8BIT;
  shift(1);
  const multiplier = r.a & BYTE_MASK;
  register('write', WRMPYB, multiplier, 1);
  load(multiplier ^ PAN_COMPLEMENT_MASK, 1);
  const complement = r.a & BYTE_MASK;
  const first = result();
  load(first, 1);
  r.a = (r.a >>> BYTE_BITS) | ((r.a & BYTE_MASK) << BYTE_BITS);
  r.status = textNZ(r.status, r.a & BYTE_MASK, 1); // Original XBA.
  load(complement, 1);
  register('write', WRMPYB, r.a & BYTE_MASK, 1);
  const second = result();
  load(second, 1);
  r.status &= ~FLAG_MEMORY_8BIT;
  r.x = r.a;
  r.status = textNZ(r.status, r.x);
  return textHelperResult(r, budget, operations, {
    outcome: 'pan_parameters_prepared',
    operand,
    positionUsed,
    signedClamp,
    borrowClamp,
    upperClamp,
    pan,
    multiplier,
    complement,
    first,
    second,
    panResultReads: counts.panResultReads,
    outputBytes: budget.outputBytes ?? 0,
    byteAccesses: byteOperations.length,
    byteOperations: Object.freeze(byteOperations),
  });
}
