// The collision tests 80:80B2, 80:8133, 80:81B4, 80:8238 and 80:82BC as register forms
// for register-level callers (moved from src/game/object-collision.mjs, whose lifted
// tests take the slot as a parameter and leave no registers).
import {
  heightCells,
  lowerXEdge,
  lowerYEdge,
  upperXEdge,
  upperYEdge,
} from '../../src/game/object-collision.mjs';
import { WORD_SIGN } from '../../src/constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_NEGATIVE,
  FLAG_OVERFLOW,
  FLAG_ZERO,
} from '../../src/constants/cpu-flags.mjs';

const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const signAndZero = (ctx, value) => {
  flag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
  flag(ctx, FLAG_ZERO, value === 0);
};
// The register form of a test: the slot in X; A, X, the sign, zero, carry and overflow
// as the original leaves them.
const registerForm = (run, edge) => (h) => {
  const { ctx } = h,
    slot = ctx.x,
    found = run(h, slot);
  ctx.x = slot;
  ctx.a = found.height;
  signAndZero(ctx, edge ? found.height : slot);
  flag(ctx, FLAG_CARRY, found.free);
  flag(ctx, FLAG_OVERFLOW, found.overflow);
  return found.returned;
};

export const searchUpperXEdge = registerForm(upperXEdge, true),
  searchLowerXEdge = registerForm(lowerXEdge, true),
  searchUpperYEdge = registerForm(upperYEdge, true),
  searchLowerYEdge = registerForm(lowerYEdge, true),
  searchHeightCells = registerForm(heightCells, false);
