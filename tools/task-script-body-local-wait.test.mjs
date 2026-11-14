import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {scriptBodySpecs} from '../proof/task/script-body-specs.mjs';import {prepareTaskScriptBody as start,prepareTaskScriptBodyResume as resume} from '../proof/task/script-bodies.mjs';
import {scriptBodyFixture,bodyCases,bodyWord as word,omitBodyBytes as omit} from './task-script-body-fixtures.mjs';
import {runWaitBodyFixture,resumeBodyFixture,waitBodyProbe} from './task-script-body-wait-fixtures.mjs';
import {localWaitBodyPCs} from './task-script-body-local-wait-fixtures.mjs';import {validateLocalBodyEvidence} from './progress.mjs';
import {prepared,commit,unchangedFailure} from './task-native-test-support.mjs';import {menuRecords} from './task-native-menu-fixtures.mjs';
const specs=scriptBodySpecs.filter(s=>s.localWaitBody);
function workspaceArguments(segment,id){
 const a=segment.accesses,from=a.findIndex(x=>x.kind==='write'&&x.label==='saved-ID-low'&&x.value===id),next=a.findIndex((x,n)=>n>from&&x.kind==='write'&&x.label==='saved-ID-low'),
  writes=a.slice(from,next<0?undefined:next).filter(x=>x.kind==='write'&&x.label.startsWith('native-argument-workspace-'));
 const values=[];for(let n=0;n<writes.length;n+=2)values.push(writes[n].value|(writes[n+1].value<<8));return values;
}
for(const s of specs)test(`Whole${s.id.toString(16)} proves every pending local return across real9F/countdowns/F509 and its actual helper effects/END`,async()=>{
 const source=JSON.parse(await readFile('analysis/render-task-script-bodies-local-wait.json')).proofs.find(p=>p.script_id===s.id),
  report=JSON.parse(await readFile('analysis/render-task-script-bodies-local-wait-native.json')),pcs=localWaitBodyPCs(s),seen=new Set();
 assert.equal(source.local_return_graph.max_local_depth,1);assert.equal(source.local_return_graph.max_handlers,s.id===0x210?90:100);
 for(const v of bodyCases(s)){
  const run=runWaitBodyFixture(s,v),{fixture:f,plan:p,segments}=run,expectedCalls=source.local_return_graph.call_sites;
  assert.equal(p.bodyComplete,true);assert.equal(p.resultWord,0xBEEF);assert.equal(p.returnTarget,0x80C20B);assert.equal(p.fullTaskBinding,false);
  assert.deepEqual(p.bodyPCs,pcs);assert.equal(p.observedReadinessEntries,s.id===0x210?38:840);assert.equal(segments.length,p.observedReadinessEntries+1);
  assert.equal(run.observations.filter(o=>o.kind==='synthetic-provider-event-byte').length,0);assert.equal(p.pendingLocalReturns.length,0);assert.equal(word(f.data,0x605),0x900);
  assert.equal(p.localReturnEvents.length,expectedCalls.length*2);
  for(const [n,call]of expectedCalls.entries()){
   const [c,r]=p.localReturnEvents.slice(n*2,n*2+2);assert.equal(c.kind,'call');assert.equal(r.kind,'return');assert.equal(c.callPC,call.pc);
   assert.equal(r.callPC,call.pc);assert.equal(r.returnWord,call.return_pc);assert.equal(r.freshPointer,0x900);assert.equal(r.originalPointer,0x8FE);
   assert.equal(r.pc,s.id===0x210?23:19);
  }
  for(const segment of segments){assert.ok(Object.isFrozen(segment.pendingLocalReturns));assert.ok(Object.isFrozen(segment.localReturnEvents));
   for(const pending of segment.pendingLocalReturns)assert.ok(Object.isFrozen(pending));
   if(segment.segmentHandlers===0&&segment.pendingLocalReturns.length){
    const reads=segment.accesses.filter(a=>a.kind==='read'&&a.label.startsWith('body-local-return-admission-'));
    assert.deepEqual(reads.map(a=>a.value),[0xFE,8,segment.pendingLocalReturns[0].returnPC,0]);
   }
  }
  const waits=p.steps.filter(p=>p.calleeEntry===0x80C401);assert.equal(waits.length,s.id===0x210?6:5);
  assert.ok(waits.every(p=>p.wordPops===2&&p.savedContinuationWord===0xF508));
  if(s.id===0x210){
   const audio=segments.filter(p=>p.steps.some(s=>s.calleeEntry===0x80C46E)&&p.accesses.some(a=>a.kind==='write'&&a.label==='saved-ID-low'&&a.value===0x4C));
   assert.equal(audio.length,4);for(const [n,p]of audio.entries())assert.deepEqual(workspaceArguments(p,0x4C),[16,74,[255,192,128,64][n],3]);
   assert.equal(f.data.readByte(0x801CE4).value,(v.token+(v.cachedVoice===3?8:9))&255);
  }else{
   const notices=segments.filter(p=>p.accesses.some(a=>a.kind==='write'&&a.label==='saved-ID-low'&&a.value===0xC8));
   const argumentsExpected=[[2,2,21,4,1024,59,240],[8,5,22,3,1024,60,180],[2,2,19,3,1024,61,240],[6,4,24,4,1024,62,300],[2,2,9,3,1024,63,120]];
   assert.equal(notices.length,5);for(const [n,p]of notices.entries())assert.deepEqual(workspaceArguments(p,0xC8),argumentsExpected[n]);
   const stores=segments[0].accesses.filter(a=>a.kind==='write'&&a.label.startsWith('leaf-long-WORD'));
   assert.deepEqual(stores.map(a=>[a.address,a.value]),v.pointer?[[0x7E4003,0x38],[0x7E4004,0x15]]:[]);
  }
  for(let n=1;n<pcs.length;n++)seen.add(pcs[n-1]+':'+pcs[n]);
  assert.deepEqual(report.probes.find(p=>p.script_id===s.id&&p.case===v.name),waitBodyProbe(s,v));
 }
 assert.deepEqual([...seen].sort(),[...new Set(source.local_return_graph.edges.map(e=>e.from+':'+e.to))].sort());
});
for(const s of specs)test(`Local-wait${s.id.toString(16)} rejects changed returnhigh/pointer, foreign brands/providers and readiness budgets without new effects`,()=>{
 const f=scriptBodyFixture(s,bodyCases(s)[0]);let p=commit(start,f);
 while(!p.pendingLocalReturns.length){const next=resumeBodyFixture(s,f,p);p=commit(resume,next);}
 const options=resumeBodyFixture(s,f,p),pending=p.pendingLocalReturns[0];
 unchangedFailure(resume,options,{continuation:{...p}},'task_script_body_continuation_required');
 unchangedFailure(resume,omit(options,0x901),{},'task_script_body_continuation_required');
 f.data.seed(0x901,[1]);unchangedFailure(resume,options,{},'task_script_body_local_return_required');f.data.seed(0x901,[0]);
 f.data.seed(0x605,[0xFC]);unchangedFailure(resume,options,{},'task_script_body_local_owner_required');f.data.seed(0x605,[0xFE]);
 assert.equal(word(f.data,0x900),pending.returnPC);
 const q=prepared(resume,options);assert.equal(q.segmentHandlers,0);assert.deepEqual(q.pendingLocalReturns,p.pendingLocalReturns);
 unchangedFailure(resume,options,{maxWork:q.work-1},'task_work_budget_required');unchangedFailure(resume,options,{maxOutputBytes:q.outputBytes-1},'task_output_budget_required');
 prepared(resume,{...options,maxWork:q.work,maxOutputBytes:q.outputBytes});
 const blocked=commit(resume,options);unchangedFailure(resume,options,{},'task_script_body_continuation_required');
 const fresh=resumeBodyFixture(s,f,blocked);assert.equal(prepared(resume,fresh).localReturnEvents.length,p.localReturnEvents.length);
});
test('Local-wait evidence requires each frozen pending owner through every independently observed readiness entry',async()=>{
 const source=JSON.parse(await readFile('analysis/render-task-script-bodies-local-wait.json')),native=JSON.parse(await readFile('analysis/render-task-script-bodies-local-wait-native.json'));
 for(const proof of source.proofs){const probes=native.probes.filter(p=>p.script_id===proof.script_id);validateLocalBodyEvidence(proof,probes);
  for(const mutate of [p=>p[0].local_return_checkpoints.splice(2,1),p=>p[0].local_return_checkpoints.find(c=>c.pending.length).pending[0].returnPC^=256,
   p=>p[0].local_return_checkpoints[1].readiness_entries++,p=>p[0].local_return_checkpoints[1].events++]){
   const changed=structuredClone(probes);mutate(changed);assert.throws(()=>validateLocalBodyEvidence(proof,changed));
  }
 }
});
test('Late original C8/text failure withholds the ready segment and its next pending localcall while retaining prior real yields',()=>{
 const s=specs.find(s=>s.id===0x2D0),f=scriptBodyFixture(s,bodyCases(s)[0]);let p=commit(start,f);
 while(word(f.data,0x800C04)!==1)p=commit(resume,resumeBodyFixture(s,f,p));
 const ready=resumeBodyFixture(s,f,p),q=prepared(resume,ready);
 assert.equal(q.bodySuspended,true);assert.equal(q.pendingLocalReturns[0].callPC,50);assert.equal(p.pendingLocalReturns[0].callPC,29);
 unchangedFailure(resume,ready,{ioObservations:menuRecords(ready.ioObservations.slice(0,-1))},'task_io_observation_required');
 unchangedFailure(resume,ready,{waitObservations:menuRecords(ready.waitObservations.slice(0,-1))},'task_wait_observation_required');
 unchangedFailure(resume,ready,{maxWork:q.work-1},'task_work_budget_required');unchangedFailure(resume,ready,{maxOutputBytes:q.outputBytes-1},'task_output_budget_required');
 const high=s.scriptEntry+2+s.bytecode.length;f.data.seed(high,[s.fetchTail^1]);
 unchangedFailure(resume,ready,{},'task_script_body_bytes_required');f.data.seed(high,[s.fetchTail]);
 prepared(resume,{...ready,maxWork:q.work,maxOutputBytes:q.outputBytes});
});
