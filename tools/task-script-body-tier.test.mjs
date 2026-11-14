import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {scriptBodySpecs} from '../proof/task/script-body-specs.mjs';import {scriptBodyFixture,bodyCases,bodyWord as word,omitBodyBytes as omit} from './task-script-body-fixtures.mjs';
import {modalBodyPCs} from './task-script-body-modal-fixtures.mjs';import {bodyProbe} from './task-script-body-artifacts.mjs';
import {prepareTaskScriptBody as start} from '../proof/task/script-bodies.mjs';import {prepared,commit,unchangedFailure} from './task-native-test-support.mjs';import {menuRecords} from './task-native-menu-fixtures.mjs';
const specs=scriptBodySpecs.filter(s=>s.tierBody);
for(const s of specs)test(`Whole original${s.id.toString(16)} owns charge-before-rank, exact5/6 and masked255 gates, refund or increment/property and every END edge`,async()=>{
 const report=JSON.parse(await readFile('analysis/render-task-script-bodies-tier-native.json')),edges=new Set();
 assert.equal(s.bytecode.length,72);assert.equal(s.instructions.length,32);assert.deepEqual(s.header,[0,4]);
 for(const v of bodyCases(s)){const f=scriptBodyFixture(s,v),p=commit(start,f),pcs=modalBodyPCs(s,v),paid=v.confirm&&(v.low>=100||v.high!==undefined&&v.high!==0),upgrade=paid&&v.rank<6,
   refund=paid&&v.rank>=6,record=s.instructions.find(i=>i.pc===16).operand,pointer=s.romReads.find(r=>r.address===0x8DB020+record).value;
  assert.equal(p.bodyComplete,true);assert.equal(p.resultWord,0xBEEF);assert.equal(p.returnTarget,0x80C20B);assert.equal(p.fullTaskBinding,false);
  assert.deepEqual(p.bodyPCs,pcs);assert.equal(p.handlersExecuted,pcs.length);for(let n=1;n<pcs.length;n++)edges.add(pcs[n-1]+':'+pcs[n]);
  const query=p.steps.find(p=>p.calleeEntry===0x80CB3C),increment=p.steps.find(p=>p.calleeEntry===0x809DEC);
  assert.equal(Boolean(query),paid);assert.equal(Boolean(increment),upgrade);assert.equal(pcs.includes(29),refund);assert.equal(pcs.includes(51),upgrade);
  if(query){assert.equal(query.wordPops,1);assert.equal(query.metadataWord,2);assert.equal(query.resultPushed,true);assert.equal(query.calleeReturnWord,0xF508);}
  if(increment){assert.equal(increment.wordPops,2);assert.equal(increment.metadataWord,0);assert.equal(increment.resultPushed,false);assert.equal(increment.calleeReturnTarget,0x80F509);
   assert.deepEqual(p.accesses.filter(a=>a.kind==='write'&&a.label==='leaf-long-BYTE'&&a.address===0x7E0002+pointer).map(a=>a.value),[v.rank+1]);}
  const low=v.low??0,high=v.high??0;assert.equal(word(f.data,0x7E3C0D),upgrade?(low-100)&65535:low);
  assert.equal(word(f.data,0x7E3C0F),upgrade&&low<100?(high-1)&65535:high);
  assert.equal(p.observationsUsed,f.ioObservations.length);assert.equal(p.waitObservationsUsed,f.waitObservations.length);assert.equal(p.inputObservationsUsed,f.inputObservations.length);
  assert.deepEqual(report.probes.find(p=>p.script_id===s.id&&p.case===v.name),bodyProbe(s,v));
 }
 assert.deepEqual([...edges].sort(),s.edges.map(e=>e.from+':'+e.to).sort());
});
test('Tier late text/wait/input/sourcehigh/exact budget failures preserve earlier charge and record stores atomically',()=>{
 const s=specs.find(s=>s.id===0x1A3),f=scriptBodyFixture(s,bodyCases(s)[0]),p=prepared(start,f),record=s.romReads.find(r=>r.address===0x8DB3B5).value;
 unchangedFailure(start,omit(f,0x7E0003+record),{},'render_source_required');
 for(const a of [s.scriptEntry+74,s.romReads.at(-1).address+1])unchangedFailure(start,omit(f,a),{},'render_source_required');
 for(const [key,reason]of [['inputObservations','task_input_observation_required'],['waitObservations','task_wait_observation_required'],['ioObservations','task_io_observation_required']])
  unchangedFailure(start,f,{[key]:menuRecords(f[key].slice(0,-1))},reason);
 unchangedFailure(start,f,{maxWork:p.work-1},'task_work_budget_required');unchangedFailure(start,f,{maxOutputBytes:p.outputBytes-1},'task_output_budget_required');
 prepared(start,{...f,maxWork:p.work,maxOutputBytes:p.outputBytes});
});
