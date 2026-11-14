// Random per-function tests of the lifted member portrait (src/game/member-portrait.mjs)
// against the register-level 80:E4B3 with 80:E48D, 80:E433 and 80:E41F
// (src/task/native-member-spell-menu.mjs). Both sides call the same stand-ins for the
// unpack 80:9F6D, the uploads 80:8F20, 80:9022 and 80:8FF5 and the word wait 81:B0A1
// (JSL, which keeps X as the original); the port writes are compared too. Each records its target, A,
// X, Y, the flags N, V, Z and C, the direct page words 00 and 02 and S (a wait takes
// its NMI there: the JSR frames of 80:E48D and 80:E433 count), and leaves
// registers and flags drawn from the sample's own sequence. WRAM outside the stack, the
// calls, the return and the registers left must be equal. A second case runs the real
// unpack and row shift on both sides (the register-level ones of the dialog's table and
// the lifted ones of src/game/portrait-upload.mjs that the game's table binds), with
// stand-ins for the uploads and the word wait only.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { e4b3Sequence } from '../src/task/native-member-spell-menu.mjs';
import { memberPortraitSequence } from '../src/game/member-portrait.mjs';
import { MEMBER_PORTRAIT } from '../src/task/wram.mjs';
import { TALK_ROUTINES } from '../src/task/native-dialog.mjs';
import { shiftPortraitRowsRoutine, unpackPortraitRoutine } from '../src/game/portrait-upload.mjs';
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
  // The dialogs with portraits (80:94F7 has a word per dialog).
  DIALOGS = 0x50,
  TARGETS = [0x809f6d, 0x808f20, 0x809022, 0x808ff5, 0x81b0a1],
  UNPACK = 0x809f6d,
  SHIFT_ROWS = 0x808f20;

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
  // A dialog's portrait, rarely any word.
  setWord(wram, MEMBER_PORTRAIT, rnd(8) ? rnd(DIALOGS) : rnd(WORD));
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
      [target, ctx.a, ctx.x, ctx.y, ctx.status & LEFT_FLAGS, word(w, 0), word(w, 2), ctx.s]
        .map((v) => v.toString(HEX))
        .join(':'),
    );
    ctx.a = rnd(WORD);
    // The word wait keeps X, the window loop's counter.
    const x = rnd(WORD);
    if (target !== 0x81b0a1) ctx.x = x;
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
  return { routines: new Map(TARGETS.map((t) => [t, stub(t)])), calls };
}
const returned = (h, calls) =>
  [h.ctx.pc, h.ctx.s, h.ctx.a, h.ctx.x, h.ctx.y, h.ctx.status & LEFT_FLAGS]
    .map((v) => v.toString(HEX))
    .join() +
  ' ' +
  calls.join(' ');
let referenceCalls, current;
// The case with the real unpack and row shift (bind: the map of target to routine).
const portraitCase = (name, referenceBind, liftedBind, samples) => ({
  name,
  entry: 0x80e4b3,
  samples,
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
    for (const [target, run] of referenceBind) routines.set(target, run);
    drainNativeSequence(e4b3Sequence(h, null, routines));
  },
  result: (h) => returned(h, referenceCalls),
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = CODE_BANK;
    h.push(CALLER_RETURN, 2);
    const { routines, calls } = standIns(current);
    for (const [target, run] of liftedBind) routines.set(target, run);
    drainNativeSequence(memberPortraitSequence(h, null, routines));
    return returned(h, calls);
  },
});
registerCases(
  [
    portraitCase(
      'memberPortrait 80:E4B3 with the real unpack and row shift',
      [
        [UNPACK, TALK_ROUTINES.get(UNPACK)],
        [SHIFT_ROWS, TALK_ROUTINES.get(SHIFT_ROWS)],
      ],
      [
        [UNPACK, unpackPortraitRoutine],
        [SHIFT_ROWS, shiftPortraitRowsRoutine],
      ],
      100,
    ),
    {
      name: 'memberPortrait 80:E4B3',
      entry: 0x80e4b3,
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
        drainNativeSequence(e4b3Sequence(h, null, routines));
      },
      result: (h) => returned(h, referenceCalls),
      lifted: (h, input) => {
        Object.assign(h.ctx, input);
        h.ctx.programBank = CODE_BANK;
        h.push(CALLER_RETURN, 2);
        const { routines, calls } = standIns(current);
        drainNativeSequence(memberPortraitSequence(h, null, routines));
        return returned(h, calls);
      },
    },
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
