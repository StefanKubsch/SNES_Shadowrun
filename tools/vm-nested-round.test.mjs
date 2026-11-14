// Themenaktion des Dialogs ($9178 ab $91CA): Task anhängen ($C34A) und sofort besuchen ($C1CA) als
// verschachtelte Schedulerrunde aus dem Native. Vergleich: dieselben Schritte direkt auf dem TaskScheduler
// (JSR-Rahmen von $91D1/$91D4 gepusht). Geprüft wird die Verbindung zwischen Native und Scheduler
// (Register hin und zurück, gesicherter Accessor, Natives in der Runde); C34A und C1CA haben eigene Beweise.
import test from 'node:test';
import assert from 'node:assert/strict';
import {VmMemory, VmFault, WRAM_SIZE} from '../src/vm/memory.mjs';
import {ScriptInterpreter} from '../src/vm/interpreter.mjs';
import {TaskScheduler, STOP_RETURNED} from '../src/vm/scheduler.mjs';
import {NativeCalls} from '../src/vm/native-call.mjs';
import {NATIVE_POINTERS} from '../src/vm/layout.mjs';
import {ObservedDevices,observationSet} from '../proof/vm/observed-devices.mjs';
import {SPECIAL_NATIVES} from '../src/vm/special-natives.mjs';
import {nativeOpcodeTargets} from '../src/task/native-opcode-targets.mjs';
import {nativeTarget} from '../src/task/native-targets.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {dialogTextRoutines, dialogTopicSequence} from '../src/task/native-dialog-text.mjs';
import {NativeCallContinuation} from '../src/task/native-call-continuation.mjs';
import {WAIT_PAUSED} from '../src/task/native-wait-continuation.mjs';
import {WEAPON_MENU_ROUTINES} from '../src/task/native-member-spell-menu.mjs';
import {prng, rom} from './vm-differential.mjs';
import {randomFeed} from './vm-special-natives-differential.mjs';

const romBytes = new Uint8Array(rom.buffer, rom.byteOffset, rom.length);
const romByte = address => rom[((address >>> 16) & 0x7F) << 15 | (address & 0x7FFF)];
const romWord = address => romByte(address) | romByte(address + 1) << 8;

// Aktionsscripts aller Dialogdatensätze (Tabelle 80:94F7, Bank 8D) wie $9178 sie liest: Schlüssel, Länge,
// Flagbyte (Bit 7 Aktion, Low-Nibble Zahl der Themen-IDs), IDs, Aktionswort, Textwort; Ende F8.
export function dialogActionScripts(dialogs = 0x89) {
  const scripts = new Set();
  for (let id = 0; id < dialogs; id++) {
    const base = 0x8D0000 | romWord(0x8094F7 + id * 2);
    for (let y = 4, guard = 0; romByte(base + y) !== 0xF8 && guard < 64; guard++) {
      const flags = romByte(base + y + 2);
      if (flags & 0x80) scripts.add(romWord(base + y + 3 + (flags & 0xF)));
      y += 1 + romByte(base + y + 1);
    }
  }
  return [...scripts].sort((a, b) => a - b);
}

const STACK = 0x1FB0, CALLER_SCRIPT = 0x2C2, RECORD = 0x7F8000;
// Scheduler mit einem laufenden Dialogtask (Cursor) und weiteren Tasks; Datensatz [11] mit dem Aktionswort.
function scenario(rnd, script) {
  const wram = new Uint8Array(WRAM_SIZE);
  for (let n = 0x1000; n < 0x2000; n++) if (rnd() < 0.1) wram[n] = (rnd() * 256) | 0;
  const vm = new ScriptInterpreter(new VmMemory(romBytes, wram)), scheduler = new TaskScheduler(vm);
  vm.dbr = 0x80; vm.s = STACK; vm.d = 0; vm.p = 0;
  vm.push16(0x1234); assert.equal(scheduler.call(0xC1A6), STOP_RETURNED);
  for (const id of [0x10, CALLER_SCRIPT]) { vm.x = id; vm.push16(0x1234); assert.equal(scheduler.call(0xC34A), STOP_RETURNED); }
  vm.mem.write16(0x800250, vm.mem.read16(0x80024C));
  const y = (rnd() * 8) | 0;
  wram[RECORD - 0x7E0000 + y] = script & 0xFF; wram[RECORD - 0x7E0000 + y + 1] = script >>> 8;
  vm.mem.write16(0x800011, RECORD & 0xFFFF); vm.mem.write8(0x800013, RECORD >>> 16);
  vm.mem.write16(0x800026, (rnd() * 0x60) | 0);
  return {wram, context: {a: 0, x: 0, y, s: STACK, d: 0, bank: 0x80, status: 0x01}};
}

const fresh = state => {
  const vm = new ScriptInterpreter(new VmMemory(romBytes, state.wram.slice()));
  vm.a = state.context.a; vm.x = state.context.x; vm.y = state.context.y; vm.s = state.context.s;
  vm.d = 0; vm.dbr = 0x80; vm.p = state.context.status; vm.pc = 0x91CA;
  return vm;
};
const natives = (vm, sets) => new NativeCalls(vm, {admitted: nativeOpcodeTargets, implementation: nativeTarget,
  devices: new ObservedDevices(sets.map(set => observationSet(set.target, set)))});

// Native-Seite: Themenaktion über die Dialogroutinen mit der Runde von NativeCalls.
const topic = (h, events) => dialogTextRoutines(events).topic(h);
function viaNative(state, sets, action = topic) {
  const vm = fresh(state);
  vm.natives = natives(vm, sets);
  const accessor = vm.natives.accessor;
  accessor.load(); accessor.entry = 0x80936C; accessor.io = Object.freeze([]); accessor.ioIndex = 0;
  const events = {values: null, waitIndex: 0, inputs: null, inputIndex: 0, round: entry => vm.natives.round(entry),
    nestedRound: entry => vm.natives.nestedRound(entry)};
  const h = dialogAccess(accessor);
  try { action(h, events); } catch (error) { return {vm, fault: error}; }
  assert.equal(accessor.io.length, 0);
  accessor.store();
  return {vm, fault: null};
}
// Vergleich: LDA [11],Y / TAX / LDA $26 / STA $00 / JSR $C34A / JSR $C1CA direkt auf dem Scheduler.
const topicSteps = vm => {
  vm.x = vm.mem.read16(RECORD + vm.y); vm.a = vm.mem.read16Bank0(0x26); vm.mem.write16Bank0(0, vm.a);
  return [0x91D3, 0x91D6];
};
function viaScheduler(state, sets, steps = topicSteps) {
  const vm = fresh(state), scheduler = new TaskScheduler(vm);
  vm.natives = natives(vm, sets);
  const [append, visit] = steps(vm);
  vm.push16(append); assert.equal(scheduler.call(0xC34A), STOP_RETURNED);
  // Zwischen den Aufrufen: optionale Schreibzugriffe des Natives (F254: STZ $1F58).
  if (typeof visit === 'object') { visit.after(vm); vm.push16(visit.pc); } else vm.push16(visit);
  try { return {vm, stop: scheduler.call(0xC1CA), error: null}; } catch (error) { return {vm, stop: null, error}; }
}

// Beobachtungen nach Bedarf (wie runObserved): Spezialnative ohne Satz in der Runde, Gerätelesungen, Warten.
function observe(state, rnd, action = topic) {
  const sets = [], feed = randomFeed(rnd);
  for (let n = 0; n < 2000; n++) {
    const run = viaNative(state, sets, action), fault = run.fault;
    if (fault === null) return {sets, run};
    const details = fault.details ?? {};
    if (fault.reason === 'nested_round_stop' && run.vm.pc === 0xF4F6) {
      const target = 0x800000 | run.vm.mem.read16(NATIVE_POINTERS + run.vm.x);
      if (SPECIAL_NATIVES.has(target) && run.vm.natives.devices.index === sets.length) { sets.push({target, io: [], wait: [], input: []}); continue; }
    }
    const set = sets.at(-1);
    if (set && fault.reason === 'device_observation_required') { set.io.push({pc: details.pc, address: fault.address, width: details.width, value: feed.io(fault, run.vm.mem)}); continue; }
    if (set && fault.reason === 'native_boundary:task_wait_observation_required') { set.wait.push({pc: details.pc, address: details.address, width: 2, value: feed.wait(details)}); continue; }
    if (set && fault.reason === 'native_boundary:task_input_observation_required') { set.input.push({pc: details.pc, address: details.address, width: 2, value: feed.input(details)}); continue; }
    return {sets, run};
  }
  throw Error('Beobachtungen ohne Ende');
}

// Native gegen Scheduler für eine Liste von Scripts; returnPc ist die PC nach dem JSR $C1CA.
function compareRounds(scripts, seeds, action, steps, returnPc) {
  const tally = {};
  for (const script of scripts)
    for (let k = 0; k < seeds; k++) {
      const rnd = prng(script * 16 + k), state = scenario(rnd, script), label = `Script $${script.toString(16)} #${k}`;
      const {sets, run} = observe(state, rnd, action(script)), ref = viaScheduler(state, sets, steps(script));
      const outcome = run.fault === null ? 'returned' : run.fault.reason === 'nested_round_stop' ? 'stop-' + run.fault.details.stop : 'fault';
      // Fehler im Inneren der Runde (Natives auf Zufallsdaten): beide Seiten gleich.
      if (outcome === 'fault') assert.equal(String(ref.error?.reason ?? ref.error?.message), String(run.fault.reason ?? run.fault.message), label);
      else if (run.fault === null) {
        assert.equal(ref.stop, STOP_RETURNED, label);
        assert.equal(run.vm.pc, returnPc, label);
      } else assert.equal(ref.stop, run.fault.details.stop, label);
      for (const key of ['a', 'x', 'y', 's', 'd', 'dbr', 'p', 'pc']) assert.equal(run.vm[key], ref.vm[key], `${label}: ${key}`);
      assert.ok(Buffer.from(run.vm.mem.wram).equals(Buffer.from(ref.vm.mem.wram)), `${label}: WRAM`);
      tally[outcome] = (tally[outcome] ?? 0) + 1;
      // Natives, die auf diesen synthetischen Daten bis zur Zugriffsgrenze laufen (z. B. $913C), nur einmal.
      if (run.fault?.reason === 'native_access_limit') break;
      if (sets.length) tally.nestedSpecial = (tally.nestedSpecial ?? 0) + 1;
      if (run.vm.natives.calls) tally.nestedNatives = (tally.nestedNatives ?? 0) + 1;
    }
  return tally;
}

test('Themenaktion: Runde aus dem Native gleicht C34A und C1CA direkt auf dem Scheduler', () => {
  const scripts = dialogActionScripts();
  assert.ok(scripts.length >= 50, `${scripts.length} Aktionsscripts`);
  const tally = compareRounds(scripts, 2, () => topic, () => topicSteps, 0x91D7);
  assert.ok(tally.returned >= 15 && tally.nestedNatives >= 10 && tally.nestedSpecial >= 3, JSON.stringify(tally));
});

// Dieselbe Themenaktion als Fortsetzung in Stücken von 40 Opcodes: C1CA als pausierbare Runde
// (NativeCalls.nestedRound) pausiert zwischen den Stücken und endet wie der Schedulerlauf.
test('Themenaktion: pausierbare Runde in kleinen Budgets gleicht C34A und C1CA direkt auf dem Scheduler', () => {
  let pauses = 0;
  const paused = () => (h, events) => {
    const continuation = new NativeCallContinuation(h.a, dialogTopicSequence(h, events));
    while (continuation.run(40) === WAIT_PAUSED) pauses++;
  };
  const tally = compareRounds(dialogActionScripts(), 2, paused, () => topicSteps, 0x91D7);
  assert.ok(tally.returned >= 15 && pauses >= 100, JSON.stringify({...tally, pauses}));
});

// Waffenmenü $E693 (Native01/F254): Script $1E2D nach X, Argument $1E3D nach DP00, JSR $C34A an $E788,
// STZ $1F58, JSR $C1CA an $E78E über die Routinen von WEAPON_MENU_ROUTINES. Scripts aus der Spalte $E804.
const WEAPON_SCRIPTS = [6, 7, 8, 9, 10, 11].map(y => romWord(0x80E804 + 2 * y));
const weaponArgument = script => 1 + (script % 5);
test('Waffenmenü: Runde aus F254 gleicht C34A und C1CA direkt auf dem Scheduler', () => {
  assert.deepEqual(WEAPON_SCRIPTS, [0x2D9, 0x20C, 0x77, 0x1FC, 0x205, 0x37]);
  const action = script => (h, events) => {
    h.index('x', script); h.dpWrite(0, weaponArgument(script), 2);
    h.call(0x80E788, 0x80C34A, () => WEAPON_MENU_ROUTINES.get(0x80C34A)(h, events));
    h.write(h.abs(0x1F58), 0, 2);
    h.call(0x80E78E, 0x80C1CA, () => WEAPON_MENU_ROUTINES.get(0x80C1CA)(h, events));
  };
  const steps = script => vm => {
    vm.x = script; vm.mem.write16Bank0(0, weaponArgument(script)); vm.p = (vm.p & ~0x82) | (script & 0x8000 ? 0x80 : 0) | (script ? 0 : 2);
    return [0xE78A, {after: vm2 => vm2.mem.write16(0x801F58, 0), pc: 0xE790}];
  };
  const tally = compareRounds(WEAPON_SCRIPTS, 6, action, steps, 0xE791);
  // Die meisten Scripts laufen auf den Zufallsdaten in einen gleichen Fehler innerhalb der Runde.
  assert.ok(tally.returned >= 3 && tally.nestedNatives >= 20 && tally.nestedSpecial >= 10, JSON.stringify(tally));
});

test('Themenaktion ohne Runde bleibt eine benannte Grenze', () => {
  const state = scenario(prng(1), 0x396), vm = fresh(state);
  vm.natives = natives(vm, []);
  vm.natives.accessor.load();
  assert.throws(() => dialogTextRoutines({values: null, waitIndex: 0}).topic(dialogAccess(vm.natives.accessor)),
    error => error?.reason === 'task_dialog_topic_visit_open');
});
