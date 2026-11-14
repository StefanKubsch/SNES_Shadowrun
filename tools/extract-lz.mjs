// Packed streams of 9F49/9F4D/9F6D (docs/ROM-FREE.md, step 2): the streams of
// analysis/rom-vram.json, the streams of FIXED_SOURCES and of the scene
// command lists (src/data/scene-lists.mjs), the dialog portraits
// (src/data/portraits.mjs) and all scene records of the
// table 8B:F9E3 as assets/vm-lz.json and one indexed BMP sheet per character format
// (assets/vm-lz-<format>.bmp; src/data/lz-streams.mjs); the scene records as
// readable JSON in assets/vm-scenes.json (src/data/scenes.mjs).
// tools/build-cartridge.mjs checks the way back through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset, cpuLabel} from './rom.mjs';
import {readLzStreams, readSceneTable, FIXED_SOURCES} from '../src/data/lz-streams.mjs';
import {readSceneListStreams} from '../src/data/scene-lists.mjs';
import {portraitStreams} from '../src/data/portraits.mjs';
import {VRAM_SHEET_WIDTH} from '../src/data/vram-tiles.mjs';
import {writeBmp} from '../src/data/tiles.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const probe = JSON.parse(await readFile('analysis/rom-vram.json', 'utf8'));
const read8 = cpu => bytes[cpuToOffset(cpu, bytes.length)], scenes = readSceneTable(read8);
const sources = new Map(probe.streams.map(s => [parseInt(s.source.replace(':', ''), 16), s.format]));
for (const cpu of scenes) sources.set(cpu, 'scene');
for (const [cpu, format] of FIXED_SOURCES) sources.set(cpu, format);
// The streams of the scene command lists; one the probe saw must agree.
for (const [cpu, format] of readSceneListStreams(read8)) {
  if (sources.has(cpu) && sources.get(cpu) !== format) throw new Error(`${cpuLabel(cpu)}: list format ${format}, probe ${sources.get(cpu)}`);
  sources.set(cpu, format);
}
// The dialog portraits (src/data/portraits.mjs): 64 OBJ characters each.
for (const cpu of portraitStreams(read8)) {
  if (sources.has(cpu) && sources.get(cpu) !== 'obj4') throw new Error(`${cpuLabel(cpu)}: portrait, probe ${sources.get(cpu)}`);
  sources.set(cpu, 'obj4');
}
const {streams, sheets} = readLzStreams(read8, [...sources].sort((a, b) => a[0] - b[0]));
const files = {};
for (const [format, pixels] of Object.entries(sheets)) {
  files[format] = `vm-lz-${format}.bmp`;
  await writeFile(`assets/${files[format]}`, writeBmp(pixels, VRAM_SHEET_WIDTH, pixels.length / VRAM_SHEET_WIDTH));
}
await writeFile('assets/vm-lz.json', JSON.stringify({
  format: 'shadowrun-lz-streams-v1',
  scope: 'Packed streams of the unpacker 9F49/9F4D/9F6D: address of the length word, format of the output, original packing (literal run n, reference position:length) and the output: characters (bg2, bg4, obj4) in the BMP sheet of the format, 16 per row, each stream from a new row in this order; map as tilemap words, scene in vm-scenes.json under the same address, text as lines, credits as groups of lines, states as the records of 5 bytes (state word, count, holder) that differ from 0000/0/FFFF with their WRAM address, bytes as hex; see src/data/lz-streams.mjs.',
  source_rom_sha256: ROM_SHA256,
  sheets: files,
  streams: streams.map(s => ({address: cpuLabel(s.cpu), format: s.format, ...(s.tiles !== undefined && {tiles: s.tiles}),
    tokens: s.tokens, ...(s.words && {words: s.words}), ...(s.lines && {lines: s.lines}), ...(s.groups && {groups: s.groups}), ...(s.states && {states: s.states}), ...(s.bytes && {bytes: s.bytes})})),
}, null, 1) + '\n');

// One line per shape and object.
const record = new Map(streams.filter(s => s.scene).map(s => [s.cpu, s.scene]));
const list = items => items.length ? `[\n    ${items.map(x => JSON.stringify(x)).join(',\n    ')}]` : '[]';
const scope = 'Scene records of the table 8B:F9E3 in table order (scene n = entry n), unpacked by 81:A117: backdrop colour (BGR555), tileset, grid shapes (line or rect at row/column of the grid 7F:CA14) and the two object lists for the layers 7E:76A8 and 7E:46A8; see src/data/scenes.mjs.';
await writeFile('assets/vm-scenes.json', `{"format":"shadowrun-scenes-v1",\n"scope":${JSON.stringify(scope)},\n"source_rom_sha256":"${ROM_SHA256}",\n"scenes":[\n` +
  scenes.map(cpu => {
    const s = record.get(cpu);
    return `{"address":"${cpuLabel(cpu)}","backdrop":"${s.backdrop}","tileset":${s.tileset},\n  "shapes":${list(s.shapes)},\n  "objects_76a8":${list(s.objects_76a8)},\n  "objects_46a8":${list(s.objects_46a8)}}`;
  }).join(',\n') + ']}\n');
console.log(`${streams.length} streams (${record.size} scenes), sheets ${Object.keys(files).join(' ')}`);
