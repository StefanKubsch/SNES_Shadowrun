// Random per-function tests of the lifted actor state natives (src/game/actor-state.mjs
// through src/task/native-record-*.mjs) against their register-level references
// (proof/game-reference/actor-state.mjs): the flag byte 80:CB2B, count 80:CB3C and
// property 80:CB4D as results, and the flag byte's set 80:CB9F, OR 80:CBB3 and AND
// 80:CBCB, with the bug fixes and the exploit prevention on or off (Akimi's and the
// vampire's actor entries among the samples). Both sides run the native from its script
// call (data bank 80, direct page 0, the RTS frame). Game state only (docs/STRATEGY.md,
// 2026-11-14): WRAM outside the stacks, the device writes and the return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import {
  getActorStateCountReference,
  getActorStateFlagsReference,
  getActorStatePropertyReference,
  keepActorStateFlagBitsReference,
  setActorStateFlagBitsReference,
  setActorStateFlagsReference,
  isActorStatePropertyReference,
} from '../proof/game-reference/actor-state.mjs';
import { getActorStateFlags } from '../src/task/native-record-flags-get.mjs';
import { getActorStateCount } from '../src/task/native-record-count-get.mjs';
import { getActorStateProperty } from '../src/task/native-record-property-get.mjs';
import { setActorStateFlags } from '../src/task/native-record-flags-set.mjs';
import { setActorStateFlagBits } from '../src/task/native-record-flags-or.mjs';
import { keepActorStateFlagBits } from '../src/task/native-record-flags-and.mjs';
import { isActorStateProperty } from '../src/task/native-record-property-equals.mjs';
import { ACTOR_BYTES, ACTOR_RECORD, ACTOR_TABLE, ACTORS } from '../src/data/actors.mjs';
import { DialogTestMemory } from './task-native-dialog-harness.mjs';

// The ROM for the property test's wanted word (the state record's pointer).
const ROM = new DialogTestMemory(new Uint8Array(0x20000));

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  // Akimi's and the vampire's actor entries (src/game/bugfixes.mjs).
  AKIMI = 0x1b6d,
  VAMPIRE = 0x0188,
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
  // An entry of the actor table, Akimi's, the vampire's or any offset.
  setWord(wram, 0, [ACTOR_BYTES * rnd(ACTORS), AKIMI, VAMPIRE, rnd(WORD)][rnd(4)]);
  // Mostly a flag byte 0 (the vampire fix's case) or a small one.
  setWord(wram, 2, [0, rnd(BYTE), rnd(WORD)][rnd(3)]);
  const gameplay = { bugfixes: rnd(2) === 1, preventExploits: rnd(2) === 1 };
  return { seed, wram, rnd, gameplay };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
let current;
const native = (name, entry, reference, run) => ({
  name,
  entry,
  samples: 400,
  reference: (h) => {
    h.a.vm = { gameplay: current.gameplay };
    reference(h.a, false);
  },
  prepare: (s) => {
    current = s;
    return { bank: CODE_BANK, status: s.rnd(BYTE) & 0xc3 };
  },
  result: returned,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.a.vm = { gameplay: current.gameplay };
    h.ctx.programBank = CODE_BANK;
    h.push(CALLER_RETURN, 2);
    run(h.a, false);
    return returned(h);
  },
});
registerCases(
  [
    native('getActorStateFlags 80:CB2B', 0x80cb2b, getActorStateFlagsReference, getActorStateFlags),
    native('getActorStateCount 80:CB3C', 0x80cb3c, getActorStateCountReference, getActorStateCount),
    native(
      'getActorStateProperty 80:CB4D',
      0x80cb4d,
      getActorStatePropertyReference,
      getActorStateProperty,
    ),
    native('setActorStateFlags 80:CB9F', 0x80cb9f, setActorStateFlagsReference, setActorStateFlags),
    native(
      'setActorStateFlagBits 80:CBB3',
      0x80cbb3,
      setActorStateFlagBitsReference,
      setActorStateFlagBits,
    ),
    native(
      'keepActorStateFlagBits 80:CBCB',
      0x80cbcb,
      keepActorStateFlagBitsReference,
      keepActorStateFlagBits,
    ),
    // 80:9DAE takes the actor as the second argument and the wanted property as the
    // first; in half the samples the wanted word is the record's property.
    {
      ...native(
        'isActorStateProperty 80:9DAE',
        0x809dae,
        isActorStatePropertyReference,
        isActorStateProperty,
      ),
      prepare: (s) => {
        current = s;
        const w = s.wram,
          actor = w[0] | (w[1] << 8);
        w[2] = w[0];
        w[3] = w[1];
        // An offset past the table's bank reaches no ROM: no wanted word then.
        const at = ACTOR_TABLE + ACTOR_RECORD + actor,
          state =
            (at & 0xffff) >= 0x8000 && (at & 0xffff) < 0xffff
              ? ROM.read8(at) | (ROM.read8(at + 1) << 8)
              : null,
          property = (state + 3) & 0x1ffff;
        if (state !== null && s.rnd(2)) {
          w[0] = w[property];
          w[1] = w[(property + 1) & 0x1ffff];
        }
        return { bank: CODE_BANK, status: s.rnd(BYTE) & 0xc3 };
      },
    },
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
