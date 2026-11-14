import { leaf } from './native-leaf-support.mjs';
import { WORD_MASK } from '../constants/bits.mjs';
import {
  PLAYER_IDLE,
  AIMING_WEAPON,
  AIMING_SPELL,
  PLAYER_HIT_FRAMES,
  GROUP_LEADER_ONLY,
  SCRIPT_GLOVE_CHOICE,
} from './wram.mjs';

// 80:DE7E: reset the player control state on a scene change: PLAYER_IDLE becomes FFFF,
// aiming, hit frames, leader-only mode and the script glove choice become 0 (all at DBR).
export const resetPlayerControl = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.longWrite(h.abs(PLAYER_IDLE), h.load(WORD_MASK));
      for (const field of [
        AIMING_WEAPON,
        AIMING_SPELL,
        PLAYER_HIT_FRAMES,
        GROUP_LEADER_ONLY,
        SCRIPT_GLOVE_CHOICE,
      ])
        h.longWrite(h.abs(field), 0);
    },
    outerReturn,
  );
