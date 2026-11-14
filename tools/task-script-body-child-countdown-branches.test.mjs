import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {childCountdownBodySpecs} from '../proof/task/script-body-child-countdown-specs.mjs';
import {countdownParentPCs,countdownParentHasText,countdownParentSelector,countdownRecord} from './task-script-child-countdown-parent-paths.mjs';
import {scriptBodyFixture as fixture,bodyWord as word,omitBodyBytes as omit} from './task-script-body-fixtures.mjs';
import {childBodyCases,runChildFixture,childNextOptions,childBodyProbe} from './task-script-body-child-fixtures.mjs';
import {prepareTaskScriptBody as start,prepareTaskScriptBodyChildEnter as enter,prepareTaskScriptBodyChildPostrun as post,
 prepareTaskScriptBodyResume as resume,prepareTaskScriptBodyParentResume as parent} from '../proof/task/script-bodies.mjs';
import {commit,prepared,unchangedFailure} from './task-native-test-support.mjs';import {menuRecords} from './task-native-menu-fixtures.mjs';
import {validateChildBodyEvidence} from './progress.mjs';
const specs=childCountdownBodySpecs.filter(s=>s.countdownBranchParent),at=id=>specs.find(s=>s.id===id);
for(const s of specs)test(`Whole${s.id.toString(16)} proves all original getter WORD thresholds/property/text branches, allocated child6F and fresh parent5B/END`,async()=>{
 const report=JSON.parse(await readFile('analysis/render-task-script-bodies-child-native.json'));
 for(const v of childBodyCases(s)){const {fixture:f,plan:p,segments}=runChildFixture(s,v),[prefix,childPrefix,postrun,child,finish]=segments,
  probe=childBodyProbe(s,v),text=countdownParentHasText(s,v),record=countdownRecord(s),pointer=record===5824?14741:14411,
  getterResults=s.id===0x1CF?[v.globalIndex,v.xRaw>>>2,v.globalIndex,v.yRaw>>>2]:[v.globalIndex,v.yRaw>>>2];
  assert.equal(segments.length,5);assert.deepEqual(p.bodyPCs,countdownParentPCs(s,v));assert.equal(prefix.scriptChildSuspended,true);
  assert.equal(prefix.childFrame,0x3D6);assert.equal(prefix.steps.at(-1).wordPops,1);assert.equal(prefix.parentSlot,2);assert.equal(prefix.childSlot,4);
  assert.ok(prefix.readAddresses.includes(0x7E0CC3));assert.ok(prefix.readAddresses.includes(0x7E0E81+v.globalIndex));
  if(s.id===0x1CF)assert.ok(prefix.readAddresses.includes(0x7E0E29+v.globalIndex));
  assert.deepEqual(probe.parent_getter_results,[...getterResults,...(text?[v.property]:[])]);
  const cc=prefix.steps.find(n=>n.calleeEntry===0x80D1CA),c8=prefix.steps.find(n=>n.calleeEntry===0x80FEC1);
  assert.equal(!!cc,text);assert.equal(!!c8,text);assert.equal(f.data.readByte(0x613).value,v.input&255);
  if(text){assert.equal(word(f.data,0x614),countdownParentSelector(s,v));assert.equal(word(f.data,0x616),v.property);
   assert.ok(prefix.readAddresses.includes(0x7E150B+(v.input&255)));assert.equal(cc.wordPops,1);assert.equal(cc.resultPushed,true);
   assert.equal(c8.arguments.wordPops,7);assert.equal(c8.callee.text.glyphs,10);assert.equal(c8.callee.text.newlines,0);
   assert.equal(prefix.observationsUsed,2);assert.equal(prefix.waitObservationsUsed,10);}
  else{assert.equal(prefix.observationsUsed,0);assert.equal(prefix.waitObservationsUsed,0);}
  assert.equal(childPrefix.bodySuspended,true);assert.equal(childPrefix.segmentHandlers,4);assert.equal(postrun.childPostrunReturned,true);
  assert.equal(postrun.returnTarget,0x8091D1);assert.equal(child.observedReadinessEntries,1);assert.equal(child.bodyComplete,true);
  assert.equal(word(f.data,0x3E9),record);assert.equal(f.data.readByte(0x7E0001+pointer).value,v.flags|2);assert.equal(child.resultWord,v.heap-33);
  assert.equal(finish.childCompletion,v.heap-33);assert.equal(finish.segmentHandlers,3);assert.equal(finish.steps.at(-2).calleeEntry,0x80A91D);
  assert.equal(finish.steps.at(-2).wordPops,1);assert.equal(finish.steps.at(-2).resultPushed,false);assert.equal(word(f.data,0x801350+(v.input&255)),65535);
  assert.equal(p.resultWord,0xBEEF);assert.equal(p.outputContext.s,0xB01);assert.equal(p.outputContext.d,0);assert.equal(word(f.data,0xB06),0x91D0);
  assert.equal(p.childPostrun.continuationTarget,0x80F495);assert.equal(p.childPostrun.resultPushed,false);
  assert.equal(word(f.data,0x8003D2),29);assert.equal(word(f.data,0x800BA4),0);assert.equal(word(f.data,0x800374),65535);
  assert.deepEqual(report.probes.find(p=>p.script_id===s.id&&p.case===v.name),probe);
 }
});
test('Branch parents retain one atomic getter/property/text ledger and freshly reload BYTE caller after actual child completion',()=>{
 for(const s of specs){const v=childBodyCases(s)[0],f=fixture(s,v),p=prepared(start,f);
  unchangedFailure(start,omit(f,0x800CC3),{},'render_source_required');
  unchangedFailure(start,f,{ioObservations:menuRecords(f.ioObservations.slice(0,-1))},'task_io_observation_required');
  unchangedFailure(start,f,{waitObservations:menuRecords(f.waitObservations.slice(0,-1))},'task_wait_observation_required');
  unchangedFailure(start,f,{maxWork:p.work-1},'task_work_budget_required');unchangedFailure(start,f,{maxOutputBytes:p.outputBytes-1},'task_output_budget_required');
  let q=commit(start,f);q=commit(enter,childNextOptions(s,f,q));q=commit(post,childNextOptions(s,f,q));q=commit(resume,childNextOptions(s,f,q));
  // Explicit later BYTE observation. Real C2 still WORDreads its following
  // high then masks it; actual Native5B writes an odd, overlapping WORD.
  f.data.seed(0x613,[0x11]);f.data.seed(0x614,[0xFF]);const r=commit(parent,childNextOptions(s,f,q));
  assert.equal(word(f.data,0x801361),65535);assert.equal(word(f.data,0x801360),0xFFEF);
  assert.ok(r.accesses.some(a=>a.kind==='read'&&a.address===0x614&&a.value===255));assert.equal(r.resultWord,0xBEEF);
  assert.equal(r.childCompletion,v.heap-33);assert.equal(r.childPostrun.resultPushed,false);
 }
});
test('Canonical branch parents reject isolated truncated getters, false predicates/locals/text ledger and substituted suffix writes',async()=>{
 const source=JSON.parse(await readFile('analysis/render-task-script-bodies-child.json')),native=JSON.parse(await readFile('analysis/render-task-script-bodies-child-native.json'));
 for(const s of specs){const proof=source.proofs.find(p=>p.script_id===s.id),child=JSON.parse(await readFile(proof.child_source_contract)).proofs.find(p=>p.script_id===0x6F),
  probes=native.probes.filter(p=>p.script_id===s.id);validateChildBodyEvidence(proof,probes,child);
  const mutations=[p=>p.parent_global_index^=0x1000,p=>p.parent_getter_results[0]^=1,p=>p.parent_y_raw=0,p=>p.parent_property^=0x100,
   p=>p.parent_text_selector^=1,p=>p.parent_text_local^=1,p=>p.child_argument_word^=1,
   p=>p.child_segments[0].native_calls[0].result_pushed=false,p=>p.child_segments.at(-1).native_calls.at(-1).callee_return_word^=1,
   p=>p.child_segments.at(-1).byte_writes.find(([a])=>a===0x7E1350+p.parent_local_byte)[1]^=1,
   p=>{const first=p.child_segments[0];first.io_records[0].value=1;first.io_requests.find(r=>r.kind==='read').value=1;}];
  for(const [n,mutate]of mutations.entries()){const changed=structuredClone(probes);mutate(changed[0]);assert.throws(()=>validateChildBodyEvidence(proof,changed,child),`Script${s.id.toString(16)} isolated mutation${n}`);}
  const properties=s.id===0x1CF?[3955,3843,3920,3934]:[3458,3430,3283],missing=probes.filter(p=>properties.includes(p.parent_property));
  assert.throws(()=>validateChildBodyEvidence(proof,missing,child),'All original default-selector paths omitted');
 }
});
