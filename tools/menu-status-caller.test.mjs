import * as directEquipment from '../src/game/equipment-window.mjs';
import * as formerEquipment from '../proof/caller/equipment-window.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as directSpell from '../src/game/spell-choice.mjs';
import * as formerSpell from '../proof/caller/spell-choice.mjs';
import { openWindowSequence } from '../proof/caller/window-open.mjs';
import { releaseWindowSequence } from '../proof/caller/window-release.mjs';
import { chooseFromMenuSequence } from '../proof/caller/menu-choice.mjs';
import { setTextCursorRoutine, printNumberSequence } from '../proof/caller/window-text.mjs';
import { printTextSequence } from '../proof/caller/text-print.mjs';
import { runFrameWait, runPadPresses } from '../src/system/live-input-calls.mjs';
import { playSoundEffectRoutine } from '../src/apu/sound-effect.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  segmentSequence,
} from '../src/system/native-call-continuation.mjs';
import { textWindowSide, finishTextWindow } from './text-window-caller-harness.mjs';
import * as W from '../src/data/wram.mjs';

function compareRun(sequence, direct, prepare, budget, pads = []) {
  const side = textWindowSide(),
    { h, a, mem, events, put } = side;
  put(W.WINDOW_ACTIVE, 0xffff);
  put(W.SOUND_LOADED_SET, mem.read16(0x80c4b3 + 0x4c));
  const serviceUpload = events.interrupts.textWait;
  let input = 0;
  events.interrupts.textWait = (callee, frameEvents, status, pc) => {
    if (pc !== 0x81b0a9) return serviceUpload(callee, frameEvents, status, pc);
    assert.ok(input < pads.length, 'bounded menu input');
    put(W.PAD_HELD, pads[input++]);
    put(W.RANDOM_STATE, mem.read16(W.RANDOM_STATE) + 1);
    return true;
  };
  const routines = new Map([
      [0x81b0a1, runFrameWait],
      [0x809e1a, runPadPresses],
      [0x80c46e, playSoundEffectRoutine],
    ]),
    bindings = [];
  function bind(target, body) {
    const run = () => assert.fail('callee requires continuation');
    routines.set(target, run);
    bindings.push(run);
    NATIVE_CALL_CONTINUATIONS.set(run, {
      run,
      create: () => new NativeCallContinuation(a, body()),
    });
  }
  bind(0x80f963, () => openWindowSequence(h, events));
  bind(0x80a6c7, () => chooseFromMenuSequence(h, events, routines, 0x80a6c7));
  bind(0x80fa3e, function* () {
    yield* releaseWindowSequence(h, events);
    let result;
    yield () => {
      result = h.rts();
    };
    return result;
  });
  bind(0x80faac, () => segmentSequence(() => setTextCursorRoutine(h)));
  bind(0x80fe69, () => printTextSequence(h, events, routines));
  bind(0x80fd80, () => printNumberSequence(h, events, routines));
  bind(0x80fb39, () => side.render(h, events));
  prepare(side);
  try {
    const result = finishTextWindow(
      side,
      sequence(h, events, direct ? side.render : routines),
      budget,
    );
    return { ...result, input };
  } finally {
    for (const run of bindings) NATIVE_CALL_CONTINUATIONS.delete(run);
  }
}

for (const budget of [1, 7])
  for (const [name, spells, pads, chosen] of [
    ['empty', [], [], 0],
    ['Exit', [1], [0x8000], 0],
    ['first spell', [1, 3], [0x400, 0, 0x8000], 1],
    ['last spell', [1, 3], [0x400, 0, 0x400, 0, 0x8000], 3],
    ['cancel', [1, 3], [0x2000], 0],
    [
      'paged choice',
      [1, 2, 3, 4, 5, 6],
      [...Array.from({ length: 6 }, () => [0x400, 0]).flat(), 0x8000],
      6,
    ],
  ])
    test(`spell choice: ${name}, budget ${budget}`, () => {
      const prepare = ({ put }) => {
        put(0x0e, 0xffff);
        [...spells, 0].forEach((value, n) => put(W.SPELL_LIST + 2 * n, value));
      };
      const actual = compareRun(directSpell.chooseSpellSequence, true, prepare, budget, pads);
      assert.deepEqual(
        actual,
        compareRun(formerSpell.chooseSpellSequence, false, prepare, budget, pads),
      );
      assert.equal(actual.wram[0] | (actual.wram[1] << 8), chosen);
      assert.equal(actual.input, pads.length);
      if (spells.length) assert.ok(actual.uploads.length >= 3);
    });

for (const budget of [1, 7])
  for (const leader of [false, true])
    for (const [name, weapon, armour, rating, dermal] of [
      ['none', 0xffff, 0xffff, 0, 0],
      ['equipped', 0, 2, 6, 0],
      ['dermal', 4, 0, 255, 1],
    ])
      test(`equipment rows: ${name}, leader ${leader}, budget ${budget}`, () => {
        const prepare = ({ put, mem }) => {
          put(W.STATUS_WINDOW, 0);
          put(W.PLAYER_OBJECT, 2);
          put(W.MEMBER_OBJECT, leader ? 2 : 4);
          put(W.MEMBER_INDEX, 2);
          put(W.RUNNER_WEAPON + 8, weapon);
          put(W.RUNNER_ARMOUR + 8, armour);
          put(W.RUNNER_ARMOUR_RATING + 8, rating);
          mem.wram[W.JAKE_DERMAL_ARMOUR] = dermal;
          put(W.SELECTED_SPELL_NAME, 0x714d);
        };
        const actual = compareRun(directEquipment.equipmentRowsSequence, true, prepare, budget);
        assert.deepEqual(
          actual,
          compareRun(formerEquipment.equipmentRowsSequence, false, prepare, budget),
        );
        assert.equal(actual.calls.length, leader ? 6 : 5);
        const number = actual.calls[leader ? 4 : 3][2];
        assert.equal(
          String.fromCharCode(...number.subarray(0, number.indexOf(0))),
          String((rating + (leader && dermal ? 2 : 0)) & 255),
        );
      });
