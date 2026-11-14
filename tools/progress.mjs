import { readFile, access } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {proveLocalBodyFlow} from '../proof/task/script-body-local-flow.mjs';
import {validateCountdownChildEvidence} from './task-script-child-countdown-evidence.mjs';
import {validatePropertyChildParent} from './task-script-child-property-evidence.mjs';
import {validateParentWaitChildProbe} from './task-script-child-parent-wait-evidence.mjs';
import {validateRecordAndEvidence} from './task-script-record-and-evidence.mjs';
import {validatePropertyPairEvidence} from './task-script-property-pair-evidence.mjs';
export const progressReference = 'docs/PORTIERUNGSSTAND.json';
const label = value => typeof value === 'string' && /^[0-9A-F]{2}:[0-9A-F]{4}$/.test(value);
function localPath(root, path) {
  if (typeof path !== 'string' || !path || relative(root, resolve(root,path)).startsWith('..') || !/^(src|proof|analysis)\//.test(path))
    throw Error('Invalid progress evidence path');
  return resolve(root,path);
}
export async function readProgress(root) {
  const progress = JSON.parse(await readFile(resolve(root,progressReference),'utf8'));
  if (progress.schema_version !== 1 || !/^[a-f0-9]{64}$/.test(progress.rom_sha256)
    || !Array.isArray(progress.supplied) || !Array.isArray(progress.work_groups) || !Array.isArray(progress.open_boundaries)
    || !['source','native','composition'].includes(progress.next_block?.kind) || !Array.isArray(progress.next_block.entries)) throw Error('Invalid progress schema');
  const entries = new Set();
  for (const routine of progress.supplied) {
    if (!label(routine.entry) || entries.has(routine.entry) || !Number.isInteger(routine.stack_bytes) || routine.stack_bytes < 1) throw Error('Invalid supplied entry');
    entries.add(routine.entry); await access(localPath(root,routine.native));
    const report = JSON.parse(await readFile(localPath(root,routine.source),'utf8')), graph = report[routine.graph];
    if (report.rom_sha256 !== progress.rom_sha256 || graph?.native_binding !== true
      || graph?.proof?.entry !== routine.entry || graph?.proof?.external_return_assumptions !== 0
      || graph?.proof?.minimum_protected_stack_bytes !== routine.stack_bytes)
      throw Error('Progress evidence drift: ' + routine.entry);
  }
  const groups = new Set();
  for (const group of progress.work_groups) {
    if (!group.id || groups.has(group.id) || !['source-required','native-required','composition-required'].includes(group.status)
      || !Array.isArray(group.entries) || !group.entries.length)
      throw Error('Invalid open work group');
    groups.add(group.id);
    for (const entry of group.entries) { if (!label(entry) || entries.has(entry)) throw Error('Duplicate or invalid work entry'); entries.add(entry); }
    if(group.entry_modes)for(const [entry,state]of Object.entries(group.entry_modes)){
      if(!group.entries.includes(entry)||!state||typeof state!=='object'||Array.isArray(state)||Object.keys(state).some(k=>!['e','m','x'].includes(k))
        ||![state.e??0,state.m??0,state.x??0].every(v=>v===0||v===1)||(state.e??0)&&(!(state.m??0)||!(state.x??0)))throw Error('Invalid progress entry mode');
    }
    if(group.manual_native)await validateManualTaskEvidence(root,group,progress.rom_sha256);
    if(group.render_adapter_blocks){
      if(group.id!=='task-f378-opcode-dispatch'||!Array.isArray(group.render_adapter_blocks))throw Error('Invalid render adapter owner');
      for(const block of group.render_adapter_blocks){
        if(!block.id||groups.has(block.id)||block.status!=='composition-required'||block.entries?.length!==1
          ||!progress.supplied.some(r=>r.entry===block.entries[0]))throw Error('Invalid supplied render adapter');
        groups.add(block.id);await validateRenderAdapterBlock(root,block,progress.rom_sha256);
      }
    }
    if(group.source_contract){
      const source=JSON.parse(await readFile(localPath(root,group.source_contract),'utf8'));
      if(source.rom_sha256!==progress.rom_sha256||source.source_graph?.native_binding!==false||source.source_graph?.local_source_complete!==true
        ||JSON.stringify(source.proofs?.map(p=>p.entry))!==JSON.stringify(group.entries)
        ||source.proofs.some(p=>p.native_binding!==false||p.local_source_complete!==true))throw Error('Local source contract drift');
    }
    if(group.composition_blocks){
      if(group.id!=='task-visit-c1ca'||!Array.isArray(group.composition_blocks))throw Error('Invalid visit composition owner');
      for(const b of group.composition_blocks){
        if(!b.id||groups.has(b.id)||b.status!=='composition-required'||!Array.isArray(b.entries)
          ||JSON.stringify(b.entries)!==JSON.stringify(['80:C1CA','80:C1F9','80:C20B']))throw Error('Invalid visit composition block');
        groups.add(b.id);await validateManualTaskEvidence(root,b,progress.rom_sha256);
        const s=JSON.parse(await readFile(localPath(root,b.source_contract),'utf8'));
        if(s.rom_sha256!==progress.rom_sha256||s.source_graph?.native_binding!==false||s.source_graph.local_source_complete!==true
          ||JSON.stringify(s.proofs?.map(p=>p.entry))!==JSON.stringify(b.entries)
          ||s.proofs.some(p=>p.native_binding!==false||p.local_source_complete!==true||p.external_return_assumptions!==0
            ||p.full_task_binding!==false||p.global_stack_minimum!==null
            ||p.joins?.length!==(b.id==='task-visit-status-opcodes'?7:6)))throw Error('Visit composition source drift');
        if(b.id==='task-visit-status-opcodes'&&s.proofs.some(p=>p.status_return?.slots?.length!==29
          ||p.status_return.proofs?.[0]?.entry!=='80:F927'||!p.postrun_d_ledger?.length
          ||p.joins.at(-1).from!=='80:F952'||p.joins.at(-1).raw_return!=='C20A'))throw Error('Status visit composition source drift');
      }
    }
    if(group.dispatch_blocks){
      if(!Array.isArray(group.dispatch_blocks)||group.id!=='task-f378-opcode-dispatch')throw Error('Invalid dispatch block owner');
      for(const block of group.dispatch_blocks){
        if(!block.id||groups.has(block.id)||block.status!=='composition-required'
          ||JSON.stringify(block.entries)!==JSON.stringify(group.entries)||!block.source_contract||!block.manual_native)
          throw Error('Invalid dispatch block');
        groups.add(block.id);
        await validateOpcodeBlock(root,block,progress.rom_sha256);
      }
    }
    if(group.native58_blocks){
      if(!Array.isArray(group.native58_blocks)||group.id!=='task-f378-opcode-dispatch')throw Error('Invalid Native58 block owner');
      for(const block of group.native58_blocks){
        if(!block.id||groups.has(block.id)||block.status!=='composition-required'
          ||JSON.stringify(block.entries)!==JSON.stringify(group.entries)||!block.source_contract||!block.manual_native)
          throw Error('Invalid Native58 composition block');
        groups.add(block.id);await validateNativeOpcodeBlock(root,block,progress.rom_sha256);
      }
    }
    if(group.script_body_batches){
      if(group.id!=='task-f378-opcode-dispatch'||!Array.isArray(group.script_body_batches))throw Error('Invalid script body batch owner');
      for(const block of group.script_body_batches){
        if(!block.id||groups.has(block.id)||block.status!=='composition-required'
          ||JSON.stringify(block.entries)!==JSON.stringify(block.id==='task-script-bodies-child'?['80:C1CA']:['80:F390']))throw Error('Invalid script body batch');
        groups.add(block.id);await validateScriptBodyBatch(root,block,progress.rom_sha256);
      }
    }
    if(group.script52_blocks){
      if(!Array.isArray(group.script52_blocks)||group.id!=='task-f378-opcode-dispatch')throw Error('Invalid Script52 block owner');
      for(const block of group.script52_blocks){
        if(!block.id||groups.has(block.id)||block.status!=='composition-required'
          ||JSON.stringify(block.entries)!==JSON.stringify(group.entries))throw Error('Invalid Script52 block');
        groups.add(block.id);await validateScriptOpcodeBlock(root,block,progress.rom_sha256);
      }
    }
  }
  const next = progress.work_groups.find(group => group.id === progress.next_block.group);
  if (!next || !progress.next_block.entries.length || progress.next_block.entries.some(entry => !next.entries.includes(entry))) throw Error('Next block outside open group');
  const batch=progress.autonomous_batch;
  if(batch&&(!Number.isInteger(batch.authorized_blocks)||batch.authorized_blocks<1||!Array.isArray(batch.completed_groups)
    ||batch.completed_groups.length>batch.authorized_blocks||new Set(batch.completed_groups).size!==batch.completed_groups.length
    ||batch.completed_groups.some(id=>typeof id!=='string'||!groups.has(id.replace(/:manual-native$/,'')))||typeof batch.authorization!=='string'))throw Error('Invalid autonomous batch');
  return progress;
}
export async function validateRenderAdapterBlock(root,block,romHash){
 await validateManualTaskEvidence(root,block,romHash);
 const source=JSON.parse(await readFile(localPath(root,block.source_contract),'utf8'));
 if(source.rom_sha256!==romHash||source.source_graph?.native_binding!==false||source.source_graph.local_source_complete!==true
  ||source.source_graph.full_graph_closed!==true||JSON.stringify(source.proofs?.map(p=>p.entry))!==JSON.stringify(block.entries)
  ||source.proofs.some(p=>p.native_binding!==false||p.local_source_complete!==true||p.full_graph_closed!==true||p.external_return_assumptions!==0
   ||p.full_task_binding!==false||p.global_stack_minimum!==null||!['RTS','RTL'].includes(p.root_return)))throw Error('Render adapter source drift');
}
export function validateLocalBodyEvidence(proof,probes){
 const graph=proveLocalBodyFlow(proof.instructions,{native9FResume:!!proof.local_wait_contract}),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),seen=new Set();
 if(!equal(proof.local_return_graph,graph)||!probes.length)throw Error('Local body graph drift');
 for(const p of probes){
  const events=p.local_return_events,stack=[];
  if(!Array.isArray(events)||!Array.isArray(p.body_pcs)||!Number.isSafeInteger(p.handlers)||p.handlers!==p.body_pcs.length||p.handlers>graph.max_handlers
   ||events.length!==2*p.body_pcs.filter(pc=>graph.call_sites.some(s=>s.pc===pc)).length)
   throw Error('Local body return evidence drift');
  const expectedEvents=p.body_pcs.filter(pc=>graph.call_sites.some(s=>s.pc===pc)||graph.return_sites.includes(pc));
  if(events.length!==expectedEvents.length||events.some((e,n)=>e.pc!==expectedEvents[n]
   ||e.kind!==(graph.call_sites.some(s=>s.pc===e.pc)?'call':'return')))throw Error('Local body event path drift');
  for(const e of events){const site=graph.call_sites.find(s=>s.pc===e.callPC);
   if(!site||e.returnPC!==site.return_pc||e.newPointer!==((e.destination-2)&65535)||e.freshPointer!==e.destination)throw Error('Local body owner drift');
   if(e.kind==='call'){
    if(e.pc!==site.pc||e.target!==site.target)throw Error('Local body call drift');stack.push(e);
   }else if(e.kind==='return'){
    const top=stack.pop();if(!top||e.callPC!==top.callPC||e.destination!==top.destination||e.originalPointer!==top.newPointer
     ||e.returnWord!==site.return_pc||!graph.return_sites.includes(e.pc))throw Error('Local body LIFO drift');
   }else throw Error('Local body event drift');
   if(stack.length>graph.max_local_depth)throw Error('Local body depth drift');
  }
  if(stack.length)throw Error('Local body pending return');
  if(proof.local_wait_contract){
   const checkpoints=p.local_return_checkpoints;
   if(!Array.isArray(checkpoints)||checkpoints.length!==p.observed_readiness_entries+1
    ||checkpoints.length!==p.segments.reduce((n,s)=>n+s.repetitions,0))throw Error('Local wait checkpoint count drift');
   let priorHandlers=0;
   for(const [segment,c]of checkpoints.entries()){
    if(c.segment!==segment||c.readiness_entries!==segment||!Number.isSafeInteger(c.body_handlers)||c.body_handlers<priorHandlers||c.body_handlers>p.handlers
     ||!Number.isSafeInteger(c.events))
     throw Error('Local wait checkpoint path drift');
    // Repeated helper return PCs require counting occurrences in the prefix,
    // rather than membership in a set of numeric source PCs.
    const prefixEvents=p.body_pcs.slice(0,c.body_handlers).filter(pc=>graph.call_sites.some(s=>s.pc===pc)||graph.return_sites.includes(pc));
    if(c.events!==prefixEvents.length)throw Error('Local wait checkpoint event drift');
    const pending=[];
    for(const e of events.slice(0,c.events)){
     if(e.kind==='call')pending.push({callPC:e.callPC,returnPC:e.returnPC,destination:e.destination,newPointer:e.newPointer});else pending.pop();
    }
    if(!equal(c.pending,pending))throw Error('Local wait checkpoint owner drift');
    priorHandlers=c.body_handlers;
   }
   const last=checkpoints.at(-1);if(last.body_handlers!==p.handlers||last.events!==events.length||last.pending.length)throw Error('Local wait END checkpoint drift');
  }
  for(let n=1;n<p.body_pcs.length;n++)seen.add(p.body_pcs[n-1]+':'+p.body_pcs[n]);
 }
 if(!equal([...seen].sort(),[...new Set(graph.edges.map(e=>e.from+':'+e.to))].sort()))throw Error('Local body incomplete edge evidence');
}
export function validateChildBodyEvidence(proof,probes,child){
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),seen=new Set(),childSeen=new Set(),end=pcs=>child.instructions.some(i=>i.pc===pcs.at(-1)&&i.opcode===0x56),
  physicalWord=(writes,address)=>{const m=new Map(writes);return m.has(address)&&m.has(address+1)?m.get(address)|(m.get(address+1)<<8):null;};
 if(![0x4B,0x33D,0x10E,0xC8,0x6F,0xD2].includes(proof.child_id)||child.script_id!==proof.child_id||proof.child_return_bytes!==0
  ||proof.instructions.filter(i=>i.opcode===0x52).length!==1||proof.instructions.find(i=>i.pc===proof.child_call_pc)?.operand!==proof.child_id
  ||proof.parent_resume_pc!==proof.child_call_pc+3||!probes.length)throw Error('Child source protocol drift');
 for(const originalProbe of probes){const p=proof.child_parent_wait_contract?
  validateParentWaitChildProbe(proof,originalProbe,{equal,physicalWord}):originalProbe;
  const segments=p.child_segments,entries=p.child_observed_entries,pcs=p.body_pcs;
  if(!Array.isArray(pcs)||pcs[0]!==0||pcs.length!==p.handlers||!proof.instructions.some(i=>i.pc===pcs.at(-1)&&i.opcode===0x56)
   ||pcs.slice(1).some((pc,n)=>!proof.edges.some(e=>e.from===pcs[n]&&e.to===pc))
   ||!Array.isArray(segments)||!Array.isArray(entries)||segments.length!==entries.length+1
   ||segments.some((s,n)=>s.segment!==n||!Number.isSafeInteger(s.segment_handlers)||s.segment_handlers<0
    ||s.io_observations_used!==s.io_records.length||!equal(s.io_records,s.io_requests.filter(r=>r.kind==='read').map(({kind,...r})=>r))
    ||s.wait_observations_used!==s.wait_records.length||!Array.isArray(s.input_records)||s.input_observations_used!==s.input_records.length))throw Error('Child path/observation evidence drift');
  for(let n=1;n<pcs.length;n++)seen.add(pcs[n-1]+':'+pcs[n]);
  const first=segments[0],last=segments.at(-1),called=pcs.includes(proof.child_call_pc);
  if(first.script_id!==proof.script_id||last.script_id!==proof.script_id||!last.body_complete||!equal(last.body_pcs,pcs)
   ||first.segment_handlers!==first.body_pcs.length)throw Error('Child parent path drift');
  if(proof.child_property_contract)validatePropertyChildParent(proof,p,{first,last,equal,physicalWord});
  if(!called){if(segments.length!==1||first.script_child_suspended||!first.body_complete||p.child_header_result!==null)throw Error('Child uncalled branch drift');continue;}
  const children=segments.slice(1,-1),body=children.at(-1),prefix=pcs.slice(0,pcs.indexOf(proof.child_call_pc)+1),
   childPCs=child.instructions.map(i=>i.pc),waitCount=proof.child_id===0x4B?5:proof.child_id===0x6F?1:proof.child_id===0xD2?2:0,
   expectedEntries=waitCount?[0x80C20B,0x80C20B,...Array(waitCount).fill(0x80C1CA),0x80C20B]:[0x80C20B,0x80C20B];
  if(first.body_complete||!first.script_child_suspended||!equal(first.body_pcs,prefix)||!equal(entries.map(o=>o.entry),expectedEntries)
   ||entries.some(o=>o.synthetic!==true)||first.parent_slot===first.child_slot||![first.parent_slot,first.child_slot,first.child_frame,first.parent_frame].every(Number.isInteger)
   ||!equal(pcs.slice(prefix.length),last.body_pcs.slice(prefix.length))||last.segment_handlers!==pcs.length-prefix.length
   ||last.body_pcs[prefix.length]!==proof.parent_resume_pc||children.some(s=>s.script_id!==proof.child_id)
   ||!body.body_complete||!end(body.body_pcs)||([0x10E,0xC8].includes(proof.child_id)?
    body.body_pcs[0]!==0||body.body_pcs.slice(1).some((pc,n)=>!child.edges.some(e=>e.from===body.body_pcs[n]&&e.to===pc)):
    !equal(body.body_pcs,childPCs)))throw Error('Child completion/resume evidence drift');
  const heapResult=(p.heap_observed_size-proof.child_frame_bytes-4)&65535;
  if(!Number.isInteger(p.heap_observed_size)||p.heap_observed_size-proof.child_frame_bytes<5
   ||body.result_word!==heapResult||p.child_header_result!==heapResult
   ||physicalWord(first.byte_writes,0x7E0252+first.child_slot)!==first.child_frame
   ||physicalWord(first.byte_writes,first.child_frame+0x7E0007)!==((first.child_frame+proof.child_frame_bytes-1-proof.child_argument_bytes)&65535)
   ||physicalWord(first.byte_writes,0x7E0BA2+first.parent_slot)!==65535
   ||physicalWord(first.byte_writes,0x7E02B2+first.parent_slot)!==0xF494
   ||physicalWord(first.byte_writes,0x7E0312+first.child_slot)!==first.parent_slot
   ||physicalWord(first.byte_writes,0x7E0372+first.parent_slot)!==first.child_slot
   ||physicalWord(last.byte_writes,0x7E0BA2+first.parent_slot)!==0
   ||physicalWord(last.byte_writes,0x7E024E)!==first.child_slot
   ||p.final_links.current!==first.parent_slot||p.final_links.tail!==first.parent_slot||p.final_links.free!==first.child_slot
   ||p.final_links.parent_wait!==0||p.final_links.parent_next!==65535||p.final_links.heap!==proof.child_frame_bytes)
   throw Error('Child physical owner/heap/header evidence drift');
  if(waitCount){
   const prefixHandlers=proof.child_id===0x4B?3:4,prefixChild=childPCs.slice(0,prefixHandlers),post=children[1],readiness=children.slice(2);
   if(children.length!==waitCount+2||!equal(children[0].body_pcs,prefixChild)||!children[0].body_suspended||children[0].segment_handlers!==prefixHandlers
    ||!post.child_postrun_returned||post.segment_handlers!==0||!equal(post.body_pcs,prefixChild)
    ||!equal(readiness.map(s=>s.countdown),Array.from({length:waitCount},(_,n)=>waitCount-n-1))||!equal(readiness.map(s=>s.observed_readiness_entries),Array.from({length:waitCount},(_,n)=>n+1))
    ||readiness.slice(0,-1).some(s=>s.segment_handlers!==0||s.body_complete||!s.body_suspended||!equal(s.body_pcs,prefixChild))
    ||body.segment_handlers!==childPCs.length-prefixHandlers)throw Error('Child real readiness/return evidence drift');
  }else if(children.length!==1||body.segment_handlers!==([0x10E,0xC8].includes(proof.child_id)?body.body_pcs.length:childPCs.length)||body.observed_readiness_entries!==0)
   throw Error('Child immediate END evidence drift');
  if([0x6F,0xD2].includes(proof.child_id))validateCountdownChildEvidence(proof,p,child,{first,body,children,equal,physicalWord});
  if(proof.child_id===0x10E){
   for(let n=1;n<body.body_pcs.length;n++)childSeen.add(body.body_pcs[n-1]+':'+body.body_pcs[n]);
   const c=proof.child_input_contract,calls=body.native_calls,active=p.child_state!==0,
    c8=calls?.find(n=>n.target===0x80FEC1),a3=calls?.find(n=>n.target===0x80F953),leaf=calls?.at(-1),
    polls=body.wait_records.filter(r=>r.pc===0x81B0A5),inputs=body.input_records;
   if(!c||c.frame_bytes!==39||c.local_offset!==0x13||!equal(c.native_ids,child.native_ids)
    ||![0,1,2,3,255].includes(p.child_state)||typeof p.child_repeated!=='boolean'
    ||p.child_argument!==c.argument||p.child_local!==c.argument||p.child_native56_field!==c.argument||p.child_native56_controls!==0x7FFF
    ||physicalWord(first.byte_writes,first.child_frame+0x7E0025)!==c.argument
    ||!Array.isArray(inputs)||body.input_observations_used!==inputs.length
    ||!Array.isArray(calls)||calls.length!==(active?3:1)||leaf.target!==0x80CC97||leaf.word_pops!==1
    ||calls.some(n=>n.callee_return_word!==0xF508||n.result_pushed!==false)
    ||!!c8!==active||!!a3!==active
    ||segments.filter(s=>s.script_id===proof.script_id).some(s=>s.io_records.length||s.wait_records.length||s.input_records.length))
    throw Error('Child10E argument/native owner evidence drift');
   if(!active){if(inputs.length||body.wait_records.length||body.io_records.length||body.body_pcs.includes(58))throw Error('Child10E skipped-call evidence drift');}
   else if(c8.word_pops!==7||c8.glyphs!==(p.child_state<=2?55:26)||c8.newlines!==0||a3.word_pops!==0
    ||a3.iterations!==(p.child_repeated?2:1)||a3.wait_observations_used!==polls.length||a3.input_observations_used!==inputs.length
    ||!equal(polls.map(r=>r.value),p.child_repeated?[5,6,6,7]:[6])
    ||polls.some(r=>r.width!==2||r.address!==0x7E1C76)
    ||!equal(inputs.map(r=>r.value),p.child_repeated?[0,0x40]:[0x40])
    ||inputs.some(r=>r.pc!==0x809E1A||r.address!==0x8001CA||r.width!==2)
    ||body.wait_observations_used!==c8.wait_observations_used+a3.wait_observations_used
    ||body.body_pcs.includes(p.child_state<=2?35:56)||!body.body_pcs.includes(p.child_state<=2?56:35))
    throw Error('Child10E explicit text/counter/input evidence drift');
  }
  if(proof.child_id===0xC8){
   for(let n=1;n<body.body_pcs.length;n++)childSeen.add(body.body_pcs[n-1]+':'+body.body_pcs[n]);
   const c=proof.child_modal_contract,args=c?.arguments,confirm=p.child_confirm,
    funded=p.child_initial_low>=args?.[1]||p.child_initial_high!==0,paid=confirm&&funded,
    expectedTargets=paid?[0x80CD43,0x80CD20,0x80CDCF,0x80CBB3]:confirm?[0x80CD43,0x80CD20,0x80933A]:[0x80CD43,0x80933A],
    expectedPops=paid?[2,1,0,2]:confirm?[2,1,1]:[2,1],calls=body.native_calls,
    expectedLow=paid?(p.child_initial_low-args[1])&65535:p.child_initial_low,
    expectedHigh=paid?(p.child_initial_high-Number(p.child_initial_low<args[1]))&65535:p.child_initial_high;
   if(!c||c.frame_bytes!==33||!equal(c.local_offsets,[0x13,0x15,0x17])||!equal(c.native_ids,child.native_ids)
    ||!equal(args,proof.instructions.slice(0,3).map(i=>i.operand).reverse())||typeof confirm!=='boolean'
    ||![p.child_initial_low,p.child_initial_high].every(n=>Number.isInteger(n)&&n>=0&&n<=65535)
    ||!equal(p.child_argument_words,args)||!equal(p.child_local_words,args)
    ||!Number.isInteger(p.child_record_flag)||p.child_record_flag<0||p.child_record_flag>255
    ||args.some((arg,n)=>physicalWord(first.byte_writes,first.child_frame+0x7E001B+2*n)!==arg)
    ||c.record_pointer?.address!==0x8DB020+args[0]||c.record_pointer?.value!==p.child_record_pointer
    ||!child.rom_reads.some(r=>parseInt(r.entry.replace(':',''),16)===c.record_pointer.address
     &&parseInt(r.machine_bytes.slice(0,2),16)+(parseInt(r.machine_bytes.slice(2),16)<<8)===c.record_pointer.value)
    ||!Array.isArray(calls)||!equal(calls.map(n=>n.target),expectedTargets)||!equal(calls.map(n=>n.word_pops),expectedPops)
    ||calls.some(n=>n.callee_return_word!==0xF508||n.result_pushed!==[0x80CD43,0x80CD20].includes(n.target))
    ||p.child_currency_low!==expectedLow||p.child_currency_high!==expectedHigh
    ||body.wait_observations_used!==calls.reduce((n,c)=>n+c.wait_observations_used,0)
    ||body.input_observations_used!==calls.reduce((n,c)=>n+c.input_observations_used,0)
    ||body.input_records.length!==2||calls[0].input_observations_used!==2||calls.slice(1).some(n=>n.input_observations_used!==0)
    ||!equal(body.wait_records.filter(r=>r.pc===0x81B0A5).map(r=>[r.address,r.width,r.value]),[[0x7E1C76,2,1]])
    ||body.input_records.some(r=>r.pc!==0x809E1A||r.address!==0x8001CA||r.width!==2||r.value!==(confirm?0x40:0x2000))
    ||segments.filter(s=>s.script_id===proof.script_id).some(s=>s.io_records.length||s.wait_records.length||s.input_records.length))
    throw Error('Child0C8 argument/modal/payment/observation owner evidence drift');
   if(paid&&(physicalWord(body.byte_writes,0x7E1D63)!==65535||!(p.child_record_flag&128)
    ||new Map(body.byte_writes).get(0x7E0001+p.child_record_pointer)!==p.child_record_flag))throw Error('Child0C8 original success flag evidence drift');
  }
 }
 if(!equal([...seen].sort(),proof.edges.map(e=>e.from+':'+e.to).sort()))throw Error('Child parent incomplete edge coverage');
 if([0x10E,0xC8].includes(proof.child_id)&&!equal([...childSeen].sort(),child.edges.map(e=>e.from+':'+e.to).sort()))throw Error('Child finite body incomplete edge coverage');
}
export async function validateScriptBodyBatch(root,block,romHash){
 const source=JSON.parse(await readFile(localPath(root,block.source_contract),'utf8'));
 const native=JSON.parse(await readFile(localPath(root,block.manual_native.report),'utf8'));
 const module=await import(pathToFileURL(localPath(root,block.manual_native.module)).href);
 const ids=block.script_ids;
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!Number.isInteger(id)||id<0||id>=937)
  ||source.rom_sha256!==romHash||source.source_graph?.native_binding!==false||source.source_graph.local_source_complete!==true
  ||native.rom_sha256!==romHash||native.native_binding!==true||native.manual_only!==true
  ||native.full_task_binding!==false||native.global_stack_minimum!==null
  ||JSON.stringify(source.proofs?.map(p=>p.script_id))!==JSON.stringify(ids)
  ||JSON.stringify(native.bindings?.map(p=>p.script_id))!==JSON.stringify(ids))throw Error('Script body batch evidence drift');
 const dependencies=JSON.parse(await readFile(localPath(root,'analysis/render-task-script-body-dependencies.json'),'utf8'));
 const hash=createHash('sha256').update(JSON.stringify(dependencies)).digest('hex');
 if(dependencies.rom_sha256!==romHash||source.shared_dependencies_sha256!==hash)throw Error('Script body dependency drift');
 for(const proof of source.proofs){
  const binding=native.bindings.find(b=>b.script_id===proof.script_id);
  if(proof.entry!==(proof.child_flow_contract?'80:C1CA':'80:F390')||proof.native_binding!==false||proof.local_source_complete!==true
   ||proof.body_control_flow_complete!==true||proof.external_return_assumptions!==0||proof.full_task_binding!==false
   ||proof.global_stack_minimum!==null||binding.entry!==proof.entry||binding.module!==block.manual_native.module
   ||binding.source_contract!==block.source_contract||typeof module[binding.export]!=='function'
   ||JSON.stringify(binding.source_proof)!==JSON.stringify(proof)
   ||!native.probes.some(p=>p.script_id===proof.script_id&&p.body_complete===true&&p.synthetic_context===true&&p.original_body_bytes===true)
   ||!proof.required_opcodes.every(op=>dependencies.handlers.some(h=>h.opcode===op&&h.external_return_assumptions===0))
   ||!proof.native_ids.every(id=>dependencies.natives.some(n=>n.admitted_targets.some(t=>t.id===id))))throw Error('Script body proof drift');
    if(proof.child_flow_contract){
     const flow=JSON.parse(await readFile(localPath(root,proof.child_flow_contract))),childSource=JSON.parse(await readFile(localPath(root,proof.child_source_contract))),
      child=childSource.proofs.find(p=>p.script_id===proof.child_id);
     if(flow.rom_sha256!==romHash||flow.source_graph?.local_source_complete!==true
      ||createHash('sha256').update(JSON.stringify(flow)).digest('hex')!==proof.child_flow_sha256
      ||!child||childSource.rom_sha256!==romHash||createHash('sha256').update(JSON.stringify(child)).digest('hex')!==proof.child_source_proof_sha256)
      throw Error('Child body shared source drift');
     validateChildBodyEvidence(proof,native.probes.filter(p=>p.script_id===proof.script_id),child);
    }
    if(proof.local_return_graph)validateLocalBodyEvidence(proof,native.probes.filter(p=>p.script_id===proof.script_id));
    if(proof.record_and_contract)validateRecordAndEvidence(proof,native.probes.filter(p=>p.script_id===proof.script_id));
    if(proof.property_pair_contract)validatePropertyPairEvidence(proof,native.probes.filter(p=>p.script_id===proof.script_id));
    if(proof.tier_root_edges){
     if(!proof.tier_root_edges.every(e=>[0xC7,0x26].includes(e.id)
       &&e.contract===`analysis/render-task-native-opcode-${e.id===0xC7?'cb3c':'9dec'}.json`
       &&dependencies.natives.some(n=>n.admitted_targets.some(t=>t.id===e.id))))throw Error('Tier body source evidence drift');
    }
    if(proof.modal_root_edges){
     const contracts=new Map([[0x72,'cd43'],[0xBF,'cd20'],[0x74,'cbf7'],[0xD7,'935b'],[0x9A,'933a']]);
     if(!proof.modal_root_edges.every(e=>e.contract===`analysis/render-task-native-opcode-${contracts.get(e.id)}.json`
       &&dependencies.natives.some(n=>n.admitted_targets.some(t=>t.id===e.id)))
      ||!native.probes.filter(p=>p.script_id===proof.script_id).every(p=>{
       const records=p.modal_root_observation_segments;
       return Array.isArray(records)&&records.reduce((n,s)=>n+s.modal_root_calls,0)===p.body_pcs.filter(pc=>proof.modal_root_edges.some(e=>e.from===pc)).length
        &&records.every(s=>s.synthetic===true&&Number.isSafeInteger(s.segment)&&s.segment>=0&&Number.isSafeInteger(s.modal_root_calls)&&s.modal_root_calls>=0
         &&Array.isArray(s.io_records)&&s.io_observations_used===s.io_records.length&&Array.isArray(s.io_requests)
         &&JSON.stringify(s.io_records)===JSON.stringify(s.io_requests.filter(r=>r.kind==='read').map(({kind,...r})=>r))
         &&Array.isArray(s.wait_records)&&s.wait_observations_used===s.wait_records.length
         &&Array.isArray(s.input_records)&&s.input_observations_used===s.input_records.length);
      }))throw Error('Modal body observation evidence drift');
    }
    if(proof.selection_root_edges){
     if(!['analysis/render-task-native-opcode-933a.json','analysis/render-task-native-opcode-bba0.json'].includes(proof.selection_root_contract)
      ||!proof.selection_root_edges.every(e=>dependencies.natives.some(n=>n.admitted_targets.some(t=>t.id===e.id&&[0x9A,0x1A].includes(t.id))))
      ||!native.probes.filter(p=>p.script_id===proof.script_id).every(p=>{
       const records=p.selection_root_observation_segments;
       return Array.isArray(records)&&records.reduce((n,s)=>n+s.selection_root_calls,0)===p.body_pcs.filter(pc=>proof.selection_root_edges.some(e=>e.from===pc)).length
        &&records.every(s=>s.synthetic===true&&Number.isSafeInteger(s.segment)&&s.segment>=0&&Number.isSafeInteger(s.selection_root_calls)&&s.selection_root_calls>0
         &&Array.isArray(s.io_records)&&s.io_observations_used===s.io_records.length&&Array.isArray(s.wait_records)&&s.wait_observations_used===s.wait_records.length);
      }))throw Error('Selection body observation evidence drift');
    }
    if(proof.native7c_edges){
     if(proof.native7c_contract!=='analysis/render-task-native-opcode-8e36.json'||!dependencies.natives.some(n=>n.admitted_targets.some(t=>t.id===0x7C&&t.target==='80:8E36'))
      ||!native.probes.filter(p=>p.script_id===proof.script_id).every(p=>{
       const records=p.native7c_observation_segments;
       return Array.isArray(records)&&records.reduce((n,s)=>n+s.native7c_calls,0)===p.body_pcs.filter(pc=>proof.native7c_edges.some(e=>e.from===pc)).length
        &&records.every(s=>s.synthetic===true&&Number.isSafeInteger(s.segment)&&s.segment>=0&&Number.isSafeInteger(s.native7c_calls)&&s.native7c_calls>=0
         &&Array.isArray(s.io_records)&&s.io_observations_used===s.io_records.length
         &&Array.isArray(s.wait_records)&&s.wait_observations_used===s.wait_records.length
         &&Array.isArray(s.input_records)&&s.input_observations_used===s.input_records.length);
      }))throw Error('Script body7C observation evidence drift');
    }
    if(proof.native_a3_edges){
     if(proof.native_a3_contract!=='analysis/render-task-native-opcode-f953.json'||!dependencies.natives.some(n=>n.admitted_targets.some(t=>t.id===0xA3&&t.target==='80:F953'))
      ||!native.probes.filter(p=>p.script_id===proof.script_id).every(p=>{
       const records=p.native_a3_observation_segments;
       return Array.isArray(records)&&records.reduce((n,s)=>n+s.native_a3_calls,0)===p.body_pcs.filter(pc=>proof.native_a3_edges.some(e=>e.from===pc)).length
        &&records.every(s=>s.synthetic===true&&Number.isSafeInteger(s.segment)&&s.segment>=0&&Number.isSafeInteger(s.native_a3_calls)&&s.native_a3_calls>=0
         &&Array.isArray(s.wait_records)&&s.wait_observations_used===s.wait_records.length
         &&Array.isArray(s.input_records)&&s.input_observations_used===s.input_records.length);
      }))throw Error('Script body A3 observation evidence drift');
    }
    if(proof.native_a7_edges){
     if(proof.native_a7_contract!=='analysis/render-task-native-opcode-ff79.json'||!dependencies.natives.some(n=>n.admitted_targets.some(t=>t.id===0xA7&&t.target==='80:FF79'))
      ||!native.probes.filter(p=>p.script_id===proof.script_id).every(p=>{
       const records=p.native_a7_observation_segments;
       return Array.isArray(records)&&records.reduce((n,s)=>n+s.native_a7_calls,0)===p.body_pcs.filter(pc=>proof.native_a7_edges.some(e=>e.from===pc)).length
        &&records.every(s=>s.synthetic===true&&Number.isSafeInteger(s.segment)&&s.segment>=0&&Number.isSafeInteger(s.native_a7_calls)&&s.native_a7_calls>=0
         &&Array.isArray(s.io_records)&&s.io_observations_used===s.io_records.length
         &&Array.isArray(s.wait_records)&&s.wait_observations_used===s.wait_records.length);
      }))throw Error('Script body A7 observation evidence drift');
    }
    if(proof.c8_edges){
     if(proof.c8_contract!=='analysis/render-task-native-opcode-fec1.json'||!dependencies.natives.some(n=>n.admitted_targets.some(t=>t.id===0xC8&&t.target==='80:FEC1'))
      ||!native.probes.filter(p=>p.script_id===proof.script_id).every(p=>{
       const records=p.c8_observation_segments;
       return Array.isArray(records)&&records.reduce((n,s)=>n+s.c8_calls,0)===p.body_pcs.filter(pc=>proof.c8_edges.some(e=>e.from===pc)).length
        &&records.every(s=>s.synthetic===true&&Number.isSafeInteger(s.segment)&&s.segment>=0&&Number.isSafeInteger(s.c8_calls)&&s.c8_calls>=0
         &&Array.isArray(s.io_records)&&s.io_observations_used===s.io_records.length
         &&Array.isArray(s.wait_records)&&s.wait_observations_used===s.wait_records.length);
      }))throw Error('Script body C8 observation evidence drift');
    }
    if(proof.native13_edges){
     if(proof.native13_contract!=='analysis/render-task-native-opcode-9ba0.json'
      ||!dependencies.natives.some(n=>n.admitted_targets.some(t=>t.id===0x13&&t.target==='80:9BA0'))
      ||!native.probes.filter(p=>p.script_id===proof.script_id).every(p=>{
       const records=p.native13_observation_segments;
       return Array.isArray(records)&&records.reduce((n,s)=>n+s.native13_calls,0)===p.body_pcs.filter(pc=>proof.native13_edges.some(e=>e.from===pc)).length
        &&records.every(s=>s.synthetic===true&&Number.isSafeInteger(s.segment)&&s.segment>=0&&Number.isSafeInteger(s.native13_calls)&&s.native13_calls>=0
         &&Number.isSafeInteger(s.c8_calls)&&s.c8_calls>=0&&Array.isArray(s.io_records)&&s.io_observations_used===s.io_records.length
         &&Array.isArray(s.wait_records)&&s.wait_observations_used===s.wait_records.length
         &&Array.isArray(s.input_records)&&s.input_observations_used===s.input_records.length);
      }))throw Error('Script body Native13 observation evidence drift');
    }
    if(proof.native63_edges){
     if(proof.native63_contract!=='analysis/render-task-native-opcode-c560.json'
      ||!dependencies.natives.some(n=>n.admitted_targets.some(t=>t.id===0x63&&t.target==='80:C560'))
      ||!native.probes.filter(p=>p.script_id===proof.script_id).every(p=>{
       const records=p.native63_observation_segments;
       return Array.isArray(records)&&records.reduce((n,s)=>n+s.native63_calls,0)===p.body_pcs.filter(pc=>proof.native63_edges.some(e=>e.from===pc)).length
        &&records.every(s=>s.synthetic===true&&Number.isSafeInteger(s.segment)&&s.segment>=0
         &&Number.isSafeInteger(s.native63_calls)&&s.native63_calls>=0&&Array.isArray(s.io_records)&&s.io_observations_used===s.io_records.length
         &&Array.isArray(s.io_requests)&&JSON.stringify(s.io_records)===JSON.stringify(s.io_requests.filter(r=>r.kind==='read').map(({kind,...r})=>r))
         &&s.io_records.filter(r=>[0x80C566,0x80C572,0x80C57F].includes(r.pc)).length===s.native63_calls*3
         &&s.io_records.filter(r=>[0x80C566,0x80C572,0x80C57F].includes(r.pc)).every((r,n)=>r.width===1&&Number.isInteger(r.value)&&r.value>=0&&r.value<=255
          &&r.pc===[0x80C566,0x80C572,0x80C57F][n%3]&&r.address===[0x802137,0x80213C,0x80213D][n%3]));
      }))throw Error('Script body Native63 observation evidence drift');
    }
    if(proof.native3e_edges){
     if(proof.native3e_contract!=='analysis/render-task-native-opcode-c51f.json'
      ||!dependencies.natives.some(n=>n.admitted_targets.some(t=>t.id===0x3E&&t.target==='80:C51F'))
      ||!native.probes.filter(p=>p.script_id===proof.script_id).every(p=>{
       const records=p.native3e_observation_segments;
       return Array.isArray(records)&&records.reduce((n,s)=>n+s.native3e_calls,0)===p.body_pcs.filter(pc=>proof.native3e_edges.some(e=>e.from===pc)).length
        &&records.every(s=>s.synthetic===true&&Number.isSafeInteger(s.segment)&&s.segment>=0
         &&Number.isSafeInteger(s.native3e_calls)&&s.native3e_calls>=0&&Array.isArray(s.io_records)&&s.io_observations_used===s.io_records.length);
      }))throw Error('Script body Native3E observation evidence drift');
    }
    if(proof.native4c_edges){
     if(proof.native4c_contract!=='analysis/render-task-native-opcode-c46e.json'
      ||!dependencies.natives.some(n=>n.admitted_targets.some(t=>t.id===0x4C&&t.target==='80:C46E'))
      ||!native.probes.filter(p=>p.script_id===proof.script_id).every(p=>{
       const records=p.native4c_observation_segments;
       return Array.isArray(records)&&records.reduce((n,s)=>n+s.native4c_calls,0)===p.body_pcs.filter(pc=>proof.native4c_edges.some(e=>e.from===pc)).length
        &&records.every(s=>s.synthetic===true&&Number.isSafeInteger(s.segment)&&s.segment>=0
         &&Number.isSafeInteger(s.native4c_calls)&&s.native4c_calls>=0
         &&Array.isArray(s.io_records)&&s.io_observations_used===s.io_records.length
         &&Array.isArray(s.wait_records)&&s.wait_observations_used===s.wait_records.length
         &&Array.isArray(s.input_records)&&s.input_observations_used===s.input_records.length);
      }))throw Error('Script body Native4C observation evidence drift');
    }
    if(proof.native9f_edges){
   if(proof.suspension_contract!=='analysis/render-task-native-wait.json'||typeof module.prepareTaskScriptBodyResume!=='function'
    ||(proof.child_parent_wait_contract?
      !proof.child_flow_contract||typeof module.prepareTaskScriptBodyParentPostrun!=='function'
       ||JSON.stringify(proof.native9f_edges.map(e=>e.from))!==JSON.stringify(proof.child_parent_wait_contract.parent_waits.map(w=>w.pc)):
     !native.probes.filter(p=>p.script_id===proof.script_id).every(p=>{
      return validScriptBodySuspensionProbe(proof,p);
    })))throw Error('Script body suspension evidence drift');
  }
 }
}
// A forward body may have multiple original ENDs. Completion belongs to the
// reached END instruction, with every edge and reached yield still proved.
export function validScriptBodySuspensionProbe(proof,p){
 if(!Array.isArray(p.body_pcs)||!p.body_pcs.length||p.body_pcs[0]!==0||p.body_pcs.length!==p.handlers
  ||!proof.instructions.some(i=>i.pc===p.body_pcs.at(-1)&&i.opcode===0x56&&i.flow==='end'))return false;
 const yields=p.body_pcs.filter(pc=>proof.native9f_edges.some(e=>e.from===pc)).length;
 return p.segments?.at(-1)?.body_complete===true&&p.segments.every(s=>Number.isSafeInteger(s.repetitions)&&s.repetitions>0)
  &&Number.isSafeInteger(p.observed_readiness_entries)&&p.observed_readiness_entries>=yields
  &&(!yields||p.segments.some(s=>s.body_suspended&&s.segment_handlers>0))
  &&p.body_pcs.slice(1).every((pc,n)=>(proof.local_return_graph?.edges??proof.edges).some(e=>e.from===p.body_pcs[n]&&e.to===pc));
}
export async function validateManualTaskEvidence(root,group,romHash){
  const native=group.manual_native;
  const r=JSON.parse(await readFile(localPath(root,native.report),'utf8'));
  if(r.rom_sha256!==romHash||r.native_binding!==true||r.manual_only!==true||r.full_task_binding!==false||r.global_stack_minimum!==null
    ||JSON.stringify(r.bindings?.map(b=>b.entry))!==JSON.stringify(group.entries))throw Error('Manual task evidence drift');
  const module=await import(pathToFileURL(localPath(root,native.module)).href);
  if(native.module==='proof/task/native-wait.mjs'){
    if(JSON.stringify(r.observed_compositions?.map(b=>b.entry))!==JSON.stringify(['80:F390','80:C1F9'])
      ||r.completed_script_bodies!==0)throw Error('Native wait observed composition drift');
    for(const b of r.observed_compositions){
      const source=JSON.parse(await readFile(localPath(root,b.source_contract),'utf8'));
      if(b.module!==native.module||typeof module[b.export]!=='function'||b.source_proof_field!=='proofs'
        ||source.rom_sha256!==romHash||source.source_graph.native_binding!==false
        ||JSON.stringify(source.proofs.find(p=>p.entry===b.entry))!==JSON.stringify(b.source_proof))
        throw Error('Native wait companion proof drift');
    }
  }
  for(const b of r.bindings){
    if(b.module!==native.module||typeof module[b.export]!=='function'||!label(b.entry))throw Error('Manual task module drift');
    const source=JSON.parse(await readFile(localPath(root,b.source_contract),'utf8'));
    const proof=source[b.source_proof_field]?.find(p=>p.entry===b.entry);
    if(source.rom_sha256!==romHash||source.source_graph.native_binding!==false||!proof||proof.native_binding!==false
      ||JSON.stringify(proof)!==JSON.stringify(b.source_proof))throw Error('Manual task source drift');
  }
}
export async function validateOpcodeBlock(root,block,romHash){
  await validateManualTaskEvidence(root,block,romHash);
  const source=JSON.parse(await readFile(localPath(root,block.source_contract),'utf8')),proof=source.proofs?.[0];
  if(!Number.isInteger(block.opcode)||block.opcode<0||block.opcode>255
    ||block.id!=='task-f378-opcode-'+block.opcode.toString(16).padStart(2,'0')||!label(block.handler)
    ||source.rom_sha256!==romHash||source.source_graph?.native_binding!==false||source.source_graph?.local_source_complete!==true
    ||JSON.stringify(source.proofs?.map(p=>p.entry))!==JSON.stringify(block.entries)
    ||source.proofs.some(p=>p.native_binding!==false||p.local_source_complete!==true)
    ||proof.opcode!==block.opcode||proof.target!==block.handler)throw Error('Dispatch block source drift');
}
export async function validateNativeOpcodeBlock(root,block,romHash){
  await validateManualTaskEvidence(root,block,romHash);
  const source=JSON.parse(await readFile(localPath(root,block.source_contract),'utf8')),p=source.proofs?.[0];
  if(source.rom_sha256!==romHash||source.source_graph?.native_binding!==false
    ||source.source_graph.local_source_complete!==true||source.proofs.length!==1||p.entry!=='80:F390'
    ||p.native_binding!==false||p.local_source_complete!==true||p.source_closed_to_dispatch!==true
    ||p.opcode!==0x58||p.target!=='80:F4CB'||p.external_return_assumptions!==0||p.full_task_binding!==false
    ||p.global_stack_minimum!==null||JSON.stringify(p.parts?.map(p=>p.proof.entry))!==JSON.stringify(['80:F4CB','80:F4F6','80:F52F','80:F509']))
    throw Error('Native58 composition source drift');
  if(block.callee!==null){
    const admitted=p.admitted_targets;
    if(!label(block.callee)||admitted?.length!==1||admitted[0].target!==block.callee||admitted[0].id!==block.native_function_id
      ||block.id!=='task-f378-native-opcode-'+block.callee.slice(3).toLowerCase())throw Error('Native58 composition target drift');
  }else {
    const {nativeOpcodeSpecs}=await import('./task-native-opcode-specs.mjs');
    if(block.id!=='task-f378-native-opcode'||JSON.stringify(p.admitted_targets?.map(t=>[t.id,t.target]))
      !==JSON.stringify(nativeOpcodeSpecs.map(s=>[s.id,'80:'+(s.entry&65535).toString(16).toUpperCase()])))throw Error('Native58 common admission drift');
  }
}
export async function validateScriptOpcodeBlock(root,block,romHash){
  await validateManualTaskEvidence(root,block,romHash);
  const source=JSON.parse(await readFile(localPath(root,block.source_contract),'utf8')),p=source.proofs?.[0];
  if(source.rom_sha256!==romHash||source.source_graph?.native_binding!==false||source.source_graph.local_source_complete!==true
    ||source.proofs.length!==1||p.entry!=='80:F390'||p.native_binding!==false||p.local_source_complete!==true
    ||p.opcode!==0x52||p.target!=='80:F460'||p.external_return_assumptions!==0||p.full_task_binding!==false
    ||p.global_stack_minimum!==null||p.script_id!==block.script_id||p.script_header!==block.script_header
    ||JSON.stringify(p.parts?.map(p=>p.proofs.map(p=>p.entry)))!==JSON.stringify([['80:F460'],['80:F488','80:F495']]))
    throw Error('Script52 composition source drift');
  if(block.script_id===null){if(block.id!=='task-f378-script-opcode'||p.anchors.length!==0)throw Error('Script52 common contract drift');}
  else if(!Number.isInteger(block.script_id)||block.script_id<0||block.script_id>65535
    ||block.id!=='task-f378-script-opcode-'+block.script_id.toString(16).padStart(3,'0')||p.anchors.length!==5||!label(block.script_header))
    throw Error('Script52 ID evidence drift');
}
