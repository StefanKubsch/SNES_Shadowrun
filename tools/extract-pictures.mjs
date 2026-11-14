// Object pictures of banks 9B and 9C as readable JSON (docs/ROM-FREE.md,
// step 2): assets/vm-pictures.json (src/data/pictures.mjs), every picture
// the frames of assets/vm-actions.json name. tools/build-cartridge.mjs
// checks the way back through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset} from './rom.mjs';
import {readActions} from '../src/data/actions.mjs';
import {readPictures} from '../src/data/pictures.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const read8 = cpu => bytes[cpuToOffset(cpu, bytes.length)];
const pictures = readPictures(read8, readActions(read8).blocks.filter(b => b.frames).flatMap(b => b.frames));
const scope = 'Object pictures (80:ACD0, 80:B20A) in address order. address: the picture as frames name it; shadow: signed byte before the picture, times 4 to FE0, present when bits 0-2 of the first cell are not 0; tiles: per slot the two 64-byte OBJ character sources for the NMI 81:A964; width, height (times 2 to DP 1A/1D); rows, columns; cells: one byte per cell, columns first (bit 5 empty, bits 6-7 flip). See src/data/pictures.mjs.';
await writeFile('assets/vm-pictures.json', `{"format":"shadowrun-pictures-v1",\n"scope":${JSON.stringify(scope)},\n"source_rom_sha256":"${ROM_SHA256}",\n"pictures":[\n` +
  pictures.map(p => JSON.stringify(p)).join(',\n') + ']}\n');
console.log(`${pictures.length} pictures`);
