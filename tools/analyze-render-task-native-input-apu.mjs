import {readFile,writeFile} from 'node:fs/promises';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {taskRomHash,taskHash} from './task-partial-source.mjs';import {formatBlock} from './disassemble.mjs';
import {inputApuWindows,decodeSource,prove} from './render-task-native-input-apu-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
const {map}=decodeSource(bytes),proofs=inputApuWindows.map(w=>prove(map,w.start));
const windows=inputApuWindows.map(w=>{const raw=bytes.subarray(cpuToOffset(w.start,bytes.length),cpuToOffset(w.start,bytes.length)+w.hex.length/2);
 if(raw.toString('hex').toUpperCase()!==w.hex)throw Error('Input/APU source bytes drift');
 return {entry:cpuLabel(w.start),end_exclusive:cpuLabel(w.start+raw.length),covered_bytes:raw.length,machine_bytes:w.hex,sha256:taskHash(raw),instruction_count:[...map.keys()].filter(pc=>pc>=w.start&&pc<w.start+raw.length).length};});
await writeFile('analysis/render-task-native-input-apu.json',JSON.stringify({rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',windows,proofs,
 completed_script_bodies:0,source_graph:{native_binding:false,local_source_complete:true,full_graph_closed:false,normal_graph_closed:true,
 full_task_binding:false,code_bytes:167,instructions:79},scope:'Whole F007/C416 and complete9E1A normal paths; full local reset source pinned, native reset/startup withheld. Caller/input/device/time/audio/wholeTask/scene/frames open.'},null,2)+'\n');
await writeFile('analysis/render-task-native-input-apu.asm.txt',inputApuWindows.map(w=>formatBlock({entry:w.start,initialState:{e:0,m:0,x:0},
 instructions:[...map.values()].filter(i=>i.cpu>=w.start&&i.cpu<w.start+w.hex.length/2),stop:'Whole local source; normal return or explicit uncompleted reset boundary.'})).join('\n'));
console.log('Task input/APU:167/79, full F007/C416;9E1A normal returns or explicit withheld reset.');
