import {readFile,writeFile} from 'node:fs/promises';
import {inspectRom} from './rom.mjs';
import {taskRomHash} from './task-partial-source.mjs';
import {proveTaskVisit} from './task-visit-source.mjs';
const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong visit ROM');
const r=await proveTaskVisit(bytes);
await writeFile('analysis/render-task-visit.json',JSON.stringify({rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',...r,
 source_graph:{native_binding:false,local_source_complete:true,full_graph_closed:false},scope:r.proofs[0].boundary},null,2)+'\n');
console.log('Visit: five bounded entries, renewed original windows, readiness/removal/frontier stack and realF495 dependency.');
