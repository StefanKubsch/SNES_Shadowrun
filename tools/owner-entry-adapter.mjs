// Original entry/return metadata for comparisons with the frozen owner caller.
// The live owner accepts showTitle and returns a choice without a stack frame.
import assert from 'node:assert/strict';
import { gameOwnerSequence as owner } from '../src/frontend/game-owner.mjs';
import {
  GAME_OWNER_ENTRY,
  GAME_OWNER_RESUME,
  GAME_OWNER_RETURN_WORD,
} from '../src/frontend/game-owner.mjs';
import { GAME_START } from '../src/game/game-start.mjs';
import { CODE_BANK } from '../src/constants/memory-map.mjs';

export { GAME_OWNER_RESUME };

export function* gameOwnerSequence(h, events, routines) {
  const showTitle = h.ctx.pc === GAME_OWNER_ENTRY,
    stack = h.ctx.s;
  // Poison the old selector: the explicit argument must govern both entries.
  h.ctx.pc = GAME_OWNER_RESUME;
  const choice = yield* owner(h, events, routines, showTitle);
  assert.equal(choice, h.a.mem.read16(0), 'owner returns its menu choice');
  assert.equal(h.ctx.s, stack, 'owner creates no game return frame');
  // The original leaves data bank 80; the live owner keeps no data bank.
  h.ctx.bank = CODE_BANK;
  h.a.pushWord(GAME_OWNER_RETURN_WORD);
  h.ctx.pc = GAME_START;
  return h.ctx.pc;
}
