// Named WRAM addresses of the original game state, as offsets into bank $7E.
// Task modules use them with h.abs(NAME) and, for long addresses, WRAM + NAME.
// Only fields whose meaning is established by a documented reader or writer
// are named (sources: the module comments in src/task, src/data/runners.mjs,
// src/data/actors.mjs, src/data/actions.mjs and src/data/tables.mjs).
// Scheduler tables stay in src/vm/layout.mjs.

/** Long address of WRAM offset 0. */
export const WRAM = 0x7e0000;

// Long selection pointer used by D02F for runner records and by 8EDA for the
// selected spell level. D02F stores only the bank byte; 8EDA stores a word.
export const DP_SELECTION_POINTER = 0xa2;
export const DP_SELECTION_POINTER_BANK = 0xa4;

// Room point list loaded by 80:A4BF and reread by the waypoint motion natives.
export const DP_POINT_LIST = 0xf3;
export const DP_POINT_LIST_BANK = 0xf5;

// Input (80:9E1A).
export const PAD_HELD = 0x01ca; // joypad bits currently held
export const PAD_PREVIOUS = 0x01cc; // previous held word used to compute newly pressed bits
export const PAD_PRESSED = 0x01ce; // joypad bits newly pressed this frame
// Button bits of these words (src/browser/controls.mjs BUTTONS).
export const PAD_B = 0x8000;
export const PAD_Y = 0x4000;
export const PAD_SELECT = 0x2000;
export const PAD_START = 0x1000;
export const PAD_DIRECTIONS = 0x0f00; // up, down, left, right
export const PAD_UP = 0x0800;
export const PAD_DOWN = 0x0400;
export const PAD_A = 0x0080;
export const PAD_X = 0x0040;
export const PAD_L = 0x0020;
export const PAD_R = 0x0010;

// Interrupt setup (81:EB7B/EB89, 80:C109) and native NMI handler (00:C112).
export const NMITIMEN_SHADOW = 0x0030; // saved value written to NMITIMEN
export const NMI_CALLBACK = 0x006e; // long callback pointer installed by C109
export const NMI_CALLBACK_BANK = 0x0070;
export const NMI_SAVED_A = 0x1c78;
export const NMI_SAVED_STACK = 0x1c7a;
export const NMI_STACK_TOP = 0x1cbb;

// Text DMA requests consumed and cleared by 81:A9E1 (main-initialize.mjs).
export const TEXT_TILE_UPLOAD = 0x01f6;
export const TEXT_MAP_UPLOAD = 0x01f8;
export const TEXT_BUFFER_UPLOAD = 0x01fa;
export const TEXT_BUFFER_READBACK = 0x01fc;
// Scene fade byte written to INIDISP by 81:D479 (main-scene-wait.mjs); it steps by one per
// frame toward SCENE_BRIGHTNESS_TARGET.
export const SCENE_BRIGHTNESS = 0x11a3;
export const SCENE_BRIGHTNESS_TARGET = 0x11a2;
// Shared cutscene direct page (81:CDF8, CF72 and D479): BG1 vertical scroll,
// BG2 speed with its step/target and fixed-point position, and the scene/mirror word.
export const DP_CUTSCENE_SCROLL_Y = 0x14;
export const DP_CUTSCENE_SPEED = 0x16;
export const DP_CUTSCENE_SPEED_STEP = 0x18;
export const DP_CUTSCENE_SPEED_TARGET = 0x1a;
export const DP_CUTSCENE_POSITION = 0x1c;
export const DP_CUTSCENE_SCENE = 0x1e;
// Cutscenes of 81:CDF8 (src/cutscene/cutscene-animation.mjs): its X argument and that argument plus or
// minus one (81:D146, D153), the step of the scene animation (also the read offset of the
// credits text) and a counter (the BG2 vertical scroll of D146/D153, the page timer of the
// credits 81:D1F0).
export const SCENE_ARGUMENT = 0x115e;
export const SCENE_ARGUMENT_MOVED = 0x1160;
export const SCENE_ANIMATION_STEP = 0x119e;
export const SCENE_COUNTER = 0x11a0;

// Glove cursor (80:BC36, BC67, BCB2, BE6D).
export const GLOVE_SPEED_X = 0x01d0; // signed glove speed words (80:BE6D)
export const GLOVE_SPEED_Y = 0x01d2;
export const GLOVE_X = 0x01d4; // glove position word, high byte the screen pixel
export const GLOVE_Y = 0x01d6;
export const GLOVE_SCREEN_X = 0x01d5; // OAM byte of the glove sprite (game NMI)
export const GLOVE_SCREEN_Y = 0x01d7;
export const GLOVE_KIND = 0x01d8; // 0 closed, FFFF action glove, FFFD spell glove
export const GLOVE_TARGET_TAG = 0x01da; // negative: no object under the glove
export const GLOVE_TARGET_OBJECT = 0x01de; // object slot under the glove
export const GLOVE_SNAP_X = 0x01e0; // glove offset from the marked object (80:BCBE)
export const GLOVE_SNAP_Y = 0x01e2;
export const GLOVE_BASE_X = 0x01e4; // projection bases of the glove kind (BC67/BC80/BC99)
export const GLOVE_BASE_Y = 0x01e6;
export const GLOVE_LIMIT_KIND = 0x01e8; // copy of the glove kind
export const GLOVE_NAME_WINDOW = 0x01dc; // name window of the glove target (80:BE29), freed by BE5B

// Player and camera.
export const PLAYER_OBJECT = 0x0cc2; // slot of the player figure (the leader)
// Zone gate 80:8000/803B: the two lists at [9D], player coordinates divided by four,
// list selector (0: scripts, 1: scene changes) and the remaining zone count.
export const DP_ZONE_LIST = 0x9d;
export const DP_ZONE_X = 0x0e;
export const DP_ZONE_Y = 0x11;
export const DP_ZONE_HEIGHT = 0x14;
export const DP_ZONE_LIST_INDEX = 0x17;
export const DP_ZONE_COUNT = 0x1a;
export const CAMERA_X = 0x0cc4;
export const CAMERA_Y = 0x0cc6;
// Camera speeds set by 81:8C2E and the map rows or columns waiting for the game NMI
// (81:8954 uploads a column with VMAINC step 32, a row with step 1); a nonzero hold
// word keeps the NMI from uploading them (81:8949).
export const CAMERA_SPEED_X = 0x0cc8;
export const CAMERA_SPEED_Y = 0x0cca;
export const MAP_COLUMN_UPLOAD = 0x0cd0;
export const MAP_ROW_UPLOAD = 0x0cd6;
export const MAP_UPLOAD_HELD = 0x0cd8;
// The column and row words 81:8A91 copies for 81:8954 (0x40 bytes each, from
// SCENE_LAYER_HIGH for BG1 and SCENE_LAYER_LOW for BG2) and their VRAM word addresses.
export const MAP_COLUMN_BG1 = 0x2d60;
export const MAP_COLUMN_BG2 = 0x2da0;
export const MAP_ROW_BG1 = 0x2ce0;
export const MAP_ROW_BG2 = 0x2d20;
export const MAP_LINE_BYTES = 0x40;
export const MAP_COLUMN_VRAM_BG1 = 0x0ccc;
export const MAP_COLUMN_VRAM_BG2 = 0x0cce;
export const MAP_ROW_VRAM_BG1 = 0x0cd2;
export const MAP_ROW_VRAM_BG2 = 0x0cd4;
// Camera limits of 80:A464 and 81:8A91.
export const CAMERA_X_MAX = 0x800;
export const CAMERA_Y_MAX = 0x47c;
// Long pointer to the camera box of the room minus 1 (80:A4BF, 81:8A05); a zero word at
// CAMERA_BOX_HIGH (its high byte and bank) means no box.
export const CAMERA_BOX = 0x0cda;
export const CAMERA_BOX_HIGH = 0x0cdb;
export const CAMERA_BOX_BANK = 0x0cdc;
// Ring buffer of the player figure's positions (80:BAD5): the last written word index
// and per entry X, Y, height and direction (bank 7E, FORMATION_LAST + 2 bytes each).
export const FORMATION_INDEX = 0x0d18;
export const FORMATION_X = 0x44a8;
export const FORMATION_Y = 0x4528;
export const FORMATION_HEIGHT = 0x45a8;
export const FORMATION_DIRECTION = 0x4628;
export const FORMATION_LAST = 0x7e;
// FFFF when 80:BAD5 found the player figure unmoved, 0 after it wrote a new entry.
export const FORMATION_UNMOVED = 0x0d1a;
// Scene palettes (81:8CE0, 80:999A): the upload request, the number of palettes, their
// list and the slot of each scene palette in bank 7F (negative: none; 81:8CB9 clears
// the word indices 0 to SCENE_PALETTE_LAST).
export const SCENE_PALETTE_UPLOAD = 0x0d0e;
export const SCENE_PALETTE_COUNT = 0x0d10;
export const SCENE_PALETTE_SLOTS = 0x7fc980;
export const SCENE_PALETTE_LAST = 0x92;
export const SCENE_PALETTE_LIST = 0x0cfe;
// Backdrop colour of the scene record, sent by the NMI to CGRAM colour 0 (80:999A).
export const SCENE_BACKDROP = 0x0d12;

// Scene build of 81:A117 (src/data/scenes.mjs, src/data/tilesets.mjs). The unpacked
// scene record; the shape grid of block numbers (0x80 bytes per row, the first
// SHAPE_GRID_HIDDEN_ROWS rows are not drawn); the two tile layers of 64 x 96 tile words
// (0x80 bytes per tile row), the first without, the second with TILE_PRIORITY.
export const SCENE_RECORD = 0x7fda14;
export const SHAPE_GRID = 0x7fca14;
export const SHAPE_GRID_BYTES = 0x1000;
export const SHAPE_GRID_ROW_BYTES = 0x80;
export const SHAPE_GRID_HIDDEN_ROWS = 8;
export const SCENE_LAYER_LOW = 0x76a8;
export const SCENE_LAYER_HIGH = 0x46a8;
export const SCENE_LAYER_BYTES = 0x3000;
export const SCENE_LAYER_ROW_BYTES = 0x80;
// Tile stacks interned by 81:8E57 (bank 7E, one word per entry, 0x400 entries): the
// three stacked tile words, the next and previous entry of the hash chain (the previous
// of a chain head is its bucket offset | 8000), the use count (FFFF: free), the stack of
// free entries and, in bank 7F, the 256 hash chain heads (negative: empty).
export const TILE_STACK_FIRST = 0xa6a8;
export const TILE_STACK_SECOND = 0xaea8;
export const TILE_STACK_THIRD = 0xb6a8;
export const TILE_STACK_NEXT = 0xbea8;
export const TILE_STACK_PREVIOUS = 0xc6a8;
export const TILE_STACK_USES = 0xcea8;
export const TILE_STACK_FREE = 0xd6a8;
export const TILE_STACK_LAST = 0x7fe;
export const TILE_STACK_HEADS = 0x7fc780;
export const TILE_STACK_HEAD_LAST = 0x1fe;
// Cache of unpacked tile streams (81:A1BC, A1E1, A243; bank 7E): 64 entries, most recently
// used first, with their stream keys (FFFF: free), the next entry and 128 data bytes each.
// TILE_CACHE_NEXT shares its first word with STATIC_BOX_END of the collision grid.
export const TILE_CACHE_KEYS = 0xdf28;
export const TILE_CACHE_NEXT = 0xdea8;
export const TILE_CACHE_DATA = 0xdfa8;
export const TILE_CACHE_LAST = 0x7e;
// Byte offset of the wanted 32-byte tile in its stream (81:A1E1) and the 32-byte buffer in
// which 81:9AE6 composes a tile and its overlays before sending it to VRAM.
export const TILE_QUARTER_OFFSET = 0x0d16;
export const TILE_COMPOSE = 0x0cde;
// Wall map of bank 7F (81:902D, 81:940A; read by native-sprite-occlusion.mjs): one word
// per four cells of six bytes (negative: no walls), the cell heights and the wall tiles of
// three layers per cell.
export const WALL_MAP = 0x7f0000;
export const WALL_MAP_BYTES = 0xc00;
export const WALL_HEIGHTS = 0x7f0c00;
export const WALL_TILES = 0x7f69c0;
export const WALL_CELL_BYTES = 6;
export const WALL_WORD_CELLS = 4;
// Direct page of the scene build shared by 81:A117 and its routines
// (main-scene-load.mjs, main-scene-layers.mjs): the long pointer into the scene record
// (bank DP10), a count, the next free wall cell record (81:902D clears it, 81:903E
// takes four cells at a time), the target layer and the bits added to its tile words,
// the three tile words for 81:8E57 and the free stack pointer of the tile stacks.
export const DP_SCENE_RECORD = 0x0e;
export const DP_SCENE_RECORD_BANK = 0x10;
export const DP_SCENE_COUNT = 0x17;
export const DP_WALL_NEXT = 0x23;
export const DP_SCENE_LAYER = 0x5c;
export const DP_SCENE_LAYER_BITS = 0x65;
export const DP_TILE_FIRST = 0x1a;
export const DP_TILE_SECOND = 0x1c;
export const DP_TILE_THIRD = 0x1e;
export const DP_TILE_FREE = 0x20;
// Depth byte mode of an object graphic (81:903E): 0 reads a depth byte for every cell;
// 7FFE (counted up per cell) reads one only for the first cell of each row.
export const GRAPHIC_DEPTH_MODE = 0x0d14;

// VRAM tile slots of the objects (80:ADF4).
export const VRAM_SLOT_COUNT = 0x0d1c;
export const VRAM_SLOT_FREE_LIST = 0x0d1e;
export const VRAM_SLOT_NEXT = 0x1564; // next VRAM slot of an object's chain or the free list
// Outside the scenes the same words hold the colour 81:EB97 fills CGRAM with (cleared
// after) and the colour shadow the palette copy 81:ECF2 writes beside CGRAM.
export const CLEAR_COLOUR = 0x0d1c;
export const CLEAR_COLOUR_HIGH = 0x0d1d;
export const PALETTE_SHADOW = 0x0d1e;

// Object arrays, one word per object slot (index = slot offset).
export const OBJECT_VELOCITY_X = 0x0d20;
export const OBJECT_VELOCITY_Y = 0x0d78;
export const OBJECT_VELOCITY_Z = 0x0dd0;
export const OBJECT_X = 0x0e28;
export const OBJECT_Y = 0x0e80;
export const OBJECT_HEIGHT = 0x0ed8;
export const OBJECT_DIAGONAL = 0x0f30; // (OBJECT_X + OBJECT_Y) >> 1 (docs/reference/movement.md)
export const OBJECT_ACTION_DIRECTIONS = 0x1090; // action record + 8, 0: no picture (docs/ROM-FREE.md)
export const OBJECT_DEPTH_RULE = 0x0f88; // compare rule of the depth sort (80:B0E3/B126 tables)
// Signed byte times four, set by 80:AC2F; the depth rules add it to the sort key (80:AFFC).
export const OBJECT_DEPTH_BIAS = 0x0fe0;
// Animation fields loaded from the action record by 80:A985 (docs/reference/slots.md) and
// stepped by 80:AC2F: speed (record byte 0) added to the clock (started at 80), the repeats
// left of the current frame word, its offset in the frame stream, the frame count (record
// byte 1 XOR 80), the palette (record byte 2) and the current picture (0: not drawn).
export const OBJECT_ANIMATION_SPEED = 0x4088;
export const OBJECT_ANIMATION_CLOCK = 0x4030;
export const ANIMATION_CLOCK_START = 0x80;
export const OBJECT_FRAME_REPEATS = 0x3fd8;
export const OBJECT_FRAME_OFFSET = 0x11f0;
export const OBJECT_FRAME_COUNT = 0x10e8;
export const OBJECT_PALETTE = 0x1248;
export const OBJECT_PICTURE = 0x3f80;
export const OBJECT_SELECTION = 0x1038; // FFFF none; bit 15 set when an animation ends
export const OBJECT_PICTURE_CHANGE = 0x1140; // 0 normal, FFFF restart, else a picture pointer
export const OBJECT_DIRECTION = 0x1198; // low byte: facing direction
export const OBJECT_VRAM_SLOT_COUNT = 0x12a0;
export const OBJECT_VRAM_SLOT_HEAD = 0x12f8;
export const OBJECT_TASK = 0x1350; // task slot of the object, negative: none
export const NO_TASK = 0xffff; // task slot value for "no task" (objects and task links)
export const OBJECT_RECORD = 0x13a8; // pointer to the record of the object, 0: none
export const OBJECT_DEPTH_ORDER = 0x1400; // bits 0 and 15: drawn in front of or behind all
// D17B reads these mode bits; D16D/D0D3 preserve every other bit when replacing them.
export const OBJECT_DEPTH_MODE_MASK = 0x8001;
export const OBJECT_DEPTH_MODE_CLEAR_MASK = 0x7ffe;
export const OBJECT_FLAGS = 0x1458;
// Bits written by the OAM entry 80:B20A: bit 2 marks an object drawn on screen (the combat
// natives 80:8521 to 80:8E35 consider only such objects), bit 9 one covered by walls or
// drawn behind everything, bit 11 one off screen or hidden by walls. Bit 7 keeps an object
// out of the scene sprites (80:B8DE). Bit 12 marks one never chosen as a target.
export const OBJECT_ON_SCREEN = 0x0004;
export const OBJECT_NOT_DRAWN = 0x0080;
export const OBJECT_COVERED = 0x0200;
export const OBJECT_HIDDEN = 0x0800;
// Bits 0 and 1 hold a class read by the collision searches 81:85FE and 81:8686.
export const OBJECT_CLASS_MASK = 0x0003;
// Movement bits of 80:AB26 and 81:8799: bit 3 marks a move that was blocked and undone,
// bit 5 an object that falls (OBJECT_VELOCITY_Z decreases every frame), bit 6 an object
// whose moves are tested against the collision grid, bit 8 one that enters the grid.
export const OBJECT_BLOCKED = 0x0008;
export const OBJECT_FALLS = 0x0020;
export const OBJECT_COLLIDES = 0x0040;
export const OBJECT_IN_GRID = 0x0100;
export const OBJECT_NO_TARGET = 0x1000;
// Bit 4 marks an object attacked by the player (80:8A51); the hit 80:8691 damages only
// objects with bit 13 and counts hits on the others with bit 15 (HARMLESS_HITS);
// the blast 80:8E36 reaches only objects with bit 15.
export const OBJECT_ATTACKED = 0x0010;
// Bit 10: the object does not move (80:8E96 sets it, 80:8EB8 clears it, 80:AFC4 skips it).
export const OBJECT_HALTED = 0x0400;
export const OBJECT_DAMAGEABLE = 0x2000;
export const OBJECT_HITTABLE = 0x8000;
// Last word index of the 44 object slots (80:8E36 scans them downward).
export const OBJECT_LAST_SLOT = 0x56;
// WRAM record fields (OBJECT_RECORD), shared by the object and record-number natives:
// flags BYTE, count BYTE (item ammunition or a person's body) and property WORD.
// Some getters read a full WORD before masking to a BYTE; the field name does not
// prescribe access width. NativeC5/9D7A writes the original property reset value.
export const RECORD_FLAGS = 1;
export const RECORD_COUNT = 2;
export const RECORD_PROPERTY = 3;
export const RECORD_PROPERTY_RESET = 0x1538;
export const OBJECT_NUMBER = 0x150a;
export const OBJECT_KIND = 0x3f28; // index into the kind table 8C:EFB0
export const OBJECT_ARMOUR = 0x43f8; // armour rating
export const OBJECT_DIALOG = 0x4450; // dialog record started by the action glove
// Signed box extents from the action record header, added to X/4, Y/4 and
// height/4 by the collision prelude 81:8799 (docs/reference/movement.md).
export const OBJECT_BOX_X1 = 0x4240;
export const OBJECT_BOX_X2 = 0x4298;
export const OBJECT_BOX_Y1 = 0x42f0;
export const OBJECT_BOX_Y2 = 0x4348;
export const OBJECT_BOX_HEIGHT = 0x43a0;
export const MOTION_ACTIVE = 0x40e0; // motion target, see src/task/native-motion-*.mjs
export const MOTION_MODE = 0x4138;
export const MOTION_X = 0x4190;
export const MOTION_Y = 0x41e8;
// Motion modes as the script natives set them (80:C6BF..C7A1): 0 heads straight for the
// target (C913), 1 approaches it axis by axis (C84D). Object targets store X = 0 and
// the target object in Y. ACTIVE counts the frames to the next step; 1 starts the motion.
export const MOTION_STRAIGHT = 0;
export const MOTION_BY_AXES = 1;
export const MOTION_START = 1;

// Scene draw list (80:B8DE).
export const DRAW_LIST_INDEX = 0x14b0; // last word index
export const DRAW_LIST = 0x14b2;
// Last word index of the NMI VRAM upload records 1654/16D4 (81:A958), negative: none.
export const DP_VRAM_UPLOAD_INDEX = 0x82;
// The upload records themselves, one word per record: source bank, source address and
// VRAM word address, 0x40 bytes each (81:A958). The matrix reuses some of these
// words, for example MATRIX_HEALTH = VRAM_UPLOAD_ADDRESSES.
export const VRAM_UPLOAD_BANKS = 0x1654;
export const VRAM_UPLOAD_SOURCES = 0x16d4;
export const VRAM_UPLOAD_ADDRESSES = 0x1754;
export const VRAM_UPLOAD_BYTES = 0x40;
// Last word index of an empty list (DRAW_LIST_INDEX, DP_VRAM_UPLOAD_INDEX, WINDOW_LAST_INDEX).
export const EMPTY_LIST = 0xfffe;
// Collision grid of bank 7E (81:80F7 clears it, 81:846E links the boxes): the first node of
// each of the 256 map cells (negative: empty), per node its box offset and the next node,
// six words per box (x0, y0, bottom, x1, y1, top) and the object of each box (7F:E214 +
// box offset >> 2). A box coordinate holds its cell in the bits of CELL_COORDINATE_MASK.
export const COLLISION_CELL_HEADS = 0xe0ac;
export const COLLISION_NODE_BOX = 0xef3c;
export const COLLISION_NODE_NEXT = 0xf79c;
export const COLLISION_BOX_X0 = 0xe2ac;
export const COLLISION_BOX_Y0 = 0xe2ae;
export const COLLISION_BOX_BOTTOM = 0xe2b0;
export const COLLISION_BOX_X1 = 0xe2b2;
export const COLLISION_BOX_Y1 = 0xe2b4;
export const COLLISION_BOX_TOP = 0xe2b6;
export const COLLISION_BOX_OBJECT = 0x7fe214;
export const CELL_COORDINATE_MASK = 0x03c0;
export const COLLISION_CELLS = 0x100;
export const COLLISION_BOX_BYTES = 12;
// The static scene boxes (81:8756) come first; the boxes of the moving objects follow
// from box offset 0A74 (81:8799). The static grid keeps the first static node of each cell
// (negative: empty) and the node index behind the last static node, where 81:8799 continues.
export const MOVING_BOX_FIRST = 0x0a74;
export const STATIC_CELL_HEADS = 0xdeac;
export const STATIC_NODE_END = 0xdeaa;
// Box offset behind the last static box (81:8756 continues from it and stores it back).
export const STATIC_BOX_END = 0xdea8;
export const NMI_JOB_LISTS = 0x1562; // number of open NMI job lists

// Matrix (cyberspace, docs/ROM-FREE.md "Matrix rules seen"). The matrix reuses
// words of the object arrays and of the NMI job lists; the names below hold
// only while the matrix runs (81:B1B5 to 81:C3CA) and are used only there.
export const MATRIX_DIRECTION = 0x141c; // 0 up, 4 right, 8 down, 12 left
export const MATRIX_SPEED_X = 0x14a0;
export const MATRIX_SPEED_Y = 0x14e2;
export const MATRIX_PERSONA_X = 0x1524; // 8000: jacked out
export const MATRIX_PERSONA_Y = 0x1566;
export const MATRIX_ANIMATION = 0x15a8; // animation list set by 81:B8AD
// Matrix objects: 33 slots in word arrays 0x42 bytes apart, slot 0 is the persona;
// MATRIX_DIRECTION, the speeds, positions and MATRIX_ANIMATION are arrays of the same form.
export const MATRIX_OBJECT_TYPE = 0x1356; // 0: free slot (81:B8C8)
export const MATRIX_OBJECT_FLAGS = 0x1398;
export const MATRIX_OBJECT_PICTURE = 0x13da;
export const MATRIX_ANIMATION_STEP = 0x15ea;
export const MATRIX_ANIMATION_CLOCK = 0x162c;
export const MATRIX_ANIMATION_SPEED = 0x166e;
export const MATRIX_OBJECT_END = 0x42;
// Matrix message window on BG3 (81:B2A0 to 81:B3C8): characters per line, queued bytes of
// the current part, palette bits, write offset in the row buffer, line and line limit,
// BG3 scroll, VRAM cursor (OBJECT_TASK outside the matrix) and the cursor the NMI last
// marked, frames until the next character, and a ring of eight texts (pointer word, bank
// word) with its read and write offsets.
export const MATRIX_COLOUR_CYCLE_A = 0x133e; // colour steps of the matrix NMI 81:BEC3
export const MATRIX_COLOUR_CYCLE_B = 0x1340;
export const MATRIX_TEXT_COLUMNS = 0x1342;
export const MATRIX_TEXT_COUNT = 0x1344;
export const MATRIX_TEXT_PALETTE = 0x1346;
export const MATRIX_TEXT_FILL = 0x1348;
export const MATRIX_TEXT_LINE = 0x134a;
export const MATRIX_TEXT_LINES = 0x134c;
export const MATRIX_TEXT_SCROLL = 0x134e;
export const MATRIX_TEXT_CURSOR = 0x1350;
export const MATRIX_TEXT_CURSOR_SHOWN = 0x1352;
export const MATRIX_TEXT_DELAY = 0x1354;
export const MATRIX_TEXT_BUSY = 0x170e;
export const MATRIX_TEXT_QUEUE_END = 0x1710;
export const MATRIX_TEXT_QUEUE_START = 0x1712;
export const MATRIX_TEXT_QUEUE = 0x1714;
export const MATRIX_TEXT_QUEUE_BANK = 0x1716;
// C029 copies the FOUND X IC! template here; B959 writes a digit and space
// at byte 8. Its terminator at byte 14 precedes the scroll table at 7F:0150.
export const MATRIX_IC_TEXT_BUFFER = 0x7f0140;
export const MATRIX_IC_TEXT_COUNT = MATRIX_IC_TEXT_BUFFER + 8;
export const MATRIX_IC_TEXT_END = MATRIX_IC_TEXT_BUFFER + 14;
// Map column and row of the seven node tiles 21-27 (81:B4D3), BG scroll, the ring index of
// the map edits (81:B69D), the frames of the matrix state (81:BD44), the matrix VRAM DMA
// records (byte offset behind the last one, their count), the memory gauge shown (moves
// towards MATRIX_MEMORY; MATRIX_DEATH_COUNTER does the same towards MATRIX_HEALTH), the map
// of the system, and the message list queued on entering (81:C39F, table 81:C515).
export const MATRIX_NODE_COLUMNS = 0x16f2;
export const MATRIX_NODE_ROWS = 0x1700;
export const MATRIX_SCROLL_X = 0x1734;
export const MATRIX_SCROLL_Y = 0x1736;
// BG2 scrolls at half the BG1 scroll (matrix NMI 81:BEC3).
export const MATRIX_FAR_SCROLL_X = 0x1738;
export const MATRIX_FAR_SCROLL_Y = 0x173a;
export const MATRIX_MAP_EDIT = 0x173c;
export const MATRIX_STATE_CLOCK = 0x1740;
export const MATRIX_STATE_FRAMES = 0x1742;
export const MATRIX_DMA_END = 0x1748;
export const MATRIX_DMA_RECORDS = 0x174a;
export const MATRIX_MEMORY_SHOWN = 0x174e;
export const MATRIX_MAP = 0x175c;
export const MATRIX_MESSAGES = 0x1d90;
// Eight-byte VRAM DMA records from 113E (81:B1E2 pulls them with the stack in the matrix
// NMI): byte count, VMAINC value, source bank, source address, VRAM word address; a zero
// byte count ends the list. They overlap the OBJECT_PICTURE_CHANGE array.
export const DMA_RECORD_COUNT = 0x113e;
export const DMA_RECORD_VMAINC = 0x1140;
export const DMA_RECORD_BANK = 0x1141;
export const DMA_RECORD_SOURCE = 0x1142;
export const DMA_RECORD_VRAM = 0x1144;
export const DMA_RECORD_BYTES = 8;
export const MATRIX_STATE = 0x173e; // JSR ($BD56,X) at 81:BD52
// Matrix states (81:BD56): 0 starts and sets 2 (81:BA70); 2 takes pad input (81:BA77,
// C111 and C28C act only then); 4 runs along a path at the fast speed (81:BBF6); 6 and 8
// turn the persona clockwise or anticlockwise to MATRIX_TURN_TARGET (81:BCC3, BCE8); 0A
// blinks the persona after an IC strike (81:BD0D) until MATRIX_BLINK runs out. All return
// to 2.
export const MATRIX_STATE_CONTROL = 2;
export const MATRIX_STATE_TRACK = 4;
export const MATRIX_STATE_TURN_RIGHT = 6;
export const MATRIX_STATE_TURN_LEFT = 8;
export const MATRIX_STATE_HIT = 0xa;
export const MATRIX_TURN_TARGET = 0x145e; // direction the turn states end at
export const MATRIX_BLINK = 0x16b0; // blink steps left in MATRIX_STATE_HIT
// Object flag bit 0: the animation list still runs (cleared at its end word FFFE, 81:BD99).
export const MATRIX_OBJECT_ANIMATING = 1;
// Object flag bit 15: 81:BD99 places the object in OAM (the hit state blinks it).
export const MATRIX_OBJECT_SHOWN = 0x8000;
export const MATRIX_FOUGHT_IC = 0x1744; // map value of the IC COMBAT.EXE fights (81:C111)
export const MATRIX_IC_COUNTED = 0x1746; // nonzero: 81:B959 already announced the IC count
export const MATRIX_MEMORY_LIMIT = 0x174c; // the decker's memory, from 7E:1D8D
export const MATRIX_MEMORY = 0x1750; // memory used by downloads
export const MATRIX_DEATH_COUNTER = 0x1752; // counts down to 0 at health 0
export const MATRIX_HEALTH = 0x1754;
export const MATRIX_CPU_BITS = 0x1756; // one bit per CPU node
export const MATRIX_DATA_BITS = 0x1758; // data nodes 10 to 17
export const MATRIX_DOWNLOAD_BITS = 0x175a; // data nodes 18 to 1F
export const DECKER_HEALTH = 0x1d8b; // health copied back to the decker's record
export const DECKER_COMPUTER_SKILL = 0x1d8c;
export const DECKER_MEMORY = 0x1d8d; // 80:E30F sets 40; the matrix copies it to MATRIX_MEMORY_LIMIT
// Bytes 81:C3CA copies back after the matrix: MATRIX_DOWNLOAD_BITS and MATRIX_DATA_BITS.
export const DECKER_DOWNLOAD_BITS = 0x1d91;
export const DECKER_DATA_BITS = 0x1d92;
// WRAM record of the decker (stored by the native 80:E30F); 80:CC4B writes DECKER_HEALTH
// back to its RECORD_COUNT byte after the matrix.
export const DECKER_RECORD = 0x1d93;
export const MATRIX_EXTRA_NODES = 0x1d8e; // terminal argument, 2 adds nodes
export const MATRIX_SYSTEM = 0x1d8f; // map n at 7F:0216 + 800 n

// Random helpers (80:C51F/C560): two mixed state bytes, the last generated byte
// accessed through DBR, and the direct-page rejection mask of C51F.
export const RANDOM_STATE = 0x1c76;
export const RANDOM_STATE_HIGH = RANDOM_STATE + 1;
export const RANDOM_BYTE = 0x1ce8;
export const DP_RANDOM_MASK = 4;

// Palette animation requests (81:8076; docs/reference/render-routines.md#8076).
// Two word-indexed slots; a completed step publishes one request for 81:80C4.
export const PALETTE_STEP = 0x1cbe; // zero stops the update
export const PALETTE_PROGRESS = 0x1cc2;
export const PALETTE_DIRECTION = 0x1cc6; // bit 15 selects reverse
export const PALETTE_TABLE = 0x1cce;
export const PALETTE_COUNT = 0x1cd2;
export const PALETTE_BYTES = 0x1cca; // DMA length of one step (81:80C4)
export const PALETTE_INDEX = 0x1cd6;
export const PALETTE_REQUEST_POINTER = 0x1cda;
export const PALETTE_REQUEST_SLOT = 0x1cdc;
// Byte offset behind the last used slot (81:8000 clears it, 81:801A fills a slot).
export const PALETTE_SLOT_END = 0x1cbc;

// Scene, room and music.
export const MUSIC = 0x1cde; // current music mode (81:EF47)
export const MUSIC_FIGHT = 6; // mode set by 80:8521 when the first fighter joins
export const SOUND_LOADED_SET = 0x1ce0; // full sound word cached by 80:C46E before F130
export const SOUND_VOICE_MASK = 0x1ce2; // full X cached by C46E before command 0F
export const APU_COMMAND_TOKEN = 0x1ce4; // F007 command/acknowledgement token
export const MUSIC_MODE_BYTE = 0x1ce5; // F1FA mode-list match and return byte
export const APU_PAIR_PENDING = 0x1ce6; // F03A: zero buffers the first byte, nonzero sends the pair
export const APU_PAIR_FIRST_BYTE = 0x1ce7;
export const SCENE_REQUEST = 0x1ce9; // FFFE matrix, 7FFF room only, else a sequence
export const SCENE_REQUEST_MATRIX = 0xfffe;
export const SCENE_REQUEST_ROOM_ONLY = 0x7fff;
export const SCENE_REQUEST_ARGUMENT = 0x1ceb;
export const ROOM = 0x2de2; // entry in the room table 8D:929D
export const STORY_STAGE = 0x2de4; // actor flags are gated by it
export const DIALOG_END = 0x1d63; // FFFF ends the dialog or menu
export const DIALOG_WINDOW = 0x1d61; // window used by CDA8 and the AF1F bars
export const TIMER_FRAMES = 0x1d87; // countdown (80:E270)
export const TIMER = 0x1d89; // negative: no countdown
export const TIMER_STOPPED = 0xffff; // the value the stop native stores
export const MAIN_LOOP_RELOAD = 0x1fd8; // nonzero: reload the room (80:96ED)
export const MAIN_LOOP_EXIT = 0x1fda; // nonzero: leave the main loop (80:96E7)
export const MAIN_LOOP_REQUESTED = 0xffff; // the value natives store to raise either request

// Player control 80:E014 (reset by Native88, native-player-control-reset.mjs).
export const PLAYER_IDLE = 0x1d5b; // FFFF once the idle action was set without a direction
export const AIMING_WEAPON = 0x1d5d; // FFFF while the crosshair aims
export const AIMING_SPELL = 0x1d5f; // FFFF while the spell glove aims
export const AIM_TARGET_OBJECT = 0x1d67; // tagged object slot under the crosshair
export const AIM_ACTION_NEXT = 0x1d69; // the aiming action of E014 plus 1
export const GROUP_LEADER_ONLY = 0x1d6b; // nonzero: only group index 0 takes part
export const SCRIPT_GLOVE_CHOICE = 0x1d6d; // FFFF while 9BB9 or 9C33 chooses an object
export const SPELL_TARGET_OBJECT = 0x1fd2; // object slot chosen by the spell glove 9BD3

// Colour request of 81:8877 (docs/reference/render-routines.md#8877): bit 15
// resets, bit 0 flashes, bits 1 and 2 run the fast and slow ramp over 80:D3D1.
export const COLOUR_REQUEST = 0x1fdc;
export const COLOUR_PHASE = 0x1fde;
// Spell choice list of 80:E1CF: header Exit, then the spell names.
export const SPELL_CHOICE_HEADER = 0x1d73;
export const SPELL_CHOICE_NAMES = 0x1d75;

// Swarm work area 1CEF-1D59, shared by three programs: the path swarm (80:D7DD starts four
// members, 80:D85B moves them), the wave swarm (80:D260 starts twelve, 80:D2E7 moves them)
// and the circling leader (80:D604, 80:D63C) with the orbit phases (80:D796) and the bobbing
// objects (80:D714/D73B). Several words have one meaning per program.
export const SWARM_MEMBERS = 0x1cef; // member slots, the orbit phases of D604/D796
export const SWARM_FOUR_ORIGIN = 0x1cf7; // origin object of the path swarm (D7DD)
export const CIRCLE_FOLLOWERS = 0x1cff; // follower slots of the circling leader (D63C)
export const SWARM_TWELVE_ORIGIN = 0x1d07; // origin object of the wave swarm (D260)
export const SWARM_ORIGIN_X = 0x1d0b;
export const SWARM_ORIGIN_Y = 0x1d0d;
export const SWARM_ORIGIN_HEIGHT = 0x1d0f;
export const WAVE_TARGET_X = 0x1d17;
export const WAVE_TARGET_Y = 0x1d19;
export const WAVE_TARGET_HEIGHT = 0x1d1b;
export const SWARM_X = 0x1d23; // running position of D85B and D2E7
export const SWARM_Y = 0x1d25;
export const SWARM_HEIGHT = 0x1d27;
export const PATH_SPEED_XY = 0x1d29; // D85B: phase speed of the position
export const PATH_SPEED_HEIGHT = 0x1d2d;
export const PATH_PHASE_XY = 0x1d39;
export const PATH_PHASE_HEIGHT = 0x1d3b;
export const PATH_START_XY = 0x1d3d;
export const PATH_START_HEIGHT = 0x1d3f;
export const PATH_START_HEIGHT_GOAL = 0x1d41; // the four goals the words above step towards
export const PATH_START_XY_GOAL = 0x1d43;
export const PATH_SPEED_XY_GOAL = 0x1d45;
export const PATH_SPEED_HEIGHT_GOAL = 0x1d47;
export const WAVE_PHASE = 0x1d33; // D2E7: two phases, their per-member copies and a scratch
export const WAVE_SECOND_PHASE = 0x1d35;
export const WAVE_MEMBER_PHASE = 0x1d37;
export const WAVE_MEMBER_SECOND_PHASE = 0x1d39;
export const WAVE_HEIGHT_PART = 0x1d3b;
export const WAVE_CLEARED = 0x1d49; // cleared by D260, read by no ported routine
export const CIRCLE_FOLLOWER_INDEX = 0x1d31; // D63C
export const CIRCLE_FOLLOWER_COUNTDOWN = 0x1d33; // negative: no more followers
export const CIRCLE_SPEED = 0x1d35;
export const CIRCLE_PHASE_SPEED = 0x1d37;
export const CIRCLE_LEADER = 0x1d4d;
export const CIRCLE_HEIGHT_PHASE = 0x1d53;
export const CIRCLE_PHASE = 0x1d55;
export const BOB_SECOND_OBJECT = 0x1d4f; // D73B
export const BOB_OBJECT = 0x1d51; // D714
export const BOB_PHASE = 0x1d57;
export const BOB_SECOND_PHASE = 0x1d59;

// Group of runners and the fight.
export const GROUP_INDEX = 0x2de6; // last word index of the group, including Jake
export const GROUP_OBJECTS = 0x2de8;
export const GROUP_NUMBERS = 0x2df0; // object numbers of the members
export const GROUP_POSITIONS = 0x2df8;
export const GROUP_SLOTS = 0x1fa8; // object slots of the members, parallel to GROUP_NUMBERS
// Scene object setup 80:A1E6: table offset of the object number, packed position and
// scratch word (first the position shifted right three, then the saved action argument).
export const DP_SCENE_OBJECT_NUMBER = 0x0a;
export const DP_SCENE_OBJECT_POSITION = 0x0c;
export const DP_SCENE_OBJECT_SCRATCH = 0x6b;
export const MEMBER_INDEX = 0x1f60; // member shown in the status and spell menus
export const FIGHT_LIST_INDEX = 0x1fb0;
export const FIGHT_LIST = 0x1fb2;
export const FIGHT_MUSIC = 0x1fca; // music before the fight (80:8521), FFFF: none
export const FIGHT_KARMA = 0x1fcc; // karma >> 3 at the first entry, then the gain (80:855E)
export const FIGHT_FIRST_REMOVAL = 0x1fce; // zero until 80:855E removes the first fighter
export const HARMLESS_HITS = 0x1fd4; // hits on objects that mean no harm (80:8691)
export const FIGHT_UNREAD = 0x1fd0; // cleared by 80:8511 with the fight words; no port reader
export const PLAYER_HIT_FRAMES = 0x1d65; // set by 80:881C, counted down by 80:DE94

// Game progress.
export const SCRIPT_VARIABLES = 0x3bbb; // script words, two bytes each
export const JAKE_CHARISMA = 0x3bff; // runner record byte 4 (80:EA6E)
export const JAKE_BODY = 0x3bfb; // runner record byte 0 (80:F0F3)
export const NUYEN = 0x3c0d; // low word, high word at NUYEN + 2
export const KARMA = 0x3c11;
export const SPELL_LIST = 0x3c1c; // learned spells, 0 ends the list
// Eight bytes per runner: armour WORD and rating BYTE, then weapon WORD, kind,
// damage and signed range. Setters 80:8B16/8B9F use the member WORD index times four.
export const RUNNER_ARMOUR = 0x3c2e;
export const RUNNER_ARMOUR_RATING = 0x3c30;
export const RUNNER_WEAPON = 0x3c31; // weapon number, then kind, damage and range
export const RUNNER_WEAPON_KIND = 0x3c33; // damage in the next byte (80:8860)
export const RUNNER_WEAPON_DAMAGE = 0x3c34;
export const RUNNER_WEAPON_RANGE = 0x3c35;
// Direct-page BYTE arguments of 80:8B9F (DP00 is the object slot).
export const DP_EQUIP_WEAPON_KIND = 2;
export const DP_EQUIP_WEAPON_DAMAGE = 4;
export const DP_EQUIP_WEAPON_RANGE = 6;
export const MAGIC_POINTS = 0x3c96; // one byte per runner
// CECB/CF2E resource additions and D079 refill: the long runner-record pointer,
// the maximum amount and a doubled Magic byte used to form ten times Magic.
// CF2E reuses its pointer word for that doubled byte after reading the record.
export const DP_RESOURCE_RECORD = 0x6b;
export const DP_RESOURCE_RECORD_BANK = 0x6d;
export const DP_RESOURCE_MAX = 4;
export const DP_RESOURCE_DOUBLE_MAGIC = DP_RESOURCE_RECORD;
export const DP_REFILL_DOUBLE_MAGIC = 0x68;
export const TOPIC_LIST = 0x3ca3; // sorted topic numbers, FF ends the list
export const TOPIC_FLAGS = 0x3cd6; // parallel to TOPIC_LIST
export const TOPIC_LIST_END = 0xff;
export const TOPIC_MARKED = 0xff; // 80:913C marks the matching entry's flag byte
// 80:90EB insertion shifts the old flag to the next topic while retaining its successor.
export const DP_TOPIC_SHIFT_FLAGS = 0x23;
export const DP_TOPIC_NEXT_FLAGS = 0x24;

// Window arrays and text buffers (80:F963/FA3E, 81:ACCF, 80:FE69/FB39).
export const WINDOW_LAST_INDEX = 0x204;
export const TEXT_BITS_REMAINING = 0x206;
export const TEXT_BIT_BUFFER = 0x208;
export const TEXT_TILE_UPLOAD_ADDRESS = 0x20a;
export const TEXT_TILE_UPLOAD_BYTES = 0x20c;
export const TEXT_BUFFER_VRAM_ADDRESS = 0x20e;
export const TEXT_BUFFER_BYTES = 0x210;
export const WINDOW_NEXT_TILE = 0x212;
export const WINDOW_ACTIVE = 0x226;
export const WINDOW_MAP_OFFSET = 0x2000;
export const WINDOW_COLUMNS = 0x2020;
export const WINDOW_ROWS = 0x2040;
export const WINDOW_TILE_START = 0x2060;
export const WINDOW_TILE_INITIAL = 0x2080;
export const WINDOW_TILE_COUNT = 0x20a0;
export const WINDOW_CURSOR_TILE = 0x20c0;
export const WINDOW_CURSOR_PIXEL = 0x20e0;
export const WINDOW_LEFT_PIXEL = 0x2100;
export const WINDOW_WIDTH_PIXELS = 0x2120;
export const WINDOW_STYLE = 0x2140;
export const WINDOW_ATTRIBUTES = 0x2180;
export const TEXT_BUFFER = 0x21a0;
export const WINDOW_MAP_BUFFER = 0x23a0;
export const TEXT_MASK_BUFFER = 0x2ae0;
export const MENU_PAGE_START = 0x1d95;
export const MENU_SELECTION = 0x1d97;
export const MENU_COLUMN = 0x1d99;
export const MENU_ROW = 0x1d9b;
export const MENU_DRAW_ROW = 0x1d9d;
export const MENU_ROWS_REMAINING = 0x1d9f;
export const MENU_REPEAT_COUNTER = 0x1da1;
export const MENU_NAVIGATION_INPUT = 0x1da3;
export const MENU_SHOW_NUMBERS = 0x1da5;
export const MENU_HOTKEYS = 0x1da7;

// Shared direct-page workspace of FE69/FB39, AF04 and AEC8.
// TEXT_WORK_WORD holds a measured width or a mask at distinct phases.
export const TEXT_SOURCE_POINTER = 0xcf;
export const TEXT_SOURCE_BANK_WORD = 0xd0;
export const TEXT_SOURCE_BANK = 0xd1;
export const TEXT_CHARACTER_INDEX = 0xd2;
export const TEXT_PENDING_BYTES = 0xab;
export const TEXT_PIXEL_OFFSET = 0xb7;
export const TEXT_WORK_WORD = 0xba;
export const TEXT_COMPOSE_STYLE = 0xae;
export const TEXT_LINE_PIXELS = 0xa8;
export const TEXT_GLYPH_ROW = 0xb1;
export const TEXT_GLYPH_BITS = 0xb4;
export const TEXT_GLYPH_HIGH = 0xb5;
export const TEXT_WORD_STATE = 0xa5;
export const TEXT_INITIAL_MASK = 0xa2;

// First window included by the AD92 redraw scan.
export const WINDOW_FIRST_INDEX = 0x200;

// Window map stream saved by 81:AA9C and consumed by 81:A9B2.
export const WINDOW_MAP_SOURCE = 0x1fe;
export const WINDOW_MAP_SOURCE_BANK = 0x1f4;
// Window style whose tiles and colours 81:AA9C loaded last (negative: none).
export const LOADED_WINDOW_STYLE = 0x214;

// Jake record byte 5, the state-count maximum (src/data/runners.mjs).
export const JAKE_COUNT_MAX = 0x3c00;

// Shared direct-page workspace of 80:9E65, 9E9B and 9F6D.
// The count high byte aliases UNPACK_OUTPUT_COUNT + 1. The two stream
// offsets track literal data and the separate packed control bits.
// A literal uses RUN_LENGTH bytes; a reference MVN copies RUN_LENGTH + 1.
export const UNPACK_OUTPUT_LIMIT = 0xdb;
export const UNPACK_OUTPUT_START = 0xdd;
export const UNPACK_OUTPUT_CURSOR = 0xdf;
export const UNPACK_SOURCE_POINTER = 0xe1;
export const UNPACK_SOURCE_BANK = 0xe3;
export const UNPACK_BIT_STREAM_OFFSET = 0xe5;
export const UNPACK_LITERAL_OFFSET = 0xe7;
export const UNPACK_OUTPUT_COUNT = 0xe9;
export const UNPACK_OUTPUT_COUNT_HIGH = UNPACK_OUTPUT_COUNT + 1;
export const UNPACK_RUN_LENGTH = 0xeb;
export const UNPACK_LITERAL_WORDS = 0xed;
export const UNPACK_BITS_REMAINING = 0xef;
export const UNPACK_BIT_BUFFER = 0xf1;

// Audio loader workspace (81:F130/F100/F122/F1E8, src/data/sound.mjs).
// Each BANK_WORD overlaps the pointer's high offset byte and bank byte.
// BLOCK_COUNT is bytes for a raw section or words for a repeated section.
// WORK_WORD holds the item number byte, F100 subtrahend or repeated word
// at distinct phases; preserve fresh reads when these fields alias data.
export const AUDIO_BLOCK_LIST_POINTER = 0x89;
export const AUDIO_BLOCK_LIST_BANK_WORD = 0x8a;
export const AUDIO_DIRECTORY_POINTER = 0x8c;
export const AUDIO_RAW_SOURCE_POINTER = 0x8f;
export const AUDIO_RAW_SOURCE_BANK_WORD = 0x90;
export const AUDIO_BYTES_REMAINING = 0x92;
export const AUDIO_BLOCK_COUNT = 0x94;
export const AUDIO_DESTINATION = 0x96;
export const AUDIO_DESTINATION_HIGH = AUDIO_DESTINATION + 1;
export const AUDIO_WORK_WORD = 0x98;

// Shared native argument slots; each name applies to the named callee only.
// F963 window geometry, A6A5/A6B8/A6C7 menu lists, FAAC cursor and C46E sound.
export const DP_WINDOW_LEFT = 0;
export const DP_WINDOW_TOP = 2;
export const DP_WINDOW_COLUMNS = 4;
export const DP_WINDOW_ROWS = 6;
export const DP_WINDOW_ATTRIBUTES = 8;
export const DP_MENU_COLUMN = 2;
export const DP_MENU_ROW = 4;
export const DP_MENU_VISIBLE_ROWS = 6;
export const DP_LIST_TOKENS = 8;
export const DP_LIST_TOKEN_BANK = 0x0a;
export const DP_LIST_VALUES = 0x0c;
export const DP_CURSOR_ROW = 4;
export const DP_SOUND_EFFECT = 2;
export const DP_SOUND_LEVEL = 4;
export const DP_SOUND_VOICE = 6;

// Main/save menu and karma windows, while 80:CE6D/EE57 own them.
export const MAIN_MENU_WINDOW = 0x1ced;
export const KARMA_BALANCE_WINDOW = 0x1f4c;
export const KARMA_CATEGORY_WINDOW = 0x1f4e;
export const KARMA_HEADER_WINDOW = 0x1f50;
export const KARMA_LIST_WINDOW = 0x1f52;
export const KARMA_MENU_NAMES = 0x1da9; // Exit, then the names of available upgrades
export const KARMA_ROW_NAMES = KARMA_MENU_NAMES + 2;
export const KARMA_MENU_VALUES = 0x1eaf; // zero for Exit, then current values
export const KARMA_ROW_VALUES = KARMA_MENU_VALUES + 2;
export const KARMA_MENU_INDICES = 0x1e2d; // choice n maps through +2*n
export const KARMA_ROW_INDICES = KARMA_MENU_INDICES + 2;
// F006 and the three karma-list loops reuse these direct-page fields.
export const DP_KARMA_VALUE_POINTER = 0x0e;
export const DP_KARMA_VALUE_BANK = 0x10;
export const DP_KARMA_UPGRADE_COST = 0x11;
export const DP_KARMA_ROW_BYTES = 0x14;
export const DP_KARMA_DISPLAY = 0x17;
export const DP_KARMA_SELECTION = 0x1a;
export const DP_KARMA_PREVIOUS_ROW_BYTES = 0x1d;
export const DP_WEAPON_RECORD = 0xf9;
export const DP_WEAPON_RECORD_BANK = 0xfb;
// EA6E and F254 keep the shown member's runner record in the same long pointer.
export const DP_MEMBER_RECORD = DP_WEAPON_RECORD;
export const DP_MEMBER_RECORD_BANK = DP_WEAPON_RECORD_BANK;

// B17D save source and B12C checksum workspace (src/game/save-slots.mjs).
export const SAVE_STATE_START = 0x2de0;
export const DP_SAVE_SLOT = 0x0e;
export const DP_CHECKSUM_FIRST_SUM = 0x11;
export const DP_CHECKSUM_SECOND_SUM = 0x14;
export const DP_CHECKSUM_WORD = DP_CHECKSUM_SECOND_SUM;
export const DP_CHECKSUM_HIGH = DP_CHECKSUM_WORD + 1;

// A835 object creation arguments (src/task/native-object-create.mjs):
// kind, X/4, Y/4, height/4 and the script C34A appends (negative: none).
export const DP_OBJECT_KIND = 0;
export const DP_OBJECT_X = 2;
export const DP_OBJECT_Y = 4;
export const DP_OBJECT_HEIGHT = 6;
export const DP_OBJECT_SCRIPT = 8;

// Game NMI shadows copied to INIDISP, TM, TS, TMW and HDMAEN by 80:C188 (main-game-nmi.mjs).
// The script interpreter uses the TM and TS words as STATUS_FLAGS_FIRST and
// STATUS_FLAGS_SECOND (src/vm/layout.mjs). A nonzero BRIGHTNESS_FADE steps the INIDISP
// brightness up (positive) or down (negative) every few frames (81:B0D1).
export const INIDISP_SHADOW = 0x1bc;
export const TM_SHADOW = 0x1be;
export const TS_SHADOW = 0x1c0;
export const BRIGHTNESS_FADE = 0x1c6;
export const BRIGHTNESS_FADE_FRAMES = 0x1c8; // frames to the next step
export const TMW_SHADOW = 0x1c2;
export const HDMAEN_SHADOW = 0x1c4;
// CGRAM start of the next portrait palette upload by 80:8FBA (set before 8FF5).
export const PORTRAIT_PALETTE_START = 0x142;
// Object palettes in CGRAM (80:AB0A, 81:A919): the slot of each palette (word per palette,
// negative: none), the palettes 81:A919 uploads to the slots and the list's byte length.
export const PALETTE_SLOTS = 0x17e6;
export const PALETTE_UPLOAD_LIST = 0x17d6;
export const PALETTE_UPLOAD_LIST_BYTES = 0x17d4;
export const OBJECT_PALETTE_COUNT = 0x46;

// Status screen 80:EA6E and member weapon/spell menu 80:F254.
// The window fields alias the karma windows; each owner releases its own.
export const STATUS_WINDOW = 0x1f4c; // attributes and equipment (E9C5)
export const STATUS_MENU_WINDOW = 0x1f4e; // submenu choice ED1E
export const STATUS_SUBMENU_WINDOW = 0x1f50; // items, skills, notes or spells
export const PORTRAIT_HDMA_TABLE = 0x1f3f; // 13 bytes copied from 80:E480
export const PORTRAIT_WINDOW_LEFT = 0x1f43; // window edges written by 80:E41F
export const PORTRAIT_WINDOW_RIGHT = 0x1f44;
export const MEMBER_PORTRAIT = 0x1f54; // dialog number of the portrait (80:974E)
export const MEMBER_DATAJACK = 0x1f56; // runner datajack word (80:9768)
export const MEMBER_PORTRAIT_REDRAW = 0x1f58; // set by a visited script round
export const MEMBER_NUMBER = 0x1f5a; // object number of the shown member
export const MEMBER_OBJECT = 0x1f5c; // object slot of the shown member
export const MEMBER_STATE_COUNT = 0x1f5e; // count byte of its state record
export const MEMBER_MENU_ACTIVE = 0x1f62; // FFFF while EA6E or F254 runs
export const STATUS_ITEMS_AT_ONCE = 0x1f64; // FFFF: E014's Y opens the items
export const ITEM_MENU_CLASS = 0x1f66; // kind flag bits 0 and 1 listed by E585
export const SPELL_CHOICE_RUNS_SCRIPT = 0x1f68; // zero from the EA6E submenu
// Parallel menu lists of E585 (items) and E693 (spells); entry 0 is Exit,
// choice n reads +2 n, and a zero name after the last entry ends the list.
export const MEMBER_MENU_NAMES = 0x1da9;
export const ITEM_MENU_ACTORS = 0x1e2d; // actor table offset of each item
export const ITEM_MENU_COUNTS = 0x1eaf; // state count, 1 shown as 0
export const SPELL_MENU_SCRIPTS = 0x1e2d; // 80:E810 script appended for another object
export const SPELL_MENU_LEVELS = 0x1e3d;
export const SPELL_MENU_LEADER_SCRIPTS = 0x1e4d; // 80:E81C script kept for the leader
export const SPELL_MENU_LEVEL_POINTERS = 0x1e5d; // record byte of the spell level
export const SPELL_MENU_SPELL_NAMES = 0x1f31; // 80:E828 spell name
// Leader spell selection read by the spell glove (E014) and Native94/8EDA.
export const SELECTED_SPELL_SCRIPT = 0x3c13;
export const SELECTED_SPELL_NAME = 0x3c15;
export const SELECTED_SPELL_LEVEL_POINTER = 0x3c1a;
// Jake's cyberware and portrait flags (notes E8C8, E9C5, EA6E and the dialog portraits).
export const JAKE_ALTERNATE_PORTRAIT = 0x3c17; // dialog portrait 4F instead of 4E
export const JAKE_DERMAL_ARMOUR = 0x3c18; // armour rating +2 for the leader
export const JAKE_SKILLSOFT = 0x3c05;
// A1E6 also uses this byte as the row factor of its packed group position.
export const SCENE_OBJECT_ROW_FACTOR = JAKE_SKILLSOFT;
export const JAKE_WIRED_REFLEXES = 0x3c19;
// Dialog 936C: flag byte 3 of the dialog record (bit 7 mirrors the partner
// portrait, bits 0 to 6 select the music) and the option bits loaded from SRAM
// 70:1FFE (bit 0 lets 936C and 8521 change the music).
export const DIALOG_RECORD_FLAGS = 0x01ba;
export const GAME_OPTIONS = 0x1fd6;
export const OPTION_MUSIC = 1;
// Bit 1: the fight end (80:855E) restores the music saved in FIGHT_MUSIC.
export const OPTION_MUSIC_RESTORE = 2;
// Portrait DMA request for the NMI: VRAM word address, negative once sent (80:8FF5).
export const PORTRAIT_DMA_REQUEST = 0x140;
// Dialog portrait window HDMA table (16 bytes from 80:8F87) and the edges 80:8EFE writes.
export const DIALOG_HDMA_TABLE = 0x144;
export const LEFT_WINDOW_LEFT_EDGE = 0x148;
export const LEFT_WINDOW_RIGHT_EDGE = 0x149;
export const RIGHT_WINDOW_LEFT_EDGE = 0x14e;
export const RIGHT_WINDOW_RIGHT_EDGE = 0x14f;
// OAM copy sent by DMA in the NMI (81:A996): four bytes per sprite, then the high table
// (src/data/tables.mjs, native-scene-sprites.mjs).
export const OAM_BUFFER = 0x3d08;
export const OAM_HIGH_TABLE = 0x3f08;
// OAM copy of the matrix, intro and front end: 81:ED8B sends 220 bytes from 7E:0F1E by DMA.
export const OAM_SHADOW = 0x0f1e;
export const OAM_SHADOW_HIGH = 0x111e;
// Title menu of the front end (main-frontend-text.mjs, main-frontend-menu.mjs). The font
// table 80:F2A0 unpacks to 7E:46A8 (tile word per character from code 20) and the BG
// tilemap 81:D531 draws into (32 x 32 tile words, sent to VRAM by 81:D59E). The same
// memory serves the scene build (SCENE_LAYER_HIGH) outside the front end.
export const MENU_FONT_TILES = 0x7e46a8;
export const MENU_TILEMAP = 0x7e86a9;
export const MENU_TILEMAP_BYTES = 0x800;
// One word per menu row (cleared by 81:D555 for 32 bytes): TILE_PALETTE_STEP marks a
// row whose save slot 81:B1AB rejects; 81:E3DA XORs it into its text (DP_MENU_TEXT_XOR).
export const MENU_ROW_DISABLED = 0x11a4;
export const MENU_ROW_DISABLED_BYTES = 0x20;
// Frame counter of the title NMI 81:E6AE (raised from 81:E57E on); same word as
// SCENE_BRIGHTNESS_TARGET outside the front end. Also mixed into FRONTEND_RANDOM.
export const FRONTEND_FRAME_COUNTER = 0x11a2;
// Frames 0 to 0x17 of the four title animations (81:E57E clears them, 81:E6AE advances
// them every eight frames, 81:E623 turns them into the stripe sources below).
export const TITLE_ANIMATION_FRAMES = 0x113e;
export const TITLE_ANIMATION_2_FRAME = 0x1140;
export const TITLE_ANIMATION_3_FRAME = 0x1142;
export const TITLE_ANIMATION_4_FRAME = 0x1144;
// Title palette sent to CGRAM colour 0 by 81:E6AE (64 colours).
export const TITLE_PALETTE = 0x7e7ea8;
export const TITLE_PALETTE_BYTES = 0x80;
// Random words of 81:E788 in bank 7F (the scene wall map outside the front end), and the
// ten DMA source words of the title animation stripes that 81:E623 writes behind them.
export const FRONTEND_RANDOM = 0x7f0000;
export const FRONTEND_RANDOM_HIGH = 0x7f0002;
export const TITLE_STRIPE_SOURCES = 0x7f0004;
// Direct page of the title menu: the chosen row (81:E343), a one-character text (the
// arrow of 81:E32F, read back by 81:D531 at the same address) and the word 81:D531
// XORs into every tile.
export const DP_MENU_CURSOR = 0x0e;
export const DP_MENU_TEXT = 0x10;
export const DP_MENU_TEXT_XOR = 0x18;
// Menu input 81:E29F: the frames left until the menu times out and the chosen save slot
// (FFFF: a new game) that 81:E1B4 returns.
export const DP_MENU_TIMEOUT = 0x1c;
export const DP_MENU_CHOICE = 0x16;
// Prologue text of 81:DDDB: the unpacked text (bank 7E, 00 ends a line, an empty line
// ends the text), its font (tile word per character from code 20) and the BG3 tilemap
// 81:DE93 writes one centred line into for every eight scroll lines (sent to VRAM by the
// NMI 81:DD54, which scrolls BG3 by DP_PROLOGUE_SCROLL).
export const PROLOGUE_TEXT = 0x62a8;
export const PROLOGUE_FONT_TILES = 0x7e56a8;
export const PROLOGUE_TILEMAP = 0x7e4ea8;
export const PROLOGUE_TILEMAP_BYTES = 0x800;
export const DP_PROLOGUE_SCROLL = 0x1e;
export const DP_PROLOGUE_DELAY = 0x1c; // frames until the next scroll line
export const DP_PROLOGUE_READ = 0x18; // text offset of the next line
export const DP_PROLOGUE_PADDING = 0x0e;
// Title scroll of 81:D694 (NMI 81:D93E pans until DP_TITLE_POSITION reaches 0401, then
// 81:DCAC scrolls vertically): position, speed, and the fraction of the position (pan)
// or the target speed (vertical scroll); DP_TITLE_UPLOAD indexes the upload table 81:DD8B.
export const DP_TITLE_POSITION = 0x1e;
export const DP_TITLE_SPEED = 0x1c;
export const DP_TITLE_SPEED_TARGET = 0x1a;
export const DP_TITLE_UPLOAD = 0x18;
// Window H-DMA table of the intro (81:D642 copies 81:D687 here; tables.mjs
// intro_window_hdma): entries of a line count and the two bytes for WH0/WH1.
export const INTRO_WINDOW_HDMA = 0x7e8ea8;
export const INTRO_WINDOW_ENTRY_BYTES = 3;
// Objects of the intro 81:DFE7 and the title pan (81:E8E5 clears them, 81:DC43, 81:E900
// and 81:E971 add them; the NMIs 81:D9D5 of the title pan and 81:DF0E of the intro draw and
// animate them): eight near and eight far objects, each an animation offset (negative:
// none), an X and a Y word. In the pan near objects scroll with a quarter of
// DP_TITLE_POSITION, far ones with an eighth. The event
// offsets into the spawn tables 81:DB8B (near) and 81:DBE1 (far); FRONTEND_FRAME_COUNTER
// counts the frames. The same words serve the title animations and cutscenes otherwise.
export const INTRO_NEAR_ANIMATIONS = 0x113e;
export const INTRO_FAR_ANIMATIONS = 0x114e;
export const INTRO_NEAR_X = 0x115e;
export const INTRO_FAR_X = 0x116e;
export const INTRO_NEAR_Y = 0x117e;
export const INTRO_FAR_Y = 0x118e;
export const INTRO_OBJECT_LAST = 0x0e; // byte index of the eighth object
export const INTRO_OBJECTS_BYTES = 0x20; // both animation lists, cleared by 81:E8E5
export const INTRO_NEAR_EVENT = 0x119e;
export const INTRO_FAR_EVENT = 0x11a0;
// Scratch of 81:D9D5, 81:E900 and 81:E971: the X argument and the scroll position.
export const DP_INTRO_X = 0x20;
export const DP_INTRO_SCROLL = 0x32;
// A tilemap of the intro background unpacked by 81:D83E; 81:D60F gives every tile word priority.
export const INTRO_MAP = 0x7e76a8;
export const INTRO_MAP_BYTES = 0x800;
// Global settings in battery-backed SRAM bank 70 (81:D5F4 defaults, 81:D5D0 checksum;
// src/game/save-slots.mjs): output mode (SETTINGS_STEREO_ON, sent as APU command 14),
// control type (bit 0: type A), music (0 off, 1 event, otherwise full) and checksum.
export const SETTINGS_STEREO = 0x701ffc;
export const SETTINGS_CONTROL = 0x701ffd;
export const SETTINGS_MUSIC = 0x701ffe;
export const SETTINGS_CHECKSUM = 0x701fff;
export const SETTINGS_STEREO_ON = 0x80;
export const SETTINGS_CONTROL_TYPE_A = 1;
export const SETTINGS_MUSIC_MASK = 3;
export const SETTINGS_MUSIC_EVENT = 1;
export const SETTINGS_MUSIC_FULL = 3;
// OAM entry of one object (80:B20A): the object, the OBJECT_FLAGS bits it collects and the
// two cell bits of the map cells behind its parts (native-sprite-occlusion.mjs mapCell): a
// cell whose first wall lies in front of the object, and a cell without a wall in front.
export const ENTERED_OBJECT = 0x1c72;
export const ENTERED_OBJECT_FLAGS = 0x1c74;
export const CELL_FRONT_WALL = 0x0001;
export const CELL_OPEN = 0x0002;
export const CELL_BITS = CELL_FRONT_WALL | CELL_OPEN;
// One word per 8x8 cell around the object, 0x20 bytes per column: the wall mask (FFFF: a
// wall in front), later the OAM priority of each sprite part, and the wall tile to draw.
export const OCCLUSION_MASKS = 0x1872;
export const OCCLUSION_TILES = 0x1a72;
export const OCCLUSION_COLUMN_BYTES = 0x20;
// Windows of the open notices of 80:FEC1, one word per slot (negative: free),
// and their remaining frames; menus wait for input (F953) and clear them (FF79).
export const NOTICE_WINDOWS = 0x0216;
export const NOTICE_WINDOW_LAST = 6;
export const NOTICE_FRAMES = 0x021e;
// Frames 80:FF20 still draws random values (C560) after FEC1 opened a window with
// attributes 0400.
export const NOTICE_EFFECT_FRAMES = 0x0202;
// FEC1 arguments after the F963 window slots: text index (table 80:D9B8) and frames.
export const DP_NOTICE_TEXT = 0x0a;
export const DP_NOTICE_FRAMES = 0x0c;

// 80:99EB builds parallel lists for A6A5. Entry zero is Exit; 1FA6
// can override the caller's mask and aliases a later word of the flag list.
export const ACTION_MENU_NAMES = 0x1f6a;
export const ACTION_MENU_HOTKEYS = 0x1f82;
export const ACTION_MENU_FLAGS = 0x1f98;
export const ACTION_MENU_OVERRIDE = 0x1fa6;
export const DP_ACTION_MENU_MASK = 0x65;
export const DP_ACTION_MENU_WINDOW = 0x68;
