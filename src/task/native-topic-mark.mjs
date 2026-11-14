import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { TOPIC_FLAGS, TOPIC_LIST, TOPIC_LIST_END, TOPIC_MARKED, WRAM } from './wram.mjs';
import { BYTE_MASK, WORD_MASK } from '../constants/bits.mjs';
import { FLAG_MEMORY_8BIT, FLAG_CARRY, FLAG_ZERO } from '../constants/cpu-flags.mjs';

// Byte CMP in 8-bit A: carry when A >= right, N and Z from the difference.
export function compareTopicByte(h, right) {
  const left = h.ctx.a & BYTE_MASK;
  h.nz((left - right) & BYTE_MASK, 1);
  h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(left >= right);
}

// 80:913C: mark the topic (low byte of the first argument) in the topic list: its flag
// byte becomes FF. An unknown topic changes nothing. The topic byte is reread for each
// entry.
export const markTopic = (a, outerReturn = true) =>
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
