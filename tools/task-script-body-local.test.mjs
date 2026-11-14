import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {scriptBodySpecs} from '../proof/task/script-body-specs.mjs';import {proveLocalBodyFlow} from '../proof/task/script-body-local-flow.mjs';
import {scriptBodyFixture,bodyCases,bodyWord as word,omitBodyBytes as omit} from './task-script-body-fixtures.mjs';
import {localBodyPCs} from './task-script-body-local-fixtures.mjs';import {bodyProbe} from './task-script-body-artifacts.mjs';
import {prepareTaskScriptBody as start} from '../proof/task/script-bodies.mjs';import {prepared,commit,unchangedFailure} from './task-native-test-support.mjs';
import {menuRecords} from './task-native-menu-fixtures.mjs';
import {createRenderData} from '../src/render/data.mjs';
import {validateLocalBodyEvidence} from './progress.mjs';
const s=scriptBodySpecs.find(s=>s.id===0x29A),prices=[300,700,1000,2000,3000,4000,5000,6000,7000,8000];
test('Whole29A executes all ten real localcalls/50 reads plus high-WORD nonmatches, helper effects and actual END',async()=>{
 const report=JSON.parse(await readFile('analysis/render-task-script-bodies-local-native.json')),graph=proveLocalBodyFlow(s.instructions),edges=new Set();
 assert.deepEqual(s.header,[6,4]);assert.equal(s.bytecode.length,232);assert.equal(s.instructions.length,103);
 assert.equal(graph.max_local_depth,1);assert.equal(graph.call_sites.length,10);assert.deepEqual(graph.return_sites,[23]);
 for(const v of bodyCases(s)){
  const f=scriptBodyFixture(s,v),p=commit(start,f),pcs=localBodyPCs(s,v),hasCall=v.counter<10;
  assert.equal(p.bodyComplete,true);assert.equal(p.resultWord,0xBEEF);assert.equal(p.returnTarget,0x80C20B);assert.equal(p.fullTaskBinding,false);
  assert.deepEqual(p.bodyPCs,pcs);assert.equal(p.handlersExecuted,pcs.length);for(let n=1;n<pcs.length;n++)edges.add(pcs[n-1]+':'+pcs[n]);
  assert.equal(word(f.data,0x7E3BBF),(v.counter+1)&65535);assert.equal(word(f.data,0x605),0x900);
  assert.equal(p.localReturnEvents.length,hasCall?2:0);
  if(hasCall){
   const [call,ret]=p.localReturnEvents,site=graph.call_sites[v.counter],price=prices[v.counter];
   assert.deepEqual(call,{kind:'call',pc:site.pc,callPC:site.pc,returnPC:site.return_pc,destination:0x900,newPointer:0x8FE,freshPointer:0x900,target:3});
   assert.deepEqual(ret,{kind:'return',pc:23,callPC:site.pc,returnPC:site.return_pc,destination:0x900,newPointer:0x8FE,originalPointer:0x8FE,freshPointer:0x900,returnWord:site.return_pc});
   assert.equal(word(f.data,0x9F0900),site.return_pc);assert.equal(word(f.data,0x615),price);assert.equal(word(f.data,0x617),0xD4+v.counter);
   const writes=p.accesses.filter(a=>a.kind==='write'&&a.label.startsWith('saved-local-return-'));
   const reads=p.accesses.filter(a=>a.kind==='read'&&a.label.startsWith('saved-local-return-'));
   assert.deepEqual(writes.map(a=>[a.address,a.value]),[[0x9F0900,site.return_pc],[0x9F0901,0]]);
   assert.deepEqual(reads.map(a=>[a.address,a.value]),writes.map(a=>[a.address,a.value]));
   const sum=(v.low??0)+price,carry=sum>65535,high=((v.high??0)+Number(carry))&65535,saturated=carry&&high===0;
   assert.equal(word(f.data,0x7E3C0D),saturated?65535:sum&65535);assert.equal(word(f.data,0x7E3C0F),saturated?65535:high);
  }else{assert.equal(word(f.data,0x9F0900),0xA5A5);assert.equal(word(f.data,0x7E3C0D),v.low??0);}
  assert.equal(p.observationsUsed,f.ioObservations.length);assert.equal(p.waitObservationsUsed,f.waitObservations.length);
  assert.equal(p.inputObservationsUsed,0);assert.deepEqual(report.probes.find(p=>p.script_id===s.id&&p.case===v.name),bodyProbe(s,v));
  assert.equal(pcs.includes(220),v.counter===9);
  if(v.counter===9){const pointer=s.romReads.find(r=>r.address===0x8DB020+0x1B66).value;assert.equal(f.data.readByte(0x7E0001+pointer).value,128);}
 }
 assert.deepEqual([...edges].sort(),[...new Set(graph.edges.map(e=>e.from+':'+e.to))].sort());
});
test('Local return ownership, byte writes, fresh high/late observation and exact budget failures are atomic',()=>{
 const f=scriptBodyFixture(s,bodyCases(s)[0]),p=prepared(start,f);
 for(const address of [0x605,0x606,s.scriptEntry+s.bytecode.length+2])unchangedFailure(start,omit(f,address),{},'render_source_required');
 // Initial saved bytes are never read before the actual call store.
 prepared(start,omit(f,0x9F0900,0x9F0901));
 const alias=scriptBodyFixture(s,{...bodyCases(s)[0],returnPointer:0x605});
 unchangedFailure(start,alias,{},'task_script_body_local_owner_required');
 // Denied highbyte after the private lowbyte store must commit neither.
 const denied=createRenderData({writeWindows:[[0x7E0000,0x7E0900],[0x7E0902,0x7FFFFF]]});
 for(const [address,value]of f.data.snapshot().bytes)denied.seed(address,[value]);
 unchangedFailure(start,{...f,data:denied},{},'render_write_window_required');
 // Actual helper local-price stores corrupt the return, including its high.
 // Explicit bytes at the altered fetch address let the handler finish its
 // real read/fetch; ownership must still reject, never use a cached return.
 const corrupted=scriptBodyFixture(s,{...bodyCases(s)[0],returnPointer:0x615});
 const alteredReturn=300,alteredFetch=s.scriptEntry+2+alteredReturn;
 corrupted.data.seed(alteredFetch,[0x56,0]);
 unchangedFailure(start,corrupted,{},'task_script_body_local_return_required');
 for(const [key,reason]of [['waitObservations','task_wait_observation_required'],['ioObservations','task_io_observation_required']])
  unchangedFailure(start,f,{[key]:menuRecords(f[key].slice(0,-1))},reason);
 unchangedFailure(start,f,{maxWork:p.work-1},'task_work_budget_required');unchangedFailure(start,f,{maxOutputBytes:p.outputBytes-1},'task_output_budget_required');
 unchangedFailure(start,f,{maxHandlers:f.maxHandlers-1},'task_script_body_handler_count_required');
 prepared(start,{...f,maxWork:p.work,maxOutputBytes:p.outputBytes});
});
test('Expanded original local graph rejects unmatched returns, recursion, loops, pending-END and yield',()=>{
 for(const mutate of [i=>i.map(x=>x.pc===0?{...x,operand:23}:x),i=>i.map(x=>x.pc===3?{...x,opcode:0x4C,flow:'local_call',operand:3,length:3}:x),
  i=>i.map(x=>x.pc===44?{...x,operand:0}:x),i=>i.map(x=>x.pc===23?{...x,opcode:0x56,flow:'end'}:x),
  i=>i.map(x=>x.pc===9?{...x,operand:0x9F}:x)])assert.throws(()=>proveLocalBodyFlow(mutate(s.instructions)));
});
test('Canonical local evidence rejects fabricated saved highs, missing calls, mismatched LIFO and omitted paths',async()=>{
 const proof=JSON.parse(await readFile('analysis/render-task-script-bodies-local.json')).proofs[0],probes=JSON.parse(await readFile('analysis/render-task-script-bodies-local-native.json')).probes;
 validateLocalBodyEvidence(proof,probes);
 for(const mutate of [p=>p[0].local_return_events[1].returnWord^=256,p=>p[0].local_return_events[1].originalPointer^=2,
  p=>p[0].local_return_events.shift(),p=>p.splice(9,1),p=>{
   p[0].local_return_events=structuredClone(p[1].local_return_events);
  },p=>p[0].handlers--]){
  const changed=structuredClone(probes);mutate(changed);assert.throws(()=>validateLocalBodyEvidence(proof,changed));
 }
 const changed=structuredClone(proof);changed.local_return_graph.call_sites[0].return_pc++;assert.throws(()=>validateLocalBodyEvidence(changed,probes));
});
