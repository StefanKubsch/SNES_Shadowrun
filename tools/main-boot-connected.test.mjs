import { withFrontendReference } from '../proof/frontend-reference/frontend.mjs';
import { freeStack } from './mesen-f390-oracle.mjs';
import { LIFTED_SCRIPT_NATIVES, inLiftedScratch } from './lifted-script-natives.mjs';
// Lifted script natives (src/task/native-script-leaves.mjs) leave the free stack bytes
// below S and their direct page scratch unwritten (tools/lifted-script-natives.mjs:
// the sample loader's after any, the line of sight's after the sight natives).
const liftedRan = new Set();
const usedWram = (wram, s) =>
  wram.map((value, at) =>
    freeStack(at, s) || [...liftedRan].some((target) => inLiftedScratch(target, at)) ? 0 : value,
  );
import test from 'node:test';
import assert from 'node:assert/strict';
import { resetWindows, softwareResetWindows } from './main-reset-source.mjs';
import { inputApuWindows } from './render-task-native-input-apu-source-proof.mjs';
import { startupSpecs } from './main-startup-source.mjs';
import { frontendSpecs } from './main-frontend-source.mjs';
import { mainStartSpecs } from './main-start-source.mjs';
import { decodeWindows, DialogTestMemory, rom } from './task-native-dialog-harness.mjs';
import { originalBootTaskRound } from './main-boot-round-reference.mjs';
import { constructBootNative, constructBootInterval } from './main-boot-native-observations.mjs';
import { BOOT_NATIVE_CONTRACTS } from './main-boot-native-contracts.mjs';
import { nativeOpcodeTargets } from '../src/task/native-opcode-targets.mjs';
import { nativeTarget } from '../src/task/native-targets.mjs';
import { runReference } from './w65c816-reference.mjs';
import { ScriptInterpreter, EXIT_END } from '../src/vm/interpreter.mjs';
import { NativeCalls } from '../src/vm/native-call.mjs';
import { MainLoopDriver } from '../src/vm/main-driver.mjs';
import { TaskScheduler, STOP_BUDGET, STOP_RETURNED, STOP_NATIVE } from '../src/vm/scheduler.mjs';
import { isIoAddress, isArithmeticRegister } from '../src/vm/devices.mjs';
import { ObservedDevices, observationSet } from '../proof/vm/observed-devices.mjs';
import { SRAM_SIZE } from '../src/vm/memory.mjs';
import { MAIN_STARTUP_ROUTINES as MAIN_STARTUP_ROUTINES_TASK } from '../src/task/main-startup.mjs';
import { FRONTEND_ROUTINES } from '../src/task/main-frontend.mjs';
import { MAIN_START_ROUTINES } from '../src/task/main-start.mjs';
import { withGameStartReference } from '../proof/game-reference/game-start.mjs';
import { dialogAccess } from '../src/task/native-dialog-support.mjs';
import { finishInterruptObservations } from '../src/task/main-wait-interrupt.mjs';
const MAIN_STARTUP_ROUTINES = withFrontendReference(MAIN_STARTUP_ROUTINES_TASK);

const map = decodeWindows([
  ...resetWindows,
  ...softwareResetWindows,
  { start: 0x809e2f, hex: inputApuWindows[0].hex.slice(0x15 * 2, 0x17 * 2) },
  ...startupSpecs.flatMap((s) => s.windows),
  ...frontendSpecs.flatMap((s) => s.windows),
  ...mainStartSpecs.flatMap((s) => s.windows),
]);
const freeze = (rows) => Object.freeze(rows.map((o) => Object.freeze({ ...o })));
// The system registers 2100-43FF are the same in every bank 00-3F and 80-BF; lifted
// code addresses them in bank 00, the original through its data bank.
const systemAddress = (address) =>
  (address >>> 16) % 0x80 < 0x40 && (address & 0xffff) >= 0x2100 && (address & 0xffff) < 0x4400
    ? address & 0xffff
    : address;
const expand = (trace) =>
  trace.flatMap((o) =>
    (o.width === 2
      ? [
          { ...o, width: 1, value: o.value & 255 },
          { ...o, width: 1, address: o.address + 1, value: o.value >>> 8 },
        ]
      : [{ ...o, width: 1 }]
    ).map((b) => ({ ...b, address: systemAddress(b.address) })),
  );
const combatCounterPattern = Object.freeze(Array.from({ length: 256 }, (_, i) => i));
// Test input only, like Mesen's glove/aim plan. Read the live cursor and
// BC36's projection of the target, then supply direction bits through NMI.
// No coordinates or target selection are written into the game state.
function seekPad(mem, input) {
  const slot = input.aim;
  const tx = slot
    ? ((0x600 + mem.read16(0xe80 + slot) - mem.read16(0xe28 + slot) - mem.read16(0xcc4) - 16) &
        65535) >>>
      2
    : input.glove[0];
  const ty = slot
    ? ((0xc00 - mem.read16(0xf30 + slot) - mem.read16(0xed8 + slot) - mem.read16(0xcc6) - 72) &
        65535) >>>
      2
    : input.glove[1];
  const dx = tx - (mem.read16(0x1d4) >>> 8),
    dy = ty - (mem.read16(0x1d6) >>> 8);
  const pad =
    (Math.abs(dx) <= 1 ? 0 : dx > 0 ? 0x100 : 0x200) |
    (Math.abs(dy) <= 1 ? 0 : dy > 0 ? 0x400 : 0x800);
  return { pad, settled: pad === 0 };
}
function side(io, interrupts, restart = false) {
  // Supplied test state only: no hardware reset values, elapsed frames or SRAM
  // power-on contents are inferred. Every later helper is the real implementation.
  const mem = new DialogTestMemory(new Uint8Array(0x20000), new Uint8Array(SRAM_SIZE), rom),
    vm = new ScriptInterpreter(mem);
  Object.assign(vm, {
    pc: 0xe382,
    e: 1,
    a: 0x5432,
    x: 0x34,
    y: 0xcd,
    p: 0x7b,
    s: 0x1ff,
    d: 0,
    dbr: 0,
  });
  const sets = (restart ? [0x80e382, 0x8096c3, 0x809e2f, 0x8096c3] : [0x80e382, 0x8096c3]).map(
      (target, i) =>
        observationSet(target, {
          io: io[i],
          interrupts: interrupts[i],
          interruptRoutines: MAIN_STARTUP_ROUTINES,
        }),
    ),
    devices = new ObservedDevices(sets);
  vm.natives = new NativeCalls(vm, {
    devices,
    admitted: nativeOpcodeTargets,
    implementation: nativeTarget,
  });
  const driver = new MainLoopDriver(vm, {
      startupRoutines: MAIN_STARTUP_ROUTINES,
      frontendRoutines: withFrontendReference(FRONTEND_ROUTINES),
      startRoutines: withGameStartReference(MAIN_START_ROUTINES),
    }),
    a = driver.accessor;
  a.trace = [];
  return { mem, vm, devices, driver, a, h: dialogAccess(a), sets };
}
const wordWaits = [0x81acaf, 0x81acbd, 0x81acc3, 0x81acc9];
function appendWait(records, pc, v) {
  const add = (pcs, nmiPc) => records.push(...pcs.map((pc) => ({ pc, nmi: pc === nmiPc })));
  if (pc === 0x81eebb) {
    const enabled = Boolean(v.mem.read8(0x30) & 0x80);
    add(
      enabled
        ? [0x81eebb, 0x81eebc, 0x81eebe, 0x81eec0, 0x81eec9, 0x81eecd, 0x81eed1, 0x81eed3, 0x81eed4]
        : [0x81eebb, 0x81eebc, 0x81eebe, 0x81eec0, 0x81eec2, 0x81eec5, 0x81eec7, 0x81eec8],
      enabled ? 0x81eecd : -1,
    );
    return;
  }
  if (pc === 0x81b0a1) {
    add([0x81b0a1, 0x81b0a5, 0x81b0a9, 0x81b0ab], 0x81b0a5);
    return;
  }
  if ([0x81acb5, 0x81aef4, 0x81aefc].includes(pc)) {
    add([pc, pc + 3], -1);
    return;
  }
  // These short source paths are frozen synthetic observations, including an
  // explicit absence at each remaining instruction. They do not schedule NMIs.
  if (wordWaits.includes(pc)) {
    add([pc, pc + 3, pc + 5], pc);
    return;
  }
  // Portrait transfer / scene tile requests: the original NMI owns 0140
  // and 1562. Observe it at the actual inline poll, then the branch absence.
  if ([0x80901c, 0x80ae0c, 0x80ae5e].includes(pc)) {
    add([pc, pc + 3], pc);
    return;
  }
  records.push({ pc, nmi: pc === 0x81cf4c });
}
function construct(restart) {
  const interrupts = Array.from({ length: restart ? 4 : 2 }, () => []);
  // Restart the identical explicit state at each newly reached observation
  // boundary. Device replies are recorded once per run; only the final frozen
  // chronology is replayed by the two independent outer control flows below.
  for (let attempt = 0; attempt < 1200; attempt++) {
    const io = interrupts.map(() => []),
      v = side(io, interrupts, restart);
    let menuTicks = 0,
      stage = 0;
    // Device reads pass busRead: the original's absolute reads and the lifted code's
    // hardware port (bank 0).
    const read = v.a.busRead;
    v.a.busRead = (address, width, pc, anyBank) => {
      const port = address & 65535;
      if (!isIoAddress(address) || isArithmeticRegister(address, false))
        return read(address, width, pc, anyBank);
      let value;
      if (port === 0x2140)
        value = pc === 0x81efaa ? 0xaa : pc === 0x81f001 ? v.a.ctx.a & 255 : v.mem.read8(0x1ce4);
      else if (port === 0x2141) value = pc === 0x81efed ? 0xca : 0xbb;
      else if (port === 0x2142) value = pc === 0x81e1b6 ? 2 : pc === 0x81e510 ? 3 : 0;
      else if (port === 0x4210) value = 0x80;
      else if (port === 0x4218) {
        // During NMI the genuine hardware frame resides on the interrupted
        // stack, whose saved S is in 1C7A. EEBB has its own saved P byte above it.
        const oldS = (v.mem.read16(0x1c7a) + 4) & 65535,
          caller = v.mem.read16((oldS + 2) & 65535);
        value =
          restart && stage === 1
            ? 0x3030
            : caller === 0xde3c
              ? 0x8000
              : caller === 0xe2aa
                ? menuTicks++ % 2 === 0
                  ? 0x8000
                  : 0
                : 0;
      } else {
        assert.ok(
          [0x4212, 0x2137, 0x213c, 0x213d].includes(port),
          'unexpected device ' + pc.toString(16) + ' ' + address.toString(16),
        );
        value = 0;
      }
      io[stage].push({ pc, address, width, value });
      v.a.trace.push({ kind: 'read', pc, address, width, value });
      return value;
    };
    try {
      assert.equal(v.driver.run(0), STOP_RETURNED);
      stage = 1;
      if (restart) {
        assert.throws(
          () => v.driver.run(0),
          (error) => {
            if (error.reason === 'main_loop_boundary:wait_interrupt_observation_required')
              throw error;
            return error.reason === 'main_loop_boundary:task_reset_source_required';
          },
        );
        stage = 2;
        menuTicks = 0;
        assert.equal(v.driver.run(0), STOP_RETURNED);
        stage = 3;
      }
      assert.equal(v.driver.run(0), STOP_BUDGET);
      return { io, interrupts };
    } catch (error) {
      if (error.reason !== 'main_loop_boundary:wait_interrupt_observation_required') throw error;
      assert.equal(error.details.observationIndex, interrupts[stage].length);
      appendWait(interrupts[stage], error.details.pc, v);
    }
  }
  assert.fail(
    'whole boot observation fixture exceeded its construction bound: ' + interrupts.length,
  );
}

test('connected special contracts retain their original target, argument and return table bytes', () => {
  const mem = new DialogTestMemory(new Uint8Array(0x20000), new Uint8Array(SRAM_SIZE), rom);
  for (const [target, c] of BOOT_NATIVE_CONTRACTS) {
    assert.equal(0x800000 | mem.read16(0x82d7b8 + c.id * 2), target);
    assert.equal(mem.read16(0x82da4c + c.id), c.metadata);
    assert.equal(Boolean(mem.read8(0x82d970 + c.id)), c.result);
  }
  // C0 has no result, although the next native contributes a nonzero high BYTE.
  assert.equal(mem.read16(0x82d970 + 0xc0), 0x0200);
});

test('one VM follows real boot and an observed software restart through the first rounds into live tasks', (t) => {
  for (const restart of [false, true]) {
    const { io, interrupts } = construct(restart),
      n = side(io, interrupts, restart),
      r = side(io, interrupts, restart),
      checkpoints = [];
    const snapshot = (v) => ({
      ctx: v.vm.context(),
      wram: v.mem.wram.slice(),
      sram: v.mem.sram.slice(),
    });
    assert.equal(n.driver.run(0), STOP_RETURNED);
    assert.equal(n.driver.pending, false);
    assert.equal(n.vm.pc, 0x96c3);
    checkpoints[0] = snapshot(n);
    assert.equal(n.mem.read16(0x250), n.mem.read16(0x24c));
    assert.notEqual(n.mem.read16(0x24c), 0xffff);
    if (restart) {
      assert.throws(
        () => n.driver.run(0),
        (error) => error.reason === 'main_loop_boundary:task_reset_source_required',
      );
      assert.equal(n.vm.pc, 0x9e2f);
      assert.equal(n.vm.a, 0x3030);
      assert.ok(n.vm.p & 2);
      checkpoints[1] = snapshot(n);
      assert.equal(n.driver.run(0), STOP_RETURNED);
      checkpoints[2] = snapshot(n);
    }
    assert.equal(n.driver.run(0), STOP_BUDGET);
    assert.equal(n.driver.pending, true);
    assert.equal(n.driver.ownsGame, true);
    const last = restart ? 3 : 1;
    assert.equal(n.devices.index, last + 1);
    assert.equal(n.vm.e, 0);
    assert.equal(n.vm.pc, 0xf390);
    assert.equal(n.vm.opcodesRun, 0);
    assert.equal(n.mem.read16(0x13e), 0xa156);
    assert.equal(n.mem.read16(0x13c), 0x96c2);
    assert.equal(n.driver.ownerReturnS, 0x13f);
    assert.equal(n.a.ioIndex, io[last].length);
    assert.equal(n.driver.roundsCompleted, restart ? 2 : 1);
    const a = r.a;
    a.load();
    a.ctx.e = 1;
    a.io = r.sets[0].io;
    a.devices = r.devices;
    const h = r.h,
      e = {
        values: freeze([]),
        waitIndex: 0,
        waitEvents: [],
        calls: [],
        inputs: freeze([]),
        inputIndex: 0,
        interrupts: r.sets[0].interrupts,
        interruptIndex: 0,
        interruptRoutines: MAIN_STARTUP_ROUTINES,
      };
    const calls = new Map(
      [...MAIN_STARTUP_ROUTINES]
        .filter(([target]) => !map.has(target))
        .map(([target, run]) => [
          target,
          () => {
            // Keep each module's own proven dependency table. The original return
            // word comes from its actual resulting PC, including void-return helpers.
            run(h, e);
            return { rawReturnWord: (a.ctx.pc - 1) & 65535 };
          },
        ]),
    );
    const stop = Symbol('live first task');
    let stage = 0,
      round = 0,
      roundStart = null;
    const next = (index) => {
      stage = index;
      a.io = r.sets[index].io;
      a.ioIndex = 0;
      e.interrupts = r.sets[index].interrupts;
      e.interruptIndex = 0;
    };
    const compareCheckpoint = (index) => {
      const expected = checkpoints[index];
      assert.deepEqual(r.vm.context(), expected.ctx);
      assert.deepEqual(r.mem.wram, expected.wram);
      assert.deepEqual(r.mem.sram, expected.sram);
    };
    calls.set(0x80c1e3, () => {
      assert.equal(a.stackWord(), 0x96c2);
      finishInterruptObservations(e);
      assert.equal(a.ioIndex, io[stage].length);
      if (stage % 2 === 1) roundStart = { ctx: { ...a.ctx }, wram: r.mem.wram.slice() };
      a.store();
      r.vm.e = a.ctx.e;
      const result = new TaskScheduler(r.vm).call(0xc1e3, 0);
      round++;
      if (stage % 2 === 0) {
        assert.equal(result, STOP_RETURNED);
        compareCheckpoint(stage);
        a.load();
        next(stage + 1);
        return { rawReturnWord: 0x96c2 };
      }
      assert.equal(result, STOP_BUDGET);
      throw stop;
    });
    // Own instruction operands and shared native helpers consume the same IO
    // cursor. WORD observations remain one chronological read in both paths.
    const read = r.mem.read8.bind(r.mem);
    let pending = null;
    r.mem.read8 = (address) => {
      if (!isIoAddress(address) || isArithmeticRegister(address, false)) return read(address);
      if (pending) {
        assert.equal(address, pending.address + 1);
        const value = pending.value >>> 8;
        pending = null;
        return value;
      }
      const pc = (a.ctx.programBank << 16) | a.ctx.pc,
        width = a.ctx.status & 0x20 ? 1 : 2,
        o = a.io[a.ioIndex++];
      assert.deepEqual({ pc, address, width }, { pc: o?.pc, address: o?.address, width: o?.width });
      if (width === 2) pending = o;
      return o.value & 255;
    };
    const before = new Map(
      [...map.keys()].map((pc) => [
        pc,
        () => {
          a.ctx.programBank = pc >>> 16;
          a.ctx.pc = pc & 65535;
        },
      ]),
    );
    const original = (entry) => {
      a.accesses = 0;
      return runReference(map, r.mem, a.ctx, {
        entry,
        root: 'RTS',
        calls,
        before,
        io: a.trace,
        limit: 5_000_000,
      });
    };
    if (restart) {
      assert.throws(
        () => original(0x80e382),
        (error) => error.taskBoundary && error.reason === 'task_reset_source_required',
      );
      finishInterruptObservations(e);
      assert.equal(a.ioIndex, io[1].length);
      a.store();
      compareCheckpoint(1);
      next(2);
      // Execute the actual BEQ at the observed frontier, then SEC/XCE and the
      // nonreturning reset. The original TCS discards the interrupted frames.
      assert.throws(
        () => original(0x809e2f),
        (error) => {
          if (error !== stop) throw error;
          return true;
        },
      );
    } else
      assert.throws(
        () => original(0x80e382),
        (error) => {
          if (error !== stop) throw error;
          return true;
        },
      );
    assert.deepEqual(n.vm.context(), r.vm.context());
    assert.deepEqual(n.mem.wram, r.mem.wram);
    assert.deepEqual(n.mem.sram, r.mem.sram);
    assert.deepEqual(expand(n.a.trace), expand(r.a.trace));
    assert.equal(n.mem.read16(0x7e2de2), 3);
    assert.equal(n.h.pointer(0x6e), 0x80c152);
    assert.notEqual(n.mem.read16(0x24c), 0xffff);
    assert.equal(round, restart ? 3 : 2);
    const firstTask = n.vm.context();
    let stopRound = STOP_BUDGET,
      opcodes = 0,
      budgetStops = 0;
    const run = n.vm.run.bind(n.vm);
    n.vm.run = (budget) => {
      const result = run(budget);
      opcodes += n.vm.opcodesRun;
      return result;
    };
    for (let i = 0; i < 1024 && stopRound === STOP_BUDGET; i++) {
      stopRound = n.driver.resume(restart ? 7 : 16);
      if (stopRound === STOP_BUDGET) budgetStops++;
      assert.equal(n.mem.read16(0x13e), 0xa156);
      assert.equal(n.mem.read16(0x13c), 0x96c2);
      assert.equal(n.devices.index, last + 1);
    }
    assert.equal(stopRound, STOP_RETURNED);
    assert.equal(n.driver.pending, false);
    assert.equal(n.driver.ownsGame, true);
    assert.equal(n.driver.roundsCompleted, restart ? 3 : 2);
    assert.equal(n.vm.pc, 0x96c3);
    assert.equal(n.vm.s, 0x13d);
    // Restart only the independent reference at the recorded real C1E3 entry.
    // The native owner continues directly from its preceding budget stop.
    r.mem.wram.set(roundStart.wram);
    Object.assign(a.ctx, roundStart.ctx);
    const stats = originalBootTaskRound(a);
    const { e: referenceE, programBank, ...result } = a.ctx;
    assert.equal(referenceE, 0);
    assert.equal(programBank, 0x80);
    assert.deepEqual(n.vm.context(), result);
    assert.deepEqual(n.mem.wram, r.mem.wram);
    assert.deepEqual(n.mem.sram, r.mem.sram);
    assert.equal(n.mem.read16(0x250), n.mem.read16(0x24c));
    assert.ok(budgetStops > 0);
    assert.equal(stats.opcodes, opcodes);
    assert.equal(stats.natives - stats.waits, n.vm.natives.calls);
    assert.ok(stats.children > 0);
    assert.ok(stats.postruns > 0);
    t.diagnostic(
      JSON.stringify({
        restart,
        io: io.map((rows) => rows.length),
        interrupts: interrupts.map((rows) => rows.length),
        firstTask,
        stats,
        budgetStops,
      }),
    );
    if (!restart) {
      const totals = {
        resumes: 0,
        waits: 0,
        opcodes: stats.opcodes,
        specials: 0,
        cameraReads: 0,
        nestedRounds: 0,
      };
      let completed = 1,
        referenceSpecials = [];
      // Book I, chapter 28, PDF p148 (2-28-9): high-byte bits 3..0 are
      // Up/Down/Left/Right. Keep both opposite-direction cases as boundaries.
      const directions = [0x0100, 0x0500, 0x0400, 0x0600, 0x0200, 0x0a00, 0x0800, 0x0900];
      assert.deepEqual(
        directions.map((pad) => n.mem.read16(0x80df4b + (pad >>> 8) * 2)),
        [14, 12, 10, 8, 6, 4, 2, 0],
      );
      for (const pad of [0x0300, 0x0c00])
        assert.equal(n.mem.read16(0x80df4b + (pad >>> 8) * 2), 16);
      const movementPads = [...directions, 0x0300, 0x0c00, 0];
      // B activates BC67; A closes the active glove through E014/BCB2.
      const actionPads = [0x8000, 0, 0x0100, 0x0400, 0, 0x0080, 0],
        gloveStates = [];
      // Move the player first, then let BC67 put the glove over that real
      // position. No coordinates, object records or task events are supplied.
      const objectPhases = [
        { label: 'approach', pad: 0x0200, rounds: 12 },
        { label: 'stop', pad: 0, rounds: 1 },
        { label: 'open', pad: 0x8000, rounds: 1 },
        { label: 'name', pad: 0, rounds: 2 },
        { label: 'examine', pad: 0x0020, rounds: 1 },
        { label: 'return', pad: 0, rounds: 68 },
        { label: 'menu-open', pad: 0x8000, rounds: 1 },
        { label: 'menu-name', pad: 0, rounds: 2 },
        { label: 'cancel', pad: 0x8000, rounds: 1, menuPads: [0, 0x2000] },
        { label: 'cancel-release', pad: 0, rounds: 1 },
        { label: 'menu-reopen', pad: 0x8000, rounds: 1 },
        { label: 'menu-rename', pad: 0, rounds: 2 },
        { label: 'menu', pad: 0x8000, rounds: 1, menuPads: [0, 0x0400, 0, 0x0080] },
        { label: 'menu-return', pad: 0, rounds: 2 },
        { label: 'pickup-open', pad: 0x8000, rounds: 1 },
        { label: 'pickup-name', pad: 0, rounds: 2 },
        { label: 'pickup', pad: 0x0010, rounds: 1 },
        { label: 'pickup-return', pad: 0, rounds: 8 },
        {
          label: 'inventory-cancel',
          pad: 0x4000,
          rounds: 1,
          nativeInput: { pad: 0x0080, menuPads: [0, 0x2000] },
        },
        { label: 'inventory-release', pad: 0, rounds: 2 },
        {
          label: 'inventory-use',
          pad: 0x4000,
          rounds: 1,
          nativeInput: {
            pad: 0x0080,
            menuPads: [0, 0x0400, 0, 0x0080, 0, 0x2000],
            nestedInputs: [{ target: 0x809ba0, menuPads: [0, 0x0400, 0, 0x0080] }],
          },
        },
        { label: 'inventory-return', pad: 0, rounds: 2 },
        { label: 'door-approach-left', pad: 0x0200, rounds: 70 },
        { label: 'door-approach-up', pad: 0x0800, rounds: 55 },
        { label: 'door-stop', pad: 0, rounds: 2 },
        { label: 'door-open-glove', pad: 0x8000, rounds: 1 },
        { label: 'door-seek-start', pad: 0, rounds: 2 },
        { label: 'door-glove-left', pad: 0x0200, rounds: 16 },
        { label: 'door-name', pad: 0, rounds: 2 },
        { label: 'door-open', pad: 0x0010, rounds: 1 },
        { label: 'door-open-return', pad: 0, rounds: 30 },
        { label: 'door-close-glove', pad: 0x8000, rounds: 1 },
        { label: 'door-close-start', pad: 0, rounds: 1 },
        { label: 'door-glove-close-left', pad: 0x0200, rounds: 6 },
        { label: 'door-close-name', pad: 0, rounds: 2 },
        { label: 'door-close', pad: 0x0010, rounds: 1 },
        { label: 'door-close-return', pad: 0, rounds: 30 },
        { label: 'exit-inner-glove', pad: 0x8000, rounds: 1 },
        { label: 'exit-inner-start', pad: 0, rounds: 1 },
        { label: 'exit-inner-left', pad: 0x0200, rounds: 16 },
        { label: 'exit-inner-name', pad: 0, rounds: 2 },
        { label: 'exit-inner-open', pad: 0x0010, rounds: 1 },
        { label: 'exit-inner-wait', pad: 0, rounds: 30 },
        { label: 'exit-around-down', pad: 0x0400, rounds: 20 },
        { label: 'exit-around-left', pad: 0x0200, rounds: 14 },
        { label: 'exit-around-up', pad: 0x0800, rounds: 16 },
        { label: 'exit-through-inner', pad: 0x0200, rounds: 20 },
        { label: 'exit-through-stop', pad: 0, rounds: 2 },
        { label: 'exit-approach-left', pad: 0x0200, rounds: 118 },
        { label: 'exit-approach-up', pad: 0x0800, rounds: 9 },
        { label: 'exit-approach-stop', pad: 0, rounds: 2 },
        { label: 'exit-first-glove', pad: 0x8000, rounds: 1 },
        { label: 'exit-first-rest', pad: 0, rounds: 2 },
        { label: 'exit-cancel-glove', pad: 0x0080, rounds: 1 },
        { label: 'exit-near-left', pad: 0x0200, rounds: 3 },
        { label: 'exit-near-stop', pad: 0, rounds: 1 },
        { label: 'exit-glove', pad: 0x8000, rounds: 1 },
        { label: 'exit-rest', pad: 0, rounds: 1 },
        { label: 'exit-glove-left', pad: 0x0200, rounds: 18 },
        { label: 'exit-name', pad: 0, rounds: 2 },
        { label: 'exit-open', pad: 0x0010, rounds: 1 },
        { label: 'exit-open-wait', pad: 0, rounds: 30 },
        { label: 'exit-around-right', pad: 0x0900, rounds: 60 },
        { label: 'exit-around-upper-left', pad: 0x0a00, rounds: 40 },
        { label: 'exit-cross-left', pad: 0x0200, rounds: 150 },
        { label: 'exit-cross-stop', pad: 0, rounds: 2 },
        { label: 'hallway-entry', pad: 0x0400, rounds: 120 },
        { label: 'hallway-stop', pad: 0, rounds: 2 },
        { label: 'street-hallway-right', pad: 0x0100, rounds: 400 },
        { label: 'street-entry-down', pad: 0x0400, rounds: 150 },
        { label: 'street-stop', pad: 0, rounds: 2 },
        // The real punk task tests distance, waits 25 rounds and calls 95.
        // Only that native receives these menu samples; other tasks keep pad 0.
        {
          label: 'street-punk-approach',
          pad: 0x0800,
          rounds: 85,
          dialogInput: { pad: 0x8000, menuPads: [0, 0x8000] },
        },
        { label: 'street-punk-leave', pad: 0, rounds: 220 },
        { label: 'southwest-street-down', pad: 0x0400, rounds: 700 },
        { label: 'southwest-corner', pad: 0x0a00, rounds: 700 },
        { label: 'southwest-stop', pad: 0, rounds: 2 },
        { label: 'alley-approach', pad: 0x0600, rounds: 425 },
        { label: 'fight-trigger', pad: 0x0600, rounds: 275 },
        { label: 'fight-stop', pad: 0, rounds: 2 },
        { label: 'fight-down1', pad: 0x0400, rounds: 40 },
        { label: 'fight-diagonal', pad: 0x0600, rounds: 40 },
        { label: 'fight-left', pad: 0x0200, rounds: 30 },
        { label: 'fight-down2', pad: 0x0400, rounds: 20 },
        { label: 'fight-right', pad: 0x0100, rounds: 24 },
        { label: 'fight-stop2', pad: 0, rounds: 2 },
        { label: 'gun-glove', pad: 0x8000, rounds: 1 },
        { label: 'gun-name', pad: 0, rounds: 2 },
        { label: 'gun-seek', glove: [150, 132], rounds: 600 },
        { label: 'gun-pickup', pad: 0x0010, rounds: 1 },
        { label: 'gun-return', pad: 0, rounds: 12 },
        {
          label: 'gun-equip',
          pad: 0x1000,
          rounds: 1,
          nativeInput: {
            pad: 0x0080,
            menuPads: [0, 0x0400, 0, 0x0400, 0, 0x0400, 0, 0x8000, 0, 0x0400, 0, 0x8000, 0, 0x2000],
            nestedInputs: [{ target: 0x809ba0, menuPads: [0, 0x0400, 0, 0x0400, 0, 0x8000] }],
          },
        },
        { label: 'gun-equip-return', pad: 0, rounds: 2 },
        { label: 'fight-crosshair', pad: 0x0080, rounds: 1 },
        ...Array.from({ length: 50 }, (_, shot) => [
          { label: 'fight-aim-' + shot, aim: 0x52, rounds: 600 },
          { label: 'fight-fire-' + shot, pad: 0x0080, rounds: 6 },
          { label: 'fight-recover-' + shot, pad: 0, rounds: 32 },
        ]).flat(),
      ];
      const inputRounds = [
        ...movementPads.map((pad) => ({ pad, rounds: 8, kind: 'movement' })),
        ...actionPads.map((pad) => ({ pad, rounds: 8, kind: 'glove' })),
        ...objectPhases,
      ].flatMap((phase) =>
        Array.from({ length: phase.rounds }, (_, i) => ({
          ...phase,
          remaining: phase.rounds - i - 1,
          end: i === phase.rounds - 1,
        })),
      );
      const objectStates = [],
        actionEvents = [],
        mainWindows = [],
        sceneTransitions = [];
      let currentInput = null,
        acquiredRecord = null,
        pickupActive = null,
        namedFrameProven = false,
        hallwayOpcodes = 0,
        streetOpcodes = 0;
      let punkTaskEnded = false,
        southwestOpcodes = 0,
        alleyOpcodes = 0;
      const dialogs = [],
        randomReads = [],
        rangeRandomReads = [];
      const combat = [];
      let beforeFight,
        combatTask,
        enemyTask,
        enemyFrame,
        orcRecord,
        gunRecord,
        fightEnded = null,
        enemyTaskEnded = null,
        referenceEnemyEnd = null,
        controlStart;
      const countedRun = n.vm.run.bind(n.vm);
      n.vm.run = (budget) => {
        const task = n.mem.read16(0x250),
          frame = n.vm.d,
          result = countedRun(budget);
        if (task === enemyTask && frame === enemyFrame && result === EXIT_END) {
          assert.equal(n.vm.pc, 0xc20b);
          assert.equal(n.vm.d, 0);
          assert.equal(enemyTaskEnded, null);
          enemyTaskEnded = completed + 1;
        }
        return result;
      };
      const activeTasks = () => {
        const active = [];
        for (let task = n.mem.read16(0x24c); !(task & 0x8000); task = n.mem.read16(0x312 + task)) {
          assert.ok(active.length < 48);
          assert.ok(!active.includes(task));
          active.push(task);
        }
        return active;
      };
      const taskChain = (slot) => {
        const chain = [];
        let task = n.mem.read16(0x1350 + slot);
        for (;;) {
          assert.ok(task <= 0x5e && !(task & 1) && chain.length < 48);
          chain.push(task);
          if (!(n.mem.read16(0xba2 + task) & 0x8000)) break;
          task = n.mem.read16(0x372 + task);
        }
        return { task, chain, event: n.mem.read16(0xc62 + task), mask: n.mem.read16(0xba2 + task) };
      };
      const expectedActions = new Map([
        ['examine', { slot: 0x54, task: 2, chain: [2], event: 0x80, mask: 0x480 }],
        ['cancel', { slot: 0x3a, task: 0x2a, chain: [0x1c, 0x2a], event: 0, mask: 0x90 }],
        ['menu', { slot: 0x3a, task: 0x2a, chain: [0x1c, 0x2a], event: 0x80, mask: 0x90 }],
        ['pickup', { slot: 0x3a, task: 0x2a, chain: [0x1c, 0x2a], event: 0x10, mask: 0x90 }],
        ['door-open', { slot: 0x4e, task: 8, chain: [8], event: 0x200, mask: 0x200 }],
        ['door-close', { slot: 0x4e, task: 0x1c, chain: [8, 0x1c], event: 0x400, mask: 0x400 }],
        [
          'exit-inner-open',
          { slot: 0x4e, task: 0x2a, chain: [8, 0x1c, 0x2a], event: 0x200, mask: 0x200 },
        ],
        ['exit-open', { slot: 0x50, task: 0x36, chain: [6, 0x36], event: 0x200, mask: 0x200 }],
      ]);
      const schedulerCall = n.driver.scheduler.call.bind(n.driver.scheduler);
      n.driver.scheduler.call = (entry, budget) => {
        if (expectedActions.has(currentInput?.label)) {
          const slot = objectStates.at(-1).object,
            event = { slot, ...taskChain(slot) };
          assert.deepEqual(event, expectedActions.get(currentInput.label));
          actionEvents.push({ label: currentInput.label, ...event });
        }
        return schedulerCall(entry, budget);
      };
      const nativeCounts = new Map();
      calls.set(0x80c1e3, () => {
        finishInterruptObservations(e);
        assert.equal(a.ioIndex, a.io.length);
        if (expectedActions.has(currentInput?.label)) {
          const event = actionEvents.at(-1);
          assert.equal(r.mem.read16(0xc62 + event.task), event.event);
        }
        const more = originalBootTaskRound(a, referenceSpecials, 0x80c1e3, (end) => {
          if (end.task === enemyTask && end.frame === enemyFrame) {
            assert.equal(referenceEnemyEnd, null);
            referenceEnemyEnd = completed;
            assert.equal(end.pointer, n.mem.read16(0x82ded1 + 0x251 * 2) + 2);
            assert.equal(end.bank, n.mem.read8(0x82db28 + 0x251));
          }
        });
        for (const key of Object.keys(totals)) totals[key] += more[key];
        throw stop;
      });
      // Repeated explicit observations, one separately owned set per main
      // interval. No real time, counter injection or implicit frame is added.
      for (let iteration = 0; iteration < 1599 + inputRounds.length; iteration++) {
        const nativeTraceStart = n.a.trace.length,
          referenceTraceStart = r.a.trace.length;
        const oldScene = n.mem.read16(0x7e2de2);
        currentInput = inputRounds[iteration - 1599] ?? null;
        if (currentInput?.label === 'fight-crosshair-off') {
          const kind = n.mem.read16(0x1d8),
            aiming = n.mem.read16(0x1d5d) | n.mem.read16(0x1d5f);
          // Death/return can already have closed the cursor. A fresh B in
          // neutral control would open the action glove again.
          currentInput = { ...currentInput, pad: kind ? (aiming ? 0x8000 : 0x0080) : 0 };
        }
        if (currentInput?.glove || currentInput?.aim) {
          const seek = seekPad(n.mem, currentInput);
          assert.ok(
            !currentInput.end || seek.settled,
            'cursor input must reach its target within the fixture bound',
          );
          if (seek.settled) inputRounds.splice(iteration - 1599 + 1, currentInput.remaining);
          currentInput = { ...currentInput, pad: seek.pad, end: seek.settled };
        }
        const pad = currentInput?.pad ?? 0;
        const menuPads = currentInput?.menuPads ?? [];
        if (currentInput?.label === 'menu') {
          const stopped = snapshot(n),
            cursor = n.devices.index;
          assert.throws(
            () => constructBootInterval(n, appendWait, { pad, menuPads: [0] }),
            /menu input samples exhausted/,
          );
          assert.throws(
            () => constructBootInterval(n, appendWait, { pad, menuPads: [...menuPads, 0] }),
            /unused menu input samples/,
          );
          assert.deepEqual(snapshot(n), stopped);
          assert.equal(n.devices.index, cursor);
        }
        const set = constructBootInterval(n, appendWait, { pad, menuPads });
        n.devices.sets.push(set);
        if (set.dmaTransfers.length)
          mainWindows.push({
            label: currentInput.label,
            round: completed + 1,
            io: set.io.length,
            interrupts: set.interrupts.length,
            dma: set.dmaTransfers.length,
          });
        referenceSpecials = [];
        const beforeOps = opcodes;
        let outcome = n.driver.run(13);
        for (let i = 0; i < 1024 && outcome === STOP_BUDGET; i++) outcome = n.driver.resume(13);
        while (outcome === STOP_NATIVE) {
          const target = 0x800000 | n.mem.read16(0x82d7b8 + n.vm.x);
          assert.equal(n.vm.pc, 0xf4f6);
          assert.equal(n.driver.pending, true);
          const stopped = snapshot(n),
            cursor = n.devices.index;
          assert.equal(n.driver.resume(0), STOP_NATIVE);
          assert.deepEqual(snapshot(n), stopped);
          assert.equal(n.devices.index, cursor);
          if (!BOOT_NATIVE_CONTRACTS.has(target)) break;
          if (target === 0x80936c) {
            assert.ok(currentInput?.dialogInput);
            assert.equal(n.mem.read16(0), 0x40);
            assert.equal(n.mem.read16(2), 0x7f);
            assert.equal(n.mem.read16(0x250), 0x16);
          }
          if (LIFTED_SCRIPT_NATIVES.has(target)) liftedRan.add(target);
          const combatNative = [0x808521, 0x808bc5, 0x808ab5, 0x808a51, 0x80855e].includes(target);
          const combatBefore = combatNative
            ? {
                round: completed + 1,
                target: target.toString(16),
                task: n.mem.read16(0x250),
                argument: n.mem.read16(0),
                fight: n.mem.read16(0x1fb0),
                music: n.mem.read16(0x1cde),
                object: n.mem.read16(0x1de),
              }
            : null;
          if (target === 0x808521) {
            assert.equal(combatBefore.argument, 0x52);
            assert.equal(combatBefore.fight, 0xfffe);
            combatTask = combatBefore.task;
            orcRecord = n.mem.read16(0x13a8 + 0x52);
            assert.ok(orcRecord);
            assert.ok(n.mem.read8(0x7e0002 + orcRecord) > 0);
            const frame = n.mem.read16(0x252 + combatTask);
            assert.equal(n.mem.read16(frame), n.mem.read16(0x82ded1 + 0x1d5 * 2) + 2);
            assert.equal(n.mem.read8(frame + 2), n.mem.read8(0x82db28 + 0x1d5));
          }
          if (target === 0x808bc5 || target === 0x808ab5) {
            const task = n.mem.read16(0x250),
              frame = n.mem.read16(0x252 + task);
            enemyTask ??= task;
            enemyFrame ??= frame;
            assert.equal(task, enemyTask);
            assert.equal(frame, enemyFrame);
            assert.notEqual(enemyTask, combatTask);
            assert.equal(n.mem.read16(frame), n.mem.read16(0x82ded1 + 0x251 * 2) + 2);
            assert.equal(n.mem.read8(frame + 2), n.mem.read8(0x82db28 + 0x251));
          }
          const nativeInput =
            target === 0x80936c
              ? currentInput.dialogInput
              : (currentInput?.nativeInput ??
                (combatNative ? { counterPattern: combatCounterPattern } : undefined));
          const notice = constructBootNative(n, appendWait, nativeInput);
          n.devices.sets.push(notice.set, ...notice.nestedSets);
          referenceSpecials.push(notice.referenceSet);
          if (combatNative) {
            assert.equal(notice.result.returnTarget, 0x80f509);
            assert.equal(notice.nestedSets.length, 0);
            if (target === 0x808521 || target === 0x808bc5) {
              assert.equal(notice.set.interrupts.length, 0);
              assert.equal(notice.set.dmaTransfers.length, 0);
            }
            if (target === 0x808bc5) assert.equal(notice.resultWord, n.mem.read16(0xcc2));
            if (target === 0x808a51) assert.equal(combatBefore.object, 0x52);
            if (target === 0x80855e) {
              assert.equal(combatBefore.argument, 0x52);
              assert.equal(notice.result.outcome, 'fight_ended_music');
              fightEnded = completed + 1;
            }
            combat.push({
              ...combatBefore,
              result: notice.resultWord,
              outcome: notice.result.outcome,
              io: notice.set.io.length,
              interrupts: notice.set.interrupts.length,
              dma: notice.set.dmaTransfers.length,
            });
          }
          if (target === 0x80c560) {
            assert.deepEqual(
              notice.set.io.map(({ pc, address, width, value }) => ({ pc, address, width, value })),
              [
                { pc: 0x80c566, address: 0x802137, width: 1, value: 0 },
                { pc: 0x80c572, address: 0x80213c, width: 1, value: 0 },
                { pc: 0x80c57f, address: 0x80213d, width: 1, value: 0 },
              ],
            );
            assert.equal(notice.set.interrupts.length, 0);
            assert.equal(notice.set.dmaTransfers.length, 0);
            randomReads.push({ round: completed + 1, reads: notice.set.io.length });
          }
          if (target === 0x80c51f) {
            assert.equal(notice.set.io.length, notice.result.attempts * 3);
            for (let i = 0; i < notice.set.io.length; i += 3)
              assert.deepEqual(notice.set.io.slice(i, i + 3), [
                { pc: 0x80c566, address: 0x802137, width: 1, value: 0 },
                { pc: 0x80c572, address: 0x80213c, width: 1, value: 0 },
                { pc: 0x80c57f, address: 0x80213d, width: 1, value: 0 },
              ]);
            assert.equal(notice.set.interrupts.length, 0);
            assert.equal(notice.set.dmaTransfers.length, 0);
            rangeRandomReads.push({
              round: completed + 1,
              attempts: notice.result.attempts,
              mask: notice.result.mask,
              zeroLimit: notice.result.zeroLimit,
              reads: notice.set.io.length,
            });
          }
          if (target === 0x80936c) {
            assert.ok(notice.set.interrupts.some((o) => o.pc === 0x80901c && o.nmi));
            assert.ok(notice.set.interrupts.some((o) => o.pc === 0x80ae0c && o.nmi));
            assert.equal(notice.result.returnTarget, 0x80f509);
            assert.equal(notice.nestedSets.length, 0);
            dialogs.push({
              round: completed + 1,
              io: notice.set.io.length,
              interrupts: notice.set.interrupts.length,
              dma: notice.set.dmaTransfers.length,
            });
          }
          for (const called of [target, ...notice.nestedTargets])
            nativeCounts.set(called, (nativeCounts.get(called) ?? 0) + 1);
          outcome = n.driver.resume(13);
          for (let i = 0; i < 1024 && outcome === STOP_BUDGET; i++) outcome = n.driver.resume(13);
          if (target !== 0x80e014)
            t.diagnostic(
              JSON.stringify({
                nativeRound: completed + 1,
                target: target.toString(16),
                io: notice.set.io.length,
                interrupts: notice.set.interrupts.length,
                dma: notice.set.dmaTransfers.length,
                outcome: notice.result.outcome,
              }),
            );
          if (currentInput?.nativeInput && currentInput.label.startsWith('inventory-')) {
            assert.equal(target, 0x80e014);
            assert.equal(n.mem.read16(0x1f62), 0);
            const itemRecord = n.mem.read16(0x13a8 + 0x3a),
              itemName = n.mem.read16(0x8cefb0 + 0x51 * 6);
            let listed = false;
            for (let row = 2; row < 0x40 && n.mem.read16(0x1da9 + row); row += 2) {
              const item = n.mem.read16(0x1e2d + row);
              if (n.mem.read16(0x8db020 + item) === itemRecord) {
                assert.equal(n.mem.read16(0x1da9 + row), itemName);
                listed = true;
              }
            }
            assert.ok(listed, 'the real acquired record is in the inventory menu');
            assert.equal(
              notice.referenceSet.rounds.length,
              currentInput.label === 'inventory-use' ? 1 : 0,
            );
            if (currentInput.label === 'inventory-use')
              assert.deepEqual(notice.nestedTargets, [0x809ba0, 0x80fec1]);
            t.diagnostic(
              JSON.stringify({
                inventory: currentInput.label,
                round: completed + 1,
                io: notice.set.io.length,
                interrupts: notice.set.interrupts.length,
                dma: notice.set.dmaTransfers.length,
                nestedTargets: notice.nestedTargets,
              }),
            );
          }
        }
        if (outcome === STOP_NATIVE) {
          t.diagnostic(
            JSON.stringify({
              frontierRound: completed + 1,
              id: n.vm.exitId,
              target: n.mem.read16(0x82d7b8 + n.vm.x).toString(16),
            }),
          );
          break;
        }
        assert.equal(outcome, STOP_RETURNED);
        completed++;
        a.io = set.io;
        a.ioIndex = 0;
        e.interrupts = set.interrupts;
        e.interruptIndex = 0;
        e.dmaTransfers = set.dmaTransfers;
        e.dmaIndex = 0;
        const beforeReference = totals.opcodes;
        assert.throws(
          () => original(0x8096c3),
          (error) => {
            if (error !== stop) throw error;
            return true;
          },
        );
        assert.equal(totals.opcodes - beforeReference, opcodes - beforeOps);
        const scene = n.mem.read16(0x7e2de2);
        if (scene !== oldScene) {
          assert.deepEqual(
            [oldScene, scene],
            [
              [3, 0x1f],
              [0x1f, 1],
              [1, 4],
              [4, 2],
            ][sceneTransitions.length],
          );
          assert.equal(opcodes - beforeOps, 0);
          assert.equal(n.mem.read16(0x250), n.mem.read16(0x24c));
          assert.notEqual(n.mem.read16(0x24c), 0xffff);
          sceneTransitions.push({
            round: completed,
            from: oldScene,
            to: scene,
            opcodes: opcodes - beforeOps,
            mainIo: set.io.length,
            interrupts: set.interrupts.length,
            dma: set.dmaTransfers.length,
          });
        }
        if (scene === 0x1f) hallwayOpcodes += opcodes - beforeOps;
        if (scene === 1) streetOpcodes += opcodes - beforeOps;
        if (scene === 4) southwestOpcodes += opcodes - beforeOps;
        if (scene === 2) alleyOpcodes += opcodes - beforeOps;
        const { e: referenceMode, programBank: referenceBank, ...expected } = a.ctx;
        assert.equal(referenceMode, 0);
        assert.equal(referenceBank, 0x80);
        assert.deepEqual(n.vm.context(), expected);
        assert.deepEqual(usedWram(n.mem.wram, n.vm.s), usedWram(r.mem.wram, n.vm.s));
        assert.deepEqual(n.mem.sram, r.mem.sram);
        const inputs = [set, ...referenceSpecials]
          .flatMap((s) => s.io)
          .filter((o) => (o.address & 65535) === 0x4218);
        assert.equal(n.mem.read16(0x1ca), inputs.at(-1).value);
        assert.deepEqual(
          expand(n.a.trace.slice(nativeTraceStart)),
          expand(r.a.trace.slice(referenceTraceStart)),
        );
        assert.equal(n.vm.s, 0x13d);
        assert.equal(n.mem.read16(0x13e), 0xa156);
        assert.equal(n.driver.pending, false);
        if (completed === 5449)
          beforeFight = { counts: new Map(nativeCounts), totals: { ...totals } };
        if (fightEnded === completed) {
          assert.equal(n.mem.read16(0x1fb0), 0xfffe);
          assert.equal(n.mem.read8(0x7e0002 + orcRecord), 0);
          // End this route at the first fight. Allow the original death task to
          // finish, close the crosshair and prove control by real movement.
          const tail = [
            { label: 'fight-cleanup', pad: 0, rounds: 48 },
            { label: 'fight-crosshair-off', pad: 0x8000, rounds: 1 },
            { label: 'fight-release', pad: 0, rounds: 2 },
            { label: 'fight-control', pad: 0x0100, rounds: 8 },
            { label: 'fight-control-release', pad: 0, rounds: 2 },
          ];
          inputRounds.splice(
            iteration - 1599 + 1,
            Infinity,
            ...tail.flatMap((p) =>
              Array.from({ length: p.rounds }, (_, i) => ({ ...p, end: i === p.rounds - 1 })),
            ),
          );
        }
        if (currentInput?.end && (currentInput.kind === 'glove' || currentInput.label)) {
          const state = {
            kind: n.mem.read16(0x1d8),
            x: n.mem.read16(0x1d4),
            y: n.mem.read16(0x1d6),
            target: n.mem.read16(0x1da),
            object: n.mem.read16(0x1de),
            window: n.mem.read16(0x1dc),
          };
          if (currentInput.kind === 'glove') gloveStates.push(state);
          else
            objectStates.push({
              label: currentInput.label,
              ...state,
              mask: n.mem.read16(0xba4),
              event: n.mem.read16(0xc64),
              continuation: n.mem.read16(0x2b4),
              itemImage: n.mem.read16(0x1090 + 0x3a),
              itemTaskMask: n.mem.read16(0xbcc),
              itemTaskEvent: n.mem.read16(0xc8c),
              ...(currentInput.label.startsWith('door-')
                ? { door: { ...taskChain(0x4e), image: n.mem.read16(0x1090 + 0x4e) } }
                : {}),
            });
          if (currentInput.label === 'pickup-return') {
            acquiredRecord = n.mem.read16(0x13a8 + 0x3a);
            pickupActive = [];
            for (
              let task = n.mem.read16(0x24c);
              !(task & 0x8000);
              task = n.mem.read16(0x312 + task)
            ) {
              assert.ok(pickupActive.length < 48);
              pickupActive.push(task);
            }
          }
          if (currentInput.label === 'name') {
            assert.ok(n.mem.read16(0x1090 + 0x54));
            const frame = n.mem.read16(0x254);
            assert.equal(n.mem.read16(frame), n.mem.read16(0x82ded1 + 0x133 * 2) + 2);
            assert.equal(n.mem.read8(frame + 2), n.mem.read8(0x82db28 + 0x133));
            namedFrameProven = true;
          }
          if (currentInput.label === 'street-punk-leave') {
            const active = [];
            for (
              let task = n.mem.read16(0x24c);
              !(task & 0x8000);
              task = n.mem.read16(0x312 + task)
            ) {
              assert.ok(active.length < 48);
              active.push(task);
            }
            assert.ok(
              !active.includes(0x16),
              'the original punk task ends after dialog and departure',
            );
            assert.equal(n.mem.read16(0x1d63), 0);
            assert.equal(n.mem.read16(0x1f62), 0);
            punkTaskEnded = true;
          }
          if (currentInput.label === 'gun-seek') {
            assert.equal(n.mem.read16(0x1de), 0x4c);
            gunRecord = n.mem.read16(0x13a8 + 0x4c);
            assert.ok(gunRecord);
          }
          if (currentInput.label === 'gun-return') {
            assert.equal(n.mem.read16(0x1090 + 0x4c), 0);
            assert.equal(n.mem.read16(0x7e0003 + gunRecord), n.mem.read16(0x7e2df0));
          }
          if (currentInput.label === 'gun-equip') {
            assert.ok(n.mem.read16(0x7e3c31) < 0x8000);
            assert.equal(n.mem.read8(0x7e3c33), 6);
            assert.equal(n.mem.read16(0x1d63), 0xffff); // original menu-cancel marker
          }
          if (currentInput.label === 'fight-release') {
            assert.equal(n.mem.read16(0x1d8), 0);
            // closeStatus leaves 1D63's menu-cancel marker intact (EA6E).
            assert.equal(n.mem.read16(0x1d63), 0xffff);
            assert.equal(n.mem.read16(0x1f62), 0);
            const player = n.mem.read16(0xcc2);
            controlStart = [n.mem.read16(0xe28 + player), n.mem.read16(0xe80 + player)];
          }
        }
      }
      assert.equal(completed, 1600 + inputRounds.length);
      assert.ok(totals.resumes > 0);
      assert.ok(totals.waits > 0);
      assert.ok(totals.cameraReads > 256);
      for (const target of BOOT_NATIVE_CONTRACTS.keys()) assert.ok(nativeCounts.get(target) > 0);
      assert.equal(gloveStates.length, actionPads.length);
      assert.equal(gloveStates[0].kind, 0xffff);
      assert.notEqual(gloveStates[1].x, gloveStates[2].x);
      assert.notEqual(gloveStates[2].y, gloveStates[3].y);
      assert.equal(gloveStates[5].kind, 0);
      assert.equal(gloveStates[6].kind, 0);
      const named = objectStates.find((s) => s.label === 'name');
      assert.equal(named.target, 0x13);
      assert.equal(named.object, 0x54);
      assert.equal(named.window, 6);
      assert.ok(namedFrameProven);
      assert.equal(n.mem.read16(0x8cefb0 + 0x13 * 6), 0x6aa2);
      const examined = objectStates.find((s) => s.label === 'examine');
      assert.equal(examined.mask, 1);
      assert.equal(examined.event, 0);
      const returned = objectStates.find((s) => s.label === 'return');
      assert.equal(returned.mask, 0x480);
      assert.equal(returned.event, 0);
      assert.equal(returned.continuation, 0xf508);
      for (const label of ['menu-name', 'menu-rename', 'pickup-name']) {
        const item = objectStates.find((s) => s.label === label);
        assert.equal(item.target, 0x51);
        assert.equal(item.object, 0x3a);
        assert.ok(item.itemImage);
      }
      assert.equal(objectStates.find((s) => s.label === 'cancel').itemTaskMask, 0x90);
      assert.equal(objectStates.find((s) => s.label === 'menu-return').itemTaskMask, 0x90);
      assert.ok(acquiredRecord);
      assert.equal(n.mem.read16(0x7e0003 + acquiredRecord), n.mem.read16(0x7e2df0));
      assert.equal(objectStates.find((s) => s.label === 'pickup-return').itemImage, 0);
      assert.ok(!pickupActive.includes(0x1c));
      assert.ok(!pickupActive.includes(0x2a));
      for (const label of ['door-name', 'door-close-name']) {
        const door = objectStates.find((s) => s.label === label);
        assert.equal(door.target, 0x18);
        assert.equal(door.object, 0x4e);
      }
      const opened = objectStates.find((s) => s.label === 'door-open-return').door;
      assert.deepEqual(opened.chain, [8, 0x1c]);
      assert.equal(opened.mask, 0x400);
      assert.equal(opened.image, 0x93fe);
      const closed = objectStates.find((s) => s.label === 'door-close-return').door;
      assert.deepEqual(closed.chain, [8, 0x1c, 0x2a]);
      assert.equal(closed.mask, 0x200);
      assert.equal(closed.image, 0x9422);
      assert.equal(n.mem.read16(0x7e2de2), 2);
      assert.equal(sceneTransitions.length, 4);
      assert.ok(hallwayOpcodes > 0);
      assert.ok(streetOpcodes > 0);
      assert.ok(southwestOpcodes > 0);
      assert.ok(alleyOpcodes > 0);
      assert.deepEqual(
        sceneTransitions.slice(0, 2).map(({ round, from, to }) => ({ round, from, to })),
        [
          { round: 2677, from: 3, to: 0x1f },
          { round: 3179, from: 0x1f, to: 1 },
        ],
      );
      assert.equal(dialogs.length, 1);
      assert.equal(dialogs[0].round, 3344);
      assert.ok(randomReads.length > 0);
      assert.ok(punkTaskEnded);
      assert.ok(rangeRandomReads.length > 0);
      assert.equal(nativeCounts.get(0x80c51f), rangeRandomReads.length);
      const exit = objectStates.find((s) => s.label === 'exit-name');
      assert.equal(exit.target, 0x18);
      assert.equal(exit.object, 0x50);
      assert.equal(beforeFight.counts.get(0x80fec1), 15);
      assert.equal(beforeFight.counts.get(0x80c46e), 13);
      assert.equal(beforeFight.counts.get(0x80cda8), 10);
      assert.equal(nativeCounts.get(0x80936c), 1);
      assert.equal(nativeCounts.get(0x80c560), randomReads.length);
      assert.equal(beforeFight.counts.get(0x809ba0), 1);
      assert.equal(beforeFight.totals.nestedRounds, 1);
      assert.equal(nativeCounts.get(0x809ba0), 2);
      assert.equal(totals.nestedRounds, 2);
      assert.deepEqual(
        mainWindows
          .filter((w) => !w.label.startsWith('gun-') && !w.label.startsWith('fight-'))
          .map(({ label, dma }) => ({ label, dma })),
        [
          { label: 'name', dma: 1 },
          { label: 'menu-name', dma: 1 },
          { label: 'cancel', dma: 5 },
          { label: 'menu-rename', dma: 1 },
          { label: 'menu', dma: 7 },
          { label: 'pickup-name', dma: 1 },
          { label: 'door-name', dma: 1 },
          { label: 'door-close-name', dma: 1 },
          { label: 'exit-inner-name', dma: 1 },
          { label: 'exit-name', dma: 1 },
        ],
      );
      assert.equal(nativeCounts.get(0x808521), 1);
      assert.equal(nativeCounts.get(0x80855e), 1);
      assert.ok(nativeCounts.get(0x808a51) > 0);
      assert.ok(nativeCounts.get(0x808ab5) > 0);
      assert.ok(nativeCounts.get(0x808bc5) > 0);
      const endFrame = n.mem.read16(0x252 + combatTask);
      assert.ok(fightEnded);
      assert.ok(enemyTaskEnded, 'the actual 251 child must execute END');
      assert.equal(enemyTaskEnded, referenceEnemyEnd);
      assert.ok(enemyTaskEnded <= fightEnded);
      // 1D5 has no END. After its actual F495 resume and C0 it waits on 0080
      // at bytecode C8 for corpse examination, while 251's original task ended.
      assert.ok(activeTasks().includes(combatTask));
      assert.equal(n.mem.read16(0xba2 + combatTask), 0x80);
      assert.equal(n.mem.read16(0x2b2 + combatTask), 0xf508);
      assert.equal(n.mem.read16(endFrame + 3), 0xc8);
      assert.equal(n.mem.read16(0x1fb0), 0xfffe);
      const player = n.mem.read16(0xcc2);
      assert.notDeepEqual(
        [n.mem.read16(0xe28 + player), n.mem.read16(0xe80 + player)],
        controlStart,
      );
      assert.equal(n.mem.read16(0x1cde), combat.find((c) => c.target === '808521').music);
      t.diagnostic(
        JSON.stringify({
          completedTaskRounds: completed,
          ...totals,
          deviceSets: n.devices.index,
          nativeCounts: Object.fromEntries(
            [...nativeCounts].map(([target, count]) => [target.toString(16), count]),
          ),
          gloveStates,
          actionEvents,
          mainWindows,
          objectStates,
          sceneTransitions,
          hallwayOpcodes,
          streetOpcodes,
          southwestOpcodes,
          alleyOpcodes,
          dialogs,
          randomReads,
          rangeRandomReads,
          combat,
          combatTask,
          enemyTask,
          enemyFrame,
          orcRecord,
          gunRecord,
          fightEnded,
          enemyTaskEnded,
          referenceEnemyEnd,
          controlStart,
        }),
      );
    }
  }
});
