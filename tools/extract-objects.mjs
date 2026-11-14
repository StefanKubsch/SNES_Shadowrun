// Object types of the scene records as readable JSON (docs/ROM-FREE.md, step
// 2): assets/vm-objects.json (src/data/object-types.mjs).
// tools/build-cartridge.mjs checks the way back through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset} from './rom.mjs';
import {readObjectTypes} from '../src/data/object-types.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const types = readObjectTypes(cpu => bytes[cpuToOffset(cpu, bytes.length)]);
const scope = 'Object types of the scene records (type n of vm-scenes.json): header words (offset and offset_flipped added by 81:903E to DP 2C, offset_2f to DP 2F), parts (graphic index into 96:C3FA, flip, column, row, depth) and collision boxes of 81:84DE (signed start and size per axis). See src/data/object-types.mjs.';
// One line per type.
await writeFile('assets/vm-objects.json', `{"format":"shadowrun-object-types-v1",\n"scope":${JSON.stringify(scope)},\n"source_rom_sha256":"${ROM_SHA256}",\n"types":[\n` +
  types.map(t => JSON.stringify(t)).join(',\n') + ']}\n');
console.log(`${types.length} object types, ${types.reduce((n, t) => n + t.parts.length, 0)} parts, ${types.reduce((n, t) => n + t.boxes.length, 0)} boxes`);
