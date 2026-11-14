// Aufzeichnung gelesener ROM-Bytes für die ROM-Karte (docs/ROM-FREE.md), nur Werkzeug:
//   node --import ./tools/rom-reads-hook.mjs --test --test-concurrency=1 tools/live-*.test.mjs
// Jeder Prozess vereinigt beim Ende seine Lesungen mit .cache/rom-reads.bin
// (1 MiB, ein Byte je ROM-Byte, 1 = gelesen), das tools/rom-map.mjs mit --reads auswertet.
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {VmMemory} from '../src/vm/memory.mjs';

const FILE = new URL('../.cache/rom-reads.bin', import.meta.url);
const seen = new Uint8Array(0x100000);
let any = false;
const read8 = VmMemory.prototype.read8;
VmMemory.prototype.read8 = function (address) {
  const bank = address >>> 16, offset = address & 0xFFFF;
  if (!(bank & 0x40) && offset >= 0x8000 && (bank & 0x7F) < 0x20) { seen[((bank & 0x1F) << 15) | (offset & 0x7FFF)] = 1; any = true; }
  return read8.call(this, address);
};
process.on('exit', () => {
  if (!any) return;
  mkdirSync(new URL('../.cache/', import.meta.url), {recursive: true});
  const merged = existsSync(FILE) ? new Uint8Array(readFileSync(FILE)) : new Uint8Array(0x100000);
  for (let i = 0; i < seen.length; i++) merged[i] |= seen[i];
  writeFileSync(FILE, merged);
});
