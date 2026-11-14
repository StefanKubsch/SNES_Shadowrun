// Paletten als JSON (docs/ROM-FREE.md, Schritt 2): die Bereiche aus
// analysis/rom-palettes.json nach assets/vm-palettes.json (src/data/palettes.mjs).
// Also the palettes of the scene command lists (src/data/scene-lists.mjs);
// ranges inside the palette cycles stay with those (src/data/palette-cycles.mjs),
// those inside dialog portrait records with them (src/data/portraits.mjs).
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset, cpuLabel} from './rom.mjs';
import {readPalettes} from '../src/data/palettes.mjs';
import {readSceneListPalettes, mergeRanges} from '../src/data/scene-lists.mjs';
import {outsideCycles} from '../src/data/palette-cycles.mjs';
import {outsidePortraits} from '../src/data/portraits.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const read8 = cpu => bytes[cpuToOffset(cpu, bytes.length)];
const ranges = outsidePortraits(read8, outsideCycles(mergeRanges([...JSON.parse(await readFile('analysis/rom-palettes.json', 'utf8')).ranges, ...readSceneListPalettes(read8)])));
const palettes = readPalettes(read8, ranges);
await writeFile('assets/vm-palettes.json', JSON.stringify({
  format: 'shadowrun-palettes-v1',
  scope: 'Palettes the game transfers by DMA from ROM to CGRAM, and those the scene command lists copy through 81:ECF2: BGR555 words (bits 0-4 red, 5-9 green, 10-14 blue) in hex; see src/data/palettes.mjs.',
  source_rom_sha256: ROM_SHA256,
  palettes: palettes.map(p => ({address: cpuLabel(p.cpu), colors: p.colors})),
}, null, 1) + '\n');
console.log(`${palettes.length} Paletten`);
