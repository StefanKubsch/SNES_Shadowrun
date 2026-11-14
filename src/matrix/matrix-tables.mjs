// The matrix control tables of bank 81 as named data (docs/MATRIX-LIFT.md). The
// names, places and meanings are those of src/data/tables.mjs; the tables are
// decoded once from the loaded image, so edited table assets apply. The lifted
// code takes entries by index instead of reading bytes at an address.
//
// An index outside a table (an odd or too large heading, a cell without a side
// of value 07) stops at a frontier: the original would read on into the bytes
// behind the table, which the game never does.
import { taskStop } from '../task/plan.mjs';
import { MATRIX_ANIMATIONS, MATRIX_ANIMATIONS_END } from '../data/tables.mjs';
import { decodeOnce, tableEntries } from '../data/named-tables.mjs';
import { BYTE_BITS, WORD_MASK } from '../constants/bits.mjs';

// Lifted name: table name in LOOKUP_TABLES.
const NAMES = {
  damage: 'matrix_damage',
  pushX: 'matrix_push_x',
  pushY: 'matrix_push_y',
  tileSteps: 'matrix_tile_steps',
  mapSteps: 'matrix_map_steps',
  stepX: 'matrix_step_x',
  stepY: 'matrix_step_y',
  fastX: 'matrix_fast_x',
  fastY: 'matrix_fast_y',
  movePictures: 'matrix_move_pictures',
  facePictures: 'matrix_face_pictures',
  trackStop: 'matrix_track_stop',
  trackTurn1: 'matrix_track_turn1',
  trackTurn2: 'matrix_track_turn2',
  trackTurn1Direction: 'matrix_track_turn1_direction',
  trackTurn2Direction: 'matrix_track_turn2_direction',
  aheadX: 'matrix_ahead_x',
  aheadY: 'matrix_ahead_y',
  bits: 'matrix_bits',
  amounts10: 'matrix_amounts_10',
  amounts18: 'matrix_amounts_18',
  cellColumns: 'matrix_cell_columns',
  cellRows: 'matrix_cell_rows',
  sideOffsets: 'matrix_side_offsets',
  sideX: 'matrix_side_x',
  sideY: 'matrix_side_y',
  sideValues: 'matrix_side_values',
  sideKinds: 'matrix_side_kinds',
  objectMarks: 'matrix_object_marks',
  neighbourOffsets: 'matrix_neighbour_offsets',
  oamXBits: 'matrix_oam_x_bits',
  blinkColours: 'matrix_blink_colors',
};
const ANIMATION_BANK = MATRIX_ANIMATIONS & ~WORD_MASK;

// A table as a function of the entry index; entries are words (signed values in
// two's complement, as the code adds them) or bytes.
function table(name, values) {
  return (index) => {
    const value = values[index];
    if (value === undefined) taskStop('matrix_table_index_frontier', { table: name, index });
    return value;
  };
}
function decode(mem) {
  const tables = {};
  for (const [key, name] of Object.entries(NAMES))
    tables[key] = table(name, tableEntries(mem, name));
  // The animation lists 81:BE69-BEC2 as one run of words (pictures, FFFF repeat,
  // FFFE stop); an object's list word and step address a word in it.
  const words = [];
  for (let at = MATRIX_ANIMATIONS; at < MATRIX_ANIMATIONS_END; at += 2)
    words.push(mem.read8(at) | (mem.read8(at + 1) << BYTE_BITS));
  const animationWords = table('matrix_animations', words);
  tables.animation = (list, step) =>
    animationWords((((ANIMATION_BANK | list) + step - MATRIX_ANIMATIONS) & WORD_MASK) / 2);
  return Object.freeze(tables);
}

// Decoded once per loaded image.
export const matrixTables = (mem) => decodeOnce(mem, 'matrix', decode);
// The entry of a table by heading (0 up, 2 diagonal, 4 right, ..., 14) or by a
// word offset: one entry per word.
export const entryOf = (offset) => offset / 2;
