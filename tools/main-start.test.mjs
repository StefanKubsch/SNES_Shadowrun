import test from 'node:test';
import assert from 'node:assert/strict';
import {mainStartSpecs,mainStartDataWindows,proveMainStart} from './main-start-source.mjs';
import {taskUnpackWindows} from './task-native-unpack-spec.mjs';
import {compareDialog,decodeWindows,rom,DialogTestMemory,prng,window} from './task-native-dialog-harness.mjs';
import {runReference} from './w65c816-reference.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {MAIN_START_ROUTINES as MAIN_START_TASK_ROUTINES,runMainStart} from '../src/task/main-start.mjs';
import {withGameStartReference} from '../proof/game-reference/game-start.mjs';
// The register-level start (proof/game-reference/game-start.mjs) against the ROM; the
// lifted start is compared with it in tools/game-start-lift*.test.mjs.
const MAIN_START_ROUTINES=withGameStartReference(MAIN_START_TASK_ROUTINES);
import {SRAM_SIZE} from '../src/vm/memory.mjs';
import {GAME_NMI_ROUTINES} from '../src/task/main-game-nmi.mjs';
import {finishInterruptObservations} from '../src/task/main-wait-interrupt.mjs';
import {saveGameSlot} from '../src/task/native-main-menu.mjs';

const maps=mainStartSpecs.map(s=>decodeWindows(s.windows));
const external=(a,e,r,map)=>new Map([...r].filter(([target])=>!map.has(target)).map(([target,run])=>[target,()=>{
  const v=run(dialogAccess(a),e,r);return {rawReturnWord:v?.rawReturnWord??v};
}]));
test('whole 9688 caller and new-game/load helpers retain pinned source, tables and stack contracts',()=>{
  const expected=[[38,22,4,['80:96EC','80:96F2']],[9,1,2,['80:9628']],[56,1,3,['80:9999']],[16,0,7,['81:B1AA']]];
  for(const [n,s]of mainStartSpecs.entries()){const p=proveMainStart(maps[n],s),[instructions,calls,stack,returns]=expected[n];
    assert.equal(p.reachable_instructions,instructions);assert.equal(maps[n].size,instructions);
    assert.equal(p.external_return_assumptions,calls);assert.equal(p.minimum_protected_stack_bytes,stack);
    assert.deepEqual(p.returns.map(r=>r.at),returns);assert.ok(p.returns.every(r=>r.m===0&&r.x===0&&r.dbr==='entry'));
  }
  for(const w of mainStartDataWindows)assert.equal(window(w.start,w.start+w.hex.length/2).hex,w.hex);
});
function scenario(entry,seed){const random=prng(seed),wram=Uint8Array.from({length:0x20000},()=>Math.floor(random()*256)),
  sram=Uint8Array.from({length:SRAM_SIZE},()=>Math.floor(random()*256));
  return {entry,wram,sram,a:entry===0x81B198?seed%4:seed*931&65535,x:seed*397&65535,y:seed*223&65535,
    dbr:[0x80,0x81,0x7E][seed%3],p:seed&0xC7};
}
test('new-game and SRAM load equations match original helpers including real unpack stream, bank restoration and SRAM mirrors',()=>{
  const unpack=decodeWindows(taskUnpackWindows.slice(0,3));
  for(const n of [1,2,3]){const s=mainStartSpecs[n],map=n===3?maps[n]:new Map([...maps[n],...(n===1?maps[2]:[]),...unpack]);
    for(let seed=0;seed<12;seed++){const f=scenario(s.entry,seed),r=MAIN_START_ROUTINES;
      const result=compareDialog(map,f,{root:s.rootReturn,native:(h,e)=>r.get(s.entry)(h,e,r),calls:(a,e)=>external(a,e,r,map)});
      assert.deepEqual(result.differences,[],s.name+' seed '+seed);
      assert.ok(result.visited.has(s.entry));
    }
  }
});
function side(choice=0xFFFF){const mem=new DialogTestMemory(new Uint8Array(0x20000),new Uint8Array(SRAM_SIZE),rom),
  vm={mem,a:0xEEDD,x:0x1234,y:0x5678,s:0x1EF0,d:0,dbr:0x80,p:0x43,pc:0x9688},a=new TaskAccessor(vm);
  a.load();a.trace=[];a.io=[];a.devices={write(){}};const h=dialogAccess(a);h.push(0xA156,2);h.dpWrite(0,choice);
  mem.write16(0x1FD8,0x5678);mem.write16(0x1FDA,0x9ABC);
  for(let i=0;i<mem.sram.length;i++)mem.sram[i]=i*17&255;
  return {mem,vm,a,h};
}
function prefixRoutines(v,mutate=false){const r=new Map(MAIN_START_ROUTINES);
  // Synthetic independent helpers isolate the actual entry selection, saved
  // scene word and first-loop continuation. Whole helpers are separately proved.
  r.set(0x809629,h=>{if(mutate)h.write((h.ctx.s+3)&65535,0x1234,2);h.load(0xBEEF);return h.rts();});
  r.set(0x80A4BF,h=>{v.scene=h.ctx.a;return h.rts();});r.set(0x818861,h=>h.rtl());return r;
}
test('both start branches match original prefix and consume the fresh saved scene word before falling through to 96AB',()=>{
  for(const choice of [0x8000,0xFFFF,0,1,2,3])for(const mutate of [false,true]){
    const n=side(choice),r=side(choice),nr=prefixRoutines(n,mutate),rr=prefixRoutines(r,mutate);
    runMainStart(n.a,null,nr);const stop=Symbol('first main instruction');
    assert.throws(()=>runReference(maps[0],r.mem,r.a.ctx,{entry:0x809688,root:'RTS',io:r.a.trace,
      calls:external(r.a,null,rr,maps[0]),before:new Map([[0x8096AB,()=>{r.a.ctx.pc=0x96AB;throw stop;}]])}),e=>e===stop);
    assert.deepEqual(n.a.ctx,r.a.ctx);assert.deepEqual(n.mem.wram,r.mem.wram);assert.deepEqual(n.mem.sram,r.mem.sram);
    assert.equal(n.scene,r.scene);assert.equal(n.scene,mutate?0x1234:choice&0x8000?3:n.mem.read16(0x7E2DE2));
    assert.equal(n.a.ctx.pc,0x96AB);assert.equal(n.a.ctx.s,0x1EEE);assert.equal(n.mem.read16(0x1EEF),0xA156);
    assert.equal(n.mem.read16(0x1FD8),0);assert.equal(n.mem.read16(0x1FDA),0);
  }
});
test('start rejects invalid context before effects and exposes an absent SRAM or helper without manufacturing data',()=>{
  for(const mutate of [v=>v.a.ctx.pc++,v=>v.a.ctx.d++,v=>v.a.ctx.bank=0x7E,v=>v.a.ctx.status|=0x20]){
    const v=side();mutate(v);const before=v.mem.wram.slice();assert.throws(()=>runMainStart(v.a,null,MAIN_START_ROUTINES),e=>e.reason==='main_start_entry_required');assert.deepEqual(v.mem.wram,before);
  }
  const v=side(0);v.mem.sram=null;assert.throws(()=>runMainStart(v.a,null,MAIN_START_ROUTINES),e=>e.reason==='unmapped_read'&&e.address===0x700000);
  assert.equal(v.a.ctx.pc,0xB19F);assert.equal(v.a.ctx.bank,0x7E); // MVN has selected its destination before its first read.
  const b=side(),r=prefixRoutines(b);r.delete(0x809629);const s=b.a.ctx.s;
  assert.throws(()=>runMainStart(b.a,null,r),e=>e.reason==='main_loop_frontier'&&e.target===0x809629);
  assert.equal(b.a.ctx.s,s-2);assert.equal(b.mem.read16((b.a.ctx.s+1)&65535),3);
});

const freeze=rows=>Object.freeze(rows.map(o=>Object.freeze({...o})));
const eventSet=interrupts=>({values:freeze([]),waitIndex:0,waitEvents:[],calls:[],inputs:freeze([]),inputIndex:0,
  interrupts:freeze(interrupts),interruptIndex:0,interruptRoutines:GAME_NMI_ROUTINES});
function connectedSide(choice=0xFFFF,sram=null){const v=side(choice);if(sram)v.mem.sram.set(sram);
  v.mem.wram.set(Buffer.from(window(0x98FFFA,0x98FFFD).hex,'hex'),0x8C);return v;}
function startObservations(makeSide){const io=[],interrupts=[];
  // Explicit synthetic fixture construction. Restart from the same initial
  // state on each missing observation, then replay the frozen list verbatim.
  for(let attempt=0;attempt<1000;attempt++){const v=makeSide(),e=eventSet(interrupts);v.a.io=io;
    try{runMainStart(v.a,e,MAIN_START_ROUTINES);finishInterruptObservations(e);assert.equal(v.a.ioIndex,io.length);return {v,io,interrupts};}
    catch(error){
      if(error.reason==='wait_interrupt_observation_required'){assert.equal(error.observationIndex,interrupts.length);
        const nmi=[0x81B0A5,0x81ACAF,0x81ACBD,0x81ACC3,0x81ACC9].includes(error.pc);
        if(nmi){const enable=v.a.trace.filter(o=>(o.address&65535)===0x4200).at(-1);assert.ok(enable.value&0x80);}
        interrupts.push({pc:error.pc,nmi});continue;
      }
      if(error.reason==='device_observation_required'){assert.equal(error.details.observationIndex,io.length);
        const port=error.address&65535,value=port===0x2140?v.mem.read8(0x1CE4):port===0x4210?0x80:0;
        assert.ok([0x2140,0x4210,0x4212,0x4218].includes(port),'unexpected synthetic device '+port.toString(16));
        io.push({pc:error.details.pc,address:error.address,width:error.details.width,value});continue;
      }
      throw error;
    }
  }assert.fail('connected start observation construction exceeded its bound: '+JSON.stringify({
    interrupts:interrupts.length,io:io.length,lastInterrupts:interrupts.slice(-5),lastIo:io.slice(-5)}));
}
test('whole new-game and saved starts use real initialization, transition and observed game NMIs before the first main instruction',()=>{
  let saved=null;
  for(const choice of [0xFFFF,0]){const makeSide=()=>connectedSide(choice,saved),recorded=startObservations(makeSide),
    n=recorded.v,r=makeSide(),e=eventSet(recorded.interrupts);r.a.io=recorded.io;
  // Original caller instructions; its separate, already proved helpers run
  // with their actual return frames and the same original ROM/data/memory.
  const stop=Symbol('first main instruction');
  assert.throws(()=>runReference(maps[0],r.mem,r.a.ctx,{entry:0x809688,root:'RTS',io:r.a.trace,
    calls:external(r.a,e,MAIN_START_ROUTINES,maps[0]),before:new Map([[0x8096AB,()=>{r.a.ctx.pc=0x96AB;throw stop;}]])}),err=>err===stop);
  finishInterruptObservations(e);assert.equal(r.a.ioIndex,recorded.io.length);
  assert.deepEqual(n.a.ctx,r.a.ctx);assert.deepEqual(n.mem.wram,r.mem.wram);assert.deepEqual(n.mem.sram,r.mem.sram);assert.deepEqual(n.a.trace,r.a.trace);
  assert.equal(n.h.pointer(0x6E),0x80C152);assert.equal(n.mem.read16(0x7E2DE2),3);assert.notEqual(n.mem.read16(0x24C),0xFFFF);
  assert.equal(n.a.ctx.s,0x1EEE);assert.equal(n.mem.read16(0x1EEF),0xA156);assert.ok(recorded.interrupts.some(o=>o.nmi));
    if(choice===0xFFFF){
      // Obtain the loading fixture from the actual save helper. The prefix
      // itself makes no checksum/validity decision and does not invent a slot.
      n.h.load(0);n.h.call(0x80CE19,0x81B17D,()=>saveGameSlot(n.h),true);saved=n.mem.sram.slice();
    }
  }
});
