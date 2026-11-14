import {readFile,writeFile} from 'node:fs/promises';import {inspectRom,cpuLabel} from './rom.mjs';
import {taskRomHash,taskHash} from './task-partial-source.mjs';import {formatBlock} from './disassemble.mjs';
import {menuRoots,decodeSource,prove,requestProofs} from './render-task-native-menu-compose-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
const {map,blocks,windows}=decodeSource(bytes),proofs=menuRoots.map(entry=>prove(map,entry));
const inputInstructions=[...map.values()].filter(i=>i.cpu>=0x809E1A&&i.cpu<0x809E59),raw=Buffer.concat(inputInstructions.map(i=>i.raw));
windows.push({entry:'80:9E1A',end_exclusive:'80:9E59',covered_bytes:63,instruction_count:26,machine_bytes:raw.toString('hex').toUpperCase(),sha256:taskHash(raw)});
await writeFile('analysis/render-task-native-menu-compose.json',JSON.stringify({rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',windows,proofs,
 internal_request_helpers:requestProofs(map),completed_script_bodies:0,source_graph:{native_binding:false,local_source_complete:true,full_graph_closed:false,
 conditional_graph_closed:true,full_task_binding:false,code_bytes:2304,instructions:1088},
 scope:'Whole own conditional menu normal roots and every actual Task dependency. Reset/startup and nonroot zero-voice audio RTS are effect-free boundaries; caller/Native13/input/time/audio/wholeTask/scene/frames open.'},null,2)+'\n');
await writeFile('analysis/render-task-native-menu-compose.asm.txt',blocks.map(formatBlock).join('\n')+'\n'+formatBlock({entry:0x809E1A,
 initialState:{e:0,m:0,x:0},instructions:inputInstructions,stop:'Whole original local input source, native exact3030 reset withheld.'}));
console.log('Task menu:2304/1088, four conditional whole normal roots, actual stack20 and original Voice3/source002D.');
