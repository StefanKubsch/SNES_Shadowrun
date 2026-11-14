import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartridge, readAsset } from './cartridge-harness.mjs';
import { loadCartridge } from '../src/data/cartridge.mjs';
import { applyMapEdits, MAP_EDITS_FILE, MAP_EDITS_FORMAT } from '../src/data/map-edits.mjs';
import { auditMapStreams } from './map-stream-audit.mjs';
import { lzBits, lzDecode } from '../src/data/lz.mjs';
import { requireRomAddress, romOffset } from '../src/data/rom-bytes.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { unpackStreamLong } from '../src/task/native-unpack.mjs';
import { buildLanguage, installLanguage } from '../src/data/language.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { startMenuWaiting } from '../src/game/credits.mjs';
import { renderMode1Frame } from '../src/video/ppu-frame.mjs';
import { hdmaRows } from '../src/video/hdma.mjs';

const baseline = JSON.parse(readFileSync('assets/vm-lz.json'));
const inventory = await auditMapStreams();
const shared = inventory.streams.filter(
  (s) => s.role === 'ppu-screen-map' && s.language_policy === 'shared-source',
);
const excluded = inventory.streams.filter((s) => !shared.includes(s));
const bytes = new Map(
  baseline.streams
    .filter((s) => s.format === 'map')
    .map((s) => [
      s.address,
      Uint8Array.from(
        s.words
          .join(' ')
          .split(/\s+/)
          .flatMap((w) => {
            const value = parseInt(w, 16);
            return [value & 255, value >>> 8];
          }),
      ),
    ]),
);
const bits = lzBits((n) => cartridge.rom[romOffset(0x80a033 + n)]);
const asset = (edits = []) => ({ format: MAP_EDITS_FORMAT, edits });
const image = () => ({ rom: cartridge.rom.slice(), present: cartridge.present.slice() });
const apply = (target, edits, base = baseline) =>
  applyMapEdits(target.rom, target.present, asset(edits), base);
const decode = (target, s) => {
  const at = romOffset(requireRomAddress(s.address));
  return lzDecode((n) => target.rom[at + 2 + n], s.output_bytes, bits);
};
const edit = (s, data = bytes.get(s.address).map((v) => v ^ 255)) => ({
  address: s.address,
  words: Array.from({ length: data.length / 2 }, (_, index) => ({
    index,
    value: (data[2 * index] | (data[2 * index + 1] << 8))
      .toString(16)
      .toUpperCase()
      .padStart(4, '0'),
  })),
});
const load = (edits) =>
  loadCartridge((name) =>
    name === MAP_EDITS_FILE
      ? new TextEncoder().encode(JSON.stringify(asset(edits)))
      : readAsset(name),
  );

test('empty map edits preserve the cartridge and complete loader progress', async () => {
  const target = image();
  apply(target, []);
  assert.deepEqual(target, { rom: cartridge.rom, present: cartridge.present });
  const progress = [];
  const loaded = await loadCartridge(readAsset, (done, total) => progress.push([done, total]));
  assert.deepEqual(loaded.rom, cartridge.rom);
  assert.deepEqual(loaded.present, cartridge.present);
  assert.equal(progress.length, progress.at(-1)[1] + 1);
  assert.deepEqual(
    progress.map((p) => p[0]),
    Array.from({ length: progress.length }, (_, n) => n),
  );
});

test('all 20 shared identities accept exact-fit words within original packed prefixes', () => {
  assert.equal(shared.length, 20);
  const target = image();
  apply(
    target,
    shared.map((s) => edit(s)),
  );
  const expected = cartridge.rom.slice();
  for (const s of shared) {
    const found = decode(target, s);
    assert.equal(found.byteLength + 2, s.packed_slot_bytes, s.address);
    assert.deepEqual(
      found.data,
      bytes.get(s.address).map((v) => v ^ 255),
      s.address,
    );
    const start = romOffset(requireRomAddress(s.address)) + 2;
    expected.set(target.rom.subarray(start, start + found.byteLength), start);
  }
  assert.deepEqual(target.rom, expected);
  assert.deepEqual(target.present, cartridge.present);
});

test('shorter recompression retains headers and old tails; partial edits retain unnamed words', async () => {
  const s = shared.find((s) => s.address === '85:D8B1');
  const source = baseline.streams.find((v) => v.address === s.address);
  const data = new Uint8Array(s.output_bytes);
  data[Number(source.tokens.split(' ')[0])] = 255;
  const target = await load([edit(s, data)]);
  const found = decode(target, s);
  assert.ok(found.byteLength < s.packed_slot_bytes - 2);
  assert.deepEqual(found.data, data);
  const start = romOffset(requireRomAddress(s.address)) + 2;
  const expected = cartridge.rom.slice();
  expected.set(target.rom.subarray(start, start + found.byteLength), start);
  assert.deepEqual(target.rom, expected);
  assert.deepEqual(target.present, cartridge.present);
  // A literal word can change without breaking original backreferences.
  const partial = image();
  const one = { address: s.address, words: [{ index: s.words - 1, value: 'FFFF' }] };
  apply(partial, [one]);
  const partialExpected = bytes.get(s.address).slice();
  partialExpected.set([255, 255], partialExpected.length - 2);
  assert.deepEqual(decode(partial, s).data, partialExpected);
});

test('malformed entries, all excluded sources and a late overflow leave the cartridge unchanged', () => {
  const s = shared[0],
    valid = edit(s);
  let seed = 12345;
  const noise = Uint8Array.from({ length: s.output_bytes }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed >>> 24;
  });
  const cases = [
    [null, 'map_edits_format_required'],
    [{ ...asset(), extra: true }, 'map_edits_format_required'],
    [asset([valid, valid]), 'map_edit_identity_required'],
    [asset([{ ...valid, address: '81:fef0' }]), 'map_edit_identity_required'],
    [asset([{ ...valid, address: '82:8000' }]), 'map_edit_identity_required'],
    [asset([{ ...valid, tokens: '' }]), 'map_edit_fields_required'],
    [asset([{ ...valid, words: null }]), 'map_edit_words_required'],
    [asset([null]), 'map_edit_fields_required'],
    [asset([{ address: s.address, words: [null] }]), 'map_edit_fields_required'],
    ...excluded.map((x) => [
      asset([{ address: x.address, words: [] }]),
      x.language_policy !== 'shared-source' ? 'map_edit_language_map' : 'map_edit_specialized_map',
    ]),
    ...[-1, 0.5, s.words, null].map((index) => [
      asset([{ address: s.address, words: [{ index, value: '0000' }] }]),
      'map_edit_index_required',
    ]),
    ...['ffff', 'FFF', '10000', 'GGGG', 0, null].map((value) => [
      asset([{ address: s.address, words: [{ index: 0, value }] }]),
      'map_edit_value_required',
    ]),
    [
      asset([
        {
          address: s.address,
          words: [
            { index: 0, value: '0000' },
            { index: 0, value: '0001' },
          ],
        },
      ]),
      'map_edit_index_required',
    ],
    [
      asset([{ address: s.address, words: [{ index: 0, value: '0000', extra: true }] }]),
      'map_edit_fields_required',
    ],
    [asset([edit(shared[1]), edit(s, noise)]), 'map_edit_slot_exceeded'],
  ];
  assert.equal(excluded.length, 7);
  for (const [input, reason] of cases) {
    const target = image();
    assert.throws(() => applyMapEdits(target.rom, target.present, input, baseline), { reason });
    assert.deepEqual(target, { rom: cartridge.rom, present: cartridge.present });
  }
});

test('baseline descriptors, words, tokens, slot bytes and missing native margins reject atomically', () => {
  const s = shared.find((s) => s.word_read_margin_bytes);
  const at = romOffset(requireRomAddress(s.address));
  for (const kind of ['identity', 'format', 'words', 'tokens', 'count', 'slot']) {
    const target = image(),
      base = structuredClone(baseline);
    const source = base.streams.find((v) => v.address === s.address);
    if (kind === 'identity') source.address = '82:8001';
    if (kind === 'format') source.format = 'bytes';
    if (kind === 'words') source.words[0] = source.words[0].replace(/^[0-9A-F]{4}/, 'FFFF');
    if (kind === 'tokens') source.tokens = '1';
    if (kind === 'count') source.words = ['0000'];
    if (kind === 'slot') target.rom[at + 4] ^= 1;
    const before = structuredClone(target);
    assert.throws(() => apply(target, [edit(s)], base), { reason: 'map_edit_baseline_required' });
    assert.deepEqual(target, before);
  }
  for (const offset of [0, 4, s.packed_slot_bytes]) {
    const target = image();
    target.present[at + offset] = 0;
    const before = structuredClone(target);
    assert.throws(() => apply(target, [edit(shared.find((x) => x !== s)), edit(s)]), {
      reason: 'rom_byte_absent',
    });
    assert.deepEqual(target, before);
  }
});

test('native unpack preserves transfer tails and aliases in both languages for every shared source', () => {
  const target = image();
  apply(
    target,
    shared.map((s) => edit(s)),
  );
  const mem = new VmMemory(target.rom, new Uint8Array(0x20000), null, target.present);
  const german = buildLanguage(JSON.parse(readFileSync('assets/vm-texts-de.json')));
  assert.equal(shared.find((s) => s.address === '87:E272').scene_commands.length, 3);
  for (const language of [german, null, german]) {
    installLanguage(mem, language);
    for (const s of shared) {
      const cpu = requireRomAddress(s.address);
      mem.wram.fill(0x5a, 0x46a7, 0x4ea9);
      mem.write16(0x1ef1, 0x1234);
      const a = new TaskAccessor({
        mem,
        a: cpu & 65535,
        y: cpu >>> 16,
        x: 0x46a8,
        s: 0x1ef0,
        d: 0,
        dbr: 0x80,
        p: 0,
        pc: 0x9f4d,
      });
      a.load();
      a.ctx.programBank = 0x80;
      unpackStreamLong(a, true, 0x809f4d);
      assert.deepEqual(
        mem.wram.slice(0x46a8, 0x46a8 + s.output_bytes),
        bytes.get(s.address).map((v) => v ^ 255),
        s.address,
      );
      assert.equal(mem.wram[0x46a7], 0x5a, s.address);
      assert.ok(
        mem.wram.slice(0x46a8 + s.output_bytes, 0x4ea9).every((v) => v === 0x5a),
        s.address,
      );
    }
  }
});

test(
  'edited shared map reaches the cold live menu and changes rendered pixels with palettes intact',
  { timeout: 180000 },
  async () => {
    const source = shared.find((s) => s.address === '84:D8DD');
    const edited = await load([edit(source)]);
    const games = [cartridge, edited].map((c) => {
      let waiting = false;
      const game = new LiveGame(c, {
        pad: (n) => {
          waiting ||= startMenuWaiting(game);
          return !waiting && n >= 3000 && n % 150 < 4 ? 0x1000 : 0;
        },
      });
      return game;
    });
    for (const game of games) {
      while (game.nmis < 12000 && !startMenuWaiting(game)) game.step();
      assert.ok(startMenuWaiting(game));
      for (let i = 0; i < 30; i++) game.step();
    }
    const picture = (g) => renderMode1Frame(g.bus.ppu, { objects: true, rows: hdmaRows(g.bus) });
    assert.deepEqual(games[0].bus.ppu.cgram, games[1].bus.ppu.cgram);
    assert.notDeepEqual(games[0].bus.ppu.vram, games[1].bus.ppu.vram);
    assert.notDeepEqual(picture(games[0]), picture(games[1]));
  },
);
