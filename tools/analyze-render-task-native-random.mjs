import {readFile,writeFile} from 'node:fs/promises';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {taskRomHash,taskHash,decodeTaskWindows} from './task-partial-source.mjs';
import {formatBlock} from './disassemble.mjs';
import {randomWindows,randomTables,randomAnchors,decodeSource,prove} from './render-task-native-random-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong ROM');
const d=decodeSource(bytes),pin=w=>{const off=cpuToOffset(w.start,bytes.length),raw=bytes.subarray(off,off+w.hex.length/2);
 if(raw.toString('hex').toUpperCase()!==w.hex)throw Error('Original random source/table/anchor drift');
 return {entry:cpuLabel(w.start),covered_bytes:raw.length,machine_bytes:w.hex,sha256:taskHash(raw)};};
const windows=randomWindows.map(w=>({...pin(w),instruction_count:decodeTaskWindows(bytes,[w]).map.size})),
 tables=randomTables.map(pin),anchors=randomAnchors.map(a=>({...pin(a),kind:a.kind}));
await writeFile('analysis/render-task-native-random.json',JSON.stringify({rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',
 windows,tables,anchors,proofs:[prove(d.map,0x80C51F),prove(d.map,0x80C560)],completed_script_bodies:0,
 source_graph:{native_binding:false,local_source_complete:true,full_graph_closed:true,full_task_binding:false,code_bytes:78,instructions:36},
 scope:'Whole original range C51F and BYTE helper C560. Literal original masks/random table and Native3E metadata. Independently observed PPU latch/horizontal/vertical BYTEs per reached attempt; no termination/time/Task/scene/frame/body claim.'},null,2)+'\n');
await writeFile('analysis/render-task-native-random.asm.txt',d.blocks.map(formatBlock).join('\n'));
console.log('Whole random C51F/C560:78 bytes/36 instructions; local stack5/3, PPU observations remain external.');
