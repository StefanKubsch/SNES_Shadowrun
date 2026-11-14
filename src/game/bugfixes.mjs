// Optional departures from the European original. Source contracts and
// regression cases: docs/BUGFIXES.md. Oracle callers keep ORIGINAL_GAMEPLAY.
import { VmFault } from '../vm/memory.mjs';
import { BYTE_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';
import { TASK_CURSOR, TASK_FRAME } from '../vm/layout.mjs';
import {
  GROUP_INDEX,
  JAKE_CHARISMA,
  RUNNER_WEAPON,
  RUNNER_WEAPON_KIND,
  RUNNER_WEAPON_RANGE,
  TOPIC_FLAGS,
  TOPIC_LIST,
  WRAM,
} from '../task/wram.mjs';

import {
  RUNNER_DEFAULT_WEAPON,
  RUNNER_DEFAULT_WEAPON_KIND_DAMAGE,
  RUNNER_DEFAULT_WEAPON_RANGE,
} from '../data/runners.mjs';
// Script 162: Charisma limits and the last word index including Jake.
const CHARISMA_ONE_FOLLOWER_MAX = 3,
  CHARISMA_TWO_FOLLOWERS_MAX = 5,
  GROUP_ONE_FOLLOWER_LAST_INDEX = 2,
  GROUP_TWO_FOLLOWERS_LAST_INDEX = 4,
  GROUP_THREE_FOLLOWERS_LAST_INDEX = 6;
// Arrival proxy 38C and the reservation/arrival bits (docs/BUGFIXES.md).
const AKIMI_OBJECT = 0x1b6d,
  AKIMI_RESERVED = 0x80,
  AKIMI_ARRIVED = 0x40,
  AKIMI_ARRIVAL_SCRIPT = 0x9ef44b;
// Original state record layout (src/data/lz-streams.mjs).
const STATE_FLAGS = 1,
  STATE_COUNT = 2,
  STATE_HOLDER = 3,
  UNOWNED_HOLDER = WORD_MASK;
// Exact initial state of actor 18A3; script 28D tests its unavailable bit.
const BULLETPROOF_VEST_RECORD = WRAM + 0x381e,
  VEST_UNAVAILABLE_STATE = 0x0100;
// Dialog 67 and topic 20 in assets/vm-dialogs.json (docs/BUGFIXES.md).
const PUSHKIN_DIALOG = 67,
  HEAD_COMPUTER_TOPIC = 20,
  TOPIC_LIST_END = BYTE_MASK;
// Script 386 sets the defeat bit; 80:9D7A uses the removed holder value.
const VAMPIRE_OBJECT = 0x0188,
  VAMPIRE_DEFEATED = 0x40,
  REMOVED_HOLDER = 0x1538;

// fourSaveSlots (quality of life, docs/SAVING.md): 16 KiB SRAM and four slots
// in the title and bed menus. Settings and recordings without the key keep
// the original two slots.
// instantText (quality of life, docs/INSTANT-TEXT.md): window and dialog text
// transfers run without waiting for frames. Recordings without the key keep
// the original timing; stored browser settings without it get the default.
// fluidControls (controls, docs/CONTROLS.md): the mouse keeps moving the crosshair and
// the spell pointer while the original's player control pauses (after a shot).
// Recordings without the key keep the original handling; stored browser settings
// without it get the default.
export const DEFAULT_GAMEPLAY = Object.freeze({
  version: 1,
  bugfixes: true,
  preventExploits: false,
  fourSaveSlots: false,
  instantText: true,
  fluidControls: true,
});
export const ORIGINAL_GAMEPLAY = Object.freeze({
  version: 1,
  bugfixes: false,
  preventExploits: false,
  fourSaveSlots: false,
  instantText: false,
  fluidControls: false,
});

export function gameplaySettings(value = DEFAULT_GAMEPLAY) {
  if (
    !value ||
    value.version !== 1 ||
    typeof value.bugfixes !== 'boolean' ||
    typeof value.preventExploits !== 'boolean' ||
    !['boolean', 'undefined'].includes(typeof value.fourSaveSlots) ||
    !['boolean', 'undefined'].includes(typeof value.instantText) ||
    !['boolean', 'undefined'].includes(typeof value.fluidControls)
  )
    throw new VmFault('gameplay_settings_required');
  return Object.freeze({
    version: 1,
    bugfixes: value.bugfixes,
    preventExploits: value.preventExploits,
    fourSaveSlots: value.fourSaveSlots === true,
    instantText: value.instantText === true,
    fluidControls: value.fluidControls === true,
  });
}

export function storedGameplay(text) {
  try {
    const value = JSON.parse(text);
    return gameplaySettings({
      ...value,
      instantText: value?.instantText ?? DEFAULT_GAMEPLAY.instantText,
      fluidControls: value?.fluidControls ?? DEFAULT_GAMEPLAY.fluidControls,
    });
  } catch {
    return DEFAULT_GAMEPLAY;
  }
}

export const fixesEnabled = (a) => a.vm?.gameplay?.bugfixes === true;
export const fourSaveSlots = (a) => a.vm?.gameplay?.fourSaveSlots === true;

// Correct the two erroneous stores in 80:9D50 to reads of the defaults.
// Both 9CE4 and 9D15 reach this helper. X is eight times the runner index.
export function restoreDefaultWeapon(h) {
  const { a, ctx } = h;
  h.load(h.longRead(h.abs(RUNNER_DEFAULT_WEAPON) + ctx.x));
  h.longWrite(WRAM + RUNNER_WEAPON + ctx.x, ctx.a);
  h.load(h.longRead(h.abs(RUNNER_DEFAULT_WEAPON_KIND_DAMAGE) + ctx.x));
  h.longWrite(WRAM + RUNNER_WEAPON_KIND + ctx.x, ctx.a);
  h.load(a.read(h.abs(RUNNER_DEFAULT_WEAPON_RANGE) + ctx.x), 1);
  h.longWrite(WRAM + RUNNER_WEAPON_RANGE + ctx.x, ctx.a, 1);
}

// 2DE6 is the last WORD index, including Jake. Four WORDs fit in each
// roster column. Script 162 uses the same Charisma thresholds at hire time.
export function canAkimiJoin(a) {
  const last = a.readWord(WRAM + GROUP_INDEX),
    charisma = a.read(WRAM + JAKE_CHARISMA);
  const limit =
    charisma <= CHARISMA_ONE_FOLLOWER_MAX
      ? GROUP_ONE_FOLLOWER_LAST_INDEX
      : charisma <= CHARISMA_TWO_FOLLOWERS_MAX
        ? GROUP_TWO_FOLLOWERS_LAST_INDEX
        : GROUP_THREE_FOLLOWERS_LAST_INDEX;
  return last >= 0 && !(last & 1) && last < limit;
}

// Only the arrival proxy (script 38C) may defer a paid reservation. Other
// readers, notably the video phone menu, must still see the hired flag.
export function akimiArrivalFlags(a, object, flags) {
  if (
    !fixesEnabled(a) ||
    object !== AKIMI_OBJECT ||
    !(flags & AKIMI_RESERVED) ||
    flags & AKIMI_ARRIVED
  )
    return flags;
  const slot = a.readWord(TASK_CURSOR),
    frame = a.readWord(TASK_FRAME + slot);
  if (
    a.readWord(frame) !== (AKIMI_ARRIVAL_SCRIPT & WORD_MASK) ||
    a.read(frame + 2) !== AKIMI_ARRIVAL_SCRIPT >>> WORD_BITS ||
    canAkimiJoin(a)
  )
    return flags;
  // The proxy leaves without consuming the reservation. Revisiting Daley
  // Station after making room retries the original arrival sequence.
  return flags & (BYTE_MASK ^ AKIMI_RESERVED);
}

// Only the original unavailable, unowned shop record is eligible. Purchases
// move its holder; importing or loading them must never restock the item.
export function unlockBulletproofVest(a) {
  if (
    fixesEnabled(a) &&
    a.readWord(BULLETPROOF_VEST_RECORD) === VEST_UNAVAILABLE_STATE &&
    a.read(BULLETPROOF_VEST_RECORD + STATE_COUNT) === 0 &&
    a.readWord(BULLETPROOF_VEST_RECORD + STATE_HOLDER) === UNOWNED_HOLDER
  )
    a.write(BULLETPROOF_VEST_RECORD + STATE_FLAGS, 0);
}

// 3CA3 holds a sorted, FF-terminated list; 3CD6 holds its parallel flags.
// Teach Head Computer at Pushkin, preserving the existing Raitsov route.
export function preparePushkinTopics(a, dialog) {
  if (!fixesEnabled(a) || dialog !== PUSHKIN_DIALOG) return;
  const base = WRAM + TOPIC_LIST,
    flags = WRAM + TOPIC_FLAGS,
    capacity = flags - base;
  let end = 0;
  while (end < capacity && a.read(base + end) !== TOPIC_LIST_END) end++;
  if (end === capacity) throw new VmFault('gameplay_topic_list_required');
  let at = 0;
  while (at < end && a.read(base + at) < HEAD_COMPUTER_TOPIC) at++;
  if (at < end && a.read(base + at) === HEAD_COMPUTER_TOPIC) {
    a.write(flags + at, 0);
    return;
  }
  if (end + 1 >= capacity) throw new VmFault('gameplay_topic_list_full');
  for (let i = end; i > at; i--) {
    a.write(base + i, a.read(base + i - 1));
    a.write(flags + i, a.read(flags + i - 1));
  }
  a.write(base + end + 1, TOPIC_LIST_END);
  a.write(base + at, HEAD_COMPUTER_TOPIC);
  a.write(flags + at, 0);
}

// Script 06C resets the Vampire's state while setting up the Jester fight.
// Preserve an actual defeat (bit 40) and use the original removed-holder
// sentinel (9D7A) so A3B6 cannot instantiate him again after the portal.
export function keepVampireDefeated(a, object, value, record) {
  if (!a.vm?.gameplay?.preventExploits || object !== VAMPIRE_OBJECT || value !== 0) return false;
  if (!(a.read(WRAM + STATE_FLAGS + record) & VAMPIRE_DEFEATED)) return false;
  a.writeWord(WRAM + STATE_HOLDER + record, REMOVED_HOLDER);
  return true;
}
