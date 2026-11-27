import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import { compareRun } from './member-menu-caller-harness.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { selectObjectAnimation } from '../src/game/object-turn.mjs';
import { controlPlayerSequence as directControl } from '../src/game/player-control.mjs';
import { partyStatusSequence } from './register-forms/party-status.mjs';
import { CAMERA_ROTATION_SRAM } from '../src/data/native-player-control.mjs';
import * as W from '../src/data/wram.mjs';

useLiftVectors(import.meta.url);

function runPlayer(
  variant,
  budget,
  realDrawing = false,
  members = 1,
  leaderOnly = false,
  control = null,
) {
  return compareRun(
    (h, events, renderer) => directControl(h, events, renderer),
    true,
    ({ put, mem }) => {
      put(W.PLAYER_OBJECT, 2);
      put(W.PAD_PRESSED, variant === 'party' ? 0x2000 : variant === 'weapon notice' ? 0x80 : 0x40);
      put(W.PAD_HELD, 0);
      put(W.GLOVE_KIND, 0);
      put(W.GROUP_INDEX, 2 * (members - 1));
      put(W.GROUP_LEADER_ONLY, leaderOnly ? 1 : 0);
      put(W.RUNNER_WEAPON, 0xffff);
      put(W.SELECTED_SPELL_SCRIPT, 0);
      for (let member = 0; member < members; member++) {
        const slot = 2 * (member + 1),
          record = 0x6200 + 0x20 * member;
        put(W.GROUP_SLOTS + 2 * member, slot);
        put(W.GROUP_NUMBERS + 2 * member, mem.read16(0x809700 + 2 * member));
        put(W.OBJECT_RECORD + slot, record);
        mem.wram[record + 2] = member ? 0 : 255;
        mem.wram[W.MAGIC_POINTS + member] = member ? 255 : 0;
      }
      if (control) {
        mem.sram = new Uint8Array(0x2000);
        for (const [field, value] of control)
          if (field >= 0x10000) mem.write16(field, value);
          else put(field, value);
      }
      for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
    },
    budget,
    variant === 'party' || variant.endsWith('notice') ? [0x8000] : [],
    realDrawing,
    ({ h, events, routines, bind }) => {
      bind(0x80ed3c, () => partyStatusSequence(h, events, routines));
    },
  );
}

for (const budget of [1, 7])
  for (const members of [1, 3])
    for (const leaderOnly of [false, true])
      for (const realDrawing of [false, true])
        test(`player party status: ${members} members, leader only ${leaderOnly}, budget ${budget}, glyphs ${realDrawing}`, () => {
          const actual = runPlayer('party', budget, realDrawing, members, leaderOnly);
          assertFrozenRun(actual);
          assert.equal(actual.input, 1);
          assert.equal(actual.wram[0] | (actual.wram[1] << 8), 0);
          if (realDrawing) assert.ok(actual.uploads.some(([pc]) => pc === 0x81accc));
        });

for (const budget of [1, 7])
  for (const variant of ['weapon notice', 'spell notice'])
    for (const realDrawing of [false, true])
      test(`player ${variant}, budget ${budget}, glyphs ${realDrawing}`, () => {
        const actual = runPlayer(variant, budget, realDrawing);
        assertFrozenRun(actual);
        assert.equal(actual.input, 1);
        assert.equal(
          actual.wram[W.OBJECT_SELECTION + 2] | (actual.wram[W.OBJECT_SELECTION + 3] << 8),
          0,
        );
        assert.equal(actual.wram[0] | (actual.wram[1] << 8), 0);
        if (realDrawing) assert.ok(actual.uploads.some(([pc]) => pc === 0x81accc));
      });

const controlState = (changes = []) => [
  [W.PAD_PRESSED, 0],
  [W.OBJECT_KIND + 2, 0],
  [W.OBJECT_SELECTION + 2, 0xffff],
  [W.OBJECT_DIRECTION + 2, 3],
  [W.GLOVE_NAME_WINDOW, 0xffff],
  ...changes,
];

for (const budget of [1, 7])
  for (const held of [0, 0x800, 0x900, 0x100, 0x500, 0x400, 0x600, 0x200, 0xa00])
    for (const rotation of [0, 1, 3])
      for (const idle of [0, 0xffff])
        test(`player walk and idle: held ${held}, rotation ${rotation}, idle ${idle}, budget ${budget}`, () => {
          const control = controlState([
            [W.PAD_HELD, held],
            [W.PLAYER_IDLE, idle],
            [CAMERA_ROTATION_SRAM, rotation],
          ]);
          const actual = runPlayer('control', budget, false, 1, false, control);
          assertFrozenRun(actual);
          assert.equal(actual.input, 0);
          assert.equal(actual.wram[0] | (actual.wram[1] << 8), 0);
        });

for (const budget of [1, 7])
  for (const edge of [0, 0xffff])
    for (const [name, changes, result = 0] of [
      ['action glove', [[W.PAD_PRESSED, 0x8000]]],
      [
        'weapon aim',
        [
          [W.PAD_PRESSED, 0x80],
          [W.RUNNER_WEAPON, 0],
        ],
      ],
      [
        'heavy weapon aim',
        [
          [W.PAD_PRESSED, 0x80],
          [W.RUNNER_WEAPON, 0],
          [W.RUNNER_WEAPON_KIND, 0xff00],
        ],
      ],
      [
        'spell aim',
        [
          [W.PAD_PRESSED, 0x40],
          [W.SELECTED_SPELL_SCRIPT, 1],
        ],
      ],
      [
        'glove turn',
        [
          [W.GLOVE_KIND, 1],
          [W.GLOVE_TARGET_TAG, 0xffff],
        ],
      ],
      [
        'glove away',
        [
          [W.GLOVE_KIND, 1],
          [W.PAD_PRESSED, 0x80],
        ],
      ],
      [
        'glove away with name',
        [
          [W.GLOVE_KIND, 1],
          [W.PAD_PRESSED, 0x80],
          [W.GLOVE_NAME_WINDOW, 0],
        ],
      ],
      [
        'weapon release',
        [
          [W.GLOVE_KIND, 1],
          [W.AIMING_WEAPON, 0xffff],
          [W.PAD_PRESSED, 0x8000],
        ],
      ],
      [
        'spell release',
        [
          [W.GLOVE_KIND, 1],
          [W.AIMING_SPELL, 0xffff],
          [W.PAD_PRESSED, 0x20],
        ],
      ],
      [
        'summon aim',
        [
          [W.GLOVE_KIND, 1],
          [W.AIMING_SPELL, 0xffff],
          [W.PAD_HELD, 0x80],
          [W.PAD_PRESSED, 0x40],
          [W.SELECTED_SPELL_SCRIPT, 0x1ec],
        ],
        0xc0,
      ],
    ])
      test(`player ${name}: coordinate ${edge}, budget ${budget}`, () => {
        const control = controlState([
          [W.OBJECT_X + 2, edge],
          [W.OBJECT_Y + 2, edge],
          [W.OBJECT_HEIGHT + 2, edge],
          [W.GLOVE_X, edge],
          [W.GLOVE_Y, edge],
          ...changes,
        ]);
        const actual = runPlayer('control', budget, false, 1, false, control);
        assertFrozenRun(actual);
        assert.equal(actual.input, 0);
        assert.equal(actual.wram[0] | (actual.wram[1] << 8), result);
      });

// User report 2026-11-17 (rom_byte_absent at $80990C): B ended an aim in the frame
// the leader turned to the glove. The turn (80:AAAF) reselected the leader's action
// through 80:A985, which left its action entry pointer in DP 00, and 80:E1AA then
// selected the idle action for that "slot", reading and writing bank 80 ROM. The
// correction reloads the leader; the original keeps its aim action.
for (const bugfixes of [false, true])
  test(`player weapon release in the frame of a turn, fixes ${bugfixes}`, () => {
    const aim = 5,
      control = controlState([
        [W.GLOVE_KIND, 1],
        [W.AIMING_WEAPON, 0xffff],
        [W.PAD_PRESSED, 0x8000],
        [W.OBJECT_SELECTION + 2, aim],
        [W.OBJECT_FRAME_COUNT + 2, 0],
        [W.OBJECT_DIRECTION + 2, 0],
        [W.GLOVE_X, 0x400],
        [W.GLOVE_Y, 0x400],
      ]);
    const actual = compareRun(
      (h, events, renderer) => {
        h.a.vm = { ...h.a.vm, gameplay: { bugfixes, aimReleaseFix: bugfixes } };
        return directControl(h, events, renderer);
      },
      true,
      ({ put, mem }) => {
        put(W.PLAYER_OBJECT, 2);
        put(W.PAD_HELD, 0);
        put(W.RUNNER_WEAPON, 0xffff);
        put(W.SELECTED_SPELL_SCRIPT, 0);
        put(W.GROUP_SLOTS, 2);
        put(W.GROUP_NUMBERS, mem.read16(0x809700));
        put(W.OBJECT_RECORD + 2, 0x6200);
        for (const [field, value] of control) put(field, value);
        for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
      },
      7,
      [],
      false,
    );
    assert.notEqual(
      actual.wram[W.OBJECT_DIRECTION + 2] | (actual.wram[W.OBJECT_DIRECTION + 3] << 8),
      0,
      'the leader turned to the glove in this frame',
    );
    const selection =
      actual.wram[W.OBJECT_SELECTION + 2] | (actual.wram[W.OBJECT_SELECTION + 3] << 8);
    assert.equal(selection, bugfixes ? 0 : aim, bugfixes ? 'the leader is idle' : 'the aim stays');
    assert.equal(actual.wram[W.AIMING_WEAPON], 0, 'the aim has ended');
  });

// Without the correction 80:E1AA indexes the object tables with the action entry
// pointer that the turn left in DP 00: Jake's list 8C:88C6 has nine actions, so the
// pointer is 88C6 + 2 action and A985 reads the code words 80:1038 + pointer
// (80:98FE to 990F) and 80:1198 + pointer (80:9A5E to 9A6F). The ROM-free package
// keeps those bytes (docs/ROM-CODE-AUDIT.md); 80:990C was missing in the report.
test('the release selection reads every Jake action pointer from the data package', () => {
  const memory = new LiveGame(cartridge, { pad: () => 0 }).memory,
    jakeList = memory.read16(0x8ced8a + 2 * 0x0b);
  assert.equal(jakeList, 0x88c6);
  for (let action = 0; action < 9; action++) {
    const pointer = jakeList + 2 * action;
    memory.write16(0x7e0000, pointer);
    memory.write16(0x7e0002, 0);
    assert.doesNotThrow(() => selectObjectAnimation(memory, memory.wram), `action ${action}`);
    for (const table of [0x1038, 0x1198])
      assert.doesNotThrow(() => memory.read16(0x800000 + table + pointer), `table ${table}`);
  }
});
