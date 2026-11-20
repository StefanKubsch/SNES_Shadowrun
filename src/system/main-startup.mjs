// Live startup 80:A133: direct composition of the boot screens and their caller.
// The former address-dispatched path is retained in proof/script/live-startup.mjs.
import { taskStop } from './task-stop.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { bootScreensInPlace } from '../frontend/boot-screens.mjs';
import { GAME_OWNER_ENTRY } from '../frontend/game-owner.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';

export const MAIN_STARTUP_ENTRY = 0xa133;

// The JSR to 80:A15C and its JSL to the boot screens 81:E7BC run without their frames,
// whose return words lie only in free stack bytes; the PHP and PLP around the screens
// and the data bank 80 the routine sets before its RTS are kept in the context (game
// state only, user decision 2026-11-17). Calls are direct; no routine table or factory
// lookup. Only the entry point is checked; the register-level check (direct page 0,
// data bank 80, 16-bit binary registers) stays with proof/script/live-startup.mjs.
export function* mainStartupSequence(h, events) {
  const { ctx } = h;
  if (ctx.programBank !== CODE_BANK || ctx.pc !== MAIN_STARTUP_ENTRY)
    taskStop('main_startup_entry_required', { pc: ctx.pc });
  if (!lagFree(events)) taskStop('game_lag_free_required');
  const status = ctx.status;
  yield* bootScreensInPlace(h, events);
  yield () => {
    ctx.bank = CODE_BANK;
    ctx.status = status;
  };
  // The original passes the owner A = 1 (LDA #1; show the title first); the lifted
  // owner takes that from its entry point (user decision 2026-11-17: no registers).
  yield () => {
    ctx.pc = GAME_OWNER_ENTRY;
  };
  return ctx.pc;
}
