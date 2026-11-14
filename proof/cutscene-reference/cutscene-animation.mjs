import { taskStop } from '../../src/task/plan.mjs';
import { routineCaller } from '../../src/task/routine-call.mjs';

// H-DMA entries of a write-twice register: line count and two data bytes.
const HDMA_ENTRY_BYTES = 3;
import {
  DP_CUTSCENE_SCROLL_Y as DP_SCROLL_Y,
  DP_CUTSCENE_SPEED as DP_SPEED,
  DP_CUTSCENE_POSITION as DP_POSITION,
  DP_CUTSCENE_SCENE as DP_SCENE,
  OAM_SHADOW,
  PAD_HELD,
  RANDOM_STATE,
  SCENE_ANIMATION_STEP,
  SCENE_ARGUMENT,
  SCENE_ARGUMENT_MOVED,
  SCENE_COUNTER,
  SCENE_LAYER_HIGH,
  WRAM,
} from '../../src/task/wram.mjs';
import {
  DMAP6,
  BBAD6,
  A1B6,
  HDMAEN,
  A1T6L,
  BG2HOFS,
  BG2VOFS,
  VMADDL,
  VMAINC,
  VMDATAL,
  DMAP0,
  A1T0L,
  A1B0,
  DAS0L,
  MDMAEN,
} from '../../src/constants/hardware-registers.mjs';
import {
  FLAG_CARRY,
  FLAG_ZERO,
  FLAG_NEGATIVE,
  FLAG_MEMORY_8BIT,
} from '../../src/constants/cpu-flags.mjs';
import {
  BANK_MASK,
  NIBBLE_BITS,
  WORD_MASK,
  BYTE_BITS,
  BYTE_MASK,
  HIGH_BYTE_MASK,
} from '../../src/constants/bits.mjs';
import { WRAM_BANK, WRAM_BANK_PAIR } from '../../src/constants/memory-map.mjs';
import {
  DMAP_TWO_PORTS,
  DMAP_WRITE_TWICE,
  LAYER_BG1,
  LAYER_BG2,
  LAYER_BG3,
  LAYER_OBJ,
  OAM_NAME_BYTE,
  VMAINC_INCREMENT_AFTER_HIGH,
} from '../../src/constants/ppu.mjs';
import {
  APU_COMMAND_SOUND_VOICES,
  APU_COMMAND_SOUND_VOLUME,
  APU_COMMAND_VOICE_PITCH,
} from '../../src/constants/sound-commands.mjs';
// 81:CF72 tail-dispatches through D41F in the program bank. No extra return frame.
// The six targets share the caller's DP and DBR; table reads and text bytes stay fresh.

// Cutscenes of 81:CDF8 (scene DP1E, negative: mirrored) and the cutscene wait 81:D479:
// BG1 vertical scroll, BG2 speed, the BG2 position (scroll times 128). Scene tables in
// bank 81 (src/data/tables.mjs): the animation calls, sprite bases and displacements.
export { DP_SCROLL_Y, DP_SPEED, DP_POSITION, DP_SCENE };
export const SCENE_SPRITE_BASES = 0x81d413;
const SCENE_ANIMATION_CALLS = 0x81d41f,
  SCENE_DISPLACEMENTS_D022 = 0x81d022,
  SCENE_DISPLACEMENTS_D0FD = 0x81d0fd,
  POSITION_SCROLL_SHIFT = 7,
  SCROLL_MIRROR = 0x1ff;
// Scene buffers: the picture map (also the H-DMA table of channel 6 that scrolls BG2 per
// line, three bytes an entry), the 32 by 32 text map after it, the credits text and its
// character map, and the TM H-DMA table of 81:D37D (main layers for 76 lines, then 64
// single lines, two bytes an entry).
export const SCENE_PICTURE = WRAM + SCENE_LAYER_HIGH,
  SCENE_TEXT_MAP = 0x7e4ea8,
  MAP_BYTES = 0x800,
  CREDITS_BUFFER = 0x62a8,
  CHARACTER_MAP = 0x56a8,
  SCENE_LAYERS = LAYER_BG1 | LAYER_BG2 | LAYER_OBJ,
  SCENE_TM_HDMA = 0x7e5ea8,
  SCENE_TM_LINES = SCENE_TM_HDMA + 2;
const SCROLL_HDMA = SCENE_PICTURE,
  TM_LINES = 0x40,
  TM_LINE_MASK = TM_LINES - 1,
  TM_LINE_HALF = 0x20,
  TM_LINE = (SCENE_LAYERS << BYTE_BITS) | 1,
  TM_LINE_WITH_BG3 = ((SCENE_LAYERS | LAYER_BG3) << BYTE_BITS) | 1;
// H-DMA setup: BG2HOFS written twice per line from bank 7E on channel 6 (with 7, or with 5
// and 7); the port writes lie 5 bytes apart (LDA #, STA abs), an STZ after a STA 3 bytes.
const HDMA_CHANNELS_6_7 = 0xc0,
  HDMA_CHANNELS_5_7 = 0xe0,
  PORT_WRITE_BYTES = 5,
  BBAD_WRITE = PORT_WRITE_BYTES,
  A1B_WRITE = 2 * PORT_WRITE_BYTES,
  HDMAEN_WRITE = 3 * PORT_WRITE_BYTES,
  STZ_BYTES = 3;
// The line scroll: DP0E the 8.8 scroll, DP10 its step per line (the position plus 3F00 for
// 81:D02A, divided by 16). 81:D160 fills 45 entries; the scenes start with BG2 scrolled
// up by 8 - speed for speed - 6 lines (at least 1).
const DP_LINE_SCROLL = 0xe,
  DP_LINE_STEP = 0x10,
  LINE_STEP_BIAS = 0x3f00,
  HEAD_SCROLL_Y = 8,
  HEAD_LINES_OFFSET = 6,
  D160_LAST_ENTRY = 0x87;
// 81:CFCC: every 8th frame on average sound 0D on voices 0 and 1 with both volume nibbles
// from bits 6-9 of the speed; 8 displacement steps from 81:D022 (mask 3).
const ENGINE_SOUND_FRAMES_MASK = 7,
  ENGINE_VOICES = 3,
  SPEED_VOLUME_BITS = 0x3c0,
  ENGINE_SOUND = 13,
  CFCC_STEPS_MASK = 7,
  CFCC_DISPLACEMENT_MASK = 3;
// 81:D02A: sound 27 on voice 0 with volume nibbles 4 and 4, then the pitch 264 + 16 per
// displacement step (16 steps from 81:D0FD, mask 7); BG2 scrolled to 50, a first H-DMA
// entry of 67 lines, then 60 single lines.
const D02A_VOICES = 1,
  D02A_SOUND = 0x4427,
  D02A_PITCH = 0x264,
  D02A_STEPS_MASK = 15,
  D02A_DISPLACEMENT_MASK = 7,
  D02A_BG2_SCROLL_Y = 0x50,
  D02A_TOP_LINES = 0x67,
  D02A_LINES = 0x3c;
// 81:D11A: a sprite (OAM entry 7, character 08, priority 3) at Y 8A, X AF minus 3/256 of
// the argument; for 128 frames it takes SCENE_ARGUMENT, then SCENE_ARGUMENT_MOVED.
const PORTRAIT_STEPS = 0x80,
  PORTRAIT_POSITION = 0x8aaf,
  PORTRAIT_ENTRY = OAM_SHADOW + 0x1c,
  PORTRAIT_TILE = 0x3008,
  DP_SPRITE_OFFSET = 0xe;
// 81:D1F0, the credits: the text map goes to VRAM 0800 by DMA; a page stays 500 frames;
// its lines (32 columns, characters from 20 through 7E:56A8) are centred around map
// offset 380, two map rows (80 bytes) apart. During the first 64 frames (counter from 1F4
// down to 1B4) and the last 64 the TM lines add BG3, the second line 23 behind; the BG2
// line scroll has a 40-line entry.
const TEXT_MAP_VRAM = 0x800,
  CREDITS_PAGE_FRAMES = 0x1f4,
  CREDITS_FADE_IN_END = 0x1b4,
  CREDITS_CENTRE = 0x380,
  CREDITS_TEXT_LINES = 0x28,
  TINT_SECOND_LINE = 0x23,
  TEXT_COLUMNS = 0x20,
  FIRST_CHARACTER = 0x20,
  WORD_OFFSET_MASK = 0xfe,
  TEXT_LINE_BYTES = 0x80,
  MAP_ROW_MASK = 0xffc0,
  CREDITS_HDMA_END = SCROLL_HDMA + 3 * HDMA_ENTRY_BYTES,
  DP_LINES = 0xe,
  DP_LINE_START = 0x10;
const call = (h, e, routines, pc, target, long = false) =>
  routineCaller(h, e, routines)(pc, target, long);
export const SCENE_ANIMATION_TARGETS = new Map([
  [0x81cfcc, animateEngineScene],
  [0x81d02a, animatePitchScene],
  [0x81d160, animateLineScroll],
  [0x81d146, moveSpriteForward],
  [0x81d153, moveSpriteBack],
  [0x81d1f0, animateCredits],
]);
// 81:CF72: run the animation of the current cutscene (table D41F by scene).
export function animateCutscene(h, e, routines) {
  h.load(h.dp(DP_SCENE));
  h.asl();
  h.index('x', h.ctx.a);
  const at = ((SCENE_ANIMATION_CALLS & WORD_MASK) + h.ctx.x) & WORD_MASK,
    target =
      (SCENE_ANIMATION_CALLS & BANK_MASK) |
      h.read((SCENE_ANIMATION_CALLS & BANK_MASK) | at, 1) |
      (h.read((SCENE_ANIMATION_CALLS & BANK_MASK) | ((at + 1) & WORD_MASK), 1) << BYTE_BITS),
    run = SCENE_ANIMATION_TARGETS.get(target);
  if (!run) taskStop('main_scene_animation_frontier', { pc: 0x81cf76, target });
  return run(h, e, routines);
}
function displacement(h, table, mask, pc, e, routines) {
  const { ctx } = h;
  h.load(h.dp(DP_SCENE));
  h.asl();
  h.index('x', ctx.a);
  h.load(h.read(h.abs(table) + ctx.y));
  h.load(ctx.a & mask);
  h.pha();
  h.load(ctx.a ^ BYTE_MASK);
  h.load(ctx.a + 1);
  h.load(ctx.a & BYTE_MASK);
  h.xba();
  ctx.status &= ~FLAG_CARRY;
  h.adc(h.read(h.abs(SCENE_SPRITE_BASES & WORD_MASK) + ctx.x));
  call(h, e, routines, pc, 0x81d4e8);
  h.pla();
  h.dpWrite(DP_SCROLL_Y, ctx.a);
}
// Original routine $81:CFCC.
function animateEngineScene(h, e, routines) {
  const { ctx } = h;
  h.load(h.read(WRAM + RANDOM_STATE));
  h.load(ctx.a & ENGINE_SOUND_FRAMES_MASK);
  if (ctx.status & FLAG_ZERO) {
    h.index('x', ENGINE_VOICES);
    h.load(APU_COMMAND_SOUND_VOICES);
    call(h, e, routines, 0x81cfdb, 0x81f007, true);
    h.load(h.dp(DP_SPEED));
    h.load(ctx.a & SPEED_VOLUME_BITS);
    for (let n = 0; n < NIBBLE_BITS; n++) h.asl();
    h.load(ctx.a | h.dp(DP_SPEED));
    h.asl();
    h.asl();
    h.load(ctx.a & HIGH_BYTE_MASK);
    h.adc(ENGINE_SOUND);
    h.index('x', ctx.a);
    h.load(APU_COMMAND_SOUND_VOLUME);
    call(h, e, routines, 0x81cff6, 0x81f007, true);
  }
  h.load(h.dp(DP_POSITION));
  h.lsr();
  h.lsr();
  h.lsr();
  h.xba();
  h.load(ctx.a & CFCC_STEPS_MASK);
  h.index('y', ctx.a);
  displacement(
    h,
    SCENE_DISPLACEMENTS_D022 & WORD_MASK,
    CFCC_DISPLACEMENT_MASK,
    0x81d01b,
    e,
    routines,
  );
  return h.rts();
}
function scrollTerms(h, add) {
  const { ctx } = h;
  h.load(h.dp(DP_POSITION));
  for (let n = 0; n < POSITION_SCROLL_SHIFT; n++) h.lsr();
  h.index('x', h.dp(DP_SCENE, 2));
  if (ctx.status & FLAG_NEGATIVE) h.load(ctx.a ^ SCROLL_MIRROR);
  h.xba();
  h.load(ctx.a & HIGH_BYTE_MASK);
  h.dpWrite(DP_LINE_SCROLL, ctx.a);
  h.load(h.dp(DP_POSITION));
  if (add) {
    ctx.status &= ~FLAG_CARRY;
    h.adc(LINE_STEP_BIAS);
  }
  for (let n = 0; n < NIBBLE_BITS; n++) h.lsr();
  h.index('x', h.dp(DP_SCENE, 2));
  if (ctx.status & FLAG_NEGATIVE) {
    h.load(ctx.a ^ WORD_MASK);
    h.load(ctx.a + 1);
  }
  h.dpWrite(DP_LINE_STEP, ctx.a);
  h.load(SCROLL_HDMA & WORD_MASK);
}
function hdmaEnd(h, base, mask) {
  const { ctx } = h;
  h.load(DMAP_WRITE_TWICE);
  h.portWrite(DMAP6, ctx.a & BYTE_MASK, 1, base);
  h.load(BG2HOFS & BYTE_MASK);
  h.portWrite(BBAD6, ctx.a & BYTE_MASK, 1, base + BBAD_WRITE);
  h.load(WRAM_BANK);
  h.portWrite(A1B6, ctx.a & BYTE_MASK, 1, base + A1B_WRITE);
  h.load(mask);
  h.portWrite(HDMAEN, ctx.a & BYTE_MASK, 1, base + HDMAEN_WRITE);
  h.rep(FLAG_MEMORY_8BIT);
}
// Original routine $81:D02A.
function animatePitchScene(h, e, routines) {
  const { ctx } = h;
  h.index('x', D02A_VOICES);
  h.load(APU_COMMAND_SOUND_VOICES);
  call(h, e, routines, 0x81d030, 0x81f007, true);
  h.index('x', D02A_SOUND);
  h.load(APU_COMMAND_SOUND_VOLUME);
  call(h, e, routines, 0x81d03a, 0x81f007, true);
  scrollTerms(h, true);
  h.portWrite(A1T6L, ctx.a, 2, 0x81d06b);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(D02A_BG2_SCROLL_Y);
  h.portWrite(BG2VOFS, ctx.a & BYTE_MASK, 1, 0x81d072);
  h.portWrite(BG2VOFS, 0, 1, 0x81d075);
  h.index('x', 0);
  h.load(D02A_TOP_LINES);
  h.write(SCROLL_HDMA, ctx.a);
  h.load(h.dp(DP_LINE_SCROLL + 1));
  h.write(SCROLL_HDMA + 1, ctx.a);
  h.load(0);
  h.write(SCROLL_HDMA + 2, ctx.a);
  h.rep(FLAG_MEMORY_8BIT);
  h.index('y', D02A_LINES);
  do {
    h.load(1);
    h.write(SCROLL_HDMA + HDMA_ENTRY_BYTES + ctx.x, ctx.a);
    h.load(h.dp(DP_LINE_SCROLL));
    ctx.status &= ~FLAG_CARRY;
    h.adc(h.dp(DP_LINE_STEP));
    h.dpWrite(DP_LINE_SCROLL, ctx.a);
    h.xba();
    h.write(SCROLL_HDMA + HDMA_ENTRY_BYTES + 1 + ctx.x, ctx.a);
    for (let n = 0; n < HDMA_ENTRY_BYTES; n++) h.index('x', ctx.x + 1);
    h.index('y', ctx.y - 1);
  } while (!(ctx.status & FLAG_ZERO));
  h.sep(FLAG_MEMORY_8BIT);
  h.load(0);
  h.write(SCROLL_HDMA + 2 * HDMA_ENTRY_BYTES + ctx.x, ctx.a);
  hdmaEnd(h, 0x81d0b5, HDMA_CHANNELS_6_7);
  h.load(h.dp(DP_POSITION));
  h.xba();
  h.load(ctx.a & D02A_STEPS_MASK);
  h.index('y', ctx.a);
  displacement(
    h,
    SCENE_DISPLACEMENTS_D0FD & WORD_MASK,
    D02A_DISPLACEMENT_MASK,
    0x81d0e7,
    e,
    routines,
  );
  for (let n = 0; n < NIBBLE_BITS; n++) h.asl();
  h.adc(D02A_PITCH);
  h.index('x', ctx.a);
  h.load(APU_COMMAND_VOICE_PITCH);
  call(h, e, routines, 0x81d0f8, 0x81f007, true);
  return h.rts();
}
function portrait(h) {
  const { ctx } = h;
  h.load(h.read(h.abs(SCENE_ARGUMENT_MOVED)));
  h.dpWrite(DP_SPRITE_OFFSET, ctx.a);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(h.read(h.abs(SCENE_ANIMATION_STEP)));
  h.cmp(PORTRAIT_STEPS);
  if (!(ctx.status & FLAG_ZERO)) {
    h.load(h.read(h.abs(SCENE_ARGUMENT)));
    h.dpWrite(DP_SPRITE_OFFSET, ctx.a);
    h.modify(h.abs(SCENE_ANIMATION_STEP), 'inc');
    h.load(h.read(h.abs(SCENE_COUNTER)));
    h.portWrite(BG2VOFS, ctx.a & BYTE_MASK, 1, 0x81d126);
    h.portWrite(BG2VOFS, 0, 1, 0x81d129);
  }
  h.rep(FLAG_MEMORY_8BIT);
  h.load(h.dp(DP_SPRITE_OFFSET));
  h.asl();
  h.adc(h.dp(DP_SPRITE_OFFSET));
  h.xba();
  h.dpWrite(DP_SPRITE_OFFSET, ctx.a);
  h.load(PORTRAIT_POSITION);
  ctx.status |= FLAG_CARRY;
  h.sbc(h.dp(DP_SPRITE_OFFSET));
  h.write(h.abs(PORTRAIT_ENTRY), ctx.a);
  h.load(PORTRAIT_TILE);
  h.write(h.abs(PORTRAIT_ENTRY + OAM_NAME_BYTE), ctx.a);
  return h.rts();
}
// Original routine $81:D146.
function moveSpriteForward(h) {
  h.load(h.read(h.abs(SCENE_ARGUMENT)));
  h.load(h.ctx.a + 1);
  h.write(h.abs(SCENE_ARGUMENT_MOVED), h.ctx.a);
  h.modify(h.abs(SCENE_COUNTER), 'dec');
  return portrait(h);
}
// Original routine $81:D153.
function moveSpriteBack(h) {
  h.load(h.read(h.abs(SCENE_ARGUMENT)));
  h.load(h.ctx.a - 1);
  h.write(h.abs(SCENE_ARGUMENT_MOVED), h.ctx.a);
  h.modify(h.abs(SCENE_COUNTER), 'inc');
  return portrait(h);
}
function scrollHead(h, base) {
  const { ctx } = h;
  h.load(HEAD_SCROLL_Y);
  ctx.status |= FLAG_CARRY;
  h.sbc(h.dp(DP_SPEED));
  h.sep(FLAG_MEMORY_8BIT);
  h.portWrite(BG2VOFS, ctx.a & BYTE_MASK, 1, base);
  h.portWrite(BG2VOFS, 0, 1, base + STZ_BYTES);
}
function scrollCount(h) {
  h.load(h.dp(DP_SPEED));
  h.ctx.status |= FLAG_CARRY;
  h.sbc(HEAD_LINES_OFFSET);
  if (h.ctx.status & (FLAG_ZERO | FLAG_NEGATIVE)) h.load(1);
  h.write(SCROLL_HDMA, h.ctx.a);
  h.load(0);
  h.write(SCROLL_HDMA + 1, h.ctx.a);
  h.write(SCROLL_HDMA + 2, h.ctx.a);
}
// Original routine $81:D160.
function animateLineScroll(h) {
  const { ctx } = h;
  scrollTerms(h, false);
  h.portWrite(A1T6L, ctx.a, 2, 0x81d189);
  scrollHead(h, 0x81d194);
  h.index('x', D160_LAST_ENTRY);
  scrollCount(h);
  h.write(SCROLL_HDMA + HDMA_ENTRY_BYTES + ctx.x, ctx.a);
  h.rep(FLAG_MEMORY_8BIT);
  do {
    h.load(1);
    h.write(SCROLL_HDMA + ctx.x, ctx.a);
    h.load(h.dp(DP_LINE_SCROLL));
    h.xba();
    h.write(SCROLL_HDMA + 1 + ctx.x, ctx.a);
    h.xba();
    ctx.status &= ~FLAG_CARRY;
    h.adc(h.dp(DP_LINE_STEP));
    h.dpWrite(DP_LINE_SCROLL, ctx.a);
    for (let n = 0; n < HDMA_ENTRY_BYTES; n++) h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_ZERO));
  h.sep(FLAG_MEMORY_8BIT);
  hdmaEnd(h, 0x81d1d9, HDMA_CHANNELS_6_7);
  h.dpWrite(DP_SCROLL_Y, 0);
  return h.rts();
}
function tint(h, value) {
  const { ctx } = h;
  h.load(ctx.a ^ TM_LINE_MASK);
  h.cmp(TM_LINE_HALF);
  h.rol();
  h.load(ctx.a & TM_LINE_MASK);
  h.asl();
  h.index('x', ctx.a);
  h.load(value);
  h.write(SCENE_TM_LINES + ctx.x, ctx.a);
  return h.rts();
}
function alignText(h) {
  const { ctx } = h;
  h.php();
  h.dpWrite(DP_LINE_START, ctx.x, 2);
  h.index('x', TEXT_COLUMNS);
  for (;;) {
    h.load(h.read(h.abs(CREDITS_BUFFER) + ctx.y));
    if (ctx.status & FLAG_ZERO) break;
    h.index('y', ctx.y + 1);
    h.index('x', ctx.x - 1);
  }
  h.rep(FLAG_MEMORY_8BIT);
  h.load(ctx.x);
  h.load(ctx.a & WORD_OFFSET_MASK);
  ctx.status &= ~FLAG_CARRY;
  h.adc(h.dp(DP_LINE_START));
  h.index('x', ctx.a);
  h.plp();
  return h.rts();
}
function drawText(h) {
  const { ctx } = h;
  h.php();
  h.load(0);
  h.xba();
  for (;;) {
    h.load(h.read(h.abs(CREDITS_BUFFER) + ctx.y));
    if (ctx.status & FLAG_ZERO) break;
    ctx.status |= FLAG_CARRY;
    h.sbc(FIRST_CHARACTER);
    h.phx();
    h.asl();
    h.index('x', ctx.a);
    h.load(h.read(WRAM + CHARACTER_MAP + ctx.x));
    h.plx();
    h.write(SCENE_TEXT_MAP + ctx.x, ctx.a);
    h.index('x', ctx.x + 1);
    h.index('x', ctx.x + 1);
    h.index('y', ctx.y + 1);
  }
  h.index('y', ctx.y + 1);
  h.rep(FLAG_MEMORY_8BIT);
  h.load(ctx.x);
  ctx.status &= ~FLAG_CARRY;
  h.adc(TEXT_LINE_BYTES);
  h.load(ctx.a & MAP_ROW_MASK);
  h.index('x', ctx.a);
  h.plp();
  return h.rts();
}
// Original routine $81:D1F0.
function animateCredits(h, e, routines) {
  const { ctx } = h;
  h.write(h.abs(PAD_HELD), 0);
  h.load(TEXT_MAP_VRAM);
  h.portWrite(VMADDL, ctx.a, 2, 0x81d1f6);
  for (const [pc, o, v] of [
    [0x81d1fc, DMAP0, ((VMDATAL & BYTE_MASK) << BYTE_BITS) | DMAP_TWO_PORTS],
    [0x81d202, A1T0L, SCENE_TEXT_MAP & WORD_MASK],
    [0x81d208, DAS0L, MAP_BYTES],
  ]) {
    h.load(v);
    h.portWrite(o, ctx.a, 2, pc);
  }
  h.sep(FLAG_MEMORY_8BIT);
  for (const [pc, o, v] of [
    [0x81d20f, VMAINC, VMAINC_INCREMENT_AFTER_HIGH],
    [0x81d214, A1B0, WRAM_BANK],
    [0x81d219, MDMAEN, 1],
  ]) {
    h.load(v);
    h.portWrite(o, ctx.a & BYTE_MASK, 1, pc);
  }
  h.rep(FLAG_MEMORY_8BIT);
  h.load(h.dp(DP_POSITION));
  for (let n = 0; n < POSITION_SCROLL_SHIFT; n++) h.lsr();
  h.load(ctx.a ^ SCROLL_MIRROR);
  h.dpWrite(DP_LINE_SCROLL, ctx.a);
  h.load(SCROLL_HDMA & WORD_MASK);
  h.portWrite(A1T6L, ctx.a, 2, 0x81d22f);
  scrollHead(h, 0x81d23a);
  scrollCount(h);
  h.load(CREDITS_TEXT_LINES);
  h.write(SCROLL_HDMA + HDMA_ENTRY_BYTES, ctx.a);
  h.rep(FLAG_MEMORY_8BIT);
  h.load(h.dp(DP_LINE_SCROLL));
  h.asl();
  h.write(SCROLL_HDMA + HDMA_ENTRY_BYTES + 1, ctx.a);
  h.load(1);
  h.write(SCROLL_HDMA + 2 * HDMA_ENTRY_BYTES, ctx.a);
  h.load(h.dp(DP_LINE_SCROLL));
  h.write(SCROLL_HDMA + 2 * HDMA_ENTRY_BYTES + 1, ctx.a);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(0);
  h.write(CREDITS_HDMA_END, ctx.a);
  hdmaEnd(h, 0x81d27f, HDMA_CHANNELS_5_7);
  h.dpWrite(DP_SCROLL_Y, 0);
  h.load(h.read(h.abs(SCENE_COUNTER)));
  if (ctx.status & FLAG_ZERO) {
    h.load(CREDITS_PAGE_FRAMES);
    h.write(h.abs(SCENE_COUNTER), ctx.a);
    call(h, e, routines, 0x81d2a0, 0x81d37d);
    h.phb();
    h.push(WRAM_BANK_PAIR, 2);
    h.plb();
    h.plb();
    h.index('y', h.read(h.abs(SCENE_ANIMATION_STEP), 2));
    h.load(h.read(h.abs(CREDITS_BUFFER) + ctx.y));
    h.load(ctx.a & BYTE_MASK);
    if (!(ctx.status & FLAG_ZERO)) {
      h.load(h.read(h.abs(CREDITS_BUFFER) + ctx.y));
      h.dpWrite(DP_LINES, ctx.a);
      h.load(ctx.a & BYTE_MASK);
      h.xba();
      h.lsr();
      h.lsr();
      h.load(ctx.a ^ WORD_MASK);
      ctx.status |= FLAG_CARRY;
      h.adc(CREDITS_CENTRE);
      h.index('x', ctx.a);
      h.index('y', ctx.y + 1);
      h.sep(FLAG_MEMORY_8BIT);
      do {
        h.phy();
        h.call(0x81d2cd, 0x81d336, () => alignText(h));
        h.ply();
        h.call(0x81d2d1, 0x81d351, () => drawText(h));
        h.modify(DP_LINES, 'dec', true);
      } while (!(ctx.status & FLAG_ZERO));
      h.write(h.abs(SCENE_ANIMATION_STEP), ctx.y, 2);
    }
    h.rep(FLAG_MEMORY_8BIT);
    h.plb();
    return h.rts();
  }
  h.modify(h.abs(SCENE_COUNTER), 'dec');
  h.load(h.read(h.abs(SCENE_COUNTER)));
  h.cmp(CREDITS_FADE_IN_END);
  if (ctx.status & FLAG_CARRY) {
    h.sbc(CREDITS_FADE_IN_END);
    h.pha();
    h.call(0x81d2ee, 0x81d2fb, () => tint(h, TM_LINE_WITH_BG3));
    h.pla();
    ctx.status &= ~FLAG_CARRY;
    h.adc(TINT_SECOND_LINE);
    h.cmp(TM_LINES);
    if (ctx.status & FLAG_CARRY) return tint(h, TM_LINE_WITH_BG3);
    return h.rts();
  }
  h.cmp(TM_LINES);
  if (ctx.status & FLAG_CARRY) return h.rts();
  h.pha();
  h.call(0x81d315, 0x81d322, () => tint(h, TM_LINE));
  h.pla();
  ctx.status &= ~FLAG_CARRY;
  h.adc(TINT_SECOND_LINE);
  h.cmp(TM_LINES);
  if (!(ctx.status & FLAG_CARRY)) return h.rts();
  return tint(h, TM_LINE);
}
