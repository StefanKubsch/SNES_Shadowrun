import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {summarizeProgress} from './status-next.mjs';

const progress={autonomous_batch:{scope:'s'},next_block:{group:'g',entries:['80:F390'],kind:'composition',objective:'o'},
 supplied:[{}],open_boundaries:[{id:'b',description:'long'}],
 work_groups:[{id:'g',status:'composition-required',entries:['80:F390'],reason:'r'.repeat(2000),proofs:[1,2,3],manual_native:{module:'m'}}]};

test('Historical status labels earlier plans and keeps proof group details accessible',()=>{
 const all=summarizeProgress(progress);
 assert.equal(all.view,'historical-evidence');
 assert.equal(all.next_group_status,'composition-required');
 assert.deepEqual(all.open_boundaries,['b']);
 const group=summarizeProgress(progress,'g');
 assert.equal(group.proofs,'[3 entries]');
 assert.equal(group.manual_native,'{module}');
 assert.ok(group.reason.length<1300);
 assert.throws(()=>summarizeProgress(progress,'missing'),/Unknown work group/);
});

const currentWork={updated:'2026-10-31',focus:'Repository cleanup',
 next_step:'Inspect generator dependencies',porting_resume:'Resume data analysis after cleanup',
 open_issues:['Browser recording'],accepted_model_assumptions:['Nominal hardware response'],
 implementation_limits:['Two wire slots'],optional_quality_checks:['Combined curved-image comparison'],
 references:['docs/STRATEGY.md']};

test('Current work takes precedence over historical tasks and authorization',()=>{
 const data=progress,before=structuredClone({data,currentWork});
 const all=summarizeProgress(data,null,currentWork);
 assert.deepEqual(all.current_work,currentWork);
 assert.equal(all.autonomous_batch,undefined);
 assert.equal(all.next_block,undefined);
 assert.equal(all.open_boundaries,undefined);
 assert.equal(all.evidence_inventory.work_groups,1);
 assert.equal(summarizeProgress(data,'g',currentWork).id,'g');
 assert.equal(summarizeProgress(data,'--history',currentWork).view,'historical-evidence');
 assert.equal(summarizeProgress(data,'--history',currentWork).next_block.group,'g');
 assert.deepEqual({data,currentWork},before);
});

test('Long historical descriptions stay bounded without changing the stored evidence',()=>{
 const data={...progress,autonomous_batch:{...progress.autonomous_batch,
  authorization:'history '.repeat(2000),scheduled_run_authorization:'old schedule '.repeat(1000)},
  next_block:{...progress.next_block,objective:'delivered work '.repeat(2000)}},before=structuredClone(data);
 const all=summarizeProgress(data,'--history');
 assert.ok(all.autonomous_batch.authorization.length<450);
 assert.ok(all.autonomous_batch.scheduled_run_authorization.length<450);
 assert.ok(all.next_block.objective.length<450);
 assert.ok(JSON.stringify(all).length<2500);
 assert.deepEqual(data,before);
});

test('Current work descriptions stay concise as notes grow',()=>{
 const work={...currentWork,focus:'focus '.repeat(1000),
  next_step:'next '.repeat(1000),porting_resume:'resume '.repeat(1000),
  open_issues:['issue '.repeat(1000)]},before=structuredClone(work);
 assert.ok(JSON.stringify(summarizeProgress(progress,null,work)).length<2500);
 assert.deepEqual(work,before);
});

test('CLI loads the current status file and keeps the real historical view bounded',()=>{
 const script=fileURLToPath(new URL('./status-next.mjs',import.meta.url));
 const run=(...args)=>execFileSync(process.execPath,[script,...args],{encoding:'utf8'});
 const current=run(),history=run('--history');
 const recorded=JSON.parse(readFileSync(new URL('../docs/PROJECT-STATUS.json',import.meta.url),'utf8'));
 assert.deepEqual(JSON.parse(current).current_work,recorded);
 assert.equal(JSON.parse(history).view,'historical-evidence');
 assert.ok(Buffer.byteLength(current)<5000);
 assert.ok(Buffer.byteLength(history)<3000);
});
