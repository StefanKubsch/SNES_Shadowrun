import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import {
  LONG_MASK,
  BYTE_BITS,
  WORD_MASK,
  BYTE_MASK,
  BANK_SIZE,
  WORD_SIGN,
  WORD_BITS,
  HIGH_BYTE_MASK,
} from '../../src/constants/bits.mjs';
import {
  TEXT_BITS_REMAINING,
  TEXT_SOURCE_POINTER,
  TEXT_SOURCE_BANK,
  TEXT_BIT_BUFFER,
  TEXT_SOURCE_BANK_WORD,
  TEXT_WORK_WORD,
  TEXT_CHARACTER_INDEX,
} from '../../src/task/wram.mjs';
import {
  FLAG_NEGATIVE,
  FLAG_MEMORY_8BIT,
  FLAG_OVERFLOW,
  FLAG_ZERO,
  FLAG_CARRY,
} from '../../src/constants/cpu-flags.mjs';
import {
  TEXT_POINTER_BANK_SEED,
  HUFFMAN_TEXT_END,
  HUFFMAN_CHARACTER_PAIR_MASK,
} from '../../src/task/native-text-compose.mjs';

const DEFAULT_MAX_WORK = 1000000;
const BIT_READER_STACK_BYTES = 5;
const WIDTH_STACK_BYTES = 7;
const TEXT_REFILL_LAST_BIT = 15;
const OVERFLOW_FLAG_SHIFT = 6;
const STATUS_NZ = FLAG_NEGATIVE | FLAG_ZERO;
const STATUS_NZC = STATUS_NZ | FLAG_CARRY;
const STATUS_NVZC = STATUS_NZC | FLAG_OVERFLOW;

function prepare(context, minimumStackBytes, run, needsA = false) {
  const {
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
  } = context;
  if ([a, x, y].some((v) => v !== null && !isWord(v))) throw Error('Invalid render text context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    minimumStackBytes,
  );
  if (entry) return entry;
  if (needsA && a === null) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => WRAM_BASE + v),
  );
  try {
    return view.finish(run(view, { bank, status, a, x, y }, { work: 0, maxWork }));
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

export const prepareRenderAF04 = (context = {}) =>
  prepare(context, BIT_READER_STACK_BYTES, renderAF04, true);
export const prepareRenderFADD = (context = {}) => prepare(context, WIDTH_STACK_BYTES, renderFADD);

function access(view, budget, operations, phase) {
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const record = (kind, address, value, bytes) => {
    operations.push(Object.freeze({ kind, space: 'data', phase, address, value, bytes }));
    return value;
  };
  return {
    read(address, bytes = 2) {
      tick();
      let value = view.read(address);
      if (bytes === 2) value |= view.read((address + 1) & LONG_MASK) << BYTE_BITS;
      return record('read', address, value, bytes);
    },
    write(address, value) {
      tick();
      value &= WORD_MASK;
      view.write(address, value & BYTE_MASK);
      view.write((address + 1) & LONG_MASK, value >>> BYTE_BITS);
      record('write', address, value, 2);
    },
  };
}

// Internal calls share the caller's overlay and budget; only the outer plan commits.
export function renderAF04(view, { bank, status, a, x = null, y = null }, budget) {
  const operations = [],
    io = access(view, budget, operations, 'bit'),
    base = bank * BANK_SIZE;
  const remaining = (io.read(base + TEXT_BITS_REMAINING) - 1) & WORD_MASK;
  io.write(base + TEXT_BITS_REMAINING, remaining);
  let reloaded = false;
  if (remaining & WORD_SIGN) {
    reloaded = true;
    io.write(base + TEXT_BITS_REMAINING, TEXT_REFILL_LAST_BIT);
    const pointer = io.read(TEXT_SOURCE_POINTER) | (io.read(TEXT_SOURCE_BANK, 1) << WORD_BITS);
    const raw = io.read(pointer);
    io.write(base + TEXT_BIT_BUFFER, (raw >>> BYTE_BITS) | ((raw & BYTE_MASK) << BYTE_BITS));
    io.write(TEXT_SOURCE_POINTER, io.read(TEXT_SOURCE_POINTER) + 1);
    io.write(TEXT_SOURCE_POINTER, io.read(TEXT_SOURCE_POINTER) + 1);
  }
  const buffer = io.read(base + TEXT_BIT_BUFFER),
    shifted = (buffer << 1) & WORD_MASK;
  io.write(base + TEXT_BIT_BUFFER, shifted);
  const flags =
    (status & ~STATUS_NZC) |
    (shifted === 0 ? 2 : 0) |
    (shifted & WORD_SIGN ? FLAG_NEGATIVE : 0) |
    (buffer >>> TEXT_REFILL_LAST_BIT);
  return {
    handled: true,
    outcome: 'bit_read',
    a,
    x,
    y,
    bank,
    status: flags,
    carry: flags & 1,
    overflow: (flags >>> OVERFLOW_FLAG_SHIFT) & 1,
    reloaded,
    work: budget.work,
    operations: Object.freeze(operations),
    ioWrites: Object.freeze([]),
  };
}

export function renderFADD(view, { bank, status, y = null }, budget) {
  const operations = [],
    io = access(view, budget, operations, 'text_width');
  let a,
    x = 0,
    flags = status,
    bits = 0,
    characters = 0;
  io.write(TEXT_SOURCE_BANK_WORD, TEXT_POINTER_BANK_SEED);
  a = io.read(0);
  if (a & WORD_SIGN) io.write(TEXT_SOURCE_BANK_WORD, io.read(TEXT_SOURCE_BANK_WORD) + 1);
  a |= WORD_SIGN;
  io.write(TEXT_SOURCE_POINTER, a);
  io.write(TEXT_WORK_WORD, 0);
  io.write(bank * BANK_SIZE + TEXT_BITS_REMAINING, 0);
  const width = () => {
    // BYTE A / WORD X: TAX includes the hidden high accumulator byte.
    x = a;
    a = (a & HIGH_BYTE_MASK) | io.read((0x81ac0c + x) & LONG_MASK, 1);
    flags &= ~FLAG_MEMORY_8BIT;
    const right = io.read(TEXT_WORK_WORD),
      sum = a + right,
      value = sum & WORD_MASK;
    flags =
      (flags & ~STATUS_NVZC) |
      (sum > WORD_MASK ? 1 : 0) |
      (~(a ^ right) & (a ^ value) & WORD_SIGN ? FLAG_OVERFLOW : 0) |
      (value === 0 ? 2 : 0) |
      (value & WORD_SIGN ? FLAG_NEGATIVE : 0);
    a = value;
    io.write(TEXT_WORK_WORD, a);
    flags |= FLAG_MEMORY_8BIT;
    characters++;
  };
  const newline = () => {
    const low = a & BYTE_MASK,
      result = (low - HUFFMAN_TEXT_END) & BYTE_MASK;
    flags =
      (flags & ~STATUS_NZC) |
      (low >= HUFFMAN_TEXT_END ? 1 : 0) |
      (result === 0 ? 2 : 0) |
      (result & FLAG_NEGATIVE);
    return low === HUFFMAN_TEXT_END;
  };
  for (;;) {
    flags &= ~FLAG_MEMORY_8BIT;
    a = 0;
    do {
      x = a;
      const bit = renderAF04(view, { bank, status: flags, a, x, y }, budget);
      operations.push(...bit.operations);
      flags = bit.status;
      bits++;
      if (bit.carry) x = (x + 2) & WORD_MASK;
      a = io.read((0x9d8000 + x) & LONG_MASK);
    } while (!(a & WORD_SIGN));
    a &= HUFFMAN_CHARACTER_PAIR_MASK;
    io.write(TEXT_CHARACTER_INDEX, a);
    a = a >>> BYTE_BITS;
    flags |= FLAG_MEMORY_8BIT;
    if (newline()) break;
    width();
    a = (a & HIGH_BYTE_MASK) | io.read(TEXT_CHARACTER_INDEX, 1);
    if (!(a & BYTE_MASK)) continue;
    if (newline()) break;
    width();
  }
  flags &= ~FLAG_MEMORY_8BIT;
  a = io.read(TEXT_WORK_WORD);
  flags = (flags & ~STATUS_NZ) | (a === 0 ? 2 : 0) | (a & WORD_SIGN ? FLAG_NEGATIVE : 0);
  return {
    handled: true,
    outcome: 'text_width_prepared',
    a,
    x,
    y,
    bank,
    status: flags,
    carry: flags & 1,
    overflow: (flags >>> OVERFLOW_FLAG_SHIFT) & 1,
    bits,
    characters,
    work: budget.work,
    operations: Object.freeze(operations),
    ioWrites: Object.freeze([]),
  };
}
