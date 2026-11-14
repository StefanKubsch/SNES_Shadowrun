import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { compareTopicByte } from './native-topic-mark.mjs';
import { TOPIC_LIST, TOPIC_LIST_END, WRAM } from './wram.mjs';
import { WORD_MASK, BANK_WRAP } from '../constants/bits.mjs';
import { FLAG_MEMORY_8BIT, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const TRUE = WORD_MASK,
  FALSE = 0;

// 80:9159: return TRUE (FFFF) when the topic (low byte of the first argument) is in
// the topic list (FF ends it), else FALSE (0). INX precedes both compares; the FALSE
// store (STZ) keeps A and the CMP flags.
export const isTopicKnown = (a, outerReturn = true) =>
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
