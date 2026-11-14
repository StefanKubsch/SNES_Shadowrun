// Random per-function tests of the lifted script natives without frame waits
// (src/task/native-script-leaves.mjs) against their register-level references: the
// fight list append 80:8521 with its fight music, the panned song level 80:C461, the
// sound effect 80:C46E, the random numbers 80:C51F and 80:C560 and the movements towards
// an object or a point 80:8D7F, 80:8D3F and 80:8D4E with the hardware divider, the nuyen
// payment 80:CD20, an actor's state holder 80:CBF7 and a member facing the room's
// direction 80:BBA0 (with the animation selection 80:A985 and the turn 80:AAAF), and the
// selection 80:A985 on its own. Both sides run the native from its script call (data bank 80,
// direct page 0, the RTS frame) and must leave the same WRAM outside the scratch, the
// same device writes and the same return (program counter and stack pointer).
import { prng, DialogTestMemory } from './task-native-dialog-harness.mjs';
import { finishLeaf } from '../src/task/native-leaf-support.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { appendToFightListReference } from '../proof/game-reference/fight-list-append.mjs';
import { panSongLevelToObjectReference } from '../proof/apu-reference/sound-stereo.mjs';
import { playSoundEffect as playSoundEffectReference } from '../src/task/native-audio-compose.mjs';
import { randomBelow, randomByte } from '../src/task/native-random.mjs';
import {
  moveObjectTowardsObject as moveReference,
  jumpObjectTowardsObject as jumpReference,
  jumpObjectTowardsPoint as jumpToPointReference,
} from '../src/task/native-combat.mjs';
import { runTaskModalObserved } from '../src/task/native-modal.mjs';
import { runTaskSelectionObserved } from '../src/task/native-selection.mjs';
import { setObjectActionAndDirection } from '../src/task/native-object-turn.mjs';
import { setActionAndDirection } from '../src/game/member-facing.mjs';
import { setObjectAnimation } from '../src/task/native-object-action-apply.mjs';
import { selectAnimationRoutine } from '../src/game/object-turn.mjs';
import {
  appendToFightListNative,
  panSongLevelToObject,
  playSoundEffectNative,
  randomBelowNative,
  randomByteNative,
  moveObjectTowardsObject,
  jumpObjectTowardsObject,
  jumpObjectTowardsPoint,
  payNuyenNative,
  setActorStateHolderNative,
  faceRoomDirectionNative,
} from '../src/task/native-script-leaves.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  APU_COMMAND_TOKEN = 0x1ce4,
  APU_PAIR_PENDING = 0x1ce6,
  FIGHT_LIST_INDEX = 0x1fb0,
  GAME_OPTIONS = 0x1fd6,
  MUSIC = 0x1cde,
  CAMERA_X = 0x0cc4,
  OBJECT_X = 0x0e28,
  OBJECT_Y = 0x0e80,
  SOUND_LOADED_SET = 0x1ce0,
  SOUND_VOICE_MASK = 0x1ce2,
  NUYEN = 0x3c0d,
  ROOM = 0x2de2,
  GROUP_INDEX = 0x2de6,
  GROUP_NUMBERS = 0x2df0,
  OBJECT_NUMBER = 0x150a,
  OBJECT_KIND = 0x3f28,
  OBJECT_SELECTION = 0x1038,
  OBJECT_DIRECTION = 0x1198,
  OBJECT_FRAME_COUNT = 0x10e8,
  ROM = new DialogTestMemory(new Uint8Array(WRAM_BYTES)),
  // The sound directory pointer the game keeps at 7E:008C (from 98:FFFA, 81:F092).
  SOUND_DIRECTORY = [0, 1, 2].map((n) => ROM.read8(0x98fffa + n)),
  // Not produced by the lifted code: the sample loader's state (7E:008C-008E stays
  // compared) and the main stack.
  IGNORED = [
    [0x0089, 0x008c],
    [0x008f, 0x009a],
    [0x0100, 0x01ca],
  ];

const word = (wram, at, value) => {
  wram[at] = value & 0xff;
  wram[at + 1] = value >>> 8;
};
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    pick = (list) => list[rnd(list.length)],
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  wram.set(SOUND_DIRECTORY, 0x8c);
  wram[APU_PAIR_PENDING] = pick([0, 0, 0xff, 1]);
  wram[APU_COMMAND_TOKEN] = rnd(256);
  return { seed, wram, rnd, pick };
}
const REFERENCES = new Map([
  [0x808521, (h) => appendToFightListReference(h.a, false)],
  [0x80c461, (h) => panSongLevelToObjectReference(h.a, false)],
  [0x80c46e, (h) => playSoundEffectReference(h.a, { calls: [] }, false)],
  [0x80c51f, (h) => randomBelow(h.a, false)],
  [0x80c560, (h) => randomByte(h.a, false)],
  [0x808d7f, (h) => moveReference(h.a, false)],
  [0x808d3f, (h) => jumpReference(h.a, false)],
  [0x808d4e, (h) => jumpToPointReference(h.a, false)],
  [0x80cd20, (h) => runTaskModalObserved(h.a, {}, 0x80cd20, false)],
  [0x80cbf7, (h) => runTaskModalObserved(h.a, {}, 0x80cbf7, false)],
  [0x80bba0, (h) => runTaskSelectionObserved(h.a, {}, 0x80bba0, false)],
]);
// Two objects (0-43) at positions near each other or anywhere, for the movements.
const OBJECT_HEIGHT = 0x0ed8,
  POINT_LIST = 0x7f4000;
function twoObjects(s) {
  const object = 2 * s.rnd(44);
  word(s.wram, 0, object);
  const other = 2 * s.rnd(44);
  word(s.wram, 2, other);
  for (const field of [OBJECT_X, OBJECT_Y, OBJECT_HEIGHT]) {
    const base = s.rnd(0x1000);
    word(s.wram, field + object, base);
    word(
      s.wram,
      field + other,
      s.pick([base, base + s.rnd(0x100), base - s.rnd(0x100), s.rnd(65536)]) & 0xffff,
    );
  }
}
const side = (s) => createSide(s, REFERENCES);
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
// The lifted side starts with the reference's registers and RTS frame.
const lifted = (run) => (h, input) => {
  Object.assign(h.ctx, input);
  h.ctx.programBank = CODE_BANK;
  h.push(CALLER_RETURN, 2);
  run(h.a, false);
  return returned(h);
};
// An object near the camera (or none) for the stereo position.
function objectNearCamera(s) {
  const camera = s.rnd(0x1000);
  word(s.wram, CAMERA_X, camera);
  const object = s.pick([0xffff, 0x8000, 2 * s.rnd(44), 2 * s.rnd(44)]);
  word(s.wram, 0, object);
  if (object < 0x8000 && s.rnd(4)) {
    const x = s.rnd(0x200);
    word(s.wram, OBJECT_X + object, x);
    word(s.wram, OBJECT_Y + object, (x + camera - 0x600 + s.rnd(0x500) - 0x80) & 0xffff);
  }
}
const CASES = [
  {
    // Empty, short and long lists; music on or off; the fight music playing or not.
    name: 'appendToFightList 80:8521',
    entry: 0x808521,
    samples: 400,
    prepare: (s) => {
      word(s.wram, FIGHT_LIST_INDEX, s.pick([0xfffe, 0xfffe, 0xfffe, 0, 2, 0x10, s.rnd(0x18)]));
      word(s.wram, 0, s.rnd(65536));
      word(s.wram, GAME_OPTIONS, s.rnd(65536));
      word(s.wram, MUSIC, s.pick([6, 6, 0x0600, 4, 0x0100, 0, s.rnd(16), s.rnd(65536)]));
      return { bank: CODE_BANK, status: s.rnd(256) & 0xc3 };
    },
    result: returned,
    lifted: lifted(appendToFightListNative),
  },
  {
    name: 'panSongLevelToObject 80:C461',
    entry: 0x80c461,
    prepare: (s) => {
      objectNearCamera(s);
      word(s.wram, 2, s.rnd(65536));
      return { bank: CODE_BANK, status: s.rnd(256) & 0xc3 };
    },
    result: returned,
    lifted: lifted(panSongLevelToObject),
  },
  {
    // The 27 effects of 80:C4B3 and words beyond, cached and new sample sets and voices.
    name: 'playSoundEffect 80:C46E',
    entry: 0x80c46e,
    samples: 400,
    prepare: (s) => {
      objectNearCamera(s);
      const effect = s.pick([2 * s.rnd(27), 2 * s.rnd(27), s.rnd(0x400)]);
      word(s.wram, 2, effect);
      word(s.wram, 4, s.rnd(65536));
      const voices = s.pick([1, 3, 0xc0, 0x80, s.rnd(65535) + 1]);
      word(s.wram, 6, voices);
      if (s.rnd(2)) word(s.wram, SOUND_VOICE_MASK, voices);
      if (s.rnd(2))
        word(
          s.wram,
          SOUND_LOADED_SET,
          ROM.read8(0x80c4b3 + effect) | (ROM.read8(0x80c4b4 + effect) << 8),
        );
      return { bank: CODE_BANK, status: s.rnd(256) & 0xc3 };
    },
    result: returned,
    lifted: lifted(playSoundEffectNative),
  },
  {
    // Limits 0, 1, powers of two and their neighbours, and any word.
    name: 'randomBelow 80:C51F',
    entry: 0x80c51f,
    samples: 400,
    prepare: (s) => {
      word(
        s.wram,
        0,
        s.pick([0, 1, 2, 3, 0x7f, 0x80, 0x81, 0x8000, 0xffff, s.rnd(65536), s.rnd(64)]),
      );
      return { bank: CODE_BANK, status: s.rnd(256) & 0xc3 };
    },
    result: returned,
    lifted: lifted(randomBelowNative),
  },
  {
    // The last byte equal to the new one or not.
    name: 'randomByte 80:C560',
    entry: 0x80c560,
    prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(256) & 0xc3 }),
    result: returned,
    lifted: lifted(randomByteNative),
  },
  ...[
    ['moveObjectTowardsObject 80:8D7F', 0x808d7f, moveObjectTowardsObject],
    ['jumpObjectTowardsObject 80:8D3F', 0x808d3f, jumpObjectTowardsObject],
  ].map(([name, entry, run]) => ({
    name,
    entry,
    samples: 400,
    prepare: (s) => {
      twoObjects(s);
      word(s.wram, 4, s.rnd(65536));
      return { bank: CODE_BANK, status: s.rnd(256) & 0xc3 };
    },
    result: returned,
    lifted: lifted(run),
  })),
  {
    // Point numbers in the list and far beyond (the index wraps in 16 bits).
    name: 'jumpObjectTowardsPoint 80:8D4E',
    entry: 0x808d4e,
    samples: 400,
    prepare: (s) => {
      twoObjects(s);
      word(s.wram, 2, s.pick([0, 1, s.rnd(32), s.rnd(0x2000), s.rnd(65536)]));
      word(s.wram, 0xf3, POINT_LIST & 0xffff);
      s.wram[0xf5] = POINT_LIST >>> 16;
      return { bank: CODE_BANK, status: s.rnd(256) & 0xc3 };
    },
    result: returned,
    lifted: lifted(jumpObjectTowardsPoint),
  },
  {
    // Amounts below, at and above the low word, with a high word of 0, 1 or any.
    name: 'payNuyen 80:CD20',
    entry: 0x80cd20,
    samples: 400,
    prepare: (s) => {
      const low = s.pick([0, 1, 0x100, 0xffff, s.rnd(65536)]);
      word(s.wram, NUYEN, low);
      word(s.wram, NUYEN + 2, s.pick([0, 0, 1, s.rnd(65536)]));
      word(s.wram, 0, s.pick([0, low, (low + 1) & 0xffff, (low - 1) & 0xffff, s.rnd(65536)]));
      return { bank: CODE_BANK, status: s.rnd(256) & 0xc3 };
    },
    result: returned,
    lifted: lifted(payNuyenNative),
  },
  {
    // Actors of the table (with and without a state record) and offsets past it.
    name: 'setActorStateHolder 80:CBF7',
    entry: 0x80cbf7,
    samples: 400,
    prepare: (s) => {
      word(s.wram, 0, s.pick([7 * s.rnd(1191), 7 * s.rnd(1191), s.rnd(0x2100)]));
      word(s.wram, 2, s.rnd(65536));
      return { bank: CODE_BANK, status: s.rnd(256) & 0xc3 };
    },
    result: returned,
    lifted: lifted(setActorStateHolderNative),
  },
  {
    // Rooms of the table, a member at each group index or none; the object's kind,
    // selection, direction and frames of the game's range or any.
    name: 'faceRoomDirection 80:BBA0',
    entry: 0x80bba0,
    samples: 600,
    prepare: (s) => {
      const object = 2 * s.rnd(44),
        number = s.rnd(65536),
        members = s.rnd(5);
      word(s.wram, 0, object);
      word(s.wram, ROOM, s.rnd(16) ? s.rnd(240) : s.rnd(65536));
      word(s.wram, GROUP_INDEX, 2 * members);
      for (let n = 0; n <= members; n++) word(s.wram, GROUP_NUMBERS + 2 * n, s.rnd(65536));
      if (s.rnd(4)) word(s.wram, GROUP_NUMBERS + 2 * s.rnd(members + 1), number);
      word(s.wram, OBJECT_NUMBER + object, number);
      word(s.wram, OBJECT_KIND + object, s.rnd(16) ? s.rnd(64) : s.rnd(65536));
      word(s.wram, OBJECT_SELECTION + object, s.pick([2, 0xffff, s.rnd(16), s.rnd(65536)]));
      word(s.wram, OBJECT_DIRECTION + object, s.pick([s.rnd(8), s.rnd(8), s.rnd(65536)]));
      word(s.wram, OBJECT_FRAME_COUNT + object, s.pick([0, 0x80, s.rnd(0x80), s.rnd(65536)]));
      return { bank: CODE_BANK, status: s.rnd(256) & 0xc3 };
    },
    result: returned,
    lifted: lifted(faceRoomDirectionNative),
  },
  {
    // The animation selection on its own (the player control's JSR callee), with any
    // selection, kind and earlier selection.
    name: 'selectAnimation 80:A985',
    entry: 0x80a985,
    samples: 600,
    reference: (h) => setObjectAnimation(h.a, false),
    prepare: (s) => {
      const object = 2 * s.rnd(44);
      word(s.wram, 0, object);
      word(s.wram, 2, s.pick([2, s.rnd(16), s.rnd(16), s.rnd(65536)]));
      word(s.wram, OBJECT_KIND + object, s.rnd(16) ? s.rnd(64) : s.rnd(65536));
      word(s.wram, OBJECT_SELECTION + object, s.pick([2, 0xffff, s.rnd(16), s.rnd(65536)]));
      word(s.wram, OBJECT_DIRECTION + object, s.pick([s.rnd(8), s.rnd(8), s.rnd(65536)]));
      return { bank: CODE_BANK, status: s.rnd(256) & 0xc3 };
    },
    result: returned,
    lifted: (h, input) => {
      Object.assign(h.ctx, input);
      h.ctx.programBank = CODE_BANK;
      h.push(CALLER_RETURN, 2);
      selectAnimationRoutine(h);
      return returned(h);
    },
  },
  {
    // 80:D15C on its own with any selection (bit 15 set reaches the carry of the
    // doubling) and direction.
    name: 'setActionAndDirection 80:D15C',
    entry: 0x80d15c,
    samples: 600,
    reference: (h) => setObjectActionAndDirection(h.a, false),
    prepare: (s) => {
      const object = 2 * s.rnd(44);
      word(s.wram, 0, object);
      word(s.wram, 2, s.pick([2, s.rnd(16), 0x8000 | s.rnd(16), s.rnd(65536)]));
      word(s.wram, 4, s.pick([s.rnd(8), s.rnd(65536)]));
      word(s.wram, OBJECT_KIND + object, s.rnd(16) ? s.rnd(64) : s.rnd(65536));
      word(s.wram, OBJECT_SELECTION + object, s.pick([2, 0xffff, s.rnd(16), s.rnd(65536)]));
      word(s.wram, OBJECT_DIRECTION + object, s.pick([s.rnd(8), s.rnd(8), s.rnd(65536)]));
      word(s.wram, OBJECT_FRAME_COUNT + object, s.pick([0, 0x80, s.rnd(0x80), s.rnd(65536)]));
      return { bank: CODE_BANK, status: s.rnd(256) & 0xc3 };
    },
    result: returned,
    lifted: lifted((a, outerReturn) => {
      setActionAndDirection(a.mem, a);
      return finishLeaf(a, outerReturn);
    }),
  },
];
// A point far beyond the list lies in the unmapped register area, where the original
// reads the open bus (the pointer's bank); the lifted code stops there.
registerCases(CASES, {
  sample,
  side,
  runtime: (h) => h,
  ignored: IGNORED,
  outside: new Set(['unmapped_read']),
});
