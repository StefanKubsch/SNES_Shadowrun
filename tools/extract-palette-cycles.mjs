// Palette cycles of the table 8B:FD75 as readable JSON (docs/ROM-FREE.md,
// step 2): assets/vm-palette-cycles.json (src/data/palette-cycles.mjs).
// tools/build-cartridge.mjs checks the way back through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset} from './rom.mjs';
import {readPaletteCycles} from '../src/data/palette-cycles.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const cycles = readPaletteCycles(cpu => bytes[cpuToOffset(cpu, bytes.length)]);
const scope = 'Palette cycles of the table 8B:FD75 (81:801A, 81:8076, 81:80C4): palette number, first colour within its slot, reverse direction, DMA length in bytes, speed added per frame, steps, and the colours (BGR555 hex); each step sends length bytes from colour 2 index on. See src/data/palette-cycles.mjs.';
await writeFile('assets/vm-palette-cycles.json', `{"format":"shadowrun-palette-cycles-v1",\n"scope":${JSON.stringify(scope)},\n"source_rom_sha256":"${ROM_SHA256}",\n"cycles":[\n` +
  cycles.map(c => JSON.stringify(c)).join(',\n') + ']}\n');
console.log(`${cycles.length} palette cycles`);
