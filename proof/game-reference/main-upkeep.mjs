import { MAIN_UPKEEP_ROUTINES } from '../../src/task/main-loop-upkeep.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  nativeCallSequence,
} from '../../src/task/native-call-continuation.mjs';
// Register-level reference of the main loop's upkeep (moved from
// src/task/main-loop-upkeep.mjs and src/task/main-loop-motion.mjs): the colour
// effect 81:8877, the palette cycles 81:8076, the hit shake 80:DE94 and the notice
// time limits 80:FF14. The lifted versions are src/game/fixed-colour.mjs,
// src/game/palette-cycles.mjs, src/game/player-hit.mjs and src/game/notice-timeout.mjs.
import { clearFixedColour, FIXED_COLOUR_BLACK } from '../../src/task/native-dialog-portrait.mjs';
import { advancePaletteCycles } from '../render/palette-cycles-equations.mjs';
import { sec, clc } from '../../src/task/status-flags.mjs';
import {
  COLOUR_PHASE,
  COLOUR_REQUEST,
  OBJECT_VELOCITY_X,
  OBJECT_VELOCITY_Y,
  PLAYER_HIT_FRAMES,
  PLAYER_OBJECT,
  NOTICE_WINDOW_LAST,
  WRAM,
  NOTICE_WINDOWS,
  NOTICE_FRAMES,
  NOTICE_EFFECT_FRAMES,
  DP_SOUND_EFFECT,
  DP_SOUND_LEVEL,
  DP_SOUND_VOICE,
} from '../../src/task/wram.mjs';
import { COLDATA_RED } from '../../src/constants/ppu.mjs';
import { BYTE_MASK, WORD_MASK } from '../../src/constants/bits.mjs';
import { COLDATA, CGADSUB } from '../../src/constants/hardware-registers.mjs';
import {
  FLAG_CARRY,
  FLAG_NEGATIVE,
  FLAG_ZERO,
  FLAG_MEMORY_8BIT,
} from '../../src/constants/cpu-flags.mjs';

// 8877 colour request bits, ramp steps and the 9-bit phase over color_ramp 80:D3D1;
// the fast ramp ends at phase 180. COLDATA levels use the red bit (ppu.mjs) or all
// three planes; the flash and the ramps write their own CGADSUB values.
const COLOUR_RESET_KEEP = 0x7ffc,
  COLOUR_FLASH = 1,
  COLOUR_FAST_RAMP = 2,
  COLOUR_SLOW_RAMP = 4,
  FAST_RAMP_STEP = 0x40,
  SLOW_RAMP_STEP = 0x10,
  COLOUR_PHASE_MASK = 0x1ff,
  FAST_RAMP_END = 0x180,
  COLOUR_RAMP = 0xd3d1;
const FLASH_FIXED_COLOUR = 0xe5,
  FLASH_COLOUR_MATH = 0xe3,
  RAMP_COLOUR_MATH = 0x23,
  SLOW_RAMP_CLEAR_PLANES = 0xc0;
// Speed of the player figure while PLAYER_HIT_FRAMES runs down.
const HIT_SPEED = 4,
  HIT_SPEED_BACK = -HIT_SPEED & WORD_MASK;
// $81:8877: colour request. The BYTE PPU writes carry their original PC.
export function applyColourRequest(h) {
  const { ctx } = h;
  h.load(h.read(h.abs(COLOUR_REQUEST)));
  if (ctx.status & FLAG_NEGATIVE) {
    h.load(ctx.a & COLOUR_RESET_KEEP);
    h.write(h.abs(COLOUR_REQUEST), ctx.a);
    return clearFixedColour(h);
  }
  if (ctx.status & FLAG_ZERO) return h.rtl();
  h.bit(COLOUR_FLASH);
  if (!(ctx.status & FLAG_ZERO)) {
    h.sep(FLAG_MEMORY_8BIT);
    h.load(FLASH_FIXED_COLOUR);
    h.portWrite(COLDATA, ctx.a & BYTE_MASK, 1, 0x818890);
    h.load(FLASH_COLOUR_MATH);
    h.portWrite(CGADSUB, ctx.a & BYTE_MASK, 1, 0x818895);
    h.rep(FLAG_MEMORY_8BIT);
    h.load(COLOUR_FLASH);
    h.testBits(h.abs(COLOUR_REQUEST), false);
    return h.rtl();
  }
  h.bit(COLOUR_FAST_RAMP);
  const ramp2 = !(ctx.status & FLAG_ZERO);
  if (!ramp2) {
    h.bit(COLOUR_SLOW_RAMP);
    if (ctx.status & FLAG_ZERO) return h.rtl();
  }
  h.load(h.read(h.abs(COLOUR_PHASE)));
  clc(h);
  h.adc(ramp2 ? FAST_RAMP_STEP : SLOW_RAMP_STEP);
  h.load(ctx.a & COLOUR_PHASE_MASK);
  h.write(h.abs(COLOUR_PHASE), ctx.a);
  h.index('x', ctx.a);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(h.read(h.abs(COLOUR_RAMP) + ctx.x));
  h.lsr();
  h.lsr();
  h.lsr();
  if (!ramp2) h.lsr();
  if (!(ctx.status & FLAG_ZERO)) {
    sec(h);
    h.sbc(1);
  }
  h.load(ctx.a | (ramp2 ? FIXED_COLOUR_BLACK : COLDATA_RED));
  h.portWrite(COLDATA, ctx.a & BYTE_MASK, 1, ramp2 ? 0x8188c7 : 0x818907);
  if (!ramp2) {
    h.load(SLOW_RAMP_CLEAR_PLANES);
    h.portWrite(COLDATA, ctx.a & BYTE_MASK, 1, 0x81890c);
  }
  h.load(RAMP_COLOUR_MATH);
  h.portWrite(CGADSUB, ctx.a & BYTE_MASK, 1, ramp2 ? 0x8188cc : 0x818911);
  h.rep(FLAG_MEMORY_8BIT);
  if (ramp2) {
    h.load(h.read(h.abs(COLOUR_PHASE)));
    h.cmp(FAST_RAMP_END);
    if (ctx.status & FLAG_ZERO) {
      h.load(COLOUR_FAST_RAMP);
      h.testBits(h.abs(COLOUR_REQUEST), false);
    }
  } else h.load(h.read(h.abs(COLOUR_REQUEST)));
  return h.rtl();
}

// $81:8076: the same proven equations as the manual palette plan, here directly on WRAM
// (the port stops the palette model after this many work steps).
const PALETTE_WORK_LIMIT = 1000;
export function animatePalettes(h) {
  const { ctx } = h,
    result = advancePaletteCycles({ read: h.a.read, write: h.a.write }, ctx, {
      work: 0,
      maxWork: PALETTE_WORK_LIMIT,
    });
  ctx.a = result.a;
  ctx.x = result.x;
  ctx.y = result.y;
  ctx.status = result.status;
  return h.rtl();
}

// $80:DE94: while $1D65 runs down, set the movement of the player figure to ±4 alternately.
// The parity comes from the old counter value, the zero test from the decremented value.
export function shakeHitPlayer(h) {
  const { ctx } = h;
  h.index('x', h.read(h.abs(PLAYER_OBJECT)));
  if (ctx.status & FLAG_NEGATIVE) return h.rts();
  h.load(h.read(h.abs(PLAYER_HIT_FRAMES)));
  if (ctx.status & FLAG_ZERO) return h.rts();
  h.modify(h.abs(PLAYER_HIT_FRAMES), 'dec');
  if (ctx.status & FLAG_ZERO) {
    h.write(h.abs(OBJECT_VELOCITY_X) + ctx.x, 0);
    h.write(h.abs(OBJECT_VELOCITY_Y) + ctx.x, 0);
  } else {
    h.load(ctx.a & 1);
    h.load(ctx.status & FLAG_ZERO ? HIT_SPEED : HIT_SPEED_BACK);
    h.write(h.abs(OBJECT_VELOCITY_X) + ctx.x, ctx.a);
    h.load(ctx.a === HIT_SPEED ? HIT_SPEED_BACK : HIT_SPEED);
    h.write(h.abs(OBJECT_VELOCITY_Y) + ctx.x, ctx.a);
  }
  return h.rts();
}

// FF14: after the notice effect a random C560 value below 3333 picks one of the three
// upkeep_sound_args 80:FF73 by C51F, played at level 20 on voices 3.
const EFFECT_SOUND_CHANCE = 0x3333,
  EFFECT_SOUND_CHOICES = 3,
  EFFECT_SOUNDS = 0xff73,
  EFFECT_SOUND_LEVEL = 0x20,
  EFFECT_SOUND_VOICES = 3;
// $80:FF14: free four time-limited windows; an occasional sound via the observed random value.
export function releaseExpiredWindows(h, events, routines = MAIN_UPKEEP_ROUTINES) {
  return drainNativeSequence(mainWindowTimeoutSequence(h, events, routines));
}
function* mainWindowTimeoutSequence(h, events, routines) {
  const { ctx } = h,
    call = (pc, target) => nativeCallSequence(h, events, routines, pc, target);
  let done = false,
    result;
  yield () => h.index('x', NOTICE_WINDOW_LAST);
  do {
    let release = false;
    yield () => {
      h.load(h.read(WRAM + NOTICE_WINDOWS + ctx.x));
      if (!(ctx.status & FLAG_NEGATIVE)) {
        h.load(h.read(h.abs(NOTICE_FRAMES) + ctx.x));
        h.load(ctx.a - 1);
        h.write(h.abs(NOTICE_FRAMES) + ctx.x, ctx.a);
        if (ctx.status & FLAG_ZERO) {
          h.load(h.read(WRAM + NOTICE_WINDOWS + ctx.x));
          h.dpWrite(0, ctx.a);
          h.phx();
          release = true;
        }
      }
    };
    if (release) {
      yield* call(0x80ff2d, 0x80fa3e);
      yield () => {
        h.plx();
        h.load(WORD_MASK);
        h.write(WRAM + NOTICE_WINDOWS + ctx.x, ctx.a);
      };
    }
    yield () => {
      h.index('x', ctx.x - 1);
      h.index('x', ctx.x - 1);
    };
  } while (!(ctx.status & FLAG_NEGATIVE));
  yield () => {
    h.load(h.read(h.abs(NOTICE_EFFECT_FRAMES)));
    if (ctx.status & FLAG_ZERO) {
      result = h.rts();
      done = true;
      return;
    }
    h.load(ctx.a - 1);
    h.write(h.abs(NOTICE_EFFECT_FRAMES), ctx.a);
  };
  if (done) return result;
  yield* call(0x80ff45, 0x80c560);
  yield () => {
    h.load(h.dp(0));
    h.cmp(EFFECT_SOUND_CHANCE);
    if (ctx.status & FLAG_CARRY) {
      result = h.rts();
      done = true;
      return;
    }
    h.load(EFFECT_SOUND_CHOICES);
    h.dpWrite(0, ctx.a);
  };
  if (done) return result;
  yield* call(0x80ff54, 0x80c51f);
  yield () => {
    h.load(h.dp(0));
    h.asl();
    h.index('x', ctx.a);
    h.load(h.read(h.abs(EFFECT_SOUNDS) + ctx.x));
    h.dpWrite(DP_SOUND_EFFECT, ctx.a);
    for (const [o, v] of [
      [0, WORD_MASK],
      [DP_SOUND_LEVEL, EFFECT_SOUND_LEVEL],
      [DP_SOUND_VOICE, EFFECT_SOUND_VOICES],
    ]) {
      h.load(v);
      h.dpWrite(o, ctx.a);
    }
  };
  yield* call(0x80ff6f, 0x80c46e);
  yield () => {
    result = h.rts();
  };
  return result;
}

export const MAIN_UPKEEP_REFERENCE_ENTRIES = [
  [0x818877, applyColourRequest],
  [0x818076, animatePalettes],
  [0x80de94, shakeHitPlayer],
  [0x80ff14, releaseExpiredWindows],
];
// The reference waits through its callees; its continuation is found by its run
// function, as the lifted entry holds the target.
NATIVE_CALL_CONTINUATIONS.set(releaseExpiredWindows, {
  run: releaseExpiredWindows,
  create: ({ h, events, routines = MAIN_UPKEEP_ROUTINES }) =>
    new NativeCallContinuation(h.a, mainWindowTimeoutSequence(h, events, routines)),
});
