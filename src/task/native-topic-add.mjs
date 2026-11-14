import { taskStop } from './plan.mjs';
import { leaf } from './native-leaf-support.mjs';
import {
  TOPIC_FLAGS,
  TOPIC_LIST,
  TOPIC_LIST_END,
  WRAM,
  DP_TOPIC_SHIFT_FLAGS,
  DP_TOPIC_NEXT_FLAGS,
} from './wram.mjs';
import { FLAG_CARRY, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { LONG_MASK, BYTE_MASK, WORD_MASK, BYTE_BITS, BANK_SIZE } from '../constants/bits.mjs';
// A full wrap of the 16-bit list index exhausts the existing scan guard.
const TOPIC_SCAN_LIMIT = BANK_SIZE;
// 80:90EB: add the topic (low byte of the first argument) to the sorted topic list
// TOPIC_LIST (FF ends it) with its flags TOPIC_FLAGS, as one
// pass of the 908C loop: present stays, otherwise inserted with flag 0 and the rest shifted up by one
// (XBA carries the entry). A list without FF wraps X in the original; stop after 65536 entries.
export const addTopic = (a, outerReturn = true) =>
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
