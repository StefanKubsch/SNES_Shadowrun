import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import { compareRun } from './member-menu-caller-harness.mjs';
import { moveAndAnimateJsr } from '../proof/caller/jsr-forms.mjs';
import { segmentSequence } from '../src/system/native-call-continuation.mjs';
import { ACTION_TABLE } from '../src/data/actions.mjs';
import * as W from '../src/data/wram.mjs';
import * as V from '../src/vm/layout.mjs';

useLiftVectors(import.meta.url);

// Find a real action with a nonempty first picture. Both callers use its actual
// frame stream, picture cells, VRAM allocation and queued tile uploads.
function action(mem) {
  for (let kind = 0; kind < 0x100; kind++) {
    const list = mem.read16(ACTION_TABLE + kind * 2);
    if (list < 0x8000) continue;
    const record = mem.read16(0x8c0000 | list);
    if (record < 0x8000) continue;
    const directions = record + 8;
    const first = mem.read8(0x8c0000 | directions);
    const picture = mem.read16(0x8c0000 | (directions + first));
    if (mem.read8(((0x9b + (picture >>> 15)) << 16) | picture | 0x8000))
      return { kind, directions, first };
  }
  assert.fail('fixture requires a real action and picture');
}

function runMotion(count, flags, target, mode, animation, slots, budget) {
  return compareRun(
    (h, events) => segmentSequence(() => moveAndAnimateJsr(h, events)),
    false,
    ({ put, mem }) => {
      const record = action(mem);
      put(W.DRAW_LIST_INDEX, count * 2 - 2);
      put(W.STATIC_NODE_END, 0);
      put(W.VRAM_SLOT_COUNT, slots);
      put(W.VRAM_SLOT_FREE_LIST, 0);
      for (let n = 0; n < 64; n++) put(W.VRAM_SLOT_NEXT + n * 2, n === 63 ? 0xffff : n * 2 + 2);
      for (let n = 0; n < count; n++) {
        const slot = n * 2;
        put(W.DRAW_LIST + slot, slot);
        put(W.OBJECT_KIND + slot, record.kind);
        put(W.OBJECT_FLAGS + slot, flags);
        put(W.OBJECT_X + slot, 0x100 + n * 16);
        put(W.OBJECT_Y + slot, 0xfc + n * 16);
        put(W.OBJECT_HEIGHT + slot, 0x104);
        put(W.OBJECT_BOX_X2 + slot, 16);
        put(W.OBJECT_BOX_Y2 + slot, 16);
        put(W.OBJECT_BOX_HEIGHT + slot, 16);
        put(W.OBJECT_VELOCITY_X + slot, n & 1 ? -4 : 4);
        put(W.OBJECT_VELOCITY_Y + slot, n & 1 ? 4 : -4);
        put(W.OBJECT_VELOCITY_Z + slot, -4);
        put(W.MOTION_ACTIVE + slot, target);
        put(W.MOTION_MODE + slot, mode);
        put(W.MOTION_X + slot, mode === 3 ? 0x100 + n * 16 : 0x200);
        put(W.MOTION_Y + slot, mode === 3 ? 0xfc + n * 16 : 0x300);
        put(W.OBJECT_TASK + slot, slot);
        put(W.OBJECT_SELECTION + slot, 0xffff);
        put(W.OBJECT_ACTION_DIRECTIONS + slot, record.directions);
        put(W.OBJECT_FRAME_OFFSET + slot, record.first);
        put(W.OBJECT_FRAME_REPEATS + slot, 1);
        put(W.OBJECT_FRAME_COUNT + slot, animation === 'ended' ? 0 : 1);
        put(W.OBJECT_ANIMATION_SPEED + slot, animation === 'still' ? 0 : 0x80);
        put(V.TASK_WAIT + slot, 0);
      }
    },
    budget,
  );
}

// The move keeps its old coordinate in a local, not in direct page 6B-6C
// (docs/STATE-MODEL-REBUILD.md); the former pass in proof/ still writes it.
const MOVE_SCRATCH = [0x6b, 0x6c];
function withoutMoveScratch(result) {
  const wram = result.wram.slice();
  for (const at of MOVE_SCRATCH) wram[at] = 0;
  return { ...result, wram };
}

for (const budget of [1, 7])
  for (const count of [0, 1, 3])
    for (const flags of [0, 0x20, 0x140, 0x160, 0x500])
      for (const target of [0, 1, 2])
        for (const mode of [0, 1, 3])
          for (const animation of ['still', 'ended', 'picture'])
            for (const slots of [0, 64])
              if (
                count ||
                (flags === 0 && target === 0 && mode === 0 && animation === 'still' && slots === 0)
              )
                test(`motion actual callees: count ${count}, flags ${flags}, target ${target}, mode ${mode}, animation ${animation}, slots ${slots}, budget ${budget}`, () => {
                  const got = runMotion(count, flags, target, mode, animation, slots, budget);
                  assertFrozenRun(withoutMoveScratch(got));
                  if (count && !(flags & W.OBJECT_HALTED)) {
                    if (animation === 'ended')
                      assert.ok(got.wram[V.TASK_EVENTS] & 8, 'actual animation completion event');
                    if (target === 1 && mode === 3)
                      assert.ok(got.wram[V.TASK_EVENTS] & 4, 'actual movement arrival event');
                    if (animation === 'picture' && slots && target !== 1)
                      assert.ok(got.wram[W.DP_VRAM_UPLOAD_INDEX] > 0, 'actual tile upload jobs');
                  }
                });
