// Intro sessions in the live game for tools/intro-lift.test.mjs: from the apartment
// save, the request 7E:1CE9 = 14 makes the main loop play cutscene 14, the intro
// 81:DFE7, which then plays cutscene 5 mirrored (the credits pages, 7068 frames; its
// animation clears the pad word, so no button ends it). One intro runs its 300
// frames (spawns, then the departure of the far object), one is ended with A while
// objects are still being added.
import { CUTSCENE_IGNORED_WRAM } from './live-cutscene-plan.mjs';

const REQUEST = 0x1ce9,
  ARGUMENT = 0x1ceb,
  INTRO = 0x14;
// The intro and the credits after it take about 7400 frames.
const intro = (before = []) => [
  ['poke', ARGUMENT, 0],
  ['poke', REQUEST, INTRO],
  ...before,
  ['wait', 7600],
];
export const INTRO_PLAN = [
  ['wait', 2989],
  ['press', 'start', 150],
  ['press', 'down', 150],
  ['press', 'start', 300],
  ['press', 'start', 1400],
  ...intro(),
  ...intro([
    ['wait', 60],
    ['press', 'a', 30],
  ]),
];
// Scratch the lifted intro no longer writes: as for the cutscenes (the direct page
// 00-13 and 20-33, unpacker and sample loader state, stacks), and the word 16-17,
// which the sprite grid 81:E83A uses as scratch (the cutscene that follows sets it
// before it reads it).
export const INTRO_IGNORED_WRAM = [...CUTSCENE_IGNORED_WRAM, [0x0016, 0x0018]];
