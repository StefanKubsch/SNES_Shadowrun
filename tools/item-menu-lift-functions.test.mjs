// Random per-function tests of the lifted item submenu and item use
// (src/game/item-menu.mjs) against the register-level 80:E585 entries and 80:E4F3
// (src/task/native-status-screen.mjs). Both sides call the same stand-ins for their
// callees: the window 80:F963 (a window number), the numbered menu 80:A6AD (an item
// row, Exit, a cancel or bit 15), the item use 80:E4F3 (ending the screen or not), the
// redraw 80:FA67 and release 80:FA3E; for the item use the object 80:A835 (a slot), the
// visit 80:C1CA (the dialog's end and the portrait redraw drawn), the window list
// 81:AEB0, the portrait 80:E4B3, the key wait 80:F953, the notice release 80:FF79 and
// the equipment rows 80:E9C5. Each records its target, A, X, Y, the flags N, V, Z and C
// and the direct page words 00 and 02, and leaves registers and flags drawn from the
// sample's own sequence. WRAM outside the stack, the calls, the return and the
// registers left must be equal.
import { DialogTestMemory, prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { e4f3Sequence, e585Sequence } from '../src/task/native-status-screen.mjs';
import { itemMenuSequence, useItemSequence } from '../src/game/item-menu.mjs';
import {
  DIALOG_END,
  MEMBER_NUMBER,
  MEMBER_OBJECT,
  MEMBER_PORTRAIT_REDRAW,
  NOTICE_WINDOWS,
  STATUS_ITEMS_AT_ONCE,
  STORY_STAGE,
} from '../src/task/wram.mjs';
import { drainNativeSequence } from '../src/task/native-call-continuation.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  // Status bits a stand-in may leave: N, V, Z and C (the register widths stay 16-bit).
  LEFT_FLAGS = 0xc3,
  IGNORED = [[0x0100, 0x01ca]],
  // The actor table 8D:B01F (1191 entries of seven bytes: flags, record, kind,
  // script) and the state record's holder word (byte 3).
  ACTOR_TABLE = 0x8db01f,
  ACTORS = 1191,
  ACTOR_BYTES = 7,
  STATE_HOLDER = 3,
  TARGETS = [
    0x80f963, 0x80a6ad, 0x80e4f3, 0x80fa67, 0x80fa3e, 0x80a835, 0x80c1ca, 0x81aeb0, 0x80e4b3,
    0x80f953, 0x80ff79, 0x80e9c5,
  ];

const romMemory = new DialogTestMemory(new Uint8Array(WRAM_BYTES)),
  records = [];
for (let n = 0; n < ACTORS; n++) {
  const at = ACTOR_TABLE + n * ACTOR_BYTES + 1,
    record = romMemory.read8(at) | (romMemory.read8(at + 1) << 8);
  if (record) records.push(record);
}
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
  // The member holds some of the actors' records; the story stage lets most through.
  const member = rnd(WORD),
    share = 1 + rnd(40);
  setWord(wram, MEMBER_NUMBER, member);
  setWord(wram, MEMBER_OBJECT, rnd(0x40) * 2);
  for (const record of records) if (!rnd(share)) setWord(wram, STATE_HOLDER + record, member);
  setWord(wram, STORY_STAGE, rnd(4) ? 0xffff : rnd(WORD));
  setWord(wram, STATUS_ITEMS_AT_ONCE, rnd(3) ? 0 : rnd(WORD));
  for (let n = 0; n < 4; n++) if (rnd(2)) wram[NOTICE_WINDOWS + 2 * n + 1] |= 0x80;
  return { seed, wram, rnd, actor: rnd(ACTORS) * ACTOR_BYTES };
}

// The stand-ins of one side; both sides draw the same sequence.
function standIns(s) {
  const random = prng(s.seed ^ 0x3c3c3c3c),
    rnd = (n) => Math.floor(random() * n),
    calls = [];
  const stub = (target) => (h) => {
    const { a } = h,
      { ctx } = a,
      w = a.mem.wram;
    calls.push(
      [target, ctx.a, ctx.x, ctx.y, ctx.status & LEFT_FLAGS, word(w, 0), word(w, 2)]
        .map((v) => v.toString(HEX))
        .join(':'),
    );
    if (target === 0x80f963) setWord(w, 0, rnd(8));
    if (target === 0x80a6ad) setWord(w, 0, [1, 2, 1 + rnd(8), 0, 0xffff, 0x8000][rnd(6)]);
    if (target === 0x80a835) setWord(w, 0, rnd(0x40) * 2);
    if (target === 0x80e4f3 || target === 0x80c1ca) {
      setWord(w, DIALOG_END, rnd(3) ? 0 : rnd(WORD));
      if (rnd(2)) setWord(w, MEMBER_PORTRAIT_REDRAW, rnd(WORD));
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
  return { routines: new Map(TARGETS.map((t) => [t, stub(t)])), calls };
}
const returned = (h, calls) =>
  [h.ctx.pc, h.ctx.s, h.ctx.a, h.ctx.x, h.ctx.y, h.ctx.status & LEFT_FLAGS]
    .map((v) => v.toString(HEX))
    .join() +
  ' ' +
  calls.join(' ');
let referenceCalls, current;
const routine = (name, entry, reference, lifted, actorInX = false) => ({
  name,
  entry,
  samples: 200,
  prepare: (s) => {
    current = s;
    return {
      bank: CODE_BANK,
      a: s.rnd(WORD),
      x: actorInX ? s.actor : s.rnd(WORD),
      y: s.rnd(WORD),
      status: s.rnd(BYTE) & LEFT_FLAGS,
    };
  },
  reference: (h) => {
    const { routines, calls } = standIns(current);
    referenceCalls = calls;
    drainNativeSequence(reference(h, routines));
  },
  result: (h) => returned(h, referenceCalls),
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = CODE_BANK;
    h.push(CALLER_RETURN, 2);
    const { routines, calls } = standIns(current);
    drainNativeSequence(lifted(h, routines));
    return returned(h, calls);
  },
});
registerCases(
  [
    ...[0x80e572, 0x80e577, 0x80e57f].map((entry) =>
      routine(
        `itemMenu ${entry.toString(HEX).toUpperCase().replace(/^80/, '80:')}`,
        entry,
        (h, routines) => e585Sequence(h, null, routines, entry),
        (h, routines) => itemMenuSequence(h, null, routines, entry),
      ),
    ),
    routine(
      'useItem 80:E4F3',
      0x80e4f3,
      (h, routines) => e4f3Sequence(h, null, routines),
      (h, routines) => useItemSequence(h, null, routines),
      true,
    ),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
