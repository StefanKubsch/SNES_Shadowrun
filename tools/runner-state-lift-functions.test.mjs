// Random per-function tests of the lifted runner state bodies of the script natives
// 80:CECB, 80:CF2E and 80:D079 (src/game/runner-state.mjs through raiseStateCountBody and
// restoreRunnersBody, and the leaf 80:CF2E with its RTS) against their register-level references
// (proof/game-reference/runner-state.mjs). Both natives then call the same window list
// 81:AD92 with the same frame; these tests compare the bodies before it: the WRAM outside
// the stack, including the direct page values both leave, or the same stop.
import { prng, DialogTestMemory } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import {
  raiseMemberMagicPointsReference,
  raiseStateCountRegisters,
  restoreRunnersRegisters,
} from '../proof/game-reference/runner-state.mjs';
import { raiseStateCountBody } from '../src/task/native-state-count-raise.mjs';
import { restoreRunnersBody } from '../src/task/native-runners-restore.mjs';
import { raiseMemberMagicPoints } from '../src/task/native-magic-points-raise.mjs';

const WRAM_BYTES = 0x20000,
  CODE_BANK = 0x80,
  ROM = new DialogTestMemory(new Uint8Array(WRAM_BYTES)),
  RUNNERS = 13,
  RUNNER_NUMBERS = Array.from(
    { length: RUNNERS },
    (_, n) => ROM.read8(0x809700 + 2 * n) | (ROM.read8(0x809701 + 2 * n) << 8),
  ),
  PLAYER_OBJECT = 0x0cc2,
  OBJECT_RECORD = 0x13a8,
  OBJECT_NUMBER = 0x150a,
  GROUP_INDEX = 0x2de6,
  GROUP_NUMBERS = 0x2df0,
  IGNORED = [[0x0100, 0x01ca]];

const word = (wram, at, value) => {
  wram[at] = value & 0xff;
  wram[at + 1] = (value >>> 8) & 0xff;
};
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    pick = (list) => list[rnd(list.length)],
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  return { seed, wram, rnd, pick };
}
const side = (s) => createSide(s, new Map());
// The lifted side starts with the reference's registers and frame.
const lifted = (run) => (h, input) => {
  Object.assign(h.ctx, input);
  h.ctx.programBank = CODE_BANK;
  h.push(0x1234, 2);
  run(h);
};
const CASES = [
  {
    name: 'raiseStateCount 80:CECB',
    entry: 0x80cecb,
    samples: 600,
    reference: (h) => raiseStateCountRegisters(h),
    prepare: (s) => members(s),
    lifted: lifted(raiseStateCountBody),
  },
  {
    // The same members; magic points and amounts below, at and above ten times the
    // magic attribute (the leaf returns with its RTS on both sides).
    name: 'raiseMagicPoints 80:CF2E',
    entry: 0x80cf2e,
    samples: 600,
    reference: (h) => raiseMemberMagicPointsReference(h.a, false),
    prepare: (s) => members(s),
    lifted: (h, input) => {
      Object.assign(h.ctx, input);
      h.ctx.programBank = CODE_BANK;
      h.push(0x1234, 2);
      raiseMemberMagicPoints(h.a, false);
    },
  },
  {
    name: 'restoreRunners 80:D079',
    entry: 0x80d079,
    reference: (h) => restoreRunnersRegisters(h),
    prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(256) & 0xc3 }),
    lifted: lifted(restoreRunnersBody),
  },
];
// The object's member in the group, only the leader's, or neither (the original
// searches forever); a runner number or another; no object record or one; amounts
// below and above the maximum.
function members(s) {
  const object = 2 * s.rnd(44),
    leader = 2 * s.rnd(44),
    count = 2 * s.rnd(8),
    number = s.pick([...RUNNER_NUMBERS, s.rnd(65536)]),
    kind = s.pick([0, 0, 0, 0, 1, 2, 3]);
  word(s.wram, 0, object);
  word(s.wram, 2, s.pick([0, 1, 5, 0xff, s.rnd(16), s.rnd(65536)]));
  word(s.wram, PLAYER_OBJECT, leader);
  word(s.wram, GROUP_INDEX, s.pick([count, count, count, count, 0xfffe, s.rnd(65536)]));
  word(s.wram, OBJECT_NUMBER + object, kind === 1 ? number ^ 0x4000 : number);
  if (leader !== object) word(s.wram, OBJECT_NUMBER + leader, number);
  if (kind < 3) word(s.wram, GROUP_NUMBERS + 2 * s.rnd(count / 2 + 1), number);
  word(s.wram, OBJECT_RECORD + object, s.pick([0, 0x3000 + s.rnd(0x800)]));
  word(s.wram, OBJECT_RECORD + leader, s.pick([0, 0x3000 + s.rnd(0x800)]));
  return { bank: CODE_BANK, status: s.rnd(256) & 0xc3 };
}
registerCases(CASES, { sample, side, runtime: (h) => h, ignored: IGNORED });
