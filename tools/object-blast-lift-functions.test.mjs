// Random per-function tests of the lifted blast (src/game/object-blast.mjs) against the
// register-level native 80:8E36 (src/task/native-object-hit.mjs). Both sides call the
// same stand-in for the hit 80:8691: it records A, X, Y, the flags N, V, Z and C and the
// direct page words 00 and 02, writes a result to DP B4 and leaves registers and flags
// drawn from the sample's own sequence. WRAM outside the stack, the calls, the return
// and the registers left must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { hitObjectsInBlast } from '../src/task/native-object-hit.mjs';
import { hitObjectsInBlastSequence } from '../src/game/object-blast.mjs';
import {
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_KIND,
  OBJECT_LAST_SLOT,
  OBJECT_X,
  OBJECT_Y,
} from '../src/task/wram.mjs';
import { drainNativeSequence } from '../src/task/native-call-continuation.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  DP_HIT_RESULT = 0xb4,
  // Status bits a stand-in may leave: N, V, Z and C (the register widths stay 16-bit).
  LEFT_FLAGS = 0xc3,
  IGNORED = [[0x0100, 0x01ca]],
  HIT = 0x808691;

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
  // The centre: mostly a slot of the game's object list, sometimes any word.
  const centre = rnd(8) ? rnd(0x40) * 2 : rnd(WORD);
  setWord(wram, 0, centre);
  // Many objects near the centre, so that the reach tests decide on each axis.
  for (let slot = 0; slot <= OBJECT_LAST_SLOT; slot += 2) {
    if (rnd(2)) wram[OBJECT_KIND + slot + 1] &= 0x7f;
    if (rnd(2)) wram[OBJECT_FLAGS + slot + 1] |= 0x80;
    if (rnd(4))
      for (const offset of [OBJECT_X, OBJECT_Y, OBJECT_HEIGHT]) {
        const near = (word(wram, offset + centre) + rnd(0xd0) - 0x68) & 0xffff;
        if (rnd(6)) setWord(wram, offset + slot, near);
      }
  }
  return { seed, wram, rnd };
}

// The hit stand-in of one side; both sides draw the same sequence.
function standIns(s) {
  const random = prng(s.seed ^ 0x3c3c3c3c),
    rnd = (n) => Math.floor(random() * n),
    calls = [];
  const hit = (h) => {
    const { a } = h,
      { ctx } = a,
      w = a.mem.wram;
    calls.push(
      [ctx.a, ctx.x, ctx.y, ctx.status & LEFT_FLAGS, word(w, 0), word(w, 2)]
        .map((v) => v.toString(HEX))
        .join(':'),
    );
    setWord(w, DP_HIT_RESULT, rnd(WORD));
    ctx.a = rnd(WORD);
    ctx.x = rnd(WORD);
    ctx.y = rnd(WORD);
    ctx.status = (ctx.status & ~LEFT_FLAGS) | (rnd(BYTE) & LEFT_FLAGS);
    const rawReturnWord = a.pullWord();
    ctx.pc = (rawReturnWord + 1) & 0xffff;
    return { rawReturnWord };
  };
  return { routines: new Map([[HIT, hit]]), calls };
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
      name: 'hitObjectsInBlast 80:8E36',
      entry: 0x808e36,
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
        hitObjectsInBlast(h.a, { calls: [] }, false, routines);
      },
      result: (h) => returned(h, referenceCalls),
      lifted: (h, input) => {
        Object.assign(h.ctx, input);
        h.ctx.programBank = CODE_BANK;
        h.push(CALLER_RETURN, 2);
        const { routines, calls } = standIns(current);
        drainNativeSequence(hitObjectsInBlastSequence(h, null, routines));
        return returned(h, calls);
      },
    },
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
