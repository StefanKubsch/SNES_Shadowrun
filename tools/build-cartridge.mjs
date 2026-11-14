// Data package without the ROM (docs/ROM-FREE.md). Step 1 kept every ROM
// byte except the code executed in Mesen in its original format. Now the
// code of every class (analysis/vm-rom-map.json) is absent, except the code
// bytes a data reader touches, and every data class has a decoded source; the
// manifest assets/vm-cartridge.json names where they are (last original
// bytes: assets/vm-raw.json, src/data/raw.mjs; scripts: assets/scripts.json,
// src/data/scripts.mjs; texts: assets/vm-texts.json, src/data/texts.mjs;
// room tiles: assets/vm-tiles.json and vm-tiles-XX.bmp, src/data/tiles.mjs;
// palettes: assets/vm-palettes.json, src/data/palettes.mjs; VRAM characters:
// assets/vm-vram.json and vm-vram-<format>.bmp, src/data/vram-tiles.mjs;
// packed streams: assets/vm-lz.json and vm-lz-<format>.bmp,
// src/data/lz-streams.mjs; scene records: assets/vm-scenes.json,
// src/data/scenes.mjs; tilesets: assets/vm-tilesets.json,
// src/data/tilesets.mjs; object types: assets/vm-objects.json,
// src/data/object-types.mjs; part graphics: assets/vm-object-graphics.json,
// src/data/object-graphics.mjs; scene command lists:
// assets/vm-scene-lists.json, src/data/scene-lists.mjs; menu texts:
// assets/vm-menu-texts.json, src/data/menu-texts.mjs; palette cycles:
// assets/vm-palette-cycles.json, src/data/palette-cycles.mjs; rooms:
// assets/vm-rooms.json, src/data/rooms.mjs; actor table:
// assets/vm-actors.json, src/data/actors.mjs; kind table:
// assets/vm-kinds.json, src/data/kinds.mjs; action lists:
// assets/vm-actions.json, src/data/actions.mjs; object pictures:
// assets/vm-pictures.json, src/data/pictures.mjs; dialog topics:
// assets/vm-topics.json, src/data/topics.mjs; sound data: assets/vm-sound.json
// and the WAVs in assets/vm-samples/, src/data/sound.mjs and src/data/brr.mjs;
// dialog portraits: assets/vm-portraits.json,
// src/data/portraits.mjs; dialog records: assets/vm-dialogs.json,
// src/data/dialogs.mjs; runner table: assets/vm-runners.json,
// src/data/runners.mjs; SPC700 sound driver: assets/vm-spc-driver.json,
// src/data/spc-driver.mjs; lookup tables: assets/vm-tables.json,
// src/data/tables.mjs; matrix texts: assets/vm-matrix-texts.json,
// src/data/matrix-texts.mjs; text font: assets/vm-font.bmp,
// src/data/font.mjs; cartridge header: assets/vm-header.json,
// src/data/header.mjs; unreferenced scripts: assets/vm-orphan-scripts.json,
// src/data/orphan-scripts.mjs; filler bytes: assets/vm-fillers.json,
// src/data/fillers.mjs). The builder assembles the address view as the
// product does (src/data/cartridge.mjs) and stops when a present byte
// differs from the ROM or a byte is present or absent against its class.
import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { inspectScriptTables, europeanTables } from './scripts.mjs';
import { loadCartridge } from '../src/data/cartridge.mjs';
import { RAW_KINDS } from '../src/data/raw.mjs';
import { ROM_CODE_CLASSES as CODE, isDataToCodeBoundary } from './rom-code-retention.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256)
  throw new Error('ROM differs from the researched European revision');
const map = JSON.parse(await readFile('analysis/vm-rom-map.json', 'utf8'));
if (map.rom_sha256 !== ROM_SHA256) throw new Error('ROM map belongs to another ROM');
const DECODED = new Set([
  'script',
  'script_table',
  'text_tree',
  'text',
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
]);

// Data with no known reader (class unknown), kept in original form.
const UNREAD = {
  '80:FFB5':
    'Eleven bytes between the sound data and the title of the cartridge header (80:FFC0); the extended header would need 00 at FFB6 to FFBC. No reader is established; preserve the bytes (docs/ROM-UNREAD-AUDIT.md).',
  '8B:FD61':
    'Five words 8B:FD6B to FD73, each pointing to a zero word right behind the table, before the palette cycle table 8B:FD75. No owning reader is established (docs/ROM-UNREAD-AUDIT.md).',
  '8D:8080':
    'Sixty-four bytes with values 00 to 3F behind the 64 topic words of 8D:8000 and before the dialog records. Their meaning is unknown; out-of-range topic IDs can index them (docs/ROM-UNREAD-AUDIT.md).',
};
const cpu = (offset) => ((0x80 + (offset >> 15)) << 16) | 0x8000 | (offset & 0x7fff);
const label = (offset) => {
  const c = cpu(offset);
  return `${(c >> 16).toString(16).toUpperCase()}:${(c & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
};
const classOf = new Array(bytes.length);
for (const range of map.ranges)
  classOf.fill(
    range.class,
    parseInt(range.rom_offset, 16),
    parseInt(range.rom_offset, 16) + range.length,
  );
const readSet = new Uint8Array(bytes.length);
for (const [offset, length] of JSON.parse(await readFile('analysis/rom-reads.json', 'utf8')).ranges)
  readSet.fill(1, offset, offset + length);
// A code byte stays when it is code_kept, read, or the first code byte behind a data byte.
const keep = (o) =>
  classOf[o] === 'code_kept' || readSet[o] === 1 || isDataToCodeBoundary(classOf, o);
const raw = { code_bytes: [], unread: [] },
  wanted = new Uint8Array(bytes.length);
let absent = 0,
  decoded = 0;
for (let o = 0; o < bytes.length;) {
  const c = classOf[o];
  let e = o + 1;
  if (CODE.has(c)) {
    const kept = keep(o);
    while (e < bytes.length && CODE.has(classOf[e]) && keep(e) === kept && e % 0x8000) e++;
    if (kept) {
      raw.code_bytes.push({
        address: label(o),
        hex: bytes.subarray(o, e).toString('hex').toUpperCase(),
      });
      wanted.fill(1, o, e);
    } else absent += e - o;
  } else {
    while (e < bytes.length && classOf[e] === c && e % 0x8000) e++;
    wanted.fill(1, o, e);
    if (DECODED.has(c)) decoded += e - o;
    else if (c === 'unknown') {
      if (!UNREAD[label(o)])
        throw new Error(
          `Unknown bytes at ${label(o)} (${e - o}) have no note in build-cartridge.mjs`,
        );
      raw.unread.push({
        address: label(o),
        hex: bytes.subarray(o, e).toString('hex').toUpperCase(),
        note: UNREAD[label(o)],
      });
    } else throw new Error(`Class ${c} at ${label(o)} has no decoded source`);
  }
  o = e;
}
const rawBytes = RAW_KINDS.reduce(
  (n, k) => n + raw[k].reduce((m, r) => m + r.hex.length / 2, 0),
  0,
);
const inventory = inspectScriptTables(bytes);
const scripts = {
  file: 'scripts.json',
  tables: Object.fromEntries(
    Object.entries(europeanTables).map(([name, offset]) => [name, cpu(offset)]),
  ),
  scriptAddresses: inventory.scripts.map((s) => cpu(parseInt(s.rom_offset, 16))),
  nativeAddresses: inventory.native_functions.map((n) => cpu(parseInt(n.rom_offset, 16))),
};
const rawFile = {
  format: 'shadowrun-raw-v1',
  scope:
    'The last ROM bytes in original form (src/data/raw.mjs): code_bytes are code bytes a data reader touches (the first code byte behind each data range and every code byte the live runs read); unread are data ranges with no known reader, each with a note. Runs as address and hex bytes.',
  source_rom_sha256: ROM_SHA256,
  ...raw,
};
const manifest = {
  format: 'shadowrun-cartridge-data-v2',
  scope:
    'Game data of the European ROM without the 65816 code. Decoded content in its own files at the addresses given here; the last bytes in original form in vm-raw.json.',
  source_rom_sha256: ROM_SHA256,
  rom_size: bytes.length,
  absent_code_bytes: absent,
  decoded_bytes: decoded,
  raw_bytes: rawBytes,
  raw: { file: 'vm-raw.json' },
  scripts,
  texts: { file: 'vm-texts.json' },
  tiles: { file: 'vm-tiles.json' },
  palettes: { file: 'vm-palettes.json' },
  vram: { file: 'vm-vram.json' },
  lz: { file: 'vm-lz.json' },
  scenes: { file: 'vm-scenes.json' },
  tilesets: { file: 'vm-tilesets.json' },
  objects: { file: 'vm-objects.json' },
  object_graphics: { file: 'vm-object-graphics.json' },
  scene_lists: { file: 'vm-scene-lists.json' },
  menu_texts: { file: 'vm-menu-texts.json' },
  palette_cycles: { file: 'vm-palette-cycles.json' },
  rooms: { file: 'vm-rooms.json' },
  actors: { file: 'vm-actors.json' },
  kinds: { file: 'vm-kinds.json' },
  actions: { file: 'vm-actions.json' },
  pictures: { file: 'vm-pictures.json' },
  topics: { file: 'vm-topics.json' },
  sound: { file: 'vm-sound.json' },
  portraits: { file: 'vm-portraits.json' },
  dialogs: { file: 'vm-dialogs.json' },
  runners: { file: 'vm-runners.json' },
  spc_driver: { file: 'vm-spc-driver.json' },
  tables: { file: 'vm-tables.json' },
  matrix_texts: { file: 'vm-matrix-texts.json' },
  font: { file: 'vm-font.bmp' },
  header: { file: 'vm-header.json' },
  orphan_scripts: { file: 'vm-orphan-scripts.json' },
  fillers: { file: 'vm-fillers.json' },
};

// Self-check through the product's loader.
const rawText = JSON.stringify(rawFile, null, 1) + '\n';
const files = {
  'vm-cartridge.json': Buffer.from(JSON.stringify(manifest)),
  'vm-raw.json': Buffer.from(rawText),
};
const { rom, present } = await loadCartridge(
  async (name) => new Uint8Array(files[name] ?? (await readFile(`assets/${name}`))),
);
for (let o = 0; o < bytes.length; o++) {
  if (present[o] !== wanted[o])
    throw new Error(`Presence of ROM byte ${o.toString(16)} wrong (${classOf[o]})`);
  if (wanted[o] && rom[o] !== bytes[o])
    throw new Error(`ROM byte ${o.toString(16)} differs after loading (${classOf[o]})`);
}

await writeFile('assets/vm-raw.json', rawText);
await writeFile('assets/vm-cartridge.json', JSON.stringify(manifest) + '\n');
console.log(
  `${raw.code_bytes.length} code byte runs and ${raw.unread.length} unread ranges (${rawBytes} bytes) in original form, ${decoded} bytes from decoded sources, ${absent} code bytes left out`,
);
