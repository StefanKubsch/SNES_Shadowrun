import {readFile} from 'node:fs/promises';
import {cpuLabel,cpuToOffset} from './rom.mjs';
import {taskHash,taskRomHash} from './task-partial-source.mjs';
import {decodeScript,encodeScript} from '../src/script/codec.mjs';
import {scriptBodySpecs,scriptBodyNativeSources} from '../proof/task/script-body-specs.mjs';
import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
import {nativeOpcodeSpecs} from './task-native-opcode-specs.mjs';
import {proveOpcodeBinding} from './task-opcode-source.mjs';
import {proveNativeOpcode} from './task-native-opcode-source.mjs';
import {proveNativeWaitSources} from './task-native-wait-source.mjs';
import {proveTaskNativeC8} from './task-native-c8-source.mjs';
import {proveTaskNativeA7} from './task-native-clear-opcode-source.mjs';
import {proveTaskNativeA3} from './task-native-input-wait-opcode-source.mjs';
import {proveTaskNative13} from './task-native13-source.mjs';
import {proveTaskNativeAudioOpcode} from './task-native-audio-opcode-source.mjs';
import {proveTaskNativeRandomOpcode} from './task-native-random-opcode-source.mjs';
import {proveTaskNative7C} from './task-native-8e36-opcode-source.mjs';
import {proveSelectionOpcode} from './task-native-selection-roots-opcode-source.mjs';
import {proveModalOpcode} from './task-native-modal-opcode-source.mjs';
import {proveLocalBodyFlow} from '../proof/task/script-body-local-flow.mjs';
import {proveScriptChildFlow,childSourceAnchors} from './task-script-child-source.mjs';

const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export async function proveScriptBodyDependencies(bytes){
 const opcodes=[...new Set(scriptBodySpecs.flatMap(s=>s.instructions.map(i=>i.opcode)))].sort((a,b)=>a-b);
 const nativeIds=[...new Set(scriptBodySpecs.flatMap(s=>s.instructions.filter(i=>i.opcode===0x58).map(i=>i.operand)))].sort((a,b)=>a-b);
 const handlers=[];
 for(const opcode of opcodes){
  const spec=taskOpcodeSpecs.find(s=>s.opcode===opcode);
  if(!spec)throw Error('Unproved body opcode');
  handlers.push(await proveOpcodeBinding(bytes,spec));
 }
 const natives=[];
 for(const id of nativeIds){const s=nativeOpcodeSpecs.find(s=>s.id===id),fixed=scriptBodyNativeSources.find(s=>s.id===id);
  if([0x72,0xBF,0x74,0xD7].includes(id)){const p=await proveModalOpcode(bytes,id);
   if(fixed?.target!==parseInt(p.admitted_targets[0].target.replace(':',''),16)||!equal(fixed.anchors,p.admitted_targets[0].anchors.map(a=>({address:parseInt(a.entry.replace(':',''),16),bytes:a.machine_bytes.match(/../g).map(v=>parseInt(v,16))}))))throw Error('Unproved modal body native');
   natives.push(p);continue;
  }
  if(id===0x9A||id===0x1A){const p=await proveSelectionOpcode(bytes,id);
   if(fixed?.target!==parseInt(p.admitted_targets[0].target.replace(':',''),16)||!equal(fixed.anchors,p.admitted_targets[0].anchors.map(a=>({address:parseInt(a.entry.replace(':',''),16),bytes:a.machine_bytes.match(/../g).map(v=>parseInt(v,16))}))))throw Error('Unproved selection body native');
   natives.push(p);continue;
  }
  if(id===0x7C){const p=await proveTaskNative7C(bytes);
   if(fixed?.target!==0x808E36||!equal(fixed.anchors,p.admitted_targets[0].anchors.map(a=>({address:parseInt(a.entry.replace(':',''),16),bytes:a.machine_bytes.match(/../g).map(v=>parseInt(v,16))}))))throw Error('Unproved body7C');
   natives.push(p);continue;
  }
  if(id===0x3E){
   const p=await proveTaskNativeRandomOpcode(bytes);
   if(fixed?.target!==0x80C51F||!equal(fixed.anchors,p.admitted_targets[0].anchors.map(a=>({address:parseInt(a.entry.replace(':',''),16),bytes:a.machine_bytes.match(/../g).map(v=>parseInt(v,16))}))))throw Error('Unproved body Native3E');
   natives.push(p);continue;
  }
  if(id===0x63){
   const p=await proveTaskNativeRandomOpcode(bytes,0x63);
   if(fixed?.target!==0x80C560||!equal(fixed.anchors,p.admitted_targets[0].anchors.map(a=>({address:parseInt(a.entry.replace(':',''),16),bytes:a.machine_bytes.match(/../g).map(v=>parseInt(v,16))}))))throw Error('Unproved body Native63');
   natives.push(p);continue;
  }
  if(id===0x13){
   const p=await proveTaskNative13(bytes);
   if(fixed?.target!==0x809BA0||!equal(fixed.anchors,p.admitted_targets[0].anchors.map(a=>({address:parseInt(a.entry.replace(':',''),16),bytes:a.machine_bytes.match(/../g).map(v=>parseInt(v,16))}))))throw Error('Unproved body Native13');
   natives.push(p);continue;
  }
  if(id===0x4C){
   const p=await proveTaskNativeAudioOpcode(bytes);
   if(fixed?.target!==0x80C46E||!equal(fixed.anchors,p.admitted_targets[0].anchors.map(a=>({address:parseInt(a.entry.replace(':',''),16),bytes:a.machine_bytes.match(/../g).map(v=>parseInt(v,16))}))))throw Error('Unproved body Native4C');
   natives.push(p);continue;
  }
  if(id===0xA7){
   const p=await proveTaskNativeA7(bytes);
   if(fixed?.target!==0x80FF79||!equal(fixed.anchors,p.admitted_targets[0].anchors.map(a=>({address:parseInt(a.entry.replace(':',''),16),bytes:a.machine_bytes.match(/../g).map(v=>parseInt(v,16))}))))throw Error('Unproved body A7 native');
   natives.push(p);continue;
  }
  if(id===0xA3){
   const p=await proveTaskNativeA3(bytes);
   if(fixed?.target!==0x80F953||!equal(fixed.anchors,p.admitted_targets[0].anchors.map(a=>({address:parseInt(a.entry.replace(':',''),16),bytes:a.machine_bytes.match(/../g).map(v=>parseInt(v,16))}))))throw Error('Unproved body A3 native');
   natives.push(p);continue;
  }
  if(id===0xC8){
   const p=await proveTaskNativeC8(bytes);
   if(fixed?.target!==0x80FEC1||!equal(fixed.anchors,p.admitted_targets[0].anchors.map(a=>({address:parseInt(a.entry.replace(':',''),16),bytes:a.machine_bytes.match(/../g).map(v=>parseInt(v,16))}))))throw Error('Unproved body C8 native');
   natives.push(p);continue;
  }
  if(id===0x9F){
   const wait=await proveNativeWaitSources(bytes),p=wait.proofs[1];
   if(fixed?.target!==0x80C401||!equal(fixed.anchors,p.anchors.map(a=>({address:parseInt(a.entry.replace(':',''),16),bytes:a.machine_bytes.match(/../g).map(v=>parseInt(v,16))}))))throw Error('Unproved body wait native');
   natives.push({...p,admitted_targets:[{id:0x9F,target:'80:C401',anchors:p.anchors,windows:wait.windows.filter(w=>w.entry==='80:C401')}],
    parts:[...p.parts,{source_contract:'analysis/render-task-native-wait.json',windows:wait.windows,proof:wait.proofs[2]}]});
   continue;
  }
  if(!s||!fixed||fixed.target!==s.entry||!equal(fixed.anchors,s.anchors.map(a=>({address:a.start,bytes:a.hex.match(/../g).map(v=>parseInt(v,16))}))))throw Error('Unproved body native');
  natives.push(await proveNativeOpcode(bytes,s));}
 return {rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',handlers,natives,
  scope:'Shared renewed original handlers, actual Native58 leaf/whole-actions/FEC1/resume and separate Native9F yield/observed readiness/native resume. Body contracts reference these proofs once; no whole Task/scene/frame evidence.'};
}
export async function proveScriptBody(bytes,spec){
 if(!scriptBodySpecs.includes(spec))throw Error('Unproved body descriptor');
 const tailBytes=spec.fetchTail===null?0:1,offset=cpuToOffset(spec.scriptEntry,bytes.length),raw=bytes.subarray(offset,offset+spec.bytecode.length+2+tailBytes);
 for(let n=0;n<raw.length;n++)if(cpuToOffset(spec.scriptEntry+n,bytes.length)!==offset+n)throw Error('Body ROM address drift');
 if(spec.fetchTail===null&&((spec.scriptEntry+2+spec.bytecode.length)&65535)!==0)throw Error('Unproved external following highbyte');
 if(taskHash(raw)!==spec.sourceHash||!raw.equals(Buffer.from([...spec.header,...spec.bytecode,...(tailBytes?[spec.fetchTail]:[])])))throw Error('Original body byte drift');
 const body=raw.subarray(2,2+spec.bytecode.length),decoded=decodeScript(body);
 const instructions=decoded.instructions.map(({pc,opcode,operand,length,flow})=>({pc,opcode,operand,length,flow}));
 if(!decoded.fullyCovered||!equal(instructions,spec.instructions)||!equal(decoded.edges,spec.edges)
  ||!Buffer.from(encodeScript(decoded)).equals(body)
  ||(spec.localBody?instructions.some(i=>i.opcode===0x52):decoded.edges.some(e=>e.to<=e.from)||instructions.some(i=>[0x4C,0x50,...(spec.scriptChildBody?[]:[0x52])].includes(i.opcode)))
  ||instructions.some(i=>i.flow==='end'&&i.opcode!==0x56))throw Error('Unproved body control flow');
 const path=`analysis/render-task-script-opcode-${spec.id.toString(16).padStart(3,'0')}.json`;
 const source=JSON.parse(await readFile(path)),original=source.proofs?.[0];
 if(source.rom_sha256!==taskRomHash||original.script_id!==spec.id||original.script_header!==cpuLabel(spec.scriptEntry))throw Error('Body ID source drift');
 for(const a of original.anchors){const off=cpuToOffset(parseInt(a.entry.replace(':',''),16),bytes.length);
  if(bytes.subarray(off,off+2).toString('hex').toUpperCase()!==a.machine_bytes)throw Error('Body original metadata drift');}
 const word=a=>bytes.readUInt16LE(cpuToOffset(a,bytes.length));
 if(((word(0x82DB28+spec.id)&255)*65536+word(0x82DED1+2*spec.id))!==spec.scriptEntry
  ||(word(0x82E9CC+spec.id)&255)!==spec.argumentBytes||(word(0x82E623+spec.id)&255)!==spec.returnBytes)throw Error('Body table drift');
 const romReads=spec.romReads.map(r=>{
  if(word(r.address)!==r.value)throw Error('Body original table drift');
  return {entry:cpuLabel(r.address),machine_bytes:Buffer.from([r.value&255,r.value>>>8]).toString('hex').toUpperCase()};
 });
 if(!spec.sourceRomGuards&&instructions.some(i=>i.opcode===0x58&&i.operand===13)){
  if(spec.id===0xFC&&spec.c8Observations){
   if(!equal(instructions.map(i=>i.opcode),[0x34,0,0xBA,0x58,0xBC,0,0x14,0xC0,0,0,0,0,0x58,0,0x16,0x58,0x56])
    ||romReads.length!==1||spec.romReads[0].address!==0x8DB030)throw Error('Unproved original FC local WORD lookup');
  }else if(spec.id===0x6F){
   if(!equal(instructions.map(i=>i.opcode),[0x34,0,0xBA,0x58,0xBC,0,0x16,0x58,0x56])||romReads.length!==3
    ||!equal(spec.romReads.map(r=>r.address),[0x8DB030,0x8DB020+5824,0x8DB020+5978]))throw Error('Unproved Native0D local WORD lookup');
  }else
  if(!equal(instructions.map(i=>i.opcode),[0,0x14,0x58,0x56])||romReads.length!==1
   ||spec.romReads[0].address!==0x8DB020+instructions[1].operand)throw Error('Unproved Native13 static lookup');
 }else if(!spec.sourceRomGuards&&romReads.length&&!instructions.some(i=>i.opcode===0x58&&i.operand===0xD2))throw Error('Unexpected body table');
 let childContract={};
 if((spec.id===0xD1)!==!!spec.recordPropertyChild)throw Error('Unproved Parent0D1 source ownership flags');
 if([0x15F,0x164].includes(spec.id)!==!!spec.parentWaitAliasChild)throw Error('Unproved parent alias source ownership flags');
 if((spec.id===0x28C)!==!!spec.parentWaitAddChild)throw Error('Unproved parent add source ownership flags');
 if((spec.id===0x1A5)!==!!spec.recordAndWaitBody)throw Error('Unproved record AND body source ownership flags');
 if((spec.id===0x3A2)!==!!spec.propertyPairBody)throw Error('Unproved property pair source ownership flags');
 if(spec.propertyPairBody&&(!spec.modalBody||!spec.sourceRomGuards||spec.scriptChildBody||spec.localBody||spec.argumentBytes!==0||spec.returnBytes!==0
  ||!equal(spec.header,[0,6])||spec.bytecode.length!==45||instructions.length!==18
  ||!equal(instructions.map(i=>[i.pc,i.opcode,i.operand]),[[0,0x14,5565],[3,0x14,2226],[6,0x58,0x42],[8,0x14,5026],[11,0x14,2226],
   [14,0x58,0x42],[16,0x7E,null],[17,0x44,44],[20,0x14,5432],[23,0x14,5565],[26,0x58,0x74],[28,0x14,5432],[31,0x14,5026],
   [34,0x58,0x74],[36,0x14,2226],[39,0x14,560],[42,0x58,0x74],[44,0x56,null]])))throw Error('Unproved whole original3A2 property pair');
 if(spec.recordAndWaitBody&&(!spec.audioWait||!spec.audioObservations||!spec.sourceRomGuards||spec.scriptChildBody||spec.localBody
  ||spec.argumentBytes!==2||spec.returnBytes!==0||!equal(spec.header,[2,8])||spec.bytecode.length!==67||instructions.length!==36
  ||!equal(instructions.map(i=>[i.pc,i.opcode,i.operand]),[[0,0x2C,0],[2,0x14,1596],[5,0x58,0xBB],[7,0xBA,null],[8,0x2C,1],[10,0,1],[12,0x7E,null],
   [13,0xBE,null],[14,2,1],[16,0,128],[18,0x7E,null],[19,0xBE,null],[20,0x84,null],[21,0x7E,null],[22,0x44,63],
   [25,0x14,5432],[28,0x14,560],[31,0x58,0x74],[33,0,128],[35,0x14,1596],[38,0x58,0xD],[40,0xA,254],[42,0x14,1596],[45,0x58,0x4B],
   [47,0,3],[49,0,255],[51,0,10],[53,0xC2,null],[54,0x58,0x4C],[56,0,60],[58,0,1],[60,0x58,0x9F],[62,0xBC,null],[63,0xC2,null],[64,0x58,0x5B],[66,0x56,null]])))
  throw Error('Unproved whole original1A5 record gate/set/OR/AND/audio/count60/END');
 if(spec.scriptChildBody){const calls=instructions.filter(i=>i.opcode===0x52),child=scriptBodySpecs.find(s=>s.id===spec.childId);
  if(calls.length!==1||calls[0].operand!==child?.id||![0x4B,0x33D,0x10E,0xC8,0x6F,0xD2].includes(child.id)||child.returnBytes!==0
   ||child.scriptChildBody||!spec.parentWaitChild&&instructions.some(i=>i.opcode===0x58&&i.operand===0x9F))throw Error('Unproved child composition family');
  if(spec.parentWaitChild&&!spec.parentWaitAddChild&&(![0x15C,0x15E,0x15F,0x164].includes(spec.id)||child.id!==0x4B||spec.argumentBytes!==2||spec.returnBytes!==0
   ||!equal(spec.header,[5,14])||!spec.random63Observations||!spec.c8Observations||!spec.originalTextSources||!spec.sourceRomGuards
   ||spec.bytecode.length!==(spec.id===0x15C?93:spec.parentWaitAliasChild?154:153)||instructions.length!==(spec.id===0x15C?49:77)
   ||!equal(instructions.slice(0,19).map(i=>[i.pc,i.opcode,i.operand]),[[0,0x2C,0],[2,0x58,0x63],[4,0,3],[6,0x7E,null],[7,0x34,1],
    [9,0xC0,null],[10,0xC0,null],[11,0xC2,null],[12,0x58,0xD2],[14,0,1],[16,0xBA,null],[17,0x58,0x9F],
    [19,0xBC,null],[20,0xC2,null],[21,0x58,0x49],[23,0xC0,null],[24,0,16],[26,0x58,0x9F],[28,0xBC,null]])
   ||!equal(instructions.filter(i=>i.opcode===0x58&&i.operand===0x9F).map(i=>i.pc),[17,26])
   ||calls[0].pc!==(spec.id===0x15C?67:98)||!equal(instructions.slice(-3).map(i=>[i.opcode,i.operand]),[[0xC2,null],[0x58,0xB9],[0x56,null]])))
   throw Error('Unproved own whole parent9F/Child4B family');
  if(spec.parentWaitAddChild&&(!spec.parentWaitChild||spec.id!==0x28C||child.id!==0x4B||spec.argumentBytes!==8||spec.returnBytes!==0
   ||!equal(spec.header,[6,14])||spec.bytecode.length!==75||instructions.length!==40||calls[0].pc!==56
   ||!spec.sourceRomGuards||!spec.c8Observations||!spec.originalTextSources
   ||!equal(instructions.map(i=>[i.pc,i.opcode,i.operand]),[[0,0x2C,0],[2,0x34,1],[4,0x34,3],[6,0x2C,5],[8,0,4],[10,0xC0,null],[11,0xC2,null],[12,0x58,0xD2],
    [14,0xC0,null],[15,0,128],[17,0x58,0x9F],[19,0xBC,null],[20,0x16,3],[22,0x58,0x99],
    ...Array.from({length:8},(_,n)=>[[24+n*4,2,5],[26+n*4,0x58,0x7B]]).flat(),[56,0x52,0x4B],
    [59,0x14,400],[62,0x16,1],[64,0xC0,null],[65,0,3],[67,0,28],[69,0,2],[71,0xBA,null],[72,0x58,0xC8],[74,0x56,null]])))
   throw Error('Unproved own whole28C single event/eight fresh adds/child/text suffix');
  if(spec.parentWaitAliasChild&&(!spec.parentWaitChild||!equal(instructions.filter(i=>i.pc>=101).map(i=>[i.pc,i.opcode,i.operand]),[
   [101,0x16,1],[103,0,1],[105,0xAA,null],[106,0x44,116],[109,0,spec.id===0x15F?70:150],[111,0x58,0x99],[113,0x48,150],
   [116,0x16,1],[118,0,1],[120,0xAA,null],[121,0x44,131],[124,0,spec.id===0x15F?80:170],[126,0x58,0x99],[128,0x48,150],
   [131,0x16,1],[133,0,2],[135,0xAA,null],[136,0x44,146],[139,0,spec.id===0x15F?90:180],[141,0x58,0x99],[143,0x48,150],
   [146,0,spec.id===0x15F?100:200],[148,0x58,0x99],[150,0xC2,null],[151,0x58,0xB9],[153,0x56,null]])))
   throw Error('Unproved original repeated equality1 and fresh alias suffix');
  if(spec.recordPropertyChild&&(!spec.scriptChildBody||!spec.modalBody||!spec.c8Observations||!spec.originalTextSources||!spec.nativeA3Observations||!spec.sourceRomGuards
   ||spec.id!==0xD1||child.id!==0x4B||spec.argumentBytes!==2||spec.returnBytes!==0
   ||!equal(spec.header,[2,14])||spec.bytecode.length!==62||instructions.length!==29||calls[0].pc!==33
   ||!equal(instructions.map(i=>[i.pc,i.opcode,i.operand]),[[0,0x34,0],[2,0x16,0],[4,0x14,2226],[7,0x58,0x42],[9,0x44,33],
    [12,0,1],[14,0x14,529],[17,0xC0,null],[18,0,3],[20,0,21],[22,0,2],[24,0,5],[26,0x58,0xC8],[28,0x58,0xA3],[30,0x48,61],
    [33,0x52,0x4B],[36,0x14,2226],[39,0x16,0],[41,0x58,0x74],[43,0,1],[45,0x14,528],[48,0xC0,null],[49,0,3],[51,0,16],
    [53,0,2],[55,0,6],[57,0x58,0xC8],[59,0x58,0xA3],[61,0x56,null]])))throw Error('Unproved Parent0D1 own full property/child/text source');
  if(child.id===0x10E&&(child.argumentBytes!==2||!equal(child.header,[2,14])||instructions.length!==3
   ||![0,0x14].includes(instructions[0].opcode)||instructions[1]!==calls[0]||instructions[2].opcode!==0x56
   ||spec.argumentBytes!==0||spec.returnBytes!==0||!equal(spec.header,[0,2])))throw Error('Unproved child10E parent source');
  if(child.id===0xC8&&(child.argumentBytes!==6||!equal(child.header,[6,4])||instructions.length!==5
   ||instructions.slice(0,3).some(i=>![0,0x14].includes(i.opcode))||instructions[3]!==calls[0]||instructions[4].opcode!==0x56
   ||spec.argumentBytes!==0||spec.returnBytes!==0||!equal(spec.header,[0,6])))throw Error('Unproved child0C8 parent source');
  const branchCountdownParent=[0x1CF,0x1D2].includes(spec.id),callIndex=instructions.indexOf(calls[0]),record=child.id===0x6F?instructions[callIndex-1]?.operand:null;
  if([0x6F,0xD2].includes(child.id)&&(child.argumentBytes!==2||spec.argumentBytes!==2||spec.returnBytes!==0
   ||!equal(child.header,child.id===0x6F?[2,4]:[1,4])||instructions[0].opcode!==0x2C||instructions[0].operand!==0
   ||instructions.at(-1).opcode!==0x56||(branchCountdownParent?!equal(instructions.slice(callIndex+1).map(i=>[i.opcode,i.operand]),[[0xC2,null],[0x58,0x5B],[0x56,null]]):instructions.at(-2)!==calls[0])
   ||(child.id===0x6F?(![0xB7,0x1CF,0x1D2].includes(spec.id)||instructions[callIndex-1].opcode!==0x14||record!==(spec.id===0x1D2?5824:5978)
    ||(branchCountdownParent?instructions.length!==(spec.id===0x1CF?57:45):instructions.length!==4)):
    ![0x161,0x18B,0x2EE].includes(spec.id)||instructions.at(-3).opcode!==0xC2)
   ||!equal(spec.header,[branchCountdownParent?5:1,spec.id===0xB7||spec.id===0x2EE?2:14])))throw Error('Unproved countdown child parent source');
  const childProof=await proveScriptBody(bytes,child),flow=await proveScriptChildFlow(bytes);
  childContract={child_flow_contract:'analysis/render-task-script-child-flow.json',child_flow_sha256:taskHash(Buffer.from(JSON.stringify(flow))),
   ...(spec.parentWaitAddChild?{child_parent_wait_contract:{kind:'parent-add',caller_header:[6,14],caller_argument_bytes:8,local_offsets:[0x13,0x14,0x16,0x18],
    parent_waits:[{pc:17,next_pc:19,mask:128,count:0}],postrun_export:'prepareTaskScriptBodyParentPostrun',readiness_entry:'80:C1CA',
    ownership:'Own real wholeC1CA private C1D8/C20A parent owner, actual observedC20B/wholeC1D9 then separately observed wholeC1CA. Explicit fresh actualDBR C62+slot eventWORD0/0080; real maskclear/F509 metadata2/PHA128, never countdown128 or synthetic frame/cursor/return. Whole allocated4B and fresh own text/END suffix.'},
    child_parent_add_contract:{argument_addresses:[0x800,0x802,0x804,0x806],argument_widths:[1,2,2,1],local_offsets:[0x13,0x14,0x16,0x18],
     d2_arguments:['BYTEcaller',0,4],reward_pc:22,add_pcs:[26,30,34,38,42,46,50,54],add_target:'80:CDB2',add_field:'7E:3C11',
     add_native_contract:'analysis/render-task-native-opcode-cdb2.json',child_pc:56,parent_text_pc:72,c8_arguments:[2,2,28,3,0,'freshWORDlocal1',400],
     ownership:'All four full callerWORDs are actually read and popped; only first/fourth store BYTE. Native99 gets fresh fullWORDlocal3 before eight distinct BYTE-local5 loads/WORDpushes and actual Native7B fullDP00/fresh7E3C11 WORD ADC stores. Each add refetches prior wrapped physicalWORD and retains source ADC flags; no aggregate arithmetic/cached source or saturation. Then whole52/4B/END/F495, freshly read WORDlocal1 and own seven C8 pops with lifetime400/flags0, own original text and typedIO/waits, own END reads actual808/809. No B9 release in this original parent, no inferred event writer/time/scene/frame.'}}:{}),
   ...(spec.parentWaitChild&&!spec.parentWaitAddChild?{child_parent_wait_contract:{caller_header:[5,14],caller_argument_bytes:2,local_offsets:[0x13,0x14,0x16],
    parent_waits:[{pc:17,next_pc:19,mask:1,count:1},{pc:26,next_pc:28,mask:16,count:0}],
    postrun_export:'prepareTaskScriptBodyParentPostrun',readiness_entry:'80:C1CA',event_source:'Fresh independently observed actualDBR C62+parentSlot WORD; no timer or status writer inferred.',
    native_ids:[0x63,0xD2,0x9F,0x49,0xC8,0x99,0xB9],
    ownership:'Whole originalC1CA produces actual parent C1D8/C20A before prefix. Own BYTEargument0, original Native63/AND3/WORDlocal1, D2 actualthreeWORD arguments,9F mask1/count1. Private committed parent owner first consumes real savedC1D8 via observedC20B and wholeC1D9 epilogue. Only then separately observed wholeC1CA writes actualcursor/actualcountdown0 and reaches actualF509/parentBC. Own49 then9F uses real poppedmask0010/count0; no countdown16. Same actualpostrun/epilogue precedes independently observed eventstatus C62+slot; blocked entries perform real visit/cursor/outerreturn and zero body handlers; observed bit0010 clears actualwaitmask and performs originalF509. Own random WORDbranches set WORDlocal3 and actualC8 seven pops with original text/lifetime180/flags2048. Only then original52 allocates whole count5Child4B, realchildEND/release/F495, own99 reward and B9 release/end. Local/stack/return/pointer/event bytes stay fresh. No Rootwait shortcut borrowed from child or C1F9, no cursor/countdown/frame seeds or automatic status/device/time/scene/frames.'}}:{}),
   ...(spec.parentWaitAliasChild?{child_parent_alias_contract:{frame:0x600,initial_operand_s:0x615,argument_address:0x616,result_address:0x618,
    saved_id_high:0x60A,repeated_comparison:[1,1,2],nominal_texts:spec.id===0x15F?[491,492,493,494]:[495,496,497,498],
    nominal_rewards:spec.id===0x15F?[100,70,90,100]:[200,150,180,200],alias_reward:spec.id===0x15F?80:170,
    alias_c8_arguments:[0,21,10,3,2048,180,180],alias_glyphs:69,alias_release_slot:8,
    ownership:'Independent observed caller frame600/operandS615, argument616/617 and END result618/619. Actual argument/operand/local/saved-ID writes alias. D2 pops originalBYTE16 but its Local-PHA-high overwrites localBYTE0. First dup writes localWORD1=1; own49 pops0. Eventmask push writes localWORD1=16. Text comparisons read successive16,0,1 and all fail; default text literal is stored then lifetime180 PUSH overwrites localWORD3 before fresh L16. Flags high overwrites localBYTE0=8; saved-ID-high overwrites first pushedC8 field2 to0. Actual seven pops therefore use field0/text180/lifetime180, original69glyph text and explicit independent geometry/IO/waits. Whole allocated4B returns before first money L16 reads180, immediatePUSH1 writes localWORD1=1, firstAA false, second freshL16 reads1 and secondAA true. Reward80/170 is reachable in whole chain; original repeated comparison1 stays unchanged. Fresh B9 pops8; no alias-disjointness, unreachable-branch or original allocated-caller assertion.'}}:{}),
   ...(spec.recordPropertyChild?{child_property_contract:{caller_local_offset:0x13,caller_argument_bytes:2,comparison_word:2226,
    getter:{id:0x42,target:'80:9DAE',word_pops:2,result_pushed:true,argument_order:['comparison2226','freshCallerWORD'],record_table:'8D:B020',property_offset:3},
    equal:{pcs:[0,2,4,7,9,12,14,17,18,20,22,24,26,28,30,61],c8_arguments:[5,2,21,3,0,529,1],glyphs:25},
    different:{pcs:[0,2,4,7,9,33,36,39,41,43,45,48,49,51,53,55,57,59,61],c8_arguments:[6,2,16,3,0,528,1],glyphs:19,
     setter:{id:0x74,target:'80:CBF7',word_pops:2,result_pushed:false,argument_order:['freshCallerWORD','property2226']}},
    ownership:'Own fullWORD argument stored/pop to localWORD0. Native42 actual DP00=2226 and DP02=fresh localWORD record; fresh original fullWORD8DB020+X pointer and physical7E0003+pointer property WORD; zero pointer skips field. ResultFFFF only exact WORD equality. Equal skips52/74 and executes own529/C8/A3. Different executes full allocated Child4B count5/actualC20B/C1D9/whole observedC1CA decrements/freshEND/release/F495, then freshly loads own localWORD0 and actual Native74 DP00=record,DP02=2226; fresh original pointer, physicalWORDproperty write or null skip. Own528/C8/A3 follows. No cached pointer/property/local/return/readiness. Both text/input ledgers belong to the actual parent segment, child audio only to actual final readiness; no device/time/scene/frame inference.'}}:{}),
   child_id:child.id,child_call_pc:calls[0].pc,parent_resume_pc:calls[0].pc+3,child_argument_bytes:child.argumentBytes,child_frame_bytes:(child.header[0]+child.header[1]+0x17)&255,
   child_return_bytes:0,child_source_contract:`analysis/render-task-${child.id===0x4B?'script-bodies-audio-wait':child.id===0x10E?'script-bodies-input-wait':child.id===0xC8?'script-bodies-modal':child.id===0x6F?'script-bodies-wait':child.id===0xD2?'script-bodies-release':'script-bodies'}.json`,
   child_source_proof_sha256:taskHash(Buffer.from(JSON.stringify(childProof))),child_anchors:childSourceAnchors(bytes,child),
   ...([0x6F,0xD2].includes(child.id)?{child_countdown_contract:{frame_bytes:child.id===0x6F?29:28,
    argument:record,local_offset:0x13,local_width:child.id===0x6F?2:1,
    count:child.id===0x6F?1:2,mask:1,prefix_handlers:child.instructions.findIndex(i=>i.opcode===0x58&&i.operand===0x9F)+1,
    native_ids:childProof.native_ids,...(child.id===0x6F?{record_pointer:child.romReads.find(r=>r.address===0x8DB020+record)}:{}),
    ...(branchCountdownParent?{parent_branch_contract:{native_ids:[0x28,...(spec.id===0x1CF?[0x4F]:[]),0x50,0xCC,0xC8,0x5B],
     full_word_getter:'Native28/80D18A reads fresh actualDBR0CC2 WORD and F509 pushes it. Native4F/A959 or50/A963 pops full actual WORD index, reads actualDBR0E28/0E80+X, retains two actual LSRs and F508/F509/resultPHA. Original9A returns FFFF only when logical quotient exceeds own unsigned threshold540/490 or515;1CF ANDs both independent predicates.',
     property_getter:'Parent C2 freshly WORDreads and BYTE masks local0 before NativeCC/80D1CA fullWORD index/read actualDBR150A+X. BA/34 create actual localWORD3, fullWORD equalities choose original435..439 or435..438 and actual localWORD1. Actual NativeC8 seven WORDpops use those locals and caller-specific original text/font/stream sources with one independently frozen IO/wait ledger.',
     suffix:'Both branches still call own child6F (5978 for1CF,5824 for1D2). Only after actual childEND/release/F495 does fresh C2 supply Native5B/A91D argument; it writes actualDBR1350+X=FFFF with real typedF508/F509 and zeroresult before own END. Getter/parameter/return aliases remain fresh; no cached property/condition/selector/pointer/child result.'}}:{}),
    ownership:'Actual parent BYTE argument store/pop and either own constant WORD record or zero-extended localBYTE0 push. Script52 copies two bytes into the allocated child; child6F localWORD0 or child0D2 localBYTE0 actually stores/pops them. Native9F actual mask1/count1 or2 suspends under the actualC20A owner. Observed kept-child C20B consumes the earlier realC1D8, runs C1D9 epilogue; fresh wholeC1CA tail/cursor/countdown/F509 resumes, never supplied counter or cursor stores. Child6F actual0D uses its fresh original recordWORD pointer and physicalBYTE OR2. Child0D2 writes actualDBR1D6B=FFFF then B9/AA4C actual localBYTE argument, fresh node count/linked free head/list shifts, own innerJSR/RTS and F508/F509 with zero return bytes. ChildEND consumes the fresh split heap header, actualC20B releases exact child/task links and F495 restores parent before own END. Parent161/18B actualC8 executes before allocation under one immutable original IO/wait ledger with individually pinned original473/474 text sources. Synthetic pre-entry caller/list/field data and independently observed C20B/C1CA transitions remain explicit; no timing/scene/event writer or initialized allocation inferred.'}}:{}),
   ...(child.id===0x10E?{child_input_contract:{argument:instructions[0].operand,frame_bytes:39,local_offset:0x13,
    state_byte:'7E:2DE6',text_branches:[{states:[1,2],selector:322,glyphs:55},{states:[3,255],selector:321,glyphs:26}],
    native_ids:childProof.native_ids,
    ownership:'Actual two-byte argument copy into allocated child operand stack, actual localWORD0 store/pop and both source branches. State0 skips C8/A3. Other states use original C8 seven actualWORDpops, original text/window/geometry sources and fresh F508/F509 before original A3. Child-only frozen IO/wait/input chronology; A3 counter samples and observed control writer remain explicit independently synthetic data, not elapsed time or task9F/readiness. Own Native56/80CC97 pops the actual localWORD, writes unmasked7E2DE2 and actualDBR1CE9=7FFF. END freshly reads split-next-heap-header high/low at frame+39/+40. Actual release/F495 zero childreturn then own parentEND.'}}:{}),
   ...(child.id===0xC8?{child_modal_contract:{arguments:instructions.slice(0,3).map(i=>i.operand).reverse(),frame_bytes:33,local_offsets:[0x13,0x15,0x17],
    native_ids:childProof.native_ids,record_pointer:child.romReads.find(r=>r.address===0x8DB020+instructions[2].operand),
    ownership:'Actual six-byte Script52 copy into allocated child stack, three real localWORD stores/pops. Actual72 normal menu/typedF508/F509 then fullWORD BF payment/borrow or own cancel/nofund text branches. Success real80/CDCF storeFFFF to actualDBR1D63 and0D/CBB3 fresh original fullindex record pointer/physicalBYTE OR80. Each fixed parent retains own record/price/text operands; all newly reached original text/record ROM words extend the existing standalone0C8 source without removing old owners. Child-only independently supplied immutable MMIO/wait/input; no implicit fields/devices, cached menu choice, price/result/pointer/high or return assumptions. Fresh actual heapheader at frame+33/+34, real release/F495/zeroChildreturn and own parentEND. Reset3030/zeroVoice alternateRTS remain explicit unsupported source boundaries.'}}:{}),
   child_data_contract:'Original C1CA produces its actual cursor/JSRbody/rawC1D8 and innerF378/rawC20A before parentF390. Real52 copies its own child arguments and creates actual heap/frame/task links/FFFF/rawF494. C20B enters that exact child. A child9F yield uses actual kept-child/C1D9 epilogue and independently observed wholeC1CA readiness with original cursor stores/countdowns. Immediate children execute their whole typed original native/body path on this observed C20B; no child9F/readiness is invented. ChildEND result comes from the fresh split-next-heap-header after all actual argument pops, never a substituted result. C20B releases the exact child heap/free/list/tail and clears parentFFFF, consumes actualrawF494/F495, fresh parentPC/ID/bank/stream and zero childreturn before parentEND. Each committed segment has a private owner brand; missing source/high/observations/alias/budget faults preserve that segment, prior commits remain. No caller/time/readiness/scene initialization inferred.'};
 }
 return {entry:spec.scriptChildBody?'80:C1CA':'80:F390',script_id:spec.id,script_header:cpuLabel(spec.scriptEntry),native_binding:false,
  local_source_complete:true,body_control_flow_complete:true,full_graph_closed:false,full_task_binding:false,
  global_stack_minimum:null,external_return_assumptions:0,
  original_id_contract:path,original_id_proof_sha256:taskHash(Buffer.from(JSON.stringify(original))),
  body_window:{entry:cpuLabel(spec.scriptEntry),machine_bytes:raw.toString('hex').toUpperCase(),sha256:spec.sourceHash,
   header_bytes:2,bytecode_bytes:spec.bytecode.length,following_opcode_highbyte:spec.fetchTail,
   ...(tailBytes?{}:{following_highbyte_source:{entry:cpuLabel(spec.scriptEntry+2+spec.bytecode.length),owner:'7E:0000',source:'fresh physical workspace after prior native writes; not ROM',width:1}})},
  instructions,edges:decoded.edges,rom_reads:romReads,...childContract,
  ...(spec.propertyPairBody?{property_pair_contract:{header:[0,6],argument_bytes:0,result_address:0x800,
   query_pcs:[6,14],query_target:'80:9DAE',query_arguments:[[2226,5565],[2226,5026]],
   pointers:[{address:0x8DC5DD,value:0x3A3F},{address:0x8DC3C2,value:0x31F2},{address:0x8DB250,value:0x3468}],
   fields:[0x7E3A42,0x7E31F5,0x7E346B],branch_pc:17,skip_pc:44,active_pc:20,
   store_pcs:[26,34,42],store_target:'80:CBF7',store_arguments:[[5565,5432],[5026,5432],[560,2226]],
   ownership:'Own whole3A2, both Native42 fullWORD queries executed before original WORD-AND/JZ; no short-circuit or BYTE equality. Fresh original fullindex/WORD pointers, actual propertyWORD/high compare to2226, true FFFF or false0000 with own resultPHA. Only both true execute three separate fresh Native74 fullWORD stores under own actual twoWORDpops/F508/F509/noPHA. Pointer/table/field/stack/return sources remain fresh, zero guards belong to renewed helper source only. Own END reads actual800/801, no caller argument or release/audio/menu/wait/device/scene/frame ownership inferred.'}}:{}),
  ...(spec.recordAndWaitBody?{record_and_contract:{header:[2,8],argument_bytes:2,byte_locals:[0x13,0x14],
   flag_record:1596,flag_pointer:{address:0x8DB65C,value:0x3A99},flag_word:0x7E3A9A,
   flag_getter:'80:CB2B',flag_getter_null_guard:false,gate:{pc:22,skip_pc:63,active_pc:25,set:1,clear:128},
   property_call:{pc:31,target:'80:CBF7',arguments:[560,5432],pointer:{address:0x8DB250,value:0x3468},word:0x7E346B},
   or_call:{pc:38,target:'80:CBB3',arguments:[1596,128]},
   and_call:{pc:45,target:'80:CBCB',arguments:[1596,65534],width:1,contract:'analysis/render-task-native-opcode-cbcb.json'},
   audio_call:{pc:54,arguments:['freshBYTElocal0',10,255,3],sound:{address:0x80C4BD,value:5}},
   wait:{pc:60,next_pc:62,mask:1,count:60,readiness_entry:'80:C1F9',postrun_owner:false},
   release:{pc:64,target:'80:A91D',argument:'freshBYTElocal0',word_base:0x801350,value:65535},end:{pc:66,result_address:0x802},
   ownership:'Own full callerWORD is popped before BYTE-local0 store; BB unconditionally reads full flagWORD/high then masks00FF. Original bit1 and inverted bit128 gate; no inferred null guard. Active74 stores own fullWORDproperty, then0D and4B separately refetch original pointer and physical flagBYTE, preserving flaghigh. SignedBYTE FE pushes FFFE; only DP02low masks field. Own Audio4C uses original soundWORD5 and separate physical APU/product observations. Manual observed outerRTS C20A, then60 independently observed real C1F9/C3C9 decrements59..0 and actualF509/metadata2/PHA1; no private parent/child owner, countdown seeds, elapsed time or occurrence inferred. Both branches freshly read BYTElocal0 for actual5B WORDFFFF and own END reads both argument-following result bytes.'}}:{}),
  ...(spec.localBody?{local_return_graph:proveLocalBodyFlow(instructions,{native9FResume:spec.localWaitBody===true}),
   local_return_contract:'Original4C/F442 saves actual continuation WORD to script-bank plus fresh frameD+5 pointer, then refetches D+5 before subtract2. Original50/F454 adds2 to actualD+5, stores, refetches pointer and reads both saved return bytes before F389 fetch. Runtime expected LIFO stack supplies no data: changed pointer ownership or returnWORD rejects atomically after actual handlers. Finite source-expanded call/return states, every helper instruction and ownEND required; no caller allocation, original initialized return area or scheduling inference.',
   local_data_contract:spec.localWaitBody?(spec.id===0x210?'Own210 header02-0A,99bytes/57instructions. LocalBYTE argument/slot, original B3/D2/coordinate queries/A9 callback creation, six actual9F yields, four ordered audio-helper calls255/192/128/64 with real localBYTE1/fresh Native4C arguments, no inferred callback execution; actual each50, thenB9release/END.':'Own2D0 header05-0E,132bytes/64instructions. C5 actual null/property1538 path, five sequential helpers with real localWORD1/count and localWORD3/signed C4..C0 arguments. Counts60/120/240/180/240; each9F/BC/NOT/50 leaves complement59..63, actual seven C8 arguments with original lifetimes240/180/240/300/120 and selectors59..63, own END.'):'Own29A header06-04,232bytes/103instructions. FullWORD Native57 reads7E3BBF; BA duplicates,34 stores local0. Exact unsigned equality0..9 selects one own localcall3, price300/700/1000/2000/3000/4000/5000/6000/7000/8000 and tokenD4..DD. Helper stores real price/text locals, original99 currency add/carry/high-wrap saturation,9A(D2),D7(selected token),D7(D3), actual50. Counter9 thenNative0D BYTEflag80 record1B66. All paths freshly reread counter57, increment WORDwrap,12 WORDstore before ownEND. Pinned actual ROM/metadata/highbytes and explicit synthetic observation ledger; all aliases remain fresh.'}:{}),
  ...(spec.localWaitBody?{local_wait_contract:'Native9F source edges remain actual yields, not direct fallthrough. Pending expected localReturn owners and cumulative call/return events are frozen into branded committed continuations, retained through blocked observedC1F9 entries and restored only after actual readiness/F509. Fresh D+5 and both saved WORD bytes are checked as admission before/after readiness and at suspension; these checks supply no execution data. Every local50 still performs actual fresh reads/fetch. Failure preserves the current segment; previously committed original yield effects remain. No timer, readiness writer, automatic parent occurrence or initialized return area inferred.'}:{}),
  ...(spec.sourceRomGuards?{dynamic_rom_ownership:'Actual fresh original WORD table/indirect lookup addresses and values must match this individually pinned set. Full native indices are retained; unproved pointer/argument aliases reject the private plan. BYTE D2 reads require their original low byte. Synthetic input paths only, no initialized original caller.'}:{}),
  word_sources:instructions.map(i=>({pc:i.pc,opcode_word:[cpuLabel(spec.scriptEntry+2+i.pc),cpuLabel(spec.scriptEntry+3+i.pc)],
   operand_word:i.length>1?[cpuLabel(spec.scriptEntry+3+i.pc),cpuLabel(spec.scriptEntry+4+i.pc)]:null,
   operand_highbyte_ignored:i.length===2})),
  shared_dependencies:'analysis/render-task-script-body-dependencies.json',
  ...(spec.random63Observations?{native63_contract:'analysis/render-task-native-opcode-c560.json',
   native63_edges:instructions.filter(i=>i.opcode===0x58&&i.operand===0x63).map(i=>({from:i.pc,to:i.pc+i.length,
    call:'zero actual WORDpops, originalC560/0100/0002, whole ownC560/PHP/SEP30/PLP/RTS, actualF508/F509/resultPHA and fresh body frame/PC/opcode',
    observations:'Three independently frozen PPU2137/213C/213D BYTEs per reached call on the same global originalPC/address/width/value ledger as audio. No range/mask/device/random/time/initialization inference; every late failure withholds the current segment.'})),
   mixed_device_contract:'Union of the individually source-proved Audio and PPU register/PC sets, one provider/access/work/output/IO ledger per independently committed segment. Sound/directory/cache/token/mix/state/Entity values remain fresh; no device simulation or assumed ready/time/motion/parent occurrence.'}:{}),
  ...(spec.randomObservations?{native3e_contract:'analysis/render-task-native-opcode-c51f.json',
   native3e_edges:instructions.filter(i=>i.opcode===0x58&&i.operand===0x3E).map(i=>({from:i.pc,to:i.pc+i.length,
    call:'one actual WORDpop, originalC51F/0201/0002, whole ownC51F/C560, actualF508/F509/resultPHA and fresh body frame/PC/opcode',
    observations:'One global frozen originalPC/address/width/value PPU2137/213C/213D BYTE stream across every reached attempt. No device/random/time/termination assumption; missing/reordered/unused observations or budget exhaustion reject the whole body.'})),
   random_data_contract:'Every original mask/random table WORD is individually pinned for this body; actual reached BYTE/WORD reads remain fresh under the whole Native3E contract. Mutable mix/state/Entity/field2A bytes and PPU samples are explicit physical synthetic observations, no originalcaller/initialization/Task/scene/frames.'}:{}),
  ...(spec.nativeA7Observations?{native_a7_contract:'analysis/render-task-native-opcode-ff79.json',
   native_a7_edges:instructions.filter(i=>i.opcode===0x58&&i.operand===0xA7).map(i=>({from:i.pc,to:i.pc+i.length,
    call:'zero actual WORDpops, originalFF79/0100/0000, whole ownFF79/FA3E/AD92, actual F508/F509/no PHA and fresh body frame/PC/opcode',
    observations:'A7 uses only the independently observed AF1F/ACAF records of its actual segment. Later C8 has new frozen records after committed9F/actual C1F9 countdown/readiness/real PEA-C20A resume. Multiple9F edges each require their own latest committed prefix and new observed C1F9 entry. One owner/work/output/provider/IO/wait ledger and atomic commit per segment; no clear/text/device/scene/frame chronology inferred.'})),
   original_text_sources:'Every reached ROM dictionary, bitstream, glyph-width/mask and font read is individually pinned, including following WORD highbytes. Allocation, geometry, slot, caller and request/wait/MMIO data remain synthetic observations; no original text/caller initialization inferred.'}:{}),
  ...(spec.originalTextSources?{original_text_sources:'Individually pinned original dictionary, bitstream, glyph widths, masks, font and unpack WORDs including their highs. Original field-pointer WORDs are also pinned. Buffer geometry, field bytes, slots, MMIO, waits and caller/readiness contexts remain explicit synthetic observations; no original initialization, device calculation, scene or frame sequence inferred.'}:{}),
  ...(spec.nativeA3Observations?{native_a3_contract:'analysis/render-task-native-opcode-f953.json',
   native_a3_edges:instructions.filter(i=>i.opcode===0x58&&i.operand===0xA3).map(i=>({from:i.pc,to:i.pc+i.length,
    call:'zero actual WORDpops, own F953/0100/0200, whole conditional normal F953/counter/input and real mixed JSL/RTL/JSR/RTS, actual F508/F509/no resultPHA and fresh frame/PC/opcode',
    observations:'Independent frozen B0A5 counter polls and 9E1A control WORDs. Shared chronological wait ledger; C8 consumes only the prefix preceding the first counter record. Missing/wrong/unused samples, reset3030 or budget exhaustion reject the entire current segment. Counter changes imply no input/time/frames.'}))}:{}),
  ...(spec.c8Observations?{c8_contract:'analysis/render-task-native-opcode-fec1.json',
   c8_edges:instructions.filter(i=>i.opcode===0x58&&i.operand===0xC8).map(i=>({from:i.pc,to:i.pc+i.length,
    call:'seven actual WORDpops, fresh original C8 metadata and actual stack bridge, whole FEC1, actual F508/F509 then fresh body frame/PC/opcode',
    observations:'One provider/work/output ledger and original-PC/address/width/value MMIO stream; one chronological wait stream per segment. Every call consumes its slice; missing, reordered and unused records reject the entire segment.'})),
   data_contract:'Caller text dictionary/bitstream/glyph/geometry/slot bytes are explicit fresh physical provider observations under the complete FEC1 contract; synthetic tests are not evidence of original initialized scene data.'}:{}),
  ...(spec.native13Observations?{native13_contract:'analysis/render-task-native-opcode-9ba0.json',
   native13_edges:instructions.filter(i=>i.opcode===0x58&&i.operand===0x13).map(i=>({from:i.pc,to:i.pc+i.length,
    call:'one actual WORDpop, original9BA0/0201/0002, whole own99EB/menu/release, actualF508/F509/result-PHA and fresh body frame/PC/opcode',
    observations:'Shared original-PC/address/width/value MMIO and wait records across13/C8 plus independently frozen control records at actual9E1A reads. Counter changes create no input/time/frames; unused/wrong/missing events reject the complete body.'})),
   menu_data_contract:'Synthetic initialized action tables/dictionary/font/cache/input/geometry/slots plus actual original body/header/native metadata and unpack ROM. No automatic Entity/menu/capture/NMI/device/time/scene/frame ownership inferred.'}:{}),
  ...(spec.audioObservations?{native4c_contract:'analysis/render-task-native-opcode-c46e.json',
   native4c_edges:instructions.filter(i=>i.opcode===0x58&&i.operand===0x4C).map(i=>({from:i.pc,to:i.pc+i.length,
    call:'four actual WORDpops, originalC46E/0104/0000, whole conditional normal audio, actualF508/F509/no resultPHA and fresh body frame/PC/opcode',
    observations:'One global original-PC/address/width/value MMIO stream over menu/audio/C8 plus independently frozen wait/control records where reached. Missing/reordered/unused records reject the complete body.'})),
   audio_data_contract:'Sound-table WORDs are individually pinned original ROM. Actual fresh ROM WORD reads in Native4C must match this set; full indices and aliases are retained. Directory/payload/Entity/pan/cache bytes are explicit physical observations. Synthetic WRAM directory/payloads and independent APU/product samples prove no original initialized audio/scene/time/caller.'}:{}),
  ...(instructions.some(i=>i.opcode===0x58&&i.operand===0x9F)?{
   suspension_contract:'analysis/render-task-native-wait.json',
   native9f_edges:instructions.filter(i=>i.opcode===0x58&&i.operand===0x9F).map(i=>({from:i.pc,to:i.pc+i.length,
    yield:'actual outer RTS; incomplete prefix',resume:'branded committed prefix plus independent observed C1F9, actual readiness Carry1/F508/PEA/PHA/RTS/F509, fresh original body frame/PC/ID/opcode'})),
   completion:'Whole original body across committed source-proved segments only; blocked readiness and prefixes do not count. Original temporal caller occurrence/whole Task/scene/frames remain separate.'}:{}),
  ...(spec.tierBody?{tier_root_edges:instructions.filter(i=>i.opcode===0x58&&[0xC7,0x26].includes(i.operand)).map(i=>({from:i.pc,to:i.pc+i.length,id:i.operand,
   contract:`analysis/render-task-native-opcode-${i.operand===0xC7?'cb3c':'9dec'}.json`})),
   tier_data_contract:'Original72byte/32instruction body, paidBF100 BEFORE freshC7 fullWORD-read/00FF mask. Script8A compares right6-minus1 unsigned>=freshleft then actual46: maskedrank0..5 increments1 through own26, actual BYTEwrap/CMP7/LDA6, own74 WORDproperty08B2; maskedrank6..255 executes original99 refund100 before its owntext. Own original record/table/header/native metadata/high/END sources and every forward edge retained. One shared chronological provider/IO/wait/input/budget/commit; text/render aliases stay physical, all caller/record/window/device samples explicit synthetic, no init/time/Task/scene/frame inference.'}:{}),
  ...(spec.modalBody&&!spec.scriptChildBody?{modal_root_edges:instructions.filter(i=>i.opcode===0x58&&[0x72,0xBF,0x74,0xD7,0x9A].includes(i.operand)).map(i=>({from:i.pc,to:i.pc+i.length,id:i.operand,
    contract:`analysis/render-task-native-opcode-${({0x72:'cd43',0xBF:'cd20',0x74:'cbf7',0xD7:'935b',0x9A:'933a'})[i.operand]}.json`})),
   modal_data_contract:'Own complete original roots and Native58 metadata WORDs including highs, real pops/F508/freshA2/RTS/F509/resultPHA/framePC/END. Original unsigned9A ordering and BYTE04 state masks, fullWORD currency borrow, null/fresh record stores and actual PEA/PLA choice retained. One global chronological MMIO/wait/input ledger and atomic provider/budget/commit across menu/text/audio/C8. Every reached original ROM source individually pinned; all field/window/caller/device/wait/input data explicitly synthetic. Reset3030 and changed audio RTS reject; no initialization/Task/scene/frame/elapsed-time inference.'}:{}),
  required_opcodes:[...new Set(instructions.map(i=>i.opcode))].sort((a,b)=>a-b),
  native_ids:[...new Set(instructions.filter(i=>i.opcode===0x58).map(i=>i.operand))],
  ...(spec.selectionBody?{selection_root_contract:spec.native9AObservations?'analysis/render-task-native-opcode-933a.json':'analysis/render-task-native-opcode-bba0.json',
   selection_root_edges:instructions.filter(i=>i.opcode===0x58&&[0x9A,0x1A].includes(i.operand)).map(i=>({from:i.pc,to:i.pc+i.length,id:i.operand})),
   selection_data_contract:'Own full root, original0201/0000 metadata high bytes, one actualWORDpop, zero resultPHA and realF508/F509. Original body/state signedness, WORDbit operations, dynamic ROM/DP/table/alias/stack reads retained. Every selected originalROM WORD pinned individually; initialized records/window/selector/caller/device/product/wait/event/time/scene/frame remain explicit synthetic observations.'}:{}),
  ...(spec.native7CObservations?{native7c_contract:'analysis/render-task-native-opcode-8e36.json',
   native7c_edges:instructions.filter(i=>i.opcode===0x58&&i.operand===0x7C).map(i=>({from:i.pc,to:i.pc+i.length})),
   native7c_data_contract:'Own7C368E/0205/0200 WORDs including highs, two actual pops and fresh DP00 result-PHA, whole conditional8E36/8691/881C and nine renewed helper graphs. Actual BYTE/WORD86C4, strict60 scan and fresh saved indices/alias/return/source/budget ledger. Reached PPU/APU/product/wait/input records are separate explicit synthetic observations; no device/time/scene/frames or initialization inferred.'}:{}),
  boundary:'Observed first F390 with explicit physical frame/stack/state and original ROM body. Exact finite handler count to END56; actual outer return target observed only. Original bodies require fresh pointers/PCs and source-proved edges. No inferred allocation/F378/readiness/caller execution, initialization, devices, scene or frames.'};
}
export function proveScriptBodyFrontiers(bytes){
 const windows=[{id:'native9F-return',entry:0x80C401,hex:'AE5002A5009DA20BA5029D020C9E620C689DB20260'},
  {id:'native9F-pointer-WORD',entry:0x82D8F6,hex:'01C4'},
  {id:'native9F-argument-WORD',entry:0x82DAEB,hex:'0202'},
  {id:'native9F-return-WORD',entry:0x82DA0F,hex:'0200'},
  {id:'script2BF-child',entry:0x9CE691,hex:'01062C00140180C258B300070001C258D2147A03007AC2523D0356'},
  {id:'script2C3-child',entry:0x9CE6AC,hex:'01062C00140180C258B300060001C258D2009900E6C2523D0356'},
  {id:'nativeA9-long-call',entry:0x80A8E7,hex:'A60830092266C380A6009D501360'},
  {id:'nativeA9-C366-JSR-RTL',entry:0x80C366,hex:'204AC36B'},
  {id:'nativeC8-render-call',entry:0x80FEC1,hex:'A508C90004D006A91E008D02022063F9'}];
 const sources=windows.map(w=>{const raw=bytes.subarray(cpuToOffset(w.entry,bytes.length),cpuToOffset(w.entry,bytes.length)+w.hex.length/2);
  if(raw.toString('hex').toUpperCase()!==w.hex)throw Error('Original body frontier byte drift');
  return {id:w.id,entry:cpuLabel(w.entry),machine_bytes:w.hex,sha256:taskHash(raw)};});
 for(const w of windows.filter(w=>w.id.startsWith('script'))){
  const d=decodeScript(Buffer.from(w.hex,'hex').subarray(2));
  if(!d.fullyCovered||!d.instructions.some(i=>i.opcode===0x52&&i.operand===0x33D))throw Error('Original child-call frontier drift');
 }
 return {rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',native_binding:false,
  completed_script_bodies:0,sources,
  native9F:{entry:'80:C401',argument_metadata_word:bytes.readUInt16LE(cpuToOffset(0x82DAEB,bytes.length)),
   return_metadata_word:bytes.readUInt16LE(cpuToOffset(0x82DA0F,bytes.length)),
   source_contract:'analysis/render-task-native-wait.json',native_binding:true,
   unresolved:'Local alternate return, actual Native58 yield and independent observed C1F9/readiness/F509 are proved separately. Automatic temporal caller/event ownership, whole Task and frame scheduling remain unproved; prefixes alone never count.'},
  closed_helpers:{native0A:{entry:'80:C68D',source_contract:'analysis/render-task-native-c68d.json',native_binding:true,
   qualification:'Whole48byte/24instruction C68D/C696 graph with real C692 JSR/RTS and separate Native58/F508/F509/F390 composition. Source WORDwrap/BPL/EOR/INC/unsigned-CMP/two-LSR equations use fresh actualDBR coordinate and DP00 owners. Six whole original ED/139/13D/13F/2D4/352 bodies, every strict100 threshold branch and actual release/END, are supplied in render-task-script-bodies-c8-distance; caller/coordinate/device/text inputs remain explicitly synthetic.'},native5C:{entry:'80:CB06',source_contract:'analysis/render-task-native-cb06.json',native_binding:true,
   qualification:'Whole20byte/10instruction original helper and own Native58/F508/F509/F390 composition, two real ASLs with second-ASL Carry and fresh DP00 ADC. Three additional whole original85/FF/1B1 bodies are supplied in render-task-script-bodies-c8-fields; every branch is covered using separately pinned original WORDlookup ownership and explicitly synthetic callers.'},nativeA9:{entry:'80:A835',source_contract:'analysis/render-task-native-a835.json',native_binding:true,
   qualification:'Whole fixed A835/C366/C34A/C2C8/C242477/201 graph, actual positive JSL/JSR/RTL callback, allocator/frame/task append and root RTS/F509. Eleven local plus two outer bytes under intact owners. Original callbacks are created but not automatically visited; initialization/whole Task/scene/frames remain separate.'}},
  next_helpers:{progress_reference:'docs/PORTIERUNGSSTAND.json',qualification:'Historical helper windows above remain source pins. Whole NativeC8/A9/13/A7/A3/80/33/C5/6A and individually delivered body families retain separate renewed source/native contracts; these helper windows themselves count no bodies. Current next source work is centralized in progress.next_block; original Script52 child/parent-resume, loops, initialization, reset, caller/scene/frame and device/time boundaries remain explicit.'},
  child_calls:{script_ids:[0x2BF,0x2C3],child_id:0x33D,resolved_source_contract:'analysis/render-task-script-bodies-child.json',unresolved:'Historical structural selection missed these calls. Their own child33D argument/frame/END/release/F495/parentEND contracts are now proved separately in the referenced body group. Automatic original caller/scene/frame occurrence remains open; these historical windows themselves count no bodies.'},
  boundary:'Original local source evidence for unfinished families only; no complete native body, caller occurrence, scene or frames are claimed.'};
}
