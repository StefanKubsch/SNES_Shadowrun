import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditSceneShapes, traceSceneShape } from './scene-shape-audit.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { encodeScene } from '../src/data/scenes.mjs';
import { lzBits, lzDecode } from '../src/data/lz.mjs';
import { readTilesets } from '../src/data/tilesets.mjs';
import { romOffset, requireRomAddress } from '../src/data/rom-bytes.mjs';
import { inspectRom } from './rom.mjs';
import { sceneLoadSpecs } from './main-scene-load-source.mjs';
import { DialogTestMemory, decodeWindows } from './task-native-dialog-harness.mjs';
import { runReference } from './w65c816-reference.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { dialogAccess } from '../src/task/native-dialog-support.mjs';
import { loadScene } from '../src/task/main-scene-load.mjs';
import { fnv1a } from '../src/data/fnv.mjs';
import {
  SCENE_RECORD,
  SHAPE_GRID,
  SHAPE_GRID_BYTES,
  DP_SCENE_RECORD,
  DP_SCENE_COUNT,
} from '../src/task/wram.mjs';

const json = (name) => JSON.parse(readFileSync(`assets/vm-${name}.json`));
const scenes = json('scenes'),
  tilesets = json('tilesets');
const originalShapes = scenes.scenes.flatMap((s) => s.shapes);
const audit = auditSceneShapes();
const shapeEntries = [0x818d09, 0x818d23, 0x818d3d, 0x818dc0, 0x818de2];
const shapeCode = new Map(
  sceneLoadSpecs
    .filter((s) => shapeEntries.includes(s.entry))
    .flatMap((s) => [...decodeWindows(s.windows)]),
);

// Original ROM instructions run only in this test. Their grid write sequence
// independently checks the native observer, including repeated and clipped writes.
function referenceShape(shape) {
  const data = encodeScene({
    backdrop: '0000',
    tileset: 0,
    shapes: [shape],
    objects_76a8: [],
    objects_46a8: [],
  });
  const mem = new DialogTestMemory(new Uint8Array(0x20000));
  mem.wram.set(data, SCENE_RECORD - 0x7e0000);
  mem.write16(DP_SCENE_RECORD, (SCENE_RECORD + 4) & 65535);
  mem.write8(DP_SCENE_RECORD + 2, 0x7f);
  mem.write16(DP_SCENE_COUNT, 1);
  mem.write16(0x1eef, 0xa16f);
  const ctx = {
    a: 0,
    x: 0,
    y: 0,
    s: 0x1eee,
    d: 0,
    bank: 0x7e,
    status: 0,
    programBank: 0x81,
    pc: 0x8de2,
  };
  const bytes = [],
    write = mem.write8.bind(mem);
  mem.write8 = (address, value) => {
    if (address >= SHAPE_GRID && address < 0x800000) bytes.push({ address, value: value & 255 });
    write(address, value);
  };
  runReference(shapeCode, mem, ctx, { entry: 0x818de2, root: 'RTS', limit: 1000000 });
  const result = [];
  for (let n = SHAPE_GRID_BYTES; n < bytes.length; n += 2) {
    assert.equal(bytes[n + 1].address, bytes[n].address + 1);
    result.push({
      offset: bytes[n].address - SHAPE_GRID,
      value: bytes[n].value | (bytes[n + 1].value << 8),
      width: 2,
    });
  }
  return result;
}

const boundaries = [
  { kind: 'line', row: 8, column: 1, step: 126, value: 1, length: 0 },
  { kind: 'line', row: 31, column: 126, step: 130, value: 1, length: 1 },
  { kind: 'line', row: 0, column: 0, step: 126, value: 255, length: 255 },
  { kind: 'rect', row: 8, column: 16, border: false, value: 10, width: 0, height: 0 },
  { kind: 'rect', row: 8, column: 16, border: true, value: 10, width: 1, height: 1 },
  { kind: 'rect', row: 33, column: 0, border: true, value: 10, width: 0, height: 0 },
  { kind: 'rect', row: 8, column: 16, border: true, value: 255, width: 1, height: 1 },
];

test('native shape write sequences match ROM instructions for every original shape and synthetic boundaries', () => {
  assert.equal(originalShapes.length, 209);
  for (const shape of [...originalShapes, ...boundaries]) {
    const observed = traceSceneShape(shape);
    assert.deepEqual(observed.writes, referenceShape(shape), JSON.stringify(shape));
    assert.equal(observed.consumed_bytes, shape.kind === 'line' ? 4 : 5);
  }
});

test('zero counters draw cells, low position bits are masked, borders add word values and an upper border can escape', () => {
  assert.deepEqual(traceSceneShape(boundaries[0]).writes, [{ offset: 1024, value: 1, width: 2 }]);
  assert.deepEqual(traceSceneShape(boundaries[1]).writes, [{ offset: 4094, value: 1, width: 2 }]);
  assert.equal(traceSceneShape(boundaries[3]).writes.length, 1);
  const bordered = traceSceneShape(boundaries[4]).writes;
  assert.equal(bordered.length, 13);
  assert.deepEqual(
    [...new Set(bordered.map((w) => w.value))].sort((a, b) => a - b),
    [10, 11, 12, 13, 14, 15, 16, 17, 18],
  );
  assert.deepEqual(traceSceneShape(boundaries[5]).writes, [{ offset: 4096, value: 17, width: 2 }]);
  assert.equal(Math.max(...traceSceneShape(boundaries[6]).writes.map((w) => w.value)), 263);
});

test('all scene records and six owned tilesets match the European ROM', () => {
  const { bytes, metadata } = inspectRom(readFileSync('Shadowrun (E).smc'));
  assert.equal(metadata.rom_sha256, scenes.source_rom_sha256);
  const read8 = (cpu) => bytes[romOffset(cpu)],
    bits = lzBits((n) => read8(0x80a033 + n));
  assert.deepEqual(readTilesets(read8), tilesets.tilesets);
  for (const s of scenes.scenes) {
    const cpu = requireRomAddress(s.address),
      data = encodeScene(s);
    assert.deepEqual(lzDecode((n) => read8(cpu + 2 + n), data.length, bits).data, data, s.address);
  }
});

test('audit covers all footprints and records actual resource peaks without mutating its input or native results', () => {
  assert.deepEqual(audit.limits, {
    grid_bytes: 4096,
    grid_word_columns: 64,
    visible_columns: 32,
    hidden_rows: 8,
    tile_stack_entries: 1024,
    wall_array_bytes: 24000,
    background_palette_slots: 7,
  });
  assert.deepEqual(audit.counts, {
    scenes: 165,
    shapes: 209,
    zero_counter_shapes: 24,
    outside_write_shapes: 0,
    unowned_value_shapes: 0,
    unowned_final_grid_scenes: 0,
    peak_tile_stacks: 771,
    peak_combined_tile_stacks: 973,
    overlapping_scenes: 0,
    changed_low_stack_scenes: 0,
    peak_wall_bytes: 23400,
    peak_palettes: 7,
    exhausted_allocations: 0,
  });
  assert.ok(
    audit.streams.every((s) =>
      s.construction.phases.every((p) => p.wall_within_capacity && p.palettes_within_capacity),
    ),
  );
  for (const s of audit.streams) {
    const mem = new VmMemory(cartridge.rom, new Uint8Array(0x20000), null, cartridge.present);
    const a = new TaskAccessor({
      mem,
      a: s.scene_index,
      x: 0,
      y: 0,
      s: 0x1ef0,
      d: 0,
      dbr: 0x7e,
      p: 0,
      pc: 0xa518,
    });
    a.load();
    a.ctx.programBank = 0x80;
    const h = dialogAccess(a);
    h.call(0x80a518, 0x81a117, () => loadScene(h), true);
    assert.equal(s.construction.wram_checksum, fnv1a(mem.wram), s.address);
  }
  const image = { rom: cartridge.rom.slice(), present: cartridge.present.slice() };
  assert.deepEqual(auditSceneShapes(image).counts, audit.counts);
  assert.deepEqual(image, { rom: cartridge.rom, present: cartridge.present });
});

test('audit rejects mismatched scene identities, decoded records, source metadata and tilesets', () => {
  for (const kind of ['count', 'identity', 'order', 'record', 'source', 'tileset']) {
    const records = structuredClone(scenes),
      sets = structuredClone(tilesets);
    if (kind === 'count') records.scenes.pop();
    if (kind === 'identity') records.scenes[1].address = records.scenes[0].address;
    if (kind === 'order') records.scenes.reverse();
    if (kind === 'record') records.scenes.find((s) => s.shapes.length).shapes[0].value ^= 1;
    if (kind === 'source') sets.source_rom_sha256 = 'other-source';
    if (kind === 'tileset') sets.tilesets[0].blocks[1].attribute ^= 1;
    assert.throws(() => auditSceneShapes(cartridge, records, sets), /Scene audit/);
  }
});
