// Runtime choices, separate from the session's original-game fixes.
export const CHEAT = Object.freeze({ health: 1, money: 2, stats: 4, spells: 8 });
export const CHEAT_MASK = CHEAT.health | CHEAT.money | CHEAT.stats | CHEAT.spells;
export const cheatMask = (value) =>
  Number.isInteger(value) && value >= 0 && value <= CHEAT_MASK ? value : 0;
export const CHEAT_EVENTS = Object.freeze(
  Array.from({ length: CHEAT_MASK + 1 }, (_, mask) => `cheats-${mask}`),
);
