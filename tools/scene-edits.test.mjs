import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartridge, readAsset } from './cartridge-harness.mjs';
import { loadCartridge } from '../src/data/cartridge.mjs';
import { applySceneEdits, SCENE_EDITS_FILE, SCENE_EDITS_FORMAT } from '../src/data/scene-edits.mjs';
import { encodeScene } from '../src/data/scenes.mjs';
import { readSceneTable } from '../src/data/lz-streams.mjs';
import { lzBits, lzDecode } from '../src/data/lz.mjs';
import { requireRomAddress, romOffset } from '../src/data/rom-bytes.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { dialogAccess } from '../src/task/native-dialog-support.mjs';
import { loadScene } from '../src/task/main-scene-load.mjs';
import { SCENE_COLLISION_ROUTINES } from '../src/task/main-scene-collision.mjs';
import { SCENE_RECORD, SCENE_BACKDROP, DP_SCENE_RECORD, ROOM } from '../src/task/wram.mjs';
import { buildLanguage, installLanguage } from '../src/data/language.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { renderMode1Frame } from '../src/video/ppu-frame.mjs';
import { hdmaRows } from '../src/video/hdma.mjs';
import { inspectRom } from './rom.mjs';

const json = (name) => JSON.parse(readFileSync(`assets/vm-${name}.json`));
const baseline = json('lz'),
  scenes = json('scenes'),
  rooms = json('rooms');
const sources = baseline.streams.filter((s) => s.format === 'scene');
const bits = lzBits((n) => cartridge.rom[romOffset(0x80a033 + n)]);
const asset = (edits = []) => ({ format: SCENE_EDITS_FORMAT, edits });
const edit = (s, backdrop = '7C1F') => ({ address: s.address, backdrop });
const image = () => ({ rom: cartridge.rom.slice(), present: cartridge.present.slice() });
const apply = (target, edits, base = baseline, records = scenes) =>
  applySceneEdits(target.rom, target.present, asset(edits), base, records);
const decode = (target, s) => {
  const at = romOffset(requireRomAddress(s.address));
  return lzDecode((n) => target.rom[at + 2 + n], encodeScene(s).length, bits);
};
const load = (edits) =>
  loadCartridge((name) =>
    name === SCENE_EDITS_FILE
      ? new TextEncoder().encode(JSON.stringify(asset(edits)))
      : readAsset(name),
  );

// Native construction, followed by both static object collision lists. Empty
// synthetic room-zone lists isolate these consumers from route initialization.
function construct(target, index, language = null) {
  const mem = new VmMemory(target.rom, new Uint8Array(0x20000), null, target.present);
  // Switching back to English must leave shared scene sources untouched too.
  for (const selected of [language, null, language]) installLanguage(mem, selected);
  const end = SCENE_RECORD + encodeScene(scenes.scenes[index]).length;
  mem.write8(end, 0xa5);
  const a = new TaskAccessor({
    mem,
    a: index,
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
  assert.equal(h.dp(DP_SCENE_RECORD), end & 65535);
  assert.equal(mem.read8(end), 0xa5);
  h.dpWrite(0x9a, 0x1000, 2);
  h.dpWrite(0x9c, 0x7e, 1);
  mem.wram.fill(0, 0x1000, 0x1008);
  h.call(0x80a584, 0x818756, () => SCENE_COLLISION_ROUTINES.get(0x818756)(h), true);
  return mem;
}

test('empty scene edits preserve every cartridge byte and loader progress', async () => {
  const target = image();
  apply(target, []);
  assert.deepEqual(target, { rom: cartridge.rom, present: cartridge.present });
  const progress = [];
  const loaded = await loadCartridge(readAsset, (n, total) => progress.push([n, total]));
  assert.deepEqual(loaded.rom, cartridge.rom);
  assert.deepEqual(
    progress.map(([n]) => n),
    Array.from({ length: progress.at(-1)[1] + 1 }, (_, n) => n),
  );
});

test('all original capacities match the ROM and every BGR555 colour has an exact-fit token contract', () => {
  const { bytes } = inspectRom(readFileSync('Shadowrun (E).smc'));
  const target = image();
  apply(
    target,
    scenes.scenes.map((s) => edit(s)),
  );
  const expected = cartridge.rom.slice();
  for (const [n, s] of scenes.scenes.entries()) {
    const at = romOffset(requireRomAddress(s.address)),
      original = decode(cartridge, s);
    const tokens = sources
      .find((v) => v.address === s.address)
      .tokens.split(' ')
      .map((t) => t.split(':').map(Number));
    // Both backdrop bytes are literals; no reference ever copies either byte.
    // Therefore all 32768 values retain the original tokens and packed size:
    // shorter and oversized outputs are unattainable under this edit contract.
    assert.ok(tokens[0][0] >= 2);
    assert.ok(tokens.every((t) => t.length === 1 || t[0] >= 2));
    const capacity = original.byteLength + 2;
    assert.deepEqual(
      cartridge.rom.slice(at, at + capacity),
      new Uint8Array(bytes.subarray(at, at + capacity)),
    );
    const found = decode(target, s),
      data = encodeScene(s);
    data.set([0x1f, 0x7c]);
    assert.deepEqual(found.data, data, s.address);
    assert.equal(found.byteLength, original.byteLength);
    assert.equal(
      found.tokens.reduce((sum, t) => sum + t.at(-1), 0),
      data.length,
    );
    expected.set(target.rom.subarray(at + 2, at + capacity), at + 2);
    assert.ok(rooms.rooms.some((r) => r.scene === n));
  }
  assert.deepEqual(target.rom, expected);
  assert.deepEqual(target.present, cartridge.present);
  assert.deepEqual(
    readSceneTable((cpu) => target.rom[romOffset(cpu)]),
    readSceneTable((cpu) => cartridge.rom[romOffset(cpu)]),
  );
});

test('malformed and duplicate edits reject the whole set, including after a valid entry', () => {
  const valid = edit(scenes.scenes[0]),
    second = edit(scenes.scenes[1]);
  const cases = [
    [null, 'scene_edits_format_required'],
    [{ ...asset(), extra: true }, 'scene_edits_format_required'],
    [asset([valid, valid]), 'scene_edit_identity_required'],
    ...[null, { ...second, tileset: 1 }, { ...second, words: [] }].map((s) => [
      asset([valid, s]),
      'scene_edit_fields_required',
    ]),
    ...['8b:D0BB', '00:0001', 0, undefined].map((address) => [
      asset([valid, { ...second, address }]),
      'scene_edit_identity_required',
    ]),
    ...['8000', 'FFFF', '7fff', 'FFF', '10000', 'GGGG', 0, null, undefined].map((backdrop) => [
      asset([valid, { ...second, backdrop }]),
      'scene_edit_value_required',
    ]),
  ];
  for (const [input, reason] of cases) {
    const target = image();
    assert.throws(() => applySceneEdits(target.rom, target.present, input, baseline, scenes), {
      reason,
    });
    assert.deepEqual(target, { rom: cartridge.rom, present: cartridge.present });
  }
  for (const value of ['0000', '0001', '7FFF']) {
    const target = image();
    apply(target, [edit(scenes.scenes[0], value)]);
    assert.deepEqual(
      decode(target, scenes.scenes[0]).data.subarray(0, 2),
      Uint8Array.of(parseInt(value, 16) & 255, parseInt(value, 16) >>> 8),
    );
  }
});

test('modified baselines, slot bytes, pointers and absent native word margins reject atomically', () => {
  const s = scenes.scenes.find((v) => decode(cartridge, v).byteLength % 2 === 1);
  const at = romOffset(requireRomAddress(s.address));
  for (const kind of [
    'identity',
    'format',
    'tokens',
    'count',
    'record',
    'order',
    'slot',
    'header',
    'pointer',
    'presence',
  ]) {
    const target = image(),
      base = structuredClone(baseline),
      records = structuredClone(scenes);
    const source = base.streams.find((v) => v.address === s.address);
    if (kind === 'identity') source.address = '82:8001';
    if (kind === 'format') source.format = 'bytes';
    if (kind === 'tokens') source.tokens = '1';
    if (kind === 'count') records.scenes.pop();
    if (kind === 'record') records.scenes.find((v) => v.address === s.address).backdrop = '001F';
    if (kind === 'order') records.scenes.reverse();
    if (kind === 'slot') target.rom[at + 4] ^= 1;
    if (kind === 'header') target.rom[at] ^= 1;
    if (kind === 'pointer') target.rom[romOffset(0x8bf9e3)] ^= 1;
    if (kind === 'presence') target.present[at + 4] = 0;
    const before = structuredClone(target);
    assert.throws(() => apply(target, [edit(scenes.scenes[0]), edit(s)], base, records));
    assert.deepEqual(target, before);
  }
  // Pick the actual native read endpoint rather than inferring it from parity.
  const margin = scenes.scenes.find((v) => {
    const start = romOffset(requireRomAddress(v.address)),
      found = decode(cartridge, v);
    const packed = cartridge.rom.subarray(start + 2, start + 2 + found.byteLength);
    const bitStart = packed[0] | (packed[1] << 8);
    return (
      Math.max(bitStart + 1, bitStart + 2 * Math.ceil((packed.length - bitStart) / 2)) >
      packed.length
    );
  });
  const target = image(),
    start = romOffset(requireRomAddress(margin.address));
  target.present[start + 2 + decode(cartridge, margin).byteLength] = 0;
  const before = structuredClone(target);
  assert.throws(() => apply(target, [edit(scenes.scenes[0]), edit(margin)]), {
    reason: 'rom_byte_absent',
  });
  assert.deepEqual(target, before);
});

test('every native scene and static collision result changes only the backdrop in both languages', () => {
  const target = image();
  apply(
    target,
    scenes.scenes.map((s) => edit(s)),
  );
  const german = buildLanguage(json('texts-de'));
  for (const [index, s] of scenes.scenes.entries()) {
    const original = construct(cartridge, index);
    for (const language of [null, german]) {
      const edited = construct(target, index, language);
      assert.equal(edited.read16(SCENE_BACKDROP), 0x7c1f, s.address);
      const expected = original.wram.slice();
      for (const address of [SCENE_BACKDROP, SCENE_RECORD])
        expected.set([0x1f, 0x7c], address & 0x1ffff);
      assert.deepEqual(edited.wram, expected, s.address);
    }
  }
});

test(
  'cold live room sends the edited backdrop to colour zero with geometry and other palettes intact',
  { timeout: 180000 },
  async () => {
    const edited = await load(scenes.scenes.map((s) => edit(s)));
    const games = [cartridge, edited].map(
      (c) =>
        new LiveGame(c, {
          pad: (k) => (k >= 3000 && k < 3400 && k % 150 < 4 ? 0x1000 : 0),
        }),
    );
    for (const game of games) {
      while (game.nmis < 5000) game.step();
      assert.ok(game.driver.ownsGame);
    }
    assert.equal(games[0].vm.mem.read16(0x7e0000 + ROOM), games[1].vm.mem.read16(0x7e0000 + ROOM));
    const p = games.map((g) => g.bus.ppu);
    assert.deepEqual(p[0].vram, p[1].vram);
    assert.deepEqual(p[0].oam, p[1].oam);
    assert.deepEqual(p[0].cgram.slice(2), p[1].cgram.slice(2));
    assert.deepEqual(p[1].cgram.slice(0, 2), Uint8Array.of(0x1f, 0x7c));
    const pictures = games.map((g) =>
      renderMode1Frame(g.bus.ppu, { objects: true, rows: hdmaRows(g.bus) }),
    );
    assert.notDeepEqual(pictures[0], pictures[1]);
  },
);
