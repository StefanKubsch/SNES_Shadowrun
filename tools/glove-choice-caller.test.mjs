import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import * as direct from '../src/game/glove-target.mjs';
import * as former from '../proof/caller/glove-target.mjs';
import { showNoticeSequence } from '../proof/caller/notice-show.mjs';
import { runDrawWindowList } from '../proof/caller/window-list.mjs';
import { runUnpackWindowMap, runRequestUpload } from '../src/game/window-list.mjs';
import { closeDialogSequence } from '../src/game/dialog-talk.mjs';
import * as W from '../src/data/wram.mjs';

function runChoice(module, name, budget, target, pads, options = {}) {
  let finalShadow;
  return compareRun(
    function* (h, events, routines) {
      const result = yield* module[name](h, events, routines);
      finalShadow = h.a.mem.wram[W.HDMAEN_SHADOW];
      return result;
    },
    false,
    ({ put }) => {
      put(W.PLAYER_OBJECT, 0);
      put(0, 4);
      put(W.GLOVE_NAME_WINDOW, options.name ? 0 : 0xffff);
      put(W.OBJECT_NUMBER + 2, 0x1234);
      put(W.OBJECT_X + 2, options.distance ?? 0);
      put(W.OBJECT_HEIGHT + 2, options.height ?? 0);
      put(W.MEMBER_MENU_ACTIVE, options.menu ? 1 : 0);
      put(W.TEXT_MAP_UPLOAD, options.request ?? 0);
      put(W.CAMERA_X, options.camera ?? 0);
      put(W.CAMERA_Y, options.camera ?? 0);
      put(W.OBJECT_HEIGHT + 4, options.camera ?? 0);
      for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
    },
    budget,
    pads,
    true,
    ({ h, events, put, routines, bind }) => {
      let moves = 0;
      routines.set(0x80be6d, () => {
        moves++;
        put(W.GLOVE_TARGET_TAG, target ? 0 : 0xffff);
        put(W.GLOVE_TARGET_OBJECT, 2);
        put(W.OBJECT_FLAGS + 2, moves <= (options.reject ?? 0) ? 0 : 0x8000);
        h.ctx.a = target ? 0 : 0xffff;
        return h.rts();
      });
      routines.set(0x81ad92, runDrawWindowList);
      routines.set(0x81a9b2, runUnpackWindowMap);
      routines.set(0x81acb5, runRequestUpload);
      bind(0x8092c5, () => closeDialogSequence(h, events));
      bind(0x80fec1, () => showNoticeSequence(h, events, routines));
      if (options.close) {
        h.ctx.s = 0x1eef;
        put(W.DRAW_LIST_INDEX, 0);
        put(W.DRAW_LIST, 0);
        put(W.OBJECT_VRAM_SLOT_COUNT, 1);
        put(W.OBJECT_FRAME_OFFSET, 2);
        put(W.VRAM_SLOT_NEXT, 0);
        put(W.HDMAEN_SHADOW, options.shadow);
        const service = events.interrupts.textWait;
        events.interrupts.textWait = (callee, frameEvents, status, pc) => {
          if (pc === 0x80ae0c) return true;
          if (pc === 0x80ae0f) {
            put(W.NMI_JOB_LISTS, 0);
            put(W.DP_VRAM_UPLOAD_INDEX, 0);
            return true;
          }
          const caller = h.a.mem.read16(0x7e0000 | (h.ctx.s + 1));
          if (pc === 0x81b0a9 && caller !== 0x9be5) {
            put(W.RANDOM_STATE, h.a.mem.read16(W.RANDOM_STATE) + 1);
            return true;
          }
          return service(callee, frameEvents, status, pc);
        };
        return (result) => ({ ...result, finalShadow });
      }
    },
  );
}

for (const budget of [1, 7])
  for (const target of [false, true])
    for (const pads of [[0x8000], [0, 0x8000], [0, 0, 0x4000]])
      test(`glove choice real frame wait: target ${target}, pads ${pads}, budget ${budget}`, () => {
        const name = 'chooseObjectUnderGloveSequence';
        const actual = runChoice(direct, name, budget, target, pads);
        assert.deepEqual(actual, runChoice(former, name, budget, target, pads));
        assert.equal(actual.input, pads.length);
        assert.equal(actual.wram[0] | (actual.wram[1] << 8), target ? 2 : 0xffff);
      });

for (const budget of [1, 7])
  for (const pads of [[0x8000], [0x4000], [0x80], [0x40], [0x800f, 0, 0x8000]])
    test(`glove choice real input: pads ${pads}, budget ${budget}`, () => {
      const name = 'chooseObjectUnderGloveSequence';
      const actual = runChoice(direct, name, budget, true, pads);
      assert.deepEqual(actual, runChoice(former, name, budget, true, pads));
      assert.equal(actual.input, pads.length);
      assert.equal(actual.wram[W.PAD_PRESSED] | (actual.wram[W.PAD_PRESSED + 1] << 8), 0);
    });

for (const budget of [1, 7])
  for (const target of [false, true])
    for (const shadow of [0, 1, 0xfe, 0xff])
      test(`spell choice closes member dialog: target ${target}, shadow ${shadow}, budget ${budget}`, () => {
        const name = 'spellGloveTargetSequence';
        const options = { menu: true, close: true, shadow };
        const actual = runChoice(direct, name, budget, target, [0x8000], options);
        assert.deepEqual(actual, runChoice(former, name, budget, target, [0x8000], options));
        assert.equal(actual.finalShadow, shadow & ~1);
        assert.equal(actual.writes.length, 17);
        assert.equal(actual.input, 1);
      });
for (const module of [direct, former])
  test(`glove choice preserves reset boundary: ${module === direct ? 'direct' : 'former'}`, () => {
    assert.throws(
      () => runChoice(module, 'chooseObjectUnderGloveSequence', 1, true, [0x3030]),
      (error) => error.reason === 'task_reset_source_required',
    );
  });

const choices = [
  'chooseObjectUnderGloveSequence',
  'chooseObjectNumberSequence',
  'scriptChooseObjectNumberSequence',
  'scriptChooseObjectSequence',
  'spellGloveTargetSequence',
  'choosePlaceWithGloveSequence',
];
for (const budget of [1, 7])
  for (const name of choices)
    for (const target of [false, true])
      for (const request of [0, 0xffff])
        test(`glove choice real release: ${name}, target ${target}, request ${request}, budget ${budget}`, () => {
          const options = { name: true, request };
          const actual = runChoice(direct, name, budget, target, [0x8000], options);
          assert.deepEqual(actual, runChoice(former, name, budget, target, [0x8000], options));
          assert.equal(actual.wram[W.GLOVE_KIND] | (actual.wram[W.GLOVE_KIND + 1] << 8), 0);
          assert.equal(
            actual.wram[W.SCRIPT_GLOVE_CHOICE] | (actual.wram[W.SCRIPT_GLOVE_CHOICE + 1] << 8),
            0,
          );
          if (name === 'choosePlaceWithGloveSequence')
            assert.equal(actual.wram[W.MOTION_ACTIVE + 4], 1);
          else {
            const result = actual.wram[0] | (actual.wram[1] << 8);
            assert.equal(result, !target ? 0xffff : name.includes('Number') ? 0x1234 : 2);
          }
        });

for (const budget of [1, 7])
  for (const name of [
    'chooseObjectNumberSequence',
    'scriptChooseObjectNumberSequence',
    'scriptChooseObjectSequence',
  ])
    for (const [distance, height, near] of [
      [0x80, 0x80, true],
      [0x81, 0, false],
      [0, 0x81, false],
      [0xffff, 0, true],
      [0x8000, 0, false],
    ])
      for (const menu of [false, true])
        test(`glove choice reach notice: ${name}, distance ${distance}, height ${height}, menu ${menu}, budget ${budget}`, () => {
          const options = { distance, height, menu };
          const actual = runChoice(direct, name, budget, true, [0x8000], options);
          assert.deepEqual(actual, runChoice(former, name, budget, true, [0x8000], options));
          assert.equal(
            actual.wram[0] | (actual.wram[1] << 8),
            near ? (name.includes('Number') ? 0x1234 : 2) : 0xffff,
          );
          if (!near) assert.ok(actual.uploads.length > 0, 'actual notice glyph and window uploads');
        });

for (const budget of [1, 7])
  for (const request of [0, 0xfffe, 0xffff])
    test(`spell choice rejects unusable object then redraws: request ${request}, budget ${budget}`, () => {
      const name = 'spellGloveTargetSequence',
        pads = [0x8000, 0, 0x8000],
        options = { reject: 1, name: true, request };
      const actual = runChoice(direct, name, budget, true, pads, options);
      assert.deepEqual(actual, runChoice(former, name, budget, true, pads, options));
      assert.equal(actual.input, 3);
      assert.equal(
        actual.wram[W.SPELL_TARGET_OBJECT] | (actual.wram[W.SPELL_TARGET_OBJECT + 1] << 8),
        2,
      );
      assert.ok(actual.uploads.length > 0);
    });
for (const budget of [1, 7])
  for (const camera of [0, 0x7fff, 0x8000, 0xffff])
    test(`place choice redraw with wrapped camera and height: ${camera}, budget ${budget}`, () => {
      const name = 'choosePlaceWithGloveSequence',
        options = { camera, name: true };
      const actual = runChoice(direct, name, budget, true, [0x8000], options);
      assert.deepEqual(actual, runChoice(former, name, budget, true, [0x8000], options));
      assert.equal(actual.wram[W.MOTION_ACTIVE + 4], 1);
      assert.ok(actual.uploads.length > 0);
    });
