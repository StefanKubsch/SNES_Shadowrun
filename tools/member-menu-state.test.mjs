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
import { memberSpellState } from '../src/state/member-spells.mjs';
import { buildMemberSpellChoices } from '../src/game/member-spell-menu.mjs';
import { detachObjectStorage } from '../src/state/objects.mjs';
import { savedGameState } from '../src/state/saved-game.mjs';
import { skills, notes } from '../src/game/status-submenus.mjs';
import * as W from '../src/data/wram.mjs';

for (const detached of [false, true]) {
  test(`spell choices keep their scripts and reread the selected level (${detached ? 'live' : 'fixture'})`, () => {
    const mem = new VmMemory(cartridge.rom, undefined, null, cartridge.present);
    if (detached) {
      detachWindowsText(mem.wram);
      detachCombat(mem.wram);
      detachSceneRoom(mem.wram);
      detachObjectStorage(mem.wram);
    }
    const menu = memberMenuState(mem),
      jake = jakeState(mem),
      spells = memberSpellState(mem);
    menu.runnerIndex = 0;
    menu.recordPosition = 6;
    jake.spells.heal = 2;
    jake.spells.armour = 3;
    const items = buildMemberSpellChoices(mem),
      content = memberMenuContent(mem);
    assert.equal(items.length, 3);
    assert.equal(spells.choice(1).spell, 1);
    assert.equal(spells.choice(1).script, content.spells[1].script);
    assert.equal(spells.choice(2).spell, 3);
    assert.equal(mem.read16(W.WRAM + W.SPELL_MENU_LEVEL_POINTERS + 2), W.JAKE_BODY + 13);
    spells.select(1);
    assert.equal(savedGameState(mem).get('combat', 'spellLevelPointer', 0), W.JAKE_BODY + 13);
    assert.equal(spells.selectedLevel, 2);
    jake.spells.heal = 5;
    spells.prepareCast();
    assert.equal(mem.read16Bank0(0), 5);
    assert.equal(mem.read16Bank0(W.DP_SELECTION_POINTER), W.JAKE_BODY + 13);
    assert.equal(spells.script, content.spells[1].leaderScript);
    // Retain the original unaligned carry and the bytes beyond level six.
    assert.equal(content.spellLevelName(0, 1, 1), mem.read16(0x80e7c9));
    assert.equal(content.spellLevelName(0, 7), mem.read16(0x80e810));
  });
  test(`empty skills and absent datajack ignore an obsolete record pointer (${detached ? 'live' : 'fixture'})`, () => {
    const mem = new VmMemory(cartridge.rom, undefined, null, cartridge.present);
    if (detached) {
      detachWindowsText(mem.wram);
      detachSceneRoom(mem.wram);
    }
    const state = memberMenuState(mem);
    state.runnerIndex = 0;
    mem.write16Bank0(W.DP_MEMBER_RECORD, 0xffff);
    mem.write8(W.DP_MEMBER_RECORD_BANK, 0xff);
    for (const body of [skills, notes]) {
      const sequence = body({ a: { mem } }, {});
      sequence.next().value();
      assert.equal(sequence.next().done, true);
    }
    assert.equal(state.endWord, 0);
    assert.equal(state.submenuWindow, 0);
  });
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
