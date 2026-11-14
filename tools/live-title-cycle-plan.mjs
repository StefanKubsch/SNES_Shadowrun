import { START_MENU_IGNORED_WRAM } from './live-start-menu-plan.mjs';

// Title cycle sessions in the live game for tools/title-cycle-lift.test.mjs, each
// from power-on with the apartment save (frames from tools/live-start-menu-plan.mjs:
// the title starts at NMI 394, its menu at 3167).
// - No input: the whole title, the menu's short timeout, the attract game (from
//   NMI 3588), the menu, its timeout, the title again (7566), the menu, its
//   timeout and the attract game again (12860), and the menu behind it.
// - Start in the title, the Credits row, B to end the credits, the menu again,
//   its timeout, the title again, Start in it, and a new game.
// - Start in the title and a new game: the cycle returns into the game.
// - Start in the title and the first saved game.
// - The menu behind the first attract game, and a new game from it.
const OPEN = [
  ['wait', 1200],
  ['press', 'start', 400],
];
// A press, then frames until the next command.
const PRESS_FRAMES = 40;
const press = (key, frames = PRESS_FRAMES) => ['press', key, frames];
export const TITLE_CYCLE_PLANS = [
  [['wait', 14600]],
  [...OPEN, press('up'), press('b', 300), press('b', 3600), press('start', 400), press('b', 800)],
  [...OPEN, press('b', 800)],
  [...OPEN, press('down'), press('b'), press('b', 800)],
  [['wait', 5300], press('b', 800)],
];
// Scratch the lifted cycle no longer writes: as for the start menu, and the
// scheduler's saved stack pointer 7E:01F2 (src/vm/layout.mjs OUTER_STACK). The
// attract game's tasks run below the cycle's frame, which no longer holds the
// status byte A18C pushes with PHP, so the saved pointer is one byte higher.
export const TITLE_CYCLE_IGNORED_WRAM = [...START_MENU_IGNORED_WRAM, [0x01f2, 0x01f4]];
