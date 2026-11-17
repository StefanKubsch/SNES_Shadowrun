// Register-level scene waits that only the scene, cutscene, matrix and intro
// references call: frame count 81:EED5, fades 81:EEDD/EEF1 and joypad reads
// 80:9E0B/F290. The game waits, fades and reads the joypad through its lifted code.
import { waitForFrame } from '../../src/system/main-scene-wait.mjs';
import { NativeWaitContinuation } from '../../src/system/native-wait-continuation.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  nativeCallSequence,
} from '../../src/system/native-call-continuation.mjs';
import { PAD_HELD } from '../../src/data/wram.mjs';
import { INIDISP_FORCED_BLANK, MAX_BRIGHTNESS } from '../../src/constants/ppu.mjs';
import { BYTE_MASK } from '../../src/constants/bits.mjs';
import { HVBJOY, INIDISP, STDCNTRL1L } from '../../src/constants/hardware-registers.mjs';
import {
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_ZERO,
  FLAG_INDEX_8BIT,
} from '../../src/constants/cpu-flags.mjs';

// 81:EEDD: fade the screen in, one brightness step per frame.
export function fadeInScreen(h, events) {
  return drainNativeSequence(fadeInScreenSequence(h, events));
}
function* fadeInScreenSequence(h, events) {
  const { ctx } = h;
  let result;
  yield () => {
    h.php();
    h.sep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
    h.index('x', MAX_BRIGHTNESS);
  };
  do {
    yield* nativeCallSequence(h, events, SCENE_WAIT_ROUTINES, 0x81eee2, 0x81eebb, true);
    yield () => {
      h.load(ctx.x);
      h.load(ctx.a ^ MAX_BRIGHTNESS);
      h.portWrite(INIDISP, ctx.a & BYTE_MASK, 1, 0x81eee9);
      h.index('x', ctx.x - 1);
    };
  } while (!(ctx.status & FLAG_NEGATIVE));
  yield () => {
    h.plp();
    result = h.rtl();
  };
  return result;
}
// 81:EED5: wait X frames through EEBB.
export function waitFrames(h, events) {
  return drainNativeSequence(waitFramesSequence(h, events));
}
function* waitFramesSequence(h, events) {
  let result;
  do {
    yield* nativeCallSequence(h, events, SCENE_WAIT_ROUTINES, 0x81eed5, 0x81eebb, true);
    yield () => h.index('x', h.ctx.x - 1);
  } while (!(h.ctx.status & FLAG_ZERO));
  yield () => {
    result = h.rtl();
  };
  return result;
}
// 81:EEF1: fade the screen out, one brightness step per frame, then forced blank.
export function fadeOutScreen(h, events) {
  return drainNativeSequence(fadeOutScreenSequence(h, events));
}
function* fadeOutScreenSequence(h, events) {
  const { ctx } = h;
  let result;
  yield () => {
    h.php();
    h.sep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
    h.index('x', MAX_BRIGHTNESS);
  };
  do {
    yield* nativeCallSequence(h, events, SCENE_WAIT_ROUTINES, 0x81eef6, 0x81eebb, true);
    yield () => {
      h.portWrite(INIDISP, ctx.x, 1, 0x81eefa);
      h.index('x', ctx.x - 1);
    };
  } while (!(ctx.status & FLAG_NEGATIVE));
  yield () => {
    h.load(INIDISP_FORCED_BLANK);
    h.portWrite(INIDISP, ctx.a & BYTE_MASK, 1, 0x81ef02);
    h.plp();
    result = h.rtl();
  };
  return result;
}
// 80:F290: long form of 9E0B (PHP/REP, JSR 9E0B, PLP, RTL).
export function readJoypadLong(h, e) {
  return drainNativeSequence(readJoypadLongSequence(h, e));
}
function* readJoypadLongSequence(h, e) {
  let result;
  yield () => {
    h.php();
    h.rep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
  };
  yield* nativeCallSequence(h, e, SCENE_WAIT_ROUTINES, 0x80f293, 0x809e0b);
  yield () => {
    h.plp();
    result = h.rtl();
  };
  return result;
}
// 80:9E0B: wait for the automatic joypad read to finish and store the held buttons.
export function readJoypad(h) {
  const { ctx } = h;
  do {
    h.load(h.port(HVBJOY, 2, 0x809e0b));
    h.load(ctx.a & 1);
  } while (!(ctx.status & FLAG_ZERO));
  h.load(h.port(STDCNTRL1L, 2, 0x809e13));
  h.write(h.abs(PAD_HELD), ctx.a);
  return h.rts();
}

export const SCENE_WAIT_ROUTINES = new Map([
  [0x80f290, readJoypadLong],
  [0x809e0b, readJoypad],
  [0x81eebb, waitForFrame],
]);
for (const [target, run, sequence] of [
  [0x80f290, readJoypadLong, readJoypadLongSequence],
  [0x81eed5, waitFrames, waitFramesSequence],
  [0x81eedd, fadeInScreen, fadeInScreenSequence],
  [0x81eef1, fadeOutScreen, fadeOutScreenSequence],
])
  NATIVE_CALL_CONTINUATIONS.set(target, {
    run,
    create: ({ h, events }) => new NativeCallContinuation(h.a, sequence(h, events)),
  });
NATIVE_CALL_CONTINUATIONS.set(0x809e0b, {
  run: readJoypad,
  create: ({ h }) => new NativeWaitContinuation(h.a, 0x809e0b),
});
