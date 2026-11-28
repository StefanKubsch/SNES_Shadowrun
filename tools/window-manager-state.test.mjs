import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { textWindowSide } from './text-window-caller-harness.mjs';
import { windowState, windowManagerState } from '../src/state/windows.mjs';
import { detachWindowsText } from '../src/state/windows-text.mjs';
import { openWindowAt } from '../src/game/window-open.mjs';
import { releaseWindowSequence } from '../src/game/window-release.mjs';
import { setTextCursorAt, setWindowTextArea } from '../src/game/window-text.mjs';

for (const detached of [false, true]) {
  test(`allocation preserves clamping, tile wrap and cursor arithmetic (${detached ? 'live' : 'fixture'})`, () => {
    for (const first of [0x2070, 0x23f0]) {
      const side = textWindowSide(),
        { mem, h, events } = side,
        manager = windowManagerState(mem),
        record = windowState(mem, 2);
      if (detached) detachWindowsText(mem.wram);
      manager.nextTile = first;
      const sequence = openWindowAt(h, events, [0, 0, 10, 6]);
      sequence.next().value();
      sequence.next().value();
      sequence.return();
      assert.equal(manager.lastIndex, 2);
      assert.equal(record.mapOffset, 66);
      assert.equal(record.widthPixels, 64);
      assert.equal(record.tileCount, 32);
      assert.equal(record.active, 0xffff);
      const expectedFirst = first === 0x23f0 ? 0x2027 : first;
      assert.equal(record.firstTile, expectedFirst);
      assert.equal(manager.nextTile, expectedFirst + 32);
      setTextCursorAt(h, 2, 3, 1);
      assert.equal(record.cursorTile, expectedFirst + 11);
      assert.equal(record.cursorPixel, 0);
      setWindowTextArea(h, 2, 4, 0);
      assert.equal(record.leftPixel, 4);
      assert.equal(record.widthPixels, 8);
    }
  });
  test(`no free window retains the original argument result (${detached ? 'live' : 'fixture'})`, () => {
    const mem = new VmMemory(cartridge.rom, undefined, null, cartridge.present),
      manager = windowManagerState(mem);
    if (detached) detachWindowsText(mem.wram);
    manager.lastIndex = 0x1e;
    manager.nextTile = 0x2300;
    const sequence = openWindowAt({ a: { mem } }, {}, [9, 8, 10, 6]);
    sequence.next().value();
    sequence.next().value();
    assert.deepEqual(sequence.next(), { done: true, value: 9 });
    assert.equal(manager.lastIndex, 0x1e);
    assert.equal(manager.nextTile, 0x2300);
  });
  test(`releasing the last window skips holes and rewinds to the following allocation (${detached ? 'live' : 'fixture'})`, () => {
    const mem = new VmMemory(cartridge.rom, undefined, null, cartridge.present),
      manager = windowManagerState(mem);
    if (detached) detachWindowsText(mem.wram);
    manager.lastIndex = 6;
    manager.windowArgument = 6;
    windowState(mem, 2).active = 1;
    windowState(mem, 4).active = 0;
    windowState(mem, 4).firstTile = 0x2123;
    windowState(mem, 6).active = 0xffff;
    const sequence = releaseWindowSequence({ a: { mem } }, {});
    sequence.next().value();
    sequence.return();
    assert.equal(manager.lastIndex, 2);
    assert.equal(manager.nextTile, 0x2123);
    assert.equal(windowState(mem, 6).active, 0);
  });
}
