// Random per-function tests of the lifted start menu (src/frontend/start-menu.mjs)
// against the register-level reference (proof/frontend-reference/start-menu-text.mjs)
// for the edge cases the live sessions of tools/start-menu-lift.test.mjs do not reach
// (docs/MATRIX-LIFT.md): every menu text at any position and highlight, settings of
// every value, every animation frame, every fade step, and the NMI callback at every
// frame counter phase with either carry of the interrupted code.
import { DialogTestMemory, prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { START_MENU_IGNORED_WRAM } from './live-start-menu-plan.mjs';
import { sceneRuntime } from '../src/system/scene-runtime.mjs';
import { SRAM_SIZE } from '../src/vm/memory.mjs';
import {
  clearMenuTilemap,
  drawMenuText,
  fadeTitleColours,
  handleStartMenuNmi,
  setAnimationSources,
  toggleMenuHighlight,
} from '../src/frontend/start-menu.mjs';
import {
  restoreDefaultSettings,
  sendOutputMode,
  settingsValid,
  storeSettingsChecksum,
} from '../src/frontend/settings.mjs';
import { START_MENU_REFERENCE_ROUTINES } from '../proof/frontend-reference/start-menu.mjs';
import { FLAG_CARRY, FLAG_MEMORY_8BIT, FLAG_ZERO } from '../src/constants/cpu-flags.mjs';

const WRAM_BYTES = 0x20000,
  ROM = new DialogTestMemory(new Uint8Array(WRAM_BYTES)),
  ANIMATION_FRAMES = 0x113e,
  FRAME_COUNTER = 0x11a2,
  DP_CURSOR = 0x0e,
  DP_TEXT_XOR = 0x18,
  // The menu texts of bank 81 (src/data/menu-texts.mjs).
  TEXTS = [
    0xd582, 0xe3b2, 0xe3c1, 0xe3d2, 0xe425, 0xe433, 0xe441, 0xe4a1, 0xe4ae, 0xe4b9, 0xe4c8, 0xe4d7,
    0xe4dc, 0xe4ec, 0xe4fd,
  ];
void ROM;

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    pick = (list) => list[rnd(list.length)],
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  const word = (at, v) => {
    wram[at] = v & 255;
    wram[at + 1] = (v >>> 8) & 255;
  };
  word(DP_CURSOR, pick([0, 1, 2, 3, 4, 0xff, 0x100, 0xffff, rnd(65536)]));
  word(DP_TEXT_XOR, pick([0, 0x400, rnd(65536)]));
  for (let n = 0; n < 4; n++)
    word(ANIMATION_FRAMES + n * 2, pick([0, 1, 22, 23, 24, 0xffff, rnd(48)]));
  word(FRAME_COUNTER, pick([0, 1, 7, 8, 0xffff, rnd(65536)]));
  const sram = new Uint8Array(SRAM_SIZE);
  for (let i = 0; i < sram.length; i++) sram[i] = rnd(256);
  return { seed, wram, sram, rnd, pick };
}

const CASES = [
  {
    name: 'drawMenuText 81:D531',
    entry: 0x81d531,
    long: true,
    samples: 600,
    prepare: (s) => ({
      x: s.pick([0, 0x414, 0x684, 0x7f0, s.rnd(0x800) & ~1]),
      y: s.pick(TEXTS),
      bank: 0x81,
    }),
    lifted: (m, r) => drawMenuText(m.mem, r.x, 0x810000 | r.y),
  },
  {
    name: 'clearMenuTilemap 81:D555',
    entry: 0x81d555,
    long: true,
    lifted: (m) => clearMenuTilemap(m.mem),
  },
  {
    name: 'toggleMenuHighlight 81:E371',
    entry: 0x81e371,
    lifted: (m) => toggleMenuHighlight(m.mem),
  },
  {
    name: 'storeSettingsChecksum 81:D5E4',
    entry: 0x81d5e4,
    long: true,
    prepare: () => ({ status: FLAG_MEMORY_8BIT }),
    lifted: (m) => storeSettingsChecksum(m.mem),
  },
  {
    // Half the samples get a valid checksum (computed on a lifted memory view).
    name: 'settingsValid 81:D5EC',
    entry: 0x81d5ec,
    long: true,
    prepare: (s) => {
      if (s.rnd(2)) {
        const view = new DialogTestMemory(s.wram.slice(), s.sram);
        storeSettingsChecksum(view);
      }
      return { status: FLAG_MEMORY_8BIT };
    },
    result: (h) => Boolean(h.ctx.status & FLAG_ZERO),
    lifted: (m) => settingsValid(m.mem),
  },
  {
    name: 'restoreDefaultSettings 81:D5F4',
    entry: 0x81d5f4,
    long: true,
    prepare: () => ({ status: FLAG_MEMORY_8BIT }),
    lifted: (m) => restoreDefaultSettings(m.mem),
  },
  {
    name: 'sendOutputMode 81:EF36',
    entry: 0x81ef36,
    long: true,
    result: (h) => h.ctx.x,
    lifted: (m) => sendOutputMode(m),
  },
  {
    name: 'setAnimationSources 81:E623',
    entry: 0x81e623,
    lifted: (m) => setAnimationSources(m.mem),
  },
  {
    name: 'fadeTitleColours 81:E5DB',
    entry: 0x81e5db,
    prepare: (s) => ({ x: s.rnd(12) }),
    lifted: (m, r) => fadeTitleColours(m.mem, r.x),
  },
  {
    name: 'handleStartMenuNmi 81:E6AE',
    entry: 0x81e6ae,
    long: true,
    samples: 600,
    prepare: (s) => ({ status: s.rnd(2) ? FLAG_CARRY : 0 }),
    lifted: (m, r) => {
      m.h.ctx.status = r.status;
      return handleStartMenuNmi(m.h);
    },
  },
];

registerCases(CASES, {
  sample,
  side: (s) => createSide(s, START_MENU_REFERENCE_ROUTINES),
  runtime: sceneRuntime,
  ignored: START_MENU_IGNORED_WRAM,
  outside: new Set(['menu_table_index_frontier']),
});
