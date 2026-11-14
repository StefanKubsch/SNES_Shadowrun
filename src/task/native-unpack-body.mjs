import {
  UNPACK_BITS_REMAINING,
  UNPACK_BIT_STREAM_OFFSET,
  UNPACK_SOURCE_POINTER,
  UNPACK_BIT_BUFFER,
  UNPACK_OUTPUT_LIMIT,
  UNPACK_LITERAL_OFFSET,
  UNPACK_OUTPUT_COUNT,
  UNPACK_OUTPUT_CURSOR,
  UNPACK_RUN_LENGTH,
  UNPACK_LITERAL_WORDS,
  UNPACK_OUTPUT_COUNT_HIGH,
  UNPACK_OUTPUT_START,
  UNPACK_SOURCE_BANK,
} from './wram.mjs';
import { interruptStep } from './main-wait-interrupt.mjs';
import { redirectLanguageStream } from '../data/language.mjs';
import { WORD_MASK, WORD_BITS, BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';
import {
  FLAG_NEGATIVE,
  FLAG_CARRY,
  FLAG_ZERO,
  FLAG_MEMORY_8BIT,
  FLAG_INDEX_8BIT,
} from '../constants/cpu-flags.mjs';
import {
  WRAM_HIGH_BANK,
  WRAM_BANK,
  WRAM_BANK_PAIR,
  CODE_BANK_BASE,
} from '../constants/memory-map.mjs';

const UNPACK_BODY_PC_DELTA = 0xe8;
const UNPACK_HEADER_BYTES = 0x4;
const ENTRY_SOURCE_BANK_STORE = 0x4;
const ENTRY_OUTPUT_START_STORE = 0x6;
const ENTRY_OUTPUT_CURSOR_STORE = 0x8;
const ENTRY_RUN_RESET = 0xa;
const ENTRY_BANK_PUSH = 0xc;
const ENTRY_FIRST_BANK_PULL = 0xf;
const ENTRY_SECOND_BANK_PULL = 0x10;
const ENTRY_SOURCE_INDEX_RESET = 0x11;
const ENTRY_LENGTH_LOAD = 0x14;
const FIXED_UNPACK_BYTES = 0x80;
const JSR_BYTES = 0x3;
const RETURN_STATUS_PULL_OFFSET = 0x4;
const RETURN_INSTRUCTION_OFFSET = 0x5;

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

// Entry frames remain owned by the original caller; the 9E9B JSR is real.
export function runInterruptUnpack(h, e, entry) {
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
