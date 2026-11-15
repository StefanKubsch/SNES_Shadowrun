import { BYTE_MASK } from '../constants/bits.mjs';

// Result word and shooter slot of a hit (8691), shared with the shots of 8AB5/8A51/8A8C:
// the result is 0, FFFF after a kill flag or 1 after a notice; a negative shooter (8E36)
// places no impact object.
export const DP_HIT_RESULT = 0xb4,
  DP_HIT_SHOOTER = 0xb7;

// 8691: the fourth hit on a harmless object warns ("Jake, do not attack those who mean you
// no harm.", 74BA at 06/06/14/04), the eighth costs 8 karma eighths, one karma point
// ("Jake, I must punish you for your lack of compassion. -1 Karma.", 74D2 at 04/04/19/04).
// Each notice waits thirty B0A1 counters before the key input F953.
export const HARMLESS_WARNING = Object.freeze({ hits: 4, margin: 6, columns: 20, text: 0x74ba }),
  HARMLESS_PENALTY = Object.freeze({ hits: 8, margin: 4, columns: 25, text: 0x74d2 }),
  HARMLESS_NOTICE_ROWS = 4,
  KARMA_PENALTY = 8,
  NOTICE_COUNTER_WAITS = 30;

// A damaged object wakes its root task with event bit 11; the hit effect object A1 runs
// script 10F four units above the box. With a shooter the impact object E7 (script 80)
// sits one unit towards the shooter's facing (offsets 80:8850) with the facing of 80:8840.
export const HIT_EVENT = 0x800,
  HIT_EFFECT_KIND = 0xa1,
  HIT_EFFECT_SCRIPT = 0x10f,
  HIT_EFFECT_RAISE = 4,
  IMPACT_KIND = 0xe7,
  IMPACT_SCRIPT = 0x80,
  IMPACT_OFFSETS = 0x8850,
  IMPACT_FACINGS = 0x8840;

// 881C: a hit player plays sound 20 at level FF on voices 7 and stays stunned 11 frames.
export const PLAYER_HIT_SOUND = 0x20,
  PLAYER_HIT_SOUND_LEVEL = BYTE_MASK,
  PLAYER_HIT_SOUND_VOICES = 7,
  PLAYER_HIT_STUN = 11;
