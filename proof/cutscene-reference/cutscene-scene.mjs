// Register-level reference of the cutscenes 81:CDF8 with 81:CF79, 81:D37D, 81:D4E8
// and the NMI callback 81:D479 (the lifted version is src/cutscene/). The ROM proof
// tests check it against the original instructions; tools/cutscene-lift.test.mjs
// compares it with the lifted cutscenes.
// 81:D37D: the text map after the cutscene picture is filled with priority tile 0; H-DMA
// channel 5 writes TM from SCENE_TM_HDMA (mode 0): the main layers for 76 lines, then 64
// single lines. Scene buffers and tables shared with cutscene-animation.mjs live there.
import {
  DP_CUTSCENE_POSITION,
  DP_CUTSCENE_SCENE,
  DP_CUTSCENE_SCROLL_Y,
  DP_CUTSCENE_SPEED,
  DP_CUTSCENE_SPEED_STEP,
  DP_CUTSCENE_SPEED_TARGET,
  DP_CUTSCENE_SPEED_STEP as DP_STEP,
  DP_CUTSCENE_SPEED_TARGET as DP_TARGET,
  MUSIC,
  OAM_SHADOW,
  OAM_SHADOW_HIGH,
  PAD_B,
  PAD_HELD,
  PAD_START,
  SCENE_ANIMATION_STEP,
  SCENE_ARGUMENT,
  SCENE_BRIGHTNESS,
  SCENE_BRIGHTNESS_TARGET,
  SCENE_COUNTER,
  SOUND_LOADED_SET,
  SOUND_VOICE_MASK,
  VRAM_SLOT_COUNT,
} from '../../src/task/wram.mjs';
import {
  CHARACTER_MAP,
  CREDITS_BUFFER,
  DP_POSITION,
  DP_SCENE,
  DP_SCROLL_Y,
  DP_SPEED,
  MAP_BYTES,
  SCENE_LAYERS,
  SCENE_PICTURE,
  SCENE_SPRITE_BASES,
  SCENE_TEXT_MAP,
  SCENE_TM_HDMA,
  SCENE_TM_LINES,
} from './cutscene-animation.mjs';
import {
  A1B5,
  A1B7,
  A1T5L,
  A1T7L,
  BBAD5,
  BBAD7,
  BG1VOFS,
  BG2HOFS,
  DMAP5,
  DMAP7,
  HDMAEN,
  INIDISP,
  TM,
  TMW,
  VMADDL,
  VMDATAL,
  W12SEL,
  W34SEL,
  WBGLOG,
  WH0,
  WOBJLOG,
  WOBJSEL,
} from '../../src/constants/hardware-registers.mjs';
import {
  DMAP_TWO_PORTS,
  INIDISP_FORCED_BLANK,
  MAX_BRIGHTNESS,
  OAM_ENTRY_BYTES,
  OAM_HIGH_ALL_LARGE,
  TILE_H_FLIP,
  TILE_PRIORITY,
  WINDOW_1_ENABLE,
  WINDOW_1_INVERT,
  WINDOW_HIGH_LAYER_SHIFT,
} from '../../src/constants/ppu.mjs';
import {
  APU_COMMAND_SOUND_VOICES,
  APU_COMMAND_SOUND_VOLUME,
} from '../../src/constants/sound-commands.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  BYTE_VALUES,
  NIBBLE_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../../src/constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_ZERO,
} from '../../src/constants/cpu-flags.mjs';
import { CODE_BANK_PAIR } from '../../src/constants/memory-map.mjs';
import {
  NATIVE_CALL_CONTINUATIONS,
  NativeCallContinuation,
  drainNativeSequence,
  nativeCallSequence,
  nativeTailSequence,
} from '../../src/task/native-call-continuation.mjs';
import { CREDITS_SEQUENCE, heldPad, menuCreditsRunning } from '../../src/game/credits.mjs';
import {
  beginPackedTextEdit,
  endPackedTextEdit,
  CREDITS_EDIT,
} from '../../src/data/packed-text-edits.mjs';
import { MAIN_SCENE_ROUTINES } from '../../src/task/main-scene.mjs';
import { AUDIO_REFERENCE_ENTRIES } from '../apu-reference/audio-routines.mjs';
import { FadePollContinuation } from '../../src/task/main-wait-interrupt.mjs';
import { sceneWaitByte, SCENE_WAIT_ROUTINES } from '../../src/task/main-scene-wait.mjs';
import { sendOamBuffer } from '../../src/task/main-scene-video.mjs';
import { animateCutscene } from './cutscene-animation.mjs';

// The call boundary of the register-level cutscene: status and data bank 81.
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
// 81:D479 converts the BG2 fixed-point position to scroll and mirrors nine bits.
const POSITION_SCROLL_SHIFT = 7,
  SCROLL_MIRROR_MASK = 0x1ff;

const TM_TOP_LINES = 0x4c,
  TM_LINES_LAST = 0x7e;
// 81:D4E8: two OBJ parts (81:D529, its offset word read from D527 + X), mirrored for a
// negative scene (X C0 - base, OAM byte 3 bit 6 H flip); both sprites large.
const SCENE_SPRITE_PARTS = 0x81d529,
  SPRITE_PARTS_LAST = 6,
  SCENE_MIRROR_X = 0xc0,
  OBJ_H_FLIP_WORD = 0x4000,
  DP_SPRITE_X = 0xe,
  DP_SPRITE_FLIP = 0x10;
// 81:CF79 mirrors the 30 rows of the picture (32 words each) and sends 780 bytes to VRAM 0.
const PICTURE_LAST_ROW = 0x1d,
  HALF_ROW_WORDS = 0x10,
  ROW_MIRROR = 0x3e,
  PICTURE_BYTES = 0x780,
  DP_ROW = 0xe,
  DP_SWAPPED = 0x10;
// 81:CDF8 cutscenes (scene DP1E, negative: mirrored; 14 is the intro 81:DFE7) and their
// tables (src/data/tables.mjs): audio mode, sound, target speed and step, frame counts,
// end step and frames and window H-DMA; the scene lists 81:F48D.
const INTRO_SCENE = 0x14,
  SCENE_AUDIO_MODES = 0x81d3bf,
  SCENE_SOUNDS = 0x81d3cb,
  SCENE_TARGETS = 0x81d3d7,
  SCENE_STEPS = 0x81d3e3,
  SCENE_END_STEPS = 0x81d3ef,
  SCENE_FRAMES = 0x81d3fb,
  SCENE_END_FRAMES = 0x81d407,
  SCENE_WINDOW_HDMA = 0x81d42b,
  SCENE_LISTS = 0x81f48d;
// The credits: character map 85:FD38 into 7E:56A8, text 81:F2BD into 7E:62A8.
const CREDITS_CHARACTERS = 0x85fd38,
  CREDITS_TEXT = 0x81f2bd;
// The scene window: H-DMA channel 7 writes WH0/WH1; window 1 inverted on BG1-BG3 and OBJ,
// masking the scene layers on the main screen. Sounds play on voice 0, their set loaded
// first (bit 15 for F130). B or Start ends a scene; at its end sound 2E plays (command
// 07 with the volume byte 00).
const HDMA_CHANNEL_7 = 0x80,
  SCENE_WINDOW = WINDOW_1_ENABLE | WINDOW_1_INVERT,
  SCENE_SOUND_VOICE = 1,
  SKIP_BUTTONS = PAD_B | PAD_START,
  SCENE_END_SOUND = 0x2e,
  NO_MUSIC = WORD_MASK;
// Direct page of the cutscene wait 81:D479: the step and target of the BG2 speed.

export function fillCutsceneTextMap(h) {
  const { ctx } = h;
  h.index('x', MAP_BYTES - 2);
  h.load(TILE_PRIORITY);
  do {
    h.write(SCENE_TEXT_MAP + ctx.x, ctx.a);
    h.index('x', ctx.x - 1);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.load((SCENE_LAYERS << BYTE_BITS) | TM_TOP_LINES);
  h.write(SCENE_TM_HDMA, ctx.a);
  h.index('x', TM_LINES_LAST);
  h.load(0);
  h.write(SCENE_TM_LINES + 2 + ctx.x, ctx.a);
  h.load((SCENE_LAYERS << BYTE_BITS) | 1);
  do {
    h.write(SCENE_TM_LINES + ctx.x, ctx.a);
    h.index('x', ctx.x - 1);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.load(SCENE_TM_HDMA & WORD_MASK);
  h.portWrite(A1T5L, ctx.a, 2, 0x81d3aa);
  h.sep(FLAG_MEMORY_8BIT);
  h.portWrite(DMAP5, 0, 1, 0x81d3af);
  h.load(TM & BYTE_MASK);
  h.portWrite(BBAD5, ctx.a & BYTE_MASK, 1, 0x81d3b4);
  h.load(SCENE_TM_HDMA >>> WORD_BITS);
  h.portWrite(A1B5, ctx.a & BYTE_MASK, 1, 0x81d3b9);
  h.rep(FLAG_MEMORY_8BIT);
  return h.rts();
}
export function drawCutsceneSprites(h) {
  const { ctx } = h;
  h.dpWrite(DP_SPRITE_X, ctx.a);
  h.dpWrite(DP_SPRITE_FLIP, 0);
  h.load(h.dp(DP_SCENE));
  if (ctx.status & FLAG_NEGATIVE) {
    h.load(OBJ_H_FLIP_WORD);
    h.dpWrite(DP_SPRITE_FLIP, ctx.a);
    h.sep(FLAG_MEMORY_8BIT);
    h.load(SCENE_MIRROR_X);
    ctx.status |= FLAG_CARRY;
    h.sbc(h.dp(DP_SPRITE_X));
    h.dpWrite(DP_SPRITE_X, ctx.a);
    h.rep(FLAG_MEMORY_8BIT);
  }
  h.index('x', SPRITE_PARTS_LAST);
  do {
    h.load(h.read(h.abs((SCENE_SPRITE_PARTS & WORD_MASK) - 2) + ctx.x));
    h.index('y', h.dp(DP_SCENE, 2));
    if (ctx.status & FLAG_NEGATIVE) {
      h.load(ctx.a ^ BYTE_MASK);
      h.load(ctx.a + 1);
    }
    ctx.status &= ~FLAG_CARRY;
    h.adc(h.dp(DP_SPRITE_X));
    h.write(h.abs(OAM_SHADOW - 2) + ctx.x, ctx.a);
    h.load(h.read(h.abs(SCENE_SPRITE_PARTS & WORD_MASK) + ctx.x));
    h.load(ctx.a ^ h.dp(DP_SPRITE_FLIP));
    h.write(h.abs(OAM_SHADOW) + ctx.x, ctx.a);
    for (let n = 0; n < OAM_ENTRY_BYTES; n++) h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.load(OAM_HIGH_ALL_LARGE & NIBBLE_MASK);
  h.write(h.abs(OAM_SHADOW_HIGH), ctx.a);
  return h.rts();
}
export function sendMirroredCutscenePicture(h) {
  const { ctx } = h;
  h.load(PICTURE_LAST_ROW);
  h.dpWrite(DP_ROW, ctx.a);
  do {
    h.index('y', HALF_ROW_WORDS);
    h.load(h.dp(DP_ROW));
    h.xba();
    h.lsr();
    h.lsr();
    h.index('x', ctx.a);
    do {
      h.load(h.read(SCENE_PICTURE + ctx.x));
      h.load(ctx.a ^ TILE_H_FLIP);
      h.phx();
      h.pha();
      h.load(ctx.x);
      h.load(ctx.a ^ ROW_MIRROR);
      h.index('x', ctx.a);
      h.load(h.read(SCENE_PICTURE + ctx.x));
      h.load(ctx.a ^ TILE_H_FLIP);
      h.dpWrite(DP_SWAPPED, ctx.a);
      h.pla();
      h.write(SCENE_PICTURE + ctx.x, ctx.a);
      h.plx();
      h.load(h.dp(DP_SWAPPED));
      h.write(SCENE_PICTURE + ctx.x, ctx.a);
      h.index('x', ctx.x + 1);
      h.index('x', ctx.x + 1);
      h.index('y', ctx.y - 1);
    } while (!(ctx.status & FLAG_ZERO));
    h.modify(DP_ROW, 'dec', true);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.load(0);
  h.portWrite(VMADDL, ctx.a, 2, 0x81cfb6);
  h.index('x', 0);
  do {
    h.load(h.read(SCENE_PICTURE + ctx.x));
    h.portWrite(VMDATAL, ctx.a, 2, 0x81cfc0);
    h.index('x', ctx.x + 1);
    h.index('x', ctx.x + 1);
    h.cpx(PICTURE_BYTES);
  } while (!(ctx.status & FLAG_ZERO));
  return h.rts();
}

// 81:CDF8: play the cutscene in DP1E (negative: mirrored).
export function playCutscene(h, events, routines = CUTSCENE_REFERENCE_ROUTINES) {
  return drainNativeSequence(playCutsceneSequence(h, events, routines));
}
function* playCutsceneSequence(h, events, routines) {
  const { ctx } = h,
    call = (pc, target, long = false) => nativeCallSequence(h, events, routines, pc, target, long);
  let result;
  yield () => h.cmp(INTRO_SCENE);
  if (ctx.status & FLAG_ZERO) return yield* nativeTailSequence(h, events, routines, 0x81dfe7);
  const selector = () => {
    h.load(h.dp(DP_SCENE));
    h.asl();
    h.index('x', ctx.a);
  };
  const snapshot =
    (ctx.a & (WORD_SIGN - 1)) === CREDITS_SEQUENCE
      ? beginPackedTextEdit(h.a.mem, CREDITS_EDIT)
      : null;
  try {
    yield () => {
      begin(h);
      h.dpWrite(DP_SCENE, ctx.a);
      h.write(h.abs(SCENE_ARGUMENT), ctx.x, 2);
      h.write(h.abs(VRAM_SLOT_COUNT), 0);
      h.rep(FLAG_INDEX_8BIT);
    };
    yield* call(0x81ce0f, 0x81eb97, true);
    yield* call(0x81ce13, 0x81ebe9, true);
    yield () => {
      selector();
      h.load(h.read(h.abs(SCENE_TARGETS & WORD_MASK) + ctx.x));
      h.dpWrite(DP_TARGET, ctx.a);
      h.load(h.read(h.abs(SCENE_STEPS & WORD_MASK) + ctx.x));
      h.dpWrite(DP_STEP, ctx.a);
      h.load(h.read(SCENE_LISTS + ctx.x));
      h.index('x', ctx.a);
      h.index('y', SCENE_LISTS >>> WORD_BITS);
    };
    yield* call(0x81ce2d, 0x81ec16, true);
    yield () => h.load(h.dp(DP_SCENE));
    if (ctx.status & FLAG_NEGATIVE) yield* call(0x81ce35, 0x81cf79);
    yield () => {
      selector();
      h.load(h.read(h.abs(SCENE_SPRITE_BASES & WORD_MASK) + ctx.x));
    };
    yield* call(0x81ce3f, 0x81d4e8);
    yield () => {
      for (const o of [DP_SCROLL_Y, SCENE_COUNTER, SCENE_ANIMATION_STEP, DP_SPEED, DP_POSITION]) {
        if (o < BYTE_VALUES) h.dpWrite(o, 0);
        else h.write(h.abs(o), 0);
      }
    };
    for (const [pc, a, y, x] of [
      [0x81ce57, CREDITS_CHARACTERS & WORD_MASK, CREDITS_CHARACTERS >>> WORD_BITS, CHARACTER_MAP],
      [0x81ce64, CREDITS_TEXT & WORD_MASK, CREDITS_TEXT >>> WORD_BITS, CREDITS_BUFFER],
    ]) {
      yield () => {
        h.load(a);
        h.index('y', y);
        h.index('x', x);
      };
      yield* call(pc, 0x80f2a0, true);
    }
  } finally {
    endPackedTextEdit(h.a.mem, snapshot);
  }
  yield* call(0x81ce68, 0x81d37d);
  yield () => {
    selector();
    h.load(h.read(h.abs(SCENE_WINDOW_HDMA & WORD_MASK) + ctx.x));
    h.portWrite(A1T7L, ctx.a, 2, 0x81ce72);
    h.sep(FLAG_MEMORY_8BIT);
    for (const [pc, o, v] of [
      [0x81ce79, DMAP7, DMAP_TWO_PORTS],
      [0x81ce7e, BBAD7, WH0 & BYTE_MASK],
      [0x81ce83, A1B7, SCENE_WINDOW_HDMA >>> WORD_BITS],
      [0x81ce88, HDMAEN, HDMA_CHANNEL_7],
      [0x81ce8d, W12SEL, SCENE_WINDOW | (SCENE_WINDOW << WINDOW_HIGH_LAYER_SHIFT)],
      [0x81ce92, W34SEL, SCENE_WINDOW],
    ]) {
      h.load(v);
      h.portWrite(o, ctx.a & BYTE_MASK, 1, pc);
    }
    h.portWrite(WOBJSEL, ctx.a & BYTE_MASK, 1, 0x81ce95);
    h.load(SCENE_LAYERS);
    h.portWrite(TMW, ctx.a & BYTE_MASK, 1, 0x81ce9a);
    h.portWrite(WBGLOG, 0, 1, 0x81ce9d);
    h.portWrite(WOBJLOG, 0, 1, 0x81cea0);
    h.load(MAX_BRIGHTNESS);
    h.write(h.abs(SCENE_BRIGHTNESS_TARGET), ctx.a);
    h.write(h.abs(SCENE_BRIGHTNESS), 0);
    h.rep(FLAG_MEMORY_8BIT);
    selector();
    h.load(h.read(h.abs(SCENE_AUDIO_MODES & WORD_MASK) + ctx.x));
  };
  if (!(ctx.status & FLAG_NEGATIVE)) yield* call(0x81ceb6, 0x81ef47, true);
  yield () => {
    selector();
    h.load(h.read(h.abs(SCENE_SOUNDS & WORD_MASK) + ctx.x));
  };
  if (!(ctx.status & FLAG_ZERO)) {
    yield () => {
      h.pha();
      h.pha();
      h.index('x', SCENE_SOUND_VOICE);
      h.load(APU_COMMAND_SOUND_VOICES);
    };
    yield* call(0x81cecb, 0x81f007, true);
    yield () => {
      h.pla();
      h.load(ctx.a & BYTE_MASK);
      h.load(ctx.a | WORD_SIGN);
    };
    yield* call(0x81ced6, 0x81f130, true);
    yield () => {
      h.pla();
      h.index('x', ctx.a);
      h.load(APU_COMMAND_SOUND_VOLUME);
    };
    yield* call(0x81cedf, 0x81f007, true);
  }
  yield* call(0x81cee3, 0x81cf72);
  yield* call(0x81cee6, 0x81eb7b, true);
  yield () => {
    selector();
    h.load(h.read(h.abs(SCENE_FRAMES & WORD_MASK) + ctx.x));
    h.index('x', ctx.a);
  };
  // Credits from the start menu (src/game/credits.mjs) may be ended with B or
  // Start: the animation 81:D1F0, which CF72 runs before each check, clears
  // 01CA first (STZ), so the original sequence 5 never sees the pad. For the
  // menu's credits the pad word of the read at F298 is kept for the check.
  let kept = 0;
  const keep = () => {
    kept = menuCreditsRunning(h.a.vm) ? heldPad(h.a.mem.wram) : 0;
  };
  let skip = false;
  do {
    yield () => h.phx();
    yield* call(0x81cef3, 0x81eebb, true);
    yield* call(0x81cef7, 0x80f298, true);
    yield keep;
    yield* call(0x81cefb, 0x81cf72);
    yield () => {
      h.plx();
      h.load((h.read(h.abs(PAD_HELD)) | kept) & SKIP_BUTTONS);
    };
    if (!(ctx.status & FLAG_ZERO)) {
      skip = true;
      break;
    }
    yield () => h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  if (!skip) {
    yield () => {
      selector();
      h.load(h.read(h.abs(SCENE_END_STEPS & WORD_MASK) + ctx.x));
      h.dpWrite(DP_STEP, ctx.a);
      h.dpWrite(DP_TARGET, 0);
      h.load(h.read(h.abs(SCENE_END_FRAMES & WORD_MASK) + ctx.x));
      h.index('x', ctx.a);
    };
    do {
      yield () => h.phx();
      yield* call(0x81cf1a, 0x81eebb, true);
      yield* call(0x81cf1e, 0x80f298, true);
      yield keep;
      yield* call(0x81cf22, 0x81cf72);
      yield () => {
        h.plx();
        h.load((h.read(h.abs(PAD_HELD)) | kept) & SKIP_BUTTONS);
      };
      if (!(ctx.status & FLAG_ZERO)) break;
      yield () => h.index('x', ctx.x - 1);
    } while (!(ctx.status & FLAG_NEGATIVE));
  }
  yield () => {
    h.push(CODE_BANK_PAIR, 2);
    h.plb();
    h.plb();
    h.load(0);
  };
  yield* call(0x81cf39, 0x81f229, true);
  yield () => {
    h.index('x', SCENE_END_SOUND);
    h.load(APU_COMMAND_SOUND_VOLUME);
  };
  yield* call(0x81cf43, 0x81f007, true);
  yield () => {
    h.sep(FLAG_MEMORY_8BIT);
    h.write(h.abs(SCENE_BRIGHTNESS_TARGET), 0);
  };
  if (events?.interrupts !== undefined) yield { continuation: new FadePollContinuation(h, events) };
  else
    do {
      yield () => h.load(sceneWaitByte(h, events, 0x81cf4c, h.abs(SCENE_BRIGHTNESS)));
    } while (!(ctx.status & FLAG_ZERO));
  yield* call(0x81cf51, 0x81eebb, true);
  yield* call(0x81cf55, 0x81eb89, true);
  yield () => {
    h.portWrite(HDMAEN, 0, 1, 0x81cf59);
    h.rep(FLAG_MEMORY_8BIT);
    h.push(CODE_BANK_PAIR, 2);
    h.plb();
    h.plb();
    h.write(h.abs(SOUND_LOADED_SET), 0);
    h.write(h.abs(SOUND_VOICE_MASK), 0);
    h.load(NO_MUSIC);
    h.write(h.abs(MUSIC), ctx.a);
    result = end(h);
  };
  return result;
}
NATIVE_CALL_CONTINUATIONS.set(playCutscene, {
  run: playCutscene,
  create: ({ h, events, routines = CUTSCENE_REFERENCE_ROUTINES }) =>
    new NativeCallContinuation(h.a, playCutsceneSequence(h, events, routines)),
});
// The callback installed by the cutscene data program. It returns M1; the real NMI
// handler owns the surrounding saved status/registers. Invoking this does not schedule an NMI.
// 81:D479: NMI callback of the cutscenes: BG2 scroll from its fixed-point position.
export function scrollCutsceneBackground(h, e) {
  return drainNativeSequence(scrollCutsceneBackgroundSequence(h, e));
}
function* scrollCutsceneBackgroundSequence(h, e) {
  const { ctx } = h;
  let result;
  yield () => {
    h.call(0x81d479, 0x81ed8b, () => sendOamBuffer(h), true);
    h.load(h.dp(DP_CUTSCENE_POSITION));
    for (let n = 0; n < POSITION_SCROLL_SHIFT; n++) h.lsr();
    h.index('x', h.dp(DP_CUTSCENE_SCENE, 2));
    if (ctx.status & FLAG_NEGATIVE) h.load(ctx.a ^ SCROLL_MIRROR_MASK);
    h.sep(FLAG_MEMORY_8BIT);
    h.portWrite(BG2HOFS, ctx.a & BYTE_MASK, 1, 0x81d48f);
    h.xba();
    h.portWrite(BG2HOFS, ctx.a & BYTE_MASK, 1, 0x81d493);
    h.load(h.dp(DP_CUTSCENE_SCROLL_Y));
    h.portWrite(BG1VOFS, ctx.a & BYTE_MASK, 1, 0x81d498);
    h.load(h.dp(DP_CUTSCENE_SCROLL_Y + 1));
    h.portWrite(BG1VOFS, ctx.a & BYTE_MASK, 1, 0x81d49d);
    h.rep(FLAG_MEMORY_8BIT);
    h.load(h.dp(DP_CUTSCENE_SPEED));
    h.cmp(h.dp(DP_CUTSCENE_SPEED_TARGET));
    if (!(ctx.status & FLAG_ZERO)) {
      if (!(ctx.status & FLAG_CARRY)) {
        h.adc(h.dp(DP_CUTSCENE_SPEED_STEP));
        h.cmp(h.dp(DP_CUTSCENE_SPEED_TARGET));
        if (ctx.status & FLAG_CARRY) h.load(h.dp(DP_CUTSCENE_SPEED_TARGET));
      } else {
        h.sbc(h.dp(DP_CUTSCENE_SPEED_STEP));
        if (!(ctx.status & FLAG_CARRY)) h.load(h.dp(DP_CUTSCENE_SPEED_TARGET));
        else {
          h.cmp(h.dp(DP_CUTSCENE_SPEED_TARGET));
          if (!(ctx.status & FLAG_CARRY)) h.load(h.dp(DP_CUTSCENE_SPEED_TARGET));
        }
      }
    }
    h.dpWrite(DP_CUTSCENE_SPEED, ctx.a);
    ctx.status &= ~FLAG_CARRY;
    h.adc(h.dp(DP_CUTSCENE_POSITION));
    h.dpWrite(DP_CUTSCENE_POSITION, ctx.a);
    h.sep(FLAG_MEMORY_8BIT);
    h.load(h.read(h.abs(SCENE_BRIGHTNESS)));
    if (ctx.status & FLAG_ZERO) h.load(INIDISP_FORCED_BLANK);
    h.portWrite(INIDISP, ctx.a & BYTE_MASK, 1, 0x81d4ce);
    h.load(h.read(h.abs(SCENE_BRIGHTNESS)));
    h.cmp(h.read(h.abs(SCENE_BRIGHTNESS_TARGET)));
    if (!(ctx.status & FLAG_ZERO))
      h.modify(h.abs(SCENE_BRIGHTNESS), ctx.status & FLAG_CARRY ? 'dec' : 'inc');
  };
  yield* nativeCallSequence(h, e, SCENE_WAIT_ROUTINES, 0x81d4e3, 0x80f290, true);
  yield () => {
    result = h.rtl();
  };
  return result;
}

// The routine table with the reference cutscenes in place of the lifted ones.
export const CUTSCENE_REFERENCE_ROUTINES = new Map([
  ...MAIN_SCENE_ROUTINES,
  ...AUDIO_REFERENCE_ENTRIES,
  [0x81cdf8, playCutscene],
  [0x81cf72, (h, e, r = CUTSCENE_REFERENCE_ROUTINES) => animateCutscene(h, e, r)],
  [0x81cf79, (h) => sendMirroredCutscenePicture(h)],
  [0x81d4e8, (h) => drawCutsceneSprites(h)],
  [0x81d37d, (h) => fillCutsceneTextMap(h)],
  [0x81d479, scrollCutsceneBackground],
]);
NATIVE_CALL_CONTINUATIONS.set(scrollCutsceneBackground, {
  run: scrollCutsceneBackground,
  create: ({ h, events }) =>
    new NativeCallContinuation(h.a, scrollCutsceneBackgroundSequence(h, events)),
});
