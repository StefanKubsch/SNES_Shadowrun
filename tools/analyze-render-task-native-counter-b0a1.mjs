import {readFile,writeFile} from 'node:fs/promises';
import {inspectRom} from './rom.mjs';
import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';
import {formatBlock} from './disassemble.mjs';
import {counterWindows,prove} from './render-task-native-counter-b0a1-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
const d=decodeTaskWindows(bytes,counterWindows),p=prove(d.map);
await writeFile('analysis/render-task-native-counter-b0a1.json',JSON.stringify({rom_sha256:taskRomHash,
 progress_reference:'docs/PORTIERUNGSSTAND.json',windows:d.windows,proofs:[p],completed_script_bodies:0,
 source_graph:{native_binding:false,local_source_complete:true,full_graph_closed:true,full_task_binding:false,code_bytes:11,instructions:4},
 scope:'Whole own Task counter helper; caller/menu/Native13/scene/frames remain separate.'},null,2)+'\n');
await writeFile('analysis/render-task-native-counter-b0a1.asm.txt',d.blocks.map(formatBlock).join('\n'));
console.log('Task B0A1: original11/4, actual RTL3, explicit chronological WORD observations.');
