import { taskTextAccess } from './native-text-prerequisites.mjs';

import { DIALOG_WINDOW, WRAM, JAKE_COUNT_MAX, GROUP_INDEX, WINDOW_MAP_BUFFER } from './wram.mjs';
import { WORD_SIGN, WORD_MASK, BYTE_MASK } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';
import {
  WRDIVL,
  WRDIVH,
  WRDIVB,
  RDDIVL,
  RDDIVH,
  RDMPYL,
  RDMPYH,
} from '../constants/hardware-registers.mjs';

// Fixed AF1F positions within the A9B2 window map buffer (81:AF3E..AF9D).
const BAR_TOP_CAP_ADDRESS = WRAM + WINDOW_MAP_BUFFER + 0x7c;
const BAR_MIDDLE_CAP_ADDRESS = WRAM + WINDOW_MAP_BUFFER + 0xbc;
const BAR_BOTTOM_CAP_ADDRESS = WRAM + WINDOW_MAP_BUFFER + 0xfc;
const BAR_TOP_ROW_ADDRESS = WRAM + WINDOW_MAP_BUFFER + 0x66;
const BAR_MIDDLE_ROW_ADDRESS = WRAM + WINDOW_MAP_BUFFER + 0xa6;
const BAR_BOTTOM_ROW_ADDRESS = WRAM + WINDOW_MAP_BUFFER + 0xe6;

const BAR_TOP_CAP_TILE = 0x6c04;
const BAR_MIDDLE_CAP_TILE = 0x6c07;
const BAR_BOTTOM_CAP_TILE = 0xec04;
const BAR_TOP_LOOP_TILE = 0x2c05;
const BAR_MIDDLE_LOOP_TILE = 0x2c10;
const BAR_BOTTOM_LOOP_TILE = 0xac05;
const BAR_TOP_REMAINDER_TILE = 0x2c06;
const BAR_TOP_ZERO_REMAINDER_TILE = 0x2c04;
const BAR_MIDDLE_REMAINDER_TILE = 0x2c15;
const BAR_MIDDLE_ZERO_REMAINDER_TILE = 0x2c07;
const BAR_BOTTOM_REMAINDER_TILE = 0xac06;
const BAR_BOTTOM_ZERO_REMAINDER_TILE = 0xac04;
const BAR_MIDDLE_DIFFERENCE_TILE = 0x2c08;

// AF1F reuses these scratch words; they are not the FB39 text workspace here.
const DP_BAR_PARAMETER = 0xa8;
const DP_BAR_QUOTIENT = 0xa2;
const DP_BAR_REMAINDER = 0xa5;
const BAR_DIVISOR = 20;
const BAR_INITIAL_COLUMN_OFFSET = 20;
const BAR_ROUND_UP_BIAS = 19;
const BAR_PARTIAL_ADJUSTMENT = 0xa;
const BAR_PARAMETER_THRESHOLD = 0xb;
const BAR_PARTIAL_TABLE_BIAS = 0xb;

const registers = Object.freeze({
  writes: Object.freeze([WRDIVL, WRDIVH, WRDIVB]),
  reads: Object.freeze([RDDIVL, RDDIVH, RDMPYL, RDMPYH]),
  observationPcs: Object.freeze([
    0x81af56, 0x81af73, 0x81afc9, 0x81afce, 0x81afec, 0x81b009, 0x81b016,
  ]),
});
export { registers as af1fRegisters };

// 81:AF1F: draw Jake's state count bar into the window map buffer (nothing without a
// dialog window or with an empty group): the bar length is the state count maximum / 20,
// the filled part the current state count. Original complete overlay graph. Hardware
// result WORDs are independent
// chronological observations, including repeated reads after later stores.
export function drawJakeStateBar(a, outerReturn = true) {
  const h = taskTextAccess(a),
    { ctx } = h;
  let firstVisits = 0,
    middleVisits = 0,
    tableOffset = null;
  const index = (name, value) => {
    ctx[name] = h.nz(value, 2);
  };
  const compare = (left, right) => {
    ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
    h.nz((left - right) & WORD_MASK, 2);
  };
  const divide = (wordPc, bytePc) => {
    a.absoluteWrite(WRDIVL, ctx.a, 2, wordPc, 'AF1F-dividend');
    ctx.status |= FLAG_MEMORY_8BIT;
    h.load(BAR_DIVISOR);
    a.absoluteWrite(WRDIVB, ctx.a & BYTE_MASK, 1, bytePc, 'AF1F-divisor');
    ctx.status &= ~FLAG_MEMORY_8BIT;
  };
  const result = (offset, pc) => a.absoluteRead(offset, 2, pc, 'AF1F-result-fresh');
  h.load(h.read(h.abs(DIALOG_WINDOW)));
  if (ctx.a === 0)
    return {
      ...h.finish(outerReturn),
      outcome: 'af1f_zero',
      firstVisits,
      middleVisits,
      tableOffset,
    };
  h.load(h.read(WRAM + GROUP_INDEX));
  if (ctx.a & WORD_SIGN)
    return {
      ...h.finish(outerReturn),
      outcome: 'af1f_negative',
      firstVisits,
      middleVisits,
      tableOffset,
    };
  h.load(h.read(WRAM + JAKE_COUNT_MAX));
  h.load(ctx.a & BYTE_MASK);
  divide(0x81af32, 0x81af39);
  for (const [address, value] of [
    [BAR_TOP_CAP_ADDRESS, BAR_TOP_CAP_TILE],
    [BAR_MIDDLE_CAP_ADDRESS, BAR_MIDDLE_CAP_TILE],
    [BAR_BOTTOM_CAP_ADDRESS, BAR_BOTTOM_CAP_TILE],
  ]) {
    h.load(value);
    h.write(address, ctx.a);
  }
  index('x', BAR_INITIAL_COLUMN_OFFSET);
  index('y', result(RDDIVL, 0x81af56));
  do {
    firstVisits++;
    for (const [address, value] of [
      [BAR_TOP_ROW_ADDRESS, BAR_TOP_LOOP_TILE],
      [BAR_MIDDLE_ROW_ADDRESS, BAR_MIDDLE_LOOP_TILE],
      [BAR_BOTTOM_ROW_ADDRESS, BAR_BOTTOM_LOOP_TILE],
    ]) {
      h.load(value);
      h.write(address + ctx.x, ctx.a);
    }
    index('x', (ctx.x - 1) & WORD_MASK);
    index('x', (ctx.x - 1) & WORD_MASK);
    index('y', (ctx.y - 1) & WORD_MASK);
  } while (ctx.y !== 0);
  h.load(result(RDMPYL, 0x81af73));
  const nonzero = ctx.a !== 0;
  for (const [address, value] of [
    [BAR_TOP_ROW_ADDRESS, nonzero ? BAR_TOP_REMAINDER_TILE : BAR_TOP_ZERO_REMAINDER_TILE],
    [BAR_MIDDLE_ROW_ADDRESS, nonzero ? BAR_MIDDLE_REMAINDER_TILE : BAR_MIDDLE_ZERO_REMAINDER_TILE],
    [BAR_BOTTOM_ROW_ADDRESS, nonzero ? BAR_BOTTOM_REMAINDER_TILE : BAR_BOTTOM_ZERO_REMAINDER_TILE],
  ]) {
    h.load(value);
    h.write(address + ctx.x, ctx.a);
  }
  h.load(h.read(WRAM + JAKE_COUNT_MAX));
  h.load(ctx.a & BYTE_MASK);
  divide(0x81afab, 0x81afb2);
  h.load(h.read(0x8db8d2));
  index('x', ctx.a);
  h.load(h.read(WRAM + 2 + ctx.x));
  h.load(ctx.a & BYTE_MASK);
  h.dpWrite(DP_BAR_PARAMETER, ctx.a);
  ctx.status &= ~FLAG_CARRY;
  h.arithmetic(BAR_ROUND_UP_BIAS);
  index('y', result(RDDIVL, 0x81afc9));
  h.dpWrite(DP_BAR_QUOTIENT, ctx.y);
  index('y', result(RDMPYL, 0x81afce));
  h.dpWrite(DP_BAR_REMAINDER, ctx.y);
  if (ctx.y !== 0) {
    ctx.status |= FLAG_CARRY;
    h.arithmetic(BAR_PARTIAL_ADJUSTMENT, true);
  }
  divide(0x81afd9, 0x81afe0);
  index('x', BAR_INITIAL_COLUMN_OFFSET);
  ctx.status |= FLAG_CARRY;
  h.load(h.dp(DP_BAR_QUOTIENT));
  h.arithmetic(result(RDDIVL, 0x81afec), true);
  if (ctx.a !== 0) {
    index('y', ctx.a);
    do {
      middleVisits++;
      h.load(BAR_MIDDLE_DIFFERENCE_TILE);
      h.write(BAR_MIDDLE_ROW_ADDRESS + ctx.x, ctx.a);
      index('x', (ctx.x - 1) & WORD_MASK);
      index('x', (ctx.x - 1) & WORD_MASK);
      index('y', (ctx.y - 1) & WORD_MASK);
    } while (ctx.y !== 0);
  }
  index('y', h.dp(DP_BAR_REMAINDER));
  let table = true;
  if (ctx.y !== 0) {
    h.load(h.dp(DP_BAR_PARAMETER));
    compare(ctx.a, BAR_PARAMETER_THRESHOLD);
    if (!(ctx.status & FLAG_CARRY)) {
      h.load(result(RDMPYL, 0x81b009));
      ctx.status &= ~FLAG_CARRY;
      h.arithmetic(BAR_PARTIAL_TABLE_BIAS);
    } else h.load(result(RDMPYL, 0x81b016));
  } else {
    h.load(h.dp(DP_BAR_PARAMETER));
    if (ctx.a === 0) table = false;
    else h.load(result(RDMPYL, 0x81b016));
  }
  if (table) {
    h.asl();
    tableOffset = ctx.a;
    a.pushWord(ctx.x, 'AF1F-PHX');
    index('x', ctx.a);
    h.load(h.read(0x81b026 + ctx.x));
    index('x', a.pullWord('AF1F-PLX-fresh'));
    h.write(BAR_MIDDLE_ROW_ADDRESS + ctx.x, ctx.a);
  }
  return {
    ...h.finish(outerReturn),
    outcome: 'af1f_active',
    firstVisits,
    middleVisits,
    tableOffset,
  };
}
