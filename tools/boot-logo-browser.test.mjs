import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findMesen} from './mesen.mjs';
import {recordBootPrefix,compareBootPrefix} from './mesen-boot-prefix.mjs';
import {logoObservations,compareLogoNative} from './capture-boot-logo.mjs';
import {runObservedLogo} from '../proof/video/boot-observed.mjs';
import {renderMode1Frame} from '../src/video/ppu-frame.mjs';
import {rom} from './task-native-dialog-harness.mjs';
const {exe,reason}=findMesen();
test('cold original logo matches native CPU, full PPU memory, every pixel (M4; the browser canvas: live-game-browser.test.mjs)',
 {skip:exe?false:'Mesen not available: '+reason},async t=>{
 const recorded=await recordBootPrefix(exe,{checkpoint:0x81EEF1,capturePpu:true}),cpu=compareBootPrefix(recorded),bundle=logoObservations(recorded);
 assert.deepEqual(bundle,JSON.parse(readFileSync('assets/boot-logo-observations.json','utf8')),'portable original input observations');
 assert.equal(cpu.nmis,169);assert.equal(cpu.interruptSteps,2856198);assert.equal(cpu.dmaBytes,86496);
 const {native,pixels}=compareLogoNative(recorded,bundle);
 t.diagnostic(JSON.stringify({nmis:cpu.nmis,instructionSteps:cpu.interruptSteps,ioBytes:cpu.ioBytes,dmaBytes:cpu.dmaBytes,readBytes:native.readBytes,recording:recorded.recording}));
 // Counterexamples are test mutations, never admitted original states.
 const reads=bundle.reads.map(r=>r.slice());reads[0][1]^=1;assert.throws(()=>runObservedLogo(rom,{...bundle,reads}),/boot_device_read_required/);
 const chronology=bundle.chronology.map(r=>r.slice()),at=chronology.findIndex(r=>r[0]==='H');assert.ok(at>=0);chronology[at][1]^=1;
 assert.throws(()=>runObservedLogo(rom,{...bundle,chronology}),/boot_nmi_position_required/);
 native.ppu.vramKnown[0]=0;assert.throws(()=>renderMode1Frame(native.ppu),/ppu_initial_memory_required/);native.ppu.vramKnown[0]=1;
 native.ppu.oam[1]=0;assert.throws(()=>renderMode1Frame(native.ppu),/ppu_visible_obj_source_required/);native.ppu.oam[1]=240;
 for(let n=0;n<512;n+=2)native.ppu.cgram[n]^=31;assert.notDeepEqual(renderMode1Frame(native.ppu),pixels,'pixels must come from native palette memory');
 });
