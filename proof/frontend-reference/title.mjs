// Register-level reference of the title 81:D694 with the prologue 81:DDDB, 81:DE93,
// 81:D81F, 81:D8E5, 81:D927, 81:D87C and the NMI callbacks 81:DD54, 81:D93E, 81:DCAC,
// 81:DAD6 and 81:D9D5 (the lifted version is src/frontend/title.mjs). The ROM proof
// tests check it against the original instructions; tools/title-lift.test.mjs compares
// it with the lifted title.
import {
  beginPackedTextEdit,
  endPackedTextEdit,
  PROLOGUE_EDIT,
} from '../../src/data/packed-text-edits.mjs';
import {
  FONT_FIRST_CODE,
  DP_FADE_MASK,
  DP_FADE_SHIFT,
  frontendCallSequence,
} from './start-menu-text.mjs';
import { interruptStep, lagFree } from '../../src/task/main-wait-interrupt.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  nativeCallSequence,
  nativeTailSequence,
} from '../../src/task/native-call-continuation.mjs';
import { routineCaller } from '../../src/task/routine-call.mjs';
import { INTRO_NEAR_Y_BIAS, INTRO_START_ANIMATION } from '../intro-reference/intro-setup.mjs';
import { INTRO_SETUP_REFERENCE_ENTRIES } from '../intro-reference/intro-routines.mjs';
import { INTRO_NMI_ROUTINES } from '../../src/task/main-intro-nmi.mjs';

import { FRONTEND_NMI_ROUTINES } from '../../src/task/main-frontend-nmi.mjs';
import {
  DP_INTRO_SCROLL,
  DP_PROLOGUE_DELAY,
  DP_PROLOGUE_PADDING,
  DP_PROLOGUE_READ,
  DP_PROLOGUE_SCROLL,
  DP_TITLE_POSITION,
  DP_TITLE_SPEED,
  DP_TITLE_SPEED_TARGET,
  DP_TITLE_UPLOAD,
  FRONTEND_FRAME_COUNTER,
  INTRO_FAR_ANIMATIONS,
  INTRO_FAR_EVENT,
  INTRO_FAR_X,
  INTRO_FAR_Y,
  INTRO_NEAR_ANIMATIONS,
  INTRO_NEAR_EVENT,
  INTRO_NEAR_X,
  INTRO_NEAR_Y,
  INTRO_OBJECT_LAST,
  INTRO_WINDOW_ENTRY_BYTES,
  INTRO_WINDOW_HDMA,
  MENU_FONT_TILES,
  PAD_HELD,
  PROLOGUE_FONT_TILES,
  PROLOGUE_TEXT,
  PROLOGUE_TILEMAP,
  PROLOGUE_TILEMAP_BYTES,
  TITLE_PALETTE,
  VRAM_SLOT_COUNT,
} from '../../src/task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../../src/constants/bits.mjs';
import {
  FLAG_ZERO,
  FLAG_CARRY,
  FLAG_NEGATIVE,
  FLAG_MEMORY_8BIT,
  FLAG_INDEX_8BIT,
} from '../../src/constants/cpu-flags.mjs';
import {
  A1B0,
  A1T0L,
  APUIO2,
  BBAD0,
  BG12NBA,
  BG1HOFS,
  BG1VOFS,
  BG2HOFS,
  BG2VOFS,
  BG3HOFS,
  BG3VOFS,
  CGADD,
  CGADSUB,
  CGDATA,
  CGSWSEL,
  DAS0L,
  DMAP0,
  HDMAEN,
  MDMAEN,
  STAT77,
  STAT78_PAL,
  TM,
  TS,
  VMADDL,
  VMAINC,
  VMDATAL,
} from '../../src/constants/hardware-registers.mjs';
import { CODE_BANK_PAIR, WRAM_BANK, WRAM_BANK_PAIR } from '../../src/constants/memory-map.mjs';
import {
  CGADSUB_HALF,
  CGSWSEL_SUB_SCREEN,
  DMAP_ONE_PORT,
  DMAP_TWO_PORTS,
  LAYER_BG1,
  LAYER_BG2,
  OAM_PRIORITY_2,
  TILE_FLIP_BITS,
  VMAINC_INCREMENT_AFTER_HIGH,
} from '../../src/constants/ppu.mjs';
import {
  APU_COMMAND_VOLUME,
  APU_COMMAND_VOLUME_TARGET,
  APU_FULL_VOLUME,
} from '../../src/constants/sound-commands.mjs';

const downX = (h) => {
  h.index('x', h.ctx.x - 1);
  h.index('x', h.ctx.x - 1);
};
const phk = (h) => h.pushByte(h.ctx.programBank);
const bank80 = (h) => {
  h.push(CODE_BANK_PAIR, 2);
  h.plb();
  h.plb();
};
const callFor = (h, e, r) => routineCaller(h, e, r, true);
const sequenceCall =
  (h, e, r) =>
  (pc, target, long = false) =>
    frontendCallSequence(h, e, r, pc, target, long);
// The title song (81:F229).
const SONG_TITLE = 1;
// Packed data: 80:F2A0 unpacks A (bank Y) to bank 7E at X.
const PROLOGUE_FONT_PACKED = 0x81f803,
  PROLOGUE_TEXT_PACKED = 0x81f5ce,
  PROLOGUE_DATA_BANK = PROLOGUE_TEXT_PACKED >>> WORD_BITS,
  MENU_FONT_PACKED = 0x84daf2;
// Scene lists run by 81:EC16 (address in X, bank in Y; src/data/scene-lists.mjs).
const PROLOGUE_LIST = 0x81f768,
  TITLE_PAN_LIST = 0x81f6df,
  TITLE_SCROLL_LIST = 0x81f6e5;
// The NMI 81:D9D5 (title pan) draws the near objects with priority 2 and the far ones
// with priority 1 and palette 1, advancing near animations every four frames and far ones
// every eight (81:DADD: a sprite per animation offset; FFFE restarts, FFFF ends). The
// spawn tables (frame, X, Y; six bytes per entry) add objects at their frame with halved
// coordinates; 81:E971 adds a far object at INTRO_FAR_ANIMATION.
const INTRO_SPRITES = 0x81dadd,
  ANIMATION_RESTART = 0xfffe,
  NEAR_OBJECT_TILE = OAM_PRIORITY_2 << BYTE_BITS,
  FAR_OBJECT_TILE = 0x1200, // priority 1, palette 1
  NEAR_ANIMATION_PERIOD_MASK = 3,
  FAR_ANIMATION_PERIOD_MASK = 7,
  NEAR_EVENT_FRAMES = 0x81db8b,
  NEAR_EVENT_X = 0x81db8d,
  NEAR_EVENT_Y = 0x81db8f,
  FAR_EVENT_FRAMES = 0x81dbe1,
  FAR_EVENT_X = 0x81dbe3,
  FAR_EVENT_Y = 0x81dbe5,
  INTRO_FAR_Y_BIAS = 0x35,
  EVENT_BYTES = 6,
  // The sprite grid 81:E83A takes its attributes and the next OAM offset in the direct page.
  DP_SPRITE_TILE = 0x24,
  DP_OAM_OFFSET = 0x2c;
// Instruction length of an absolute LDA or STA: the next instruction of a port access.
const ABSOLUTE_INSTRUCTION_BYTES = 3;
// Prologue 81:DDDB: 980 frames unless a key ends it; after 120 frames the title song
// starts at volume 0 and fades in. The text scrolls one line every three frames; 81:DE93
// centres a new text line in tile row 30 below the scroll position every eight lines and
// waits PROLOGUE_END_DELAY after the last one.
const PROLOGUE_FRAMES = 0x3d4,
  PROLOGUE_MUSIC_FRAME = 0x35c,
  PROLOGUE_SCROLL_DELAY = 2,
  PROLOGUE_LINE_MASK = 7, // scroll lines within a tile row
  PROLOGUE_END_DELAY = 0xfa0,
  PROLOGUE_ROW_MASK = 0xfff8,
  PROLOGUE_NEW_ROW = 0x780,
  PROLOGUE_ROW_COLUMNS = 0x20,
  PROLOGUE_ROW_END_MASK = 0x3e, // byte column within a tile row
  PROLOGUE_TILE_MASK = TILE_FLIP_BITS | BYTE_MASK;
// Title 81:D694, positions in DP_TITLE_POSITION. After the pan the vertical scroll starts at
// TITLE_SCROLL_SPEED; from TITLE_WINDOW_START to TITLE_WINDOW_END 81:D81F moves the window
// border a line per frame (the first H-DMA entry loses a line, the second and third gain
// one); BG2 leaves the main screen at TITLE_BG1_ONLY. Three BG2 views then blend in
// (81:D87C), and the title ends past TITLE_END_CHECK once the position (plus 0200 on a PAL
// console, STAT78 read with STAT77 as a word) reaches TITLE_END.
export const TITLE_PAN_WAIT = 0x34,
  TITLE_PAN_END = 0x401,
  TITLE_SCROLL_SPEED = 0xb0,
  TITLE_WINDOW_START = 0x226,
  TITLE_BG1_ONLY = 0x3e8,
  TITLE_WINDOW_END = 0xdac,
  TITLE_END_CHECK = 0x4d10,
  TITLE_END = 0x6000,
  STAT77_WORD_PAL = STAT78_PAL << BYTE_BITS,
  TITLE_SCROLL_COLOURS_BYTES = 0x60, // colours 16-63 sent by the NMI 81:DCAC
  WINDOW_SECOND_LINES = INTRO_WINDOW_HDMA + INTRO_WINDOW_ENTRY_BYTES,
  WINDOW_THIRD_LINES = WINDOW_SECOND_LINES + INTRO_WINDOW_ENTRY_BYTES;
// 81:D927: BG1 and BG2 (BG12NBA character bases 3 and 1), BG2 at the first of three views.
const TITLE_PICTURE_LAYERS = LAYER_BG1 | LAYER_BG2,
  TITLE_PICTURE_CHARACTERS = 0x13,
  TITLE_BG2_VIEW_1 = 0x9c,
  TITLE_BG2_VIEW_2 = 0xbe,
  TITLE_BG2_VIEW_3 = 0xdf;
// 81:D87C: BG1 on the main screen, added at half to BG2 on the sub screen. One fade step
// of 81:D8E5 per frame (shift and mask tables 81:D90F/D91B, a pair per four steps) runs up,
// holds and runs back down.
const BLEND_MAIN = LAYER_BG1,
  BLEND_SUB = LAYER_BG2,
  BLEND_MATH = CGADSUB_HALF | LAYER_BG1,
  BLEND_FADE_FIRST = 0x12,
  BLEND_FADE_END = 0x18,
  BLEND_FADE_LAST = BLEND_FADE_END - 1,
  BLEND_HOLD_FRAMES = 0x3c,
  BLEND_FADE_SHIFTS = 0x81d90f,
  BLEND_FADE_MASKS = 0x81d91b;
// Music beat polls LDA 2142 / BNE of the title: one segment per iteration. Only
// lag-free frames take a step there (their NMI arrives at the BNE, pc+3); the
// recorded contract of these polls has no instruction records.
function* titlePoll(h, e, pc) {
  const live = !!lagFree(e);
  do {
    yield () => {
      h.load(h.port(APUIO2, 1, pc));
      if (live) interruptStep(h, e, pc + ABSOLUTE_INSTRUCTION_BYTES);
    };
  } while (!(h.ctx.status & FLAG_ZERO));
}
const port = (h, pc, offset, value) => {
  h.load(value);
  h.portWrite(offset, h.ctx.a & (h.m() ? BYTE_MASK : WORD_MASK), h.m() ? 1 : 2, pc);
};
// Original routine $81:DE93.
function drawPrologueLine(h) {
  const { ctx } = h;
  h.load(h.dp(DP_PROLOGUE_SCROLL));
  h.load(ctx.a & PROLOGUE_ROW_MASK);
  h.asl();
  h.asl();
  h.asl();
  ctx.status &= ~FLAG_CARRY;
  h.adc(PROLOGUE_NEW_ROW);
  h.load(ctx.a & (PROLOGUE_TILEMAP_BYTES - 1));
  h.index('x', ctx.a);
  h.index('y', h.dp(DP_PROLOGUE_READ, 2));
  h.load(h.read(h.abs(PROLOGUE_TEXT) + ctx.y));
  h.load(ctx.a & BYTE_MASK);
  if (ctx.status & FLAG_ZERO) {
    h.load(PROLOGUE_END_DELAY);
    h.dpWrite(DP_PROLOGUE_DELAY, ctx.a);
  } else {
    h.load(PROLOGUE_ROW_COLUMNS);
    h.dpWrite(DP_PROLOGUE_PADDING, ctx.a);
    for (;;) {
      h.load(h.read(h.abs(PROLOGUE_TEXT) + ctx.y));
      h.load(ctx.a & BYTE_MASK);
      if (ctx.status & FLAG_ZERO) break;
      h.index('y', ctx.y + 1);
      h.modify(DP_PROLOGUE_PADDING, 'dec', true);
    }
    const value = h.dp(DP_PROLOGUE_PADDING);
    ctx.status = (ctx.status & ~FLAG_CARRY) | (value & 1);
    h.dpWrite(DP_PROLOGUE_PADDING, h.nz(value >>> 1, 2));
    h.load(0);
    for (;;) {
      h.modify(DP_PROLOGUE_PADDING, 'dec', true);
      if (ctx.status & FLAG_NEGATIVE) break;
      h.write(PROLOGUE_TILEMAP + ctx.x, ctx.a);
      h.index('x', ctx.x + 1);
      h.index('x', ctx.x + 1);
    }
    h.index('y', h.dp(DP_PROLOGUE_READ, 2));
    for (;;) {
      h.load(h.read(h.abs(PROLOGUE_TEXT) + ctx.y));
      h.load(ctx.a & BYTE_MASK);
      if (ctx.status & FLAG_ZERO) break;
      ctx.status |= FLAG_CARRY;
      h.sbc(FONT_FIRST_CODE);
      h.phx();
      h.asl();
      h.index('x', ctx.a);
      h.load(h.read(PROLOGUE_FONT_TILES + ctx.x));
      h.plx();
      h.load(ctx.a & PROLOGUE_TILE_MASK);
      h.write(PROLOGUE_TILEMAP + ctx.x, ctx.a);
      h.index('x', ctx.x + 1);
      h.index('x', ctx.x + 1);
      h.index('y', ctx.y + 1);
    }
    h.index('y', ctx.y + 1);
    h.dpWrite(DP_PROLOGUE_READ, ctx.y, 2);
    h.load(ctx.x);
    h.load(ctx.a & PROLOGUE_ROW_END_MASK);
    if (ctx.status & FLAG_ZERO) return h.rts();
  }
  for (;;) {
    h.load(0);
    h.write(PROLOGUE_TILEMAP + ctx.x, ctx.a);
    h.index('x', ctx.x + 1);
    h.index('x', ctx.x + 1);
    h.load(ctx.x);
    h.load(ctx.a & PROLOGUE_ROW_END_MASK);
    if (ctx.status & FLAG_ZERO) return h.rts();
  }
}
// Original routine $81:D81F.
function moveTitleWindow(h) {
  h.sep(FLAG_MEMORY_8BIT);
  h.load(h.read(INTRO_WINDOW_HDMA));
  h.cmp(1);
  if (!(h.ctx.status & FLAG_ZERO)) {
    h.load(h.ctx.a - 1);
    h.write(INTRO_WINDOW_HDMA, h.ctx.a);
    h.load(h.read(WINDOW_SECOND_LINES));
    h.load(h.ctx.a + 1);
    h.write(WINDOW_SECOND_LINES, h.ctx.a);
    h.write(WINDOW_THIRD_LINES, h.ctx.a);
  }
  h.rep(FLAG_MEMORY_8BIT);
  return h.rts();
}
// Original routine $81:D8E5.
function fadeTitleBlend(h) {
  const { ctx } = h;
  h.phx();
  h.load(ctx.x);
  h.lsr();
  h.lsr();
  h.asl();
  h.index('x', ctx.a);
  h.load(h.read(h.abs(BLEND_FADE_SHIFTS & WORD_MASK) + ctx.x));
  h.dpWrite(DP_FADE_SHIFT, ctx.a);
  h.load(h.read(h.abs(BLEND_FADE_MASKS & WORD_MASK) + ctx.x));
  h.dpWrite(DP_FADE_MASK, ctx.a);
  h.index('x', TITLE_SCROLL_COLOURS_BYTES - 2);
  do {
    h.load(0);
    h.load(ctx.a & h.dp(DP_FADE_MASK));
    h.index('y', h.dp(DP_FADE_SHIFT, 2));
    if (!(ctx.status & FLAG_ZERO))
      do {
        h.lsr();
        h.index('y', ctx.y - 1);
      } while (!(ctx.status & FLAG_ZERO));
    h.write(TITLE_PALETTE + ctx.x, ctx.a);
    downX(h);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.plx();
  return h.rts();
}
// Original routine $81:D927.
function showTitlePicture(h) {
  h.php();
  h.sep(FLAG_MEMORY_8BIT);
  port(h, 0x81d92c, TM, TITLE_PICTURE_LAYERS);
  port(h, 0x81d931, BG12NBA, TITLE_PICTURE_CHARACTERS);
  port(h, 0x81d936, BG2VOFS, TITLE_BG2_VIEW_1);
  h.portWrite(BG2VOFS, 0, 1, 0x81d939);
  h.plp();
  return h.rts();
}
// Original routine $81:D87C.
function blendTitleView(h, e, r = TITLE_REFERENCE_ROUTINES) {
  return drainNativeSequence(blendTitleViewSequence(h, e, r));
}
function* blendTitleViewSequence(h, e, r) {
  const { ctx } = h,
    call = sequenceCall(h, e, r);
  phk(h);
  h.plb();
  h.sep(FLAG_MEMORY_8BIT);
  for (const [pc, offset, value] of [
    [0x81d882, TM, BLEND_MAIN],
    [0x81d887, TS, BLEND_SUB],
    [0x81d88c, CGSWSEL, CGSWSEL_SUB_SCREEN],
    [0x81d891, CGADSUB, BLEND_MATH],
  ])
    port(h, pc, offset, value);
  h.rep(FLAG_MEMORY_8BIT);
  h.index('x', BLEND_FADE_FIRST);
  do {
    yield* call(0x81d899, 0x81eebb, true);
    yield* call(0x81d89d, 0x81d8e5);
    yield* call(0x81d8a0, 0x80f298, true);
    h.load(h.read(h.abs(PAD_HELD)));
    if (!(ctx.status & FLAG_ZERO)) return h.rts();
    h.index('x', ctx.x + 1);
    h.cpx(BLEND_FADE_END);
  } while (!(ctx.status & FLAG_ZERO));
  h.index('x', BLEND_HOLD_FRAMES);
  do {
    yield* call(0x81d8b2, 0x81eebb, true);
    yield* call(0x81d8b6, 0x80f298, true);
    h.load(h.read(h.abs(PAD_HELD)));
    if (!(ctx.status & FLAG_ZERO)) return h.rts();
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_ZERO));
  h.index('x', BLEND_FADE_LAST);
  do {
    yield* call(0x81d8c5, 0x81eebb, true);
    yield* call(0x81d8c9, 0x81d8e5);
    yield* call(0x81d8cc, 0x80f298, true);
    h.load(h.read(h.abs(PAD_HELD)));
    if (!(ctx.status & FLAG_ZERO)) return h.rts();
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.sep(FLAG_MEMORY_8BIT);
  port(h, 0x81d8dc, TM, BLEND_MAIN);
  h.portWrite(TS, 0, 1, 0x81d8df);
  h.rep(FLAG_MEMORY_8BIT);
  return h.rts();
}
// Original routine $81:DDDB.
function playPrologue(h, e, r = TITLE_REFERENCE_ROUTINES) {
  return drainNativeSequence(playPrologueSequence(h, e, r));
}
function* playPrologueSequence(h, e, r) {
  const { ctx } = h,
    call = sequenceCall(h, e, r);
  const snapshot = beginPackedTextEdit(h.a.mem, PROLOGUE_EDIT);
  try {
    h.php();
    h.phb();
    yield* call(0x81dddd, 0x81eb97, true);
    yield* call(0x81dde1, 0x81ebe9, true);
    for (const [pc, a, x] of [
      [0x81ddee, PROLOGUE_FONT_PACKED & WORD_MASK, PROLOGUE_FONT_TILES & WORD_MASK],
      [0x81ddfb, PROLOGUE_TEXT_PACKED & WORD_MASK, PROLOGUE_TEXT],
    ]) {
      h.load(a);
      h.index('y', PROLOGUE_DATA_BANK);
      h.index('x', x);
      yield* call(pc, 0x80f2a0, true);
    }
    h.index('x', PROLOGUE_LIST & WORD_MASK);
    h.index('y', PROLOGUE_LIST >>> WORD_BITS);
    yield* call(0x81de05, 0x81ec16, true);
  } finally {
    endPackedTextEdit(h.a.mem, snapshot);
  }
  yield* call(0x81de09, 0x81ddb1, true);
  for (const at of [DP_PROLOGUE_SCROLL, DP_PROLOGUE_DELAY, DP_PROLOGUE_READ]) h.dpWrite(at, 0);
  yield* call(0x81de13, 0x81eb7b, true);
  h.phb();
  h.load(0);
  h.write(PROLOGUE_TILEMAP, ctx.a);
  h.index('x', PROLOGUE_TILEMAP & WORD_MASK);
  h.index('y', (PROLOGUE_TILEMAP & WORD_MASK) + 1);
  h.load(PROLOGUE_TILEMAP_BYTES - 2);
  yield () =>
    h.move(
      WRAM_BANK,
      WRAM_BANK,
      1,
      e?.startupInterrupts ? () => interruptStep(h, e, 0x81de28) : null,
    );
  h.plb();
  yield* call(0x81de2c, 0x81eedd, true);
  h.push(WRAM_BANK_PAIR, 2);
  h.plb();
  h.plb();
  h.index('x', PROLOGUE_FRAMES);
  for (;;) {
    h.phx();
    yield* call(0x81de39, 0x81eebb, true);
    yield* call(0x81de3d, 0x80f298, true);
    h.modify(DP_PROLOGUE_DELAY, 'dec', true);
    if (ctx.status & FLAG_NEGATIVE) {
      h.load(PROLOGUE_SCROLL_DELAY);
      h.dpWrite(DP_PROLOGUE_DELAY, ctx.a);
      h.modify(DP_PROLOGUE_SCROLL, 'inc', true);
      h.load(h.dp(DP_PROLOGUE_SCROLL));
      h.load(ctx.a & PROLOGUE_LINE_MASK);
      if (ctx.status & FLAG_ZERO) yield* call(0x81de53, 0x81de93);
    }
    h.plx();
    h.load(h.read(h.abs(PAD_HELD)));
    if (!(ctx.status & FLAG_ZERO)) break;
    h.cpx(PROLOGUE_MUSIC_FRAME);
    if (ctx.status & FLAG_ZERO) {
      h.phx();
      h.phb();
      phk(h);
      h.plb();
      h.load(APU_COMMAND_VOLUME);
      h.index('x', 0);
      yield* call(0x81de6b, 0x81f007, true);
      h.load(APU_COMMAND_VOLUME_TARGET);
      h.index('x', APU_FULL_VOLUME);
      yield* call(0x81de75, 0x81f007, true);
      h.load(SONG_TITLE);
      yield* call(0x81de7c, 0x81f229, true);
      h.plb();
      h.plx();
    }
    h.index('x', ctx.x - 1);
    if (ctx.status & FLAG_ZERO) {
      h.phx();
      bank80(h);
      yield* call(0x81de8b, 0x81eef1, true);
      h.plx();
      break;
    }
  }
  h.plb();
  h.plp();
  return h.rts();
}

// Original routine $81:D694.
function playTitle(h, e, r = TITLE_REFERENCE_ROUTINES) {
  return drainNativeSequence(playTitleSequence(h, e, r));
}
function* playTitleSequence(h, e, r) {
  const { ctx } = h,
    call = sequenceCall(h, e, r);
  h.php();
  h.rep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
  h.load(APU_COMMAND_VOLUME_TARGET);
  h.index('x', APU_FULL_VOLUME);
  yield* call(0x81d69d, 0x81f007, true);
  h.write(h.abs(VRAM_SLOT_COUNT), 0);
  yield* call(0x81d6a4, 0x81e8e5, true);
  yield* call(0x81d6a8, 0x81dddb);
  h.index('x', ctx.x - 1);
  h.index('x', ctx.x + 1);
  // All key exits join the original D803 epilogue. No elapsed frame or
  // changing DP counter is synthesized; EEBB executes observed NMIs.
  title: {
    if (ctx.status & FLAG_ZERO) {
      yield* call(0x81d6b2, 0x81d60f);
      yield* call(0x81d6b5, 0x81d642);
      h.sep(FLAG_MEMORY_8BIT);
      yield* titlePoll(h, e, 0x81d6ba);
      h.rep(FLAG_MEMORY_8BIT);
      yield* call(0x81d6c1, 0x81eb7b, true);
      yield* call(0x81d6c5, 0x81eedd, true);
      h.dpWrite(DP_TITLE_SPEED_TARGET, 0);
      h.dpWrite(DP_TITLE_SPEED, 0);
      h.index('x', TITLE_PAN_WAIT);
      do {
        h.phx();
        yield* call(0x81d6d1, 0x81eebb, true);
        yield* call(0x81d6d5, 0x80f298, true);
        h.plx();
        h.load(h.read(h.abs(PAD_HELD)));
        if (!(ctx.status & FLAG_ZERO)) break title;
        h.index('x', ctx.x - 1);
      } while (!(ctx.status & FLAG_ZERO));
      h.index('x', TITLE_PAN_LIST & WORD_MASK);
      h.index('y', TITLE_PAN_LIST >>> WORD_BITS);
      yield* call(0x81d6e8, 0x81ec16, true);
      yield* call(0x81d6ec, 0x81eebb, true);
      yield* call(0x81d6f0, 0x80f298, true);
      h.load(h.read(h.abs(PAD_HELD)));
    }
    if (!(ctx.status & FLAG_ZERO)) break title;
    for (;;) {
      h.load(h.dp(DP_TITLE_POSITION));
      h.cmp(TITLE_PAN_END);
      if (ctx.status & FLAG_ZERO) break;
      yield* call(0x81d6ec, 0x81eebb, true);
      yield* call(0x81d6f0, 0x80f298, true);
      h.load(h.read(h.abs(PAD_HELD)));
      if (!(ctx.status & FLAG_ZERO)) break title;
    }
    h.index('x', MENU_FONT_TILES & WORD_MASK);
    h.load(MENU_FONT_PACKED & WORD_MASK);
    h.index('y', MENU_FONT_PACKED >>> WORD_BITS);
    yield* call(0x81d70c, 0x80f2a0, true);
    yield* call(0x81d710, 0x81eb89, true);
    h.index('x', TITLE_SCROLL_LIST & WORD_MASK);
    h.index('y', TITLE_SCROLL_LIST >>> WORD_BITS);
    yield* call(0x81d71a, 0x81ec16, true);
    h.load(TITLE_SCROLL_SPEED);
    h.dpWrite(DP_TITLE_SPEED_TARGET, ctx.a);
    for (const at of [DP_TITLE_SPEED, DP_TITLE_POSITION, DP_TITLE_UPLOAD]) h.dpWrite(at, 0);
    h.index('x', TITLE_SCROLL_COLOURS_BYTES - 2);
    h.load(0);
    do {
      h.write(TITLE_PALETTE + ctx.x, ctx.a);
      downX(h);
    } while (!(ctx.status & FLAG_NEGATIVE));
    yield* call(0x81d737, 0x81eebb, true);
    yield* call(0x81d73b, 0x81eb7b, true);
    for (;;) {
      yield* call(0x81d73f, 0x81eebb, true);
      h.load(h.dp(DP_TITLE_POSITION));
      h.cmp(TITLE_WINDOW_START);
      if (ctx.status & FLAG_CARRY) yield* call(0x81d74a, 0x81d81f);
      yield* call(0x81d74d, 0x80f298, true);
      h.load(h.read(h.abs(PAD_HELD)));
      if (!(ctx.status & FLAG_ZERO)) break title;
      h.load(h.dp(DP_TITLE_POSITION));
      h.cmp(TITLE_BG1_ONLY);
      if (ctx.status & FLAG_CARRY) break;
    }
    h.sep(FLAG_MEMORY_8BIT);
    port(h, 0x81d761, TM, LAYER_BG1);
    h.rep(FLAG_MEMORY_8BIT);
    for (;;) {
      yield* call(0x81d766, 0x81eebb, true);
      yield* call(0x81d76a, 0x80f298, true);
      yield* call(0x81d76e, 0x81d81f);
      h.load(h.read(h.abs(PAD_HELD)));
      if (!(ctx.status & FLAG_ZERO)) break title;
      h.load(h.dp(DP_TITLE_POSITION));
      h.cmp(TITLE_WINDOW_END);
      if (ctx.status & FLAG_CARRY) break;
    }
    h.sep(FLAG_MEMORY_8BIT);
    yield* titlePoll(h, e, 0x81d782);
    h.rep(FLAG_MEMORY_8BIT);
    yield* call(0x81d789, 0x81d927);
    yield* call(0x81d78c, 0x81d87c);
    h.load(h.read(h.abs(PAD_HELD)));
    if (!(ctx.status & FLAG_ZERO)) break title;
    for (const [value, pc, poll, helper] of [
      [TITLE_BG2_VIEW_2, 0x81d798, 0x81d79e, 0x81d7a5],
      [TITLE_BG2_VIEW_3, 0x81d7b1, 0x81d7b7, 0x81d7be],
    ]) {
      h.sep(FLAG_MEMORY_8BIT);
      port(h, pc, BG2VOFS, value);
      h.portWrite(BG2VOFS, 0, 1, pc + ABSOLUTE_INSTRUCTION_BYTES);
      yield* titlePoll(h, e, poll);
      h.rep(FLAG_MEMORY_8BIT);
      yield* call(helper, 0x81d87c);
      h.load(h.read(h.abs(PAD_HELD)));
      if (!(ctx.status & FLAG_ZERO)) break title;
    }
    for (;;) {
      yield* call(0x81d7c6, 0x81eebb, true);
      yield* call(0x81d7ca, 0x80f298, true);
      h.load(h.read(h.abs(PAD_HELD)));
      if (!(ctx.status & FLAG_ZERO)) break title;
      h.load(h.dp(DP_TITLE_POSITION));
      h.cmp(TITLE_END_CHECK);
      if (!(ctx.status & FLAG_CARRY)) continue;
      h.load(h.port(STAT77, 2, 0x81d7da));
      h.load(ctx.a & STAT77_WORD_PAL);
      h.lsr();
      h.lsr();
      h.lsr();
      h.adc(h.dp(DP_TITLE_POSITION));
      h.cmp(TITLE_END);
      if (ctx.status & FLAG_CARRY) break;
    }
    yield* call(0x81d7ea, 0x81eef1, true);
    yield* call(0x81d7ee, 0x81eb89, true);
    h.sep(FLAG_MEMORY_8BIT);
    h.portWrite(HDMAEN, 0, 1, 0x81d7f4);
    yield* titlePoll(h, e, 0x81d7f7);
    h.plp();
    h.rep(FLAG_MEMORY_8BIT);
    h.load(0);
    return h.rtl();
  }
  h.rep(FLAG_MEMORY_8BIT);
  h.load(APU_COMMAND_VOLUME_TARGET);
  h.index('x', 0);
  yield* call(0x81d80b, 0x81f007, true);
  yield* call(0x81d80f, 0x81eef1, true);
  yield* call(0x81d813, 0x81eb89, true);
  h.portWrite(HDMAEN, 0, 2, 0x81d817);
  h.plp();
  h.load(1);
  return h.rtl();
}
// Original routine $81:DAD6.
function runPanObjectsCallback(h, e, r = TITLE_REFERENCE_ROUTINES) {
  return drainNativeSequence(panObjectsCallbackSequence(h, e, r));
}
function* panObjectsCallbackSequence(h, e, r) {
  yield () => {
    callFor(h, e, r)(0x81dad6, 0x81ed8b);
    h.ctx.pc = 0x81d9d5 & WORD_MASK;
  };
  return yield* drawPanObjectsSequence(h, e, r);
}
// Original routine $81:D9D5.
function drawPanObjects(h, e, r = TITLE_REFERENCE_ROUTINES) {
  return drainNativeSequence(drawPanObjectsSequence(h, e, r));
}
function* drawPanObjectsSequence(h, e, r) {
  const { ctx } = h,
    call = callFor(h, e, r);
  let result;
  yield () => {
    h.pushByte(ctx.programBank);
    h.plb();
    h.rep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
    call(0x81d9d9, 0x81edd7);
    h.dpWrite(DP_OAM_OFFSET, 0);
    h.load(h.dp(DP_TITLE_POSITION));
    h.lsr();
    h.lsr();
    h.dpWrite(DP_INTRO_SCROLL, ctx.a);
    h.index('x', INTRO_OBJECT_LAST);
    do {
      h.load(NEAR_OBJECT_TILE);
      h.dpWrite(DP_SPRITE_TILE, ctx.a);
      h.load(h.read(h.abs(INTRO_NEAR_ANIMATIONS) + ctx.x));
      if (!(ctx.status & FLAG_NEGATIVE)) {
        h.index('y', ctx.a);
        h.load(h.read(h.abs(INTRO_SPRITES & WORD_MASK) + ctx.y));
        h.phx();
        h.pha();
        h.index('y', h.read(h.abs(INTRO_NEAR_Y) + ctx.x, 2));
        h.load(h.read(h.abs(INTRO_NEAR_X) + ctx.x));
        ctx.status |= FLAG_CARRY;
        h.sbc(h.dp(DP_INTRO_SCROLL));
        h.index('x', ctx.a);
        h.pla();
        call(0x81da03, 0x81e83a);
        h.plx();
        h.load(h.read(h.abs(FRONTEND_FRAME_COUNTER)));
        h.load(ctx.a & NEAR_ANIMATION_PERIOD_MASK);
        if (ctx.status & FLAG_ZERO) {
          h.load(h.read(h.abs(INTRO_NEAR_ANIMATIONS) + ctx.x));
          h.load(ctx.a + 1);
          h.load(ctx.a + 1);
          h.write(h.abs(INTRO_NEAR_ANIMATIONS) + ctx.x, ctx.a);
          h.index('y', ctx.a);
          h.load(h.read(h.abs(INTRO_SPRITES & WORD_MASK) + ctx.y));
          if (ctx.status & FLAG_NEGATIVE) {
            h.cmp(ANIMATION_RESTART);
            if (ctx.status & FLAG_ZERO) h.load(INTRO_START_ANIMATION);
            h.write(h.abs(INTRO_NEAR_ANIMATIONS) + ctx.x, ctx.a);
          }
        }
      }
      h.index('x', ctx.x - 1);
      h.index('x', ctx.x - 1);
    } while (!(ctx.status & FLAG_NEGATIVE));
    h.load(h.dp(DP_TITLE_POSITION));
    h.lsr();
    h.lsr();
    h.lsr();
    h.dpWrite(DP_INTRO_SCROLL, ctx.a);
    h.index('x', INTRO_OBJECT_LAST);
    do {
      h.load(FAR_OBJECT_TILE);
      h.dpWrite(DP_SPRITE_TILE, ctx.a);
      h.load(h.read(h.abs(INTRO_FAR_ANIMATIONS) + ctx.x));
      if (!(ctx.status & FLAG_NEGATIVE)) {
        h.index('y', ctx.a);
        h.load(h.read(h.abs(INTRO_SPRITES & WORD_MASK) + ctx.y));
        h.phx();
        h.pha();
        h.index('y', h.read(h.abs(INTRO_FAR_Y) + ctx.x, 2));
        h.load(h.read(h.abs(INTRO_FAR_X) + ctx.x));
        ctx.status |= FLAG_CARRY;
        h.sbc(h.dp(DP_INTRO_SCROLL));
        h.index('x', ctx.a);
        h.pla();
        call(0x81da52, 0x81e83a);
        h.plx();
        h.load(h.read(h.abs(FRONTEND_FRAME_COUNTER)));
        h.load(ctx.a & FAR_ANIMATION_PERIOD_MASK);
        if (ctx.status & FLAG_ZERO) {
          h.load(h.read(h.abs(INTRO_FAR_ANIMATIONS) + ctx.x));
          h.load(ctx.a + 1);
          h.load(ctx.a + 1);
          h.write(h.abs(INTRO_FAR_ANIMATIONS) + ctx.x, ctx.a);
          h.index('y', ctx.a);
          h.load(h.read(h.abs(INTRO_SPRITES & WORD_MASK) + ctx.y));
          if (ctx.status & FLAG_NEGATIVE) h.write(h.abs(INTRO_FAR_ANIMATIONS) + ctx.x, ctx.a);
        }
      }
      h.index('x', ctx.x - 1);
      h.index('x', ctx.x - 1);
    } while (!(ctx.status & FLAG_NEGATIVE));
    call(0x81da74, 0x81ee0c);
    h.index('x', h.read(h.abs(INTRO_NEAR_EVENT), 2));
    for (;;) {
      h.load(h.read(h.abs(FRONTEND_FRAME_COUNTER)));
      h.cmp(h.read(h.abs(NEAR_EVENT_FRAMES & WORD_MASK) + ctx.x));
      if (!(ctx.status & FLAG_ZERO)) break;
      h.phx();
      h.load(h.read(h.abs(NEAR_EVENT_Y & WORD_MASK) + ctx.x));
      h.lsr();
      ctx.status &= ~FLAG_CARRY;
      h.adc(INTRO_NEAR_Y_BIAS);
      h.index('y', ctx.a);
      h.load(h.read(h.abs(NEAR_EVENT_X & WORD_MASK) + ctx.x));
      h.lsr();
      h.index('x', ctx.a);
      h.load(h.dp(DP_TITLE_POSITION));
      h.lsr();
      h.lsr();
      call(0x81da96, 0x81e900);
      h.pla();
      ctx.status &= ~FLAG_CARRY;
      h.adc(EVENT_BYTES);
      h.index('x', ctx.a);
    }
    h.write(h.abs(INTRO_NEAR_EVENT), ctx.x, 2);
    h.index('x', h.read(h.abs(INTRO_FAR_EVENT), 2));
    for (;;) {
      h.load(h.read(h.abs(FRONTEND_FRAME_COUNTER)));
      h.cmp(h.read(h.abs(FAR_EVENT_FRAMES & WORD_MASK) + ctx.x));
      if (!(ctx.status & FLAG_ZERO)) break;
      h.phx();
      h.load(h.read(h.abs(FAR_EVENT_Y & WORD_MASK) + ctx.x));
      h.lsr();
      ctx.status &= ~FLAG_CARRY;
      h.adc(INTRO_FAR_Y_BIAS);
      h.index('y', ctx.a);
      h.load(h.read(h.abs(FAR_EVENT_X & WORD_MASK) + ctx.x));
      h.lsr();
      h.index('x', ctx.a);
      call(0x81dabf, 0x81e971);
      h.pla();
      ctx.status &= ~FLAG_CARRY;
      h.adc(EVENT_BYTES);
      h.index('x', ctx.a);
    }
    h.write(h.abs(INTRO_FAR_EVENT), ctx.x, 2);
    h.modify(h.abs(FRONTEND_FRAME_COUNTER), 'inc');
  };
  yield* nativeCallSequence(h, e, r, 0x81dad1, 0x80f290, true);
  yield () => {
    result = h.rtl();
  };
  return result;
}

// The prologue NMI 81:DD54 sends the text tilemap to VRAM word 1000 and scrolls BG3.
const PROLOGUE_TILEMAP_VRAM = 0x1000,
  VRAM_WORD_DMA = ((VMDATAL & BYTE_MASK) << BYTE_BITS) | DMAP_TWO_PORTS;
// The pan NMI 81:D93E speeds up by PAN_ACCELERATION (saturating) and scrolls BG1 by the
// position, BG2 by a quarter and BG3 by an eighth of it until TITLE_PAN_END; the vertical scroll NMI 81:DCAC moves the
// speed toward the target, scrolls BG1 by the position over 4 and BG2 over 8 until
// BG2_SCROLL_END, from then on it sends the scroll colours to CGRAM colour 16. Both send a
// map of 800 bytes to VRAM when the position reaches an entry of their upload tables
// (position, source in bank 7E, VRAM word; six bytes per entry, negative ends the pan's).
const PAN_ACCELERATION = 0x7d0,
  PAN_UPLOADS = 0x81dc92,
  SCROLL_UPLOAD_POSITIONS = 0x81dd8b,
  SCROLL_UPLOAD_SOURCES = 0x81dd8d,
  SCROLL_UPLOAD_VRAM = 0x81dd8f,
  UPLOAD_ENTRY_BYTES = 6,
  UPLOAD_BYTES = 0x800,
  BG2_SCROLL_END = 0x78,
  SCROLL_FIRST_COLOUR = 0x10;

const yport = (h, value, offset, pc) => {
  h.index('y', value);
  h.portWrite(offset, h.ctx.y, 1, pc);
};
const aport = (h, value, offset, pc) => {
  h.load(value);
  h.portWrite(offset, h.ctx.a & (h.m() ? BYTE_MASK : WORD_MASK), h.m() ? 1 : 2, pc);
};
function* inputSequence(h, e, r) {
  let result;
  yield* nativeCallSequence(h, e, r, 0x81dd4f, 0x80f290, true);
  yield () => {
    result = h.rtl();
  };
  return result;
}
// Original routine $81:DD54.
function runPrologueCallback(h, e, r = TITLE_REFERENCE_ROUTINES) {
  return drainNativeSequence(prologueCallbackSequence(h, e, r));
}
function* prologueCallbackSequence(h, e, r) {
  const { ctx } = h;
  yield () => {
    for (const [value, port, pc] of [
      [PROLOGUE_TILEMAP_VRAM, VMADDL, 0x81dd57],
      [VRAM_WORD_DMA, DMAP0, 0x81dd5d],
      [PROLOGUE_TILEMAP & WORD_MASK, A1T0L, 0x81dd63],
      [PROLOGUE_TILEMAP_BYTES, DAS0L, 0x81dd69],
    ])
      aport(h, value, port, pc);
    h.load(h.dp(DP_PROLOGUE_SCROLL));
    h.sep(FLAG_MEMORY_8BIT);
    h.portWrite(BG3VOFS, ctx.a & BYTE_MASK, 1, 0x81dd70);
    h.xba();
    h.portWrite(BG3VOFS, ctx.a & BYTE_MASK, 1, 0x81dd74);
    for (const [value, port, pc] of [
      [VMAINC_INCREMENT_AFTER_HIGH, VMAINC, 0x81dd79],
      [WRAM_BANK, A1B0, 0x81dd7e],
      [1, MDMAEN, 0x81dd83],
    ])
      aport(h, value, port, pc);
    h.rep(FLAG_MEMORY_8BIT);
  };
  return yield* inputSequence(h, e, r);
}
// Original routine $81:D93E.
function runTitlePanCallback(h, e, r = TITLE_REFERENCE_ROUTINES) {
  return drainNativeSequence(titlePanCallbackSequence(h, e, r));
}
function* titlePanCallbackSequence(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  yield () => {
    call(0x81d93e, 0x81ed8b, true);
    h.load(h.dp(DP_TITLE_POSITION));
    h.cmp(TITLE_PAN_END);
    if (ctx.status & FLAG_ZERO) return;
    h.pha();
    h.load(h.dp(DP_TITLE_SPEED));
    ctx.status &= ~FLAG_CARRY;
    h.adc(PAN_ACCELERATION);
    if (ctx.status & FLAG_CARRY) h.load(WORD_MASK);
    h.dpWrite(DP_TITLE_SPEED, ctx.a);
    ctx.status &= ~FLAG_CARRY;
    h.adc(h.dp(DP_TITLE_SPEED_TARGET));
    h.dpWrite(DP_TITLE_SPEED_TARGET, ctx.a);
    h.load(h.dp(DP_TITLE_POSITION));
    h.adc(0);
    h.dpWrite(DP_TITLE_POSITION, ctx.a);
    h.pla();
    for (const [low, high, shifts] of [
      [0x81d969, 0x81d96d, 2],
      [0x81d977, 0x81d97b, 1],
      [0x81d984, 0x81d988, 0],
    ]) {
      h.sep(FLAG_MEMORY_8BIT);
      const offset = low === 0x81d969 ? BG1HOFS : low === 0x81d977 ? BG2HOFS : BG3HOFS;
      h.portWrite(offset, ctx.a & BYTE_MASK, 1, low);
      h.xba();
      h.portWrite(offset, ctx.a & BYTE_MASK, 1, high);
      h.xba();
      h.rep(FLAG_MEMORY_8BIT);
      for (let n = 0; n < shifts; n++) h.lsr();
    }
    h.pushByte(ctx.programBank);
    h.plb();
    h.index('x', 0);
    for (;;) {
      h.load(h.read(h.abs(PAN_UPLOADS & WORD_MASK) + ctx.x));
      if (ctx.status & FLAG_NEGATIVE) return;
      h.cmp(h.dp(DP_TITLE_POSITION));
      if (ctx.status & FLAG_ZERO) break;
      h.load(ctx.x);
      ctx.status &= ~FLAG_CARRY;
      h.adc(UPLOAD_ENTRY_BYTES);
      h.index('x', ctx.a);
    }
    h.index('x', ctx.x + 1);
    h.index('x', ctx.x + 1);
    h.sep(FLAG_INDEX_8BIT);
    for (const [value, port, pc] of [
      [VMAINC_INCREMENT_AFTER_HIGH, VMAINC, 0x81d9aa],
      [DMAP_TWO_PORTS, DMAP0, 0x81d9af],
      [VMDATAL & BYTE_MASK, BBAD0, 0x81d9b4],
    ])
      yport(h, value, port, pc);
    h.load(h.read(h.abs(PAN_UPLOADS & WORD_MASK) + ctx.x));
    h.index('x', ctx.x + 1);
    h.index('x', ctx.x + 1);
    h.portWrite(A1T0L, ctx.a, 2, 0x81d9bc);
    yport(h, WRAM_BANK, A1B0, 0x81d9c1);
    aport(h, UPLOAD_BYTES, DAS0L, 0x81d9c7);
    h.load(h.read(h.abs(PAN_UPLOADS & WORD_MASK) + ctx.x));
    h.portWrite(VMADDL, ctx.a, 2, 0x81d9cd);
    yport(h, 1, MDMAEN, 0x81d9d2);
  };
  return yield* nativeTailSequence(h, e, r, 0x81d9d5);
}
// Original routine $81:DCAC.
function runTitleScrollCallback(h, e, r = TITLE_REFERENCE_ROUTINES) {
  return drainNativeSequence(titleScrollCallbackSequence(h, e, r));
}
function* titleScrollCallbackSequence(h, e, r) {
  const { ctx } = h;
  yield () => {
    routineCaller(h, e, r)(0x81dcac, 0x81ed8b, true);
    h.load(h.dp(DP_TITLE_SPEED));
    h.cmp(h.dp(DP_TITLE_SPEED_TARGET));
    if (!(ctx.status & FLAG_ZERO)) {
      h.load(ctx.a + (ctx.status & FLAG_CARRY ? -1 : 1));
      h.dpWrite(DP_TITLE_SPEED, ctx.a);
    }
    h.lsr();
    h.lsr();
    ctx.status &= ~FLAG_CARRY;
    h.adc(h.dp(DP_TITLE_POSITION));
    h.dpWrite(DP_TITLE_POSITION, ctx.a);
    h.lsr();
    h.lsr();
    h.sep(FLAG_MEMORY_8BIT);
    h.portWrite(BG1VOFS, ctx.a & BYTE_MASK, 1, 0x81dcc9);
    h.xba();
    h.portWrite(BG1VOFS, ctx.a & BYTE_MASK, 1, 0x81dccd);
    h.xba();
    h.rep(FLAG_MEMORY_8BIT);
    h.lsr();
    h.cmp(BG2_SCROLL_END);
    if (!(ctx.status & FLAG_CARRY)) {
      h.sep(FLAG_MEMORY_8BIT);
      h.portWrite(BG2VOFS, ctx.a & BYTE_MASK, 1, 0x81dcdb);
      h.xba();
      h.portWrite(BG2VOFS, ctx.a & BYTE_MASK, 1, 0x81dcdf);
      h.xba();
      h.rep(FLAG_MEMORY_8BIT);
    } else {
      h.sep(FLAG_INDEX_8BIT);
      for (const [value, port, pc] of [
        [SCROLL_FIRST_COLOUR, CGADD, 0x81dceb],
        [DMAP_ONE_PORT, DMAP0, 0x81dcf0],
        [CGDATA & BYTE_MASK, BBAD0, 0x81dcf5],
      ])
        yport(h, value, port, pc);
      aport(h, TITLE_PALETTE & WORD_MASK, A1T0L, 0x81dcfb);
      yport(h, WRAM_BANK, A1B0, 0x81dd00);
      aport(h, TITLE_SCROLL_COLOURS_BYTES, DAS0L, 0x81dd06);
      yport(h, 1, MDMAEN, 0x81dd0b);
      h.rep(FLAG_INDEX_8BIT);
    }
    h.pushByte(ctx.programBank);
    h.plb();
    h.index('x', h.dp(DP_TITLE_UPLOAD, 2));
    h.load(h.read(h.abs(SCROLL_UPLOAD_POSITIONS & WORD_MASK) + ctx.x));
    h.cmp(h.dp(DP_TITLE_POSITION));
    if (ctx.status & FLAG_CARRY) return;
    h.load(ctx.x);
    ctx.status &= ~FLAG_CARRY;
    h.adc(UPLOAD_ENTRY_BYTES);
    h.dpWrite(DP_TITLE_UPLOAD, ctx.a);
    h.sep(FLAG_INDEX_8BIT);
    for (const [value, port, pc] of [
      [VMAINC_INCREMENT_AFTER_HIGH, VMAINC, 0x81dd26],
      [DMAP_TWO_PORTS, DMAP0, 0x81dd2b],
      [VMDATAL & BYTE_MASK, BBAD0, 0x81dd30],
    ])
      yport(h, value, port, pc);
    h.load(h.read(h.abs(SCROLL_UPLOAD_SOURCES & WORD_MASK) + ctx.x));
    h.portWrite(A1T0L, ctx.a, 2, 0x81dd36);
    yport(h, WRAM_BANK, A1B0, 0x81dd3b);
    aport(h, UPLOAD_BYTES, DAS0L, 0x81dd41);
    h.load(h.read(h.abs(SCROLL_UPLOAD_VRAM & WORD_MASK) + ctx.x));
    h.portWrite(VMADDL, ctx.a, 2, 0x81dd47);
    yport(h, 1, MDMAEN, 0x81dd4c);
  };
  return yield* inputSequence(h, e, r);
}

// The routine table with the reference title in place of the lifted one.
const REFERENCE = [
  [0x81d694, playTitle, playTitleSequence],
  [0x81dddb, playPrologue, playPrologueSequence],
  [0x81d87c, blendTitleView, blendTitleViewSequence],
  [0x81dd54, runPrologueCallback, prologueCallbackSequence],
  [0x81d93e, runTitlePanCallback, titlePanCallbackSequence],
  [0x81dcac, runTitleScrollCallback, titleScrollCallbackSequence],
  [0x81dad6, runPanObjectsCallback, panObjectsCallbackSequence],
  [0x81d9d5, drawPanObjects, drawPanObjectsSequence],
];
export const TITLE_REFERENCE_ENTRIES = [
  ...INTRO_SETUP_REFERENCE_ENTRIES,
  ...REFERENCE.map(([target, run]) => [target, run]),
  [0x81de93, drawPrologueLine],
  [0x81d81f, moveTitleWindow],
  [0x81d8e5, fadeTitleBlend],
  [0x81d927, showTitlePicture],
];
export const TITLE_REFERENCE_ROUTINES = new Map([
  ...FRONTEND_NMI_ROUTINES,
  ...INTRO_NMI_ROUTINES,
  ...TITLE_REFERENCE_ENTRIES,
]);
for (const [, run, sequence] of REFERENCE)
  NATIVE_CALL_CONTINUATIONS.set(run, {
    run,
    create: ({ h, events, routines = TITLE_REFERENCE_ROUTINES }) =>
      new NativeCallContinuation(h.a, sequence(h, events, routines)),
  });
// A copy of a routine table with the reference title in place of the lifted one
// (for the ROM proof tests of the boot and the frontend).
export const withTitleReference = (routines) => new Map([...routines, ...TITLE_REFERENCE_ENTRIES]);
