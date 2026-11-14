// Uncompressed VRAM characters as BMP (docs/ROM-FREE.md, step 2): the ranges
// of analysis/rom-vram.json, the OBJ character sources of the object pictures
// (src/data/pictures.mjs) and C06B_SOURCES, joined, as one indexed sheet per
// format (assets/vm-vram-<format>.bmp) and assets/vm-vram.json (src/data/vram-tiles.mjs).
// tools/build-cartridge.mjs checks the way back through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset, cpuLabel} from './rom.mjs';
import {readVramTiles, mergeVramRanges, VRAM_SHEET_WIDTH, C06B_SOURCES} from '../src/data/vram-tiles.mjs';
import {readActions} from '../src/data/actions.mjs';
import {readPictures, pictureSources} from '../src/data/pictures.mjs';
import {writeBmp} from '../src/data/tiles.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const probe = JSON.parse(await readFile('analysis/rom-vram.json', 'utf8'));
const read8 = cpu => bytes[cpuToOffset(cpu, bytes.length)];
const pictures = readPictures(read8, readActions(read8).blocks.filter(b => b.frames).flatMap(b => b.frames));
const {ranges, sheets} = readVramTiles(read8, mergeVramRanges([...probe.ranges.map(r => [parseInt(r.source.replace(':', ''), 16), r.length, r.format]), ...pictureSources(pictures), ...C06B_SOURCES]));
const files = {};
for (const [format, pixels] of Object.entries(sheets)) {
  files[format] = `vm-vram-${format}.bmp`;
  await writeFile(`assets/${files[format]}`, writeBmp(pixels, VRAM_SHEET_WIDTH, pixels.length / VRAM_SHEET_WIDTH));
}
await writeFile('assets/vm-vram.json', JSON.stringify({
  format: 'shadowrun-vram-tiles-v1',
  scope: 'Characters the game sends by DMA from ROM to VRAM (seen in the live tests or named by the object pictures): obj4 OBJ characters with 4 bpp, bg2 BG characters with 2 bpp, as indexed BMP sheets (pixel = colour index, 16 characters per row, each range from a new row in this order); see src/data/vram-tiles.mjs.',
  source_rom_sha256: ROM_SHA256,
  sheets: files,
  ranges: ranges.map(r => ({address: cpuLabel(r.cpu), format: r.format, tiles: r.tiles})),
}, null, 1) + '\n');
console.log(`${ranges.length} ranges, ${ranges.reduce((n, r) => n + r.tiles, 0)} characters in ${Object.keys(files).length} sheets`);
