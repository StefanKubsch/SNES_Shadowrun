import test from 'node:test';
import assert from 'node:assert/strict';
import {gameNmiSpecs} from './main-game-nmi-source.mjs';
import {mainInitializeSpecs,proveMainInitialize} from './main-initialize-source.mjs';
import {matrixNmiSpecs} from './main-matrix-nmi-source.mjs';
import {wordInterruptWindows} from './main-word-wait-interrupt-source.mjs';
import {textComposeWindows} from './task-native-text-compose-source.mjs';
import {taskTextComposeFixture} from './task-native-text-compose-fixtures.mjs';
import {taskMenuFixture} from './task-native-menu-fixtures.mjs';
import {decodeSource as decodeMenu} from './render-task-native-menu-compose-source-proof.mjs';
import {counterWindows} from './render-task-native-counter-b0a1-source-proof.mjs';
import {inputApuWindows} from './render-task-native-input-apu-source-proof.mjs';
import {decodeWindows,DialogTestMemory,rom,romBytes} from './task-native-dialog-harness.mjs';
import {runReference} from './w65c816-reference.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {clearTextTiles} from '../src/task/main-initialize.mjs';
import {GAME_NMI_ROUTINES} from '../src/task/main-game-nmi.mjs';
import {printText,drawTextBuffer} from '../src/task/native-text-compose.mjs';
import {runTaskMenuCompose} from '../src/task/native-menu-compose.mjs';
import {finishInterruptObservations} from '../src/task/main-wait-interrupt.mjs';
import {finishTextDmaObservations} from '../src/task/main-dma-readback.mjs';
import {textDma,referenceTextDma} from './main-dma-readback-fixtures.mjs';

const freeze=rows=>Object.freeze(rows.map(o=>Object.freeze({...o})));
const expand=t=>t.flatMap(o=>o.width===2?[{...o,width:1,value:o.value&255},{...o,width:1,address:o.address+1,value:o.value>>>8}]:[{...o,width:1}]);
const a9e1=decodeWindows(gameNmiSpecs.find(s=>s.entry===0x81A9E1).windows);
const nmi=decodeWindows([...matrixNmiSpecs[2].windows,...gameNmiSpecs.flatMap(s=>s.windows)]);
const words=decodeWindows(wordInterruptWindows);
function side(dbr=0,vmadd=0xFFFF){
  const mem=new DialogTestMemory(new Uint8Array(0x20000),null,rom.slice());
  const a=new TaskAccessor({mem,a:0xABCD,x:0x1234,y:0xFEDC,s:0x1EF0,d:0,dbr,p:0xC5,pc:0xA9E1});
  a.load();a.ctx.programBank=0x81;a.trace=[];a.io=[];a.devices={write(){}};
  mem.write16(0x1FC,1);mem.write16(0x20E,vmadd);
  for(let i=0;i<18;i++)mem.write8(0x7E2ADF+i,0xA5);
  const h=dialogAccess(a);h.pushByte(0x80);h.push(0x1234,2);
  return {mem,a,h};
}
function referenceIo(v){let byte=0;const read=v.mem.read8.bind(v.mem);
  v.mem.read8=address=>{const o=v.a.io[v.a.ioIndex];if(o&&address===o.address+byte){const value=o.value>>>(8*byte++)&255;
    if(byte===o.width){v.a.ioIndex++;byte=0;}return value;}return read(address);};
}
const portIo=(dbr=0)=>[{pc:0x81AA8E,address:dbr<<16|0x213A,width:1,value:0x7B}];

test('channel-5 configuration, dynamic register stores, widths and clear order retain pinned original source',()=>{
  for(const entry of [0x81AB2C,0x81A9E1]){const s=mainInitializeSpecs.find(s=>s.entry===entry);proveMainInitialize(decodeWindows(s.windows),s);}
  const init=decodeWindows(mainInitializeSpecs.find(s=>s.entry===0x81AB2C).windows);
  for(const [pc,port,value]of [[0x81AB8E,0x4350,0x81],[0x81AB9B,0x4351,0x39],[0x81ABAA,0x4354,0x7E]]){
    const i=init.get(pc);assert.equal(i.mnemonic,'STA');assert.equal(i.value,port);assert.equal(i.state.m,1);
    assert.equal(init.get(pc-2).value,value);
  }
  assert.deepEqual([...a9e1.values()].filter(i=>i.cpu>=0x81AA75).map(i=>[i.cpu,i.mnemonic,i.value,i.state.m]),[
    [0x81AA75,'LDA',0x20E,0],[0x81AA78,'STA',0x2116,0],[0x81AA7B,'LDA',16,0],[0x81AA7E,'STA',0x4355,0],
    [0x81AA81,'LDA',0x2AE0,0],[0x81AA84,'STA',0x4352,0],[0x81AA87,'SEP',32,0],
    [0x81AA89,'LDA',0x80,1],[0x81AA8B,'STA',0x2115,1],[0x81AA8E,'LDA',0x213A,1],
    [0x81AA91,'LDA',0x20,1],[0x81AA93,'STA',0x420B,1],[0x81AA96,'REP',32,1],[0x81AA98,'STZ',0x1FC,0],[0x81AA9B,'RTL',0,0]]);
});

test('explicit transfer occurrences match original A9E1 stores and physical BYTE writes before its flag clear',()=>{
  for(const dbr of [0,0x80,0x81])for(const vmadd of [0,0x7FFF,0xFFFF]){
    const r=side(dbr,vmadd),n=side(dbr,vmadd),o=textDma(vmadd,vmadd,dbr<<16|0x420B);
    r.a.io=portIo(dbr);n.a.io=portIo(dbr);referenceIo(r);const used=referenceTextDma(r,[o]);
    runReference(a9e1,r.mem,r.a.ctx,{entry:0x81A9E1,io:r.a.trace});
    const writes=[],write=n.mem.write8.bind(n.mem);
    n.mem.write8=(address,value)=>{if(address>=0x7E2AE0&&address<0x7E2AF0){
      assert.equal(n.a.trace.at(-1).pc,0x81AA93);assert.equal(n.mem.read16(0x1FC),1);writes.push([address,value]);}
      write(address,value);};
    const e={dmaTransfers:Object.freeze([o])};clearTextTiles(n.h,e);finishTextDmaObservations(e);
    assert.equal(used(),1);assert.deepEqual(n.a.ctx,r.a.ctx);assert.deepEqual(n.mem.wram,r.mem.wram);
    assert.deepEqual(expand(n.a.trace),expand(r.a.trace));assert.equal(n.a.ioIndex,1);
    assert.deepEqual(writes,o.bytes.map((value,i)=>[0x7E2AE0+i,value]));
    assert.equal(n.mem.read8(0x7E2ADF),0xA5);assert.equal(n.mem.read8(0x7E2AF0),0xA5);
  }
});

test('missing, mutable, stale-register, wrong-direction, wrong-width and malformed occurrences never partly write or clear',()=>{
  const good=textDma(),bad=[];
  for(const [key,value]of Object.entries(good)){
    if(key==='bytes')continue;
    bad.push(Object.freeze([{...good,[key]:value^1}]));
    bad.push(Object.freeze([Object.freeze({...good,[key]:value^1})]));
  }
  for(const bytes of [good.bytes.slice(),Object.freeze(good.bytes.slice(1)),Object.freeze([...good.bytes,0]),
    Object.freeze([...good.bytes.slice(0,15),256]),Object.freeze([...good.bytes.slice(0,15),-1]),
    Object.freeze([...good.bytes.slice(0,15),1.5]),Object.freeze(new Array(16))])
    bad.push(Object.freeze([Object.freeze({...good,bytes})]));
  bad.push(undefined,[],Object.freeze([]),[good],Object.freeze([{...good}]));
  for(const dmaTransfers of bad){const v=side(0,0),before=v.mem.wram.slice(0x2AE0,0x2AF0);v.a.io=portIo();
    const e={interrupts:Object.freeze([]),dmaTransfers};
    assert.throws(()=>clearTextTiles(v.h,e),err=>err.reason==='text_dma_observation_required'&&err.pc===0x81AA93);
    assert.equal(e.dmaIndex,undefined);assert.equal(v.mem.read16(0x1FC),1);assert.equal(v.a.ctx.status&32,32);
    assert.deepEqual(v.mem.wram.slice(0x2AE0,0x2AF0),before);assert.equal(v.a.trace.at(-1).pc,0x81AA93);
  }
  assert.throws(()=>finishTextDmaObservations({dmaTransfers:Object.freeze([good])}),e=>e.reason==='text_dma_observation_unused');
});

test('unreached requests and WRAM register shadows consume no transfer, while repeated occurrences keep order',()=>{
  const v=side(0,0),one=textDma(0,1),two=textDma(0x1234,2),e={dmaTransfers:Object.freeze([one,two])};v.a.io=portIo();
  clearTextTiles(v.h,e);assert.equal(e.dmaIndex,1);assert.deepEqual([...v.mem.wram.slice(0x2AE0,0x2AF0)],one.bytes);
  v.h.pushByte(0x80);v.h.push(0x1234,2);clearTextTiles(v.h,e);assert.equal(e.dmaIndex,1);
  v.mem.write16(0x1FC,1);v.mem.write16(0x20E,0x1234);v.a.io.push(...portIo());v.h.pushByte(0x80);v.h.push(0x1234,2);
  clearTextTiles(v.h,e);finishTextDmaObservations(e);assert.deepEqual([...v.mem.wram.slice(0x2AE0,0x2AF0)],two.bytes);
  const w=side(0x7E,0),before=w.mem.wram.slice(0x2AE0,0x2AF0),ew={dmaTransfers:Object.freeze([])};
  clearTextTiles(w.h,ew);finishTextDmaObservations(ew);assert.deepEqual(w.mem.wram.slice(0x2AE0,0x2AF0),before);
  assert.equal(w.mem.read8(0x7E420B),0x20);assert.equal(w.mem.read16(0x1FC),0);
});

test('whole text and menu consume observed DMA masks, counter and input with full original NMI/RTI',()=>{
  const menu=decodeMenu(romBytes).map;
  const input=decodeWindows([{start:0x809E1A,hex:inputApuWindows[0].hex.slice(0,0x23*2)}]);
  const observations=new Map([...words,...decodeWindows(counterWindows),...input]);
  for(const helper of ['FE69','FB39','menu'])for(const offset of [0,3,7]){
    const fixture=helper==='menu'?taskMenuFixture(0x80A6A5,{offset,held:0x2000}):taskTextComposeFixture(helper,{offset}),entry=fixture.entry;
    const setup=()=>{const v=side(fixture.context.bank,0);v.a.ctx.programBank=0x80;v.a.ctx.pc=entry&65535;
      v.a.ctx.s=0x1EF0;v.h.push(0x1234,2);
      for(const [address,value]of fixture.data.snapshot().bytes){
        if(address>=0x7E0000&&address<=0x7FFFFF)v.mem.write8(address,value);
        else v.mem.rom[((address>>>16)&0x1F)<<15|(address&0x7FFF)]=value;
      }
      v.mem.write16(0x6E,0xC152);v.mem.write8(0x70,0x80);v.mem.write16(0x140,0xFFFF);v.mem.write16(0xCD8,1);
      v.a.io=[...fixture.ioObservations];v.a.observeArithmetic=true;return v;};
    const r=setup(),n=setup(),records=[],transfers=[];referenceIo(r);const used=referenceTextDma(r,transfers);
    const hooks=new Map([...observations.keys()].map(pc=>[pc,()=>{
      const pending=[0x81ACAF,0x81ACBD,0x81ACC3,0x81ACC9].includes(pc)&&r.mem.read16(words.get(pc).value)!==0;
      const interrupt=pending||pc===0x81B0A5;
      records.push({pc,nmi:interrupt});if(!interrupt)return;
      r.a.ctx.programBank=pc>>>16;r.a.ctx.pc=pc&65535;const before={...r.a.ctx};
      const io=[...(before.bank===0x7E?[]:[{pc:0x00C118,address:before.bank<<16|0x4210,width:2,value:0x80}]),
        ...(r.mem.read16(0x1FC)?portIo():[]),{pc:0x809E0B,address:0x4212,width:2,value:0},
        {pc:0x809E13,address:0x4218,width:2,value:helper==='menu'?0x2000:0}];
      r.a.io.splice(r.a.ioIndex,0,...io);
      if(r.mem.read16(0x1FC))transfers.push(textDma(r.mem.read16(0x20E),offset+1));
      r.h.pushByte(before.programBank);r.h.push(before.pc,2);r.h.pushByte(before.status);
      r.a.ctx.status=(before.status|4)&~8;r.a.ctx.programBank=0;
      runReference(nmi,r.mem,r.a.ctx,{entry:0x00C112,root:'RTI',io:r.a.trace});assert.deepEqual(r.a.ctx,before);
    }]));
    runReference(helper==='menu'?menu:decodeWindows(textComposeWindows(entry)),r.mem,r.a.ctx,{entry,root:'RTS',io:r.a.trace,before:hooks});
    n.a.io=r.a.io;const e={interrupts:freeze(records),interruptIndex:0,interruptRoutines:GAME_NMI_ROUTINES,
      dmaTransfers:Object.freeze(transfers),waitIndex:0,values:freeze([]),calls:[],inputIndex:0,inputs:freeze([])};
    const p=helper==='menu'?runTaskMenuCompose(n.a,e,entry,false):(helper==='FE69'?printText:drawTextBuffer)(n.a,e,false);finishInterruptObservations(e);
    if(helper==='menu'){assert.equal(p.outcome,'menu_cancelled');assert.equal(p.iterations,1);assert.equal(e.inputIndex,0);}
    else assert.equal(p.glyphs,1);
    assert.equal(used(),transfers.length);assert.equal(e.dmaIndex,transfers.length);assert.equal(e.waitIndex,0);
    assert.deepEqual(n.a.ctx,r.a.ctx);assert.deepEqual(n.mem.wram,r.mem.wram);assert.deepEqual(expand(n.a.trace),expand(r.a.trace));
    assert.equal(n.a.ioIndex,r.a.io.length);assert.equal(r.a.ioIndex,r.a.io.length);
    // First eight mask words have been consumed and changed by the real glyph path.
    assert.notDeepEqual([...n.mem.wram.slice(0x2AE0,0x2AF0)],transfers[0].bytes);
  }
});
