// Random per-function tests of the lifted karma, nuyen and magic point sums
// (src/game/party-funds.mjs through their natives in src/task) against the frozen outcomes (tools/lift-vectors/) of their
// former register-level references (proof/game-reference/party-funds.mjs): 80:CDB2 (karma),
// 80:CCDB (nuyen), 80:8B8A (the shown member's magic points) and 80:E1B3 (a learned
// spell), and the brightness fade 80:D9AD (src/game/game-nmi.mjs). Both sides run the
// native from its script call (data bank 80, direct page 0, the RTS frame). Game state
// only (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks, the device writes and the
// return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import { learnSpell as learnSpellLifted } from '../src/script/native-spell-add.mjs';
import { startBrightnessFade as startBrightnessFadeLifted } from '../src/script/native-signed-offset-set.mjs';
import { addKarma as addKarmaLifted } from '../src/script/native-karma-add.mjs';
import { addNuyen as addNuyenLifted } from '../src/script/native-nuyen-add.mjs';
import { addMagicPoints as addMagicPointsLifted } from '../src/script/native-magic-points-add.mjs';
import { MEMBER_INDEX, NUYEN, SPELL_LIST } from '../src/data/wram.mjs';
import { leafRts } from './register-forms/leaf-return.mjs';
// The natives with the RTS of their register-level entry (2026-11-27).
const learnSpell = leafRts(learnSpellLifted);
const startBrightnessFade = leafRts(startBrightnessFadeLifted);
const addKarma = leafRts(addKarmaLifted);
const addNuyen = leafRts(addNuyenLifted);
const addMagicPoints = leafRts(addMagicPointsLifted);
useLiftVectors(import.meta.url);

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  MEMBERS = 13;

const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  // The nuyen's high word near its wrap (FFFF: the saturation), the member shown one
  // of the runners or any word.
  if (rnd(2)) setWord(wram, NUYEN + 2, WORD - 1 - rnd(2));
  setWord(wram, MEMBER_INDEX, [2 * rnd(MEMBERS), rnd(WORD)][rnd(2)]);
  // Learned spells: up to 20 nonzero words ended by 0; the argument sometimes one of them.
  const spells = Array.from({ length: rnd(21) }, () => 1 + rnd(WORD - 1));
  spells.forEach((spell, n) => setWord(wram, SPELL_LIST + 2 * n, spell));
  setWord(wram, SPELL_LIST + 2 * spells.length, 0);
  if (spells.length && rnd(2)) setWord(wram, 0, spells[rnd(spells.length)]);
  // The fade's argument sometimes 8000 or 0.
  if (!rnd(8)) setWord(wram, 0, [0x8000, 0][rnd(2)]);
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const FADE_WORDS = 0x1c6,
  FADE_STACK = 0x1c2;
const fadeResult = (h, returnState) =>
  `${returnState} ${[...h.a.mem.wram.subarray(FADE_WORDS, FADE_WORDS + 4)].join()}`;
const sum = (name, entry, run) => ({
  name,
  entry,
  samples: 400,
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
    sum('addKarma 80:CDB2', 0x80cdb2, addKarma),
    sum('addNuyen 80:CCDB', 0x80ccdb, addNuyen),
    sum('addMagicPoints 80:8B8A', 0x808b8a, addMagicPoints),
    sum('learnSpell 80:E1B3', 0x80e1b3, learnSpell),
    // The fade words 7E:01C6-01C9 lie in the stack page the harness ignores, so the result
    // holds them; the harness stack moves to 01C2 below them, as the register-level fade's JSL frame at
    // 01C9 would overlap them (the game's stack lies elsewhere).
    {
      ...sum('startBrightnessFade 80:D9AD', 0x80d9ad, startBrightnessFade),
      prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(BYTE) & 0xc3, s: FADE_STACK }),
      lifted: (h, input) => {
        Object.assign(h.ctx, input);
        h.ctx.programBank = CODE_BANK;
        h.push(CALLER_RETURN, 2);
        startBrightnessFade(h.a, false);
        return fadeResult(h, returned(h));
      },
    },
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
