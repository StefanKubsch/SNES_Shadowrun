// Original CPU metadata of the reset 00:E382 and startup 80:A133 for comparisons with
// frozen register-level callers (docs/BOOT-SERVICE-COMPOSITION.md). The live reset and
// startup take no CPU context; these adapters restore what the original leaves.
import { resetHardware } from '../src/system/main-reset.mjs';
import { mainStartupSequence } from '../src/system/main-startup.mjs';
import { accessorPort } from '../src/system/hardware-port.mjs';
import { STARTUP_CONTEXT } from '../src/script/game-loop.mjs';
import { GAME_OWNER_ENTRY } from '../src/frontend/game-owner.mjs';
import { CODE_BANK } from '../src/constants/memory-map.mjs';

// The reset service, then the registers it leaves at 80:A133.
export function resetWithEntryContext(a) {
  resetHardware(accessorPort(a), a.mem);
  Object.assign(a.ctx, STARTUP_CONTEXT);
  return a.ctx.pc;
}

// The startup with its PHP/PLP around the screens, the data bank 80 set before its
// RTS and the owner entry A139. Live events pass game services only; recorded events
// keep the boot screens' own status changes on the caller's context.
export function* startupWithEntryContext(h, events) {
  const { ctx } = h,
    status = ctx.status;
  yield* mainStartupSequence(events.frameJobs ? { a: h.a } : h, events);
  yield () => {
    ctx.bank = CODE_BANK;
    ctx.status = status;
    ctx.pc = GAME_OWNER_ENTRY;
  };
  return ctx.pc;
}
