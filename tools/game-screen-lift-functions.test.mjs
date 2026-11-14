// Random per-function test of the lifted game screen set-up 80:9629
// (src/game/game-screen.mjs, entry setUpGameScreenRoutine in
// src/task/main-initialize.mjs) against the register-level reference
// (proof/game-reference/game-screen.mjs) with its register-level callees, including
// Jake's state bar 81:AF1F (src/game/state-bar.mjs; docs/GAME-SCREEN-LIFT.md). Both sides
// must leave the same WRAM outside the scratch, the same device writes and the
// registers the callers keep (S, PC, data bank, program bank, 16-bit modes).
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { MAIN_INITIALIZE_ROUTINES } from '../src/task/main-initialize.mjs';
import { initializeGameScreen } from '../proof/game-reference/game-screen.mjs';
import { DIALOG_WINDOW, GROUP_INDEX, JAKE_COUNT_MAX } from '../src/task/wram.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  STATUS_MODES = 0x30,
  // The main stack of the game (the harness's own stack at 01C9 lies on the screen
  // shadows 01BC-01C7 that 81:B064 sets).
  GAME_STACK = 0x1ef0,
  // The state bar's current value: 7E:0002 plus the ROM word 8D:B8D2 (33DC).
  BAR_VALUE = 0x33de,
  // Not produced by the lifted code: direct page scratch, the unpacker state and
  // the stack below the caller's frame (docs/MATRIX-LIFT.md).
  IGNORED = [
    [0x0000, 0x0034],
    [0x00db, 0x00f3],
    [0x1e80, GAME_STACK - 1],
  ];

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    pick = (list) => list[rnd(list.length)],
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  // Jake's state bar: no dialog window, an empty group, or a drawn bar whose maximum
  // leaves a remainder, none, or is below 20 (65536 frame segments), and whose value
  // is 0, small, below or above the maximum.
  const bar = pick(['window', 'group', 'drawn', 'drawn', 'drawn']);
  if (bar === 'window') wram.fill(0, DIALOG_WINDOW, DIALOG_WINDOW + 2);
  else {
    wram[DIALOG_WINDOW] |= 1;
    wram[GROUP_INDEX + 1] = bar === 'group' ? 0x80 : 0;
    if (bar === 'drawn') {
      wram[GROUP_INDEX] = 0;
      wram[JAKE_COUNT_MAX] = pick([20 + rnd(236), 20 + rnd(236), 20 * (1 + rnd(12)), rnd(20)]);
      wram[BAR_VALUE] = pick([0, rnd(11), rnd(256), rnd(wram[JAKE_COUNT_MAX] + 1)]);
    }
  }
  return { seed, wram, rnd, pick };
}
const side = (s) => createSide(s, MAIN_INITIALIZE_ROUTINES);
const registers = (h) =>
  ['s', 'pc', 'bank', 'programBank'].map((r) => h.ctx[r].toString(HEX)).join() +
  ',' +
  (h.ctx.status & STATUS_MODES).toString(HEX);

const CASES = [
  {
    name: 'setUpGameScreen 80:9629',
    entry: 0x809629,
    samples: 60,
    prepare: (s) => ({ bank: 0x80, status: s.rnd(256) & 0xc7, pc: 0x9629, s: GAME_STACK }),
    reference: (h, e, r) => initializeGameScreen(h, e, r),
    result: registers,
    lifted: (h, input) => {
      Object.assign(h.ctx, input);
      h.ctx.programBank = 0x80;
      h.push(0x1234, 2);
      MAIN_INITIALIZE_ROUTINES.get(0x809629)(h);
      return registers(h);
    },
  },
];

registerCases(CASES, { sample, side, runtime: (h) => h, ignored: IGNORED });
