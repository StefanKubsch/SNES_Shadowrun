// Differential comparison of task management and the scheduler (src/vm/scheduler.mjs)
// against the proved compositions as an oracle:
//   $C1CA/$C1F9/$C20B with opcodes, natives, script calls (child tasks) and
//   postrun: prepareTaskVisitStatusOpcodes; without opcodes: prepareTaskVisit
//   $C34A append a task (heap, frame, list): prepareTaskAppendC34A
//   $C401 native wait through its return: prepareTaskNativeWaitOpcode
//   $C1F9 with saved continuation $F508: prepareTaskNativeWaitResume
// Compare all registers, flags and all 131072 WRAM bytes.
import { VmFault } from '../src/vm/memory.mjs';
import { ScriptInterpreter } from '../src/vm/interpreter.mjs';
import { NativeCalls, nativeBridge } from '../src/vm/native-call.mjs';
import { NATIVE_POINTERS } from '../src/vm/layout.mjs';
import { TaskScheduler, nativeWait, STOP_BUDGET } from '../src/vm/scheduler.mjs';
import { prepareTaskVisit } from '../proof/task/visit-c1ca.mjs';
import { prepareTaskVisitStatusOpcodes } from '../proof/task/visit-opcodes.mjs';
import { prepareTaskAppendC34A } from '../proof/task/append-c34a.mjs';
import {
  prepareTaskNativeWaitOpcode,
  prepareTaskNativeWaitResume,
} from '../proof/task/native-wait.mjs';
import { nativeOpcodeTargets } from '../src/task/native-opcode-targets.mjs';
import { nativeTarget } from '../src/task/native-targets.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
import { rom, IO_PCS, TracingMemory } from './vm-differential.mjs';

const romBytes = new Uint8Array(rom.buffer, rom.byteOffset, rom.length);
const admitted = new Set(nativeOpcodeTargets);
const OUTER_S = 0x1fe0,
  OUTER_RETURN = 0x9998;
const WAIT = 0x80c401;

export function createVm(wram) {
  const memory = new TracingMemory(romBytes, wram.slice());
  const vm = new ScriptInterpreter(memory);
  vm.natives = new NativeCalls(vm, { admitted: nativeOpcodeTargets, implementation: nativeTarget });
  return { vm, memory, scheduler: new TaskScheduler(vm) };
}
const set16 = (wram, address, value) => {
  wram[address] = value & 0xff;
  wram[address + 1] = value >>> 8;
};
const get16 = (wram, address) => wram[address] | (wram[address + 1] << 8);

// Target of the $58 opcode that runs next at $F390 (operand = native ID).
function pendingNative(vm) {
  if (vm.x !== 0x58) return null;
  const id = vm.stream16() & 0xff;
  return 0x800000 | vm.mem.read16(NATIVE_POINTERS + id * 2);
}

// --- Oracle -------------------------------------------------------------------

export function oracle(prepare, wram, options) {
  const ranges = [];
  for (let attempt = 0; ; attempt++) {
    const data = createRenderData({ writeWindows: [[0x7e0000, 0x7fffff]] });
    data.seed(0x7e0000, wram);
    for (const [start, length] of ranges) {
      const offset = (((start >>> 16) & 0x1f) << 15) | (start & 0x7fff);
      data.seed(start, romBytes.subarray(offset, offset + length));
    }
    const plan = prepare({ data, maxWork: 3e6, maxOutputBytes: 1e6, ...options });
    const address = plan.address;
    if (
      plan.handled ||
      plan.reason !== 'render_source_required' ||
      !(address >= 0x800000 && (address & 0xffff) >= 0x8000) ||
      attempt === 64
    )
      return plan;
    ranges.push([(address & 0xff0000) | 0x8000, 0x8000]);
  }
}
export const context = (pc, c) =>
  Object.freeze({
    e: 0,
    programBank: 0x80,
    pc,
    a: c.a,
    x: c.x,
    y: c.y,
    s: c.s,
    d: c.d,
    bank: c.bank,
    status: c.status,
  });
// Oracle proof boundaries (protected stack, budget) are not differences.
export const PROOF_LIMITS = [
  'task_stack_alias_required',
  'task_outer_return_required',
  'task_work_budget_required',
  'task_output_budget_required',
];

export function check(label, plan, wram, vm, memory) {
  if (!plan.handled) {
    if (PROOF_LIMITS.includes(plan.reason)) return 'skipped:' + plan.reason;
    throw Error(
      `Oracle fails (${plan.reason} ${plan.address?.toString(16) ?? ''}), VM succeeds; ${label}`,
    );
  }
  const expected = wram.slice();
  for (const access of plan.accesses)
    if (access.kind === 'write') expected[renderAddress(access.address) - 0x7e0000] = access.value;
  const out = plan.outputContext,
    got = vm.context();
  for (const key of ['a', 'x', 'y', 's', 'd', 'bank', 'status', 'pc'])
    if (out[key] !== got[key])
      throw Error(
        `Register ${key}: oracle ${out[key]?.toString(16)}, VM ${got[key]?.toString(16)}; ${label}`,
      );
  for (let n = 0; n < expected.length; n++)
    if (expected[n] !== memory.wram[n])
      throw Error(
        `WRAM $${(0x7e0000 + n).toString(16)}: oracle ${expected[n]}, VM ${memory.wram[n]}; ${label}`,
      );
  return 'equal';
}

// --- Comparisons --------------------------------------------------------------

// A scheduler entry ($C1CA/$C1F9/$C20B) with at most maxSteps opcodes.
// The VM advances opcode by opcode to assign arithmetic device observations
// to their original PCs; the comparison ends before natives without an oracle
// composition ($C401 and unadmitted natives).
// Optional stats count the flows established by the oracle plan.
export function compareVisit(state, entry, maxSteps, label, stats = null) {
  const run = (budget) => {
    const { vm, memory, scheduler } = createVm(state.wram);
    vm.setContext(state.context);
    const observations = [];
    let stop = scheduler.call(entry, 0),
      steps = 0,
      fault = null,
      waitPending = false;
    while (stop === STOP_BUDGET && steps < budget) {
      const target = pendingNative(vm);
      if (target !== null && !admitted.has(target)) {
        waitPending = target === WAIT;
        break;
      }
      const opcode = vm.x;
      memory.io.length = 0;
      try {
        stop = scheduler.resume(1);
      } catch (error) {
        if (!(error instanceof VmFault)) throw error;
        fault = error;
        break;
      }
      const family =
        opcode >= 0x60 && opcode <= 0x66
          ? 'multiply'
          : opcode >= 0x68 && opcode <= 0x6e
            ? 'divide'
            : null;
      if (memory.io.length && !family) throw Error('Unerwarteter I/O-Zugriff; ' + label);
      memory.io.forEach((o, n) =>
        observations.push(
          Object.freeze({
            pc: IO_PCS[family][n],
            address: o.address,
            width: o.width,
            value: o.value,
          }),
        ),
      );
      steps++;
    }
    return { vm, memory, steps, stop, fault, observations, waitPending };
  };
  // The oracle composes a saved native continuation ($F508) only without
  // further opcodes and only from $C1F9.
  const visited = entry === 0xc1ca ? get16(state.wram, 0x24c) : state.context.x;
  if (!(visited & 0x8000) && get16(state.wram, 0x2b2 + visited) === 0xf508) {
    if (entry !== 0xc1f9) return 'skipped:wait-resume-entry';
    maxSteps = 0;
  }
  let result;
  try {
    result = run(maxSteps);
  } catch (error) {
    if (!(error instanceof VmFault)) throw error;
    return 'vm-fault-before-opcode:' + error.reason;
  }
  // After a fault, compare the clean state immediately before it.
  if (result.fault) result = run(result.steps);
  const { vm, memory, steps, observations } = result;
  const protectedStackBytes = [
    renderAddress(state.context.s + 1),
    renderAddress(state.context.s + 2),
  ];
  let plan;
  if (steps === 0) {
    const resume = entry === 0xc1f9 && get16(state.wram, 0x2b2 + visited) === 0xf508;
    plan = oracle(resume ? prepareTaskNativeWaitResume : prepareTaskVisit, state.wram, {
      entry: 0x800000 | entry,
      context: context(entry, state.context),
      protectedStackBytes,
    });
  } else {
    plan = oracle(prepareTaskVisitStatusOpcodes, state.wram, {
      entry: 0x800000 | entry,
      context: context(entry, state.context),
      maxHandlers: steps,
      protectedStackBytes,
      ioMode: 'record-requests',
      ioObservations: Object.freeze(observations),
    });
  }
  const outcome = check(`${label}, ${steps} opcodes`, plan, state.wram, vm, memory);
  // Compare a pending native wait separately, starting from this state.
  if (result.waitPending && outcome === 'equal') {
    const waited = compareWait(memory.wram.slice(), vm.context(), label + ' wait');
    if (stats) stats['wait-' + waited] = (stats['wait-' + waited] ?? 0) + 1;
  }
  if (stats && outcome === 'equal') {
    const count = (key) => {
      stats[key] = (stats[key] ?? 0) + 1;
    };
    for (const step of plan.steps ?? []) {
      if (step.opcode === 0x52) count('script-call');
      if (step.opcode === 0x56) count('end');
      if (step.opcode === 0x58) count('native');
    }
    for (const visit of plan.visits ?? []) {
      if (visit.postrunOccurrenceProven) count('postrun');
      if (visit.continuationTarget === 0x80f495) count('script-resume');
    }
    if (plan.continuationTarget === 0x80f509) count('wait-resume');
  }
  return outcome === 'equal' ? (steps ? 'equal-opcodes' : 'equal') : outcome;
}

// $C34A for script id; arguments in the DBR:0000 work area come from the state.
export function compareAppend(state, id, label) {
  const { vm, memory, scheduler } = createVm(state.wram);
  vm.setContext({ ...state.context, x: id });
  scheduler.call(0xc34a);
  const plan = oracle(prepareTaskAppendC34A, state.wram, {
    entry: 0x80c34a,
    context: context(0xc34a, { ...state.context, x: id }),
    protectedStackBytes: [renderAddress(state.context.s + 1), renderAddress(state.context.s + 2)],
  });
  return check(label, plan, state.wram, vm, memory);
}

// $58 targeting $C401 from $F390 through the return to the scheduler ($C20B).
export function compareWait(wram, taskContext, label) {
  const { vm, memory } = createVm(wram);
  vm.setContext(taskContext);
  vm.run(1);
  nativeBridge(vm);
  vm.pc = WAIT & 0xffff;
  nativeWait(vm);
  const outer = get16(wram, 0x1f2);
  const plan = oracle(prepareTaskNativeWaitOpcode, wram, {
    entry: 0x80f390,
    context: context(0xf390, taskContext),
    protectedStackBytes: [renderAddress(outer + 1), renderAddress(outer + 2)],
  });
  return check(label, plan, wram, vm, memory);
}

// --- States -------------------------------------------------------------------

// Random WRAM, task management initialized through $C1A6 and tasks appended
// through $C34A. The outer caller's return word is at OUTER_S+1.
export function initialState(rnd, ids) {
  const wram = new Uint8Array(0x20000);
  for (let n = 0; n < wram.length; n++) wram[n] = rnd() < 0.5 ? 0 : (rnd() * 256) | 0;
  const { vm, memory, scheduler } = createVm(wram);
  vm.setContext({
    a: 0,
    x: 0,
    y: 0,
    s: OUTER_S - 2,
    d: 0,
    bank: 0x80,
    status: (rnd() * 256) & 0xc7,
  });
  const enter = (entry, budget = Infinity) => {
    vm.s = OUTER_S;
    vm.push16(OUTER_RETURN);
    return scheduler.call(entry, budget);
  };
  enter(0xc1a6);
  for (const id of ids) {
    vm.x = id;
    vm.d = 0;
    vm.dbr = 0x80;
    enter(0xc34a);
  }
  return { wram: memory.wram, vm, scheduler, enter };
}

// Comparison state: current WRAM and registers at the outer caller's JSR.
export function snapshot(sim, x, status) {
  const wram = sim.wram.slice();
  set16(wram, OUTER_S - 1, OUTER_RETURN);
  return { wram, context: { a: 0, x, y: 0, s: OUTER_S - 2, d: 0, bank: 0x80, status } };
}
export { OUTER_S, OUTER_RETURN, get16, set16, pendingNative };
