// Differenzvergleich: nativer Interpreter (src/vm) gegen die bewiesenen Handler
// (proof/task/opcode-sequence.mjs) als Orakel. Gleiche Startzustände, danach
// Vergleich aller Register, Flags und des gesamten WRAM; Fehler müssen auf
// beiden Seiten auftreten. Werte der Recheneinheit gehen als Beobachtungen an
// das Orakel, das sie selbst nicht berechnet.
import {readFileSync} from 'node:fs';
import {VmMemory, VmFault} from '../src/vm/memory.mjs';
import {ScriptInterpreter, EXIT_BUDGET, EXIT_END, EXIT_STATUS_RETURN, EXIT_NATIVE_CALL} from '../src/vm/interpreter.mjs';
import {NativeCalls} from '../src/vm/native-call.mjs';
import {prepareTaskOpcodeSequence, prepareTaskNativeOpcodeSequence} from '../proof/task/opcode-sequence.mjs';
import {nativeOpcodeTargets} from '../src/task/native-opcode-targets.mjs';
import {nativeTarget} from '../src/task/native-targets.mjs';
import {NATIVE_POINTERS} from '../src/vm/layout.mjs';
import {LIFTED_SCRIPT_NATIVES} from './lifted-script-natives.mjs';
import {createRenderData, renderAddress} from '../src/render/data.mjs';
import {inspectScriptTables} from './scripts.mjs';

const CARRY_FLAG = 0x01, OVERFLOW_FLAG = 0x40;
export const rom = readFileSync(new URL('../Shadowrun (E).smc', import.meta.url));
const romBytes = new Uint8Array(rom.buffer, rom.byteOffset, rom.length);
export const scriptTable = inspectScriptTables(rom).scripts;

export function prng(seed) {
  let t = seed >>> 0;
  return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
const EDGE = [0, 1, 2, 0x7F, 0x80, 0xFF, 0x100, 0x7FFF, 0x8000, 0x8001, 0xFFFE, 0xFFFF];
export const randomWord = rnd => rnd() < 0.4 ? EDGE[(rnd() * EDGE.length) | 0] : rnd() < 0.5 ? (rnd() * 0x40) | 0 : (rnd() * 0x10000) | 0;

// Ablesestellen der Recheneinheit im Original (je Handlerfamilie in Lesereihenfolge).
export const IO_PCS = {multiply: [0x80F592, 0x80F5A1, 0x80F5A6, 0x80F5B6], divide: [0x80F642, 0x80F647, 0x80F652, 0x80F664]};
export class TracingMemory extends VmMemory {
  constructor(rom, wram) { super(rom, wram); this.io = []; this.inWord = false; }
  isIo(address) { const bank = address >>> 16, offset = address & 0xFFFF; return !(bank & 0x40) && bank !== 0x7E && bank !== 0x7F && offset >= 0x2000 && offset < 0x8000; }
  // WORD-Lesezugriffe auf die Recheneinheit zählen als eine Beobachtung der Breite 2.
  read16(address) {
    this.inWord = true;
    try { const value = super.read16(address); if (this.isIo(address)) this.io.push({address, width: 2, value}); return value; }
    finally { this.inWord = false; }
  }
  read8(address) {
    const value = super.read8(address);
    if (!this.inWord && this.isIo(address)) this.io.push({address, width: 1, value});
    return value;
  }
}

// Führt den VM-Teil schrittweise aus und sammelt Beobachtungen mit Original-PCs.
function runVm(scenario, maxSteps) {
  const memory = new TracingMemory(romBytes, scenario.wram.slice());
  const vm = new ScriptInterpreter(memory);
  vm.setContext(scenario.context);
  if (scenario.natives) vm.natives = new NativeCalls(vm, {admitted: nativeOpcodeTargets, implementation: nativeTarget});
  const observations = [];
  let steps = 0, exit = EXIT_BUDGET, fault = null;
  while (steps < maxSteps) {
    const opcode = vm.x;
    memory.io.length = 0;
    try { exit = vm.run(1); } catch (error) { if (!(error instanceof VmFault)) throw error; fault = error; break; }
    const family = opcode >= 0x60 && opcode <= 0x66 ? 'multiply' : opcode >= 0x68 && opcode <= 0x6E ? 'divide' : null;
    if (memory.io.length && !family) throw Error('Unerwarteter I/O-Zugriff');
    memory.io.forEach((o, n) => observations.push(Object.freeze({pc: IO_PCS[family][n], address: o.address, width: o.width, value: o.value})));
    steps++;
    if (exit !== EXIT_BUDGET) break;
  }
  return {vm, memory, steps, exit, fault, observations};
}

function seedData(scenario) {
  const data = createRenderData({writeWindows: [[0x7E0000, 0x7FFFFF]]});
  data.seed(0x7E0000, scenario.wram);
  for (const [start, length] of [[0x80F2B4, 0xC4], [0x82DA4C, 0x101], [0x82E9CC, 0x3AA], ...scenario.romRanges])
    data.seed(start, romBytes.subarray(((start >>> 16) & 0x1F) << 15 | (start & 0x7FFF), (((start >>> 16) & 0x1F) << 15 | (start & 0x7FFF)) + length));
  return data;
}
function runOracle(scenario, handlers, observations, protectedStackBytes) {
  const data = seedData(scenario), c = scenario.context;
  const prepare = scenario.natives ? prepareTaskNativeOpcodeSequence : prepareTaskOpcodeSequence;
  const plan = prepare({data, entry: 0x80F390, maxHandlers: handlers, maxWork: 3e6, maxOutputBytes: 1e6,
    context: Object.freeze({e: 0, programBank: 0x80, pc: 0xF390, a: c.a, x: c.x, y: c.y, s: c.s, d: c.d, bank: c.bank, status: c.status}),
    protectedStackBytes, ioMode: 'record-requests', ioObservations: Object.freeze(observations.slice()),
    statusReturnComposition: true, allowCurrentStackReturn: true});
  return plan;
}
const physical = offset => renderAddress(offset & 0xFFFF);
const isRom = address => address >= 0x800000 && (address & 0xFFFF) >= 0x8000;
// Zur Laufzeit gelesene ROM-Bänke werden dem Orakel nachträglich bereitgestellt.
function oracle(scenario, handlers, observations, protectedStackBytes) {
  for (let attempt = 0; ; attempt++) {
    const plan = runOracle(scenario, handlers, observations, protectedStackBytes);
    if (plan.handled || plan.reason !== 'render_source_required' || !isRom(plan.address) || attempt === 32) return plan;
    scenario.romRanges.push([(plan.address & 0xFF0000) | 0x8000, 0x8000]);
  }
}

// Vergleicht einen Lauf. Ergebnis: 'equal', 'skipped' (Orakel verweigert aus
// reinen Beweisgründen, z. B. Stackalias) oder wirft bei Abweichung.
export function compareScenario(scenario, maxSteps = 64) {
  const {result, steps} = compareOnce(scenario, maxSteps);
  // Stackalias beim Ausstieg: die Schritte davor trotzdem vergleichen.
  if (result.startsWith('skipped:task_stack_alias') && steps > 1) {
    const before = compareOnce(scenario, steps - 1).result;
    return before.startsWith('equal') ? 'equal-before-exit' : before;
  }
  return result;
}
function compareOnce(scenario, maxSteps) {
  let run = runVm(scenario, maxSteps);
  // Nach einem Fehler ist der VM-Zustand teilweise verändert: sauberen Stand neu rechnen.
  const failed = run.fault;
  if (failed) run = {...runVm(scenario, run.steps), fault: failed};
  const {vm, steps, exit, fault, observations} = run;
  // Ein nicht zugelassenes Native ist für das Orakel mit Native-Komposition ein Fehler: davor vergleichen.
  if (scenario.natives && exit === EXIT_NATIVE_CALL) {
    if (steps <= 1) return {result: 'equal-before-native', steps};
    const before = compareOnce(scenario, steps - 1);
    return {result: before.result.startsWith('equal') ? 'equal-before-native' : before.result, steps: before.steps};
  }
  const guarded = new Set([0x7FFFFE, 0x7FFFFF]);
  const outer = scenario.wram[0x01F2] | (scenario.wram[0x01F3] << 8);
  if (scenario.natives) { guarded.add(physical(outer + 1)); guarded.add(physical(outer + 2)); }
  if (exit === EXIT_END) { const saved = vm.s - 2; guarded.add(physical(saved + 1)); guarded.add(physical(saved + 2)); }
  if (exit === EXIT_STATUS_RETURN) { const s = vm.s - 2; guarded.add(physical(s + 1)); guarded.add(physical(s + 2)); }
  const protectedStackBytes = [...guarded];
  if (steps > 0) {
    const plan = oracle(scenario, steps, observations, protectedStackBytes);
    if (!plan.handled) {
      // Reine Beweisgrenzen des Orakels (Stackschutz, Arbeitsbudget) sind keine Abweichung.
      if (['task_stack_alias_required', 'task_outer_return_required', 'task_work_budget_required'].includes(plan.reason)) return {result: 'skipped:' + plan.reason, steps};
      throw Error(`Orakel scheitert (${plan.reason} ${plan.address?.toString(16)} ${JSON.stringify(Object.fromEntries(Object.entries(plan).filter(([k])=>!["handled","reason"].includes(k))))}), VM nicht; Schritte ${steps}, Szenario ${scenario.label}`);
    }
    const expected = scenario.wram.slice();
    for (const access of plan.accesses) if (access.kind === 'write') expected[renderAddress(access.address) - 0x7E0000] = access.value;
    const out = plan.outputContext, got = vm.context();
    // A lifted native leaves no carry or overflow (tools/lifted-script-natives.mjs: no
    // opcode reads them before it sets them), so these two status bits are not compared.
    const lifted = scenario.nativeId !== undefined &&
      LIFTED_SCRIPT_NATIVES.has(0x800000 | vm.mem.read16(NATIVE_POINTERS + 2 * scenario.nativeId));
    const statusMask = lifted ? ~(CARRY_FLAG | OVERFLOW_FLAG) : ~0;
    for (const key of ['a', 'x', 'y', 's', 'd', 'bank', 'status', 'pc'])
      if (key === 'status' ? (out[key] & statusMask) !== (got[key] & statusMask) : out[key] !== got[key]) throw Error(`Register ${key}: Orakel ${out[key]}, VM ${got[key]}; Szenario ${scenario.label}, Schritte ${steps}`);
    const wram = run.memory.wram;
    for (let n = 0; n < expected.length; n++)
      if (expected[n] !== wram[n]) throw Error(`WRAM $${(0x7E0000 + n).toString(16)}: Orakel ${expected[n]}, VM ${wram[n]}; Szenario ${scenario.label}`);
  }
  if (fault) {
    const plan = oracle(scenario, steps + 1, observations, protectedStackBytes);
    if (plan.handled) throw Error(`VM-Fehler ${fault.reason}, Orakel nicht; Szenario ${scenario.label}`);
    return {result: 'equal-fault', steps, fault: fault.reason};
  }
  return {result: vm.natives?.calls ? 'equal-native' : 'equal', steps};
}

// Synthetisches Programm im unteren WRAM, Scriptbank $80 (Recheneinheit aktiv).
const OPERAND = {0x00: 1, 0x02: 1, 0x04: 2, 0x0A: 1, 0x0C: 1, 0x0E: 2, 0x14: 2, 0x16: 1, 0x18: 2, 0x2C: 1, 0x2E: 2, 0x34: 1, 0x36: 2,
  0x44: 2, 0x46: 2, 0x48: 2, 0x4C: 2, 0x52: 2, 0x58: 1};
export function syntheticScenario(rnd, opcodes, label) {
  const wram = new Uint8Array(0x20000);
  for (let n = 0; n < wram.length; n++) wram[n] = (rnd() * 256) | 0;
  const program = 0x0800, frame = 0x0400 + ((rnd() * 0x100) | 0), stack = 0x1E00 + ((rnd() * 0x80) | 0);
  const bytes = [];
  for (const opcode of opcodes) {
    bytes.push(opcode);
    for (let n = 0; n < (OPERAND[opcode] ?? 0); n++) {
      // Lokale Indizes klein halten, Zustandsoffsets in Bank $7E frei.
      if (opcode === 0x52) { const id = (rnd() * 937) | 0; bytes.push(id & 0xFF, id >>> 8); break; }
      bytes.push(opcode === 0x02 || opcode === 0x0C || opcode === 0x16 || opcode === 0x2C || opcode === 0x34 ? (rnd() * 0x20) | 0 : (rnd() * 256) | 0);
    }
  }
  bytes.push(0x56, 0x56);
  wram.set(bytes, program);
  wram[frame] = program & 0xFF; wram[frame + 1] = program >>> 8;
  // Stapelinhalt mit Randwerten; Rücksprung-/Zeigerwörter in sicheren Bereichen.
  for (let n = 0; n < 0x40; n += 2) { const w = randomWord(rnd); wram[stack + 1 + n] = w & 0xFF; wram[stack + 2 + n] = w >>> 8; }
  const safeWord = (address, value) => { wram[address] = value & 0xFF; wram[address + 1] = value >>> 8; };
  safeWord(frame + 5, 0x1000 + ((rnd() * 0x400) & ~1));       // lokaler Rücksprungzeiger
  safeWord(0x01F2, 0x1C00 + ((rnd() * 0x100) | 0));           // äußerer Stack (END, Natives)
  wram[frame + 2] = 0x80;                                      // Scriptbank im 24-Bit-Zeiger [D]
  safeWord(0x0250, 0x0010); safeWord(0x0262, frame);           // Tasktabelle: aktueller Task -> D
  const status = ((rnd() * 256) | 0) & ~0x30 & (rnd() < 0.05 ? 0xFF : ~0x08);
  return {label, wram, romRanges: [[0x808000, 0x8000]],
    context: {a: (rnd() * 0x10000) | 0, x: bytes[0], y: 1, s: stack, d: frame, bank: 0x80, status}};
}

// Originalscript aus der ROM, zufälliger WRAM.
export function romScenario(rnd, id, label) {
  const info = scriptTable[id], cpu = parseInt(info.cpu_address.replace(':', ''), 16);
  const wram = new Uint8Array(0x20000);
  for (let n = 0; n < wram.length; n++) wram[n] = rnd() < 0.5 ? 0 : (rnd() * 256) | 0;
  const frame = 0x0400 + ((rnd() * 0x100) | 0), stack = 0x1E00 + ((rnd() * 0x80) | 0), pointer = (cpu & 0xFFFF) + 2;
  wram[frame] = pointer & 0xFF; wram[frame + 1] = pointer >>> 8;
  for (let n = 0; n < 0x40; n += 2) { const w = randomWord(rnd); wram[stack + 1 + n] = w & 0xFF; wram[stack + 2 + n] = w >>> 8; }
  wram[frame + 5] = 0x00; wram[frame + 6] = 0x10;
  wram[0x01F2] = 0x00; wram[0x01F3] = 0x1C;
  wram[frame + 2] = cpu >>> 16;
  wram[0x0250] = 0x10; wram[0x0251] = 0; wram[0x0262] = frame & 0xFF; wram[0x0263] = frame >>> 8;
  const length = Math.min(0x8000 - (cpu & 0x7FFF), 0x2000);
  return {label, wram, romRanges: [[cpu, length]],
    context: {a: 0, x: romBytes[(((cpu >>> 16) & 0x1F) << 15) | ((pointer) & 0x7FFF)], y: 1, s: stack, d: frame, bank: cpu >>> 16, status: 0x01}};
}

// Ein Native mit zufälligen Argumenten, danach Push und END. Nur zugelassene Ziele.
export const admittedNativeIds = Array.from({length: 220}, (_, id) => id)
  .filter(id => nativeOpcodeTargets.includes(0x800000 | rom.readUInt16LE(0x157B8 + id * 2)));
export function nativeScenario(rnd, id, label) {
  const count = rom[0x15A4C + id], program = [];
  for (let n = 0; n < count; n++) program.push(0x14);
  const scenario = syntheticScenario(rnd, [...program, 0x58, 0x14, 0x56], label);
  // Operanden der Pushes durch Randwerte ersetzen, Native-ID setzen.
  let at = 0x0800;
  for (let n = 0; n < count; n++) { const w = randomWord(rnd); scenario.wram[at + 1] = w & 0xFF; scenario.wram[at + 2] = w >>> 8; at += 3; }
  scenario.wram[at + 1] = id;
  scenario.context.status &= ~0x08;
  scenario.natives = true;
  scenario.nativeId = id;
  return scenario;
}
