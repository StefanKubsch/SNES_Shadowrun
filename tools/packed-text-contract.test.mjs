// Source and native layout boundaries for the packed text domains. This does
// not enable edits; docs/PACKED-TEXT-EDITING.md defines the admission contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartridge } from './cartridge-harness.mjs';
import { rom } from './task-native-dialog-harness.mjs';
import { drawPrologueLine } from '../src/frontend/title.mjs';
import { CUTSCENE_ANIMATIONS } from '../src/cutscene/cutscene-animation.mjs';
import { lzBits, lzDecode, lzEncode } from '../src/data/lz.mjs';
import { readLzStreams } from '../src/data/lz-streams.mjs';
import { romOffset } from '../src/data/rom-bytes.mjs';
import { buildLanguage, installLanguage } from '../src/data/language.mjs';
import { redirectLanguageStream } from '../proof/system/native-unpack.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import '../proof/system/dialog-register-helpers.mjs';

const assets = JSON.parse(readFileSync('assets/vm-lz.json', 'utf8'));
const germanAsset = JSON.parse(readFileSync('assets/vm-texts-de.json', 'utf8'));
const german = buildLanguage(germanAsset);
const germanRom = readFileSync('Shadowrun (G).sfc');
const bits = lzBits((i) => rom[romOffset(0x80a033 + i)]);
const domains = [
  {
    address: 0x81f5ce,
    label: '81:F5CE',
    format: 'text',
    german: 0x81f680,
    map: 0x81f803,
    germanMap: 0x81f897,
    font: 0x81f8b8,
    germanFont: 0x81f94f,
    lengths: [351, 412],
    packed: [273, 321],
    mapWords: 128,
    tiles: [82, 84],
  },
  {
    address: 0x81f2bd,
    label: '81:F2BD',
    format: 'credits',
    german: 0x81f361,
    map: 0x85fd38,
    germanMap: 0x85fd42,
    font: 0x85fc15,
    germanFont: 0x85fc15,
    lengths: [638, 654],
    packed: [464, 478],
    mapWords: 160,
    tiles: [54, 56],
  },
];
const readEnglish = (cpu) => cartridge.rom[romOffset(cpu)];
const readGerman = (cpu) => germanRom[romOffset(cpu)];
function unpack(read8, cpu) {
  const length = read8(cpu) | (read8(cpu + 1) << 8);
  const found = lzDecode((n) => read8(cpu + 2 + n), length, bits);
  return { ...found, data: Buffer.from(found.data), packed: found.byteLength + 2 };
}
function translated(cpu) {
  const label = cpu
    .toString(16)
    .toUpperCase()
    .replace(/(..)(....)/, '$1:$2');
  const bytes = Buffer.from(germanAsset.streams.find((s) => s.english === label).bytes, 'hex');
  return unpack((at) => bytes[at - cpu], cpu);
}
function pages(data, credits) {
  const groups = [];
  let at = 0;
  while (data[at]) {
    const count = credits ? data[at++] : 1;
    const lines = [];
    for (let n = 0; n < count; n++) {
      const end = data.indexOf(0, at);
      assert.ok(end >= at, 'every line terminates');
      lines.push(data.subarray(at, end).toString('latin1'));
      at = end + 1;
    }
    groups.push(lines);
  }
  assert.equal(at, data.length - 1, 'one final terminator, no trailing content');
  return credits ? groups : groups.flat();
}

for (const domain of domains) {
  test(`${domain.label}: decoded assets and source slots retain the original stream`, () => {
    const original = unpack(readEnglish, domain.address);
    const stored = assets.streams.find((s) => s.address === domain.label);
    const decoded = readLzStreams(readEnglish, [[domain.address, domain.format]]).streams[0];
    const field = domain.format === 'text' ? 'lines' : 'groups';
    assert.equal(original.data.length, domain.lengths[0]);
    assert.equal(original.packed, domain.packed[0]);
    assert.deepEqual(stored[field], decoded[field]);
    assert.deepEqual(stored[field], pages(original.data, domain.format === 'credits'));
    const tokens = stored.tokens.split(' ').map((t) => t.split(':').map(Number));
    const encoded = Buffer.from(lzEncode(original.data, tokens, bits));
    assert.deepEqual(
      encoded,
      Buffer.from(
        rom.subarray(romOffset(domain.address) + 2, romOffset(domain.address) + original.packed),
      ),
    );
    // These are occupied neighboring sources, not relocation space.
    const next = domain.address + original.packed;
    assert.equal(next, domain.format === 'text' ? 0x81f6df : 0x81f48d);
    assert.equal(cartridge.present[romOffset(next)], 1);
    assert.equal(readEnglish(next), rom[romOffset(next)]);
  });

  test(`${domain.label}: translated text, map and font remain one coherent source set`, () => {
    const text = translated(domain.address);
    const originalGerman = unpack(readGerman, domain.german).data;
    const expected =
      domain.format === 'text'
        ? originalGerman.map((c) => (c === 0x84 ? 0x24 : c))
        : originalGerman;
    assert.deepEqual(text.data, expected, 'only the documented German intro umlaut is corrected');
    assert.equal(text.data.length, domain.lengths[1]);
    assert.equal(text.packed, domain.packed[1]);
    assert.deepEqual(translated(domain.map).data, unpack(readGerman, domain.germanMap).data);
    assert.deepEqual(translated(domain.font).data, unpack(readGerman, domain.germanFont).data);
    for (const language of [0, 1]) {
      const get = language ? translated : (cpu) => unpack(readEnglish, cpu);
      const map = get(domain.map).data;
      assert.equal(map.length, domain.mapWords * 2);
      assert.equal(get(domain.font).data.length, domain.tiles[language] * 16);
      const content = pages(get(domain.address).data, domain.format === 'credits');
      assert.equal(content.length, domain.format === 'text' ? [28, 29][language] : 14);
      for (const line of content.flat()) {
        assert.ok(line.length <= 31, line);
        for (const char of line) {
          const code = char.charCodeAt(0);
          assert.ok(code >= 0x20 && code <= 0x7e, line);
          assert.ok((map.readUInt16LE(2 * (code - 0x20)) & 0x3ff) < domain.tiles[language]);
        }
      }
      if (domain.format === 'credits') {
        assert.deepEqual(
          content.map((g) => g.length),
          [3, 3, 3, 3, 4, 3, 3, 2, 4, 4, 4, 4, 3, 3],
        );
      }
    }
  });
}

test('font aliases distinguish glyph support from printable ASCII', () => {
  const intro = unpack(readEnglish, 0x81f803).data;
  const introDe = translated(0x81f803).data;
  const credits = unpack(readEnglish, 0x85fd38).data;
  const creditsDe = translated(0x85fd38).data;
  const word = (map, char) => map.readUInt16LE(2 * (char.charCodeAt(0) - 0x20));
  assert.equal(word(intro, '$'), 0, 'English intro dollar is blank');
  assert.equal(word(introDe, '$'), 4, 'German intro dollar carries the a umlaut');
  assert.equal(word(introDe, '%'), 5, 'German intro percent carries sharp s');
  assert.equal(word(credits, 'a'), word(credits, 'A'), 'English credits collapse case');
  assert.equal(word(creditsDe, 'a'), 44, 'German credits lowercase a carries A umlaut');
  assert.equal(word(creditsDe, 'u'), 45, 'German credits lowercase u carries U umlaut');
  assert.equal(word(creditsDe, 'A'), 17, 'uppercase A remains A');
  assert.equal(word(creditsDe, 'o'), word(creditsDe, 'O'));
  for (const map of [credits, creditsDe]) {
    assert.equal(word(map, '$'), 2, 'unsupported character selects the placeholder');
    assert.equal(word(map, ' '), 0, 'space is the blank tile');
  }
  const font = unpack(readEnglish, 0x85fc15).data;
  assert.deepEqual(
    [...font.subarray(32, 48)],
    Array(7).fill([0xfe, 0]).flat().concat(0, 0),
    'placeholder tile 2 is a solid seven-by-seven block',
  );
});

function fixture(entry, data) {
  const wram = new Uint8Array(0x20000);
  wram.set(data, 0x62a8);
  // Distinct nonzero words expose clearing and accidental writes outside the map.
  wram.fill(0x5a, 0x4ea8, 0x56a8);
  for (let c = 0; c < 128; c++) {
    wram[0x56a8 + 2 * c] = c + 1;
    wram[0x56a9 + 2 * c] = 0x3f;
  }
  return { entry, wram, a: 0, x: 0, y: 0, dbr: 0x7e, p: 0, io: [] };
}
const mapWords = (bytes) =>
  Array.from({ length: bytes.length / 2 }, (_, n) => bytes.readUInt16LE(2 * n));

// The prologue line 81:DE93 (lifted in src/frontend/title.mjs, golden trace attract; its
// register-level reference was retired on 2026-11-25) on a fixture: the row below the
// screen, the text offset of the next line (7E:0018) and the end delay (7E:001C).
test('intro centering, full rows and terminators match the original renderer', () => {
  for (const length of [0, 1, 30, 31, 32]) {
    const { wram } = fixture(0, [...Array(length).fill(0x41), 0, 0]),
      mem = new VmMemory(cartridge.rom, wram, null, cartridge.present);
    drawPrologueLine(mem);
    const output = Buffer.from(mem.wram.slice(0x5628, 0x5668)),
      cursor = mem.wram[0x18] | (mem.wram[0x19] << 8),
      delay = mem.wram[0x1c] | (mem.wram[0x1d] << 8);
    const expected = Array(32).fill(0);
    if (length)
      expected.fill(0x22, Math.floor((32 - length) / 2), Math.floor((32 - length) / 2) + length);
    assert.deepEqual(mapWords(output), expected, `length ${length}`);
    assert.equal(cursor, length ? length + 1 : 0);
    if (!length) assert.equal(delay, 4000, 'empty line stops further text, it is not spacing');
  }
});

// The credits page animation 81:D1F0 (lifted in src/cutscene/cutscene-animation.mjs,
// golden trace cutscenes) on a fixture: the text map, the text offset after the page
// (7E:119E) and the memory around them. Its video transfers are not needed here.
const CREDITS_ANIMATION = 0xd1f0;
function credits(data) {
  const { wram } = fixture(0, data),
    mem = new VmMemory(cartridge.rom, wram, null, cartridge.present),
    video = new Proxy({}, { get: () => () => {} });
  CUTSCENE_ANIMATIONS.get(CREDITS_ANIMATION)({ mem, wram: mem.wram, video });
  return {
    wram: mem.wram,
    output: Buffer.from(mem.wram.slice(0x4ea8, 0x56a8)),
    cursor: mem.read16(0x7e119e),
  };
}

test('credits centering exposes the 32-column stride and page overflow boundaries', () => {
  for (const [count, length] of [
    [0, 0],
    [1, 0],
    [4, 31],
    [4, 32],
    [5, 1],
    [15, 1],
  ]) {
    const data = count
      ? [count, ...Array.from({ length: count }, () => [...Array(length).fill(0x41), 0]).flat(), 0]
      : [0];
    const { output, cursor } = credits(data);
    assert.equal(cursor, data.length - 1, 'page consumes exactly its count and line terminators');
    const rows = [
      ...new Set(
        mapWords(output).flatMap((word, n) => (word === 0x2022 ? [Math.floor(n / 32)] : [])),
      ),
    ];
    if (!length) assert.deepEqual(rows, []);
    if (count === 4 && length === 31) assert.deepEqual(rows, [10, 12, 14, 16]);
    if (count === 4 && length === 32) assert.deepEqual(rows, [10, 13, 16, 19]);
    if (count === 5) assert.deepEqual(rows, [9, 11, 13, 15, 17]);
    if (count === 15)
      assert.deepEqual(
        rows,
        Array.from({ length: 14 }, (_, n) => 1 + 2 * n),
        'the first line writes outside the map; later offsets wrap into it',
      );
  }
});

test('credits M8 indexing aliases high character bytes and preserves the map high byte', () => {
  const { wram } = credits([1, 0xa1, 0, 0]);
  assert.equal(
    wram[0x5206] | (wram[0x5207] << 8),
    0x2002,
    'A1 aliases ASCII 21; only the low table byte replaces the tile',
  );
});

test('language switches select the source at unpack time and do not replace loaded WRAM', () => {
  const memory = new VmMemory(cartridge.rom, undefined, null, cartridge.present);
  for (const domain of domains) {
    const dp = new Map([
      [0xe1, domain.address & 0xffff],
      [0xe3, domain.address >>> 16],
    ]);
    const access = { dp: (at) => dp.get(at), dpWrite: (at, value) => dp.set(at, value) };
    redirectLanguageStream(memory, access);
    assert.equal((dp.get(0xe3) << 16) | dp.get(0xe1), domain.address);
    installLanguage(memory, german);
    redirectLanguageStream(memory, access);
    const source = (dp.get(0xe3) << 16) | dp.get(0xe1);
    assert.equal(source, german.streams.get(domain.address));
    const data = unpack((cpu) => memory.read8(cpu), source).data;
    memory.wram.set(data, 0x62a8);
    installLanguage(memory, null);
    assert.deepEqual(Buffer.from(memory.wram.slice(0x62a8, 0x62a8 + data.length)), data);
  }
});
