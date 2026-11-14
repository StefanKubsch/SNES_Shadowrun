// Raumkacheln als BMP (docs/ROM-FREE.md, Schritt 2): je Bank $82-$87 ein
// indiziertes Blatt assets/vm-tiles-XX.bmp und assets/vm-tiles.json mit Adresse
// und Zerlegung je Strom (Format in src/data/tiles.mjs). Der Rückweg wird in
// tools/build-cartridge.mjs über den Lader des Produkts bytegleich geprüft.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset, cpuLabel} from './rom.mjs';
import {readTiles, streamToSheet, writeBmp, TILE_BANK} from '../src/data/tiles.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const streams = readTiles(cpu => bytes[cpuToOffset(cpu, bytes.length)]);
const sheets = [];
for (let s = 0; s < streams.length / 256; s++) {
  const pixels = new Uint8Array(256 * 256);
  for (let i = s * 256; i < (s + 1) * 256; i++) streamToSheet(streams[i].data, pixels, i);
  const file = `vm-tiles-${(TILE_BANK + s).toString(16)}.bmp`;
  await writeFile(`assets/${file}`, writeBmp(pixels, 256, 256));
  sheets.push(file);
}
await writeFile('assets/vm-tiles.json', JSON.stringify({
  format: 'shadowrun-tiles-v1',
  scope: 'Room tiles unpacked by $80:9E7E via the table $8D:A41F: 4 bpp 8x8 tiles, four per stream, as indexed BMP sheets (tile n at column n % 32, row n / 32). tokens is the original packing (literal run n, reference position:length); see src/data/tiles.mjs.',
  source_rom_sha256: ROM_SHA256,
  sheets,
  streams: streams.map(s => ({address: cpuLabel(s.start), tokens: s.tokens.map(t => t.join(':')).join(' ')})),
}, null, 1) + '\n');
console.log(`${streams.length} Ströme in ${sheets.length} Blättern`);
