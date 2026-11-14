import {
  WRAM,
  WINDOW_COLUMNS,
  WINDOW_ROWS,
  WINDOW_TILE_START,
  WINDOW_CURSOR_TILE,
  WINDOW_CURSOR_PIXEL,
  TEXT_BUFFER,
  MENU_PAGE_START,
  MENU_COLUMN,
  MENU_ROW,
  MENU_DRAW_ROW,
  MENU_ROWS_REMAINING,
  MENU_SHOW_NUMBERS,
  DP_CURSOR_ROW,
  DP_LIST_TOKENS,
  DP_LIST_TOKEN_BANK,
  DP_LIST_VALUES,
  DP_MENU_VISIBLE_ROWS as DP_VISIBLE_ROWS,
} from './wram.mjs';
import { taskStop } from './plan.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { taskTextAccess } from './native-text-prerequisites.mjs';
import { printText, drawTextBuffer } from './native-text-compose.mjs';
import {
  BANK_WRAP,
  WORD_MASK,
  BANK_SIZE,
  BYTE_MASK,
  WORD_BITS,
  LONG_MASK,
} from '../constants/bits.mjs';
import { FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT, FLAG_CARRY } from '../constants/cpu-flags.mjs';
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
import { WRAM_BANK_PAIR, CODE_BANK } from '../constants/memory-map.mjs';

const JSR_BYTES = 0x3;
const DECIMAL_WORD_DIGITS = 0x5;
const DECIMAL_RADIX = 0xa;
const CHARACTER_ZERO = 0x30;
const TEXT_UNMARK = 0x707d;
const TEXT_MARK = 0x7074;
const TEXT_MORE = 0x707a;
const TEXT_PREVIOUS = 0x7077;

const devices = Object.freeze({
  writes: Object.freeze([WRMPYA, WRMPYB, WRDIVL, WRDIVH, WRDIVB]),
  reads: Object.freeze([RDDIVL, RDDIVH, RDMPYL, RDMPYH]),
  observationPcs: Object.freeze([
    0x80facd, 0x80fd9e, 0x80fda7, 0x81addd, 0x81ae39, 0x81ae73, 0x81ae7d, 0x81ae94,
  ]),
});
export { devices as taskListDevices };

function access(a, events) {
  if (a.ctx.programBank !== CODE_BANK) taskStop('task_text_entry_required');
  const h = taskTextAccess(a),
    { ctx } = h;
  const index = (name, value) => {
    ctx[name] = h.nz(value, 2);
  };
  const finish = (outer) => {
    if (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)) taskStop('task_text_word_mode_required');
    const rawReturnWord = a.readWord((ctx.s + 1) & WORD_MASK, BANK_WRAP, 'list-outer-RTS', outer);
    ctx.s = (ctx.s + 2) & WORD_MASK;
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    return {
      rawReturnWord,
      returnTarget: ctx.programBank * BANK_SIZE + ctx.pc,
      returnTargetExecuted: false,
      dynamicDispatchExecuted: false,
      frontier: 'observed-outer-RTS-target',
      scope: 'manual-source-specific-whole-list-helper',
    };
  };
  const call = (pc, target, run, saveY = false) => {
    const bank = ctx.programBank;
    if (saveY) a.pushWord(ctx.y, 'list-PHY');
    a.pushWord((pc + 2) & WORD_MASK, 'list-inner-JSR');
    ctx.pc = target & WORD_MASK;
    const result = run();
    if (
      result.rawReturnWord !== ((pc + 2) & WORD_MASK) ||
      result.returnTarget !== bank * BANK_SIZE + ((pc + JSR_BYTES) & WORD_MASK) ||
      ctx.programBank !== bank
    )
      taskStop('task_native_helper_return_required', {
        pc,
        raw: result.rawReturnWord,
        target: result.returnTarget,
      });
    if (saveY) index('y', a.pullWord('list-PLY-fresh'));
    events.calls.push(
      Object.freeze({
        pc,
        target,
        rawReturnWord: result.rawReturnWord,
        returnTarget: result.returnTarget,
        saveY,
        outcome: result.outcome,
      }),
    );
    return result;
  };
  const text = (token, pc, saveY = false) => {
    h.load(token);
    h.dpWrite(2, ctx.a);
    return call(pc, 0x80fe69, () => printText(a, events, false), saveY);
  };
  return { ...h, index, finish, call, text };
}

// 80:FAAC: set the text cursor (row and column) in the window of the first argument.
export function setTextCursor(a, events, outerReturn = true) {
  const h = access(a, events),
    { ctx } = h;
  h.selectBank();
  h.index('x', h.dp(0));
  ctx.status |= FLAG_MEMORY_8BIT;
  h.load(h.dp(DP_CURSOR_ROW));
  a.absoluteWrite(WRMPYA, ctx.a & BYTE_MASK, 1, 0x80fab8, 'FAAC-row');
  h.load(h.read(WRAM + WINDOW_COLUMNS + ctx.x));
  h.load((ctx.a - 1) & BYTE_MASK);
  h.load((ctx.a - 1) & BYTE_MASK);
  a.absoluteWrite(WRMPYB, ctx.a & BYTE_MASK, 1, 0x80fac1, 'FAAC-width-minus-two');
  ctx.status &= ~FLAG_MEMORY_8BIT;
  ctx.status &= ~FLAG_CARRY;
  h.load(h.read(WRAM + WINDOW_TILE_START + ctx.x));
  h.arithmetic(h.dp(2));
  h.arithmetic(a.absoluteRead(RDMPYL, 2, 0x80facd, 'FAAC-observed-product'));
  h.write(WRAM + WINDOW_CURSOR_TILE + ctx.x, ctx.a);
  h.load(0);
  h.write(WRAM + WINDOW_CURSOR_PIXEL + ctx.x, ctx.a);
  h.restoreBank();
  return { ...h.finish(outerReturn), outcome: 'cursor_prepared' };
}

// 80:FD80: print a number into a window through FB39. routines (optional) replaces FB39
// by a table entry that ends with its RTS, as the function test of the lifted number
// (src/game/window-text.mjs) does.
export function printNumber(a, events, outerReturn = true, routines = null) {
  const h = access(a, events),
    { ctx } = h;
  let divisions = 0,
    copiedBytes = 0;
  h.load(0);
  h.write(WRAM + TEXT_BUFFER + DECIMAL_WORD_DIGITS, ctx.a);
  h.index('x', DECIMAL_WORD_DIGITS);
  h.load(h.dp(2));
  do {
    a.absoluteWrite(WRDIVL, ctx.a, 2, 0x80fd8c, 'FD80-dividend');
    ctx.status |= FLAG_MEMORY_8BIT;
    h.load(DECIMAL_RADIX);
    a.absoluteWrite(WRDIVB, ctx.a & BYTE_MASK, 1, 0x80fd93, 'FD80-divisor');
    h.index('x', (ctx.x - 1) & WORD_MASK);
    ctx.status &= ~FLAG_CARRY;
    h.load(CHARACTER_ZERO);
    h.arithmetic(a.absoluteRead(RDMPYL, 1, 0x80fd9e, 'FD80-byte-remainder'));
    h.write(WRAM + TEXT_BUFFER + ctx.x, ctx.a & BYTE_MASK);
    ctx.status &= ~FLAG_MEMORY_8BIT;
    h.load(a.absoluteRead(RDDIVL, 2, 0x80fda7, 'FD80-word-quotient'));
    divisions++;
  } while (ctx.a !== 0);
  h.pushByte(ctx.bank, 'FD80-PHB');
  a.pushWord(WRAM_BANK_PAIR, 'FD80-PEA');
  ctx.bank = h.pullByte('FD80-PLB-first');
  h.nz(ctx.bank, 1);
  ctx.bank = h.pullByte('FD80-PLB-second');
  h.nz(ctx.bank, 1);
  ctx.status = (ctx.status & ~FLAG_CARRY) | FLAG_CARRY;
  h.nz(ctx.x, 2);
  if (ctx.x !== 0) {
    h.index('y', 0);
    ctx.status |= FLAG_MEMORY_8BIT;
    for (;;) {
      h.load(h.read(h.abs(TEXT_BUFFER) + ctx.x));
      h.write(h.abs(TEXT_BUFFER) + ctx.y, ctx.a & BYTE_MASK);
      copiedBytes++;
      if ((ctx.a & BYTE_MASK) === 0) break;
      h.index('x', (ctx.x + 1) & WORD_MASK);
      h.index('y', (ctx.y + 1) & WORD_MASK);
    }
    ctx.status &= ~FLAG_MEMORY_8BIT;
  }
  const composed = h.call(0x80fdca, 0x80fb39, () => {
    if (!routines?.has(0x80fb39)) return drawTextBuffer(a, events, false);
    const rawReturnWord = routines.get(0x80fb39)(dialogAccess(a), events);
    return { rawReturnWord, returnTarget: ctx.programBank * BANK_SIZE + ctx.pc };
  });
  ctx.bank = h.pullByte('FD80-PLB-restored-fresh');
  h.nz(ctx.bank, 1);
  return {
    ...h.finish(outerReturn),
    outcome: 'number_composed',
    divisions,
    copiedBytes,
    glyphs: composed.glyphs,
  };
}

export function runTaskListHelper(a, events, entry, outerReturn = true) {
  if (entry === 0x80faac) return setTextCursor(a, events, outerReturn);
  if (entry === 0x80fd80) return printNumber(a, events, outerReturn);
  if (![0x80a617, 0x80a5db, 0x80a5f9].includes(entry)) taskStop('task_text_entry_required');
  const h = access(a, events),
    { ctx } = h;
  let visits = 0,
    rows = 0,
    numbers = 0,
    more = false,
    previous = false;
  const field = (offset) => h.read(h.abs(offset)),
    store = (offset, value) => h.write(h.abs(offset), value);
  const cursor = (pc) => h.call(pc, 0x80faac, () => setTextCursor(a, events, false));
  const token = () => {
    const pointer = h.dp(DP_LIST_TOKENS, 2) | (h.dp(DP_LIST_TOKEN_BANK, 1) << WORD_BITS);
    return h.read((pointer + ctx.y) & LONG_MASK, 2);
  };
  const number = () => h.read((h.abs(h.dp(DP_LIST_VALUES, 2)) + ctx.y) & LONG_MASK, 2);
  const dec = () => h.load((ctx.a - 1) & WORD_MASK);
  if (entry !== 0x80a617) {
    h.load(ctx.y);
    ctx.status |= FLAG_CARRY;
    h.arithmetic(field(MENU_PAGE_START), true);
    h.lsr();
    ctx.status &= ~FLAG_CARRY;
    h.arithmetic(field(MENU_ROW));
    h.dpWrite(DP_CURSOR_ROW, ctx.a);
    h.load(field(MENU_COLUMN));
    dec();
    h.dpWrite(2, ctx.a);
    cursor(entry === 0x80a5db ? 0x80a5ed : 0x80a60b);
    h.text(entry === 0x80a5db ? TEXT_UNMARK : TEXT_MARK, entry === 0x80a5db ? 0x80a5f5 : 0x80a613);
  } else {
    h.load(field(MENU_ROW));
    store(MENU_DRAW_ROW, ctx.a);
    h.load(h.dp(DP_VISIBLE_ROWS));
    store(MENU_ROWS_REMAINING, ctx.a);
    h.index('y', field(MENU_PAGE_START));
    for (;;) {
      visits++;
      h.load(field(MENU_COLUMN));
      h.dpWrite(2, ctx.a);
      h.load(field(MENU_DRAW_ROW));
      h.dpWrite(DP_CURSOR_ROW, ctx.a);
      h.load((ctx.a + 1) & WORD_MASK);
      store(MENU_DRAW_ROW, ctx.a);
      cursor(0x80a633);
      h.load(token());
      if (ctx.a === 0) break;
      h.dpWrite(2, ctx.a);
      h.call(0x80a63d, 0x80fe69, () => printText(a, events, false), true);
      rows++;
      h.load(field(MENU_SHOW_NUMBERS));
      if (ctx.a !== 0) {
        h.load(number());
        if (ctx.a !== 0) {
          h.text(TEXT_UNMARK, 0x80a650, true);
          h.load(number());
          h.dpWrite(2, ctx.a);
          h.call(0x80a659, 0x80fd80, () => printNumber(a, events, false), true);
          numbers++;
        }
      }
      h.index('y', (ctx.y + 1) & WORD_MASK);
      h.index('y', (ctx.y + 1) & WORD_MASK);
      const remaining = h.nz((field(MENU_ROWS_REMAINING) - 1) & WORD_MASK, 2);
      store(MENU_ROWS_REMAINING, remaining);
      if (remaining !== 0) continue;
      h.load(token());
      if (ctx.a !== 0) {
        more = true;
        h.index('x', h.dp(0));
        h.load(h.read(WRAM + WINDOW_COLUMNS + ctx.x));
        dec();
        dec();
        dec();
        h.dpWrite(2, ctx.a);
        h.load(h.read(WRAM + WINDOW_ROWS + ctx.x));
        dec();
        dec();
        dec();
        h.dpWrite(DP_CURSOR_ROW, ctx.a);
        cursor(0x80a67c);
        h.text(TEXT_MORE, 0x80a684);
      }
      break;
    }
    h.load(field(MENU_PAGE_START));
    if (ctx.a !== 0) {
      previous = true;
      h.index('x', h.dp(0));
      h.load(h.read(WRAM + WINDOW_COLUMNS + ctx.x));
      dec();
      dec();
      dec();
      h.dpWrite(2, ctx.a);
      h.dpWrite(DP_CURSOR_ROW, 0);
      cursor(0x80a699);
      h.text(TEXT_PREVIOUS, 0x80a6a1);
    }
  }
  return {
    ...h.finish(outerReturn),
    outcome: entry === 0x80a617 ? 'list_composed' : 'mark_composed',
    visits,
    rows,
    numbers,
    more,
    previous,
  };
}
