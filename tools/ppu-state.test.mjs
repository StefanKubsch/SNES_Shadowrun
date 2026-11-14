import test from 'node:test';
import assert from 'node:assert/strict';
import {PpuState,PpuBus} from '../src/video/ppu-state.mjs';
import {renderMode1Frame} from '../src/video/ppu-frame.mjs';

// Synthetic fixtures check the manual's port/bitplane contracts only. The
// separate boot-logo-browser test establishes actual cold original evidence.
test('PPU VRAM word wrap and CGRAM latches keep byte order and known state',()=>{
 const p=new PpuState();assert.throws(()=>p.requireComplete(),/ppu_initial_memory_required/);
 p.writeByte(0x2100,0x80);p.writeByte(0x2115,0x80);p.writeByte(0x2116,255);p.writeByte(0x2117,255);
 p.writeByte(0x2118,0x12);p.writeByte(0x2119,0x34);assert.equal(p.vramAddress,0);assert.deepEqual(Array.from(p.vram.subarray(65534)),[0x12,0x34]);
 p.writeByte(0x2121,255);p.writeByte(0x2122,0x56);assert.equal(p.cgramKnown[510],0);
 p.writeByte(0x2122,0xFF);assert.deepEqual(Array.from(p.cgram.subarray(510)),[0x56,0x7F]);assert.equal(p.cgAddress,0);
 p.writeByte(0x2100,15);assert.throws(()=>p.writeByte(0x2118,0),/ppu_observed_write_window_required/);
 p.writeByte(0x2100,128);p.writeByte(0x2115,4);assert.throws(()=>p.writeByte(0x2118,0),/ppu_vram_remap_required/);
});
test('PPU DMA fixed source and zero DAS compute all 65536 bytes from live memory',()=>{
 const p=new PpuState();p.writeByte(0x2100,128);p.writeByte(0x2115,128);p.writeByte(0x2116,0);p.writeByte(0x2117,0);
 let reads=0;const bus=new PpuBus({read8(address){assert.equal(address,0x808000);reads++;return 0x5A;}},p);
 [9,0x18,0,0x80,0x80,0,0].forEach((value,n)=>bus.write(0x123456,0x804300+n,value,1));bus.write(0x123456,0x80420B,1,1);
 assert.equal(reads,65536);assert.equal(bus.dmaBytes,65536);assert.ok(p.vram.every(v=>v===0x5A));assert.ok(p.vramKnown.every(v=>v===1));assert.equal(p.vramAddress,0x8000);
 assert.deepEqual(Array.from(bus.dma.subarray(2,7)),[0,0x80,0x80,0,0]);
});
function fixture(){const p=new PpuState();for(const name of ['vramKnown','cgramKnown','oamKnown'])p[name].fill(1);
 for(const [port,value]of [[0x2100,15],[0x2105,1],[0x2106,0],[0x2107,0],[0x2108,4],[0x210B,0x21],[0x212C,1],[0x212E,0],[0x2130,0x30],[0x2131,0],[0x2133,0]])p.writeByte(port,value);
 for(let port=0x210D;port<=0x2110;port++){p.writeByte(port,0);p.writeByte(port,0);}return p;}
const pixel=(frame,x,y)=>Array.from(frame.subarray((y*256+x)*4,(y*256+x)*4+4));
test('mode 1 bitplanes use the manual BG row origin, tile flips and BG priority',()=>{
 const p=fixture();p.vram[0x2002]=0x80;p.cgram[2]=31;
 let frame=renderMode1Frame(p);assert.deepEqual(pixel(frame,0,0),[255,0,0,255]);assert.deepEqual(pixel(frame,1,0),[0,0,0,255]);
 p.vram[1]=0xC0;frame=renderMode1Frame(p);assert.deepEqual(pixel(frame,7,5),[255,0,0,255]);assert.deepEqual(pixel(frame,0,0),[0,0,0,255]);
 p.vram[1]=0;p.vram[0x4002]=0x80;p.vram[0x801]=0x24;p.cgram[35]=0x7C;p.writeByte(0x212C,3);
 assert.deepEqual(pixel(renderMode1Frame(p),0,0),[0,0,255,255]);
 p.vram[0x801]=4;assert.deepEqual(pixel(renderMode1Frame(p),0,0),[255,0,0,255]);
});
