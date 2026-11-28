import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { noticeState } from '../src/state/notices.mjs';
import { detachWindowsText } from '../src/state/windows-text.mjs';
import { noticeText, noticeEffectSound } from '../src/content/notices.mjs';
import { noticeTimeoutSequence } from '../src/game/notice-timeout.mjs';
import { SequenceRunner } from '../src/system/sequence-runner.mjs';
import { memberMenuState } from '../src/state/member-menu.mjs';
import * as W from '../src/data/wram.mjs';

for (const detached of [false, true]) {
  test(`notice slots preserve free/replacement order and duration widths (${detached ? 'live' : 'fixture'})`, () => {
    const mem = new VmMemory(cartridge.rom, undefined, null, cartridge.present),
      state = noticeState(mem);
    state.slots[1].frames = 37;
    if (detached) detachWindowsText(mem.wram);
    state.resetWindows();
    assert.equal(state.slots[1].frames, 37);
    assert.equal(state.chooseSlot(), 3);
    assert.equal(memberMenuState(mem).hasNotices, false);
    for (const [index, frames] of [20, 10, 10, 20].entries()) {
      state.slots[index].window = index * 2;
      state.slots[index].frames = frames;
    }
    assert.equal(state.chooseSlot(), 1);
    for (const slot of state.slots) slot.frames = 5;
    assert.equal(state.chooseSlot(), 0);
    assert.equal(memberMenuState(mem).hasNotices, true);
    state.slots[2].window = -1;
    assert.equal(state.chooseSlot(), 2);
    state.effectFrames = 0x10001;
    assert.equal(mem.read16(W.WRAM + W.NOTICE_EFFECT_FRAMES), 1);
  });
  test(`zero notice duration wraps and inactive slots do not count down (${detached ? 'live' : 'fixture'})`, () => {
    const mem = new VmMemory(cartridge.rom, undefined, null, cartridge.present);
    if (detached) detachWindowsText(mem.wram);
    const state = noticeState(mem);
    state.resetWindows();
    state.slots[0].window = 0;
    state.slots[0].frames = 0;
    state.slots[1].window = 2;
    state.slots[1].frames = 2;
    state.slots[3].frames = 10;
    const runner = new SequenceRunner(noticeTimeoutSequence({ a: { mem } }, {}));
    runner.run(20);
    assert.equal(runner.done, true);
    assert.equal(state.slots[0].frames, 0xffff);
    assert.equal(state.slots[1].frames, 1);
    assert.equal(state.slots[3].frames, 10);
  });
}

test('notice text retains its bank limit and effect arguments match the source table', () => {
  const mem = new VmMemory(cartridge.rom, undefined, null, cartridge.present);
  assert.equal(noticeText(mem, 0x8000), noticeText(mem, 0));
  assert.throws(
    () => noticeText(mem, 0x7fff),
    (error) =>
      error.taskBoundary === true &&
      error.reason === 'notice_text_required' &&
      error.text === 0x7fff,
  );
  for (let index = 0; index < 3; index++)
    assert.equal(noticeEffectSound(mem, index), mem.read16(0x80ff73 + 2 * index));
});
