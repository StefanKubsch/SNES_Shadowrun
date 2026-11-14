import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { SPELL_LIST, WRAM } from './wram.mjs';
import { FLAG_CARRY, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { WORD_MASK } from '../constants/bits.mjs';

const END = 0,
  SPELL_BYTES = 2;

// 80:E1B3: add the spell (first argument) to the end of the learned spell list (words,
// 0 ends it) unless the list already holds it. The new end marker is written before
// the spell; the flags come from the last load or CMP.
export const learnSpell = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      let entry = h.index('x', 0);
      while (true) {
        const spell = h.load(h.longRead(WRAM + SPELL_LIST + entry));
        if (spell === END) {
          h.longWrite(WRAM + SPELL_LIST + SPELL_BYTES + entry, spell);
          h.longWrite(WRAM + SPELL_LIST + entry, h.load(h.dp(FIRST_ARGUMENT)));
          return;
        }
        // CMP DP00: carry when the entry >= the spell, N and Z from the difference.
        const wanted = h.dp(FIRST_ARGUMENT);
        h.nz((spell - wanted) & WORD_MASK);
        h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(spell >= wanted);
        if (h.ctx.status & FLAG_ZERO) return;
        h.index('x', (entry + 1) & WORD_MASK);
        entry = h.index('x', (entry + 2) & WORD_MASK);
      }
    },
    outerReturn,
  );
