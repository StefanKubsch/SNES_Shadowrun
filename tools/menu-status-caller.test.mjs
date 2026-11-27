import { drawTextBufferSequence as drawTextBuffer } from '../src/game/text-draw.mjs';
import { STATE_COUNT } from '../src/data/actors.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import * as directSpell from '../src/game/spell-choice.mjs';
import {
  equipmentRowsJsr,
  notesJsr,
  partyStatusJsr,
  skillsJsr,
} from './register-forms/jsr-forms.mjs';
import { setTextCursorRoutine, printNumberSequence } from './register-forms/window-text.mjs';
import { printTextSequence } from './register-forms/text-print.mjs';
import { runFrameWait, runPadPresses } from './register-forms/input-routines.mjs';
import { playSoundEffectJsr } from './register-forms/jsr-forms.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  segmentSequence,
} from './register-forms/native-call-continuation.mjs';
import { textWindowSide, finishTextWindow } from './text-window-caller-harness.mjs';
import * as W from '../src/data/wram.mjs';

useLiftVectors(import.meta.url);

function compareRun(sequence, direct, prepare, budget, pads = [], realDrawing = false) {
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
      [0x80c46e, playSoundEffectJsr],
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
  bind(0x80faac, () => segmentSequence(() => setTextCursorRoutine(h)));
  bind(0x80fe69, () => printTextSequence(h, events, routines));
  bind(0x80fd80, () => printNumberSequence(h, events, routines));
  bind(0x80fb39, () => side.render(h, events));
  if (realDrawing) side.render = drawTextBuffer;
  prepare(side);
  try {
    const result = finishTextWindow(
      side,
      sequence(h, events, direct ? (realDrawing ? undefined : side.render) : routines),
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
      assertFrozenRun(actual);
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
        const actual = compareRun(equipmentRowsJsr, true, prepare, budget);
        assertFrozenRun(actual);
        assert.equal(actual.calls.length, leader ? 6 : 5);
        const number = actual.calls[leader ? 4 : 3][2];
        assert.equal(
          String.fromCharCode(...number.subarray(0, number.indexOf(0))),
          String((rating + (leader && dermal ? 2 : 0)) & 255),
        );
      });

for (const budget of [1, 7])
  for (const [name, skills] of [
    ['none', [0, 0, 0, 0, 0, 0]],
    ['one', [0, 0, 9, 0, 0, 0]],
    ['sparse', [1, 0, 0, 2, 0, 255]],
    ['all', [1, 2, 3, 4, 5, 6]],
  ])
    for (const button of [0x8000, 0x2000])
      test(`skills: ${name}, button ${button}, budget ${budget}`, () => {
        const prepare = ({ put, mem }) => {
          put(W.DP_MEMBER_RECORD, 0x6000);
          mem.wram[W.DP_MEMBER_RECORD_BANK] = 0x7e;
          mem.wram.set(skills, 0x6000);
        };
        const pads = skills.some(Boolean) ? [button] : [];
        const actual = compareRun(skillsJsr, true, prepare, budget, pads);
        assertFrozenRun(actual);
        assert.equal(actual.calls.length, skills.filter(Boolean).length * 2);
        assert.equal(
          actual.wram[W.DIALOG_END] | (actual.wram[W.DIALOG_END + 1] << 8),
          skills.some(Boolean) && button === 0x2000 ? 0xffff : 0,
        );
        assert.equal(actual.input, pads.length);
      });

for (const budget of [1, 7])
  for (const [name, jake, datajack, flags] of [
    ['runner without datajack', false, 0, 0],
    ['runner with datajack', false, 0xffff, 0],
    ...Array.from({ length: 8 }, (_, flags) => [`Jake cyberware ${flags}`, true, 0, flags]),
  ])
    test(`notes: ${name}, budget ${budget}`, () => {
      const prepare = ({ put, mem }) => {
        put(W.MEMBER_NUMBER, jake ? 0x08b2 : 0x1234);
        put(W.MEMBER_DATAJACK, datajack);
        [W.JAKE_DERMAL_ARMOUR, W.JAKE_SKILLSOFT, W.JAKE_WIRED_REFLEXES].forEach((at, n) => {
          mem.wram[at] = (flags >>> n) & 1;
        });
      };
      const pads = jake || datajack ? [0x8000] : [];
      const actual = compareRun(notesJsr, true, prepare, budget, pads);
      assertFrozenRun(actual);
      assert.equal(
        actual.calls.length,
        jake ? 2 + [1, 2, 4].filter((bit) => flags & bit).length : datajack ? 1 : 0,
      );
      assert.equal(actual.input, pads.length);
      if (pads.length) assert.ok(actual.uploads.length >= 3);
    });

for (const budget of [1, 7])
  for (const [name, count, last, leaderOnly, notices] of [
    ['leader', 1, 0, false, false],
    ['two members', 2, 2, false, false],
    ['four members', 4, 6, false, false],
    ['leader only', 4, 6, true, false],
    ['odd last index', 3, 5, false, false],
    ['release notices and target', 2, 2, false, true],
  ])
    test(`party status: ${name}, budget ${budget}`, () => {
      const prepare = ({ put, mem }) => {
        put(W.GROUP_INDEX, last);
        put(W.GROUP_LEADER_ONLY, leaderOnly ? 0xffff : 0);
        put(W.GLOVE_KIND, 3);
        put(W.GLOVE_TARGET_TAG, notices ? 1 : 0xffff);
        put(W.GLOVE_NAME_WINDOW, 0);
        for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2)
          put(W.NOTICE_WINDOWS + n, notices && n === 0 ? 0 : 0xffff);
        for (let n = 0; n < count; n++) {
          put(W.GROUP_NUMBERS + 2 * n, mem.read16(0x809700 + 2 * n));
          put(W.GROUP_SLOTS + 2 * n, 2 * n);
          put(W.OBJECT_RECORD + 2 * n, 0x6200 + 0x20 * n);
          mem.wram[STATE_COUNT + 0x6200 + 0x20 * n] = 10 + n;
          mem.wram[W.MAGIC_POINTS + n] = n === 0 ? 255 : 2 + n;
        }
        const record = mem.read16(0x80971a);
        mem.wram[record + 1] = 25;
        mem.wram[record + 5] = 255;
      };
      const actual = compareRun(partyStatusJsr, true, prepare, budget, [0x8000]);
      assertFrozenRun(actual);
      assert.equal(actual.calls.length, 1 + (leaderOnly ? 1 : count) * 7);
      assert.equal(actual.input, 1);
      assert.equal(actual.wram[W.GLOVE_KIND], 0);
      assert.ok(actual.uploads.length >= 3);
    });

for (const budget of [1, 7])
  for (const [name, direct, prepare, pads] of [
    [
      'spell choice',
      directSpell.chooseSpellSequence,
      ({ put }) => {
        put(W.SPELL_LIST, 1);
        put(W.SPELL_LIST + 2, 0);
      },
      [0x400, 0, 0x8000],
    ],
    [
      'equipment',
      equipmentRowsJsr,
      ({ put }) => {
        put(W.STATUS_WINDOW, 0);
        put(W.MEMBER_INDEX, 0);
        put(W.RUNNER_WEAPON, 0xffff);
        put(W.RUNNER_ARMOUR, 0xffff);
        put(W.RUNNER_ARMOUR_RATING, 12);
        put(W.SELECTED_SPELL_NAME, 0x714d);
      },
      [],
    ],
    [
      'skills',
      skillsJsr,
      ({ put, mem }) => {
        put(W.DP_MEMBER_RECORD, 0x6000);
        mem.wram[W.DP_MEMBER_RECORD_BANK] = 0x7e;
        mem.wram.set([1, 0, 3, 0, 0, 0], 0x6000);
      },
      [0x8000],
    ],
    [
      'notes',
      notesJsr,
      ({ put, mem }) => {
        put(W.MEMBER_NUMBER, 0x08b2);
        mem.wram[W.JAKE_DERMAL_ARMOUR] = 1;
      },
      [0x8000],
    ],
    [
      'party',
      partyStatusJsr,
      ({ put, mem }) => {
        put(W.GLOVE_TARGET_TAG, 0xffff);
        for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
        put(W.GROUP_INDEX, 0);
        put(W.GROUP_LEADER_ONLY, 0);
        put(W.GROUP_NUMBERS, mem.read16(0x809700));
        put(W.GROUP_SLOTS, 0);
        put(W.OBJECT_RECORD, 0x6200);
        mem.wram[STATE_COUNT + 0x6200] = 12;
        const record = mem.read16(0x80971a);
        mem.wram[record + 1] = 4;
        mem.wram[record + 5] = 20;
        mem.wram[W.MAGIC_POINTS] = 17;
      },
      [0x8000],
    ],
  ])
    test(`default live renderer: ${name}, budget ${budget}`, () => {
      const actual = compareRun(direct, true, prepare, budget, pads, true);
      assertFrozenRun(actual);
      assert.ok(
        actual.uploads.some(([pc]) => pc === 0x81accc),
        'real glyph upload',
      );
    });
