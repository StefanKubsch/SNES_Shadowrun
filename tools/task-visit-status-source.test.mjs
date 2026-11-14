import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';
import {proveVisitStatus} from './task-visit-status-source.mjs';
import {spec} from './render-task-status-return-source-proof.mjs';
import {statusOpcodeSpecs} from './task-visit-status-fixtures.mjs';
import {readProgress,validateManualTaskEvidence} from './progress.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
test('separate status Visit renews all29 original slots, real current RTS and D preservation',async()=>{
 const p=await proveVisitStatus(bytes),r=JSON.parse(await readFile('analysis/render-task-visit-status-opcodes.json'));
 assert.deepEqual(r.proofs,p.proofs);assert.deepEqual(r.windows,p.windows);
 for(const q of p.proofs){assert.equal(q.status_return.slots.length,29);assert.equal(q.joins.length,7);
  assert.equal(q.joins.at(-1).from,'80:F952');assert.equal(q.joins.at(-1).raw_return,'C20A');
  assert.equal(q.external_return_assumptions,0);assert.equal(q.full_task_binding,false);
  assert.ok(q.postrun_d_ledger.some(i=>i.pc===0x80C20B));assert.ok(q.postrun_d_ledger.some(i=>i.pc===0x80C1E2));
  assert.ok(q.postrun_d_ledger.every(i=>!['TCD','PLD'].includes(i.mnemonic)&&!i.mode.startsWith('dp')));
 }
 const progress=await readProgress(process.cwd()),g=progress.work_groups.find(g=>g.id==='task-visit-c1ca');
 await validateManualTaskEvidence(process.cwd(),g.composition_blocks.find(b=>b.id==='task-visit-status-opcodes'),progress.rom_sha256);
});
test('every F927/prefix/slot byte and postrun D/DBR/tail source rejects mutation',async()=>{
 const addresses=new Set([0x80C20B,0x80C21E,0x80C22C,0x80C239,0x80C396,0x80C2BD,0x80C1D9,0x80C1E2]);
 for(let n=0;n<spec.windows[0].hex.length/2;n++)addresses.add(spec.entry+n);
 for(const s of statusOpcodeSpecs){addresses.add(0x80F2B4+s.opcode);addresses.add(0x80F2B5+s.opcode);
  if(s.family==='trap-prefix')for(let n=0;n<3;n++)addresses.add(s.target+n);}
 for(const address of addresses){const changed=Buffer.from(bytes);changed[cpuToOffset(address,bytes.length)]^=1;
  await assert.rejects(()=>proveVisitStatus(changed));}
});
test('new hundred-block batch contains the renewed status Visit and49 individual Script52 pairs',async()=>{
 const p=await readProgress(process.cwd());if(!p.autonomous_batch.authorization.includes('ab b205b03'))return;
 const g=p.work_groups.find(g=>g.id==='task-f378-opcode-dispatch');
 const expected=['task-visit-status-opcodes',...g.script52_blocks.filter(b=>b.script_id>=160&&b.script_id<=208).map(b=>b.id)]
  .flatMap(id=>[id,id+':manual-native']);
 assert.equal(expected.length,100);assert.equal(new Set(expected).size,100);
 assert.equal(p.autonomous_batch.authorized_blocks,100);assert.deepEqual(p.autonomous_batch.completed_groups,expected);
});
