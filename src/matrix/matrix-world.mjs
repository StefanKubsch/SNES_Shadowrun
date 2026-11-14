// The matrix grid (lifted from 81:B4B9-B9D0, 81:BA70-BEC2 and 81:C108-C394): the
// map of a system, the objects on it (persona, gates, falling IC), the persona's
// states and what A and B do on the node ahead. Positions are pixels; a map tile
// is 16 pixels and the persona acts only on the tile grid.
import { taskStop } from '../task/plan.mjs';
import { protectedJakeHealth } from '../game/cheats.mjs';
import {
  longWord,
  queueVramCopy,
  setLongWord,
  setWord,
  word,
  wramOffset,
} from './matrix-runtime.mjs';
import { queueText } from './matrix-text.mjs';
import { entryOf } from './matrix-tables.mjs';
import {
  DECKER_COMPUTER_SKILL,
  DECKER_RECORD,
  MATRIX_ANIMATION,
  MATRIX_ANIMATION_CLOCK,
  MATRIX_ANIMATION_SPEED,
  MATRIX_ANIMATION_STEP,
  MATRIX_BLINK,
  MATRIX_CPU_BITS,
  MATRIX_DATA_BITS,
  MATRIX_DIRECTION,
  MATRIX_DMA_RECORDS,
  MATRIX_DOWNLOAD_BITS,
  MATRIX_FOUGHT_IC,
  MATRIX_HEALTH,
  MATRIX_IC_COUNTED,
  MATRIX_IC_TEXT_BUFFER,
  MATRIX_IC_TEXT_COUNT,
  MATRIX_MAP,
  MATRIX_MAP_EDIT,
  MATRIX_MEMORY,
  MATRIX_MEMORY_LIMIT,
  MATRIX_NODE_COLUMNS,
  MATRIX_NODE_ROWS,
  MATRIX_OBJECT_ANIMATING,
  MATRIX_OBJECT_END,
  MATRIX_OBJECT_FLAGS,
  MATRIX_OBJECT_PICTURE,
  MATRIX_OBJECT_SHOWN,
  MATRIX_OBJECT_TYPE,
  MATRIX_PERSONA_X,
  MATRIX_PERSONA_Y,
  MATRIX_SCROLL_X,
  MATRIX_SCROLL_Y,
  MATRIX_SPEED_X,
  MATRIX_SPEED_Y,
  MATRIX_STATE,
  MATRIX_STATE_CLOCK,
  MATRIX_STATE_CONTROL,
  MATRIX_STATE_FRAMES,
  MATRIX_STATE_HIT,
  MATRIX_STATE_TRACK,
  MATRIX_STATE_TURN_LEFT,
  MATRIX_STATE_TURN_RIGHT,
  MATRIX_TURN_TARGET,
  OAM_SHADOW,
  OAM_SHADOW_HIGH,
  PAD_A,
  PAD_B,
  PAD_DIRECTIONS,
  PAD_HELD,
  PAD_PRESSED,
  RANDOM_STATE,
  WRAM,
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import {
  APU_COMMAND_SOUND,
  APU_COMMAND_SOUND_LEVEL,
  APU_COMMAND_SOUND_VOICES,
  APU_COMMAND_SOUND_VOLUME,
} from '../constants/sound-commands.mjs';
import {
  OAM_ENTRY_BYTES,
  OAM_HIGH_TABLE_BYTES,
  OAM_LOW_TABLE_BYTES,
  OAM_NAME_BYTE,
  OAM_Y_BYTE,
  SCREEN_MAP_BYTES,
} from '../constants/ppu.mjs';

// The map: 32 x 32 words in bank 7F; bits 0-9 are the tile, bits 10-15 its BG
// attributes. Tile 59 marks the persona's start; tiles 21-27 are the nodes whose
// column and row the upload records.
export const MAP_BANK = 0x7f,
  MATRIX_MAP_VRAM = 0x2000;
const MAP_BASE = MAP_BANK << WORD_BITS,
  MAP_TILES = 0x20,
  MAP_ROW_BYTES = MAP_TILES * 2,
  MAP_ROW_SHIFT = 5,
  TILE_NUMBER_MASK = 0x3ff,
  TILE_ROW_BITS = 0x3f8,
  TILE_COLUMN_BITS = 7,
  TILE_ATTRIBUTE_BITS = 0xfc00,
  PERSONA_TILE = 0x59,
  MAP_ROW_OFFSET_MASK = 0xffc0,
  MAP_COLUMN_OFFSET_MASK = 0x3e,
  // A map byte offset to pixels: a row of 64 bytes is 16 pixels, a column of 2 bytes too.
  ROW_OFFSET_PIXEL_SHIFT = 2,
  COLUMN_OFFSET_PIXEL_SHIFT = 3,
  FIRST_NODE_TILE = 0x21,
  NODE_TILE_END = 0x28,
  NODE_TABLE_BYTES = (NODE_TILE_END - FIRST_NODE_TILE) * 2,
  NO_NODE = WORD_MASK;
const TILE_PIXEL_SHIFT = 4,
  TILE_PIXELS = 1 << TILE_PIXEL_SHIFT,
  GRID_MASK = TILE_PIXELS - 1,
  HALF_TILE = TILE_PIXELS / 2,
  TILE_ROW_MASK = WORD_MASK - GRID_MASK;
// Map values (docs/ROM-FREE.md "Matrix rules seen"): 00 edge, 01 and 02 paths; 07 costs
// one health under B; IC 08-0F; data nodes 10-17 and 18-1F; the CPU node 20 with
// gates; 21-27 need a password; 58 and 10-4F block the way. A data node 10-17 taken
// becomes 40, B on 40 makes 41 (guard IC destroyed), a download makes 42. Words
// written back to VRAM carry palette 4.
const TILE_EDGE = 0,
  TILE_PATH = 1,
  TILE_FAST_PATH = 2,
  NODE_COSTS_HEALTH = 7,
  IC_FIRST = 8,
  IC_END = 0x10,
  DATA_FIRST = 0x10,
  DATA_END = 0x18,
  DOWNLOAD_FIRST = 0x18,
  DOWNLOAD_END = 0x20,
  NODE_CPU = 0x20,
  PASSWORD_FIRST = 0x21,
  CPU_END = 0x28,
  BLOCKING_NODE = 0x58,
  BLOCKING_FIRST = 0x10,
  BLOCKING_END = 0x50,
  NODE_DATA_TAKEN = 0x40,
  NODE_GUARD_DOWN = 0x41,
  NODE_DOWNLOADED = 0x42,
  NODE_PALETTE = 0x1000;

// The control tables of bank 81 come by name from m.tables (src/matrix/matrix-tables.mjs);
// tables by heading take the heading (0, 2, ... 14) as entryOf(heading). There are four
// sides (up, right, down, left) and eight neighbours around a tile.
const SIDES = 4,
  NEIGHBOURS = 8,
  // B on a taken data node (40) indexes matrix_bits with 30; the word there is
  // entries 4 and 5 of matrix_amounts_10 (81:C334), which go into the data bits.
  TAKEN_NODE_BITS_LOW = 4,
  TAKEN_NODE_BITS_HIGH = 5;
// Matrix texts (src/data/matrix-texts.mjs).
const TEXT_ATTACKED = 0x81c5c0, // ATTACKED BY IC
  TEXT_COMBAT = 0x81c5d2, // EXEC. COMBAT.EXE
  TEXT_COMBAT_WON = 0x81c5e6, // COMBAT SUCCESSFUL
  TEXT_COMBAT_LOST = 0x81c5fb, // COMBAT FAILED!
  TEXT_TRANSFER = 0x81c642, // EXEC. TRANSFER.EXE
  TEXT_PHONEBOOK = 0x81c658, // PHONEBOOK RECEIVED.
  TEXT_DATA_RECEIVED = 0x81c66f, // DATA RECEIVED.
  TEXT_PROGRAM_MODIFIED = 0x81c681, // PROGRAM MODIFIED.
  TEXT_GUARD_DESTROYED = 0x81c696, // GUARD IC DESTROYED...
  TEXT_LINES_OPENED = 0x81c6b1, // LINES OPENED..
  TEXT_PASSWORD = 0x81c6c3, // PASSWORD NEEDED..
  TEXT_OUT_OF_STORAGE = 0x81c6d8; // ERROR : OUT OF STORAGE

// Objects: 33 slots of the arrays MATRIX_OBJECT_* and MATRIX_PERSONA_* (slot 0 is the
// persona); a slot is a word offset. A new object runs its animation list every 6
// frames and plays sound 5; kinds 2-4 restore their map word when they vanish.
const PERSONA = 0,
  // The eight-picture list 81:BEB1 that ends with FFFE (stop).
  OBJECT_ANIMATION = 0xbeb1,
  OBJECT_ANIMATION_SPEED = 6,
  OBJECT_SOUND = 5,
  OBJECT_IC = 2,
  MARKED_KIND_FIRST = 2,
  MARKED_KIND_END = 5;
// Animation lists hold picture words and end with FFFE (stop) or FFFF (repeat).
const ANIMATION_STOP = 0xfffe,
  ANIMATION_LOOP = WORD_MASK,
  ANIMATION_DONE = WORD_MASK ^ MATRIX_OBJECT_ANIMATING;
// Sprites at a screen X of -8 to F7 and a Y of -8 to D7 are drawn; unused entries
// get X FF and Y F0. The persona's screen Y is one less than its position (the
// original subtracts with a borrow).
const VISIBLE_START = 0xfff8,
  VISIBLE_RIGHT = 0xf8,
  VISIBLE_BOTTOM = 0xd8,
  OAM_HIDDEN = 0xf0ff,
  OAM_HIGH_SLOT_MASK = 3,
  OAM_SLOTS_PER_HIGH_BYTE_SHIFT = 2;
// Map edits: a ring of 64 bytes in bank 7F that the VRAM copies read from.
const MAP_EDIT_TILES = 0x7f019a,
  MAP_EDIT_RING_BYTES = 0x40,
  MAP_EDIT_BYTES = 2;
// Sounds: voices 0-3 at full volume; an IC strike plays sound 12; the IC count plays
// sound 16 at full level with the pitch byte 50 + 2 per IC.
const SOUND_VOICES = 0xf,
  FULL_VOLUME = 0xff00,
  IC_ATTACK_SOUND = 0x12,
  FOUND_IC_LEVELS = 0x7f7f,
  FOUND_IC_PITCH = 0x50,
  FOUND_IC_SOUND = 0x16,
  // "FOUND X IC!": the digit and a space over the X.
  DIGIT_ZERO_AND_SPACE = 0x2030;
// Headings: 0 up, 4 right, 8 down, 12 left; turns step by 2 every 5 frames, a turn of
// 8 or more goes anticlockwise.
const DIRECTION_UP = 0,
  DIRECTION_RIGHT = 4,
  DIRECTION_DOWN = 8,
  DIRECTION_LEFT = 12,
  DIRECTION_MASK = 0xf,
  DIRECTION_TURN_STEP = 2,
  DIRECTION_HALF_TURN = 8,
  TURN_STEP_FRAMES = 5;
// The pad nibble (up 8, down 4, left 2, right 1): one direction moves, anything else stops.
const PAD_NIBBLE_SHIFT = 8,
  PAD_HEADINGS = new Map([
    [1, DIRECTION_RIGHT],
    [2, DIRECTION_LEFT],
    [4, DIRECTION_DOWN],
    [8, DIRECTION_UP],
  ]);
// COMBAT.EXE wins when a draw of 0-6 lies below the Computer skill; an IC strike
// blinks the persona 15 times. Memory holds at most 40; the CPU nodes cost 0A.
const COMBAT_RANGE = 7,
  HIT_BLINK_STEPS = 0xf,
  MEMORY_MAX = 0x40,
  CPU_PROGRAM_MEMORY = 0xa,
  ENTER_CONTROL = 0;

const at = (array, slot) => array + slot;
const add = (wram, address, value) => setWord(wram, address, word(wram, address) + value);
const onGrid = (wram) =>
  ((word(wram, MATRIX_PERSONA_X) | word(wram, MATRIX_PERSONA_Y)) & GRID_MASK) === 0;
const isIc = (tile) => tile >= IC_FIRST && tile < IC_END;

// ---- Map ----

// The BG tilemap word of a map word: the tile sheet has 8 tiles of 16 x 16 pixels
// per row, so tile t starts at character 2 (t & 7) + 32 (t >> 3) (81:B4B9).
export const tilemapEntry = (value) =>
  (((((value & TILE_ROW_BITS) << 1) | (value & TILE_COLUMN_BITS)) << 1) |
    (value & TILE_ATTRIBUTE_BITS)) &
  WORD_MASK;
// Write a map (long address) to the BG map at a VRAM word address and record the
// column and row of each node tile (81:B4D3).
export function uploadMap(m, map, vram) {
  const { mem, wram, video } = m;
  for (let node = 0; node < NODE_TABLE_BYTES; node += 2) {
    setWord(wram, MATRIX_NODE_COLUMNS + node, NO_NODE);
    setWord(wram, MATRIX_NODE_ROWS + node, NO_NODE);
  }
  let offset = 0;
  for (let row = 0; row < MAP_TILES; row++)
    for (let column = 0; column < MAP_TILES; column++, offset += 2) {
      const value = longWord(mem, map + offset);
      video.setVramWord((row * MAP_TILES) | column | vram, tilemapEntry(value));
      const tile = value & TILE_NUMBER_MASK;
      if (tile >= FIRST_NODE_TILE && tile < NODE_TILE_END) {
        const node = (tile - FIRST_NODE_TILE) * 2;
        setWord(wram, MATRIX_NODE_COLUMNS + node, column);
        setWord(wram, MATRIX_NODE_ROWS + node, row);
      }
    }
}
// Put the persona on the first start tile of the map (81:B818).
export function placePersonaAtStart(m) {
  const { mem, wram } = m,
    map = MAP_BASE + word(wram, MATRIX_MAP);
  let offset = 0;
  while (offset !== SCREEN_MAP_BYTES) {
    if ((longWord(mem, map + offset) & TILE_NUMBER_MASK) === PERSONA_TILE) break;
    offset += 2;
  }
  setWord(wram, MATRIX_PERSONA_Y, (offset & MAP_ROW_OFFSET_MASK) >>> ROW_OFFSET_PIXEL_SHIFT);
  setWord(wram, MATRIX_PERSONA_X, (offset & MAP_COLUMN_OFFSET_MASK) << COLUMN_OFFSET_PIXEL_SHIFT);
}
// The map address (bank 7F) of the tile under the centre of object slot, plus a byte
// offset (81:B66A).
function tileAddress(m, slot, offset) {
  const { wram } = m,
    column =
      ((word(wram, at(MATRIX_PERSONA_X, slot)) + HALF_TILE) & WORD_MASK) >>> TILE_PIXEL_SHIFT,
    row = (((word(wram, at(MATRIX_PERSONA_Y, slot)) + HALF_TILE) & TILE_ROW_MASK) << 1) & WORD_MASK,
    index = (((row | column) << 1) & WORD_MASK) + ((offset + word(wram, MATRIX_MAP)) & WORD_MASK);
  return MAP_BASE + (index & WORD_MASK);
}
const readTile = (m, slot, offset) =>
  longWord(m.mem, tileAddress(m, slot, offset)) & TILE_NUMBER_MASK;
const writeTile = (m, slot, offset, value) =>
  setLongWord(m.mem, tileAddress(m, slot, offset), value);
// The tile beside node at a byte offset in the map (81:B54C).
function readNodeSideTile(m, node, offset) {
  const { wram } = m,
    rows = (word(wram, MATRIX_NODE_ROWS + node) << MAP_ROW_SHIFT) & WORD_MASK,
    index = (((rows + word(wram, MATRIX_NODE_COLUMNS + node)) & WORD_MASK) << 1) & WORD_MASK,
    pointer = (index + ((offset + word(wram, MATRIX_MAP)) & WORD_MASK)) & WORD_MASK;
  return longWord(m.mem, MAP_BASE + pointer) & TILE_NUMBER_MASK;
}
// Show a changed map word under object slot plus a tile step: it goes to the edit
// ring and its VRAM copy is queued (81:B6A6).
function showMapEdit(m, slot, tileStep, value) {
  const { mem, wram } = m;
  let edit = (word(wram, MATRIX_MAP_EDIT) + MAP_EDIT_BYTES) & WORD_MASK;
  if (edit >= MAP_EDIT_RING_BYTES) edit = 0;
  setWord(wram, MATRIX_MAP_EDIT, edit);
  setLongWord(mem, MAP_EDIT_TILES + edit, tilemapEntry(value));
  const column =
      ((word(wram, at(MATRIX_PERSONA_X, slot)) + HALF_TILE) & WORD_MASK) >>> TILE_PIXEL_SHIFT,
    row = (((word(wram, at(MATRIX_PERSONA_Y, slot)) + HALF_TILE) & TILE_ROW_MASK) << 1) & WORD_MASK,
    vram = ((row | column | MATRIX_MAP_VRAM) + tileStep) & WORD_MASK;
  queueVramCopy(wram, MAP_EDIT_BYTES, MAP_EDIT_TILES + edit, vram);
  setWord(wram, MATRIX_DMA_RECORDS, 1);
}

// ---- Objects ----

// Sound at full volume on the matrix voices (81:B1C6).
function playSound(m, sound) {
  m.sound(APU_COMMAND_SOUND_VOICES, SOUND_VOICES);
  m.sound(APU_COMMAND_SOUND_VOLUME, sound | FULL_VOLUME);
}
// Add an object of kind at x, y in the first free slot (81:B8C8).
function addObject(m, x, y, kind) {
  const { wram } = m;
  for (let slot = 0; slot < MATRIX_OBJECT_END; slot += 2)
    if (word(wram, at(MATRIX_OBJECT_TYPE, slot)) === 0) {
      setWord(wram, at(MATRIX_PERSONA_X, slot), x);
      setWord(wram, at(MATRIX_PERSONA_Y, slot), y);
      setWord(wram, at(MATRIX_OBJECT_TYPE, slot), kind);
      setWord(wram, at(MATRIX_ANIMATION, slot), OBJECT_ANIMATION);
      setWord(wram, at(MATRIX_ANIMATION_STEP, slot), 0);
      setWord(wram, at(MATRIX_ANIMATION_SPEED, slot), OBJECT_ANIMATION_SPEED);
      setWord(wram, at(MATRIX_ANIMATION_CLOCK, slot), 1);
      const flags = at(MATRIX_OBJECT_FLAGS, slot);
      setWord(wram, flags, word(wram, flags) | MATRIX_OBJECT_ANIMATING);
      playSound(m, OBJECT_SOUND);
      return;
    }
}
// Empty every slot; the flags keep only "shown" (81:BD62).
export function resetObjects(m) {
  const { wram } = m;
  for (let slot = 0; slot < MATRIX_OBJECT_END; slot += 2) {
    setWord(wram, at(MATRIX_OBJECT_TYPE, slot), 0);
    setWord(wram, at(MATRIX_OBJECT_FLAGS, slot), MATRIX_OBJECT_SHOWN);
    setWord(wram, at(MATRIX_SPEED_X, slot), 0);
    setWord(wram, at(MATRIX_SPEED_Y, slot), 0);
  }
}
// Start the persona animation list unless it already runs (81:B8AD).
function setPersonaAnimation(m, list) {
  const { wram } = m;
  if (list === word(wram, MATRIX_ANIMATION)) return;
  setWord(wram, MATRIX_ANIMATION, list);
  setWord(wram, MATRIX_ANIMATION_STEP, 0);
  setWord(wram, MATRIX_ANIMATION_CLOCK, 1);
  setWord(wram, MATRIX_OBJECT_FLAGS, word(wram, MATRIX_OBJECT_FLAGS) | MATRIX_OBJECT_ANIMATING);
}
// Move and animate object slot and put its sprite into the OAM buffer at oam; returns
// the next OAM offset (81:BD99).
function drawObject(m, slot, oam) {
  const { wram } = m,
    x = at(MATRIX_PERSONA_X, slot),
    y = at(MATRIX_PERSONA_Y, slot),
    flags = at(MATRIX_OBJECT_FLAGS, slot),
    picture = at(MATRIX_OBJECT_PICTURE, slot),
    clock = at(MATRIX_ANIMATION_CLOCK, slot);
  add(wram, x, word(wram, at(MATRIX_SPEED_X, slot)));
  add(wram, y, word(wram, at(MATRIX_SPEED_Y, slot)));
  setWord(wram, flags, word(wram, flags) | MATRIX_OBJECT_ANIMATING);
  if (!(word(wram, flags) & MATRIX_OBJECT_SHOWN)) return oam;
  const screenX = (word(wram, x) - word(wram, MATRIX_SCROLL_X)) & WORD_MASK,
    screenY = (word(wram, y) - word(wram, MATRIX_SCROLL_Y) - 1) & WORD_MASK;
  const ticks = (word(wram, clock) - 1) & WORD_MASK;
  setWord(wram, clock, ticks);
  if (ticks === 0) {
    setWord(wram, clock, word(wram, at(MATRIX_ANIMATION_SPEED, slot)));
    const list = word(wram, at(MATRIX_ANIMATION, slot));
    let step = word(wram, at(MATRIX_ANIMATION_STEP, slot)),
      value;
    for (;;) {
      value = m.tables.animation(list, step);
      if (value === ANIMATION_STOP) {
        setWord(wram, flags, word(wram, flags) & ANIMATION_DONE);
        return oam;
      }
      if (value !== ANIMATION_LOOP) break;
      setWord(wram, flags, word(wram, flags) & ANIMATION_DONE);
      step = 0;
    }
    setWord(wram, picture, value);
    setWord(wram, at(MATRIX_ANIMATION_STEP, slot), step + 2);
  }
  if (screenX < VISIBLE_START && screenX >= VISIBLE_RIGHT) return oam;
  if (screenY < VISIBLE_START && screenY >= VISIBLE_BOTTOM) return oam;
  // Three overlapping word writes leave X, Y and the picture word in the entry.
  setWord(wram, OAM_SHADOW + oam, screenX);
  setWord(wram, OAM_SHADOW + OAM_Y_BYTE + oam, screenY);
  setWord(wram, OAM_SHADOW + OAM_NAME_BYTE + oam, word(wram, picture));
  const next = oam + OAM_ENTRY_BYTES;
  if (screenX & WORD_SIGN) {
    // X bit 8 of a sprite left of the screen. The original indexes the high table
    // with the slot within its byte, so the bit always lands in the first word.
    const slotInByte = ((next >>> 2) - 1) & OAM_HIGH_SLOT_MASK,
      bit = m.tables.oamXBits(slotInByte),
      high = OAM_SHADOW_HIGH + (slotInByte >>> OAM_SLOTS_PER_HIGH_BYTE_SHIFT);
    setWord(wram, high, bit | word(wram, high));
  }
  return next;
}
// Rebuild the OAM buffer from the objects (81:BD7C with 81:EDD7 and 81:EE0C).
export function drawObjects(m) {
  const { wram } = m;
  for (let offset = 0; offset < OAM_HIGH_TABLE_BYTES; offset += 2)
    setWord(wram, OAM_SHADOW_HIGH + offset, 0);
  let oam = 0;
  for (let slot = 0; slot < MATRIX_OBJECT_END; slot += 2)
    if (word(wram, at(MATRIX_OBJECT_TYPE, slot)) !== 0) oam = drawObject(m, slot, oam);
  // Hide the rest of the low table; an offset off the entry grid runs on to the
  // word wrap as the original loop does.
  do {
    setWord(wram, OAM_SHADOW + oam, OAM_HIDDEN);
    oam = (oam + OAM_ENTRY_BYTES) & WORD_MASK;
  } while (oam !== OAM_LOW_TABLE_BYTES);
}
// Remove the objects of kinds 2-4 whose animation has ended; each restores its map
// word, the removal also on screen (81:B90F).
export function removeFinishedObjects(m) {
  const { wram } = m;
  for (let slot = 0; slot < MATRIX_OBJECT_END; slot += 2) {
    const kind = word(wram, at(MATRIX_OBJECT_TYPE, slot));
    if (kind < MARKED_KIND_FIRST || kind >= MARKED_KIND_END) continue;
    const mark = m.tables.objectMarks(kind);
    writeTile(m, slot, 0, mark);
    if (word(wram, at(MATRIX_OBJECT_FLAGS, slot)) & MATRIX_OBJECT_ANIMATING) continue;
    setWord(wram, at(MATRIX_OBJECT_TYPE, slot), 0);
    showMapEdit(m, slot, 0, mark);
  }
}
// An object at each of the four sides of a cell whose tile holds the side's value;
// returns their count (shared by 81:B609 and 81:B56F). origin() gives the cell's x
// and y for each side.
function addSideObjects(m, readSide, origin) {
  const t = m.tables;
  let opened = 0;
  for (let side = 0; side < SIDES; side++) {
    if (readSide(t.sideOffsets(side)) !== t.sideValues(side)) continue;
    opened++;
    const [x, y] = origin();
    addObject(
      m,
      (x + t.sideX(side)) & WORD_MASK,
      (y + t.sideY(side)) & WORD_MASK,
      t.sideKinds(side),
    );
  }
  return opened;
}
// Gate objects around the persona (81:B609); returns their count.
function openGatesAroundPersona(m) {
  const { wram } = m;
  return addSideObjects(
    m,
    (offset) => readTile(m, PERSONA, offset),
    // Read for each side: a gate added in a free persona slot moves the persona.
    () => [word(wram, MATRIX_PERSONA_X), word(wram, MATRIX_PERSONA_Y)],
  );
}
// Open the gates of the nodes whose bits are set: each such node's cell moves one
// step toward its side with tile 07, and gates appear around it (81:B56F). Returns
// the number of gates.
export function openNodeGates(m, bits) {
  const { wram } = m,
    t = m.tables;
  let opened = 0;
  for (let node = 0; node !== NODE_TABLE_BYTES; node += 2) {
    const columns = MATRIX_NODE_COLUMNS + node,
      rows = MATRIX_NODE_ROWS + node;
    if (word(wram, columns) & WORD_SIGN) break;
    // Node n has bit n + 1 (bit 0 is the CPU node 20).
    const bit = t.bits(entryOf(node) + 1);
    if (!(bits & bit)) continue;
    setWord(wram, MATRIX_CPU_BITS, word(wram, MATRIX_CPU_BITS) | bit);
    let side = 0;
    while (side !== SIDES) {
      if (readNodeSideTile(m, node, t.sideOffsets(side)) === NODE_COSTS_HEALTH) break;
      side++;
    }
    add(wram, columns, t.cellColumns(side));
    add(wram, rows, t.cellRows(side));
    const cell = [
      (word(wram, columns) << TILE_PIXEL_SHIFT) & WORD_MASK,
      (word(wram, rows) << TILE_PIXEL_SHIFT) & WORD_MASK,
    ];
    opened += addSideObjects(
      m,
      (offset) => readNodeSideTile(m, node, offset),
      () => cell,
    );
  }
  return opened;
}
// The room around the persona: from its tile, left and up to the edge (tiles 0-2),
// then right and down to the next zero tile. Every IC tile in it falls as an object
// (81:B71F); returns their count.
function dropRoomIcs(m) {
  const { mem, wram } = m;
  let pointer = tileAddress(m, PERSONA, 0) & WORD_MASK,
    x = word(wram, MATRIX_PERSONA_X),
    y = word(wram, MATRIX_PERSONA_Y);
  const tileAt = (offset) => longWord(mem, MAP_BASE + pointer + offset) & TILE_NUMBER_MASK,
    isEdge = () => tileAt(0) <= TILE_FAST_PATH;
  while (!isEdge()) {
    pointer = (pointer - 2) & WORD_MASK;
    x = (x - TILE_PIXELS) & WORD_MASK;
  }
  pointer = (pointer + 2) & WORD_MASK;
  x = (x + TILE_PIXELS) & WORD_MASK;
  while (!isEdge()) {
    pointer = (pointer - MAP_ROW_BYTES) & WORD_MASK;
    y = (y - TILE_PIXELS) & WORD_MASK;
  }
  pointer = (pointer + MAP_ROW_BYTES) & WORD_MASK;
  y = (y + TILE_PIXELS) & WORD_MASK;
  let columns = 0,
    rows = 0;
  for (let offset = 0; tileAt(offset) !== TILE_EDGE; offset = (offset + 2) & WORD_MASK) columns++;
  for (let offset = 0; tileAt(offset) !== TILE_EDGE; offset = (offset + MAP_ROW_BYTES) & WORD_MASK)
    rows++;
  const left = x;
  let dropped = 0;
  do {
    x = left;
    let offset = 0,
      count = columns;
    do {
      if (isIc(tileAt(offset))) {
        addObject(m, x, y, OBJECT_IC);
        dropped++;
      }
      x = (x + TILE_PIXELS) & WORD_MASK;
      offset = (offset + 2) & WORD_MASK;
      count = (count - 1) & WORD_MASK;
    } while (count !== 0);
    pointer = (pointer + MAP_ROW_BYTES) & WORD_MASK;
    y = (y + TILE_PIXELS) & WORD_MASK;
    rows = (rows - 1) & WORD_MASK;
  } while (rows !== 0);
  return dropped;
}

// ---- Persona ----

// Subtract damage from the matrix health, not below zero (81:B1B5).
export function takeDamage(m, damage) {
  const { wram } = m,
    health = word(wram, MATRIX_HEALTH);
  let left = health >= damage ? health - damage : 0;
  if (m.h.a.vm?.cheats) left = protectedJakeHealth(m.h.a, word(wram, DECKER_RECORD), left);
  setWord(wram, MATRIX_HEALTH, left);
}
// Count the IC around the persona and announce them once, with the count as digit and
// a sound (81:B959).
function announceNearbyIcs(m) {
  const { mem, wram } = m;
  let ics = 0;
  for (let n = NEIGHBOURS - 1; n >= 0; n--)
    if (isIc(readTile(m, PERSONA, m.tables.neighbourOffsets(n)))) ics++;
  if (ics === 0 || word(wram, MATRIX_IC_COUNTED) !== 0) return;
  setLongWord(mem, MATRIX_IC_TEXT_COUNT, ics + DIGIT_ZERO_AND_SPACE);
  queueText(m, MATRIX_IC_TEXT_BUFFER);
  add(wram, MATRIX_IC_COUNTED, 1);
  m.sound(APU_COMMAND_SOUND_VOICES, SOUND_VOICES);
  m.sound(APU_COMMAND_SOUND_LEVEL, FOUND_IC_LEVELS);
  m.sound(
    APU_COMMAND_SOUND,
    (((ics * 2 + FOUND_IC_PITCH) & BYTE_MASK) << BYTE_BITS) | FOUND_IC_SOUND,
  );
}
// On an IC tile the persona takes random damage, is pushed back one tile and blinks
// (81:B9D0).
function sufferIcAttack(m) {
  const { wram } = m,
    t = m.tables,
    tile = readTile(m, PERSONA, 0);
  if (!isIc(tile)) return;
  setWord(wram, MATRIX_IC_COUNTED, 0);
  takeDamage(m, (m.random(t.damage(tile - IC_FIRST)) + 1) & WORD_MASK);
  const direction = entryOf(word(wram, MATRIX_DIRECTION));
  add(wram, MATRIX_PERSONA_X, t.pushX(direction));
  add(wram, MATRIX_PERSONA_Y, t.pushY(direction));
  setWord(wram, MATRIX_STATE_CLOCK, 1);
  setWord(wram, MATRIX_STATE_FRAMES, 1);
  setWord(wram, MATRIX_STATE, MATRIX_STATE_HIT);
  setWord(wram, MATRIX_BLINK, HIT_BLINK_STEPS);
  setWord(wram, MATRIX_SPEED_X, 0);
  setWord(wram, MATRIX_SPEED_Y, 0);
  queueText(m, TEXT_ATTACKED);
  playSound(m, IC_ATTACK_SOUND);
}
// Without a pad direction: face the heading, stand still, check for IC (81:BA97).
function stopPersona(m) {
  const { wram } = m;
  setPersonaAnimation(m, m.tables.facePictures(entryOf(word(wram, MATRIX_DIRECTION))));
  setWord(wram, MATRIX_SPEED_X, 0);
  setWord(wram, MATRIX_SPEED_Y, 0);
  sufferIcAttack(m);
}
// Turn towards heading, or step along it when the tile ahead is open; on a path the
// persona runs on to the next node (81:BAAA).
function movePersona(m, heading) {
  const { wram } = m,
    t = m.tables,
    direction = word(wram, MATRIX_DIRECTION);
  if (heading !== direction) {
    setWord(wram, MATRIX_SPEED_X, 0);
    setWord(wram, MATRIX_SPEED_Y, 0);
    setWord(wram, MATRIX_STATE_FRAMES, TURN_STEP_FRAMES);
    setWord(wram, MATRIX_TURN_TARGET, heading);
    const anticlockwise = ((heading - direction) & DIRECTION_MASK) >= DIRECTION_HALF_TURN;
    setWord(wram, MATRIX_STATE, anticlockwise ? MATRIX_STATE_TURN_LEFT : MATRIX_STATE_TURN_RIGHT);
    sufferIcAttack(m);
    return;
  }
  const entry = entryOf(heading),
    ahead = readTile(m, PERSONA, t.mapSteps(entry));
  if (
    ahead === TILE_EDGE ||
    ahead === BLOCKING_NODE ||
    (ahead >= BLOCKING_FIRST && ahead < BLOCKING_END)
  ) {
    stopPersona(m);
    return;
  }
  setWord(wram, MATRIX_DIRECTION, heading);
  setWord(wram, MATRIX_IC_COUNTED, 0);
  setPersonaAnimation(m, t.movePictures(entry));
  const path = readTile(m, PERSONA, t.mapSteps(entry));
  if (path === TILE_PATH || path === TILE_FAST_PATH) {
    setWord(wram, MATRIX_SPEED_X, t.fastX(entry));
    setWord(wram, MATRIX_SPEED_Y, t.fastY(entry));
    setWord(wram, MATRIX_STATE, MATRIX_STATE_TRACK);
    return;
  }
  setWord(wram, MATRIX_SPEED_X, t.stepX(entry));
  setWord(wram, MATRIX_SPEED_Y, t.stepY(entry));
  sufferIcAttack(m);
}
// Control state: on a grid point count the IC around and steer by the pad (81:BA77).
function controlPersona(m) {
  const { wram } = m;
  if (!onGrid(wram)) return;
  announceNearbyIcs(m);
  const heading = PAD_HEADINGS.get((word(wram, PAD_HELD) & PAD_DIRECTIONS) >>> PAD_NIBBLE_SHIFT);
  if (heading === undefined) stopPersona(m);
  else movePersona(m, heading);
}
// Running along a path: speed and moving animation of the heading (81:BC2B).
function setTrackSpeed(m) {
  const { wram } = m,
    t = m.tables,
    direction = entryOf(word(wram, MATRIX_DIRECTION));
  setWord(wram, MATRIX_SPEED_X, t.fastX(direction));
  setWord(wram, MATRIX_SPEED_Y, t.fastY(direction));
  setPersonaAnimation(m, t.movePictures(direction));
}
// The tile under the persona against the track values of its heading: the first keeps
// the heading, a turn value turns. Returns false when the track ends (81:BC41).
function followTrack(m, heading) {
  const { wram } = m,
    t = m.tables,
    entry = entryOf(heading),
    tile = readTile(m, PERSONA, 0);
  if (tile === t.trackStop(entry)) return true;
  for (const [values, directions] of [
    [t.trackTurn1, t.trackTurn1Direction],
    [t.trackTurn2, t.trackTurn2Direction],
  ])
    if (tile === values(entry)) {
      setWord(wram, MATRIX_DIRECTION, directions(entry));
      setTrackSpeed(m);
      return true;
    }
  return false;
}
// Track state: on a grid point follow the track, or stop and return to control (81:BBF6).
function runOnTrack(m) {
  const { wram } = m;
  if (!onGrid(wram)) return;
  const heading = word(wram, MATRIX_DIRECTION);
  // Only the four main headings have a track check (table 81:BC1B).
  if (heading > DIRECTION_LEFT || heading & (DIRECTION_RIGHT - 1))
    taskStop('matrix_control_dispatch_frontier', { pc: 0x81bc09, index: heading });
  if (followTrack(m, heading)) return;
  setWord(wram, MATRIX_SPEED_X, 0);
  setWord(wram, MATRIX_SPEED_Y, 0);
  setWord(wram, MATRIX_STATE, MATRIX_STATE_CONTROL);
}
// Turn states: one step clockwise or anticlockwise until the target heading
// (81:BCC3, 81:BCE8).
function turnPersona(m, step) {
  const { wram } = m,
    direction = word(wram, MATRIX_DIRECTION);
  if (direction !== word(wram, MATRIX_TURN_TARGET)) {
    const next = (direction + step) & DIRECTION_MASK;
    setWord(wram, MATRIX_DIRECTION, next);
    setPersonaAnimation(m, m.tables.facePictures(entryOf(next)));
    return;
  }
  setWord(wram, MATRIX_STATE, MATRIX_STATE_CONTROL);
  setWord(wram, MATRIX_STATE_FRAMES, 1);
}
// Hit state: blink every other frame until the blink steps run out (81:BD0D).
function blinkPersona(m) {
  const { wram } = m;
  setPersonaAnimation(m, m.tables.facePictures(entryOf(word(wram, MATRIX_DIRECTION))));
  if (word(wram, wramOffset(WRAM + RANDOM_STATE)) & 1) return;
  const blink = (word(wram, MATRIX_BLINK) - 1) & WORD_MASK;
  setWord(wram, MATRIX_BLINK, blink);
  if (!(blink & WORD_SIGN)) {
    setWord(wram, MATRIX_OBJECT_FLAGS, word(wram, MATRIX_OBJECT_FLAGS) ^ MATRIX_OBJECT_SHOWN);
    return;
  }
  setWord(wram, MATRIX_STATE, MATRIX_STATE_CONTROL);
  setWord(wram, MATRIX_OBJECT_FLAGS, word(wram, MATRIX_OBJECT_FLAGS) | MATRIX_OBJECT_SHOWN);
  setWord(wram, MATRIX_STATE_FRAMES, 1);
}
// The persona's state runs whenever its frame clock runs out (81:BD44).
export function stepPersona(m) {
  const { wram } = m,
    clock = (word(wram, MATRIX_STATE_CLOCK) - 1) & WORD_MASK;
  setWord(wram, MATRIX_STATE_CLOCK, clock);
  if (clock !== 0) return;
  setWord(wram, MATRIX_STATE_CLOCK, word(wram, MATRIX_STATE_FRAMES));
  const state = word(wram, MATRIX_STATE);
  if (state === ENTER_CONTROL) setWord(wram, MATRIX_STATE, MATRIX_STATE_CONTROL);
  else if (state === MATRIX_STATE_CONTROL) controlPersona(m);
  else if (state === MATRIX_STATE_TRACK) runOnTrack(m);
  else if (state === MATRIX_STATE_TURN_RIGHT) turnPersona(m, DIRECTION_TURN_STEP);
  else if (state === MATRIX_STATE_TURN_LEFT) turnPersona(m, -DIRECTION_TURN_STEP);
  else if (state === MATRIX_STATE_HIT) blinkPersona(m);
  else taskStop('matrix_control_dispatch_frontier', { pc: 0x81bd52, index: state });
}

// ---- Actions on the node ahead ----

// The tile one step ahead of the persona when A or B was just pressed on a grid
// point in the control state; null otherwise.
function tileAheadOnPress(m, button) {
  const { wram } = m;
  if (word(wram, MATRIX_STATE) !== MATRIX_STATE_CONTROL || !onGrid(wram)) return null;
  if (!(word(wram, PAD_PRESSED) & button)) return null;
  return readTile(m, PERSONA, m.tables.mapSteps(entryOf(word(wram, MATRIX_DIRECTION))));
}
// Write a node's new value on the map and on screen.
function changeNodeAhead(m, value) {
  const t = m.tables,
    direction = entryOf(word(m.wram, MATRIX_DIRECTION));
  writeTile(m, PERSONA, t.mapSteps(direction), value);
  showMapEdit(m, PERSONA, t.tileSteps(direction), NODE_PALETTE | value);
}
// B: health cost on 07, gates at the CPU node, password check, IC combat or the
// guard IC of a taken data node (81:C111).
export function useNodeAhead(m) {
  const { wram } = m,
    t = m.tables,
    tile = tileAheadOnPress(m, PAD_B);
  if (tile === null) return;
  if (tile === NODE_COSTS_HEALTH) {
    takeDamage(m, 1);
    return;
  }
  if (tile === NODE_CPU) {
    if (openGatesAroundPersona(m) !== 0) {
      queueText(m, TEXT_COMBAT);
      queueText(m, TEXT_LINES_OPENED);
    }
    return;
  }
  if (tile >= PASSWORD_FIRST && tile < CPU_END) {
    if (!(word(wram, MATRIX_CPU_BITS) & t.bits(tile - NODE_CPU))) queueText(m, TEXT_PASSWORD);
    return;
  }
  if (isIc(tile)) {
    setWord(wram, MATRIX_FOUGHT_IC, tile);
    queueText(m, TEXT_COMBAT);
    const draw = m.random(COMBAT_RANGE);
    if ((draw - (wram[DECKER_COMPUTER_SKILL] & BYTE_MASK)) & WORD_SIGN) {
      const direction = entryOf(word(wram, MATRIX_DIRECTION));
      addObject(
        m,
        (word(wram, MATRIX_PERSONA_X) + t.aheadX(direction)) & WORD_MASK,
        (word(wram, MATRIX_PERSONA_Y) + t.aheadY(direction)) & WORD_MASK,
        OBJECT_IC,
      );
      queueText(m, TEXT_COMBAT_WON);
      return;
    }
    const strike = t.damage(word(wram, MATRIX_FOUGHT_IC) - IC_FIRST);
    takeDamage(m, (m.random(strike) + 1) & WORD_MASK);
    queueText(m, TEXT_COMBAT_LOST);
    return;
  }
  if (tile !== NODE_DATA_TAKEN && (tile < DATA_FIRST || tile >= DATA_END)) return;
  const bit =
    tile === NODE_DATA_TAKEN
      ? t.amounts10(TAKEN_NODE_BITS_LOW) | (t.amounts10(TAKEN_NODE_BITS_HIGH) << BYTE_BITS)
      : t.bits(tile - DATA_FIRST);
  setWord(wram, MATRIX_DATA_BITS, word(wram, MATRIX_DATA_BITS) | bit);
  changeNodeAhead(m, NODE_GUARD_DOWN);
  queueText(m, TEXT_COMBAT);
  if (dropRoomIcs(m) !== 0) queueText(m, TEXT_GUARD_DESTROYED);
}
// Add a download of size to the deck memory; returns true (and says so) when it does
// not fit (81:C25C).
function storeDownload(m, size) {
  const { wram } = m;
  let memory = ((size & BYTE_MASK) + word(wram, MATRIX_MEMORY)) & WORD_MASK;
  if (memory >= word(wram, MATRIX_MEMORY_LIMIT)) memory = MEMORY_MAX;
  if (memory >= MEMORY_MAX) {
    queueText(m, TEXT_OUT_OF_STORAGE);
    return true;
  }
  setWord(wram, MATRIX_MEMORY, memory);
  queueText(m, TEXT_TRANSFER);
  return false;
}
// A: read the CPU memory, take a data node or download one; a download can open
// lines (81:C28C).
export function readNodeAhead(m) {
  const { wram } = m,
    t = m.tables,
    tile = tileAheadOnPress(m, PAD_A);
  if (tile === null) return;
  if (tile >= NODE_CPU && tile < CPU_END) {
    if (!storeDownload(m, CPU_PROGRAM_MEMORY)) queueText(m, TEXT_PHONEBOOK);
    return;
  }
  if (tile < DATA_FIRST) return;
  if (tile < DATA_END) {
    const index = tile - DATA_FIRST;
    setWord(wram, MATRIX_DATA_BITS, word(wram, MATRIX_DATA_BITS) | t.bits(index));
    if (storeDownload(m, t.amounts10(index))) return;
    changeNodeAhead(m, NODE_DATA_TAKEN);
    queueText(m, TEXT_PROGRAM_MODIFIED);
    return;
  }
  if (tile < DOWNLOAD_FIRST || tile >= DOWNLOAD_END) return;
  const index = tile - DOWNLOAD_FIRST,
    bit = t.bits(index);
  setWord(wram, MATRIX_DOWNLOAD_BITS, word(wram, MATRIX_DOWNLOAD_BITS) | bit);
  if (storeDownload(m, t.amounts18(index))) return;
  if (openNodeGates(m, bit) !== 0) queueText(m, TEXT_LINES_OPENED);
  changeNodeAhead(m, NODE_DOWNLOADED);
  queueText(m, TEXT_DATA_RECEIVED);
}
