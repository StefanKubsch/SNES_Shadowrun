// Read-only shape footprints and scene-build resource observations.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { cartridge } from './cartridge-harness.mjs';
import { fnv1a } from '../src/data/fnv.mjs';
import { readSceneTable, SCENES } from '../src/data/lz-streams.mjs';
import { lzBits, lzDecode } from '../src/data/lz.mjs';
import { placedReader, requireRomAddress } from '../src/data/rom-bytes.mjs';
import { readTilesets } from '../src/data/tilesets.mjs';
import { encodeScene } from '../src/data/scenes.mjs';
import { TILE_NAME_MASK } from '../src/constants/ppu.mjs';
import { WORD_BITS, BYTE_BITS, BYTE_MASK } from '../src/constants/bits.mjs';
import { VmMemory, WRAM_SIZE } from '../src/vm/memory.mjs';
import { drawSceneShapes, loadSceneSequence, observeSceneLoad } from '../src/game/scene-load.mjs';
import { drainNativeSequence } from '../src/system/sequence-runner.mjs';
import {
  SHAPE_GRID,
  SHAPE_GRID_BYTES,
  SHAPE_GRID_ROW_BYTES,
  SHAPE_GRID_HIDDEN_ROWS,
  SCENE_RECORD,
  DP_SCENE_COUNT,
  DP_SCENE_LAYER,
  DP_SCENE_RECORD,
  DP_WALL_NEXT,
  SCENE_PALETTE_COUNT,
  SCENE_LAYER_LOW,
  SCENE_LAYER_BYTES,
  WALL_HEIGHTS,
  WALL_TILES,
  TILE_STACK_HEADS,
  TILE_STACK_LAST,
  TILE_STACK_FIRST,
  TILE_STACK_SECOND,
  TILE_STACK_THIRD,
} from '../src/data/wram.mjs';

const WORD_BYTES = 2,
  WORD_MASK = 0xffff,
  WRAM_BASE = 0x7e0000;
const SCENE_HEADER_BYTES = 4,
  GRID_POSITION_MASK = 0x3ffe;
const GRID_VISIBLE_COLUMNS = 32,
  GRID_WORD_COLUMNS = SHAPE_GRID_ROW_BYTES / WORD_BYTES;
const GRID_VISIBLE_START = SHAPE_GRID_HIDDEN_ROWS * SHAPE_GRID_ROW_BYTES;
const TILE_STACK_CAPACITY = (TILE_STACK_LAST + WORD_BYTES) / WORD_BYTES;
// Both wall arrays end at the next independently owned region.
const WALL_CAPACITY_BYTES = Math.min(WALL_TILES - WALL_HEIGHTS, TILE_STACK_HEADS - WALL_TILES);
const PALETTE_CAPACITY = 7; // Background slots 1 through 7; slot zero is reserved.
const json = (name) =>
  JSON.parse(readFileSync(new URL(`../assets/vm-${name}.json`, import.meta.url)));
const visible = (offset) =>
  offset >= GRID_VISIBLE_START &&
  offset < SHAPE_GRID_BYTES &&
  offset % SHAPE_GRID_ROW_BYTES < GRID_VISIBLE_COLUMNS * WORD_BYTES;

const dpWord = (mem, at) => mem.wram[at] | (mem.wram[at + 1] << BYTE_BITS);
const setDpWord = (mem, at, value) => {
  mem.wram[at] = value & BYTE_MASK;
  mem.wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
// Run with the scene load observer of src/game/scene-load.mjs.
function observing(observer, run) {
  const previous = observeSceneLoad(observer);
  try {
    return run();
  } finally {
    observeSceneLoad(previous);
  }
}

// Isolated synthetic WRAM contains the caller's shape and empty object lists.
// The lifted shape decoder (81:8DE2) provides the write sequence after its grid clear.
export function traceSceneShape(shape) {
  const data = encodeScene({
    backdrop: '0000',
    tileset: 0,
    shapes: [shape],
    objects_76a8: [],
    objects_46a8: [],
  });
  const mem = new VmMemory(cartridge.rom, new Uint8Array(WRAM_SIZE), null, cartridge.present);
  mem.wram.set(data, SCENE_RECORD - WRAM_BASE);
  setDpWord(mem, DP_SCENE_RECORD, (SCENE_RECORD + SCENE_HEADER_BYTES) & WORD_MASK);
  mem.wram[DP_SCENE_RECORD + WORD_BYTES] = SCENE_RECORD >>> WORD_BITS;
  setDpWord(mem, DP_SCENE_COUNT, 1);
  const writes = [];
  observing(
    { gridWrite: (offset, value) => writes.push({ offset, value, width: WORD_BYTES }) },
    () => drawSceneShapes(mem, mem.wram),
  );
  return {
    writes,
    consumed_bytes:
      dpWord(mem, DP_SCENE_RECORD) - ((SCENE_RECORD + SCENE_HEADER_BYTES) & WORD_MASK),
  };
}

function shapeSummary(shape, index, blocks) {
  const { writes, consumed_bytes } = traceSceneShape(shape);
  const offsets = [...new Set(writes.map((w) => w.offset))].sort((a, b) => a - b);
  const values = [...new Set(writes.map((w) => w.value))].sort((a, b) => a - b);
  return {
    index,
    kind: shape.kind,
    border: shape.border ?? false,
    encoded_position: shape.row * SHAPE_GRID_ROW_BYTES + shape.column,
    masked_position: (shape.row * SHAPE_GRID_ROW_BYTES + shape.column) & GRID_POSITION_MASK,
    zero_counter:
      shape.kind === 'line' ? shape.length === 0 : shape.width === 0 || shape.height === 0,
    consumed_bytes,
    writes: writes.length,
    distinct_cells: offsets.length,
    visible_cells: offsets.filter(visible).length,
    outside_offsets: offsets.filter(
      (o) => o < 0 || o + WORD_BYTES > SHAPE_GRID_BYTES || o % WORD_BYTES !== 0,
    ),
    values,
    unowned_block_values: values.filter((v) => v !== 0 && v >= blocks),
    first_offset: offsets[0] ?? null,
    last_offset: offsets.at(-1) ?? null,
  };
}

export function observeSceneBuild(image, sceneIndex, blockCount) {
  const mem = new VmMemory(image.rom, new Uint8Array(WRAM_SIZE), null, image.present);
  const phases = [];
  let minimumFree = TILE_STACK_LAST,
    exhaustedAllocations = 0;
  let grid = null;
  let highPass = false,
    combinedPeak = 0;
  const retainedLow = new Set(),
    overlaps = new Set(),
    retainedTriples = new Map();
  const snapshot = (name) => {
    const wall = dpWord(mem, DP_WALL_NEXT),
      palettes = mem.read16(WRAM_BASE + SCENE_PALETTE_COUNT);
    phases.push({
      name,
      wall_bytes: wall,
      palettes,
      wall_within_capacity: wall <= WALL_CAPACITY_BYTES,
      palettes_within_capacity: palettes <= PALETTE_CAPACITY,
    });
  };
  const observer = {
    // 8FC2 allocates low-layer entries downwards. 8FF0 resets the free stack
    // to allocate high-layer entries upwards without clearing low-layer data.
    highReset() {
      for (let offset = 0; offset < SCENE_LAYER_BYTES; offset += WORD_BYTES) {
        const index = mem.read16(WRAM_BASE + SCENE_LAYER_LOW + offset) & TILE_NAME_MASK;
        if (index) retainedLow.add(index);
      }
      for (const index of retainedLow)
        retainedTriples.set(
          index,
          [TILE_STACK_FIRST, TILE_STACK_SECOND, TILE_STACK_THIRD].map((at) =>
            mem.read16(WRAM_BASE + at + index * WORD_BYTES),
          ),
        );
      highPass = true;
    },
    intern(before, after, stack) {
      if (before === WORD_MASK - 1 && after !== before) exhaustedAllocations++;
      const allocated = after === ((before - WORD_BYTES) & WORD_MASK);
      if (highPass && allocated && retainedLow.has(stack & TILE_NAME_MASK))
        overlaps.add(stack & TILE_NAME_MASK);
      const used =
        after === WORD_MASK - 1
          ? TILE_STACK_CAPACITY
          : TILE_STACK_CAPACITY - (after / WORD_BYTES + 1);
      combinedPeak = Math.max(combinedPeak, used + (highPass ? retainedLow.size : 0));
      if (after <= TILE_STACK_LAST) minimumFree = Math.min(minimumFree, after);
      else if (after === WORD_MASK - 1) minimumFree = -WORD_BYTES;
      else throw new Error('Native tile free pointer escaped its table');
    },
    before(name) {
      if (name !== 'grid-blocks') return;
      const cells = [];
      for (let offset = GRID_VISIBLE_START; offset < SHAPE_GRID_BYTES; offset += WORD_BYTES)
        if (visible(offset)) {
          const value = mem.read16(SHAPE_GRID + offset);
          if (value) cells.push({ offset, block: value });
        }
      grid = {
        visible_nonzero_cells: cells.length,
        blocks: [...new Set(cells.map((c) => c.block))].sort((a, b) => a - b),
        unowned_cells: cells.filter((c) => c.block >= blockCount),
      };
    },
    after(name) {
      snapshot(
        name === 'objects'
          ? dpWord(mem, DP_SCENE_LAYER) === SCENE_LAYER_LOW
            ? 'low_objects'
            : 'high_objects'
          : name === 'grid-blocks'
            ? 'shape_blocks'
            : 'wall_tiles',
      );
    },
  };
  observing(observer, () => drainNativeSequence(loadSceneSequence({ a: { mem } }, sceneIndex)));
  return {
    grid,
    phases,
    wram_checksum: fnv1a(mem.wram),
    tile_stack_peak: TILE_STACK_CAPACITY - (minimumFree / WORD_BYTES + 1),
    exhausted_allocations: exhaustedAllocations,
    retained_low_stacks: retainedLow.size,
    low_high_overlaps: [...overlaps].sort((a, b) => a - b),
    changed_retained_low_stacks: [...retainedTriples]
      .filter(([index, words]) =>
        [TILE_STACK_FIRST, TILE_STACK_SECOND, TILE_STACK_THIRD].some(
          (at, n) => mem.read16(WRAM_BASE + at + index * WORD_BYTES) !== words[n],
        ),
      )
      .map(([index]) => index),
    combined_tile_stack_peak: combinedPeak,
  };
}

// Audit metadata must describe the assembled image that is actually executed.
// These checks establish consistency, not authentication of an edited baseline.
function validateInputs(image, scenes, tilesets) {
  if (
    scenes?.scenes?.length !== SCENES ||
    new Set(scenes.scenes.map((s) => s.address)).size !== SCENES ||
    scenes.source_rom_sha256 !== tilesets?.source_rom_sha256
  )
    throw new Error('Scene audit identities and source must match');
  const read8 = placedReader(image.rom, image.present);
  const table = readSceneTable(read8);
  const bits = lzBits((n) => read8(0x80a033 + n));
  for (const [n, scene] of scenes.scenes.entries()) {
    const cpu = requireRomAddress(scene.address),
      data = encodeScene(scene);
    if (table[n] !== cpu || (read8(cpu) | (read8(cpu + 1) << BYTE_BITS)) !== data.length)
      throw new Error('Scene audit pointer or decoded size mismatch');
    const found = lzDecode((k) => read8(cpu + WORD_BYTES + k), data.length, bits);
    if (
      found.data.some((v, k) => v !== data[k]) ||
      found.tokens.reduce((sum, t) => sum + t.at(-1), 0) !== data.length
    )
      throw new Error('Scene audit record differs from assembled data');
  }
  if (JSON.stringify(readTilesets(read8)) !== JSON.stringify(tilesets.tilesets))
    throw new Error('Scene audit tilesets differ from assembled data');
}

export function auditSceneShapes(
  image = cartridge,
  scenes = json('scenes'),
  tilesets = json('tilesets'),
) {
  validateInputs(image, scenes, tilesets);
  const streams = scenes.scenes.map((s, scene_index) => {
    const blocks = tilesets.tilesets[s.tileset]?.blocks.length;
    if (!blocks) throw new Error('Scene tileset has no owned blocks');
    return {
      address: s.address,
      scene_index,
      tileset: s.tileset,
      block_count: blocks,
      shapes: s.shapes.map((shape, index) => shapeSummary(shape, index, blocks)),
      construction: observeSceneBuild(image, scene_index, blocks),
    };
  });
  const shapes = streams.flatMap((s) => s.shapes),
    builds = streams.map((s) => s.construction);
  return {
    scope:
      'Read-only native observations from assembled scenes. Not trusted capacities for edits or gameplay reachability.',
    limits: {
      grid_bytes: SHAPE_GRID_BYTES,
      grid_word_columns: GRID_WORD_COLUMNS,
      visible_columns: GRID_VISIBLE_COLUMNS,
      hidden_rows: SHAPE_GRID_HIDDEN_ROWS,
      tile_stack_entries: TILE_STACK_CAPACITY,
      wall_array_bytes: WALL_CAPACITY_BYTES,
      background_palette_slots: PALETTE_CAPACITY,
    },
    counts: {
      scenes: streams.length,
      shapes: shapes.length,
      zero_counter_shapes: shapes.filter((s) => s.zero_counter).length,
      outside_write_shapes: shapes.filter((s) => s.outside_offsets.length).length,
      unowned_value_shapes: shapes.filter((s) => s.unowned_block_values.length).length,
      unowned_final_grid_scenes: builds.filter((s) => s.grid.unowned_cells.length).length,
      peak_tile_stacks: Math.max(...builds.map((s) => s.tile_stack_peak)),
      peak_combined_tile_stacks: Math.max(...builds.map((s) => s.combined_tile_stack_peak)),
      overlapping_scenes: builds.filter((s) => s.low_high_overlaps.length).length,
      changed_low_stack_scenes: builds.filter((s) => s.changed_retained_low_stacks.length).length,
      peak_wall_bytes: Math.max(...builds.flatMap((s) => s.phases.map((p) => p.wall_bytes))),
      peak_palettes: Math.max(...builds.flatMap((s) => s.phases.map((p) => p.palettes))),
      exhausted_allocations: builds.reduce((sum, s) => sum + s.exhausted_allocations, 0),
    },
    streams,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(auditSceneShapes(), null, 2));
