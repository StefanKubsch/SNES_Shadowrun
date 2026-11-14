import {readFile,writeFile} from 'node:fs/promises';import {inspectRom} from './rom.mjs';
import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';import {formatBlock} from './disassemble.mjs';
import {taskListSpecs} from './task-native-list-specs.mjs';import {listWindows,prove} from './render-task-native-list-prerequisites-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
const roots=taskListSpecs.map(s=>decodeTaskWindows(bytes,listWindows(s.entry)));
const windows=[...new Map(roots.flatMap(d=>d.windows).map(w=>[w.entry,w])).values()],proofs=roots.map((d,n)=>prove(d.map,taskListSpecs[n].entry));
await writeFile('analysis/render-task-native-list-prerequisites.json',JSON.stringify({rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',
 windows,proofs,completed_script_bodies:0,source_graph:{native_binding:false,local_source_complete:true,full_graph_closed:true,full_task_binding:false,
 code_bytes:windows.reduce((n,w)=>n+w.covered_bytes,0),instructions:new Set(roots.flatMap(d=>[...d.map.keys()])).size},
 scope:'Whole own Task list prerequisites; existing separate render providers remain separate contracts. Native13/menu/caller/wholeTask/scene/frames open.'},null,2)+'\n');
await writeFile('analysis/render-task-native-list-prerequisites.asm.txt',[...new Map(roots.flatMap(d=>d.blocks).map(b=>[b.entry,b])).values()].map(formatBlock).join('\n'));
console.log('Task list prerequisites: five whole roots, actual typed stack16/14/14/5/12.');
