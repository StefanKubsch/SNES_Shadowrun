// The seven matrix sessions of tools/live-matrix.test.mjs (see its description),
// shared with tools/matrix-lift.test.mjs.

// Scratch the lifted matrix no longer writes (docs/MATRIX-LIFT.md): the direct
// page words 00-33 below the persistent text pointer 34-37, and the stack pages
// (main and NMI stack). Shared with tools/matrix-lift-functions.test.mjs.
export const IGNORED_WRAM = [
  [0x0000, 0x0034],
  // The unpacker's direct page state (src/system/unpack.mjs): every call sets each
  // field before it reads it, and no other code reads them.
  [0x00db, 0x00f3],
  // The sample loader's direct page state (src/apu/music-mode.mjs), set before
  // read on every call and read by no other code; 7E:008C-008E stays compared.
  [0x0089, 0x008c],
  [0x008f, 0x009a],
  [0x1c78, 0x1c7c], // NMI_SAVED_A and NMI_SAVED_STACK: interrupted A and S
  [0x1c7c, 0x1cbc], // NMI stack
  [0x0100, 0x01ca], // main stack, below the pad words
];
export const DECKER = 0x3c04,
  HEALTH = 0x1754,
  SEED = 0x12345678,
  APARTMENT = 345;
const session = (computer, system = 10, level = 3, extra = 0) => [
  ['poke', DECKER, computer, 1],
  ['matrix', system, APARTMENT, extra, level],
];
const sync = (health) => [
  ['until', HEALTH, health],
  ['poke', 0x1ce8, 0, 1],
  ['poke', 0x1c76, 0],
  ['counter', SEED],
];
const TO_IC = [
  ['wait', 650],
  ['hold', 'up', 30],
  ['wait', 20],
  ['hold', 'up', 4],
  ['wait', 60],
];
const OUT = [
  ['press', 'x', 30],
  ['until', 0x1ce9, 0xffff],
  ['wait', 300],
];
const COMBAT = [...TO_IC, ['press', 'b', 150], ['press', 'b', 150], ...OUT];
const DATA = [
  ['wait', 650],
  ['hold', 'right', 4],
  ['wait', 80],
  ['hold', 'down', 24],
  ['wait', 120],
  ['hold', 'left', 24],
  ['wait', 60],
  ['press', 'a', 200],
  ['press', 'a', 200],
  ...OUT,
];
const CPU = [
  ['wait', 650],
  ['hold', 'right', 4],
  ['wait', 80],
  ['press', 'a', 200],
  ['press', 'b', 200],
  ...OUT,
];
const step = (key, turn) => [
  ['hold', key, turn ? 24 : 4],
  ['wait', 30],
];
const NODE_17 = [
  ['wait', 650],
  ['hold', 'right', 4],
  ['wait', 80],
  ['hold', 'up', 24],
  ['wait', 30],
  ['press', 'b', 150],
  ['press', 'a', 150],
  ['hold', 'right', 24],
  ['wait', 80],
  ...step('down', true),
  ...step('down'),
  ...step('right', true),
  ...step('right'),
  ...step('right'),
  ...step('down', true),
  ...step('right', true),
  ...Array(5).fill(step('right')).flat(),
  ...step('up', true),
  ['press', 'a', 200],
  ['press', 'b', 200],
  ...OUT,
];
const DEATH = [...TO_IC, ['press', 'b', 150], ['until', 0x1ce9, 0xffff], ['wait', 1200]];
// The data node 18 of system 1 at (12, 11): word 7F:175C + 2 (32 y + x), 175C = 0216 + 800 * system (set up by 81:C3CA).
const DATA_NODE = 0x10000 + 0x0a16 + 2 * (11 * 32 + 12);
// The gate 3F above the CPU node 20 of system 2 at (17, 13), the node 17 of system 3 at (29, 10).
const GATE = 0x10000 + 0x1216 + 2 * (13 * 32 + 17),
  NODE17 = 0x10000 + 0x1a16 + 2 * (10 * 32 + 29);
export const WATCH = [
  0x1754,
  0x1750,
  0x1752,
  0x173e,
  0x141c,
  0x1744,
  0x1756,
  0x1758,
  0x175a,
  0x1524,
  0x1566,
  0x1ce8,
  0x1c76,
  DATA_NODE,
  GATE,
  NODE17,
];
export const PLAN = [
  ['wait', 2989],
  ['press', 'start', 150],
  ['press', 'down', 150],
  ['press', 'start', 300],
  ['press', 'start', 1400],
  ['watch', ...WATCH],
  ...session(12),
  ...sync(30),
  ...COMBAT,
  ...session(0),
  ...sync(29),
  ...COMBAT,
  ...session(12, 1, 1),
  ...sync(5),
  ...DATA,
  ...session(12, 2, 1),
  ...sync(5),
  ...CPU,
  ...session(12, 3, 2, 2),
  ...sync(5),
  ...NODE_17,
  ...session(12, 2, 0),
  ...sync(5),
  ['until', 0x1ce9, 0xffff],
  ['wait', 300],
  ...session(0),
  ...sync(5),
  ...DEATH,
];
