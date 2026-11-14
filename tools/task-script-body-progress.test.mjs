import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readProgress,validateScriptBodyBatch,validScriptBodySuspensionProbe} from './progress.mjs';
import {scriptBodySpecs,scriptBodyBatches} from '../proof/task/script-body-specs.mjs';
test('grouped body delivery validates every individual identity and native proof through shared evidence',async()=>{
 const p=await readProgress(process.cwd()),group=p.work_groups.find(g=>g.id==='task-f378-opcode-dispatch');
 const batch=group.script_body_batches.find(b=>b.id==='task-script-bodies-start');
 assert.deepEqual(batch.script_ids,scriptBodyBatches[0].ids);
 assert.deepEqual(group.script_body_batches.flatMap(b=>b.script_ids).sort((a,b)=>a-b),scriptBodySpecs.map(s=>s.id));
 for(const b of group.script_body_batches)await validateScriptBodyBatch(process.cwd(),b,p.rom_sha256);
 await validateScriptBodyBatch(process.cwd(),batch,p.rom_sha256);
 await assert.rejects(()=>validateScriptBodyBatch(process.cwd(),{...batch,script_ids:[0,...batch.script_ids.slice(1)]},p.rom_sha256));
 await assert.rejects(()=>validateScriptBodyBatch(process.cwd(),{...batch,script_ids:[...batch.script_ids,batch.script_ids[0]]},p.rom_sha256));
 assert.ok(Number.isSafeInteger(p.workflow.script_body_batches.target_scripts_per_delivery));
 assert.ok(p.workflow.script_body_batches.target_scripts_per_delivery>0);
 if(p.autonomous_batch.scope==='original-script-body-start'){
  assert.equal(p.autonomous_batch.authorized_blocks,1);
  assert.deepEqual(p.autonomous_batch.completed_groups,[batch.id]);
 }
});

test('Original2C6 progress accepts both source-proved ENDs and still rejects non-END, jumped edges and missing yield/readiness evidence',async()=>{
 const source=JSON.parse(await readFile('analysis/render-task-script-bodies-record-lifecycle.json'));
 const native=JSON.parse(await readFile('analysis/render-task-script-bodies-record-lifecycle-native.json'));
 const proof=source.proofs.find(p=>p.script_id===0x2C6),early=native.probes.find(p=>p.script_id===0x2C6&&p.body_pcs.at(-1)===12),
  full=native.probes.find(p=>p.script_id===0x2C6&&p.body_pcs.at(-1)===64);
 assert.equal(validScriptBodySuspensionProbe(proof,early),true);assert.equal(validScriptBodySuspensionProbe(proof,full),true);
 assert.equal(validScriptBodySuspensionProbe(proof,{...early,body_pcs:early.body_pcs.slice(0,-1),handlers:early.handlers-1}),false);
 assert.equal(validScriptBodySuspensionProbe(proof,{...early,body_pcs:[0,12],handlers:2}),false);
 assert.equal(validScriptBodySuspensionProbe(proof,{...full,observed_readiness_entries:0}),false);
 assert.equal(validScriptBodySuspensionProbe(proof,{...full,segments:full.segments.filter(s=>!s.body_suspended)}),false);
 assert.equal(validScriptBodySuspensionProbe(proof,{...full,observed_readiness_entries:0.5}),false);
});
