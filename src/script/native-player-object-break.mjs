import { finishLeaf, setLeafResult } from '../system/native-leaf-support.mjs';
import { playerObject } from '../game/script-queries.mjs';

// 80:D186 (lifted in src/game/script-queries.mjs; register-level reference in
// proof/game-reference/script-starts.mjs): return the player figure's object slot. The
// original first executes BRK #$00, whose vector 00:FFE6 points to a plain RTI (00:F2B3):
// it returns to 80:D18A with the registers restored, leaving only its four pushed bytes
// below the stack pointer, which nothing reads (game state only, docs/STRATEGY.md).
export const getPlayerObjectAfterBreak = (a, outerReturn = true) => {
  setLeafResult(a, playerObject(a.mem));
  return finishLeaf(a, outerReturn);
};
