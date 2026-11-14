import { isWord } from '../script/runtime.mjs';
import { isRenderData, prepareRenderView } from '../../src/render/data.mjs';
import { renderOutputBytes } from './output-budget.mjs';
import {
  BYTE_MASK,
  BYTE_BITS,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
  LONG_MASK,
} from '../../src/constants/bits.mjs';
import { FLAG_DECIMAL, FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT } from '../../src/constants/cpu-flags.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import {
  UNPACK_OUTPUT_LIMIT,
  UNPACK_OUTPUT_START,
  UNPACK_OUTPUT_CURSOR,
  UNPACK_SOURCE_POINTER,
  UNPACK_SOURCE_BANK,
  UNPACK_BIT_STREAM_OFFSET,
  UNPACK_LITERAL_OFFSET,
  UNPACK_OUTPUT_COUNT,
  UNPACK_OUTPUT_COUNT_HIGH,
  UNPACK_RUN_LENGTH,
  UNPACK_LITERAL_WORDS,
  UNPACK_BITS_REMAINING,
  UNPACK_BIT_BUFFER,
} from '../../src/task/wram.mjs';

// Existing standalone safety limits; neither value models device timing.
const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const UNPACK_STACK_BYTES = 18;
const ENTRY_STATUS_MASK = FLAG_DECIMAL | FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT;
// Two header words precede literal bytes; control bits refill a WORD at a time.
const PACKED_HEADER_BYTES = 4;
const BIT_BUFFER_TOP_SHIFT = 15;

// Native data algorithm derived from 9F49/9F4D/9E9B/9E65. No CPU
// instructions, clock, DMA, stack execution or register dispatch.
export function renderEntryBoundary(
  {
    data,
    bank = null,
    status = null,
    emulation = null,
    directPage = null,
    stackWindow = null,
    maxWork = DEFAULT_MAX_WORK,
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  } = {},
  minimumStackBytes = UNPACK_STACK_BYTES,
  accumulatorBytes = 2,
) {
  if (
    !isRenderData(data) ||
    (bank !== null && (!Number.isInteger(bank) || bank < 0 || bank > BYTE_MASK)) ||
    (status !== null && (!Number.isInteger(status) || status < 0 || status > BYTE_MASK)) ||
    !Number.isSafeInteger(maxWork) ||
    maxWork < 1 ||
    !Number.isSafeInteger(maxOutputBytes) ||
    maxOutputBytes < 1 ||
    ![1, 2].includes(accumulatorBytes)
  )
    throw Error('Invalid render unpack context');
  if (
    bank === null ||
    status === null ||
    emulation !== 0 ||
    directPage !== 0 ||
    (status & ENTRY_STATUS_MASK) !== (accumulatorBytes === 1 ? FLAG_MEMORY_8BIT : 0)
  )
    return { handled: false, reason: 'render_entry_required' };
  if (minimumStackBytes === 0 && stackWindow === null) return null;
  if (
    !Array.isArray(stackWindow) ||
    stackWindow.length !== 2 ||
    !Array.from(stackWindow).every(isWord) ||
    stackWindow[0] > stackWindow[1] ||
    stackWindow[1] - stackWindow[0] + 1 < minimumStackBytes
  )
    return { handled: false, reason: 'render_stack_required' };
  return null;
}

export function prepareRenderUnpack9F49({
  data,
  sourceOffset,
  sourceBankWord,
  destination,
  bank = null,
  status = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
} = {}) {
  if (![sourceOffset, sourceBankWord, destination].every(isWord))
    throw Error('Invalid render unpack context');
  const entry = renderEntryBoundary({
    data,
    bank,
    status,
    emulation,
    directPage,
    stackWindow,
    maxWork,
    maxOutputBytes,
  });
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  try {
    return view.finish(
      unpackRender9F49(
        view,
        { sourceOffset, sourceBankWord, destination, bank, status },
        { work: 0, maxWork, maxOutputBytes },
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Internal algorithm for a larger atomic render plan. Only its caller can
// finish/commit the view; no separately applicable unpack plan is exposed.
export function unpackRender9F49(
  view,
  { sourceOffset, sourceBankWord, destination, bank, status },
  budget,
) {
  let outputBytes = 0,
    bits = 0,
    literals = 0,
    references = 0;
  let x = destination,
    y = 0;
  const boundary = (reason) => {
    throw { renderBoundary: true, reason };
  };
  const tick = () => {
    if (++budget.work > budget.maxWork) boundary('render_work_budget_required');
  };
  const readWord = (a) => view.read(a) | (view.read((a + 1) & LONG_MASK) << BYTE_BITS);
  const word = (dp) => readWord(dp);
  const writeWord = (a, value) => {
    view.write(a, value & BYTE_MASK);
    view.write(a + 1, value >>> BYTE_BITS);
  };
  const store = (dp, value) => writeWord(dp, value & WORD_MASK);
  const source = (index) =>
    ((view.read(UNPACK_SOURCE_POINTER) |
      (view.read(UNPACK_SOURCE_POINTER + 1) << BYTE_BITS) |
      (view.read(UNPACK_SOURCE_BANK) << WORD_BITS)) +
      index) &
    LONG_MASK;
  const sourceWord = (index) => readWord(source(index));
  const emit = (offset, value) => {
    if (++outputBytes > budget.maxOutputBytes) boundary('render_output_budget_required');
    renderOutputBytes(budget, 1);
    view.write(WRAM_BASE + offset, value);
  };
  const bit = () => {
    tick();
    bits++;
    const remaining = (word(UNPACK_BITS_REMAINING) - 1) & WORD_MASK;
    store(UNPACK_BITS_REMAINING, remaining);
    if (remaining & WORD_SIGN) {
      store(UNPACK_BITS_REMAINING, BIT_BUFFER_TOP_SHIFT);
      y = word(UNPACK_BIT_STREAM_OFFSET);
      const raw = sourceWord(y);
      store(UNPACK_BIT_BUFFER, (raw >>> BYTE_BITS) | ((raw & BYTE_MASK) << BYTE_BITS));
      y = (y + 2) & WORD_MASK;
      store(UNPACK_BIT_STREAM_OFFSET, y);
    }
    const buffer = word(UNPACK_BIT_BUFFER);
    store(UNPACK_BIT_BUFFER, buffer << 1);
    return buffer >>> BIT_BUFFER_TOP_SHIFT;
  };
  const length = () => {
    let value = 1;
    while (!bit()) value = ((value << 1) | bit()) & WORD_MASK;
    return value;
  };
  store(UNPACK_SOURCE_POINTER, sourceOffset);
  store(UNPACK_SOURCE_BANK, sourceBankWord);
  store(UNPACK_OUTPUT_START, x);
  store(UNPACK_OUTPUT_CURSOR, x);
  store(UNPACK_RUN_LENGTH, 0);
  const header = sourceWord(0);
  store(UNPACK_OUTPUT_LIMIT, header);
  y = 2;
  store(UNPACK_BIT_STREAM_OFFSET, sourceWord(y) + 2);
  store(UNPACK_LITERAL_OFFSET, PACKED_HEADER_BYTES);
  store(UNPACK_OUTPUT_COUNT, 0);
  store(UNPACK_BITS_REMAINING, 0);
  let literal = true;
  for (;;) {
    tick();
    if (literal) {
      literals++;
      const count = length();
      y = word(UNPACK_LITERAL_OFFSET);
      x = word(UNPACK_OUTPUT_CURSOR);
      store(UNPACK_RUN_LENGTH, count);
      store(UNPACK_LITERAL_WORDS, count >>> 1);
      if (count >>> 1) {
        // ED is read freshly after each output WORD, so an output alias
        // can change the literal loop. The saved odd carry stays local.
        do {
          tick();
          const value = sourceWord(y);
          y = (y + 2) & WORD_MASK;
          // Absolute indexed WORD at FFFF needs a separate bank-edge
          // contract; never guess its high-byte destination.
          if (x === WORD_MASK) boundary('render_word_bank_edge_required');
          emit(x, value & BYTE_MASK);
          emit(x + 1, value >>> BYTE_BITS);
          x = (x + 2) & WORD_MASK;
          store(UNPACK_LITERAL_WORDS, word(UNPACK_LITERAL_WORDS) - 1);
        } while (word(UNPACK_LITERAL_WORDS) !== 0);
      }
      if (count < 2 || count & 1) {
        tick();
        const value = view.read(source(y));
        y = (y + 1) & WORD_MASK;
        emit(x, value);
        x = (x + 1) & WORD_MASK;
      }
      store(UNPACK_OUTPUT_CURSOR, x);
      store(UNPACK_LITERAL_OFFSET, y);
      const emitted = (word(UNPACK_RUN_LENGTH) + word(UNPACK_OUTPUT_COUNT)) & WORD_MASK;
      store(UNPACK_OUTPUT_COUNT, emitted);
      if (emitted >= word(UNPACK_OUTPUT_LIMIT)) break;
      literal = false; // First reference is unconditional.
    } else {
      references++;
      const high = view.read(UNPACK_OUTPUT_COUNT_HIGH),
        low = high === 0 ? view.read(UNPACK_OUTPUT_COUNT) : high;
      let width = ((high ? BYTE_BITS : 0) + view.read(0x80a033 + low)) & BYTE_MASK;
      let offset = 0;
      // Real do/while semantics, including width 0 -> 65536 bit visits.
      do {
        offset = ((offset << 1) | bit()) & WORD_MASK;
        width = (width - 1) & WORD_MASK;
      } while (width !== 0);
      x = (offset + word(UNPACK_OUTPUT_START)) & WORD_MASK;
      const count = (length() + 1) & WORD_MASK;
      store(UNPACK_RUN_LENGTH, count);
      y = word(UNPACK_OUTPUT_CURSOR);
      // Forward MVN uses the accumulator count captured before any alias
      // write, but accounting later rereads EB/E9 and the header.
      for (let remaining = count + 1; remaining > 0; remaining--) {
        tick();
        const value = view.read(WRAM_BASE + x);
        emit(y, value);
        x = (x + 1) & WORD_MASK;
        y = (y + 1) & WORD_MASK;
      }
      store(UNPACK_OUTPUT_CURSOR, y);
      const emitted = (word(UNPACK_RUN_LENGTH) + word(UNPACK_OUTPUT_COUNT) + 1) & WORD_MASK;
      store(UNPACK_OUTPUT_COUNT, emitted);
      if (emitted >= word(UNPACK_OUTPUT_LIMIT)) break;
      literal = bit() === 0;
    }
  }
  return {
    handled: true,
    header,
    a: header,
    x,
    y,
    bank,
    status,
    outputBytes,
    emittedCount: word(UNPACK_OUTPUT_COUNT),
    bits,
    literals,
    references,
    work: budget.work,
  };
}
