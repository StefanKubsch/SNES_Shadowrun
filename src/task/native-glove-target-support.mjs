import { taskStop } from './plan.mjs';
import { drainNativeSequence, dialogCallSequence } from './native-call-continuation.mjs';
import { TALK_ROUTINES } from './native-dialog.mjs';
import { showNoticeAdapter } from './native-notice.mjs';
import { printTextAdapter } from './native-text-compose.mjs';
import { readTextBit } from './native-text-prerequisites.mjs';
import { requestTextMapUpload } from './native-render-compose.mjs';
import { runDrawWindowList } from '../game/window-list.mjs';
import { unpackWindowMap } from './native-render-unpack.mjs';
import { clc } from './status-flags.mjs';
import { languageTextWidth } from '../data/language.mjs';
import { portTextAddress } from '../data/port-extension.mjs';
import {
  TEXT_POINTER_BANK_SEED,
  HUFFMAN_CHARACTER_PAIR_MASK,
  HUFFMAN_TEXT_END,
} from './native-text-compose.mjs';
import {
  TEXT_WORK_WORD,
  TEXT_SOURCE_POINTER,
  TEXT_SOURCE_BANK_WORD,
  TEXT_SOURCE_BANK,
  TEXT_CHARACTER_INDEX,
  TEXT_BITS_REMAINING,
} from './wram.mjs';
import { WORD_MASK, HIGH_BYTE_MASK, WORD_SIGN, WORD_BITS } from '../constants/bits.mjs';

// DP BA: the text width FADD sums and returns.
const DP_TEXT_WIDTH = TEXT_WORK_WORD;
import { FLAG_NEGATIVE, FLAG_MEMORY_8BIT, FLAG_CARRY, FLAG_ZERO } from '../constants/cpu-flags.mjs';

// 80:9BC6 (chooseObjectNumberWithGlove): choose a target with the action glove. 9C40 puts the glove over the player figure (BC67)
// and runs every frame (B0A1) with input 9E1A and glove movement BE6D until A, B, X or Y is newly
// pressed. Without an object under the glove ($01DA negative) or at too large a distance from the player
// figure (notice FEC1) the result is FFFF, otherwise slot $01DE; 9BC6 turns it into the object number
// $150A+slot in DP00. Called routines by target address; each has its own comparison with the original
// instructions. Tests may replace them. A routine receives (h, events) and ends with the original RTS/RTL.
export const GLOVE_ROUTINES = new Map([
  ...[0x81b0a1, 0x809e1a, 0x80f963, 0x80fa3e, 0x8092c5].map((target) => [
    target,
    TALK_ROUTINES.get(target),
  ]),
  [0x81a9b2, (h) => unpackWindowMap(h.a, false)],
  [0x81acb5, (h, e) => requestTextMapUpload(h.a, e, false)],
  [0x80bcb2, TALK_ROUTINES.get(0x80bcb2)],
  [0x80fec1, showNoticeAdapter],
  [0x80fe69, printTextAdapter],
  [0x81ad92, runDrawWindowList],
  [0x81af04, (h) => readTextBit(h.a, false)],
]);
// A table callee; its registered continuation is chosen by target and function identity.
export function routineCall(routines, events, h, pc, target, long = false) {
  if (!routines.get(target)) taskStop('task_9bc6_routine_open', { pc, target });
  return dialogCallSequence(h, events, routines, pc, target, long);
}
export const routine = (routines, events, h, pc, target, long = false) =>
  drainNativeSequence(routineCall(routines, events, h, pc, target, long));
export function* rts(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
// Absolute value after SBC: BPL, otherwise EOR #$FFFF and INC A.
export const absolute = (h) => {
  if (h.ctx.status & FLAG_NEGATIVE) {
    h.load(h.ctx.a ^ WORD_MASK);
    h.load(h.ctx.a + 1);
  }
};
// 80:FADD: width of text DP00 in pixels. Pointer [CF] to 9D/9E:8000|DP00, bit stream via AF04 through the
// tree 9D:8000; each character (up to $0A or word end 0) adds its width from 81:AC0C to $BA (FB2A).
export function measureTextWidth(h, events, routines = GLOVE_ROUTINES) {
  const { ctx } = h;
  const width = (pc) =>
    h.call(pc, 0x80fb2a, () => {
      h.index('x', ctx.a);
      clc(h);
      h.load(h.read(0x81ac0c + ctx.x, 1));
      h.rep(FLAG_MEMORY_8BIT);
      h.adc(h.dp(DP_TEXT_WIDTH));
      h.dpWrite(DP_TEXT_WIDTH, ctx.a);
      h.sep(FLAG_MEMORY_8BIT);
      return h.rts();
    });
  const textId = h.dp(0);
  h.load(TEXT_POINTER_BANK_SEED);
  h.dpWrite(TEXT_SOURCE_BANK_WORD, ctx.a);
  h.load(h.dp(0));
  if (ctx.status & FLAG_NEGATIVE) h.modify(TEXT_SOURCE_BANK_WORD, 'inc', true);
  h.load(ctx.a | WORD_SIGN);
  h.dpWrite(TEXT_SOURCE_POINTER, ctx.a);
  const port = portTextAddress(h.a?.mem, textId);
  if (port !== null) {
    h.dpWrite(TEXT_SOURCE_POINTER, port & WORD_MASK, 2);
    h.dpWrite(TEXT_SOURCE_BANK, port >>> WORD_BITS, 1);
  }
  h.dpWrite(DP_TEXT_WIDTH, 0);
  h.write(h.abs(TEXT_BITS_REMAINING), 0);
  for (;;) {
    h.rep(FLAG_MEMORY_8BIT);
    h.load(0);
    do {
      h.index('x', ctx.a);
      routine(routines, events, h, 0x80faf8, 0x81af04, true);
      if (ctx.status & FLAG_CARRY) {
        h.index('x', ctx.x + 1);
        h.index('x', ctx.x + 1);
      }
      h.load(h.read(0x9d8000 + ctx.x));
    } while (!(ctx.status & FLAG_NEGATIVE));
    h.load(ctx.a & HUFFMAN_CHARACTER_PAIR_MASK);
    h.dpWrite(TEXT_CHARACTER_INDEX, ctx.a);
    h.load(ctx.a & HIGH_BYTE_MASK);
    h.xba();
    h.sep(FLAG_MEMORY_8BIT);
    h.cmp(HUFFMAN_TEXT_END);
    if (ctx.status & FLAG_ZERO) break;
    width(0x80fb15);
    h.load(h.dp(TEXT_CHARACTER_INDEX));
    if (ctx.status & FLAG_ZERO) continue;
    h.cmp(HUFFMAN_TEXT_END);
    if (ctx.status & FLAG_ZERO) break;
    width(0x80fb20);
  }
  h.rep(FLAG_MEMORY_8BIT);
  // Text language (src/data/language.mjs): the width of the translated name.
  const translated = languageTextWidth(h.a?.mem, textId);
  if (translated !== null) h.dpWrite(DP_TEXT_WIDTH, translated);
  h.load(h.dp(DP_TEXT_WIDTH));
  return h.rts();
}
