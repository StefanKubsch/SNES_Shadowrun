// Rooms of the table 8D:929D and their headers in banks 99 and 9A as
// readable JSON (docs/ROM-FREE.md, step 2): assets/vm-rooms.json
// (src/data/rooms.mjs). tools/build-cartridge.mjs checks the way back
// through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset} from './rom.mjs';
import {readRooms} from '../src/data/rooms.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const {entries, rooms} = readRooms(cpu => bytes[cpuToOffset(cpu, bytes.length)]);
const scope = 'Rooms (80:A4BF). entries: the 498 entries of the table 8D:929D in order: room index into rooms (null: word FFFF), direction (DP 11, for 80:AAAF), start x, y, z (DP 14, 17, 1A). rooms: the headers in address order, back to back per bank: scene number, music (255 none), actors (x, y, flags = DP 06, actor: index into the actor table 8D:B01F, vm-actors.json), boxes (collision: low x, y, z, high x, y, z), scripts (box and script started by 80:8000), exits (box and target room entry), points (x, y, z), sight (x0, y0, unused, x1, y1, height for 81:A25F), camera (minimum and maximum of DP 41 and DP 44 for 81:8A05, or null). See src/data/rooms.mjs.';
await writeFile('assets/vm-rooms.json', `{"format":"shadowrun-rooms-v1",\n"scope":${JSON.stringify(scope)},\n"source_rom_sha256":"${ROM_SHA256}",\n"entries":[\n` +
  entries.map(e => JSON.stringify(e)).join(',\n') + '],\n"rooms":[\n' + rooms.map(r => JSON.stringify(r)).join(',\n') + ']}\n');
console.log(`${entries.length} entries, ${rooms.length} rooms`);
