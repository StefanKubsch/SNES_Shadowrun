// Random per-function tests of the lifted script variable natives
// (src/game/script-variables.mjs through src/task/native-script-variable-*.mjs) against
// their register-level references (proof/game-reference/script-variables.mjs): the get
// 80:CC07, set 80:CC10, OR 80:CC19 and AND 80:CC26. Both sides run the native from its
// script call (data bank 80, direct page 0, the RTS frame). Game state only
// (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks, the device writes and the
// return (program counter and stack pointer) must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import {
  getScriptVariableReference,
  keepScriptVariableBitsReference,
  setScriptVariableBitsReference,
  setScriptVariableReference,
} from '../proof/game-reference/script-variables.mjs';
import { getScriptVariable } from '../src/task/native-script-variable-get.mjs';
import { setScriptVariable } from '../src/task/native-script-variable-set.mjs';
import { setScriptVariableBits } from '../src/task/native-script-variable-or.mjs';
import { keepScriptVariableBits } from '../src/task/native-script-variable-and.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  // The game's variables lie in the first 0x100 bytes; offsets near FFFF reach bank 7F.
  GAME_OFFSETS = 0x100,
  IGNORED = [];

const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  setWord(wram, 0, [rnd(GAME_OFFSETS), rnd(GAME_OFFSETS), rnd(WORD), 0xffff - rnd(4)][rnd(4)]);
  setWord(wram, 2, rnd(WORD));
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const variable = (name, entry, reference, run) => ({
  name,
  entry,
  samples: 400,
  reference: (h) => reference(h.a, false),
  prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(BYTE) & 0xc3 }),
  result: returned,
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
    variable('getScriptVariable 80:CC07', 0x80cc07, getScriptVariableReference, getScriptVariable),
    variable('setScriptVariable 80:CC10', 0x80cc10, setScriptVariableReference, setScriptVariable),
    variable(
      'setScriptVariableBits 80:CC19',
      0x80cc19,
      setScriptVariableBitsReference,
      setScriptVariableBits,
    ),
    variable(
      'keepScriptVariableBits 80:CC26',
      0x80cc26,
      keepScriptVariableBitsReference,
      keepScriptVariableBits,
    ),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
