// Live startup 80:A133: direct composition of the boot screens and their caller.
// The former address-dispatched path is retained in proof/script/live-startup.mjs.
import { taskStop } from './task-stop.mjs';
import { dialogCallBody } from './native-call-continuation.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { bootScreensSequence } from '../frontend/boot-screens.mjs';
import { GAME_OWNER_ENTRY } from '../frontend/game-owner.mjs';
import { CODE_BANK, CODE_BANK_PAIR } from '../constants/memory-map.mjs';
import { FLAG_DECIMAL, FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';

export const MAIN_STARTUP_ENTRY = 0xa133;

// Preserve the original JSR/JSL frames while shared boot/NMI code still uses
// the register accessor. Calls are direct; no routine table or factory lookup.
export function* mainStartupSequence(h, events) {
  const { ctx } = h;
  if (
    ctx.programBank !== CODE_BANK ||
    ctx.pc !== MAIN_STARTUP_ENTRY ||
    ctx.d !== 0 ||
    ctx.bank !== CODE_BANK ||
    ctx.status & (FLAG_DECIMAL | FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('main_startup_entry_required', { pc: ctx.pc });
  if (!lagFree(events)) taskStop('game_lag_free_required');
  yield* dialogCallBody(h, 0x80a133, 0x80a15c, function* () {
    yield () => h.php();
    yield* dialogCallBody(h, 0x80a15d, 0x81e7bc, () => bootScreensSequence(h, events), true);
    yield () => {
      h.push(CODE_BANK_PAIR, 2);
      h.plb();
      h.plb();
      h.plp();
      h.rts();
    };
  });
  yield () => {
    h.load(1);
    ctx.pc = GAME_OWNER_ENTRY;
  };
  return ctx.pc;
}
