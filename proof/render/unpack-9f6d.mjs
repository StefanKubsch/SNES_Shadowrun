import { WRAM_BASE, WRAM_HIGH_BANK } from '../../src/constants/memory-map.mjs';
import {
  UNPACK_SOURCE_POINTER,
  UNPACK_SOURCE_BANK,
  UNPACK_BITS_REMAINING,
  UNPACK_BIT_STREAM_OFFSET,
  UNPACK_BIT_BUFFER,
  UNPACK_OUTPUT_START,
  UNPACK_OUTPUT_CURSOR,
  UNPACK_RUN_LENGTH,
  UNPACK_OUTPUT_LIMIT,
  UNPACK_LITERAL_OFFSET,
  UNPACK_OUTPUT_COUNT,
  UNPACK_LITERAL_WORDS,
  UNPACK_OUTPUT_COUNT_HIGH,
} from '../../src/task/wram.mjs';
import {
  WORD_BITS,
  LONG_MASK,
  WORD_MASK,
  WORD_SIGN,
  BYTE_BITS,
  BYTE_MASK,
  BANK_SIZE,
} from '../../src/constants/bits.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderOutputBytes } from './output-budget.mjs';
import { textHelperAccess, textHelperResult } from './text-helper-access.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const UNPACK_STACK_BYTES = 10;
const BIT_BUFFER_TOP_SHIFT = 15;
const WORD_SIGN_SHIFT = 15;
const PACKED_HEADER_BYTES = 4;
const HIGH_OFFSET_BASE = 8;

export function prepareRender9F6D({
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
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
} = {}) {
  if ([a, x, y].some((v) => v !== null && !isWord(v))) throw Error('Invalid render 9F6D context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    UNPACK_STACK_BYTES,
  );
  if (entry) return entry;
  if ([a, x, y].some((v) => v === null)) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => WRAM_BASE + v),
  );
  try {
    return view.finish(
      render9F6D(
        view,
        { bank, status, a, x, y },
        { work: 0, maxWork, outputBytes: 0, maxOutputBytes },
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Source-specific9F6D/9E65 data algorithm. No opcode dispatch or CPU/stack
// execution. All bytes share the outer caller's overlay and cumulative budget;
// only that caller can finish/commit. Entry P/DBR are opaque preserved values.
export function render9F6D(view, context, budget) {
  const operations = [];
  const inputWord = context.a,
    sourceBankWord = context.y,
    destination = context.x;
  let x = destination,
    y = 0,
    phase = 'setup';
  let bits = 0,
    literals = 0,
    references = 0,
    emittedBytes = 0,
    emittedCount;
  budget.outputBytes ??= 0;
  const access = () => textHelperAccess(view, budget, operations, phase);
  const read = (address, bytes = 2) => access().read(address, bytes);
  const store = (address, value, bytes = 2) => access().write(address, value, bytes);
  const source = (index, bytes) => {
    const pointer = read(UNPACK_SOURCE_POINTER) | (read(UNPACK_SOURCE_BANK, 1) << WORD_BITS);
    return read((pointer + index) & LONG_MASK, bytes);
  };
  const emit = (address, value, bytes) => {
    renderOutputBytes(budget, bytes);
    store(address, value, bytes);
    emittedBytes += bytes;
  };
  const bit = () => {
    bits++;
    const remaining = (read(UNPACK_BITS_REMAINING) - 1) & WORD_MASK;
    store(UNPACK_BITS_REMAINING, remaining);
    if (remaining & WORD_SIGN) {
      store(UNPACK_BITS_REMAINING, BIT_BUFFER_TOP_SHIFT);
      y = read(UNPACK_BIT_STREAM_OFFSET);
      const raw = source(y, 2);
      store(UNPACK_BIT_BUFFER, (raw >>> BYTE_BITS) | ((raw & BYTE_MASK) << BYTE_BITS));
      y = (y + 2) & WORD_MASK;
      store(UNPACK_BIT_STREAM_OFFSET, y);
    }
    const buffer = read(UNPACK_BIT_BUFFER);
    store(UNPACK_BIT_BUFFER, buffer << 1);
    return buffer >>> WORD_SIGN_SHIFT;
  };
  const length = () => {
    let value = 1;
    while (!bit()) value = ((value << 1) | bit()) & WORD_MASK;
    return value;
  };
  try {
    store(UNPACK_SOURCE_POINTER, inputWord);
    store(UNPACK_SOURCE_BANK, sourceBankWord);
    store(UNPACK_OUTPUT_START, x);
    store(UNPACK_OUTPUT_CURSOR, x);
    store(UNPACK_RUN_LENGTH, 0);
    phase = 'header';
    const header = source(0, 2);
    store(UNPACK_OUTPUT_LIMIT, header);
    y = 2;
    store(UNPACK_BIT_STREAM_OFFSET, source(y, 2) + 2);
    store(UNPACK_LITERAL_OFFSET, PACKED_HEADER_BYTES);
    store(UNPACK_OUTPUT_COUNT, 0);
    store(UNPACK_BITS_REMAINING, 0);
    let literal = true;
    for (;;) {
      if (literal) {
        phase = 'literalCode';
        literals++;
        const count = length();
        y = read(UNPACK_LITERAL_OFFSET);
        x = read(UNPACK_OUTPUT_CURSOR);
        store(UNPACK_RUN_LENGTH, count);
        store(UNPACK_LITERAL_WORDS, count >>> 1);
        phase = 'literal';
        if (count >>> 1) {
          // Real WORD reads/stores and fresh ED; original LSR odd carry is
          // protected across this loop, independently of copied data.
          let remaining;
          do {
            const value = source(y, 2);
            y = (y + 2) & WORD_MASK;
            emit(WRAM_HIGH_BANK * BANK_SIZE + x, value, 2);
            x = (x + 2) & WORD_MASK;
            remaining = (read(UNPACK_LITERAL_WORDS) - 1) & WORD_MASK;
            store(UNPACK_LITERAL_WORDS, remaining);
          } while (remaining !== 0);
        }
        if (count < 2 || count & 1) {
          const value = source(y, 1);
          y = (y + 1) & WORD_MASK;
          emit(WRAM_HIGH_BANK * BANK_SIZE + x, value, 1);
          x = (x + 1) & WORD_MASK;
        }
        phase = 'literalTail';
        store(UNPACK_OUTPUT_CURSOR, x);
        store(UNPACK_LITERAL_OFFSET, y);
        emittedCount = (read(UNPACK_RUN_LENGTH) + read(UNPACK_OUTPUT_COUNT)) & WORD_MASK;
        store(UNPACK_OUTPUT_COUNT, emittedCount);
        if (emittedCount >= read(UNPACK_OUTPUT_LIMIT)) break;
        literal = false;
      } else {
        phase = 'offsetWidth';
        references++;
        // SEP30 clears index highbytes. BYTE TAX zeroextends the width;
        // hidden high-A never contributes to the WORD index after REP30.
        x = read(UNPACK_OUTPUT_COUNT_HIGH, 1);
        y &= BYTE_MASK;
        const high = x,
          base = high ? HIGH_OFFSET_BASE : 0;
        if (!high) x = read(UNPACK_OUTPUT_COUNT, 1);
        x = (base + read(0x80a033 + x, 1)) & BYTE_MASK;
        phase = 'offsetBits';
        let offset = 0;
        do {
          offset = ((offset << 1) | bit()) & WORD_MASK;
          x = (x - 1) & WORD_MASK;
        } while (x !== 0);
        x = (offset + read(UNPACK_OUTPUT_START)) & WORD_MASK;
        phase = 'repeatCode';
        const count = (length() + 1) & WORD_MASK;
        store(UNPACK_RUN_LENGTH, count);
        y = read(UNPACK_OUTPUT_CURSOR);
        phase = 'repeat';
        // Ascending MVN7F->7F: count captured in A, byte reads see previous
        // writes, each index wraps within7F. This is never a snapshot copy.
        for (let remaining = count + 1; remaining > 0; remaining--) {
          const value = read(WRAM_HIGH_BANK * BANK_SIZE + x, 1);
          emit(WRAM_HIGH_BANK * BANK_SIZE + y, value, 1);
          x = (x + 1) & WORD_MASK;
          y = (y + 1) & WORD_MASK;
        }
        phase = 'repeatTail';
        store(UNPACK_OUTPUT_CURSOR, y);
        emittedCount = (read(UNPACK_RUN_LENGTH) + read(UNPACK_OUTPUT_COUNT) + 1) & WORD_MASK;
        store(UNPACK_OUTPUT_COUNT, emittedCount);
        if (emittedCount >= read(UNPACK_OUTPUT_LIMIT)) break;
        phase = 'selector';
        literal = bit() === 0;
      }
    }
    return textHelperResult(
      { a: header, x, y, bank: context.bank, status: context.status },
      budget,
      operations,
      {
        outcome: 'dialog_bytes_prepared',
        inputWord,
        sourceBankWord,
        destination,
        header,
        emittedCount,
        emittedBytes,
        outputBytes: budget.outputBytes,
        bits,
        literals,
        references,
        minimumStackBytes: UNPACK_STACK_BYTES,
      },
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, caller: '9F6D', phase };
  }
}
