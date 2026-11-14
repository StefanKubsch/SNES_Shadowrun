// Random per-function tests of the lifted sight natives (src/game/combat-targets.mjs
// with src/game/line-of-sight.mjs, bridges in src/task/native-script-leaves.mjs)
// against their register-level references: the enemy's target 80:8BC5, the nearest
// visible member 80:8C08, the random fight target 80:8C8D and the attack test 80:8CCF.
// Both sides run the native from its script call (data bank 80, direct page 0, the RTS
// frame) and must leave the same WRAM outside the line of sight's direct page working
// bytes (user decision 2026-11-13) and the stack, the same device writes and the same
// return. The line of sight runs on the same arithmetic unit model on both sides.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { chooseEnemyTarget as enemyReference } from '../proof/game-reference/enemy-target-choice.mjs';
import {
  findNearestVisibleMember as nearestReference,
  chooseRandomFightTarget as fightReference,
  canObjectAttack as attackReference,
} from '../src/task/native-combat.mjs';
import {
  chooseEnemyTargetNative,
  findNearestVisibleMemberNative,
  chooseRandomFightTargetNative,
  canAttackNative,
} from '../src/task/native-script-leaves.mjs';
import { testLineOfSight } from '../src/task/line-of-sight.mjs';
import { leafAccess } from '../src/task/native-leaf-support.mjs';
import { lineOfSight } from '../src/game/line-of-sight.mjs';
import { accessorPort } from '../src/system/hardware-port.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  OBJECT_FLAGS = 0x1458,
  OBJECT_X = 0x0e28,
  OBJECT_Y = 0x0e80,
  OBJECT_HEIGHT = 0x0ed8,
  OBJECT_BOX_HEIGHT = 0x43a0,
  GROUP_LEADER_ONLY = 0x1d6b,
  GROUP_INDEX = 0x2de6,
  GROUP_SLOTS = 0x1fa8,
  FIGHT_LIST_INDEX = 0x1fb0,
  FIGHT_LIST = 0x1fb2,
  ON_SCREEN = 0x0004,
  NO_TARGET = 0x1000,
  CELL_LIST = 0x7f4000,
  BOX_RECORD = 12,
  OBJECTS = 44,
  // Not produced by the lifted code: the line of sight's direct page working bytes
  // and the main stack.
  IGNORED = [
    [0x000e, 0x006d],
    [0x0100, 0x01ca],
  ];

const word = (wram, at, value) => {
  wram[at] = value & 0xff;
  wram[at + 1] = (value >>> 8) & 0xff;
};
// Objects spread over a field of span pixels with boxes on and off the lines between
// them, as tools/task-sight-a25f.test.mjs builds them.
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    pick = (list) => list[rnd(list.length)],
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  const span = pick([0x100, 0x400, 0x1000, 0x4000, 0x10000]),
    positions = [];
  for (let n = 0; n < OBJECTS; n++) {
    const object = 2 * n,
      p = [rnd(span), rnd(span), rnd(0x200)];
    positions.push(p);
    word(wram, OBJECT_X + object, p[0]);
    word(wram, OBJECT_Y + object, p[1]);
    word(wram, OBJECT_HEIGHT + object, p[2]);
    word(wram, OBJECT_BOX_HEIGHT + object, rnd(0x100));
    // Mostly on screen and a target.
    word(
      wram,
      OBJECT_FLAGS + object,
      (rnd(65536) & ~(ON_SCREEN | NO_TARGET)) | (rnd(5) ? ON_SCREEN : 0) | (rnd(5) ? 0 : NO_TARGET),
    );
  }
  word(wram, 0xfc, CELL_LIST & 0xffff);
  wram[0xfe] = CELL_LIST >>> 16;
  const count = pick([0, 1, 2, 3, 6, 12]),
    list = CELL_LIST - 0x7e0000;
  wram[list] = count;
  for (let n = 0; n < count; n++) {
    const [a, b] = [pick(positions), pick(positions)],
      t = random(),
      cx = (random() < 0.8 ? a[0] + (b[0] - a[0]) * t : rnd(span)) / 4,
      cy = (random() < 0.8 ? a[1] + (b[1] - a[1]) * t : rnd(span)) / 4,
      size = () => rnd(span / pick([4, 16, 64, 256])) + 1,
      w = size(),
      h = size(),
      at = list + 1 + n * BOX_RECORD,
      clamp = (v) => Math.max(0, Math.min(0xffff, Math.round(v)));
    word(wram, at, clamp(cx - w));
    word(wram, at + 2, clamp(cy - h));
    word(wram, at + 4, rnd(65536));
    word(wram, at + 6, clamp(cx + w));
    word(wram, at + 8, clamp(cy + h));
    word(wram, at + 10, rnd(0x200));
  }
  // The group (up to four members) and the fight list (empty or up to eight entries).
  const members = rnd(4);
  word(wram, GROUP_INDEX, 2 * members);
  word(wram, GROUP_LEADER_ONLY, pick([0, 0, 0, 1, 0x100]));
  for (let n = 0; n <= members; n++)
    word(wram, GROUP_SLOTS + 2 * n, rnd(8) ? 2 * rnd(OBJECTS) : 0xffff);
  const fighters = pick([-1, 0, 1, 3, 7]);
  word(wram, FIGHT_LIST_INDEX, (2 * fighters) & 0xffff);
  for (let n = 0; n <= fighters; n++)
    word(wram, FIGHT_LIST + 2 * n, rnd(8) ? 2 * rnd(OBJECTS) : 0xffff);
  return { seed, wram, rnd, pick };
}
const REFERENCES = new Map([
  [0x808bc5, (h) => enemyReference(h.a, false)],
  [0x808c08, (h) => nearestReference(h.a, false)],
  [0x808c8d, (h) => fightReference(h.a, false)],
  [0x808ccf, (h) => attackReference(h.a, false)],
]);
const side = (s) => createSide(s, REFERENCES);
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
// The lifted side starts with the reference's registers and RTS frame.
const lifted = (run) => (h, input) => {
  Object.assign(h.ctx, input);
  h.ctx.programBank = CODE_BANK;
  h.push(CALLER_RETURN, 2);
  run(h.a, false);
  return returned(h);
};
// The looking object and, for the attack test, a fight list entry or another object.
// An object or FFFF (none, as scripts pass it on; the original reads the fields through
// the data bank 80 and reaches the WRAM mirror of bank 81).
const objectOrNone = (s) => (s.rnd(8) ? 2 * s.rnd(OBJECTS) : 0xffff);
function arguments_(s, second) {
  word(s.wram, 0, objectOrNone(s));
  if (!second) return;
  const fighters = s.wram[FIGHT_LIST_INDEX] | (s.wram[FIGHT_LIST_INDEX + 1] << 8);
  const listed =
    fighters < 0x8000 ? s.wram[FIGHT_LIST + 2 * s.rnd(fighters / 2 + 1)] : 2 * s.rnd(OBJECTS);
  word(s.wram, 2, s.rnd(4) ? listed : objectOrNone(s));
}
const CASES = [
  ['chooseEnemyTarget 80:8BC5', 0x808bc5, chooseEnemyTargetNative],
  ['findNearestVisibleMember 80:8C08', 0x808c08, findNearestVisibleMemberNative],
  ['chooseRandomFightTarget 80:8C8D', 0x808c8d, chooseRandomFightTargetNative],
  ['canAttack 80:8CCF', 0x808ccf, canAttackNative],
].map(([name, entry, run]) => ({
  name,
  entry,
  samples: 600,
  prepare: (s) => {
    arguments_(s, entry === 0x808ccf);
    return { bank: CODE_BANK, status: s.rnd(256) & 0xc3 };
  },
  result: returned,
  lifted: lifted(run),
}));
// The line of sight itself against 81:A25F: blocked (the carry), the low box mark (the
// direct page word 68) and the multiplier and divider writes with their sites.
const LOW_BOX = 0x68;
const arithmetic = (h) =>
  h.a.trace.map((t) => [t.pc.toString(HEX), t.address & 0xffff, t.width, t.value].join()).join(';');
const SIGHT_CASE = {
  name: 'lineOfSight 81:A25F',
  entry: 0x81a25f,
  long: true,
  samples: 3000,
  prepare: (s) => ({
    x: objectOrNone(s),
    y: objectOrNone(s),
    bank: CODE_BANK,
    status: s.rnd(256) & 0xc3,
  }),
  reference: (h) => {
    h.a.trace = [];
    testLineOfSight(leafAccess(h.a));
  },
  result: (h) =>
    [
      h.ctx.status & 1,
      h.a.read(LOW_BOX) === 0xff && h.a.read(LOW_BOX + 1) === 0xff,
      arithmetic(h),
    ].join(),
  lifted: (h, input) => {
    h.a.trace = [];
    const { blocked, lowBox } = lineOfSight(h.a.mem, accessorPort(h.a), input.y, input.x);
    return [Number(blocked), lowBox, arithmetic(h)].join();
  },
};
registerCases([...CASES, SIGHT_CASE], { sample, side, runtime: (h) => h, ignored: IGNORED });
