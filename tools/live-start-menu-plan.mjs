// Start menu sessions in the live game for tools/start-menu-lift.test.mjs, each from
// power-on with the apartment save; Start in the title opens the menu.
// - Options: control type, output mode, music three times, Exit; then the saved
//   games with Exit, Up from the first row, and a saved game.
// - A new game.
// - The Credits row of the port, ended with B.
// - The timeout after the whole title and the attract game behind it (its nested
//   scheduler rounds pause within their scripts; tools/live-step-budget.test.mjs).
import { TITLE_IGNORED_WRAM } from './live-title-plan.mjs';

const OPEN = [
  ['wait', 1200],
  ['press', 'start', 400],
];
// A press, then frames until the next command.
const PRESS_FRAMES = 40;
const press = (key, frames = PRESS_FRAMES) => ['press', key, frames];
export const START_MENU_PLANS = [
  [
    ...OPEN,
    press('down'),
    press('down'),
    press('b', 120),
    press('b'),
    press('down'),
    press('b'),
    press('down'),
    press('b'),
    press('b'),
    press('b'),
    press('down'),
    press('b', 120),
    press('down'),
    press('b', 120),
    press('down'),
    press('down'),
    press('b', 120),
    press('up'),
    press('up'),
    press('select'),
    press('b', 800),
  ],
  [...OPEN, press('start', 1600)],
  [...OPEN, press('up'), press('b', 300), press('b', 400)],
  [
    ['wait', 3500],
    ['wait', 1200],
  ],
];
// Scratch the lifted menu no longer writes: as for the title.
export const START_MENU_IGNORED_WRAM = TITLE_IGNORED_WRAM;
