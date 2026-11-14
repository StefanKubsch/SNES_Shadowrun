import { taskStop } from './plan.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { routineCaller } from './routine-call.mjs';
import { FRONTEND_ROUTINES, MAIN_OWNER_ENTRY } from './main-frontend.mjs';
import { interruptStep, lagFree } from './main-wait-interrupt.mjs';
import { bootScreensSequence } from '../frontend/boot-screens.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  nativeCallSequence,
} from './native-call-continuation.mjs';

import {
  APU_COMMAND_TOKEN,
  AUDIO_BLOCK_LIST_POINTER,
  MUSIC,
  SETTINGS_CONTROL_TYPE_A,
  SETTINGS_STEREO,
  SETTINGS_STEREO_ON,
} from './wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';
import {
  FLAG_ZERO,
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_DECIMAL,
} from '../constants/cpu-flags.mjs';
import { APUIO0, APUIO1, APUIO2, APUIO3 } from '../constants/hardware-registers.mjs';
import { CODE_BANK, CODE_BANK_PAIR } from '../constants/memory-map.mjs';
import { APU_COMMAND_SONG_LEVEL, APU_COMMAND_VOLUME } from '../constants/sound-commands.mjs';
export const MAIN_STARTUP_ENTRY = 0xa133;
// IPL transfer of 81:EFA5 (Book I appendix D, PDF 237/238; docs/SOUND-DRIVER.md): the IPL
// reports AA/BB on ports 0/1, CC on port 0 starts a block at the port 2/3 address. The
// driver (0C55 bytes from 97:8000) loads to and starts at ARAM 0200 and reports CA on port
// 1 when ready. The source long pointer lies at AUDIO_BLOCK_LIST_POINTER.
const IPL_READY_PORT0 = 0xaa,
  IPL_READY_PORT1 = 0xbb,
  IPL_START = 0xcc,
  SOUND_DRIVER = 0x978000,
  SOUND_DRIVER_BYTES = 0xc55,
  SOUND_DRIVER_ARAM = 0x0200,
  DRIVER_READY = 0xca,
  SOURCE_BANK = AUDIO_BLOCK_LIST_POINTER + 2;
// 81:EF07: no music, main volume 0, song level 20/20.
const NO_MUSIC = WORD_MASK,
  START_SONG_LEVEL = 0x2020;
// Boot 81:E7BC: the logo (scene list 8A:8000) for 150 frames, the settings (only the
// defined bits of the stereo and control bytes survive; a bad checksum restores the
// defaults), then the second screen (scene list 89:EC26) for up to 180 frames, and the
// output mode to the APU.
const LOGO_LIST = 0x8a8000,
  LOGO_FRAMES = 0x96,
  SECOND_SCREEN_LIST = 0x89ec26,
  SECOND_SCREEN_FRAMES = 0xb4,
  SETTINGS_WORD_BITS = SETTINGS_STEREO_ON | (SETTINGS_CONTROL_TYPE_A << BYTE_BITS);
// SPC bootstrap transfer, not an SPC processor/audio model. Every handshake
// read is an explicit chronological observation at its original instruction.
// Existing isolated compositions may supply only port observations. The cold
// boot owner additionally supplies every original instruction/NMI occurrence.
const startupStep = (h, e, pc) => {
  if (e?.startupInterrupts) interruptStep(h, e, pc);
};
// Original routine $81:F001.
function waitApuEcho(h, e) {
  do {
    startupStep(h, e, 0x81f001);
    h.cmp(h.port(APUIO0, 1, 0x81f001));
    startupStep(h, e, 0x81f004);
  } while (!(h.ctx.status & FLAG_ZERO));
  startupStep(h, e, 0x81f006);
  return h.rts();
}
// Original routine $81:EFFA.
function sendApuByte(h, e) {
  startupStep(h, e, 0x81effa);
  h.portWrite(APUIO1, h.ctx.a & BYTE_MASK, 1, 0x81effa);
  startupStep(h, e, 0x81effd);
  h.load(h.ctx.y);
  startupStep(h, e, 0x81effe);
  h.portWrite(APUIO0, h.ctx.a & BYTE_MASK, 1, 0x81effe);
  return waitApuEcho(h, e);
}
// Original routine $81:EFA5.
function transferToApu(h, e, r = MAIN_STARTUP_ROUTINES) {
  const { ctx } = h,
    call = routineCaller(h, e, r),
    step = (pc) => startupStep(h, e, pc);
  step(0x81efa5);
  h.php();
  step(0x81efa6);
  h.dpWrite(SOURCE_BANK, ctx.a);
  step(0x81efa8);
  h.dpWrite(AUDIO_BLOCK_LIST_POINTER, ctx.y, 2);
  for (;;) {
    step(0x81efaa);
    h.load(h.port(APUIO0, 1, 0x81efaa));
    step(0x81efad);
    h.cmp(IPL_READY_PORT0);
    step(0x81efaf);
    if (!(ctx.status & FLAG_ZERO)) continue;
    step(0x81efb1);
    h.load(h.port(APUIO1, 1, 0x81efb1));
    step(0x81efb4);
    h.cmp(IPL_READY_PORT1);
    step(0x81efb6);
    if (ctx.status & FLAG_ZERO) break;
  }
  // INC $2141 reads and writes the port; it changes N/Z without loading A.
  step(0x81efb8);
  const increment = h.nz((h.port(APUIO1, 1, 0x81efb8) + 1) & BYTE_MASK, 1);
  h.portWrite(APUIO1, increment, 1, 0x81efb8);
  step(0x81efbb);
  h.load(0);
  step(0x81efbd);
  h.portWrite(APUIO2, ctx.a & BYTE_MASK, 1, 0x81efbd);
  step(0x81efc0);
  h.load(SOUND_DRIVER_ARAM >>> BYTE_BITS);
  step(0x81efc2);
  h.portWrite(APUIO3, ctx.a & BYTE_MASK, 1, 0x81efc2);
  step(0x81efc5);
  h.load(IPL_START);
  step(0x81efc7);
  h.portWrite(APUIO0, ctx.a & BYTE_MASK, 1, 0x81efc7);
  step(0x81efca);
  call(0x81efca, 0x81f001);
  step(0x81efcd);
  h.index('y', 0);
  do {
    step(0x81efd0);
    h.load(h.read(h.indirect(AUDIO_BLOCK_LIST_POINTER, ctx.y)));
    step(0x81efd2);
    call(0x81efd2, 0x81effa);
    step(0x81efd5);
    h.index('y', ctx.y + 1);
    step(0x81efd6);
    h.index('x', ctx.x - 1);
    step(0x81efd7);
  } while (!(ctx.status & FLAG_ZERO));
  step(0x81efd9);
  h.portWrite(APUIO1, 0, 1, 0x81efd9);
  step(0x81efdc);
  h.load(0);
  step(0x81efde);
  h.portWrite(APUIO2, ctx.a & BYTE_MASK, 1, 0x81efde);
  step(0x81efe1);
  h.load(SOUND_DRIVER_ARAM >>> BYTE_BITS);
  step(0x81efe3);
  h.portWrite(APUIO3, ctx.a & BYTE_MASK, 1, 0x81efe3);
  step(0x81efe6);
  h.load(ctx.y);
  step(0x81efe7);
  h.load(ctx.a + 1);
  step(0x81efe8);
  h.portWrite(APUIO0, ctx.a & BYTE_MASK, 1, 0x81efe8);
  step(0x81efeb);
  h.load(DRIVER_READY);
  do {
    step(0x81efed);
    h.cmp(h.port(APUIO1, 1, 0x81efed));
    step(0x81eff0);
  } while (!(ctx.status & FLAG_ZERO));
  step(0x81eff2);
  h.portWrite(APUIO0, 0, 1, 0x81eff2);
  step(0x81eff5);
  h.write(h.abs(APU_COMMAND_TOKEN), 0);
  step(0x81eff8);
  h.plp();
  step(0x81eff9);
  return h.rtl();
}
// Original routine $81:F07F.
function loadSoundDriver(h, e, r = MAIN_STARTUP_ROUTINES) {
  const step = (pc) => startupStep(h, e, pc);
  step(0x81f07f);
  h.php();
  step(0x81f080);
  h.rep(FLAG_INDEX_8BIT);
  step(0x81f082);
  h.sep(FLAG_MEMORY_8BIT);
  step(0x81f084);
  h.index('y', SOUND_DRIVER & WORD_MASK);
  step(0x81f087);
  h.load(SOUND_DRIVER >>> WORD_BITS);
  step(0x81f089);
  h.index('x', SOUND_DRIVER_BYTES);
  step(0x81f08c);
  routineCaller(h, e, r)(0x81f08c, 0x81efa5, true);
  step(0x81f090);
  h.plp();
  step(0x81f091);
  return h.rtl();
}
// Original routine $81:EF07.
function startSoundDriver(h, e, r = MAIN_STARTUP_ROUTINES) {
  const call = routineCaller(h, e, r),
    step = (pc) => startupStep(h, e, pc);
  step(0x81ef07);
  h.load(NO_MUSIC);
  step(0x81ef0a);
  h.write(h.abs(MUSIC), h.ctx.a);
  step(0x81ef0d);
  call(0x81ef0d, 0x81f07f, true);
  step(0x81ef11);
  h.load(APU_COMMAND_VOLUME);
  step(0x81ef14);
  h.index('x', 0);
  step(0x81ef17);
  call(0x81ef17, 0x81f007, true);
  step(0x81ef1b);
  h.load(APU_COMMAND_SONG_LEVEL);
  step(0x81ef1e);
  h.index('x', START_SONG_LEVEL);
  step(0x81ef21);
  call(0x81ef21, 0x81f007, true);
  step(0x81ef25);
  return h.rtl();
}
// Original routine $81:E7BC.
export function showBootScreens(h, e, r = MAIN_STARTUP_ROUTINES) {
  return drainNativeSequence(showBootScreensSequence(h, e, r));
}
function* showBootScreensSequence(h, e, r) {
  const { ctx } = h,
    call = (pc, target) => nativeCallSequence(h, e, r, pc, target, true);
  let result;
  yield () => {
    h.php();
    h.rep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
    h.dpWrite(0x10, 0); // magic-number-ok: direct page 10 cleared at boot; no reader established
  };
  yield* call(0x81e7c1, 0x81eb97);
  yield () => {
    h.index('x', LOGO_LIST & WORD_MASK);
    h.index('y', LOGO_LIST >>> WORD_BITS);
  };
  for (const [pc, target] of [
    [0x81e7cb, 0x81ec16],
    [0x81e7cf, 0x81ebe9],
    [0x81e7d3, 0x81eb7b],
    [0x81e7d7, 0x81eedd],
    [0x81e7db, 0x81ef07],
  ])
    yield* call(pc, target);
  yield () => h.index('x', LOGO_FRAMES);
  do {
    yield* call(0x81e7e2, 0x81eebb);
    yield () => h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_ZERO));
  yield* call(0x81e7e9, 0x81eef1);
  yield* call(0x81e7ed, 0x81eb89);
  yield () => {
    h.load(h.read(SETTINGS_STEREO));
    h.load(ctx.a & SETTINGS_WORD_BITS);
    h.write(SETTINGS_STEREO, ctx.a);
    h.sep(FLAG_MEMORY_8BIT);
  };
  yield* call(0x81e7fe, 0x81d5ec);
  if (!(ctx.status & FLAG_ZERO)) yield* call(0x81e804, 0x81d5f4);
  yield () => h.rep(FLAG_MEMORY_8BIT);
  yield* call(0x81e80a, 0x81eb97);
  yield () => {
    h.index('x', SECOND_SCREEN_LIST & WORD_MASK);
    h.index('y', SECOND_SCREEN_LIST >>> WORD_BITS);
  };
  for (const [pc, target] of [
    [0x81e814, 0x81ec16],
    [0x81e818, 0x81ebe9],
    [0x81e81c, 0x81eb7b],
    [0x81e820, 0x81eedd],
  ])
    yield* call(pc, target);
  yield () => h.index('x', SECOND_SCREEN_FRAMES);
  for (const [pc, target] of [
    [0x81e827, 0x81eed5],
    [0x81e82b, 0x81eef1],
    [0x81e82f, 0x81eb89],
    [0x81e833, 0x81ef36],
  ])
    yield* call(pc, target);
  yield () => {
    h.plp();
    result = h.rtl();
  };
  return result;
}
// Original routine $80:A15C.
function runBootScreens(h, e, r = MAIN_STARTUP_ROUTINES) {
  return drainNativeSequence(runBootScreensSequence(h, e, r));
}
function* runBootScreensSequence(h, e, r) {
  let result;
  yield () => h.php();
  yield* nativeCallSequence(h, e, r, 0x80a15d, 0x81e7bc, true);
  yield () => {
    h.push(CODE_BANK_PAIR, 2);
    h.plb();
    h.plb();
    h.plp();
    result = h.rts();
  };
  return result;
}
for (const [target, run, sequence] of [
  [0x81e7bc, showBootScreens, showBootScreensSequence],
  [0x80a15c, runBootScreens, runBootScreensSequence],
])
  NATIVE_CALL_CONTINUATIONS.set(target, {
    run,
    create: ({ h, events, routines = MAIN_STARTUP_ROUTINES }) =>
      new NativeCallContinuation(h.a, sequence(h, events, routines)),
  });
// 81:E7BC for the live game: the lifted boot screens (src/frontend/boot-screens.mjs)
// with lag-free frames; recorded runs keep the register-level screens above.
export function runBootScreensLifted(h, e, r = MAIN_STARTUP_ROUTINES) {
  if (!lagFree(e)) return showBootScreens(h, e, r);
  return drainNativeSequence(bootScreensSequence(h, e));
}
NATIVE_CALL_CONTINUATIONS.set(runBootScreensLifted, {
  run: runBootScreensLifted,
  create: (call) =>
    lagFree(call.events)
      ? new NativeCallContinuation(call.h.a, bootScreensSequence(call.h, call.events))
      : NATIVE_CALL_CONTINUATIONS.get(0x81e7bc).create(call),
});
export const MAIN_STARTUP_ROUTINES = new Map([
  ...FRONTEND_ROUTINES,
  [0x81e839, (h) => h.rtl()],
  [0x81f001, waitApuEcho],
  [0x81effa, sendApuByte],
  [0x81efa5, transferToApu],
  [0x81f07f, loadSoundDriver],
  [0x81ef07, startSoundDriver],
  [0x81e7bc, runBootScreensLifted],
  [0x80a15c, runBootScreens],
]);

// Original A133 JSR A15C / LDA 1 falls through to the endless menu owner.
// The earlier reset caller and its initial state are separate contracts.
export function runMainStartup(a, e, r = MAIN_STARTUP_ROUTINES) {
  return drainNativeSequence(mainStartupSequence(a, e, r));
}
export class MainStartupContinuation extends NativeCallContinuation {
  constructor(a, e, r = MAIN_STARTUP_ROUTINES) {
    super(a, mainStartupSequence(a, e, r));
  }
}
function* mainStartupSequence(a, e, r) {
  const { ctx } = a;
  if (
    ctx.programBank !== CODE_BANK ||
    ctx.pc !== MAIN_STARTUP_ENTRY ||
    ctx.d !== 0 ||
    ctx.bank !== CODE_BANK ||
    ctx.status & (FLAG_DECIMAL | FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('main_startup_entry_required', { pc: ctx.pc });
  const h = dialogAccess(a);
  yield* nativeCallSequence(h, e, r, 0x80a133, 0x80a15c);
  yield () => {
    h.load(1);
    ctx.pc = MAIN_OWNER_ENTRY;
  };
  return ctx.pc;
}
