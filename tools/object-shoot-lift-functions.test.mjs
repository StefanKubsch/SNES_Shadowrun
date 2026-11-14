// Random per-function tests of the lifted shooting natives (src/game/object-shoot.mjs)
// against the register-level natives (src/task/native-object-shoot.mjs). Both sides run
// their real callees (the line of sight 81:A25F over a cell list with boxes on the
// shot's line, the random number 80:C51F, the object slot 80:A835 with its task append
// on a free heap block, the turn 80:AAAF and the sound 80:C46E) but the hit 80:8691, a
// stand-in that records its inputs (A the damage, X the target, Y the shooter:
// calleeRecord) and leaves a result in DP B4. Game
// state only (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks, the line of
// sight's direct page working bytes (user decision 2026-11-13) and the sample loader's
// scratch, the device writes, the hit calls and the return must be equal; the
// registers the natives leave are not compared (the script interpreter replaces them).
import { DialogTestMemory, prng } from './task-native-dialog-harness.mjs';
import { calleeRecord, createSide, registerCases } from './lift-function-harness.mjs';
import {
  NATIVE_8AB5_ROUTINES,
  shootAtGloveTarget,
  shootAtObject,
  shootWithOwnWeapon,
} from '../src/task/native-object-shoot.mjs';
import {
  shootAtGloveTargetSequence,
  shootAtObjectSequence,
  shootWithOwnWeaponSequence,
} from '../src/game/object-shoot.mjs';
import {
  DRAW_LIST_INDEX,
  OBJECT_ACTION_DIRECTIONS,
  OBJECT_FRAME_COUNT,
  OBJECT_SELECTION,
  OBJECT_BOX_HEIGHT,
  OBJECT_HEIGHT,
  OBJECT_NUMBER,
  OBJECT_X,
  OBJECT_Y,
  RUNNER_WEAPON_KIND,
  RUNNER_WEAPON_RANGE,
} from '../src/task/wram.mjs';
import {
  HEAP_NEXT_WORD,
  HEAP_SIZE_WORD,
  TASK_FREE_LIST,
  TASK_LIST_HEAD,
  TASK_NEXT,
} from '../src/vm/layout.mjs';
import { drainNativeSequence } from '../src/task/native-call-continuation.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  GLOVE_TARGET_TAG = 0x01da,
  GLOVE_TARGET_OBJECT = 0x01de,
  PLAYER_OBJECT = 0x0cc2,
  DP_HIT_RESULT = 0xb4,
  // The weapon owners' list 80:9700 (13 words) and the weapon entries' size.
  WEAPON_OWNERS = 0x809700,
  OWNERS = 13,
  WEAPON_ENTRY = 4,
  // The cell list of the line of sight in bank 7F and its box records.
  CELL_LIST = 0x7f4000,
  BOX_RECORD = 12,
  // One free heap block for the miss marker's task frame and the task slots.
  HEAP_BLOCK = 0x200,
  TASK_SLOTS = 0x20,
  // The draw list holds up to 44 objects.
  DRAW_LIST_OBJECTS = 43,
  // Not produced by the lifted code: the line of sight's direct page working bytes, the
  // sample loader's scratch and the main stack.
  IGNORED = [
    [0x000e, 0x006d],
    [0x0089, 0x008c],
    [0x008f, 0x009a],
    [0x0100, 0x01ca],
  ];
const HIT = 0x808691;

const romMemory = new DialogTestMemory(new Uint8Array(WRAM_BYTES)),
  owners = Array.from({ length: OWNERS }, (_, n) => romMemory.read16(WEAPON_OWNERS + 2 * n));
const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
const word = (w, at) => w[at] | (w[at + 1] << 8);

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  const slot = () => rnd(0x40) * 2,
    shooter = slot(),
    // The player figure shoots for 80:8A51; mostly the same object.
    player = rnd(4) ? shooter : slot(),
    target = slot();
  setWord(wram, 0, shooter);
  // The target, sometimes none.
  setWord(wram, 2, rnd(8) ? target : 0x8000 | rnd(WORD));
  setWord(wram, PLAYER_OBJECT, player);
  setWord(wram, GLOVE_TARGET_TAG, rnd(6) ? rnd(0x8000) : 0x8000 | rnd(WORD));
  setWord(wram, GLOVE_TARGET_OBJECT, rnd(8) ? target : 0x8000 | rnd(WORD));
  // The shooters own a listed weapon, rarely none (the search does not end).
  for (const object of [shooter, player])
    setWord(wram, OBJECT_NUMBER + object, rnd(40) ? owners[rnd(OWNERS)] : rnd(WORD));
  // The weapon kinds and the shot's kind mostly 0 to 7.
  for (let n = 0; n < OWNERS; n++) if (rnd(8)) wram[RUNNER_WEAPON_KIND + WEAPON_ENTRY * n] = rnd(8);
  if (rnd(8)) setWord(wram, 6, rnd(8));
  // Mostly small bonuses and range penalties, where the roll's borrows decide the hit.
  if (rnd(4)) setWord(wram, 4, rnd(8));
  if (rnd(4)) setWord(wram, 0x0a, (rnd(8) - 4) & 0xffff);
  for (let n = 0; n < OWNERS; n++)
    if (rnd(4)) wram[RUNNER_WEAPON_RANGE + WEAPON_ENTRY * n] = (rnd(8) - 4) & 0xff;
  // About half of the targets within reach of the shooter on each axis.
  if (rnd(3))
    for (const [offset, spread] of [
      [OBJECT_X, 0x90],
      [OBJECT_Y, 0x90],
      [OBJECT_HEIGHT, 0x90],
    ]) {
      const value = (word(wram, offset + shooter) + rnd(spread) - spread / 2) & 0xffff;
      setWord(wram, offset + target, value);
    }
  // Box heights that let lines pass over some boxes.
  for (const object of [shooter, player, target])
    setWord(wram, OBJECT_BOX_HEIGHT + object, rnd(0x100));
  // The cell list: boxes on the line between the shooter and the target (box units),
  // some elsewhere, with heights that block, mark a low box or let the line pass.
  setWord(wram, 0xfc, CELL_LIST & 0xffff);
  wram[0xfe] = CELL_LIST >>> 16;
  const list = CELL_LIST - 0x7e0000,
    count = [0, 1, 2, 3, 6][rnd(5)],
    at = (object, offset) => word(wram, offset + object) / 4;
  wram[list] = count;
  for (let n = 0; n < count; n++) {
    const t = random(),
      along = (offset) => at(shooter, offset) + (at(target, offset) - at(shooter, offset)) * t,
      cx = rnd(5) ? along(OBJECT_X) : rnd(0x4000),
      cy = rnd(5) ? along(OBJECT_Y) : rnd(0x4000),
      size = () => rnd([4, 16, 64, 256][rnd(4)]) + 1,
      w = size(),
      h = size(),
      box = list + 1 + n * BOX_RECORD,
      clamp = (v) => Math.max(0, Math.min(0xffff, Math.round(v)));
    setWord(wram, box, clamp(cx - w));
    setWord(wram, box + 2, clamp(cy - h));
    setWord(wram, box + 4, rnd(WORD));
    setWord(wram, box + 6, clamp(cx + w));
    setWord(wram, box + 8, clamp(cy + h));
    setWord(wram, box + 10, rnd(0x200));
  }
  // The shooters turn with their direction table in ROM (a pointer into the low WRAM
  // mirror would read the line of sight's working bytes), or have no selection to repeat.
  for (const object of [shooter, player])
    if (rnd(4)) {
      setWord(wram, OBJECT_FRAME_COUNT + object, 1 + rnd(0x7f));
      setWord(wram, OBJECT_ACTION_DIRECTIONS + object, 0x8000 | rnd(0x8000));
    } else {
      setWord(wram, OBJECT_FRAME_COUNT + object, 0);
      setWord(wram, OBJECT_SELECTION + object, 0xffff);
    }
  // The draw list's last index, a free heap block and free task slots for the miss
  // marker.
  setWord(wram, DRAW_LIST_INDEX, 2 * rnd(DRAW_LIST_OBJECTS));
  setWord(wram, HEAP_SIZE_WORD, HEAP_BLOCK);
  setWord(wram, HEAP_NEXT_WORD, 0);
  const free = 2 * rnd(TASK_SLOTS / 2),
    head = 2 * rnd(TASK_SLOTS / 2);
  setWord(wram, TASK_FREE_LIST, free);
  setWord(wram, TASK_NEXT + free, 0xffff);
  setWord(wram, TASK_LIST_HEAD, head === free ? 0xffff : head);
  return { seed, wram, rnd };
}

// The hit's stand-in of one side; both sides draw the same results.
function hitStandIn(s) {
  const random = prng(s.seed ^ 0x3c3c3c3c),
    calls = [];
  const hit = (a) => {
    calls.push(calleeRecord(HIT, { a }, { registers: ['a', 'x', 'y'] }));
    setWord(a.mem.wram, DP_HIT_RESULT, [0, 1, 0xffff][Math.floor(random() * 3)]);
    const rawReturnWord = a.pullWord();
    a.ctx.pc = (rawReturnWord + 1) & 0xffff;
    return { rawReturnWord };
  };
  return { hit, calls };
}
const returned = (h, calls) => [h.ctx.pc.toString(HEX), h.ctx.s.toString(HEX), ...calls].join(' ');
let referenceCalls, current;
const shot = (name, entry, reference, lifted) => ({
  name,
  entry,
  samples: 400,
  prepare: (s) => {
    current = s;
    return { bank: CODE_BANK, a: s.rnd(WORD), x: s.rnd(WORD), y: s.rnd(WORD) };
  },
  reference: (h) => {
    const { hit, calls } = hitStandIn(current);
    referenceCalls = calls;
    reference(h.a, { calls: [] }, false, { ...NATIVE_8AB5_ROUTINES, hit });
  },
  result: (h) => returned(h, referenceCalls),
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = CODE_BANK;
    h.push(CALLER_RETURN, 2);
    const { hit, calls } = hitStandIn(current);
    drainNativeSequence(lifted(h, null, new Map([[HIT, (call) => hit(call.a)]])));
    return returned(h, calls);
  },
});
registerCases(
  [
    shot('shootAtObject 80:8AB5', 0x808ab5, shootAtObject, shootAtObjectSequence),
    shot('shootAtGloveTarget 80:8A51', 0x808a51, shootAtGloveTarget, shootAtGloveTargetSequence),
    shot('shootWithOwnWeapon 80:8A8C', 0x808a8c, shootWithOwnWeapon, shootWithOwnWeaponSequence),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
