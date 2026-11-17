import { dialogAccess } from '../../src/system/native-dialog-support.mjs';
import { taskStop } from '../../src/system/task-stop.mjs';
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
} from '../../src/data/wram.mjs';
import { redirectLanguageStream } from '../../src/data/language.mjs';
import {
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_CARRY,
  FLAG_NEGATIVE,
  FLAG_ZERO,
} from '../../src/constants/cpu-flags.mjs';
import {
  WORD_BITS,
  WORD_MASK,
  BYTE_BITS,
  BANK_SIZE,
  LONG_MASK,
  BYTE_MASK,
  BANK_WRAP,
} from '../../src/constants/bits.mjs';
import {
  WRAM_BANK_PAIR,
  WRAM_BANK,
  CODE_BANK,
  WRAM_HIGH_BANK,
  CODE_BANK_BASE,
} from '../../src/constants/memory-map.mjs';
import { interruptStep } from '../../src/system/main-wait-interrupt.mjs';

const UNPACK_HEADER_BYTES = 0x4;
const FIXED_UNPACK_BYTES = 0x80;
// Instruction offsets within the 9F4D/9E7E entry and after the 9E9B call.
const ENTRY_SOURCE_BANK_STORE = 0x4;
const ENTRY_OUTPUT_START_STORE = 0x6;
const ENTRY_OUTPUT_CURSOR_STORE = 0x8;
const ENTRY_RUN_RESET = 0xa;
const ENTRY_BANK_PUSH = 0xc;
const ENTRY_FIRST_BANK_PULL = 0xf;
const ENTRY_SECOND_BANK_PULL = 0x10;
const ENTRY_SOURCE_INDEX_RESET = 0x11;
const ENTRY_LENGTH_LOAD = 0x14;
const JSR_BYTES = 0x3;
const RETURN_STATUS_PULL_OFFSET = 0x4;
const RETURN_INSTRUCTION_OFFSET = 0x5;

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

// Entry frames remain owned by the original caller; the 9E9B JSR is real.
function runInterruptUnpack(h, e, entry) {
  const { ctx } = h,
    step = (pc) => unpackStep(h, e, pc);
  if (entry === 0x809f49) {
    step(entry);
    h.call(entry, 0x809f4d, () => runInterruptUnpack(h, e, 0x809f4d));
    step(0x809f4c);
    return h.rtl();
  }
  const fixed = entry === 0x809e7e,
    base = fixed ? 0x809e7e : 0x809f4d;
  step(base);
  h.php();
  step(base + 1);
  h.phb();
  step(base + 2);
  h.dpWrite(UNPACK_SOURCE_POINTER, ctx.a);
  step(base + ENTRY_SOURCE_BANK_STORE);
  h.dpWrite(UNPACK_SOURCE_BANK, ctx.y, 2);
  // Text language (src/data/language.mjs): a translated stream is read instead.
  redirectLanguageStream(h.a?.mem, h);
  step(base + ENTRY_OUTPUT_START_STORE);
  h.dpWrite(UNPACK_OUTPUT_START, ctx.x, 2);
  step(base + ENTRY_OUTPUT_CURSOR_STORE);
  h.dpWrite(UNPACK_OUTPUT_CURSOR, ctx.x, 2);
  step(base + ENTRY_RUN_RESET);
  h.dpWrite(UNPACK_RUN_LENGTH, 0);
  step(base + ENTRY_BANK_PUSH);
  h.push(WRAM_BANK_PAIR, 2);
  step(base + ENTRY_FIRST_BANK_PULL);
  h.plb();
  step(base + ENTRY_SECOND_BANK_PULL);
  h.plb();
  step(base + ENTRY_SOURCE_INDEX_RESET);
  h.index('y', 0);
  step(base + ENTRY_LENGTH_LOAD);
  h.load(fixed ? FIXED_UNPACK_BYTES : h.read(h.indirect(UNPACK_SOURCE_POINTER, ctx.y)));
  const call = fixed ? 0x809e95 : 0x809f63;
  step(call);
  h.call(call, 0x809e9b, () => {
    runUnpackBody(h, e, false);
    step(0x809f48);
    return h.rts();
  });
  step(call + JSR_BYTES);
  h.plb();
  step(call + RETURN_STATUS_PULL_OFFSET);
  h.plp();
  step(call + RETURN_INSTRUCTION_OFFSET);
  return fixed ? h.rtl() : h.rts();
}

const UNPACK_BODY_PC_DELTA = 0xe8;

// Fixed 9F6D/9E9B equations. Their bodies from STA DB through PLA differ
// only by the pinned address displacement E8 and MVN destination (7F/7E).
// Observe before each original instruction, including each repeated MVN byte.
// No decoding, inferred interrupts or imported intermediate state.
// Mask bank-qualified source references to the original WORD offset before
// applying the existing body displacement and restoring the program bank.
export const unpackStep = (h, e, pc) => {
  if (e?.startupInterrupts) interruptStep(h, e, pc);
};

function runUnpackBit(h, e) {
  const { ctx } = h,
    step = (pc) => unpackStep(h, e, CODE_BANK_BASE | pc);
  step(0x809e65 & WORD_MASK);
  h.modify(UNPACK_BITS_REMAINING, 'dec', true);
  step(0x809e67 & WORD_MASK);
  if (ctx.status & FLAG_NEGATIVE) {
    step(0x809e69 & WORD_MASK);
    h.pha();
    step(0x809e6a & WORD_MASK);
    h.load(WORD_BITS - 1);
    step(0x809e6d & WORD_MASK);
    h.dpWrite(UNPACK_BITS_REMAINING, ctx.a);
    step(0x809e6f & WORD_MASK);
    h.index('y', h.dp(UNPACK_BIT_STREAM_OFFSET));
    step(0x809e71 & WORD_MASK);
    h.load(h.read(h.indirect(UNPACK_SOURCE_POINTER, ctx.y)));
    step(0x809e73 & WORD_MASK);
    h.xba();
    step(0x809e74 & WORD_MASK);
    h.dpWrite(UNPACK_BIT_BUFFER, ctx.a);
    step(0x809e76 & WORD_MASK);
    h.index('y', ctx.y + 1);
    step(0x809e77 & WORD_MASK);
    h.index('y', ctx.y + 1);
    step(0x809e78 & WORD_MASK);
    h.dpWrite(UNPACK_BIT_STREAM_OFFSET, ctx.y, 2);
    step(0x809e7a & WORD_MASK);
    h.pla();
  }
  step(0x809e7b & WORD_MASK);
  h.modify(UNPACK_BIT_BUFFER, 'asl', true);
  step(0x809e7d & WORD_MASK);
  return h.rts();
}

export function runUnpackBody(h, e, portrait) {
  const { ctx } = h,
    delta = portrait ? 0 : UNPACK_BODY_PC_DELTA;
  const pc = (at) => CODE_BANK_BASE | (at - delta),
    step = (at) => unpackStep(h, e, pc(at));
  const bit = (at) => {
    step(at);
    h.call(pc(at), 0x809e65, () => runUnpackBit(h, e));
  };
  step(0x809f83 & WORD_MASK);
  h.dpWrite(UNPACK_OUTPUT_LIMIT, ctx.a);
  step(0x809f85 & WORD_MASK);
  h.pha();
  step(0x809f86 & WORD_MASK);
  h.index('y', ctx.y + 1);
  step(0x809f87 & WORD_MASK);
  h.index('y', ctx.y + 1);
  step(0x809f88 & WORD_MASK);
  ctx.status &= ~FLAG_CARRY;
  step(0x809f89 & WORD_MASK);
  h.load(h.read(h.indirect(UNPACK_SOURCE_POINTER, ctx.y)));
  step(0x809f8b & WORD_MASK);
  h.adc(2);
  step(0x809f8e & WORD_MASK);
  h.dpWrite(UNPACK_BIT_STREAM_OFFSET, ctx.a);
  step(0x809f90 & WORD_MASK);
  h.load(UNPACK_HEADER_BYTES);
  step(0x809f93 & WORD_MASK);
  h.dpWrite(UNPACK_LITERAL_OFFSET, ctx.a);
  step(0x809f95 & WORD_MASK);
  h.dpWrite(UNPACK_OUTPUT_COUNT, 0);
  step(0x809f97 & WORD_MASK);
  h.dpWrite(UNPACK_BITS_REMAINING, 0);
  step(0x809f99 & WORD_MASK);
  let selector = false;
  for (;;) {
    if (selector) {
      bit(0x809f9b & WORD_MASK);
      step(0x809f9e & WORD_MASK);
      if (ctx.status & FLAG_CARRY) {
        if (reference()) break;
        continue;
      }
    }
    step(0x809fa0 & WORD_MASK);
    h.load(1);
    for (;;) {
      bit(0x809fa3 & WORD_MASK);
      step(0x809fa6 & WORD_MASK);
      if (ctx.status & FLAG_CARRY) break;
      bit(0x809fa8 & WORD_MASK);
      step(0x809fab & WORD_MASK);
      h.rol();
      step(0x809fac & WORD_MASK);
    }
    step(0x809fae & WORD_MASK);
    h.index('y', h.dp(UNPACK_LITERAL_OFFSET));
    step(0x809fb0 & WORD_MASK);
    h.index('x', h.dp(UNPACK_OUTPUT_CURSOR));
    step(0x809fb2 & WORD_MASK);
    h.dpWrite(UNPACK_RUN_LENGTH, ctx.a);
    step(0x809fb4 & WORD_MASK);
    h.lsr();
    step(0x809fb5 & WORD_MASK);
    h.dpWrite(UNPACK_LITERAL_WORDS, ctx.a);
    step(0x809fb7 & WORD_MASK);
    let odd = true;
    if (!(ctx.status & FLAG_ZERO)) {
      step(0x809fb9 & WORD_MASK);
      h.php();
      do {
        step(0x809fba & WORD_MASK);
        h.load(h.read(h.indirect(UNPACK_SOURCE_POINTER, ctx.y)));
        step(0x809fbc & WORD_MASK);
        h.index('y', ctx.y + 1);
        step(0x809fbd & WORD_MASK);
        h.index('y', ctx.y + 1);
        step(0x809fbe & WORD_MASK);
        h.write(h.abs(ctx.x), ctx.a);
        step(0x809fc1 & WORD_MASK);
        h.index('x', ctx.x + 1);
        step(0x809fc2 & WORD_MASK);
        h.index('x', ctx.x + 1);
        step(0x809fc3 & WORD_MASK);
        h.modify(UNPACK_LITERAL_WORDS, 'dec', true);
        step(0x809fc5 & WORD_MASK);
      } while (!(ctx.status & FLAG_ZERO));
      step(0x809fc7 & WORD_MASK);
      h.plp();
      step(0x809fc8 & WORD_MASK);
      odd = !!(ctx.status & FLAG_CARRY);
    }
    if (odd) {
      step(0x809fca & WORD_MASK);
      h.sep(FLAG_MEMORY_8BIT);
      step(0x809fcc & WORD_MASK);
      h.load(h.read(h.indirect(UNPACK_SOURCE_POINTER, ctx.y)));
      step(0x809fce & WORD_MASK);
      h.index('y', ctx.y + 1);
      step(0x809fcf & WORD_MASK);
      h.write(h.abs(ctx.x), ctx.a);
      step(0x809fd2 & WORD_MASK);
      h.index('x', ctx.x + 1);
      step(0x809fd3 & WORD_MASK);
      h.rep(FLAG_MEMORY_8BIT);
    }
    step(0x809fd5 & WORD_MASK);
    h.dpWrite(UNPACK_OUTPUT_CURSOR, ctx.x, 2);
    step(0x809fd7 & WORD_MASK);
    h.dpWrite(UNPACK_LITERAL_OFFSET, ctx.y, 2);
    step(0x809fd9 & WORD_MASK);
    h.load(h.dp(UNPACK_RUN_LENGTH));
    step(0x809fdb & WORD_MASK);
    ctx.status &= ~FLAG_CARRY;
    step(0x809fdc & WORD_MASK);
    h.adc(h.dp(UNPACK_OUTPUT_COUNT));
    step(0x809fde & WORD_MASK);
    h.dpWrite(UNPACK_OUTPUT_COUNT, ctx.a);
    step(0x809fe0 & WORD_MASK);
    h.cmp(h.dp(UNPACK_OUTPUT_LIMIT));
    step(0x809fe2 & WORD_MASK);
    if (ctx.status & FLAG_CARRY) {
      step(0x809fe4 & WORD_MASK);
      break;
    }
    if (reference()) break;
    selector = true;
  }
  step(0x80a02f & WORD_MASK);
  h.pla();
  function reference() {
    step(0x809fe6 & WORD_MASK);
    h.sep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
    step(0x809fe8 & WORD_MASK);
    h.load(BYTE_BITS);
    step(0x809fea & WORD_MASK);
    h.index('x', h.dp(UNPACK_OUTPUT_COUNT_HIGH, 1));
    step(0x809fec & WORD_MASK);
    if (ctx.status & FLAG_ZERO) {
      step(0x809fee & WORD_MASK);
      h.load(0);
      step(0x809ff0 & WORD_MASK);
      h.index('x', h.dp(UNPACK_OUTPUT_COUNT, 1));
    }
    step(0x809ff2 & WORD_MASK);
    ctx.status &= ~FLAG_CARRY;
    step(0x809ff3 & WORD_MASK);
    h.adc(h.read(0x80a033 + ctx.x, 1));
    step(0x809ff7 & WORD_MASK);
    h.index('x', ctx.a & BYTE_MASK);
    step(0x809ff8 & WORD_MASK);
    h.rep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
    step(0x809ffa & WORD_MASK);
    h.load(0);
    do {
      bit(0x809ffd & WORD_MASK);
      step(0x80a000 & WORD_MASK);
      h.rol();
      step(0x80a001 & WORD_MASK);
      h.index('x', ctx.x - 1);
      step(0x80a002 & WORD_MASK);
    } while (!(ctx.status & FLAG_ZERO));
    step(0x80a004 & WORD_MASK);
    ctx.status &= ~FLAG_CARRY;
    step(0x80a005 & WORD_MASK);
    h.adc(h.dp(UNPACK_OUTPUT_START));
    step(0x80a007 & WORD_MASK);
    h.index('x', ctx.a);
    step(0x80a008 & WORD_MASK);
    h.load(1);
    for (;;) {
      bit(0x80a00b & WORD_MASK);
      step(0x80a00e & WORD_MASK);
      if (ctx.status & FLAG_CARRY) break;
      bit(0x80a010 & WORD_MASK);
      step(0x80a013 & WORD_MASK);
      h.rol();
      step(0x80a014 & WORD_MASK);
    }
    step(0x80a017 & WORD_MASK);
    h.load(ctx.a + 1);
    step(0x80a018 & WORD_MASK);
    h.dpWrite(UNPACK_RUN_LENGTH, ctx.a);
    step(0x80a01a & WORD_MASK);
    h.index('y', h.dp(UNPACK_OUTPUT_CURSOR));
    const bank = portrait ? WRAM_HIGH_BANK : WRAM_BANK;
    h.move(bank, bank, 1, () => step(0x80a01c & WORD_MASK));
    step(0x80a01f & WORD_MASK);
    h.dpWrite(UNPACK_OUTPUT_CURSOR, ctx.y, 2);
    step(0x80a021 & WORD_MASK);
    ctx.status |= FLAG_CARRY;
    step(0x80a022 & WORD_MASK);
    h.load(h.dp(UNPACK_RUN_LENGTH));
    step(0x80a024 & WORD_MASK);
    h.adc(h.dp(UNPACK_OUTPUT_COUNT));
    step(0x80a026 & WORD_MASK);
    h.dpWrite(UNPACK_OUTPUT_COUNT, ctx.a);
    step(0x80a028 & WORD_MASK);
    h.cmp(h.dp(UNPACK_OUTPUT_LIMIT));
    step(0x80a02a & WORD_MASK);
    if (ctx.status & FLAG_CARRY) return true;
    step(0x80a02c & WORD_MASK);
    return false;
  }
}
