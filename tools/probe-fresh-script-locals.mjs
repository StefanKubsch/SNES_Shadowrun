// Probe for docs/SCRIPT-VM-LIFT.md: does any script read a local before writing it?
// Task frames come from the heap uncleared, so such a read would see the residue of
// earlier frames. The probe runs the live game on the route of tools/live-benchmark.mjs
// (title, menu, opening dialog, walking), marks the locals and stack of each new frame
// (a write of a task frame word) as fresh, clears the mark on each write, and counts the
// local loads (opcodes 02, 0C, 16, C2) that read a fresh byte.
// Usage: node tools/probe-fresh-script-locals.mjs [nmis]
import { cartridge } from './cartridge-harness.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { counterBytes } from '../src/vm/frame-events.mjs';
import { registerLevelLoop } from '../proof/script/register-level-loop.mjs';

const DIRECTIONS = [0x0800, 0x0100, 0x0400, 0x0200];
const route = (k) =>
  k >= 3000 && k < 3400
    ? k % 150 < 4
      ? 0x1000
      : 0
    : k >= 3400 && k < 5200
      ? k % 60 < 4
        ? 0x0080
        : 0
      : k >= 5200
        ? DIRECTIONS[Math.floor(k / 90) % 4]
        : 0;
const nmis = Number(process.argv[2] ?? 12000);
// The register-level loop keeps the frames in the WRAM heap, where residue can be read.
const game = new LiveGame(cartridge, {
  pad: route,
  counter: counterBytes(12345),
  loop: registerLevelLoop,
});
const mem = game.memory,
  vm = game.vm;
const fresh = new Uint8Array(0x2000);
const low = (address) => {
  const bank = (address >>> 16) & 0xff,
    offset = address & 0xffff;
  if (offset >= 0x2000) return -1;
  if (bank === 0x7e || bank < 0x40 || (bank >= 0x80 && bank < 0xc0)) return offset;
  return -1;
};
const reads = new Map();
let frames = 0,
  localReads = 0;
const read8 = mem.read8.bind(mem),
  write8 = mem.write8.bind(mem);
mem.write8 = (address, value) => {
  write8(address, value);
  const at = low(address);
  if (at < 0) return;
  fresh[at] = 0;
  // The high byte of a task frame word: mark the new frame's locals and stack fresh.
  if (at >= 0x252 && at < 0x2b2 && (at - 0x252) % 2 === 1) {
    const d = read8(at - 1) | (read8(at) << 8),
      size = (read8(d - 4) | (read8(d - 3) << 8)) & 0x7fff;
    frames++;
    for (let n = 0x13; n < size && d + n < 0x2000; n++) fresh[d + n] = 1;
  }
};
mem.read8 = (address) => {
  const value = read8(address),
    at = low(address);
  if (
    at >= 0 &&
    vm.pc === 0xf390 &&
    [0x02, 0x0c, 0x16, 0xc2].includes(vm.a & 0xff) &&
    at === ((vm.d + 0x13 + ((vm.a & 0xff) === 0xc2 ? 0 : vm.x)) & 0xffff)
  )
    localReads++;
  if (at >= 0 && fresh[at] && vm.pc === 0xf390) {
    const op = vm.a & 0xff,
      base = (vm.d + 0x13 + (op === 0xc2 ? 0 : vm.x)) & 0xffff;
    const word = op === 0x16;
    if ([0x02, 0x0c, 0x16, 0xc2].includes(op) && (at === base || (word && at === base + 1))) {
      const script = read8(vm.d) | (read8(vm.d + 1) << 8);
      const key = `op ${op.toString(16)} local ${(at - vm.d - 0x13).toString(16)} script@${script.toString(16)} pc ${vm.y.toString(16)}`;
      reads.set(key, (reads.get(key) ?? 0) + 1);
    }
  }
  return value;
};
while (game.nmis < nmis) game.step();
console.log(
  'frames',
  frames,
  'localReads',
  localReads,
  'nmis',
  game.nmis,
  'distinct fresh local reads',
  reads.size,
);
for (const [k, v] of [...reads].slice(0, 40)) console.log(v, k);
