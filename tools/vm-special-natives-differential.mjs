// Differential comparison of special natives (src/vm/special-natives.mjs) against their
// proved opcode compositions: one $58 from $F390 through bridge, native, and
// resumption to the next $F390. Compare all registers, flags, all 131072 WRAM bytes,
// and device writes.
//
// Observations (device reads, wait words, and input words) are test inputs:
// when the VM requests one, append a random value and repeat the call from the
// same initial state. The oracle gets the same set and the processor's read values,
// which it does not calculate itself.
import { VmMemory, VmFault } from '../src/vm/memory.mjs';
import { LIFTED_SCRIPT_NATIVES, inLiftedScratch } from './lifted-script-natives.mjs';
import { ScriptInterpreter } from '../proof/vm/interpreter.mjs';
import { NativeCalls } from '../proof/vm/native-call.mjs';
import { NATIVE_POINTERS } from '../src/vm/layout.mjs';
import { ObservedDevices, observationSet } from '../proof/vm/observed-devices.mjs';
import { SPECIAL_NATIVES } from '../proof/vm/special-natives.mjs';
import { nativeOpcodeTargets } from '../src/data/native-opcode-targets.mjs';
import { nativeTarget } from '../src/script/native-targets.mjs';
import { prepareTaskNativeOpcodeFEC1 } from '../proof/task/native-c8-opcode.mjs';
import { prepareTaskNativeOpcodeFF79 } from '../proof/task/native-clear-opcode.mjs';
import { prepareTaskNativeOpcodeF953 } from '../proof/task/native-input-wait-opcode.mjs';
import { prepareTaskNativeOpcode9BA0 } from '../proof/task/native13-opcode.mjs';
import { prepareTaskNativeOpcodeC46E } from '../proof/task/native-audio-opcode.mjs';
import {
  prepareTaskNativeOpcodeC51F,
  prepareTaskNativeOpcodeC560,
} from '../proof/task/native-random-opcode.mjs';
import { prepareTaskNativeOpcode8E36 } from '../proof/task/native-8e36-opcode.mjs';
import { prepareTaskSelectionOpcode } from '../proof/task/native-selection-root-opcode.mjs';
import { prepareTaskModalOpcode } from '../proof/task/native-modal-opcode.mjs';
import { prepareTaskNativeOpcodeCDA8 } from '../proof/task/native-cda8-opcode.mjs';
import { prepareTaskNativeOpcode8AB5 } from '../proof/task/native-8ab5-opcode.mjs';
import { prepareTaskNativeOpcode8BC5 } from '../proof/task/native-8bc5-opcode.mjs';
import { prepareTaskNativeOpcode8521 } from '../proof/task/native-8521-opcode.mjs';
import { prepareTaskNativeOpcode855E } from '../proof/task/native-855e-opcode.mjs';
import { prepareTaskNativeOpcode936C } from '../proof/task/native-936c-opcode.mjs';
import { prepareTaskNativeOpcode9BC6 } from '../proof/task/native-9bc6-opcode.mjs';
import { prepareTaskNativeOpcode8A51 } from '../proof/task/native-8a51-opcode.mjs';
import {
  prepareTaskNativeOpcodeCombat,
  COMBAT_NATIVE_IDS,
} from '../proof/task/native-combat-opcode.mjs';
import {
  prepareTaskNativeOpcodeSmall,
  SMALL_SPECIAL_CALLEES,
} from '../proof/task/native-small-opcode.mjs';
import { renderAddress } from '../src/render/data.mjs';
import { rom, nativeScenario } from './vm-differential.mjs';
import { oracle, context, PROOF_LIMITS } from './vm-scheduler-differential.mjs';

const romBytes = new Uint8Array(rom.buffer, rom.byteOffset, rom.length);

// Native ID -> proved opcode composition (each checks its ID and metadata).
export const SPECIAL_ORACLES = new Map([
  [0xc8, prepareTaskNativeOpcodeFEC1],
  [0xa7, prepareTaskNativeOpcodeFF79],
  [0xa3, prepareTaskNativeOpcodeF953],
  [0x13, prepareTaskNativeOpcode9BA0],
  [0x4c, prepareTaskNativeOpcodeC46E],
  [0x3e, prepareTaskNativeOpcodeC51F],
  [0x63, prepareTaskNativeOpcodeC560],
  [0x7c, prepareTaskNativeOpcode8E36],
  [0x9a, prepareTaskSelectionOpcode],
  [0x1a, prepareTaskSelectionOpcode],
  [0x72, prepareTaskModalOpcode],
  [0xbf, prepareTaskModalOpcode],
  [0x74, prepareTaskModalOpcode],
  [0xd7, prepareTaskModalOpcode],
  [0xc2, prepareTaskNativeOpcodeCDA8],
  [0x10, prepareTaskNativeOpcode8AB5],
  [0x07, prepareTaskNativeOpcode8BC5],
  [0xac, prepareTaskNativeOpcode8521],
  [0xc0, prepareTaskNativeOpcode855E],
  [0x95, prepareTaskNativeOpcode936C],
  [0xd8, prepareTaskNativeOpcode9BC6],
  [0x58, prepareTaskNativeOpcode8A51],
  [0x5a, prepareTaskNativeOpcode8A51],
  ...COMBAT_NATIVE_IDS.map((id) => [id, prepareTaskNativeOpcodeCombat]),
  ...Object.keys(SMALL_SPECIAL_CALLEES).map((id) => [Number(id), prepareTaskNativeOpcodeSmall]),
]);
const targetOf = (id) => 0x800000 | rom.readUInt16LE(0x157b8 + id * 2);
// All native IDs whose target is a special native.
export const specialNativeIds = Array.from({ length: 256 }, (_, id) => id).filter((id) =>
  SPECIAL_NATIVES.has(targetOf(id)),
);

// State at $F390 immediately before $58 (arguments are on the stack).
export function specialScenario(rnd, id, label) {
  const scenario = nativeScenario(rnd, id, label);
  // Zero half the values so loops over tables and slots can terminate.
  for (let n = 0x2000; n < scenario.wram.length; n++) if (rnd() < 0.5) scenario.wram[n] = 0;
  const vm = new ScriptInterpreter(new VmMemory(romBytes, scenario.wram));
  vm.setContext(scenario.context);
  vm.run(rom[0x15a4c + id]);
  if (vm.x !== 0x58) throw Error(`Scenario ${label}: did not reach $58`);
  return { label, id, wram: scenario.wram, context: vm.context() };
}

// Run the VM from a starting state: drive(vm) is either an opcode count (interpreter
// starting at $F390) or a function that drives the VM (for example TaskScheduler).
// Observations are produced on demand: when a special native requests one, feed returns
// a value (or undefined), which is added to the current call's set, and execution repeats
// from the initial state. feed: {io(fault, memory), wait(details), input(details)}.
export function runObserved(start, feed, drive, limit = 4000) {
  const sets = [];
  for (let n = 0; n < limit; n++) {
    const memory = new VmMemory(start.rom ?? romBytes, start.wram.slice()),
      vm = new ScriptInterpreter(memory);
    vm.setContext(start.context);
    if (start.pc !== undefined) vm.pc = start.pc;
    const devices = new ObservedDevices(sets.map((set) => observationSet(set.target, set)));
    vm.natives = new NativeCalls(vm, {
      admitted: nativeOpcodeTargets,
      implementation: nativeTarget,
      devices,
    });
    const trace = (vm.natives.accessor.trace = []);
    vm.natives.accessor.observeArithmetic = start.observeArithmetic === true;
    let exit = null,
      fault = null;
    try {
      exit = typeof drive === 'number' ? vm.run(drive) : drive(vm);
    } catch (error) {
      if (!(error instanceof VmFault)) throw error;
      fault = error;
    }
    if (fault === null && vm.pc === 0xf4f6) {
      // Special native without an observation set: create an empty set for this call.
      const target = 0x800000 | memory.read16(NATIVE_POINTERS + vm.x);
      if (SPECIAL_NATIVES.has(target) && devices.index === sets.length) {
        sets.push({ target, io: [], wait: [], input: [] });
        continue;
      }
    }
    if (fault !== null && devices.index === sets.length && sets.length) {
      const set = sets.at(-1),
        details = fault.details ?? {};
      let added;
      if (fault.reason === 'device_observation_required') {
        const value = feed.io(fault, memory);
        if (value !== undefined)
          added = set.io.push({
            pc: details.pc,
            address: nativeBank(fault.address),
            width: details.width,
            value,
          });
      } else if (fault.reason === 'native_boundary:task_wait_observation_required') {
        const value = feed.wait(details);
        if (value !== undefined)
          added = set.wait.push({ pc: details.pc, address: details.address, width: 2, value });
      } else if (fault.reason === 'native_boundary:task_input_observation_required') {
        const value = feed.input(details);
        if (value !== undefined)
          added = set.input.push({ pc: details.pc, address: details.address, width: 2, value });
      }
      if (added) continue;
    }
    return { vm, memory, exit, fault, trace, sets };
  }
  throw Error(`Observations did not terminate (${sets.length} sets); ${start.label}`);
}

// Random values: wait loops stop at 0, so return 0 with probability 1/2.
// APU port 0: the original waits for the token echo in $1CE4; the test supplies it half the time.
export const randomFeed = (rnd) => ({
  io: (fault, memory) =>
    (fault.address & 0xffff) === 0x2140 && rnd() < 0.5
      ? memory.wram[0x1ce4]
      : (rnd() * (fault.details.width === 1 ? 0x100 : 0x10000)) | 0,
  wait: () => (rnd() < 0.5 ? 0 : 1 + ((rnd() * 4) | 0)),
  input: () => (rnd() * 0x10000) | 0,
});

// Lifted natives read the system registers in bank 00; the natives' data bank is 80,
// where the register-level compositions and recordings read them.
const nativeBank = (address) =>
  (address >>> 16) % 0x80 < 0x40 && (address & 0xffff) < 0x8000
    ? 0x800000 | (address & 0xffff)
    : address;
export function compareSpecial(rnd, state) {
  const { vm, memory, fault, trace, sets } = runObserved(state, randomFeed(rnd), 1);
  const observations = sets[0] ?? { wait: [], input: [] };
  const outer = state.wram[0x01f2] | (state.wram[0x01f3] << 8);
  const protectedStackBytes = [
    0x7ffffe,
    0x7fffff,
    renderAddress((outer + 1) & 0xffff),
    renderAddress((outer + 2) & 0xffff),
  ];
  const frozen = (list) => Object.freeze(list.map((o) => Object.freeze({ ...o })));
  const plan = oracle(SPECIAL_ORACLES.get(state.id), state.wram, {
    entry: 0x80f390,
    context: context(0xf390, state.context),
    protectedStackBytes,
    nativeId: state.id,
    ioMode: 'record-requests',
    ioObservations: frozen(
      trace
        .filter((t) => t.kind === 'read')
        .map(({ kind, ...o }) => ({ ...o, address: nativeBank(o.address) })),
    ),
    waitMode: 'record-observations',
    waitObservations: frozen(observations.wait),
    inputMode: 'record-observations',
    inputObservations: frozen(observations.input),
  });
  if (fault) {
    // Lifted natives stop at unmapped addresses past the WRAM mirror of their data bank.
    if (
      plan.handled &&
      LIFTED_SCRIPT_NATIVES.has(targetOf(state.id)) &&
      /unmapped_read|unmapped_write/.test(fault.reason)
    )
      return { result: 'skipped:lifted-domain' };
    if (plan.handled) throw Error(`VM fault ${fault.reason}, but not the oracle; ${state.label}`);
    return { result: 'equal-fault', reason: plan.reason, fault: fault.reason };
  }
  if (!plan.handled) {
    if (PROOF_LIMITS.includes(plan.reason)) return { result: 'skipped:' + plan.reason };
    // A lifted native reads a table entry far past its table through the full long
    // address, where the composition wraps in its bank and stops unmapped.
    if (LIFTED_SCRIPT_NATIVES.has(targetOf(state.id)) && plan.reason === 'render_address_required')
      return { result: 'skipped:lifted-past-table' };
    throw Error(
      `Oracle failed (${plan.reason} ${plan.address?.toString(16) ?? ''}), but not the VM; ${state.label}`,
    );
  }
  const expected = state.wram.slice();
  for (const access of plan.accesses)
    if (access.kind === 'write') expected[renderAddress(access.address) - 0x7e0000] = access.value;
  // A lifted native (tools/lifted-script-natives.mjs) does not produce the carry and
  // overflow it leaves nor its pushes below the scheduler's S, where natives run.
  const lifted = LIFTED_SCRIPT_NATIVES.has(targetOf(state.id)),
    flags = lifted ? ~0x41 : ~0;
  const out = { ...plan.outputContext, status: plan.outputContext.status & flags },
    got = { ...vm.context(), status: vm.context().status & flags };
  for (const key of ['a', 'x', 'y', 's', 'd', 'bank', 'status', 'pc'])
    if (out[key] !== got[key])
      throw Error(
        `Register ${key}: Orakel ${out[key]?.toString(16)}, VM ${got[key]?.toString(16)}; ${state.label}`,
      );
  // Nor its direct page scratch (tools/lifted-script-natives.mjs).
  const freeStack = (n) =>
    lifted && ((n <= outer && n > outer - 0x40) || inLiftedScratch(targetOf(state.id), n));
  for (let n = 0; n < expected.length; n++)
    if (expected[n] !== memory.wram[n] && !freeStack(n))
      throw Error(
        `WRAM ${(0x7e0000 + n).toString(16)}: Orakel ${expected[n]}, VM ${memory.wram[n]}; ${state.label}`,
      );
  const writes = trace
    .filter((t) => t.kind === 'write')
    .map(({ kind, ...o }) => ({ ...o, address: nativeBank(o.address) }));
  const oracleWrites = (plan.ioRequests ?? [])
    .filter((r) => r.kind === 'write')
    .map(({ kind, ...o }) => ({ ...o, address: nativeBank(o.address) }));
  if (JSON.stringify(writes) !== JSON.stringify(oracleWrites))
    throw Error(`Device writes differ; ${state.label}`);
  return {
    result: 'equal',
    io: trace.length,
    wait: observations.wait.length,
    input: observations.input.length,
  };
}

// Command line: node tools/vm-special-natives-differential.mjs [scenarios per ID]
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/').replace(/^\//, '')}`) {
  const { prng } = await import('./vm-differential.mjs');
  const per = Number(process.argv[2] ?? 20),
    started = Date.now(),
    totals = {};
  for (const id of specialNativeIds) {
    const tally = {};
    for (let k = 0; k < per; k++) {
      const rnd = prng(id * 1000 + k),
        r = compareSpecial(rnd, specialScenario(rnd, id, `id ${id.toString(16)} #${k}`));
      const key = r.result === 'equal-fault' ? `fault:${r.fault}` : r.result;
      tally[key] = (tally[key] ?? 0) + 1;
      totals[r.result] = (totals[r.result] ?? 0) + 1;
    }
    console.log(id.toString(16).padStart(2, '0'), targetOf(id).toString(16), JSON.stringify(tally));
  }
  console.log(JSON.stringify(totals), `${((Date.now() - started) / 1000).toFixed(1)} s`);
}
