// Cutscene sessions in the live game for tools/cutscene-lift.test.mjs: from the
// apartment save, each request 7E:1CE9 = scene (7E:1CEB its argument) makes the
// main loop play the cutscene 81:CDF8, as the game's natives do. The sequences 0-4
// run to their end, two of them mirrored (bit 15), one with an argument, one is
// ended with B, and the credits (5) run for 7068 frames.
const REQUEST = 0x1ce9,
  ARGUMENT = 0x1ceb,
  MIRRORED = 0x8000,
  SCENE_FRAMES = 900,
  CREDITS_FRAMES = 7500;
const play = (scene, argument = 0, frames = SCENE_FRAMES) => [
  ['poke', ARGUMENT, argument],
  ['poke', REQUEST, scene],
  ['wait', frames],
];
export const CUTSCENE_PLAN = [
  ['wait', 2989],
  ['press', 'start', 150],
  ['press', 'down', 150],
  ['press', 'start', 300],
  ['press', 'start', 1400],
  ...play(0),
  ...play(1),
  ...play(2),
  ...play(3, 0x40),
  ...play(4),
  ...play(MIRRORED | 1),
  ...play(MIRRORED | 3, 0x20),
  // Ended with B after 100 frames.
  ['poke', ARGUMENT, 0],
  ['poke', REQUEST, 2],
  ['wait', 100],
  ['press', 'b', 30],
  ['wait', 400],
  ...play(5, 0, CREDITS_FRAMES),
];
// Scratch the lifted cutscenes no longer write: the direct page 00-13 and 20-33 (the
// cutscene state 14-1F stays compared), the unpacker and sample loader state, the
// stacks and the interrupted registers (as tools/live-matrix-plan.mjs IGNORED_WRAM).
export const CUTSCENE_IGNORED_WRAM = [
  [0x0000, 0x0014],
  [0x0020, 0x0034],
  [0x0089, 0x008c],
  [0x008f, 0x009a],
  [0x00db, 0x00f3],
  [0x1c78, 0x1c7c],
  [0x1c7c, 0x1cbc],
  [0x0100, 0x01ca],
];
