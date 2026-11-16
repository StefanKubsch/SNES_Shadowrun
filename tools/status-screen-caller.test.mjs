import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import * as directStatus from '../src/game/status-screen.mjs';
import * as formerStatus from '../proof/caller/status-screen.mjs';
import { decimalNumberSequence } from '../proof/caller/decimal-number.mjs';
import { equipmentRowsSequence } from '../proof/caller/equipment-window.mjs';
import { closeDialogSequence as formerClose } from '../proof/caller/dialog-talk.mjs';
import { closePortraitWindowSequence } from '../proof/caller/portrait-window.mjs';
import { reloadObjectTiles } from '../src/system/native-scene-tiles.mjs';
import { buildSpriteList } from '../proof/replay/native-scene-sprites.mjs';
import { clearFixedColourRoutine } from '../src/game/dialog-talk.mjs';
import * as W from '../src/data/wram.mjs';
import { sendApuCommand } from '../src/system/native-input-apu.mjs';
import { itemMenuSequence } from '../proof/caller/item-menu.mjs';
import { spellMenuSequence, STATUS_ENTRY } from '../proof/caller/member-spell-menu.mjs';
import { skillsSequence, notesSequence } from '../proof/caller/status-submenus.mjs';
import { chooseFromMenuSequence } from '../proof/caller/menu-choice.mjs';
import { memberPortraitSequence } from '../proof/caller/member-portrait.mjs';
import {
  uploadFirstPortraitSequence,
  uploadPortraitTilesSequence,
} from '../proof/caller/portrait-upload.mjs';
import { unpackPortraitRoutine, shiftPortraitRowsRoutine } from '../src/game/portrait-upload.mjs';
function runStatus(
  module,
  direct,
  entry,
  runner,
  variant,
  budget,
  realDrawing = false,
  alternate = false,
  initialToken = 0,
) {
  let captureFinal;
  const selectedRow =
    variant === 'submenu' || variant === 'unknown'
      ? 1
      : variant.startsWith('submenu-')
        ? Number(variant.split('-')[1])
        : 0;
  const pads =
    entry === 0x80ea8e
      ? [0x8000]
      : selectedRow
        ? [
            ...Array.from({ length: selectedRow }, () => [0x400, 0]).flat(),
            0x8000,
            ...([5, 6].includes(selectedRow)
              ? [0, variant.endsWith('-end') ? 0x2000 : 0x8000]
              : []),
            ...(variant.endsWith('-end') && selectedRow === 5 ? [] : [0, 0x8000]),
          ]
        : [variant === 'cancel' ? 0x2000 : 0x8000];
  const result = compareRun(
    function* (h, e, r) {
      const returned = yield* module.statusScreenSequence(
        h,
        e,
        ...(direct ? [entry, r] : [r, entry]),
      );
      captureFinal();
      return returned;
    },
    direct,
    ({ put, mem }) => {
      const number = mem.read16(0x809700 + 2 * runner),
        jake = mem.read16(0x809700),
        record = mem.read16(0x80971a);
      put(0, variant === 'fallback' ? 6 : 2);
      put(W.PLAYER_OBJECT, 2);
      put(W.DRAW_LIST_INDEX, 0);
      put(W.DRAW_LIST, 0);
      put(W.OBJECT_FRAME_OFFSET, 2);
      put(W.OBJECT_VRAM_SLOT_COUNT, 1);
      mem.wram[W.APU_COMMAND_TOKEN] = initialToken;
      mem.wram[W.JAKE_ALTERNATE_PORTRAIT] = alternate ? 1 : 0;
      put(W.GLOVE_TARGET_TAG, 0xffff);
      put(W.OBJECT_NUMBER + 2, number);
      put(W.OBJECT_NUMBER + 6, 0x1234);
      put(W.OBJECT_RECORD + 2, 0x6200);
      put(W.OBJECT_RECORD + 6, 0x6220);
      mem.wram[0x6202] = 255;
      put(W.GROUP_INDEX, 0);
      put(W.GROUP_NUMBERS, number);
      put(W.GLOVE_KIND, 3);
      for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
      mem.wram.set([2, 3, 99, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 0, 0, 0, 0, 0], record);
      put(W.KARMA, 0xffff);
      put(W.NUYEN, 0xffff);
      put(W.NUYEN + 2, 0xffff);
      put(W.SELECTED_SPELL_NAME, 0x714d);
      for (let n = 0; n < 26; n += 2) {
        put(W.RUNNER_WEAPON + n, 0xffff);
        put(W.RUNNER_ARMOUR + n, 0xffff);
      }
      assert.ok(jake, 'real runner table');
    },
    budget,
    pads,
    realDrawing,
    ({ h, mem, events, put, routines, bind, calls }) => {
      if (variant === 'unknown') {
        const read = mem.read8.bind(mem);
        mem.read8 = (address) =>
          address === 0x80ed30 ? 0x34 : address === 0x80ed31 ? 0x12 : read(address);
      }
      h.ctx.s = 0x1eef;
      const snapshot = () => [
        mem.wram[W.HDMAEN_SHADOW],
        mem.read16(W.TMW_SHADOW),
        mem.wram.slice(W.PORTRAIT_HDMA_TABLE, W.PORTRAIT_HDMA_TABLE + 13),
        mem.wram[W.PORTRAIT_WINDOW_LEFT],
        mem.wram[W.PORTRAIT_WINDOW_RIGHT],
      ];
      captureFinal = () => calls.push(['final portrait', ...snapshot()]);
      const service = events.interrupts.textWait;
      events.interrupts.textWait = (callee, frameEvents, status, pc) => {
        if (pc === 0x80ae0c) return true;
        if (pc === 0x80ae0f) {
          if (!mem.read16(W.NMI_JOB_LISTS)) return true;
          calls.push([
            'scene tile jobs',
            mem.wram.slice(W.VRAM_UPLOAD_SOURCES, W.VRAM_UPLOAD_SOURCES + 6),
          ]);
          put(W.NMI_JOB_LISTS, 0);
          put(W.DP_VRAM_UPLOAD_INDEX, 0);
          return true;
        }
        if (pc === 0x80901f) {
          calls.push([
            'portrait upload',
            mem.read16(W.PORTRAIT_DMA_REQUEST),
            mem.read16(W.PORTRAIT_PALETTE_START),
            mem.wram.slice(0x15250, 0x16250),
          ]);
          put(W.PORTRAIT_DMA_REQUEST, mem.read16(W.PORTRAIT_DMA_REQUEST) | 0x8000);
          return true;
        }
        const caller = mem.read16(0x7e0000 | (h.ctx.s + 1));
        if (pc === 0x81b0a9 && caller !== 0xa6ec && caller !== 0xf956) {
          calls.push([
            [0x8f9d, 0x92d4].includes(caller) ? 'scene close frame' : 'portrait frame',
            h.ctx.x,
            ...snapshot(),
          ]);
          put(W.RANDOM_STATE, mem.read16(W.RANDOM_STATE) + 1);
          return true;
        }
        return service(callee, frameEvents, status, pc);
      };
      routines.set(0x809f6d, unpackPortraitRoutine);
      routines.set(0x808f20, shiftPortraitRowsRoutine);
      bind(0x809022, () => uploadFirstPortraitSequence(h, events, routines));
      bind(0x808ff5, () => uploadPortraitTilesSequence(h, events, routines));
      bind(0x80e4b3, () => memberPortraitSequence(h, events, routines));
      routines.set(0x81886a, clearFixedColourRoutine);
      routines.set(0x81f007, (callee) => sendApuCommand(callee.a, false));
      routines.set(0x80adf4, reloadObjectTiles);
      routines.set(0x80b8de, buildSpriteList);
      bind(0x808f97, () => closePortraitWindowSequence(h, events, routines));
      bind(0x8092c5, () => formerClose(h, events, routines));
      bind(0x80fdcf, () => decimalNumberSequence(h, events, routines));
      bind(0x80e9c5, () => equipmentRowsSequence(h, events, routines));
      bind(0x80a6ad, () => chooseFromMenuSequence(h, events, routines, 0x80a6ad));
      for (const target of [0x80e572, 0x80e577, 0x80e57f])
        bind(target, () => itemMenuSequence(h, events, routines, target));
      bind(STATUS_ENTRY, () => spellMenuSequence(h, events, routines, STATUS_ENTRY));
      bind(0x80e834, () => skillsSequence(h, events, routines));
      bind(0x80e8c8, () => notesSequence(h, events, routines));
    },
  );
  result.wram.fill(0, 0x1e80, 0x1ef0);
  for (const [, snapshot] of result.uploads) snapshot.fill(0, 0x1e80 - 0x1cc, 0x1ef0 - 0x1cc);
  return result;
}
for (const budget of [1, 7])
  for (const runner of [0, 1])
    for (const [entry, variant] of [
      [0x80ea6e, 'Exit'],
      [0x80ea89, 'Exit'],
      [0x80ea8e, 'items'],
      [0x80ea6e, 'fallback'],
      [0x80ea89, 'cancel'],
      [0x80ea89, 'submenu'],
    ])
      test(`status caller: entry ${entry}, runner ${runner}, ${variant}, budget ${budget}`, () => {
        const actual = runStatus(directStatus, true, entry, runner, variant, budget);
        assert.deepEqual(actual, runStatus(formerStatus, false, entry, runner, variant, budget));
        assert.equal(actual.input, entry === 0x80ea8e ? 1 : variant === 'submenu' ? 5 : 1);
        assert.equal(
          actual.wram[W.MEMBER_MENU_ACTIVE] | (actual.wram[W.MEMBER_MENU_ACTIVE + 1] << 8),
          0,
        );
        assert.equal(actual.writes.filter((write) => write === '8513,2,1').length, 2);
        assert.ok(actual.writes.includes('8514,12079,2'));
        assert.ok(actual.writes.includes('8514,32639,2'));
        assert.equal(
          actual.wram[W.APU_COMMAND_TOKEN],
          actual.writes.filter((write) => write.startsWith('8512,')).length & 0xff,
        );
        assert.ok(actual.writes.includes('8498,224,1'), 'fixed colour reset');
        assert.ok(actual.writes.includes('8497,0,1'), 'colour math disabled');
      });

for (const budget of [1, 7])
  for (const runner of [0, 1])
    test(`status default glyphs: runner ${runner}, budget ${budget}`, () => {
      const actual = runStatus(directStatus, true, 0x80ea89, runner, 'Exit', budget, true);
      assert.deepEqual(
        actual,
        runStatus(formerStatus, false, 0x80ea89, runner, 'Exit', budget, true),
      );
      assert.ok(actual.uploads.some(([pc]) => pc === 0x81accc));
    });

for (const budget of [1, 7])
  test(`status alternate Jake portrait, budget ${budget}`, () => {
    const actual = runStatus(directStatus, true, 0x80ea89, 0, 'Exit', budget, false, true);
    assert.deepEqual(
      actual,
      runStatus(formerStatus, false, 0x80ea89, 0, 'Exit', budget, false, true),
    );
    assert.equal(actual.calls.filter((c) => c[0] === 'portrait frame').length, 11);
    assert.equal(actual.calls.filter((c) => c[0] === 'scene close frame').length, 12);
    assert.equal(actual.wram[W.HDMAEN_SHADOW] & 1, 0);
    assert.equal(actual.calls.filter((c) => c[0] === 'portrait upload').length, 2);
  });

for (const budget of [1, 7])
  for (const row of [1, 2, 3, 4, 5, 6])
    for (const realDrawing of [false, true])
      test(`status real submenu: row ${row}, budget ${budget}, glyphs ${realDrawing}`, () => {
        const actual = runStatus(
          directStatus,
          true,
          0x80ea89,
          0,
          'submenu-' + row,
          budget,
          realDrawing,
        );
        assert.deepEqual(
          actual,
          runStatus(formerStatus, false, 0x80ea89, 0, 'submenu-' + row, budget, realDrawing),
        );
        assert.equal(actual.input, 2 * row + 3 + ([5, 6].includes(row) ? 2 : 0));
        if (realDrawing) assert.ok(actual.uploads.some(([pc]) => pc === 0x81accc));
      });

for (const budget of [1, 7]) {
  for (const row of [5, 6])
    test(`status Select in submenu: row ${row}, budget ${budget}`, () => {
      const actual = runStatus(directStatus, true, 0x80ea89, 0, 'submenu-' + row + '-end', budget);
      assert.deepEqual(
        actual,
        runStatus(formerStatus, false, 0x80ea89, 0, 'submenu-' + row + '-end', budget),
      );
      assert.equal(actual.input, 2 * row + 3 + (row === 6 ? 2 : 0));
      assert.equal(
        actual.wram[W.DIALOG_END] | (actual.wram[W.DIALOG_END + 1] << 8),
        row === 5 ? 0xffff : 0,
      );
    });
  test(`status rejects an unknown submenu before its frame, budget ${budget}`, () => {
    for (const [module, direct] of [
      [directStatus, true],
      [formerStatus, false],
    ])
      assert.throws(
        () => runStatus(module, direct, 0x80ea89, 0, 'unknown', budget),
        (error) => {
          assert.deepEqual(error, {
            taskBoundary: true,
            reason: 'task_ea6e_submenu_open',
            pc: 0x80ecea,
            x: 2,
            target: 0x801234,
          });
          return true;
        },
      );
  });
}

for (const budget of [1, 7])
  for (const token of [0xfe, 0xff])
    test(`status sound token wrap: ${token}, budget ${budget}`, () => {
      const actual = runStatus(
        directStatus,
        true,
        0x80ea89,
        0,
        'cancel',
        budget,
        false,
        false,
        token,
      );
      assert.deepEqual(
        actual,
        runStatus(formerStatus, false, 0x80ea89, 0, 'cancel', budget, false, false, token),
      );
      assert.equal(actual.wram[W.APU_COMMAND_TOKEN], (token + 2) & 0xff);
      assert.equal(actual.writes.filter((write) => write === '8513,2,1').length, 2);
    });
