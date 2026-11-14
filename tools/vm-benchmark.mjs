// Leistungsmessung des nativen Interpreters: Opcodes pro Sekunde und Heapzuwachs.
// Aufruf: node --expose-gc tools/vm-benchmark.mjs [opcodes]
import {readFileSync} from 'node:fs';
import {VmMemory} from '../src/vm/memory.mjs';
import {ScriptInterpreter, EXIT_BUDGET} from '../src/vm/interpreter.mjs';
import {NativeCalls} from '../src/vm/native-call.mjs';
import {TaskScheduler, STOP_RETURNED} from '../src/vm/scheduler.mjs';
import {nativeOpcodeTargets} from '../src/task/native-opcode-targets.mjs';
import {nativeTarget} from '../src/task/native-targets.mjs';

const loadRom = () => new Uint8Array(readFileSync(new URL('../Shadowrun (E).smc', import.meta.url)));

export function benchmark(opcodes = 20_000_000) {
  const memory = new VmMemory(loadRom()), vm = new ScriptInterpreter(memory);
  // Endlosschleife ab $0800: Local 0 laden, 1 addieren, speichern, mit 7 multiplizieren,
  // Vergleich, verwerfen, zurückspringen.
  const program = [0x16, 0x00, 0x14, 0x01, 0x00, 0x5C, 0x34, 0x00, 0x16, 0x00, 0x14, 0x07, 0x00, 0x60,
    0x00, 0x09, 0x8A, 0xBC, 0x48, 0x00, 0x00];
  memory.wram.set(program, 0x0800);
  memory.write16Bank0(0x0400, 0x0800);
  vm.setContext({a: 0, x: program[0], y: 1, s: 0x1EFF, d: 0x0400, bank: 0x80, status: 0});
  globalThis.gc?.();
  const heapBefore = process.memoryUsage().heapUsed, start = process.hrtime.bigint();
  if (vm.run(opcodes) !== EXIT_BUDGET) throw Error('Benchmarkschleife verlassen');
  const seconds = Number(process.hrtime.bigint() - start) / 1e9;
  globalThis.gc?.();
  return {opcodes, seconds: +seconds.toFixed(3), opcodesPerSecond: Math.round(opcodes / seconds),
    heapGrowthBytes: process.memoryUsage().heapUsed - heapBefore, gcMeasured: typeof globalThis.gc === 'function',
    wramBytes: memory.wram.byteLength, stackPointer: vm.s};
}

// Scheduler: acht Originalscripts, die dauerhaft warten und fortsetzen, in
// Runden über $C1E3 (Bereitschaft, Fortsetzung $F509, Opcodes, Natives, Nachlauf).
export const SCHEDULER_SCRIPTS = Object.freeze([76, 88, 89, 137, 205, 262, 279, 327]);
export function schedulerBenchmark(rounds = 200_000) {
  const memory = new VmMemory(loadRom()), vm = new ScriptInterpreter(memory);
  vm.natives = new NativeCalls(vm, {admitted: nativeOpcodeTargets, implementation: nativeTarget});
  const scheduler = new TaskScheduler(vm);
  vm.dbr = 0x80; vm.p = 0;
  const call = entry => { vm.s = 0x1FF0; vm.push16(0x1233); return scheduler.call(entry); };
  call(0xC1A6);
  for (const id of SCHEDULER_SCRIPTS) { vm.x = id; call(0xC34A); }
  for (let n = 0; n < 100; n++) call(0xC1E3); // Anlauf
  globalThis.gc?.();
  let opcodes = 0;
  const heapBefore = process.memoryUsage().heapUsed, start = process.hrtime.bigint();
  for (let n = 0; n < rounds; n++) {
    if (call(0xC1E3) !== STOP_RETURNED) throw Error('Schedulerrunde angehalten');
    opcodes += scheduler.opcodesRun;
  }
  const seconds = Number(process.hrtime.bigint() - start) / 1e9;
  globalThis.gc?.();
  return {rounds, tasks: SCHEDULER_SCRIPTS.length, opcodes, seconds: +seconds.toFixed(3),
    roundsPerSecond: Math.round(rounds / seconds), nativeCalls: vm.natives.calls,
    heapGrowthBytes: process.memoryUsage().heapUsed - heapBefore, gcMeasured: typeof globalThis.gc === 'function'};
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) console.log(JSON.stringify({interpreter: benchmark(Number(process.argv[2] ?? 20_000_000)), scheduler: schedulerBenchmark()}, null, 2));
