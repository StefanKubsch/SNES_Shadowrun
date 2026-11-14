import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';import {decode,formatBlock} from './disassemble.mjs';
import {taskWord,taskOwner} from './task-control-source.mjs';
export const taskRomHash='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
export const taskHash=b=>createHash('sha256').update(b).digest('hex');
export function taskBank(bank){if(!Number.isInteger(bank)||bank<0||bank>255)throw Error('Explicit actual DBR');return bank;}
export function taskWords(...values){if(!values.every(taskWord))throw Error('Explicit actual WORD observations');}
export const taskPair=a=>[taskOwner(a&0xFFFFFF),taskOwner((a+1)&0xFFFFFF)];
export const taskDpPair=(d,n)=>[taskOwner((d+n)&65535),taskOwner((d+n+1)&65535)];
export const taskWrites=(owners,value,order=['low','high'])=>owners.map((b,n)=>({...b,byte:order[n],value:order[n]==='high'?value>>>8:value&255}));
export function decodeTaskWindows(bytes,windows){const map=new Map(),blocks=[],descriptions=[];
  for(const w of windows){const instructions=[];let state={e:0,m:w.initialM??0,x:w.initialX??0};for(let pc=w.start;pc<w.start+w.hex.length/2;){const i=decode(bytes,pc,state);if(i.next>w.start+w.hex.length/2)throw Error('Partial source width');instructions.push(i);map.set(pc,i);if(['SEP','REP'].includes(i.mnemonic))state={...state,...(i.value&32?{m:Number(i.mnemonic==='SEP')}:{}) ,...(i.value&16?{x:Number(i.mnemonic==='SEP')}:{})};pc=i.next;}
    const raw=Buffer.concat(instructions.map(i=>i.raw));blocks.push({entry:w.start,initialState:{e:0,m:w.initialM??0,x:w.initialX??0},instructions,stop:'Explicit bounded source/frontier only, not CPU or inferred task lifecycle.'});descriptions.push({name:w.name??cpuLabel(w.start),entry:cpuLabel(w.start),end_exclusive:cpuLabel(w.start+raw.length),covered_bytes:raw.length,instruction_count:instructions.length,sha256:taskHash(raw),machine_bytes:raw.toString('hex').toUpperCase()});}
  return {map,blocks,windows:descriptions};
}
// Structural reachability only: both conditional edges; revisiting a loop is
// allowed but supplies no termination proof. Exact source pins are separate.
export function taskSourceEdges(map,entry,frontiers){const pending=[entry],seen=new Set(),edges=[];
  while(pending.length){const pc=pending.pop();if(seen.has(pc))continue;const i=map.get(pc);if(!i)throw Error('Uncovered partial source edge');seen.add(pc);if(frontiers.includes(pc))continue;
    if(['JSR','RTS','TCS'].includes(i.mnemonic))throw Error('Unproved partial control boundary');
    const next=i.mnemonic==='JMP'||i.mnemonic==='BRA'?[i.target]:i.mode==='rel8'?[i.next,i.target]:[i.next];for(const to of next){edges.push({from:cpuLabel(pc),to:cpuLabel(to)});pending.push(to);}}
  if(!frontiers.every(pc=>seen.has(pc)))throw Error('Missing partial frontier');return {visited:[...seen].sort((a,b)=>a-b).map(cpuLabel),edges};
}
export async function emitTaskPartialSource(spec,prove,examples){const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong ROM');const decoded=decodeTaskWindows(bytes,spec.windows),proofs=prove(decoded.map),dispatch=[];
  if(spec.opcode!==undefined){const pc=0x80F2B4+spec.opcode,off=cpuToOffset(pc,bytes.length),raw=bytes.subarray(off,off+2);if(raw.readUInt16LE()!==spec.entry%65536)throw Error('Opcode target drift');dispatch.push({opcode:spec.opcode,word_source:cpuLabel(pc),target:cpuLabel(spec.entry),machine_bytes:raw.toString('hex').toUpperCase()});}
  const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',windows:decoded.windows,proofs,dispatch_entries:dispatch,source_graph:{local_source_complete:true,source_closed_to_dispatch:false,full_graph_closed:false,native_binding:false,classification:spec.classification,code_bytes:decoded.windows.reduce((n,w)=>n+w.covered_bytes,0),instructions:decoded.map.size,minimum_protected_stack_bytes:null},synthetic_examples:examples,processor_reference:'WDC W65C816S 13March2024 sections3.5/7.1/7.2 and instruction table: native stack/DP bank00, WORD transfers, fresh actualDBR/24bit data; instruction semantics only.',host_boundary:spec.host_boundary};
  await writeFile(`analysis/render-task-${spec.name}.json`,JSON.stringify(report,null,2)+'\n');await writeFile(`analysis/render-task-${spec.name}.asm.txt`,decoded.blocks.map(formatBlock).join('\n'));console.log(`${spec.name}: bounded source ${report.source_graph.code_bytes}/${decoded.map.size}; fulltask/native OPEN.`);return report;
}
