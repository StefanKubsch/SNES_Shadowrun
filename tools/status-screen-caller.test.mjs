import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import { compareRun } from './member-menu-caller-harness.mjs';
import { pictureVideoOf } from './text-window-caller-harness.mjs';
import { controlPlayerSequence as directPlayer } from '../src/game/player-control.mjs';
import * as directStatus from '../src/game/status-screen.mjs';
import { decimalNumberSequence } from './register-forms/decimal-number.mjs';
import { equipmentRowsSequence } from './register-forms/equipment-window.mjs';
import { closePortraitWindowSequence } from './register-forms/portrait-window.mjs';
import * as W from '../src/data/wram.mjs';
import { itemMenuSequence } from './register-forms/item-menu.mjs';
import { spellMenuSequence, STATUS_ENTRY } from './register-forms/member-spell-menu.mjs';
import { skillsSequence, notesSequence } from './register-forms/status-submenus.mjs';
import { memberPortraitSequence } from './register-forms/member-portrait.mjs';
import { unpackPortraitRoutine } from './register-forms/portrait-routines.mjs';
import { clearFixedColourJsl, shiftPortraitRowsJsr } from './register-forms/jsr-forms.mjs';

useLiftVectors(import.meta.url);

function runStatus(
  entry,
  runner,
  variant,
  budget,
  realDrawing = false,
  alternate = false,
  initialToken = 0,
  player = false,
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
      const returned = player
        ? yield* directPlayer(h, e, r)
        : yield* directStatus.statusScreenSequence(h, e, entry, r);
      captureFinal();
      return returned;
    },
    true,
    ({ put, mem }) => {
      const number = mem.read16(0x809700 + 2 * runner),
        jake = mem.read16(0x809700),
        record = mem.read16(0x80971a);
      put(0, variant === 'fallback' ? 6 : 2);
      put(W.PLAYER_OBJECT, 2);
      if (player) put(W.PAD_PRESSED, entry === 0x80ea89 ? 0x1000 : 0x4000);
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
    ({ h, mem, events, put, routines, bind, calls, remainingInput }) => {
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
      let openingFrames = 0;
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
          // The second transfer is followed by eleven opening steps. Closing
          // frames are identified by chronology, not removed CPU return words.
          if (mem.read16(W.PORTRAIT_DMA_REQUEST) === 0x800) openingFrames = 11;
          calls.push([
            'portrait upload',
            mem.read16(W.PORTRAIT_DMA_REQUEST),
            mem.read16(W.PORTRAIT_PALETTE_START),
            mem.wram.slice(0x15250, 0x16250),
          ]);
          put(W.PORTRAIT_DMA_REQUEST, mem.read16(W.PORTRAIT_DMA_REQUEST) | 0x8000);
          return true;
        }
        if (pc === 0x81b0a9 && (openingFrames > 0 || remainingInput() === 0)) {
          calls.push([
            openingFrames > 0 ? 'portrait frame' : 'scene close frame',
            // Game state only (user decision 2026-11-17): no X (the portrait window step).
            ...snapshot(),
          ]);
          if (openingFrames > 0) openingFrames--;
          put(W.RANDOM_STATE, mem.read16(W.RANDOM_STATE) + 1);
          return true;
        }
        return service(callee, frameEvents, status, pc);
      };
      routines.set(0x809f6d, unpackPortraitRoutine);
      routines.set(0x808f20, shiftPortraitRowsJsr);
      bind(0x80e4b3, () => memberPortraitSequence(h, events, routines));
      routines.set(0x81886a, clearFixedColourJsl);
      bind(0x808f97, () => closePortraitWindowSequence(h, events, routines));
      bind(0x80fdcf, () => decimalNumberSequence(h, events, routines));
      bind(0x80e9c5, () => equipmentRowsSequence(h, events, routines));
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
        const actual = runStatus(entry, runner, variant, budget);
        assertFrozenRun(actual);
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
        assert.equal(pictureVideoOf(actual).fixedColour, 0, 'fixed colour reset');
        assert.equal(pictureVideoOf(actual).mathLayers, 0, 'colour math disabled');
      });

for (const budget of [1, 7])
  for (const runner of [0, 1])
    test(`status default glyphs: runner ${runner}, budget ${budget}`, () => {
      const actual = runStatus(0x80ea89, runner, 'Exit', budget, true);
      assertFrozenRun(actual);
      assert.ok(actual.uploads.some(([pc]) => pc === 0x81accc));
    });

for (const budget of [1, 7])
  test(`status alternate Jake portrait, budget ${budget}`, () => {
    const actual = runStatus(0x80ea89, 0, 'Exit', budget, false, true);
    assertFrozenRun(actual);
    assert.equal(actual.calls.filter((c) => c[0] === 'portrait frame').length, 11);
    assert.equal(actual.calls.filter((c) => c[0] === 'scene close frame').length, 12);
    assert.equal(actual.wram[W.HDMAEN_SHADOW] & 1, 0);
    assert.equal(actual.calls.filter((c) => c[0] === 'portrait upload').length, 2);
  });

for (const budget of [1, 7])
  for (const row of [1, 2, 3, 4, 5, 6])
    for (const realDrawing of [false, true])
      test(`status real submenu: row ${row}, budget ${budget}, glyphs ${realDrawing}`, () => {
        const actual = runStatus(0x80ea89, 0, 'submenu-' + row, budget, realDrawing);
        assertFrozenRun(actual);
        assert.equal(actual.input, 2 * row + 3 + ([5, 6].includes(row) ? 2 : 0));
        if (realDrawing) assert.ok(actual.uploads.some(([pc]) => pc === 0x81accc));
      });

for (const budget of [1, 7]) {
  for (const row of [5, 6])
    test(`status Select in submenu: row ${row}, budget ${budget}`, () => {
      const actual = runStatus(0x80ea89, 0, 'submenu-' + row + '-end', budget);
      assertFrozenRun(actual);
      assert.equal(actual.input, 2 * row + 3 + (row === 6 ? 2 : 0));
      assert.equal(
        actual.wram[W.DIALOG_END] | (actual.wram[W.DIALOG_END + 1] << 8),
        row === 5 ? 0xffff : 0,
      );
    });
  test(`status rejects an unknown submenu before its frame, budget ${budget}`, () => {
    assert.throws(
      () => runStatus(0x80ea89, 0, 'unknown', budget),
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
      const actual = runStatus(0x80ea89, 0, 'cancel', budget, false, false, token);
      assertFrozenRun(actual);
      assert.equal(actual.wram[W.APU_COMMAND_TOKEN], (token + 2) & 0xff);
      assert.equal(actual.writes.filter((write) => write === '8513,2,1').length, 2);
    });

for (const budget of [1, 7])
  for (const variant of ['Exit', 'cancel', 'submenu-5-end'])
    for (const glyphs of [false, true])
      test(`player Start actual status: ${variant}, budget ${budget}, glyphs ${glyphs}`, () => {
        const actual = runStatus(0x80ea89, 0, variant, budget, glyphs, false, 0, true);
        assertFrozenRun(actual);
        assert.equal(actual.wram[0] | (actual.wram[1] << 8), 0);
        assert.ok(actual.input > 0);
        assert.ok(actual.writes.includes('8514,32639,2'));
      });

for (const budget of [1, 7])
  for (const runner of [0, 1])
    for (const glyphs of [false, true])
      test(`player immediate items: runner ${runner}, budget ${budget}, glyphs ${glyphs}`, () => {
        const actual = runStatus(0x80ea8e, runner, 'items', budget, glyphs, false, 0, true);
        assertFrozenRun(actual);
        assert.equal(actual.input, 1);
        assert.equal(actual.wram[0] | (actual.wram[1] << 8), 0);
        assert.ok(actual.calls.some((call) => call[0] === 'scene close frame'));
      });
