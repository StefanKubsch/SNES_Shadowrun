import { taskStop } from './plan.mjs';
import {
  FLAG_CARRY,
  FLAG_DECIMAL,
  FLAG_OVERFLOW,
  FLAG_MEMORY_8BIT,
  FLAG_ZERO,
} from '../constants/cpu-flags.mjs';
import {
  BANK_WRAP,
  WORD_MASK,
  BYTE_BITS,
  BYTE_MASK,
  WORD_BITS,
  LONG_WRAP,
  LONG_MASK,
  BYTE_SIGN,
} from '../constants/bits.mjs';
import {
  WRMPYA,
  WRMPYB,
  WRDIVL,
  WRDIVH,
  WRDIVB,
  RDDIVL,
  RDDIVH,
  RDMPYL,
  RDMPYH,
} from '../constants/hardware-registers.mjs';
import { WRAM, OBJECT_BOX_HEIGHT, OBJECT_HEIGHT, OBJECT_X, OBJECT_Y } from './wram.mjs';

// 81:A25F line of sight between object X (target) and object Y (viewer) through the map boxes
// of the current cell list [$FC] (count byte, then 12-byte records from +1: x0, y0, unused word,
// x1, y1, height; box units are coordinates >> 2). Fixed equations of
// the original graph A25F/A32D/A344/A55C with its four quadrant variants (DP5F) and the shared
// division tails A5B3/A5D9/A5FE/A60B/A62B/A64A/A656; not an instruction interpreter.
// Called by JSL with DBR = $80, E0/M0/X0, D = 0. Ends with RTL; carry set = sight blocked,
// DP68 = $FFFF marks a box below the line (A664). Hardware multiply/divide through the
// arithmetic registers $4202-$4206/$4214/$4216 with their original instruction addresses.
// Source: pinned windows and stack proof in tools/task-sight-a25f-source.mjs; the equations are
// compared against the original instructions in tools/task-sight-a25f.test.mjs (all 716 reached).
// Long address of the routine, the JSL target of its callers (80:8BC5, 80:8C08, 80:8C8D,
// 80:8CCF and the shots 80:8AB5, 80:8A51 and 80:8A8C).
export const SIGHT_ROUTINE = 0x81a25f;
// Arithmetic unit of A25F: written registers, read registers and the original PCs of all reads.
export const lineOfSightDevices = Object.freeze({
  writes: Object.freeze([WRMPYA, WRMPYB, WRDIVL, WRDIVH, WRDIVB]),
  reads: Object.freeze([RDDIVL, RDDIVH, RDMPYL, RDMPYH]),
  observationPcs: Object.freeze([
    0x81a36d, 0x81a375, 0x81a391, 0x81a39a, 0x81a3bb, 0x81a3c4, 0x81a3e7, 0x81a3ef, 0x81a40f,
    0x81a418, 0x81a43d, 0x81a446, 0x81a469, 0x81a471, 0x81a491, 0x81a49a, 0x81a4bf, 0x81a4c8,
    0x81a4ef, 0x81a4f7, 0x81a51b, 0x81a524, 0x81a54d, 0x81a556, 0x81a5a5, 0x81a5ae, 0x81a5c7,
    0x81a5ed, 0x81a601, 0x81a619, 0x81a639, 0x81a64d, 0x81a6ac, 0x81a6b5, 0x81a701, 0x81a70a,
    0x81a75e, 0x81a767,
  ]),
});
// A25F direct page: the line between viewer and target in box units (coordinates >> 2:
// minimum and maximum per axis, viewer cell >> 2 more, spans in the high byte), the eye
// height (viewer height plus 3/4 of its box), the target bottom and top, the current box
// record, the quadrant (2: target x below, 1: target y below), the boxes left in the cell, the
// low-box mark and the divisors of the A5B3 (x) and A5D9 (y) division tails.
const DP_LINE_MIN_X = 0x0e;
const DP_LINE_MAX_X = 0x11;
const DP_LINE_MIN_Y = 0x14;
const DP_LINE_MAX_Y = 0x17;
const DP_VIEWER_CELL_X = 0x1a;
const DP_VIEWER_CELL_Y = 0x1d;
const DP_SPAN_X = 0x20;
const DP_SPAN_X_HIGH = 0x21;
const DP_SPAN_Y = 0x23;
const DP_SPAN_Y_HIGH = 0x24;
const DP_EYE_HEIGHT = 0x26;
const DP_TARGET_BOTTOM = 0x2c;
const DP_TARGET_TOP = 0x2f;
const DP_BOX_X0 = 0x32;
const DP_BOX_Y0 = 0x35;
const DP_BOX_X1 = 0x38;
const DP_BOX_Y1 = 0x3b;
const DP_X_DIVISOR = 0x3e;
const DP_Y_DIVISOR = 0x41;
const DP_X_NEGATIVE_DIVISOR = 0x44;
const DP_Y_NEGATIVE_DIVISOR = 0x47;
const DP_BOX_HEIGHT = 0x5c;
const DP_QUADRANT = 0x5f;
const DP_BOXES_LEFT = 0x62;
const DP_TARGET_BOX_HEIGHT = 0x65;
const DP_LOW_BOX = 0x68;
const DP_TERM = 0x6b;
const DP_CELL_LIST = 0xfc;
const DP_CELL_LIST_BANK = 0xfe;
// Last quadrant index; a box record holds x0, y0, an unused word, x1, y1 and the height.
const QUADRANT_LAST = 3,
  BOX_Y0_STEP = 4;
// Return word of a JSR inside bank 81: the bank offset of the call's last byte.
const callReturn = (address) => address & WORD_MASK;
// 81:A25F: test the line of sight between two objects against the box records.
export function testLineOfSight(h) {
  const { a, ctx } = h;
  const dp = (n) => h.dp(n),
    st = (n, v = ctx.a) => a.writeWord(n, v, BANK_WRAP, 'a25f-DP-WORD');
  const carry = () => (ctx.status & FLAG_CARRY) !== 0,
    sec = () => {
      ctx.status |= FLAG_CARRY;
    },
    clc = () => {
      ctx.status &= ~FLAG_CARRY;
    };
  const lsr = () => {
    ctx.status = (ctx.status & ~FLAG_CARRY) | (ctx.a & 1);
    h.load(ctx.a >>> 1);
  };
  const sbc = (v) => h.arithmetic(v, true),
    adc = (v) => h.arithmetic(v);
  const compare = (left, right) => {
    h.nz((left - right) & WORD_MASK);
    ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
  };
  const incDp = (n) => {
    const v = h.nz((dp(n) + 1) & WORD_MASK);
    st(n, v);
  };
  const xba = () => {
    const v = ((ctx.a >>> BYTE_BITS) | (ctx.a << BYTE_BITS)) & WORD_MASK;
    ctx.a = v;
    h.nz(v & BYTE_MASK, 1);
  };
  const wide = (pc, offset, value = ctx.a) =>
    a.absoluteWrite(offset, value, 2, pc, 'a25f-arithmetic');
  const byte = (pc, offset, value = ctx.a & BYTE_MASK) =>
    a.absoluteWrite(offset, value, 1, pc, 'a25f-arithmetic');
  const product = (pc) => a.absoluteRead(RDMPYL, 2, pc, 'a25f-product');
  const pointer = () =>
    (a.read(DP_CELL_LIST_BANK, 'a25f-pointer-bank') << WORD_BITS) |
    a.readWord(DP_CELL_LIST, BANK_WRAP, 'a25f-pointer');
  const indirect = (y) => a.readWord((pointer() + y) & LONG_MASK, LONG_WRAP, 'a25f-cell-WORD');
  // Terms: forward "LDA d / LSR / LSR / SEC / SBC base", reverse "... STA 6B / SEC / LDA base / SBC 6B".
  // loaded=true continues after an earlier LDA d (third term, loaded before the product compare).
  const term = ([d, base, reverse], loaded = false) => {
    if (!loaded) h.load(dp(d));
    lsr();
    lsr();
    if (reverse) {
      st(DP_TERM);
      sec();
      h.load(dp(base));
      sbc(dp(DP_TERM));
    } else {
      sec();
      sbc(dp(base));
    }
    return carry();
  };
  // A32D: viewer/target box overlap on both axes (carry = overlap).
  const boxes = () => {
    for (const [l, r] of [
      [DP_LINE_MAX_X, DP_BOX_X0],
      [DP_LINE_MAX_Y, DP_BOX_Y0],
      [DP_BOX_X1, DP_LINE_MIN_X],
      [DP_BOX_Y1, DP_LINE_MIN_Y],
    ]) {
      h.load(dp(l));
      compare(ctx.a, dp(r));
      if (!carry()) return false;
    }
    return true;
  };
  // A344: quadrant compare against the line (carry = blocked). pcs: [STA1,LDX2,STA2,CPX3,STA3,LDX4,STA4,CPX4] and alt.
  const QUADRANT_LINES = [
    {
      t: [
        [DP_BOX_X1, DP_VIEWER_CELL_X],
        [DP_BOX_Y0, DP_VIEWER_CELL_Y],
        [DP_BOX_Y1, DP_VIEWER_CELL_Y],
        [DP_BOX_X0, DP_VIEWER_CELL_X],
      ],
      alt: [
        [DP_BOX_Y1, DP_VIEWER_CELL_Y],
        [DP_BOX_X0, DP_VIEWER_CELL_X],
      ],
      pcs: [0x81a35f, 0x81a36d, 0x81a370, 0x81a375, 0x81a383, 0x81a391, 0x81a394, 0x81a39a],
      alts: [0x81a3ad, 0x81a3bb, 0x81a3be, 0x81a3c4],
    },
    {
      t: [
        [DP_BOX_X1, DP_VIEWER_CELL_X],
        [DP_BOX_Y1, DP_VIEWER_CELL_Y, 1],
        [DP_BOX_Y0, DP_VIEWER_CELL_Y, 1],
        [DP_BOX_X0, DP_VIEWER_CELL_X],
      ],
      alt: [
        [DP_BOX_Y0, DP_VIEWER_CELL_Y, 1],
        [DP_BOX_X0, DP_VIEWER_CELL_X],
      ],
      pcs: [0x81a3d5, 0x81a3e7, 0x81a3ea, 0x81a3ef, 0x81a401, 0x81a40f, 0x81a412, 0x81a418],
      alts: [0x81a42f, 0x81a43d, 0x81a440, 0x81a446],
    },
    {
      t: [
        [DP_BOX_X0, DP_VIEWER_CELL_X, 1],
        [DP_BOX_Y0, DP_VIEWER_CELL_Y],
        [DP_BOX_Y1, DP_VIEWER_CELL_Y],
        [DP_BOX_X1, DP_VIEWER_CELL_X, 1],
      ],
      alt: [
        [DP_BOX_Y1, DP_VIEWER_CELL_Y],
        [DP_BOX_X1, DP_VIEWER_CELL_X, 1],
      ],
      pcs: [0x81a45b, 0x81a469, 0x81a46c, 0x81a471, 0x81a47f, 0x81a491, 0x81a494, 0x81a49a],
      alts: [0x81a4ad, 0x81a4bf, 0x81a4c2, 0x81a4c8],
    },
    {
      t: [
        [DP_BOX_X0, DP_VIEWER_CELL_X, 1],
        [DP_BOX_Y1, DP_VIEWER_CELL_Y, 1],
        [DP_BOX_Y0, DP_VIEWER_CELL_Y, 1],
        [DP_BOX_X1, DP_VIEWER_CELL_X, 1],
      ],
      alt: [
        [DP_BOX_Y0, DP_VIEWER_CELL_Y, 1],
        [DP_BOX_X1, DP_VIEWER_CELL_X, 1],
      ],
      pcs: [0x81a4dd, 0x81a4ef, 0x81a4f2, 0x81a4f7, 0x81a509, 0x81a51b, 0x81a51e, 0x81a524],
      alts: [0x81a53b, 0x81a54d, 0x81a550, 0x81a556],
    },
  ];
  const blockedLine = () => {
    const q = QUADRANT_LINES[Math.min(dp(DP_QUADRANT), QUADRANT_LAST)],
      [first, second, third, fourth] = q.t,
      [firstAlt, secondAlt] = q.alt,
      [sta1, ldx2, sta2, cpx3, sta3, ldx4, sta4, cpx4] = q.pcs,
      [altSta1, altLdx2, altSta2, altCpx2] = q.alts;
    if (!term(first)) return false;
    h.load(ctx.a | dp(DP_SPAN_Y));
    wide(sta1, WRMPYA);
    if (!term(second)) {
      // Alternative branch (second term below zero).
      if (!term(firstAlt)) return false;
      h.load(ctx.a | dp(DP_SPAN_X));
      wide(altSta1, WRMPYA);
      if (!term(secondAlt)) {
        sec();
        return true;
      }
      h.load(ctx.a | dp(DP_SPAN_Y));
      h.index('x', product(altLdx2));
      wide(altSta2, WRMPYA);
      compare(ctx.x, product(altCpx2));
      if (carry()) {
        sec();
        return true;
      }
      return false;
    }
    h.load(ctx.a | dp(DP_SPAN_X));
    h.index('x', product(ldx2));
    wide(sta2, WRMPYA);
    h.load(dp(third[0]));
    compare(ctx.x, product(cpx3));
    if (!carry()) return false;
    if (!term(third, true)) {
      sec();
      return true;
    }
    h.load(ctx.a | dp(DP_SPAN_X));
    wide(sta3, WRMPYA);
    if (!term(fourth)) {
      sec();
      return true;
    }
    h.load(ctx.a | dp(DP_SPAN_Y));
    h.index('x', product(ldx4));
    wide(sta4, WRMPYA);
    compare(ctx.x, product(cpx4));
    if (carry()) {
      sec();
      return true;
    }
    return false;
  };
  // A55C quadrants: four terms to DP44/3E/47/41, then the division tails.
  const QUADRANT_SPANS = [
    {
      t: [
        [DP_BOX_X1, DP_VIEWER_CELL_X],
        [DP_BOX_X0, DP_VIEWER_CELL_X],
        [DP_BOX_Y1, DP_VIEWER_CELL_Y],
        [DP_BOX_Y0, DP_VIEWER_CELL_Y],
      ],
      pcs: [0x81a589, 0x81a5a5, 0x81a5a8, 0x81a5ae],
    },
    {
      t: [
        [DP_BOX_X1, DP_VIEWER_CELL_X],
        [DP_BOX_X0, DP_VIEWER_CELL_X],
        [DP_BOX_Y0, DP_VIEWER_CELL_Y, 1],
        [DP_BOX_Y1, DP_VIEWER_CELL_Y, 1],
      ],
      pcs: [0x81a682, 0x81a6ac, 0x81a6af, 0x81a6b5],
    },
    {
      t: [
        [DP_BOX_X0, DP_VIEWER_CELL_X, 1],
        [DP_BOX_X1, DP_VIEWER_CELL_X, 1],
        [DP_BOX_Y1, DP_VIEWER_CELL_Y],
        [DP_BOX_Y0, DP_VIEWER_CELL_Y],
      ],
      pcs: [0x81a6df, 0x81a701, 0x81a704, 0x81a70a],
    },
    {
      t: [
        [DP_BOX_X0, DP_VIEWER_CELL_X, 1],
        [DP_BOX_X1, DP_VIEWER_CELL_X, 1],
        [DP_BOX_Y0, DP_VIEWER_CELL_Y, 1],
        [DP_BOX_Y1, DP_VIEWER_CELL_Y, 1],
      ],
      pcs: [0x81a734, 0x81a75e, 0x81a761, 0x81a767],
    },
  ];
  // Division tails. 8-bit SBC of DP5C - DP26; below zero negates (EOR #$FF / INC A) and subtracts.
  const byteSbc = (v) => {
    const left = ctx.a & BYTE_MASK,
      c = ctx.status & FLAG_CARRY,
      sum = left - v - 1 + c,
      result = sum & BYTE_MASK;
    if (ctx.status & FLAG_DECIMAL) taskStop('task_binary_arithmetic_required');
    ctx.status =
      (ctx.status & ~(FLAG_CARRY | FLAG_OVERFLOW)) |
      Number(sum >= 0) |
      ((left ^ v) & (left ^ result) & BYTE_SIGN ? FLAG_OVERFLOW : 0);
    h.load(result, 1);
  };
  const divide = (scale, divisor, pcs, negative) => {
    // pcs: [STA 4202, STA 4203, LDA 4216, STA 4204, STA 4206, ADC/SBC 4214]
    const [factorPc, scalePc, productPc, dividendPc, divisorPc, quotientPc] = pcs;
    if (negative) {
      h.load((ctx.a & BYTE_MASK) ^ BYTE_MASK, 1);
      h.load((ctx.a + 1) & BYTE_MASK, 1);
    }
    byte(factorPc, WRMPYA);
    h.load(a.read(scale, 'a25f-scale-BYTE'), 1);
    byte(scalePc, WRMPYB);
    ctx.status &= ~FLAG_MEMORY_8BIT;
    h.load(product(productPc));
    wide(dividendPc, WRDIVL);
    ctx.status |= FLAG_MEMORY_8BIT;
    h.load(a.read(divisor, 'a25f-divisor-BYTE'), 1);
    byte(divisorPc, WRDIVB);
    ctx.status &= ~FLAG_MEMORY_8BIT;
    const quotient = a.absoluteRead(RDDIVL, 2, quotientPc, 'a25f-quotient');
    if (!negative) {
      clc();
      h.load(dp(DP_EYE_HEIGHT));
      adc(quotient);
      if (carry()) return true;
      compare(ctx.a, dp(DP_TARGET_BOTTOM));
      if (!carry()) return false;
    } else {
      clc();
      h.load(dp(DP_EYE_HEIGHT));
      sbc(quotient);
      if (!carry()) return false;
      compare(ctx.a, dp(DP_TARGET_BOTTOM));
      if (!carry()) return false;
    }
    // A656: height check against DP2F/DP65; a lower box marks DP68.
    sec();
    sbc(dp(DP_TARGET_TOP));
    if (carry()) return true;
    h.load(ctx.a ^ WORD_MASK);
    h.load((ctx.a + 1) & WORD_MASK);
    h.asl();
    compare(ctx.a, dp(DP_TARGET_BOX_HEIGHT));
    if (!carry()) {
      h.load(WORD_MASK);
      st(DP_LOW_BOX);
    }
    clc();
    return false;
  };
  const TAILS = {
    b3: {
      scale: DP_SPAN_X_HIGH,
      divisor: DP_X_DIVISOR,
      pcs: [0x81a5bc, 0x81a5c1, 0x81a5c7, 0x81a5ca, 0x81a5d1, 0x81a601],
      negative: {
        divisor: DP_X_NEGATIVE_DIVISOR,
        pcs: [0x81a60e, 0x81a613, 0x81a619, 0x81a61c, 0x81a623, 0x81a64d],
      },
    },
    d9: {
      scale: DP_SPAN_Y_HIGH,
      divisor: DP_Y_DIVISOR,
      pcs: [0x81a5e2, 0x81a5e7, 0x81a5ed, 0x81a5f0, 0x81a5f7, 0x81a601],
      negative: {
        divisor: DP_Y_NEGATIVE_DIVISOR,
        pcs: [0x81a62e, 0x81a633, 0x81a639, 0x81a63c, 0x81a643, 0x81a64d],
      },
    },
  };
  const tail = (t) => {
    ctx.status |= FLAG_MEMORY_8BIT;
    sec();
    h.load(a.read(DP_BOX_HEIGHT, 'a25f-height-BYTE'), 1);
    byteSbc(a.read(DP_EYE_HEIGHT, 'a25f-base-BYTE'));
    if (carry()) return divide(t.scale, t.divisor, t.pcs, false);
    return divide(t.scale, t.negative.divisor, t.negative.pcs, true);
  };
  const span = () => {
    h.index('x', 0);
    const q = QUADRANT_SPANS[Math.min(dp(DP_QUADRANT), QUADRANT_LAST)],
      [xNegative, x, yNegative, y] = q.t,
      [firstSta, ldx, secondSta, cpy] = q.pcs;
    term(xNegative);
    st(DP_X_NEGATIVE_DIVISOR);
    term(x);
    st(DP_X_DIVISOR);
    if (!carry()) h.index('x', (ctx.x + 1) & WORD_MASK);
    h.load(ctx.a | dp(DP_SPAN_Y));
    wide(firstSta, WRMPYA);
    term(yNegative);
    st(DP_Y_NEGATIVE_DIVISOR);
    term(y);
    st(DP_Y_DIVISOR);
    h.index('x', (ctx.x - 1) & WORD_MASK);
    if (ctx.status & FLAG_ZERO) return tail(TAILS.d9);
    if (!carry()) return tail(TAILS.b3);
    h.load(ctx.a | dp(DP_SPAN_X));
    h.index('x', product(ldx));
    wide(secondSta, WRMPYA);
    compare(ctx.y, product(cpy));
    return tail(carry() ? TAILS.d9 : TAILS.b3);
  };
  const call = (returnWord, run) => {
    a.pushWord(returnWord, 'a25f-JSR');
    const result = run();
    const raw = a.pullWord('a25f-RTS');
    if (raw !== returnWord)
      taskStop('task_native_helper_return_required', { actual: raw, expected: returnWord });
    return result;
  };
  const rtl = () => {
    const raw = a.pullWord('a25f-RTL-WORD');
    ctx.s = (ctx.s + 1) & WORD_MASK;
    const bank = a.read(ctx.s, 'a25f-RTL-bank');
    ctx.pc = (raw + 1) & WORD_MASK;
    ctx.programBank = bank;
    return raw;
  };
  st(DP_LOW_BOX, 0);
  h.load(indirect(0));
  h.load(ctx.a & BYTE_MASK);
  if (ctx.status & FLAG_ZERO) {
    clc();
    return { rawReturnWord: rtl(), blocked: false };
  }
  st(DP_BOXES_LEFT);
  st(DP_QUADRANT, 0);
  const field = (offset, index) => h.longRead(h.abs(offset) + index);
  h.load(field(OBJECT_X, ctx.y));
  lsr();
  lsr();
  st(DP_LINE_MIN_X);
  st(DP_LINE_MAX_X);
  lsr();
  lsr();
  st(DP_VIEWER_CELL_X);
  h.load(field(OBJECT_Y, ctx.y));
  lsr();
  lsr();
  st(DP_LINE_MIN_Y);
  st(DP_LINE_MAX_Y);
  lsr();
  lsr();
  st(DP_VIEWER_CELL_Y);
  h.load(field(OBJECT_X, ctx.x));
  lsr();
  lsr();
  compare(ctx.a, dp(DP_LINE_MIN_X));
  if (carry()) st(DP_LINE_MAX_X);
  else st(DP_LINE_MIN_X);
  lsr();
  lsr();
  sec();
  sbc(dp(DP_VIEWER_CELL_X));
  if (!carry()) {
    h.load(ctx.a ^ WORD_MASK);
    h.load((ctx.a + 1) & WORD_MASK);
    incDp(DP_QUADRANT);
    incDp(DP_QUADRANT);
  }
  xba();
  st(DP_SPAN_X);
  h.load(field(OBJECT_Y, ctx.x));
  lsr();
  lsr();
  compare(ctx.a, dp(DP_LINE_MIN_Y));
  if (carry()) st(DP_LINE_MAX_Y);
  else st(DP_LINE_MIN_Y);
  lsr();
  lsr();
  sec();
  sbc(dp(DP_VIEWER_CELL_Y));
  if (!carry()) {
    h.load(ctx.a ^ WORD_MASK);
    h.load((ctx.a + 1) & WORD_MASK);
    incDp(DP_QUADRANT);
  }
  xba();
  st(DP_SPAN_Y);
  h.load(h.longRead(WRAM + OBJECT_BOX_HEIGHT + ctx.x));
  st(DP_TARGET_BOX_HEIGHT);
  h.load(field(OBJECT_HEIGHT, ctx.x));
  lsr();
  lsr();
  st(DP_TARGET_BOTTOM);
  clc();
  adc(dp(DP_TARGET_BOX_HEIGHT));
  st(DP_TARGET_TOP);
  h.index('x', ctx.y);
  h.load(h.longRead(WRAM + OBJECT_BOX_HEIGHT + ctx.x));
  lsr();
  st(DP_EYE_HEIGHT);
  lsr();
  clc();
  adc(dp(DP_EYE_HEIGHT));
  st(DP_EYE_HEIGHT);
  h.load(field(OBJECT_HEIGHT, ctx.x));
  lsr();
  lsr();
  clc();
  adc(dp(DP_EYE_HEIGHT));
  st(DP_EYE_HEIGHT);
  h.index('y', 1);
  const iny = (n) => {
    for (let k = 0; k < n; k++) h.index('y', (ctx.y + 1) & WORD_MASK);
  };
  let left;
  do {
    for (const [target, step] of [
      [DP_BOX_X0, 2],
      [DP_BOX_Y0, BOX_Y0_STEP],
      [DP_BOX_X1, 2],
      [DP_BOX_Y1, 2],
      [DP_BOX_HEIGHT, 2],
    ]) {
      h.load(indirect(ctx.y));
      st(target);
      iny(step);
    }
    if (
      call(callReturn(0x81a317), boxes) &&
      call(callReturn(0x81a31c), blockedLine) &&
      call(callReturn(0x81a321), span)
    )
      return { rawReturnWord: rtl(), blocked: true };
    left = h.nz((dp(DP_BOXES_LEFT) - 1) & WORD_MASK);
    st(DP_BOXES_LEFT, left);
  } while (left !== 0);
  clc();
  h.load(dp(DP_LOW_BOX));
  return { rawReturnWord: rtl(), blocked: false };
}
