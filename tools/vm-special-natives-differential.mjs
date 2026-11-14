// Differenzvergleich der Spezialnatives (src/vm/special-natives.mjs) gegen ihre
// bewiesenen Opcode-Kompositionen: ein $58 ab $F390 über Brücke, Native und
// Wiederaufnahme bis zum nächsten $F390. Verglichen werden alle Register, Flags
// und alle 131072 WRAM-Bytes, dazu die Geräteschreibzugriffe.
//
// Beobachtungen (Gerätelesungen, Warte- und Eingabewörter) sind Testeingaben:
// Fordert die VM eine an, wird ein Zufallswert angehängt und der Aufruf vom
// gleichen Startzustand wiederholt. Das Orakel erhält denselben Satz und dazu
// die Lesewerte der Recheneinheit, die es selbst nicht berechnet.
import {VmMemory, VmFault} from '../src/vm/memory.mjs';
import {LIFTED_SCRIPT_NATIVES, inLiftedScratch} from './lifted-script-natives.mjs';
import {ScriptInterpreter} from '../src/vm/interpreter.mjs';
import {NativeCalls} from '../src/vm/native-call.mjs';
import {NATIVE_POINTERS} from '../src/vm/layout.mjs';
import {ObservedDevices,observationSet} from '../proof/vm/observed-devices.mjs';
import {SPECIAL_NATIVES} from '../src/vm/special-natives.mjs';
import {nativeOpcodeTargets} from '../src/task/native-opcode-targets.mjs';
import {nativeTarget} from '../src/task/native-targets.mjs';
import {prepareTaskNativeOpcodeFEC1} from '../proof/task/native-c8-opcode.mjs';
import {prepareTaskNativeOpcodeFF79} from '../proof/task/native-clear-opcode.mjs';
import {prepareTaskNativeOpcodeF953} from '../proof/task/native-input-wait-opcode.mjs';
import {prepareTaskNativeOpcode9BA0} from '../proof/task/native13-opcode.mjs';
import {prepareTaskNativeOpcodeC46E} from '../proof/task/native-audio-opcode.mjs';
import {prepareTaskNativeOpcodeC51F, prepareTaskNativeOpcodeC560} from '../proof/task/native-random-opcode.mjs';
import {prepareTaskNativeOpcode8E36} from '../proof/task/native-8e36-opcode.mjs';
import {prepareTaskSelectionOpcode} from '../proof/task/native-selection-root-opcode.mjs';
import {prepareTaskModalOpcode} from '../proof/task/native-modal-opcode.mjs';
import {prepareTaskNativeOpcodeCDA8} from '../proof/task/native-cda8-opcode.mjs';
import {prepareTaskNativeOpcode8AB5} from '../proof/task/native-8ab5-opcode.mjs';
import {prepareTaskNativeOpcode8BC5} from '../proof/task/native-8bc5-opcode.mjs';
import {prepareTaskNativeOpcode8521} from '../proof/task/native-8521-opcode.mjs';
import {prepareTaskNativeOpcode855E} from '../proof/task/native-855e-opcode.mjs';
import {prepareTaskNativeOpcode936C} from '../proof/task/native-936c-opcode.mjs';
import {prepareTaskNativeOpcode9BC6} from '../proof/task/native-9bc6-opcode.mjs';
import {prepareTaskNativeOpcode8A51} from '../proof/task/native-8a51-opcode.mjs';
import {prepareTaskNativeOpcodeCombat, COMBAT_NATIVE_IDS} from '../proof/task/native-combat-opcode.mjs';
import {prepareTaskNativeOpcodeSmall, SMALL_SPECIAL_CALLEES} from '../proof/task/native-small-opcode.mjs';
import {renderAddress} from '../src/render/data.mjs';
import {rom, nativeScenario} from './vm-differential.mjs';
import {oracle, context, PROOF_LIMITS} from './vm-scheduler-differential.mjs';

const romBytes = new Uint8Array(rom.buffer, rom.byteOffset, rom.length);

// Native-ID -> bewiesene Opcode-Komposition (jede prüft ihre ID und Metadaten).
export const SPECIAL_ORACLES = new Map([
  [0xC8, prepareTaskNativeOpcodeFEC1], [0xA7, prepareTaskNativeOpcodeFF79], [0xA3, prepareTaskNativeOpcodeF953],
  [0x13, prepareTaskNativeOpcode9BA0], [0x4C, prepareTaskNativeOpcodeC46E],
  [0x3E, prepareTaskNativeOpcodeC51F], [0x63, prepareTaskNativeOpcodeC560], [0x7C, prepareTaskNativeOpcode8E36],
  [0x9A, prepareTaskSelectionOpcode], [0x1A, prepareTaskSelectionOpcode],
  [0x72, prepareTaskModalOpcode], [0xBF, prepareTaskModalOpcode], [0x74, prepareTaskModalOpcode], [0xD7, prepareTaskModalOpcode],
  [0xC2, prepareTaskNativeOpcodeCDA8], [0x10, prepareTaskNativeOpcode8AB5], [0x07, prepareTaskNativeOpcode8BC5],
  [0xAC, prepareTaskNativeOpcode8521], [0xC0, prepareTaskNativeOpcode855E], [0x95, prepareTaskNativeOpcode936C], [0xD8, prepareTaskNativeOpcode9BC6],
  [0x58, prepareTaskNativeOpcode8A51], [0x5A, prepareTaskNativeOpcode8A51],
  ...COMBAT_NATIVE_IDS.map(id => [id, prepareTaskNativeOpcodeCombat]), ...Object.keys(SMALL_SPECIAL_CALLEES).map(id => [Number(id), prepareTaskNativeOpcodeSmall]),
]);
const targetOf = id => 0x800000 | rom.readUInt16LE(0x157B8 + id * 2);
// Alle Native-IDs, deren Ziel ein Spezialnative ist.
export const specialNativeIds = Array.from({length: 256}, (_, id) => id).filter(id => SPECIAL_NATIVES.has(targetOf(id)));

// Zustand bei $F390 unmittelbar vor dem $58 (Argumente liegen auf dem Stapel).
export function specialScenario(rnd, id, label) {
  const scenario = nativeScenario(rnd, id, label);
  // Halb Nullen, damit Schleifen über Tabellen/Slots auch enden.
  for (let n = 0x2000; n < scenario.wram.length; n++) if (rnd() < 0.5) scenario.wram[n] = 0;
  const vm = new ScriptInterpreter(new VmMemory(romBytes, scenario.wram));
  vm.setContext(scenario.context);
  vm.run(rom[0x15A4C + id]);
  if (vm.x !== 0x58) throw Error(`Szenario ${label}: kein $58 erreicht`);
  return {label, id, wram: scenario.wram, context: vm.context()};
}

// Führt die VM ab einem Startzustand aus: drive(vm) = Zahl der Opcodes (Interpreter
// ab $F390) oder eine Funktion, die die VM antreibt (z. B. TaskScheduler). Beobachtungen
// entstehen bedarfsgesteuert: Fordert ein Spezialnative eine an, liefert feed den
// Wert (oder undefined), er kommt in den Satz des laufenden Aufrufs, und der Lauf
// wiederholt sich vom Startzustand. feed: {io(fault, memory), wait(details), input(details)}.
export function runObserved(start, feed, drive, limit = 4000) {
  const sets = [];
  for (let n = 0; n < limit; n++) {
    const memory = new VmMemory(start.rom ?? romBytes, start.wram.slice()), vm = new ScriptInterpreter(memory);
    vm.setContext(start.context);
    if (start.pc !== undefined) vm.pc = start.pc;
    const devices = new ObservedDevices(sets.map(set => observationSet(set.target, set)));
    vm.natives = new NativeCalls(vm, {admitted: nativeOpcodeTargets, implementation: nativeTarget, devices});
    const trace = vm.natives.accessor.trace = [];
    vm.natives.accessor.observeArithmetic = start.observeArithmetic === true;
    let exit = null, fault = null;
    try { exit = typeof drive === 'number' ? vm.run(drive) : drive(vm); }
    catch (error) { if (!(error instanceof VmFault)) throw error; fault = error; }
    if (fault === null && vm.pc === 0xF4F6) {
      // Spezialnative ohne Satz: neuen leeren Satz für diesen Aufruf anlegen.
      const target = 0x800000 | memory.read16(NATIVE_POINTERS + vm.x);
      if (SPECIAL_NATIVES.has(target) && devices.index === sets.length) { sets.push({target, io: [], wait: [], input: []}); continue; }
    }
    if (fault !== null && devices.index === sets.length && sets.length) {
      const set = sets.at(-1), details = fault.details ?? {};
      let added;
      if (fault.reason === 'device_observation_required') {
        const value = feed.io(fault, memory);
        if (value !== undefined) added = set.io.push({pc: details.pc, address: nativeBank(fault.address), width: details.width, value});
      } else if (fault.reason === 'native_boundary:task_wait_observation_required') {
        const value = feed.wait(details);
        if (value !== undefined) added = set.wait.push({pc: details.pc, address: details.address, width: 2, value});
      } else if (fault.reason === 'native_boundary:task_input_observation_required') {
        const value = feed.input(details);
        if (value !== undefined) added = set.input.push({pc: details.pc, address: details.address, width: 2, value});
      }
      if (added) continue;
    }
    return {vm, memory, exit, fault, trace, sets};
  }
  throw Error(`Beobachtungen ohne Ende (${sets.length} Sätze); ${start.label}`);
}

// Zufallswerte: Warteschleifen enden bei 0, daher 0 mit Wahrscheinlichkeit 1/2.
// APU-Port 0: Das Original wartet auf das Echo des Tokens in $1CE4; halb so oft liefert der Test es.
export const randomFeed = rnd => ({
  io: (fault, memory) => (fault.address & 0xFFFF) === 0x2140 && rnd() < 0.5 ? memory.wram[0x1CE4]
    : (rnd() * (fault.details.width === 1 ? 0x100 : 0x10000)) | 0,
  wait: () => rnd() < 0.5 ? 0 : 1 + ((rnd() * 4) | 0),
  input: () => (rnd() * 0x10000) | 0,
});

// Lifted natives read the system registers in bank 00; the natives' data bank is 80,
// where the register-level compositions and recordings read them.
const nativeBank = address => (address >>> 16) % 0x80 < 0x40 && (address & 0xFFFF) < 0x8000 ? 0x800000 | (address & 0xFFFF) : address;
export function compareSpecial(rnd, state) {
  const {vm, memory, fault, trace, sets} = runObserved(state, randomFeed(rnd), 1);
  const observations = sets[0] ?? {wait: [], input: []};
  const outer = state.wram[0x01F2] | (state.wram[0x01F3] << 8);
  const protectedStackBytes = [0x7FFFFE, 0x7FFFFF, renderAddress((outer + 1) & 0xFFFF), renderAddress((outer + 2) & 0xFFFF)];
  const frozen = list => Object.freeze(list.map(o => Object.freeze({...o})));
  const plan = oracle(SPECIAL_ORACLES.get(state.id), state.wram, {
    entry: 0x80F390, context: context(0xF390, state.context), protectedStackBytes, nativeId: state.id,
    ioMode: 'record-requests', ioObservations: frozen(trace.filter(t => t.kind === 'read').map(({kind, ...o}) => ({...o, address: nativeBank(o.address)}))),
    waitMode: 'record-observations', waitObservations: frozen(observations.wait),
    inputMode: 'record-observations', inputObservations: frozen(observations.input)});
  if (fault) {
    // Lifted natives stop at unmapped addresses past the WRAM mirror of their data bank.
    if (plan.handled && LIFTED_SCRIPT_NATIVES.has(targetOf(state.id)) && /unmapped_read|unmapped_write/.test(fault.reason)) return {result: 'skipped:lifted-domain'};
    if (plan.handled) throw Error(`VM-Fehler ${fault.reason}, Orakel nicht; ${state.label}`);
    return {result: 'equal-fault', reason: plan.reason, fault: fault.reason};
  }
  if (!plan.handled) {
    if (PROOF_LIMITS.includes(plan.reason)) return {result: 'skipped:' + plan.reason};
    // A lifted native reads a table entry far past its table through the full long
    // address, where the composition wraps in its bank and stops unmapped.
    if (LIFTED_SCRIPT_NATIVES.has(targetOf(state.id)) && plan.reason === 'render_address_required') return {result: 'skipped:lifted-past-table'};
    throw Error(`Orakel scheitert (${plan.reason} ${plan.address?.toString(16) ?? ''}), VM nicht; ${state.label}`);
  }
  const expected = state.wram.slice();
  for (const access of plan.accesses) if (access.kind === 'write') expected[renderAddress(access.address) - 0x7E0000] = access.value;
  // A lifted native (tools/lifted-script-natives.mjs) does not produce the carry and
  // overflow it leaves nor its pushes below the scheduler's S, where natives run.
  const lifted = LIFTED_SCRIPT_NATIVES.has(targetOf(state.id)), flags = lifted ? ~0x41 : ~0;
  const out = {...plan.outputContext, status: plan.outputContext.status & flags}, got = {...vm.context(), status: vm.context().status & flags};
  for (const key of ['a', 'x', 'y', 's', 'd', 'bank', 'status', 'pc'])
    if (out[key] !== got[key]) throw Error(`Register ${key}: Orakel ${out[key]?.toString(16)}, VM ${got[key]?.toString(16)}; ${state.label}`);
  // Nor its direct page scratch (tools/lifted-script-natives.mjs).
  const freeStack = n => lifted && ((n <= outer && n > outer - 0x40) || inLiftedScratch(targetOf(state.id), n));
  for (let n = 0; n < expected.length; n++)
    if (expected[n] !== memory.wram[n] && !freeStack(n)) throw Error(`WRAM ${(0x7E0000 + n).toString(16)}: Orakel ${expected[n]}, VM ${memory.wram[n]}; ${state.label}`);
  const writes = trace.filter(t => t.kind === 'write').map(({kind, ...o}) => ({...o, address: nativeBank(o.address)}));
  const oracleWrites = (plan.ioRequests ?? []).filter(r => r.kind === 'write').map(({kind, ...o}) => ({...o, address: nativeBank(o.address)}));
  if (JSON.stringify(writes) !== JSON.stringify(oracleWrites)) throw Error(`Geräteschreibzugriffe weichen ab; ${state.label}`);
  return {result: 'equal', io: trace.length, wait: observations.wait.length, input: observations.input.length};
}

// Kommandozeile: node tools/vm-special-natives-differential.mjs [Szenarien je ID]
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/').replace(/^\//, '')}`) {
  const { prng } = await import('./vm-differential.mjs');
  const per = Number(process.argv[2] ?? 20), started = Date.now(), totals = {};
  for (const id of specialNativeIds) {
    const tally = {};
    for (let k = 0; k < per; k++) {
      const rnd = prng(id * 1000 + k), r = compareSpecial(rnd, specialScenario(rnd, id, `id ${id.toString(16)} #${k}`));
      const key = r.result === 'equal-fault' ? `fault:${r.fault}` : r.result;
      tally[key] = (tally[key] ?? 0) + 1; totals[r.result] = (totals[r.result] ?? 0) + 1;
    }
    console.log(id.toString(16).padStart(2, '0'), targetOf(id).toString(16), JSON.stringify(tally));
  }
  console.log(JSON.stringify(totals), `${((Date.now() - started) / 1000).toFixed(1)} s`);
}
