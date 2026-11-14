// Tilesets of the scene records as readable JSON (docs/ROM-FREE.md, step 2):
// assets/vm-tilesets.json (src/data/tilesets.mjs). tools/build-cartridge.mjs
// checks the way back through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset} from './rom.mjs';
import {readTilesets} from '../src/data/tilesets.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const tilesets = readTilesets(cpu => bytes[cpuToOffset(cpu, bytes.length)]);
const scope = 'Tilesets of the scene records (tileset n of vm-scenes.json): per block the attribute byte (palette slot of 8CE0) and its eight words in hex as four rows of two (left, right), as 81:8EDF writes them to the layer 7E:76A8; 0000 leaves a cell empty. See src/data/tilesets.mjs.';
// One line per block.
await writeFile('assets/vm-tilesets.json', `{"format":"shadowrun-tilesets-v1",\n"scope":${JSON.stringify(scope)},\n"source_rom_sha256":"${ROM_SHA256}",\n"tilesets":[\n` +
  tilesets.map(t => `{"blocks":[\n  ${t.blocks.map(b => JSON.stringify(b)).join(',\n  ')}]}`).join(',\n') + ']}\n');
console.log(`${tilesets.length} tilesets, ${tilesets.reduce((n, t) => n + t.blocks.length, 0)} blocks`);
