import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { STORY_STAGE, WRAM } from './wram.mjs';
import { WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_CARRY } from '../constants/cpu-flags.mjs';

// 80:CCA4: raise the story stage to stage n (first argument, 1 to 16): the stage word is
// the bit 2^(n-1), formed by n ROL A from 0 after one SEC (each later ROL shifts in the
// old bit 15). The word is stored only when it is not below the current stage (CMP,
// BCC); the flags come from that CMP.
export const raiseStoryStage = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.index('x', h.dp(FIRST_ARGUMENT));
      h.load(0);
      h.ctx.status |= FLAG_CARRY;
      do {
        a.tick();
        const carry = h.ctx.status & FLAG_CARRY,
          nextCarry = Number(h.ctx.a >= WORD_SIGN);
        h.load((h.ctx.a * 2 + carry) & WORD_MASK);
        h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | nextCarry;
        h.index('x', (h.ctx.x - 1) & WORD_MASK);
      } while (h.ctx.x !== 0);
      const stage = h.ctx.a,
        current = h.longRead(WRAM + STORY_STAGE);
      h.nz((stage - current) & WORD_MASK);
      h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(stage >= current);
      if (stage >= current) h.longWrite(WRAM + STORY_STAGE, stage);
    },
    outerReturn,
  );
