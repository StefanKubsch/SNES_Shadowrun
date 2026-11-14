// Recording of a browser session for replay (docs/STRATEGY.md, recording for the user's test
// run). The live game is deterministic for a given start: the seed of the H/V counter substitute,
// the start SRAM and the raw inputs at each pad read (the mouse control in mouse-control.mjs
// derives its WRAM writes from them and from the game state). So the recording holds those raw
// inputs as a change list per pad read, plus a WRAM hash every CHECK_EVERY NMIs, so that a
// replay finds the first point where it differs.
//
// Raw input at a pad read: word (pad bits), keys (keyboard directions and A/X), mouse
// (sequence<<16 | y<<8 | x), buttons (pad bits of the mouse | left<<16 | right<<17 | back<<18)
// and wheel (sum of the wheel steps); the same packing as the shared memory (shared-input.mjs).
import { LiveGame } from '../video/live-game.mjs';
import { counterBytes } from '../vm/frame-events.mjs';
import { MouseControl } from './mouse-control.mjs';
import { PAD_BIT, DIRECTIONS } from './controls.mjs';
import {
  BACK_HELD,
  MOUSE_BUTTON_SHIFT,
  MOUSE_BUTTONS_MASK,
  MOUSE_COUNTER_SHIFT,
  MOUSE_Y_SHIFT,
} from './shared-input.mjs';
import { toBase64, fromBase64 } from './save-file.mjs';
import { fnv1a } from '../data/fnv.mjs';
import { gameplaySettings, ORIGINAL_GAMEPLAY } from '../game/bugfixes.mjs';
import {
  DEBUG_ROOM_EVENT,
  DEBUG_ROOM_UNLOCK_EVENT,
  unlockDebugRoom,
  warpToDebugRoom,
} from './debug-room.mjs';
import { SAVE_SLOT_EVENTS, saveToSlot } from '../game/save-anywhere.mjs';
import { CREDITS_EVENT, requestCredits } from '../game/credits.mjs';
import { BYTE_MASK, WORD_MASK } from '../constants/bits.mjs';
import { LANGUAGES, ENGLISH } from '../data/language.mjs';
import { CHEAT_EVENTS } from '../game/cheat-settings.mjs';
import { applyCheats } from '../game/cheats.mjs';

// A text language switch of the page (src/data/language.mjs), applied at a pad read.
export const languageEvent = (code) => 'language-' + code;

// Page events that change the game themselves (debug-room.mjs, save-anywhere.mjs, credits.mjs) are kept as
// [read, name]: they take effect before that pad read. Recordings without events stay valid.
const EVENTS = new Map([
  ...CHEAT_EVENTS.map((name, mask) => [
    name,
    (game) => {
      game.vm.cheats = mask;
    },
  ]),
  [DEBUG_ROOM_EVENT, (game) => warpToDebugRoom(game.memory.wram)],
  [DEBUG_ROOM_UNLOCK_EVENT, (game) => unlockDebugRoom(game.memory.wram)],
  [CREDITS_EVENT, (game) => requestCredits(game.vm)],
  ...SAVE_SLOT_EVENTS.map((name, slot) => [name, (game) => saveToSlot(game, slot)]),
  ...LANGUAGES.map((code) => [languageEvent(code), (game) => game.setLanguage(code)]),
]);
const RECORDING_FORMAT = 'shadowrun-recording-1',
  CHECK_EVERY = 1000;
export const unpackInput = (word, keys, mouse, buttons, wheel) => ({
  word,
  keyDirections: keys & DIRECTIONS,
  keyButtons: keys & (PAD_BIT.A | PAD_BIT.X),
  mouse: {
    seq: mouse >>> MOUSE_COUNTER_SHIFT,
    x: mouse & BYTE_MASK,
    y: (mouse >> MOUSE_Y_SHIFT) & BYTE_MASK,
  },
  mouseBits: buttons & WORD_MASK,
  buttons: (buttons >> MOUSE_BUTTON_SHIFT) & MOUSE_BUTTONS_MASK, // MOUSE_LEFT and MOUSE_RIGHT as bits 0 and 1
  back: !!(buttons & BACK_HELD),
  wheel,
});
// FNV-1a over the WRAM.
export const wramHash = fnv1a;

export class Recorder {
  constructor(seed, sram, gameplay = ORIGINAL_GAMEPLAY, language = ENGLISH) {
    this.gameplay = gameplaySettings(gameplay);
    this.language = language;
    this.seed = seed;
    this.sram = sram ? sram.slice() : null;
    this.inputs = [];
    this.events = [];
    this.checks = [];
    this.reads = 0;
    this.last = null;
    this.nmis = 0;
  }
  // A page event applied just before the next pad read.
  event(name) {
    this.events.push([this.reads, name]);
  }
  // One pad read at NMI k with the raw input values.
  input(k, values) {
    const changed = !this.last || values.some((v, i) => v !== this.last[i]);
    if (changed) {
      this.inputs.push([this.reads, k, ...values]);
      this.last = values.slice();
    }
    this.reads++;
  }
  frame(nmi, wram) {
    this.nmis = nmi;
    if (nmi % CHECK_EVERY === 0) this.checks.push([nmi, wramHash(wram)]);
  }
  toJSON() {
    return {
      format: RECORDING_FORMAT,
      gameplay: this.gameplay,
      language: this.language,
      seed: this.seed,
      sram: this.sram ? toBase64(this.sram) : null,
      reads: this.reads,
      nmis: this.nmis,
      inputs: this.inputs,
      events: this.events,
      checks: this.checks,
    };
  }
}

export function parseRecording(text) {
  const data = JSON.parse(text);
  if (data?.format !== RECORDING_FORMAT)
    throw new Error('Not a Shadowrun recording (' + RECORDING_FORMAT + ').');
  const events = data.events ?? [],
    language = data.language ?? ENGLISH;
  if (
    !Number.isInteger(data.seed) ||
    !Array.isArray(data.inputs) ||
    !Array.isArray(data.checks) ||
    !Array.isArray(events) ||
    !LANGUAGES.includes(language) ||
    events.some((e) => !Number.isInteger(e?.[0]) || !EVENTS.has(e[1]))
  )
    throw new Error('Damaged recording.');
  const gameplay = gameplaySettings(
    data.gameplay === undefined ? ORIGINAL_GAMEPLAY : data.gameplay,
  );
  return { ...data, gameplay, language, events, sram: data.sram ? fromBase64(data.sram) : null };
}

// Replays a recording on the cartridge data up to NMI until (default: its end). Returns the game,
// the NMIs reached, the first check that differs ({nmi, expected, actual}) and the first pad read
// whose NMI differs from the recorded one (the replay left the recorded path there). With stop the
// replay ends at the first differing check.
export function replayRecording(
  cartridge,
  recording,
  { until = recording.nmis, stop = false, onFrame = null, languages = {} } = {},
) {
  const inputs = recording.inputs,
    events = recording.events ?? [],
    checks = new Map(recording.checks);
  let read = 0,
    next = 0,
    nextEvent = 0,
    values = [0, 0, 0, 0, 0],
    control = null,
    game = null,
    mismatch = null,
    offPath = null;
  game = new LiveGame(cartridge, {
    gameplay: recording.gameplay === undefined ? ORIGINAL_GAMEPLAY : recording.gameplay,
    languages,
    language: recording.language ?? ENGLISH,
    counter: counterBytes(recording.seed),
    sram: recording.sram ? recording.sram.slice() : null,
    pad: (k) => {
      while (nextEvent < events.length && events[nextEvent][0] <= read)
        EVENTS.get(events[nextEvent++][1])(game);
      applyCheats(game);
      while (next < inputs.length && inputs[next][0] <= read) {
        const [at, nmi, ...v] = inputs[next];
        if (at === read && nmi !== k && !offPath) offPath = { read, expected: nmi, actual: k };
        values = v;
        next++;
      }
      read++;
      return control.pad(k, unpackInput(...values));
    },
    onFrame: (f) => {
      const expected = checks.get(f.nmi);
      if (expected !== undefined && !mismatch) {
        const actual = wramHash(game.memory.wram);
        if (actual !== expected) mismatch = { nmi: f.nmi, expected, actual };
      }
      onFrame?.(f);
    },
  });
  control = new MouseControl(game);
  while (game.nmis < until && !(stop && mismatch)) game.step();
  return { game, nmis: game.nmis, mismatch, offPath };
}
