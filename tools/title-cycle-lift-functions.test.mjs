// Random per-function tests of the lifted title cycle 80:A18C, attract game 80:A168
// and demo owner 80:96F3 (src/frontend/title-cycle.mjs) against the register-level
// reference (proof/frontend-reference/title-cycle.mjs), for the paths the live
// sessions of tools/title-cycle-lift.test.mjs do not reach (docs/MATRIX-LIFT.md):
// the cycle after a game (A = 0), every order of cancelled menus, credits requests
// and choices, with and without music. The title, start menu, demo, credits
// cutscene, new game set-up and room start answer as stubs that record each call
// (target, return address, A, X, data bank); both sides must make the same calls
// and leave the same WRAM, device writes and registers.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { START_MENU_IGNORED_WRAM } from './live-start-menu-plan.mjs';
import { FRONTEND_ROUTINES } from '../src/task/main-frontend.mjs';
import { INTRO_SETUP_REFERENCE_ENTRIES } from '../proof/intro-reference/intro-routines.mjs';
import { GAME_OWNER_REFERENCE_ENTRIES } from '../proof/frontend-reference/game-owner.mjs';
import {
  TITLE_CYCLE_REFERENCE_ENTRIES,
  playAttractGame as referenceAttractDemo,
} from '../proof/frontend-reference/title-cycle.mjs';
import { playAttractDemo, runAttractGame, runTitleCycle } from '../src/frontend/title-cycle.mjs';

const WRAM_BYTES = 0x20000,
  MUSIC = 0x1cde,
  MENU_CANCELLED = 0xfffe,
  NEW_GAME = 0xffff,
  HEX = 16;
const reference = new Map(TITLE_CYCLE_REFERENCE_ENTRIES);

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    pick = (list) => list[rnd(list.length)],
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  // No music (FFFF) in half of the samples: the credits then set up their own.
  if (rnd(2)) wram[MUSIC] = wram[MUSIC + 1] = 0xff;
  // The menu's answers in turn ('c': the Credits row, a cancel with a request).
  const answers = [];
  for (let n = rnd(6); n > 0; n--) answers.push(pick([MENU_CANCELLED, 'c']));
  answers.push(pick([NEW_GAME, 0, 1, 2, 3]));
  return { seed, wram, rnd, pick, answers, titleKey: rnd(2) };
}

// The stubbed callees of one side; each call is logged on the accessor with its
// return address, data bank and the registers it takes as arguments: A for the
// start menu, the cutscene (with X) and the room start.
const ARGUMENTS = new Map([
  [0x81e14a, ['a']],
  [0x81cdf8, ['a', 'x']],
  [0x809699, ['a']],
]);
function stubbedRoutines(s) {
  // The register-level audio set-up (proof/intro-reference) and no-countdown marker
  // 80:E24E (proof/frontend-reference/game-owner.mjs) the reference calls.
  const routines = new Map([
    ...FRONTEND_ROUTINES,
    ...INTRO_SETUP_REFERENCE_ENTRIES,
    ...GAME_OWNER_REFERENCE_ENTRIES,
  ]);
  let menus = 0;
  const stub = (target, long, answer) =>
    routines.set(target, (h) => {
      const { ctx } = h,
        log = (h.a.callLog ??= []),
        values = [
          target,
          h.a.stackWord(),
          ctx.bank,
          ...(ARGUMENTS.get(target) ?? []).map((r) => ctx[r]),
        ];
      log.push(values.map((v) => v.toString(HEX)).join(':'));
      answer?.(h);
      return long ? h.rtl() : h.rts();
    });
  // The title answers with A and the zero flag of that load.
  stub(0x81d694, true, (h) => {
    h.load(s.titleKey);
    h.ctx.bank = 0x81;
  });
  stub(0x81e14a, true, (h) => {
    const answer = s.answers[Math.min(menus++, s.answers.length - 1)];
    if (answer === 'c') h.a.vm.creditsRequested = true;
    h.ctx.a = answer === 'c' ? MENU_CANCELLED : answer;
    h.ctx.x = 0xff;
    h.ctx.bank = 0x81;
  });
  stub(0x8096f3, true, (h) => (h.ctx.bank = 0x80));
  stub(0x81cdf8, true);
  stub(0x80960d, false, (h) => (h.ctx.a = 3));
  stub(0x809699, false);
  return routines;
}
const side = (s) => {
  const state = createSide(s, stubbedRoutines(s));
  state.a.vm = {};
  state.a.routines = state.routines;
  return state;
};
// The calls and the registers a side ends with that its caller reads: the title
// cycle returns the menu's choice in A (and X, data bank and status), the attract
// game and the demo only the data bank. Other leftovers (Y, A after the audio
// routines) are not produced (docs/MATRIX-LIFT.md); the stack must balance.
const summary = (registers) => (h) =>
  [
    ...(h.a.callLog ?? []),
    [...registers, 'bank', 's'].map((r) => h.ctx[r].toString(HEX)).join(),
  ].join(' ');
// The lifted side starts with the reference's registers and caller frame.
const lifted = (run, long, registers) => (h, input) => {
  Object.assign(h.ctx, input);
  h.ctx.programBank = 0x80;
  if (long) h.pushByte(0x81);
  h.push(0x1234, 2);
  run(h, { calls: [] }, h.a.routines);
  return summary(registers)(h);
};
const CYCLE_REGISTERS = ['a', 'x', 'status'];

const CASES = [
  {
    name: 'title cycle 80:A18C',
    entry: 0x80a18c,
    samples: 200,
    prepare: (s) => ({ a: s.pick([0, 0, 1, 0x7654]), bank: 0x80, status: s.pick([0, 0x43]) }),
    reference: (h, e, r) => reference.get(0x80a18c)(h, e, r),
    events: () => ({ calls: [] }),
    result: summary(CYCLE_REGISTERS),
    lifted: lifted(runTitleCycle, false, CYCLE_REGISTERS),
  },
  {
    name: 'attract game 80:A168',
    // Each sample uploads two sound directories.
    samples: 60,
    entry: 0x80a168,
    prepare: () => ({ bank: 0x80 }),
    reference: (h, e, r) => reference.get(0x80a168)(h, e, r),
    events: () => ({ calls: [] }),
    result: summary([]),
    lifted: lifted(runAttractGame, false, []),
  },
  {
    name: 'attract demo 80:96F3',
    entry: 0x8096f3,
    long: true,
    prepare: () => ({ bank: 0x80 }),
    reference: (h, e, r) => referenceAttractDemo(h, e, r),
    events: () => ({ calls: [] }),
    result: summary([]),
    lifted: lifted(playAttractDemo, true, []),
  },
];

registerCases(CASES, {
  sample,
  side,
  // The lifted functions take the accessor with its side's routines.
  runtime: (h) => h,
  ignored: START_MENU_IGNORED_WRAM,
});
