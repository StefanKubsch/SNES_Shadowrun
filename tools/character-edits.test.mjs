import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartridge, readAsset } from './cartridge-harness.mjs';
import { loadCartridge } from '../src/data/cartridge.mjs';
import {
  applyCharacterEdits,
  CHARACTER_EDITS_FILE,
  CHARACTER_EDITS_FORMAT,
} from '../src/data/character-edits.mjs';
import { VRAM_FORMATS, sheetsToCharacters } from '../src/data/vram-tiles.mjs';
import { readBmp } from '../src/data/tiles.mjs';
import { lzBits, lzDecode } from '../src/data/lz.mjs';
import { requireRomAddress, romOffset } from '../src/data/rom-bytes.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { unpackStreamLong } from '../src/task/native-unpack.mjs';
import { unpackPortrait } from '../src/task/native-dialog-portrait.mjs';
import { dialogAccess } from '../src/task/native-dialog-support.mjs';
import { buildLanguage, installLanguage } from '../src/data/language.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { startMenuWaiting } from '../src/game/credits.mjs';
import { renderMode1Frame } from '../src/video/ppu-frame.mjs';
import { hdmaRows } from '../src/video/hdma.mjs';

const baseline = JSON.parse(readFileSync('assets/vm-lz.json'));
const sources = baseline.streams.filter((s) => Object.hasOwn(VRAM_FORMATS, s.format));
const sheets = Object.fromEntries(
  Object.entries(baseline.sheets).map(([f, name]) => [f, readBmp(readFileSync(`assets/${name}`))]),
);
const bytes = new Map(sheetsToCharacters(sources, sheets).map((b, n) => [sources[n].address, b]));
const shared = sources.filter((s) => !['81:F8B8', '85:FC15'].includes(s.address));
const bits = lzBits((n) => cartridge.rom[romOffset(0x80a033 + n)]);
const asset = (edits = []) => ({ format: CHARACTER_EDITS_FORMAT, edits });
const image = () => ({ rom: cartridge.rom.slice(), present: cartridge.present.slice() });
const apply = (target, edits, base = baseline) =>
  applyCharacterEdits(target.rom, target.present, asset(edits), base, sheets);
const decode = (target, s) => {
  const cpu = requireRomAddress(s.address);
  return lzDecode((n) => target.rom[romOffset(cpu + 2 + n)], bytes.get(s.address).length, bits);
};
// Independent planar decoder for authoring rows; the production encoder does
// not participate in computing the expected unpacked bytes.
function edit(s, data = bytes.get(s.address).map((v) => v ^ 255)) {
  const bpp = VRAM_FORMATS[s.format],
    unit = bpp * 8;
  return {
    address: s.address,
    characters: Array.from({ length: s.tiles }, (_, index) => ({
      index,
      pixels: Array.from({ length: 8 }, (_, y) =>
        Array.from({ length: 8 }, (_, x) => {
          let v = 0;
          for (let p = 0; p < bpp; p++)
            v |= ((data[index * unit + (p >> 1) * 16 + y * 2 + (p & 1)] >> (7 - x)) & 1) << p;
          return v.toString(16).toUpperCase();
        }).join(''),
      ),
    })),
  };
}
const load = (edits) =>
  loadCartridge((name) =>
    name === CHARACTER_EDITS_FILE
      ? new TextEncoder().encode(JSON.stringify(asset(edits)))
      : readAsset(name),
  );

test('empty loader preserves every cartridge byte and reports complete progress', async () => {
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

test('all 56 shared identities accept exact-fit pixels in every format, confined to original prefixes', () => {
  assert.equal(shared.length, 56);
  const target = image();
  apply(
    target,
    shared.map((s) => edit(s)),
  );
  const expected = cartridge.rom.slice();
  for (const s of shared) {
    const found = decode(target, s),
      old = decode(cartridge, s);
    assert.equal(found.byteLength, old.byteLength, s.address);
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

test('shorter recompressed sources preserve headers, old tails and unchanged characters', async () => {
  const s = shared.find((s) => s.address === '81:FF08');
  const data = new Uint8Array(bytes.get(s.address).length);
  data[Number(s.tokens.split(' ')[0])] = 255;
  const target = await load([edit(s, data)]);
  const old = decode(cartridge, s),
    found = decode(target, s);
  assert.ok(found.byteLength < old.byteLength);
  assert.deepEqual(found.data, data);
  const start = romOffset(requireRomAddress(s.address)) + 2;
  const expected = cartridge.rom.slice();
  expected.set(target.rom.subarray(start, start + found.byteLength), start);
  assert.deepEqual(target.rom, expected);
  const mem = new VmMemory(target.rom, new Uint8Array(0x20000), null, target.present);
  mem.wram.fill(0x5a, 0x3fff, 0x4001 + data.length);
  mem.write16(0x1ef1, 0x1234);
  const cpu = requireRomAddress(s.address);
  const accessor = new TaskAccessor({
    mem,
    a: cpu & 0xffff,
    y: cpu >>> 16,
    x: 0x4000,
    s: 0x1ef0,
    d: 0,
    dbr: 0x80,
    p: 0,
    pc: 0x9f49,
  });
  accessor.load();
  accessor.ctx.programBank = 0x80;
  unpackStreamLong(accessor);
  assert.deepEqual(mem.wram.slice(0x4000, 0x4000 + data.length), data);
  assert.equal(mem.wram[0x3fff], 0x5a);
  assert.equal(mem.wram[0x4000 + data.length], 0x5a);
  const partialSource = shared.find((s) => s.address === '80:FF98');
  const unit = VRAM_FORMATS[partialSource.format] * 8;
  const one = edit(partialSource);
  one.characters = one.characters.slice(0, 1);
  const partial = image();
  apply(partial, [one]);
  assert.deepEqual(
    decode(partial, partialSource).data.subarray(0, unit),
    bytes
      .get(partialSource.address)
      .subarray(0, unit)
      .map((v) => v ^ 255),
  );
  assert.deepEqual(
    decode(partial, partialSource).data.subarray(unit),
    bytes.get(partialSource.address).subarray(unit),
  );
});

test('invalid entries and late oversize failures publish no bytes or presence marks', () => {
  const s = shared.find((s) => s.address === '81:FF08'),
    valid = edit(s);
  let seed = 12345;
  const noise = Uint8Array.from({ length: bytes.get(s.address).length }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed >>> 24;
  });
  const cases = [
    [null, 'character_edits_format_required'],
    [{ ...asset(), extra: true }, 'character_edits_format_required'],
    [asset([valid, valid]), 'character_edit_identity_required'],
    [asset([{ ...valid, address: '81:F8B8' }]), 'character_edit_language_font'],
    [asset([{ ...valid, address: '85:FC15' }]), 'character_edit_language_font'],
    [asset([{ ...valid, address: '81:F803' }]), 'character_edit_identity_required'],
    [asset([{ ...valid, address: '81:ff08' }]), 'character_edit_identity_required'],
    [asset([{ ...valid, tokens: '' }]), 'character_edit_fields_required'],
    [asset([{ ...valid, characters: null }]), 'character_edit_characters_required'],
    ...[-1, 0.5, s.tiles].map((index) => [
      asset([{ ...valid, characters: [{ ...valid.characters[0], index }] }]),
      'character_edit_index_required',
    ]),
    [
      asset([{ ...valid, characters: [valid.characters[0], valid.characters[0]] }]),
      'character_edit_index_required',
    ],
    ...[null, [], ['0'.repeat(8)], Array(8).fill('a'.repeat(8)), Array(8).fill('0'.repeat(9))].map(
      (pixels) => [
        asset([{ ...valid, characters: [{ index: 0, pixels }] }]),
        'character_edit_pixels_required',
      ],
    ),
    [
      asset([
        { ...edit(shared[0]), characters: [{ index: 0, pixels: Array(8).fill('44444444') }] },
      ]),
      'character_edit_pixels_required',
    ],
    [asset([edit(shared[0]), edit(s, noise)]), 'character_edit_slot_exceeded'],
    [asset([valid, null]), 'character_edit_fields_required'],
  ];
  for (const [input, reason] of cases) {
    const target = image();
    assert.throws(() => applyCharacterEdits(target.rom, target.present, input, baseline, sheets), {
      reason,
    });
    assert.deepEqual(target, { rom: cartridge.rom, present: cartridge.present });
  }
});

test('baseline, header, source and native word-read margin mismatches reject atomically', () => {
  const s = shared.find((source) => {
    const at = romOffset(requireRomAddress(source.address));
    const bitStart = cartridge.rom[at + 2] | (cartridge.rom[at + 3] << 8);
    return (
      (decode(cartridge, source).byteLength - bitStart) % 2 === 1 &&
      source.address !== shared[0].address
    );
  });
  const cpu = requireRomAddress(s.address),
    old = decode(cartridge, s);
  const bitStart = cartridge.rom[romOffset(cpu) + 2] | (cartridge.rom[romOffset(cpu) + 3] << 8);
  const margin = 2 + bitStart + 2 * Math.ceil((old.byteLength - bitStart) / 2);
  assert.equal(
    margin,
    old.byteLength + 3,
    'the missing final byte is a borrowed native word-read margin',
  );
  for (const n of [0, 4, margin - 1]) {
    const target = image();
    target.present[romOffset(cpu) + n] = 0;
    const before = structuredClone(target);
    assert.throws(() => apply(target, [edit(shared[0]), edit(s)]), { reason: 'rom_byte_absent' });
    assert.deepEqual(target, before);
  }
  for (const kind of ['header', 'tokens', 'pixels']) {
    const target = image(),
      base = structuredClone(baseline);
    if (kind === 'header') target.rom[romOffset(cpu)] ^= 1;
    else if (kind === 'pixels') target.rom[romOffset(cpu) + 4] ^= 1;
    else base.streams.find((v) => v.address === s.address).tokens = '1';
    const before = structuredClone(target);
    assert.throws(() => apply(target, [edit(s)], base), {
      reason: 'character_edit_baseline_required',
    });
    assert.deepEqual(target, before);
  }
  for (const field of ['address', 'format', 'tiles']) {
    const base = structuredClone(baseline);
    const source = base.streams.find((v) => v.address === s.address);
    source[field] =
      field === 'address'
        ? '82:8001'
        : field === 'format'
          ? source.format === 'bg2'
            ? 'obj4'
            : 'bg2'
          : source.tiles + 1;
    const target = image();
    assert.throws(() => apply(target, [edit(s)], base), {
      reason: 'character_edit_baseline_required',
    });
    assert.deepEqual(target, { rom: cartridge.rom, present: cartridge.present });
  }
});

test('native unpack respects output guards in every format and shared portrait aliases survive language switches', () => {
  const portraits = JSON.parse(readFileSync('assets/vm-portraits.json')).portraits;
  const portrait = shared.find((s) => portraits.filter((p) => p.stream === s.address).length > 1);
  const selected = [
    shared.find((s) => s.format === 'bg2'),
    shared.find((s) => s.format === 'bg4'),
    portrait,
  ];
  const target = image();
  apply(
    target,
    selected.map((s) => edit(s)),
  );
  const german = buildLanguage(JSON.parse(readFileSync('assets/vm-texts-de.json')));
  const mem = new VmMemory(target.rom, new Uint8Array(0x20000), null, target.present);
  for (const language of [german, null, german]) {
    installLanguage(mem, language);
    for (const s of selected) {
      const cpu = requireRomAddress(s.address),
        length = bytes.get(s.address).length;
      const portraitSource = s === portrait;
      const offset = portraitSource ? 0x15250 : 0x4000;
      mem.wram.fill(0x5a, offset - 1, offset + length + 1);
      mem.write16(0x1ef1, 0x1234);
      const vm = {
        mem,
        a: cpu & 0xffff,
        y: cpu >>> 16,
        x: offset & 0xffff,
        s: 0x1ef0,
        d: 0,
        dbr: 0x80,
        p: 0,
        pc: 0x9f49,
      };
      const a = new TaskAccessor(vm);
      a.load();
      a.ctx.programBank = 0x80;
      if (portraitSource) unpackPortrait(dialogAccess(a));
      else unpackStreamLong(a);
      assert.deepEqual(
        mem.wram.slice(offset, offset + length),
        bytes.get(s.address).map((v) => v ^ 255),
      );
      assert.equal(mem.wram[offset - 1], 0x5a);
      assert.equal(mem.wram[offset + length], 0x5a);
    }
    for (const record of portraits.filter((p) => p.stream === portrait.address))
      assert.equal(
        mem.read16(requireRomAddress(record.address)),
        requireRomAddress(portrait.address) & 0xffff,
      );
  }
});

test(
  'edited frontend font reaches the cold live menu and visibly changes pixels',
  { timeout: 180000 },
  async () => {
    const source = shared.find((s) => s.address === '84:DAF2');
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
