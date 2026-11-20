import { readFileSync } from 'node:fs';
import { inspectRom } from './rom.mjs';
import { decodeTaskWindows } from './task-partial-source.mjs';
import { runReference } from './w65c816-reference.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { isIoAddress, isArithmeticRegister } from '../src/vm/devices.mjs';
import { dialogAccess } from '../src/system/native-dialog-support.mjs';

// Test tool: the dialog routines ($936C) against the original instructions (w65c816-reference.mjs).
// Both sides start with the same WRAM, the same registers and the same return frame; external
// routines with their own proof run on both sides as the same modules with real frames.
const file = readFileSync(new URL('../Shadowrun (E).smc', import.meta.url));
export const romBytes = inspectRom(file).bytes,
  rom = new Uint8Array(romBytes);
const romOffset = (address) => (((address >>> 16) & 0x1f) << 15) | (address & 0x7fff);
// A window of the ROM (start, end exclusive); the source itself pins the bytes separately.
export const window = (start, end, extra = {}) => ({
  start,
  hex: Buffer.from(rom.subarray(romOffset(start), romOffset(start) + end - start))
    .toString('hex')
    .toUpperCase(),
  ...extra,
});
export const decodeWindows = (windows) => decodeTaskWindows(romBytes, windows).map;

// Memory without a device model: hardware writes (except the arithmetic unit) have no effect.
export class DialogTestMemory extends VmMemory {
  constructor(wram, sram = null, sourceRom = rom) {
    super(sourceRom, wram, sram);
  }
  write8(address, value) {
    if (isIoAddress(address) && !isArithmeticRegister(address, true)) return;
    super.write8(address, value);
  }
}
export function prng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const expand = (trace) =>
  trace.flatMap((e) =>
    e.width === 2
      ? [
          { kind: e.kind, pc: e.pc, address: e.address, value: e.value & 255 },
          { kind: e.kind, pc: e.pc, address: e.address + 1, value: e.value >>> 8 },
        ]
      : [{ kind: e.kind, pc: e.pc, address: e.address, value: e.value }],
  );
const STACK = 0x1ef0,
  FREE_STACK_FLOOR = 0x1e80;
function side(s, root) {
  const mem = new DialogTestMemory(s.wram.slice(), s.sram ? s.sram.slice() : null, s.rom ?? rom);
  const vm = {
    mem,
    a: s.a,
    x: s.x,
    y: s.y,
    s: STACK,
    d: 0,
    dbr: s.dbr,
    p: s.p,
    pc: s.entry & 0xffff,
  };
  // The caller's return frame (bank 80, return word 1234).
  if (root === 'RTL') {
    mem.write8(vm.s, 0x80);
    vm.s--;
  }
  mem.write8(vm.s, 0x12);
  vm.s--;
  mem.write8(vm.s, 0x34);
  vm.s--;
  const acc = new TaskAccessor(vm);
  acc.load();
  acc.ctx.programBank = s.entry >>> 16;
  acc.trace = [];
  acc.devices = { write() {} };
  if (s.io) {
    acc.io = s.io;
    let deviceByte = 0;
    const read = mem.read8.bind(mem);
    mem.read8 = (address) => {
      if (!isIoAddress(address) || isArithmeticRegister(address, false)) return read(address);
      const o = s.io[acc.ioIndex];
      if (!o || o.address + deviceByte !== address || ![1, 2].includes(o.width))
        throw Error('Reference device observation required');
      const value = (o.value >>> (8 * deviceByte)) & 255;
      if (++deviceByte === o.width) {
        acc.ioIndex++;
        deviceByte = 0;
      }
      return value;
    };
  }
  return { mem, acc };
}
// Compares native(h, events) with the original instructions. scenario: {entry, wram, sram?, a, x, y, dbr, p, waits, io?}.
// io: ordered byte or word device values; the reference reads their bytes one by one, both traces pin the PC.
// calls(acc, events) -> map target -> run() for externally proved routines on the reference side.
// Wait loops the reference runs itself: before each instruction at a loop PC it stores the next
// byte or word observation of that PC at its address (as the module does before its read).
export function waitHooks(s, pcs) {
  const queues = new Map(pcs.map((pc) => [pc, (s.waits ?? []).filter((o) => o.pc === pc)]));
  return new Map(
    pcs.map((pc) => [
      pc,
      (mem) => {
        const queue = queues.get(pc),
          o = queue.shift();
        if (!o) return;
        if (o.width === 1) mem.write8(o.address, o.value);
        else mem.write16(o.address, o.value);
        // Exit: words the NMI wrote meanwhile (another address, the same PC) are stored at once.
        while (queue.length && queue[0].address !== o.address) {
          const extra = queue.shift();
          mem.write16(extra.address, extra.value);
        }
      },
    ]),
  );
}
// feed(details) supplies a missing observation (a wait at details.pc/address); the native then runs
// again from the same initial state. The reference receives the finished list: loop PCs (waits)
// through hooks, all other observations (counter B0A1) through the modules in calls.
// registers: the registers compared after the run. A lifted native that works on game state only
// (user decision 2026-11-17) is compared without A, X, Y and the flags (GAME_STATE_REGISTERS).
// freeStack: also leave out the free stack bytes from FREE_STACK_FLOOR up to the final stack
// pointer, where the original saves registers lifted callers do not hold.
export const CPU_REGISTERS = Object.freeze([
  'a',
  'x',
  'y',
  's',
  'status',
  'pc',
  'programBank',
  'bank',
]);
export const GAME_STATE_REGISTERS = Object.freeze(['s', 'pc', 'programBank', 'bank']);
export function compareDialog(
  map,
  s,
  {
    native,
    root = 'RTS',
    calls = () => new Map(),
    waits = [],
    feed = null,
    referenceLimit = 1_000_000,
    registers = CPU_REGISTERS,
    freeStack = false,
    // Half-open WRAM ranges of direct page locals the lifted side no longer writes.
    scratch = [],
  },
) {
  s.waits ??= [];
  const freeze = (list) => Object.freeze(list.map((o) => Object.freeze({ ...o })));
  const events = (values) => ({
    mode: 'record-observations',
    values: freeze(values),
    waitIndex: 0,
    calls: [],
    waitEvents: [],
    inputMode: 'record-observations',
    inputs: freeze(s.inputs ?? []),
    inputIndex: 0,
  });
  let n, nativeEvents;
  for (let attempt = 0; ; attempt++) {
    n = side(s, root);
    nativeEvents = events(s.waits);
    try {
      native(dialogAccess(n.acc), nativeEvents, s);
      break;
    } catch (error) {
      // Modules with their own counter (B0A1, F963) report the index within their part from events.waitIndex.
      const missing =
        error?.reason === 'task_wait_observation_required' &&
        (error.observationIndex === s.waits.length ||
          nativeEvents.waitIndex + error.observationIndex === s.waits.length);
      if (feed === null || attempt > 4000 || !missing) throw error;
      s.waits.push({
        pc: error.pc,
        address: error.address,
        width: error.width ?? 2,
        value: feed(error),
      });
    }
  }
  const r = side(s, root),
    refEvents = events(s.waits.filter((o) => !waits.includes(o.pc)));
  const run = runReference(map, r.mem, r.acc.ctx, {
    entry: s.entry,
    root,
    limit: referenceLimit,
    io: r.acc.trace,
    calls: calls(r.acc, refEvents, s),
    before: waitHooks(s, waits),
  });
  const differences = [];
  for (const key of registers)
    if (n.acc.ctx[key] !== r.acc.ctx[key])
      differences.push(
        `${key} native ${n.acc.ctx[key].toString(16)} original ${r.acc.ctx[key].toString(16)}`,
      );
  const free = (i) =>
    (freeStack && i >= FREE_STACK_FLOOR && i <= r.acc.ctx.s) ||
    scratch.some(([from, to]) => i >= from && i < to);
  for (let i = 0; i < n.mem.wram.length; i++)
    if (n.mem.wram[i] !== r.mem.wram[i] && !free(i)) {
      differences.push(
        `wram ${(0x7e0000 + i).toString(16)} native ${n.mem.wram[i].toString(16)} original ${r.mem.wram[i].toString(16)}`,
      );
      break;
    }
  // Optional SRAM (scenario field sram): compared like WRAM.
  if (s.sram)
    for (let i = 0; i < s.sram.length; i++)
      if (n.mem.sram[i] !== r.mem.sram[i]) {
        differences.push(
          `sram ${i.toString(16)} native ${n.mem.sram[i].toString(16)} original ${r.mem.sram[i].toString(16)}`,
        );
        break;
      }
  const io = [expand(n.acc.trace), expand(r.acc.trace)].map((t) => JSON.stringify(t));
  if (io[0] !== io[1]) {
    // Show the traces from their first difference on.
    let at = 0;
    while (at < io[0].length && io[0][at] === io[1][at]) at++;
    differences.push(
      'io ' +
        io[0].slice(Math.max(0, at - 120), at + 200) +
        ' / ' +
        io[1].slice(Math.max(0, at - 120), at + 200),
    );
  }
  const loops = s.waits.filter((o) => waits.includes(o.pc)).length;
  if (nativeEvents.waitIndex !== refEvents.waitIndex + loops)
    differences.push(
      `waits native ${nativeEvents.waitIndex} original ${refEvents.waitIndex} + ${loops}`,
    );
  if (s.io && (n.acc.ioIndex !== s.io.length || r.acc.ioIndex !== s.io.length))
    differences.push(
      `device observations native ${n.acc.ioIndex} original ${r.acc.ioIndex} expected ${s.io.length}`,
    );
  return { differences, visited: run.visited, events: nativeEvents };
}
