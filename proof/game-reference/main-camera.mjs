// Register-level reference of the main loop's camera and formation trail (moved
// from src/task/main-loop-camera.mjs and src/task/main-motion-target.mjs): the camera
// follow 81:8C2E and the formation step 80:BAD5. The lifted versions are
// src/game/camera-follow.mjs and src/game/formation-trail.mjs; the tile buffers
// 81:8A91 (lifted in src/game/camera-scroll.mjs) keep their register-level version
// in src/task/main-loop-camera.mjs for the camera jump's replay.
import { clampToCameraBox, updateCameraTileBuffers } from '../../src/task/main-loop-camera.mjs';
import { sec, clc } from '../../src/task/status-flags.mjs';
import {
  CAMERA_SPEED_X,
  CAMERA_SPEED_Y,
  CAMERA_X,
  CAMERA_Y,
  FORMATION_DIRECTION,
  FORMATION_HEIGHT,
  FORMATION_INDEX,
  FORMATION_LAST,
  FORMATION_UNMOVED,
  FORMATION_X,
  FORMATION_Y,
  OBJECT_DIAGONAL,
  OBJECT_DIRECTION,
  OBJECT_HEIGHT,
  OBJECT_X,
  OBJECT_Y,
  PLAYER_HIT_FRAMES,
  PLAYER_OBJECT,
  WRAM,
} from '../../src/task/wram.mjs';
import { WORD_MASK } from '../../src/constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';

// Projected camera position (DP0E X, DP11 Y) shared with 81:8A05.
const DP_CAMERA_X = 0x0e,
  DP_CAMERA_Y = 0x11;
const CAMERA_CENTRE_X = 0x400;
// 81:8C2E: the player's row base, the height offset and the camera speed: differences
// below 8 are ignored, the rest / 4 (rounded, arithmetic) clamped to +-20 in steps of 4.
const PLAYER_ROW_BASE = 0x910,
  CAMERA_HEIGHT_BASE = 0x100,
  SPEED_DEAD_ZONE_MASK = 0xfff8,
  SHIFT_2_SIGN_BITS = 0xc000,
  SPEED_MAX = 0x20,
  SPEED_STEP_MASK = 0xfffc;
const FORMATION_UNCHANGED = WORD_MASK;
const zero = (h) => Boolean(h.ctx.status & FLAG_ZERO),
  negative = (h) => Boolean(h.ctx.status & FLAG_NEGATIVE);

// $8C2E: project and clamp the player figure, and camera speed in steps of four up to ±32.
export function projectPlayerAndMoveCamera(h) {
  const { ctx } = h;
  h.index('y', h.read(h.abs(PLAYER_OBJECT)));
  if (ctx.status & FLAG_NEGATIVE) return h.rtl();
  h.load(PLAYER_ROW_BASE);
  sec(h);
  h.sbc(h.read(h.abs(OBJECT_DIAGONAL) + ctx.y));
  h.dpWrite(DP_CAMERA_Y, ctx.a);
  h.load(CAMERA_CENTRE_X);
  clc(h);
  h.adc(h.read(h.abs(OBJECT_Y) + ctx.y));
  sec(h);
  h.sbc(h.read(h.abs(OBJECT_X) + ctx.y));
  h.dpWrite(DP_CAMERA_X, ctx.a);
  h.phy();
  h.call(0x818c4d, 0x818a05, () => clampToCameraBox(h), true);
  h.ply();
  const velocity = () => {
    h.load(ctx.a & SPEED_DEAD_ZONE_MASK);
    if (!(ctx.status & FLAG_ZERO)) {
      const negative = Boolean(ctx.status & FLAG_NEGATIVE);
      h.lsr();
      h.lsr();
      if (negative) {
        h.load(ctx.a | SHIFT_2_SIGN_BITS);
        h.adc(0);
        h.cmp(-SPEED_MAX & WORD_MASK);
        if (!(ctx.status & FLAG_CARRY)) h.load(-SPEED_MAX & WORD_MASK);
      } else {
        h.cmp(SPEED_MAX + 1);
        if (ctx.status & FLAG_CARRY) h.load(SPEED_MAX);
      }
    }
    h.load(ctx.a & SPEED_STEP_MASK);
  };
  h.load(h.dp(DP_CAMERA_Y));
  clc(h);
  h.adc(CAMERA_HEIGHT_BASE);
  sec(h);
  h.sbc(h.read(h.abs(OBJECT_HEIGHT) + ctx.y));
  sec(h);
  h.sbc(h.read(h.abs(CAMERA_Y)));
  velocity();
  h.write(h.abs(CAMERA_SPEED_Y), ctx.a);
  h.load(h.dp(DP_CAMERA_X));
  sec(h);
  h.sbc(h.read(h.abs(CAMERA_X)));
  velocity();
  h.write(h.abs(CAMERA_SPEED_X), ctx.a);
  return h.rtl();
}

// $80:BAD5: store the position and direction of the player figure in the formation's ring buffer.
// With an unchanged position or a running $1D65 only $0D1A is set to FFFF.
export function recordFormationStep(h) {
  const { ctx } = h;
  h.load(h.read(h.abs(PLAYER_HIT_FRAMES)));
  let changed = false;
  if (zero(h)) {
    h.index('y', h.read(h.abs(PLAYER_OBJECT)));
    h.index('x', h.read(h.abs(FORMATION_INDEX)));
    h.load(h.read(h.abs(OBJECT_X) + ctx.y));
    h.cmp(h.read(WRAM + FORMATION_X + ctx.x));
    changed = !zero(h);
    if (!changed) {
      h.load(h.read(h.abs(OBJECT_Y) + ctx.y));
      h.cmp(h.read(WRAM + FORMATION_Y + ctx.x));
      changed = !zero(h);
    }
    if (!changed) {
      h.load(h.read(h.abs(OBJECT_HEIGHT) + ctx.y));
      h.cmp(h.read(WRAM + FORMATION_HEIGHT + ctx.x));
      changed = !zero(h);
    }
  }
  if (!changed) {
    h.load(FORMATION_UNCHANGED);
    h.write(h.abs(FORMATION_UNMOVED), ctx.a);
    return h.rts();
  }
  h.index('x', ctx.x - 1);
  h.index('x', ctx.x - 1);
  if (negative(h)) h.index('x', FORMATION_LAST);
  h.write(h.abs(FORMATION_INDEX), ctx.x);
  for (const [source, destination] of [
    [OBJECT_X, WRAM + FORMATION_X],
    [OBJECT_Y, WRAM + FORMATION_Y],
    [OBJECT_HEIGHT, WRAM + FORMATION_HEIGHT],
    [OBJECT_DIRECTION, WRAM + FORMATION_DIRECTION],
  ]) {
    h.load(h.read(h.abs(source) + ctx.y));
    h.write(destination + ctx.x, ctx.a);
  }
  h.write(h.abs(FORMATION_UNMOVED), 0);
  return h.rts();
}

export const MAIN_CAMERA_REFERENCE_ENTRIES = [
  [0x818c2e, projectPlayerAndMoveCamera],
  [0x818a91, updateCameraTileBuffers],
  [0x80bad5, recordFormationStep],
];
