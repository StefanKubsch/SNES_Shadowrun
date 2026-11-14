// Actor table 8D:B01F as readable JSON (docs/ROM-FREE.md, step 2):
// assets/vm-actors.json (src/data/actors.mjs). tools/build-cartridge.mjs
// checks the way back through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset} from './rom.mjs';
import {readActors} from '../src/data/actors.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const actors = readActors(cpu => bytes[cpuToOffset(cpu, bytes.length)]);
const scope = 'Actor table 8D:B01F (80:A3B6, A2FA, A1E6, EA6E), in order; the actor of a room actor in vm-rooms.json is the index here. flags: A3B6 skips the actor when flags ORA 7E:2DE4 is 0, EA6E lists it when flags AND 2DE4 AND 7F is not 0, bits 6 and 7 to 1400; record: WRAM address of its new-game state record (7E:2E00) or null; kind: for 80:A835 (index into the kind table 8C:EFB0, vm-kinds.json); script: appended by A835 through C34A. See src/data/actors.mjs.';
await writeFile('assets/vm-actors.json', `{"format":"shadowrun-actors-v1",\n"scope":${JSON.stringify(scope)},\n"source_rom_sha256":"${ROM_SHA256}",\n"actors":[\n` +
  actors.map(a => JSON.stringify(a)).join(',\n') + ']}\n');
console.log(`${actors.length} actors`);
