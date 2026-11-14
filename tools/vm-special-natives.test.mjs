import test from 'node:test';
import assert from 'node:assert/strict';
import {VmMemory, VmFault} from '../src/vm/memory.mjs';
import {ScriptInterpreter, EXIT_NATIVE_CALL} from '../src/vm/interpreter.mjs';
import {NativeCalls} from '../src/vm/native-call.mjs';
import {ObservedDevices,observationSet} from '../proof/vm/observed-devices.mjs';
import {nativeOpcodeTargets} from '../src/task/native-opcode-targets.mjs';
import {nativeTarget} from '../src/task/native-targets.mjs';
import {prng, rom} from './vm-differential.mjs';
import {specialNativeIds, specialScenario, compareSpecial} from './vm-special-natives-differential.mjs';
import {bodyCasesAll, compareBody} from './vm-body-specs.mjs';

const tally = results => results.reduce((t, r) => (t[r] = (t[r] ?? 0) + 1, t), {});
const romBytes = new Uint8Array(rom.buffer, rom.byteOffset, rom.length);

test('Spezialnatives gleichen ihren bewiesenen Opcode-Kompositionen (Beobachtungen als Eingabe)', () => {
  assert.equal(specialNativeIds.length, 44);
  const results = [];
  for (const id of specialNativeIds)
    for (let k = 0; k < 4; k++) {
      const rnd = prng(id * 1000 + k);
      results.push(compareSpecial(rnd, specialScenario(rnd, id, `id ${id.toString(16)} #${k}`)).result);
    }
  const counts = tally(results);
  assert.ok(counts.equal >= 30, JSON.stringify(counts));
  assert.deepEqual(Object.keys(counts).filter(r => !r.startsWith('equal') && !r.startsWith('skipped:')), []);
});

test('Ohne Beobachtungssatz endet ein Spezialnative wie ein nicht gebundenes Native', () => {
  const rnd = prng(0xC8 * 1000), state = specialScenario(rnd, 0xC8, 'ohne Satz');
  const vm = new ScriptInterpreter(new VmMemory(romBytes, state.wram.slice()));
  vm.setContext(state.context);
  vm.natives = new NativeCalls(vm, {admitted: nativeOpcodeTargets, implementation: nativeTarget, devices: new ObservedDevices()});
  assert.equal(vm.run(1), EXIT_NATIVE_CALL);
  assert.equal(vm.pc, 0xF4F6);
  assert.equal(vm.natives.calls, 0);
});

test('Gerätelesungen brauchen eine passende Beobachtung; übrige Beobachtungen sind ein Fehler', () => {
  const rnd = prng(0x63 * 1000), state = specialScenario(rnd, 0x63, 'Zufallsbyte');
  const run = sets => {
    const vm = new ScriptInterpreter(new VmMemory(romBytes, state.wram.slice()));
    vm.setContext(state.context);
    vm.natives = new NativeCalls(vm, {admitted: nativeOpcodeTargets, implementation: nativeTarget, devices: new ObservedDevices(sets)});
    try { vm.run(1); return 'ok'; } catch (error) { if (error instanceof VmFault) return error.reason; throw error; }
  };
  const io = [{pc: 0x80C566, address: 0x802137, width: 1, value: 1}, {pc: 0x80C572, address: 0x80213C, width: 1, value: 2},
    {pc: 0x80C57F, address: 0x80213D, width: 1, value: 3}];
  assert.equal(run([observationSet(0x80C560, {io: io.slice(0, 2)})]), 'device_observation_required');
  assert.equal(run([observationSet(0x80C560, {io})]), 'ok');
  assert.equal(run([observationSet(0x80C560, {io: [...io, io[0]]})]), 'device_observation_unused');
});

test('Alle bewiesenen Body-Specs laufen über Scheduler, Interpreter und Natives identisch zum Body-Plan', () => {
  const results = [];
  for (const [spec, variant] of bodyCasesAll()) results.push(compareBody(spec, variant).result);
  const counts = tally(results);
  assert.equal(results.length, 1503);
  assert.deepEqual(counts, {equal: 682, 'equal-suspended': 821});
});
