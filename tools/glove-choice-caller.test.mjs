import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import { compareRun } from './member-menu-caller-harness.mjs';
import { fontUploaded } from './text-window-caller-harness.mjs';
import * as direct from '../src/game/glove-target.mjs';
import * as W from '../src/data/wram.mjs';

useLiftVectors(import.meta.url);

// The glove choices of src/game/glove-target.mjs with the actual glove movement and
// object search: reach, the spell glove's member dialog close and its rejection of an
// unusable object, the place choice with a wrapped camera and the reset boundary.
// The movement paths themselves are compared in glove-choice-movement-caller.test.mjs.
//
// The outcomes are frozen from the lifted module (2026-11-27). The former proof/caller
// composition stubbed the glove movement through its routine table, which the lifted
// module does not have, so its vectors do not carry over; the lifted choices were
// compared with that composition under actual movement before (the movement test's
// frozen vectors), and the notice, close, window list and object search have their own.
//
// Object 2 stands under the glove placed over the player figure (slot 0). A reach
// offset moves it across and down by the same amount, which keeps its screen column
// (base plus y less x) and sums both distances; a rise lifts it and lowers its
// diagonal by the same amount, which keeps its screen row.
const INPUT_WAIT = 0x81b0a9,
  STACK_TOP = 0x1eef,
  STACK_START = 0x1e80,
  STACK_END = 0x1ef0,
  GAME_STATE_START = 0x1cc,
  OBJECT_POSITION = 0x500,
  OBJECT_DIAGONAL = 0xa00,
  USABLE = 0x8000;

function runChoice(name, budget, target, pads, options = {}) {
  let finalShadow;
  const offset = options.offset ?? 0,
    rise = options.rise ?? 0,
    camera = options.camera ?? 0;
  return compareRun(
    function* (h, events, renderer) {
      const result = yield* direct[name](h, events, renderer);
      finalShadow = h.a.mem.wram[W.HDMAEN_SHADOW];
      return result;
    },
    true,
    ({ put }) => {
      put(W.PLAYER_OBJECT, 0);
      put(0, 4);
      for (const slot of [0, 2, 4]) {
        put(W.OBJECT_X + slot, OBJECT_POSITION);
        put(W.OBJECT_DIAGONAL + slot, OBJECT_DIAGONAL);
      }
      put(W.OBJECT_X + 2, (OBJECT_POSITION + offset) & 0xffff);
      put(W.OBJECT_Y + 2, offset);
      put(W.OBJECT_HEIGHT + 2, rise);
      put(W.OBJECT_DIAGONAL + 2, (OBJECT_DIAGONAL - rise) & 0xffff);
      put(W.GLOVE_TARGET_TAG, 0xffff);
      put(W.GLOVE_NAME_WINDOW, 0xffff);
      put(W.DRAW_LIST_INDEX, target ? 0 : 0xffff);
      put(W.DRAW_LIST, 2);
      put(W.OBJECT_ACTION_DIRECTIONS + 2, 1);
      put(W.OBJECT_KIND + 2, 0);
      put(W.OBJECT_FLAGS + 2, options.reject ? 0 : USABLE);
      put(W.OBJECT_NUMBER + 2, 0x1234);
      put(W.OBJECT_BOX_X2 + 2, 16);
      put(W.OBJECT_BOX_HEIGHT + 2, 16);
      put(W.MEMBER_MENU_ACTIVE, options.menu ? 1 : 0);
      put(W.TEXT_MAP_UPLOAD, options.request ?? 0);
      put(W.CAMERA_X, camera);
      put(W.CAMERA_Y, camera);
      put(W.OBJECT_HEIGHT + 4, camera);
      for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
    },
    budget,
    pads,
    true,
    ({ h, events, put, mem }) => {
      events.frameJobs = () => assert.fail('fixture services every wait');
      const service = events.interrupts.textWait;
      let inputs = 0;
      events.interrupts.textWait = (callee, frameEvents, status, pc) => {
        if (pc === INPUT_WAIT) {
          // The member dialog's close waits before any glove is out.
          if (options.close && mem.read16(W.GLOVE_KIND) === 0) {
            put(W.RANDOM_STATE, mem.read16(W.RANDOM_STATE) + 1);
            return true;
          }
          // The rejected object becomes usable after the first choosing press.
          if (options.reject && ++inputs === options.reject + 1) put(W.OBJECT_FLAGS + 2, USABLE);
        }
        if (options.close && pc === 0x80ae0c) return true;
        if (options.close && pc === 0x80ae0f) {
          put(W.NMI_JOB_LISTS, 0);
          put(W.DP_VRAM_UPLOAD_INDEX, 0);
          return true;
        }
        return service(callee, frameEvents, status, pc);
      };
      if (!options.close) return;
      h.ctx.s = STACK_TOP;
      put(W.DRAW_LIST_INDEX, target ? 0 : 0xffff);
      put(W.OBJECT_VRAM_SLOT_COUNT, 1);
      put(W.OBJECT_FRAME_OFFSET, 2);
      put(W.VRAM_SLOT_NEXT, 0);
      put(W.HDMAEN_SHADOW, options.shadow);
      return (result) => {
        // This fixture relocates the CPU stack out of the default masked range.
        result.wram.fill(0, STACK_START, STACK_END);
        for (const [, payload] of result.uploads)
          payload.fill(0, STACK_START - GAME_STATE_START, STACK_END - GAME_STATE_START);
        return { ...result, finalShadow };
      };
    },
  );
}

const word = (wram, at) => wram[at] | (wram[at + 1] << 8);

for (const budget of [1, 7])
  for (const target of [false, true])
    for (const shadow of [0, 1, 0xfe, 0xff])
      test(`spell choice closes member dialog: target ${target}, shadow ${shadow}, budget ${budget}`, () => {
        const options = { menu: true, close: true, shadow };
        const actual = runChoice('spellGloveTargetSequence', budget, target, [0x8000], options);
        assertFrozenRun(actual);
        assert.equal(actual.finalShadow, shadow & ~1);
        assert.ok(fontUploaded(actual), 'OBJSEL and both complete font DMAs');
        assert.equal(actual.input, 1);
        assert.equal(word(actual.wram, 0), target ? 2 : 0xffff);
      });

for (const budget of [1, 7])
  for (const pads of [[0x4000], [0x80], [0x40], [0x800f, 0, 0x8000]])
    test(`glove choice real input: pads ${pads}, budget ${budget}`, () => {
      const actual = runChoice('chooseObjectUnderGloveSequence', budget, true, pads);
      assertFrozenRun(actual);
      assert.equal(actual.input, pads.length);
      assert.equal(word(actual.wram, W.PAD_PRESSED), 0);
      assert.equal(word(actual.wram, 0), 2);
    });

test('glove choice preserves reset boundary', () => {
  assert.throws(
    () => runChoice('chooseObjectUnderGloveSequence', 1, true, [0x3030]),
    (error) => error.reason === 'task_reset_source_required',
  );
});

for (const budget of [1, 7])
  for (const name of [
    'chooseObjectNumberSequence',
    'scriptChooseObjectNumberSequence',
    'scriptChooseObjectSequence',
  ])
    for (const [offset, rise, near] of [
      [0x40, 0x80, true],
      [0x41, 0, false],
      [0, 0x81, false],
      [0xffff, 0, true],
      [0x4000, 0, false],
    ])
      for (const menu of [false, true])
        test(`glove choice reach notice: ${name}, offset ${offset}, rise ${rise}, menu ${menu}, budget ${budget}`, () => {
          const options = { offset, rise, menu };
          const actual = runChoice(name, budget, true, [0x8000], options);
          assertFrozenRun(actual);
          assert.equal(
            word(actual.wram, 0),
            near ? (name.includes('Number') ? 0x1234 : 2) : 0xffff,
          );
          assert.equal(word(actual.wram, W.SCRIPT_GLOVE_CHOICE), 0);
          if (!near) assert.ok(actual.uploads.length > 0, 'actual notice glyph and window uploads');
        });

for (const budget of [1, 7])
  for (const request of [0, 0xfffe, 0xffff])
    test(`spell choice rejects unusable object then redraws: request ${request}, budget ${budget}`, () => {
      const options = { reject: 1, request };
      const pads = [0x8000, 0, 0x8000];
      const actual = runChoice('spellGloveTargetSequence', budget, true, pads, options);
      assertFrozenRun(actual);
      assert.equal(actual.input, 3);
      assert.equal(word(actual.wram, W.SPELL_TARGET_OBJECT), 2);
      assert.ok(actual.uploads.length > 0);
    });

for (const budget of [1, 7])
  for (const camera of [0, 0x7fff, 0x8000, 0xffff])
    test(`place choice redraw with wrapped camera and height: ${camera}, budget ${budget}`, () => {
      const actual = runChoice('choosePlaceWithGloveSequence', budget, true, [0x8000], {
        camera,
      });
      assertFrozenRun(actual);
      assert.equal(actual.wram[W.MOTION_ACTIVE + 4], 1);
      assert.ok(actual.uploads.length > 0);
    });
