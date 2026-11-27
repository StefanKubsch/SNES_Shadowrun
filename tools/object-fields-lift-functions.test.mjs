// Random per-function tests of the lifted object field script natives
// (src/game/object-fields.mjs through src/task/native-object-flags-*.mjs) against the frozen outcomes (tools/lift-vectors/) of their
// former register-level references (proof/game-reference/object-fields.mjs): the flag word's
// get 80:CA05, set 80:CA0D, OR 80:CA15 and AND 80:CA20, and the record's byte 0 80:CA2B,
// flag byte 80:CA3A, count 80:CA49 and property 80:CA58, the flag byte's set 80:CAA2, OR
// 80:CAB4 and AND 80:CACA and the count's set 80:CAE0 (with and without the health
// cheat, src/game/cheats.mjs), and the armour word's get 80:8EF5, set 80:8AF1, sum 80:8AFA
// and difference 80:8B08, the motion getters 80:A941 to 80:A96D, the direction 80:D255,
// number 80:D1CA and sprite mode 80:D17B and 80:D16D, the task link 80:A91D and 80:A926
// and the velocity setters 80:A92F and 80:D13E, the height's raise 80:A977, the dialog
// 80:94EE, the position 80:D14A, the animation test 80:BB90 and the record property's
// group value 80:9D6A, reset 80:9D7A and test 80:9D98 and the depth mode 80:D0D3. Both
// sides run the native from
// its script call (data bank 80, direct page 0, the RTS frame). Game state only
// (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks, the device writes and the
// return (program counter and stack pointer) must be equal; the script interpreter
// replaces the registers the natives leave.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import { getObjectRecordFirstByte as getObjectRecordFirstByteLifted } from '../src/script/native-object-record-byte0.mjs';
import { getObjectRecordFlags as getObjectRecordFlagsLifted } from '../src/script/native-object-record-flags.mjs';
import { getObjectRecordCount as getObjectRecordCountLifted } from '../src/script/native-object-record-count.mjs';
import { getObjectRecordProperty as getObjectRecordPropertyLifted } from '../src/script/native-object-record-property.mjs';
import { setObjectRecordFlags as setObjectRecordFlagsLifted } from '../src/script/native-object-record-flags-set.mjs';
import { setObjectRecordFlagBits as setObjectRecordFlagBitsLifted } from '../src/script/native-object-record-flags-or.mjs';
import { keepObjectRecordFlagBits as keepObjectRecordFlagBitsLifted } from '../src/script/native-object-record-flags-and.mjs';
import { setObjectRecordCount as setObjectRecordCountLifted } from '../src/script/native-object-record-count-set.mjs';
import { getObjectArmour as getObjectArmourLifted } from '../src/script/native-object-armour-get.mjs';
import { setObjectArmour as setObjectArmourLifted } from '../src/script/native-object-armour-set.mjs';
import { addObjectArmour as addObjectArmourLifted } from '../src/script/native-object-armour-add.mjs';
import { subtractObjectArmour as subtractObjectArmourLifted } from '../src/script/native-object-armour-subtract.mjs';
import { getObjectVelocityX as getObjectVelocityXLifted } from '../src/script/native-object-velocity-x.mjs';
import { getObjectVelocityY as getObjectVelocityYLifted } from '../src/script/native-object-velocity-y.mjs';
import { getObjectVelocityZ as getObjectVelocityZLifted } from '../src/script/native-object-velocity-z.mjs';
import { getObjectCoarseX as getObjectCoarseXLifted } from '../src/script/native-object-position-x.mjs';
import { getObjectCoarseY as getObjectCoarseYLifted } from '../src/script/native-object-position-y.mjs';
import { getObjectCoarseHeight as getObjectCoarseHeightLifted } from '../src/script/native-object-height.mjs';
import { getObjectDirection as getObjectDirectionLifted } from '../src/script/native-object-direction.mjs';
import { getObjectNumber as getObjectNumberLifted } from '../src/script/native-object-number.mjs';
import { getSpriteMode as getSpriteModeLifted } from '../src/script/native-sprite-mode-get.mjs';
import { setSpriteMode as setSpriteModeLifted } from '../src/script/native-sprite-mode-set.mjs';
import { clearObjectTask as clearObjectTaskLifted } from '../src/script/native-object-task-clear.mjs';
import { bindObjectToCurrentTask as bindObjectToCurrentTaskLifted } from '../src/script/native-object-task-bind.mjs';
import { setObjectVelocity as setObjectVelocityLifted } from '../src/script/native-object-velocity-set.mjs';
import { clearObjectVelocity as clearObjectVelocityLifted } from '../src/script/native-object-velocity-clear.mjs';
import { addObjectHeight as addObjectHeightLifted } from '../src/script/native-object-height-add.mjs';
import { setObjectDialog as setObjectDialogLifted } from '../src/script/native-object-dialog-set.mjs';
import { setObjectPosition as setObjectPositionLifted } from '../src/script/native-object-position-set.mjs';
import { hasNoObjectAnimation as hasNoObjectAnimationLifted } from '../src/script/native-object-selection-empty.mjs';
import { setObjectRecordPropertyFromGroup as setObjectRecordPropertyFromGroupLifted } from '../src/script/native-object-record-property-from-group.mjs';
import { resetObjectRecordProperty as resetObjectRecordPropertyLifted } from '../src/script/native-object-record-property-reset.mjs';
import { hasObjectRecordProperty as hasObjectRecordPropertyLifted } from '../src/script/native-object-record-property-test.mjs';
import { updateObjectDepthMode as updateObjectDepthModeLifted } from '../src/script/native-sprite-mode-from-flags.mjs';
import { JAKE_STATE_RECORD } from '../src/game/cheats.mjs';
import { CHEAT } from '../src/game/cheat-settings.mjs';
import { JAKE_BODY, OBJECT_RECORD, OBJECT_SELECTION } from '../src/data/wram.mjs';
import { RECORD_ATTRIBUTE } from '../src/data/runners.mjs';
import { getObjectFlags as getObjectFlagsLifted } from '../src/script/native-object-flags-get.mjs';
import { setObjectFlags as setObjectFlagsLifted } from '../src/script/native-object-flags-set.mjs';
import { setObjectFlagBits as setObjectFlagBitsLifted } from '../src/script/native-object-flags-or.mjs';
import { keepObjectFlagBits as keepObjectFlagBitsLifted } from '../src/script/native-object-flags-and.mjs';
import { leafRts } from './register-forms/leaf-return.mjs';
// The natives with the RTS of their register-level entry (2026-11-27).
const getObjectRecordFirstByte = leafRts(getObjectRecordFirstByteLifted);
const getObjectRecordFlags = leafRts(getObjectRecordFlagsLifted);
const getObjectRecordCount = leafRts(getObjectRecordCountLifted);
const getObjectRecordProperty = leafRts(getObjectRecordPropertyLifted);
const setObjectRecordFlags = leafRts(setObjectRecordFlagsLifted);
const setObjectRecordFlagBits = leafRts(setObjectRecordFlagBitsLifted);
const keepObjectRecordFlagBits = leafRts(keepObjectRecordFlagBitsLifted);
const setObjectRecordCount = leafRts(setObjectRecordCountLifted);
const getObjectArmour = leafRts(getObjectArmourLifted);
const setObjectArmour = leafRts(setObjectArmourLifted);
const addObjectArmour = leafRts(addObjectArmourLifted);
const subtractObjectArmour = leafRts(subtractObjectArmourLifted);
const getObjectVelocityX = leafRts(getObjectVelocityXLifted);
const getObjectVelocityY = leafRts(getObjectVelocityYLifted);
const getObjectVelocityZ = leafRts(getObjectVelocityZLifted);
const getObjectCoarseX = leafRts(getObjectCoarseXLifted);
const getObjectCoarseY = leafRts(getObjectCoarseYLifted);
const getObjectCoarseHeight = leafRts(getObjectCoarseHeightLifted);
const getObjectDirection = leafRts(getObjectDirectionLifted);
const getObjectNumber = leafRts(getObjectNumberLifted);
const getSpriteMode = leafRts(getSpriteModeLifted);
const setSpriteMode = leafRts(setSpriteModeLifted);
const clearObjectTask = leafRts(clearObjectTaskLifted);
const bindObjectToCurrentTask = leafRts(bindObjectToCurrentTaskLifted);
const setObjectVelocity = leafRts(setObjectVelocityLifted);
const clearObjectVelocity = leafRts(clearObjectVelocityLifted);
const addObjectHeight = leafRts(addObjectHeightLifted);
const setObjectDialog = leafRts(setObjectDialogLifted);
const setObjectPosition = leafRts(setObjectPositionLifted);
const hasNoObjectAnimation = leafRts(hasNoObjectAnimationLifted);
const setObjectRecordPropertyFromGroup = leafRts(setObjectRecordPropertyFromGroupLifted);
const resetObjectRecordProperty = leafRts(resetObjectRecordPropertyLifted);
const hasObjectRecordProperty = leafRts(hasObjectRecordPropertyLifted);
const updateObjectDepthMode = leafRts(updateObjectDepthModeLifted);
const getObjectFlags = leafRts(getObjectFlagsLifted);
const setObjectFlags = leafRts(setObjectFlagsLifted);
const setObjectFlagBits = leafRts(setObjectFlagBitsLifted);
const keepObjectFlagBits = leafRts(keepObjectFlagBitsLifted);

useLiftVectors(import.meta.url);

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
  // Sometimes no animation selected (FFFF) where the low WRAM mirror holds the selection.
  const selection = (OBJECT_SELECTION + object) & 0xffff;
  if (selection < 0x2000 && rnd(2)) setWord(wram, selection, 0xffff);
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
const field = (name, entry, run, cheats = 0) => ({
  name,
  entry,
  samples: 400,
  prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(BYTE) & 0xc3 }),
  lifted: (h, input) => {
    h.a.vm = { cheats };
    return lifted(run)(h, input);
  },
});
registerCases(
  [
    field('getObjectFlags 80:CA05', 0x80ca05, getObjectFlags),
    field('setObjectFlags 80:CA0D', 0x80ca0d, setObjectFlags),
    field('setObjectFlagBits 80:CA15', 0x80ca15, setObjectFlagBits),
    field('keepObjectFlagBits 80:CA20', 0x80ca20, keepObjectFlagBits),
    field('getObjectRecordFirstByte 80:CA2B', 0x80ca2b, getObjectRecordFirstByte),
    field('getObjectRecordFlags 80:CA3A', 0x80ca3a, getObjectRecordFlags),
    field('getObjectRecordCount 80:CA49', 0x80ca49, getObjectRecordCount),
    field('getObjectRecordProperty 80:CA58', 0x80ca58, getObjectRecordProperty),
    field('setObjectRecordFlags 80:CAA2', 0x80caa2, setObjectRecordFlags),
    field('setObjectRecordFlagBits 80:CAB4', 0x80cab4, setObjectRecordFlagBits),
    field('keepObjectRecordFlagBits 80:CACA', 0x80caca, keepObjectRecordFlagBits),
    field('setObjectRecordCount 80:CAE0', 0x80cae0, setObjectRecordCount),
    field(
      'setObjectRecordCount 80:CAE0 with the health cheat',
      0x80cae0,
      setObjectRecordCount,
      CHEAT.health,
    ),
    field('getObjectArmour 80:8EF5', 0x808ef5, getObjectArmour),
    field('setObjectArmour 80:8AF1', 0x808af1, setObjectArmour),
    field('addObjectArmour 80:8AFA', 0x808afa, addObjectArmour),
    field('subtractObjectArmour 80:8B08', 0x808b08, subtractObjectArmour),
    field('getObjectVelocityX 80:A941', 0x80a941, getObjectVelocityX),
    field('getObjectVelocityY 80:A949', 0x80a949, getObjectVelocityY),
    field('getObjectVelocityZ 80:A951', 0x80a951, getObjectVelocityZ),
    field('getObjectCoarseX 80:A959', 0x80a959, getObjectCoarseX),
    field('getObjectCoarseY 80:A963', 0x80a963, getObjectCoarseY),
    field('getObjectCoarseHeight 80:A96D', 0x80a96d, getObjectCoarseHeight),
    field('getObjectDirection 80:D255', 0x80d255, getObjectDirection),
    field('getObjectNumber 80:D1CA', 0x80d1ca, getObjectNumber),
    field('getSpriteMode 80:D17B', 0x80d17b, getSpriteMode),
    field('setSpriteMode 80:D16D', 0x80d16d, setSpriteMode),
    field('clearObjectTask 80:A91D', 0x80a91d, clearObjectTask),
    field('bindObjectToCurrentTask 80:A926', 0x80a926, bindObjectToCurrentTask),
    field('setObjectVelocity 80:A92F', 0x80a92f, setObjectVelocity),
    field('clearObjectVelocity 80:D13E', 0x80d13e, clearObjectVelocity),
    field('addObjectHeight 80:A977', 0x80a977, addObjectHeight),
    field('setObjectDialog 80:94EE', 0x8094ee, setObjectDialog),
    field('setObjectPosition 80:D14A', 0x80d14a, setObjectPosition),
    field('hasNoObjectAnimation 80:BB90', 0x80bb90, hasNoObjectAnimation),
    field('setObjectRecordPropertyFromGroup 80:9D6A', 0x809d6a, setObjectRecordPropertyFromGroup),
    field('resetObjectRecordProperty 80:9D7A', 0x809d7a, resetObjectRecordProperty),
    field('hasObjectRecordProperty 80:9D98', 0x809d98, hasObjectRecordProperty),
    field('updateObjectDepthMode 80:D0D3', 0x80d0d3, updateObjectDepthMode),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
