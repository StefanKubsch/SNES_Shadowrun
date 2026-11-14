// Action lists and records of the kinds, 8C:8000 to the table 8C:ED8A, as
// readable JSON (docs/ROM-FREE.md, step 2): assets/vm-actions.json
// (src/data/actions.mjs). tools/build-cartridge.mjs checks the way back
// through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset} from './rom.mjs';
import {readActions} from '../src/data/actions.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const {kinds, blocks} = readActions(cpu => bytes[cpuToOffset(cpu, bytes.length)]);
const scope = 'Action lists of the kinds (80:D15C, 80:8371). kinds: per kind of vm-kinds.json the block index of its action list, or null where the table word points at the table 8C:ED8A itself (kind 274). blocks: 8C:8000 on, in address order: a list {actions: block index of the record per action number} or a record {speed (4088, added to 4030 by 80:AC2F), count (frames per direction), loop (bit 7 of byte 1; 10E8 = byte XOR 80), fields (bytes +2 to +7 to 1248, 4240, 4298, 42F0, 4348 signed, 43A0), directions (per direction 1198 the index of its first frame, null for offset 0), frames (picture addresses in banks 9B and 9C for 80:ACD0)}. See src/data/actions.mjs.';
await writeFile('assets/vm-actions.json', `{"format":"shadowrun-actions-v1",\n"scope":${JSON.stringify(scope)},\n"source_rom_sha256":"${ROM_SHA256}",\n"kinds":${JSON.stringify(kinds)},\n"blocks":[\n` +
  blocks.map(b => JSON.stringify(b)).join(',\n') + ']}\n');
console.log(`${kinds.length} kinds, ${blocks.filter(b => b.actions).length} lists, ${blocks.filter(b => b.frames).length} records`);
