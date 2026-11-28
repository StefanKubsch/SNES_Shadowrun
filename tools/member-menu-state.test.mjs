import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { memberMenuState } from '../src/state/member-menu.mjs';
import { detachWindowsText } from '../src/state/windows-text.mjs';
import { detachCombat } from '../src/state/combat.mjs';
import { detachSceneRoom } from '../src/state/scene-room.mjs';
import { jakeState } from '../src/state/jake.mjs';
import { scriptState } from '../src/state/scripts.mjs';
import { findRunnerIndex, runnerContent } from '../src/content/runners.mjs';
import { memberMenuContent } from '../src/content/member-menus.mjs';
import * as W from '../src/data/wram.mjs';

for (const detached of [false, true]) {
  test(`member selection shares scripts and late detached owners (${detached ? 'live' : 'fixture'})`, () => {
    const mem = new VmMemory(cartridge.rom, undefined, null, cartridge.present),
      state = memberMenuState(mem);
    state.number = 123;
    state.object = 0xa537;
    if (detached) {
      detachWindowsText(mem.wram);
      detachCombat(mem.wram);
      detachSceneRoom(mem.wram);
    }
    scriptState(mem).menu.memberObject = 0x12;
    assert.equal(state.object, 0xa512);
    state.runnerIndex = 0;
    jakeState(mem).body = 7;
    assert.equal(state.stats.body, 7);
    state.window = 6;
    assert.equal(mem.read16(W.WRAM + W.STATUS_WINDOW), 6);
    state.runnerIndex = 2;
    assert.equal(scriptState(mem).menu.memberIndex, 4);
    state.resources.magicPoints = 0x123;
    assert.equal(mem.read8(W.WRAM + W.MAGIC_POINTS + 2), 0x23);
    // Odd legacy member indices select an equipment row between regular runners.
    mem.write16(W.WRAM + W.MEMBER_INDEX, 1);
    mem.write16(W.WRAM + W.RUNNER_WEAPON + 4, 0x1357);
    assert.equal(state.equipment.weapon.object, 0x1357);
    for (const [index, runner] of runnerContent(mem).entries()) {
      assert.equal(findRunnerIndex(mem, runner.object), index);
      state.runnerIndex = index;
      assert.equal(state.details.portrait, runner.portrait);
    }
    assert.equal(findRunnerIndex(mem, 0xffff), -1);
    assert.equal(memberMenuState(mem), state);
    assert.deepEqual(
      memberMenuContent(mem).attributes.map(({ field, row }) => [field, row]),
      [
        ['body', 11],
        ['magic', 12],
        ['strength', 13],
        ['charisma', 14],
      ],
    );
  });
}
