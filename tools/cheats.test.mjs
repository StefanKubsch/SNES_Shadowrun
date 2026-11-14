import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { ScriptInterpreter } from '../src/vm/interpreter.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { takeDamage } from '../src/matrix/matrix-world.mjs';
import { hitObject } from '../src/task/native-object-hit.mjs';
import { setObjectRecordCount } from '../src/task/native-object-record-count-set.mjs';
import { decrementObjectStateCount } from '../src/task/native-object-record-count-decrement.mjs';
import { task8E36Fixture } from './task-native-8e36-fixtures.mjs';
import { CHEAT, CHEAT_MASK, CHEAT_EVENTS } from '../src/game/cheat-settings.mjs';
import { applyCheats, JAKE_STATE_RECORD } from '../src/game/cheats.mjs';
import { RECORD_ATTRIBUTE, RECORD_SKILL, RECORD_SPELL } from '../src/data/runners.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { counterBytes } from '../src/vm/frame-events.mjs';
import { Recorder, parseRecording, replayRecording } from '../src/browser/recording.mjs';

function fixture(mask = 0) {
  const memory = new VmMemory(cartridge.rom),
    vm = new ScriptInterpreter(memory);
  vm.cheats = mask;
  vm.setContext({
    a: 0,
    x: 0,
    y: 0,
    s: 0x1eee,
    d: 0,
    bank: 0x80,
    status: 0,
    programBank: 0x80,
    pc: 0x8691,
  });
  const a = new TaskAccessor(vm);
  a.load();
  memory.write16(0x1eef, 0xf508);
  return { memory, vm, a };
}
const initialize = (f) => {
  f.memory.write16(0x7e2de4, 1);
  f.memory.wram.set([3, 0, 3, 0x91, 3, 30], 0x3bfb);
  f.memory.wram[0x33de] = 5;
};

test('cheat layout and upgrade caps match the shipped European data', () => {
  const tables = JSON.parse(readFileSync('assets/vm-tables.json')).tables;
  const table = (name) => tables.find((row) => row.name === name).values;
  assert.deepEqual(table('karma_attribute_limits'), [20, 20, 6, 6]);
  assert.deepEqual(table('karma_skill_limits'), [16, 6, 6, 6]);
  assert.deepEqual(table('karma_spell_limits'), [6, 6, 6, 6, 6, 6]);
  assert.equal(new VmMemory(cartridge.rom).read16(0x8db01f + 0x08b2 + 1), JAKE_STATE_RECORD);
});

test('cold-start and disabled cheats leave every WRAM byte unchanged', () => {
  const cold = fixture(CHEAT_MASK),
    off = fixture();
  initialize(off);
  for (const f of [cold, off]) {
    const before = f.memory.wram.slice();
    applyCheats(f);
    assert.deepEqual(f.memory.wram, before);
  }
});

test('all sixteen combinations preserve other runners and unused state; disabling keeps gains', () => {
  for (let mask = 0; mask <= CHEAT_MASK; mask++) {
    const f = fixture(mask),
      wram = f.memory.wram;
    initialize(f);
    wram[0x3c97] = 13;
    wram[0x33e3] = 7;
    f.memory.write16(0x1754, 0xabcd);
    applyCheats(f);
    assert.equal(wram[0x3bfe], 0x91);
    assert.equal(wram[0x3c97], 13);
    assert.equal(wram[0x33e3], 7);
    assert.equal(f.memory.read16(0x1754), 0xabcd, 'non-Matrix upload memory stays intact');
    assert.equal(wram[0x3bfb], mask & CHEAT.stats ? 20 : 3);
    assert.equal(wram[0x3bfc], mask & (CHEAT.stats | CHEAT.spells) ? 20 : 0);
    assert.equal(wram[0x33de], mask & CHEAT.health ? (mask & CHEAT.stats ? 200 : 30) : 5);
    for (const [name, offset] of Object.entries(RECORD_SKILL))
      assert.equal(wram[0x3bfb + offset], mask & CHEAT.stats ? (name === 'firearms' ? 16 : 6) : 0);
    for (const offset of Object.values(RECORD_SPELL))
      assert.equal(wram[0x3bfb + offset], mask & CHEAT.spells ? 6 : 0);
    assert.equal(f.memory.read16(0x7e3c0d), mask & CHEAT.money ? 65535 : 0);
    assert.equal(f.memory.read16(0x7e3c0f), mask & CHEAT.money ? 65535 : 0);
    wram[0x3c96] = 11;
    applyCheats(f);
    assert.equal(wram[0x3c96], 11, 'casting still spends spell points');
    const before = wram.slice();
    f.vm.cheats = 0;
    applyCheats(f);
    assert.deepEqual(wram, before);
  }
});

test('real 8691 lethal damage cannot kill Jake with protection, but still kills other records', () => {
  for (const [mask, record, expected] of [
    [0, 0x33dc, 0],
    [CHEAT.health, 0x33dc, 30],
    [CHEAT_MASK, 0x33dc, 200],
    [CHEAT.health, 0x3400, 0],
  ]) {
    const f = fixture(mask),
      sample = task8E36Fixture({ flags: 0xa000, record, health: 1 });
    for (const [address, value] of sample.data.snapshot().bytes) {
      if (
        (address >= 0x7e0000 && address < 0x800000) ||
        (!(address & 0x400000) && (address & 65535) < 0x2000)
      )
        f.memory.write8(address, value);
    }
    f.memory.wram[0x3c00] = mask === CHEAT_MASK ? 200 : 30;
    Object.assign(f.a.ctx, { a: 1, x: 16, y: 65535, s: 0x1eee, bank: 0x80, pc: 0x8691 });
    f.a.io = sample.ioObservations;
    hitObject(f.a, { calls: [], waitEvents: [] });
    assert.equal(f.memory.wram[record + 2], expected);
    assert.equal(
      !!(f.memory.read16(0xc62) & 0x800),
      expected === 0,
      'death task event matches survival',
    );
  }
});

test('Matrix damage protects only Jake and only the active callback permits scratch refills', () => {
  for (const [mask, record, expected] of [
    [0, 0x33dc, 0],
    [CHEAT.health, 0x33dc, 30],
    [CHEAT.health, 0x3400, 0],
  ]) {
    const f = fixture(mask);
    initialize(f);
    f.memory.write16(0x1d93, record);
    f.memory.write16(0x1754, 1);
    Object.assign(f.a.ctx, { a: 100, bank: 0x81 });
    // The lifted matrix damage (81:B1B5) honours the health cheat.
    takeDamage({ wram: f.memory.wram, h: { a: f.a } }, 100);
    assert.equal(f.memory.read16(0x1754), expected);
    f.memory.write16(0x1754, 1);
    f.memory.write16(0x6e, 0xbec3);
    f.memory.write8(0x70, 0x81);
    applyCheats(f);
    assert.equal(f.memory.read16(0x1754), mask && record === 0x33dc ? 30 : 1);
  }
});

test('script count setters and decrements cannot bypass Jake protection', () => {
  for (const mask of [0, CHEAT.health]) {
    for (const run of [setObjectRecordCount, decrementObjectStateCount]) {
      const f = fixture(mask);
      initialize(f);
      f.memory.write16(0, 16);
      f.memory.write16(2, 0);
      f.memory.write16(0x13a8 + 16, JAKE_STATE_RECORD);
      f.memory.write16(0x150a + 16, 0x08b2);
      f.memory.wram[0x33de] = 1;
      run(f.a);
      assert.equal(f.memory.wram[0x33de], mask ? 30 : 0);
      if (run === decrementObjectStateCount)
        assert.equal(
          f.memory.read16(0),
          mask ? 0 : 65535,
          'script depletion result follows protection',
        );
    }
  }
});

test('cheat switches before and during a real cold session replay with identical WRAM', () => {
  const seed = 0x1234567,
    recorder = new Recorder(seed, null);
  let game,
    active = -1;
  game = new LiveGame(cartridge, {
    counter: counterBytes(seed),
    pad: (k) => {
      const mask = k < 4900 ? CHEAT_MASK : k < 5000 ? 0 : CHEAT.health | CHEAT.money;
      if (active !== mask) {
        recorder.event(CHEAT_EVENTS[mask]);
        game.vm.cheats = active = mask;
      }
      applyCheats(game);
      const word = [3000, 3300, 3600].some((at) => k >= at && k < at + 4) ? 0x1000 : 0;
      recorder.input(k, [word, 0, 0, 0, 0]);
      return word;
    },
    onFrame: (f) => recorder.frame(f.nmi, game.memory.wram),
  });
  while (game.nmis < 5100) game.step();
  assert.equal(game.memory.wram[0x3bfb + RECORD_ATTRIBUTE.body], 20);
  assert.equal(game.memory.wram[0x3bfb + RECORD_SPELL.heal], 6);
  const recording = parseRecording(JSON.stringify(recorder));
  assert.ok(recording.events.some((e) => e[1] === 'cheats-0'));
  const replay = replayRecording(cartridge, recording, { until: game.nmis, stop: true });
  assert.equal(replay.mismatch, null);
  assert.equal(replay.offPath, null);
  assert.deepEqual(replay.game.memory.wram, game.memory.wram);
});
