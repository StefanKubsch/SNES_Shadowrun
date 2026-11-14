// Command lists of the scene loader 81:EC16 as readable JSON (docs/ROM-FREE.md,
// step 2): assets/vm-scene-lists.json (src/data/scene-lists.mjs).
// tools/build-cartridge.mjs checks the way back through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset} from './rom.mjs';
import {readSceneLists} from '../src/data/scene-lists.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const runs = readSceneLists(cpu => bytes[cpuToOffset(cpu, bytes.length)]);
const scope = 'Command lists of the scene loader 81:EC16 in their runs: pointer (02, to DP 6E/70), unpack (03, stream through 80:F2A0 to the VRAM word address, DMA length), palette (04, count colours from colour first through 81:ECF2), port (05), nop; a list without 00 continues into the next. The run 81:F48D starts with the six list pointers read by 81:CDF8. See src/data/scene-lists.mjs.';
// One line per command.
await writeFile('assets/vm-scene-lists.json', `{"format":"shadowrun-scene-lists-v1",\n"scope":${JSON.stringify(scope)},\n"source_rom_sha256":"${ROM_SHA256}",\n"runs":[\n` +
  runs.map(r => `{"address":"${r.address}",${r.table ? `"table":${JSON.stringify(r.table)},` : ''}"lists":[\n` + r.lists.map(l =>
    ` {"address":"${l.address}",${l.continues ? '"continues":true,' : ''}"commands":[\n   ${l.commands.map(c => JSON.stringify(c)).join(',\n   ')}]}`).join(',\n') + ']}').join(',\n') + ']}\n');
console.log(`${runs.length} runs, ${runs.reduce((n, r) => n + r.lists.length, 0)} lists`);
