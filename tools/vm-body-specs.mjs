// Die bewiesenen Body-Specs (src/task/script-body-*-specs.mjs) über den
// allgemeinen Pfad: dieselben Fixtures laufen im VM-Kern (Interpreter, alle
// gebundenen Natives, Spezialnatives mit den Fixture-Beobachtungen) und werden
// mit dem Body-Plan (prepareTaskScriptBody) verglichen: alle Register, Flags,
// alle 131072 WRAM-Bytes und die Geräteschreibzugriffe.
import {NATIVE_POINTERS} from '../src/vm/layout.mjs';
import {LIFTED_SCRIPT_NATIVES, inLiftedScratch} from './lifted-script-natives.mjs';
import {TaskScheduler, STOP_RETURNED, STOP_NATIVE, STOP_FRONTIER} from '../src/vm/scheduler.mjs';
import {WRAM_SIZE} from '../src/vm/memory.mjs';
import {scriptBodySpecs} from '../proof/task/script-body-specs.mjs';
import {prepareTaskScriptBody} from '../proof/task/script-bodies.mjs';
import {renderAddress} from '../src/render/data.mjs';
import {scriptBodyFixture, bodyCases} from './task-script-body-fixtures.mjs';
import {rom} from './vm-differential.mjs';
import {runObserved} from './vm-special-natives-differential.mjs';

const romOffset = address => (((address >>> 16) & 0x1F) << 15) | (address & 0x7FFF);

// Fixture -> Startzustand der VM. Nicht belegte WRAM-Bytes sind 0 (das Orakel
// würde sie gar nicht lesen). Manche Fixtures setzen synthetische ROM-Bytes;
// die VM erhält dann dieselbe ROM wie das Orakel.
function startState(fixture, label) {
  const wram = new Uint8Array(WRAM_SIZE);
  let image = null;
  for (const [address, value] of fixture.data.snapshot().bytes) {
    if (address >= 0x7E0000 && address <= 0x7FFFFF) wram[address - 0x7E0000] = value;
    else if (address >= 0x800000 && rom[romOffset(address)] !== value) (image ??= new Uint8Array(rom))[romOffset(address)] = value;
  }
  return {label, wram, context: fixture.context, rom: image ?? undefined};
}

// Beobachtungen der Fixture in ihrer Reihenfolge; jede muss zur Anforderung passen.
function fixtureFeed(fixture) {
  const cursor = {io: 0, wait: 0, input: 0};
  const next = (kind, list, pc, address, width) => {
    const o = list?.[cursor[kind]];
    // A system register matches in any bank: lifted natives read in bank 00, the
    // recording has the data bank 80 of the original.
    const same = o && (o.address === address || (kind === 'io' && (o.address & 0xFFFF) === (address & 0xFFFF) && (address >>> 16) % 0x80 < 0x40));
    if (!same || o.pc !== pc || o.width !== width) return undefined;
    cursor[kind]++; return o.value;
  };
  return {
    io: fault => next('io', fixture.ioObservations, fault.details.pc, fault.address, fault.details.width),
    wait: d => next('wait', fixture.waitObservations, d.pc, d.address, 2),
    input: d => next('input', fixture.inputObservations, d.pc, d.address, 2),
  };
}

export function compareBody(spec, variant) {
  const label = `Body ${spec.id.toString(16)} ${variant.name ?? ''}`.trim();
  const fixture = scriptBodyFixture(spec, variant), plan = prepareTaskScriptBody(fixture);
  if (!plan.handled) return {result: 'oracle-refused:' + plan.reason};
  // Die Fixtures beobachten auch die Recheneinheit (teils mit synthetischen Werten).
  const start = {...startState(fixture, label), pc: fixture.entry & 0xFFFF, observeArithmetic: true};
  // Über den Scheduler bis zum Nachlauf $C20B (dort enden die Body-Pläne) oder zum Handlerbudget.
  const liftedNatives = new Set();
  const drive = vm => {
    // Whether a lifted native ran (tools/lifted-script-natives.mjs): its carry and
    // overflow stay unproduced until an opcode sets them.
    const call = vm.natives.call.bind(vm.natives);
    vm.natives.call = () => {
      const target = 0x800000 | vm.mem.read16(NATIVE_POINTERS + vm.x);
      if (LIFTED_SCRIPT_NATIVES.has(target)) liftedNatives.add(target);
      return call();
    };
    const scheduler = new TaskScheduler(vm);
    scheduler.stopAt = 0xC20B;
    if (fixture.entry === 0x80F390) { scheduler.returnS = -1; return scheduler.resume(fixture.maxHandlers); }
    return scheduler.call(fixture.entry & 0xFFFF, fixture.maxHandlers);
  };
  const run = runObserved(start, fixtureFeed(fixture), drive);
  if (run.fault) throw Error(`VM-Fehler ${run.fault.reason} ${run.fault.message}; ${label}`);
  const {vm, memory} = run;
  if (run.exit === STOP_NATIVE) return {result: 'vm-native-unbound:' + (0x800000 | memory.read16(NATIVE_POINTERS + vm.x)).toString(16)};
  if (run.exit === STOP_RETURNED || run.exit === STOP_FRONTIER) throw Error(`Scheduler endet vor $C20B (${run.exit}, pc ${vm.pc.toString(16)}); ${label}`);
  const expected = start.wram.slice();
  for (const access of plan.accesses) if (access.kind === 'write') {
    const physical = renderAddress(access.address);
    if (physical >= 0x7E0000 && physical <= 0x7FFFFF) expected[physical - 0x7E0000] = access.value;
  }
  const flags = liftedNatives.size ? ~0x41 : ~0,
    out = {...plan.outputContext, status: plan.outputContext.status & flags},
    got = {...vm.context(), status: vm.context().status & flags};
  for (const key of ['a', 'x', 'y', 's', 'd', 'bank', 'status', 'pc'])
    if (out[key] !== got[key]) throw Error(`Register ${key}: Orakel ${out[key]?.toString(16)}, VM ${got[key]?.toString(16)}; ${label}`);
  // Natives run below the scheduler's S (7E:01F2); lifted ones leave their pushes there
  // unwritten (tools/lifted-script-natives.mjs), free stack bytes nobody reads.
  const outer = memory.wram[0x1F2] | (memory.wram[0x1F3] << 8),
    // Lifted natives leave their direct page scratch (tools/lifted-script-natives.mjs).
    freeStack = n => (n <= outer && n > outer - 0x40) || [...liftedNatives].some(t => inLiftedScratch(t, n));
  for (let n = 0; n < expected.length; n++)
    if (expected[n] !== memory.wram[n] && !freeStack(n)) throw Error(`WRAM ${(0x7E0000 + n).toString(16)}: Orakel ${expected[n]}, VM ${memory.wram[n]}; ${label}`);
  // Lifted natives reach the system registers in bank 00, the recording in the data bank 80.
  const nativeBank = address => (address >>> 16) % 0x80 < 0x40 && (address & 0xFFFF) < 0x8000 ? 0x800000 | (address & 0xFFFF) : address;
  const reads = run.trace.filter(t => t.kind === 'read').map(({kind, ...o}) => ({...o, address: nativeBank(o.address)}));
  if (JSON.stringify(reads) !== JSON.stringify((fixture.ioObservations ?? []).map(o => ({...o}))))
    throw Error(`Hardware-Lesewerte weichen von den Fixture-Beobachtungen ab; ${label}`);
  const writes = run.trace.filter(t => t.kind === 'write').map(({kind, ...o}) => ({...o, address: nativeBank(o.address)}));
  const oracleWrites = (plan.ioRequests ?? []).filter(r => r.kind === 'write').map(({kind, ...o}) => ({...o, address: nativeBank(o.address)}));
  if (JSON.stringify(writes) !== JSON.stringify(oracleWrites)) throw Error(`Geräteschreibzugriffe weichen ab; ${label}`);
  return {result: plan.bodyComplete ? 'equal' : 'equal-suspended', natives: vm.natives.calls, sets: run.sets.length};
}

export function* bodyCasesAll(filter = () => true) {
  for (const spec of scriptBodySpecs) if (filter(spec)) for (const variant of bodyCases(spec)) yield [spec, variant];
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const started = Date.now(), tally = {};
  for (const [spec, variant] of bodyCasesAll()) {
    let r;
    try { r = compareBody(spec, variant).result; } catch (error) { r = 'MISMATCH'; console.log(error.message); }
    tally[r] = (tally[r] ?? 0) + 1;
  }
  console.log(JSON.stringify(tally), `${((Date.now() - started) / 1000).toFixed(1)} s`);
}
