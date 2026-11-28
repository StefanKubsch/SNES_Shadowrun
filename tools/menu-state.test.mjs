import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { navigationState } from '../src/state/menu.mjs';
import { windowState } from '../src/state/windows.mjs';
import { memberMenuState } from '../src/state/member-menu.mjs';
import { detachWindowsText } from '../src/state/windows-text.mjs';
import { detachFrontend } from '../src/state/frontend.mjs';
import * as W from '../src/data/wram.mjs';

for (const detached of [false, true]) {
  test(`menu state shares drawing/input and rereads live member buffers (${detached ? 'live' : 'fixture'})`, () => {
    const mem = new VmMemory(cartridge.rom, undefined, null, cartridge.present),
      a = { mem, dataBank: 0x80 },
      state = navigationState(a),
      window = windowState(mem, 2);
    state.selection = 6;
    window.columns = 12;
    if (detached) {
      detachWindowsText(mem.wram);
      detachFrontend(mem.wram);
    }
    assert.equal(navigationState(a), state);
    mem.write16(W.WRAM + W.MENU_SELECTION, 10);
    assert.equal(state.selection, 10);
    mem.write16(W.WRAM + W.PAD_PRESSED, 0x8040);
    assert.equal(state.pressed, 0x8040);
    window.rows = 7;
    assert.equal(mem.read16(W.WRAM + W.WINDOW_ROWS + 2), 7);
    state.configure({
      window: 2,
      column: 1,
      row: 0,
      visibleRows: 5,
      items: [0x7110, 0x7113],
      values: [0, 9],
    });
    assert.equal(state.textAt(2), 0x7113);
    assert.equal(state.valueAt(2), 9);
    // The data bank belongs to the caller and may change after the view is cached.
    mem.write16(W.WRAM + 0x10182, 37);
    a.dataBank = 0x7f;
    assert.equal(state.valueAt(2), 37);
    a.dataBank = 0x80;
    const member = memberMenuState(mem);
    member.inventoryRow(0).text = 0x707f;
    member.inventoryRow(0).count = 3;
    state.configure({
      window: 2,
      column: 1,
      row: 0,
      visibleRows: 5,
      items: [1],
      values: [1],
      storage: 'member',
    });
    assert.equal(state.textAt(0), 0x707f);
    assert.equal(state.valueAt(0), 3);
    // Rendering and long inventories can mutate these rows after configuration.
    member.inventoryRow(0).text = 0x7113;
    assert.equal(state.textAt(0), 0x7113);
    mem.write16Bank0(W.DP_LIST_TOKENS, 0xffff);
    mem.write8(W.DP_LIST_TOKEN_BANK, 0x7e);
    mem.write8(W.WRAM + 0xffff, 0x37);
    mem.write8(W.WRAM + 0x10000, 0xa5);
    assert.equal(state.textAt(0), 0xa537);
  });
}
