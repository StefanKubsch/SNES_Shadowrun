import test from 'node:test';import assert from 'node:assert/strict';
import {taskLeafFixture} from './task-native-leaf-fixtures.mjs';
import {loadTaskNativeBlock} from './task-native-catalog.mjs';
import {createRenderData,renderAddress} from '../src/render/data.mjs';
import {prepared,unchangedFailure} from './task-native-test-support.mjs';
const cases=[['a963',0x2FBB,0x45],['a96d',0x2FBB,0x45],['a91d',65535,0xC5],['a926',0xBEEF,0xC5],['a92f',0x4567,0x45],['ca05',0x800,0x45],['ca15',0x803,0x45],['cc07',0xABCD,0xC5],['cc19',0xABCF,0xC5],['d255',0xEF,0x45],['d1ca',0xBEEF,0xC5],['d17b',0x8001,0xC5],['d16d',0x3EEF,0x45],['d985',0x10,0x45],['d98e',0x10,0x45],['d9a7',0x20,0x44],['94ee',3,0x45],['9e59',0xBEEF,0xC5],['9e5f',0xBEEF,0xC5],['cd97',0x3456,0x45],['c0f7',0xEF,0x45],['c100',0xEF,0x45],['e255',0x1D,0x45],['d016',65535,0xC5]];
const blocks=new Map(await Promise.all(cases.map(async([name])=>[name,await loadTaskNativeBlock('native-'+name)])));
const fixture=(name,patch={})=>{const b=blocks.get(name);return {b,f:taskLeafFixture(b.entries[0],patch)};};
const word=(f,a,v)=>f.data.seed(a,[v&255,v>>>8]);
const drop=(f,...addresses)=>{const data=createRenderData({writeWindows:f.data.snapshot().writeWindows});for(const [a,v] of f.data.snapshot().bytes)if(!addresses.map(renderAddress).includes(a))data.seed(a,[v]);return {...f,data};};
for(const [name,a,status] of cases)test(`${name}: independent original-source result and full flags`,()=>{
 const {b,f}=fixture(name),p=prepared(b.prepare,f);assert.equal(p.outputContext.a,a);assert.equal(p.outputContext.status,status);
 assert.equal(p.outputContext.s,0x701);assert.equal(p.rawReturnWord,0xC20A);assert.equal(p.returnTargetExecuted,false);
});
test('new masked BYTE getters require ignored high source before masking, even lowzero',()=>{
 for(const [name,address] of [['d255',0x8011A8],['c0f7',0x8001D5],['c100',0x8001D7]]){const {b,f}=fixture(name);word(f,address,0x8000);const p=prepared(b.prepare,f);assert.equal(p.outputContext.a,0);assert.equal(p.outputContext.status&0x82,2);unchangedFailure(b.prepare,drop(f,address+1),{},'render_source_required');}
});
test('new full-index absolute readers carry across the actual DBR bank and require both bytes',()=>{
 for(const [name,offset,expected] of [['a963',0xE80,0x2000],['a96d',0xED8,0x2000],['ca05',0x1458,0x8001],['d1ca',0x150A,0x8001],['d255',0x1198,1],['d17b',0x1400,0x8001]]){
  const {b,f}=fixture(name,{bank:0x7F});word(f,0,0xFFF0);word(f,0x800000+offset-16,0x8001);const p=prepared(b.prepare,f);assert.equal(p.outputContext.x,0xFFF0);assert.equal(p.outputContext.a,expected);unchangedFailure(b.prepare,drop(f,0x800000+offset-15),{},'render_source_required');
 }
});
test('A92F later DP04 reads see earlier destination alias writes in original order',()=>{
 const {b,f}=fixture('a92f');f.context=Object.freeze({...f.context,bank:0x7D});word(f,0,0xF2E4);word(f,2,0x8123);word(f,4,0x4567);word(f,6,0xFEDC);
 const p=prepared(b.prepare,f);assert.deepEqual(p.byteWrites,[[0x7E0004,0x23],[0x7E0005,0x81],[0x7E005C,0x23],[0x7E005D,0x81],[0x7E00B4,0xDC],[0x7E00B5,0xFE]]);
 assert.equal(p.outputContext.a,0xFEDC);assert.equal(p.accesses.find(r=>r.label==='leaf-DP-WORD-low'&&r.address===4).value,0x23);
});
test('D9A7 ASL A and ROR memory have distinct results and actual final carries',()=>{
 const {b,f}=fixture('d9a7');for(const [input,a,memory,flags] of [[0,0,0,2],[1,2,0,3],[0x8000,0,0xC000,0x80],[0xFFFF,0xFFFE,0xFFFF,0x81],[3,6,1,1]]){word(f,0,input);const p=prepared(b.prepare,f);assert.equal(p.outputContext.a,a);assert.equal(p.outputContext.status&0x83,flags);assert.deepEqual(p.byteWrites,[[0x7E0000,memory&255],[0x7E0001,memory>>>8]]);}
});
test('D16D OR retains all parameter bits; OR writers require destination high even with FFFF',()=>{
 const d=fixture('d16d');word(d.f,0x801410,0);word(d.f,2,0xFFFF);assert.equal(prepared(d.b.prepare,d.f).outputContext.a,65535);
 for(const [name,address] of [['ca15',0x801468],['cc19',0x7E3BCB]]){const {b,f}=fixture(name);word(f,2,65535);unchangedFailure(b.prepare,drop(f,address+1),{},'render_source_required');}
});
test('plain new setters need no target bytes; E255 writes exact original constants in order',()=>{
 for(const name of ['a91d','a926','a92f','94ee','d985','d98e','e255','d016']){const {b,f}=fixture(name),p=prepared(b.prepare,f),targets=p.accesses.filter(r=>r.kind==='write').map(r=>r.address);prepared(b.prepare,drop(f,...targets));}
 const {b,f}=fixture('e255',{bank:0x7F}),p=prepared(b.prepare,f);assert.deepEqual(p.byteWrites,[[0x7F1D87,0xD4],[0x7F1D88,0x0D],[0x7F1D89,0x1D],[0x7F1D8A,0]]);
});
