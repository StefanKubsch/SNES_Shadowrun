// Register-level references of the topic list script natives (moved from
// src/script/native-topic-known.mjs, native-topic-mark.mjs and native-topic-add.mjs; lifted
// in src/game/topic-list.mjs). The proof plans, the Native58 dispatch of
// proof/task/native-dispatch.mjs and the instruction test of 80:90EB run these; the game
// runs the lifted natives.
import { taskStop } from '../../src/system/task-stop.mjs';
import { FIRST_ARGUMENT, leaf } from '../system/native-leaf-support.mjs';
import {
  DP_TOPIC_NEXT_FLAGS,
  DP_TOPIC_SHIFT_FLAGS,
  TOPIC_FLAGS,
  TOPIC_LIST,
  TOPIC_LIST_END,
  TOPIC_MARKED,
  WRAM,
} from '../../src/data/wram.mjs';
import {
  BANK_SIZE,
  BANK_WRAP,
  BYTE_BITS,
  BYTE_MASK,
  LONG_MASK,
  WORD_MASK,
} from '../../src/constants/bits.mjs';
import { FLAG_CARRY, FLAG_MEMORY_8BIT, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';
import '../system/dialog-register-helpers.mjs';

const TRUE = WORD_MASK,
  FALSE = 0,
  // A full wrap of the 16-bit list index exhausts the existing scan guard.
  TOPIC_SCAN_LIMIT = BANK_SIZE;
// Byte CMP in 8-bit A: carry when A >= right, N and Z from the difference.
export function compareTopicByte(h, right) {
  const left = h.ctx.a & BYTE_MASK;
  h.nz((left - right) & BYTE_MASK, 1);
  h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(left >= right);
}

// 80:913C: mark the topic (low byte of the first argument) in the topic list: its flag
// byte becomes FF. An unknown topic changes nothing. The topic byte is reread for each
// entry.
export const markTopicReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.ctx.status |= FLAG_MEMORY_8BIT;
      let entry = h.index('x', 0);
      while (true) {
        h.load(a.read(WRAM + TOPIC_LIST + entry, 'scan-list-BYTE'), 1);
        compareTopicByte(h, TOPIC_LIST_END);
        if (h.ctx.status & FLAG_ZERO) break;
        compareTopicByte(h, h.dp(FIRST_ARGUMENT, 1));
        if (h.ctx.status & FLAG_ZERO) {
          h.longWrite(WRAM + TOPIC_FLAGS + entry, h.load(TOPIC_MARKED, 1), 1);
          break;
        }
        entry = h.index('x', (entry + 1) & WORD_MASK);
      }
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
    },
    outerReturn,
  );
// 80:9159: return TRUE (FFFF) when the topic (low byte of the first argument) is in
// the topic list (FF ends it), else FALSE (0). INX precedes both compares; the FALSE
// store (STZ) keeps A and the CMP flags.
export const isTopicKnownReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.ctx.status |= FLAG_MEMORY_8BIT;
      let entry = h.index('x', 0);
      while (true) {
        h.load(a.read(WRAM + TOPIC_LIST + entry, 'scan-list-BYTE'), 1);
        entry = h.index('x', (entry + 1) & WORD_MASK);
        compareTopicByte(h, TOPIC_LIST_END);
        if (h.ctx.status & FLAG_ZERO) {
          h.ctx.status &= ~FLAG_MEMORY_8BIT;
          a.writeWord(FIRST_ARGUMENT, FALSE, BANK_WRAP, 'leaf-result-DP00');
          return;
        }
        compareTopicByte(h, h.dp(FIRST_ARGUMENT, 1));
        if (h.ctx.status & FLAG_ZERO) break;
      }
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
      a.writeWord(FIRST_ARGUMENT, h.load(TRUE), BANK_WRAP, 'leaf-result-DP00');
    },
    outerReturn,
  );
// 80:90EB: add the topic (low byte of the first argument) to the sorted topic list
// TOPIC_LIST (FF ends it) with its flags TOPIC_FLAGS, as one
// pass of the 908C loop: present stays, otherwise inserted with flag 0 and the rest shifted up by one
// (XBA carries the entry). A list without FF wraps X in the original; stop after 65536 entries.
export const addTopicReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h,
        byte = (address) => h.load(a.read(address & LONG_MASK, '90eb-BYTE'), 1),
        put = (address) => a.write(address & LONG_MASK, ctx.a & BYTE_MASK, '90eb-BYTE');
      const cmp = (right) => {
        const left = ctx.a & BYTE_MASK;
        h.nz((left - right) & BYTE_MASK, 1);
        ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
      };
      const xba = () => {
        ctx.a = ((ctx.a >>> BYTE_BITS) | (ctx.a << BYTE_BITS)) & WORD_MASK;
        h.nz(ctx.a & BYTE_MASK, 1);
      };
      const inx = () => h.index('x', (ctx.x + 1) & WORD_MASK);
      let n = 0;
      const guard = () => {
        if (++n > TOPIC_SCAN_LIMIT) taskStop('task_native_90eb_list_unbounded');
      };
      h.index('x', 0);
      for (;;) {
        guard();
        byte(WRAM + TOPIC_LIST + ctx.x);
        cmp(TOPIC_LIST_END);
        if (ctx.status & FLAG_ZERO) break;
        cmp(a.read(0, '90eb-DP00'));
        if (ctx.status & FLAG_ZERO) return;
        if (ctx.status & FLAG_CARRY) break;
        inx();
      }
      byte(WRAM + TOPIC_LIST + ctx.x);
      xba();
      byte(WRAM + TOPIC_FLAGS + ctx.x);
      a.write(DP_TOPIC_SHIFT_FLAGS, ctx.a & BYTE_MASK, '90eb-DP23');
      byte(0);
      put(WRAM + TOPIC_LIST + ctx.x);
      h.load(0, 1);
      put(WRAM + TOPIC_FLAGS + ctx.x);
      inx();
      for (;;) {
        guard();
        byte(WRAM + TOPIC_LIST + ctx.x);
        xba();
        put(WRAM + TOPIC_LIST + ctx.x);
        cmp(TOPIC_LIST_END);
        if (ctx.status & FLAG_ZERO) return;
        byte(WRAM + TOPIC_FLAGS + ctx.x);
        a.write(DP_TOPIC_NEXT_FLAGS, ctx.a & BYTE_MASK, '90eb-DP24');
        byte(DP_TOPIC_SHIFT_FLAGS);
        put(WRAM + TOPIC_FLAGS + ctx.x);
        byte(DP_TOPIC_NEXT_FLAGS);
        a.write(DP_TOPIC_SHIFT_FLAGS, ctx.a & BYTE_MASK, '90eb-DP23');
        inx();
      }
    },
    outerReturn,
  );
