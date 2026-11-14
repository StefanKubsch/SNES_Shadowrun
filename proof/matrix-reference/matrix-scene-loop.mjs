// Reference: the register-level matrix scene loop 81:C3CA as it ran before the
// lift to src/matrix (docs/MATRIX-LIFT.md). Tests run it against the lifted scene.
import { MAIN_SCENE_ROUTINES } from '../../src/task/main-scene.mjs';
import { AUDIO_REFERENCE_ENTRIES } from '../apu-reference/audio-routines.mjs';
import {
  NATIVE_CALL_CONTINUATIONS,
  NativeCallContinuation,
  drainNativeSequence,
  nativeCallSequence,
} from '../../src/task/native-call-continuation.mjs';
import { MATRIX_SETUP_ROUTINES, MAP_BANK } from './main-scene-matrix.mjs';
import { MATRIX_OBJECT_ROUTINES, MATRIX_MAP_VRAM } from './main-matrix-objects.mjs';
import { MATRIX_CONTROL_ROUTINES } from './main-matrix-control.mjs';
import { MATRIX_NMI_ROUTINES } from './main-matrix-nmi.mjs';
import {
  DECKER_DATA_BITS,
  DECKER_DOWNLOAD_BITS,
  DECKER_HEALTH,
  DECKER_MEMORY,
  MATRIX_CPU_BITS,
  MATRIX_DATA_BITS,
  MATRIX_DEATH_COUNTER,
  MATRIX_DMA_END,
  MATRIX_DMA_RECORDS,
  MATRIX_DOWNLOAD_BITS,
  MATRIX_EXTRA_NODES,
  MATRIX_HEALTH,
  MATRIX_MAP,
  MATRIX_MEMORY,
  MATRIX_MEMORY_LIMIT,
  MATRIX_MEMORY_SHOWN,
  MATRIX_MESSAGES,
  MATRIX_PERSONA_X,
  MATRIX_PERSONA_Y,
  MATRIX_SYSTEM,
  PAD_PRESSED,
  PAD_X,
} from '../../src/task/wram.mjs';
import { BYTE_MASK, WORD_BITS, WORD_MASK } from '../../src/constants/bits.mjs';
import { FLAG_CARRY, FLAG_MEMORY_8BIT, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';

const CREDITS_CHARACTERS = 0x85fd38;
// 81:C3CA: audio mode 8, the register list 81:CDB2, the streams (src/data/lz-streams.mjs)
// into bank 7F: the text characters to 7F:0000, the back map to 7F:0216 (VRAM 2400), the 16
// system maps (800 bytes each) and one more map to 7F:8216; X jacks out, after which the
// persona leaves the grid (8000) and 60 frames run on.
const MATRIX_AUDIO_MODE = 8,
  MATRIX_LIST = 0x81cdb2,
  BACK_MAP_STREAM = 0x89ec1b,
  SYSTEM_MAPS_STREAM = 0x89e14e,
  EXTRA_MAP_STREAM = 0x89eb4b,
  MAP_BUFFER = 0x216,
  EXTRA_MAP_BUFFER = 0x8216,
  MATRIX_BACK_MAP_VRAM = 0x2400,
  TEXT_JACKED_OUT = 0x81c61c,
  JACKED_OUT = 0x8000,
  JACK_OUT_FRAMES = 0x3c;
const begin = (h) => {
  h.php();
  h.phb();
  h.pushByte(h.ctx.programBank);
  h.plb();
};
const end = (h) => {
  h.plb();
  h.plp();
  return h.rtl();
};
// 81:C3CA: play the matrix scene until the decker jacks out.
export function playMatrixScene(h, events, routines = MATRIX_REFERENCE_ROUTINES) {
  return drainNativeSequence(playMatrixSceneSequence(h, events, routines));
}
function* playMatrixSceneSequence(h, events, routines) {
  const { ctx } = h,
    call = (pc, target, long = false) => nativeCallSequence(h, events, routines, pc, target, long);
  let result;
  yield () => begin(h);
  yield* call(0x81c3ce, 0x81eb97, true);
  yield () => h.load(MATRIX_AUDIO_MODE);
  yield* call(0x81c3d5, 0x81ef47, true);
  yield () => {
    h.write(h.abs(MATRIX_DMA_END), 0);
    h.write(h.abs(MATRIX_DMA_RECORDS), 0);
    h.index('x', MATRIX_LIST & WORD_MASK);
    h.index('y', MATRIX_LIST >>> WORD_BITS);
  };
  yield* call(0x81c3e5, 0x81ec16, true);
  for (const [pc, a, y, x] of [
    [0x81c3f2, CREDITS_CHARACTERS & WORD_MASK, CREDITS_CHARACTERS >>> WORD_BITS, 0],
    [0x81c3ff, BACK_MAP_STREAM & WORD_MASK, BACK_MAP_STREAM >>> WORD_BITS, MAP_BUFFER],
    [0x81c418, SYSTEM_MAPS_STREAM & WORD_MASK, SYSTEM_MAPS_STREAM >>> WORD_BITS, MAP_BUFFER],
    [0x81c425, EXTRA_MAP_STREAM & WORD_MASK, EXTRA_MAP_STREAM >>> WORD_BITS, EXTRA_MAP_BUFFER],
  ]) {
    yield () => {
      h.load(a);
      h.index('y', y);
      h.index('x', x);
    };
    yield* call(pc, 0x80f2a4, true);
    if (pc === 0x81c3ff) {
      yield () => {
        h.load(MAP_BUFFER);
        h.index('y', MAP_BANK);
        h.index('x', MATRIX_BACK_MAP_VRAM);
      };
      yield* call(0x81c40c, 0x81b4d3);
    }
  }
  yield () => {
    h.load(h.read(h.abs(MATRIX_SYSTEM)) & BYTE_MASK);
    h.xba();
    h.asl();
    h.asl();
    h.asl();
    h.adc(MAP_BUFFER);
    h.write(h.abs(MATRIX_MAP), ctx.a);
    h.load(h.read(h.abs(MATRIX_MAP)));
    h.index('y', MAP_BANK);
    h.index('x', MATRIX_MAP_VRAM);
  };
  yield* call(0x81c442, 0x81b4d3);
  yield* call(0x81c445, 0x81b2a0);
  yield* call(0x81c448, 0x81c39f);
  yield* call(0x81c44b, 0x81eb7b, true);
  yield* call(0x81c44f, 0x81eedd, true);
  do {
    yield* call(0x81c453, 0x81eebb, true);
    yield* call(0x81c457, 0x81b2d1);
  } while (ctx.status & FLAG_CARRY);
  yield () => {
    h.load(h.read(h.abs(DECKER_HEALTH)) & BYTE_MASK);
    h.write(h.abs(MATRIX_HEALTH), ctx.a);
    for (const o of [MATRIX_DEATH_COUNTER, MATRIX_MEMORY_SHOWN, MATRIX_MEMORY])
      h.write(h.abs(o), 0);
    h.load(h.read(h.abs(DECKER_MEMORY)) & BYTE_MASK);
    h.write(h.abs(MATRIX_MEMORY_LIMIT), ctx.a);
    for (const o of [MATRIX_DATA_BITS, MATRIX_CPU_BITS, MATRIX_DOWNLOAD_BITS]) h.write(h.abs(o), 0);
    h.load(h.read(h.abs(MATRIX_MESSAGES)) & BYTE_MASK);
  };
  if (!(ctx.status & FLAG_ZERO)) {
    for (const [pc, t] of [
      [0x81c48b, 0x81bfd8],
      [0x81c48e, 0x81bd62],
      [0x81c491, 0x81c029],
    ])
      yield* call(pc, t);
    yield () => h.load(h.read(h.abs(MATRIX_EXTRA_NODES)));
    yield* call(0x81c497, 0x81b56f);
    for (const [pc, t] of [
      [0x81c49a, 0x81b84a],
      [0x81c49d, 0x81bd7c],
      [0x81c4a0, 0x81bff8],
    ])
      yield* call(pc, t);
    do {
      yield* call(0x81c4a3, 0x81eebb, true);
      yield* call(0x81c4a7, 0x80f298, true);
      for (const [pc, t] of [
        [0x81c4ab, 0x81b485],
        [0x81c4ae, 0x81b2d1],
        [0x81c4b1, 0x81b84a],
        [0x81c4b4, 0x81bd44],
        [0x81c4b7, 0x81c111],
        [0x81c4ba, 0x81c28c],
        [0x81c4bd, 0x81b90f],
        [0x81c4c0, 0x81bd7c],
      ])
        yield* call(pc, t);
      yield () => h.load(h.read(h.abs(PAD_PRESSED)) & PAD_X);
      if (!(ctx.status & FLAG_ZERO)) break;
      yield () => h.load(h.read(h.abs(MATRIX_DEATH_COUNTER)));
    } while (!(ctx.status & FLAG_ZERO));
    yield () => {
      h.index('x', TEXT_JACKED_OUT & WORD_MASK);
      h.index('y', TEXT_JACKED_OUT >>> WORD_BITS);
    };
    yield* call(0x81c4d6, 0x81b282);
    yield () => {
      h.load(JACKED_OUT);
      h.write(h.abs(MATRIX_PERSONA_X), ctx.a);
      h.write(h.abs(MATRIX_PERSONA_Y), ctx.a);
      h.index('x', JACK_OUT_FRAMES);
    };
    do {
      yield () => h.phx();
      yield* call(0x81c4e6, 0x81eebb, true);
      for (const [pc, t] of [
        [0x81c4ea, 0x81b485],
        [0x81c4ed, 0x81b2d1],
        [0x81c4f0, 0x81b90f],
        [0x81c4f3, 0x81bd7c],
      ])
        yield* call(pc, t);
      yield () => {
        h.plx();
        h.index('x', ctx.x - 1);
      };
    } while (!(ctx.status & FLAG_ZERO));
  }
  yield* call(0x81c4fa, 0x81eef1, true);
  yield () => {
    h.sep(FLAG_MEMORY_8BIT);
    for (const [source, dest] of [
      [MATRIX_HEALTH, DECKER_HEALTH],
      [MATRIX_DATA_BITS, DECKER_DATA_BITS],
      [MATRIX_DOWNLOAD_BITS, DECKER_DOWNLOAD_BITS],
    ]) {
      h.load(h.read(h.abs(source)));
      h.write(h.abs(dest), ctx.a);
    }
    result = end(h);
  };
  return result;
}
NATIVE_CALL_CONTINUATIONS.set(playMatrixScene, {
  run: playMatrixScene,
  create: ({ h, events, routines = MATRIX_REFERENCE_ROUTINES }) =>
    new NativeCallContinuation(h.a, playMatrixSceneSequence(h, events, routines)),
});

// The routine table with the reference matrix in place of the lifted one.
export const MATRIX_REFERENCE_ROUTINES = new Map([
  ...MAIN_SCENE_ROUTINES,
  ...AUDIO_REFERENCE_ENTRIES,
  ...MATRIX_SETUP_ROUTINES,
  ...MATRIX_OBJECT_ROUTINES,
  ...MATRIX_CONTROL_ROUTINES,
  ...MATRIX_NMI_ROUTINES,
  [0x81c3ca, playMatrixScene],
]);
