// Part graphics of the object types as readable JSON (docs/ROM-FREE.md, step
// 2): assets/vm-object-graphics.json (src/data/object-graphics.mjs).
// tools/build-cartridge.mjs checks the way back through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset} from './rom.mjs';
import {readObjectGraphics} from '../src/data/object-graphics.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const {graphics, runs} = readObjectGraphics(cpu => bytes[cpuToOffset(cpu, bytes.length)]);
const scope = 'Part graphics of the object types (graphic n of vm-objects.json, table 96:C3FA read by 81:903E): attribute (palette bits through 8CE0), depth mode (a depth byte in every cell, or only in the first cell of each row) and rows of cells, "DD.WWWW" with depth byte or "WWWW" without, WWWW the tile stack entry (0000 empty). Runs give the order of the graphics in each ROM region. See src/data/object-graphics.mjs.';
// One line per graphic and per run.
await writeFile('assets/vm-object-graphics.json', `{"format":"shadowrun-object-graphics-v1",\n"scope":${JSON.stringify(scope)},\n"source_rom_sha256":"${ROM_SHA256}",\n"graphics":[\n` +
  graphics.map(g => JSON.stringify(g)).join(',\n') + '],\n"runs":[\n' + runs.map(r => JSON.stringify(r)).join(',\n') + ']}\n');
console.log(`${graphics.length} graphics, ${graphics.reduce((n, g) => n + g.rows.length * g.rows[0].split(' ').length, 0)} cells, ${runs.length} runs`);
