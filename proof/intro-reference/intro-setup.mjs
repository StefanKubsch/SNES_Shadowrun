import { routineCaller } from '../../src/task/routine-call.mjs';

import {
  APU_PAIR_PENDING,
  AUDIO_BLOCK_LIST_BANK_WORD,
  AUDIO_BLOCK_LIST_POINTER,
  AUDIO_BYTES_REMAINING,
  AUDIO_DIRECTORY_POINTER,
  AUDIO_RAW_SOURCE_BANK_WORD,
  AUDIO_RAW_SOURCE_POINTER,
  AUDIO_WORK_WORD,
  DP_INTRO_SCROLL,
  DP_INTRO_X,
  DP_TITLE_POSITION,
  FRONTEND_FRAME_COUNTER,
  INTRO_FAR_EVENT,
  INTRO_MAP,
  INTRO_MAP_BYTES,
  INTRO_NEAR_ANIMATIONS,
  INTRO_NEAR_EVENT,
  INTRO_NEAR_X,
  INTRO_NEAR_Y,
  INTRO_OBJECT_LAST,
  INTRO_OBJECTS_BYTES,
  INTRO_WINDOW_HDMA,
  MUSIC,
  SOUND_LOADED_SET,
  SOUND_VOICE_MASK,
  VRAM_SLOT_COUNT,
} from '../../src/task/wram.mjs';
import { BYTE_MASK, WORD_MASK, WORD_BITS, WORD_SIGN } from '../../src/constants/bits.mjs';
import {
  A1T7L,
  A1B7,
  BBAD7,
  DMAP7,
  HDMAEN,
  W12SEL,
  W34SEL,
  WH0,
  WOBJSEL,
  TMW,
  WBGLOG,
  WOBJLOG,
} from '../../src/constants/hardware-registers.mjs';
import { CODE_BANK_PAIR, WRAM_BANK } from '../../src/constants/memory-map.mjs';
import {
  DMAP_TWO_PORTS,
  LAYER_BG1,
  LAYER_BG2,
  LAYER_BG3,
  LAYER_OBJ,
  TILE_PRIORITY,
  WINDOW_1_ENABLE,
  WINDOW_1_INVERT,
  WINDOW_HIGH_LAYER_SHIFT,
} from '../../src/constants/ppu.mjs';
import {
  APU_COMMAND_FADE_STEP,
  APU_COMMAND_SOUND_VOICES,
  APU_COMMAND_SOUND_VOLUME,
  APU_COMMAND_UPLOAD,
  APU_COMMAND_VOLUME,
  APU_COMMAND_VOLUME_TARGET,
  APU_FULL_VOLUME,
  SOUND_DIRECTORY_GAME,
} from '../../src/constants/sound-commands.mjs';
import {
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_ZERO,
  FLAG_NEGATIVE,
  FLAG_CARRY,
} from '../../src/constants/cpu-flags.mjs';
// The shared set-up routines of the intro 81:DFE7 (lifted in src/intro/, reference in
// proof/intro-reference/), which the title pan still uses. Calls use the one VM stack;
// PPU/DMA/APU stores remain requests. Waits and device replies come from the caller.

// 81:F092: the directory pointer's bank byte; a negative block length repeats one word
// (the low 15 bits count the words).
const AUDIO_DIRECTORY_BANK = AUDIO_DIRECTORY_POINTER + 1,
  AUDIO_REPEAT_COUNT_MASK = WORD_SIGN - 1;
// 81:D83E: the unpack list 81:D85C, six bytes per entry (source, its bank, destination in
// bank 7E for 80:F2A0); a zero source ends it.
const UNPACK_SOURCES = 0x81d85c,
  UNPACK_BANKS = 0x81d85e,
  UNPACK_TARGETS = 0x81d860,
  LIST_ENTRY_BYTES = 6;
// 81:DC43: the first near objects from 81:DC78 (animation, X, Y; six bytes per entry, a
// negative animation ends the list). Animations start at INTRO_START_ANIMATION, X and Y
// are stored halved, Y raised by INTRO_NEAR_Y_BIAS (as by the spawns of 81:D9D5).
const START_ANIMATIONS = 0x81dc78,
  START_X = 0x81dc7a,
  START_Y = 0x81dc7c;
export const INTRO_START_ANIMATION = 0x3c,
  INTRO_NEAR_Y_BIAS = 0x38;
// 81:D60F/D642: the scene list 81:F6EF, then H-DMA channel 7 writes WH0/WH1 from
// INTRO_WINDOW_HDMA (14 bytes from 81:D687); window 1 inverted on BG1-BG3 (W12SEL and
// W34SEL, WOBJSEL receives the W34SEL value) masks BG1-BG3 and OBJ on the main screen.
const INTRO_LIST = 0x81f6ef,
  INTRO_WINDOW_HDMA_BYTES = 14,
  HDMA_CHANNEL_7 = 0x80,
  INTRO_WINDOW_BG3 = WINDOW_1_ENABLE | WINDOW_1_INVERT,
  INTRO_WINDOW_BG12 = INTRO_WINDOW_BG3 | (INTRO_WINDOW_BG3 << WINDOW_HIGH_LAYER_SHIFT),
  INTRO_WINDOW_LAYERS = LAYER_BG1 | LAYER_BG2 | LAYER_BG3 | LAYER_OBJ;
// 81:DDB1 and 81:EF63: sounds on voices 0 and 1, fade steps toward the volume target.
const VOICES_0_1 = 3,
  TITLE_FADE_STEP = 0x0a0a,
  GAME_FADE_STEP = 0x0808;
// 81:E900: a near object's sound (81:E949 by slot, four sounds) with the left/right level
// of 81:E951 for its screen X (sixteen steps of 32 pixels, centred by PAN_BIAS).
const SPAWN_SOUND_SLOT_MASK = 6,
  PAN_BIAS = 0x40,
  PAN_SHIFT = 5,
  PAN_STEP_MASK = 15;
// Animation offsets of the first near objects and of the far object (also 81:E971).
export const INTRO_NEAR_START_ANIMATION = 0x36,
  INTRO_FAR_ANIMATION = 0x28;
// 81:F092: load the sound blocks of the directory entry in A into the APU.
export function loadSoundDirectory(h, e, routines) {
  const { ctx } = h,
    call = routineCaller(h, e, routines);
  h.php();
  h.rep(FLAG_INDEX_8BIT);
  h.index('x', ctx.a);
  h.load(h.read(0x98fffa + ctx.x));
  h.dpWrite(AUDIO_DIRECTORY_POINTER, ctx.a);
  h.load(h.read(0x98fffb + ctx.x));
  h.dpWrite(AUDIO_DIRECTORY_BANK, ctx.a);
  h.index('y', 2);
  h.load(h.read(h.indirect(AUDIO_DIRECTORY_POINTER, ctx.y)));
  h.dpWrite(AUDIO_BLOCK_LIST_POINTER, ctx.a);
  h.index('y', ctx.y + 1);
  h.load(h.read(h.indirect(AUDIO_DIRECTORY_POINTER, ctx.y)));
  h.dpWrite(AUDIO_BLOCK_LIST_BANK_WORD, ctx.a);
  h.index('y', 0);
  h.load(h.read(h.indirect(AUDIO_BLOCK_LIST_POINTER, ctx.y)));
  h.load(ctx.a - 1);
  h.load(ctx.a - 1);
  h.index('x', ctx.a);
  h.dpWrite(AUDIO_BYTES_REMAINING, ctx.a);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(APU_COMMAND_UPLOAD);
  call(0x81f0bc, 0x81f007, true);
  h.write(h.abs(APU_PAIR_PENDING), 0);
  h.rep(FLAG_MEMORY_8BIT);
  h.index('y', ctx.y + 1);
  h.index('y', ctx.y + 1);
  h.load(h.read(h.indirect(AUDIO_BLOCK_LIST_POINTER, ctx.y)));
  call(0x81f0c9, 0x81f122);
  for (;;) {
    h.index('y', ctx.y + 1);
    h.index('y', ctx.y + 1);
    h.load(h.dp(AUDIO_BYTES_REMAINING));
    if (ctx.status & FLAG_ZERO) break;
    h.load(h.read(h.indirect(AUDIO_BLOCK_LIST_POINTER, ctx.y)));
    if (!(ctx.status & FLAG_NEGATIVE)) {
      call(0x81f0d6, 0x81f100);
      h.index('y', ctx.y + 1);
      h.index('y', ctx.y + 1);
      h.load(h.read(h.indirect(AUDIO_BLOCK_LIST_POINTER, ctx.y)));
      h.dpWrite(AUDIO_RAW_SOURCE_POINTER, ctx.a);
      h.index('y', ctx.y + 1);
      h.load(h.read(h.indirect(AUDIO_BLOCK_LIST_POINTER, ctx.y)));
      h.dpWrite(AUDIO_RAW_SOURCE_BANK_WORD, ctx.a);
      h.phy();
      h.index('y', 0);
      h.sep(FLAG_MEMORY_8BIT);
      do {
        h.load(h.read(h.indirect(AUDIO_RAW_SOURCE_POINTER, ctx.y)));
        call(0x81f0ec, 0x81f03a);
        h.index('y', ctx.y + 1);
        h.cpy(h.dp(AUDIO_WORK_WORD, 2));
      } while (!(ctx.status & FLAG_ZERO));
      h.rep(FLAG_MEMORY_8BIT);
      h.ply();
    } else {
      h.load(ctx.a & AUDIO_REPEAT_COUNT_MASK);
      h.index('x', ctx.a);
      h.asl();
      call(0x81f10f, 0x81f100);
      h.index('y', ctx.y + 1);
      h.index('y', ctx.y + 1);
      h.load(h.read(h.indirect(AUDIO_BLOCK_LIST_POINTER, ctx.y)));
      h.dpWrite(AUDIO_WORK_WORD, ctx.a);
      do {
        h.load(h.dp(AUDIO_WORK_WORD));
        call(0x81f11a, 0x81f122);
        h.index('x', ctx.x - 1);
      } while (!(ctx.status & FLAG_ZERO));
    }
  }
  h.sep(FLAG_MEMORY_8BIT);
  call(0x81f0fb, 0x81f03a);
  h.plp();
  return h.rtl();
}
// 81:E8E5: clear the near and far intro objects and the frame counter.
export function clearIntroObjects(h) {
  const { ctx } = h;
  h.php();
  h.rep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
  h.index('x', INTRO_OBJECTS_BYTES - 2);
  h.load(WORD_MASK);
  do {
    h.write(h.abs(INTRO_NEAR_ANIMATIONS) + ctx.x, ctx.a);
    h.index('x', ctx.x - 1);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  for (const o of [INTRO_NEAR_EVENT, INTRO_FAR_EVENT, FRONTEND_FRAME_COUNTER]) h.write(h.abs(o), 0);
  h.plp();
  return h.rtl();
}
// 81:D83E: unpack the streams of the intro list into bank 7E.
export function unpackIntroList(h, e, routines) {
  const { ctx } = h,
    call = routineCaller(h, e, routines);
  h.pushByte(ctx.programBank);
  h.plb();
  for (;;) {
    h.load(h.read(h.abs(UNPACK_SOURCES & WORD_MASK) + ctx.x));
    if (ctx.status & FLAG_ZERO) return h.rts();
    h.phx();
    h.pha();
    h.index('y', h.read(h.abs(UNPACK_BANKS & WORD_MASK) + ctx.x, 2));
    h.load(h.read(h.abs(UNPACK_TARGETS & WORD_MASK) + ctx.x));
    h.index('x', ctx.a);
    h.pla();
    call(0x81d84f, 0x80f2a0, true);
    h.pla();
    ctx.status &= ~FLAG_CARRY;
    h.adc(LIST_ENTRY_BYTES);
    h.index('x', ctx.a);
  }
}
// 81:DC43: place the first near objects of the intro.
export function placeFirstNearObjects(h) {
  const { ctx } = h;
  h.php();
  h.phb();
  h.pushByte(ctx.programBank);
  h.plb();
  h.rep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
  h.index('x', 0);
  h.index('y', ctx.x);
  for (;;) {
    h.load(h.read(h.abs(START_ANIMATIONS & WORD_MASK) + ctx.y));
    if (ctx.status & FLAG_NEGATIVE) break;
    ctx.status &= ~FLAG_CARRY;
    h.adc(INTRO_START_ANIMATION);
    h.write(h.abs(INTRO_NEAR_ANIMATIONS) + ctx.x, ctx.a);
    h.load(h.read(h.abs(START_X & WORD_MASK) + ctx.y));
    h.lsr();
    h.write(h.abs(INTRO_NEAR_X) + ctx.x, ctx.a);
    h.load(h.read(h.abs(START_Y & WORD_MASK) + ctx.y));
    h.lsr();
    ctx.status &= ~FLAG_CARRY;
    h.adc(INTRO_NEAR_Y_BIAS);
    h.write(h.abs(INTRO_NEAR_Y) + ctx.x, ctx.a);
    h.load(ctx.y);
    ctx.status &= ~FLAG_CARRY;
    h.adc(LIST_ENTRY_BYTES);
    h.index('y', ctx.a);
    h.index('x', ctx.x + 1);
    h.index('x', ctx.x + 1);
  }
  h.plb();
  h.plp();
  return h.rts();
}
// 81:D60F: build the intro scene: lists, picture with priority tiles and first objects.
export function setupIntroScene(h, e, routines) {
  const { ctx } = h,
    call = routineCaller(h, e, routines);
  h.write(h.abs(VRAM_SLOT_COUNT), 0);
  call(0x81d612, 0x81eb97, true);
  call(0x81d616, 0x81ebe9, true);
  h.index('x', INTRO_LIST & WORD_MASK);
  h.index('y', INTRO_LIST >>> WORD_BITS);
  call(0x81d620, 0x81ec16, true);
  h.index('x', 0);
  call(0x81d627, 0x81d83e);
  h.index('x', INTRO_MAP_BYTES - 2);
  do {
    h.load(h.read(INTRO_MAP + ctx.x));
    h.load(ctx.a | TILE_PRIORITY);
    h.write(INTRO_MAP + ctx.x, ctx.a);
    h.index('x', ctx.x - 1);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.dpWrite(DP_TITLE_POSITION, 0);
  call(0x81d63e, 0x81dc43);
  return h.rts();
}
// 81:D642: set up the intro window H-DMA and masks.
export function setupIntroWindow(h) {
  const { ctx } = h;
  h.php();
  h.load(INTRO_WINDOW_HDMA & WORD_MASK);
  h.portWrite(A1T7L, ctx.a, 2, 0x81d646);
  h.sep(FLAG_MEMORY_8BIT);
  h.index('x', INTRO_WINDOW_HDMA_BYTES - 1);
  do {
    h.load(h.read(0x81d687 + ctx.x));
    h.write(INTRO_WINDOW_HDMA + ctx.x, ctx.a);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  for (const [pc, o, v] of [
    [0x81d65b, DMAP7, DMAP_TWO_PORTS],
    [0x81d660, BBAD7, WH0 & BYTE_MASK],
    [0x81d665, A1B7, WRAM_BANK],
    [0x81d66a, HDMAEN, HDMA_CHANNEL_7],
    [0x81d66f, W12SEL, INTRO_WINDOW_BG12],
    [0x81d674, W34SEL, INTRO_WINDOW_BG3],
  ]) {
    h.load(v);
    h.portWrite(o, ctx.a & BYTE_MASK, 1, pc);
  }
  h.portWrite(WOBJSEL, ctx.a & BYTE_MASK, 1, 0x81d677);
  h.load(INTRO_WINDOW_LAYERS);
  h.portWrite(TMW, ctx.a & BYTE_MASK, 1, 0x81d67c);
  h.portWrite(WBGLOG, 0, 1, 0x81d67f);
  h.portWrite(WOBJLOG, 0, 1, 0x81d682);
  h.plp();
  return h.rts();
}
// 81:DDB1: title audio: fade step, sound voices 0 and 1, full volume and its target.
export function setupTitleAudio(h, e, routines) {
  const { ctx } = h,
    call = routineCaller(h, e, routines);
  h.pushByte(ctx.programBank);
  h.plb();
  h.load(APU_COMMAND_FADE_STEP);
  h.index('x', TITLE_FADE_STEP);
  call(0x81ddb9, 0x81f007, true);
  h.load(APU_COMMAND_SOUND_VOICES);
  h.index('x', VOICES_0_1);
  call(0x81ddc3, 0x81f007, true);
  h.load(APU_COMMAND_VOLUME);
  h.index('x', APU_FULL_VOLUME);
  h.phx();
  call(0x81ddce, 0x81f007, true);
  h.load(APU_COMMAND_VOLUME_TARGET);
  h.plx();
  call(0x81ddd6, 0x81f007, true);
  return h.rtl();
}
// 81:E900: play a near object's sound panned by its screen X.
export function playNearObjectSound(h, e, routines) {
  const { ctx } = h,
    call = routineCaller(h, e, routines);
  h.dpWrite(DP_INTRO_X, ctx.x, 2);
  h.index('x', INTRO_OBJECT_LAST);
  h.dpWrite(DP_INTRO_SCROLL, ctx.a);
  for (;;) {
    h.load(h.read(h.abs(INTRO_NEAR_ANIMATIONS) + ctx.x));
    if (ctx.status & FLAG_NEGATIVE) break;
    h.index('x', ctx.x - 1);
    h.index('x', ctx.x - 1);
    if (ctx.status & FLAG_NEGATIVE) return h.rtl();
  }
  h.write(h.abs(INTRO_NEAR_ANIMATIONS) + ctx.x, 0);
  h.load(ctx.y);
  h.write(h.abs(INTRO_NEAR_Y) + ctx.x, ctx.a);
  h.load(h.dp(DP_INTRO_X));
  h.write(h.abs(INTRO_NEAR_X) + ctx.x, ctx.a);
  h.load(ctx.x);
  h.load(ctx.a & SPAWN_SOUND_SLOT_MASK);
  h.pha();
  h.load(h.read(h.abs(INTRO_NEAR_X) + ctx.x));
  ctx.status |= FLAG_CARRY;
  h.sbc(h.dp(DP_INTRO_SCROLL));
  ctx.status &= ~FLAG_CARRY;
  h.adc(PAN_BIAS);
  for (let n = 0; n < PAN_SHIFT; n++) h.lsr();
  h.load(ctx.a & PAN_STEP_MASK);
  h.asl();
  h.index('x', ctx.a);
  h.load(h.read(0x81e951 + ctx.x));
  h.plx();
  h.load(ctx.a | h.read(0x81e949 + ctx.x));
  h.index('x', ctx.a);
  h.load(APU_COMMAND_SOUND_VOLUME);
  call(0x81e944, 0x81f007, true);
  return h.rtl();
}
// 81:EF63: game audio: no music, the game sound directory, voices 0 and 1, fade step.
export function setupGameAudio(h, e, routines) {
  const { ctx } = h,
    call = routineCaller(h, e, routines);
  h.push(CODE_BANK_PAIR, 2);
  h.plb();
  h.plb();
  h.load(0);
  h.write(h.abs(SOUND_LOADED_SET), ctx.a);
  h.write(h.abs(MUSIC), ctx.a);
  call(0x81ef71, 0x81f229, true);
  h.load(SOUND_DIRECTORY_GAME);
  call(0x81ef78, 0x81f092, true);
  h.index('x', VOICES_0_1);
  h.write(h.abs(SOUND_VOICE_MASK), ctx.x, 2);
  h.load(APU_COMMAND_SOUND_VOICES);
  call(0x81ef85, 0x81f007, true);
  h.load(APU_COMMAND_FADE_STEP);
  h.index('x', GAME_FADE_STEP);
  call(0x81ef8f, 0x81f007, true);
  return h.rtl();
}
