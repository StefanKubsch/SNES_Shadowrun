// Oracle tools only. Export input observations, never an expected image or
// later CPU/PPU state, into the bounded native browser startup.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {decode} from './disassemble.mjs';
import {rom} from './task-native-dialog-harness.mjs';
import {findMesen} from './mesen.mjs';
import {recordBootPrefix,compareBootPrefix} from './mesen-boot-prefix.mjs';
import {runObservedLogo} from '../proof/video/boot-observed.mjs';
import {renderMode1Frame} from '../src/video/ppu-frame.mjs';
const romSha256='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
function memoryRuns(bytes){const runs=[];for(const value of bytes){const last=runs.at(-1);if(last&&last[1]===value)last[0]++;else runs.push([1,value]);}return runs;}
export function logoObservations(recorded){
 assert.equal(recorded.checkpoint,0x81EEF1);const reads=[];
 for(const o of recorded.io)if(o.kind==='read'){
  const pc=(o.pcAfter-3)&0xFFFFFF,i=decode(rom,pc,{e:0,m:0,x:0});
  assert.equal(i.next,o.pcAfter,'original logo input instruction');assert.equal(i.mode,'abs','original logo input mode');
  const last=reads.at(-1);if(last&&last[0]===o.address&&last[1]===pc&&last[2]===o.value)last[3]++;
  else reads.push([o.address,pc,o.value,1]);
 }
 return {schema:1,romSha256,checkpoint:recorded.checkpoint,
  initial:{context:recorded.initial.context,wram:memoryRuns(recorded.initial.wram),sram:memoryRuns(recorded.initial.sram)},
  reads,chronology:recorded.chronology.map(o=>o.kind==='L'?['L',o.count]:[o.kind,o.pc]),instructionSteps:recorded.instructionSteps,nmis:recorded.nmis};
}
export function originalLogoPixels(video){
 assert.equal(video.width,256);assert.ok([224,239].includes(video.height),'original 224-line noninterlaced frame');
 const top=video.height===239?7:0,pixels=new Uint8ClampedArray(256*224*4);
 if(top){assert.ok(video.rgb.subarray(0,7*256*3).every(v=>v===0),'original top border');
  assert.ok(video.rgb.subarray(231*256*3).every(v=>v===0),'original bottom border');}
 for(let y=0;y<224;y++)for(let x=0;x<256;x++){
  const src=((y+top)*256+x)*3,dst=(y*256+x)*4;
  pixels[dst]=video.rgb[src];pixels[dst+1]=video.rgb[src+1];pixels[dst+2]=video.rgb[src+2];pixels[dst+3]=255;
 }
 return pixels;
}
export function compareLogoNative(recorded,bundle=logoObservations(recorded)){
 const native=runObservedLogo(rom,bundle),original=recorded.video;
 assert.deepEqual(native.context,recorded.final.context,'native logo CPU');
 assert.deepEqual(native.memory.wram,recorded.final.wram,'native logo WRAM');assert.deepEqual(native.memory.sram,recorded.final.sram,'native logo SRAM');
 for(const name of ['vram','cgram','oam'])assert.deepEqual(native.ppu[name],original[name],'native logo '+name);
 const pixels=renderMode1Frame(native.ppu),expected=originalLogoPixels(original);assert.deepEqual(pixels,expected,'native frame versus original');
 return {native,pixels};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const {exe,reason}=findMesen();assert.ok(exe,reason);
 const recorded=await recordBootPrefix(exe,{checkpoint:0x81EEF1,capturePpu:true}),cpu=compareBootPrefix(recorded),bundle=logoObservations(recorded);
 compareLogoNative(recorded,bundle);
 const path=new URL('../assets/boot-logo-observations.json',import.meta.url);writeFileSync(path,JSON.stringify(bundle)+'\n');
 console.log(JSON.stringify({observationsBytes:readFileSync(path).length,nmis:cpu.nmis,instructionSteps:cpu.interruptSteps,dmaBytes:cpu.dmaBytes,recording:recorded.recording}));
}
