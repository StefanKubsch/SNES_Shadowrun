import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { loadSave } from './mesen-f390-oracle.mjs';
import { livePlanDriver } from './live-plan-driver.mjs';
import { BADGE_BUY_LIVE_PLAN } from './live-plans.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { MouseControl, useEvent } from '../src/browser/mouse-control.mjs';
import { DEFAULT_BINDINGS, bitsFor } from '../src/browser/controls.mjs';

// Glove actions with the mouse (user decision 2026-10-30, as few intermediate steps as
// possible): left examines (L), right depends on the context. In the original
// (80:BF3B) R ("Use") acts only on an object with a use event; on persons it only closes
// the hand, and there B opens the action list (Exit, Talk). Live from the reset with
// the save apartment along the closed path of BADGE_BUY_LIVE_PLAN: the hand on the
// Beretta in the alley (before the plan's R) and on the guest in the Grim Reaper Club
// (object 17).
const START = 0x1000,
  DOWN = 0x0400,
  B = 0x8000,
  L = 0x0020,
  R = 0x0010,
  OPEN = 0x01d8,
  TARGET = 0x01da;
const TITLE = (k) =>
  (k >= 3000 && k < 3004) || (k >= 3300 && k < 3304) || (k >= 3600 && k < 3604)
    ? START
    : k >= 3150 && k < 3154
      ? DOWN
      : 0;
const plan = BADGE_BUY_LIVE_PLAN,
  beretta = plan.findIndex((c) => c[0] === 'press' && c[1] === 'r');
const target = plan.findIndex(([kind, x, y]) => kind === 'glove' && x === 91 && y === 107);
const guest =
  plan.findIndex(
    ([kind, x, y], i) =>
      kind === 'glove' &&
      x === 91 &&
      y === 107 &&
      plan[i - 1][0] === 'press' &&
      plan[i - 1][2] === 12,
  ) + 2;
function clickAt(end, button) {
  const input = {
      word: 0,
      keyDirections: 0,
      keyButtons: 0,
      mouse: { seq: 0, x: 0, y: 0 },
      mouseBits: 0,
      buttons: 0,
      back: false,
      wheel: 0,
    },
    out = [];
  let driver = null,
    control = null;
  const game = new LiveGame(cartridge, {
    sram: new Uint8Array(loadSave('apartment')),
    pad: (k) => {
      if (k < 5000) return TITLE(k);
      driver ??= livePlanDriver(
        plan.slice(3, end),
        game.memory.wram,
        () => game.driver.roundsCompleted,
      );
      if (!driver.done()) return driver.pad(k);
      const word = control.pad(k, input);
      out.push(word);
      return word;
    },
  });
  control = new MouseControl(game);
  const wram = game.memory.wram,
    word = (a) => wram[a] | (wram[a + 1] << 8),
    after = (n) => {
      const end = game.nmis + n;
      while (game.nmis < end) game.step();
    };
  while (!driver?.done()) game.step();
  const before = {
    open: word(OPEN),
    object: word(TARGET),
    use: useEvent(wram),
    x: wram[0x1d5],
    y: wram[0x1d7],
  };
  // The page sends the mouse button as its bound pad bits (start.mjs) plus the left/right state.
  if (button >= 0) {
    input.mouseBits = input.word = bitsFor(DEFAULT_BINDINGS, [`mouse:${button}`]);
    input.buttons = button === 0 ? 1 : button === 2 ? 2 : 0;
    after(5);
    input.mouseBits = input.word = input.buttons = 0;
    after(10);
  }
  const sent = out.reduce((bits, w) => bits | w, 0) & (B | L | R);
  return {
    before,
    sent,
    open: word(OPEN),
    object: word(TARGET),
    playing: game.controlNmi >= game.nmis - 1,
    game,
    input,
    after,
    word,
  };
}
test(
  'the right mouse button uses an item directly and opens the action list of a person',
  { timeout: 900000 },
  () => {
    // Beretta: R has a use event, the right button sends R and Jake picks it up.
    const item = clickAt(beretta, 2);
    assert.ok(!(item.before.object & 0x8000), 'hand on the Beretta');
    assert.ok(item.before.use, 'the Beretta has a use event');
    assert.equal(item.sent, R, 'right button gives R');
    item.after(60);
    item.input.mouse = { seq: 1, x: item.before.x, y: item.before.y };
    item.after(8);
    assert.notEqual(item.word(TARGET), item.before.object, 'the Beretta is gone from the street');
    // Club patron: no use event, the right button opens his action list (B).
    const person = clickAt(guest, 2);
    assert.deepEqual(
      [person.before.open, person.before.object, person.before.use],
      [0xffff, 0x17, 0],
      'hand on the club patron, no use event',
    );
    assert.equal(person.sent, B, 'right button gives B');
    assert.deepEqual(
      [person.open, person.object, person.playing],
      [0xffff, 0x17, false],
      'the action list holds the game',
    );
    // The list is a menu (LiveGame choosing stays false): the wheel moves its cursor (1D97, two per entry)
    // from Exit to Talk, a mouse move does not move the hand, and the left button confirms Talk.
    assert.equal(person.game.choosing, false, 'no target selection');
    const cursor = person.word(0x1d97);
    person.input.wheel = 1;
    person.after(12);
    assert.equal(person.word(0x1d97), cursor + 2, 'wheel moves the list cursor');
    person.input.mouse = { seq: 1, x: 30, y: 30 };
    person.after(6);
    assert.deepEqual(
      [person.word(0x01d4) >> 8, person.word(0x01d6) >> 8],
      [person.before.x, person.before.y],
      'the hand stays on him',
    );
    person.input.buttons = 1;
    person.input.mouseBits = bitsFor(DEFAULT_BINDINGS, ['mouse:0']);
    person.after(5);
    // The dialog shows its greeting and waits 61 frames before its menu (80:936C), so the
    // menu replaces the list cursor about 63 NMIs after the button; the lifted dialog's
    // waits end their live steps at the NMI, so the test no longer overshoots by a long step.
    person.input.buttons = person.input.mouseBits = 0;
    person.after(90);
    assert.notEqual(
      person.word(0x1d97),
      cursor + 2,
      'Talk chosen: the topic list or dialog replaced the action list',
    );
    // Left button: L (Examine); on him it only closes the hand, as in the original.
    const examine = clickAt(guest, 0);
    assert.deepEqual([examine.sent, examine.open], [L, 0], 'left button examines');
  },
);
// Target selection (an item from the Y list used on the guest, plan step before its first glove):
// LiveGame marks it, the mouse leads the glove there instead of treating it as a menu.
test('in a glove target selection the mouse still leads the glove', { timeout: 900000 }, () => {
  const run = clickAt(target, -1);
  assert.deepEqual(
    [run.before.open, run.game.choosing],
    [0xffff, true],
    'target selection with the hand open',
  );
  run.input.mouse = { seq: 1, x: 91, y: 107 };
  run.after(6);
  assert.deepEqual(
    [run.word(0x01d4) >> 8, run.word(0x01d6) >> 8],
    [91, 107],
    'the glove follows the mouse',
  );
});
