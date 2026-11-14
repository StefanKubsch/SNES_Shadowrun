import test from 'node:test';
import assert from 'node:assert/strict';
import {LagFreeFrames,LiveDevices,BLOCKING_BRANCHES,PAD_BUTTONS,counterBytes} from '../src/vm/frame-events.mjs';
import {waitForRandomStateChangeWithInterrupts,runInterruptWordWait,ObservedWaitContinuation} from '../src/task/main-wait-interrupt.mjs';
import {waitWord} from '../src/task/native-dialog-portrait.mjs';
import {GAME_NMI_ROUTINES} from '../src/task/main-game-nmi.mjs';
import {WAIT_PAUSED,WAIT_RETURNED} from '../src/task/native-wait-continuation.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {DialogTestMemory,rom} from './task-native-dialog-harness.mjs';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {ObservedRoom} from '../proof/video/room-observed.mjs';

const romAt=address=>rom[((address>>>16)&0x7F)*0x8000+(address&0x7FFF)];
// Synthetic WRAM for the original game NMI C152; not a PAL timing fixture.
function side({bank=0x80,pad=0x8000,nmitimen=0x81,pc=0x81B0A1,returnBank=0x80}={}){
  const mem=new DialogTestMemory(new Uint8Array(0x20000),null,rom);
  for(const [at,value]of [[0x6E,0xC152],[0x1C76,0xFFFF],[0x140,0xFFFF],[0xCD8,1],[0x1CA,0x1111]])mem.write16(at,value);
  mem.write8(0x70,0x80);
  const a=new TaskAccessor({mem,a:0xBEAD,x:0xABCD,y:0x3456,s:0x1EED,d:0,dbr:bank,p:0x41,pc:pc&65535});a.load();
  a.ctx.e=0;a.ctx.programBank=pc>>>16;const h=dialogAccess(a);
  // The caller's long JSL frame, returned by the original RTL.
  h.pushByte(returnBank);a.pushWord(0x1234);
  const pads=[];const frames=new LagFreeFrames({nmitimen:nmitimen??undefined,pad:()=>{pads.push(pad);return pad;}});
  a.devices=new LiveDevices(frames,GAME_NMI_ROUTINES);a.io=Object.freeze([]);a.trace=[];
  return {mem,a,h,frames,pads,events:{interrupts:frames,interruptRoutines:GAME_NMI_ROUTINES}};
}
// The same original wait with explicit records and device observations.
function recorded(nmiAt,{bank=0x80,pad=0x8000}={}){const v=side({bank,pad});
  const records=[[0x81B0A1,false],...(nmiAt===0x81B0A5?[[0x81B0A5,true],[0x81B0A9,false]]:
    [[0x81B0A5,false],[0x81B0A9,true],[0x81B0A5,false],[0x81B0A9,false]]),[0x81B0AB,false]];
  v.events={interrupts:Object.freeze(records.map(([pc,nmi])=>Object.freeze({pc,nmi}))),interruptIndex:0,interruptRoutines:GAME_NMI_ROUTINES};
  // Bits outside the documented contract differ from the live answers on purpose.
  v.a.io=Object.freeze([...(bank===0x7E?[]:[{pc:0x00C118,address:bank<<16|0x4210,width:2,value:0x7F82}]),
    {pc:0x809E0B,address:0x4212,width:2,value:0xFFFE},{pc:0x809E13,address:0x4218,width:2,value:pad}]);
  v.a.devices={write(){}};return v;
}
const snapshot=v=>({ctx:{...v.a.ctx},wram:v.mem.wram.slice()});
const trace=v=>v.a.trace.filter(o=>o.kind==='write');

test('every blocking branch is the original backward branch onto its read, with the ROM condition',()=>{
  const conditions={0xF0:[2,true],0xD0:[2,false],0x10:[0x80,false]};
  for(const [pc,loops]of BLOCKING_BRANCHES){
    const [flag,set]=conditions[romAt(pc)]??assert.fail(pc.toString(16)),offset=romAt(pc+1)-256,read=pc+2+offset;
    assert.ok(offset<0&&[0xAD,0xCF].includes(romAt(read)),pc.toString(16));
    assert.equal(loops(set?flag:0),true);assert.equal(loops(set?0:flag),false);
  }
  // C118 LDA 4210 is followed by TSC; 9E0B LDA 4212 by AND #0001 / BNE; 9E13 LDA 4218.
  assert.deepEqual([0xC118,0xC119,0xC11A,0xC11B].map(o=>romAt(o)),[0xAD,0x10,0x42,0x3B]);
  assert.deepEqual([...Array(10)].map((_,n)=>romAt(0x809E0B+n)),[0xAD,0x12,0x42,0x29,0x01,0x00,0xD0,0xF8,0xAD,0x18]);
  assert.equal(PAD_BUTTONS,0xFFF0);
});

test('lag-free B0A1 equals the original record with its NMI at the same branch, for every DBR',()=>{
  for(const bank of [0,0x80,0x81,0x7E]){
    const live=side({bank}),rec=recorded(0x81B0A9,{bank});
    waitForRandomStateChangeWithInterrupts(live.h,live.events);waitForRandomStateChangeWithInterrupts(rec.h,rec.events);
    assert.deepEqual(snapshot(live),snapshot(rec));assert.deepEqual(trace(live),trace(rec));
    assert.equal(rec.events.interruptIndex,rec.events.interrupts.length);assert.equal(rec.a.ioIndex,rec.a.io.length);
    assert.equal(live.frames.nmis,1);assert.deepEqual(live.pads,[0x8000]);assert.equal(live.mem.read16(0x1CA),0x8000);
    assert.equal(live.a.ctx.programBank,0x80);assert.equal(live.a.ctx.pc,0x1235);assert.equal(live.frames.inNmi,false);
  }
});

test('another NMI position in the same loop differs only in the hardware frame below S',()=>{
  const at=recorded(0x81B0A5),branch=side();
  waitForRandomStateChangeWithInterrupts(at.h,at.events);waitForRandomStateChangeWithInterrupts(branch.h,branch.events);
  assert.deepEqual(at.a.ctx,branch.a.ctx);
  const s=0x1EED-3,diff=[];for(let n=0;n<0x20000;n++)if(at.mem.wram[n]!==branch.mem.wram[n])diff.push(n);
  // PB, PCH, PCL, P pushed at S..S-3 before the handler switches to 1CBB.
  assert.ok(diff.length>0&&diff.every(n=>n>=s-3&&n<=s),diff.map(n=>n.toString(16)).join());
});

test('non-blocking reads take no NMI; inline waits take one NMI per blocked iteration',()=>{
  const free=side({pc:0x81ACAF});free.mem.write16(0x1F8,0);
  runInterruptWordWait(free.h,free.events,0x81ACAF);assert.equal(free.frames.nmis,0);assert.equal(free.mem.read16(0x1C76),0xFFFF);
  // 8FBA in the NMI stores FFFF to 0140; BPL at 901F then falls through.
  const inline=side({pc:0x80901C});inline.mem.write16(0x140,0);inline.a.ctx.programBank=0x80;
  waitWord(inline.h,inline.events,0x80901C,0x140);
  assert.equal(inline.frames.nmis,1);assert.equal(inline.mem.read16(0x140),0xFFFF);assert.equal(inline.mem.read16(0x1C76),0);
  assert.equal(inline.a.ctx.pc,0x901F);
});

test('the resumable wait owner matches the synchronous lag-free result at budget one',()=>{
  const sync=side(),cont=side();waitForRandomStateChangeWithInterrupts(sync.h,sync.events);
  const c=new ObservedWaitContinuation(cont.h,cont.events,0x81B0A1);
  assert.equal(c.run(0),WAIT_PAUSED);let pauses=0;
  while(c.run(1)===WAIT_PAUSED)assert.ok(++pauses<500);
  assert.ok(pauses>10);assert.deepEqual(snapshot(cont),snapshot(sync));assert.deepEqual(trace(cont),trace(sync));
  assert.deepEqual(cont.pads,[0x8000]);assert.equal(c.run(5),WAIT_RETURNED);
});

test('NMITIMEN, pad words and nested NMIs are boundaries, never assumptions',()=>{
  for(const [nmitimen,reason]of [[null,'frame_nmitimen_required'],[0x01,'frame_nmi_disabled'],[0x80,'frame_joypad_disabled']]){
    const v=side({nmitimen});assert.throws(()=>waitForRandomStateChangeWithInterrupts(v.h,v.events),e=>e.reason===reason);
  }
  for(const pad of [0x0001,0x10000,-1,0.5]){const v=side({pad});
    assert.throws(()=>waitForRandomStateChangeWithInterrupts(v.h,v.events),e=>e.reason==='frame_pad_word_required');}
  // The original writes NMITIMEN through the device port; a later wait uses it.
  const v=side({nmitimen:null});v.a.devices.write(0x80FFFF,0x804200,0x81,1);assert.equal(v.frames.nmitimen,0x81);
  v.a.devices.write(0x80FFFF,0x7E4200,0x00,1);assert.equal(v.frames.nmitimen,0x81);
  v.a.devices.write(0x80FFFF,0x0041FF,0x0100,2);assert.equal(v.frames.nmitimen,0x01);
  const nested=new LagFreeFrames({nmitimen:0x81});nested.enterNmi();
  assert.throws(()=>nested.nmiAt(2,0x81B0A9),e=>e.reason==='frame_nested_nmi');
  // Outside an NMI and for any other read the live source has no answer.
  assert.equal(nested.read(0x4218,2,0x809E13),0x0000);nested.leaveNmi();
  assert.equal(nested.read(0x4218,2,0x809E13),undefined);
  nested.enterNmi();for(const [address,width,pc]of [[0x4212,1,0x809E0B],[0x4212,2,0x81EEC2],[0x2140,1,0x81F00E],[0x4219,2,0x809E13]])
    assert.equal(nested.read(address,width,pc),undefined);
  assert.throws(()=>new LagFreeFrames({nmitimen:256}),e=>e.reason==='frame_nmitimen_required');
  assert.throws(()=>new LiveDevices(nested,null),e=>e.reason==='frame_devices_required');
});

test('recorded device streams are consumed before a live device answers',()=>{
  const v=side();v.a.io=Object.freeze([{pc:0x809E0B,address:0x804212,width:2,value:1}]);
  // The first read must match its record; a mismatch is not replaced by the live source.
  v.a.ctx.bank=0x80;v.frames.enterNmi();
  assert.throws(()=>v.a.absoluteRead(0x4218,2,0x809E13),e=>e.reason==='device_observation_required');
  assert.equal(v.a.absoluteRead(0x4212,2,0x809E0B),1);assert.equal(v.a.absoluteRead(0x4212,2,0x809E0B),0);
});

// Not an original comparison: the lag-free model continues the same native
// owner after the complete first-room replay with a live pad.
const bundle=JSON.parse(gunzipSync(readFileSync('assets/room-observations.json.gz')));
function liveRoom(padAt,count){const room=new ObservedRoom(rom,bundle);
  assert.throws(()=>room.live({pad:()=>0}),e=>e.reason==='room_replay_incomplete');
  room.finish();const hashes=[],raster=[];let nmi=0;
  const frames=room.live({pad:k=>padAt(k),onFrame:f=>{assert.equal(f.nmi,nmi);nmi++;
    hashes.push(createHash('sha256').update(f.pixels).digest('hex'));raster.push(f.rasterWrites);}});
  assert.equal(frames.nmitimen,0x81);assert.throws(()=>room.live({pad:()=>0}),e=>e.reason==='room_replay_incomplete');
  while(frames.nmis<count)room.stepLive();
  return {room,frames,hashes,raster,wram:room.memory.wram.slice()};
}
test('the first room continues live with lag-free frames and a live pad',()=>{
  const down=at=>at<40?0:0x0400,a=liveRoom(down,160),b=liveRoom(down,160),idle=liveRoom(()=>0,160);
  // NMITIMEN comes from the replay's own last write (0x81 at 80:9671).
  assert.equal(a.hashes.length,160);assert.deepEqual(a.hashes,b.hashes);assert.deepEqual(a.wram,b.wram);
  assert.ok(a.raster.every(n=>n===0));
  assert.deepEqual(a.hashes.slice(0,41),idle.hashes.slice(0,41));
  assert.notDeepEqual(a.hashes.slice(41),idle.hashes.slice(41));assert.notDeepEqual(a.wram,idle.wram);
  // 9E0B stored the last latched live word at 01CA.
  assert.equal(a.room.memory.wram[0x1CB]<<8|a.room.memory.wram[0x1CA],0x0400);
  assert.throws(()=>new ObservedRoom(rom,bundle).stepLive(),e=>e.reason==='room_live_required');
});

test('the PPU multiplier is signed 16 x 8 bits and rejects an interleaved latch',async()=>{
  const {PpuState}=await import('../src/video/ppu-state.mjs');
  const product=(a,b)=>{const p=new PpuState();p.writeByte(0x211B,a&255);p.writeByte(0x211B,a>>>8);p.writeByte(0x211C,b);
    return [0x2134,0x2135,0x2136].map(port=>p.readProduct(port)).reduce((x,v,n)=>x|v<<(8*n),0);};
  // Book I PDF 124/134: two's complement operands and 24-bit result.
  for(const [a,b,expected]of [[0x0003,0x05,15],[0xFFFF,0x02,0xFFFFFE],[0x8000,0x80,0x400000],[0x7FFF,0x7F,0x3F7F81],[0x1234,0xFF,0xFFEDCC]])
    assert.equal(product(a,b),expected,a.toString(16)+'*'+b.toString(16));
  const p=new PpuState();assert.throws(()=>p.readProduct(0x2134),e=>e.reason==='ppu_multiplier_operands_required');
  p.writeByte(0x211B,1);assert.throws(()=>p.writeByte(0x211C,1),e=>e.reason==='ppu_multiplier_latch_required');
  // Live devices answer 2134 from the PPU; without a PPU the text mask DMA is a boundary.
  const q=new PpuState();q.writeByte(0x211B,7);q.writeByte(0x211B,0);q.writeByte(0x211C,6);
  const frames=new LagFreeFrames({nmitimen:0x81}),live=new LiveDevices(frames,GAME_NMI_ROUTINES,{bus:{ppu:q,write(){}}});
  assert.equal(live.read(0x802134,2,0x80FA01),42);assert.equal(live.read(0x802136,1,0x80FA19),0);
  assert.equal(live.read(0x7E2134,2,0x80FA01),undefined);
  const bare=new LiveDevices(frames,GAME_NMI_ROUTINES);
  assert.throws(()=>bare.write(0x81AA93,0x80420B,0x20,1),e=>e.reason==='frame_text_dma_device_required');
  bare.write(0x81AA40,0x80420B,0x80,1);assert.equal(bare.read(0x802134,2,0x80FA01),undefined);
});

test('the live random substitute feeds only the two used counter bytes of C560',async()=>{
  const {randomBelow}=await import('../src/task/native-random.mjs');
  // ROM: C566 LDA 2137, C569 LDA C58D,Y (dead read); C572 EOR 213C; C57F EOR 213D.
  assert.deepEqual([0xC566,0xC569,0xC572,0xC57F].map(o=>romAt(0x800000|o)),[0xAD,0xB9,0x4D,0x4D]);
  assert.deepEqual([0xC567,0xC568,0xC573,0xC574,0xC580,0xC581].map(o=>romAt(0x800000|o)),[0x37,0x21,0x3C,0x21,0x3D,0x21]);
  // Five rolls on the same WRAM: the counter bytes reach the high byte and
  // the next state 1CE8, so they change later rolls, not the first low byte.
  const roll=(counter,limit=6)=>{const v=side({pc:0x80C51F});v.a.ctx.bank=0x80;
    const reads=[],values=[];let attempts=0;
    v.a.devices=new LiveDevices(v.frames,GAME_NMI_ROUTINES,{counter:(port,pc)=>{const b=counter();reads.push([port,pc]);return b;}});
    for(let n=0;n<5;n++){v.a.ctx.programBank=0x80;v.a.ctx.pc=0xC51F;v.mem.write16(0,limit);v.a.pushWord(0x4321);
      attempts+=randomBelow(v.a).attempts;values.push(v.mem.read16(0));assert.equal(v.a.ctx.pc,0x4322);}
    return {value:values.join(),values,state:v.mem.read8(0x1CE8),attempts,reads};};
  const a=roll(counterBytes()),b=roll(counterBytes()),c=roll(counterBytes(7));
  assert.deepEqual(a,b,'same seed, same rolls');assert.ok(a.values.every(v=>v<=6));
  assert.equal(a.reads.length,2*a.attempts);
  assert.ok(a.reads.every(([port,pc],n)=>n%2?port===0x213D&&pc===0x80C57F:port===0x213C&&pc===0x80C572));
  // Explicit original bytes (oracle mode) drive the same equations.
  const bytes=[0x12,0x34,0x56,0x78,0x9A,0xBC,0xDE,0xF0];let i=0;
  assert.deepEqual(roll(()=>bytes[i++%8]),(i=0,roll(()=>bytes[i++%8])));
  const values=new Set();for(let seed=1;seed<40;seed++)values.add(roll(counterBytes(seed)).value);
  assert.ok(values.size>3,'different seeds give different rolls '+[...values]);
  assert.throws(()=>roll(()=>256),e=>e.reason==='frame_counter_byte_required');
  assert.throws(()=>counterBytes(0),e=>e.reason==='frame_counter_seed_required');
  assert.ok(c.values.every(v=>v<=6));
});
