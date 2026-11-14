// Random per-function tests of the lifted status screen (src/game/status-screen.mjs)
// against the register-level 80:EA6E, 80:EA89 and 80:EA8E (statusSequence in
// src/task/native-status-screen.mjs). Both sides call the same stand-ins for the sound
// command 81:F007, the notice release 80:FF79, the glove 80:BCB2, 81:886A, the window
// 80:F963 (a window number in DP 00), the cursor, text, number and decimal number, the
// equipment rows, the portrait, the menu 80:A6C7 (Exit, a submenu row or a negative
// row in DP 00), the six submenus of 80:ED2E (some end the screen, 7E:1D63), the
// release 80:FA3E and 80:92C5. The cursor sometimes lowers the attribute index kept in
// DP 6B. Each records its target, A, X, Y, the flags N, V, Z and C and the direct page
// words 00 and 02, and leaves registers and flags drawn from the sample's own sequence.
// WRAM outside the stack, the calls, the return and the registers left must be equal;
// an object and leader outside the group stop both sides alike.
import { DialogTestMemory, prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { statusRoutineSequence } from '../src/task/native-status-screen.mjs';
import {
  ITEMS_ENTRY,
  NATIVE_ENTRY,
  START_ENTRY,
  statusScreenSequence,
} from '../src/game/status-screen.mjs';
import {
  DIALOG_END,
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  GROUP_INDEX,
  GROUP_NUMBERS,
  JAKE_ALTERNATE_PORTRAIT,
  OBJECT_NUMBER,
  PLAYER_OBJECT,
} from '../src/task/wram.mjs';
import { RUNNER_OBJECT_NUMBERS } from '../src/data/runners.mjs';
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
  RUNNERS = 13,
  JAKE = 0x08b2,
  // Object slots below the object fields' ends; group indices up to five members.
  OBJECT_SLOTS = 0x40,
  GROUP_MEMBERS = 6,
  DP_SCRATCH = 0x6b,
  SUBMENU_TABLE = 0x80ed2e,
  SUBMENU_ROWS = 6,
  LONG_TARGETS = new Set([0x81f007, 0x81886a]);

const romMemory = new DialogTestMemory(new Uint8Array(WRAM_BYTES)),
  runnerNumbers = Array.from({ length: RUNNERS }, (_, n) =>
    romMemory.read16(0x800000 + RUNNER_OBJECT_NUMBERS + 2 * n),
  ),
  submenus = Array.from(
    { length: SUBMENU_ROWS },
    (_, n) => 0x800000 | romMemory.read16(SUBMENU_TABLE + 2 * (n + 1)),
  ),
  TARGETS = [
    0x81f007,
    0x80ff79,
    0x80bcb2,
    0x81886a,
    0x80f963,
    0x80faac,
    0x80fe69,
    0x80fd80,
    0x80fdcf,
    0x80e9c5,
    0x80e4b3,
    0x80a6c7,
    0x80fa3e,
    0x8092c5,
    ...submenus,
  ];
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
  const slot = () => 2 * rnd(OBJECT_SLOTS),
    object = slot(),
    leader = slot(),
    number = rnd(2) ? JAKE : rnd(4) ? runnerNumbers[rnd(RUNNERS)] : rnd(WORD),
    leaderNumber = rnd(2) ? JAKE : runnerNumbers[rnd(RUNNERS)];
  setWord(wram, 0, object);
  setWord(wram, GLOVE_TARGET_OBJECT, object);
  setWord(wram, GLOVE_TARGET_TAG, rnd(2) ? rnd(0x8000) : 0x8000 | rnd(0x8000));
  setWord(wram, PLAYER_OBJECT, leader);
  setWord(wram, OBJECT_NUMBER + object, number);
  if (leader !== object) setWord(wram, OBJECT_NUMBER + leader, leaderNumber);
  const last = 2 * rnd(GROUP_MEMBERS);
  setWord(wram, GROUP_INDEX, last);
  for (let n = 0; n <= last; n += 2) setWord(wram, GROUP_NUMBERS + n, rnd(WORD));
  // The object in the group mostly, else the leader (rarely neither: both stop).
  const place = (value) => setWord(wram, GROUP_NUMBERS + 2 * rnd(last / 2 + 1), value);
  if (rnd(4)) place(number);
  else if (rnd(8)) place(leaderNumber);
  if (rnd(2)) wram[JAKE_ALTERNATE_PORTRAIT] = 0;
  const entry = [NATIVE_ENTRY, START_ENTRY, ITEMS_ENTRY][rnd(3)];
  return { seed, wram, rnd, entry };
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
    if (target === 0x80f963) setWord(w, 0, rnd(8));
    if (target === 0x80a6c7) setWord(w, 0, rnd(4) ? 1 + rnd(SUBMENU_ROWS) : rnd(2) ? 0 : WORD - 1);
    if (submenus.includes(target)) setWord(w, DIALOG_END, rnd(3) ? 0 : rnd(WORD));
    if (target === 0x80faac && rnd(8) === 0) setWord(w, DP_SCRATCH, 2 * rnd(3));
    ctx.a = rnd(WORD);
    ctx.x = rnd(WORD);
    ctx.y = rnd(WORD);
    ctx.status = (ctx.status & ~LEFT_FLAGS) | (rnd(BYTE) & LEFT_FLAGS);
    const rawReturnWord = LONG_TARGETS.has(target) ? h.rtl() : h.rts();
    return { rawReturnWord };
  };
  return { routines: new Map(TARGETS.map((t) => [t, stub(t)])), calls };
}
const returned = (h, calls) =>
  [h.ctx.pc, h.ctx.s, h.ctx.a, h.ctx.x, h.ctx.y, h.ctx.status & LEFT_FLAGS]
    .map((v) => v.toString(HEX))
    .join() +
  ' ' +
  calls.join(' ');
let referenceCalls, current;
registerCases(
  [
    {
      name: 'status screen 80:EA6E, 80:EA89 and 80:EA8E',
      entry: NATIVE_ENTRY,
      samples: 600,
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
        drainNativeSequence(statusRoutineSequence(h, null, routines, current.entry));
      },
      result: (h) => returned(h, referenceCalls),
      lifted: (h, input) => {
        Object.assign(h.ctx, input);
        h.ctx.programBank = CODE_BANK;
        h.push(CALLER_RETURN, 2);
        const { routines, calls } = standIns(current);
        drainNativeSequence(statusScreenSequence(h, null, routines, current.entry));
        return returned(h, calls);
      },
    },
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
