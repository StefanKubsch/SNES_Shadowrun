import { taskStop } from './plan.mjs';
import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { taskSelectionSupport } from './native-object-turn.mjs';
import { appendScriptTask } from './task-append.mjs';
import { BANK_WRAP, BYTE_MASK } from '../constants/bits.mjs';
import { WRAM_BANK } from '../constants/memory-map.mjs';
import {
  WRAM,
  SELECTED_SPELL_SCRIPT,
  SELECTED_SPELL_LEVEL_POINTER,
  DP_SELECTION_POINTER,
  DP_SELECTION_POINTER_BANK,
} from './wram.mjs';
const APPEND_RETURN_WORD = 0x8ef3;
// 80:8EDA: start the selected spell's script: X = its script (SELECTED_SPELL_SCRIPT),
// the spell level byte from the long pointer SELECTED_SPELL_LEVEL_POINTER (bank 7E, via
// DP A2..A4) becomes the first argument, then the proved 80:C34A appends the task
// (real JSR frame).
export const appendSelectedSpellTask = (a, outerReturn = true) =>
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
