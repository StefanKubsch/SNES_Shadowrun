// Dialog topic action ($9178 from $91CA): append a task ($C34A) and visit it immediately ($C1CA) as a
// nested scheduler round from the native. Compare with the same steps directly on TaskScheduler
// (JSR frames pushed from $91D1/$91D4). This checks the connection between native and scheduler
// (registers in both directions, saved accessor, natives during the round); C34A and C1CA have separate proofs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { VmMemory, WRAM_SIZE } from '../src/vm/memory.mjs';
import { ScriptInterpreter } from '../proof/vm/interpreter.mjs';
import { TaskScheduler, STOP_RETURNED } from '../proof/vm/scheduler.mjs';
import { NativeCalls } from '../proof/vm/native-call.mjs';
import { NATIVE_POINTERS } from '../src/vm/layout.mjs';
import { ObservedDevices, observationSet } from '../proof/vm/observed-devices.mjs';
import { SPECIAL_NATIVES } from '../proof/vm/special-natives.mjs';
import { nativeOpcodeTargets } from '../src/data/native-opcode-targets.mjs';
import { nativeTarget } from '../src/script/native-targets.mjs';
import { dialogAccess } from '../src/system/native-dialog-support.mjs';
import { dialogTextRoutines, dialogTopicSequence } from '../proof/replay/native-dialog-text.mjs';
import { NativeCallContinuation } from '../src/system/native-call-continuation.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import { WEAPON_MENU_ROUTINES } from '../proof/replay/native-member-spell-menu.mjs';
import { prng, rom } from './vm-differential.mjs';
import { randomFeed } from './vm-special-natives-differential.mjs';

const romBytes = new Uint8Array(rom.buffer, rom.byteOffset, rom.length);
const romByte = (address) => rom[(((address >>> 16) & 0x7f) << 15) | (address & 0x7fff)];
const romWord = (address) => romByte(address) | (romByte(address + 1) << 8);

// Action scripts for dialog records (table 80:94F7, bank 8D) as read by $9178: key, length,
// flag byte (bit 7 action, low nibble is the number of topic IDs), IDs, action word, text word; terminator F8.
export function dialogActionScripts(dialogs = 0x89) {
  const scripts = new Set();
  for (let id = 0; id < dialogs; id++) {
    const base = 0x8d0000 | romWord(0x8094f7 + id * 2);
    for (let y = 4, guard = 0; romByte(base + y) !== 0xf8 && guard < 64; guard++) {
      const flags = romByte(base + y + 2);
      if (flags & 0x80) scripts.add(romWord(base + y + 3 + (flags & 0xf)));
      y += 1 + romByte(base + y + 1);
    }
  }
  return [...scripts].sort((a, b) => a - b);
}

const STACK = 0x1fb0,
  CALLER_SCRIPT = 0x2c2,
  RECORD = 0x7f8000;
// Scheduler with a running dialog task (cursor) and other tasks; record [11] holds the action word.
function scenario(rnd, script) {
  const wram = new Uint8Array(WRAM_SIZE);
  for (let n = 0x1000; n < 0x2000; n++) if (rnd() < 0.1) wram[n] = (rnd() * 256) | 0;
  const vm = new ScriptInterpreter(new VmMemory(romBytes, wram)),
    scheduler = new TaskScheduler(vm);
  vm.dbr = 0x80;
  vm.s = STACK;
  vm.d = 0;
  vm.p = 0;
  vm.push16(0x1234);
  assert.equal(scheduler.call(0xc1a6), STOP_RETURNED);
  for (const id of [0x10, CALLER_SCRIPT]) {
    vm.x = id;
    vm.push16(0x1234);
    assert.equal(scheduler.call(0xc34a), STOP_RETURNED);
  }
  vm.mem.write16(0x800250, vm.mem.read16(0x80024c));
  const y = (rnd() * 8) | 0;
  wram[RECORD - 0x7e0000 + y] = script & 0xff;
  wram[RECORD - 0x7e0000 + y + 1] = script >>> 8;
  vm.mem.write16(0x800011, RECORD & 0xffff);
  vm.mem.write8(0x800013, RECORD >>> 16);
  vm.mem.write16(0x800026, (rnd() * 0x60) | 0);
  return { wram, context: { a: 0, x: 0, y, s: STACK, d: 0, bank: 0x80, status: 0x01 } };
}

const fresh = (state) => {
  const vm = new ScriptInterpreter(new VmMemory(romBytes, state.wram.slice()));
  vm.a = state.context.a;
  vm.x = state.context.x;
  vm.y = state.context.y;
  vm.s = state.context.s;
  vm.d = 0;
  vm.dbr = 0x80;
  vm.p = state.context.status;
  vm.pc = 0x91ca;
  return vm;
};
const natives = (vm, sets) =>
  new NativeCalls(vm, {
    admitted: nativeOpcodeTargets,
    implementation: nativeTarget,
    devices: new ObservedDevices(sets.map((set) => observationSet(set.target, set))),
  });

// Native side: topic action through the dialog routines with the NativeCalls round.
const topic = (h, events) => dialogTextRoutines(events).topic(h);
function viaNative(state, sets, action = topic) {
  const vm = fresh(state);
  vm.natives = natives(vm, sets);
  const accessor = vm.natives.accessor;
  accessor.load();
  accessor.entry = 0x80936c;
  accessor.io = Object.freeze([]);
  accessor.ioIndex = 0;
  const events = {
    values: null,
    waitIndex: 0,
    inputs: null,
    inputIndex: 0,
    round: (entry) => vm.natives.round(entry),
    nestedRound: (entry) => vm.natives.nestedRound(entry),
  };
  const h = dialogAccess(accessor);
  try {
    action(h, events);
  } catch (error) {
    return { vm, fault: error };
  }
  assert.equal(accessor.io.length, 0);
  accessor.store();
  return { vm, fault: null };
}
// Comparison: LDA [11],Y / TAX / LDA $26 / STA $00 / JSR $C34A / JSR $C1CA directly on the scheduler.
const topicSteps = (vm) => {
  vm.x = vm.mem.read16(RECORD + vm.y);
  vm.a = vm.mem.read16Bank0(0x26);
  vm.mem.write16Bank0(0, vm.a);
  return [0x91d3, 0x91d6];
};
function viaScheduler(state, sets, steps = topicSteps) {
  const vm = fresh(state),
    scheduler = new TaskScheduler(vm);
  vm.natives = natives(vm, sets);
  const [append, visit] = steps(vm);
  vm.push16(append);
  assert.equal(scheduler.call(0xc34a), STOP_RETURNED);
  // Optional native writes between calls (F254: STZ $1F58).
  if (typeof visit === 'object') {
    visit.after(vm);
    vm.push16(visit.pc);
  } else vm.push16(visit);
  try {
    return { vm, stop: scheduler.call(0xc1ca), error: null };
  } catch (error) {
    return { vm, stop: null, error };
  }
}

// Observations as needed (like runObserved): special native without a set during the round, device reads, waits.
function observe(state, rnd, action = topic) {
  const sets = [],
    feed = randomFeed(rnd);
  for (let n = 0; n < 2000; n++) {
    const run = viaNative(state, sets, action),
      fault = run.fault;
    if (fault === null) return { sets, run };
    const details = fault.details ?? {};
    if (fault.reason === 'nested_round_stop' && run.vm.pc === 0xf4f6) {
      const target = 0x800000 | run.vm.mem.read16(NATIVE_POINTERS + run.vm.x);
      if (SPECIAL_NATIVES.has(target) && run.vm.natives.devices.index === sets.length) {
        sets.push({ target, io: [], wait: [], input: [] });
        continue;
      }
    }
    const set = sets.at(-1);
    if (set && fault.reason === 'device_observation_required') {
      set.io.push({
        pc: details.pc,
        address: fault.address,
        width: details.width,
        value: feed.io(fault, run.vm.mem),
      });
      continue;
    }
    if (set && fault.reason === 'native_boundary:task_wait_observation_required') {
      set.wait.push({
        pc: details.pc,
        address: details.address,
        width: 2,
        value: feed.wait(details),
      });
      continue;
    }
    if (set && fault.reason === 'native_boundary:task_input_observation_required') {
      set.input.push({
        pc: details.pc,
        address: details.address,
        width: 2,
        value: feed.input(details),
      });
      continue;
    }
    return { sets, run };
  }
  throw Error('Observations did not terminate');
}

// Native against scheduler for a list of scripts; returnPc is the PC after JSR $C1CA.
function compareRounds(scripts, seeds, action, steps, returnPc) {
  const tally = {};
  for (const script of scripts)
    for (let k = 0; k < seeds; k++) {
      const rnd = prng(script * 16 + k),
        state = scenario(rnd, script),
        label = `Script $${script.toString(16)} #${k}`;
      const { sets, run } = observe(state, rnd, action(script)),
        ref = viaScheduler(state, sets, steps(script));
      const outcome =
        run.fault === null
          ? 'returned'
          : run.fault.reason === 'nested_round_stop'
            ? 'stop-' + run.fault.details.stop
            : 'fault';
      // Errors inside the round (natives on random data): both sides match.
      if (outcome === 'fault')
        assert.equal(
          String(ref.error?.reason ?? ref.error?.message),
          String(run.fault.reason ?? run.fault.message),
          label,
        );
      else if (run.fault === null) {
        assert.equal(ref.stop, STOP_RETURNED, label);
        assert.equal(run.vm.pc, returnPc, label);
      } else assert.equal(ref.stop, run.fault.details.stop, label);
      for (const key of ['a', 'x', 'y', 's', 'd', 'dbr', 'p', 'pc'])
        assert.equal(run.vm[key], ref.vm[key], `${label}: ${key}`);
      assert.ok(
        Buffer.from(run.vm.mem.wram).equals(Buffer.from(ref.vm.mem.wram)),
        `${label}: WRAM`,
      );
      tally[outcome] = (tally[outcome] ?? 0) + 1;
      // Run natives that reach the access limit on this synthetic data (such as $913C) only once.
      if (run.fault?.reason === 'native_access_limit') break;
      if (sets.length) tally.nestedSpecial = (tally.nestedSpecial ?? 0) + 1;
      if (run.vm.natives.calls) tally.nestedNatives = (tally.nestedNatives ?? 0) + 1;
    }
  return tally;
}

test('Topic action: native round matches direct C34A and C1CA on the scheduler', () => {
  const scripts = dialogActionScripts();
  assert.ok(scripts.length >= 50, `${scripts.length} action scripts`);
  const tally = compareRounds(
    scripts,
    2,
    () => topic,
    () => topicSteps,
    0x91d7,
  );
  assert.ok(
    tally.returned >= 15 && tally.nestedNatives >= 10 && tally.nestedSpecial >= 3,
    JSON.stringify(tally),
  );
});

// The same topic action as a continuation in chunks of 40 opcodes: C1CA as a pausable round
// (NativeCalls.nestedRound) pauses between chunks and finishes like the scheduler run.
test('Topic action: pausable round in small budgets matches direct C34A and C1CA on the scheduler', () => {
  let pauses = 0;
  const paused = () => (h, events) => {
    const continuation = new NativeCallContinuation(h.a, dialogTopicSequence(h, events));
    while (continuation.run(40) === WAIT_PAUSED) pauses++;
  };
  const tally = compareRounds(dialogActionScripts(), 2, paused, () => topicSteps, 0x91d7);
  assert.ok(tally.returned >= 15 && pauses >= 100, JSON.stringify({ ...tally, pauses }));
});

// Weapon menu $E693 (Native01/F254): script $1E2D to X, argument $1E3D to DP00, JSR $C34A at $E788,
// STZ $1F58, JSR $C1CA at $E78E through WEAPON_MENU_ROUTINES. Scripts from column $E804.
const WEAPON_SCRIPTS = [6, 7, 8, 9, 10, 11].map((y) => romWord(0x80e804 + 2 * y));
const weaponArgument = (script) => 1 + (script % 5);
test('Weapon menu: F254 round matches direct C34A and C1CA on the scheduler', () => {
  assert.deepEqual(WEAPON_SCRIPTS, [0x2d9, 0x20c, 0x77, 0x1fc, 0x205, 0x37]);
  const action = (script) => (h, events) => {
    h.index('x', script);
    h.dpWrite(0, weaponArgument(script), 2);
    h.call(0x80e788, 0x80c34a, () => WEAPON_MENU_ROUTINES.get(0x80c34a)(h, events));
    h.write(h.abs(0x1f58), 0, 2);
    h.call(0x80e78e, 0x80c1ca, () => WEAPON_MENU_ROUTINES.get(0x80c1ca)(h, events));
  };
  const steps = (script) => (vm) => {
    vm.x = script;
    vm.mem.write16Bank0(0, weaponArgument(script));
    vm.p = (vm.p & ~0x82) | (script & 0x8000 ? 0x80 : 0) | (script ? 0 : 2);
    return [0xe78a, { after: (vm2) => vm2.mem.write16(0x801f58, 0), pc: 0xe790 }];
  };
  const tally = compareRounds(WEAPON_SCRIPTS, 6, action, steps, 0xe791);
  // Most scripts hit the same error inside the round on random data.
  assert.ok(
    tally.returned >= 3 && tally.nestedNatives >= 20 && tally.nestedSpecial >= 10,
    JSON.stringify(tally),
  );
});

test('Topic action without a round remains an explicit boundary', () => {
  const state = scenario(prng(1), 0x396),
    vm = fresh(state);
  vm.natives = natives(vm, []);
  vm.natives.accessor.load();
  assert.throws(
    () =>
      dialogTextRoutines({ values: null, waitIndex: 0 }).topic(dialogAccess(vm.natives.accessor)),
    (error) => error?.reason === 'task_dialog_topic_visit_open',
  );
});
