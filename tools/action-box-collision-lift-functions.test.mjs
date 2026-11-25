// Random per-function test of the lifted script native 80:8371, the collision test of an
// object's action box (src/game/action-box-collision.mjs through
// src/script/native-object-collision.mjs), against its register-level reference
// (proof/game-reference/action-box-collision.mjs). The native runs from its script call
// (data bank 80, direct page 0, the RTS frame). The object is a game slot of any kind of
// the action table (or any word) in a direction (or any word), at a position in the
// room; every grid cell holds an empty list or a chain of four moving boxes near the
// object (some overlapping, some not, some below or above it) whose objects are other
// slots, the object itself or the player figure, and the object's flags pass the player
// figure or not. Game state only (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks,
// the device writes and the return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import { testObjectCollisionReference } from '../proof/game-reference/action-box-collision.mjs';
import { testObjectCollision } from '../src/script/native-object-collision.mjs';
import {
  COLLISION_BOX_X0,
  COLLISION_CELL_HEADS,
  COLLISION_NODE_BOX,
  COLLISION_NODE_NEXT,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_KIND,
  OBJECT_X,
  OBJECT_Y,
  PLAYER_OBJECT,
} from '../src/data/wram.mjs';

useLiftVectors(import.meta.url);

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  SLOTS = 44,
  ACTION_KINDS = 275,
  CELL_BYTES = 0x200,
  NODES = 4,
  BOX_BYTES = 12,
  FIRST_BOX = 0x400,
  // The box object words in bank 7F (7F:E214 plus the box offset over 4).
  BOX_OBJECTS = 0x1e214;

const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    pick = (list) => list[rnd(list.length)],
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  const slot = 2 * rnd(SLOTS),
    player = pick([slot, 2 * rnd(SLOTS)]),
    other = 2 * rnd(SLOTS);
  setWord(wram, 0, rnd(16) ? slot : rnd(WORD));
  setWord(wram, 2, pick([rnd(8), rnd(8), rnd(WORD)]));
  setWord(wram, OBJECT_KIND + slot, rnd(16) ? rnd(ACTION_KINDS) : rnd(WORD));
  const x = 0x40 + rnd(0x700),
    y = 0x40 + rnd(0x700),
    z = rnd(0x100);
  setWord(wram, OBJECT_X + slot, 4 * x + rnd(4));
  setWord(wram, OBJECT_Y + slot, 4 * y + rnd(4));
  setWord(wram, OBJECT_HEIGHT + slot, 4 * z + rnd(4));
  setWord(wram, OBJECT_FLAGS + slot, rnd(WORD));
  setWord(wram, PLAYER_OBJECT, player);
  const empty = rnd(8) === 0;
  for (let cell = 0; cell < CELL_BYTES; cell += 2)
    setWord(wram, COLLISION_CELL_HEADS + cell, empty || rnd(4) === 0 ? 0xffff : 2 * rnd(NODES));
  for (let n = 0; n < NODES; n++) {
    const node = 2 * n,
      box = FIRST_BOX + n * BOX_BYTES;
    setWord(wram, COLLISION_NODE_BOX + node, box);
    setWord(wram, COLLISION_NODE_NEXT + node, n + 1 < NODES ? node + 2 : 0xffff);
    const near = (v, span) => (v - span + rnd(2 * span)) & 0xffff;
    const edges = [near(x, 40), near(y, 40), near(z, 24), near(x, 40), near(y, 40), near(z, 64)];
    edges.forEach((v, i) => setWord(wram, COLLISION_BOX_X0 + box + 2 * i, v));
    setWord(wram, BOX_OBJECTS + (box >>> 2), pick([other, slot, player, rnd(WORD)]));
  }
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s, h.ctx.bank].map((v) => v.toString(HEX)).join();
registerCases(
  [
    {
      name: 'testObjectCollision 80:8371',
      entry: 0x808371,
      samples: 600,
      reference: (h) => testObjectCollisionReference(h.a, false),
      prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(BYTE) & 0xc3 }),
      result: returned,
      lifted: (h, input) => {
        Object.assign(h.ctx, input);
        h.ctx.programBank = CODE_BANK;
        h.push(CALLER_RETURN, 2);
        testObjectCollision(h.a, false);
        return returned(h);
      },
    },
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
