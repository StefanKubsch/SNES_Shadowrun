// Title sessions in the live game for tools/title-lift.test.mjs, each from power-on
// (the apartment save only matters for the start menu after the title): the whole
// prologue and title, and a held Start in the prologue, the first title frames, the
// pan, the vertical scroll and the blend of the picture. (A press during a music
// beat poll is lost, as in the original, which reads no button there.)
import { INTRO_IGNORED_WRAM } from './live-intro-plan.mjs';

const keyAt = (frame) => [
  ['wait', frame],
  ['press', 'start', 30],
  ['wait', 400],
];
export const TITLE_PLANS = [
  [['wait', 3400]],
  keyAt(600),
  keyAt(1440),
  keyAt(1700),
  keyAt(2600),
  keyAt(3050),
];
// Scratch the lifted title no longer writes: as for the intro (src/intro shares the
// sprite grid with its scratch word 7E:0016).
export const TITLE_IGNORED_WRAM = INTRO_IGNORED_WRAM;
