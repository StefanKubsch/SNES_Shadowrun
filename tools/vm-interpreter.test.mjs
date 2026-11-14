import test from 'node:test';
import assert from 'node:assert/strict';
import { VmMemory, VmFault, WRAM_SIZE, SRAM_SIZE } from '../src/vm/memory.mjs';
import {
  ScriptInterpreter,
  verifyOpcodeTable,
  EXIT_END,
  EXIT_STATUS_RETURN,
  EXIT_NATIVE_CALL,
  EXIT_SCRIPT_CALL,
  EXIT_BUDGET,
} from '../src/vm/interpreter.mjs';
import { OPCODE_TABLE } from '../src/vm/handlers.mjs';
import {
  compareScenario,
  syntheticScenario,
  romScenario,
  nativeScenario,
  admittedNativeIds,
  prng,
  rom,
  scriptTable,
} from './vm-differential.mjs';
import { NativeCalls } from '../src/vm/native-call.mjs';
import { nativeOpcodeTargets } from '../src/task/native-opcode-targets.mjs';
import { nativeTarget } from '../src/task/native-targets.mjs';

const romBytes = () => new Uint8Array(rom);
const exits = [0x52, 0x54, 0x56, 0x58, 0x90, 0x98, 0xa0, 0xa8];
const status = OPCODE_TABLE.filter(([, target]) => target === 0xf927).map(([op]) => op);
const plain = OPCODE_TABLE.map(([op]) => op).filter(
  (op) =>
    !exits.includes(op) && !status.includes(op) && ![0x44, 0x46, 0x48, 0x4c, 0x50].includes(op),
);
const tally = (results) => results.reduce((t, r) => ((t[r] = (t[r] ?? 0) + 1), t), {});

test('the ROM jump table equals the modelled handler targets exactly', () => {
  verifyOpcodeTable(new VmMemory(romBytes()));
  const changed = romBytes();
  changed[0x72b4 + 0x5c] ^= 1;
  assert.throws(
    () => new ScriptInterpreter(new VmMemory(changed)),
    (error) => error instanceof VmFault && error.reason === 'opcode_table_mismatch',
  );
  assert.equal(new Set(OPCODE_TABLE.map(([op]) => op)).size, 0x62);
});

test('every arithmetic, stack and comparison opcode equals the proven handler at edge values', () => {
  const rnd = prng(11),
    results = [];
  for (const op of plain)
    for (let k = 0; k < 4; k++)
      results.push(
        compareScenario(
          syntheticScenario(rnd, [0x14, 0x14, 0x14, op, 0x14, op], `op${op.toString(16)}/${k}`),
          8,
        ),
      );
  assert.deepEqual(
    Object.keys(tally(results)).filter((r) => !r.startsWith('equal')),
    [],
  );
});

test('random programs with jumps, local calls and all exits equal the oracle', () => {
  const rnd = prng(23),
    ops = OPCODE_TABLE.map(([op]) => op),
    results = [];
  for (let k = 0; k < 200; k++)
    results.push(
      compareScenario(
        syntheticScenario(
          rnd,
          Array.from({ length: 12 }, () => ops[(rnd() * ops.length) | 0]),
          `rand${k}`,
        ),
        24,
      ),
    );
  const t = tally(results);
  assert.deepEqual(
    Object.keys(t).filter((r) => !r.startsWith('equal')),
    [],
  );
  assert.ok(t.equal >= 50 && t['equal-fault'] > 0, JSON.stringify(t));
});

test('original ROM scripts run identically to the oracle (every fourth script)', () => {
  const rnd = prng(37),
    results = [];
  for (let id = 0; id < scriptTable.length; id += 4)
    results.push(compareScenario(romScenario(rnd, id, `rom${id}`), 64));
  assert.deepEqual(tally(results), { equal: results.length });
});

test('every exit is reported with its exit code, ID and next address', () => {
  const run = (program, budget = 16) => {
    const rnd = prng(5),
      scenario = syntheticScenario(rnd, program, 'exit');
    scenario.context.status = 0;
    const vm = new ScriptInterpreter(new VmMemory(romBytes(), scenario.wram));
    vm.setContext(scenario.context);
    return { vm, exit: vm.run(budget) };
  };
  let r = run([0x14, 0x56]);
  assert.equal(r.exit, EXIT_END);
  assert.equal(r.vm.d, 0);
  r = run([0x06]);
  assert.equal(r.exit, EXIT_STATUS_RETURN);
  r = run([0x58]);
  assert.equal(r.exit, EXIT_NATIVE_CALL);
  assert.equal(r.vm.pc, 0xf4f6);
  r = run([0x52]);
  assert.equal(r.exit, EXIT_SCRIPT_CALL);
  assert.equal(r.vm.pc, 0xf488);
  assert.ok(r.vm.exitId < 937);
  r = run([0xba, 0xbc, 0xba, 0xbc], 2);
  assert.equal(r.exit, EXIT_BUDGET);
  assert.equal(r.vm.opcodesRun, 2);
});

test('faults stop on both sides: decimal mode, endless original loop, unknown opcode', () => {
  const rnd = prng(9);
  const decimal = syntheticScenario(rnd, [0x14, 0x14, 0x5c], 'decimal');
  decimal.context.status = 0x08;
  assert.equal(compareScenario(decimal, 4), 'equal-fault');
  const vm = new ScriptInterpreter(new VmMemory(romBytes(), decimal.wram));
  vm.setContext(decimal.context);
  vm.run(2);
  assert.throws(
    () => vm.run(1),
    (error) => error.reason === 'decimal_mode',
  );
  // Remainder with divisor 0: the original doubles forever; the VM reports it instead of hanging.
  const zero = syntheticScenario(rnd, [0x14, 0x14, 0x70], 'remainder-zero');
  const z = new ScriptInterpreter(new VmMemory(romBytes(), zero.wram));
  z.setContext(zero.context);
  z.run(2);
  z.poke16(1, 0);
  z.poke16(3, 5);
  assert.throws(
    () => z.run(1),
    (error) => error.reason === 'original_endless_loop',
  );
  const odd = new ScriptInterpreter(new VmMemory(romBytes()));
  odd.setContext({ ...decimal.context, x: 0x13, status: 0 });
  assert.throws(
    () => odd.run(1),
    (error) => error.reason === 'opcode_unknown',
  );
});

test('the arithmetic unit follows the hardware: 8x8 product, 16/8 division, division by 0', () => {
  const m = new VmMemory(romBytes());
  m.write8(0x804202, 0xff);
  m.write8(0x804203, 0xff);
  assert.equal(m.read16(0x804216), 0xfe01);
  m.write16(0x804204, 0xffff);
  m.write8(0x804206, 7);
  assert.equal(m.read16(0x804214), 9362);
  assert.equal(m.read16(0x804216), 1);
  m.write16(0x804204, 1234);
  m.write8(0x804206, 0);
  assert.equal(m.read16(0x804214), 0xffff);
  assert.equal(m.read16(0x804216), 1234);
  assert.throws(
    () => m.read8(0x804218),
    (error) => error.reason === 'unmapped_read',
  );
  assert.throws(
    () => m.write8(0x804218, 1),
    (error) => error.reason === 'unmapped_write',
  );
  assert.equal(m.read8(0x7e0005), m.read8(0x000005));
});

test('writes to the ROM have no effect, are counted and are logged in diagnostic mode', () => {
  const m = new VmMemory(romBytes()),
    before = m.read16(0x8097ae);
  m.write16(0x8097ae, before ^ 0xffff);
  assert.equal(m.read16(0x8097ae), before);
  assert.equal(m.romWrites, 2);
  m.romWriteLog = [];
  m.write8(0x9f8000, 1);
  assert.deepEqual(m.romWriteLog, [0x9f8000]);
  assert.equal(m.romWrites, 3);
  // Above the 32 LoROM banks, in banks with bit 6 and in bank $00 (only stack/DP overflows) it stays a fault.
  for (const address of [0xa08000, 0x408000, 0x008000])
    assert.throws(
      () => m.write8(address, 1),
      (error) => error.reason === 'unmapped_write',
    );
});

test('SRAM only with given contents: 8 KiB in $70-$7D/$F0-$FD below $8000, mirrored', () => {
  const m = new VmMemory(romBytes());
  assert.throws(
    () => m.read8(0x701ffd),
    (error) => error.reason === 'unmapped_read',
  );
  assert.throws(
    () => new VmMemory(romBytes(), new Uint8Array(WRAM_SIZE), new Uint8Array(16)),
    (error) => error.reason === 'sram_size_required',
  );
  const sram = new Uint8Array(SRAM_SIZE),
    s = new VmMemory(romBytes(), new Uint8Array(WRAM_SIZE), sram);
  s.write16(0x701ffd, 0x1234);
  assert.equal(sram[0x1ffd], 0x34);
  assert.equal(sram[0x1ffe], 0x12);
  assert.equal(s.read16(0x703ffd), 0x1234);
  assert.equal(s.read16(0xfd1ffd), 0x1234);
  assert.throws(
    () => s.read8(0x708000),
    (error) => error.reason === 'unmapped_read',
  );
});

test('the coverage report is current and names only special targets proven in the modules', async () => {
  const { readFile } = await import('node:fs/promises');
  const { analyzeCoverage, specialNativeTargets } = await import('./analyze-vm-coverage.mjs');
  const { taskModulePath } = await import('./task-native-catalog.mjs');
  for (const [module, targets] of specialNativeTargets) {
    const source = await readFile(
      new URL(`../${taskModulePath(module.replace(/.mjs$/, ''))}`, import.meta.url),
      'utf8',
    );
    for (const target of targets)
      assert.match(
        source,
        new RegExp('0x' + target.toString(16), 'i'),
        `${module} ${target.toString(16)}`,
      );
  }
  const report = JSON.parse(
    await readFile(new URL('../analysis/vm-coverage.json', import.meta.url), 'utf8'),
  );
  const fresh = analyzeCoverage(rom);
  assert.deepEqual({ ...report, rom_sha256: undefined }, { ...fresh, rom_sha256: undefined });
  assert.equal(report.scripts, 937);
  assert.deepEqual(report.undecodable, []);
  assert.ok(
    report.eligible_scripts > 0 && report.missing_natives.every((m) => m.unlocks_alone >= 0),
  );
});

test('every admitted native runs through the bridge, its proven module and the resumption identically to the oracle', () => {
  // An own random sequence per ID: newly admitted natives do not shift the scenarios of the others.
  const results = [];
  for (const id of admittedNativeIds) {
    const rnd = prng(43 * 256 + id);
    for (let k = 0; k < 2; k++)
      results.push(compareScenario(nativeScenario(rnd, id, `nat${id.toString(16)}/${k}`), 16));
  }
  const t = tally(results);
  // The task API stops at task words that name no slot, where the original reads garbage
  // table words (docs/SCRIPT-VM-LIFT.md, phase 4): no game state.
  const skipped = (r) => /^skipped:native_boundary:task_(slot_required|chain_unbounded)$/.test(r);
  assert.deepEqual(
    Object.keys(t).filter((r) => !r.startsWith('equal') && !skipped(r)),
    [],
  );
  assert.ok(t['equal-native'] >= admittedNativeIds.length, JSON.stringify(t));
});

test('original scripts with bound natives run on identically (every eighth script)', () => {
  const rnd = prng(47),
    results = [];
  for (let id = 0; id < scriptTable.length; id += 8) {
    const scenario = romScenario(rnd, id, `romnat${id}`);
    scenario.natives = true;
    results.push(compareScenario(scenario, 200));
  }
  const t = tally(results);
  // The task API stops at task words that name no slot, where the original reads garbage
  // table words (docs/SCRIPT-VM-LIFT.md, phase 4): no game state.
  const skipped = (r) => /^skipped:native_boundary:task_(slot_required|chain_unbounded)$/.test(r);
  assert.deepEqual(
    Object.keys(t).filter((r) => !r.startsWith('equal') && !skipped(r)),
    [],
  );
  assert.ok(t['equal-native'] > 0, JSON.stringify(t));
});

test('natives not admitted end at the exit; module faults become VmFault', () => {
  const rnd = prng(53),
    unadmitted = Array.from({ length: 220 }, (_, id) => id).find(
      (id) => !admittedNativeIds.includes(id),
    );
  const scenario = nativeScenario(rnd, admittedNativeIds[0], 'gate');
  scenario.wram[0x0800 + 3 * rom[0x15a4c + admittedNativeIds[0]] + 1] = unadmitted;
  const vm = new ScriptInterpreter(new VmMemory(romBytes(), scenario.wram));
  vm.setContext(scenario.context);
  vm.natives = new NativeCalls(vm, { admitted: nativeOpcodeTargets, implementation: nativeTarget });
  assert.equal(vm.run(64), EXIT_NATIVE_CALL);
  assert.equal(vm.exitId, unadmitted);
  assert.equal(vm.natives.calls, 0);
  const failing = new ScriptInterpreter(
    new VmMemory(romBytes(), nativeScenario(prng(1), admittedNativeIds[0], 'boundary').wram),
  );
  failing.setContext(nativeScenario(prng(1), admittedNativeIds[0], 'boundary').context);
  failing.natives = new NativeCalls(failing, {
    admitted: nativeOpcodeTargets,
    implementation: () => () => {
      throw { taskBoundary: true, reason: 'probe' };
    },
  });
  assert.throws(
    () => failing.run(64),
    (error) => error instanceof VmFault && error.reason === 'native_boundary:probe',
  );
  const looping = new ScriptInterpreter(
    new VmMemory(romBytes(), nativeScenario(prng(1), admittedNativeIds[0], 'loop').wram),
  );
  looping.setContext(nativeScenario(prng(1), admittedNativeIds[0], 'loop').context);
  looping.natives = new NativeCalls(looping, {
    admitted: nativeOpcodeTargets,
    implementation: () => (a) => {
      for (;;) a.read(0x7e0000);
    },
  });
  assert.throws(
    () => looping.run(64),
    (error) => error instanceof VmFault && error.reason === 'native_access_limit',
  );
});
