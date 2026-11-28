import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { karmaMenuState } from '../src/state/karma-menu.mjs';
import { memberMenuContent } from '../src/content/member-menus.mjs';
import { buildKarmaChoices, buyStep } from '../src/game/karma-menu.mjs';
import { jakeState } from '../src/state/jake.mjs';
import { detachSceneRoom } from '../src/state/scene-room.mjs';
import { detachWindowsText } from '../src/state/windows-text.mjs';
import { KARMA_LISTS } from './karma-source-layout.mjs';
import * as W from '../src/data/wram.mjs';

for (const detached of [false, true]) {
  const memory = () => {
    const mem = new VmMemory(cartridge.rom, undefined, null, cartridge.present);
    if (detached) {
      detachSceneRoom(mem.wram);
      detachWindowsText(mem.wram);
    }
    return mem;
  };
  test(`every named upgrade matches the original stat, label and limit (${detached ? 'live' : 'fixture'})`, () => {
    const mem = memory(),
      state = karmaMenuState(mem),
      content = memberMenuContent(mem);
    for (let index = 0; index < 18; index++) mem.write8(W.WRAM + W.JAKE_BODY + index, index + 1);
    const categories = { attributes: 0x80f0f3, skills: 0x80f054, spells: 0x80f1b5 };
    for (const [category, entry] of Object.entries(categories)) {
      const source = KARMA_LISTS[entry];
      for (const [index, upgrade] of content.karma[category].upgrades.entries()) {
        const pointer = mem.read16(0x800000 + source.pointers + index * 2);
        assert.equal(state.value(upgrade), mem.read8(W.WRAM + pointer), upgrade.field);
        assert.equal(upgrade.limit, mem.read16(0x800000 + source.limits + index * 2));
        assert.equal(upgrade.text, mem.read16(0x800000 + source.names + index * 2));
      }
    }
  });
  test(`karma failure is atomic and the UI keeps locked/limited values hidden (${detached ? 'live' : 'fixture'})`, () => {
    const mem = memory(),
      state = karmaMenuState(mem),
      jake = jakeState(mem),
      body = memberMenuContent(mem).karma.attributes.upgrades[0];
    jake.body = 3;
    jake.maxHealth = 30;
    state.balance = 23;
    assert.equal(state.buy(body), false);
    assert.equal(state.balance, 23);
    assert.equal(jake.body, 3);
    state.balance = 24;
    const purchase = buyStep({ a: { mem } }, {}, body);
    purchase.next().value();
    assert.deepEqual(purchase.next(), { done: true, value: true });
    assert.equal(state.balance, 0);
    assert.equal(jake.body, 4);
    jake.strength = 6;
    jake.magic = 0;
    jake.charisma = 2;
    state.previousRowCount = -1;
    state.selectedRow = 5;
    const rows = buildKarmaChoices(mem, 'attributes');
    assert.equal(rows.length, 3);
    assert.equal(rows[1].sourceIndex, 0);
    assert.equal(rows[2].sourceIndex, 3);
    assert.equal(mem.read16(W.WRAM + W.KARMA_ROW_INDICES + 2), 6);
    assert.equal(state.selectedRow, 0);
    state.selectedRow = 2;
    buildKarmaChoices(mem, 'attributes');
    assert.equal(state.selectedRow, 2);
    // The text cursor is independent; only an actual row-count change resets selection.
    mem.write16Bank0(W.DP_CURSOR_ROW, 1);
    buildKarmaChoices(mem, 'attributes');
    assert.equal(state.selectedRow, 2);
    jake.body = 20;
    buildKarmaChoices(mem, 'attributes');
    assert.equal(state.selectedRow, 0);
  });
}
