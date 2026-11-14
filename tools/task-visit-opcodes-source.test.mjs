import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';
import {proveVisitOpcodes,proveVisitTailBytes,visitTailWindow} from './task-visit-opcodes-source.mjs';
import {readProgress,validateManualTaskEvidence} from './progress.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
test('separate original C1D9 and actual visit/opcode source contracts reproduce',async()=>{
 for(const [name,prove]of [['visit-tail',proveVisitTailBytes],['visit-opcodes',proveVisitOpcodes]]){
  const p=await prove(bytes),r=JSON.parse(await readFile(`analysis/render-task-${name}.json`));assert.deepEqual(r.proofs,p.proofs);
  assert.ok(p.proofs.every(p=>p.full_task_binding===false&&p.external_return_assumptions===0&&p.global_stack_minimum===null));
 }
 const p=await readProgress(process.cwd()),visit=p.work_groups.find(g=>g.id==='task-visit-c1ca'),tail=p.work_groups.find(g=>g.id==='task-visit-tail');
 await validateManualTaskEvidence(process.cwd(),tail,p.rom_sha256);await validateManualTaskEvidence(process.cwd(),visit.composition_blocks[0],p.rom_sha256);
});
test('every tail byte and all new original return/entry/END/Yield/native joins reject source mutations',async()=>{
 for(let n=0;n<visitTailWindow.hex.length/2;n++){
  const changed=Buffer.from(bytes);changed[cpuToOffset(visitTailWindow.start+n,bytes.length)]^=1;await assert.rejects(()=>proveVisitTailBytes(changed));
 }
 for(const address of [0x80C1D8,0x80C1D9,0x80C203,0x80C208,0x80C238,0x80F378,0x80F381,0x80F386,0x80F390,0x80F30A,0x80F4CA,0x80F488,0x80C384,0x80F495,0x80F509,0x80A941]){
  const changed=Buffer.from(bytes);changed[cpuToOffset(address,bytes.length)]^=1;await assert.rejects(()=>proveVisitOpcodes(changed));
 }
});
test('current hundred-block batch consists of two compositions and 48 new original-ID source/native pairs',async()=>{
 const p=await readProgress(process.cwd());if(!p.autonomous_batch.authorization.includes('ab e68538b'))return;
 const g=p.work_groups.find(g=>g.id==='task-f378-opcode-dispatch');
 const expected=['task-visit-tail','task-visit-opcodes',...g.script52_blocks.filter(b=>b.script_id>=87&&b.script_id<=134).map(b=>b.id)].flatMap(id=>[id,id+':manual-native']);
 assert.equal(expected.length,100);assert.equal(p.autonomous_batch.authorized_blocks,100);
 if(p.autonomous_batch.completed_groups.length)assert.deepEqual(p.autonomous_batch.completed_groups,expected);
});
