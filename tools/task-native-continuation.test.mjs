import test from 'node:test';import assert from 'node:assert/strict';
import {taskContinuationFixture} from './task-native-continuation-fixtures.mjs';
import {prepareTaskNativeBridge as bridge} from '../proof/task/native-bridge.mjs';
import {prepareTaskNativeResume as resume} from '../proof/task/native-resume.mjs';
import {createRenderData,renderAddress} from '../src/render/data.mjs';
import {prepared,commit,unchangedFailure} from './task-native-test-support.mjs';
const word=(f,address,value)=>f.data.seed(address,[value&255,value>>>8]);
const drop=(f,address)=>{const data=createRenderData({writeWindows:f.data.snapshot().writeWindows});for(const [a,v] of f.data.snapshot().bytes)if(a!==renderAddress(address))data.seed(a,[v]);return {...f,data};};
test('F4F6 establishes D0/DBR80 with real stack bytes and original F508 JSR frame',()=>{
 const f=taskContinuationFixture(0x80F4F6),p=commit(bridge,f);assert.deepEqual(p.byteWrites,[[0x7E06FF,0xF5],[0x7E06FE,8],[0x7E00A2,0x3A],[0x7E00A3,0xCA]]);
 assert.deepEqual(p.accesses.filter(a=>a.kind==='write').map(a=>[a.address,a.value]),[[0x6FF,0x80],[0x6FE,0x80],[0xA2,0x3A],[0xA3,0xCA],[0x6FF,0xF5],[0x6FE,8]]);
 assert.equal(p.outputContext.s,0x6FD);assert.equal(p.outputContext.d,0);assert.equal(p.outputContext.bank,0x80);assert.equal(p.outputContext.a,0xCA3A);
 assert.equal(p.outputContext.status&0xC3,0xC1);assert.equal(p.frontier,'80:F52F');assert.equal(p.dynamicDispatchExecuted,false);
});
test('F4F6 preserves fresh fullX and last JSR writes can alias pointerA2',()=>{
 const f=taskContinuationFixture(0x80F4F6);f.context=Object.freeze({...f.context,a:0xA3,x:0xFFFF,bank:0x7F});f.protectedStackBytes=[0x7E00A4,0x7E00A5];word(f,0x83D7B7,0x2345);
 const p=prepared(bridge,f);assert.equal(p.pointerWord,0x2345);assert.equal(p.outputContext.s,0xA1);assert.deepEqual(p.byteWrites,[[0x7E00A3,0xF5],[0x7E00A2,8]]);
 assert.equal(p.outputContext.bank,0x80);assert.equal(p.outputContext.status&0x82,0);
});
test('F4F6 native bank00 stack wrap stops at ROM write and requires precise outer protection',()=>{
 const f=taskContinuationFixture(0x80F4F6);f.context=Object.freeze({...f.context,a:0});f.protectedStackBytes=[0x7E0001,0x7E0002];
 unchangedFailure(bridge,f,{},'render_write_window_required');
 unchangedFailure(bridge,f,{protectedStackBytes:[0x7E0100,0x7E0101]},'task_outer_return_required');
});
test('F509 PEI/PLB uses both original bytes, restores operand S, full metadata WORD and fresh opcode',()=>{
 const f=taskContinuationFixture(0x80F509),p=prepared(resume,f);
 assert.deepEqual(p.accesses.filter(a=>a.label==='resume-PLB').map(a=>a.value),[0x12,0x80]);
 assert.equal(p.metadataWord,0xAA02);assert.equal(p.resultPushed,true);assert.equal(p.outputContext.s,0x3EE);assert.equal(p.outputContext.y,5);assert.equal(p.opcodeWord,0xA514);
 assert.equal(p.outputContext.d,0x200);assert.equal(p.outputContext.bank,0x80);assert.equal(p.outputContext.x,0x14);assert.equal(p.outputContext.status&0xC3,0x41);
 assert.equal(p.frontier,'80:F390');assert.ok(p.readAddresses.includes(0x82D973));
});
test('F509 zero return metadata skips absent result and stackwrites; high metadata still required',()=>{
 const f=taskContinuationFixture(0x80F509);word(f,0x82D972,0xBB00);const p=prepared(resume,drop(drop(f,0),1));
 assert.equal(p.resultPushed,false);assert.equal(p.outputContext.s,0x3F0);assert.equal(p.outputBytes,4);
 unchangedFailure(resume,drop(f,0x82D973),{},'render_source_required');
});
test('F509 uses actual bank after secondPLB, not entry bank; result and01F2 share physical source',()=>{
 const f=taskContinuationFixture(0x80F509);word(f,0x201,0x7F12);word(f,0x7F0000,0xFFFF);word(f,0x7F1204,0xBB56);
 const p=prepared(resume,f);assert.equal(p.outputContext.bank,0x7F);assert.equal(p.opcodeWord,0xBB56);assert.ok(p.byteWrites.some(([a])=>a===0x7F01F2));
 assert.ok(p.accesses.some(a=>a.label==='resume-result-PHA-high'&&a.value===255));
});
test('F509 earlier01F2 store aliases restoredDP07 and must be read freshly',()=>{
 const f=taskContinuationFixture(0x80F509);word(f,0x800262,0x1EB);word(f,0x1EC,0x8012);word(f,0x1EE,4);word(f,0x1F4,2);word(f,0x1EB,0x1200);word(f,0x1F2,0x3F0);
 const p=prepared(resume,f);assert.equal(p.outputContext.s,0x6FD);assert.equal(p.accesses.find(a=>a.label==='resume-fresh-operand-S-low').value,0xFF);
});
test('F509 result stack can alias savedPC and pointer; next reads reflect writes',()=>{
 const f=taskContinuationFixture(0x80F509);word(f,0x207,0x204);word(f,0x800000,8);word(f,0x801208,0xEF34);
 const p=prepared(resume,f);assert.equal(p.opcodeWord,0xEF34);assert.equal(p.outputContext.y,9);assert.equal(p.outputContext.s,0x202);
});
test('migration late missing reads and protected accesses discard all earlier writes',()=>{
 const f=taskContinuationFixture(0x80F509);unchangedFailure(resume,drop(f,0x801205),{},'render_source_required');
 unchangedFailure(resume,f,{protectedStackBytes:[...f.protectedStackBytes,0x7E0201]},'task_stack_alias_required');
 const b=taskContinuationFixture(0x80F4F6);unchangedFailure(bridge,drop(b,0x82D7BD),{},'render_source_required');
 unchangedFailure(bridge,b,{protectedStackBytes:[...b.protectedStackBytes,0x7E00A2]},'task_stack_alias_required');
});
