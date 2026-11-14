// Probe for the ROM-free package (docs/ROM-FREE.md, "VRAM characters"), tool only:
//   node --import ./tools/rom-vram-hook.mjs --test --test-concurrency=1 tools/live-*.test.mjs
//   node tools/rom-vram.mjs
// Records every general DMA from ROM to VRAM (2118/2119) with source, length,
// VMAIN and VRAM address, and owns each written VRAM byte by its transfer.
// At every NMI entry (end of the visible picture, LagFreeFrames.enterNmi) each
// PPU written since the last NMI with the display on in mode 1 marks how the
// visible screen uses owned bytes, with the same addressing as
// src/video/ppu-frame.mjs: BG1/BG2 4 bpp, BG3 2 bpp, OBJ 4 bpp, BG tilemaps.
// Packed streams: every call of the unpacker 9F49/9F4D/9F6D (wrapped by
// tools/rom-unpack-loader.mjs) is recorded with source, destination and
// length (the word at the source). Its output bytes in WRAM are owned by the
// stream until written otherwise; a DMA from WRAM passes the ownership on to
// VRAM (and is counted per target for CGRAM and OAM), but only for bytes that
// still equal the stream's output.
// Each process merges its records into .cache/rom-vram/<pid>.json.
import {writeFileSync, mkdirSync} from 'node:fs';
import {register} from 'node:module';

register(new URL('./rom-unpack-loader.mjs', import.meta.url));
const {PpuBus, PpuState} = await import('../src/video/ppu-state.mjs');
const {LagFreeFrames} = await import('../src/vm/frame-events.mjs');
const {VmMemory} = await import('../src/vm/memory.mjs');

const transfers = new Map(), list = [];
const entry = (key, fields) => {
  let t = transfers.get(key);
  if (!t) { t = {key, ...fields, count: 0, uses: {}, id: list.length}; transfers.set(key, t); list.push(t); }
  t.count++;
  return t;
};

// Unpacked streams and WRAM ownership (128 KiB).
const wramId = new Int32Array(0x20000).fill(-1), wramIndex = new Int32Array(0x20000);
let unpacking = null;
globalThis.__unpackBegin = (at, source, destination) => {
  unpacking = {t: entry(['lz', at, source, destination].join(','), {type: 'lz'}), source, destination: destination - 0x7E0000, length: null, memory: null};
};
globalThis.__unpackEnd = () => {
  const u = unpacking;
  unpacking = null;
  if (u?.memory) u.t.data = u.memory.wram.slice(u.destination, u.destination + u.length);
};
const write8 = VmMemory.prototype.write8;
VmMemory.prototype.write8 = function (address, value) {
  const bank = address >>> 16, offset = address & 0xFFFF;
  const w = bank === 0x7E || bank === 0x7F ? address - 0x7E0000 : !(bank & 0x40) && offset < 0x2000 ? offset : -1;
  if (w >= 0) {
    const u = unpacking;
    if (u && !u.memory) { u.memory = this; u.length = this.read16(u.source); }
    if (u && w >= u.destination && w < u.destination + u.length) { wramId[w] = u.t.id; wramIndex[w] = w - u.destination; }
    else wramId[w] = -1;
  }
  return write8.call(this, address, value);
};
const wramOwner = (memory, w) => {
  const id = wramId[w], t = list[id];
  return id >= 0 && t.data && t.data[wramIndex[w]] === memory.wram[w] ? id : -1;
};
let current = null;
const OWNERS = Symbol('owners');
const owners = ppu => ppu[OWNERS] ??= {id: new Int32Array(65536).fill(-1), index: new Int32Array(65536)};

const transfer = PpuBus.prototype.transfer;
PpuBus.prototype.transfer = function (mask) {
  for (let channel = 0; channel < 8; channel++) if (mask & (1 << channel)) {
    const at = channel * 16, mode = this.dma[at], target = 0x2100 + this.dma[at + 1], bank = this.dma[at + 4];
    const source = this.dma[at + 2] | this.dma[at + 3] << 8, length = (this.dma[at + 5] | this.dma[at + 6] << 8) || 65536;
    const rom = !(bank & 0x40) && source >= 0x8000 && (bank & 0x7F) < 0x20;
    const wram = bank === 0x7E || bank === 0x7F ? (bank - 0x7E) << 16 | source : !(bank & 0x40) && source < 0x2000 ? source : -1;
    const known = this.dmaKnown[at] && this.dmaKnown[at + 6], step = mode & 8 ? 0 : 1, vram = target === 0x2118 || target === 0x2119;
    if (rom && vram && known) {
      const key = [bank << 16 | source, length, mode, target, this.ppu.registers[0x15], this.ppu.vramAddress].join(',');
      current = {t: entry(key, {type: 'dma'}).id, n: 0, step};
    } else if (wram >= 0 && known) {
      if (vram) current = {wram, memory: this.memory, n: 0, step};
      else for (let n = 0; n < length; n++) {
        const id = wramOwner(this.memory, (wram + n * step) & 0x1FFFF);
        if (id >= 0) { const k = target === 0x2122 ? 'cgram' : target === 0x2104 ? 'oam' : `port${target.toString(16)}`; list[id].uses[k] = (list[id].uses[k] ?? 0) + 1; }
      }
    }
    try { transfer.call(this, 1 << channel); } finally { current = null; }
  }
};

const writeByte = PpuState.prototype.writeByte;
const dirty = new Set();
PpuState.prototype.writeByte = function (port, value) {
  dirty.add(this);
  if ((port === 0x2118 || port === 0x2119) && this.vramAddressKnown === 3) {
    const o = owners(this), address = ((this.vramAddress & 0x7FFF) << 1) | (port & 1);
    if (current?.memory) {
      const w = (current.wram + current.n) & 0x1FFFF, id = wramOwner(current.memory, w);
      o.id[address] = id; o.index[address] = id >= 0 ? wramIndex[w] : 0;
    } else { o.id[address] = current ? current.t : -1; o.index[address] = current ? current.n : 0; }
    if (current) current.n += current.step;
  }
  return writeByte.call(this, port, value);
};

const use = (ppu, start, bytes, kind) => {
  const o = ppu[OWNERS];
  if (!o) return;
  const first = o.id[start & 65535];
  for (let n = 0; n < bytes; n++) {
    const id = o.id[(start + n) & 65535];
    if (id < 0) continue;
    const u = list[id].uses, k = `${kind}${id === first ? `@${o.index[start & 65535] % bytes}` : ''}`;
    u[k] = (u[k] ?? 0) + 1;
  }
};

const enterNmi = LagFreeFrames.prototype.enterNmi;
LagFreeFrames.prototype.enterNmi = function () {
  for (const ppu of dirty) mark.call(ppu);
  dirty.clear();
  return enterNmi.call(this);
};
function mark() {
  const r = port => this.registers[port - 0x2100];
  if (!this.registerKnown[0] || r(0x2100) & 0x80 || !(r(0x2100) & 15) || (r(0x2105) & 7) !== 1 || r(0x2105) & 0xF0) return;
  const shown = r(0x212C) | r(0x212D), seen = new Set();
  for (let layer = 0; layer < 3; layer++) if (shown & (1 << layer)) {
    const sc = r(0x2107 + layer), nba = r(0x210B + (layer >>> 1)), bpp = layer === 2 ? 2 : 4;
    const base = (sc & 0xFC) << 9, chars = ((nba >>> ((layer & 1) * 4)) & 15) * 8192;
    const width = sc & 1 ? 512 : 256, height = sc & 2 ? 512 : 256, h = this.scroll[layer * 2], v = this.scroll[layer * 2 + 1];
    for (let y = 0; y < 224; y += 8) for (let x = 0; x < 264; x += 8) {
      const sx = (Math.min(x, 255) + h) & (width - 1), sy = (y + 1 + v) & (height - 1), tx = sx >>> 3, ty = sy >>> 3;
      const map = base + ((tx >>> 5) + (ty >>> 5) * (width === 512 ? 2 : 1)) * 2048 + (ty & 31) * 64 + (tx & 31) * 2;
      if (seen.has(map)) continue;
      seen.add(map);
      use(this, map, 2, 'map');
      const tile = this.vram[map & 65535] | this.vram[(map + 1) & 65535] << 8;
      use(this, chars + (tile & 1023) * bpp * 8, bpp * 8, `bg${bpp}`);
    }
  }
  if (shown & 16) {
    const sizes = [[8, 16], [8, 32], [8, 64], [16, 32], [16, 64], [32, 64]], select = r(0x2101);
    const base = (select & 7) * 16384, gap = (((select >>> 3) & 3) + 1) * 8192, pair = sizes[select >>> 5];
    if (pair) for (let n = 0; n < 128; n++) {
      const high = this.oam[512 + (n >>> 2)] >>> ((n & 3) * 2), size = pair[(high >>> 1) & 1];
      const x = this.oam[n * 4] - (high & 1 ? 256 : 0), y = this.oam[n * 4 + 1], name = this.oam[n * 4 + 2], attr = this.oam[n * 4 + 3];
      if (x <= -size || x >= 256 || (y >= 224 && y + size <= 256)) continue;
      for (let row = 0; row < size / 8; row++) for (let col = 0; col < size / 8; col++) {
        const tile = ((name & 0xF0) + row * 16 + ((name + col) & 15)) & 255;
        use(this, base + (attr & 1 ? gap : 0) + tile * 32, 32, 'obj4');
      }
    }
  }
}

process.on('exit', () => {
  if (!list.length) return;
  const dir = new URL('../.cache/rom-vram/', import.meta.url);
  mkdirSync(dir, {recursive: true});
  writeFileSync(new URL(`${process.pid}.json`, dir), JSON.stringify(list.map(({data, id, ...t}) => t)));
});
