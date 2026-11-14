// Export only original input observations. Expectations (later CPU/RAM,
// PPU snapshots and original RGB frames) remain in the oracle recording.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {rom} from './task-native-dialog-harness.mjs';
import {findMesen} from './mesen.mjs';
import {recordBootPrefix,bootObservationSets} from './mesen-boot-prefix.mjs';
import {ObservedRoom} from '../proof/video/room-observed.mjs';
import {originalLogoPixels} from './capture-boot-logo.mjs';
export const ROOM_RECORD_OPTIONS=Object.freeze({checkpoint:0x8096C3,menuInput:true,stopHits:3,captureMainCalls:true,captureNativeCalls:true,
  capturePpu:true,captureRoomFrames:true,stopAfterNativeTarget:0x80E014,stopAfterNativeTargetHits:3,afterNativeTargetInput:['right'],timeoutMs:1200000});
function memoryRuns(bytes){const out=[];for(const value of bytes){const last=out.at(-1);if(last&&last[1]===value)last[0]++;else out.push([1,value]);}return out;}
function encodeInstructions(rows){const out=[];
  for(let n=0;n<rows.length;n++){
    const o=rows[n],second=o.pc===0x81EECD?0x81EED1:o.pc===0x81B0A5?0x81B0A9:null;
    if(!o.nmi&&second!==null&&rows[n+1]?.pc===second&&!rows[n+1].nmi){
      let count=1;while(rows[n+count*2]?.pc===o.pc&&!rows[n+count*2].nmi&&rows[n+count*2+1]?.pc===second&&!rows[n+count*2+1].nmi)count++;
      out.push(-count,o.pc,second);n+=count*2-1;
    }else out.push(o.pc|(o.nmi?0x1000000:0));
  }
  return out;
}
export function roomObservations(recorded){
  assert.equal(recorded.frames.length,2);const instructions=[],cache=new Map();let pending=false;
  const append=pc=>{const key=pc|(pending?0x1000000:0);if(!cache.has(key))cache.set(key,Object.freeze({pc,nmi:pending}));instructions.push(cache.get(key));pending=false;};
  for(const o of recorded.chronology){if(o.kind==='H')pending=true;else if(o.kind==='L')for(let n=0;n<o.count;n++)for(const pc of o.pcs)append(pc);else append(o.pc);}
  assert.equal(instructions.length,recorded.instructionSteps);assert.equal(pending,false);
  const sets=bootObservationSets(recorded,instructions).map(set=>{
    const reads=[];
    for(const {pc,address,width,value}of set.io){const last=reads.at(-1);
      if(last&&last[0]===pc&&last[1]===address&&last[2]===width&&last[3]===value)last[4]++;
      else reads.push([pc,address,width,value,1]);}
    return {target:set.target,reads,instructions:encodeInstructions(set.interrupts),dmaTransfers:set.dmaTransfers};
  });
  return {schema:1,romSha256:'91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690',checkpoint:recorded.checkpoint,
    initial:{context:recorded.initial.context,wram:memoryRuns(recorded.initial.wram),sram:memoryRuns(recorded.initial.sram)},
    rounds:recorded.mainCalls.length,sets,windows:recorded.ppuWindows,
    frames:recorded.frames.map(({frame,writes,controls,scanline})=>({frame,writes,controls,scanline}))};
}
export function compareRoomNative(recorded,bundle=roomObservations(recorded)){
  let frames=0;
  const native=new ObservedRoom(rom,bundle,{onFrame:(frame,ppu)=>{
    const original=recorded.frames[frames++];assert.equal(original.scanline,225,'original complete frame boundary');
    for(const name of ['vram','cgram','oam'])assert.deepEqual(ppu[name],original[name],'native room '+name);
    assert.deepEqual(frame.pixels,originalLogoPixels(original),'native room frame versus original');
  }}).finish();
  for(const name of ['wram','sram'])assert.deepEqual(native.memory[name],recorded.final[name],'native room '+name);
  native.vm.natives.accessor.load();native.vm.natives.accessor.ctx.e=native.vm.e;
  assert.deepEqual(native.vm.natives.accessor.ctx,recorded.final.context,'native room CPU');
  for(const name of ['vram','cgram','oam'])assert.deepEqual(native.bus.ppu[name],recorded.video[name],'native final room '+name);
  assert.equal(frames,2);assert.notDeepEqual(native.frames[0].pixels,native.frames[1].pixels,'original movement must change visible output');
  return native;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const {exe,reason}=findMesen();assert.ok(exe,reason);const recorded=await recordBootPrefix(exe,ROOM_RECORD_OPTIONS),bundle=roomObservations(recorded);
  const native=compareRoomNative(recorded,bundle),bytes=gzipSync(JSON.stringify(bundle));writeFileSync('assets/room-observations.json.gz',bytes);
  console.log(JSON.stringify({bytes:bytes.length,rounds:bundle.rounds,frames:native.frames.map(({pixels,...f})=>f),recording:recorded.recording}));
}
