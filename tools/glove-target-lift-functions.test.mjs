// Random per-function tests of the lifted glove choices (src/game/glove-target.mjs)
// against the register-level natives (src/task/native-glove-target.mjs). Both sides call
// the same stand-ins for their callees: the word wait 81:B0A1 (JSL), the pad word
// 80:9E1A, the glove movement 80:BE6D, the glove release 80:BCB2 and the others of the
// case. Each records its target, A, X, Y and the direct page words 00 and 02, and
// leaves registers and flags from the sample's own sequence; the pad word sets newly
// pressed buttons (a choosing one after a few frames) and the glove movement an object
// under the glove or none. WRAM outside the stack, the calls, the return and the
// registers left must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import {
  chooseObjectUnderGlove,
  chooseObjectNumberWithGlove,
  choosePlaceWithGlove,
  scriptChooseObjectNumberWithGlove,
  scriptChooseObjectWithGlove,
  targetWithSpellGlove,
} from '../src/task/native-glove-target.mjs';
import {
  chooseObjectUnderGloveSequence,
  chooseObjectNumberSequence,
  choosePlaceWithGloveSequence,
  scriptChooseObjectNumberSequence,
  scriptChooseObjectSequence,
  spellGloveTargetSequence,
} from '../src/game/glove-target.mjs';
import {
  MEMBER_MENU_ACTIVE,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_X,
  OBJECT_Y,
} from '../src/task/wram.mjs';
import { drainNativeSequence } from '../src/task/native-call-continuation.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  PAD_PRESSED = 0x01ce,
  GLOVE_TARGET_TAG = 0x01da,
  GLOVE_TARGET_OBJECT = 0x01de,
  PLAYER_OBJECT = 0x0cc2,
  // A, B, X and Y among the pad bits.
  CHOICE_BUTTONS = 0xc0c0,
  // Status bits a stand-in may leave: N, V, Z and C (the register widths stay 16-bit).
  LEFT_FLAGS = 0xc3,
  IGNORED = [[0x0100, 0x01ca]];
const FRAME_WAIT = 0x81b0a1,
  PAD_WORD = 0x809e1a,
  MOVE_GLOVE = 0x80be6d,
  PUT_AWAY = 0x80bcb2,
  SHOW_NOTICE = 0x80fec1,
  DRAW_LIST = 0x81ad92,
  CLOSE_DIALOG = 0x8092c5,
  UNPACK_MAP = 0x81a9b2,
  REQUEST_UPLOAD = 0x81acb5;

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  // Mostly a slot of the game's object list, sometimes any word.
  const player = rnd(4) ? rnd(0x40) * 2 : rnd(WORD);
  wram[PLAYER_OBJECT] = player & 0xff;
  wram[PLAYER_OBJECT + 1] = player >>> 8;
  // The object under the glove: about half of the samples near the player figure on
  // each axis (the reach limits 81 lie inside the drawn distances).
  const target = rnd(0x40) * 2,
    field = (at) => wram[at] | (wram[at + 1] << 8);
  if (rnd(2))
    for (const [offset, spread] of [
      [OBJECT_X, 0x60],
      [OBJECT_Y, 0x60],
      [OBJECT_HEIGHT, 0x120],
    ]) {
      const value = (field(offset + player) + rnd(spread) - spread / 2) & 0xffff;
      wram[offset + target] = value & 0xff;
      wram[offset + target + 1] = value >>> 8;
    }
  // A member menu open or not.
  if (rnd(2)) wram[MEMBER_MENU_ACTIVE] = wram[MEMBER_MENU_ACTIVE + 1] = 0;
  return { seed, wram, rnd, frames: 1 + rnd(4), target };
}

// The stand-ins of one side; both sides draw the same sequence.
function standIns(s) {
  const random = prng(s.seed ^ 0x3c3c3c3c),
    rnd = (n) => Math.floor(random() * n),
    calls = [];
  let frame = 0;
  const word = (w, at) => w[at] | (w[at + 1] << 8);
  const setWord = (w, at, v) => {
    w[at] = v & 0xff;
    w[at + 1] = (v >>> 8) & 0xff;
  };
  const stub = (target) => (h) => {
    const { a } = h,
      { ctx } = a,
      w = a.mem.wram;
    calls.push(
      [target, ctx.a, ctx.x, ctx.y, ctx.status & LEFT_FLAGS, word(w, 0), word(w, 2)]
        .map((v) => v.toString(HEX))
        .join(':'),
    );
    if (target === PAD_WORD) {
      frame++;
      const other = rnd(WORD) & ~CHOICE_BUTTONS;
      setWord(
        w,
        PAD_PRESSED,
        frame >= s.frames ? other | (CHOICE_BUTTONS & (1 + rnd(WORD))) : other,
      );
      if (frame >= s.frames && !(word(w, PAD_PRESSED) & CHOICE_BUTTONS))
        setWord(w, PAD_PRESSED, other | 0x0080);
    }
    if (target === MOVE_GLOVE) {
      setWord(w, GLOVE_TARGET_TAG, rnd(WORD));
      setWord(w, GLOVE_TARGET_OBJECT, s.target);
      // The spell glove takes the object only with bit 15 of its flags.
      setWord(w, OBJECT_FLAGS + s.target, rnd(WORD));
    }
    ctx.a = rnd(WORD);
    ctx.x = rnd(WORD);
    ctx.y = rnd(WORD);
    ctx.status = (ctx.status & ~LEFT_FLAGS) | (rnd(BYTE) & LEFT_FLAGS);
    const rawReturnWord = a.pullWord();
    if (target >>> 16 === 0x81) {
      ctx.s = (ctx.s + 1) & 0xffff;
      ctx.programBank = a.read(ctx.s);
    }
    ctx.pc = (rawReturnWord + 1) & 0xffff;
    return { rawReturnWord };
  };
  const routines = new Map(
    [
      FRAME_WAIT,
      PAD_WORD,
      MOVE_GLOVE,
      PUT_AWAY,
      SHOW_NOTICE,
      DRAW_LIST,
      CLOSE_DIALOG,
      UNPACK_MAP,
      REQUEST_UPLOAD,
    ].map((t) => [t, stub(t)]),
  );
  return { routines, calls };
}
const returned = (h, calls) =>
  [h.ctx.pc, h.ctx.s, h.ctx.a, h.ctx.x, h.ctx.y, h.ctx.status & LEFT_FLAGS]
    .map((v) => v.toString(HEX))
    .join() +
  ' ' +
  calls.join(' ');
const prepare = (s) => ({
  bank: CODE_BANK,
  a: s.rnd(WORD),
  x: s.rnd(WORD),
  y: s.rnd(WORD),
  status: s.rnd(BYTE) & LEFT_FLAGS,
});
let referenceCalls, current;
const choice = (name, entry, reference, lifted) => ({
  name,
  entry,
  samples: 300,
  prepare: (s) => {
    current = s;
    return prepare(s);
  },
  reference: (h) => {
    const { routines, calls } = standIns(current);
    referenceCalls = calls;
    reference(h.a, null, false, routines);
  },
  result: (h) => returned(h, referenceCalls),
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = CODE_BANK;
    h.push(CALLER_RETURN, 2);
    const { routines, calls } = standIns(current);
    drainNativeSequence(lifted(h, null, routines));
    return returned(h, calls);
  },
});
registerCases(
  [
    choice(
      'chooseObjectUnderGlove 80:8D0B',
      0x808d0b,
      chooseObjectUnderGlove,
      chooseObjectUnderGloveSequence,
    ),
    choice(
      'chooseObjectNumberWithGlove 80:9BC6',
      0x809bc6,
      chooseObjectNumberWithGlove,
      chooseObjectNumberSequence,
    ),
    choice(
      'scriptChooseObjectNumberWithGlove 80:9BB9',
      0x809bb9,
      scriptChooseObjectNumberWithGlove,
      scriptChooseObjectNumberSequence,
    ),
    choice(
      'scriptChooseObjectWithGlove 80:9C33',
      0x809c33,
      scriptChooseObjectWithGlove,
      scriptChooseObjectSequence,
    ),
    choice(
      'targetWithSpellGlove 80:9BD3',
      0x809bd3,
      targetWithSpellGlove,
      spellGloveTargetSequence,
    ),
    choice(
      'choosePlaceWithGlove 80:C724',
      0x80c724,
      choosePlaceWithGlove,
      choosePlaceWithGloveSequence,
    ),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
