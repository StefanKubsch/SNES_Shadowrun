import test from 'node:test';
import assert from 'node:assert/strict';
import {smallFamilySpecs} from './task-native-small-specs.mjs';
import {loadTaskNativeBlock} from './task-native-catalog.mjs';
import {taskLeafFixture} from './task-native-leaf-fixtures.mjs';
import {prepared,commit,unchangedFailure} from './task-native-test-support.mjs';
import {createRenderData,renderAddress} from '../src/render/data.mjs';
const blocks=new Map(await Promise.all(smallFamilySpecs.map(async s=>[s.id,await loadTaskNativeBlock(s.name)])));
const fixture=id=>{const b=blocks.get(id);return {b,f:taskLeafFixture(b.entries[0])};};
const put=(f,a,v)=>f.data.seed(a,[v&255,v>>>8]);
const word=(f,a)=>f.data.readByte(a).value|f.data.readByte(a+1).value<<8;
const omit=(f,...addresses)=>{const data=createRenderData({writeWindows:f.data.snapshot().writeWindows}),set=new Set(addresses.map(renderAddress));for(const[a,v]of f.data.snapshot().bytes)if(!set.has(a))data.seed(a,[v]);return {...f,data};};
test('Native6D matching WORD preserves CMP flags and insertion zeros its next WORD before storing fresh DP00',()=>{
 const {b,f}=fixture(0x6D);put(f,0x7E3C1C,3);put(f,0x7E3C1E,0x10);
 const match=prepared(b.prepare,f);assert.equal(match.outputBytes,0);assert.equal(match.outputContext.x,2);assert.equal(match.outputContext.a,0x10);assert.equal(match.outputContext.status&0x83,3);
 put(f,0x7E3C1E,0);const p=commit(b.prepare,f);assert.equal(word(f,0x7E3C1E),0x10);assert.equal(word(f,0x7E3C20),0);assert.equal(p.outputContext.status&0x83,0);
 assert.deepEqual(p.byteWrites,[[0x7E3C20,0],[0x7E3C21,0],[0x7E3C1E,0x10],[0x7E3C1F,0]]);
});
test('Native6D uses all32768 WORD positions, carries into physical7F and admits no inferred capacity',()=>{
 const {b,f}=fixture(0x6D),values=new Uint8Array(65536);for(let n=0;n<65534;n+=2)values[n]=1;
 f.data.seed(0x7E3C1C,values);put(f,0,2);const p=commit(b.prepare,f);
 assert.equal(p.outputContext.x,65534);assert.equal(word(f,0x7F3C1A),2);assert.equal(word(f,0x7F3C1C),0);
});
test('Native7E BYTE sentinel precedes DP00 lookup, high A is retained and match indices exceed255',()=>{
 const {b,f}=fixture(0x7E);f.data.seed(0x7E3CA3,[255]);const end=prepared(b.prepare,omit(f,0));
 assert.equal(end.outputBytes,0);assert.equal(end.outputContext.a,0xABFF);assert.equal(end.outputContext.status&0x83,3);
 f.data.seed(0x7E3CA3,new Uint8Array(257).fill(1));f.data.seed(0x7E3DA3,[0x10]);
 const p=commit(b.prepare,f);assert.equal(p.outputContext.x,256);assert.equal(p.outputContext.a,0xABFF);assert.equal(p.outputContext.status&0x83,0x81);
 assert.deepEqual(p.byteWrites,[[0x7E3DD6,255]]);assert.equal(p.outputContext.status&0x30,0);
});
test('Native6D and7E stop atomically on budget or missing source rather than inventing a terminator',()=>{
 for(const id of [0x6D,0x7E]){const{b,f}=fixture(id);
  if(id===0x6D)put(f,0x7E3C1C,1);else f.data.seed(0x7E3CA3,[1]);
  unchangedFailure(b.prepare,f,{},'render_source_required');unchangedFailure(b.prepare,f,{maxWork:1},'task_work_budget_required');
 }
});
test('NativeB6 preserves sequential SBC borrow and refetches long pointer after an actual destination alias',()=>{
 const {b,f}=fixture(0xB6);put(f,0,0xF2CB);put(f,0x8D9013,0xA234);put(f,0x8D88E5,0x8000);put(f,0x8D88E7,0xFFFF);
 const p=commit(b.prepare,f);assert.equal(word(f,0xF3),0x88D0);assert.equal(word(f,0x81014B),0);assert.equal(word(f,0x8101A3),0xFFFC);
 assert.equal(word(f,0x7F33AB),0);assert.equal(p.outputContext.x,0xF2CB);assert.equal(p.outputContext.y,23);assert.equal(p.outputContext.a,0);
 assert.equal(p.outputContext.status&0x83,3);assert.equal(p.accesses.filter(r=>r.label==='position-fresh-bank').length,3);
 const g=fixture(0xB6).f;put(g,2,0x8001);put(g,0x8D9006,1);put(g,0x8D9008,2);put(g,0x8D900A,3);
 // 8*x wraps to8, then two SBCs retain the first borrow: Y=6.
 const q=prepared(b.prepare,g);assert.equal(q.outputContext.y,10);
 unchangedFailure(b.prepare,g,{context:Object.freeze({...g.context,status:g.context.status|8})},'task_binary_arithmetic_required');
});
test('Native60 is an actual BYTE overwrite, keeps pointer high A and its zero gate skips absent DP02',()=>{
 const {b,f}=fixture(0x60);put(f,2,0xAA80);const p=commit(b.prepare,f);assert.equal(p.outputContext.a,0x480);assert.equal(f.data.readByte(0x7E0401).value,128);assert.equal(p.outputContext.status&0x82,0x80);
 put(f,0x8DB030,0);const q=prepared(b.prepare,omit(f,2));assert.equal(q.outputBytes,0);assert.equal(q.outputContext.a,0);assert.equal(q.outputContext.status&0x82,2);
});
test('NativeBB reads both field bytes before low masking and preserves full table address',()=>{
 const {b,f}=fixture(0xBB);put(f,0x8DB030,65535);put(f,0x7F0000,0xFE80);
 const p=prepared(b.prepare,f);assert.equal(p.outputContext.a,128);assert.equal(p.outputContext.x,65535);assert.equal(p.outputContext.status&0x82,0);
 unchangedFailure(b.prepare,omit(f,0x7F0001),{},'render_source_required');
});
test('NativeAF original AA4C release changes fields and linked nodes but leaves object definition and list alone',()=>{
 const {b,f}=fixture(0xAF);put(f,0x8012B0,1);put(f,0x801308,0x200);put(f,0x801764,0x300);put(f,0x800D1C,65535);put(f,0x800D1E,0x400);
 const p=commit(b.prepare,f);assert.equal(word(f,0x7E3F38),5);assert.equal(word(f,0x801308),0x300);assert.equal(word(f,0x800D1C),0);assert.equal(word(f,0x800D1E),0x200);
 assert.equal(word(f,0x801764),0x400);assert.equal(word(f,0x8012B0),0);assert.equal(p.outputContext.status&0xC3,3);
 assert.ok(!p.accesses.some(a=>a.address===0x8014B0||a.label==='release-inner-JSR-low'));
});
test('Native34 has actual signed01DA gates, full indices and a BYTE record write followed by WORD motion write',()=>{
 for(const gate of [0,0x7FFF,0x8000,65535]){const{b,f}=fixture(0x34);put(f,0x8001DA,gate);put(f,0x8001DE,0x20);put(f,0x800CC2,0x30);put(f,2,0xFE80);
  const p=commit(b.prepare,f);assert.equal(word(f,0x7E3C3A),0xBEEF);assert.equal(f.data.readByte(0x7E3C3C).value,128);
  assert.equal(word(f,0x7E43F8+(gate&0x8000?0x30:0x20)),0xFE80);assert.equal(p.outputContext.x,gate&0x8000?0x30:0x20);assert.equal(p.outputContext.status&0x83,0x80);
 }
});
test('Native23 writes only actual low argument bytes and retains final BYTE N/Z and WORD X',()=>{
 const{b,f}=fixture(0x23);put(f,0x801F60,0x4000);put(f,2,0xFE80);put(f,4,0xAA00);put(f,6,0x567F);
 const p=commit(b.prepare,f);assert.equal(p.outputContext.x,0);assert.equal(word(f,0x7E3C31),0xBEEF);assert.equal(p.outputContext.a,0xBE7F);
 assert.deepEqual(p.byteWrites.slice(2),[[0x7E3C33,128],[0x7E3C34,0],[0x7E3C35,127]]);assert.equal(p.outputContext.status&0x83,1);
});
test('Native99 reproduces actual overflow path, including original low-FFFF saturation side effect',()=>{
 for(const [low,high,add,outLow,outHigh,outA,outP]of [[1,7,2,3,7,3,0],[65535,7,1,0,8,8,1],[65535,65535,1,65535,65535,65535,0x81],[0x7FFF,5,1,0x8000,5,0x8000,0xC0]]){
  const{b,f}=fixture(0x99);put(f,0x7E3C0D,low);put(f,0x7E3C0F,high);put(f,0,add);
  const p=commit(b.prepare,f);assert.equal(word(f,0x7E3C0D),outLow);assert.equal(word(f,0x7E3C0F),outHigh);assert.equal(p.outputContext.a,outA);assert.equal(p.outputContext.status&0xC3,outP);
 }
});
