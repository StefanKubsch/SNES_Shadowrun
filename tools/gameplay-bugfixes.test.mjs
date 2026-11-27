import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import {
  createTask,
  finishCall,
  scriptInfo,
  runTask,
  EXIT_END,
  EXIT_BUDGET,
  EXIT_NATIVE,
} from './script-interpreter.mjs';
import { nativeTarget as nativeEntry } from '../src/script/natives.mjs';
import { TaskAccessor } from './register-forms/task-accessor.mjs';
import { nativeTarget as nativeImplementation } from '../src/script/native-targets.mjs';
import { setItemPropertyAndUnequip as setItemPropertyAndUnequipLifted } from '../src/script/native-object-record-property-equip.mjs';
import { setActorItemPropertyAndUnequip as setActorItemPropertyAndUnequipLifted } from '../src/script/native-record-property-equip.mjs';
import { getActorStateFlags as getActorStateFlagsLifted } from '../src/script/native-record-flags-get.mjs';
import { setActorStateFlags as setActorStateFlagsLifted } from '../src/script/native-record-flags-set.mjs';
import { setUpNewGameState, loadSavedGame } from '../src/game/game-start.mjs';
import {
  DEFAULT_GAMEPLAY,
  ORIGINAL_GAMEPLAY,
  gameplaySettings,
  storedGameplay,
  fixesEnabled,
  preparePushkinTopics,
} from '../src/game/bugfixes.mjs';
import { leafRts } from './register-forms/leaf-return.mjs';
// The natives with the RTS of their register-level entry (2026-11-27).
const setItemPropertyAndUnequip = leafRts(setItemPropertyAndUnequipLifted);
const setActorItemPropertyAndUnequip = leafRts(setActorItemPropertyAndUnequipLifted);
const getActorStateFlags = leafRts(getActorStateFlagsLifted);
const setActorStateFlags = leafRts(setActorStateFlagsLifted);

const manifest = JSON.parse(readFileSync(new URL('../assets/vm-cartridge.json', import.meta.url)));
const scripts = JSON.parse(
  readFileSync(new URL('../assets/scripts.json', import.meta.url)),
).scripts;
const runners = JSON.parse(
  readFileSync(new URL('../assets/vm-runners.json', import.meta.url)),
).runners;
const FRAME = 0x600;
function fixture(gameplay = DEFAULT_GAMEPLAY) {
  const mem = new VmMemory(
    cartridge.rom,
    new Uint8Array(0x20000),
    new Uint8Array(0x2000),
    cartridge.present,
  );
  // The settings the natives read through their accessor's VM (a.vm.gameplay).
  const vm = { mem, a: 0, x: 0, y: 0, s: 0x1eee, d: 0, dbr: 0x80, p: 0, pc: 0 };
  vm.gameplay = gameplaySettings(gameplay);
  const a = new TaskAccessor(vm);
  a.load();
  return { mem, vm, a };
}
function invoke(f, run, args) {
  args.forEach((v, i) => f.mem.write16Bank0(i * 2, v));
  f.a.ctx.s = 0x1eee;
  f.a.ctx.status = 0;
  f.a.ctx.bank = 0x80;
  return run(f.a, false);
}
// Script id from byte offset on the reference interpreter (tools/script-interpreter.mjs).
// Its frame words stay where the natives look for the running script (task 0 at
// FRAME); the lifted natives (src/script/native-targets.mjs) answer its calls.
function scriptFixture(id, offset = 0, gameplay = DEFAULT_GAMEPLAY) {
  const f = fixture(gameplay),
    { mem } = f;
  const cpu = manifest.scripts.scriptAddresses[id] + 2;
  mem.write16Bank0(FRAME, cpu & 65535);
  mem.write8(FRAME + 2, cpu >>> 16);
  mem.write16Bank0(0x250, 0);
  mem.write16Bank0(0x252, FRAME);
  const args = new Array(scriptInfo(mem, id).argumentBytes >>> 1).fill(0);
  f.task = createTask(mem, id, args);
  f.task.pc = offset;
  return f;
}
// Run the script until its PC reaches stop (or its END); returns the last exit kind.
function runScript(f, stop = null, limit = 1000) {
  const { mem, task } = f;
  for (let step = 0; step < limit; step++) {
    if (task.pc === stop) return EXIT_BUDGET;
    const exit = runTask(mem, task, 1);
    if (exit.kind === EXIT_END) return EXIT_END;
    if (exit.kind === EXIT_NATIVE) {
      exit.args.forEach((value, n) => mem.write16Bank0(2 * n, value));
      nativeImplementation(nativeEntry(mem, exit.id))(f.a, false);
      finishCall(mem, task, mem.read16Bank0(0));
    } else if (exit.kind !== EXIT_BUDGET) throw new Error(`script exit ${exit.kind}`);
  }
  throw new Error('script step limit');
}

test('product defaults enable fixes; original and damaged preferences are explicit', () => {
  assert.equal(DEFAULT_GAMEPLAY.bugfixes, true);
  assert.equal(DEFAULT_GAMEPLAY.preventExploits, false);
  assert.equal(storedGameplay(null), DEFAULT_GAMEPLAY);
  assert.equal(storedGameplay('{'), DEFAULT_GAMEPLAY);
  assert.deepEqual(storedGameplay(JSON.stringify(ORIGINAL_GAMEPLAY)), ORIGINAL_GAMEPLAY);
  // instantText: stored browser settings without the key get the default (on);
  // recordings without it keep the original frame timing.
  const { instantText, ...withoutInstantText } = ORIGINAL_GAMEPLAY;
  assert.equal(instantText, false);
  assert.equal(DEFAULT_GAMEPLAY.instantText, true);
  assert.equal(storedGameplay(JSON.stringify(withoutInstantText)).instantText, true);
  assert.equal(gameplaySettings(withoutInstantText).instantText, false);
  // aimReleaseFix: recordings without the key keep the earlier aim release.
  const { aimReleaseFix, ...withoutAimRelease } = DEFAULT_GAMEPLAY;
  assert.equal(aimReleaseFix, true);
  assert.equal(ORIGINAL_GAMEPLAY.aimReleaseFix, false);
  assert.equal(storedGameplay(JSON.stringify(withoutAimRelease)).aimReleaseFix, true);
  assert.equal(gameplaySettings(withoutAimRelease).aimReleaseFix, false);
  assert.throws(
    () => gameplaySettings({ ...DEFAULT_GAMEPLAY, instantText: 1 }),
    /gameplay_settings_required/,
  );
  for (const bad of [
    null,
    { ...DEFAULT_GAMEPLAY, version: 2 },
    { ...DEFAULT_GAMEPLAY, bugfixes: 1 },
  ])
    assert.throws(() => gameplaySettings(bad), /gameplay_settings_required/);
});

test('both removal entries restore all 13 actual default weapons, including empty weapons, repeatedly', () => {
  for (const run of [setItemPropertyAndUnequip, setActorItemPropertyAndUnequip])
    for (const settings of [ORIGINAL_GAMEPLAY, DEFAULT_GAMEPLAY])
      for (let runner = 0; runner < runners.length; runner++) {
        const f = fixture(settings),
          { mem } = f,
          row = 8 * runner,
          borrowed = 0x1f48,
          slot = 0x12;
        const record = mem.read16(0x8db020 + borrowed);
        mem.write16Bank0(0x150a + slot, borrowed);
        mem.write16Bank0(0x13a8 + slot, record);
        const armour = [0x44, 0x33, 7];
        mem.wram.set(armour, 0x3c2e + row);
        for (let cycle = 0; cycle < 2; cycle++) {
          mem.write16(0x7e3c31 + row, borrowed);
          mem.wram.set([9, 250, 128], 0x3c33 + row);
          invoke(f, run, [run === setItemPropertyAndUnequip ? slot : borrowed, 0xffff]);
          const weapon = runners[runner].weapon;
          assert.equal(mem.read16(0x7e3c31 + row), parseInt(weapon.object, 16));
          const actual = Array.from(mem.wram.slice(0x3c33 + row, 0x3c36 + row));
          const id = parseInt(weapon.object, 16);
          assert.deepEqual(
            actual,
            settings.bugfixes
              ? [weapon.kind, weapon.damage, weapon.range & 255]
              : [id & 255, id >>> 8, id & 255],
          );
          assert.deepEqual(Array.from(mem.wram.slice(0x3c2e + row, 0x3c31 + row)), armour);
          assert.equal(mem.read16(0x7e0003 + record), 0xffff);
        }
      }
});

test('Akimi rechecks Charisma and physical capacity without consuming her reservation or changing the party', () => {
  assert.equal(manifest.scripts.scriptAddresses[0x38c] + 2, 0x9ef44b);
  for (const settings of [ORIGINAL_GAMEPLAY, DEFAULT_GAMEPLAY])
    for (const charisma of [3, 4, 5, 6])
      for (const last of [0, 2, 4, 6, 8]) {
        const f = fixture(settings),
          { mem } = f;
        mem.write16Bank0(0x250, 0);
        mem.write16Bank0(0x252, FRAME);
        mem.write16Bank0(FRAME, 0xf44b);
        mem.write8(FRAME + 2, 0x9e);
        mem.write8(0x7e3405, 0xa0);
        mem.write8(0x7e3bff, charisma);
        mem.write16(0x7e2de6, last);
        mem.wram.fill(0x5a, 0x2de8, 0x2e00);
        const before = mem.wram.slice(0x2de6, 0x2e00);
        invoke(f, getActorStateFlags, [0x1b6d]);
        const limit = charisma <= 3 ? 2 : charisma <= 5 ? 4 : 6;
        assert.equal(mem.read16Bank0(0), settings.bugfixes && last >= limit ? 0x20 : 0xa0);
        assert.equal(mem.read8(0x7e3405), 0xa0);
        assert.deepEqual(mem.wram.slice(0x2de6, 0x2e00), before);
        // The same reservation succeeds on a later visit with space.
        mem.write16(0x7e2de6, 0);
        invoke(f, getActorStateFlags, [0x1b6d]);
        assert.equal(mem.read16Bank0(0), 0xa0);
        // Other scripts (including the phone menu) still see the reservation.
        mem.write16Bank0(FRAME, 0x8000);
        mem.write16(0x7e2de6, 6);
        invoke(f, getActorStateFlags, [0x1b6d]);
        assert.equal(mem.read16Bank0(0), 0xa0);
      }
});

test('the original arrival condition takes its harmless exit when a paid Akimi has no room', () => {
  const f = scriptFixture(0x38c),
    { mem } = f;
  mem.write16(0x7e2de6, 6);
  mem.write8(0x7e3bff, 6);
  mem.write8(0x7e3405, 0xa0);
  // Stop after the condition and branch (at A3), before the proxy's normal release.
  assert.equal(runScript(f, 0xa3), EXIT_BUDGET);
  assert.equal(mem.read8(0x7e3405), 0xa0);
  assert.equal(mem.read16(0x7e2de6), 6);
});

test('Pushkin teaches or reactivates Head Computer when its dialog prepares the topics, with stable parallel flags', () => {
  for (const settings of [ORIGINAL_GAMEPLAY, DEFAULT_GAMEPLAY])
    for (const alreadyKnown of [false, true]) {
      const f = fixture(settings),
        { mem } = f;
      const ids = alreadyKnown ? [0, 15, 20, 38, 255] : [0, 15, 38, 255];
      mem.wram.set(ids, 0x3ca3);
      mem.wram.set([1, 2, 255, 4], 0x3cd6);
      const before = mem.wram.slice(0x3ca3, 0x3d09);
      // The lifted dialog entry (src/game/dialog-talk.mjs) prepares the topics of
      // record 67 when the fixes are on.
      if (fixesEnabled(f.a)) preparePushkinTopics(f.a, 67);
      if (!settings.bugfixes) assert.deepEqual(mem.wram.slice(0x3ca3, 0x3d09), before);
      else {
        assert.deepEqual(Array.from(mem.wram.slice(0x3ca3, 0x3ca8)), [0, 15, 20, 38, 255]);
        assert.deepEqual(Array.from(mem.wram.slice(0x3cd6, 0x3cda)), [
          1,
          2,
          0,
          alreadyKnown ? 4 : 255,
        ]);
      }
    }
  const full = fixture();
  full.mem.wram.set(Array.from({ length: 50 }, (_, i) => (i < 20 ? i : i + 1)).concat(255), 0x3ca3);
  const before = full.mem.wram.slice();
  assert.throws(() => preparePushkinTopics(full.a, 67), /gameplay_topic_list_full/);
  assert.deepEqual(full.mem.wram, before);
});

test('new game unlocks the actual vest record and save loading preserves bought or removed items', () => {
  for (const settings of [ORIGINAL_GAMEPLAY, DEFAULT_GAMEPLAY]) {
    const f = fixture(settings);
    setUpNewGameState(f.a);
    assert.equal(f.mem.read16(0x7e381e), settings.bugfixes ? 0 : 0x100);
    assert.equal(f.mem.read16(0x7e3821), 0xffff);
    for (const holder of [0xffff, 0x08b2, 0x1538]) {
      const save = fixture(settings),
        { mem, a } = save;
      const slot = mem.read16(0x81b124);
      mem.write16(0x700000 + slot + 0x381e - 0x2de0, 0x100);
      mem.write16(0x700000 + slot + 0x3821 - 0x2de0, holder);
      loadSavedGame(a, 0);
      assert.equal(mem.read16(0x7e381e), settings.bugfixes && holder === 0xffff ? 0 : 0x100);
      assert.equal(mem.read16(0x7e3821), holder);
    }
  }
});

test('the Jester script cannot reset a defeated vampire with the separate exploit option', () => {
  assert.deepEqual(scripts[0x6c].bytecode.slice(0x6c, 0x72), [0xc0, 0x14, 0x88, 0x01, 0x58, 0x60]);
  for (const preventExploits of [false, true])
    for (const state of [0, 0x80, 0xc7]) {
      const f = scriptFixture(0x6c, 0x6c, { ...DEFAULT_GAMEPLAY, preventExploits });
      f.mem.write8(0x7e36c6, state);
      f.mem.write16(0x7e36c8, 0xffff);
      assert.equal(runScript(f, 0x72), EXIT_BUDGET);
      const preserved = preventExploits && !!(state & 0x40);
      assert.equal(f.mem.read8(0x7e36c6), preserved ? state : 0);
      assert.equal(f.mem.read16(0x7e36c8), preserved ? 0x1538 : 0xffff);
    }
  // A nonzero reset or another actor still uses the original setter.
  const f = fixture({ ...DEFAULT_GAMEPLAY, preventExploits: true });
  f.mem.write8(0x7e36c6, 0xc0);
  invoke(f, setActorStateFlags, [0x188, 3]);
  assert.equal(f.mem.read8(0x7e36c6), 3);
});

test('European station cleanup leaves Examination available while its completion condition is clear', () => {
  for (const settings of [ORIGINAL_GAMEPLAY, DEFAULT_GAMEPLAY])
    for (const completed of [false, true]) {
      const f = scriptFixture(0x158, 0, settings);
      f.mem.write8(0x7e3950, completed ? 1 : 0);
      f.mem.wram.set([6, 15, 18, 26, 37, 255], 0x3ca3);
      assert.equal(runScript(f), EXIT_END);
      assert.equal(f.mem.read8(0x7e3cd7), completed ? 255 : 0);
    }
});
