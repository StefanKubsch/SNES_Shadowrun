import {readFile,writeFile} from 'node:fs/promises';import {inspectRom} from './rom.mjs';
import {taskRomHash,taskHash} from './task-partial-source.mjs';import {formatBlock} from './disassemble.mjs';
import {actionsRoots,decodeSource,prove} from './render-task-native-actions-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
const {map,blocks,windows}=decodeSource(bytes),proofs=actionsRoots.map(entry=>prove(map,entry));
const inputInstructions=[...map.values()].filter(i=>i.cpu>=0x809E1A&&i.cpu<0x809E59),raw=Buffer.concat(inputInstructions.map(i=>i.raw));
windows.push({entry:'80:9E1A',end_exclusive:'80:9E59',covered_bytes:63,instruction_count:26,machine_bytes:raw.toString('hex').toUpperCase(),sha256:taskHash(raw)});
await writeFile('analysis/render-task-native-actions.json',JSON.stringify({rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',windows,proofs,
 completed_script_bodies:0,source_graph:{native_binding:false,local_source_complete:true,full_graph_closed:false,conditional_graph_closed:true,
 full_task_binding:false,code_bytes:3802,instructions:1756},scope:'Whole own conditional99EB/Native13 original graphs; reset/zeroVoice are effect-free boundaries. Native58/task/scene/frame binding remains open.'},null,2)+'\n');
await writeFile('analysis/render-task-native-actions.asm.txt',blocks.map(formatBlock).join('\n')+'\n'+formatBlock({entry:0x809E1A,
 initialState:{e:0,m:0,x:0},instructions:inputInstructions,stop:'Whole original local input source, native exact3030 reset withheld.'}));
console.log('Task actions:3802/1756, whole99EB/Native13 conditional graph, stack28/30.');
