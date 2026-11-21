// Scene geometry, room transitions, palettes and the shared saved byte store.
// Wall, grid and record spans stop at their adjacent original owners. Overflows
// retain aliases through the shared byte boundary, without new capacity guards.
// Actor records, leader attributes, topics and script variables keep their fixed
// save format; their live storage is independent of the raw compatibility bytes.
import * as W from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';
const field = (base, count = 1, bytes = 2, stride = bytes) =>
  Object.freeze({ base, count, bytes, stride });
export const SCENE_ROOM_FIELDS = Object.freeze({
  playerObject: field(W.PLAYER_OBJECT),
  request: field(W.SCENE_REQUEST),
  argument: field(W.SCENE_REQUEST_ARGUMENT),
  room: field(W.ROOM),
  storyStage: field(W.STORY_STAGE),
  reload: field(W.MAIN_LOOP_RELOAD),
  exit: field(W.MAIN_LOOP_EXIT),
  timer: field(W.TIMER),
  timerFrames: field(W.TIMER_FRAMES),
  enteredObject: field(W.ENTERED_OBJECT),
  enteredFlags: field(W.ENTERED_OBJECT_FLAGS),
  paletteUpload: field(W.SCENE_PALETTE_UPLOAD),
  paletteCount: field(W.SCENE_PALETTE_COUNT),
  backdrop: field(W.SCENE_BACKDROP),
  tileQuarter: field(W.TILE_QUARTER_OFFSET),
  paletteEnd: field(W.PALETTE_SLOT_END),
  paletteRequestPointer: field(W.PALETTE_REQUEST_POINTER),
  paletteRequestSlot: field(W.PALETTE_REQUEST_SLOT),
  objectPaletteBytes: field(W.PALETTE_UPLOAD_LIST_BYTES),
  colourRequest: field(W.COLOUR_REQUEST),
  colourPhase: field(W.COLOUR_PHASE),
  saveHeader: field(W.SAVE_STATE_START),
  karma: field(W.KARMA),
  shapeGrid: field(W.SHAPE_GRID - W.WRAM, W.SHAPE_GRID_BYTES / 2),
  record: field(W.SCENE_RECORD - W.WRAM, W.COLLISION_BOX_OBJECT - W.SCENE_RECORD, 1),
  wallMap: field(W.WALL_MAP - W.WRAM, W.WALL_MAP_BYTES / 2),
  wallHeights: field(W.WALL_HEIGHTS - W.WRAM, (W.WALL_TILES - W.WALL_HEIGHTS) / 2),
  wallTiles: field(W.WALL_TILES - W.WRAM, (W.TILE_STACK_HEADS - W.WALL_TILES) / 2),
  paletteSlots: field(W.SCENE_PALETTE_SLOTS - W.WRAM, (W.SCENE_PALETTE_LAST + 2) / 2),
  paletteList: field(W.SCENE_PALETTE_LIST, (W.SCENE_PALETTE_UPLOAD - W.SCENE_PALETTE_LIST) / 2),
  tileCompose: field(W.TILE_COMPOSE, W.SCENE_PALETTE_LIST - W.TILE_COMPOSE, 1),
  occlusionMasks: field(W.OCCLUSION_MASKS, (W.OCCLUSION_TILES - W.OCCLUSION_MASKS) / 2),
  occlusionTiles: field(W.OCCLUSION_TILES, (W.ENTERED_OBJECT - W.OCCLUSION_TILES) / 2),
  paletteStep: field(W.PALETTE_STEP, 2),
  paletteProgress: field(W.PALETTE_PROGRESS, 2),
  paletteDirection: field(W.PALETTE_DIRECTION, 2),
  paletteBytes: field(W.PALETTE_BYTES, 2),
  paletteTable: field(W.PALETTE_TABLE, 2),
  cycleCount: field(W.PALETTE_COUNT, 2),
  paletteIndex: field(W.PALETTE_INDEX, 2),
  objectPaletteList: field(W.PALETTE_UPLOAD_LIST, (W.PALETTE_SLOTS - W.PALETTE_UPLOAD_LIST) / 2),
  objectPaletteSlots: field(W.PALETTE_SLOTS, W.OBJECT_PALETTE_COUNT),
  actorRecords: field(
    W.GROUP_POSITIONS + (W.GROUP_NUMBERS - W.GROUP_OBJECTS),
    W.SCRIPT_VARIABLES - (W.GROUP_POSITIONS + (W.GROUP_NUMBERS - W.GROUP_OBJECTS)),
    1,
  ),
  scriptVariables: field(W.SCRIPT_VARIABLES, (W.JAKE_BODY - W.SCRIPT_VARIABLES) / 2),
  leaderRecord: field(W.JAKE_BODY, W.NUYEN - W.JAKE_BODY, 1),
  funds: field(W.NUYEN, 2),
  leaderFlags: field(
    W.JAKE_ALTERNATE_PORTRAIT,
    W.SELECTED_SPELL_LEVEL_POINTER - W.JAKE_ALTERNATE_PORTRAIT,
    1,
  ),
  spells: field(W.SPELL_LIST, (W.RUNNER_ARMOUR - W.SPELL_LIST) / 2),
  topics: field(W.TOPIC_LIST, W.TOPIC_FLAGS - W.TOPIC_LIST, 1),
  topicFlags: field(W.TOPIC_FLAGS, W.OAM_BUFFER - W.TOPIC_FLAGS, 1),
});
const tables = new WeakMap(),
  byteFields = [];
for (const [name, { base, count, bytes, stride }] of Object.entries(SCENE_ROOM_FIELDS))
  for (let index = 0; index < count; index++)
    for (let byte = 0; byte < bytes; byte++)
      byteFields[base + index * stride + byte] = { name, index, shift: byte * BYTE_BITS };
export const sceneRoomState = (wram) => tables.get(wram);
export function detachSceneRoom(wram) {
  let table = tables.get(wram);
  if (!table) {
    table = {};
    for (const [name, { base, count, bytes, stride }] of Object.entries(SCENE_ROOM_FIELDS)) {
      const values = bytes === 1 ? new Uint8Array(count) : new Uint16Array(count);
      for (let i = 0; i < count; i++)
        values[i] =
          wram[base + i * stride] | (bytes === 2 ? wram[base + i * stride + 1] << BYTE_BITS : 0);
      table[name] = values;
    }
    tables.set(wram, table);
  }
  return table;
}
export function sceneRoomByte(wram, at) {
  const table = tables.get(wram),
    f = table && byteFields[at];
  return f ? (table[f.name][f.index] >>> f.shift) & BYTE_MASK : undefined;
}
export function setSceneRoomByte(wram, at, value) {
  const table = tables.get(wram),
    f = table && byteFields[at];
  if (!f) return false;
  const values = table[f.name],
    mask = BYTE_MASK << f.shift;
  values[f.index] = (values[f.index] & ~mask) | ((value & BYTE_MASK) << f.shift);
  return true;
}
