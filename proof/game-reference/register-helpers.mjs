// Register-level helpers of the game references that the game itself no longer
// needs: LSR and CLC on the accessor (the swarm references), and the glove limit
// stores of 80:BC36 (the crosshair and spell limit references).
import { GLOVE_BASE_X, GLOVE_BASE_Y, GLOVE_LIMIT_KIND, GLOVE_KIND } from '../../src/data/wram.mjs';
import { FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';

// LSR and CLC on the accessor, with the carry in the status register.
export const lsr = (h) => {
  h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | (h.ctx.a & 1);
  h.load(h.ctx.a >>> 1);
};
export const clc = (h) => {
  h.ctx.status &= ~FLAG_CARRY;
};

// Register-level: store the projection bases and the kind of one GLOVE_LIMITS entry,
// then the kind again as the active glove kind (each value by LDA #, STA at DBR); used by
// the register-level glove natives of native-player-control.mjs and the references.
export function applyGloveLimits(h, [left, top, kind]) {
  for (const [field, value] of [
    [GLOVE_BASE_X, left],
    [GLOVE_BASE_Y, top],
    [GLOVE_LIMIT_KIND, kind],
  ])
    h.longWrite(h.abs(field), h.load(value));
  h.longWrite(h.abs(GLOVE_KIND), h.ctx.a);
}
