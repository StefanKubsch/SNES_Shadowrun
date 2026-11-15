// Random per-function tests of the lifted group member position 80:A297 and removal
// 80:A2B5 (src/game/group-members.mjs through their natives in src/task) against their
// register-level references (proof/game-reference/group-members.mjs). Both sides run the native from its
// script call (data bank 80, direct page 0, the RTS frame). Game state only
// (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks, the device writes and the
// return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import {
  getGroupMemberPositionReference,
  removeGroupMemberReference,
} from '../proof/game-reference/group-members.mjs';
import { getGroupMemberPosition } from '../src/script/native-group-member-position.mjs';
import { removeGroupMember } from '../src/script/native-group-remove.mjs';
import { GROUP_INDEX, GROUP_SLOTS } from '../src/data/wram.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  SLOTS = 44,
  // At most four members.
  MEMBERS = 4;

const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  // A group of 0 to 4 members (the last index FFFE when empty) and one of them, a slot or
  // any word as the object.
  const count = rnd(MEMBERS + 1),
    slots = Array.from({ length: count }, () => 2 * rnd(SLOTS));
  setWord(wram, GROUP_INDEX, 2 * count - 2);
  slots.forEach((slot, n) => setWord(wram, GROUP_SLOTS + 2 * n, slot));
  setWord(wram, 0, [count ? slots[rnd(count)] : 0, 2 * rnd(SLOTS), rnd(WORD)][rnd(3)]);
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const member = (name, entry, reference, run) => ({
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
    member(
      'getGroupMemberPosition 80:A297',
      0x80a297,
      getGroupMemberPositionReference,
      getGroupMemberPosition,
    ),
    member('removeGroupMember 80:A2B5', 0x80a2b5, removeGroupMemberReference, removeGroupMember),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
