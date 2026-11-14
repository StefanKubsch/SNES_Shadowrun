import { taskStop } from './plan.mjs';
import { waitForFrameWithInterrupts, ObservedWaitContinuation } from './main-wait-interrupt.mjs';
import { NativeWaitContinuation } from './native-wait-continuation.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  nativeCallSequence,
} from './native-call-continuation.mjs';

import { PAD_HELD, RANDOM_STATE, WRAM, NMITIMEN_SHADOW } from './wram.mjs';
import { INIDISP_FORCED_BLANK, MAX_BRIGHTNESS } from '../constants/ppu.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';
import { HVBJOY, INIDISP, STDCNTRL1L } from '../constants/hardware-registers.mjs';
import {
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_ZERO,
  FLAG_INDEX_8BIT,
} from '../constants/cpu-flags.mjs';
// One explicitly observed BYTE at the original polling instruction. No inferred NMI or frame.
export function sceneWaitByte(h, events, pc, address) {
  const index = events?.waitIndex ?? 0,
    o = events?.values?.[index];
  if (
    events?.mode !== 'record-observations' ||
    !Array.isArray(events.values) ||
    !Object.isFrozen(events.values) ||
    !o ||
    !Object.isFrozen(o) ||
    o.pc !== pc ||
    o.address !== address ||
    o.width !== 1 ||
    !Number.isInteger(o.value) ||
    o.value < 0 ||
    o.value > BYTE_MASK
  )
    taskStop('task_wait_observation_required', { pc, address, width: 1, observationIndex: index });
  events.waitIndex++;
  events.waitEvents.push(o);
  h.write(address, o.value, 1);
  return h.read(address, 1);
}
// 81:EEBB: wait for the next frame: poll VBlank (NMI disabled) or wait until the NMI changes the random state byte.
export function waitForFrame(h, events) {
  if (events?.interrupts !== undefined) return waitForFrameWithInterrupts(h, events);
  const { ctx } = h;
  h.php();
  h.sep(FLAG_MEMORY_8BIT);
  h.load(h.dp(NMITIMEN_SHADOW));
  if (!(ctx.status & FLAG_NEGATIVE)) {
    do {
      h.load(h.port(HVBJOY, 1, 0x81eec2));
    } while (ctx.status & FLAG_NEGATIVE);
  } else {
    h.load(h.read(WRAM + RANDOM_STATE));
    do {
      const value = sceneWaitByte(h, events, 0x81eecd, WRAM + RANDOM_STATE);
      h.cmp(value);
    } while (ctx.status & FLAG_ZERO);
  }
  h.plp();
  return h.rtl();
}
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
NATIVE_CALL_CONTINUATIONS.set(0x81eebb, {
  run: waitForFrame,
  create: ({ h, events }) =>
    events?.interrupts === undefined ? null : new ObservedWaitContinuation(h, events, 0x81eebb),
});
