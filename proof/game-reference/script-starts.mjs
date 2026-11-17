// Register-level references of the script natives 80:8EDA (the selected spell's task),
// 80:D067 (a runner's Strength) and 80:D186 (the player object after a BRK), moved from
// src/script/native-task-append-from-list.mjs, native-runner-record-byte.mjs and
// native-player-object-break.mjs; lifted in src/game/spell-start.mjs,
// src/game/runner-state.mjs and src/game/script-queries.mjs. The proof plans, the
// Native58 dispatch of proof/task/native-dispatch.mjs and the instruction tests run these;
// the game runs the lifted natives.
import { taskStop } from '../../src/system/task-stop.mjs';
import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from '../../src/system/native-leaf-support.mjs';
import { taskSelectionSupport } from '../script/native-object-turn.mjs';
import { appendScriptTask } from '../../src/system/task-append.mjs';
import {
  DP_SELECTION_POINTER,
  DP_SELECTION_POINTER_BANK,
  OBJECT_NUMBER,
  PLAYER_OBJECT,
  SELECTED_SPELL_LEVEL_POINTER,
  SELECTED_SPELL_SCRIPT,
  WRAM,
} from '../../src/data/wram.mjs';
import {
  RUNNER_LAST_INDEX,
  RUNNER_OBJECT_NUMBERS,
  RUNNER_RECORD_POINTERS,
  RUNNER_RECORD_BANKS,
} from '../../src/data/runners.mjs';
import {
  BANK_WRAP,
  BYTE_BITS,
  BYTE_MASK,
  LONG_MASK,
  WORD_MASK,
} from '../../src/constants/bits.mjs';
import { CODE_BANK, WRAM_BANK } from '../../src/constants/memory-map.mjs';
import {
  FLAG_DECIMAL,
  FLAG_IRQ_DISABLE,
  FLAG_NEGATIVE,
  FLAG_ZERO,
} from '../../src/constants/cpu-flags.mjs';
const APPEND_RETURN_WORD = 0x8ef3;
// 80:8EDA: start the selected spell's script: X = its script (SELECTED_SPELL_SCRIPT),
// the spell level byte from the long pointer SELECTED_SPELL_LEVEL_POINTER (bank 7E, via
// DP A2..A4) becomes the first argument, then the proved 80:C34A appends the task
// (real JSR frame).
export const appendSelectedSpellTaskReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const k = taskSelectionSupport(h),
        { ctx } = h;
      h.load(h.longRead(WRAM + SELECTED_SPELL_SCRIPT));
      h.index('x', ctx.a);
      h.load(h.longRead(WRAM + SELECTED_SPELL_LEVEL_POINTER));
      a.writeWord(DP_SELECTION_POINTER, ctx.a, BANK_WRAP, '8eda-DPA2');
      h.load(WRAM_BANK);
      a.writeWord(DP_SELECTION_POINTER_BANK, ctx.a, BANK_WRAP, '8eda-DPA4');
      h.load(k.indirect(DP_SELECTION_POINTER));
      h.load(ctx.a & BYTE_MASK);
      a.writeWord(FIRST_ARGUMENT, ctx.a, BANK_WRAP, '8eda-DP00');
      a.pushWord(APPEND_RETURN_WORD, '8eda-JSR');
      const append = appendScriptTask(a, false);
      if (append.rawReturnWord !== APPEND_RETURN_WORD)
        taskStop('task_native_helper_return_required', {
          actual: append.rawReturnWord,
          expected: APPEND_RETURN_WORD,
        });
    },
    outerReturn,
  );
const RECORD_LOOKUP_RETURN_WORD = 0xd06e,
  STRENGTH_BYTE = 2;
// D02F: byte DP02 of the record of object DP00. Its number 150A+Y is searched in the words 9700+X from
// X = 18 down (DEX DEX, BPL: a miss ends with X = FFFE, read with bank carry); the record pointer
// 971A+X WORD and 9734+X BYTE go to DPA2/DPA4 (SEP #20 keeps the high byte of A), [A2]+DP02 BYTE to DP00.
function readRunnerRecordByte(h, k) {
  const { a, ctx } = h;
  h.index('y', h.dp(FIRST_ARGUMENT));
  h.index('x', RUNNER_LAST_INDEX);
  h.load(h.longRead(h.abs(OBJECT_NUMBER) + ctx.y));
  for (;;) {
    k.compare(ctx.a, h.longRead(h.abs(RUNNER_OBJECT_NUMBERS) + ctx.x));
    if (ctx.status & FLAG_ZERO) break;
    h.index('x', (ctx.x - 1) & WORD_MASK);
    h.index('x', (ctx.x - 1) & WORD_MASK);
    if (ctx.status & FLAG_NEGATIVE) break;
  }
  h.load(h.longRead(h.abs(RUNNER_RECORD_POINTERS) + ctx.x));
  a.writeWord(DP_SELECTION_POINTER, ctx.a, BANK_WRAP, 'd02f-DPA2');
  h.load(a.read((h.abs(RUNNER_RECORD_BANKS) + ctx.x) & LONG_MASK, 'd02f-9734-BYTE'), 1);
  a.write(DP_SELECTION_POINTER_BANK, ctx.a & BYTE_MASK, 'd02f-DPA4-BYTE');
  h.index('y', h.dp(SECOND_ARGUMENT));
  h.load(k.indirect(DP_SELECTION_POINTER, ctx.y));
  h.load(ctx.a & BYTE_MASK);
  a.writeWord(FIRST_ARGUMENT, ctx.a, BANK_WRAP, 'd02f-DP00');
}
// 80:D067: return the Strength (record byte 2, src/data/runners.mjs) of the runner object
// (first argument): D02F with DP02 = 2 (real JSR frame).
export const getRunnerStrengthReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const k = taskSelectionSupport(h);
      h.load(STRENGTH_BYTE);
      a.writeWord(SECOND_ARGUMENT, h.ctx.a, BANK_WRAP, 'd067-DP02');
      k.call(RECORD_LOOKUP_RETURN_WORD, () => readRunnerRecordByte(h, k));
    },
    outerReturn,
  );
// 80:D186: return the player object (0CC2) after a BRK: LDA $00, then BRK #$00. The
// native BRK vector 00:FFE6 points to 00:F2B3, a plain RTI: BRK pushes PB, the PC behind
// the signature byte ($D18A) and P (four bytes below S stay in WRAM), sets I and clears
// D; RTI takes P, PC and PB back. Then the D18A body: DP00 = $0CC2.
const BRK_RETURN_HIGH = (0x80d18a >>> BYTE_BITS) & BYTE_MASK,
  BRK_RETURN_LOW = 0x80d18a & BYTE_MASK,
  INTERRUPT_FRAME_BYTES = 4;
export const getPlayerObjectAfterBreakReference = (a, outerReturn = true) =>
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
