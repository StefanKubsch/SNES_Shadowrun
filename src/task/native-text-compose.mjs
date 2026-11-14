import { WRAM_BANK_PAIR } from '../constants/memory-map.mjs';
import {
  TEXT_MASK_BUFFER,
  TEXT_COMPOSE_STYLE,
  TEXT_PIXEL_OFFSET,
  TEXT_WORK_WORD,
  TEXT_INITIAL_MASK,
  TEXT_WORD_STATE,
  TEXT_CHARACTER_INDEX,
  TEXT_LINE_PIXELS,
  TEXT_PENDING_BYTES,
  TEXT_GLYPH_ROW,
  TEXT_GLYPH_BITS,
  TEXT_GLYPH_HIGH,
  TEXT_SOURCE_BANK_WORD,
  TEXT_SOURCE_POINTER,
  TEXT_SOURCE_BANK,
  TEXT_BITS_REMAINING,
  TEXT_BUFFER_VRAM_ADDRESS,
  WRAM,
  WINDOW_CURSOR_TILE,
  WINDOW_CURSOR_PIXEL,
  WINDOW_STYLE,
  TEXT_BUFFER,
} from './wram.mjs';
import { portTextAddress } from '../data/port-extension.mjs';
import { languageText } from '../data/language.mjs';
import { taskStop } from './plan.mjs';
import {
  taskTextAccess,
  readTextBit,
  runTaskTextGeometry,
  closeTextMask,
  runTaskTextWait,
} from './native-text-prerequisites.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { InterruptStepContinuation, RequestWaitContinuation } from './main-wait-interrupt.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
} from './native-call-continuation.mjs';
import {
  BYTE_MASK,
  WORD_MASK,
  BANK_SIZE,
  BYTE_SIGN,
  WORD_SIGN,
  WORD_BITS,
  BYTE_BITS,
  BANK_WRAP,
} from '../constants/bits.mjs';
import {
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_CARRY,
  FLAG_ZERO,
  FLAG_NEGATIVE,
} from '../constants/cpu-flags.mjs';

const TEXT_MASK_BYTES = 0x10;
const GLYPH_BOLD_STYLE = 0x8;
const TEXT_TILE_PIXEL_SHIFT = 0x3;
const TEXT_TILE_VRAM_START = 0x5000;
const EMPTY_WORD_WIDTH = 0x5;
const GLYPH_LAST_ROW = 0x7;
const GLYPH_ROW_SHIFT_STYLES = 0x60;
const GLYPH_SHIFT_LOW_ROW_INDICES = 0x20;
const GLYPH_ROW_SHIFT_BOUNDARY = 0x5;
const GLYPH_SHIFT_HIGH_ROW_INDICES = 0x40;
const GLYPH_UNDERLINE_STYLE = 0x10;
const GLYPH_UNDERLINE_SKIP_INDEX = 0x107;
const GLYPH_ROW_PIXELS = 0x8;
const GLYPH_PIXEL_MASK = 0x7;
const TEXT_MASK_ADVANCE_SUBTRAHEND = 0xf;
const TEXT_TILE_BYTE_SHIFT = 0x4;

const TEXT_MASK_WORDS = 0x8;
const TEXT_MASK_LAST_WORD = 0xe;
export const TEXT_POINTER_BANK_SEED = 0x9dff;
export const HUFFMAN_CHARACTER_PAIR_MASK = 0x7f7f;
const CHARACTER_SPACE = 0x20;
const CHARACTER_STYLE_TOGGLE = 0x7c;
const CHARACTER_STYLE_PLACEHOLDER = 0x1a;
const CHARACTER_LOWERCASE_FIRST = 0x61;
const CHARACTER_LOWERCASE_END = 0x7b;
const CHARACTER_UPPERCASE_MASK = 0x5f;
export const HUFFMAN_TEXT_END = 0xa;

// Glyph widths 81:AC0C; window styles in DP AE with bits 68 draw each glyph one pixel wider.
const GLYPH_WIDTHS = 0x81ac0c,
  GLYPH_EXTRA_STYLE = 0x68,
  DP_WINDOW_STYLE = TEXT_COMPOSE_STYLE, // style of the window being composed
  DP_LINE_REST = TEXT_LINE_PIXELS; // pixels left on the line
const wordMode = (ctx) => {
  if (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)) taskStop('task_text_word_mode_required');
};
const byteMode = (ctx) => {
  if ((ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)) !== FLAG_MEMORY_8BIT)
    taskStop('task_text_byte_mode_required');
};
function returnRTS(a, outerReturn) {
  wordMode(a.ctx);
  const rawReturnWord = a.readWord(
    (a.ctx.s + 1) & WORD_MASK,
    BANK_WRAP,
    'text-compose-RTS-fresh',
    outerReturn,
  );
  a.ctx.s = (a.ctx.s + 2) & WORD_MASK;
  a.ctx.pc = (rawReturnWord + 1) & WORD_MASK;
  return {
    rawReturnWord,
    returnTarget: a.ctx.programBank * BANK_SIZE + a.ctx.pc,
    returnTargetExecuted: false,
    dynamicDispatchExecuted: false,
    frontier: outerReturn ? 'observed-outer-RTS-target' : 'observed-inner-RTS-target',
    scope: 'manual-source-specific-text-composition',
  };
}
function composition(a, events) {
  const h = taskTextAccess(a),
    { ctx } = h;
  const index = (name, value) => {
    ctx[name] = h.nz(value, 2);
  };
  const compare = (left, right, bytes = ctx.status & FLAG_MEMORY_8BIT ? 1 : 2) => {
    const mask = bytes === 1 ? BYTE_MASK : WORD_MASK;
    ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
    h.nz((left - right) & mask, bytes);
  };
  const change = (offset, delta) => {
    const bytes = ctx.status & FLAG_MEMORY_8BIT ? 1 : 2,
      mask = bytes === 1 ? BYTE_MASK : WORD_MASK;
    const value = h.nz((h.dp(offset, bytes) + delta) & mask, bytes);
    h.dpWrite(offset, value, bytes);
    return value;
  };
  const rightCount = (count) => {
    // Source LSR/DEY loops have no intervening data access. Keep the full
    // wrapping count, final Carry and final WORD-DEY flags, and charge work.
    a.tick(count);
    const old = ctx.a;
    ctx.status = (ctx.status & ~FLAG_CARRY) | (count <= WORD_BITS ? (old >>> (count - 1)) & 1 : 0);
    h.load(count < WORD_BITS ? old >>> count : 0);
    index('y', 0);
  };
  const callSequence = function* (at, next, target, body, long = true) {
    let bank;
    yield () => {
      bank = ctx.programBank;
      if (long) h.pushByte(bank, 'text-compose-JSL-bank');
      a.pushWord((next - 1) & WORD_MASK, 'text-compose-inner-return');
      ctx.programBank = target >>> WORD_BITS;
      ctx.pc = target & WORD_MASK;
    };
    const result = yield* body();
    yield () => {
      if (
        result.rawReturnWord !== ((next - 1) & WORD_MASK) ||
        ctx.programBank !== bank ||
        ctx.pc !== (next & WORD_MASK)
      )
        taskStop('task_native_helper_return_required', {
          at,
          actual: result.rawReturnWord,
          bank: ctx.programBank,
          pc: ctx.pc,
        });
      events.calls.push(
        Object.freeze({
          at,
          target,
          rawReturnWord: result.rawReturnWord,
          returnBank: ctx.programBank,
          ...(result.polls !== undefined ? { polls: result.polls } : {}),
        }),
      );
    };
    return result;
  };
  const call = (at, next, target, run, long = true) =>
    drainNativeSequence(
      callSequence(
        at,
        next,
        target,
        function* () {
          let result;
          yield () => {
            result = run();
          };
          return result;
        },
        long,
      ),
    );
  // Poll values up to the first zero; after $01FC follow the eight mask words read by the NMI.
  const observedWait = (name) => {
    let end = events.waitIndex;
    while (end < (events.values?.length ?? 0)) {
      if (events.values[end++].value === 0) break;
    }
    if (name === 'AEFC') end = Math.min(end + TEXT_MASK_WORDS, events.values?.length ?? 0);
    const values =
      events.values === null ? null : Object.freeze(events.values.slice(events.waitIndex, end));
    const result = runTaskTextWait(a, name, { mode: events.mode, values }, false);
    events.waitIndex += result.polls + result.nmiWords;
    return result;
  };
  // The same request frame over finite budgets: only the original request
  // continuation owns the pause, an observation replay stays one segment.
  const waitSequence = (name, at, next, target) =>
    callSequence(at, next, target, function* () {
      if (events.interrupts !== undefined)
        return yield {
          continuation: new RequestWaitContinuation(dialogAccess(a), events, target),
        };
      let result;
      yield () => {
        result = observedWait(name);
      };
      return result;
    });
  const geometry = (name, at, next, target) =>
    call(at, next, target, () => runTaskTextGeometry(a, name, false));
  const mask = (at, next) => call(at, next, 0x81aec8, () => closeTextMask(a, false));
  return {
    ...h,
    index,
    compare,
    change,
    rightCount,
    call,
    callSequence,
    waitSequence,
    geometry,
    mask,
  };
}

// 80:FB39: draw the decoded text buffer into the window, glyph by glyph with word
// wrapping, styles and line breaks. Entire fixed word/glyph/style/line graph. All original status and
// data stack bytes use the same private owner as native helper calls.
// Only its three request waits and the startup FD21 boundary can pause.
export function drawTextBuffer(a, events, outerReturn = true) {
  return drainNativeSequence(drawTextBufferSequence(a, events, outerReturn));
}
export function* drawTextBufferSequence(a, events, outerReturn) {
  const h = composition(a, events),
    { ctx } = h;
  let glyphs = 0,
    rows = 0,
    newlines = 0;
  const interruptAccess = events?.startupInterrupts ? dialogAccess(a) : null;
  const value = () => ctx.a & (ctx.status & FLAG_MEMORY_8BIT ? BYTE_MASK : WORD_MASK);
  const styleBits = (set) => {
    h.load(GLYPH_BOLD_STYLE);
    const old = h.dp(DP_WINDOW_STYLE, 1);
    ctx.status = (ctx.status & ~FLAG_ZERO) | (old & GLYPH_BOLD_STYLE ? 0 : FLAG_ZERO);
    h.dpWrite(DP_WINDOW_STYLE, set ? old | GLYPH_BOLD_STYLE : old & ~GLYPH_BOLD_STYLE, 1);
  };
  const cursorRequest = () => {
    h.load(h.read(WRAM + WINDOW_CURSOR_TILE + ctx.x));
    for (let n = 0; n < TEXT_TILE_PIXEL_SHIFT; n++) h.asl();
    ctx.status &= ~FLAG_CARRY;
    h.arithmetic(TEXT_TILE_VRAM_START);
    h.write(h.abs(TEXT_BUFFER_VRAM_ADDRESS), ctx.a);
  };
  const maskRows = (initial) => {
    h.load(h.read(WRAM + WINDOW_CURSOR_PIXEL + ctx.x));
    h.dpWrite(TEXT_PIXEL_OFFSET, ctx.a);
    h.index('y', ctx.a);
    h.pushByte(ctx.status, 'FB39-mask-PHP');
    h.load(WORD_MASK);
    ctx.status = h.pullByte('FB39-mask-PLP-fresh');
    wordMode(ctx);
    if (!(ctx.status & FLAG_ZERO)) {
      h.rightCount(ctx.y || BANK_SIZE);
      h.dpWrite(TEXT_WORK_WORD, ctx.a);
      h.xba();
      h.load(ctx.a & h.dp(TEXT_WORK_WORD));
    }
    h.load(ctx.a ^ WORD_MASK);
    if (initial) h.dpWrite(TEXT_INITIAL_MASK, ctx.a);
    h.index('x', TEXT_MASK_LAST_WORD);
    do {
      if (initial) {
        h.load(h.read(h.abs(TEXT_MASK_BUFFER) + ctx.x));
        h.load(ctx.a & h.dp(TEXT_INITIAL_MASK));
      }
      h.write(h.abs(TEXT_MASK_BUFFER) + ctx.x, ctx.a);
      h.index('x', (ctx.x - 1) & WORD_MASK);
      h.index('x', (ctx.x - 1) & WORD_MASK);
    } while (!(ctx.status & FLAG_NEGATIVE));
  };
  const measure = () => {
    h.dpWrite(TEXT_WORK_WORD, 0);
    h.dpWrite(TEXT_WORD_STATE, 0);
    h.load(0);
    ctx.status |= FLAG_MEMORY_8BIT;
    h.index('y', h.dp(TEXT_CHARACTER_INDEX, 2));
    for (;;) {
      h.load(h.read(h.abs(TEXT_BUFFER) + ctx.y));
      if (value() === 0) break;
      h.compare(value(), CHARACTER_SPACE);
      if (ctx.status & FLAG_ZERO) break;
      h.compare(value(), CHARACTER_STYLE_TOGGLE);
      if (ctx.status & FLAG_ZERO) {
        styleBits(true);
        h.load(CHARACTER_STYLE_PLACEHOLDER);
        h.write(h.abs(TEXT_BUFFER) + ctx.y, value());
        continue;
      }
      h.index('y', (ctx.y + 1) & WORD_MASK);
      h.index('x', ctx.a);
      h.load(h.dp(DP_WINDOW_STYLE));
      h.load(value() & GLYPH_BOLD_STYLE);
      if (value()) h.change(TEXT_WORK_WORD, 1);
      ctx.status &= ~FLAG_CARRY;
      h.load(h.read(GLYPH_WIDTHS + ctx.x));
      h.arithmetic(h.dp(TEXT_WORK_WORD));
      h.dpWrite(TEXT_WORK_WORD, value());
    }
    ctx.status &= ~FLAG_MEMORY_8BIT;
    h.load(h.dp(TEXT_WORK_WORD));
    if (ctx.a === 0) h.load(EMPTY_WORD_WIDTH);
    h.compare(ctx.a, h.dp(DP_LINE_REST));
  };
  const line = function* () {
    let pending, space;
    yield () => {
      newlines++;
      h.load(h.dp(TEXT_PENDING_BYTES));
      h.load(ctx.a | h.dp(TEXT_PIXEL_OFFSET));
      pending = ctx.a !== 0;
      if (pending) {
        h.mask(0x80fbd7, 0x80fbdb);
        h.dpWrite(TEXT_PENDING_BYTES, 0);
        h.index('x', h.dp(0));
      }
    };
    if (pending) yield* h.waitSequence('AEF4', 0x80fbdf, 0x80fbe3, 0x81aef4);
    yield () => {
      h.geometry('AE4D', 0x80fbe3, 0x80fbe7, 0x81ae4d);
      h.geometry('ADBA', 0x80fbe7, 0x80fbeb, 0x81adba);
      cursorRequest();
      h.geometry('AE14', 0x80fbf9, 0x80fbfd, 0x81ae14);
      h.dpWrite(DP_LINE_REST, ctx.a);
      maskRows(false);
      h.index('x', h.dp(TEXT_CHARACTER_INDEX));
      h.load(h.read(h.abs(TEXT_BUFFER) + ctx.x));
      h.load(ctx.a & BYTE_MASK);
      h.compare(ctx.a, CHARACTER_SPACE);
      space = Boolean(ctx.status & FLAG_ZERO);
      if (space) {
        h.index('x', (ctx.x + 1) & WORD_MASK);
        h.dpWrite(TEXT_CHARACTER_INDEX, ctx.x);
      }
    };
    return space;
  };
  const glyph = function* () {
    yield () => {
      ctx.status &= ~FLAG_MEMORY_8BIT;
      h.load(ctx.a & BYTE_MASK);
      h.index('x', ctx.a);
      h.load(h.read(GLYPH_WIDTHS + ctx.x));
      h.load(ctx.a & BYTE_MASK);
      h.dpWrite(TEXT_WORK_WORD, ctx.a);
      h.load(h.dp(DP_WINDOW_STYLE));
      h.load(ctx.a & GLYPH_EXTRA_STYLE);
      if (ctx.a) h.change(TEXT_WORK_WORD, 1);
      h.load(ctx.x);
      for (let n = 0; n < TEXT_TILE_PIXEL_SHIFT; n++) h.asl();
      h.index('x', ctx.a);
      ctx.status |= FLAG_MEMORY_8BIT;
      h.load(GLYPH_LAST_ROW);
      h.dpWrite(TEXT_GLYPH_ROW, value());
    };
    do {
      yield () => {
        h.load(h.dp(DP_WINDOW_STYLE));
        h.index('y', ctx.a);
        h.load(value() & GLYPH_BOLD_STYLE);
        if (value()) {
          h.load(h.read(0x95f2d0 + ctx.x));
          h.asl();
        }
        h.load(value() | h.read(0x95f2d0 + ctx.x));
        h.dpWrite(TEXT_GLYPH_BITS, value());
        h.load(ctx.y);
        h.load(value() & GLYPH_ROW_SHIFT_STYLES);
        h.compare(value(), GLYPH_ROW_SHIFT_STYLES);
        let shift = false;
        if (ctx.status & FLAG_ZERO) {
          h.load(h.dp(TEXT_GLYPH_ROW));
          h.lsr();
          shift = !(ctx.status & FLAG_CARRY);
        } else {
          h.load(ctx.y);
          h.load(value() & GLYPH_SHIFT_LOW_ROW_INDICES);
          if (value()) {
            h.load(h.dp(TEXT_GLYPH_ROW));
            h.compare(value(), GLYPH_ROW_SHIFT_BOUNDARY);
            shift = !(ctx.status & FLAG_CARRY);
          } else {
            h.load(ctx.y);
            h.load(value() & GLYPH_SHIFT_HIGH_ROW_INDICES);
            if (value()) {
              h.load(h.dp(TEXT_GLYPH_ROW));
              h.compare(value(), GLYPH_ROW_SHIFT_BOUNDARY);
              shift = Boolean(ctx.status & FLAG_CARRY);
            }
          }
        }
        if (shift) {
          const old = h.dp(TEXT_GLYPH_BITS);
          ctx.status = (ctx.status & ~FLAG_CARRY) | (old >>> (BYTE_BITS - 1));
          h.dpWrite(TEXT_GLYPH_BITS, h.nz((old << 1) & BYTE_MASK, 1));
        }
        h.load(ctx.y);
        h.load(value() & GLYPH_UNDERLINE_STYLE);
        if (value()) {
          h.load(h.dp(TEXT_GLYPH_ROW));
          if (!value()) {
            h.compare(ctx.x, GLYPH_UNDERLINE_SKIP_INDEX, 2);
            if (!(ctx.status & FLAG_ZERO)) {
              h.load(BYTE_MASK);
              h.dpWrite(TEXT_GLYPH_BITS, value());
            }
          }
        }
        h.dpWrite(TEXT_GLYPH_HIGH, 0, 1);
        ctx.status &= ~FLAG_MEMORY_8BIT;
        h.load(h.dp(TEXT_GLYPH_BITS));
        h.xba();
        h.index('y', h.dp(TEXT_WORK_WORD));
        h.compare(ctx.y, GLYPH_ROW_PIXELS, 2);
        if (!(ctx.status & FLAG_ZERO)) {
          const count = (GLYPH_ROW_PIXELS - ctx.y) & WORD_MASK;
          a.tick(count);
          h.load(count < WORD_BITS ? ctx.a << count : 0);
          h.index('y', GLYPH_ROW_PIXELS);
          h.compare(ctx.y, GLYPH_ROW_PIXELS, 2);
        }
        a.pushWord(ctx.x, 'FB39-glyph-PHX');
        a.pushWord(ctx.a, 'FB39-glyph-PHA');
        h.load(h.dp(TEXT_WORK_WORD));
        h.asl();
        h.index('x', ctx.a);
        h.load(a.pullWord('FB39-glyph-PLA-fresh'));
        h.load(ctx.a ^ h.read(0x81ac9d + ctx.x));
        h.index('x', a.pullWord('FB39-glyph-PLX-fresh'));
        h.index('y', h.dp(TEXT_PIXEL_OFFSET));
        if (ctx.y !== 0) h.rightCount(ctx.y);
        ctx.status |= FLAG_MEMORY_8BIT;
        h.index('y', h.dp(TEXT_PENDING_BYTES, 2));
        h.write(h.abs(TEXT_MASK_BUFFER + TEXT_MASK_BYTES) + ctx.y, value());
        h.xba();
        h.load(value() | h.read(h.abs(TEXT_MASK_BUFFER) + ctx.y));
        h.write(h.abs(TEXT_MASK_BUFFER) + ctx.y, value());
      };
      // Original FD21 is INY in M8/X16, after the first BYTE mask store.
      if (interruptAccess)
        yield {
          continuation: new InterruptStepContinuation(interruptAccess, events, 0x80fd21),
        };
      yield () => {
        h.index('y', (ctx.y + 1) & WORD_MASK);
        h.load(BYTE_MASK);
        h.write(h.abs(TEXT_MASK_BUFFER) + ctx.y, value());
        h.write(h.abs(TEXT_MASK_BUFFER + TEXT_MASK_BYTES) + ctx.y, value());
        h.index('y', (ctx.y + 1) & WORD_MASK);
        h.dpWrite(TEXT_PENDING_BYTES, ctx.y, 2);
        h.index('x', (ctx.x + 1) & WORD_MASK);
        h.change(TEXT_GLYPH_ROW, -1);
        rows++;
      };
    } while (!(ctx.status & FLAG_NEGATIVE));
    yield () => {
      ctx.status &= ~FLAG_MEMORY_8BIT;
      ctx.status |= FLAG_CARRY;
      h.load(h.dp(DP_LINE_REST));
      h.arithmetic(h.dp(TEXT_WORK_WORD), true);
      h.dpWrite(DP_LINE_REST, ctx.a);
      ctx.status &= ~FLAG_CARRY;
      h.load(h.dp(TEXT_PIXEL_OFFSET));
      h.arithmetic(h.dp(TEXT_WORK_WORD));
      h.compare(ctx.a, GLYPH_ROW_PIXELS);
      h.load(ctx.a & GLYPH_PIXEL_MASK);
      h.dpWrite(TEXT_PIXEL_OFFSET, ctx.a);
      if (!(ctx.status & FLAG_CARRY)) {
        h.load(h.dp(TEXT_PENDING_BYTES));
        h.arithmetic(TEXT_MASK_ADVANCE_SUBTRAHEND, true);
        h.dpWrite(TEXT_PENDING_BYTES, ctx.a);
      }
      ctx.status |= FLAG_MEMORY_8BIT;
      glyphs++;
    };
  };
  // One original character step: style toggle, end of text, or the glyph path.
  const character = () => {
    ctx.status |= FLAG_MEMORY_8BIT;
    h.load(h.dp(DP_WINDOW_STYLE));
    h.index('y', ctx.a);
    h.asl();
    h.load(h.dp(TEXT_WORD_STATE));
    if (value() & BYTE_SIGN) {
      styleBits(false);
      ctx.status &= ~FLAG_MEMORY_8BIT;
      return 'measure';
    }
    h.index('x', h.dp(TEXT_CHARACTER_INDEX, 2));
    h.load(h.read(h.abs(TEXT_BUFFER) + ctx.x));
    if (value() === 0) return 'end';
    h.pushByte(ctx.status, 'FB39-character-PHP');
    h.compare(value(), CHARACTER_SPACE);
    if (ctx.status & FLAG_ZERO) {
      h.load(h.dp(TEXT_WORD_STATE));
      if (value()) {
        ctx.status = h.pullByte('FB39-character-PLP-fresh');
        byteMode(ctx);
        styleBits(false);
        ctx.status &= ~FLAG_MEMORY_8BIT;
        return 'measure';
      }
      h.change(TEXT_WORD_STATE, -1);
      h.load(CHARACTER_SPACE);
    } else h.change(TEXT_WORD_STATE, 1);
    h.index('x', (ctx.x + 1) & WORD_MASK);
    h.dpWrite(TEXT_CHARACTER_INDEX, ctx.x, 2);
    ctx.status = h.pullByte('FB39-character-PLP-fresh');
    byteMode(ctx);
    if (ctx.status & FLAG_CARRY) {
      h.compare(value(), CHARACTER_LOWERCASE_FIRST);
      if (ctx.status & FLAG_CARRY) {
        h.compare(value(), CHARACTER_LOWERCASE_END);
        if (!(ctx.status & FLAG_CARRY)) h.load(value() & CHARACTER_UPPERCASE_MASK);
      }
    }
    return 'glyph';
  };
  yield () => {
    h.index('x', h.dp(0));
    h.geometry('ADBA', 0x80fb3b, 0x80fb3f, 0x81adba);
    h.geometry('AE14', 0x80fb3f, 0x80fb43, 0x81ae14);
    h.dpWrite(DP_LINE_REST, ctx.a);
    h.load(h.read(WRAM + WINDOW_STYLE + ctx.x));
    h.dpWrite(DP_WINDOW_STYLE, ctx.a);
    h.dpWrite(TEXT_PENDING_BYTES, 0);
    cursorRequest();
  };
  yield* h.waitSequence('AEFC', 0x80fb5b, 0x80fb5f, 0x81aefc);
  yield () => {
    maskRows(true);
    h.dpWrite(TEXT_CHARACTER_INDEX, 0);
  };
  // Width the glyph of the character in A would take (as glyph() computes it).
  const glyphOverflows = () =>
    a.mem.read8(GLYPH_WIDTHS + (ctx.a & BYTE_MASK)) +
      (h.dp(DP_WINDOW_STYLE, 1) & GLYPH_EXTRA_STYLE ? 1 : 0) >
    h.dp(DP_LINE_REST, 2);
  let needsMeasure = true;
  for (;;) {
    if (needsMeasure) {
      let carry;
      yield () => {
        measure();
        carry = Boolean(ctx.status & FLAG_CARRY);
      };
      if (carry && (yield* line())) continue;
    }
    let action;
    yield () => {
      action = character();
    };
    if (action === 'end') break;
    if (action === 'measure') {
      needsMeasure = true;
      continue;
    }
    // Text language (src/data/language.mjs): a translated word wider than its
    // window would draw past the window's tiles into other video memory; a
    // glyph that no longer fits the line (DP A8) is left out instead.
    if (a.mem?.language && glyphOverflows()) {
      needsMeasure = false;
      continue;
    }
    yield* glyph();
    needsMeasure = false;
  }
  let pending;
  yield () => {
    ctx.status &= ~FLAG_MEMORY_8BIT;
    h.load(h.dp(TEXT_PENDING_BYTES));
    h.load(ctx.a | h.dp(TEXT_PIXEL_OFFSET));
    pending = ctx.a !== 0;
    if (pending) {
      h.mask(0x80fd61, 0x80fd65);
      h.load(h.dp(TEXT_PENDING_BYTES));
      for (let n = 0; n < TEXT_TILE_BYTE_SHIFT; n++) h.lsr();
      h.index('x', h.dp(0));
      h.arithmetic(h.read(WRAM + WINDOW_CURSOR_TILE + ctx.x));
      h.write(WRAM + WINDOW_CURSOR_TILE + ctx.x, ctx.a);
      h.load(h.dp(TEXT_PIXEL_OFFSET));
      h.write(WRAM + WINDOW_CURSOR_PIXEL + ctx.x, ctx.a);
    }
  };
  if (pending) yield* h.waitSequence('AEF4', 0x80fd7b, 0x80fd7f, 0x81aef4);
  let result;
  yield () => {
    result = {
      ...returnRTS(a, outerReturn),
      outcome: 'text_composed',
      glyphs,
      rows,
      newlines,
    };
  };
  return result;
}

// 80:FE69: print a text: decode text DP02 (banks 9D/9E, or a port or language text)
// into the text buffer, then draw it through FB39. routines (optional) replaces FB39 by
// a table entry that ends with its RTS, as the function test of the lifted text print
// (src/game/text-print.mjs) does.
export function printText(a, events, outerReturn = true, routines = null) {
  return drainNativeSequence(printTextSequence(a, events, outerReturn, routines));
}
export function* printTextSequence(a, events, outerReturn, routines = null) {
  const h = composition(a, events),
    { ctx } = h;
  let bits = 0,
    characters = 0;
  yield () => {
    h.pushByte(ctx.bank, 'FE69-PHB');
    h.load(TEXT_POINTER_BANK_SEED);
    h.dpWrite(TEXT_SOURCE_BANK_WORD, ctx.a);
    h.load(h.dp(2));
    if (ctx.a & WORD_SIGN) h.change(TEXT_SOURCE_BANK_WORD, 1);
    h.load(ctx.a | WORD_SIGN);
    h.dpWrite(TEXT_SOURCE_POINTER, ctx.a);
    // Port texts (src/data/port-extension.mjs): a reserved id points into the
    // port bank instead of 9D/9E; the decoding below stays the original one.
    const textId = h.dp(2),
      translated = languageText(a.mem, textId);
    const port = portTextAddress(a.mem, textId);
    if (port !== null) {
      h.dpWrite(TEXT_SOURCE_POINTER, port & WORD_MASK, 2);
      h.dpWrite(TEXT_SOURCE_BANK, port >>> WORD_BITS, 1);
    }
    a.pushWord(WRAM_BANK_PAIR, 'FE69-PEA');
    ctx.bank = h.pullByte('FE69-PLB-first');
    h.nz(ctx.bank, 1);
    ctx.bank = h.pullByte('FE69-PLB-second');
    h.nz(ctx.bank, 1);
    h.write(h.abs(TEXT_BITS_REMAINING), 0);
    ctx.status |= FLAG_MEMORY_8BIT;
    h.index('y', 0);
    decode: for (;;) {
      ctx.status &= ~FLAG_MEMORY_8BIT;
      h.load(0);
      do {
        h.index('x', ctx.a);
        h.call(0x80fe8d, 0x80fe91, 0x81af04, () => readTextBit(a, false));
        bits++;
        if (ctx.status & FLAG_CARRY) {
          h.index('x', (ctx.x + 1) & WORD_MASK);
          h.index('x', (ctx.x + 1) & WORD_MASK);
        }
        h.load(h.read(0x9d8000 + ctx.x));
      } while (!(ctx.a & WORD_SIGN));
      h.load(ctx.a & HUFFMAN_CHARACTER_PAIR_MASK);
      h.xba();
      ctx.status |= FLAG_MEMORY_8BIT;
      h.compare(ctx.a & BYTE_MASK, HUFFMAN_TEXT_END);
      if (ctx.status & FLAG_ZERO) break;
      h.write(h.abs(TEXT_BUFFER) + ctx.y, ctx.a & BYTE_MASK);
      characters++;
      h.index('y', (ctx.y + 1) & WORD_MASK);
      h.xba();
      if ((ctx.a & BYTE_MASK) === 0) continue;
      h.compare(ctx.a & BYTE_MASK, HUFFMAN_TEXT_END);
      if (ctx.status & FLAG_ZERO) break decode;
      h.write(h.abs(TEXT_BUFFER) + ctx.y, ctx.a & BYTE_MASK);
      characters++;
      h.index('y', (ctx.y + 1) & WORD_MASK);
    }
    // Text language (src/data/language.mjs): after the original decoding,
    // the buffer gets the translated characters; FB39 composes them as usual.
    if (translated) {
      for (let i = 0; i < translated.length; i++) h.write(h.abs(TEXT_BUFFER) + i, translated[i], 1);
      h.index('y', translated.length);
    }
    h.index('x', ctx.y);
    h.write(h.abs(TEXT_BUFFER) + ctx.x, 0);
    ctx.status &= ~FLAG_MEMORY_8BIT;
  };
  const composed = yield* h.callSequence(
    0x80febc,
    0x80febf,
    0x80fb39,
    routines?.has(0x80fb39)
      ? function* () {
          let rawReturnWord;
          yield () => {
            rawReturnWord = routines.get(0x80fb39)(dialogAccess(a), events);
          };
          return { rawReturnWord };
        }
      : () => drawTextBufferSequence(a, events, false),
    false,
  );
  let result;
  yield () => {
    ctx.bank = h.pullByte('FE69-PLB-restored-fresh');
    h.nz(ctx.bank, 1);
    result = {
      ...returnRTS(a, outerReturn),
      outcome: 'text_decoded_composed',
      bits,
      characters,
      glyphs: composed.glyphs,
      rows: composed.rows,
      newlines: composed.newlines,
    };
  };
  return result;
}
// An upload request of FB39 (AEF4 or AEFC) through its JSL frame at 'at', as FB39 runs
// it; the lifted text drawing (src/game/text-draw.mjs) runs it without the lag-free
// frame model.
export const textRequestWaitSequence = (a, events, name, at, next, target) =>
  composition(a, events).waitSequence(name, at, next, target);
export const printTextAdapter = (h, e) => printText(h.a, e, false);
NATIVE_CALL_CONTINUATIONS.set(0x80fe69, {
  run: printTextAdapter,
  create: ({ h, events }) => new NativeCallContinuation(h.a, printTextSequence(h.a, events, false)),
});
export const drawTextBufferAdapter = (h, e) => drawTextBuffer(h.a, e, false);
NATIVE_CALL_CONTINUATIONS.set(0x80fb39, {
  run: drawTextBufferAdapter,
  create: ({ h, events }) =>
    new NativeCallContinuation(h.a, drawTextBufferSequence(h.a, events, false)),
});
