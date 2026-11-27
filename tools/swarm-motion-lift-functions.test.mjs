// Random per-function tests of the lifted swarm motion natives (src/game/swarm-motion.mjs
// through their natives in src/task) against the frozen outcomes (tools/lift-vectors/) of their former register-level references
// (proof/game-reference/swarm-motion.mjs): 80:D85B (along a path) and 80:D2E7 (as a wave,
// or setting its target from the room's point list, open bus included). Both sides run
// the native from its script call (data bank 80, direct page 0, the RTS frame). Game
// state only (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks, the device writes
// and the return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import { moveSwarmAlongPath as moveSwarmAlongPathLifted } from '../src/script/native-swarm-follow-path.mjs';
import { moveSwarmWave as moveSwarmWaveLifted } from '../src/script/native-swarm-wave.mjs';
import { SWARM_MEMBERS } from '../src/data/wram.mjs';
import { leafRts } from './register-forms/leaf-return.mjs';
// The natives with the RTS of their register-level entry (2026-11-27).
const moveSwarmAlongPath = leafRts(moveSwarmAlongPathLifted);
const moveSwarmWave = leafRts(moveSwarmWaveLifted);

useLiftVectors(import.meta.url);

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  SLOTS = 44,
  MEMBERS = 13,
  SWARM_WORDS = 0x1d0b,
  SWARM_WORDS_END = 0x1d49,
  POINT_LIST = 0xf3,
  // Point lists in ROM (bank 8D), the system area's open bus or any long pointer.
  LIST_POINTERS = [0x8d8000, 0x8d9a00, 0x8c6a00, 0x003000, 0x7e2000];

const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    pick = (list) => list[rnd(list.length)],
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  // Member slots of the game's objects, one far out of range at times.
  for (let n = 0; n < MEMBERS; n++)
    setWord(wram, SWARM_MEMBERS + 2 * n, rnd(16) ? 2 * rnd(SLOTS) : rnd(WORD));
  // The swarm's words small (phases, speeds and goals near each other) or any word.
  if (rnd(4))
    for (let at = SWARM_WORDS; at < SWARM_WORDS_END; at += 2)
      setWord(wram, at, pick([rnd(0x200), rnd(0x400), rnd(8)]));
  setWord(wram, 0, pick([0, 1, 1, rnd(WORD)]));
  setWord(wram, 2, pick([rnd(64), rnd(WORD)]));
  const list = pick([...LIST_POINTERS, rnd(0x1000000)]);
  wram[POINT_LIST] = list & 0xff;
  wram[POINT_LIST + 1] = (list >>> 8) & 0xff;
  wram[POINT_LIST + 2] = list >>> 16;
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const step = (name, entry, run) => ({
  name,
  entry,
  samples: 600,
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
    step('moveSwarmAlongPath 80:D85B', 0x80d85b, moveSwarmAlongPath),
    step('moveSwarmWave 80:D2E7', 0x80d2e7, moveSwarmWave),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
