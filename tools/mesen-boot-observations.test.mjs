import test from 'node:test';
import assert from 'node:assert/strict';
import {bootObservationSets,bootReadbackObservations} from './mesen-boot-prefix.mjs';

const point=(ioCursor,instructionSteps)=>({ioCursor,instructionSteps});
function fixture(){
  const interrupts=Object.freeze([0x81B0A1,0x81ACAF,0x809E1A].map(pc=>Object.freeze({pc,nmi:false})));
  return {interrupts,recorded:{initial:{context:{programBank:0,pc:0xE382}},io:[],
    mainCalls:[point(0,1),point(0,3)],
    nativeCalls:[{round:0,depth:0,start:{...point(0,1),target:0x80FEC1},end:point(0,2)}]}};
}
test('cold observations preserve the original main and Native owner order',()=>{
  const {recorded,interrupts}=fixture(),routines=new Map(),sets=bootObservationSets(recorded,interrupts,routines);
  assert.deepEqual(sets.map(o=>o.target),[0x00E382,0x80FEC1,0x8096C3]);
  assert.deepEqual(sets.map(o=>o.interrupts),interrupts.map(o=>[o]));
  assert.ok(Object.isFrozen(sets)&&sets.every(o=>Object.isFrozen(o)&&Object.isFrozen(o.interrupts)));
  assert.ok(sets.every(o=>o.interruptRoutines===routines&&o.startupInterrupts));
});
test('cold observations reject missing, overlapping or unowned Native segments',()=>{
  for(const [change,message] of [
    [r=>{r.nativeCalls[0].start.instructionSteps=2;},/unowned task-round interrupt input/],
    [r=>{r.nativeCalls[0].depth=1;},/nested native owner partition required/],
    [r=>{delete r.nativeCalls[0].end;},/original native return required/],
    [r=>{r.nativeCalls[0].end.instructionSteps=4;},/original owner instruction partition/],
    [r=>{r.nativeCalls[0].round=-1;},/original native main owner required/],
    [r=>{r.mainCalls.pop();},/unrecorded task-round interrupt input/],
  ]){const {recorded,interrupts}=fixture();change(recorded);assert.throws(()=>bootObservationSets(recorded,interrupts,new Map()),message);}
});

function readback(){
  const rows=[];
  for(const [address,value]of [[0x4350,0x81],[0x4351,0x39],[0x4354,0x7E],[0x4352,0xE0],[0x4353,0x2A],
    [0x4355,16],[0x4356,0],[0x2115,0x80],[0x2116,0x34],[0x2117,0x12],[0x420B,0x20]])
    rows.push({kind:'write',address,value,pcAfter:0x81AA96});
  for(let n=0;n<16;n++)rows.push({kind:'dma-read',address:0x7E2AE0+n,value:n+32,pcAfter:0x81AA96});
  return rows;
}
test('each original reverse DMA byte belongs to its actual Native observation interval',()=>{
  const io=readback(),[dma]=bootReadbackObservations(io);
  assert.deepEqual(dma,{ioCursor:10,observation:{pc:0x81AA93,address:0x420B,width:1,value:0x20,
    dmap:0x81,bbad:0x39,a1b:0x7E,a1t:0x2AE0,das:16,vmain:0x80,vmadd:0x1234,
    bytes:Array.from({length:16},(_,i)=>i+32)}});
  assert.ok(Object.isFrozen(dma.observation.bytes));
  const recorded={initial:{context:{programBank:0,pc:0xE382}},io,mainCalls:[point(0,0)],
    nativeCalls:[{round:0,depth:0,start:{...point(0,0),target:0x80FEC1},end:point(io.length,0)}]};
  const sets=bootObservationSets(recorded,[],new Map());
  assert.deepEqual(sets.map(o=>o.dmaTransfers.length),[0,1]);assert.deepEqual(sets[1].dmaTransfers[0],dma.observation);
});
test('reverse DMA rejects missing retained registers, wrong destinations and missing or unowned bytes',()=>{
  for(const [change,message]of [
    [rows=>rows.splice(1,1),/original text DMA registers/],
    [rows=>{rows[11].address++;},/original reverse DMA destination/],
    [rows=>rows.pop(),/missing original reverse DMA byte/],
    [rows=>{rows[10].kind='read';},/reverse DMA without original command/],
  ]){const rows=readback();change(rows);assert.throws(()=>bootReadbackObservations(rows),message);}
});
