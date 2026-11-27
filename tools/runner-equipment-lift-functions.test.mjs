// Random per-function tests of the lifted equipment natives (src/game/runner-equipment.mjs
// through their natives in src/task) against the frozen outcomes (tools/lift-vectors/) of their former register-level references
// (proof/game-reference/runner-equipment.mjs): 80:8B16 (armour), 80:8B9F (weapon), 80:9D15
// and 80:9CE4 (an item's property word, taking it off its runner), with the bug fixes off
// and on. Both sides run the native from its script call (data bank 80, direct page 0,
// the RTS frame). Game state only (docs/STRATEGY.md, 2026-11-14): WRAM outside the
// stacks, the device writes and the return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import { equipRunnerArmour as equipRunnerArmourLifted } from '../src/script/native-runner-armour-equip.mjs';
import { equipRunnerWeapon as equipRunnerWeaponLifted } from '../src/script/native-runner-weapon-equip.mjs';
import { setItemPropertyAndUnequip as setItemPropertyAndUnequipLifted } from '../src/script/native-object-record-property-equip.mjs';
import { setActorItemPropertyAndUnequip as setActorItemPropertyAndUnequipLifted } from '../src/script/native-record-property-equip.mjs';
import {
  GLOVE_TARGET_TAG,
  GLOVE_TARGET_OBJECT,
  PLAYER_OBJECT,
  MEMBER_INDEX,
  OBJECT_NUMBER,
  OBJECT_RECORD,
  RUNNER_ARMOUR,
} from '../src/data/wram.mjs';
import { leafRts } from './register-forms/leaf-return.mjs';
// The natives with the RTS of their register-level entry (2026-11-27).
const equipRunnerArmour = leafRts(equipRunnerArmourLifted);
const equipRunnerWeapon = leafRts(equipRunnerWeaponLifted);
const setItemPropertyAndUnequip = leafRts(setItemPropertyAndUnequipLifted);
const setActorItemPropertyAndUnequip = leafRts(setActorItemPropertyAndUnequipLifted);

useLiftVectors(import.meta.url);

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  SLOTS = 0x60,
  RUNNERS = 14,
  ROW_BYTES = 8,
  WEAPON = 3;

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
  const item = pick([2 * rnd(SLOTS), 2 * rnd(SLOTS), rnd(WORD)]),
    actor = pick([2 * rnd(0x400), rnd(WORD)]);
  setWord(wram, 0, pick([item, actor]));
  setWord(wram, MEMBER_INDEX, pick([2 * rnd(4), 2 * rnd(RUNNERS), rnd(WORD)]));
  setWord(wram, GLOVE_TARGET_TAG, rnd(WORD));
  setWord(wram, GLOVE_TARGET_OBJECT, pick([2 * rnd(SLOTS), rnd(WORD)]));
  setWord(wram, PLAYER_OBJECT, pick([2 * rnd(SLOTS), rnd(WORD)]));
  if (item < 2 * SLOTS)
    setWord(wram, OBJECT_RECORD + item, pick([0, 0x3000 + rnd(0x1000), rnd(WORD)]));
  // The item's number (or the actor entry) worn by one or two runners.
  const number = pick([
    item < 2 * SLOTS ? wram[OBJECT_NUMBER + item] | (wram[OBJECT_NUMBER + item + 1] << 8) : 0,
    actor,
    wram[0] | (wram[1] << 8),
  ]);
  for (let n = rnd(3); n > 0; n--)
    setWord(wram, RUNNER_ARMOUR + ROW_BYTES * rnd(RUNNERS) + pick([0, WEAPON]), number);
  return { seed, wram, rnd, fixes: rnd(2) === 1 };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const step = (name, entry, run) => ({
  name,
  entry,
  samples: 500,
  prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(BYTE) & 0xc3 }),
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = CODE_BANK;
    h.push(CALLER_RETURN, 2);
    run(h.a, false);
    return returned(h);
  },
});
const side = (s) => {
  const made = createSide(s, new Map());
  if (s.fixes) made.a.vm = { gameplay: { bugfixes: true } };
  return made;
};
registerCases(
  [
    step('equipRunnerArmour 80:8B16', 0x808b16, equipRunnerArmour),
    step('equipRunnerWeapon 80:8B9F', 0x808b9f, equipRunnerWeapon),
    step('setItemPropertyAndUnequip 80:9D15', 0x809d15, setItemPropertyAndUnequip),
    step('setActorItemPropertyAndUnequip 80:9CE4', 0x809ce4, setActorItemPropertyAndUnequip),
  ],
  { sample, side, runtime: (h) => h, ignored: [] },
);
