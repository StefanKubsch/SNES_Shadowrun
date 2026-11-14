import {readFileSync} from 'node:fs';
import {inspectRom} from './rom.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {runReference} from './w65c816-reference.mjs';
import {VmMemory} from '../src/vm/memory.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {isIoAddress, isArithmeticRegister} from '../src/vm/devices.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';

// Testwerkzeug: Gleichungen der Dialogroutinen ($936C) gegen die Originalbefehle (w65c816-reference.mjs).
// Beide Seiten starten mit demselben WRAM, denselben Registern und demselben Rücksprungrahmen; externe
// Routinen mit eigenem Beweis laufen auf beiden Seiten als dieselben Module mit echten Rahmen.
const file = readFileSync(new URL('../Shadowrun (E).smc', import.meta.url));
export const romBytes = inspectRom(file).bytes, rom = new Uint8Array(romBytes);
const romOffset = address => ((address >>> 16) & 0x1F) << 15 | (address & 0x7FFF);
// Fenster aus der ROM (Start, Ende exklusiv); die Quelle selbst pinnt die Bytes getrennt.
export const window = (start, end, extra = {}) => ({start, hex: Buffer.from(rom.subarray(romOffset(start), romOffset(start) + end - start)).toString('hex').toUpperCase(), ...extra});
export const decodeWindows = windows => decodeTaskWindows(romBytes, windows).map;

// Speicher ohne Gerätemodell: Hardwareschreibzugriffe (außer Recheneinheit) wirken nicht.
export class DialogTestMemory extends VmMemory {
  constructor(wram, sram = null, sourceRom = rom) { super(sourceRom, wram, sram); }
  write8(address, value) { if (isIoAddress(address) && !isArithmeticRegister(address, true)) return; super.write8(address, value); }
}
export function prng(seed) {
  let t = seed >>> 0;
  return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
const expand = trace => trace.flatMap(e => e.width === 2
  ? [{kind: e.kind, pc: e.pc, address: e.address, value: e.value & 255}, {kind: e.kind, pc: e.pc, address: e.address + 1, value: e.value >>> 8}]
  : [{kind: e.kind, pc: e.pc, address: e.address, value: e.value}]);
const STACK = 0x1EF0;
function side(s, root) {
  const mem = new DialogTestMemory(s.wram.slice(), s.sram ? s.sram.slice() : null, s.rom??rom);
  const vm = {mem, a: s.a, x: s.x, y: s.y, s: STACK, d: 0, dbr: s.dbr, p: s.p, pc: s.entry & 0xFFFF};
  // Rücksprungrahmen des Aufrufers (Bank 80, Rücksprungwort 1234).
  if (root === 'RTL') { mem.write8(vm.s, 0x80); vm.s--; }
  mem.write8(vm.s, 0x12); vm.s--; mem.write8(vm.s, 0x34); vm.s--;
  const acc = new TaskAccessor(vm); acc.load(); acc.ctx.programBank = s.entry >>> 16; acc.trace = []; acc.devices = {write() {}};
  if(s.io){acc.io=s.io;let deviceByte=0;const read=mem.read8.bind(mem);
    mem.read8=address=>{if(!isIoAddress(address)||isArithmeticRegister(address,false))return read(address);
      const o=s.io[acc.ioIndex];if(!o||o.address+deviceByte!==address||![1,2].includes(o.width))throw Error('Reference device observation required');
      const value=o.value>>>(8*deviceByte)&255;if(++deviceByte===o.width){acc.ioIndex++;deviceByte=0;}return value;};}
  return {mem, acc};
}
// Vergleicht native(h, events) mit den Originalbefehlen. scenario: {entry, wram, sram?, a, x, y, dbr, p, waits, io?}.
// io: geordnete BYTE-/WORD-Gerätewerte; die Referenz liest ihre Bytes einzeln, beide Traces pinnen die PC.
// calls(acc, events) -> Map Ziel -> run() für extern bewiesene Routinen der Referenzseite.
// Warteschleifen, die die Referenz selbst ausführt: vor jedem Befehl an einer Schleifen-PC legt sie die
// nächste BYTE- oder WORD-Beobachtung dieser PC an der Adresse ab (wie das Modul vor seinem Lesen).
export function waitHooks(s, pcs) {
  const queues = new Map(pcs.map(pc => [pc, (s.waits ?? []).filter(o => o.pc === pc)]));
  return new Map(pcs.map(pc => [pc, mem => {
    const queue = queues.get(pc), o = queue.shift(); if (!o) return;
    if(o.width===1)mem.write8(o.address,o.value);else mem.write16(o.address, o.value);
    // Austritt: vom NMI dabei geschriebene Wörter (andere Adresse, gleiche PC) sofort ablegen.
    while (queue.length && queue[0].address !== o.address) { const extra = queue.shift(); mem.write16(extra.address, extra.value); }
  }]));
}
// feed(details) liefert eine fehlende Beobachtung (Warten an details.pc/address); das Native läuft dann vom
// selben Anfangszustand erneut. Die Referenz erhält die fertige Liste: Schleifen-PCs (waits) über Hooks,
// alle übrigen Beobachtungen (Zähler B0A1) über die Module in calls.
export function compareDialog(map, s, {native, root = 'RTS', calls = () => new Map(), waits = [], feed = null, referenceLimit = 1_000_000}) {
  s.waits ??= [];
  const freeze = list => Object.freeze(list.map(o => Object.freeze({...o})));
  const events = values => ({mode: 'record-observations', values: freeze(values), waitIndex: 0, calls: [], waitEvents: [],
    inputMode: 'record-observations', inputs: freeze(s.inputs ?? []), inputIndex: 0});
  let n, nativeEvents;
  for (let attempt = 0; ; attempt++) {
    n = side(s, root); nativeEvents = events(s.waits);
    try { native(dialogAccess(n.acc), nativeEvents, s); break; }
    catch (error) {
      // Module mit eigenem Zähler (B0A1, F963) melden den Index in ihrem Ausschnitt ab events.waitIndex.
      const missing = error?.reason === 'task_wait_observation_required'
        && (error.observationIndex === s.waits.length || nativeEvents.waitIndex + error.observationIndex === s.waits.length);
      if (feed === null || attempt > 4000 || !missing) throw error;
      s.waits.push({pc: error.pc, address: error.address, width: error.width??2, value: feed(error)});
    }
  }
  const r = side(s, root), refEvents = events(s.waits.filter(o => !waits.includes(o.pc)));
  const run = runReference(map, r.mem, r.acc.ctx, {entry: s.entry, root, limit: referenceLimit, io: r.acc.trace, calls: calls(r.acc, refEvents, s), before: waitHooks(s, waits)});
  const differences = [];
  for (const key of ['a', 'x', 'y', 's', 'status', 'pc', 'programBank', 'bank'])
    if (n.acc.ctx[key] !== r.acc.ctx[key]) differences.push(`${key} native ${n.acc.ctx[key].toString(16)} original ${r.acc.ctx[key].toString(16)}`);
  for (let i = 0; i < n.mem.wram.length; i++)
    if (n.mem.wram[i] !== r.mem.wram[i]) { differences.push(`wram ${(0x7E0000 + i).toString(16)} native ${n.mem.wram[i].toString(16)} original ${r.mem.wram[i].toString(16)}`); break; }
  // Optional SRAM (scenario field sram): compared like WRAM.
  if (s.sram) for (let i = 0; i < s.sram.length; i++)
    if (n.mem.sram[i] !== r.mem.sram[i]) { differences.push(`sram ${i.toString(16)} native ${n.mem.sram[i].toString(16)} original ${r.mem.sram[i].toString(16)}`); break; }
  const io = [expand(n.acc.trace), expand(r.acc.trace)].map(t => JSON.stringify(t));
  if (io[0] !== io[1]) {
    // Show the traces from their first difference on.
    let at = 0; while (at < io[0].length && io[0][at] === io[1][at]) at++;
    differences.push('io ' + io[0].slice(Math.max(0, at - 120), at + 200) + ' / ' + io[1].slice(Math.max(0, at - 120), at + 200));
  }
  const loops = s.waits.filter(o => waits.includes(o.pc)).length;
  if (nativeEvents.waitIndex !== refEvents.waitIndex + loops) differences.push(`waits native ${nativeEvents.waitIndex} original ${refEvents.waitIndex} + ${loops}`);
  if(s.io&&(n.acc.ioIndex!==s.io.length||r.acc.ioIndex!==s.io.length))differences.push(`device observations native ${n.acc.ioIndex} original ${r.acc.ioIndex} expected ${s.io.length}`);
  return {differences, visited: run.visited, events: nativeEvents};
}
