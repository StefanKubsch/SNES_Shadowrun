// Intro and title objects (lifted from 81:E8E5, 81:DC43, 81:E900, 81:E971, 81:E83A,
// the NMI drawing of 81:DF0E and 81:D9D5 and the frame step of 81:DFE7;
// register-level reference in proof/intro-reference/ and proof/frontend-reference/).
//
// Intro and title show up to sixteen objects in two lists of eight slots (near and
// far), each with an animation offset into a frame list (negative: the slot is free),
// X and Y. The intro NMI draws nine of them (the near slots and the first far slot)
// from intro_frames_df77; every frame the intro adds near objects with a sound
// panned by their X, keeps one object looping, and moves the far object up and left.
// The title pan draws both lists from intro_frames, scrolled by a quarter (near) and
// an eighth (far) of the title position, and adds objects when the frame counter
// reaches the times of its event lists.
import { taskStop } from '../task/plan.mjs';
import { decodeOnce, tableEntries } from '../data/named-tables.mjs';
import { readJoypad } from '../system/joypad.mjs';
import {
  FRONTEND_FRAME_COUNTER,
  INTRO_FAR_ANIMATIONS,
  INTRO_FAR_EVENT,
  INTRO_FAR_X,
  INTRO_FAR_Y,
  INTRO_NEAR_ANIMATIONS,
  INTRO_NEAR_EVENT,
  INTRO_NEAR_X,
  INTRO_NEAR_Y,
  INTRO_OBJECTS_BYTES,
  OAM_SHADOW,
  OAM_SHADOW_HIGH,
  PAD_HELD,
  WRAM,
} from '../task/wram.mjs';
import {
  OAM_BYTES,
  OAM_ENTRY_BYTES,
  OAM_HIGH_TABLE_BYTES,
  OAM_LOW_TABLE_BYTES,
  OAM_NAME_BYTE,
  OAM_PRIORITY_2,
  SCREEN_WIDTH,
  TILE_SIZE,
} from '../constants/ppu.mjs';
import { APU_COMMAND_SOUND_VOLUME } from '../constants/sound-commands.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

// Slots: eight per list, a word each; the NMI draws slots 0-8, so slot 8 is the
// first far slot (the lists lie next to each other).
const SLOTS = 8,
  DRAWN_SLOTS = 9,
  FREE = WORD_MASK;
// Animations step by one frame word. A frame word FFFE restarts at FRAME_RESTART;
// another negative word ends the animation (the slot becomes free).
const FRAME_STEP = 2,
  FRAME_RESTART_WORD = 0xfffe;
export const INTRO_FRAME_RESTART = 0x36,
  INTRO_FAR_ANIMATION = 0x28;
// The first near objects (81:DC43, intro_spawns): animation offset plus 3C, X and Y
// stored halved, Y raised by NEAR_Y_BIAS (as for every near object the intro adds).
const SPAWN_ANIMATION_BIAS = 0x3c,
  SPAWN_ENTRY_WORDS = 3,
  NEAR_Y_BIAS = 0x38;
// The NMI animates on every fourth frame; slot 2 draws with palette 1.
const ANIMATION_PERIOD_MASK = 3,
  NEAR_ATTRIBUTES = OAM_PRIORITY_2 << BYTE_BITS,
  LIT_SLOT = 2,
  LIT_ATTRIBUTES = NEAR_ATTRIBUTES | 0x200; // palette 1
// The title pan: far objects with priority 1 and palette 1, animated every eighth
// frame; near animations restart at PAN_FRAME_RESTART. Its events (three words: the
// frame, X and Y twice their value) start far objects lower by FAR_Y_BIAS.
const FAR_ATTRIBUTES = 0x1200,
  FAR_ANIMATION_PERIOD_MASK = 7,
  PAN_FRAME_RESTART = 0x3c,
  NEAR_SCROLL_SHIFT = 2,
  FAR_SCROLL_SHIFT = 3,
  EVENT_BYTES = 6,
  FAR_Y_BIAS = 0x35;
// The sprite grid (81:E83A): the attribute bits 9-15 come from the caller; the
// character steps by one per column and by a sheet row of sixteen per row. An X
// of 256 or more (or negative) sets the object's X bit 8 in the high table.
const ATTRIBUTES_MASK = 0xfe00,
  SHEET_ROW_CHARACTERS = 0x10,
  HIGH_TABLE_SLOTS = 4,
  OAM_HIDDEN = 0xf0ff;
// A near object's sound (81:E900): the level by slot pair, the left/right levels by
// screen column (sixteen of 32 pixels, centred by PAN_BIAS).
const SOUND_SLOT_MASK = 3,
  PAN_BIAS = 0x40,
  PAN_SHIFT = 5,
  PAN_STEP_MASK = 15;
// The frame step: until frame 100 a near object every eight frames (positions
// intro_e900_x/y by frame) while slot 2 stays free; from then on slot 2 loops
// animation 1A at 64/63 and the far object departs, its step growing with the
// frames past 46 (8.8 fixed point, the second far slot holding the fractions).
const SPAWN_FRAMES = 0x64,
  SPAWN_PERIOD_MASK = 7,
  SPAWN_SHIFT = 3,
  SPAWN_POSITIONS_MASK = 7,
  LOOP_SLOT = 2,
  LOOP_ANIMATION = 0x1a,
  LOOP_X = 0x64,
  LOOP_Y = 0x63,
  DEPARTURE_FRAME = 0x46,
  FAR_FRACTION_SLOT = 1;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const swap = (value) => ((value << BYTE_BITS) | (value >>> BYTE_BITS)) & WORD_MASK;
// The words of a slot: near slots 0-7, far slots 8-15.
const slotAt = (list, slot) => list + slot * 2;

// The intro tables of banks 81 by name (src/data/tables.mjs); an index outside a
// table stops at the frontier.
export const introTables = (mem) =>
  decodeOnce(mem, 'intro', (image) => {
    const tables = {};
    for (const [key, name] of [
      ['characters', 'intro_sprite_tiles'],
      ['columns', 'intro_sprite_columns'],
      ['rows', 'intro_sprite_rows'],
      ['left', 'intro_sprite_x'],
      ['top', 'intro_sprite_y'],
      ['frames', 'intro_frames_df77'],
      ['panFrames', 'intro_frames'],
      ['nearEvents', 'intro_events_e900'],
      ['farEvents', 'intro_events_e971'],
      ['spawns', 'intro_spawns'],
      ['spawnX', 'intro_e900_x'],
      ['spawnY', 'intro_e900_y'],
      ['soundLevels', 'intro_sound_voices'],
      ['soundPans', 'intro_sound_pans'],
      ['oamXBits', 'intro_oam_x_bits'],
      ['unpacks', 'intro_unpacks'],
      ['windowHdma', 'intro_window_hdma'],
    ]) {
      const values = tableEntries(image, name);
      tables[key] = (index) => {
        const value = values[index];
        if (value === undefined) taskStop('intro_table_index_frontier', { table: name, index });
        return value;
      };
    }
    return Object.freeze(tables);
  });
// The frame word of an animation offset (a byte offset into the frame list).
const frameAt = (t, offset, list = 'frames') => {
  if (offset & 1) taskStop('intro_table_index_frontier', { table: list, offset });
  return t[list](offset >>> 1);
};

// Free every slot and restart the spawn lists and the frame counter (81:E8E5).
export function clearIntroObjects(wram) {
  for (let at = 0; at < INTRO_OBJECTS_BYTES; at += 2)
    setWord(wram, INTRO_NEAR_ANIMATIONS + at, FREE);
  for (const at of [INTRO_NEAR_EVENT, INTRO_FAR_EVENT, FRONTEND_FRAME_COUNTER])
    setWord(wram, at, 0);
}

// Place the first near objects from intro_spawns (81:DC43), up to a negative word.
export function placeFirstNearObjects(m) {
  const { wram } = m,
    t = introTables(m.mem);
  for (let slot = 0; ; slot++) {
    const at = slot * SPAWN_ENTRY_WORDS,
      animation = t.spawns(at);
    if (animation & WORD_SIGN) return;
    setWord(wram, slotAt(INTRO_NEAR_ANIMATIONS, slot), animation + SPAWN_ANIMATION_BIAS);
    setWord(wram, slotAt(INTRO_NEAR_X, slot), t.spawns(at + 1) >>> 1);
    setWord(wram, slotAt(INTRO_NEAR_Y, slot), (t.spawns(at + 2) >>> 1) + NEAR_Y_BIAS);
  }
}

// Add a near object at x, y in the last free near slot with its sound, panned by
// x minus scroll (81:E900); without a free slot nothing happens.
export function addNearObject(m, x, y, scroll) {
  const { wram } = m,
    t = introTables(m.mem);
  let slot = SLOTS - 1;
  while (!(word(wram, slotAt(INTRO_NEAR_ANIMATIONS, slot)) & WORD_SIGN)) if (--slot < 0) return;
  setWord(wram, slotAt(INTRO_NEAR_ANIMATIONS, slot), 0);
  setWord(wram, slotAt(INTRO_NEAR_Y, slot), y);
  setWord(wram, slotAt(INTRO_NEAR_X, slot), x);
  const column = ((((x - scroll) & WORD_MASK) + PAN_BIAS) & WORD_MASK) >>> PAN_SHIFT;
  m.sound(
    APU_COMMAND_SOUND_VOLUME,
    t.soundPans(column & PAN_STEP_MASK) | t.soundLevels(slot & SOUND_SLOT_MASK),
  );
}

// Draw sprite picture as a grid of 8x8 objects with its top left corner offset from
// x, y (81:E83A), from OAM byte offset at with the attribute bits of attributes.
// A grid not on screen horizontally is skipped. Returns the next OAM offset.
//
// As in the original, the X bit 8 goes to the high table byte of the offset's low
// byte: objects 64-127 set the bits of objects 0-63. The intro draws fewer.
export function drawSpriteGrid(m, picture, x, y, attributes, at) {
  const { wram } = m,
    t = introTables(m.mem),
    columns = t.columns(picture),
    width = (columns * TILE_SIZE) & WORD_MASK,
    left = (x - t.left(picture)) & WORD_MASK;
  if (((left + width) & WORD_MASK) >= ((width + SCREEN_WIDTH) & WORD_MASK)) return at;
  let top = (y - t.top(picture)) & WORD_MASK,
    character = (attributes & ATTRIBUTES_MASK) | t.characters(picture),
    rows = t.rows(picture);
  do {
    let column = left,
      name = character,
      count = columns;
    do {
      // Past the low table the original writes on into the high table and beyond.
      if (at >= OAM_LOW_TABLE_BYTES) taskStop('intro_oam_frontier', { at });
      setWord(wram, OAM_SHADOW + at + OAM_NAME_BYTE, name);
      name = (name + 1) & WORD_MASK;
      if (column >>> BYTE_BITS) {
        const object = (at & BYTE_MASK) / OAM_ENTRY_BYTES;
        wram[OAM_SHADOW_HIGH + Math.floor(object / HIGH_TABLE_SLOTS)] |= t.oamXBits(
          object % HIGH_TABLE_SLOTS,
        );
      }
      wram[OAM_SHADOW + at] = column & BYTE_MASK;
      wram[OAM_SHADOW + at + 1] = top & BYTE_MASK;
      at += OAM_ENTRY_BYTES;
      column = (column + TILE_SIZE) & WORD_MASK;
      count = (count - 1) & WORD_MASK;
    } while (count !== 0);
    top = (top + TILE_SIZE) & WORD_MASK;
    character = (character + SHEET_ROW_CHARACTERS) & WORD_MASK;
    rows = (rows - 1) & WORD_MASK;
  } while (rows !== 0);
  return at;
}

// The work of the intro NMI callback 81:DF0E: send the OAM buffer, draw the nine
// objects and step their animations every fourth frame, count the frame, hide the
// unused objects and read the joypad.
export function drawIntroObjects(m) {
  const { wram, video } = m,
    t = introTables(m.mem);
  video.copyToOam(WRAM + OAM_SHADOW, OAM_BYTES);
  wram.fill(0, OAM_SHADOW_HIGH, OAM_SHADOW_HIGH + OAM_HIGH_TABLE_BYTES);
  const animate = (word(wram, FRONTEND_FRAME_COUNTER) & ANIMATION_PERIOD_MASK) === 0;
  let at = 0;
  for (let slot = DRAWN_SLOTS - 1; slot >= 0; slot--) {
    const animation = word(wram, slotAt(INTRO_NEAR_ANIMATIONS, slot));
    if (animation & WORD_SIGN) continue;
    at = drawSpriteGrid(
      m,
      frameAt(t, animation),
      word(wram, slotAt(INTRO_NEAR_X, slot)),
      word(wram, slotAt(INTRO_NEAR_Y, slot)),
      slot === LIT_SLOT ? LIT_ATTRIBUTES : NEAR_ATTRIBUTES,
      at,
    );
    if (!animate) continue;
    const next = (animation + FRAME_STEP) & WORD_MASK,
      frame = frameAt(t, next);
    setWord(
      wram,
      slotAt(INTRO_NEAR_ANIMATIONS, slot),
      !(frame & WORD_SIGN) ? next : frame === FRAME_RESTART_WORD ? INTRO_FRAME_RESTART : frame,
    );
  }
  setWord(wram, FRONTEND_FRAME_COUNTER, word(wram, FRONTEND_FRAME_COUNTER) + 1);
  hideRemainingObjects(wram, at);
  setWord(wram, PAD_HELD, readJoypad(m.port));
}

// One frame of the intro loop (81:E08A-E10E).
export function stepIntroFrame(m) {
  const { wram } = m,
    t = introTables(m.mem),
    loop = slotAt(INTRO_NEAR_ANIMATIONS, LOOP_SLOT);
  if (word(wram, INTRO_FAR_ANIMATIONS) & WORD_SIGN)
    setWord(wram, INTRO_FAR_ANIMATIONS, INTRO_FAR_ANIMATION);
  if (word(wram, loop) & WORD_SIGN) {
    setWord(wram, loop, LOOP_ANIMATION);
    setWord(wram, slotAt(INTRO_NEAR_X, LOOP_SLOT), LOOP_X);
    setWord(wram, slotAt(INTRO_NEAR_Y, LOOP_SLOT), LOOP_Y);
  }
  const frame = word(wram, FRONTEND_FRAME_COUNTER);
  if (frame < SPAWN_FRAMES) {
    if ((frame & SPAWN_PERIOD_MASK) === 0) {
      const n = (frame >>> SPAWN_SHIFT) & SPAWN_POSITIONS_MASK;
      addNearObject(m, t.spawnX(n) >>> 1, (t.spawnY(n) >>> 1) + NEAR_Y_BIAS, 0);
    }
    setWord(wram, loop, FREE);
    return;
  }
  // The step is the frames past 46 with its bytes swapped (8.8), half of it upwards.
  const step = swap((frame - DEPARTURE_FRAME) & WORD_MASK);
  for (const [whole, by] of [
    [INTRO_FAR_X, step],
    [INTRO_FAR_Y, step >>> 1],
  ]) {
    const fraction = slotAt(whole, FAR_FRACTION_SLOT),
      rest = word(wram, fraction) - by;
    setWord(wram, fraction, rest);
    setWord(wram, whole, word(wram, whole) - (rest < 0 ? 1 : 0));
  }
}

// Start a far object at x, y in the last free far slot (81:E971); without a free
// slot nothing happens.
export function startFarObject(m, x, y) {
  const { wram } = m;
  let slot = SLOTS - 1;
  while (!(word(wram, slotAt(INTRO_FAR_ANIMATIONS, slot)) & WORD_SIGN)) if (--slot < 0) return;
  setWord(wram, slotAt(INTRO_FAR_ANIMATIONS, slot), INTRO_FAR_ANIMATION);
  setWord(wram, slotAt(INTRO_FAR_Y, slot), y);
  setWord(wram, slotAt(INTRO_FAR_X, slot), x);
}

// Draw one list of the title pan scrolled by scroll and step its animations on the
// frames where the counter has no bits of period set; restart is the offset a frame
// word FFFE restarts at (none: the slot takes the negative word).
function drawPanList(m, t, list, attributes, scroll, period, restart, at) {
  const { wram } = m,
    [animations, xs, ys] = list,
    animate = (word(wram, FRONTEND_FRAME_COUNTER) & period) === 0;
  for (let slot = SLOTS - 1; slot >= 0; slot--) {
    const animation = word(wram, slotAt(animations, slot));
    if (animation & WORD_SIGN) continue;
    at = drawSpriteGrid(
      m,
      frameAt(t, animation, 'panFrames'),
      (word(wram, slotAt(xs, slot)) - scroll) & WORD_MASK,
      word(wram, slotAt(ys, slot)),
      attributes,
      at,
    );
    if (!animate) continue;
    const next = (animation + FRAME_STEP) & WORD_MASK,
      frame = frameAt(t, next, 'panFrames');
    setWord(
      wram,
      slotAt(animations, slot),
      !(frame & WORD_SIGN)
        ? next
        : frame === FRAME_RESTART_WORD && restart !== undefined
          ? restart
          : frame,
    );
  }
  return at;
}
// Hide the objects from at to the end of the low table (81:EE0C).
function hideRemainingObjects(wram, at) {
  if (at >= OAM_LOW_TABLE_BYTES) taskStop('intro_oam_frontier', { at });
  for (; at < OAM_LOW_TABLE_BYTES; at += OAM_ENTRY_BYTES)
    setWord(wram, OAM_SHADOW + at, OAM_HIDDEN);
}
// Run the events of a list whose time is the frame counter, from the offset at the
// word event; add(x, y) adds the object. The offset of the next event is kept.
function runPanEvents(m, events, event, add) {
  const { wram } = m,
    frame = word(wram, FRONTEND_FRAME_COUNTER);
  let at = word(wram, event);
  for (;;) {
    if (at & 1) taskStop('intro_table_index_frontier', { table: 'intro events', offset: at });
    const n = at >>> 1;
    if (events(n) !== frame) break;
    add(events(n + 1) >>> 1, events(n + 2) >>> 1);
    at = (at + EVENT_BYTES) & WORD_MASK;
  }
  setWord(wram, event, at);
}

// The work of the title pan NMI 81:D9D5 (after the OAM buffer was sent): draw the
// near objects (priority 2, a quarter of position) and the far ones (priority 1,
// palette 1, an eighth), hide the rest, add the objects whose time has come, count
// the frame and read the joypad.
export function drawPanObjects(m, position) {
  const { wram } = m,
    t = introTables(m.mem);
  wram.fill(0, OAM_SHADOW_HIGH, OAM_SHADOW_HIGH + OAM_HIGH_TABLE_BYTES);
  let at = drawPanList(
    m,
    t,
    [INTRO_NEAR_ANIMATIONS, INTRO_NEAR_X, INTRO_NEAR_Y],
    NEAR_ATTRIBUTES,
    position >>> NEAR_SCROLL_SHIFT,
    ANIMATION_PERIOD_MASK,
    PAN_FRAME_RESTART,
    0,
  );
  at = drawPanList(
    m,
    t,
    [INTRO_FAR_ANIMATIONS, INTRO_FAR_X, INTRO_FAR_Y],
    FAR_ATTRIBUTES,
    position >>> FAR_SCROLL_SHIFT,
    FAR_ANIMATION_PERIOD_MASK,
    undefined,
    at,
  );
  hideRemainingObjects(wram, at);
  runPanEvents(m, t.nearEvents, INTRO_NEAR_EVENT, (x, y) =>
    addNearObject(m, x, y + NEAR_Y_BIAS, position >>> NEAR_SCROLL_SHIFT),
  );
  runPanEvents(m, t.farEvents, INTRO_FAR_EVENT, (x, y) => startFarObject(m, x, y + FAR_Y_BIAS));
  setWord(wram, FRONTEND_FRAME_COUNTER, word(wram, FRONTEND_FRAME_COUNTER) + 1);
  setWord(wram, PAD_HELD, readJoypad(m.port));
}
