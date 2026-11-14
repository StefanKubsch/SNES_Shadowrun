// Random per-function tests of the lifted spell choice (src/game/spell-choice.mjs)
// against the register-level native 80:E1CF (src/task/native-spell-choice.mjs). Both
// sides call the same stand-ins for the window 80:F963 (a window number in DP 00), the
// menu 80:A6C7 (a row, Exit or a cancel in DP 00) and the release 80:FA3E. Each records
// its target, A, X, Y, the flags N, V, Z and C and the direct page words 00 and 02, and
// leaves registers and flags drawn from the sample's own sequence. WRAM outside the
// stack, the calls, the return and the registers left must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { chooseSpell } from '../src/task/native-spell-choice.mjs';
import { chooseSpellSequence } from '../src/game/spell-choice.mjs';
import { SPELL_LIST } from '../src/task/wram.mjs';
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
  OPEN_WINDOW = 0x80f963,
  MENU = 0x80a6c7,
  RELEASE_WINDOW = 0x80fa3e;

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
  // None to eight learned spells, mostly small numbers, sometimes any word.
  const count = rnd(6) ? 1 + rnd(8) : 0;
  for (let n = 0; n < count; n++)
    setWord(wram, SPELL_LIST + 2 * n, rnd(8) ? 1 + rnd(0x30) : 1 + rnd(WORD - 1));
  setWord(wram, SPELL_LIST + 2 * count, 0);
  return { seed, wram, rnd, count };
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
    // A row of the list (Exit is 0), a cancel, or a word with only bit 15 set.
    if (target === MENU)
      setWord(w, 0, [rnd(s.count + 1), rnd(s.count + 1), 0xffff, 0x8000, rnd(WORD)][rnd(5)]);
    ctx.a = rnd(WORD);
    ctx.x = rnd(WORD);
    ctx.y = rnd(WORD);
    ctx.status = (ctx.status & ~LEFT_FLAGS) | (rnd(BYTE) & LEFT_FLAGS);
    const rawReturnWord = a.pullWord();
    ctx.pc = (rawReturnWord + 1) & 0xffff;
    return { rawReturnWord };
  };
  const routines = new Map([OPEN_WINDOW, MENU, RELEASE_WINDOW].map((t) => [t, stub(t)]));
  // The register-level native takes its callees by name with the accessor.
  const named = {
    allocate: (a) => routines.get(OPEN_WINDOW)({ a }),
    menu: (a) => routines.get(MENU)({ a }),
    release: (a) => routines.get(RELEASE_WINDOW)({ a }),
  };
  return { routines, named, calls };
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
      name: 'chooseSpell 80:E1CF',
      entry: 0x80e1cf,
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
        const { named, calls } = standIns(current);
        referenceCalls = calls;
        chooseSpell(h.a, null, false, named);
      },
      result: (h) => returned(h, referenceCalls),
      lifted: (h, input) => {
        Object.assign(h.ctx, input);
        h.ctx.programBank = CODE_BANK;
        h.push(CALLER_RETURN, 2);
        const { routines, calls } = standIns(current);
        drainNativeSequence(chooseSpellSequence(h, null, routines));
        return returned(h, calls);
      },
    },
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
