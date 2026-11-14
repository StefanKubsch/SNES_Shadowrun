import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartridge, readAsset } from './cartridge-harness.mjs';
import { loadCartridge } from '../src/data/cartridge.mjs';
import {
  applyRoomTileEdits,
  ROOM_TILE_EDITS_FILE,
  ROOM_TILE_EDITS_FORMAT,
} from '../src/data/room-tile-edits.mjs';
import { lzBits, lzDecode } from '../src/data/lz.mjs';
import { readBmp, sheetToStream, streamToSheet } from '../src/data/tiles.mjs';
import { romOffset, requireRomAddress } from '../src/data/rom-bytes.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { unpackFixedStream } from '../src/task/native-unpack.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { renderMode1Frame } from '../src/video/ppu-frame.mjs';
import { hdmaRows } from '../src/video/hdma.mjs';
import { SHAPE_GRID, SHAPE_GRID_BYTES } from '../src/task/wram.mjs';

const baseline = JSON.parse(readFileSync('assets/vm-tiles.json', 'utf8'));
const sheets = baseline.sheets.map((file) => readBmp(readFileSync(`assets/${file}`)).pixels);
const bitsFor = lzBits((n) => cartridge.rom[romOffset(0x80a033 + n)]);
const asset = (edits = []) => ({ format: ROOM_TILE_EDITS_FORMAT, edits });
const image = () => ({ rom: cartridge.rom.slice(), present: cartridge.present.slice() });
const cpuOf = (entry) => requireRomAddress(entry.address);
const original = (index) => sheetToStream(sheets[index >> 8], index);
const shorter = (index) => {
  const bytes = new Uint8Array(128);
  // Break the first original reference while retaining highly compressible data.
  bytes[Number(baseline.streams[index].tokens.split(' ')[0])] = 255;
  return bytes;
};
function pixelsOf(bytes) {
  const sheet = new Uint8Array(256 * 256);
  streamToSheet(bytes, sheet, 0);
  return Array.from({ length: 8 }, (_, y) =>
    Array.from(sheet.subarray(y * 256, y * 256 + 32), (value) =>
      value.toString(16).toUpperCase(),
    ).join(''),
  );
}
const edit = (index, bytes = original(index).map((value) => value ^ 255)) => ({
  address: baseline.streams[index].address,
  pixels: pixelsOf(bytes),
});
const decoded = (rom, entry) => lzDecode((n) => rom[romOffset(cpuOf(entry) + n)], 128, bitsFor);
const apply = (target, edits) =>
  applyRoomTileEdits(target.rom, target.present, asset(edits), baseline);
const load = (edits, progress = () => {}) =>
  loadCartridge(
    (name) =>
      name === ROOM_TILE_EDITS_FILE
        ? new TextEncoder().encode(JSON.stringify(asset(edits)))
        : readAsset(name),
    progress,
  );

test('empty edits preserve all cartridge bytes and presence; loader progress includes edit validation', async () => {
  const target = image();
  apply(target, []);
  assert.deepEqual(target, { rom: cartridge.rom, present: cartridge.present });
  const progress = [];
  const loaded = await load([], (done, total) => progress.push([done, total]));
  assert.deepEqual(loaded.rom, cartridge.rom);
  assert.deepEqual(loaded.present, cartridge.present);
  assert.equal(progress.length, progress.at(-1)[1] + 1);
  assert.deepEqual(
    progress.map(([done]) => done),
    Array.from({ length: progress.length }, (_, n) => n),
  );
});

test('exact-fit and shorter edits preserve every byte outside their admitted prefixes', async () => {
  const entries = [edit(0), edit(1, shorter(1))];
  const target = await load(entries);
  const first = decoded(target.rom, entries[0]);
  const second = decoded(target.rom, entries[1]);
  assert.equal(first.byteLength, decoded(cartridge.rom, entries[0]).byteLength);
  assert.ok(second.byteLength < decoded(cartridge.rom, entries[1]).byteLength);
  assert.deepEqual(
    first.data,
    original(0).map((value) => value ^ 255),
  );
  assert.deepEqual(second.data, shorter(1));
  const allowed = new Set(
    entries.flatMap((entry, i) =>
      Array.from(
        { length: i ? second.byteLength : first.byteLength },
        (_, n) => romOffset(cpuOf(entry)) + n,
      ),
    ),
  );
  for (let n = 0; n < target.rom.length; n++)
    if (!allowed.has(n))
      assert.equal(target.rom[n], cartridge.rom[n], `unchanged byte ${n.toString(16)}`);
  assert.deepEqual(target.present, cartridge.present);
});

test('an oversized edit after a valid edit rejects the entire set without writes', () => {
  let seed = 12345;
  const noise = Uint8Array.from({ length: 128 }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed >>> 24;
  });
  const target = image();
  assert.throws(() => apply(target, [edit(1), edit(0, noise)]), {
    reason: 'room_tile_edit_slot_exceeded',
  });
  assert.deepEqual(target, { rom: cartridge.rom, present: cartridge.present });
});

test('invalid formats, identities, fields and pixel grids reject atomically', () => {
  const valid = edit(0);
  const cases = [
    [null, 'room_tile_edits_format_required'],
    [{ format: 'other', edits: [] }, 'room_tile_edits_format_required'],
    [asset([valid, valid]), 'room_tile_edit_identity_required'],
    [asset([{ ...valid, address: '82:8001' }]), 'room_tile_edit_identity_required'],
    [asset([{ ...valid, tokens: '128' }]), 'room_tile_edit_fields_required'],
    [asset([{ ...valid, pixels: valid.pixels.slice(1) }]), 'room_tile_edit_pixels_required'],
    [
      asset([{ ...valid, pixels: ['G'.repeat(32), ...valid.pixels.slice(1)] }]),
      'room_tile_edit_pixels_required',
    ],
    [
      asset([{ ...valid, pixels: ['0'.repeat(31), ...valid.pixels.slice(1)] }]),
      'room_tile_edit_pixels_required',
    ],
    [asset([null]), 'room_tile_edit_identity_required'],
  ];
  for (const [input, reason] of cases) {
    const target = image();
    assert.throws(() => applyRoomTileEdits(target.rom, target.present, input, baseline), {
      reason,
    });
    assert.deepEqual(target, { rom: cartridge.rom, present: cartridge.present });
  }
});

test('missing source/margin bytes and a modified baseline reject before any write', () => {
  for (const [offset, entries] of [
    [romOffset(cpuOf(edit(1))), [edit(2), edit(1)]],
    [romOffset(cpuOf(edit(0))) + decoded(cartridge.rom, edit(0)).byteLength, [edit(2), edit(0)]],
  ]) {
    const target = image();
    target.present[offset] = 0;
    const before = target.rom.slice();
    assert.throws(() => apply(target, entries), { reason: 'rom_byte_absent' });
    assert.deepEqual(target.rom, before);
  }
  const changed = structuredClone(baseline);
  changed.streams[0].tokens = '128';
  const target = image();
  assert.throws(() => applyRoomTileEdits(target.rom, target.present, asset([edit(0)]), changed), {
    reason: 'room_tile_edit_baseline_required',
  });
  assert.deepEqual(target, { rom: cartridge.rom, present: cartridge.present });
});

test('native 9E7E produces edited pixels with intact destination neighbors and source presence', () => {
  for (const entry of [edit(0), edit(0, shorter(0)), edit(1535)]) {
    const target = image();
    apply(target, [entry]);
    const mem = new VmMemory(target.rom, new Uint8Array(0x20000), null, target.present);
    mem.wram.fill(0x5a, 0x1fff, 0x2081);
    mem.write16(0x1ef1, 0x1234);
    const pointer = cpuOf(entry) - 2;
    const vm = {
      mem,
      a: pointer & 0xffff,
      y: pointer >>> 16,
      x: 0x2000,
      s: 0x1ef0,
      d: 0,
      dbr: 0x80,
      p: 0,
      pc: 0x9e7e,
    };
    const accessor = new TaskAccessor(vm);
    accessor.load();
    accessor.ctx.programBank = 0x80;
    unpackFixedStream(accessor);
    assert.deepEqual(mem.wram.slice(0x2000, 0x2080), decoded(target.rom, entry).data);
    assert.equal(mem.wram[0x1fff], 0x5a);
    assert.equal(mem.wram[0x2080], 0x5a);
  }
});

test(
  'edited room tiles pass through the cold live scene loader and change the visible room',
  { timeout: 120000 },
  async () => {
    const addresses = new Map(baseline.streams.map((entry, index) => [cpuOf(entry), index]));
    const used = new Set();
    const pad = (n) => ([3000, 3300, 3600].some((at) => n >= at && n < at + 4) ? 0x1000 : 0);
    const base = new LiveGame(cartridge, { pad });
    const read8 = base.memory.read8.bind(base.memory);
    base.memory.read8 = (address) => {
      if (addresses.has(address)) used.add(addresses.get(address));
      return read8(address);
    };
    while (base.nmis < 5100) base.step();
    assert.ok(base.driver.ownsGame);
    assert.ok(used.size > 0, 'the live room actually reads room tile sources');
    const changed = new LiveGame(await load([...used].map((index) => edit(index))), { pad });
    while (changed.nmis < 5100) changed.step();
    assert.equal(changed.driver.ownsGame, true);
    const grid = SHAPE_GRID - 0x7e0000;
    assert.deepEqual(
      changed.memory.wram.slice(grid, grid + SHAPE_GRID_BYTES),
      base.memory.wram.slice(grid, grid + SHAPE_GRID_BYTES),
      'scene collision grid stays unchanged',
    );
    assert.deepEqual(changed.bus.ppu.cgram, base.bus.ppu.cgram, 'palettes stay unchanged');
    const picture = (game) =>
      renderMode1Frame(game.bus.ppu, { objects: true, rows: hdmaRows(game.bus) });
    const expected = picture(base),
      actual = picture(changed);
    assert.notDeepEqual(actual, expected, 'edited pixels reach the final room image');
    assert.notDeepEqual(changed.bus.ppu.vram, base.bus.ppu.vram);
  },
);
