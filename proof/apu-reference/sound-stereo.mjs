// Register-level reference of the panned song level 80:C461 (moved from
// src/task/native-sound-stereo.mjs; lifted in src/task/native-script-leaves.mjs with
// soundLevels of src/apu/sound-effect.mjs).
import { taskStop } from '../../src/task/plan.mjs';
import { SECOND_ARGUMENT, leaf } from '../../src/task/native-leaf-support.mjs';
import { computeSoundPan, sendApuCommand } from '../../src/task/native-input-apu.mjs';
import { WORD_MASK } from '../../src/constants/bits.mjs';
import { CODE_BANK } from '../../src/constants/memory-map.mjs';
import { APU_COMMAND_SONG_LEVEL } from '../../src/constants/sound-commands.mjs';
const APU_CODE_BANK = 0x81;
// 80:C461: set the song level (second argument) panned to the screen position of the
// object (first argument): LDA DP02, JSR 80:C416 (left and right levels from A and the
// object position), LDA #$0D, JSL 81:F007 (APU command 0D), RTS. Both routines have
// their own proofs; the APU handshake reads are device observations as in C46E.
const NATIVE_C461_ROUTINES = Object.freeze({
  pan: (a) => computeSoundPan(a, false),
  apu: (a) => sendApuCommand(a, false),
});
export const panSongLevelToObjectReference = (
  a,
  outerReturn = true,
  routines = NATIVE_C461_ROUTINES,
) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h,
        check = (result, raw, bank) => {
          if (result.rawReturnWord !== raw || ctx.programBank !== bank)
            taskStop('task_native_helper_return_required', {
              actual: result.rawReturnWord,
              expected: raw,
              bank: ctx.programBank,
            });
        };
      h.load(h.dp(SECOND_ARGUMENT));
      a.pushWord(0x80c465 & WORD_MASK, 'c461-JSR');
      check(routines.pan(a), 0x80c465 & WORD_MASK, CODE_BANK);
      h.load(APU_COMMAND_SONG_LEVEL);
      a.write(ctx.s, ctx.programBank, 'c461-JSL-bank');
      ctx.s = (ctx.s - 1) & WORD_MASK;
      a.pushWord(0x80c46c & WORD_MASK, 'c461-JSL');
      ctx.programBank = APU_CODE_BANK;
      check(routines.apu(a), 0x80c46c & WORD_MASK, CODE_BANK);
    },
    outerReturn,
  );
