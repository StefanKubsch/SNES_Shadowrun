import test from 'node:test';
import assert from 'node:assert/strict';
import {VmMemory, VmFault, WRAM_SIZE, SRAM_SIZE} from '../src/vm/memory.mjs';
import {ScriptInterpreter, verifyOpcodeTable, EXIT_END, EXIT_STATUS_RETURN, EXIT_NATIVE_CALL, EXIT_SCRIPT_CALL, EXIT_BUDGET} from '../src/vm/interpreter.mjs';
import {OPCODE_TABLE} from '../src/vm/handlers.mjs';
import {compareScenario, syntheticScenario, romScenario, nativeScenario, admittedNativeIds, prng, rom, scriptTable} from './vm-differential.mjs';
import {NativeCalls} from '../src/vm/native-call.mjs';
import {nativeOpcodeTargets} from '../src/task/native-opcode-targets.mjs';
import {nativeTarget} from '../src/task/native-targets.mjs';

const romBytes = () => new Uint8Array(rom);
const exits = [0x52, 0x54, 0x56, 0x58, 0x90, 0x98, 0xA0, 0xA8];
const status = OPCODE_TABLE.filter(([, target]) => target === 0xF927).map(([op]) => op);
const plain = OPCODE_TABLE.map(([op]) => op).filter(op => !exits.includes(op) && !status.includes(op) && ![0x44, 0x46, 0x48, 0x4C, 0x50].includes(op));
const tally = results => results.reduce((t, r) => (t[r] = (t[r] ?? 0) + 1, t), {});

test('Sprungtabelle der ROM entspricht genau den nachgebildeten Handlerzielen', () => {
  verifyOpcodeTable(new VmMemory(romBytes()));
  const changed = romBytes(); changed[0x72B4 + 0x5C] ^= 1;
  assert.throws(() => new ScriptInterpreter(new VmMemory(changed)), error => error instanceof VmFault && error.reason === 'opcode_table_mismatch');
  assert.equal(new Set(OPCODE_TABLE.map(([op]) => op)).size, 0x62);
});

test('Jeder Rechen-, Stapel- und Vergleichsopcode gleicht dem bewiesenen Handler mit Randwerten', () => {
  const rnd = prng(11), results = [];
  for (const op of plain) for (let k = 0; k < 4; k++)
    results.push(compareScenario(syntheticScenario(rnd, [0x14, 0x14, 0x14, op, 0x14, op], `op${op.toString(16)}/${k}`), 8));
  assert.deepEqual(Object.keys(tally(results)).filter(r => !r.startsWith('equal')), []);
});

test('Zufallsprogramme mit Sprüngen, lokalen Aufrufen und allen Ausstiegen gleichen dem Orakel', () => {
  const rnd = prng(23), ops = OPCODE_TABLE.map(([op]) => op), results = [];
  for (let k = 0; k < 200; k++)
    results.push(compareScenario(syntheticScenario(rnd, Array.from({length: 12}, () => ops[(rnd() * ops.length) | 0]), `rand${k}`), 24));
  const t = tally(results);
  assert.deepEqual(Object.keys(t).filter(r => !r.startsWith('equal')), []);
  assert.ok(t.equal >= 50 && t['equal-fault'] > 0, JSON.stringify(t));
});

test('Originalscripts aus der ROM laufen identisch zum Orakel (jedes vierte Script)', () => {
  const rnd = prng(37), results = [];
  for (let id = 0; id < scriptTable.length; id += 4) results.push(compareScenario(romScenario(rnd, id, `rom${id}`), 64));
  assert.deepEqual(tally(results), {equal: results.length});
});

test('Jeder Ausstieg wird mit Exitcode, ID und Folgeadresse gemeldet', () => {
  const run = (program, budget = 16) => {
    const rnd = prng(5), scenario = syntheticScenario(rnd, program, 'exit');
    scenario.context.status = 0;
    const vm = new ScriptInterpreter(new VmMemory(romBytes(), scenario.wram)); vm.setContext(scenario.context);
    return {vm, exit: vm.run(budget)};
  };
  let r = run([0x14, 0x56]); assert.equal(r.exit, EXIT_END); assert.equal(r.vm.d, 0);
  r = run([0x06]); assert.equal(r.exit, EXIT_STATUS_RETURN);
  r = run([0x58]); assert.equal(r.exit, EXIT_NATIVE_CALL); assert.equal(r.vm.pc, 0xF4F6);
  r = run([0x52]); assert.equal(r.exit, EXIT_SCRIPT_CALL); assert.equal(r.vm.pc, 0xF488); assert.ok(r.vm.exitId < 937);
  r = run([0xBA, 0xBC, 0xBA, 0xBC], 2); assert.equal(r.exit, EXIT_BUDGET); assert.equal(r.vm.opcodesRun, 2);
});

test('Fehler stoppen auf beiden Seiten: Dezimalmodus, endlose Originalschleife, unbekannter Opcode', () => {
  const rnd = prng(9);
  const decimal = syntheticScenario(rnd, [0x14, 0x14, 0x5C], 'decimal'); decimal.context.status = 0x08;
  assert.equal(compareScenario(decimal, 4), 'equal-fault');
  const vm = new ScriptInterpreter(new VmMemory(romBytes(), decimal.wram)); vm.setContext(decimal.context);
  vm.run(2); assert.throws(() => vm.run(1), error => error.reason === 'decimal_mode');
  // Rest mit Divisor 0: das Original verdoppelt ewig; VM meldet es, statt zu hängen.
  const zero = syntheticScenario(rnd, [0x14, 0x14, 0x70], 'remainder-zero');
  const z = new ScriptInterpreter(new VmMemory(romBytes(), zero.wram)); z.setContext(zero.context);
  z.run(2); z.poke16(1, 0); z.poke16(3, 5);
  assert.throws(() => z.run(1), error => error.reason === 'original_endless_loop');
  const odd = new ScriptInterpreter(new VmMemory(romBytes())); odd.setContext({...decimal.context, x: 0x13, status: 0});
  assert.throws(() => odd.run(1), error => error.reason === 'opcode_unknown');
});

test('Recheneinheit folgt der Hardware: 8x8-Produkt, 16/8-Division, Division durch 0', () => {
  const m = new VmMemory(romBytes());
  m.write8(0x804202, 0xFF); m.write8(0x804203, 0xFF); assert.equal(m.read16(0x804216), 0xFE01);
  m.write16(0x804204, 0xFFFF); m.write8(0x804206, 7); assert.equal(m.read16(0x804214), 9362); assert.equal(m.read16(0x804216), 1);
  m.write16(0x804204, 1234); m.write8(0x804206, 0); assert.equal(m.read16(0x804214), 0xFFFF); assert.equal(m.read16(0x804216), 1234);
  assert.throws(() => m.read8(0x804218), error => error.reason === 'unmapped_read');
  assert.throws(() => m.write8(0x804218, 1), error => error.reason === 'unmapped_write');
  assert.equal(m.read8(0x7E0005), m.read8(0x000005));
});

test('Schreibzugriffe auf die ROM sind wirkungslos, gezählt und im Diagnosemodus protokolliert', () => {
  const m = new VmMemory(romBytes()), before = m.read16(0x8097AE);
  m.write16(0x8097AE, before ^ 0xFFFF); assert.equal(m.read16(0x8097AE), before); assert.equal(m.romWrites, 2);
  m.romWriteLog = []; m.write8(0x9F8000, 1); assert.deepEqual(m.romWriteLog, [0x9F8000]); assert.equal(m.romWrites, 3);
  // Oberhalb der 32 LoROM-Bänke, in Bänken mit Bit 6 und in Bank $00 (nur Überläufe von Stapel/DP) bleibt es ein Fehler.
  for (const address of [0xA08000, 0x408000, 0x008000]) assert.throws(() => m.write8(address, 1), error => error.reason === 'unmapped_write');
});

test('SRAM nur mit übergebenem Inhalt: 8 KiB in $70-$7D/$F0-$FD unterhalb $8000, gespiegelt', () => {
  const m = new VmMemory(romBytes());
  assert.throws(() => m.read8(0x701FFD), error => error.reason === 'unmapped_read');
  assert.throws(() => new VmMemory(romBytes(), new Uint8Array(WRAM_SIZE), new Uint8Array(16)), error => error.reason === 'sram_size_required');
  const sram = new Uint8Array(SRAM_SIZE), s = new VmMemory(romBytes(), new Uint8Array(WRAM_SIZE), sram);
  s.write16(0x701FFD, 0x1234); assert.equal(sram[0x1FFD], 0x34); assert.equal(sram[0x1FFE], 0x12);
  assert.equal(s.read16(0x703FFD), 0x1234); assert.equal(s.read16(0xFD1FFD), 0x1234);
  assert.throws(() => s.read8(0x708000), error => error.reason === 'unmapped_read');
});

test('Abdeckungsbericht ist aktuell und nennt nur in den Modulen belegte Spezialziele', async () => {
  const {readFile} = await import('node:fs/promises');
  const {analyzeCoverage, specialNativeTargets} = await import('./analyze-vm-coverage.mjs');
  const {taskModulePath} = await import('./task-native-catalog.mjs');
  for (const [module, targets] of specialNativeTargets) {
    const source = await readFile(new URL(`../${taskModulePath(module.replace(/.mjs$/, ''))}`, import.meta.url), 'utf8');
    for (const target of targets) assert.match(source, new RegExp('0x' + target.toString(16), 'i'), `${module} ${target.toString(16)}`);
  }
  const report = JSON.parse(await readFile(new URL('../analysis/vm-coverage.json', import.meta.url), 'utf8'));
  const fresh = analyzeCoverage(rom);
  assert.deepEqual({...report, rom_sha256: undefined}, {...fresh, rom_sha256: undefined});
  assert.equal(report.scripts, 937); assert.deepEqual(report.undecodable, []);
  assert.ok(report.eligible_scripts > 0 && report.missing_natives.every(m => m.unlocks_alone >= 0));
});

test('Jedes zugelassene Native läuft über Brücke, bewiesenes Modul und Wiederaufnahme identisch zum Orakel', () => {
  // Eigene Zufallsfolge je ID: neu zugelassene Natives verschieben die Szenarien der übrigen nicht.
  const results = [];
  for (const id of admittedNativeIds) {
    const rnd = prng(43 * 256 + id);
    for (let k = 0; k < 2; k++) results.push(compareScenario(nativeScenario(rnd, id, `nat${id.toString(16)}/${k}`), 16));
  }
  const t = tally(results);
  assert.deepEqual(Object.keys(t).filter(r => !r.startsWith('equal')), []);
  assert.ok(t['equal-native'] >= admittedNativeIds.length, JSON.stringify(t));
});

test('Originalscripts mit gebundenen Natives laufen identisch weiter (jedes achte Script)', () => {
  const rnd = prng(47), results = [];
  for (let id = 0; id < scriptTable.length; id += 8) {
    const scenario = romScenario(rnd, id, `romnat${id}`); scenario.natives = true;
    results.push(compareScenario(scenario, 200));
  }
  const t = tally(results);
  assert.deepEqual(Object.keys(t).filter(r => !r.startsWith('equal')), []);
  assert.ok(t['equal-native'] > 0, JSON.stringify(t));
});

test('Nicht zugelassene Natives enden am Ausstieg; Fehler der Module werden zu VmFault', () => {
  const rnd = prng(53), unadmitted = Array.from({length: 220}, (_, id) => id).find(id => !admittedNativeIds.includes(id));
  const scenario = nativeScenario(rnd, admittedNativeIds[0], 'gate');
  scenario.wram[0x0800 + 3 * rom[0x15A4C + admittedNativeIds[0]] + 1] = unadmitted;
  const vm = new ScriptInterpreter(new VmMemory(romBytes(), scenario.wram)); vm.setContext(scenario.context);
  vm.natives = new NativeCalls(vm, {admitted: nativeOpcodeTargets, implementation: nativeTarget});
  assert.equal(vm.run(64), EXIT_NATIVE_CALL); assert.equal(vm.exitId, unadmitted); assert.equal(vm.natives.calls, 0);
  const failing = new ScriptInterpreter(new VmMemory(romBytes(), nativeScenario(prng(1), admittedNativeIds[0], 'boundary').wram));
  failing.setContext(nativeScenario(prng(1), admittedNativeIds[0], 'boundary').context);
  failing.natives = new NativeCalls(failing, {admitted: nativeOpcodeTargets, implementation: () => (a) => { throw {taskBoundary: true, reason: 'probe'}; }});
  assert.throws(() => failing.run(64), error => error instanceof VmFault && error.reason === 'native_boundary:probe');
  const looping = new ScriptInterpreter(new VmMemory(romBytes(), nativeScenario(prng(1), admittedNativeIds[0], 'loop').wram));
  looping.setContext(nativeScenario(prng(1), admittedNativeIds[0], 'loop').context);
  looping.natives = new NativeCalls(looping, {admitted: nativeOpcodeTargets, implementation: () => (a) => { for (;;) a.read(0x7E0000); }});
  assert.throws(() => looping.run(64), error => error instanceof VmFault && error.reason === 'native_access_limit');
});
