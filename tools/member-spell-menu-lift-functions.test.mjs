// Random per-function tests of the lifted spell menu (src/game/member-spell-menu.mjs)
// against the register-level natives (src/task/native-member-spell-menu.mjs): the
// script native 80:F254 with its menu 80:E693, and the menu's entries 80:E693 and
// 80:E68E (from the status screen) alone. Both sides call the same stand-ins for the
// window 80:F963 (a window number in DP 00), the menu 80:A6C7 (a row, Exit or a
// negative word in DP 00), the script's append 80:C34A and visit 80:C1CA (the dialog's
// end and the portrait redraw drawn), the window list 81:AEB0 (JSL), the portrait
// 80:E4B3, the key wait 80:F953, the notice windows' release 80:FF79, the window's
// release 80:FA3E and the equipment window 80:E9C5. Each records its target, A, X, Y,
// the flags N, V, Z and C and the direct page words 00 and 02, and leaves registers and
// flags drawn from the sample's own sequence. WRAM outside the stack, the calls, the
// return and the registers left must be equal.
import { DialogTestMemory, prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { openWeaponMenu, e693Sequence } from '../src/task/native-member-spell-menu.mjs';
import {
  openSpellMenuSequence,
  spellMenuSequence,
  STATUS_ENTRY,
} from '../src/game/member-spell-menu.mjs';
import {
  DIALOG_END,
  MEMBER_PORTRAIT_REDRAW,
  NOTICE_WINDOWS,
  OBJECT_NUMBER,
  PLAYER_OBJECT,
  MEMBER_OBJECT,
} from '../src/task/wram.mjs';
import { drainNativeSequence } from '../src/task/native-call-continuation.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  // Status bits a stand-in may leave: N, V, Z and C (the register widths stay 16-bit).
  LEFT_FLAGS = 0xc3,
  IGNORED = [[0x0100, 0x01ca]],
  // The runners' object numbers (80:9700, 13 words), the record pointer DP F9-FB and
  // the spell slots 12 to 17 of a record.
  RUNNER_NUMBERS = 0x809700,
  RUNNERS = 13,
  RUNNER_RECORDS = 0x80971a,
  DP_RECORD = 0xf9,
  SKILLS_START = 6,
  SPELL_SLOTS = [12, 13, 14, 15, 16, 17];
const OPEN_WINDOW = 0x80f963,
  MENU = 0x80a6c7,
  APPEND_SCRIPT = 0x80c34a,
  VISIT_SCRIPT = 0x80c1ca,
  REDRAW_LIST = 0x81aeb0,
  SHOW_PORTRAIT = 0x80e4b3,
  CONFIRM_KEY = 0x80f953,
  RELEASE_NOTICES = 0x80ff79,
  RELEASE_WINDOW = 0x80fa3e,
  SHOW_EQUIPMENT = 0x80e9c5,
  SPELL_MENU = 0x80e693;

const romMemory = new DialogTestMemory(new Uint8Array(WRAM_BYTES)),
  runnerNumbers = Array.from({ length: RUNNERS }, (_, n) =>
    romMemory.read16(RUNNER_NUMBERS + 2 * n),
  ),
  runnerRecords = Array.from({ length: RUNNERS }, (_, n) =>
    romMemory.read16(RUNNER_RECORDS + 2 * n),
  ),
  // Jake's record lies in WRAM, the others in the ROM.
  runnerBanks = Array.from(
    { length: RUNNERS },
    (_, n) => romMemory.read16(RUNNER_RECORDS + 2 * RUNNERS + 2 * n) & 0xff,
  );
const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
const word = (w, at) => w[at] | (w[at + 1] << 8);

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  const object = rnd(0x40) * 2,
    // Jake in about half of the samples.
    runner = rnd(2) ? 0 : rnd(RUNNERS);
  setWord(wram, 0, object);
  // Mostly a runner's object, rarely none.
  setWord(wram, OBJECT_NUMBER + object, rnd(12) ? runnerNumbers[runner] : rnd(WORD));
  // The member is the leader in some samples.
  if (rnd(3)) setWord(wram, PLAYER_OBJECT, object);
  // The record pointer for the menu alone: a runner's record in WRAM.
  const record = (runnerRecords[runner] + SKILLS_START) & 0xffff;
  setWord(wram, DP_RECORD, record);
  wram[DP_RECORD + 2] = runnerBanks[runner];
  setWord(wram, MEMBER_OBJECT, rnd(2) ? object : word(wram, PLAYER_OBJECT));
  // Spell levels: none known, a few, or all; levels 1 to 3 mostly.
  const known = rnd(5);
  for (const slot of SPELL_SLOTS) {
    const at = runnerRecords[0] + SKILLS_START + slot;
    wram[at] = known === 0 ? 0 : rnd(known + 1) ? 0 : rnd(8) ? 1 + rnd(3) : rnd(BYTE);
  }
  // Notice windows open or not.
  for (let n = 0; n < 4; n++) if (rnd(2)) wram[NOTICE_WINDOWS + 2 * n + 1] |= 0x80;
  return { seed, wram, rnd };
}

// The stand-ins of one side; both sides draw the same sequence.
function standIns(s) {
  const random = prng(s.seed ^ 0x3c3c3c3c),
    rnd = (n) => Math.floor(random() * n),
    calls = [];
  const stub = (target) => (h) => {
    const { a } = h,
      { ctx } = a,
      w = a.mem.wram;
    calls.push(
      [target, ctx.a, ctx.x, ctx.y, ctx.status & LEFT_FLAGS, word(w, 0), word(w, 2)]
        .map((v) => v.toString(HEX))
        .join(':'),
    );
    if (target === OPEN_WINDOW) setWord(w, 0, rnd(8));
    if (target === MENU) setWord(w, 0, [rnd(7), rnd(7), rnd(7), 0, 0xffff, rnd(WORD)][rnd(6)]);
    if (target === VISIT_SCRIPT) {
      setWord(w, DIALOG_END, rnd(3) ? 0 : rnd(WORD));
      // The script asks for the redraw or leaves the cleared word.
      if (rnd(2)) setWord(w, MEMBER_PORTRAIT_REDRAW, rnd(WORD));
    }
    ctx.a = rnd(WORD);
    ctx.x = rnd(WORD);
    ctx.y = rnd(WORD);
    ctx.status = (ctx.status & ~LEFT_FLAGS) | (rnd(BYTE) & LEFT_FLAGS);
    const rawReturnWord = a.pullWord();
    if (target >>> 16 === 0x81) {
      ctx.s = (ctx.s + 1) & 0xffff;
      ctx.programBank = a.read(ctx.s);
    }
    ctx.pc = (rawReturnWord + 1) & 0xffff;
    return { rawReturnWord };
  };
  const routines = new Map(
    [
      OPEN_WINDOW,
      MENU,
      APPEND_SCRIPT,
      VISIT_SCRIPT,
      REDRAW_LIST,
      SHOW_PORTRAIT,
      CONFIRM_KEY,
      RELEASE_NOTICES,
      RELEASE_WINDOW,
      SHOW_EQUIPMENT,
    ].map((t) => [t, stub(t)]),
  );
  if (s.menuStandIn) routines.set(SPELL_MENU, stub(SPELL_MENU));
  return { routines, calls };
}
const returned = (h, calls) =>
  [h.ctx.pc, h.ctx.s, h.ctx.a, h.ctx.x, h.ctx.y, h.ctx.status & LEFT_FLAGS]
    .map((v) => v.toString(HEX))
    .join() +
  ' ' +
  calls.join(' ');
let referenceCalls, current;
const menu = (name, entry, reference, lifted) => ({
  name,
  entry,
  samples: 400,
  prepare: (s) => {
    current = s;
    return {
      bank: CODE_BANK,
      a: s.rnd(WORD),
      x: s.rnd(WORD),
      y: s.rnd(WORD),
      status: s.rnd(BYTE) & LEFT_FLAGS,
    };
  },
  reference: (h) => {
    const { routines, calls } = standIns(current);
    referenceCalls = calls;
    reference(h, routines);
  },
  result: (h) => returned(h, referenceCalls),
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = CODE_BANK;
    h.push(CALLER_RETURN, 2);
    const { routines, calls } = standIns(current);
    drainNativeSequence(lifted(h, routines));
    return returned(h, calls);
  },
});
registerCases(
  [
    // 80:F254 with its menu as a stand-in: the registers it passes.
    {
      ...menu(
        'openSpellMenu 80:F254 (menu stand-in)',
        0x80f254,
        (h, routines) => openWeaponMenu(h.a, null, false, routines),
        (h, routines) => openSpellMenuSequence(h, null, routines),
      ),
      prepare: (s) => {
        current = { ...s, menuStandIn: true };
        return {
          bank: CODE_BANK,
          a: s.rnd(WORD),
          x: s.rnd(WORD),
          y: s.rnd(WORD),
          status: s.rnd(BYTE) & LEFT_FLAGS,
        };
      },
    },
    menu(
      'openSpellMenu 80:F254',
      0x80f254,
      (h, routines) => openWeaponMenu(h.a, null, false, routines),
      (h, routines) => openSpellMenuSequence(h, null, routines),
    ),
    menu(
      'spellMenu 80:E693',
      0x80e693,
      (h, routines) => drainNativeSequence(e693Sequence(h, null, routines)),
      (h, routines) => spellMenuSequence(h, null, routines),
    ),
    menu(
      'spellMenu 80:E68E',
      STATUS_ENTRY,
      (h, routines) => drainNativeSequence(e693Sequence(h, null, routines, STATUS_ENTRY)),
      (h, routines) => spellMenuSequence(h, null, routines, STATUS_ENTRY),
    ),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
