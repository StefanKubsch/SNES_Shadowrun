import { dialogAccess } from './native-dialog-support.mjs';
import { runInterruptUnpack } from './native-unpack-body.mjs';
import { taskStop } from './plan.mjs';
import { taskTextAccess } from './native-text-prerequisites.mjs';
import {
  UNPACK_SOURCE_POINTER,
  UNPACK_SOURCE_BANK,
  UNPACK_BITS_REMAINING,
  UNPACK_BIT_STREAM_OFFSET,
  UNPACK_BIT_BUFFER,
  UNPACK_OUTPUT_LIMIT,
  UNPACK_LITERAL_OFFSET,
  UNPACK_OUTPUT_COUNT,
  UNPACK_OUTPUT_CURSOR,
  UNPACK_RUN_LENGTH,
  UNPACK_LITERAL_WORDS,
  UNPACK_OUTPUT_COUNT_HIGH,
  UNPACK_OUTPUT_START,
  WRAM,
} from './wram.mjs';
import { redirectLanguageStream } from '../data/language.mjs';
import {
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_CARRY,
  FLAG_NEGATIVE,
} from '../constants/cpu-flags.mjs';
import {
  WORD_BITS,
  WORD_MASK,
  BYTE_BITS,
  BANK_SIZE,
  LONG_MASK,
  BYTE_MASK,
  BANK_WRAP,
} from '../constants/bits.mjs';
import { WRAM_BANK_PAIR, WRAM_BANK, CODE_BANK } from '../constants/memory-map.mjs';

const UNPACK_HEADER_BYTES = 0x4;
const FIXED_UNPACK_BYTES = 0x80;

// 80:9F49: unpack an LZ stream (source in A/Y, destination X in bank 7E) for a long
// caller: JSR 9F4D and RTL. The entry argument also selects 9F4D (unpackStream, RTS)
// and 9E7E (unpackFixedStream, 128 bytes instead of the stream's length word).
// Fixed original 9F49/9F4D/9E7E/9E9B/9E65 data algorithms. No instruction decode,
// dispatch, source-size inference, cached stack bytes or destination clipping.
export function unpackStreamLong(a, outerReturn = true, entry = 0x809f49, events = null) {
  if (![0x809f49, 0x809f4d, 0x809e7e].includes(entry)) taskStop('task_unpack_entry_required');
  if (events?.startupInterrupts) {
    const rawReturnWord = runInterruptUnpack(dialogAccess(a), events, entry);
    return {
      rawReturnWord,
      returnBank: a.ctx.programBank,
      returnTarget: a.ctx.programBank * BANK_SIZE + a.ctx.pc,
      outcome: 'unpacked',
    };
  }
  const h = taskTextAccess(a),
    { ctx } = h;
  let bits = 0,
    literals = 0,
    references = 0,
    literalBytes = 0,
    referenceBytes = 0;
  const wordMode = () => {
    if (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT))
      taskStop('task_unpack_word_mode_required');
  };
  const index = (name, value) => {
    const bytes = ctx.status & FLAG_INDEX_8BIT ? 1 : 2;
    ctx[name] = h.nz(value, bytes);
  };
  const inc = (name) => index(name, (ctx[name] + 1) & WORD_MASK),
    dec = (name) => index(name, (ctx[name] - 1) & WORD_MASK);
  const change = (offset, delta) => {
    const value = h.nz((h.dp(offset) + delta) & WORD_MASK, 2);
    h.dpWrite(offset, value);
    return value;
  };
  const compare = (left, right) => {
    ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
    h.nz((left - right) & WORD_MASK, 2);
  };
  const source = () =>
    ((h.dp(UNPACK_SOURCE_POINTER, 2) | (h.dp(UNPACK_SOURCE_BANK, 1) << WORD_BITS)) + ctx.y) &
    LONG_MASK;
  const indirect = () => h.read(source());
  const rol = () => {
    const old = ctx.a,
      c = ctx.status & FLAG_CARRY;
    ctx.status = (ctx.status & ~FLAG_CARRY) | (old >>> (WORD_BITS - 1));
    h.load((old * 2 + c) & WORD_MASK);
  };
  const rts = () => {
    wordMode();
    const raw = a.pullWord('unpack-inner-RTS-fresh');
    ctx.pc = (raw + 1) & WORD_MASK;
    return raw;
  };
  const call = (at, next, run) => {
    a.pushWord((next - 1) & WORD_MASK, 'unpack-inner-JSR');
    ctx.pc = [0x809f63, 0x809e95].includes(at) ? 0x809e9b & WORD_MASK : 0x809e65 & WORD_MASK;
    run();
    const raw = rts();
    if (raw !== ((next - 1) & WORD_MASK) || ctx.programBank !== CODE_BANK)
      taskStop('task_native_helper_return_required', { at, raw, bank: ctx.programBank });
  };
  const select7E = () => {
    a.pushWord(WRAM_BANK_PAIR, 'unpack-PEA7E');
    ctx.bank = h.pullByte('unpack-PLB-first');
    h.nz(ctx.bank, 1);
    ctx.bank = h.pullByte('unpack-PLB-second');
    h.nz(ctx.bank, 1);
  };
  const bitBody = () => {
    bits++;
    change(UNPACK_BITS_REMAINING, -1);
    if (ctx.status & FLAG_NEGATIVE) {
      a.pushWord(ctx.a, 'unpack-bit-PHA');
      h.load(WORD_BITS - 1);
      h.dpWrite(UNPACK_BITS_REMAINING, ctx.a);
      index('y', h.dp(UNPACK_BIT_STREAM_OFFSET));
      h.load(indirect());
      h.xba();
      h.dpWrite(UNPACK_BIT_BUFFER, ctx.a);
      inc('y');
      inc('y');
      h.dpWrite(UNPACK_BIT_STREAM_OFFSET, ctx.y);
      h.load(a.pullWord('unpack-bit-PLA-fresh'));
    }
    const old = h.dp(UNPACK_BIT_BUFFER),
      shifted = (old << 1) & WORD_MASK;
    ctx.status = (ctx.status & ~FLAG_CARRY) | (old >>> (WORD_BITS - 1));
    h.dpWrite(UNPACK_BIT_BUFFER, h.nz(shifted, 2));
  };
  const bit = (at, next) => call(at, next, bitBody);
  const unpack = () => {
    h.dpWrite(UNPACK_OUTPUT_LIMIT, ctx.a);
    a.pushWord(ctx.a, 'unpack-header-PHA');
    inc('y');
    inc('y');
    ctx.status &= ~FLAG_CARRY;
    h.load(indirect());
    h.arithmetic(2);
    h.dpWrite(UNPACK_BIT_STREAM_OFFSET, ctx.a);
    h.load(UNPACK_HEADER_BYTES);
    h.dpWrite(UNPACK_LITERAL_OFFSET, ctx.a);
    h.dpWrite(UNPACK_OUTPUT_COUNT, 0);
    h.dpWrite(UNPACK_BITS_REMAINING, 0);
    let literal = true;
    for (;;) {
      if (literal) {
        literals++;
        h.load(1);
        for (;;) {
          bit(0x809ebb, 0x809ebe);
          if (ctx.status & FLAG_CARRY) break;
          bit(0x809ec0, 0x809ec3);
          rol();
        }
        index('y', h.dp(UNPACK_LITERAL_OFFSET));
        index('x', h.dp(UNPACK_OUTPUT_CURSOR));
        h.dpWrite(UNPACK_RUN_LENGTH, ctx.a);
        h.lsr();
        h.dpWrite(UNPACK_LITERAL_WORDS, ctx.a);
        const halfZero = ctx.a === 0;
        if (!halfZero) {
          h.pushByte(ctx.status, 'unpack-literal-PHP');
          let remaining;
          do {
            h.load(indirect());
            inc('y');
            inc('y');
            h.write(h.abs(0) + ctx.x, ctx.a);
            literalBytes += 2;
            inc('x');
            inc('x');
            remaining = change(UNPACK_LITERAL_WORDS, -1);
          } while (remaining !== 0);
          ctx.status = h.pullByte('unpack-literal-PLP-fresh');
          wordMode();
        }
        if (halfZero || ctx.status & FLAG_CARRY) {
          ctx.status |= FLAG_MEMORY_8BIT;
          h.load(indirect());
          inc('y');
          h.write(h.abs(0) + ctx.x, ctx.a & BYTE_MASK);
          literalBytes++;
          inc('x');
          ctx.status &= ~FLAG_MEMORY_8BIT;
        }
        h.dpWrite(UNPACK_OUTPUT_CURSOR, ctx.x);
        h.dpWrite(UNPACK_LITERAL_OFFSET, ctx.y);
        h.load(h.dp(UNPACK_RUN_LENGTH));
        ctx.status &= ~FLAG_CARRY;
        h.arithmetic(h.dp(UNPACK_OUTPUT_COUNT));
        h.dpWrite(UNPACK_OUTPUT_COUNT, ctx.a);
        compare(ctx.a, h.dp(UNPACK_OUTPUT_LIMIT));
        if (ctx.status & FLAG_CARRY) break;
        literal = false;
      } else {
        references++;
        ctx.status |= FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT;
        ctx.x &= BYTE_MASK;
        ctx.y &= BYTE_MASK;
        h.load(BYTE_BITS);
        index('x', h.dp(UNPACK_OUTPUT_COUNT_HIGH, 1));
        if (ctx.x === 0) {
          h.load(0);
          index('x', h.dp(UNPACK_OUTPUT_COUNT, 1));
        }
        ctx.status &= ~FLAG_CARRY;
        h.arithmetic(h.read(0x80a033 + ctx.x));
        index('x', ctx.a);
        ctx.status &= ~(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
        h.load(0);
        do {
          bit(0x809f15, 0x809f18);
          rol();
          dec('x');
        } while (ctx.x !== 0);
        ctx.status &= ~FLAG_CARRY;
        h.arithmetic(h.dp(UNPACK_OUTPUT_START));
        index('x', ctx.a);
        h.load(1);
        for (;;) {
          bit(0x809f23, 0x809f26);
          if (ctx.status & FLAG_CARRY) break;
          bit(0x809f28, 0x809f2b);
          rol();
        }
        h.load((ctx.a + 1) & WORD_MASK);
        h.dpWrite(UNPACK_RUN_LENGTH, ctx.a);
        index('y', h.dp(UNPACK_OUTPUT_CURSOR));
        const count = ctx.a + 1;
        for (let n = 0; n < count; n++) {
          // MVN takes its count from A, changes A/X/Y and destination DBR, and
          // preserves all flags. EB/output aliases are reread only afterward.
          const value = h.read(WRAM + ctx.x, 1);
          h.write(WRAM + ctx.y, value, 1);
          referenceBytes++;
          ctx.x = (ctx.x + 1) & WORD_MASK;
          ctx.y = (ctx.y + 1) & WORD_MASK;
          ctx.a = (ctx.a - 1) & WORD_MASK;
          ctx.bank = WRAM_BANK;
        }
        h.dpWrite(UNPACK_OUTPUT_CURSOR, ctx.y);
        ctx.status |= FLAG_CARRY;
        h.load(h.dp(UNPACK_RUN_LENGTH));
        h.arithmetic(h.dp(UNPACK_OUTPUT_COUNT));
        h.dpWrite(UNPACK_OUTPUT_COUNT, ctx.a);
        compare(ctx.a, h.dp(UNPACK_OUTPUT_LIMIT));
        if (ctx.status & FLAG_CARRY) break;
        bit(0x809eb3, 0x809eb6);
        literal = !(ctx.status & FLAG_CARRY);
      }
    }
    h.load(a.pullWord('unpack-header-PLA-fresh'));
  };
  // The real 9F49 JSR9F4D, PHP/PHB/scratch writes, temporary DBR and 9E9B call.
  if (entry === 0x809f49) a.pushWord(0x809f4b & WORD_MASK, 'unpack-root-JSR9F4D');
  h.pushByte(ctx.status, 'unpack-root-PHP');
  h.pushByte(ctx.bank, 'unpack-root-PHB');
  h.dpWrite(UNPACK_SOURCE_POINTER, ctx.a);
  h.dpWrite(UNPACK_SOURCE_BANK, ctx.y);
  // Text language (src/data/language.mjs): a translated stream is read instead.
  redirectLanguageStream(a.mem, h);
  h.dpWrite(UNPACK_OUTPUT_START, ctx.x);
  h.dpWrite(UNPACK_OUTPUT_CURSOR, ctx.x);
  h.dpWrite(UNPACK_RUN_LENGTH, 0);
  select7E();
  index('y', 0);
  h.load(entry === 0x809e7e ? FIXED_UNPACK_BYTES : indirect());
  call(entry === 0x809e7e ? 0x809e95 : 0x809f63, entry === 0x809e7e ? 0x809e98 : 0x809f66, unpack);
  ctx.bank = h.pullByte('unpack-root-PLB-restored-fresh');
  h.nz(ctx.bank, 1);
  ctx.status = h.pullByte('unpack-root-PLP-fresh');
  wordMode();
  if (entry === 0x809f49) {
    const raw = rts();
    if (raw !== (0x809f4b & WORD_MASK))
      taskStop('task_native_helper_return_required', { raw, expected: 0x809f4b & WORD_MASK });
  }
  let returned;
  if (entry !== 0x809f4d) returned = h.finish(outerReturn);
  else {
    const rawReturnWord = a.readWord(
      (ctx.s + 1) & WORD_MASK,
      BANK_WRAP,
      'unpack-root-RTS-fresh',
      outerReturn,
    );
    ctx.s = (ctx.s + 2) & WORD_MASK;
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    returned = {
      rawReturnWord,
      returnTarget: ctx.programBank * BANK_SIZE + ctx.pc,
      returnTargetExecuted: false,
      dynamicDispatchExecuted: false,
      frontier: 'observed-outer-RTS-target',
    };
  }
  return {
    ...returned,
    outcome: 'unpacked',
    bits,
    literals,
    references,
    literalBytes,
    referenceBytes,
  };
}
export const unpackStream = (a, outerReturn = true, events = null) =>
  unpackStreamLong(a, outerReturn, 0x809f4d, events);
// 80:9E7E supplies 128 bytes instead of reading the stream's first WORD.
export const unpackFixedStream = (a, outerReturn = true, events = null) =>
  unpackStreamLong(a, outerReturn, 0x809e7e, events);
