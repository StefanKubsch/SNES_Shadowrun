// Game in the worker: cold start live from the reset (src/video/live-game.mjs). Each
// picture goes to the page while computing, with the sound pairs since the previous
// picture; the page buffers and shows them at 50 Hz.
//
// Boot, intro, title and menu run in synchronous sections (one step over up to about
// 140 NMIs). With shared memory (page with cross-origin isolation) the worker therefore
// waits at each NMI until the page has at most LEAD pictures in stock, and reads the pad
// word where the original reads it (9E13 in the NMI): a section also runs in real time
// with the held key. Without shared memory the worker computes ahead as far as the last
// section was long, and the page reports the pad word and the pictures shown by message
// (inputs in sections then act up to about three seconds later).
import { LiveGame } from '../video/live-game.mjs';
import { SoundtrackApu } from '../apu/soundtrack-apu.mjs';
import { counterBytes } from '../vm/frame-events.mjs';
import { MouseControl } from './mouse-control.mjs';
import { SaveWatch, saveHash } from './save-file.mjs';
import { Recorder, unpackInput } from './recording.mjs';
import { DEBUG_ROOM_EVENT, debugRoomReachable, warpToDebugRoom } from './debug-room.mjs';
import { SHARED_SHOWN, SHARED_CHEATS, INPUT_WORDS } from './shared-input.mjs';
import { CHEAT_EVENTS, cheatMask } from '../game/cheat-settings.mjs';
import { applyCheats } from '../game/cheats.mjs';
import { gameplaySettings } from '../game/bugfixes.mjs';
import { SAVE_SLOT_EVENTS, saveAnywhereReachable, saveToSlot } from '../game/save-anywhere.mjs';
import { saveSlotCount } from '../game/save-slots.mjs';
import {
  drawObjectMarkers,
  markerPulse,
  markersAllowed,
  usableObjectBoxes,
} from '../video/object-markers.mjs';
import { buildLanguage, LANGUAGES, ENGLISH } from '../data/language.mjs';
import { languageEvent } from './recording.mjs';

// Lead growth after a step that produced several pictures (in MIN_LEAD units).
const LEAD_GROWTH = 4;
// Longest wait for the page to show a picture before checking again.
const SHOWN_WAIT_MS = 1000;
// Audio buffer of the APU output in frames (see enableOutput below).
const AUDIO_BUFFER_FRAMES = 256;
// LEAD: at most this many pictures ahead of the display (user rule: as little input
// delay as possible, in all situations); 2 pictures are 40 ms.
const LEAD = 2,
  MIN_LEAD = 3,
  MAX_LEAD = 160,
  SLICE_MS = 12;
let game = null,
  control = null,
  watch = null,
  recorder = null,
  shared = null,
  debugRoom = false,
  saveSlot = -1,
  markers = false,
  cheats = 0,
  // Text languages built from the page's assets (src/data/language.mjs) and a
  // switch waiting for the next pad read.
  languages = {},
  pendingLanguage = null,
  pad = 0,
  keys = 0,
  mouse = 0,
  buttons = 0,
  wheel = 0,
  produced = 0,
  consumed = 0,
  lead = MIN_LEAD,
  timer = null,
  failed = false;
const shown = () => (shared ? Atomics.load(shared, SHARED_SHOWN) : consumed);
function pump() {
  timer = null;
  if (!game || failed) return;
  const started = performance.now();
  try {
    while ((shared || produced - consumed < lead) && performance.now() - started < SLICE_MS) {
      const before = game.nmis;
      game.step();
      const size = game.nmis - before;
      if (!shared)
        lead =
          size > 2
            ? Math.min(MAX_LEAD, size + MIN_LEAD * LEAD_GROWTH)
            : Math.max(MIN_LEAD, lead - 1);
    }
  } catch (error) {
    failed = true;
    // The message names the address of a VmFault (such as rom_byte_absent) for the user's report.
    self.postMessage({ error: error.message });
    return;
  }
  if (shared || produced - consumed < lead) timer = setTimeout(pump, 0);
}
self.onmessage = ({ data }) => {
  try {
    if (data.command === 'start') {
      const gameplay = gameplaySettings(data.gameplay);
      markers = data.markers === true;
      cheats = cheatMask(data.cheats);
      const language = LANGUAGES.includes(data.language) ? data.language : ENGLISH;
      if (language !== ENGLISH) languages[language] = buildLanguage(data.languageAsset);
      shared = data.shared ? new Int32Array(data.shared) : null;
      // Each session draws its own start value for the H/V counter substitute.
      const seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
      // Mouse and back key (mouse-control.mjs) add their buttons and the glove position at the pad read.
      // The raw input of each read goes to the session recording (recording.mjs) first.
      // A requested debug room warp (debug-room.mjs) happens at the next pad read and is recorded there,
      // provided Jake can move freely then; otherwise the page gets a refusal.
      const padAt = (k) => {
        const mask = shared ? cheatMask(Atomics.load(shared, SHARED_CHEATS)) : cheats;
        if (mask !== (game.vm.cheats ?? 0)) {
          recorder.event(CHEAT_EVENTS[mask]);
          game.vm.cheats = mask;
        }
        if (debugRoom) {
          debugRoom = false;
          const reachable = debugRoomReachable(game);
          if (reachable) {
            recorder.event(DEBUG_ROOM_EVENT);
            warpToDebugRoom(game.memory.wram);
          }
          self.postMessage({ debugRoom: reachable });
        }
        // Save anywhere (save-anywhere.mjs): the original slot save at this pad read, recorded
        // as an event; SaveWatch then hands the new SRAM to the page as after a bed save.
        if (saveSlot >= 0) {
          const slot = saveSlot,
            reachable = saveAnywhereReachable(game);
          saveSlot = -1;
          if (reachable) {
            recorder.event(SAVE_SLOT_EVENTS[slot]);
            saveToSlot(game, slot);
          }
          self.postMessage({ savedSlot: reachable ? slot : -1 });
        }
        // Text language (language.mjs): switched at this pad read and recorded as an event.
        if (pendingLanguage) {
          recorder.event(languageEvent(pendingLanguage));
          game.setLanguage(pendingLanguage);
          pendingLanguage = null;
        }
        applyCheats(game);
        const values = shared
          ? INPUT_WORDS.map((i) => Atomics.load(shared, i))
          : [pad, keys, mouse, buttons, wheel];
        recorder.input(k, values);
        return control.pad(k, unpackInput(...values));
      };
      recorder = new Recorder(
        seed,
        data.sram ? new Uint8Array(data.sram) : null,
        gameplay,
        language,
      );
      // The page's stored save (save-file.mjs) is the cartridge SRAM; whatever the game saves goes back to it.
      // Game data from the data package (src/data/cartridge.mjs): ROM address view and present bytes.
      game = new LiveGame(
        {
          rom: new Uint8Array(data.rom),
          present: new Uint8Array(data.present),
          textEdits: data.textEdits,
        },
        {
          gameplay,
          languages,
          language,
          apu: new SoundtrackApu(),
          pad: padAt,
          counter: counterBytes(seed),
          sram: data.sram ? new Uint8Array(data.sram) : null,
          onFrame: (f) => {
            recorder.frame(f.nmi, game.memory.wram);
            // Object markers (object-markers.mjs): display only, after the recording's check.
            if (markers && markersAllowed(game)) {
              const pulse = markerPulse(f.nmi);
              if (pulse > 0) drawObjectMarkers(f.pixels, usableObjectBoxes(game.memory), pulse);
            }
            const save = watch.check();
            if (save) self.postMessage({ save }, [save.buffer]);
            const audio = game.apu.takeOutput();
            const effects = game.apu.takeEffectsOutput(),
              music = game.apu.musicState();
            produced++;
            self.postMessage(
              {
                frame: true,
                pixels: f.pixels,
                nmi: f.nmi,
                audio,
                effects,
                music,
                glove: control.open,
                debugRoomAvailable: debugRoomReachable(game),
              },
              [f.pixels.buffer, audio.buffer, effects.buffer],
            );
            // Wait at the NMI until the page has shown enough (paused: until it continues).
            if (shared)
              for (let seen = shown(); produced - seen > LEAD; seen = shown())
                Atomics.wait(shared, SHARED_SHOWN, seen, SHOWN_WAIT_MS);
          },
        },
      );
      control = new MouseControl(game);
      watch = new SaveWatch(game.memory.sram);
      // Between two NMIs the title waits up to about 141 frames of audio time
      // for the sound driver without NMI; the buffer holds 256 frames.
      game.apu.enableOutput(AUDIO_BUFFER_FRAMES);
      self.postMessage({ ready: true, gameplay, save: saveHash(game.memory.sram) });
      pump();
      return;
    }
    if (data.command === 'recording' && recorder) {
      self.postMessage({ recording: JSON.stringify(recorder) });
      return;
    }
    if (data.command === 'markers') {
      markers = data.on === true;
      return;
    }
    if (data.command === 'cheats') {
      cheats = cheatMask(data.mask);
      return;
    }
    if (data.command === 'language') {
      if (!LANGUAGES.includes(data.language)) throw Error('Unknown language.');
      if (data.language !== ENGLISH && !languages[data.language])
        languages[data.language] = buildLanguage(data.asset);
      if (game) pendingLanguage = data.language;
      return;
    }
    if (data.command === 'debug-room' && game) {
      debugRoom = true;
      return;
    }
    if (data.command === 'save-slot' && game) {
      if (
        !Number.isInteger(data.slot) ||
        data.slot < 0 ||
        data.slot >= saveSlotCount({ vm: game.vm })
      )
        throw Error('Unknown save slot.');
      saveSlot = data.slot;
      return;
    }
    if (data.command !== 'consumed' || !game) throw Error('The game is not running yet.');
    // Without shared memory the page reports the frames shown and the pad word held now.
    consumed = data.consumed;
    pad = data.pad;
    keys = data.keys;
    mouse = data.mouse;
    buttons = data.buttons;
    wheel = data.wheel;
    if (!timer) timer = setTimeout(pump, 0);
  } catch (error) {
    // The page ends the session on any error, so the game stops too; otherwise it would
    // block waiting for frames and never answer the recording request.
    failed = true;
    self.postMessage({ error: error.message });
  }
};
