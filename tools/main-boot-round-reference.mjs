// Test-only original C1CA/C1E3 flow with existing source-proved visit, opcode,
// Native9F, leaf and resume contracts. No ScriptInterpreter runs in this path.
import assert from 'node:assert/strict';
import {decodeWindows} from './task-native-dialog-harness.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {runReference} from './w65c816-reference.mjs';
import {taskStop} from '../src/task/plan.mjs';
import {bootReferenceView} from './main-boot-reference-view.mjs';
import {runTaskVisit} from '../proof/task/visit-c1ca.mjs';
import {runTaskOpcodeSequence} from '../proof/task/opcode-sequence.mjs';
import {runTaskOpcodeTarget} from '../proof/task/opcode-target.mjs';
import {runTaskNativeArguments} from '../proof/task/native-arguments.mjs';
import {runTaskNativeBridge} from '../proof/task/native-bridge.mjs';
import {runTaskNativeDispatch} from '../proof/task/native-dispatch.mjs';
import {runTaskNativeResume} from '../proof/task/native-resume.mjs';
import {runTaskNativeWait,runTaskNativeWaitResume} from '../proof/task/native-wait.mjs';
import {BOOT_NATIVE_CONTRACTS} from './main-boot-native-contracts.mjs';
import {finishInterruptObservations} from '../src/task/main-wait-interrupt.mjs';
import {isIoAddress} from '../src/vm/devices.mjs';
import {nativeOpcodeTargets} from '../src/task/native-opcode-targets.mjs';
import {renderAddress} from '../src/render/data.mjs';

const windows=[{start:0x80C1CA,hex:'AD500248AE4C028E5002300820F9C1F48080ABAB688D500260'},
  {start:0x80C1E3,hex:'AE5002300520F9C180F6AD4C028D5002F48080ABAB60'}],map=decodeWindows(windows);
assertPinnedTaskSource(map,windows);
function visitPlan(mem,options){
 const view=bootReferenceView(mem,options),a=view.accessor;
 try{
  // The same source occurrences that own C20A in visit-opcodes.mjs. Each
  // actual fresh return is checked and retired before its postrun is applied.
  const inner=new Map(),steps=[],visits=[],ioTrace=[],nestedStats=[],key=s=>renderAddress((s+1)&65535);let specialIndex=0;
  const adapted={...a,pushWord(value,label){
    a.pushWord(value,label);
    if(['visit-JSR-F378','visit-PEA-continuation-return'].includes(label)){
      if(value!==0xC20A)taskStop('task_visit_inner_source_required');
      inner.set(key(a.ctx.s),[key(a.ctx.s),renderAddress((a.ctx.s+2)&65535)]);
    }
  },readWord(address,wrap=24,label='WORD',outer=false){
    const owned=outer&&wrap===16?inner.get(renderAddress(address)):null;
    if(!owned)return a.readWord(address,wrap,label,outer);
    const raw=a.readWord(address,wrap,label+'-owned-inner');
    if(raw!==0xC20A)taskStop('task_visit_inner_return_required');inner.delete(renderAddress(address));return raw;
  }};
  const owners=()=>[...options.protectedStackBytes,...Array.from(inner.values()).flat()];
  // Select the existing contract; it still performs the actual fresh C3C9
  // readiness check and verifies the continuation AFTER that check. A stored
  // F508 alone grants no readiness or immediate F509 occurrence.
  const slot=a.ctx.x;
  if(slot>0x5E||(slot&1))taskStop('boot_visit_slot_required');
  const saved=adapted.readWord(a.ctx.bank*65536+0x2B2+slot,24,'boot-observed-continuation');
  let result=saved===0xF508?runTaskNativeWaitResume(adapted,options):runTaskVisit(adapted);visits.push(result);
  while(result.frontier==='80:F390'){
    if(steps.length===1024)taskStop('boot_visit_handler_bound_required');
    const opcode=a.ctx.x,local={maxHandlers:1,native58Composition:true,script52Composition:true,
      statusReturnComposition:true,allowCurrentStackReturn:true,protectedStackBytes:owners()};
    if(opcode===0x58){
      assert.equal(runTaskOpcodeTarget(adapted).target,0x80F4CB);
      const args=runTaskNativeArguments({...adapted,entry:0x80F4CB});runTaskNativeBridge(adapted,owners());
      // The fresh bridge pointer is read AFTER the argument writes. No ID
      // lookahead or cached pointer chooses the Native9F/leaf branch.
      const target=0x800000|adapted.readWord(0xA2,16,'boot-fresh-native-pointer');
      if(target===0x80C401){a.ctx.pc=0xC401;result=runTaskNativeWait(adapted);
        if(result.savedContinuationWord!==0xF508)taskStop('task_native_wait_continuation_required');}
      else{let callee;
        const special=BOOT_NATIVE_CONTRACTS.get(target);
        if(special){
          if(args.id!==special.id||args.freshId!==special.id||args.metadataWord!==special.metadata)taskStop('boot_special_argument_source_required');
          // Each special has its own source contract; none is admitted as a
          // leaf. All observation cursors stay in the private visit.
          const set=options.specialSets[specialIndex];
          if(set?.target!==target)taskStop('boot_special_observations_required',{target,specialIndex});
          let ioIndex=0;
          const events={interrupts:set.interrupts,interruptIndex:0,interruptRoutines:set.interruptRoutines,
            dmaTransfers:set.dmaTransfers,dmaIndex:0};
          const observed={...adapted,absoluteRead(offset,width,pc){
            const address=a.ctx.bank*65536+offset;
            if(!isIoAddress(address))return adapted.absoluteRead(offset,width,pc);
            adapted.tick(width);const o=set.io[ioIndex++];
            if(!o||o.pc!==pc||o.address!==address||o.width!==width)taskStop('boot_special_io_required',{pc,address,width});
            ioTrace.push({kind:'read',...o});return o.value;
          },absoluteWrite(offset,value,width,pc){
            const address=a.ctx.bank*65536+offset;
            if(!isIoAddress(address))return adapted.absoluteWrite(offset,value,width,pc);
            adapted.tick(width);ioTrace.push({kind:'write',pc,address,width,value});
          }};
          let roundIndex=0;
          a.ctx.pc=target&65535;const observedOptions={interruptEvents:events,round:entry=>{
            const round=set.rounds?.[roundIndex++];
            if(entry!==0x80C1CA||round?.entry!==entry)taskStop('boot_nested_round_source_required',{entry,roundIndex});
            nestedStats.push(originalBootTaskRound({...observed,mem:view.memory,trace:ioTrace},round.sets,entry));
            return {};
          }};
          callee=special.run(observed,observedOptions);
          finishInterruptObservations(events);assert.equal(ioIndex,set.io.length);assert.equal(roundIndex,set.rounds?.length??0);specialIndex++;
        }else callee=runTaskNativeDispatch(adapted,false,nativeOpcodeTargets);
        if(callee.returnTarget!==0x80F509)taskStop('task_native_resume_target_required');
        if(a.ctx.d!==0||a.ctx.bank!==0x80||(a.ctx.status&0x30))taskStop('task_native_resume_context_required');
        result=runTaskNativeResume(adapted,owners(),0x82D970,true,special?.id??null);
        // The table is byte indexed: the high byte belongs to the next native.
        if(special&&result.resultPushed!==Boolean(special.result))taskStop('boot_special_return_source_required');}
      steps.push({opcode,target});
    }else{
      const ending=opcode===0x56?{task:a.readWord(0x250),frame:a.ctx.d,
        pointer:a.readWord(a.ctx.d,16),bank:a.read((a.ctx.d+2)&65535)}:null;
      result=runTaskOpcodeSequence(adapted,local).steps[0];steps.push(ending?{...result,endedTask:ending}:result);
    }
    if(result.frontier!=='80:F390'){
      if(result.returnTarget!==0x80C20B||inner.size!==0)taskStop('boot_visit_postrun_source_required');
      result=runTaskVisit({...adapted,entry:0x80C20B},{preservePostrunD:true});visits.push({...result,postrunOccurrenceProven:true});
    }
  }
  if(inner.size!==0)taskStop('boot_visit_inner_return_unused');
  return view.finish({...result,steps,visits,specials:specialIndex,ioTrace,nestedStats});
 }catch(error){if(!error?.taskBoundary)throw error;const {taskBoundary,...boundary}=error;return {handled:false,...boundary};}
}
export function originalBootTaskRound(a,specialSets=[],entry=0x80C1E3,onTaskEnd=null){const stats={visits:0,opcodes:0,natives:0,children:0,postruns:0,waits:0,resumes:0,specials:0,cameraReads:0,nestedRounds:0};
  assert.ok([0x80C1CA,0x80C1E3].includes(entry));let usedSpecials=0;
  const calls=new Map([[0x80C1F9,()=>{
    const rawReturn=a.stackWord();assert.ok([0xC1D8,0xC1EA].includes(rawReturn));
    const context=Object.freeze({...a.ctx}),options={entry:0x80C1F9,context,
      protectedStackBytes:Array.from({length:0x13F-context.s},(_,i)=>renderAddress(context.s+i+1))},
      plan=visitPlan(a.mem,{...options,specialSets:specialSets.slice(usedSpecials)});
    assert.equal(plan.handled,true,JSON.stringify(plan));assert.equal(plan.outputContext.pc,rawReturn+1);assert.equal(plan.outputContext.s,context.s+2);
    for(const access of plan.accesses)if(access.kind==='write')a.mem.write8(access.address,access.value);
    Object.assign(a.ctx,plan.outputContext);stats.visits++;
    stats.specials+=plan.specials;usedSpecials+=plan.specials;a.trace?.push(...plan.ioTrace);
    stats.cameraReads+=plan.cameraReads;
    for(const step of plan.steps){stats.opcodes++;if(step.opcode===0x58)stats.natives++;if(step.opcode===0x52)stats.children++;if(step.target===0x80C401)stats.waits++;
      if(step.endedTask)onTaskEnd?.(step.endedTask);}
    stats.postruns+=plan.visits.filter(v=>v.postrunOccurrenceProven).length;
    stats.resumes+=plan.visits.filter(v=>v.continuationOccurrenceProven&&v.continuationTarget===0x80F509).length;
    for(const nested of plan.nestedStats){stats.nestedRounds++;for(const key of Object.keys(stats))stats[key]+=nested[key];}
    return {rawReturnWord:plan.outerReturnWord};
  }]]);
  const before=new Map([...map.keys()].map(pc=>[pc,()=>{a.ctx.programBank=pc>>>16;a.ctx.pc=pc&65535;}]));
  runReference(map,a.mem,a.ctx,{entry,root:'RTS',calls,before,io:a.trace});
  assert.equal(usedSpecials,specialSets.length);return stats;
}
