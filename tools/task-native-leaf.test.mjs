import test from 'node:test';import assert from 'node:assert/strict';
import {loadTaskNativeBlock} from './task-native-catalog.mjs';import {taskLeafSpecs} from './task-native-leaf-specs.mjs';
import {taskLeafFixture} from './task-native-leaf-fixtures.mjs';import {createRenderData} from '../src/render/data.mjs';
import {prepared,commit,unchangedFailure} from './task-native-test-support.mjs';
const blocks=await Promise.all(taskLeafSpecs.map(s=>loadTaskNativeBlock(s.name))),byName=new Map(blocks.map(b=>[b.name,b]));
const run=(name,patch={})=>{const b=byName.get('native-'+name),f=taskLeafFixture(b.entries[0],patch);return {b,f};};
const drop=(f,addresses)=>{const data=createRenderData({writeWindows:f.data.snapshot().writeWindows});for(const [address,value] of f.data.snapshot().bytes)if(!addresses.includes(address))data.seed(address,[value]);return {...f,data};};
for(const b of blocks)test(`${b.name}: explicit observed outer WORD is consumed, target is reported only`,()=>{
 const f=taskLeafFixture(b.entries[0]),p=commit(b.prepare,f);assert.equal(p.rawReturnWord,0xC20A);assert.equal(p.returnTarget,0x80C20B);
 assert.equal(p.outputContext.s,0x701);assert.equal(p.returnTargetExecuted,false);assert.equal(p.outputContext.d,0);assert.equal(p.outputContext.bank,0x80);
 assert.equal(p.outputContext.status&0x30,0);unchangedFailure(b.prepare,f,{context:Object.freeze({...f.context,d:1})},'task_direct_page_zero_required');
 unchangedFailure(b.prepare,drop(taskLeafFixture(b.entries[0]),[0x7E0701]),{},'render_source_required');
});
test('record BYTE getters require full source WORD including high at7F bank crossing',()=>{
 for(const [name,offset] of [['ca2b',0],['ca3a',1],['ca49',2]]){
  const {b,f}=run(name);f.data.seed(0x8013B8,[255,255]);f.data.seed(0x7EFFFF+offset,[0x80,0xAA]);
  const p=prepared(b.prepare,f);assert.equal(p.outputContext.a,0x80);assert.ok(p.readAddresses.includes(0x7EFFFF+offset+1));
  unchangedFailure(b.prepare,drop(f,[0x7EFFFF+offset+1]),{},'render_source_required');
 }
});
test('record WORD getter retains both bytes and final WORD N rather than masking',()=>{
 const {b,f}=run('ca58'),p=prepared(b.prepare,f);assert.equal(p.outputContext.a,0x9A78);assert.equal(p.outputContext.status&0x82,0x80);
});
test('CC26 AND and CC10 direct writer retain widths; plain writer needs no destination reads',()=>{
 const a=run('cc26');assert.equal(prepared(a.b.prepare,a.f).outputContext.a,1);
 const c=run('cc10'),f=drop(c.f,[0x7E3BCB,0x7E3BCC]),p=prepared(c.b.prepare,f);assert.equal(p.outputContext.a,3);assert.ok(!p.readAddresses.includes(0x7E3BCB));
});
test('CBB3 zero gate skips field and BYTE path preserves tableHighA and BYTE flags',()=>{
 const z=run('cbb3');z.f.data.seed(0x8DB030,[0,0]);const zp=prepared(z.b.prepare,drop(z.f,[0x7E0401]));assert.equal(zp.outputBytes,0);assert.equal(zp.outputContext.status&0x82,2);
 const a=run('cbb3'),p=prepared(a.b.prepare,drop(a.f,[0x7E0402]));assert.equal(p.outputContext.a,0x437);assert.equal(p.outputBytes,1);assert.equal(p.outputContext.status&0x82,0);
});
test('selection masks and FFFF reset use actual incoming DBR',()=>{
 for(const [name,offset] of [['d97c',0x1D41],['d997',0x1D47]]){
  const {b,f}=run(name,{bank:0x7F});f.data.seed(0,[255,255]);const p=prepared(b.prepare,f);assert.equal(p.outputContext.a,0x1FE);assert.deepEqual(p.byteWrites,[[0x7F0000+offset,254],[0x7F0001+offset,1]]);
 }
 const {b,f}=run('d9a0');assert.equal(prepared(b.prepare,f).outputContext.a,65535);
});
test('8AFA binary WORD addition retains actual overflow, carry and zero',()=>{
 const {b,f}=run('8afa'),p=prepared(b.prepare,f);assert.equal(p.outputContext.a,0x8001);assert.equal(p.outputContext.status&0xC3,0xC0);
 f.data.seed(0x7E4408,[255,255]);f.data.seed(2,[1,0]);const q=prepared(b.prepare,f);assert.equal(q.outputContext.a,0);assert.equal(q.outputContext.status&0xC3,3);
 unchangedFailure(b.prepare,f,{context:Object.freeze({...f.context,status:0x4D})},'task_binary_arithmetic_required');
});
test('CCCC third ASL Carry is added by ADC; no conventional 9*x replacement',()=>{
 const {b,f}=run('cccc');f.data.seed(0,[0,0x20]);f.data.seed(0x8DB29E,[0x34,0x12]);
 const p=prepared(b.prepare,f);assert.equal(p.outputContext.x,0x2001);assert.equal(p.outputContext.a,0x1234);
});
test('CAF2 second ASL Carry survives store and full index is used freshly',()=>{
 const {b,f}=run('caf2');f.data.seed(0x8DB032,[0,0xD0]);f.data.seed(0x8DCFB3,[0x34,0x12]);
 const p=prepared(b.prepare,f);assert.equal(p.outputContext.x,0xE001);assert.equal(p.outputContext.a,0x1234);
});
test('D622 performs all sixteen unaligned stores and final flags come from CPX',()=>{
 const {b,f}=run('d622'),p=prepared(b.prepare,f);assert.equal(p.outputBytes,36);assert.equal(p.outputContext.a,0x180);assert.equal(p.outputContext.x,32);assert.equal(p.outputContext.status&0x83,3);
 assert.equal(p.byteWrites.filter(([a])=>a>=0x7E1CEF&&a<=0x7E1D0E).length,32);
});
test('C6C4 uses fresh long pointer before both reads and preserves final ASL Carry',()=>{
 const {b,f}=run('c6c4'),p=prepared(b.prepare,f);assert.equal(p.outputContext.a,1);assert.equal(p.outputContext.y,21);assert.equal(p.outputContext.status&0x41,1);
 assert.deepEqual(p.byteWrites,[[0x7E4148,1],[0x7E4149,0],[0x7E41A0,0xD0],[0x7E41A1,0x48],[0x7E41F8,0xE0],[0x7E41F9,0x59],[0x7E40F0,1],[0x7E40F1,0]]);
 assert.equal(p.accesses.filter(r=>r.label==='leaf-long-bank').length,2);
});
test('D0FC retains full table WORD and C716 stores fresh 0CC2 through the original backward shared reset tail',()=>{
 const a=run('d0fc');a.f.data.seed(0x8DB032,[255,0x80]);assert.equal(prepared(a.b.prepare,a.f).outputContext.a,0x80FF);
 const c=run('c716'),p=prepared(c.b.prepare,c.f);assert.equal(p.outputContext.a,1);assert.equal(p.outputContext.x,0x10);assert.equal(p.outputContext.y,4);
 // C716 LDA $0CC2 (bytes AD C2 0C); Mesen2 found the earlier 0CD2 equation wrong at frame 5733 of STREET_PLAN.
 assert.deepEqual(p.byteWrites.find(([address])=>address===0x7E41F8),[0x7E41F8,0x56]);
});
test('every leaf preserves outer return ownership and refuses protected data aliases',()=>{
 for(const b of blocks){const f=taskLeafFixture(b.entries[0]),p=prepared(b.prepare,f);
  const touched=p.accesses.find(r=>r.address<0x700&&r.kind==='read');if(touched)unchangedFailure(b.prepare,f,{protectedStackBytes:[0x7E0000+touched.address,0x7E0701]},'task_stack_alias_required');
  unchangedFailure(b.prepare,f,{protectedStackBytes:[0x7E0701,0x7E0702]},'task_outer_return_required');
 }
});
