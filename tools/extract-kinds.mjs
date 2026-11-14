// Kind table 8C:EFB0 as readable JSON (docs/ROM-FREE.md, step 2):
// assets/vm-kinds.json (src/data/kinds.mjs). tools/build-cartridge.mjs
// checks the way back through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset} from './rom.mjs';
import {readKinds} from '../src/data/kinds.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const kinds = readKinds(cpu => bytes[cpuToOffset(cpu, bytes.length)]);
const scope = 'Kind table 8C:EFB0, in order; the kind of an actor in vm-actors.json is the index here. name: text address in vm-texts.json for the name window (BE6D, 9BC6, E9A8, EA6E) or null; value: returned to scripts by the natives C9F1 and CAF2 (hex); flags: copied by 80:A835 to 1458, bits 0 and 1 compared with 1F66 by EA6E (hex). See src/data/kinds.mjs.';
await writeFile('assets/vm-kinds.json', `{"format":"shadowrun-kinds-v1",\n"scope":${JSON.stringify(scope)},\n"source_rom_sha256":"${ROM_SHA256}",\n"kinds":[\n` +
  kinds.map(k => JSON.stringify(k)).join(',\n') + ']}\n');
console.log(`${kinds.length} kinds`);
