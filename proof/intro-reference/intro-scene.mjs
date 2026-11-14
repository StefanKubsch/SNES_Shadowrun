// Register-level reference of the intro 81:DFE7 and its NMI callback 81:DF0E (the
// lifted version is src/intro/). The ROM proof tests check it against the original
// instructions; tools/intro-lift.test.mjs compares it with the lifted intro. The
// register-level set-up routines are in intro-setup.mjs and intro-sprites.mjs
// (table entries in intro-routines.mjs).
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  nativeCallSequence,
} from '../../src/task/native-call-continuation.mjs';
import { routineCaller } from '../../src/task/routine-call.mjs';
import { MAIN_SCENE_ROUTINES } from '../../src/task/main-scene.mjs';
import { AUDIO_REFERENCE_ENTRIES } from '../apu-reference/audio-routines.mjs';
import {
  INTRO_FAR_ANIMATION,
  INTRO_NEAR_START_ANIMATION,
  INTRO_NEAR_Y_BIAS,
} from './intro-setup.mjs';
import { INTRO_SETUP_REFERENCE_ENTRIES } from './intro-routines.mjs';
import {
  DP_TITLE_SPEED,
  DP_TITLE_SPEED_TARGET,
  FRONTEND_FRAME_COUNTER,
  INTRO_FAR_ANIMATIONS,
  INTRO_FAR_X,
  INTRO_FAR_Y,
  INTRO_NEAR_ANIMATIONS,
  INTRO_NEAR_X,
  INTRO_NEAR_Y,
  PAD_HELD,
} from '../../src/task/wram.mjs';
import { BYTE_BITS, WORD_BITS, WORD_MASK, WORD_SIGN } from '../../src/constants/bits.mjs';
import { OAM_PRIORITY_2 } from '../../src/constants/ppu.mjs';
import {
  APU_COMMAND_SOUND_VOICES,
  APU_COMMAND_SOUND_VOLUME,
  SOUND_DIRECTORY_TITLE,
} from '../../src/constants/sound-commands.mjs';
import {
  FLAG_CARRY,
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_ZERO,
} from '../../src/constants/cpu-flags.mjs';

// 81:DF0E draws near objects with priority 2; animations step every fourth frame and
// a frame word FFFE restarts them.
const NEAR_OBJECT_TILE = OAM_PRIORITY_2 << BYTE_BITS,
  NEAR_ANIMATION_PERIOD_MASK = 3,
  ANIMATION_RESTART = 0xfffe,
  // The sprite grid 81:E83A takes its attributes and the next OAM offset in the direct page.
  DP_SPRITE_TILE = 0x24,
  DP_OAM_OFFSET = 0x2c;
const callFor = (h, e, r) => routineCaller(h, e, r, true);
// The intro 81:DFE7 (cutscene 14): the intro song and its sound set (bit 15 for F130), a
// sound on voices 6 and 7, then 300 frames unless a key ends them, and cutscene 5 mirrored.
// Two near objects start at animation 36, the third repeats animation 1A at 64/63 once
// the first 100 frames are over; until then 81:E900 adds a near object every eight frames
// (X and Y from 81:E12A/E13A by frame). The far object (animation 28 at 6C/4C) leaves up
// and left after frame 46, faster each frame; the second far slot's X and Y hold its
// fractions.
const INTRO_SCENE_LIST = 0x81f79f,
  INTRO_SOUND_SET = 0x800a,
  SONG_INTRO = 3,
  INTRO_SOUND = 0x440a, // sound 0A, level 44
  VOICES_6_7 = 0xc0,
  INTRO_FRAMES = 0x12c,
  INTRO_END_SCENE = WORD_SIGN | 5,
  NEAR_2_ANIMATION = INTRO_NEAR_ANIMATIONS + 2,
  NEAR_3_ANIMATION = NEAR_2_ANIMATION + 2,
  NEAR_4_ANIMATION = NEAR_3_ANIMATION + 2,
  NEAR_3_X = INTRO_NEAR_X + (NEAR_3_ANIMATION - INTRO_NEAR_ANIMATIONS),
  NEAR_3_Y = INTRO_NEAR_Y + (NEAR_3_ANIMATION - INTRO_NEAR_ANIMATIONS),
  FAR_X_FRACTION = INTRO_FAR_X + 2,
  FAR_Y_FRACTION = INTRO_FAR_Y + 2,
  NEAR_3_LOOP_ANIMATION = 0x1a,
  NEAR_3_LOOP_X = 0x64,
  NEAR_3_LOOP_Y = 0x63,
  FAR_START_X = 0x6c,
  FAR_START_Y = 0x4c,
  SPAWN_FRAMES = 0x64,
  SPAWN_PERIOD_MASK = 7,
  SPAWN_INDEX_MASK = 14,
  SPAWN_X = 0x81e12a,
  SPAWN_Y = 0x81e13a,
  DEPARTURE_FRAME = 0x46,
  DP_DEPARTURE_X_STEP = 0x0e,
  DP_DEPARTURE_Y_STEP = 0x10;
// The NMI 81:DF0E (intro 81:DFE7) draws nine objects without scrolling, the near list and
// the first far object (sprites 81:DF77); the third object uses palette 1.
const INTRO_DF0E_SPRITES = 0x81df77,
  DF0E_OBJECT_LAST = 0x10,
  LIT_OBJECT = 4,
  LIT_OBJECT_TILE = NEAR_OBJECT_TILE | 0x200; // palette 1
// 81:DFE7: play the intro (cutscene 14).
export function playIntro(h, e, routines) {
  return drainNativeSequence(playIntroSequence(h, e, routines));
}
function* playIntroSequence(h, e, routines) {
  const { ctx } = h,
    call = (pc, target, long = false) => nativeCallSequence(h, e, routines, pc, target, long);
  let result;
  yield () => {
    h.php();
    h.pushByte(ctx.programBank);
    h.plb();
    h.rep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
    h.load(0);
  };
  yield* call(0x81dfef, 0x81f229, true);
  yield () => h.load(SOUND_DIRECTORY_TITLE);
  yield* call(0x81dff6, 0x81f092, true);
  yield* call(0x81dffa, 0x81e8e5, true);
  yield* call(0x81dffe, 0x81d60f);
  yield () => {
    h.index('x', INTRO_SCENE_LIST & WORD_MASK);
    h.index('y', INTRO_SCENE_LIST >>> WORD_BITS);
  };
  yield* call(0x81e007, 0x81ec16, true);
  yield () => {
    for (const [value, offsets] of [
      [INTRO_NEAR_START_ANIMATION, [INTRO_NEAR_ANIMATIONS, NEAR_2_ANIMATION]],
      [WORD_MASK, [NEAR_3_ANIMATION, NEAR_4_ANIMATION]],
      [INTRO_FAR_ANIMATION, [INTRO_FAR_ANIMATIONS]],
      [FAR_START_X, [INTRO_FAR_X]],
      [FAR_START_Y, [INTRO_FAR_Y]],
      [WORD_MASK, [FAR_X_FRACTION, FAR_Y_FRACTION]],
    ]) {
      h.load(value);
      for (const o of offsets) h.write(h.abs(o), ctx.a);
    }
  };
  yield* call(0x81e038, 0x81ddb1, true);
  yield* call(0x81e03c, 0x81d642);
  yield () => {
    h.index('x', 1);
    h.load(APU_COMMAND_SOUND_VOICES);
  };
  yield* call(0x81e045, 0x81f007, true);
  yield () => h.load(INTRO_SOUND_SET);
  yield* call(0x81e04c, 0x81f130, true);
  yield () => h.load(SONG_INTRO);
  yield* call(0x81e053, 0x81f229, true);
  yield () => {
    h.index('x', INTRO_SOUND);
    h.load(APU_COMMAND_SOUND_VOLUME);
  };
  yield* call(0x81e05d, 0x81f007, true);
  yield () => {
    h.index('x', VOICES_6_7);
    h.load(APU_COMMAND_SOUND_VOICES);
  };
  yield* call(0x81e067, 0x81f007, true);
  yield* call(0x81e06b, 0x81eb7b, true);
  yield* call(0x81e06f, 0x81eedd, true);
  yield () => {
    h.write(h.abs(FRONTEND_FRAME_COUNTER), 0);
    h.dpWrite(DP_TITLE_SPEED_TARGET, 0);
    h.dpWrite(DP_TITLE_SPEED, 0);
    h.index('x', INTRO_FRAMES);
  };
  for (;;) {
    yield () => h.phx();
    yield* call(0x81e07e, 0x81eebb, true);
    yield* call(0x81e082, 0x80f298, true);
    yield () => {
      h.load(h.read(h.abs(INTRO_FAR_ANIMATIONS)));
      if (ctx.status & FLAG_NEGATIVE) {
        h.load(INTRO_FAR_ANIMATION);
        h.write(h.abs(INTRO_FAR_ANIMATIONS), ctx.a);
      }
      h.load(h.read(h.abs(NEAR_3_ANIMATION)));
      if (ctx.status & FLAG_NEGATIVE) {
        for (const [o, v] of [
          [NEAR_3_ANIMATION, NEAR_3_LOOP_ANIMATION],
          [NEAR_3_X, NEAR_3_LOOP_X],
          [NEAR_3_Y, NEAR_3_LOOP_Y],
        ]) {
          h.load(v);
          h.write(h.abs(o), ctx.a);
        }
      }
      h.load(h.read(h.abs(FRONTEND_FRAME_COUNTER)));
      h.cmp(SPAWN_FRAMES);
      if (!(ctx.status & FLAG_CARRY)) {
        h.load(ctx.a & SPAWN_PERIOD_MASK);
        if (ctx.status & FLAG_ZERO) {
          h.load(h.read(h.abs(FRONTEND_FRAME_COUNTER)));
          h.lsr();
          h.lsr();
          h.load(ctx.a & SPAWN_INDEX_MASK);
          h.index('x', ctx.a);
          h.load(h.read(h.abs(SPAWN_Y & WORD_MASK) + ctx.x));
          h.lsr();
          ctx.status &= ~FLAG_CARRY;
          h.adc(INTRO_NEAR_Y_BIAS);
          h.index('y', ctx.a);
          h.load(h.read(h.abs(SPAWN_X & WORD_MASK) + ctx.x));
          h.lsr();
          h.index('x', ctx.a);
          h.load(0);
          // E900 contains no wait; keep this unchanged helper as one segment.
          routineCaller(h, e, routines)(0x81e0cf, 0x81e900, true);
        }
        h.load(WORD_MASK);
        h.write(h.abs(NEAR_3_ANIMATION), ctx.a);
      } else {
        ctx.status |= FLAG_CARRY;
        h.sbc(DEPARTURE_FRAME);
        h.xba();
        h.dpWrite(DP_DEPARTURE_X_STEP, ctx.a);
        h.lsr();
        h.dpWrite(DP_DEPARTURE_Y_STEP, ctx.a);
        h.load(h.read(h.abs(FAR_X_FRACTION)));
        ctx.status |= FLAG_CARRY;
        h.sbc(h.dp(DP_DEPARTURE_X_STEP));
        h.write(h.abs(FAR_X_FRACTION), ctx.a);
        h.load(h.read(h.abs(INTRO_FAR_X)));
        h.sbc(0);
        h.write(h.abs(INTRO_FAR_X), ctx.a);
        h.load(h.read(h.abs(FAR_Y_FRACTION)));
        ctx.status |= FLAG_CARRY;
        h.sbc(h.dp(DP_DEPARTURE_Y_STEP));
        h.write(h.abs(FAR_Y_FRACTION), ctx.a);
        h.load(h.read(h.abs(INTRO_FAR_Y)));
        h.sbc(0);
        h.write(h.abs(INTRO_FAR_Y), ctx.a);
      }
      h.plx();
      h.load(h.read(h.abs(PAD_HELD)));
    };
    if (!(ctx.status & FLAG_ZERO)) break;
    yield () => h.index('x', ctx.x - 1);
    if (ctx.status & FLAG_ZERO) break;
  }
  yield* call(0x81e115, 0x81eef1, true);
  yield* call(0x81e119, 0x81eb89, true);
  yield () => h.load(INTRO_END_SCENE);
  yield* call(0x81e120, 0x81cdf8, true);
  yield* call(0x81e124, 0x81ef63, true);
  yield () => {
    h.plp();
    result = h.rtl();
  };
  return result;
}
// Original routine $81:DF0E.
export function drawIntroObjects(h, e, r = INTRO_REFERENCE_ROUTINES) {
  return drainNativeSequence(drawIntroObjectsSequence(h, e, r));
}
function* drawIntroObjectsSequence(h, e, r) {
  const { ctx } = h,
    call = callFor(h, e, r);
  let result;
  yield () => {
    call(0x81df0e, 0x81ed8b);
    h.pushByte(ctx.programBank);
    h.plb();
    h.rep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
    call(0x81df16, 0x81edd7);
    h.dpWrite(DP_OAM_OFFSET, 0);
    h.index('x', DF0E_OBJECT_LAST);
    do {
      h.load(NEAR_OBJECT_TILE);
      h.dpWrite(DP_SPRITE_TILE, ctx.a);
      h.cpx(LIT_OBJECT);
      if (ctx.status & FLAG_ZERO) {
        h.load(LIT_OBJECT_TILE);
        h.dpWrite(DP_SPRITE_TILE, ctx.a);
      }
      h.load(h.read(h.abs(INTRO_NEAR_ANIMATIONS) + ctx.x));
      if (!(ctx.status & FLAG_NEGATIVE)) {
        h.index('y', ctx.a);
        h.load(h.read(h.abs(INTRO_DF0E_SPRITES & WORD_MASK) + ctx.y));
        h.phx();
        h.pha();
        h.index('y', h.read(h.abs(INTRO_NEAR_Y) + ctx.x, 2));
        h.load(h.read(h.abs(INTRO_NEAR_X) + ctx.x));
        h.index('x', ctx.a);
        h.pla();
        call(0x81df41, 0x81e83a);
        h.plx();
        h.load(h.read(h.abs(FRONTEND_FRAME_COUNTER)));
        h.load(ctx.a & NEAR_ANIMATION_PERIOD_MASK);
        if (ctx.status & FLAG_ZERO) {
          h.load(h.read(h.abs(INTRO_NEAR_ANIMATIONS) + ctx.x));
          h.load(ctx.a + 1);
          h.load(ctx.a + 1);
          h.write(h.abs(INTRO_NEAR_ANIMATIONS) + ctx.x, ctx.a);
          h.index('y', ctx.a);
          h.load(h.read(h.abs(INTRO_DF0E_SPRITES & WORD_MASK) + ctx.y));
          if (ctx.status & FLAG_NEGATIVE) {
            h.cmp(ANIMATION_RESTART);
            if (ctx.status & FLAG_ZERO) h.load(INTRO_NEAR_START_ANIMATION);
            h.write(h.abs(INTRO_NEAR_ANIMATIONS) + ctx.x, ctx.a);
          }
        }
      }
      h.index('x', ctx.x - 1);
      h.index('x', ctx.x - 1);
    } while (!(ctx.status & FLAG_NEGATIVE));
    h.modify(h.abs(FRONTEND_FRAME_COUNTER), 'inc');
    call(0x81df6e, 0x81ee0c);
  };
  yield* nativeCallSequence(h, e, r, 0x81df72, 0x80f290, true);
  yield () => {
    result = h.rtl();
  };
  return result;
}

// The routine table with the reference intro in place of the lifted one.
export const INTRO_REFERENCE_ROUTINES = new Map([
  ...MAIN_SCENE_ROUTINES,
  ...AUDIO_REFERENCE_ENTRIES,
  ...INTRO_SETUP_REFERENCE_ENTRIES,
  [0x81dfe7, (h, e, r = INTRO_REFERENCE_ROUTINES) => playIntro(h, e, r)],
  [0x81df0e, (h, e, r = INTRO_REFERENCE_ROUTINES) => drawIntroObjects(h, e, r)],
]);
for (const [target, sequence] of [
  [0x81dfe7, playIntroSequence],
  [0x81df0e, drawIntroObjectsSequence],
]) {
  const run = INTRO_REFERENCE_ROUTINES.get(target);
  NATIVE_CALL_CONTINUATIONS.set(run, {
    run,
    create: ({ h, events, routines = INTRO_REFERENCE_ROUTINES }) =>
      new NativeCallContinuation(h.a, sequence(h, events, routines)),
  });
}
