import test from 'node:test';import assert from 'node:assert/strict';
import {taskLeafFixture} from './task-native-leaf-fixtures.mjs';
import {loadTaskNativeBlock} from './task-native-catalog.mjs';
import {createRenderData,renderAddress} from '../src/render/data.mjs';
import {prepared,unchangedFailure} from './task-native-test-support.mjs';
const cases=[['8ef5',0x7FFE,0x45],['8af1',3,0x45],['c6f3',1,0x45],['d18a',0x3456,0x45],['e24e',65535,0xC5],['ca20',0,0x47],['c79c',1,0x44],['8b08',0x7FFB,5],['c7c2',0,0x47],['ca0d',3,0x45],['c9f1',0x5678,4],['9dae',0x9A78,0xC5],['a941',0xABCD,0xC5],['a949',0xABCD,0xC5],['a951',0xABCD,0xC5],['d0d3',0x800,0x45],['d13e',0xABCD,0x45],['a959',0x2AF3,0x44]];
const blocks=new Map(await Promise.all(cases.map(async([name])=>[name,await loadTaskNativeBlock('native-'+name)])));
const fixture=(name,patch={})=>{const b=blocks.get(name);return {b,f:taskLeafFixture(b.entries[0],patch)};};
const word=(f,a,v)=>f.data.seed(a,[v&255,v>>>8]);
const drop=(f,addresses)=>{const data=createRenderData({writeWindows:f.data.snapshot().writeWindows});for(const [a,v] of f.data.snapshot().bytes)if(!addresses.map(renderAddress).includes(a))data.seed(a,[v]);return {...f,data};};
for(const [name,expectedA,expectedP] of cases)test(`${name}: independent source-derived register and flag expectations`,()=>{
 const {b,f}=fixture(name),p=prepared(b.prepare,f);assert.equal(p.outputContext.a,expectedA);assert.equal(p.outputContext.status,expectedP);
 assert.equal(p.outputContext.s,0x701);assert.equal(p.rawReturnWord,0xC20A);assert.equal(p.returnTargetExecuted,false);
});
test('8EF5 and A941/A949/A951 require ignored-looking source high; full index and actualDBR preserved',()=>{
 const {b,f}=fixture('8ef5');word(f,0,0xFFF0);word(f,0x7F43E8,0x8012);const p=prepared(b.prepare,f);assert.equal(p.outputContext.x,0xFFF0);assert.equal(p.outputContext.a,0x8012);
 unchangedFailure(b.prepare,drop(f,[0x7F43E9]),{},'render_source_required');
 for(const [name,offset] of [['a941',0x0D20],['a949',0x0D78],['a951',0x0DD0]]){const {b,f}=fixture(name,{bank:0x7F});word(f,0,0xFFF0);word(f,0x800000+offset-16,0x8001);const p=prepared(b.prepare,f);assert.equal(p.outputContext.a,0x8001);assert.ok(p.readAddresses.includes(renderAddress(0x800000+offset-15)));}
});
test('plain 8AF1/CA0D/C7C2 writes need no destination source and retain true load flags',()=>{
 for(const [name,destination] of [['8af1',0x7E4408],['ca0d',0x801468],['c7c2',0x7E40F0]]){const {b,f}=fixture(name),g=drop(f,[destination,destination+1]),p=prepared(b.prepare,g);assert.equal(p.readAddresses.includes(destination),false);assert.equal(p.outputBytes,2);}
});
test('C6F3 shared tail and C79C shift flags preserve all real writes and do not preread targets',()=>{
 const {b,f}=fixture('c6f3'),p=prepared(b.prepare,f);assert.deepEqual(p.byteWrites,[[0x7E4148,0],[0x7E4149,0],[0x7E41A0,0],[0x7E41A1,0],[0x7E41F8,3],[0x7E41F9,0],[0x7E40F0,1],[0x7E40F1,0]]);
 const c=fixture('c79c');word(c.f,4,0x4000);const q=prepared(c.b.prepare,c.f);assert.equal(q.outputContext.status&1,1);assert.equal(q.outputContext.a,1);assert.deepEqual(q.byteWrites.find(([a])=>a===0x7E41F8),[0x7E41F8,0]);
});
test('CA20 reads full destination WORD before AND, requiring high even with maskzero',()=>{
 const {b,f}=fixture('ca20');word(f,2,0);unchangedFailure(b.prepare,drop(f,[0x801469]),{},'render_source_required');
 word(f,2,0xFFFF);word(f,0x801468,0x8001);const p=prepared(b.prepare,f);assert.equal(p.outputContext.a,0x8001);assert.equal(p.outputContext.status&0x82,0x80);
});
test('8B08 SEC/binary subtraction retains real borrow and signed overflow',()=>{
 const {b,f}=fixture('8b08');word(f,0x7E4408,0);word(f,2,1);let p=prepared(b.prepare,f);assert.equal(p.outputContext.a,65535);assert.equal(p.outputContext.status&0xC3,0x80);
 word(f,0x7E4408,0x8000);p=prepared(b.prepare,f);assert.equal(p.outputContext.a,0x7FFF);assert.equal(p.outputContext.status&0xC3,0x41);
 unchangedFailure(b.prepare,f,{context:Object.freeze({...f.context,status:0x4D})},'task_binary_arithmetic_required');
});
test('C9F1 second ASL Carry participates in fresh ADC, intermediate DP00 store is real',()=>{
 const {b,f}=fixture('c9f1');word(f,0x7E3F38,0xD000);word(f,0x8DCFB3,0xABCD);const p=prepared(b.prepare,f);
 assert.equal(p.outputContext.x,0xE001);assert.equal(p.outputContext.a,0xABCD);assert.equal(p.outputBytes,4);
 assert.equal(p.accesses.findLast(a=>a.label==='leaf-DP-WORD-high'&&a.address===1).value,0xA0);
});
test('9DAE zero/equal/unequal branches retain actual A/C/N/Z and skip absent field',()=>{
 const {b,f}=fixture('9dae');word(f,0x8DB023,0);const z=prepared(b.prepare,drop(f,[0x7E0403,0x7E0404]));assert.equal(z.outputContext.a,0);assert.equal(z.outputContext.status&0x83,3);
 word(f,0x8DB023,0x400);word(f,0x7E0403,0x10);const e=prepared(b.prepare,f);assert.equal(e.outputContext.a,65535);assert.equal(e.outputContext.status&0x83,0x81);assert.deepEqual(e.byteWrites.slice(0,2),[[0x7E0000,255],[0x7E0001,255]]);
 word(f,0x7E0403,1);const n=prepared(b.prepare,f);assert.equal(n.outputContext.a,1);assert.equal(n.outputContext.status&0x83,0x80);assert.deepEqual(n.byteWrites.slice(0,2),[[0x7E0000,0],[0x7E0001,0]]);
});
test('D0D3 immediateBIT affects onlyZ, gates writes and chooses original OR0001/8001',()=>{
 const {b,f}=fixture('d0d3');word(f,0x801468,0xC800);const p=prepared(b.prepare,f);assert.equal(p.outputContext.status&0xC3,0xC1);assert.equal(p.outputBytes,0);assert.equal(p.outputContext.a,0xC800);
 word(f,0x801410,0xFFFF);for(const [gate,result] of [[0,0x7FFF],[0x200,0xFFFF]]){word(f,0x801468,gate);const q=prepared(b.prepare,f);assert.equal(q.outputContext.a,result);assert.equal(q.outputContext.y,0x10);assert.equal(q.outputBytes,2);}
 unchangedFailure(b.prepare,drop(f,[0x801411]),{},'render_source_required');
});
test('D13E STZ changes neither A nor flags after actualLDX, all three writes are mandatory',()=>{
 const {b,f}=fixture('d13e',{bank:0x7F});word(f,0,0x8000);const p=prepared(b.prepare,f);assert.equal(p.outputContext.a,0xABCD);assert.equal(p.outputContext.status&0xC3,0xC1);assert.equal(p.outputBytes,6);
 unchangedFailure(b.prepare,f,{maxOutputBytes:5},'task_output_budget_required');
});
test('A959 second LSR Carry comes from original bit1 and WORDsign is cleared',()=>{
 const {b,f}=fixture('a959');for(const [value,result,carry] of [[0x8002,0x2000,1],[3,0,1],[1,0,0],[0xFFFF,0x3FFF,1]]){word(f,0x800E38,value);const p=prepared(b.prepare,f);assert.equal(p.outputContext.a,result);assert.equal(p.outputContext.status&1,carry);assert.equal(p.outputContext.status&0x82,result===0?2:0);}
});
