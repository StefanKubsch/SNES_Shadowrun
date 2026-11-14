// Random per-function tests of the lifted object field script natives
// (src/game/object-fields.mjs through src/task/native-object-flags-*.mjs) against their
// register-level references (proof/game-reference/object-fields.mjs): the flag word's
// get 80:CA05, set 80:CA0D, OR 80:CA15 and AND 80:CA20, and the record's byte 0 80:CA2B,
// flag byte 80:CA3A, count 80:CA49 and property 80:CA58, the flag byte's set 80:CAA2, OR
// 80:CAB4 and AND 80:CACA and the count's set 80:CAE0 (with and without the health
// cheat, src/game/cheats.mjs), and the armour word's get 80:8EF5, set 80:8AF1, sum 80:8AFA
// and difference 80:8B08, and the motion getters 80:A941 to 80:A96D. Both sides run the native from
// its script call (data bank 80, direct page 0, the RTS frame). Game state only
// (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks, the device writes and the
// return (program counter and stack pointer) must be equal; the script interpreter
// replaces the registers the natives leave.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import {
  getObjectFlagsReference,
  keepObjectFlagBitsReference,
  setObjectFlagBitsReference,
  setObjectFlagsReference,
  getObjectRecordFirstByteReference,
  getObjectRecordFlagsReference,
  getObjectRecordCountReference,
  getObjectRecordPropertyReference,
  setObjectRecordFlagsReference,
  setObjectRecordFlagBitsReference,
  keepObjectRecordFlagBitsReference,
  setObjectRecordCountReference,
  getObjectArmourReference,
  setObjectArmourReference,
  addObjectArmourReference,
  subtractObjectArmourReference,
  getObjectVelocityXReference,
  getObjectVelocityYReference,
  getObjectVelocityZReference,
  getObjectCoarseXReference,
  getObjectCoarseYReference,
  getObjectCoarseHeightReference,
} from '../proof/game-reference/object-fields.mjs';
import { getObjectRecordFirstByte } from '../src/task/native-object-record-byte0.mjs';
import { getObjectRecordFlags } from '../src/task/native-object-record-flags.mjs';
import { getObjectRecordCount } from '../src/task/native-object-record-count.mjs';
import { getObjectRecordProperty } from '../src/task/native-object-record-property.mjs';
import { setObjectRecordFlags } from '../src/task/native-object-record-flags-set.mjs';
import { setObjectRecordFlagBits } from '../src/task/native-object-record-flags-or.mjs';
import { keepObjectRecordFlagBits } from '../src/task/native-object-record-flags-and.mjs';
import { setObjectRecordCount } from '../src/task/native-object-record-count-set.mjs';
import { getObjectArmour } from '../src/task/native-object-armour-get.mjs';
import { setObjectArmour } from '../src/task/native-object-armour-set.mjs';
import { addObjectArmour } from '../src/task/native-object-armour-add.mjs';
import { subtractObjectArmour } from '../src/task/native-object-armour-subtract.mjs';
import { getObjectVelocityX } from '../src/task/native-object-velocity-x.mjs';
import { getObjectVelocityY } from '../src/task/native-object-velocity-y.mjs';
import { getObjectVelocityZ } from '../src/task/native-object-velocity-z.mjs';
import { getObjectCoarseX } from '../src/task/native-object-position-x.mjs';
import { getObjectCoarseY } from '../src/task/native-object-position-y.mjs';
import { getObjectCoarseHeight } from '../src/task/native-object-height.mjs';
import { JAKE_STATE_RECORD } from '../src/game/cheats.mjs';
import { CHEAT } from '../src/game/cheat-settings.mjs';
import { JAKE_BODY, OBJECT_RECORD } from '../src/task/wram.mjs';
import { RECORD_ATTRIBUTE } from '../src/data/runners.mjs';
import { getObjectFlags } from '../src/task/native-object-flags-get.mjs';
import { setObjectFlags } from '../src/task/native-object-flags-set.mjs';
import { setObjectFlagBits } from '../src/task/native-object-flags-or.mjs';
import { keepObjectFlagBits } from '../src/task/native-object-flags-and.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  // Indices below this reach the flag table's low WRAM mirror (7E:1458 + index < 2000).
  LOW_WRAM_INDICES = 0x0ba8,
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
  // An object of the game's slots, none (FFFF) or any index in the low WRAM mirror.
  setWord(wram, 0, [2 * rnd(44), 2 * rnd(44), 0xffff, rnd(LOW_WRAM_INDICES)][rnd(4)]);
  setWord(wram, 2, rnd(WORD));
  // The object's record: none, Jake's state record, one in low WRAM or any pointer (a
  // pointer near FFFF reaches bank 7F). Jake's count maximum sometimes 0.
  const object = wram[0] | (wram[1] << 8);
  if (object < LOW_WRAM_INDICES || object === 0xffff)
    setWord(
      wram,
      (OBJECT_RECORD + object) & 0xffff,
      [0, JAKE_STATE_RECORD, 0x2000 + rnd(0x2000), rnd(WORD), 0xfffd + rnd(3)][rnd(5)],
    );
  if (!rnd(4)) wram[JAKE_BODY + RECORD_ATTRIBUTE.count_max] = 0;
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const lifted = (run) => (h, input) => {
  Object.assign(h.ctx, input);
  h.ctx.programBank = CODE_BANK;
  h.push(CALLER_RETURN, 2);
  run(h.a, false);
  return returned(h);
};
// cheats: the cheat mask of the game (the health cheat protects Jake's count).
const field = (name, entry, reference, run, cheats = 0) => ({
  name,
  entry,
  samples: 400,
  reference: (h) => {
    h.a.vm = { cheats };
    reference(h.a, false);
  },
  prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(BYTE) & 0xc3 }),
  result: returned,
  lifted: (h, input) => {
    h.a.vm = { cheats };
    return lifted(run)(h, input);
  },
});
registerCases(
  [
    field('getObjectFlags 80:CA05', 0x80ca05, getObjectFlagsReference, getObjectFlags),
    field('setObjectFlags 80:CA0D', 0x80ca0d, setObjectFlagsReference, setObjectFlags),
    field('setObjectFlagBits 80:CA15', 0x80ca15, setObjectFlagBitsReference, setObjectFlagBits),
    field('keepObjectFlagBits 80:CA20', 0x80ca20, keepObjectFlagBitsReference, keepObjectFlagBits),
    field(
      'getObjectRecordFirstByte 80:CA2B',
      0x80ca2b,
      getObjectRecordFirstByteReference,
      getObjectRecordFirstByte,
    ),
    field(
      'getObjectRecordFlags 80:CA3A',
      0x80ca3a,
      getObjectRecordFlagsReference,
      getObjectRecordFlags,
    ),
    field(
      'getObjectRecordCount 80:CA49',
      0x80ca49,
      getObjectRecordCountReference,
      getObjectRecordCount,
    ),
    field(
      'getObjectRecordProperty 80:CA58',
      0x80ca58,
      getObjectRecordPropertyReference,
      getObjectRecordProperty,
    ),
    field(
      'setObjectRecordFlags 80:CAA2',
      0x80caa2,
      setObjectRecordFlagsReference,
      setObjectRecordFlags,
    ),
    field(
      'setObjectRecordFlagBits 80:CAB4',
      0x80cab4,
      setObjectRecordFlagBitsReference,
      setObjectRecordFlagBits,
    ),
    field(
      'keepObjectRecordFlagBits 80:CACA',
      0x80caca,
      keepObjectRecordFlagBitsReference,
      keepObjectRecordFlagBits,
    ),
    field(
      'setObjectRecordCount 80:CAE0',
      0x80cae0,
      setObjectRecordCountReference,
      setObjectRecordCount,
    ),
    field(
      'setObjectRecordCount 80:CAE0 with the health cheat',
      0x80cae0,
      setObjectRecordCountReference,
      setObjectRecordCount,
      CHEAT.health,
    ),
    field('getObjectArmour 80:8EF5', 0x808ef5, getObjectArmourReference, getObjectArmour),
    field('setObjectArmour 80:8AF1', 0x808af1, setObjectArmourReference, setObjectArmour),
    field('addObjectArmour 80:8AFA', 0x808afa, addObjectArmourReference, addObjectArmour),
    field(
      'subtractObjectArmour 80:8B08',
      0x808b08,
      subtractObjectArmourReference,
      subtractObjectArmour,
    ),
    field('getObjectVelocityX 80:A941', 0x80a941, getObjectVelocityXReference, getObjectVelocityX),
    field('getObjectVelocityY 80:A949', 0x80a949, getObjectVelocityYReference, getObjectVelocityY),
    field('getObjectVelocityZ 80:A951', 0x80a951, getObjectVelocityZReference, getObjectVelocityZ),
    field('getObjectCoarseX 80:A959', 0x80a959, getObjectCoarseXReference, getObjectCoarseX),
    field('getObjectCoarseY 80:A963', 0x80a963, getObjectCoarseYReference, getObjectCoarseY),
    field(
      'getObjectCoarseHeight 80:A96D',
      0x80a96d,
      getObjectCoarseHeightReference,
      getObjectCoarseHeight,
    ),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
