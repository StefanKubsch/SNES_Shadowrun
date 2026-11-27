// Random per-function tests of the lifted pad, player and glove getters
// (src/game/script-queries.mjs through their natives in src/task) against the frozen outcomes (tools/lift-vectors/) of their
// former register-level references (proof/game-reference/script-queries.mjs): 80:9E59, 80:9E5F,
// 80:CD97, 80:D18A, 80:C0F7 and 80:C100. Both sides run the native from its script call
// (data bank 80, direct page 0, the RTS frame). Game state only (docs/STRATEGY.md,
// 2026-11-14): WRAM outside the stacks, the device writes and the return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import { getPadHeld as getPadHeldLifted } from '../src/script/native-pad-held.mjs';
import { getPadPressed as getPadPressedLifted } from '../src/script/native-pad-pressed.mjs';
import { getPlayerObject as getPlayerObjectLifted } from '../src/script/native-player-object.mjs';
import { getPlayerObjectCopy as getPlayerObjectCopyLifted } from '../src/script/native-player-object-second.mjs';
import { getGloveScreenX as getGloveScreenXLifted } from '../src/script/native-glove-screen-x.mjs';
import { getGloveScreenY as getGloveScreenYLifted } from '../src/script/native-glove-screen-y.mjs';
import { leafRts } from './register-forms/leaf-return.mjs';
// The natives with the RTS of their register-level entry (2026-11-27).
const getPadHeld = leafRts(getPadHeldLifted);
const getPadPressed = leafRts(getPadPressedLifted);
const getPlayerObject = leafRts(getPlayerObjectLifted);
const getPlayerObjectCopy = leafRts(getPlayerObjectCopyLifted);
const getGloveScreenX = leafRts(getGloveScreenXLifted);
const getGloveScreenY = leafRts(getGloveScreenYLifted);

useLiftVectors(import.meta.url);

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234;

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const query = (name, entry, run) => ({
  name,
  entry,
  samples: 200,
  prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(BYTE) & 0xc3 }),
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = CODE_BANK;
    h.push(CALLER_RETURN, 2);
    run(h.a, false);
    return returned(h);
  },
});
registerCases(
  [
    query('getPadHeld 80:9E59', 0x809e59, getPadHeld),
    query('getPadPressed 80:9E5F', 0x809e5f, getPadPressed),
    query('getPlayerObject 80:CD97', 0x80cd97, getPlayerObject),
    query('getPlayerObjectCopy 80:D18A', 0x80d18a, getPlayerObjectCopy),
    query('getGloveScreenX 80:C0F7', 0x80c0f7, getGloveScreenX),
    query('getGloveScreenY 80:C100', 0x80c100, getGloveScreenY),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
