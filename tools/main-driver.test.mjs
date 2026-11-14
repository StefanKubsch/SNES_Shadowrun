import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MainLoopDriver,
  MAIN_OBSERVATION_TARGET,
  MAIN_START_OBSERVATION_TARGET,
  MAIN_ROUND_RETURN_WORD,
  STOP_MAIN_OWNER_RETURN,
  STOP_MAIN_WAIT,
} from '../src/vm/main-driver.mjs';
import { FRONTEND_ROUTINES as FRONTEND_TASK_ROUTINES } from '../src/task/main-frontend.mjs';
import { GAME_OWNER_REFERENCE_ENTRIES } from '../proof/frontend-reference/game-owner.mjs';
// The register-level owner (proof): these tests stub its audio set-up 81:EF63, which
// the lifted owner (src/frontend/game-owner.mjs) calls directly.
const FRONTEND_ROUTINES = new Map([...FRONTEND_TASK_ROUTINES, ...GAME_OWNER_REFERENCE_ENTRIES]);
import { MAIN_STARTUP_ROUTINES } from '../src/task/main-startup.mjs';
// The reset fixtures observe the register-level APU reads of 81:F007 at their data
// bank address (80:2140), so the startup tables use the audio references.
import { withAudioReference } from '../proof/apu-reference/audio-routines.mjs';
import { SRAM_SIZE } from '../src/vm/memory.mjs';
import { MAIN_START_ROUTINES } from '../src/task/main-start.mjs';
import { withGameStartReference } from '../proof/game-reference/game-start.mjs';
import { MAIN_LOOP_ROUTINES } from '../src/vm/main-loop.mjs';
import { ScriptInterpreter } from '../src/vm/interpreter.mjs';
import { NativeCalls } from '../src/vm/native-call.mjs';
import { ObservedDevices, observationSet } from '../proof/vm/observed-devices.mjs';
import {
  TaskScheduler,
  STOP_RETURNED,
  STOP_BUDGET,
  STOP_NATIVE,
  STOP_FRONTIER,
  STOP_BREAK,
  STOP_NATIVE_WAIT,
} from '../src/vm/scheduler.mjs';
import { ff79Fixture } from './render-ff79-fixtures.mjs';
import { textDma } from './main-dma-readback-fixtures.mjs';
import { GAME_NMI_ROUTINES } from '../src/task/main-game-nmi.mjs';
import { MAIN_SCENE_ROUTINES } from '../src/task/main-scene.mjs';
import { FRONTEND_NMI_ROUTINES } from '../src/task/main-frontend-nmi.mjs';
import { finishInterruptObservations } from '../src/task/main-wait-interrupt.mjs';
import { dialogAccess } from '../src/task/native-dialog-support.mjs';
import { mainLoopWindow } from './main-loop-motion-source.mjs';
import { assertPinnedTaskSource } from './pinned-task-source.mjs';
import { decodeWindows, DialogTestMemory, rom } from './task-native-dialog-harness.mjs';
import { runReference } from './w65c816-reference.mjs';

const mainMap = decodeWindows([mainLoopWindow]);
const inputPcs = [
  0x809e1a, 0x809e1d, 0x809e20, 0x809e23, 0x809e26, 0x809e29, 0x809e2c, 0x809e2f, 0x809e31,
  0x809e34, 0x809e3c,
];
function mainSet(extra = {}) {
  return observationSet(MAIN_OBSERVATION_TARGET, {
    interrupts: [
      { pc: 0x81b0a1, nmi: false },
      { pc: 0x81b0a5, nmi: true },
      { pc: 0x81b0a9, nmi: false },
      { pc: 0x81b0ab, nmi: false },
      ...inputPcs.map((pc) => ({ pc, nmi: false })),
    ],
    io: [
      { pc: 0x00c118, address: 0x804210, width: 2, value: 0x80 },
      { pc: 0x809e0b, address: 0x4212, width: 2, value: 0 },
      { pc: 0x809e13, address: 0x4218, width: 2, value: 0x8000 },
    ],
    interruptRoutines: GAME_NMI_ROUTINES,
    ...extra,
  });
}
// Unrelated main helpers are synthetic here, as in main-loop.test.mjs. The
// counter/input/NMI, original outer instructions and whole scheduler are real.
function mainRoutines(shortcut = 1) {
  const r = new Map(MAIN_LOOP_ROUTINES);
  for (const i of mainMap.values())
    if (['JSR', 'JSL'].includes(i.mnemonic) && ![0x80c1e3, 0x81b0a1, 0x809e1a].includes(i.target))
      r.set(i.target, (h) => {
        h.load(i.target & 65535);
        h.index('x', h.ctx.x + 2);
        h.ctx.status =
          (h.ctx.status & ~1) |
          Number(
            (shortcut === 1 && i.target === 0x808000) || (shortcut === 2 && i.target === 0x80cc4b),
          );
        return i.mnemonic === 'JSL' ? h.rtl() : h.rts();
      });
  return r;
}
function setup(
  code = [0x14, 0x34, 0x12, 0x56, 0],
  sets = [mainSet()],
  shortcut = 1,
  driverOptions = {},
  seed = null,
) {
  const mem = new DialogTestMemory(new Uint8Array(0x20000), null, rom),
    vm = new ScriptInterpreter(mem),
    scheduler = new TaskScheduler(vm);
  seed?.(mem);
  vm.dbr = 0x80;
  vm.s = 0x1ef0;
  vm.p = 0;
  vm.d = 0;
  vm.push16(0x1234);
  assert.equal(scheduler.call(0xc1a6), STOP_RETURNED);
  if (code) {
    vm.x = 0;
    vm.push16(0x1234);
    assert.equal(scheduler.call(0xc34a), STOP_RETURNED);
    const slot = mem.read16(0x24c),
      frame = mem.read16(0x252 + slot);
    // Synthetic bytecode and explicit task stack on an actually allocated
    // frame. This is an integration fixture, not another admitted ROM body.
    mem.write16(frame, 0x800);
    mem.write8(frame + 2, 0x7e);
    mem.write16(frame + 3, 0);
    mem.write16(frame + 7, 0x600);
    mem.wram.set(code, 0x800);
    mem.write16(0x250, slot);
  }
  mem.write16(0x6e, 0xc152);
  mem.write8(0x70, 0x80);
  mem.write16(0x140, 0xffff);
  mem.write16(0xcd8, 1);
  mem.write16(0x1c76, 0xffff);
  vm.pc = 0x96c3;
  vm.d = 0;
  vm.dbr = 0x80;
  vm.p = 0x40;
  vm.s = 0x1ef0;
  const devices = new ObservedDevices(sets);
  vm.natives = new NativeCalls(vm, { admitted: [], implementation: () => null, devices });
  vm.natives.accessor.trace = [];
  const driver = new MainLoopDriver(vm, { routines: mainRoutines(shortcut), ...driverOptions });
  return { vm, mem, devices, driver };
}
function originalIteration(v, set) {
  const { vm, driver } = v,
    a = driver.accessor,
    h = dialogAccess(a),
    scheduler = new TaskScheduler(vm);
  a.load();
  a.io = set.io;
  a.ioIndex = 0;
  const e = {
    mode: 'record-observations',
    values: set.wait,
    waitIndex: 0,
    waitEvents: [],
    calls: [],
    inputMode: 'record-observations',
    inputs: set.input,
    inputIndex: 0,
    interrupts: set.interrupts,
    interruptIndex: 0,
    interruptRoutines: set.interruptRoutines,
  };
  const calls = new Map(
    [...driver.routines].map(([target, run]) => [
      target,
      () => {
        const result = run(h, e, driver.routines);
        return { rawReturnWord: result?.rawReturnWord ?? result };
      },
    ]),
  );
  calls.set(0x80c1e3, () => {
    assert.equal(a.stackWord(), 0x96c2);
    finishInterruptObservations(e);
    assert.equal(a.ioIndex, set.io.length);
    a.store();
    assert.equal(scheduler.call(0xc1e3, 100), STOP_RETURNED);
    a.load();
    return { rawReturnWord: 0x96c2 };
  });
  const end = Symbol('next R'),
    hooks = new Map([
      [
        0x8096c3,
        () => {
          if (hooks.started) throw end;
          hooks.started = true;
        },
      ],
    ]);
  assert.throws(
    () => runReference(mainMap, v.mem, a.ctx, { entry: 0x8096c3, calls, before: hooks }),
    (e) => e === end,
  );
  a.store();
}
// The lifted room start calls the game screen set-up 80:9629 and the fixed colour
// 81:8861 directly; the register-level start of a game calls them through the
// table, so the tests that replace them with stubs run it.
const stubbableStart = () => withGameStartReference(MAIN_START_ROUTINES);

test('main driver retains pinned JSR96C0/C1E3 frame and matches original outer code across all carry paths', () => {
  assertPinnedTaskSource(mainMap, [mainLoopWindow]);
  const i = mainMap.get(0x8096c0);
  assert.equal(i.mnemonic, 'JSR');
  assert.equal(i.target, 0x80c1e3);
  assert.equal(i.next, 0x8096c3);
  assert.equal(MAIN_ROUND_RETURN_WORD, 0x96c2);
  for (const shortcut of [0, 1, 2])
    for (const code of [null, [0x14, 0x34, 0x12, 0x56, 0]]) {
      const set = mainSet(),
        n = setup(code, [set], shortcut),
        r = setup(code, [], shortcut);
      originalIteration(r, set);
      assert.equal(n.driver.run(100), STOP_RETURNED);
      assert.deepEqual(n.vm.context(), r.vm.context());
      assert.deepEqual(n.mem.wram, r.mem.wram);
      assert.deepEqual(n.driver.accessor.trace, r.driver.accessor.trace);
      assert.equal(n.driver.roundsCompleted, 1);
      assert.equal(n.driver.pending, false);
      assert.equal(n.vm.pc, 0x96c3);
      assert.equal(n.vm.s, 0x1ef0);
      assert.equal(n.devices.index, 1);
      assert.equal(n.driver.accessor.io, null);
    }
});
test('budget and explicit break preserve the live C1E3 caller frame without rerunning the main interval', () => {
  const v = setup();
  assert.equal(v.driver.run(0), STOP_BUDGET);
  assert.equal(v.driver.pending, true);
  const state = v.vm.context(),
    wram = v.mem.wram.slice();
  assert.throws(
    () => v.driver.run(),
    (e) => e.reason === 'main_round_active',
  );
  assert.deepEqual(v.vm.context(), state);
  assert.deepEqual(v.mem.wram, wram);
  assert.equal(v.driver.resume(1), STOP_BUDGET);
  assert.equal(v.devices.index, 1);
  assert.equal(v.driver.resume(1), STOP_RETURNED);
  assert.equal(v.driver.roundsCompleted, 1);
  assert.equal(v.vm.pc, 0x96c3);
  assert.equal(v.vm.s, 0x1ef0);
  assert.equal(v.mem.read16(0x1c76), 0);
  assert.throws(
    () => v.driver.resume(),
    (e) => e.reason === 'main_round_not_active',
  );
  const b = setup();
  b.driver.scheduler.stopAt = 0xc1f9;
  assert.equal(b.driver.run(10), STOP_BREAK);
  assert.equal(b.driver.pending, true);
  b.driver.scheduler.stopAt = -1;
  assert.equal(b.driver.resume(10), STOP_RETURNED);
  assert.equal(b.vm.s, 0x1ef0);
});

test('main and opcode budgets retain one owner, observation set and both original call frames through resume', () => {
  const n = setup(),
    r = setup();
  assert.equal(r.driver.run(), STOP_RETURNED);
  let stop = n.driver.run(0, { mainBudget: 1 }),
    pauses = 0;
  while (stop === STOP_MAIN_WAIT) {
    assert.ok(++pauses < 300);
    assert.equal(n.devices.index, 1);
    assert.equal(n.driver.roundsCompleted, 0);
    assert.equal(n.driver.accessor.io, null);
    assert.throws(
      () => n.driver.run(),
      (e) => e.reason === 'main_round_active',
    );
    if (n.driver.mainPending.continuation.wait?.pc === 0x81b0a5) {
      assert.equal(n.vm.s, 0x1eed);
      assert.equal(n.mem.read16(0x1eee), 0x96ae);
      assert.equal(n.mem.read8(0x1ef0), 0x80);
    }
    stop = n.driver.resume(0, { mainBudget: 1 });
  }
  assert.equal(stop, STOP_BUDGET);
  assert.equal(n.driver.pending, true);
  assert.equal(n.driver.mainPending, null);
  assert.equal(n.mem.read16(0x1eef), 0x96c2);
  assert.equal(n.driver.resume(), STOP_RETURNED);
  assert.deepEqual(n.vm.context(), r.vm.context());
  assert.deepEqual(n.mem.wram, r.mem.wram);
  assert.deepEqual(n.driver.accessor.trace, r.driver.accessor.trace);
  assert.equal(n.driver.roundsCompleted, 1);
  assert.equal(n.devices.index, 1);
  const stale = setup();
  assert.equal(stale.driver.run(0, { mainBudget: 1 }), STOP_MAIN_WAIT);
  const before = stale.mem.wram.slice();
  stale.vm.a ^= 1;
  assert.throws(
    () => stale.driver.resume(),
    (e) => e.reason === 'main_driver_owner_required',
  );
  assert.deepEqual(stale.mem.wram, before);
  const cursor = setup();
  assert.equal(cursor.driver.run(0, { mainBudget: 1 }), STOP_MAIN_WAIT);
  cursor.driver.accessor.ioIndex++;
  assert.throws(
    () => cursor.driver.resume(),
    (e) => e.reason === 'main_driver_owner_required',
  );
  assert.equal(cursor.devices.index, 1);
});
test('a busy joypad inside NMI pauses through the actual main driver without replaying an observation set', () => {
  const set = mainSet({
    io: [
      mainSet().io[0],
      ...Array.from({ length: 20 }, () => ({ pc: 0x809e0b, address: 0x4212, width: 2, value: 1 })),
      ...mainSet().io.slice(1),
    ],
  });
  const n = setup(null, [set]),
    r = setup(null, [set]);
  assert.equal(r.driver.run(), STOP_RETURNED);
  let stop = n.driver.run(0, { mainBudget: 1 }),
    busyPauses = 0,
    pauses = 0;
  while (stop === STOP_MAIN_WAIT) {
    assert.ok(++pauses < 400);
    assert.equal(n.devices.index, 1);
    assert.equal(n.driver.roundsCompleted, 0);
    if (n.vm.pc === 0x9e0b) {
      busyPauses++;
      assert.equal(n.vm.s, 0x1cac);
      assert.equal(n.mem.read16(0x1cad), 0xc17b);
      assert.equal(n.mem.read16(0x1caf), 0xc13a);
      assert.equal(n.mem.read16(0x1eee), 0x96ae);
      assert.equal(n.mem.read16(0x1ca), 0);
      assert.equal(n.driver.accessor.io, null);
      const before = n.vm.context(),
        wram = n.mem.wram.slice(),
        cursor = n.driver.accessor.ioIndex;
      assert.equal(n.driver.resume(0, { mainBudget: 0 }), STOP_MAIN_WAIT);
      assert.deepEqual(n.vm.context(), before);
      assert.deepEqual(n.mem.wram, wram);
      assert.equal(n.driver.accessor.ioIndex, cursor);
    }
    stop = n.driver.resume(0, { mainBudget: 1 });
  }
  assert.ok(busyPauses >= 21);
  assert.equal(stop, STOP_RETURNED);
  assert.equal(n.driver.mainPending, null);
  assert.equal(n.driver.roundsCompleted, 1);
  assert.deepEqual(n.vm.context(), r.vm.context());
  assert.deepEqual(n.mem.wram, r.mem.wram);
  assert.deepEqual(n.driver.accessor.trace, r.driver.accessor.trace);
  assert.equal(n.devices.index, 1);
});
test('F290 callback pauses all reach the same main driver and complete their original RTI before C1E3', () => {
  for (const target of [
    0x81bec3, 0x81d479, 0x81dad6, 0x81df0e, 0x81dd54, 0x81d93e, 0x81dcac, 0x81e6ae,
  ]) {
    const set = mainSet({
      interruptRoutines: new Map([...MAIN_SCENE_ROUTINES, ...FRONTEND_NMI_ROUTINES]),
      io: [
        mainSet().io[0],
        { pc: 0x809e0b, address: 0x4212, width: 2, value: 1 },
        ...mainSet().io.slice(1),
      ],
    });
    const prepare = () => {
      const v = setup(null, [set]);
      v.mem.write16(0x6e, target & 65535);
      v.mem.write8(0x70, 0x81);
      for (let at = 0x113e; at < 0x115e; at += 2) v.mem.write16(at, 0xffff);
      v.mem.write16(0x11a2, target === 0x81e6ae ? 0 : 0xffff);
      v.mem.write16(0x1e, target === 0x81d93e ? 0x401 : 0);
      return v;
    };
    const n = prepare(),
      r = prepare();
    assert.equal(r.driver.run(), STOP_RETURNED);
    let stop = n.driver.run(0, { mainBudget: 1 }),
      pauses = 0,
      padPauses = 0;
    while (stop === STOP_MAIN_WAIT) {
      assert.ok(++pauses < 300);
      assert.equal(n.devices.index, 1);
      assert.equal(n.driver.roundsCompleted, 0);
      if (n.vm.pc === 0x9e0b) {
        padPauses++;
        assert.equal(n.vm.s, 0x1ca8);
        assert.equal(n.mem.read16(0x1ca9), 0xf295);
      }
      stop = n.driver.resume(0, { mainBudget: 1 });
    }
    // All these callbacks are lifted (src/matrix, src/cutscene, src/intro,
    // src/frontend) and read the joypad without instruction steps: they take the
    // same observations but never pause at 9E0B.
    assert.equal(padPauses, 0);
    assert.equal(stop, STOP_RETURNED);
    assert.equal(n.driver.roundsCompleted, 1);
    assert.deepEqual(n.vm.context(), r.vm.context());
    assert.deepEqual(n.mem.wram, r.mem.wram);
    assert.deepEqual(n.driver.accessor.trace, r.driver.accessor.trace);
  }
});
test('unavailable Native and foreign scheduler PC stay explicit, and an owner can bind a stopped Native then resume', () => {
  const v = setup([0x58, 0x63, 0x56, 0]);
  assert.equal(v.driver.run(10), STOP_NATIVE);
  assert.equal(v.vm.pc, 0xf4f6);
  assert.equal(v.driver.pending, true);
  const stopped = v.vm.context(),
    bytes = v.mem.wram.slice();
  assert.equal(v.driver.resume(0), STOP_NATIVE);
  assert.deepEqual(v.vm.context(), stopped);
  assert.deepEqual(v.mem.wram, bytes);
  assert.equal(v.devices.index, 1);
  const random = observationSet(0x80c560, {
    io: [
      { pc: 0x80c566, address: 0x802137, width: 1, value: 1 },
      { pc: 0x80c572, address: 0x80213c, width: 1, value: 2 },
      { pc: 0x80c57f, address: 0x80213d, width: 1, value: 3 },
    ],
  });
  v.devices.sets = [mainSet(), random];
  assert.equal(v.vm.natives.canCall(), true);
  assert.equal(v.driver.resume(0), STOP_BUDGET);
  assert.equal(v.vm.pc, 0xf390);
  assert.equal(v.driver.pending, true);
  const resumed = v.vm.context(),
    resumedBytes = v.mem.wram.slice();
  assert.equal(v.driver.resume(0), STOP_BUDGET);
  assert.deepEqual(v.vm.context(), resumed);
  assert.deepEqual(v.mem.wram, resumedBytes);
  assert.equal(v.vm.natives.calls, 1);
  assert.equal(v.driver.resume(10), STOP_RETURNED);
  assert.equal(v.devices.index, 2);
  assert.equal(v.vm.natives.calls, 1);
  assert.equal(v.vm.s, 0x1ef0);
  const f = setup();
  assert.equal(f.driver.run(0), STOP_BUDGET);
  f.vm.pc = 0xabcd;
  assert.equal(f.driver.resume(1), STOP_FRONTIER);
  assert.equal(f.driver.pending, true);
  assert.equal(f.driver.roundsCompleted, 0);
});
test('entry, owner, budget and missing observation failures preserve the unstarted VM and device cursor', () => {
  for (const [mutate, reason] of [
    [
      (v) => {
        v.vm.pc = 0x96c0;
      },
      'main_driver_entry_required',
    ],
    [
      (v) => {
        v.vm.d = 1;
      },
      'main_driver_entry_required',
    ],
    [
      (v) => {
        v.vm.p |= 0x20;
      },
      'main_driver_entry_required',
    ],
    [
      (v) => {
        v.driver.devices = new ObservedDevices([mainSet()]);
      },
      'main_driver_owner_required',
    ],
    [
      (v) => {
        v.devices.sets = [];
      },
      'main_loop_observations_required',
    ],
  ]) {
    const v = setup();
    mutate(v);
    const ctx = v.vm.context(),
      bytes = v.mem.wram.slice();
    assert.throws(
      () => v.driver.run(2),
      (e) => e.reason === reason,
    );
    assert.deepEqual(v.vm.context(), ctx);
    assert.deepEqual(v.mem.wram, bytes);
    assert.equal(v.devices.index, 0);
  }
  for (const budget of [-1, 0.5, NaN]) {
    const v = setup(),
      before = v.mem.wram.slice();
    assert.throws(
      () => v.driver.run(budget),
      (e) => e.reason === 'main_round_budget_required',
    );
    assert.deepEqual(v.mem.wram, before);
    assert.equal(v.devices.index, 0);
  }
});
test('main observation failures retain direct NMI effects, clear IO and never start a scheduler round', () => {
  for (const extra of [
    { interrupts: [] },
    { io: [...mainSet().io, mainSet().io[0]] },
    { interrupts: [...mainSet().interrupts, { pc: 0x81b0a1, nmi: false }] },
  ]) {
    const v = setup(undefined, [mainSet(extra)]);
    assert.throws(
      () => v.driver.run(10),
      (e) => e.reason.startsWith('main_loop_'),
    );
    assert.equal(v.driver.pending, false);
    assert.equal(v.driver.roundsCompleted, 0);
    assert.equal(v.driver.accessor.io, null);
    assert.equal(v.vm.s, v.driver.accessor.ctx.s);
    if (extra.interrupts?.length !== 0) assert.equal(v.mem.read16(0x1c76), 0);
  }
});
test('a modified real outer return word is exposed instead of reported as a completed main round', () => {
  const v = setup();
  assert.equal(v.driver.run(0), STOP_BUDGET);
  assert.equal(v.mem.read16(0x1eef), 0x96c2);
  v.mem.write16(0x1eef, 0x1234);
  assert.throws(
    () => v.driver.resume(10),
    (e) => e.reason === 'main_round_return_context',
  );
  assert.equal(v.vm.pc, 0x1235);
  assert.equal(v.vm.s, 0x1ef0);
  assert.equal(v.driver.roundsCompleted, 0);
});
test('main and F953 inside its scheduler round consume separate chronological sets on the same accessor and memory', () => {
  const caller = mainSet(),
    child = observationSet(0x80f953, {
      interrupts: caller.interrupts,
      interruptRoutines: GAME_NMI_ROUTINES,
      io: caller.io.map((o) => (o.pc === 0x809e13 ? { ...o, value: 0x4000 } : o)),
    });
  const v = setup([0x58, 0xa3, 0xc0, 0x56, 0], [caller, child]);
  assert.equal(v.driver.accessor, v.vm.natives.accessor);
  assert.equal(v.driver.run(100), STOP_RETURNED);
  assert.equal(v.devices.index, 2);
  assert.equal(v.vm.natives.calls, 1);
  assert.equal(v.mem.read16(0x1c76), 1);
  assert.equal(v.mem.read16(0x1ca), 0x4000);
  assert.equal(v.vm.pc, 0x96c3);
  assert.equal(v.vm.s, 0x1ef0);
  assert.equal(v.driver.accessor.trace.filter((o) => o.pc === 0x00c118).length, 2);
  assert.equal(v.driver.accessor.io, null);
});
test('Native9F wait and F509 resume advance only on explicitly invoked scheduler rounds', () => {
  // Native9F: count 2, mask 1. Metadata and its C401 continuation are proved by
  // the existing native-wait contracts; this fixture supplies synthetic code.
  const v = setup([0x14, 2, 0, 0x14, 1, 0, 0x58, 0x9f, 0x56, 0], [mainSet(), mainSet(), mainSet()]);
  const slot = v.mem.read16(0x24c);
  assert.equal(v.driver.run(100), STOP_RETURNED);
  assert.equal(v.mem.read16(0xba2 + slot), 1);
  assert.equal(v.mem.read16(0xc02 + slot), 2);
  assert.equal(v.mem.read16(0x2b2 + slot), 0xf508);
  assert.equal(v.driver.run(100), STOP_RETURNED);
  assert.equal(v.mem.read16(0xc02 + slot), 1);
  assert.equal(v.driver.run(100), STOP_RETURNED);
  assert.equal(v.mem.read16(0x24c), 0xffff);
  assert.equal(v.driver.roundsCompleted, 3);
  assert.equal(v.devices.index, 3);
  assert.equal(v.mem.read16(0x1c76), 2);
  assert.equal(v.vm.pc, 0x96c3);
  assert.equal(v.vm.s, 0x1ef0);
});
test('an unsupported Native in a nested round keeps the real inner VM frontier instead of stale outer registers', () => {
  const v = setup([0x58, 0x63, 0x56, 0]);
  // Synthetic main helper exercises the already proved C1CA round adapter.
  v.driver.routines.set(0x808000, (h, e) => {
    h.call(0x8091d4, 0x80c1ca, () => e.round(0x80c1ca));
    return h.rts();
  });
  assert.throws(
    () => v.driver.run(100),
    (e) => e.reason === 'nested_round_stop' && e.details.stop === STOP_NATIVE,
  );
  assert.equal(v.vm.pc, 0xf4f6);
  assert.notEqual(v.vm.d, 0);
  assert.equal(v.driver.roundsCompleted, 0);
  assert.equal(v.driver.accessor.io, null);
});
test('both original main-loop exits stay boundaries before another wait or scheduler call', () => {
  for (const [offset, pc] of [
    [0x1fda, 0x96ec],
    [0x1fd8, 0x96f2],
  ]) {
    const v = setup(undefined, [mainSet()], 0);
    v.mem.write16(offset, 1);
    assert.throws(
      () => v.driver.run(10),
      (e) => e.reason === 'main_loop_boundary:main_loop_exit' && e.details.pc === pc,
    );
    assert.equal(v.driver.pending, false);
    assert.equal(v.driver.roundsCompleted, 0);
    assert.equal(v.mem.read16(0x1c76), 0xffff);
    assert.equal(v.driver.accessor.io, null);
  }
});

test('the proved 9688 prefix reaches the first top and live C1E3 frame before any post-round main helper', () => {
  const set = observationSet(MAIN_START_OBSERVATION_TARGET, mainSet()),
    v = setup(undefined, [set]);
  v.vm.pc = 0x9688;
  v.vm.push16(0xa156);
  v.mem.write16(0, 0xffff);
  v.driver.startRoutines = stubbableStart();
  // Preserve the synthetic allocated task from setup while independently
  // exercising the original prefix and real new-game data preparation.
  v.driver.startRoutines.set(0x809629, (h) => h.rts());
  v.driver.startRoutines.set(0x80a4bf, (h) => h.rts());
  v.driver.startRoutines.set(0x818861, (h) => h.rtl());
  v.driver.routines.set(0x808000, () => assert.fail('post-round gate ran before the first C1E3'));
  assert.equal(v.driver.run(0), STOP_BUDGET);
  assert.equal(v.driver.pending, true);
  assert.equal(v.driver.roundsCompleted, 0);
  assert.equal(v.mem.read16(0x1eed), 0x96c2);
  assert.equal(v.mem.read16(0x1eef), 0xa156);
  assert.equal(v.devices.index, 1);
  assert.equal(v.driver.resume(100), STOP_RETURNED);
  assert.equal(v.vm.s, 0x1eee);
  assert.equal(v.vm.pc, 0x96c3);
  assert.equal(v.mem.read16(0x1eef), 0xa156);
  assert.equal(v.driver.roundsCompleted, 1);
  assert.equal(v.mem.read16(0x7e2de4), 1);
});

test('A139 owns the actual A154 game frame across budgeted rounds, both main RTS and the next A157 menu', () => {
  for (const offset of [0x1fda, 0x1fd8]) {
    const first = observationSet(0x80a139, mainSet()),
      exit = observationSet(MAIN_OBSERVATION_TARGET, {}),
      next = observationSet(0x80a157, mainSet()),
      v = setup(undefined, [first, exit, next], 0);
    v.vm.pc = 0xa139;
    v.vm.a = 1;
    v.mem.sram = new Uint8Array(SRAM_SIZE);
    v.mem.sram[0x1ffe] = 3;
    const entries = [];
    v.driver.frontendRoutines = new Map(FRONTEND_ROUTINES);
    v.driver.frontendRoutines.set(0x80a18c, (h) => {
      entries.push(h.ctx.a);
      h.load(0xffff);
      return h.rts();
    });
    v.driver.frontendRoutines.set(0x81ef63, (h) => h.rtl());
    v.driver.startRoutines = stubbableStart();
    for (const t of [0x809629, 0x80a4bf]) v.driver.startRoutines.set(t, (h) => h.rts());
    v.driver.startRoutines.set(0x818861, (h) => h.rtl());
    assert.equal(v.driver.run(0), STOP_BUDGET);
    assert.equal(v.driver.ownsGame, true);
    assert.equal(v.driver.ownerReturnS, 0x1ef0);
    assert.equal(v.mem.read16(0x1eed), 0x96c2);
    assert.equal(v.mem.read16(0x1eef), 0xa156);
    assert.equal(v.mem.read16(0x1fd6), 3);
    assert.equal(v.driver.resume(100), STOP_RETURNED);
    v.mem.write16(offset, 1);
    assert.equal(v.driver.run(10), STOP_MAIN_OWNER_RETURN);
    assert.equal(v.driver.ownsGame, false);
    assert.equal(v.driver.pending, false);
    assert.equal(v.vm.pc, 0xa157);
    assert.equal(v.vm.s, 0x1ef0);
    assert.equal(v.driver.roundsCompleted, 1);
    assert.equal(v.devices.index, 2);
    // The first synthetic task ended in the preceding round; C1E3 now
    // returns immediately even with budget zero, just like the original.
    assert.equal(v.driver.run(0), STOP_RETURNED);
    assert.deepEqual(entries, [1, 0]);
    assert.equal(v.driver.ownsGame, true);
    assert.equal(v.mem.read16(0x1eef), 0xa156);
    assert.equal(v.mem.read16(offset), 0);
    assert.equal(v.driver.roundsCompleted, 2);
    assert.equal(v.devices.index, 3);
  }
});
test('owned main return rejects an altered A156 frame at its actual resulting PC', () => {
  const v = setup(null, [observationSet(MAIN_OBSERVATION_TARGET, {})], 0);
  v.driver.ownsGame = true;
  v.driver.ownerReturnS = 0x1ef0;
  v.vm.push16(0x1234);
  v.mem.write16(0x1fda, 1);
  assert.throws(
    () => v.driver.run(10),
    (e) => e.reason === 'main_owner_return_context' && e.address === 0x801235,
  );
  assert.equal(v.vm.pc, 0x1235);
  assert.equal(v.vm.s, 0x1ef0);
  assert.equal(v.driver.pending, false);
});
test('A133 runs its actual startup frame and LDA1 before the same budgeted menu/game owner', () => {
  const v = setup(
    undefined,
    [observationSet(0x80a133, { ...mainSet(), startupInterrupts: true })],
    0,
  );
  v.vm.pc = 0xa133;
  v.vm.a = 0x7654;
  v.mem.sram = new Uint8Array(SRAM_SIZE);
  v.driver.startupRoutines = withAudioReference(MAIN_STARTUP_ROUTINES);
  v.driver.startupRoutines.set(0x80a15c, (h, e) => {
    assert.equal(e.startupInterrupts, true);
    assert.equal(h.a.stackWord(), 0xa135);
    assert.equal(h.ctx.a, 0x7654);
    return h.rts();
  });
  v.driver.frontendRoutines = new Map(FRONTEND_ROUTINES);
  v.driver.frontendRoutines.set(0x80a18c, (h) => {
    assert.equal(h.ctx.a, 1);
    h.load(0xffff);
    return h.rts();
  });
  v.driver.frontendRoutines.set(0x81ef63, (h) => h.rtl());
  v.driver.startRoutines = stubbableStart();
  for (const target of [0x809629, 0x80a4bf]) v.driver.startRoutines.set(target, (h) => h.rts());
  v.driver.startRoutines.set(0x818861, (h) => h.rtl());
  // This synthetic test isolates owner frames and startup-mode forwarding;
  // unpack instruction chronology is compared separately against the ROM.
  v.driver.startRoutines.set(0x809f4d, (h, e) => {
    assert.equal(e.startupInterrupts, true);
    return h.rts();
  });
  assert.equal(v.driver.run(0), STOP_BUDGET);
  assert.equal(v.driver.ownsGame, true);
  assert.equal(v.mem.read16(0x1eef), 0xa156);
  assert.equal(v.mem.read16(0x1eed), 0x96c2);
  assert.equal(v.driver.resume(100), STOP_RETURNED);
  assert.equal(v.vm.pc, 0x96c3);
  assert.equal(v.vm.s, 0x1eee);
});

test('finite driver budgets preserve A133, E7BC and EED5 until the same original game and scheduler frames', () => {
  const waitPcs = [
    0x81eebb, 0x81eebc, 0x81eebe, 0x81eec0, 0x81eec9, 0x81eecd, 0x81eed1, 0x81eed3, 0x81eed4,
  ];
  for (const cold of [false, true]) {
    const entry = cold ? 0x00e382 : 0x80a133;
    const bootRecords = Array.from({ length: 394 }, () =>
      waitPcs.map((pc) => ({ pc, nmi: pc === 0x81eecd })),
    ).flat();
    const set = observationSet(entry, {
      ...mainSet(),
      interrupts: [...bootRecords, ...mainSet().interrupts],
      io: [
        ...Array.from({ length: 394 }, () => ({
          pc: 0x00c118,
          address: 0x804210,
          width: 2,
          value: 0x80,
        })),
        ...mainSet().io,
      ],
      interruptRoutines: MAIN_STARTUP_ROUTINES,
    });
    const prepare = () => {
      const v = setup(undefined, [set], 0, { resetProgramBank: 0 });
      v.vm.pc = entry & 65535;
      v.mem.sram = new Uint8Array(SRAM_SIZE);
      if (cold) {
        v.vm.e = 1;
        v.vm.p = 0x7b;
        v.vm.s = 0x1ff;
        v.vm.x = 0x34;
        v.vm.y = 0xcd;
        v.vm.dbr = 0;
      }
      v.driver.startupRoutines = withAudioReference(MAIN_STARTUP_ROUTINES);
      // Scene/SPC/SRAM helpers retain separate comparisons. This driver
      // fixture keeps the real complete E7BC, both fades, EED5 and EEBB.
      for (const target of [
        0x81eb97, 0x81ec16, 0x81ebe9, 0x81eb7b, 0x81eb89, 0x81ef07, 0x81d5ec, 0x81d5f4, 0x81ef36,
      ])
        v.driver.startupRoutines.set(target, (h) => {
          if (target === 0x81eb7b) {
            h.dpWrite(0x30, 0x80, 1);
            h.write(0x6e, 0xe839, 2);
            h.write(0x70, 0x81, 1);
          }
          return h.rtl();
        });
      v.driver.frontendRoutines = new Map(FRONTEND_ROUTINES);
      v.driver.frontendRoutines.set(0x80a18c, (h) => {
        h.load(0xffff);
        return h.rts();
      });
      v.driver.frontendRoutines.set(0x81ef63, (h) => {
        h.write(0x6e, 0xc152, 2);
        h.write(0x70, 0x80, 1);
        return h.rtl();
      });
      v.driver.startRoutines = stubbableStart();
      v.driver.startRoutines.set(0x809629, (h) => MAIN_START_ROUTINES.get(0x80c1a6)(h));
      for (const target of [0x80a4bf, 0x818861, 0x809f4d])
        v.driver.startRoutines.set(target, (h) => (target === 0x818861 ? h.rtl() : h.rts()));
      return v;
    };
    const n = prepare(),
      r = prepare();
    assert.equal(r.driver.run(0), STOP_RETURNED);
    const initial = n.mem.wram.slice(),
      ctx = n.vm.context();
    let stop = n.driver.run(0, { mainBudget: 0 }),
      pauses = 0,
      eed5 = 0;
    assert.equal(stop, STOP_MAIN_WAIT);
    assert.deepEqual(n.mem.wram, initial);
    assert.deepEqual(n.vm.context(), ctx);
    while (stop === STOP_MAIN_WAIT) {
      assert.ok(++pauses < 25000);
      assert.equal(n.devices.index, 1);
      assert.equal(n.driver.roundsCompleted, 0);
      const a = n.driver.accessor;
      if (
        a.ctx.programBank === 0x81 &&
        n.vm.pc === 0xeecd &&
        n.vm.s === (cold ? 0x131 : 0x1ee2) &&
        n.mem.read16((n.vm.s + 2) & 65535) === 0xeed8
      )
        eed5++;
      stop = n.driver.resume(0, { mainBudget: 1 });
    }
    assert.equal(stop, STOP_RETURNED);
    assert.ok(pauses > 10000);
    assert.ok(eed5 > 0);
    assert.deepEqual(n.vm.context(), r.vm.context());
    assert.deepEqual(n.mem.wram, r.mem.wram);
    assert.deepEqual(n.mem.sram, r.mem.sram);
    assert.deepEqual(n.driver.accessor.trace, r.driver.accessor.trace);
    assert.equal(n.devices.index, 1);
    assert.equal(n.driver.roundsCompleted, 1);
    assert.equal(n.driver.ownsGame, true);
    assert.equal(n.driver.ownerReturnS, cold ? 0x13f : 0x1ef0);
    assert.equal(n.mem.read16(cold ? 0x13e : 0x1eef), 0xa156);
  }
});
test('an observed reset branch abandons a pending round and keeps the original new 013F stack for the next game', () => {
  const resetSet = observationSet(0x809e2f, {
      ...mainSet(),
      io: [{ pc: 0x81f00e, address: 0x802140, width: 1, value: 0 }, ...mainSet().io],
    }),
    v = setup(undefined, [mainSet(), resetSet]);
  assert.equal(v.driver.run(0), STOP_BUDGET);
  v.vm.pc = 0x9e2f;
  v.vm.a = 0x3030;
  v.vm.p = 0x43;
  v.vm.d = 0;
  v.vm.dbr = 0x80;
  v.mem.sram = new Uint8Array(SRAM_SIZE);
  v.driver.startupRoutines = withAudioReference(MAIN_STARTUP_ROUTINES);
  v.driver.startupRoutines.set(0x80a15c, (h) => {
    assert.equal(h.a.stackWord(), 0xa135);
    return h.rts();
  });
  v.driver.frontendRoutines = new Map(FRONTEND_ROUTINES);
  v.driver.frontendRoutines.set(0x80a18c, (h) => {
    h.load(0xffff);
    return h.rts();
  });
  v.driver.frontendRoutines.set(0x81ef63, (h) => h.rtl());
  v.driver.startRoutines = stubbableStart();
  v.driver.startRoutines.set(0x809629, (h) => MAIN_START_ROUTINES.get(0x80c1a6)(h));
  v.driver.startRoutines.set(0x80a4bf, (h) => h.rts());
  v.driver.startRoutines.set(0x818861, (h) => h.rtl());
  assert.equal(v.driver.run(0), STOP_RETURNED);
  assert.equal(v.driver.pending, false);
  assert.equal(v.driver.ownsGame, true);
  assert.equal(v.driver.ownerReturnS, 0x13f);
  assert.equal(v.vm.e, 0);
  assert.equal(v.vm.s, 0x13d);
  assert.equal(v.mem.read16(0x13e), 0xa156);
  assert.equal(v.vm.pc, 0x96c3);
  assert.equal(v.driver.roundsCompleted, 1);
  assert.equal(v.devices.index, 2);
  assert.throws(
    () => v.driver.resume(),
    (e) => e.reason === 'main_round_not_active',
  );
});
test('a reset branch with stale A or flags preserves the pending round and observation cursor', () => {
  for (const corrupt of [(v) => (v.vm.a = 0x3031), (v) => (v.vm.p &= ~2)]) {
    const v = setup();
    assert.equal(v.driver.run(0), STOP_BUDGET);
    v.vm.pc = 0x9e2f;
    v.vm.a = 0x3030;
    v.vm.p = 0x43;
    v.vm.d = 0;
    v.vm.dbr = 0x80;
    corrupt(v);
    const ctx = v.vm.context(),
      wram = v.mem.wram.slice();
    assert.throws(
      () => v.driver.run(),
      (e) => e.reason === 'main_driver_entry_required',
    );
    assert.deepEqual(v.vm.context(), ctx);
    assert.deepEqual(v.mem.wram, wram);
    assert.equal(v.driver.pending, true);
    assert.equal(v.devices.index, 1);
  }
});

test('reset DMA or startup instruction observations require interrupts before consuming the pending owner', () => {
  for (const extra of [{ dmaTransfers: [] }, { startupInterrupts: true }]) {
    const v = setup(undefined, [mainSet(), observationSet(0x809e2f, extra)]);
    assert.equal(v.driver.run(0), STOP_BUDGET);
    v.driver.ownsGame = true;
    v.vm.pc = 0x9e2f;
    v.vm.a = 0x3030;
    v.vm.p = 0x43;
    v.vm.d = 0;
    v.vm.dbr = 0x80;
    const ctx = v.vm.context(),
      wram = v.mem.wram.slice();
    assert.throws(
      () => v.driver.run(),
      (e) => e.reason === 'interrupt_observations_required',
    );
    assert.deepEqual(v.vm.context(), ctx);
    assert.deepEqual(v.mem.wram, wram);
    assert.equal(v.driver.pending, true);
    assert.equal(v.driver.ownsGame, true);
    assert.equal(v.devices.index, 1);
  }
});
test('the observed 3030 branch and both physical E1 reset program banks start a new owned game on the same VM', () => {
  for (const [cold, resetProgramBank] of [
    [false, 0x80],
    [true, 0],
    [true, 0x80],
  ]) {
    const first = mainSet({
        interrupts: mainSet().interrupts.slice(0, 12),
        io: mainSet().io.map((o) => (o.pc === 0x809e13 ? { ...o, value: 0x3030 } : o)),
      }),
      restart = observationSet(cold ? (resetProgramBank << 16) | 0xe382 : 0x809e2f, {
        ...mainSet(),
        io: [
          ...(cold ? [] : [{ pc: 0x81f00e, address: 0x802140, width: 1, value: 0 }]),
          ...mainSet().io,
        ],
      }),
      v = setup(undefined, cold ? [restart] : [first, restart], 1, { resetProgramBank });
    if (cold) {
      v.vm.pc = 0xe382;
      v.vm.e = 1;
      v.vm.p = 0x7b;
      v.vm.s = 0x1ff;
      v.vm.x = 0x34;
      v.vm.y = 0xcd;
      v.vm.dbr = 0;
    } else {
      assert.throws(
        () => v.driver.run(),
        (e) => e.reason === 'main_loop_boundary:task_reset_source_required',
      );
      assert.equal(v.vm.pc, 0x9e2f);
      assert.equal(v.vm.a, 0x3030);
      assert.ok(v.vm.p & 2);
    }
    v.mem.sram = new Uint8Array(SRAM_SIZE);
    v.driver.startupRoutines = withAudioReference(MAIN_STARTUP_ROUTINES);
    v.driver.startupRoutines.set(0x80a15c, (h) => h.rts());
    v.driver.frontendRoutines = new Map(FRONTEND_ROUTINES);
    v.driver.frontendRoutines.set(0x80a18c, (h) => {
      h.load(0xffff);
      return h.rts();
    });
    v.driver.frontendRoutines.set(0x81ef63, (h) => h.rtl());
    v.driver.startRoutines = stubbableStart();
    v.driver.startRoutines.set(0x809629, (h) => MAIN_START_ROUTINES.get(0x80c1a6)(h));
    v.driver.startRoutines.set(0x80a4bf, (h) => h.rts());
    v.driver.startRoutines.set(0x818861, (h) => h.rtl());
    assert.equal(v.driver.run(0), STOP_RETURNED);
    assert.equal(v.vm.e, 0);
    assert.equal(v.vm.s, 0x13d);
    assert.equal(v.vm.dbr, 0x80);
    assert.equal(v.vm.pc, 0x96c3);
    assert.equal(v.mem.read16(0x13e), 0xa156);
    assert.equal(v.driver.ownerReturnS, 0x13f);
    if (cold) assert.equal(v.vm.natives.accessor.trace[0].pc, (resetProgramBank << 16) | 0xe383);
    assert.equal(v.mem.read16(0x24c), 0xffff);
    assert.equal(v.driver.roundsCompleted, 1);
    assert.equal(v.devices.index, cold ? 1 : 2);
  }
});

test('driver rejects an unproved reset program bank before consuming observations', () => {
  const v = setup(),
    before = v.vm.context();
  for (const resetProgramBank of [-1, 1, 0x7e, 0x81, 256, null])
    assert.throws(
      () => new MainLoopDriver(v.vm, { resetProgramBank }),
      (e) => e.reason === 'main_reset_program_bank_required',
    );
  assert.equal(v.devices.index, 0);
  assert.deepEqual(v.vm.context(), before);
});
// FF79 from a synthetic script inside the real round (no script arguments). Its interrupt/device/DMA
// records are synthetic and rebuilt from the synchronous stops; the alternating
// busy poll makes every taken NMI pause in 9E0B under the main work budget.
test('a resumable special native inside the round returns STOP_NATIVE_WAIT and resumes to the same original round end', () => {
  const seed = (mem) => {
    for (const [address, value] of ff79Fixture({
      bank: 0x80,
      flags: [1, 1, 1, 1],
      last: 6,
      slots: [0, 2, 4, 6],
      counter: 0,
    }).snapshot().bytes)
      if (address >= 0x7e0000 && address <= 0x7fffff) mem.write8(address, value);
  };
  const code = [0x58, 0xa7, 0x56, 0],
    records = [],
    io = [],
    dma = [];
  const sets = () => [
    mainSet(),
    observationSet(0x80ff79, {
      io,
      interrupts: records,
      interruptRoutines: GAME_NMI_ROUTINES,
      dmaTransfers: dma,
    }),
  ];
  let r;
  for (let attempt = 0; ; attempt++) {
    assert.ok(attempt < 4000);
    r = setup(code, sets(), 1, {}, seed);
    try {
      assert.equal(r.driver.run(1000), STOP_RETURNED);
      break;
    } catch (error) {
      const reason = error?.reason?.replace('native_boundary:', '');
      if (reason === 'wait_interrupt_observation_required') {
        const pc = error.details.pc;
        records.push({ pc, nmi: records.filter((o) => o.pc === pc).length >= 2 });
      } else if (reason === 'device_observation_required') {
        const offset = error.address & 65535;
        io.push({
          pc: error.details.pc,
          address: error.address,
          width: error.details.width,
          value:
            offset === 0x4212
              ? io.findLast((o) => (o.address & 65535) === 0x4212)?.value === 1
                ? 0
                : 1
              : (new Map([
                  [0x4210, 0x80],
                  [0x4218, 0x8000],
                  [0x2134, 1],
                ]).get(offset) ?? 0),
        });
      } else if (reason === 'text_dma_observation_required')
        dma.push(textDma(r.mem.read16(0x20e), dma.length));
      else throw error;
    }
  }
  assert.ok(records.some((o) => o.nmi));
  assert.equal(r.vm.natives.calls, 1);
  const n = setup(code, sets(), 1, {}, seed);
  let stop = n.driver.run(1000, { mainBudget: 1 }),
    mainWaits = 0,
    nativeWaits = 0;
  for (;;) {
    if (stop === STOP_MAIN_WAIT) mainWaits++;
    else if (stop === STOP_NATIVE_WAIT) {
      nativeWaits++;
      assert.equal(n.vm.natives.pending?.target, 0x80ff79);
    } else break;
    assert.ok(mainWaits + nativeWaits < 200000);
    stop = n.driver.resume(1000, { mainBudget: 1 });
  }
  assert.equal(stop, STOP_RETURNED);
  assert.ok(mainWaits > 0);
  assert.ok(nativeWaits > records.length);
  assert.equal(n.vm.natives.workBudget, Infinity);
  assert.equal(n.vm.natives.pending, null);
  assert.deepEqual(n.vm.context(), r.vm.context());
  assert.deepEqual(n.mem.wram, r.mem.wram);
  assert.deepEqual(n.vm.natives.accessor.trace, r.vm.natives.accessor.trace);
  assert.equal(n.devices.index, 2);
});
