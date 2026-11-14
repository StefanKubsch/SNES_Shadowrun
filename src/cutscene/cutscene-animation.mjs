// Cutscene animation (lifted from 81:CF72-D336 and 81:D37D-D4E8; register-level
// reference in proof/cutscene-reference/). Each cutscene runs one animation per
// frame (table scene_animation_calls): an engine sound with shaking sprites, a
// sound with a rising pitch over a per-line BG2 scroll, a line scroll alone, a
// sprite that moves forward or back, or the credits pages.
//
// The scene state lives in the direct page, where the NMI callback 81:D479 reads
// it: BG1 scroll (14), BG2 speed (16), its step (18) and target (1A), the BG2
// position (1C, scroll times 128) and the scene (1E, negative: mirrored).
import { taskStop } from '../task/plan.mjs';
import { decodeOnce, tableEntries } from '../data/named-tables.mjs';
import {
  DP_CUTSCENE_POSITION as DP_POSITION,
  DP_CUTSCENE_SCENE as DP_SCENE,
  DP_CUTSCENE_SCROLL_Y as DP_SCROLL_Y,
  DP_CUTSCENE_SPEED as DP_SPEED,
  OAM_SHADOW,
  OAM_SHADOW_HIGH,
  PAD_HELD,
  RANDOM_STATE,
  SCENE_ANIMATION_STEP,
  SCENE_ARGUMENT,
  SCENE_ARGUMENT_MOVED,
  SCENE_COUNTER,
  SCENE_LAYER_HIGH,
  WRAM,
} from '../task/wram.mjs';
import {
  A1B0,
  A1B5,
  A1B6,
  A1T0L,
  A1T5L,
  A1T6L,
  BBAD5,
  BBAD6,
  BG2HOFS,
  BG2VOFS,
  DAS0L,
  DMAP0,
  DMAP5,
  DMAP6,
  HDMAEN,
  MDMAEN,
  TM,
  VMADDL,
  VMAINC,
  VMDATAL,
} from '../constants/hardware-registers.mjs';
import {
  DMAP_TWO_PORTS,
  DMAP_WRITE_TWICE,
  LAYER_BG1,
  LAYER_BG2,
  LAYER_BG3,
  LAYER_OBJ,
  OAM_HIGH_ALL_LARGE,
  OAM_NAME_BYTE,
  TILE_H_FLIP,
  TILE_PRIORITY,
  VMAINC_INCREMENT_AFTER_HIGH,
} from '../constants/ppu.mjs';
import {
  APU_COMMAND_SOUND_VOICES,
  APU_COMMAND_SOUND_VOLUME,
  APU_COMMAND_VOICE_PITCH,
} from '../constants/sound-commands.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  NIBBLE_BITS,
  NIBBLE_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';

const WRAM_BANK = WRAM >>> WORD_BITS,
  ANIMATION_BANK = 0x810000;
// Scene buffers in bank 7E: the picture map (also the H-DMA table of channel 6 that
// scrolls BG2 per line, three bytes an entry), the 32 by 32 text map after it, the
// credits text and its character map, and the TM H-DMA table of 81:D37D (main
// layers for 76 lines, then 64 single lines, two bytes an entry).
export const SCENE_PICTURE = WRAM + SCENE_LAYER_HIGH,
  SCENE_TEXT_MAP = 0x7e4ea8,
  MAP_BYTES = 0x800,
  CREDITS_BUFFER = 0x62a8,
  CHARACTER_MAP = 0x56a8,
  SCENE_LAYERS = LAYER_BG1 | LAYER_BG2 | LAYER_OBJ,
  SCENE_TM_HDMA = 0x7e5ea8;
const SCENE_TM_LINES = SCENE_TM_HDMA + 2,
  SCROLL_HDMA = SCENE_PICTURE,
  HDMA_ENTRY_BYTES = 3,
  TM_TOP_LINES = 0x4c,
  TM_LINE_PAIRS_LAST = 0x7e,
  TM_LINES = 0x40,
  TM_LINE_MASK = TM_LINES - 1,
  TM_LINE_HALF = 0x20,
  TM_LINE = (SCENE_LAYERS << BYTE_BITS) | 1,
  TM_LINE_WITH_BG3 = ((SCENE_LAYERS | LAYER_BG3) << BYTE_BITS) | 1;
// The BG2 position is the scroll times 128; a mirrored scene scrolls the other way.
const POSITION_SCROLL_SHIFT = 7,
  SCROLL_MIRROR = 0x1ff;
// H-DMA of BG2HOFS (written twice per line) from bank 7E on channel 6, with 7 or 5 and 7.
const HDMA_CHANNELS_6_7 = 0xc0,
  HDMA_CHANNELS_5_7 = 0xe0;
// Line scroll: an 8.8 scroll and its step per line (the position, plus 3F00 for the
// pitch scene, divided by 16). The line scroll scene fills 45 entries; the scenes
// start with BG2 scrolled up by 8 - speed for speed - 6 lines (at least 1).
const LINE_STEP_BIAS = 0x3f00,
  HEAD_SCROLL_Y = 8,
  HEAD_LINES_OFFSET = 6,
  LINE_SCROLL_LAST_ENTRY = 0x87;
// Engine scene 81:CFCC: on frames with the low three counter bits clear, sound 0D on
// voices 0 and 1, both volume nibbles from bits 6-9 of the speed; the sprites shake
// by 8 displacement steps (mask 3).
const ENGINE_SOUND_FRAMES_MASK = 7,
  ENGINE_VOICES = 3,
  SPEED_VOLUME_BITS = 0x3c0,
  ENGINE_SOUND = 13,
  ENGINE_STEP_SHIFT = 11,
  ENGINE_STEPS_MASK = 7,
  ENGINE_DISPLACEMENT_MASK = 3;
// Pitch scene 81:D02A: sound 27 on voice 0 with volume nibbles 4 and 4, then the pitch
// 264 + 16 per displacement step (16 steps, mask 7); BG2 scrolled to 50, a first
// H-DMA entry of 67 lines, then 60 single lines.
const PITCH_VOICES = 1,
  PITCH_SOUND = 0x4427,
  PITCH_BASE = 0x264,
  PITCH_STEPS_MASK = 15,
  PITCH_DISPLACEMENT_MASK = 7,
  PITCH_BG2_SCROLL_Y = 0x50,
  PITCH_TOP_LINES = 0x67,
  PITCH_LINES = 0x3c;
// Portrait 81:D11A: a sprite (OAM entry 7, character 08, priority 3) at Y 8A, X AF
// minus 3/256 of the argument; for 128 frames it takes SCENE_ARGUMENT, then
// SCENE_ARGUMENT_MOVED.
const PORTRAIT_STEPS = 0x80,
  PORTRAIT_POSITION = 0x8aaf,
  PORTRAIT_ENTRY = OAM_SHADOW + 0x1c,
  PORTRAIT_TILE = 0x3008;
// Credits 81:D1F0: the text map goes to VRAM 0800 by DMA; a page stays 500 frames;
// its lines (32 columns, characters from 20 through 7E:56A8) are centred around
// map offset 380, two map rows (80 bytes) apart. During the first 64 frames
// (counter from 1F4 down to 1B4) and the last 64 the TM lines add BG3, the second
// line 23 behind; the BG2 line scroll has a 40-line entry.
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
  LINES_SHIFT = 6,
  CREDITS_HDMA_ENTRIES = 3;
// Sprites 81:D4E8: two OBJ parts (scene_sprite_parts: offset word, picture word each),
// mirrored for a negative scene (X C0 - base, the H flip); both sprites large.
const SCENE_MIRROR_X = 0xc0,
  SPRITE_PARTS = 2,
  SPRITE_ENTRY_BYTES = 4;
// The mirrored picture 81:CF79: the 30 rows of 32 words swap their halves with the H
// flip; 780 bytes go to VRAM 0000.
const PICTURE_ROWS = 0x1e,
  ROW_BYTES = 0x40,
  HALF_ROW_WORDS = 0x10,
  ROW_MIRROR = 0x3e,
  PICTURE_BYTES = 0x780;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const longWord = (mem, address) => mem.read8(address) | (mem.read8(address + 1) << BYTE_BITS);
const setLongWord = (mem, address, value) => {
  mem.write8(address, value & BYTE_MASK);
  mem.write8(address + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
const swap = (value) => ((value << BYTE_BITS) | (value >>> BYTE_BITS)) & WORD_MASK;

// Scene tables of bank 81 by name (src/data/tables.mjs); a scene index outside a
// table stops at the frontier.
export const cutsceneTables = (mem) =>
  decodeOnce(mem, 'cutscene', (image) => {
    const tables = {};
    for (const [key, name] of [
      ['audioModes', 'scene_audio_modes'],
      ['sounds', 'scene_sounds'],
      ['targets', 'scene_targets'],
      ['steps', 'scene_steps'],
      ['endSteps', 'scene_end_steps'],
      ['frames', 'scene_frames'],
      ['endFrames', 'scene_end_frames'],
      ['spriteBases', 'scene_sprite_bases'],
      ['animationCalls', 'scene_animation_calls'],
      ['windowHdma', 'scene_window_hdma'],
      ['engineDisplacements', 'scene_displacements_d022'],
      ['pitchDisplacements', 'scene_displacements_d0fd'],
      ['spriteParts', 'scene_sprite_parts'],
    ]) {
      const values = tableEntries(image, name);
      tables[key] = (index) => {
        const value = values[index];
        if (value === undefined) taskStop('cutscene_table_index_frontier', { table: name, index });
        return value;
      };
    }
    return Object.freeze(tables);
  });
// The scene number without the mirror bit, the index of the scene tables.
export const sceneIndex = (wram) => ((word(wram, DP_SCENE) << 1) & WORD_MASK) >>> 1;
const mirrored = (wram) => (word(wram, DP_SCENE) & WORD_SIGN) !== 0;

// Fill the text map with the priority tile 0 and set up the TM H-DMA (81:D37D).
export function fillTextMap(m) {
  const { mem, video } = m;
  for (let at = MAP_BYTES - 2; at >= 0; at -= 2)
    setLongWord(mem, SCENE_TEXT_MAP + at, TILE_PRIORITY);
  setLongWord(mem, SCENE_TM_HDMA, (SCENE_LAYERS << BYTE_BITS) | TM_TOP_LINES);
  setLongWord(mem, SCENE_TM_LINES + 2 + TM_LINE_PAIRS_LAST, 0);
  for (let at = TM_LINE_PAIRS_LAST; at >= 0; at -= 2)
    setLongWord(mem, SCENE_TM_LINES + at, TM_LINE);
  video.write(A1T5L, SCENE_TM_HDMA & WORD_MASK, 2);
  video.write(DMAP5, 0, 1);
  video.write(BBAD5, TM & BYTE_MASK, 1);
  video.write(A1B5, SCENE_TM_HDMA >>> WORD_BITS, 1);
}

// The two sprites of the scene at base (X in the low byte, Y in the high byte) (81:D4E8).
export function drawSprites(m, base) {
  const { mem, wram } = m,
    t = cutsceneTables(mem);
  let x = base,
    flip = 0;
  if (mirrored(wram)) {
    flip = TILE_H_FLIP;
    // Only the low byte is mirrored.
    x = (x & ~BYTE_MASK) | ((SCENE_MIRROR_X - x) & BYTE_MASK);
  }
  for (let part = SPRITE_PARTS - 1; part >= 0; part--) {
    let offset = t.spriteParts(part * 2);
    if (mirrored(wram)) offset = ((offset ^ BYTE_MASK) + 1) & WORD_MASK;
    setWord(wram, OAM_SHADOW + part * SPRITE_ENTRY_BYTES, offset + x);
    setWord(wram, OAM_SHADOW + part * SPRITE_ENTRY_BYTES + 2, t.spriteParts(part * 2 + 1) ^ flip);
  }
  setWord(wram, OAM_SHADOW_HIGH, OAM_HIGH_ALL_LARGE & NIBBLE_MASK);
}

// Swap the halves of every picture row with the H flip and send the picture to VRAM
// 0000 (81:CF79).
export function sendMirroredPicture(m) {
  const { mem, video } = m;
  for (let row = PICTURE_ROWS - 1; row >= 0; row--)
    for (let n = 0, at = row * ROW_BYTES; n < HALF_ROW_WORDS; n++, at += 2) {
      const left = longWord(mem, SCENE_PICTURE + at) ^ TILE_H_FLIP,
        mirror = at ^ ROW_MIRROR,
        right = longWord(mem, SCENE_PICTURE + mirror) ^ TILE_H_FLIP;
      setLongWord(mem, SCENE_PICTURE + mirror, left);
      setLongWord(mem, SCENE_PICTURE + at, right);
    }
  const words = [];
  for (let at = 0; at < PICTURE_BYTES; at += 2) words.push(longWord(mem, SCENE_PICTURE + at));
  video.setVramWords(0, words);
}

// The sprites shaken by the displacement step of a table; the displacement also
// scrolls BG1 (shared by the engine and the pitch scene).
function shake(m, table, mask, step) {
  const { wram } = m,
    displacement = table(step) & mask,
    base =
      (((-displacement & BYTE_MASK) << BYTE_BITS) +
        cutsceneTables(m.mem).spriteBases(sceneIndex(wram))) &
      WORD_MASK;
  drawSprites(m, base);
  setWord(wram, DP_SCROLL_Y, displacement);
  return displacement;
}
// The H-DMA line scroll terms: the scroll of the first line and the step per line.
function lineScrollTerms(wram, bias) {
  const position = word(wram, DP_POSITION);
  let scroll = position >>> POSITION_SCROLL_SHIFT,
    step = ((position + bias) & WORD_MASK) >>> NIBBLE_BITS;
  if (mirrored(wram)) {
    scroll ^= SCROLL_MIRROR;
    step = -step & WORD_MASK;
  }
  return { scroll: (scroll & BYTE_MASK) << BYTE_BITS, step };
}
function enableLineScroll(video, channels) {
  video.write(DMAP6, DMAP_WRITE_TWICE, 1);
  video.write(BBAD6, BG2HOFS & BYTE_MASK, 1);
  video.write(A1B6, WRAM_BANK, 1);
  video.write(HDMAEN, channels, 1);
}
// BG2 scrolled up by 8 - speed, and the first H-DMA entry of speed - 6 lines.
function scrollHead(m) {
  const { mem, wram, video } = m,
    speed = word(wram, DP_SPEED);
  video.write(BG2VOFS, (HEAD_SCROLL_Y - speed) & BYTE_MASK, 1);
  video.write(BG2VOFS, 0, 1);
  let lines = (speed - HEAD_LINES_OFFSET) & BYTE_MASK;
  if (lines === 0 || lines & 0x80) lines = 1; // magic-number-ok: bit 7, the sign of the 8-bit count
  mem.write8(SCROLL_HDMA, lines);
  mem.write8(SCROLL_HDMA + 1, 0);
  mem.write8(SCROLL_HDMA + 2, 0);
}

// 81:CFCC: engine sound and shaking sprites.
function animateEngine(m) {
  const { wram } = m;
  if ((word(wram, RANDOM_STATE) & ENGINE_SOUND_FRAMES_MASK) === 0) {
    m.sound(APU_COMMAND_SOUND_VOICES, ENGINE_VOICES);
    const speed = word(wram, DP_SPEED),
      levels = ((((speed & SPEED_VOLUME_BITS) << NIBBLE_BITS) & WORD_MASK) | speed) << 2,
      // The second shift's carry goes into the sum.
      carry = (levels >>> WORD_BITS) & 1;
    m.sound(APU_COMMAND_SOUND_VOLUME, ((levels & 0xff00) + ENGINE_SOUND + carry) & WORD_MASK); // magic-number-ok: the high byte
  }
  const step = (word(wram, DP_POSITION) >>> ENGINE_STEP_SHIFT) & ENGINE_STEPS_MASK;
  shake(m, cutsceneTables(m.mem).engineDisplacements, ENGINE_DISPLACEMENT_MASK, step);
}
// 81:D02A: a sound whose pitch follows the shaking, over the per-line BG2 scroll.
function animatePitch(m) {
  const { mem, wram, video } = m;
  m.sound(APU_COMMAND_SOUND_VOICES, PITCH_VOICES);
  m.sound(APU_COMMAND_SOUND_VOLUME, PITCH_SOUND);
  const terms = lineScrollTerms(wram, LINE_STEP_BIAS);
  video.write(A1T6L, SCROLL_HDMA & WORD_MASK, 2);
  video.write(BG2VOFS, PITCH_BG2_SCROLL_Y, 1);
  video.write(BG2VOFS, 0, 1);
  mem.write8(SCROLL_HDMA, PITCH_TOP_LINES);
  mem.write8(SCROLL_HDMA + 1, terms.scroll >>> BYTE_BITS);
  mem.write8(SCROLL_HDMA + 2, 0);
  let scroll = terms.scroll,
    at = 0;
  for (let n = 0; n < PITCH_LINES; n++, at += HDMA_ENTRY_BYTES) {
    setLongWord(mem, SCROLL_HDMA + HDMA_ENTRY_BYTES + at, 1);
    scroll = (scroll + terms.step) & WORD_MASK;
    setLongWord(mem, SCROLL_HDMA + HDMA_ENTRY_BYTES + 1 + at, swap(scroll));
  }
  // The end mark lands one entry behind the next free one, as in the original.
  mem.write8(SCROLL_HDMA + 2 * HDMA_ENTRY_BYTES + at, 0);
  enableLineScroll(video, HDMA_CHANNELS_6_7);
  const step = (word(wram, DP_POSITION) >>> BYTE_BITS) & PITCH_STEPS_MASK,
    displacement = shake(m, cutsceneTables(mem).pitchDisplacements, PITCH_DISPLACEMENT_MASK, step);
  m.sound(APU_COMMAND_VOICE_PITCH, ((displacement << NIBBLE_BITS) + PITCH_BASE) & WORD_MASK);
}
// 81:D160: the per-line BG2 scroll alone.
function animateLineScroll(m) {
  const { mem, wram, video } = m,
    terms = lineScrollTerms(wram, 0);
  video.write(A1T6L, SCROLL_HDMA & WORD_MASK, 2);
  scrollHead(m);
  mem.write8(SCROLL_HDMA + HDMA_ENTRY_BYTES + LINE_SCROLL_LAST_ENTRY, 0);
  let scroll = terms.scroll;
  for (let at = LINE_SCROLL_LAST_ENTRY; at !== 0; at -= HDMA_ENTRY_BYTES) {
    setLongWord(mem, SCROLL_HDMA + at, 1);
    setLongWord(mem, SCROLL_HDMA + 1 + at, swap(scroll));
    scroll = (scroll + terms.step) & WORD_MASK;
  }
  enableLineScroll(video, HDMA_CHANNELS_6_7);
  setWord(wram, DP_SCROLL_Y, 0);
}
// 81:D11A: the portrait sprite; for its first 128 frames BG2 follows the counter.
function drawPortrait(m) {
  const { wram, video } = m;
  let offset = word(wram, SCENE_ARGUMENT_MOVED);
  if (wram[SCENE_ANIMATION_STEP] !== PORTRAIT_STEPS) {
    // Only the low byte of the argument replaces the offset.
    offset = (offset & ~BYTE_MASK) | wram[SCENE_ARGUMENT];
    wram[SCENE_ANIMATION_STEP] = (wram[SCENE_ANIMATION_STEP] + 1) & BYTE_MASK;
    video.write(BG2VOFS, wram[SCENE_COUNTER], 1);
    video.write(BG2VOFS, 0, 1);
  }
  // Three times the offset (the shift's carry included), in 1/256.
  const triple = ((offset << 1) & WORD_MASK) + offset + ((offset >>> (WORD_BITS - 1)) & 1);
  setWord(wram, PORTRAIT_ENTRY, (PORTRAIT_POSITION - swap(triple & WORD_MASK)) & WORD_MASK);
  setWord(wram, PORTRAIT_ENTRY + OAM_NAME_BYTE, PORTRAIT_TILE);
}
// 81:D146 and 81:D153: the portrait moves forward or back by one.
function movePortrait(m, delta) {
  const { wram } = m;
  setWord(wram, SCENE_ARGUMENT_MOVED, (word(wram, SCENE_ARGUMENT) + delta) & WORD_MASK);
  setWord(wram, SCENE_COUNTER, (word(wram, SCENE_COUNTER) - delta) & WORD_MASK);
  drawPortrait(m);
}

// A TM H-DMA line of the credits fade: value at the line for the count in the low six
// bits, counted from the middle outwards (81:D2FB).
function tint(mem, count, value) {
  const flipped = (count ^ TM_LINE_MASK) & WORD_MASK,
    carry = flipped >= TM_LINE_HALF ? 1 : 0,
    line = (((flipped << 1) | carry) & TM_LINE_MASK) << 1;
  setLongWord(mem, SCENE_TM_LINES + line, value);
}
// A credits text line: its characters (from the character map) centred in the
// 32 columns from start. Returns the next text offset and the next line start
// (81:D336 and 81:D351).
function drawCreditsLine(mem, text, start) {
  // Absolute indexed reads: the offset may run on into bank 7F.
  const textByte = (offset) => mem.read8(WRAM + CREDITS_BUFFER + offset);
  let columns = TEXT_COLUMNS,
    end = text;
  while (textByte(end) !== 0) {
    end = (end + 1) & WORD_MASK;
    columns = (columns - 1) & WORD_MASK;
  }
  let at = ((columns & WORD_OFFSET_MASK) + start) & WORD_MASK,
    offset = text;
  for (let c = textByte(offset); c !== 0; c = textByte(offset)) {
    // The character's map byte replaces the low byte of the tile word only.
    const index = ((c - FIRST_CHARACTER) << 1) & BYTE_MASK;
    mem.write8((SCENE_TEXT_MAP + at) & 0xffffff, mem.read8(WRAM + CHARACTER_MAP + index)); // magic-number-ok: 24-bit address mask
    at = (at + 2) & WORD_MASK;
    offset = (offset + 1) & WORD_MASK;
  }
  return {
    text: (offset + 1) & WORD_MASK,
    start: (at + TEXT_LINE_BYTES) & MAP_ROW_MASK & WORD_MASK,
  };
}
// 81:D1F0: the credits pages with their BG3 fade lines.
function animateCredits(m) {
  const { mem, wram, video } = m;
  setWord(wram, PAD_HELD, 0);
  video.write(VMADDL, TEXT_MAP_VRAM, 2);
  // DMAP0 and BBAD0 in one word write.
  video.write(DMAP0, ((VMDATAL & BYTE_MASK) << BYTE_BITS) | DMAP_TWO_PORTS, 2);
  video.write(A1T0L, SCENE_TEXT_MAP & WORD_MASK, 2);
  video.write(DAS0L, MAP_BYTES, 2);
  video.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1);
  video.write(A1B0, WRAM_BANK, 1);
  video.write(MDMAEN, 1, 1);
  const scroll = (word(wram, DP_POSITION) >>> POSITION_SCROLL_SHIFT) ^ SCROLL_MIRROR;
  video.write(A1T6L, SCROLL_HDMA & WORD_MASK, 2);
  scrollHead(m);
  mem.write8(SCROLL_HDMA + HDMA_ENTRY_BYTES, CREDITS_TEXT_LINES);
  setLongWord(mem, SCROLL_HDMA + HDMA_ENTRY_BYTES + 1, (scroll << 1) & WORD_MASK);
  setLongWord(mem, SCROLL_HDMA + 2 * HDMA_ENTRY_BYTES, 1);
  setLongWord(mem, SCROLL_HDMA + 2 * HDMA_ENTRY_BYTES + 1, scroll);
  mem.write8(SCROLL_HDMA + CREDITS_HDMA_ENTRIES * HDMA_ENTRY_BYTES, 0);
  enableLineScroll(video, HDMA_CHANNELS_5_7);
  setWord(wram, DP_SCROLL_Y, 0);
  if (word(wram, SCENE_COUNTER) === 0) {
    // A new page: its line count, then the lines centred around map offset 380.
    setWord(wram, SCENE_COUNTER, CREDITS_PAGE_FRAMES);
    fillTextMap(m);
    let text = word(wram, SCENE_ANIMATION_STEP);
    const header = longWord(mem, WRAM + CREDITS_BUFFER + text);
    if ((header & BYTE_MASK) === 0) return;
    let lines = header & BYTE_MASK,
      start = (CREDITS_CENTRE - (lines << LINES_SHIFT)) & WORD_MASK;
    text = (text + 1) & WORD_MASK;
    do {
      ({ text, start } = drawCreditsLine(mem, text, start));
      lines = (lines - 1) & BYTE_MASK;
    } while (lines !== 0);
    setWord(wram, SCENE_ANIMATION_STEP, text);
    return;
  }
  const counter = (word(wram, SCENE_COUNTER) - 1) & WORD_MASK;
  setWord(wram, SCENE_COUNTER, counter);
  if (counter >= CREDITS_FADE_IN_END) {
    const count = counter - CREDITS_FADE_IN_END;
    tint(mem, count, TM_LINE_WITH_BG3);
    if (((count + TINT_SECOND_LINE) & WORD_MASK) >= TM_LINES)
      tint(mem, (count + TINT_SECOND_LINE) & WORD_MASK, TM_LINE_WITH_BG3);
    return;
  }
  if (counter >= TM_LINES) return;
  tint(mem, counter, TM_LINE);
  if (((counter + TINT_SECOND_LINE) & WORD_MASK) >= TM_LINES)
    tint(mem, (counter + TINT_SECOND_LINE) & WORD_MASK, TM_LINE);
}

const ANIMATIONS = new Map([
  [0xcfcc, animateEngine],
  [0xd02a, animatePitch],
  [0xd160, animateLineScroll],
  [0xd146, (m) => movePortrait(m, 1)],
  [0xd153, (m) => movePortrait(m, -1)],
  [0xd1f0, animateCredits],
]);
// Run the animation of the current scene (81:CF72, table scene_animation_calls).
export function animateCutscene(m) {
  const handler = cutsceneTables(m.mem).animationCalls(sceneIndex(m.wram)),
    run = ANIMATIONS.get(handler);
  if (!run)
    taskStop('main_scene_animation_frontier', { pc: 0x81cf76, target: ANIMATION_BANK | handler });
  run(m);
}
