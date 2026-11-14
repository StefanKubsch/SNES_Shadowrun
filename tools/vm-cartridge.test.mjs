import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { romBytes } from './task-native-dialog-harness.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory, VmFault } from '../src/vm/memory.mjs';
import { placeTexts, readText } from '../src/data/texts.mjs';
import { romOffset } from '../src/data/rom-bytes.mjs';
import { readBmp, writeBmp, sheetToStream, placeTiles } from '../src/data/tiles.mjs';
import { lzBits, lzDecode, lzEncode } from '../src/data/lz.mjs';
import { placeVramTiles } from '../src/data/vram-tiles.mjs';
import { placeLzStreams } from '../src/data/lz-streams.mjs';
import { placeMenuTexts } from '../src/data/menu-texts.mjs';
import { placePaletteCycles } from '../src/data/palette-cycles.mjs';
import { placeRooms, readRooms } from '../src/data/rooms.mjs';
import { placeActors, readActors } from '../src/data/actors.mjs';
import { placeKinds, readKinds } from '../src/data/kinds.mjs';
import { placeActions, readActions } from '../src/data/actions.mjs';
import { placePictures, readPictures } from '../src/data/pictures.mjs';
import { placeTopics, readTopics } from '../src/data/topics.mjs';
import { placeSound, readSound } from '../src/data/sound.mjs';
import { readWav } from '../src/data/brr.mjs';
import { placePortraits, readPortraits } from '../src/data/portraits.mjs';
import { placeDialogs, readDialogs } from '../src/data/dialogs.mjs';
import { placeRunners, readRunners } from '../src/data/runners.mjs';
import { readSpcDriver, spcDriverBytes } from '../src/data/spc-driver.mjs';
import { readTables, placeTables, readAnimations } from '../src/data/tables.mjs';
import { readMatrixTexts, placeMatrixTexts } from '../src/data/matrix-texts.mjs';
import { fnv1a, DRIVER_FNV } from '../src/apu/apu.mjs';
import { readSceneListStreams, placeSceneLists } from '../src/data/scene-lists.mjs';
import { decodeScene, encodeScene } from '../src/data/scenes.mjs';
import { placeTilesets, readTilesets } from '../src/data/tilesets.mjs';
import { placeObjectTypes, readObjectTypes } from '../src/data/object-types.mjs';
import { placeObjectGraphics, readObjectGraphics } from '../src/data/object-graphics.mjs';
import { readFont, placeFont, FONT_WIDTH, FONT_HEIGHT } from '../src/data/font.mjs';
import { readHeader, placeHeader } from '../src/data/header.mjs';

// Data package without the ROM (docs/ROM-FREE.md).
const manifest = JSON.parse(
  readFileSync(new URL('../assets/vm-cartridge.json', import.meta.url), 'utf8'),
);
const rawFile = JSON.parse(readFileSync(new URL('../assets/vm-raw.json', import.meta.url), 'utf8'));
const map = JSON.parse(
  readFileSync(new URL('../analysis/vm-rom-map.json', import.meta.url), 'utf8'),
);
const reads = JSON.parse(
  readFileSync(new URL('../analysis/rom-reads.json', import.meta.url), 'utf8'),
);
const CODE_CLASSES = new Set([
  'code',
  'code_kept',
  'code_static',
  'code_dead',
  'code_unused_native',
  'code_unused_opcode',
]);
const classOf = [];
for (const r of map.ranges)
  for (let o = parseInt(r.rom_offset, 16), e = o + r.length; o < e; o++) classOf[o] = r.class;
// The classes of the bytes in original form (vm-raw.json).
const rawClasses = new Set();
for (const kind of ['code_bytes', 'unread'])
  for (const run of rawFile[kind])
    for (let i = 0; i < run.hex.length / 2; i++)
      rawClasses.add(classOf[romOffset(parseInt(run.address.replace(':', ''), 16) + i)]);

test('the package holds every data byte unchanged and of the code only the bytes data readers touch', () => {
  const { rom, present } = cartridge;
  const readSet = new Set();
  for (const [offset, length] of reads.ranges)
    for (let o = offset; o < offset + length; o++) readSet.add(o);
  let absent = 0,
    kept = 0;
  for (let o = 0; o < romBytes.length; o++) {
    const code = CODE_CLASSES.has(classOf[o]);
    if (!code || present[o]) {
      assert.equal(present[o], 1, `present ${o.toString(16)}`);
      if (rom[o] !== romBytes[o]) assert.fail(`byte ${o.toString(16)} differs from the ROM`);
      if (code) {
        kept++;
        assert.ok(
          classOf[o] === 'code_kept' || readSet.has(o) || !CODE_CLASSES.has(classOf[o - 1]),
          `kept code ${o.toString(16)}`,
        );
      }
    } else {
      absent++;
      assert.equal(rom[o], 0);
    }
  }
  assert.equal(absent, manifest.absent_code_bytes);
  // Every code byte behind a data byte stays (a word read at the end of data).
  for (let o = 1; o < romBytes.length; o++)
    if (CODE_CLASSES.has(classOf[o]) && !CODE_CLASSES.has(classOf[o - 1]))
      assert.equal(present[o], 1, `margin ${o.toString(16)}`);
  // The 2026-11-09 audit removes 200 margins between two code classes.
  // All actual reads, including the four A985/D15C words, remain retained.
  assert.equal(kept, 93);
  assert.deepEqual(
    rawFile.unread.map((r) => [r.address, r.hex.length / 2]),
    [
      ['80:FFB5', 11],
      ['8B:FD61', 20],
      ['8D:8080', 64],
    ],
  );
  assert.equal(manifest.raw_bytes, 188);
  assert.ok(!('data_file' in manifest) && !('segments' in manifest), 'no binary part');
});

test('scripts and their tables come from scripts.json, not from the raw part', () => {
  const decoded = map.ranges
    .filter((r) =>
      [
        'script',
        'script_table',
        'text',
        'text_tree',
        'tile_table',
        'tile_lz',
        'palette',
        'vram_tile',
        'lz_stream',
        'scene_table',
        'tileset',
        'object_type',
        'object_graphic',
        'scene_list',
        'menu_text',
        'palette_cycle',
        'room_table',
        'room',
        'actor',
        'kind',
        'action',
        'picture',
        'topic',
        'sound',
        'portrait',
        'dialog',
        'runner',
        'spc_driver',
        'lookup_table',
        'matrix_text',
        'font',
        'header',
        'filler',
        'orphan_script',
      ].includes(r.class),
    )
    .reduce((n, r) => n + r.length, 0);
  assert.equal(manifest.decoded_bytes, decoded);
  assert.ok(![...rawClasses].some((kind) => kind === 'script' || kind === 'script_table'));
  assert.equal(manifest.scripts.scriptAddresses.length, 937);
  assert.equal(manifest.scripts.nativeAddresses.length, 220);
});

test('texts come from vm-texts.json and keep their addresses', () => {
  const texts = JSON.parse(
    readFileSync(new URL('../assets/vm-texts.json', import.meta.url), 'utf8'),
  );
  assert.equal(texts.texts.length, 1603);
  assert.deepEqual(texts.texts.slice(0, 2), [
    { address: '9D:857C', text: 'Akimi' },
    { address: '9D:8581', text: 'Anders' },
  ]);
  assert.ok(![...rawClasses].some((kind) => kind === 'text' || kind === 'text_tree'));
  // A longer text would move the next one and break the pointers to it.
  const longer = {
    ...texts,
    texts: texts.texts.map((t, i) => (i === 0 ? { ...t, text: t.text + 'xyz' } : t)),
  };
  assert.throws(
    () => placeTexts(new Uint8Array(0x100000), new Uint8Array(0x100000), longer),
    (error) => error.reason === 'text_layout_changed',
  );
  const edited = {
    ...texts,
    texts: texts.texts.map((t, i) => (i === 0 ? { ...t, text: 'Akimo' } : t)),
  };
  const rom = new Uint8Array(0x100000),
    present = new Uint8Array(0x100000);
  placeTexts(rom, present, edited);
  assert.equal(readText((cpu) => rom[romOffset(cpu)], texts.tree, 0x9d857c).text, 'Akimo');
});

test('room tiles come from BMP sheets and repack validly after an edit', () => {
  const tiles = JSON.parse(
    readFileSync(new URL('../assets/vm-tiles.json', import.meta.url), 'utf8'),
  );
  assert.equal(tiles.streams.length, 1536);
  assert.ok(![...rawClasses].some((kind) => kind === 'tile_lz' || kind === 'tile_table'));
  const sheets = tiles.sheets.map(
    (name) => readBmp(readFileSync(new URL(`../assets/${name}`, import.meta.url))).pixels,
  );
  assert.deepEqual(readBmp(writeBmp(sheets[0], 256, 256)).pixels, sheets[0]);
  const bitsFor = lzBits((n) => cartridge.rom[romOffset(0x80a033 + n)]);
  // An edited stream packs greedily and unpacks to the edited pixels.
  const data = sheetToStream(sheets[2], 0x200 + 7);
  data[5] ^= 0x81;
  data[70] = 0x3c;
  const packed = lzEncode(data, [[128]], bitsFor);
  assert.deepEqual(lzDecode((n) => packed[n], 128, bitsFor).data, data);
  // A stream that no longer fits its place is refused.
  const noisy = sheets.map((s) => s.slice());
  let seed = 1;
  for (let i = 0; i < 256 * 32; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    noisy[0][i] = (seed >>> 27) & 15;
  }
  const rom = cartridge.rom.slice(),
    present = cartridge.present.slice();
  for (const [offset, length, kind] of map.ranges.map((r) => [
    parseInt(r.rom_offset, 16),
    r.length,
    r.class,
  ]))
    if (kind === 'tile_lz' || kind === 'tile_table') present.fill(0, offset, offset + length);
  assert.throws(
    () => placeTiles(rom, present, tiles, noisy),
    (error) => error.reason === 'tile_layout_changed',
  );
});

test('palettes come from vm-palettes.json as BGR555 words', () => {
  const { palettes } = JSON.parse(
    readFileSync(new URL('../assets/vm-palettes.json', import.meta.url), 'utf8'),
  );
  // 9 DMA ranges and 15 of the scene command lists; 81:FF1A ends at the stream
  // 81:FF40, 8B:FDE3 belongs to the palette cycles and six portrait colour
  // sets to the dialog portraits.
  assert.equal(palettes.length, 18);
  assert.ok(!palettes.some((p) => ['8B:FDE3', '89:C58B', '85:FDDA'].includes(p.address)));
  assert.equal(palettes.find((p) => p.address === '81:FF1A').colors.length, 19);
  assert.ok(![...rawClasses].some((kind) => kind === 'palette'));
  for (const { address, colors } of palettes)
    colors.forEach((hex, i) => {
      const o = romOffset(parseInt(address.replace(':', ''), 16) + 2 * i);
      assert.equal(romBytes[o] | (romBytes[o + 1] << 8), parseInt(hex, 16));
    });
});

test('VRAM characters come from BMP sheets in planar SNES order', () => {
  const vram = JSON.parse(readFileSync(new URL('../assets/vm-vram.json', import.meta.url), 'utf8'));
  // Banks 8E to 94 and 95 up to F140 are whole OBJ ranges; every character
  // source an object picture names lies in a range.
  assert.equal(vram.ranges.length, 11);
  assert.deepEqual(
    vram.ranges.slice(2, 9).map((r) => [r.address, r.tiles]),
    ['8E', '8F', '90', '91', '92', '93', '94'].map((b) => [`${b}:8000`, 1024]),
  );
  const pictures = JSON.parse(
    readFileSync(new URL('../assets/vm-pictures.json', import.meta.url), 'utf8'),
  ).pictures;
  const inRange = (t) =>
    vram.ranges.some((r) => {
      const a = parseInt(r.address.replace(':', ''), 16),
        c = parseInt(t.replace(':', ''), 16);
      return r.format === 'obj4' && c >= a && c + 64 <= a + 32 * r.tiles;
    });
  assert.ok(pictures.every((p) => p.tiles.flat().every(inRange)));
  assert.ok(![...rawClasses].some((kind) => kind === 'vram_tile'));
  const sheets = Object.fromEntries(
    Object.entries(vram.sheets).map(([f, name]) => [
      f,
      readBmp(readFileSync(new URL(`../assets/${name}`, import.meta.url))),
    ]),
  );
  // Pixel (x, 0) of the first OBJ character: bit 7 - x of planes 0-3 at bytes 0, 1, 16, 17.
  const first = 0x8dfb78,
    o = romOffset(first);
  for (let x = 0; x < 8; x++) {
    const v = [0, 1, 16, 17].reduce(
      (n, at, p) => n | (((romBytes[o + at] >> (7 - x)) & 1) << p),
      0,
    );
    assert.equal(sheets.obj4.pixels[x], v);
  }
  // An edited pixel lands in its plane bits; a range keeps its place.
  const edited = { ...sheets, obj4: { ...sheets.obj4, pixels: sheets.obj4.pixels.slice() } };
  edited.obj4.pixels[0] = 0b1010;
  const rom = new Uint8Array(0x100000),
    present = new Uint8Array(0x100000);
  placeVramTiles(rom, present, vram, edited);
  assert.deepEqual(
    [rom[o] >> 7, rom[o + 1] >> 7, rom[o + 16] >> 7, rom[o + 17] >> 7],
    [0, 1, 0, 1],
  );
  assert.throws(
    () => placeVramTiles(rom, present, vram, sheets),
    (error) => error.reason === 'vram_layout_changed',
  );
  edited.obj4.pixels[0] = 16;
  assert.throws(
    () => placeVramTiles(new Uint8Array(0x100000), new Uint8Array(0x100000), vram, edited),
    (error) => error.reason === 'vram_pixel_range_required',
  );
});

test('packed streams come from vm-lz.json and its sheets and keep their place', () => {
  const lz = JSON.parse(readFileSync(new URL('../assets/vm-lz.json', import.meta.url), 'utf8'));
  const scenes = JSON.parse(
    readFileSync(new URL('../assets/vm-scenes.json', import.meta.url), 'utf8'),
  );
  assert.equal(scenes.scenes.length, 165);
  assert.equal(lz.streams.filter((s) => s.format === 'scene').length, 165);
  assert.ok(lz.streams.length > 165);
  assert.ok(![...rawClasses].some((kind) => kind === 'lz_stream'));
  const sheets = Object.fromEntries(
    Object.entries(lz.sheets).map(([f, name]) => [
      f,
      readBmp(readFileSync(new URL(`../assets/${name}`, import.meta.url))),
    ]),
  );
  const fresh = () => {
    const rom = cartridge.rom.slice(),
      present = cartridge.present.slice();
    for (const r of map.ranges)
      if (r.class === 'lz_stream' || r.class === 'scene_table')
        present.fill(0, parseInt(r.rom_offset, 16), parseInt(r.rom_offset, 16) + r.length);
    return { rom, present };
  };
  // An edited map word repacks and unpacks to the edit with the same length.
  const at = lz.streams.findIndex((s) => s.format === 'map'),
    stream = lz.streams[at],
    cpu = parseInt(stream.address.replace(':', ''), 16);
  const words = stream.words.slice();
  words[0] = '1234' + words[0].slice(4);
  const { rom, present } = fresh();
  placeLzStreams(
    rom,
    present,
    { ...lz, streams: lz.streams.map((s, i) => (i === at ? { ...s, words } : s)) },
    sheets,
    scenes,
  );
  const read8 = (c) => rom[romOffset(c)],
    length = read8(cpu) | (read8(cpu + 1) << 8);
  const out = lzDecode(
    (n) => read8(cpu + 2 + n),
    length,
    lzBits((n) => read8(0x80a033 + n)),
  ).data;
  assert.equal(length, words.join(' ').split(' ').length * 2);
  assert.deepEqual([out[0], out[1]], [0x34, 0x12]);
  // Noise in the new-game states no longer fits its place.
  const b = lz.streams.findIndex((s) => s.address === '8B:FBD2');
  assert.equal(lz.streams[b].states.count, 703);
  let seed = 7;
  const noisy = {
    count: 703,
    records: Array.from({ length: 703 }, (_, n) => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return {
        address: `7E:${(0x2e00 + 5 * n).toString(16).toUpperCase()}`,
        state: '0000',
        count: seed >>> 24,
        holder: 'FFFF',
      };
    }),
  };
  const second = fresh();
  assert.throws(
    () =>
      placeLzStreams(
        second.rom,
        second.present,
        { ...lz, streams: lz.streams.map((s, i) => (i === b ? { ...s, states: noisy } : s)) },
        sheets,
        scenes,
      ),
    (error) => error.reason === 'lz_layout_changed',
  );
  // Intro text and credits are lines; an edited line lands in the output.
  const intro = lz.streams.findIndex((s) => s.address === '81:F5CE'),
    credits = lz.streams.find((s) => s.address === '81:F2BD');
  assert.equal(lz.streams[intro].lines[1], 'THE YEAR IS 2050');
  assert.deepEqual(credits.groups[0], ['system programming', 'darren bremner', 'andrew bailey']);
  const third = fresh(),
    lines = lz.streams[intro].lines.slice();
  lines[1] = 'THE YEAR IS 2051';
  placeLzStreams(
    third.rom,
    third.present,
    { ...lz, streams: lz.streams.map((s, i) => (i === intro ? { ...s, lines } : s)) },
    sheets,
    scenes,
  );
  const r8 = (c) => third.rom[romOffset(c)],
    text = lzDecode(
      (n) => r8(0x81f5d0 + n),
      r8(0x81f5ce) | (r8(0x81f5cf) << 8),
      lzBits((n) => r8(0x80a033 + n)),
    ).data;
  assert.equal(String.fromCharCode(...text.slice(2, 18)), 'THE YEAR IS 2051');
  const fourth = fresh();
  assert.throws(
    () =>
      placeLzStreams(
        fourth.rom,
        fourth.present,
        {
          ...lz,
          streams: lz.streams.map((s, i) => (i === intro ? { ...s, lines: ['', ...lines] } : s)),
        },
        sheets,
        scenes,
      ),
    (error) => error.reason === 'lz_text_required',
  );
});

test('the scene command lists give each stream the format of its VRAM use', () => {
  const lz = JSON.parse(readFileSync(new URL('../assets/vm-lz.json', import.meta.url), 'utf8'));
  const format = new Map(lz.streams.map((s) => [s.address, s.format]));
  const listed = readSceneListStreams((c) => romBytes[romOffset(c)]);
  assert.equal(listed.length, 26);
  for (const [cpu, f] of listed)
    assert.equal(
      format.get(
        `${(cpu >>> 16).toString(16).toUpperCase()}:${(cpu & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`,
      ),
      f,
    );
  // The title list 81:F6EF agrees with the probe: maps, BG3 2 bpp, BG1 4 bpp, OBJ.
  assert.deepEqual(
    ['84:F110', '84:F7D5', '86:E00A', '85:ECC0'].map((a) => format.get(a)),
    ['map', 'bg2', 'bg4', 'obj4'],
  );
});

test('scene command lists come from vm-scene-lists.json and keep their runs', () => {
  const file = JSON.parse(
    readFileSync(new URL('../assets/vm-scene-lists.json', import.meta.url), 'utf8'),
  );
  assert.ok(![...rawClasses].some((kind) => kind === 'scene_list'));
  const runs = file.runs,
    ending = runs[0].lists;
  assert.deepEqual(runs[0].table, [
    '81:F499',
    '81:F4E1',
    '81:F53E',
    '81:F586',
    '81:F586',
    '81:F529',
  ]);
  assert.ok(ending.find((l) => l.address === '81:F529').continues);
  const fresh = () => {
    const rom = cartridge.rom.slice(),
      present = cartridge.present.slice();
    for (const r of map.ranges)
      if (r.class === 'scene_list')
        present.fill(0, parseInt(r.rom_offset, 16), parseInt(r.rom_offset, 16) + r.length);
    return { rom, present };
  };
  // A changed port value lands in place; an extra command moves the next list.
  const edited = structuredClone(file),
    list = edited.runs[1].lists.find((l) => l.address === '81:F768');
  const port = list.commands.find((c) => c.port === '212C');
  port.value = '15';
  const { rom, present } = fresh();
  placeSceneLists(rom, present, edited);
  const at = list.commands.findIndex((c) => c === port);
  assert.equal(at, list.commands.length - 1);
  assert.equal(rom[romOffset(0x81f79f - 2)], 0x15);
  list.commands.push({ nop: 1 });
  const second = fresh();
  assert.throws(
    () => placeSceneLists(second.rom, second.present, edited),
    (error) => error.reason === 'scene_list_layout_changed',
  );
});

test('menu texts come from vm-menu-texts.json and keep their addresses', () => {
  const file = JSON.parse(
    readFileSync(new URL('../assets/vm-menu-texts.json', import.meta.url), 'utf8'),
  );
  assert.equal(file.texts.length, 15);
  assert.deepEqual(file.texts[1], { address: '81:E3B2', text: 'START NEW GAME' });
  assert.ok(![...rawClasses].some((kind) => kind === 'menu_text'));
  const edited = structuredClone(file);
  edited.texts[3].text = 'SETTING';
  const rom = new Uint8Array(0x100000),
    present = new Uint8Array(0x100000);
  placeMenuTexts(rom, present, edited);
  assert.equal(
    String.fromCharCode(...rom.subarray(romOffset(0x81e3d2), romOffset(0x81e3d2) + 7)),
    'SETTING',
  );
  edited.texts[3].text = 'SETTINGS';
  assert.throws(
    () => placeMenuTexts(new Uint8Array(0x100000), new Uint8Array(0x100000), edited),
    (error) => error.reason === 'menu_text_layout_changed',
  );
});

test('palette cycles come from vm-palette-cycles.json and keep their records', () => {
  const file = JSON.parse(
    readFileSync(new URL('../assets/vm-palette-cycles.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(
    file.cycles.map((c) => [c.palette, c.steps, c.colors.length]),
    [
      ['20', 3, 5],
      ['21', 3, 5],
      ['25', 5, 9],
      ['2A', 4, 7],
      ['31', 3, 5],
      ['3C', 16, 16],
    ],
  );
  assert.ok(![...rawClasses].some((kind) => kind === 'palette_cycle'));
  const edited = structuredClone(file);
  edited.cycles[5].colors[3] = '7FFF';
  const rom = new Uint8Array(0x100000),
    present = new Uint8Array(0x100000);
  placePaletteCycles(rom, present, edited);
  assert.deepEqual([rom[romOffset(0x8bfded + 14)], rom[romOffset(0x8bfded + 15)]], [0xff, 0x7f]);
  edited.cycles[0].steps = 4;
  assert.throws(
    () => placePaletteCycles(new Uint8Array(0x100000), new Uint8Array(0x100000), edited),
    (error) => error.reason === 'palette_cycle_required',
  );
});

test('rooms come from vm-rooms.json and the table follows a room that changes its size', () => {
  const file = JSON.parse(
    readFileSync(new URL('../assets/vm-rooms.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(
    [file.entries.length, file.rooms.length, file.entries.filter((e) => e.room === null).length],
    [498, 192, 2],
  );
  assert.equal(file.rooms.filter((_, n) => !file.entries.some((e) => e.room === n)).length, 3);
  assert.deepEqual(
    readRooms((c) => cartridge.rom[romOffset(c)]),
    { entries: file.entries, rooms: file.rooms },
  );
  assert.ok(![...rawClasses].some((kind) => kind === 'room' || kind === 'room_table'));
  const fresh = () => {
    const rom = cartridge.rom.slice(),
      present = cartridge.present.slice();
    for (const r of map.ranges)
      if (r.class === 'room' || r.class === 'room_table')
        present.fill(0, parseInt(r.rom_offset, 16), parseInt(r.rom_offset, 16) + r.length);
    return { rom, present };
  };
  // Room 0 (99:8000) loses an actor: the next room moves 6 bytes down, the
  // box pointers and table words follow and the run ends in six 00 bytes.
  const edited = structuredClone(file);
  edited.rooms[0].actors.pop();
  const { rom, present } = fresh();
  placeRooms(rom, present, edited);
  const read8 = (c) => rom[romOffset(c)],
    word = (c) => read8(c) | (read8(c + 1) << 8);
  assert.equal(word(0x998002), 0x8128 - 6);
  assert.equal(word(0x8d929d + 9), 0x012a - 6);
  assert.equal(read8(0x998124), file.rooms[1].scene);
  assert.deepEqual(
    [...rom.subarray(romOffset(0x99c5d8 - 6), romOffset(0x99c5d8))],
    [0, 0, 0, 0, 0, 0],
  );
  // One more exit in room 0 no longer fits bank 99.
  const grown = structuredClone(file);
  grown.rooms[0].exits.push({ box: [0, 0, 0, 1, 1, 1], room: 0 });
  const second = fresh();
  assert.throws(
    () => placeRooms(second.rom, second.present, grown),
    (error) => error.reason === 'room_layout_changed',
  );
});

test('the actor table comes from vm-actors.json and keeps its entries', () => {
  const file = JSON.parse(
    readFileSync(new URL('../assets/vm-actors.json', import.meta.url), 'utf8'),
  );
  assert.equal(file.actors.length, 1191);
  assert.deepEqual(
    readActors((c) => cartridge.rom[romOffset(c)]),
    file.actors,
  );
  assert.ok(![...rawClasses].some((kind) => kind === 'actor'));
  // Every new-game state record belongs to exactly one actor.
  const records = file.actors.map((a) => a.record).filter(Boolean);
  assert.deepEqual([records.length, new Set(records).size], [703, 703]);
  const edited = structuredClone(file);
  edited.actors[2].script = 0x123;
  const rom = new Uint8Array(0x100000),
    present = new Uint8Array(0x100000);
  placeActors(rom, present, edited);
  assert.deepEqual(
    [rom[romOffset(0x8db01f + 14 + 5)], rom[romOffset(0x8db01f + 14 + 6)]],
    [0x23, 0x01],
  );
  edited.actors[2].record = '2E01';
  assert.throws(
    () => placeActors(new Uint8Array(0x100000), new Uint8Array(0x100000), edited),
    (error) => error.reason === 'actor_value_required',
  );
  edited.actors.pop();
  assert.throws(
    () => placeActors(new Uint8Array(0x100000), new Uint8Array(0x100000), edited),
    (error) => error.reason === 'actor_layout_changed',
  );
});

test('the kind table comes from vm-kinds.json and its names are texts', () => {
  const file = JSON.parse(
    readFileSync(new URL('../assets/vm-kinds.json', import.meta.url), 'utf8'),
  );
  const texts = new Set(
    JSON.parse(readFileSync(new URL('../assets/vm-texts.json', import.meta.url), 'utf8')).texts.map(
      (t) => t.address,
    ),
  );
  const actors = JSON.parse(
    readFileSync(new URL('../assets/vm-actors.json', import.meta.url), 'utf8'),
  ).actors;
  assert.equal(file.kinds.length, 275);
  assert.equal(Math.max(...actors.map((a) => a.kind)), 274);
  assert.deepEqual(
    readKinds((c) => cartridge.rom[romOffset(c)]),
    file.kinds,
  );
  assert.ok(![...rawClasses].some((kind) => kind === 'kind'));
  assert.ok(file.kinds.every((k) => k.name === null || texts.has(k.name)));
  assert.equal(file.kinds.filter((k) => k.name === null).length, 48);
  const edited = structuredClone(file);
  edited.kinds[3].name = '9E:8000';
  const rom = new Uint8Array(0x100000),
    present = new Uint8Array(0x100000);
  placeKinds(rom, present, edited);
  assert.deepEqual([rom[romOffset(0x8cefb0 + 18)], rom[romOffset(0x8cefb0 + 19)]], [0x00, 0x80]);
  edited.kinds[3].name = '9D:7000';
  assert.throws(
    () => placeKinds(new Uint8Array(0x100000), new Uint8Array(0x100000), edited),
    (error) => error.reason === 'kind_value_required',
  );
});

test('action lists come from vm-actions.json and follow a record that changes its size', () => {
  const file = JSON.parse(
    readFileSync(new URL('../assets/vm-actions.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(
    [
      file.kinds.length,
      file.blocks.filter((b) => b.actions).length,
      file.blocks.filter((b) => b.frames).length,
    ],
    [275, 253, 673],
  );
  assert.equal(file.kinds.indexOf(null), 274);
  assert.deepEqual(
    readActions((c) => cartridge.rom[romOffset(c)]),
    { kinds: file.kinds, blocks: file.blocks },
  );
  assert.ok(![...rawClasses].some((kind) => kind === 'action'));
  const fresh = () => {
    const rom = cartridge.rom.slice(),
      present = cartridge.present.slice();
    for (const r of map.ranges)
      if (r.class === 'action')
        present.fill(0, parseInt(r.rom_offset, 16), parseInt(r.rom_offset, 16) + r.length);
    return { rom, present };
  };
  // The first record of kind 0 (8C:800A) loses the frame of direction 7:
  // the records behind it move down, the list words and the table follow.
  const edited = structuredClone(file),
    first = edited.blocks[1];
  assert.deepEqual(
    [first.count, first.directions, first.frames[0]],
    [1, [0, 1, 2, 3, 4, 5, 6, 7], '9B:8001'],
  );
  first.frames.pop();
  first.directions[7] = null;
  const { rom, present } = fresh();
  placeActions(rom, present, edited);
  const word = (c) => rom[romOffset(c)] | (rom[romOffset(c + 1)] << 8);
  assert.deepEqual([word(0x8c8000), word(0x8c8002)], [0x800a, 0x802a - 2]);
  // Read back, the two fill bytes 00 end the last record as one more frame.
  const back = readActions((c) => rom[romOffset(c)]),
    last = edited.blocks.findLastIndex((b) => b.frames);
  edited.blocks[last].frames.push('9B:8000');
  assert.deepEqual(back, { kinds: edited.kinds, blocks: edited.blocks });
  const grown = structuredClone(file);
  grown.blocks[1].frames.push(...Array(32).fill('9B:8000'));
  const second = fresh();
  assert.throws(
    () => placeActions(second.rom, second.present, grown),
    (error) => error.reason === 'action_layout_changed',
  );
});

test('object pictures come from vm-pictures.json and keep their addresses', () => {
  const file = JSON.parse(
    readFileSync(new URL('../assets/vm-pictures.json', import.meta.url), 'utf8'),
  );
  const actions = JSON.parse(
    readFileSync(new URL('../assets/vm-actions.json', import.meta.url), 'utf8'),
  );
  const read8 = (c) => cartridge.rom[romOffset(c)];
  assert.deepEqual(
    readPictures(
      read8,
      actions.blocks.filter((b) => b.frames).flatMap((b) => b.frames),
    ),
    file.pictures,
  );
  assert.deepEqual(
    [file.pictures.length, file.pictures.filter((p) => p.shadow !== null).length],
    [2329, 100],
  );
  assert.ok(![...rawClasses].some((kind) => kind === 'picture'));
  // A flipped cell lands in place; a cell more no longer fits.
  const edited = structuredClone(file);
  edited.pictures[0].cells[1] = 0x40;
  const rom = new Uint8Array(0x100000),
    present = new Uint8Array(0x100000);
  placePictures(rom, present, edited);
  assert.equal(rom[romOffset(0x9b8001 + 1 + 8 + 3 + 1)], 0x40);
  edited.pictures[0].cells.push(0x20);
  edited.pictures[0].rows = 3;
  assert.throws(
    () => placePictures(new Uint8Array(0x100000), new Uint8Array(0x100000), edited),
    (error) => error.reason === 'picture_layout_changed',
  );
  edited.pictures[0].cells[2] = 0;
  assert.throws(
    () => placePictures(new Uint8Array(0x100000), new Uint8Array(0x100000), edited),
    (error) => error.reason === 'picture_value_required',
  );
});

test('dialog topics come from vm-topics.json and name texts', () => {
  const file = JSON.parse(
    readFileSync(new URL('../assets/vm-topics.json', import.meta.url), 'utf8'),
  );
  const texts = new Map(
    JSON.parse(readFileSync(new URL('../assets/vm-texts.json', import.meta.url), 'utf8')).texts.map(
      (t) => [t.address, t.text],
    ),
  );
  assert.deepEqual(
    readTopics((c) => cartridge.rom[romOffset(c)]),
    file.topics,
  );
  assert.deepEqual(
    file.topics.slice(0, 2).map((t) => texts.get(t)),
    ['Akimi', 'Anders'],
  );
  assert.ok(file.topics.every((t) => texts.has(t)));
  assert.ok(![...rawClasses].some((kind) => kind === 'topic'));
  const edited = structuredClone(file);
  edited.topics[1] = '9E:8000';
  const rom = new Uint8Array(0x100000),
    present = new Uint8Array(0x100000);
  placeTopics(rom, present, edited);
  assert.deepEqual([rom[romOffset(0x8d8002)], rom[romOffset(0x8d8003)]], [0x00, 0x80]);
  edited.topics.pop();
  assert.throws(
    () => placeTopics(new Uint8Array(0x100000), new Uint8Array(0x100000), edited),
    (error) => error.reason === 'topic_layout_changed',
  );
});

test('sound data comes from vm-sound.json and the sample WAVs and keeps its layout', () => {
  const file = JSON.parse(
    readFileSync(new URL('../assets/vm-sound.json', import.meta.url), 'utf8'),
  );
  const wavs = Object.fromEntries(
    file.data
      .filter((d) => d.file)
      .map((d) => [
        d.file,
        readWav(
          new Uint8Array(readFileSync(new URL('../assets/' + d.file, import.meta.url))),
          d.address,
        ),
      ]),
  );
  const { samples, ...read } = readSound((c) => cartridge.rom[romOffset(c)]);
  assert.deepEqual(read, { directories: file.directories, lists: file.lists, data: file.data });
  assert.deepEqual(samples, wavs);
  assert.deepEqual(
    file.directories.map((d) => d.address),
    ['9F:FEAC', '99:FFC8'],
  );
  // The mode lists behind the directories, read by F1FA from directory + its length word.
  assert.deepEqual(
    file.directories.map((d) => d.modes.map((m) => m.mode + '/' + m.item)),
    [['02/38', '05/37', '06/39', '0C/38'], []],
  );
  assert.equal(file.data.find((d) => d.address === '99:C5D8').role, 'samples');
  const directory = file.data.find((d) => d.address === '9F:FD6F');
  assert.equal(directory.entries.length, 41);
  assert.deepEqual(directory.entries[1], { start: '183A', loop: '1843' });
  // Each song header holds exactly the sounds its patterns use.
  for (const d of file.data.filter(
    (x) => x.role === 'songs' && x.pieces.filter((p) => p.song).length === 1,
  )) {
    const used = d.pieces
      .flatMap((p) => p.pattern ?? [])
      .filter((e) => /^[no] /.test(e))
      .map((e) => +e.split(' ')[2]);
    assert.equal(Math.max(...used) + 1, d.pieces.find((p) => p.song).song.sounds.length, d.address);
  }
  // Per base: the vibrato pointers name the records, the note words name the tables.
  for (const d of file.directories) {
    const own = new Set(file.lists.find((l) => l.address === d.base).chunks.map((c) => c.data));
    const part = (role) => file.data.find((x) => x.role === role && own.has(x.address));
    const vp = part('vibrato_pitch'),
      start = parseInt(vp.aram[0], 16);
    assert.deepEqual(
      part('vibrato_table').words,
      vp.vibratos.map((_, n) => (start + 6 * n).toString(16).toUpperCase().padStart(4, '0')),
    );
    const tables = new Set(
      vp.pitches.map((_, n) =>
        (start + 6 * vp.vibratos.length + 24 * n).toString(16).toUpperCase().padStart(4, '0'),
      ),
    );
    assert.ok(part('sounds').sounds.every((s) => s.notes === '0000' || tables.has(s.notes)));
    assert.ok(part('sounds').sounds.every((s) => s.vibrato <= vp.vibratos.length));
  }
  assert.ok(![...rawClasses].some((kind) => kind === 'sound'));
  const rom = new Uint8Array(0x100000),
    present = new Uint8Array(0x100000);
  // A missing WAV, and an end bit in the first of several blocks.
  const missing = { ...wavs };
  delete missing[file.data.find((d) => d.file).file];
  assert.throws(
    () => placeSound(new Uint8Array(0x100000), new Uint8Array(0x100000), file, missing),
    (error) => error.reason === 'sound_bytes_required',
  );
  const brr = structuredClone(file),
    sample = brr.data.find((d) => d.file && d.blocks.length > 2);
  sample.blocks =
    (parseInt(sample.blocks.slice(0, 2), 16) | 1).toString(16).toUpperCase().padStart(2, '0') +
    sample.blocks.slice(2);
  const louder = structuredClone(file);
  louder.data.find((d) => d.sounds).sounds[0].volume = 1;
  placeSound(rom, present, louder, wavs);
  assert.equal(rom[romOffset(0x9ad567)], 1);
  const longer = structuredClone(file),
    song = longer.data.find((d) => d.address === '9F:E157');
  song.pieces.find((p) => p.pattern).pattern.unshift('w 3');
  assert.throws(
    () => placeSound(new Uint8Array(0x100000), new Uint8Array(0x100000), longer, wavs),
    (error) => error.reason === 'sound_song_layout_changed',
  );
  assert.throws(
    () => placeSound(new Uint8Array(0x100000), new Uint8Array(0x100000), brr, wavs),
    (error) => error.reason === 'sound_brr_required',
  );
});

test('the runner table comes from vm-runners.json and names its members', () => {
  const file = JSON.parse(
    readFileSync(new URL('../assets/vm-runners.json', import.meta.url), 'utf8'),
  );
  const texts = new Map(
    JSON.parse(readFileSync(new URL('../assets/vm-texts.json', import.meta.url), 'utf8')).texts.map(
      (t) => [t.address, t.text],
    ),
  );
  assert.deepEqual(
    readRunners((c) => cartridge.rom[romOffset(c)]),
    file.runners,
  );
  assert.deepEqual(
    file.runners.slice(0, 3).map((r) => texts.get(r.name)),
    ['Jake', 'Spatter', 'Jetboy'],
  );
  assert.equal(file.runners[0].record, '7E:3BFB');
  assert.equal(file.runners.filter((r) => r.stats).length, 12);
  // Health maximum 10 x Body, magic points 10 x Magic.
  assert.ok(
    file.runners
      .filter((r) => r.stats)
      .every(
        (r) => r.stats.count_max === 10 * r.stats.body && r.magic_points === 10 * r.stats.magic,
      ),
  );
  assert.ok(![...rawClasses].some((kind) => kind === 'runner'));
  // Jake starts unarmed and without armour, Spatter with both.
  assert.deepEqual(
    [file.runners[0].weapon.object, file.runners[0].armour.object],
    ['FFFF', 'FFFF'],
  );
  assert.ok(file.runners[1].weapon.object !== 'FFFF' && file.runners[1].armour.rating > 0);
  const edited = structuredClone(file);
  edited.runners[1].weapon.range = -2;
  const rom = new Uint8Array(0x100000),
    present = new Uint8Array(0x100000);
  placeRunners(rom, present, edited);
  assert.equal(rom[romOffset(0x8097a9 + 8 + 7)], 0xfe);
  edited.runners[2].record = edited.runners[1].record;
  assert.throws(
    () => placeRunners(new Uint8Array(0x100000), new Uint8Array(0x100000), edited),
    (error) => error.reason === 'runner_layout_changed',
  );
});

test('the SPC700 sound driver comes from vm-spc-driver.json as the program the APU accepts', () => {
  const file = JSON.parse(
    readFileSync(new URL('../assets/vm-spc-driver.json', import.meta.url), 'utf8'),
  );
  const { format, scope, source_rom_sha256, ...driver } = file;
  assert.deepEqual(
    readSpcDriver((c) => cartridge.rom[romOffset(c)]),
    driver,
  );
  assert.equal(fnv1a(spcDriverBytes(file)), DRIVER_FNV);
  assert.ok(![...rawClasses].some((kind) => kind === 'spc_driver'));
  assert.equal(file.commands[0x10], '097F');
  assert.equal(file.code[0], '0200 DI');
  const edited = structuredClone(file);
  edited.vibrato_sine[1] = -1;
  assert.equal(spcDriverBytes(edited)[0x0e15 - 0x0200], 0xff);
  edited.code[0] = '0200 FROB';
  assert.throws(
    () => spcDriverBytes(edited),
    (error) => error.reason === 'spc_driver_line_unknown',
  );
  edited.code.shift();
  assert.throws(
    () => spcDriverBytes(edited),
    (error) => error.reason === 'spc_driver_layout_changed',
  );
});

test('the lookup tables of banks 80 and 81 come from vm-tables.json', () => {
  const file = JSON.parse(
    readFileSync(new URL('../assets/vm-tables.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(
    readTables((c) => cartridge.rom[romOffset(c)]),
    file.tables,
  );
  assert.ok(![...rawClasses].some((kind) => kind === 'lookup_table'));
  const named = Object.fromEntries(file.tables.map((t) => [t.name, t.values]));
  assert.deepEqual(named.random_masks.slice(0, 3), [0xffff, 0x7fff, 0x3fff]);
  assert.equal(named.bit_reverse[1], 0x80);
  assert.deepEqual(named.dialog_music, [9, 10]);
  // Text number 0 is the notice "Too far away.", 610 lies in bank 9E.
  const texts = new Map(
    JSON.parse(readFileSync(new URL('../assets/vm-texts.json', import.meta.url), 'utf8')).texts.map(
      (t) => [t.address, t.text],
    ),
  );
  assert.equal(texts.get(named.text_numbers[0]), 'Too far away.');
  assert.equal(named.text_numbers[610], '9E:AD12');
  // Opcode 00 pushes a byte (F398), the matrix steps are signed, a zero
  // pointer stays 0.
  assert.equal(named.opcode_handlers[0], '80:F398');
  assert.deepEqual(named.matrix_tile_steps.slice(0, 3), [-32, 0, 1]);
  assert.deepEqual(named.matrix_track_calls.slice(0, 2), ['81:BC41', 0]);
  // Save slots lie 0FFE bytes apart in SRAM; the HDMA table ends with 00.
  assert.deepEqual(named.save_slot_offsets, [0, 0xffe, 0x1ffc, 0x2ffa]);
  assert.deepEqual(named.matrix_bg3_hdma, [6, 0xc, 0x44, 8, 0x7f, 0xc, 0]);
  // The intro frames stop with -1 and loop with -2; scene 5 has no audio mode.
  assert.equal(named.intro_frames[19], -1);
  assert.equal(named.intro_frames.at(-1), -2);
  assert.equal(named.scene_audio_modes[5], -1);
  assert.equal(named.scene_window_hdma[0], '81:D437');
  // Karma: the first attribute is Body at 7E:3BFB, raised up to 20.
  assert.equal(texts.get(named.karma_attribute_names[0]), 'Body');
  assert.deepEqual([named.karma_attribute_stats[0], named.karma_attribute_limits[0]], ['3BFB', 20]);
  assert.equal(named.sound_effects[1], '0001');
  // Spell menu: level 1 Powerball costs 5, the sixth spell is Freeze.
  assert.ok(texts.get(named.spell_level_names[0]).startsWith('Powerball lv1'));
  assert.ok(texts.get(named.spell_names[5]).startsWith('Freeze'));
  assert.equal(named.pad_directions[0], 0x10);
  // Long words and zero text pointers: 10^9 first, the status menu ends with 0.
  assert.equal(named.decimal_powers[0], 1e9);
  assert.equal(texts.get(named.status_menu_items[0]), 'Exit');
  assert.equal(named.status_menu_items.at(-1), 0);
  // Long addresses: AA9C unpacks 80:FF98 first; Yes/No end with 0.
  assert.deepEqual(named.aa9c_sources, ['80:FF98', '81:FF3A']);
  assert.deepEqual(
    named.modal_menu_items.map((p) => p && texts.get(p)),
    ['Yes', 'No', 0],
  );
  const longs = structuredClone(file);
  longs.tables[file.tables.findIndex((t) => t.name === 'decimal_powers')].values[0] = 0x12345678;
  const placedLongs = new Uint8Array(0x100000);
  placeTables(placedLongs, new Uint8Array(0x100000), longs);
  assert.deepEqual(
    [0, 1, 2, 3].map((k) => placedLongs[romOffset(0x80fe45 + k)]),
    [0x78, 0x56, 0x34, 0x12],
  );
  // The matrix animation lists: the death list BEB1 of B8C8 stops.
  assert.deepEqual(
    readAnimations((c) => cartridge.rom[romOffset(c)]),
    file.animations,
  );
  assert.deepEqual(file.animations.at(-1), {
    address: '81:BEB1',
    pictures: ['33E0', '33E2', '33E4', '33E6', '33E8', '33EA', '33EC', '33EE'],
    end: 'stop',
  });
  for (const change of [
    (a) => {
      a[0].end = 'again';
    },
    (a) => {
      a[0].pictures[0] = 'FFFF';
    },
    (a) => {
      a[0].pictures.push('35C0');
    },
  ]) {
    const bad = structuredClone(file);
    change(bad.animations);
    assert.throws(
      () => placeTables(new Uint8Array(0x100000), new Uint8Array(0x100000), bad),
      (error) => ['table_value_required', 'table_layout_changed'].includes(error.reason),
    );
  }
  const edited = structuredClone(file);
  const at = (name) => edited.tables.findIndex((t) => t.name === name);
  const pointers = structuredClone(file);
  pointers.tables[at('matrix_track_calls')].values[1] = '81:BC42';
  pointers.tables[at('matrix_tile_steps')].values[0] = -2;
  const placed = new Uint8Array(0x100000);
  placeTables(placed, new Uint8Array(0x100000), pointers);
  assert.deepEqual(
    [
      placed[romOffset(0x81bc1d)],
      placed[romOffset(0x81bc1e)],
      placed[romOffset(0x81bb76)],
      placed[romOffset(0x81bb77)],
    ],
    [0x42, 0xbc, 0xfe, 0xff],
  );
  for (const [name, value] of [
    ['matrix_track_calls', '80:BC41'],
    ['matrix_tile_steps', 0x8000],
    ['opcode_handlers', 'F398'],
  ]) {
    const bad = structuredClone(file);
    bad.tables[at(name)].values[0] = value;
    assert.throws(
      () => placeTables(new Uint8Array(0x100000), new Uint8Array(0x100000), bad),
      (error) => error.reason === 'table_value_required',
    );
  }
  edited.tables[1].values[0] = 0x1234;
  const rom = new Uint8Array(0x100000),
    present = new Uint8Array(0x100000);
  placeTables(rom, present, edited);
  assert.deepEqual([rom[romOffset(0x80c540)], rom[romOffset(0x80c541)]], [0x34, 0x12]);
  edited.tables[1].values[0] = 0x10000;
  assert.throws(
    () => placeTables(new Uint8Array(0x100000), new Uint8Array(0x100000), edited),
    (error) => error.reason === 'table_value_required',
  );
  edited.tables[1].values.pop();
  assert.throws(
    () => placeTables(new Uint8Array(0x100000), new Uint8Array(0x100000), edited),
    (error) => error.reason === 'table_layout_changed',
  );
});

test('the cartridge header and vectors come from vm-header.json', () => {
  const { header } = JSON.parse(
    readFileSync(new URL('../assets/vm-header.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(
    readHeader((c) => cartridge.rom[romOffset(c)]),
    header,
  );
  assert.ok(![...rawClasses].some((kind) => kind === 'header'));
  assert.deepEqual(
    [header.title, header.vectors.reset, header.vectors.brk],
    ['SHADOWRUN', 'E382', 'F2B3'],
  );
  for (const change of [
    (h) => {
      h.title = 'X'.repeat(22);
    },
    (h) => {
      h.checksum = '2F6';
    },
    (h) => {
      delete h.vectors.irq;
    },
  ]) {
    const bad = structuredClone(header);
    change(bad);
    assert.throws(
      () => placeHeader(new Uint8Array(0x100000), new Uint8Array(0x100000), bad),
      (error) => ['header_value_required', 'header_layout_changed'].includes(error.reason),
    );
  }
});

test('the text font comes from vm-font.bmp', () => {
  const sheet = readBmp(readFileSync(new URL('../assets/vm-font.bmp', import.meta.url)));
  assert.deepEqual(
    readFont((c) => cartridge.rom[romOffset(c)]),
    sheet.pixels,
  );
  assert.ok(![...rawClasses].some((kind) => kind === 'font'));
  // 'A' (41) has its top row ...###. at the right edge of the cell.
  const row = Array.from({ length: 8 }, (_, bit) =>
    sheet.pixels[4 * 8 * FONT_WIDTH + 8 + bit] ? '#' : '.',
  ).join('');
  assert.equal(row, '....###.');
  const fails = (change, reason) => {
    const bad = { ...sheet, pixels: sheet.pixels.slice() };
    change(bad);
    assert.throws(
      () => placeFont(new Uint8Array(0x100000), new Uint8Array(0x100000), bad),
      (error) => error.reason === reason,
    );
  };
  fails((p) => {
    p.pixels[0] = 1;
  }, 'font_pixel_required');
  fails((p) => {
    p.pixels[FONT_WIDTH * FONT_HEIGHT - 1] = 15;
  }, 'font_layout_changed');
  fails((p) => {
    p.height = 64;
  }, 'font_layout_changed');
});

test('the matrix texts come from vm-matrix-texts.json and keep their addresses', () => {
  const file = JSON.parse(
    readFileSync(new URL('../assets/vm-matrix-texts.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(
    readMatrixTexts((c) => cartridge.rom[romOffset(c)]),
    { lists: file.lists, texts: file.texts },
  );
  assert.ok(![...rawClasses].some((kind) => kind === 'matrix_text'));
  assert.equal(file.texts.length, 22);
  assert.ok(file.texts.some((t) => t.address === '81:C62E'));
  // An edit of the same length is laid out in place; "\n" is the command 04.
  const edited = structuredClone(file);
  edited.texts[1].text = edited.texts[1].text.replace('ATTACKED BY IC', 'ATTACKED BY XX');
  const rom = new Uint8Array(0x100000),
    present = new Uint8Array(0x100000);
  placeMatrixTexts(rom, present, edited);
  assert.equal(rom[romOffset(0x81c5c0 + 1)], 4);
  assert.equal(
    String.fromCharCode(rom[romOffset(0x81c5c0 + 14)], rom[romOffset(0x81c5c0 + 15)]),
    'XX',
  );
  edited.texts[1].text += '!';
  assert.throws(
    () => placeMatrixTexts(new Uint8Array(0x100000), new Uint8Array(0x100000), edited),
    (error) => error.reason === 'matrix_layout_changed',
  );
  edited.texts[1].text = '{wait 300}';
  assert.throws(
    () => placeMatrixTexts(new Uint8Array(0x100000), new Uint8Array(0x100000), edited),
    (error) => error.reason === 'matrix_text_required',
  );
});

test('dialog records come from vm-dialogs.json and are laid out again', () => {
  const file = JSON.parse(
    readFileSync(new URL('../assets/vm-dialogs.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(
    readDialogs((c) => cartridge.rom[romOffset(c)]),
    file.dialogs,
  );
  assert.equal(
    file.dialogs.reduce((n, d) => n + d.entries.length, 0),
    727,
  );
  assert.ok(
    file.dialogs.every(
      (d) =>
        ['greeting', 'talk', 'fallback'].every((k) => d.entries.some((e) => e.key === k)) ||
        d.entries.length < 3,
    ),
  );
  assert.ok(![...rawClasses].some((kind) => kind === 'dialog'));
  // The records fill 8D:80C0 to 929D exactly. A shorter first record moves
  // the others down, the table follows and the end is filled with 00; one
  // more byte does not fit.
  const word = (rom, c) => rom[romOffset(c)] | (rom[romOffset(c + 1)] << 8);
  const before = new Uint8Array(0x100000);
  placeDialogs(before, new Uint8Array(0x100000), file);
  const longer = structuredClone(file);
  longer.dialogs[0].entries[1].topics.push(5);
  assert.throws(
    () => placeDialogs(new Uint8Array(0x100000), new Uint8Array(0x100000), longer),
    (error) => error.reason === 'dialog_layout_changed',
  );
  const edited = structuredClone(file);
  edited.dialogs[0].entries.pop();
  const rom = new Uint8Array(0x100000);
  placeDialogs(rom, new Uint8Array(0x100000), edited);
  const last = file.dialogs[0].entries.at(-1),
    removed = 5 + last.topics.length + (last.script === undefined ? 0 : 2);
  assert.equal(
    word(rom, 0x8094f7 + 2 * file.dialogs[1].dialog),
    word(before, 0x8094f7 + 2 * file.dialogs[1].dialog) - removed,
  );
  assert.equal(rom[romOffset(0x8d929c)], 0);
});

test('dialog portraits come from vm-portraits.json and name obj4 streams', () => {
  const file = JSON.parse(
    readFileSync(new URL('../assets/vm-portraits.json', import.meta.url), 'utf8'),
  );
  const lz = new Map(
    JSON.parse(readFileSync(new URL('../assets/vm-lz.json', import.meta.url), 'utf8')).streams.map(
      (s) => [s.address, s],
    ),
  );
  assert.deepEqual(
    readPortraits((c) => cartridge.rom[romOffset(c)]),
    file.portraits,
  );
  assert.equal(file.portraits.length, 139);
  assert.ok(file.portraits.every((p) => lz.get(p.stream)?.format === 'obj4'));
  assert.equal(new Set(file.portraits.map((p) => p.stream)).size, 37);
  assert.ok(![...rawClasses].some((kind) => kind === 'portrait'));
  const edited = structuredClone(file);
  edited.portraits[0].colors[0] = '7FFF';
  const rom = new Uint8Array(0x100000),
    present = new Uint8Array(0x100000);
  placePortraits(rom, present, edited);
  assert.deepEqual([rom[romOffset(0x81ff82)], rom[romOffset(0x81ff83)]], [0xff, 0x7f]);
  edited.portraits.pop();
  assert.throws(
    () => placePortraits(new Uint8Array(0x100000), new Uint8Array(0x100000), edited),
    (error) => error.reason === 'portrait_layout_changed',
  );
});

test('scene records come from vm-scenes.json and an edit lands in the record', () => {
  const lz = JSON.parse(readFileSync(new URL('../assets/vm-lz.json', import.meta.url), 'utf8'));
  const scenes = JSON.parse(
    readFileSync(new URL('../assets/vm-scenes.json', import.meta.url), 'utf8'),
  );
  const sheets = Object.fromEntries(
    Object.entries(lz.sheets).map(([f, name]) => [
      f,
      readBmp(readFileSync(new URL(`../assets/${name}`, import.meta.url))),
    ]),
  );
  for (const scene of scenes.scenes)
    assert.deepEqual(decodeScene(encodeScene(scene)), (({ address, ...rest }) => rest)(scene));
  // Scene 14: move its first object one step; the table still points to the record.
  const edited = structuredClone(scenes),
    first = edited.scenes[14].objects_46a8[0];
  first.x -= 1;
  first.flip = !first.flip;
  const rom = cartridge.rom.slice(),
    present = cartridge.present.slice();
  for (const r of map.ranges)
    if (r.class === 'lz_stream' || r.class === 'scene_table')
      present.fill(0, parseInt(r.rom_offset, 16), parseInt(r.rom_offset, 16) + r.length);
  placeLzStreams(rom, present, lz, sheets, edited);
  const read8 = (c) => rom[romOffset(c)],
    entry = 0x8bf9e3 + 3 * 14,
    cpu = (read8(entry + 2) << 16) | read8(entry) | (read8(entry + 1) << 8);
  const length = read8(cpu) | (read8(cpu + 1) << 8);
  const record = Uint8Array.from(
    lzDecode(
      (n) => read8(cpu + 2 + n),
      length,
      lzBits((n) => read8(0x80a033 + n)),
    ).data.slice(0, length),
  );
  assert.deepEqual(decodeScene(record).objects_46a8[0], first);
  assert.throws(
    () => encodeScene({ ...edited.scenes[14], tileset: 256 }),
    (error) => error.reason === 'scene_value_required',
  );
});

test('tilesets come from vm-tilesets.json and repack in place', () => {
  const file = JSON.parse(
    readFileSync(new URL('../assets/vm-tilesets.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(
    file.tilesets.map((t) => t.blocks.length),
    [128, 80, 80, 24, 80, 104],
  );
  assert.ok(![...rawClasses].some((kind) => kind === 'tileset'));
  const fresh = () => {
    const rom = cartridge.rom.slice(),
      present = cartridge.present.slice();
    for (const r of map.ranges)
      if (r.class === 'tileset')
        present.fill(0, parseInt(r.rom_offset, 16), parseInt(r.rom_offset, 16) + r.length);
    return { rom, present };
  };
  const edited = structuredClone(file);
  edited.tilesets[3].blocks[2] = {
    attribute: 7,
    rows: ['0001 0002', '0003 0004', '0005 0006', '0007 0008'],
  };
  const { rom, present } = fresh();
  placeTilesets(rom, present, edited);
  assert.deepEqual(
    readTilesets((c) => rom[romOffset(c)]),
    edited.tilesets,
  );
  // One more block in tileset 0 no longer fits before the pointer tables.
  const grown = structuredClone(file);
  grown.tilesets[0].blocks.push(grown.tilesets[0].blocks[0]);
  const second = fresh();
  assert.throws(
    () => placeTilesets(second.rom, second.present, grown),
    (error) => error.reason === 'tileset_layout_changed',
  );
});

test('object types come from vm-objects.json and repack in place', () => {
  const file = JSON.parse(
    readFileSync(new URL('../assets/vm-objects.json', import.meta.url), 'utf8'),
  );
  assert.equal(file.types.length, 548);
  assert.ok(![...rawClasses].some((kind) => kind === 'object_type'));
  const fresh = () => {
    const rom = cartridge.rom.slice(),
      present = cartridge.present.slice();
    for (const r of map.ranges)
      if (r.class === 'object_type')
        present.fill(0, parseInt(r.rom_offset, 16), parseInt(r.rom_offset, 16) + r.length);
    return { rom, present };
  };
  // Moving a box from type 1 to type 0 keeps the total size: the definitions shift, the table follows.
  const edited = structuredClone(file);
  edited.types[0].boxes.push(edited.types[1].boxes.pop());
  edited.types[0].parts[0].flip = true;
  const { rom, present } = fresh();
  placeObjectTypes(rom, present, edited);
  assert.deepEqual(
    readObjectTypes((c) => rom[romOffset(c)]),
    edited.types,
  );
  // One more part no longer fits before the table.
  const grown = structuredClone(file);
  grown.types[5].parts.push(grown.types[5].parts[0]);
  const second = fresh();
  assert.throws(
    () => placeObjectTypes(second.rom, second.present, grown),
    (error) => error.reason === 'object_layout_changed',
  );
});

test('part graphics come from vm-object-graphics.json and repack in their runs', () => {
  const file = JSON.parse(
    readFileSync(new URL('../assets/vm-object-graphics.json', import.meta.url), 'utf8'),
  );
  assert.equal(file.graphics.length, 658);
  assert.ok(![...rawClasses].some((kind) => kind === 'object_graphic'));
  const fresh = () => {
    const rom = cartridge.rom.slice(),
      present = cartridge.present.slice();
    for (const r of map.ranges)
      if (r.class === 'object_graphic')
        present.fill(0, parseInt(r.rom_offset, 16), parseInt(r.rom_offset, 16) + r.length);
    return { rom, present };
  };
  // Swapping two graphics of a run moves both; the table follows.
  const edited = structuredClone(file);
  const order = edited.runs[7].graphics;
  [order[0], order[1]] = [order[1], order[0]];
  edited.graphics[order[0]].attribute ^= 1;
  edited.graphics[order[0]].rows[0] = edited.graphics[order[0]].rows[0].replace(
    /[0-9A-F]{4}$/,
    '0123',
  );
  const { rom, present } = fresh();
  placeObjectGraphics(rom, present, edited);
  assert.deepEqual(
    readObjectGraphics((c) => rom[romOffset(c)]),
    { graphics: edited.graphics, runs: edited.runs },
  );
  // A changed shared byte at 8D:FD78 (graphic 70, also an OBJ character) is refused.
  const shared = structuredClone(file);
  shared.graphics[70].rows = shared.graphics[70].rows.map((r) => r.replace(/0000/g, '0101'));
  const second = fresh();
  assert.throws(
    () => placeObjectGraphics(second.rom, second.present, shared),
    (error) => error.reason === 'graphic_shared_byte_changed',
  );
  // One more row no longer fits in the bank 81 run.
  const grown = structuredClone(file);
  const first = grown.graphics[grown.runs[0].graphics[0]];
  first.rows.push(first.rows[0]);
  const third = fresh();
  assert.throws(
    () => placeObjectGraphics(third.rom, third.present, grown),
    (error) => error.reason === 'graphic_layout_changed',
  );
});

test('every byte the live runs read is in the package', () => {
  for (const [offset, length] of reads.ranges)
    for (let o = offset; o < offset + length; o++)
      if (!cartridge.present[o]) assert.fail(`read byte ${o.toString(16)} missing`);
});

test('every byte the original reads in banks 80/81 in the coverage scenarios is in the package', () => {
  // Script tours (script_tour_reads) and the HDMA reads behind the table 81:D463 that the native
  // product never makes (HARDWARE_ONLY_READS in tools/rom-map.mjs) are left out.
  const observed = JSON.parse(readFileSync('analysis/rom-code-observed.json', 'utf8'));
  const missing = Object.keys(observed.reads)
    .map((key) => parseInt(key, 16))
    .filter((o) => !cartridge.present[o] && !(o >= 0xd479 && o <= 0xd577));
  assert.deepEqual(missing, []);
  assert.ok(Object.keys(observed.reads).length > 10000);
});

test('reading an absent code byte is a fault, not an invented value', () => {
  const memory = new VmMemory(cartridge.rom, undefined, null, cartridge.present);
  const offset = cartridge.present.indexOf(0),
    address = ((0x80 + (offset >> 15)) << 16) | 0x8000 | (offset & 0x7fff);
  assert.throws(
    () => memory.read8(address),
    (error) => error instanceof VmFault && error.reason === 'rom_byte_absent',
  );
  const data = cartridge.present.indexOf(1, 0x10000),
    dataAddress = ((0x80 + (data >> 15)) << 16) | 0x8000 | (data & 0x7fff);
  assert.equal(memory.read8(dataAddress), romBytes[data]);
});
