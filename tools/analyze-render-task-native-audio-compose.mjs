import {readFile,writeFile} from 'node:fs/promises';import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {taskRomHash,taskHash} from './task-partial-source.mjs';import {formatBlock} from './disassemble.mjs';
import {audioComposeWindows,decodeSource,prove} from './render-task-native-audio-compose-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
const {map}=decodeSource(bytes),proofs=audioComposeWindows.slice(0,5).map(w=>prove(map,w.start));
const windows=audioComposeWindows.map(w=>{const off=cpuToOffset(w.start,bytes.length),raw=bytes.subarray(off,off+w.hex.length/2);
 if(raw.toString('hex').toUpperCase()!==w.hex)throw Error('Original audio source drift');
 return {entry:cpuLabel(w.start),end_exclusive:cpuLabel(w.start+raw.length),covered_bytes:raw.length,machine_bytes:w.hex,sha256:taskHash(raw),instruction_count:[...map.keys()].filter(pc=>pc>=w.start&&pc<w.start+raw.length).length};});
await writeFile('analysis/render-task-native-audio-compose.json',JSON.stringify({rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',windows,proofs,completed_script_bodies:0,
 source_graph:{native_binding:false,local_source_complete:true,full_graph_closed:false,conditional_graph_closed:true,full_task_binding:false,code_bytes:444,instructions:220},
 scope:'Full own audio loader/length/WORDsender helpers and conditional whole C46E normal graph. Actual zero voice saved-sound RTS not root return; caller/menu/Native13/audio/clock/wholeTask/scene/frames open.'},null,2)+'\n');
await writeFile('analysis/render-task-native-audio-compose.asm.txt',audioComposeWindows.map(w=>formatBlock({entry:w.start,initialState:{e:0,m:w.initialM??0,x:0},
 instructions:[...map.values()].filter(i=>i.cpu>=w.start&&i.cpu<w.start+w.hex.length/2),stop:'Whole individually pinned source; C46E zero voice return remains conditional.'})).join('\n'));
console.log('Task audio:444/220; whole F130/F100/F122/F1E8, conditional C46E, actual transitive stack14/10/2/6/6.');
