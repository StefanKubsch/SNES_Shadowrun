import {readFile} from 'node:fs/promises';
import {cpuLabel,cpuToOffset} from './rom.mjs';
import {decodeTaskWindows,taskHash,taskRomHash} from './task-partial-source.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
export const opcodeDispatchWindow={start:0x80F390,hex:'7CB4F2'};
export function proveOpcodeTarget(map){
  assertPinnedTaskSource(map,[opcodeDispatchWindow]);
  const i=map.get(0x80F390);
  if(i.mode!=='indx'||i.value!==0xF2B4)throw Error('Original F390 indexed JMP required');
  return {entry:'80:F390',native_binding:false,local_source_complete:true,external_return_assumptions:0,
    minimum_protected_stack_bytes:null,global_stack_minimum:null,
    table:{bank:'80',low:'(F2B4+full WORD X)&FFFF',high:'(F2B4+full WORD X+1)&FFFF',width:2,
      directPageApplied:false,dataBankApplied:false,asl:false,opcodeClamp:false,parityGuard:false},
    effects:'PC=fresh low|(fresh high<<8); all registers, S, flags, D and DBR unchanged; no return frame or data write.',
    frontier:'Observed target only; target execution requires a separately pinned slot, handler source and native equation.',
    full_task_binding:false};
}
export async function proveOpcodeBinding(bytes,spec){
  const path=`analysis/render-task-${spec.family}.json`,source=JSON.parse(await readFile(path));
  if(source.rom_sha256!==taskRomHash)throw Error('Handler ROM drift');
  const windows=source.windows.map(w=>{
    const start=parseInt(w.entry.replace(':',''),16),off=cpuToOffset(start,bytes.length),raw=bytes.subarray(off,off+w.covered_bytes);
    if(raw.toString('hex').toUpperCase()!==w.machine_bytes||taskHash(raw)!==w.sha256)throw Error('Handler window drift');
    return {start,hex:w.machine_bytes};
  });
  const decoded=decodeTaskWindows(bytes,windows),proofModule=await import(`./render-task-${spec.family}-source-proof.mjs`);
  const renewed=proofModule[spec.proofExport](decoded.map,spec.target);
  const handlerProof=Array.isArray(renewed)?renewed.find(p=>p.entry===cpuLabel(spec.target)):renewed;
  const saved=Object.values(source).filter(Array.isArray).flat().find(p=>p?.entry===cpuLabel(spec.target)&&p.native_binding===false);
  const olderTypedProof=spec.family==='end-return'||/^(multiply|divide|remainder)-/.test(spec.family);
  if(!saved||JSON.stringify(saved)!==JSON.stringify(handlerProof)
    ||(handlerProof.external_return_assumptions===undefined?!olderTypedProof:handlerProof.external_return_assumptions!==0))throw Error('Handler source proof drift');
  // Arithmetic proofs deliberately leave dynamic dispatch open. Renew their
  // complete local edge/width ledger; this admits only the fixed body and an
  // explicit observation stream, never hardware results or loop termination.
  let admission;
  if(spec.frontier){
    if(spec.frontier==='actual-outer-return-target'){
      const rts=spec.family==='end-return'?0x80F4CA:spec.family==='status-return'?0x80F952:null;
      if(rts===null||decoded.map.get(rts)?.mnemonic!=='RTS')throw Error('Typed original return required');
    }else if(handlerProof.frontier?.at!==spec.frontier)throw Error('Explicit prefix frontier required');
    admission={frontier:spec.frontier,continues:false,targetExecuted:false,
      reason:'Complete fixed prefix only. Further handler count rejects the whole plan before outer commit.'};
  }else if(!handlerProof.source_closed_to_dispatch){
    const edges=handlerProof.edges;
    if(!Array.isArray(edges)||!handlerProof.visited.includes('80:F390')
      ||!edges.some(e=>e.to==='80:F390')||edges.filter(e=>e.to==='80:F390').some(e=>e.m!==0||e.operand_s_delta!==2))
      throw Error('Complete arithmetic F390 width/stack edges required');
    admission={frontier:'80:F390',continues:true,external_return_assumptions:0,
      reason:'Renewed pinned arithmetic edges join WORD F390 with S+2; actual MMIO observations and budgets remain mandatory.'};
  }
  // Older control/sign proofs pin their finite paths but have no output_mode
  // field. Audit every instruction on those paths; none may alter E/M/X.
  let modeProof;
  if(!handlerProof.output_mode&&!handlerProof.edges){
    const preserving=new Set(['PLA','PHA','LDA','LDX','STA','STY','INY','TAY','TYA','TAX','TXY','TSC','AND','ASL','LSR','INX','DEY','DEC','INC','CMP','BCC','BEQ','BNE','ORA','JMP','TCS','TCD','RTS']);
    const visited=[...new Set(handlerProof.paths?handlerProof.paths.flatMap(p=>p.visited):handlerProof.visited??handlerProof.graph?.visited??[])];
    if(!visited.length)throw Error('Missing pinned mode path');
    for(const label of visited){
      const i=decoded.map.get(parseInt(label.replace(':',''),16));
      if(!i||!preserving.has(i.mnemonic)||['e','m','x'].some(k=>i.state[k]!==0))throw Error('Unproved handler output mode');
    }
    modeProof={e:0,m:0,x:0,visited,reason:'All pinned finite-path instructions preserve E/M/X; entry E0/M0/X0.'};
  }else if(handlerProof.edges){
    modeProof={e:0,m:0,x:0,reason:'Renewed arithmetic edge ledger checks every SEP/REP width and WORD F390 join, with no E/X-changing instruction.'};
  }else if(['e','m','x'].some(k=>handlerProof.output_mode[k]!==0))throw Error('Non-WORD handler output mode');
  const address=0x80F2B4+spec.opcode,off=cpuToOffset(address,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.readUInt16LE()!==(spec.target&65535))throw Error('Original opcode slot drift');
  const fetch=windows.find(w=>w.start===0x80F389);
  if(!spec.frontier&&fetch?.hex!=='B100C829FF00AA7CB4F2')throw Error('Fresh handler fetch required');
  return {...proveOpcodeTarget(decodeTaskWindows(bytes,[opcodeDispatchWindow]).map),opcode:spec.opcode,target:cpuLabel(spec.target),
    slot:{address:cpuLabel(address),machine_bytes:raw.toString('hex').toUpperCase(),sha256:taskHash(raw)},
    handler_source:path,handler_windows:source.windows,handler_proof:handlerProof,
    ...(modeProof?{handler_output_mode:modeProof}:{}),...(admission?{handler_admission:admission}:{}),
    stack:'Opcode JMP adds no return frame. Existing operand stack and all explicitly protected outer return owners share one overlay; reject every protected byte alias.',
    composition:spec.frontier?'Only this pinned index/target pair is admitted through its explicit terminal prefix frontier. Further continuation rejects the whole plan. Finite handler count, cumulative budgets and one outer commit.':'Only this pinned index/target pair is admitted. E0M0X0 and source-specific decimal premises; handler ends at fresh F390. Explicit finite handler count and cumulative access/output budgets, one outer commit.',
    boundary:'Unbound index/target, changed table, mode, byte source, stack owner, write window, budget or stale owner rejects whole plan. No yield/migration/return/wholeTask/scene/frame binding.'};
}
