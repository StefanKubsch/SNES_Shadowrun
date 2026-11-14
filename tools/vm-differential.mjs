// Differential: the native interpreter (src/vm) against the proven handlers
// (proof/task/opcode-sequence.mjs) as the oracle. The same start states, then a
// comparison of all registers, flags and the whole WRAM; faults must occur on both
// sides. Values of the arithmetic unit go to the oracle as observations, as it does
// not compute them itself.
import { readFileSync } from 'node:fs';
import { VmMemory, VmFault } from '../src/vm/memory.mjs';
import {
  ScriptInterpreter,
  EXIT_BUDGET,
  EXIT_END,
  EXIT_STATUS_RETURN,
  EXIT_NATIVE_CALL,
} from '../src/vm/interpreter.mjs';
import { NativeCalls } from '../src/vm/native-call.mjs';
import {
  prepareTaskOpcodeSequence,
  prepareTaskNativeOpcodeSequence,
} from '../proof/task/opcode-sequence.mjs';
import { nativeOpcodeTargets } from '../src/task/native-opcode-targets.mjs';
import { nativeTarget } from '../src/task/native-targets.mjs';
import { NATIVE_POINTERS } from '../src/vm/layout.mjs';
import { LIFTED_SCRIPT_NATIVES, inLiftedScratch } from './lifted-script-natives.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
import { inspectScriptTables } from './scripts.mjs';

const CARRY_FLAG = 0x01,
  OVERFLOW_FLAG = 0x40;
export const rom = readFileSync(new URL('../Shadowrun (E).smc', import.meta.url));
const romBytes = new Uint8Array(rom.buffer, rom.byteOffset, rom.length);
export const scriptTable = inspectScriptTables(rom).scripts;

export function prng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const EDGE = [0, 1, 2, 0x7f, 0x80, 0xff, 0x100, 0x7fff, 0x8000, 0x8001, 0xfffe, 0xffff];
export const randomWord = (rnd) =>
  rnd() < 0.4
    ? EDGE[(rnd() * EDGE.length) | 0]
    : rnd() < 0.5
      ? (rnd() * 0x40) | 0
      : (rnd() * 0x10000) | 0;

// Read sites of the arithmetic unit in the original (per handler family in read order).
export const IO_PCS = {
  multiply: [0x80f592, 0x80f5a1, 0x80f5a6, 0x80f5b6],
  divide: [0x80f642, 0x80f647, 0x80f652, 0x80f664],
};
export class TracingMemory extends VmMemory {
  constructor(rom, wram) {
    super(rom, wram);
    this.io = [];
    this.inWord = false;
  }
  isIo(address) {
    const bank = address >>> 16,
      offset = address & 0xffff;
    return !(bank & 0x40) && bank !== 0x7e && bank !== 0x7f && offset >= 0x2000 && offset < 0x8000;
  }
  // Word reads of the arithmetic unit count as one observation of width 2.
  read16(address) {
    this.inWord = true;
    try {
      const value = super.read16(address);
      if (this.isIo(address)) this.io.push({ address, width: 2, value });
      return value;
    } finally {
      this.inWord = false;
    }
  }
  read8(address) {
    const value = super.read8(address);
    if (!this.inWord && this.isIo(address)) this.io.push({ address, width: 1, value });
    return value;
  }
}

// Runs the VM side step by step and collects observations with original PCs.
function runVm(scenario, maxSteps) {
  const memory = new TracingMemory(romBytes, scenario.wram.slice());
  const vm = new ScriptInterpreter(memory);
  vm.setContext(scenario.context);
  // The lifted script natives that run (tools/lifted-script-natives.mjs).
  const lifted = new Set();
  if (scenario.natives) {
    vm.natives = new NativeCalls(vm, {
      admitted: nativeOpcodeTargets,
      implementation: nativeTarget,
    });
    const call = vm.natives.call.bind(vm.natives);
    vm.natives.call = () => {
      const target = 0x800000 | vm.mem.read16(NATIVE_POINTERS + vm.x);
      if (LIFTED_SCRIPT_NATIVES.has(target)) lifted.add(target);
      return call();
    };
  }
  const observations = [];
  let steps = 0,
    exit = EXIT_BUDGET,
    fault = null;
  while (steps < maxSteps) {
    const opcode = vm.x;
    memory.io.length = 0;
    try {
      exit = vm.run(1);
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
    if (memory.io.length && !family) throw Error('Unerwarteter I/O-Zugriff');
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
    if (exit !== EXIT_BUDGET) break;
  }
  return { vm, memory, steps, exit, fault, observations, lifted };
}

function seedData(scenario) {
  const data = createRenderData({ writeWindows: [[0x7e0000, 0x7fffff]] });
  data.seed(0x7e0000, scenario.wram);
  for (const [start, length] of [
    [0x80f2b4, 0xc4],
    [0x82da4c, 0x101],
    [0x82e9cc, 0x3aa],
    ...scenario.romRanges,
  ])
    data.seed(
      start,
      romBytes.subarray(
        (((start >>> 16) & 0x1f) << 15) | (start & 0x7fff),
        ((((start >>> 16) & 0x1f) << 15) | (start & 0x7fff)) + length,
      ),
    );
  return data;
}
function runOracle(scenario, handlers, observations, protectedStackBytes) {
  const data = seedData(scenario),
    c = scenario.context;
  const prepare = scenario.natives ? prepareTaskNativeOpcodeSequence : prepareTaskOpcodeSequence;
  const plan = prepare({
    data,
    entry: 0x80f390,
    maxHandlers: handlers,
    maxWork: 3e6,
    maxOutputBytes: 1e6,
    context: Object.freeze({
      e: 0,
      programBank: 0x80,
      pc: 0xf390,
      a: c.a,
      x: c.x,
      y: c.y,
      s: c.s,
      d: c.d,
      bank: c.bank,
      status: c.status,
    }),
    protectedStackBytes,
    ioMode: 'record-requests',
    ioObservations: Object.freeze(observations.slice()),
    statusReturnComposition: true,
    allowCurrentStackReturn: true,
  });
  return plan;
}
const physical = (offset) => renderAddress(offset & 0xffff);
const isRom = (address) => address >= 0x800000 && (address & 0xffff) >= 0x8000;
// ROM banks read at run time are given to the oracle afterwards.
function oracle(scenario, handlers, observations, protectedStackBytes) {
  for (let attempt = 0; ; attempt++) {
    const plan = runOracle(scenario, handlers, observations, protectedStackBytes);
    if (
      plan.handled ||
      plan.reason !== 'render_source_required' ||
      !isRom(plan.address) ||
      attempt === 32
    )
      return plan;
    scenario.romRanges.push([(plan.address & 0xff0000) | 0x8000, 0x8000]);
  }
}

// Compares one run. Result: 'equal', 'skipped' (the oracle declines for proof reasons
// only, such as a stack alias) or a throw on a difference.
export function compareScenario(scenario, maxSteps = 64) {
  const { result, steps } = compareOnce(scenario, maxSteps);
  // A stack alias at the exit: compare the steps before it anyway.
  if (result.startsWith('skipped:task_stack_alias') && steps > 1) {
    const before = compareOnce(scenario, steps - 1).result;
    return before.startsWith('equal') ? 'equal-before-exit' : before;
  }
  return result;
}
function compareOnce(scenario, maxSteps) {
  let run = runVm(scenario, maxSteps);
  // After a fault the VM state is partly changed: compute a clean state again.
  const failed = run.fault;
  if (failed) run = { ...runVm(scenario, run.steps), fault: failed };
  const { vm, steps, exit, fault, observations, lifted: liftedRan } = run;
  // A native not admitted is a fault for the oracle with native composition: compare before it.
  if (scenario.natives && exit === EXIT_NATIVE_CALL) {
    if (steps <= 1) return { result: 'equal-before-native', steps };
    const before = compareOnce(scenario, steps - 1);
    return {
      result: before.result.startsWith('equal') ? 'equal-before-native' : before.result,
      steps: before.steps,
    };
  }
  const guarded = new Set([0x7ffffe, 0x7fffff]);
  const outer = scenario.wram[0x01f2] | (scenario.wram[0x01f3] << 8);
  if (scenario.natives) {
    guarded.add(physical(outer + 1));
    guarded.add(physical(outer + 2));
  }
  if (exit === EXIT_END) {
    const saved = vm.s - 2;
    guarded.add(physical(saved + 1));
    guarded.add(physical(saved + 2));
  }
  if (exit === EXIT_STATUS_RETURN) {
    const s = vm.s - 2;
    guarded.add(physical(s + 1));
    guarded.add(physical(s + 2));
  }
  const protectedStackBytes = [...guarded];
  if (steps > 0) {
    const plan = oracle(scenario, steps, observations, protectedStackBytes);
    if (!plan.handled) {
      // The oracle's proof limits only (stack guard, work budget) are no difference.
      if (
        [
          'task_stack_alias_required',
          'task_outer_return_required',
          'task_work_budget_required',
        ].includes(plan.reason)
      )
        return { result: 'skipped:' + plan.reason, steps };
      throw Error(
        `oracle fails (${plan.reason} ${plan.address?.toString(16)} ${JSON.stringify(Object.fromEntries(Object.entries(plan).filter(([k]) => !['handled', 'reason'].includes(k))))}), VM does not; steps ${steps}, scenario ${scenario.label}`,
      );
    }
    const expected = scenario.wram.slice();
    for (const access of plan.accesses)
      if (access.kind === 'write')
        expected[renderAddress(access.address) - 0x7e0000] = access.value;
    const out = plan.outputContext,
      got = vm.context();
    // A lifted native leaves no carry or overflow (tools/lifted-script-natives.mjs: no
    // opcode reads them before it sets them), so these two status bits are not compared.
    const named =
      scenario.nativeId !== undefined
        ? 0x800000 | vm.mem.read16(NATIVE_POINTERS + 2 * scenario.nativeId)
        : null;
    if (LIFTED_SCRIPT_NATIVES.has(named)) liftedRan.add(named);
    const lifted = liftedRan.size > 0;
    const statusMask = lifted ? ~(CARRY_FLAG | OVERFLOW_FLAG) : ~0;
    for (const key of ['a', 'x', 'y', 's', 'd', 'bank', 'status', 'pc'])
      if (
        key === 'status'
          ? (out[key] & statusMask) !== (got[key] & statusMask)
          : out[key] !== got[key]
      )
        throw Error(
          `register ${key}: oracle ${out[key]}, VM ${got[key]}; scenario ${scenario.label}, steps ${steps}`,
        );
    const wram = run.memory.wram;
    // Nor the dead stack below its outer return word (an inner JSR frame) or its direct
    // page scratch: game state only (docs/STRATEGY.md, 2026-11-14), as in
    // tools/vm-special-natives-differential.mjs.
    const free = (n) =>
      lifted &&
      ((n <= outer && n > outer - 0x40) ||
        [...liftedRan].some((target) => inLiftedScratch(target, n)));
    for (let n = 0; n < expected.length; n++)
      if (expected[n] !== wram[n] && !free(n))
        throw Error(
          `WRAM $${(0x7e0000 + n).toString(16)}: oracle ${expected[n]}, VM ${wram[n]}; scenario ${scenario.label}`,
        );
  }
  if (fault) {
    // The task API stops at a task word that names no task slot or at a cyclic wait chain,
    // where the original reads garbage table words: no game state (docs/STRATEGY.md,
    // 2026-11-14; docs/SCRIPT-VM-LIFT.md, phase 4).
    if (/:(task_slot_required|task_chain_unbounded)$/.test(fault.reason))
      return { result: 'skipped:' + fault.reason, steps };
    const plan = oracle(scenario, steps + 1, observations, protectedStackBytes);
    if (plan.handled)
      throw Error(`VM fault ${fault.reason}, oracle none; scenario ${scenario.label}`);
    return { result: 'equal-fault', steps, fault: fault.reason };
  }
  return { result: vm.natives?.calls ? 'equal-native' : 'equal', steps };
}

// A synthetic program in low WRAM, script bank $80 (arithmetic unit active).
const OPERAND = {
  0x00: 1,
  0x02: 1,
  0x04: 2,
  0x0a: 1,
  0x0c: 1,
  0x0e: 2,
  0x14: 2,
  0x16: 1,
  0x18: 2,
  0x2c: 1,
  0x2e: 2,
  0x34: 1,
  0x36: 2,
  0x44: 2,
  0x46: 2,
  0x48: 2,
  0x4c: 2,
  0x52: 2,
  0x58: 1,
};
export function syntheticScenario(rnd, opcodes, label) {
  const wram = new Uint8Array(0x20000);
  for (let n = 0; n < wram.length; n++) wram[n] = (rnd() * 256) | 0;
  const program = 0x0800,
    frame = 0x0400 + ((rnd() * 0x100) | 0),
    stack = 0x1e00 + ((rnd() * 0x80) | 0);
  const bytes = [];
  for (const opcode of opcodes) {
    bytes.push(opcode);
    for (let n = 0; n < (OPERAND[opcode] ?? 0); n++) {
      // Lokale Indizes klein halten, Zustandsoffsets in Bank $7E frei.
      if (opcode === 0x52) {
        const id = (rnd() * 937) | 0;
        bytes.push(id & 0xff, id >>> 8);
        break;
      }
      bytes.push(
        opcode === 0x02 || opcode === 0x0c || opcode === 0x16 || opcode === 0x2c || opcode === 0x34
          ? (rnd() * 0x20) | 0
          : (rnd() * 256) | 0,
      );
    }
  }
  bytes.push(0x56, 0x56);
  wram.set(bytes, program);
  wram[frame] = program & 0xff;
  wram[frame + 1] = program >>> 8;
  // Stack contents with edge values; return and pointer words in safe areas.
  for (let n = 0; n < 0x40; n += 2) {
    const w = randomWord(rnd);
    wram[stack + 1 + n] = w & 0xff;
    wram[stack + 2 + n] = w >>> 8;
  }
  const safeWord = (address, value) => {
    wram[address] = value & 0xff;
    wram[address + 1] = value >>> 8;
  };
  safeWord(frame + 5, 0x1000 + ((rnd() * 0x400) & ~1)); // local return pointer
  safeWord(0x01f2, 0x1c00 + ((rnd() * 0x100) | 0)); // outer stack (END, natives)
  wram[frame + 2] = 0x80; // Scriptbank im 24-Bit-Zeiger [D]
  safeWord(0x0250, 0x0010);
  safeWord(0x0262, frame); // Tasktabelle: aktueller Task -> D
  const status = ((rnd() * 256) | 0) & ~0x30 & (rnd() < 0.05 ? 0xff : ~0x08);
  return {
    label,
    wram,
    romRanges: [[0x808000, 0x8000]],
    context: {
      a: (rnd() * 0x10000) | 0,
      x: bytes[0],
      y: 1,
      s: stack,
      d: frame,
      bank: 0x80,
      status,
    },
  };
}

// An original script from the ROM, random WRAM.
export function romScenario(rnd, id, label) {
  const info = scriptTable[id],
    cpu = parseInt(info.cpu_address.replace(':', ''), 16);
  const wram = new Uint8Array(0x20000);
  for (let n = 0; n < wram.length; n++) wram[n] = rnd() < 0.5 ? 0 : (rnd() * 256) | 0;
  const frame = 0x0400 + ((rnd() * 0x100) | 0),
    stack = 0x1e00 + ((rnd() * 0x80) | 0),
    pointer = (cpu & 0xffff) + 2;
  wram[frame] = pointer & 0xff;
  wram[frame + 1] = pointer >>> 8;
  for (let n = 0; n < 0x40; n += 2) {
    const w = randomWord(rnd);
    wram[stack + 1 + n] = w & 0xff;
    wram[stack + 2 + n] = w >>> 8;
  }
  wram[frame + 5] = 0x00;
  wram[frame + 6] = 0x10;
  wram[0x01f2] = 0x00;
  wram[0x01f3] = 0x1c;
  wram[frame + 2] = cpu >>> 16;
  wram[0x0250] = 0x10;
  wram[0x0251] = 0;
  wram[0x0262] = frame & 0xff;
  wram[0x0263] = frame >>> 8;
  const length = Math.min(0x8000 - (cpu & 0x7fff), 0x2000);
  return {
    label,
    wram,
    romRanges: [[cpu, length]],
    context: {
      a: 0,
      x: romBytes[(((cpu >>> 16) & 0x1f) << 15) | (pointer & 0x7fff)],
      y: 1,
      s: stack,
      d: frame,
      bank: cpu >>> 16,
      status: 0x01,
    },
  };
}

// A native with random arguments, then a push and END. Admitted targets only.
export const admittedNativeIds = Array.from({ length: 220 }, (_, id) => id).filter((id) =>
  nativeOpcodeTargets.includes(0x800000 | rom.readUInt16LE(0x157b8 + id * 2)),
);
export function nativeScenario(rnd, id, label) {
  const count = rom[0x15a4c + id],
    program = [];
  for (let n = 0; n < count; n++) program.push(0x14);
  const scenario = syntheticScenario(rnd, [...program, 0x58, 0x14, 0x56], label);
  // Replace the push operands with edge values, set the native ID.
  let at = 0x0800;
  for (let n = 0; n < count; n++) {
    const w = randomWord(rnd);
    scenario.wram[at + 1] = w & 0xff;
    scenario.wram[at + 2] = w >>> 8;
    at += 3;
  }
  scenario.wram[at + 1] = id;
  scenario.context.status &= ~0x08;
  scenario.natives = true;
  scenario.nativeId = id;
  return scenario;
}
