// Random per-function tests of the lifted kind natives (src/game/kind-values.mjs through
// their natives in src/task) against their register-level references
// (proof/game-reference/kind-values.mjs): the object's kind value 80:C9F1 and the actor
// entry's kind value 80:CAF2, kind flags 80:CB06 and kind 80:D0FC. Both sides run the
// native from its script call (data bank 80, direct page 0, the RTS frame). Game state
// only (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks, the device writes and the
// return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import {
  getActorKindFlagsReference,
  getActorKindReference,
  getActorKindValueReference,
  getObjectKindValueReference,
} from '../proof/game-reference/kind-values.mjs';
import { getObjectKindValue } from '../src/task/native-object-kind-attribute.mjs';
import { getActorKindValue } from '../src/task/native-record-kind-attribute.mjs';
import { getActorKindFlags } from '../src/task/native-record-kind-second-attribute.mjs';
import { getActorKind } from '../src/task/native-record-kind-get.mjs';
import { ACTOR_BYTES, ACTORS } from '../src/data/actors.mjs';
import { KINDS } from '../src/data/kinds.mjs';
import { OBJECT_KIND } from '../src/task/wram.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234;

const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  // An actor entry, a game object slot or any offset.
  const first = [ACTOR_BYTES * rnd(ACTORS), 2 * rnd(44), rnd(WORD)][rnd(3)];
  setWord(wram, 0, first);
  // The object's kind: one of the game's or any word (bit 14 set: the ADC's carry).
  if (rnd(2)) setWord(wram, (OBJECT_KIND + first) & 0x1ffff, rnd(KINDS));
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const query = (name, entry, reference, run) => ({
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
    query('getObjectKindValue 80:C9F1', 0x80c9f1, getObjectKindValueReference, getObjectKindValue),
    query('getActorKindValue 80:CAF2', 0x80caf2, getActorKindValueReference, getActorKindValue),
    query('getActorKindFlags 80:CB06', 0x80cb06, getActorKindFlagsReference, getActorKindFlags),
    query('getActorKind 80:D0FC', 0x80d0fc, getActorKindReference, getActorKind),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
