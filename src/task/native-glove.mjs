import { releaseGloveNameWindowSequence } from './native-dialog-portrait.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  dialogCallBody,
  segmentSequence,
} from './native-call-continuation.mjs';
import {
  GLOVE_LIMITS,
  GLOVE_OVER_PLAYER,
  GLOVE_KIND_SPELL,
} from './native-glove-crosshair-limits.mjs';
import {
  GLOVE_ROUTINES,
  routineCall,
  rts,
  measureTextWidth,
} from './native-glove-target-support.mjs';
import { sec, clc } from './status-flags.mjs';

import {
  CAMERA_X,
  CAMERA_Y,
  DRAW_LIST,
  DRAW_LIST_INDEX,
  GLOVE_KIND,
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  OBJECT_KIND,
  PAD_HELD,
  PLAYER_OBJECT,
  WRAM,
  OBJECT_BOX_X1,
  OBJECT_BOX_Y1,
  OBJECT_BOX_HEIGHT,
  OBJECT_BOX_X2,
  OBJECT_BOX_Y2,
  OBJECT_X,
  OBJECT_Y,
  OBJECT_HEIGHT,
  OBJECT_DIAGONAL,
  OBJECT_ACTION_DIRECTIONS,
  OBJECT_FLAGS,
  OBJECT_NUMBER,
  GLOVE_X,
  GLOVE_Y,
  GLOVE_SPEED_X,
  GLOVE_SPEED_Y,
  GLOVE_SNAP_X,
  GLOVE_SNAP_Y,
  GLOVE_BASE_X,
  GLOVE_BASE_Y,
  GLOVE_LIMIT_KIND,
  GLOVE_NAME_WINDOW,
  AIMING_SPELL,
  SCRIPT_GLOVE_CHOICE,
  PAD_DIRECTIONS,
  DP_WINDOW_LEFT,
  DP_WINDOW_TOP,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_ROWS,
  DP_WINDOW_ATTRIBUTES,
} from './wram.mjs';
import { RUNNER_LAST_INDEX } from '../data/runners.mjs';
import { KIND_ITEM_CLASS_MASK, KIND_NO_NAME } from '../data/kinds.mjs';
import { BYTE_MASK, BYTE_BITS, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

// BE6D: the D-pad bits of the high byte accelerate the glove by 30 per frame up to 300
// (ADC 2F with the carry set); the position stays in 0300..EF00 and 0300..CE00.
const PAD_DIRECTION_BITS = PAD_DIRECTIONS >>> BYTE_BITS,
  GLOVE_ACCELERATION = 0x30,
  GLOVE_MAX_SPEED = 0x300,
  GLOVE_MIN_SPEED = -GLOVE_MAX_SPEED & WORD_MASK,
  GLOVE_POSITION_MIN = 0x300,
  GLOVE_LIMIT_X = 0xef00,
  GLOVE_LIMIT_Y = 0xce00;
// BCBE: kind 0B is only offered to the spell glove or a script choice; the glove snaps to
// a marked object while it stays within FF of the recorded offset; kind class 3 (1458 bits
// 0 and 1) names a runner from 80:9782.
const GLOVE_RESTRICTED_KIND = 0x0b,
  GLOVE_SNAP_RANGE = BYTE_MASK,
  RUNNER_KIND_CLASS = 3;
// BCBE direct page: glove screen X/Y, the glove relative to the object, and the kind index.
const DP_GLOVE_SCREEN_X = 0x0e,
  DP_GLOVE_SCREEN_Y = 0x11,
  DP_GLOVE_OBJECT_X = 0x14,
  DP_GLOVE_OBJECT_Y = 0x17,
  DP_GLOVE_KIND_INDEX = 0x1a;
// The name window at the bottom right: three rows from row 17, (width + 18) / 8 columns
// left of column 1E, attributes 0800.
const NAME_WINDOW = Object.freeze({
  widthPadding: 0x18,
  pixelShift: 3,
  right: 0x1e,
  top: 0x17,
  rows: 3,
  attributes: 0x800,
});
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';
// The action glove of NativeD8/9BC6 and its relatives (src/task/native-glove-target.mjs).

// 80:BC36: glove over the player figure $0CC2 ($01D4/$01D6 from position and camera $0CC4/$0CC6).
function runGloveOverPlayer(h) {
  const { ctx } = h,
    field = (offset) => h.read(h.abs(offset) + ctx.y);
  h.index('y', h.read(h.abs(PLAYER_OBJECT)));
  sec(h);
  h.load(GLOVE_OVER_PLAYER.yBase);
  for (const right of [
    field(OBJECT_DIAGONAL),
    field(OBJECT_HEIGHT),
    h.read(h.abs(CAMERA_Y)),
    GLOVE_OVER_PLAYER.yOffset,
  ])
    h.sbc(right);
  h.lsr();
  h.lsr();
  h.xba();
  h.write(h.abs(GLOVE_Y), ctx.a);
  clc(h);
  h.load(GLOVE_OVER_PLAYER.xBase);
  h.adc(field(OBJECT_Y));
  sec(h);
  for (const right of [field(OBJECT_X), h.read(h.abs(CAMERA_X)), GLOVE_OVER_PLAYER.xOffset])
    h.sbc(right);
  h.lsr();
  h.lsr();
  h.xba();
  h.write(h.abs(GLOVE_X), ctx.a);
  return h.rts();
}
// 80:BC67: switch the glove on: position, limits $01E4/$01E6, kind $01E8 = $01D8 = FFFF.
// 80:BC99: spell glove, the same form with kind FFFD (limits in src/task/native-glove-crosshair-limits.mjs).
function gloveOn(h, entry, limits) {
  h.call(entry, 0x80bc36, () => runGloveOverPlayer(h));
  for (const [offset, value] of [
    [GLOVE_BASE_X, limits[0]],
    [GLOVE_BASE_Y, limits[1]],
    [GLOVE_LIMIT_KIND, limits[2]],
  ]) {
    h.load(value);
    h.write(h.abs(offset), h.ctx.a);
  }
  h.write(h.abs(GLOVE_KIND), h.ctx.a);
  return h.rts();
}
// 80:BC67 and 80:BC99: show the action or the spell glove with its movement limits.
export const putOnActionGlove = (h) => gloveOn(h, 0x80bc67, GLOVE_LIMITS.action);
export const putOnSpellGlove = (h) => gloveOn(h, 0x80bc99, GLOVE_LIMITS.spell);
// 80:BE6D: move the glove. The D-pad ($01CA bits 8-11) accelerates the speed $01D0/$01D2 by
// $30 up to ±$300 (the opposite direction starts at 0, no direction 0); position $01D4/$01D6 in 0300..EF00/CE00.
// Moved: name window away (BE5B); at rest: look for an object under the glove (BCBE).
export function moveGlove(h, events, routines = GLOVE_ROUTINES) {
  return drainNativeSequence(be6dSequence(h, events, routines));
}
export function* be6dSequence(h, events, routines = GLOVE_ROUTINES) {
  const { ctx } = h;
  let off,
    still,
    moved = false;
  // Carry = first direction (right/down, ADC #$2F with C = 1), otherwise the next bit (left/up, SBC #$30 with C = 1).
  const speed = (offset) => {
    if (ctx.status & FLAG_CARRY) {
      h.load(h.read(h.abs(offset)));
      if (ctx.status & FLAG_NEGATIVE) h.load(0);
      h.adc(GLOVE_ACCELERATION - 1);
      h.cmp(GLOVE_MAX_SPEED);
      if (ctx.status & FLAG_CARRY) h.load(GLOVE_MAX_SPEED);
      h.write(h.abs(offset), ctx.a);
      return;
    }
    h.lsr();
    if (!(ctx.status & FLAG_CARRY)) {
      h.write(h.abs(offset), 0);
      return;
    }
    h.load(h.read(h.abs(offset)));
    if (!(ctx.status & FLAG_NEGATIVE)) h.load(0);
    h.sbc(GLOVE_ACCELERATION);
    h.cmp(GLOVE_MIN_SPEED);
    if (!(ctx.status & FLAG_CARRY)) h.load(GLOVE_MIN_SPEED);
    h.write(h.abs(offset), ctx.a);
  };
  yield () => {
    h.load(h.read(h.abs(GLOVE_KIND)));
    off = Boolean(ctx.status & FLAG_ZERO);
    if (off) return;
    h.load(h.read(h.abs(PAD_HELD)));
    h.xba();
    h.load(ctx.a & PAD_DIRECTION_BITS);
    h.lsr();
    h.index('x', ctx.a);
    speed(GLOVE_SPEED_X);
    h.load(ctx.x);
    h.lsr();
    h.lsr();
    speed(GLOVE_SPEED_Y);
    for (const [position, velocity, limit] of [
      [GLOVE_X, GLOVE_SPEED_X, GLOVE_LIMIT_X],
      [GLOVE_Y, GLOVE_SPEED_Y, GLOVE_LIMIT_Y],
    ]) {
      clc(h);
      h.load(h.read(h.abs(position)));
      h.adc(h.read(h.abs(velocity)));
      h.cmp(GLOVE_POSITION_MIN);
      if (!(ctx.status & FLAG_CARRY)) h.load(GLOVE_POSITION_MIN);
      h.cmp(limit + 1);
      if (ctx.status & FLAG_CARRY) h.load(limit);
      h.write(h.abs(position), ctx.a);
    }
    h.load(h.read(h.abs(PAD_HELD)));
    h.xba();
    h.load(ctx.a & PAD_DIRECTION_BITS);
    still = Boolean(ctx.status & FLAG_ZERO);
    if (!still) {
      h.load(h.read(h.abs(GLOVE_TARGET_TAG)));
      moved = !(ctx.status & FLAG_NEGATIVE);
    }
  };
  if (!off) {
    if (still)
      yield* dialogCallBody(h, 0x80bf37, 0x80bcbe, () => bcbeSequence(h, events, routines));
    else if (moved)
      yield* dialogCallBody(h, 0x80bf33, 0x80be5b, () =>
        releaseGloveNameWindowSequence(h, events, routines),
      );
  }
  return yield* rts(h);
}
// 80:BCBE: check the scene objects ($14B2+Y, Y = $14B0 downwards) with a picture ($1090) and a name
// (8C:EFB0 by kind $7E3F28) against the glove; kind $0B only with $01D8 = FFFD or an open $1D5F/$1D6D. The
// first object whose box ($7E4240.. over height $01E6 and depth $01E4) contains the glove is marked:
// name (kind 3 in $1458: from table 80:9700/9782 to $150A) in a window at the bottom right (FADD, F963, FE69).
// The same object again: the glove snaps in relative to the object ($01E0/$01E2). No object: BE5B.
export function* bcbeSequence(h, events, routines = GLOVE_ROUTINES) {
  const { ctx } = h,
    field = (offset) => h.read(offset + ctx.x),
    near = (offset) => h.read(h.abs(offset) + ctx.x);
  const release = (pc) =>
    dialogCallBody(h, pc, 0x80be5b, () => releaseGloveNameWindowSequence(h, events, routines));
  const ror = () => {
    const n = ctx.a,
      c = ctx.status & FLAG_CARRY;
    ctx.status = (ctx.status & ~FLAG_CARRY) | (n & 1);
    h.load((c << (WORD_BITS - 1)) | (n >>> 1));
  };
  // Returns true if object X contains the glove (jump to BDA2).
  const hit = () => {
    h.index('x', h.read(h.abs(DRAW_LIST) + ctx.y));
    h.load(near(OBJECT_ACTION_DIRECTIONS));
    if (ctx.status & FLAG_ZERO) return false;
    h.load(field(WRAM + OBJECT_KIND));
    h.cmp(GLOVE_RESTRICTED_KIND);
    if (ctx.status & FLAG_ZERO) {
      h.load(h.read(h.abs(GLOVE_KIND)));
      h.cmp(GLOVE_KIND_SPELL);
      if (!(ctx.status & FLAG_ZERO)) {
        h.load(h.read(h.abs(AIMING_SPELL)));
        h.load(ctx.a | h.read(h.abs(SCRIPT_GLOVE_CHOICE)));
        if (ctx.status & FLAG_ZERO) return false;
      }
      h.load(field(WRAM + OBJECT_KIND));
    }
    h.asl();
    h.dpWrite(DP_GLOVE_KIND_INDEX, ctx.a);
    h.asl();
    h.adc(h.dp(DP_GLOVE_KIND_INDEX));
    h.dpWrite(DP_GLOVE_KIND_INDEX, ctx.x);
    h.index('x', ctx.a);
    h.load(field(0x8cefb0));
    h.index('x', h.dp(DP_GLOVE_KIND_INDEX));
    h.cmp(KIND_NO_NAME);
    if (ctx.status & FLAG_ZERO) return false;
    sec(h);
    h.load(h.read(h.abs(GLOVE_BASE_Y)));
    h.sbc(near(OBJECT_DIAGONAL));
    sec(h);
    h.sbc(near(OBJECT_HEIGHT));
    sec(h);
    h.sbc(h.read(h.abs(CAMERA_Y)));
    if (ctx.status & FLAG_NEGATIVE) return false;
    h.lsr();
    h.lsr();
    h.dpWrite(DP_GLOVE_OBJECT_Y, ctx.a);
    h.asl();
    sec(h);
    h.sbc(field(WRAM + OBJECT_BOX_X1));
    sec(h);
    h.sbc(field(WRAM + OBJECT_BOX_Y1));
    if (ctx.status & FLAG_NEGATIVE) return false;
    h.lsr();
    h.cmp(h.dp(DP_GLOVE_SCREEN_Y));
    if (!(ctx.status & FLAG_CARRY)) return false;
    h.load(h.dp(DP_GLOVE_OBJECT_Y));
    sec(h);
    h.sbc(field(WRAM + OBJECT_BOX_HEIGHT));
    h.asl();
    sec(h);
    h.sbc(field(WRAM + OBJECT_BOX_X2));
    sec(h);
    h.sbc(field(WRAM + OBJECT_BOX_Y2));
    if (!(ctx.status & FLAG_NEGATIVE)) {
      h.lsr();
      h.cmp(h.dp(DP_GLOVE_SCREEN_Y));
      if (ctx.status & FLAG_CARRY) return false;
    }
    clc(h);
    h.load(h.read(h.abs(GLOVE_BASE_X)));
    h.adc(near(OBJECT_Y));
    sec(h);
    h.sbc(near(OBJECT_X));
    sec(h);
    h.sbc(h.read(h.abs(CAMERA_X)));
    if (ctx.status & FLAG_NEGATIVE) {
      sec(h);
      ror();
      sec(h);
      ror();
    }
    h.lsr();
    h.lsr();
    h.dpWrite(DP_GLOVE_OBJECT_X, ctx.a);
    sec(h);
    h.sbc(field(WRAM + OBJECT_BOX_X1));
    clc(h);
    h.adc(field(WRAM + OBJECT_BOX_Y2));
    if (ctx.status & FLAG_NEGATIVE) return false;
    h.cmp(h.dp(DP_GLOVE_SCREEN_X));
    if (!(ctx.status & FLAG_CARRY)) return false;
    h.load(h.dp(DP_GLOVE_OBJECT_X));
    clc(h);
    h.adc(field(WRAM + OBJECT_BOX_Y1));
    sec(h);
    h.sbc(field(WRAM + OBJECT_BOX_X2));
    if (ctx.status & FLAG_NEGATIVE) return true;
    h.cmp(h.dp(DP_GLOVE_SCREEN_X));
    return !(ctx.status & FLAG_CARRY);
  };
  let found = false;
  yield () => {
    h.index('y', h.read(h.abs(DRAW_LIST_INDEX)));
    if (!(ctx.status & FLAG_NEGATIVE)) {
      h.load(h.read(h.abs(GLOVE_X)));
      h.xba();
      h.load(ctx.a & BYTE_MASK);
      h.dpWrite(DP_GLOVE_SCREEN_X, ctx.a);
      h.load(h.read(h.abs(GLOVE_Y)));
      h.xba();
      h.load(ctx.a & BYTE_MASK);
      h.dpWrite(DP_GLOVE_SCREEN_Y, ctx.a);
      for (;;) {
        if (hit()) {
          found = true;
          break;
        }
        h.index('y', ctx.y - 1);
        h.index('y', ctx.y - 1);
        if (ctx.status & FLAG_NEGATIVE) break;
      }
    }
  };
  if (!found) {
    let held;
    yield () => {
      h.load(h.read(h.abs(GLOVE_TARGET_TAG)));
      held = !(ctx.status & FLAG_NEGATIVE);
    };
    if (held) yield* release(0x80bd9e);
    return yield* rts(h);
  }
  let marked,
    same = false;
  yield () => {
    h.load(h.read(h.abs(GLOVE_TARGET_TAG)));
    marked = !(ctx.status & FLAG_NEGATIVE);
    if (marked) {
      h.cmp(field(WRAM + OBJECT_KIND));
      if (ctx.status & FLAG_ZERO) {
        h.cpx(h.read(h.abs(GLOVE_TARGET_OBJECT)));
        same = Boolean(ctx.status & FLAG_ZERO);
      }
    }
  };
  if (same) {
    // 80:BE38: same object, set the glove to the recorded offset (otherwise free it).
    for (const [dp, offset, position] of [
      [DP_GLOVE_OBJECT_X, GLOVE_SNAP_X, GLOVE_X],
      [DP_GLOVE_OBJECT_Y, GLOVE_SNAP_Y, GLOVE_Y],
    ]) {
      let away;
      yield () => {
        sec(h);
        h.load(h.dp(dp));
        h.sbc(h.read(h.abs(offset)));
        h.cmp(GLOVE_SNAP_RANGE);
        away = Boolean(ctx.status & FLAG_CARRY);
        if (!away) {
          h.xba();
          h.write(h.abs(position), ctx.a);
        }
      };
      if (away) {
        yield* release(0x80be57);
        return yield* rts(h);
      }
    }
    return yield* rts(h);
  }
  if (marked) {
    yield () => h.phx();
    yield* release(0x80bdb6);
    yield () => h.plx();
  }
  yield () => {
    sec(h);
    h.load(h.dp(DP_GLOVE_OBJECT_X));
    h.sbc(h.dp(DP_GLOVE_SCREEN_X));
    h.write(h.abs(GLOVE_SNAP_X), ctx.a);
    sec(h);
    h.load(h.dp(DP_GLOVE_OBJECT_Y));
    h.sbc(h.dp(DP_GLOVE_SCREEN_Y));
    h.write(h.abs(GLOVE_SNAP_Y), ctx.a);
    h.load(field(WRAM + OBJECT_KIND));
    h.write(h.abs(GLOVE_TARGET_TAG), ctx.a);
    h.write(h.abs(GLOVE_TARGET_OBJECT), ctx.x);
    h.load(near(OBJECT_FLAGS) & KIND_ITEM_CLASS_MASK);
    h.cmp(RUNNER_KIND_CLASS);
    if (ctx.status & FLAG_ZERO) {
      h.load(near(OBJECT_NUMBER));
      h.index('x', RUNNER_LAST_INDEX);
      for (;;) {
        h.cmp(field(0x809700));
        if (ctx.status & FLAG_ZERO) break;
        h.index('x', ctx.x - 1);
        h.index('x', ctx.x - 1);
        if (ctx.status & FLAG_NEGATIVE) break;
      }
      h.load(field(0x809782));
    } else {
      h.load(h.read(h.abs(GLOVE_TARGET_TAG)));
      h.asl();
      h.dpWrite(DP_GLOVE_KIND_INDEX, ctx.a);
      h.asl();
      h.adc(h.dp(DP_GLOVE_KIND_INDEX));
      h.index('x', ctx.a);
      h.load(field(0x8cefb0));
    }
    h.dpWrite(0, ctx.a);
    h.pha();
  };
  yield* dialogCallBody(h, 0x80be06, 0x80fadd, () =>
    segmentSequence(() => measureTextWidth(h, events, routines)),
  );
  yield () => {
    clc(h);
    h.adc(NAME_WINDOW.widthPadding);
    for (let n = 0; n < NAME_WINDOW.pixelShift; n++) h.lsr();
    // Edited names can exceed the screen; FB39 clips their remaining glyphs.
    if (h.a.mem?.language) h.load(Math.min(ctx.a, NAME_WINDOW.right - 1));
    h.dpWrite(DP_WINDOW_COLUMNS, ctx.a);
    sec(h);
    h.load(NAME_WINDOW.right);
    h.sbc(h.dp(DP_WINDOW_COLUMNS));
    h.dpWrite(DP_WINDOW_LEFT, ctx.a);
    for (const [offset, value] of [
      [DP_WINDOW_TOP, NAME_WINDOW.top],
      [DP_WINDOW_ROWS, NAME_WINDOW.rows],
      [DP_WINDOW_ATTRIBUTES, NAME_WINDOW.attributes],
    ]) {
      h.load(value);
      h.dpWrite(offset, ctx.a);
    }
  };
  yield* routineCall(routines, events, h, 0x80be29, 0x80f963);
  yield () => {
    h.load(h.dp(0));
    h.write(h.abs(GLOVE_NAME_WINDOW), ctx.a);
    h.pla();
    h.dpWrite(2, ctx.a);
  };
  yield* routineCall(routines, events, h, 0x80be34, 0x80fe69);
  return yield* rts(h);
}
// BE6D is also a direct main-loop helper with its own frame.
NATIVE_CALL_CONTINUATIONS.set(0x80be6d, {
  run: moveGlove,
  create: ({ h, events }) => new NativeCallContinuation(h.a, be6dSequence(h, events)),
});
