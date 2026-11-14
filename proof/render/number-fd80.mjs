import { BYTE_MASK, BANK_SIZE, WORD_MASK } from '../../src/constants/bits.mjs';
import { WRAM_BASE, WRAM_BANK, BANK_WITHOUT_IO } from '../../src/constants/memory-map.mjs';
import { WRDIVL, WRDIVB, RDMPYL, RDDIVL } from '../../src/constants/hardware-registers.mjs';
import { FLAG_MEMORY_8BIT } from '../../src/constants/cpu-flags.mjs';
import { TEXT_BUFFER } from '../../src/task/wram.mjs';
const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const NUMBER_STACK_BYTES = 12;
const DECIMAL_DIGITS = 5;
const OVERFLOW_BIT = 64;
const DECIMAL_RADIX = 10;
const DIGIT_ZERO = 0x30;
const BYTE_SIGN_BIT = 128;
const STATUS_CV = 0x41;

import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderFB39 } from './text-compose.mjs';
import { renderOutputBytes } from './output-budget.mjs';
import { textHelperAccess, textHelperResult, textNZ } from './text-helper-access.mjs';

const isByte = (v) => Number.isInteger(v) && v >= 0 && v <= BYTE_MASK;
export function prepareRenderFD80({
  data,
  bank = null,
  status = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  ioMode = null,
  ioRead4214Word = null,
  ioRead4216Byte = null,
  ioRead4214 = null,
  ioRead4216 = null,
  waitMode = null,
  waitRead01FA = null,
  waitRead01FC = null,
} = {}) {
  if (
    (y !== null && !isWord(y)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (waitMode !== null && waitMode !== 'record-observations') ||
    [ioRead4214Word, ioRead4216, waitRead01FA, waitRead01FC].some(
      (v) => v !== null && (!Array.isArray(v) || !Array.from(v).every(isWord)),
    ) ||
    [ioRead4216Byte, ioRead4214].some(
      (v) => v !== null && (!Array.isArray(v) || !Array.from(v).every(isByte)),
    )
  )
    throw Error('Invalid render FD80 context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    NUMBER_STACK_BYTES,
  );
  if (entry) return entry;
  if (y === null) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => WRAM_BASE + v),
  );
  try {
    return view.finish(
      renderFD80(
        view,
        {
          bank,
          status,
          y,
          ioMode,
          ioRead4214Word,
          ioRead4216Byte,
          ioRead4214,
          ioRead4216,
          waitMode,
          waitRead01FA,
          waitRead01FC,
        },
        { work: 0, maxWork, maxOutputBytes, outputBytes: 0 },
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Fixed original number/forward-copy/text algorithm. Actual quotient and
// remainder reads are external observations, never inferred from the dividend.
// Physical WRAM DBRs use provider bytes, not MMIO observation lists.
export function renderFD80(view, context, budget) {
  budget.outputBytes ??= 0;
  const r = { a: 0, x: DECIMAL_DIGITS, y: context.y, bank: context.bank, status: context.status };
  const operations = [],
    byteOperations = [];
  const counts = context.observations ?? {};
  for (const key of [
    'numberQuotientReads',
    'numberRemainderReads',
    'quotientReads',
    'resultReads',
    'pollsFA',
    'pollsFC',
  ])
    counts[key] ??= 0;
  let phase = 'numberFD80',
    divisions = 0,
    copiedBytes = 0;
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const shared = {
    read(address) {
      tick();
      const value = view.read(address);
      byteOperations.push(Object.freeze({ kind: 'read', phase, address, value, bytes: 1 }));
      return value;
    },
    write(address, value) {
      tick();
      view.write(address, value);
      byteOperations.push(Object.freeze({ kind: 'write', phase, address, value, bytes: 1 }));
    },
  };
  const io = textHelperAccess(shared, budget, operations, phase);
  const absolute = (offset) => context.bank * BANK_SIZE + offset;
  const mmio = !(context.bank & BANK_WITHOUT_IO);
  const register = (kind, offset, value, bytes) =>
    mmio
      ? io.request(kind, absolute(offset), value, bytes, context.ioMode)
      : kind === 'read'
        ? io.read(absolute(offset), bytes)
        : io.write(absolute(offset), value, bytes);
  const load = (value, bytes = 2) => {
    const mask = bytes === 1 ? BYTE_MASK : WORD_MASK;
    r.a = (r.a & ~mask) | (value & mask);
    r.status = textNZ(r.status, r.a & mask, bytes);
  };
  const index = (name, value) => {
    r[name] = value & WORD_MASK;
    r.status = textNZ(r.status, r[name]);
  };
  const emit = (address, value, bytes = 1) => {
    renderOutputBytes(budget, bytes);
    io.write(address, value, bytes);
  };
  load(0);
  emit(WRAM_BASE + TEXT_BUFFER + DECIMAL_DIGITS, r.a, 2);
  index('x', DECIMAL_DIGITS);
  load(io.read(2));
  do {
    register('write', WRDIVL, r.a, 2);
    r.status |= FLAG_MEMORY_8BIT;
    load(DECIMAL_RADIX, 1);
    register('write', WRDIVB, r.a & BYTE_MASK, 1);
    index('x', r.x - 1);
    r.status &= ~1;
    load(DIGIT_ZERO, 1);
    const remainder = register(
      'read',
      RDMPYL,
      context.ioRead4216Byte?.[counts.numberRemainderReads],
      1,
    );
    if (mmio) counts.numberRemainderReads++;
    const sum = DIGIT_ZERO + remainder,
      character = sum & BYTE_MASK;
    r.status =
      (r.status & ~STATUS_CV) |
      Number(sum > BYTE_MASK) |
      (~(DIGIT_ZERO ^ remainder) & (DIGIT_ZERO ^ character) & BYTE_SIGN_BIT ? OVERFLOW_BIT : 0);
    load(character, 1);
    emit(WRAM_BASE + TEXT_BUFFER + r.x, r.a & BYTE_MASK);
    r.status &= ~FLAG_MEMORY_8BIT;
    load(register('read', RDDIVL, context.ioRead4214Word?.[counts.numberQuotientReads], 2));
    if (mmio) counts.numberQuotientReads++;
    divisions++;
  } while (r.a !== 0);
  const firstCharacterIndex = r.x;
  r.bank = WRAM_BANK;
  r.status = textNZ(r.status, r.bank, 1);
  r.status = textNZ((r.status & ~1) | 1, r.x); // Original CPX0, WORD.
  if (r.x !== 0) {
    index('y', 0);
    r.status |= FLAG_MEMORY_8BIT;
    for (;;) {
      // Full indices wrap separately; addresses carry into7F. Read each byte
      // after preceding stores, including the null byte's destination store.
      load(io.read(WRAM_BASE + TEXT_BUFFER + r.x, 1), 1);
      emit(WRAM_BASE + TEXT_BUFFER + r.y, r.a & BYTE_MASK);
      copiedBytes++;
      if (!(r.a & BYTE_MASK)) break;
      index('x', r.x + 1);
      index('y', r.y + 1);
    }
    r.status &= ~FLAG_MEMORY_8BIT;
  }
  const composerEntry = Object.freeze({ ...r });
  phase = 'FB39';
  const composed = renderFB39(shared, { ...context, ...r, observations: counts }, budget);
  for (const event of composed.operations) operations.push(event);
  const status = textNZ(composed.status, context.bank, 1);
  return textHelperResult(
    { a: composed.a, x: composed.x, y: composed.y, bank: context.bank, status },
    budget,
    operations,
    {
      outcome: 'number_composed',
      divisions,
      firstCharacterIndex,
      copiedBytes,
      composerEntry,
      glyphs: composed.glyphs,
      rows: composed.rows,
      newlines: composed.newlines,
      outputBytes: budget.outputBytes,
      ...counts,
      byteAccesses: byteOperations.length,
      byteOperations: Object.freeze(byteOperations),
    },
  );
}
