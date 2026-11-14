// Menu texts of bank 81 as readable JSON (docs/ROM-FREE.md, step 2):
// assets/vm-menu-texts.json (src/data/menu-texts.mjs). tools/build-cartridge.mjs
// checks the way back through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset} from './rom.mjs';
import {readMenuTexts} from '../src/data/menu-texts.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const texts = readMenuTexts(cpu => bytes[cpuToOffset(cpu, bytes.length)]);
const scope = 'Menu texts of bank 81 that 81:D531 writes (copyright line, main menu, saved games, options): address and ASCII text; each text keeps its address and length. See src/data/menu-texts.mjs.';
await writeFile('assets/vm-menu-texts.json', `{"format":"shadowrun-menu-texts-v1",\n"scope":${JSON.stringify(scope)},\n"source_rom_sha256":"${ROM_SHA256}",\n"texts":[\n` +
  texts.map(t => JSON.stringify(t)).join(',\n') + ']}\n');
console.log(`${texts.length} menu texts`);
