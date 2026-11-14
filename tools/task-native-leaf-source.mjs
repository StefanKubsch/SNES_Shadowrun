import {readFile,writeFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset,cpuLabel} from './rom.mjs';
import {decodeTaskWindows,taskRomHash,taskHash} from './task-partial-source.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
import {formatBlock} from './disassemble.mjs';

export function proveLeafSource(map,spec) {
  assertPinnedTaskSource(map,spec.windows);
  const localStack=spec.maximumLocalStackBytes??0;
  const proof=proveWordStack(map,spec.entry,'RTS',{measureStack:true,peiWordPushes:new Map(spec.peiWordPushes??[]),dataPulls:new Set(spec.dataPulls??[]),interruptReturns:new Set(spec.interruptReturns??[])});
  if(proof.external_return_assumptions!==0||proof.maximum_local_stack_bytes!==localStack||proof.minimum_protected_stack_bytes!==localStack+2
    ||proof.reachable_instructions!==map.size||proof.returns.some(r=>r.m!==0||r.x!==0||r.dbr!=='entry'))throw Error('Leaf stack/mode drift');
  const events=[...map.values()].sort((a,b)=>a.cpu-b.cpu).filter(i=>!['i','A','immM','immX','imm8','rel8'].includes(i.mode)
    &&!(spec.peiWordPushes&&['JSR','JSL','JMP'].includes(i.mnemonic)))
    .map(i=>({at:cpuLabel(i.cpu),operation:i.mnemonic,mode:i.mode,operand:i.value,width:i.state.m?1:2,
      address_contract:spec.peiWordPushes&&['di','dil'].includes(i.mode)?'actual bank00 D0 fresh WORD/long pointer bytes; PEI WORD high/low stack push or indirect data24bit':['dp','dpx','dily'].includes(i.mode)?'actual bank00 D0; pointer bytes fresh; indirect data24bit':'actualDBR absolute/absoluteY24bit or explicit long/longX24bit; full WORD index, no clamp'}));
  return {...proof,native_binding:false,local_source_complete:true,source_closed_to_dispatch:false,full_graph_closed:true,
    global_stack_minimum:null,root_return:'RTS',return_target_executed:false,data_events:events,
    ...(spec.peiWordPushes?{inner_calls:[...map.values()].filter(i=>['JSR','JSL'].includes(i.mnemonic)).map(i=>({
      at:cpuLabel(i.cpu),target:cpuLabel(i.target),continuation:cpuLabel(i.next),return_word:(i.next-1)&65535,
      ownership:'actual bank00 current-S high/low push; fresh RTS low/high checked before continuation',
      ...(spec.mixedReturnFrames?{kind:i.mnemonic,return_kind:i.mnemonic==='JSL'?'RTL':'RTS',return_bytes:i.mnemonic==='JSL'?3:2,
       ...(i.mnemonic==='JSL'?{return_bank:i.cpu>>>16}:{}),ownership:'actual pushed bytes; fresh matching WORD/bank consumed before fixed continuation'}:{})}))}:{}),
    qualification:spec.helperReturnContract??(spec.mixedReturnFrames?spec.contract:spec.name==='native-a8f5'?'Complete pinned A8F5/AA4C helper graph, real inner A8F7 JSR/RTS and two local stack bytes under intact code/stack. E0M0X0D0/entry DBR preserved. Fresh linked count, list and full indices, no bounds/termination/input initialization inferred. Binary ADC and atomic access/output budgets required; no whole Task/scene/frame proof.':spec.peiWordPushes?'Complete pinned D15C/A985/AAAF helper graph with individually proved PEI04/00 WORD pushes, real nested JSR/RTS and six local stack bytes under intact stack/code. E0M0X0D0/entry DBR restored at root RTS; actual internal return words and aliases checked natively. Binary ADC/SBC, fresh data, no initialization/wholeTask/scene/frame proof.':'Complete pinned call-free original Native58 callee through typed RTS, E0/M0/X0/D0; original BYTE path only where source SEP20/REP20. Binary required for ADC/SBC. Fresh physical bytes, full indices and intact code/protected two-byte outer return required. Structural graph only, no input initialization, temporal occurrence, wholeTask/native dispatch/scene/frame proof.')};
}
export async function emitLeafSource(spec) {
  const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
  if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
  const {map,blocks,windows}=decodeTaskWindows(bytes,spec.windows);
  for(const w of windows){const literal=spec.windows.find(s=>cpuLabel(s.start)===w.entry);if(w.machine_bytes!==literal.hex)throw Error('Leaf source literal drift');}
  const anchors=spec.anchors.map(a=>{
    const raw=bytes.subarray(cpuToOffset(a.start,bytes.length),cpuToOffset(a.start,bytes.length)+2);
    if(raw.toString('hex').toUpperCase()!==a.hex)throw Error('Native58 anchor drift');
    return {kind:a.kind,entry:cpuLabel(a.start),machine_bytes:a.hex,sha256:taskHash(raw)};
  });
  const proof=proveLeafSource(map,spec),report={rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',
    scope:'Original Native58 callee local source contract; full Task dispatch and actual caller occurrence remain separate.',
    windows,proofs:[proof],native_function_id:spec.id,anchors,
    source_graph:{local_source_complete:true,source_closed_to_dispatch:false,full_graph_closed:true,native_binding:false,
      classification:spec.peiWordPushes?'native58-helper-graph-source':'native58-leaf-source',code_bytes:windows.reduce((n,w)=>n+w.covered_bytes,0),instructions:map.size},
    contract:spec.contract};
  await writeFile(`analysis/render-task-${spec.name}.json`,JSON.stringify(report,null,2)+'\n');
  await writeFile(`analysis/render-task-${spec.name}.asm.txt`,blocks.map(formatBlock).join('\n'));
  console.log(`${spec.name}: ${report.source_graph.code_bytes}/${map.size}, exact original Native58 ID${spec.id}, local RTS proof; wholeTask OPEN.`);
}
