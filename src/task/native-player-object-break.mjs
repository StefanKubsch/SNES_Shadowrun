import { taskStop } from './plan.mjs';
import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { PLAYER_OBJECT } from './wram.mjs';
import { WORD_MASK, BANK_WRAP, BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';
import { FLAG_DECIMAL, FLAG_IRQ_DISABLE } from '../constants/cpu-flags.mjs';
// 80:D186: return the player object (0CC2) after a BRK: LDA $00, then BRK #$00. The
// native BRK vector 00:FFE6 points to 00:F2B3, a plain RTI: BRK pushes PB, the PC behind
// the signature byte ($D18A) and P (four bytes below S stay in WRAM), sets I and clears
// D; RTI takes P, PC and PB back. Then the D18A body: DP00 = $0CC2.
const BRK_RETURN_HIGH = (0x80d18a >>> BYTE_BITS) & BYTE_MASK,
  BRK_RETURN_LOW = 0x80d18a & BYTE_MASK,
  INTERRUPT_FRAME_BYTES = 4;
export const getPlayerObjectAfterBreak = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h;
      h.load(h.dp(FIRST_ARGUMENT));
      if (ctx.programBank !== CODE_BANK) taskStop('task_native_d186_bank_required');
      const pushed = [CODE_BANK, BRK_RETURN_HIGH, BRK_RETURN_LOW, ctx.status];
      for (const value of pushed) {
        a.write(ctx.s, value, 'd186-BRK-push');
        ctx.s = (ctx.s - 1) & WORD_MASK;
      }
      const status = ctx.status;
      ctx.status = (status | FLAG_IRQ_DISABLE) & ~FLAG_DECIMAL;
      // 00:F2B3 RTI (native mode): P, PCL, PCH, PB.
      const pulled = [];
      for (let n = 0; n < INTERRUPT_FRAME_BYTES; n++) {
        ctx.s = (ctx.s + 1) & WORD_MASK;
        pulled.push(a.read(ctx.s, 'd186-RTI-pull'));
      }
      const [pulledStatus, pulledLow, pulledHigh, pulledBank] = pulled;
      ctx.status = pulledStatus;
      if (
        pulledLow !== BRK_RETURN_LOW ||
        pulledHigh !== BRK_RETURN_HIGH ||
        pulledBank !== CODE_BANK
      )
        taskStop('task_native_d186_interrupt_frame_required', { pulled });
      h.load(h.longRead(h.abs(PLAYER_OBJECT)));
      a.writeWord(FIRST_ARGUMENT, ctx.a, BANK_WRAP, 'd186-DP00');
    },
    outerReturn,
  );
