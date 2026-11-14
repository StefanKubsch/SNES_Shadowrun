import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {taskUnpackWindows} from './task-native-unpack-spec.mjs';
import {sceneGraphicsSpecs} from './main-scene-graphics-source.mjs';
import {sceneVideoSpecs} from './main-scene-video-source.mjs';
import {decodeWindows,DialogTestMemory,rom} from './task-native-dialog-harness.mjs';
import {runReference} from './w65c816-reference.mjs';
import {encodedStream,lengthBits,fixedBits} from './task-native-unpack-fixtures.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {unpackPortrait} from '../src/task/native-dialog-portrait.mjs';
import {unpackStreamLong} from '../src/task/native-unpack.mjs';
import {enableNmiAndJoypad} from '../src/task/main-scene-video.mjs';
import {finishInterruptObservations} from '../src/task/main-wait-interrupt.mjs';

const portrait=JSON.parse(readFileSync(new URL('../analysis/render-9f6d.json',import.meta.url))).windows
  .filter(w=>['unpack9F6D','bit9E65'].includes(w.name)).map(w=>({start:parseInt(w.entry.replace(':',''),16),hex:w.machine_bytes}));
const graph=decodeWindows([...taskUnpackWindows.slice(0,3),...portrait,
  ...sceneGraphicsSpecs.find(s=>s.entry===0x809E7E).windows,
  ...sceneVideoSpecs.find(s=>s.entry===0x81EB7B).windows]);
const side=(entry,stream)=>{const mem=new DialogTestMemory(new Uint8Array(0x20000),null,rom);
  mem.wram.set(stream,0x7400);const a=new TaskAccessor({mem,a:0x7400,x:0x9000,y:0x7E,s:0x1EF0,d:0,dbr:0x80,p:0x45,pc:entry&65535});
  a.load();a.ctx.programBank=entry>>>16;a.devices={write(){}};a.trace=[];const h=dialogAccess(a);
  if(![0x809F4D,0x809F6D].includes(entry))h.pushByte(0x81);h.push(0x1234,2);return {mem,a,h};};
const snapshot=v=>({ctx:{...v.a.ctx},scratch:Array.from(v.mem.wram.slice(0xDB,0xF3)),stack:Array.from(v.mem.wram.slice(0x1EC0,0x1EF1))});

test('unpack continuations match original registers, live scratch and stack before every instruction and MVN byte',()=>{
  const reached=new Set();
  for(const entry of [0x809F49,0x809F4D,0x809E7E,0x809F6D,0x81EB7B])for(const size of [1,2,3,17,255,256,512]){
    const header=entry===0x809E7E?128:size+3,code=Math.max(1,header-size-2);
    const stream=encodedStream(header,Array.from({length:size},(_,i)=>i&255),
      [...lengthBits(size),...fixedBits(size-1,size.toString(2).length),...lengthBits(code)]);
    const r=side(entry,stream),n=side(entry,stream),records=[],states=[];
    const before=new Map([...graph.keys()].map(pc=>[pc,()=>{r.a.ctx.pc=pc&65535;r.a.ctx.programBank=pc>>>16;
      records.push(Object.freeze({pc,nmi:false}));states.push(snapshot(r));reached.add(pc);} ]));
    const root=[0x809F4D,0x809F6D].includes(entry)?'RTS':'RTL';
    runReference(graph,r.mem,r.a.ctx,{entry,root,before,repeatBlockMoves:true,limit:1_000_000,io:r.a.trace});
    let index=0;const e={startupInterrupts:true,interrupts:Object.freeze(records),
      get interruptIndex(){return index;},set interruptIndex(value){assert.deepEqual(snapshot(n),states[value-1],`before ${records[value-1].pc.toString(16)}`);index=value;}};
    if(entry===0x809F6D)unpackPortrait(n.h,e);else if(entry===0x81EB7B)enableNmiAndJoypad(n.h,e);else unpackStreamLong(n.a,false,entry,e);
    finishInterruptObservations(e);assert.deepEqual(n.a.ctx,r.a.ctx);assert.deepEqual(n.mem.wram,r.mem.wram);
  }
  for(const pc of [0x809FF7,0x809E65,0x809E67,0x809E7A,0x80A01C,0x809F34,0x81EB88])assert.ok(reached.has(pc),pc.toString(16));
});

test('startup unpack refuses missing instruction chronology at entry',()=>{
  for(const entry of [0x809F49,0x809F4D,0x809E7E,0x809F6D]){
    const v=side(entry,encodedStream(1,[7],[1])),before=snapshot(v),e={startupInterrupts:true,interrupts:Object.freeze([]),interruptIndex:0};
    assert.throws(()=>entry===0x809F6D?unpackPortrait(v.h,e):unpackStreamLong(v.a,false,entry,e),error=>error.reason==='wait_interrupt_observation_required'&&error.pc===entry);
    assert.deepEqual(snapshot(v),before);
  }
});
