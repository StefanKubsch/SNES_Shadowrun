// Register-level form of the default weapon correction for the runner equipment
// reference (proof/game-reference/runner-equipment.mjs); the game applies the
// correction in src/game/runner-equipment.mjs (docs/BUGFIXES.md).
import {
  WRAM,
  RUNNER_WEAPON,
  RUNNER_WEAPON_KIND,
  RUNNER_WEAPON_RANGE,
} from '../../src/data/wram.mjs';
import {
  RUNNER_DEFAULT_WEAPON,
  RUNNER_DEFAULT_WEAPON_KIND_DAMAGE,
  RUNNER_DEFAULT_WEAPON_RANGE,
} from '../../src/data/runners.mjs';

// Correct the two erroneous stores in 80:9D50 to reads of the defaults.
// Both 9CE4 and 9D15 reach this helper. X is eight times the runner index.
export function restoreDefaultWeapon(h) {
  const { a, ctx } = h;
  h.load(h.longRead(h.abs(RUNNER_DEFAULT_WEAPON) + ctx.x));
  h.longWrite(WRAM + RUNNER_WEAPON + ctx.x, ctx.a);
  h.load(h.longRead(h.abs(RUNNER_DEFAULT_WEAPON_KIND_DAMAGE) + ctx.x));
  h.longWrite(WRAM + RUNNER_WEAPON_KIND + ctx.x, ctx.a);
  h.load(a.read(h.abs(RUNNER_DEFAULT_WEAPON_RANGE) + ctx.x), 1);
  h.longWrite(WRAM + RUNNER_WEAPON_RANGE + ctx.x, ctx.a, 1);
}
