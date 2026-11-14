// Start page: the game data come from the data package (src/data/cartridge.mjs,
// docs/ROM-FREE.md), no ROM. "Start game" begins the cold start live from the
// reset in the worker (game-worker.mjs); the click also allows the sound output.
import { loadCartridge } from '../data/cartridge.mjs';
import { ENGLISH, GERMAN, loadLanguageAsset } from '../data/language.mjs';
import {
  BACK,
  BINDABLE,
  DIRECTIONS,
  PAD_BIT,
  RESERVED,
  bind,
  bitsFor,
  captureInput,
  cleanPad,
  gamepadBits,
  keyInputs,
  parseBindings,
} from './controls.mjs';
import {
  SAVE_KEY,
  SAVE_EXTRA_KEY,
  importSave,
  mergeSave,
  storedSave,
  saveHash,
  saveToText,
} from './save-file.mjs';
import {
  SHARED_PAD,
  SHARED_SHOWN,
  SHARED_KEYS,
  SHARED_MOUSE,
  SHARED_BUTTONS,
  SHARED_WHEEL,
  SHARED_CHEATS,
  SHARED_WORDS,
  MOUSE_LEFT,
  MOUSE_RIGHT,
  BACK_HELD,
  MOUSE_COUNTER_MASK,
  MOUSE_COUNTER_SHIFT,
  MOUSE_Y_SHIFT,
} from './shared-input.mjs';
import { FNV_OFFSET, fnv1a } from '../data/fnv.mjs';
import { DSP_SAMPLE_RATE } from './audio-output.mjs';
import { TributePlayer, tributeVolume } from './tribute-player.mjs';
import { TributeCache } from './tribute-cache.mjs';
import { createCrt } from '../crt/crt.mjs';
import { createBezel } from './bezel.mjs';
import { createStartScreen } from './start-screen.mjs';
import { createManual } from './manual.mjs';
import { createCheats } from './cheats.mjs';
import { createAudioSettings } from './audio-settings.mjs';
import { createOverlayDialog } from './overlay-dialog.mjs';
import { controlName, menuText, translateMenu } from './ui-language.mjs';
import {
  CONTROL_ACTIONS,
  CONTROL_MOUSE_HELP,
  controlBindingLabel,
  resolveControlText,
} from './control-help.mjs';
import { parseControls } from '../crt/controls.mjs';
import { SNES_PAL_RGB, SONY_PVM_20M2E } from '../crt/profiles.mjs';
import { storedGameplay } from '../game/bugfixes.mjs';
import { WORD_MASK } from '../constants/bits.mjs';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../constants/ppu.mjs';
import { FOUR_SAVE_SLOTS, ORIGINAL_SAVE_SLOTS, occupiedSlots } from '../game/save-slots.mjs';
import { SRAM_SIZE, SRAM_SIZE_FOUR_SLOTS } from '../vm/memory.mjs';

const LANGUAGE_KEY = 'shadowrun.language.1';
let language = readStored(LANGUAGE_KEY) === GERMAN ? GERMAN : ENGLISH;
const t = (key, values) => menuText(language, key, values);
const stateText = (enabled) => t(enabled ? 'on' : 'off');
const PERCENT = 100;
// Delay before a download link's object URL is released.
const DOWNLOAD_URL_LIFETIME_MS = 1000;
// One wheel step: three lines or 100 pixels of scroll distance.
const WHEEL_LINES_PER_STEP = 3,
  WHEEL_PIXELS_PER_STEP = 100;
// Picture pacing: resynchronise when more than MAX_FRAMES_BEHIND pictures are
// due, and show at most MAX_FRAMES_PER_TICK queued pictures per animation frame.
const MAX_FRAMES_BEHIND = 8,
  MAX_FRAMES_PER_TICK = 4;
const status = document.querySelector('#status'),
  loadingProgress = document.querySelector('#loading-progress'),
  canvas = document.querySelector('#screen');
// Picture output (docs/CRT-FILTER.md): CRT picture on (default) or off, the choice stays in the browser; F9 or the button toggles.
const CRT_KEY = 'shadowrun.crt.1',
  crtButton = document.querySelector('#crt');
const CRT_CONTROLS_KEY = 'shadowrun.crt.controls.1',
  crtSettings = document.querySelector('#crt-settings');
const crtSliders = [...crtSettings.querySelectorAll('input[type="range"]')];
const crt = createCrt(canvas, {
  source: SNES_PAL_RGB,
  monitor: SONY_PVM_20M2E,
  enabled: readStored(CRT_KEY) !== 'off',
  controls: parseControls(readStored(CRT_CONTROLS_KEY)),
});
canvas.crt = crt;
const BEZEL_KEY = 'shadowrun.crt.bezel.1';
const bezel = createBezel(
  document.querySelector('#monitor'),
  document.querySelector('#pvm-bezel'),
  document.querySelector('#bezel'),
  {
    enabled: readStored(BEZEL_KEY) !== 'off',
    onChange: (enabled) => writeStored(BEZEL_KEY, enabled ? 'on' : 'off'),
    label: (enabled) => t('bezel', { state: stateText(enabled) }),
  },
);
function showCrt() {
  canvas.dataset.crt = crt.enabled ? 'on' : 'off';
  bezel.sync(crt);
  crtButton.hidden = !crt.available;
  crtButton.setAttribute('aria-pressed', String(crt.enabled));
  crtButton.textContent = t('crt', { state: stateText(crt.enabled) });
  crtSettings.hidden = !crt.available;
  crtSettings.querySelector('fieldset').disabled = !crt.enabled;
  for (const slider of crtSliders) {
    const name = slider.name,
      value = Math.round(crt.controls[name] * Number(slider.dataset.scale));
    slider.value = String(value);
    document.querySelector('#' + slider.id + '-value').value =
      (name === 'brightness' && value > 0 ? '+' : '') + value + '%';
  }
}
function toggleCrt() {
  crt.setEnabled(!crt.enabled);
  writeStored(CRT_KEY, crt.enabled ? 'on' : 'off');
  showCrt();
  monitorUi.refresh();
}
crtButton.addEventListener('click', () => {
  toggleCrt();
  crtButton.blur();
});
for (const slider of crtSliders)
  slider.addEventListener('input', () => {
    crt.setControls({ [slider.name]: Number(slider.value) / Number(slider.dataset.scale) });
    writeStored(CRT_CONTROLS_KEY, JSON.stringify(crt.controls));
    showCrt();
  });
document.querySelector('#crt-reset').addEventListener('click', () => {
  crt.setControls(parseControls(null));
  writeStored(CRT_CONTROLS_KEY, null);
  showCrt();
});
showCrt();
// Resize the whole monitor in layout so the CRT renders at the chosen resolution
// and pointer coordinates still follow the canvas. Fullscreen uses its own fit.
const WINDOW_ZOOM_KEY = 'shadowrun.window.zoom.1',
  windowZoomButton = document.querySelector('#window-zoom');
let windowZoom = readStored(WINDOW_ZOOM_KEY) === '2' ? 2 : 1;
function showWindowZoom() {
  document.documentElement.style.setProperty('--window-zoom', String(windowZoom));
  windowZoomButton.textContent = t('zoom', { value: windowZoom * PERCENT });
  windowZoomButton.setAttribute('aria-pressed', String(windowZoom === 2));
}
windowZoomButton.addEventListener('click', () => {
  windowZoom = windowZoom === 1 ? 2 : 1;
  writeStored(WINDOW_ZOOM_KEY, String(windowZoom));
  showWindowZoom();
  windowZoomButton.blur();
});
showWindowZoom();
// Full screen: the game picture fills the screen height in device pixels (there the
// output carries beam and mask). Esc is the back key in the game: with the Keyboard
// Lock API (Edge, Chrome) a short Esc goes to the game, only a held Esc ends the full
// screen. Without it Esc ends the full screen as usual in the browser.
const frame = document.querySelector('#frame'),
  fullscreenButton = document.querySelector('#fullscreen');
fullscreenButton.hidden = !frame.requestFullscreen;
fullscreenButton.addEventListener('click', async () => {
  fullscreenButton.blur();
  closeMenu();
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await frame.requestFullscreen();
  } catch {
    return;
  }
  try {
    await navigator.keyboard.lock(['Escape']);
    frame.dataset.escape = 'game';
  } catch {
    frame.dataset.escape = 'browser';
  }
});
document.addEventListener('fullscreenchange', () => {
  showFullscreen();
  if (document.fullscreenElement) return;
  navigator.keyboard?.unlock?.();
  delete frame.dataset.escape;
});
function showFullscreen() {
  fullscreenButton.textContent = t(document.fullscreenElement ? 'exitFullscreen' : 'fullscreen');
}
// Menu: the burger button opens the panel with all other controls; Close, the button again or a
// click outside closes it.
const menu = document.querySelector('#menu'),
  menuToggle = document.querySelector('#menu-toggle');
// All options remain descendants of the fullscreen element.
frame.append(menu);
function closeMenu() {
  menu.hidden = true;
  menuToggle.setAttribute('aria-expanded', 'false');
}
menuToggle.addEventListener('click', (event) => {
  event.stopPropagation();
  menuToggle.blur();
  menu.hidden = !menu.hidden;
  menuToggle.setAttribute('aria-expanded', String(!menu.hidden));
});
document.querySelector('#menu-close').addEventListener('click', closeMenu);
addEventListener('click', (event) => {
  // A settings handler may replace its clicked row before this event bubbles here.
  if (!menu.hidden && !event.composedPath().includes(menu) && event.target !== menuToggle)
    closeMenu();
});
const start = document.querySelector('#start');
const monitorUi = createStartScreen({
  canvas,
  crt,
  source: SNES_PAL_RGB,
  logo: document.querySelector('#start-logo'),
  title: document.querySelector('h1'),
  start,
  status,
  progress: loadingProgress,
});
let cartridge = null,
  worker = null,
  live = null,
  audio = null,
  shared = null;
const ANALOG_AUDIO_KEY = 'shadowrun.audio.analog.1',
  AUDIO_PROFILE_KEY = 'shadowrun.audio.profile.1';
const SOUNDTRACK_KEY = 'shadowrun.soundtrack.1',
  TRIBUTE_VOLUME_KEY = 'shadowrun.soundtrack.volume.1',
  soundtrackButton = document.querySelector('#soundtrack'),
  tributeVolumeSlider = document.querySelector('#tribute-volume'),
  tributeVolumeValue = document.querySelector('#tribute-volume-value'),
  soundtrackStatus = document.querySelector('#soundtrack-status');
let tributeEnabled = readStored(SOUNDTRACK_KEY) !== 'original';
const tributeCache = new TributeCache();
let musicVolume = tributeVolume(readStored(TRIBUTE_VOLUME_KEY));
function showSoundtrack() {
  soundtrackButton.setAttribute('aria-pressed', String(tributeEnabled));
  soundtrackButton.textContent = t('soundtrack', {
    name: t(tributeEnabled ? 'tribute' : 'original'),
  });
  showSoundtrackStatus();
}
function showSoundtrackStatus() {
  const state = audio?.trackState;
  soundtrackStatus.textContent =
    !tributeEnabled || !state
      ? ''
      : state.error ||
        (!state.playing
          ? ''
          : state.paused
            ? t('musicPaused')
            : !state.track
              ? t('musicOriginal')
              : state.active
                ? state.track.name
                : t('musicLoading'));
}
soundtrackButton.addEventListener('click', () => {
  tributeEnabled = !tributeEnabled;
  writeStored(SOUNDTRACK_KEY, tributeEnabled ? 'tribute' : 'original');
  if (tributeEnabled) tributeCache.preload();
  else tributeCache.cancel();
  audio?.tribute?.setEnabled(tributeEnabled);
  showSoundtrack();
  soundtrackButton.blur();
});
showSoundtrack();
function showTributeVolume() {
  tributeVolumeSlider.value = String(Math.round(musicVolume * PERCENT));
  tributeVolumeValue.value = tributeVolumeSlider.value + '%';
}
tributeVolumeSlider.addEventListener('input', () => {
  musicVolume = Number(tributeVolumeSlider.value) / PERCENT;
  writeStored(TRIBUTE_VOLUME_KEY, String(musicVolume));
  audio?.tribute?.setVolume(musicVolume);
  showTributeVolume();
});
showTributeVolume();
if (tributeEnabled) tributeCache.preload();
addEventListener('pagehide', (event) => {
  if (!event.persisted) tributeCache.close();
});
// Object markers (src/video/object-markers.mjs): display only, so the choice
// applies at once, also to a running game, and is not part of the recording.
const MARKERS_KEY = 'shadowrun.markers.1',
  markersButton = document.querySelector('#object-markers');
let markersEnabled = readStored(MARKERS_KEY) === 'on';
function showMarkers() {
  markersButton.setAttribute('aria-pressed', String(markersEnabled));
  markersButton.textContent = t('markers', { state: stateText(markersEnabled) });
}
markersButton.addEventListener('click', () => {
  markersEnabled = !markersEnabled;
  writeStored(MARKERS_KEY, markersEnabled ? 'on' : 'off');
  worker?.postMessage({ command: 'markers', on: markersEnabled });
  showMarkers();
  markersButton.blur();
});
showMarkers();
// Gameplay choices belong to a complete session and its recording. A running
// session keeps them fixed; a reload permits choosing the original behaviour.
const GAMEPLAY_KEY = 'shadowrun.gameplay.1',
  bugfixButton = document.querySelector('#bugfixes'),
  exploitButton = document.querySelector('#prevent-exploits'),
  slotsButton = document.querySelector('#four-save-slots'),
  instantTextButton = document.querySelector('#instant-text'),
  fluidControlsButton = document.querySelector('#fluid-controls');
let gameplay = storedGameplay(readStored(GAMEPLAY_KEY));
function showGameplay(locked = false) {
  for (const [button, key, label] of [
    [bugfixButton, 'bugfixes', t('bugfixes')],
    [exploitButton, 'preventExploits', t('preventExploits')],
    [slotsButton, 'fourSaveSlots', t('fourSaveSlots')],
    [instantTextButton, 'instantText', t('instantText')],
    [fluidControlsButton, 'fluidControls', t('fluidControls')],
  ]) {
    button.disabled = locked;
    button.setAttribute('aria-pressed', String(gameplay[key]));
    button.textContent = label + ': ' + stateText(gameplay[key]);
  }
}
for (const [button, key] of [
  [bugfixButton, 'bugfixes'],
  [exploitButton, 'preventExploits'],
  [slotsButton, 'fourSaveSlots'],
  [instantTextButton, 'instantText'],
  [fluidControlsButton, 'fluidControls'],
])
  button.addEventListener('click', () => {
    gameplay = { ...gameplay, [key]: !gameplay[key] };
    writeStored(GAMEPLAY_KEY, JSON.stringify(gameplay));
    showGameplay();
    showSave();
    button.blur();
  });
showGameplay();
const asset = async (name) => {
  const response = await fetch(new URL(`../../assets/${name}`, import.meta.url));
  if (!response.ok) throw Error(`Game data missing: ${name}`);
  return new Uint8Array(await response.arrayBuffer());
};
// Text language (src/data/language.mjs): German replaces the game's texts.
// The choice applies at once, also to a running game; the worker records
// each switch so that a replay shows the same texts. Saved games stay the same.
const languageButton = document.querySelector('#language'),
  languageAssets = {},
  languageData = {};
const manualButton = document.querySelector('#manual-open');
const manual = createManual({
  frame,
  opener: manualButton,
  returnFocus: menuToggle,
  getBindings: () => bindings,
  onOpen() {
    closeMenu();
    clearGameInput();
    updatePauseState();
  },
  onClose() {
    clearGameInput();
    updatePauseState();
  },
});
manualButton.addEventListener('click', () => manual.open());
const cheatsButton = document.querySelector('#cheats-open');
const cheats = createCheats({
  frame,
  opener: cheatsButton,
  returnFocus: menuToggle,
  onOpen() {
    closeMenu();
    clearGameInput();
    updatePauseState();
  },
  onClose() {
    clearGameInput();
    updatePauseState();
  },
  onChange(mask) {
    if (shared) Atomics.store(shared, SHARED_CHEATS, mask);
    else worker?.postMessage({ command: 'cheats', mask });
  },
});
cheatsButton.addEventListener('click', () => cheats.open());
const audioSettingsButton = document.querySelector('#audio-settings-open');
const audioSettings = createAudioSettings({
  frame,
  opener: audioSettingsButton,
  returnFocus: menuToggle,
  soundtrackControls: document.querySelector('#audio-soundtrack'),
  enabled: readStored(ANALOG_AUDIO_KEY) !== 'off',
  profile: readStored(AUDIO_PROFILE_KEY),
  onOpen() {
    closeMenu();
    clearGameInput();
    updatePauseState();
  },
  onClose() {
    clearGameInput();
    updatePauseState();
  },
  onChange({ enabled, profile }) {
    writeStored(ANALOG_AUDIO_KEY, enabled ? 'on' : 'off');
    writeStored(AUDIO_PROFILE_KEY, profile);
    audio?.node?.port.postMessage({ command: 'audio-profile', profile });
    audio?.node?.port.postMessage({ command: 'analog-filter', enabled });
  },
});
audioSettingsButton.addEventListener('click', () => audioSettings.open());
const videoSettingsButton = document.querySelector('#video-settings-open');
const videoSettings = createOverlayDialog({
  id: 'video-settings',
  titles: { en: 'Graphics', de: 'Grafik' },
  frame,
  opener: videoSettingsButton,
  returnFocus: menuToggle,
  content: document.querySelector('#video-controls'),
  onOpen() {
    closeMenu();
    clearGameInput();
    updatePauseState();
  },
  onClose() {
    clearGameInput();
    updatePauseState();
  },
});
videoSettingsButton.addEventListener('click', () => videoSettings.open());
const controlsSettingsButton = document.querySelector('#controls-settings-open');
const controlsSettings = createOverlayDialog({
  id: 'controls-settings',
  titles: { en: 'Controls', de: 'Steuerung' },
  frame,
  opener: controlsSettingsButton,
  returnFocus: menuToggle,
  content: document.querySelector('#controls'),
  onKeyDown(event) {
    if (!capturing) return false;
    event.preventDefault();
    rebind(captureInput(event));
    return true;
  },
  onOpen() {
    closeMenu();
    clearGameInput();
    updatePauseState();
  },
  onClose() {
    capturing = null;
    showBindings();
    clearGameInput();
    updatePauseState();
  },
});
controlsSettingsButton.addEventListener('click', () => controlsSettings.open());
const [aboutProject, gameSettings, savesSettings, recordingSettings] = [
  ['about', 'about-project-content', { en: 'About this project', de: 'Über dieses Projekt' }],
  ['game', 'game-settings-controls', { en: 'Game', de: 'Spiel' }],
  ['saves', 'saves', { en: 'Save/load game', de: 'Spiel speichern/laden' }],
  ['recording', 'recording', { en: 'Recording', de: 'Aufzeichnung' }],
].map(([name, controlsId, titles]) => {
  const opener = document.querySelector(`#${name}-settings-open`),
    overlay = createOverlayDialog({
      id: `${name}-settings`,
      titles,
      frame,
      opener,
      returnFocus: menuToggle,
      content: document.getElementById(controlsId),
      contentClass: name === 'about' ? 'about-content' : 'settings-content',
      onOpen() {
        closeMenu();
        clearGameInput();
        updatePauseState();
      },
      onClose() {
        clearGameInput();
        updatePauseState();
      },
    });
  opener.addEventListener('click', () => overlay.open());
  return overlay;
});
const overlayOpen = () =>
  aboutProject.isOpen ||
  manual.isOpen ||
  cheats.isOpen ||
  audioSettings.isOpen ||
  videoSettings.isOpen ||
  controlsSettings.isOpen ||
  gameSettings.isOpen ||
  savesSettings.isOpen ||
  recordingSettings.isOpen;
// The asset of a language, loaded once; a failed load may be retried.
const languageAsset = (code) =>
  code === ENGLISH
    ? Promise.resolve(null)
    : (languageAssets[code] ??= loadLanguageAsset(asset, code).then(
        (data) => (languageData[code] = data),
        (error) => {
          delete languageAssets[code];
          throw error;
        },
      ));
function showLanguage() {
  languageButton.textContent = t('language');
  menu.lang = language;
  translateMenu(document, language);
  manual.setLanguage(language);
  cheats.setLanguage(language);
  audioSettings.setLanguage(language);
  videoSettings.setLanguage(language);
  controlsSettings.setLanguage(language);
  for (const overlay of [aboutProject, gameSettings, savesSettings, recordingSettings])
    overlay.setLanguage(language);
  showCrt();
  showWindowZoom();
  showFullscreen();
  showSoundtrack();
  showMarkers();
  showGameplay(bugfixButton.disabled);
  showBindings();
  showDebugRoom();
  showSave();
}
languageButton.addEventListener('click', async () => {
  const code = language === GERMAN ? ENGLISH : GERMAN;
  languageButton.blur();
  languageButton.disabled = true;
  try {
    const data = await languageAsset(code);
    language = code;
    writeStored(LANGUAGE_KEY, code);
    worker?.postMessage({ command: 'language', language: code, asset: data });
  } catch (error) {
    status.textContent = error.reason ?? error.message;
  } finally {
    languageButton.disabled = false;
    showLanguage();
  }
});
// Without the stored language's data the game starts in English.
const startLanguage = languageAsset(language).catch(() => {
  language = ENGLISH;
  showLanguage();
});
Promise.all([
  loadCartridge(asset, (completed, total) => {
    // The selected language is part of readiness, so reserve the final step.
    loadingProgress.max = total + 1;
    loadingProgress.value = completed;
    status.textContent = `Loading game data … ${Math.floor((completed / (total + 1)) * PERCENT)}%`;
  }),
  startLanguage,
]).then(
  ([data]) => {
    loadingProgress.value = loadingProgress.max;
    loadingProgress.hidden = true;
    cartridge = data;
    start.hidden = false;
    start.disabled = false;
    canvas.dataset.stage = 'data';
    status.textContent = 'Game data loaded.';
  },
  (error) => {
    loadingProgress.hidden = true;
    status.textContent = error.reason ?? error.message;
    canvas.dataset.error = error.reason ?? error.message;
  },
);
start.addEventListener('click', () => {
  if (!cartridge || live) return;
  start.disabled = true;
  showGameplay(true);
  delete canvas.dataset.ready;
  delete canvas.dataset.error;
  status.textContent = 'Starting the game …';
  worker?.terminate();
  worker = new Worker(new URL('./game-worker.mjs', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.error) {
      showFault(data.error);
      return;
    }
    if (data.save instanceof Uint8Array) {
      storeSave(data.save, savedSlot >= 0 ? t('savedSlot', { slot: savedSlot + 1 }) : t('saved'));
      savedSlot = -1;
      return;
    }
    if (Number.isInteger(data.savedSlot)) {
      savedSlot = data.savedSlot;
      status.textContent = savedSlot >= 0 ? '' : t('saveUnavailable');
      return;
    }
    if (typeof data.recording === 'string') {
      downloadRecording(data.recording);
      return;
    }
    if (typeof data.debugRoom === 'boolean') {
      showDebugRoom(false);
      status.textContent = data.debugRoom ? '' : t('debugUnavailable');
      return;
    }
    if (data.ready) {
      canvas.dataset.bugfixes = String(data.gameplay.bugfixes);
      canvas.dataset.preventExploits = String(data.gameplay.preventExploits);
      canvas.dataset.fourSaveSlots = String(data.gameplay.fourSaveSlots === true);
      start.hidden = true;
      saveNow.hidden = false;
      // Slots 3/4 only with the four-slot option of this session.
      for (const button of saveNow.querySelectorAll('button'))
        button.hidden =
          Number(button.dataset.slot) >=
          (data.gameplay.fourSaveSlots ? FOUR_SAVE_SLOTS : ORIGINAL_SAVE_SLOTS);
      showSlots();
      canvas.dataset.saveLoaded = String(data.save);
      live = {
        queue: [],
        shown: 0,
        stalls: 0,
        waiting: false,
        paused: false,
        start: performance.now(),
        raf: requestAnimationFrame(tick),
      };
      showDebugRoom(false);
      canvas.dataset.stage = 'live';
      status.textContent = '';
      updatePauseState();
      return;
    }
    if (data.frame && live) live.queue.push(data);
  };
  worker.onerror = (event) => showFault(event.message);
  startAudio();
  // Shared memory (shared-input.mjs), only with cross-origin isolation (tools/serve-browser.mjs).
  shared = globalThis.crossOriginIsolated
    ? new Int32Array(new SharedArrayBuffer(SHARED_WORDS * Int32Array.BYTES_PER_ELEMENT))
    : null;
  canvas.dataset.shared = String(!!shared);
  if (shared) Atomics.store(shared, SHARED_CHEATS, cheats.mask);
  publishPad();
  const rom = cartridge.rom.slice(),
    present = cartridge.present.slice(),
    sram = save?.slice() ?? null;
  worker.postMessage(
    {
      command: 'start',
      gameplay,
      cheats: cheats.mask,
      markers: markersEnabled,
      language,
      languageAsset: languageData[language] ?? null,
      textEdits: cartridge.textEdits,
      rom: rom.buffer,
      present: present.buffer,
      shared: shared?.buffer ?? null,
      sram: sram?.buffer ?? null,
    },
    [rom.buffer, present.buffer, ...(sram ? [sram.buffer] : [])],
  );
});

// Debug room (debug-room.mjs): the worker warps Jake there at its next pad read, as the
// matchbox's "Open" does; the room's invisible exit returns him.
const debugRoomButton = document.querySelector('#debug-room');
let debugRoomAvailable = false;
// Keep unavailable actions focusable so their explanatory tooltip stays accessible.
function showDebugRoom(available = debugRoomAvailable) {
  debugRoomAvailable = available === true;
  debugRoomButton.setAttribute('aria-disabled', String(!debugRoomAvailable));
  debugRoomButton.title = t(
    debugRoomAvailable ? 'debugHelp' : live ? 'debugUnavailable' : 'debugNotStarted',
  );
}
debugRoomButton.addEventListener('click', () => {
  if (!debugRoomAvailable || !worker || !live) return;
  debugRoomButton.blur();
  closeMenu();
  showDebugRoom(false);
  worker.postMessage({ command: 'debug-room' });
});

// Save anywhere (src/game/save-anywhere.mjs): the worker runs the original slot save at its
// next pad read if Jake can move freely, and answers with the slot or -1.
const saveNow = document.querySelector('#save-now');
let savedSlot = -1;
for (const button of saveNow.querySelectorAll('button'))
  button.addEventListener('click', () => {
    button.blur();
    closeMenu();
    savesSettings.close();
    if (worker && live)
      worker.postMessage({ command: 'save-slot', slot: Number(button.dataset.slot) });
  });

// Save game (save-file.mjs): the SRAM stays in the browser. The worker reports every
// completely written state; export and import as an .srm file.
const saveStatus = document.querySelector('#save-status'),
  saveExport = document.querySelector('#save-export'),
  saveInput = document.querySelector('#save-file');
let save = storedSave(readStored(SAVE_KEY), readStored(SAVE_EXTRA_KEY));
// replace: an imported file also replaces slots 3/4; a save from the game
// with 8 KiB keeps them (mergeSave).
function storeSave(bytes, message, replace = false) {
  save = replace ? bytes : mergeSave(save, bytes);
  canvas.dataset.saveHash = String(saveHash(save));
  const kept =
    writeStored(SAVE_KEY, saveToText(save.subarray(0, SRAM_SIZE))) &&
    writeStored(
      SAVE_EXTRA_KEY,
      save.length > SRAM_SIZE ? saveToText(save.subarray(SRAM_SIZE)) : null,
    );
  navigator.storage?.persist?.().catch(() => {});
  showSave(kept ? message : t('saveFailed'));
}
// Slot occupancy with the title menu's own checksum rule (save-slots.mjs):
// a dot on each "Save now" button, red for a used slot, green for a free one.
function showSlots() {
  const used = occupiedSlots(save);
  for (const button of saveNow.querySelectorAll('button')) {
    const slot = Number(button.dataset.slot),
      taken = used[slot] === true;
    button.dataset.occupied = String(taken);
    button.textContent = t('saveNow', { slot: slot + 1 });
    button.setAttribute(
      'aria-label',
      `${t('saveNow', { slot: slot + 1 })} (${t(taken ? 'slotUsed' : 'slotFree')})`,
    );
  }
}
// The status matches the stored slots against the four-slot option of the
// next start, so slots the game would not offer are never silently hidden.
function showSave(message) {
  saveExport.disabled = !save;
  showSlots();
  const used = occupiedSlots(save),
    games = used.flatMap((taken, slot) => (taken ? [slot + 1] : [])),
    hidden = games.filter((game) => game > ORIGINAL_SAVE_SLOTS),
    fourSlots = live ? canvas.dataset.fourSaveSlots === 'true' : gameplay.fourSaveSlots;
  let text = message;
  if (text === undefined)
    text = !games.length ? t('saveEmpty') : t('saveStored', { games: games.join(', ') });
  if (hidden.length && !fourSlots) text += t('saveHidden', { games: hidden.join(t('and')) });
  saveStatus.textContent = text;
}
saveExport.addEventListener('click', () => {
  if (save) download(new Blob([save], { type: 'application/octet-stream' }), 'Shadowrun.srm');
});
function download(blob, name) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), DOWNLOAD_URL_LIFETIME_MS);
}
// An imported state replaces the stored one; a running game ends, because the game
// reads the SRAM only in the title menu.
saveInput.addEventListener('change', async () => {
  const file = saveInput.files?.[0];
  saveInput.value = '';
  if (!file) return;
  try {
    const bytes = importSave(new Uint8Array(await file.arrayBuffer())),
      lost = occupiedSlots(save)
        .slice(ORIGINAL_SAVE_SLOTS)
        .flatMap((taken, n) =>
          taken && bytes.length < SRAM_SIZE_FOUR_SLOTS ? [ORIGINAL_SAVE_SLOTS + n + 1] : [],
        );
    // An 8 KiB file has no slots 3/4; importing it removes the stored ones.
    if (lost.length && !confirm(t('importLost', { games: lost.join(t('and')) }))) return;
    if (live && !confirm(t('importRunning'))) return;
    if (live || worker) {
      stopLive();
      worker?.terminate();
      worker = null;
      canvas.dataset.stage = 'data';
      start.hidden = !cartridge;
      start.disabled = false;
    }
    storeSave(bytes, t('saveImported'), true);
  } catch (error) {
    saveStatus.textContent = error.message;
  }
});
showSave();

// Session recording (recording.mjs): the worker keeps the raw inputs of every pad read since the
// start; the button saves them as a .json file for a native replay (tools/replay-recording.mjs).
const recordingExport = document.querySelector('#recording-export');
recordingExport.addEventListener('click', () => {
  // After a fault the stopped worker still holds the recording up to it.
  if (worker) worker.postMessage({ command: 'recording' });
});
function downloadRecording(text) {
  download(
    new Blob([text], { type: 'application/json' }),
    'Shadowrun-recording-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json',
  );
}

// Live mode: lag-free frames, one NMI per PAL picture (50 Hz), pad word from the
// keyboard, the mouse on the game picture and the gamepad (controls.mjs). P pauses and resumes.
// The worker receives them through shared memory (shared-input.mjs).
const BINDINGS_KEY = 'shadowrun.bindings.4';
// Version 2 had the same mouse layout and stays valid; version 3 (short left click B) is dropped.
let bindings = parseBindings(readStored(BINDINGS_KEY) ?? readStored('shadowrun.bindings.2')),
  capturing = null,
  gamepad = 0,
  pointer = 0,
  wheel = 0,
  wheelRest = 0;
// Pressed keys with the SNES bits they had when pressed (release also counts after Shift).
const held = new Map(),
  backKeys = new Set(),
  mouse = new Set();
const keyWord = () => {
  let word = 0;
  for (const bits of held.values()) word |= bits;
  return word;
};
const mouseBits = () => bitsFor(bindings, [...mouse]);
const padWord = () => cleanPad(gamepad | mouseBits() | keyWord());
const keyDirections = () => cleanPad(keyWord()) & (DIRECTIONS | PAD_BIT.A | PAD_BIT.X);
const backHeld = () => backKeys.size > 0 || bindings[BACK].some((input) => mouse.has(input));
const buttonWord = () =>
  mouseBits() |
  (mouse.has('mouse:0') ? MOUSE_LEFT : 0) |
  (mouse.has('mouse:2') ? MOUSE_RIGHT : 0) |
  (backHeld() ? BACK_HELD : 0);
// With shared memory the worker reads the pad word at the NMI itself.
const publishPad = () => {
  const word = overlayOpen() ? 0 : padWord();
  canvas.dataset.pad = String(word);
  if (shared) {
    Atomics.store(shared, SHARED_PAD, word);
    Atomics.store(shared, SHARED_KEYS, overlayOpen() ? 0 : keyDirections());
    Atomics.store(shared, SHARED_BUTTONS, overlayOpen() ? 0 : buttonWord());
  }
};
function clearGameInput() {
  held.clear();
  backKeys.clear();
  mouse.clear();
  gamepad = 0;
  publishPad();
}
// Overlay pause is independent of the player's P pause. Closing an overlay only
// resumes a game that was running before it opened, including a late worker ready.
function updatePauseState() {
  if (!live) return;
  const paused = live.paused || overlayOpen();
  canvas.dataset.paused = String(paused);
  status.textContent = paused ? 'Paused (P resumes).' : '';
  if (!paused) live.start = performance.now() - live.shown * FRAME_MS;
  if (audio?.context) paused ? audio.context.suspend() : audio.context.resume();
  audio?.tribute?.setPaused(paused);
}
// Mouse wheel on the game picture: whole steps (line and pixel mode of touchpads combined).
canvas.addEventListener(
  'wheel',
  (event) => {
    if (!live || live.paused || overlayOpen()) return;
    event.preventDefault();
    wheelRest +=
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? event.deltaY / WHEEL_LINES_PER_STEP
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? Math.sign(event.deltaY)
          : event.deltaY / WHEEL_PIXELS_PER_STEP;
    const steps = Math.trunc(wheelRest);
    if (!steps) return;
    wheelRest -= steps;
    wheel = (wheel + steps) | 0;
    canvas.dataset.wheel = String(wheel);
    if (shared) Atomics.store(shared, SHARED_WHEEL, wheel);
  },
  { passive: false },
);
// Mouse movement on the game picture in SNES pixels; the counter reports every movement.
canvas.addEventListener('pointermove', (event) => {
  if (!live || live.paused || overlayOpen()) return;
  const { x, y } = crt.toSource(event.clientX, event.clientY);
  if (x < 0 || y < 0 || x >= SCREEN_WIDTH || y >= SCREEN_HEIGHT) return;
  const counter = ((pointer >>> MOUSE_COUNTER_SHIFT) + 1) & MOUSE_COUNTER_MASK,
    packed = (counter << MOUSE_COUNTER_SHIFT) | (Math.floor(y) << MOUSE_Y_SHIFT) | Math.floor(x);
  if ((packed & WORD_MASK) === (pointer & WORD_MASK)) return;
  pointer = packed;
  canvas.dataset.mouse = String(pointer);
  if (shared) Atomics.store(shared, SHARED_MOUSE, pointer);
});
addEventListener('keydown', (event) => {
  if (capturing) {
    event.preventDefault();
    rebind(captureInput(event));
    return;
  }
  if (overlayOpen()) return;
  if (event.code === 'F9') {
    event.preventDefault();
    if (!event.repeat) toggleCrt();
    return;
  }
  // Native keyboard interaction with the sliders must not reach the game bindings.
  if (event.target?.matches?.('#crt-settings input, #crt-settings button, #tribute-volume, #start'))
    return;
  if (live && event.code === 'KeyP') {
    live.paused = !live.paused;
    updatePauseState();
    return;
  }
  const inputs = keyInputs(event),
    bits = bitsFor(bindings, inputs),
    back = bindings[BACK].some((input) => inputs.includes(input));
  if (!bits && !back) return;
  if (bits) held.set(event.code, bits);
  if (back) backKeys.add(event.code);
  publishPad();
  if (live) event.preventDefault();
});
addEventListener('keyup', (event) => {
  if (held.delete(event.code) | backKeys.delete(event.code)) publishPad();
});
addEventListener('blur', () => {
  held.clear();
  backKeys.clear();
  mouse.clear();
  publishPad();
});
// Mouse buttons count on the game picture; they are released anywhere.
canvas.addEventListener('pointerdown', (event) => {
  if (overlayOpen() || capturing || !monitorUi.running) return;
  mouse.add('mouse:' + event.button);
  publishPad();
  if (live) event.preventDefault();
});
addEventListener(
  'pointerdown',
  (event) => {
    if (capturing) {
      event.preventDefault();
      event.stopPropagation();
      rebind('mouse:' + event.button);
    }
  },
  { capture: true },
);
addEventListener('pointerup', (event) => {
  if (mouse.delete('mouse:' + event.button)) publishPad();
});
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
// Gamepad: the page polls it in each display pass (the Gamepad API exists only here, not in the worker).
function pollGamepads() {
  let word = 0;
  if (!overlayOpen()) for (const pad of navigator.getGamepads?.() ?? []) word |= gamepadBits(pad);
  if (word !== gamepad) {
    gamepad = word;
    publishPad();
  }
}
// Rebinding: "change" waits for the next key or mouse button.
const bindingList = document.querySelector('#bindings');
const controlExplanations = document.querySelector('#control-explanations');
controlExplanations.addEventListener('click', () => {
  const enabled = controlExplanations.getAttribute('aria-pressed') !== 'true';
  controlExplanations.setAttribute('aria-pressed', String(enabled));
  document.querySelector('#controls').dataset.explanations = enabled ? 'on' : 'off';
});
function showBindings() {
  document.querySelector('#mouse-controls-help').textContent = resolveControlText(
    CONTROL_MOUSE_HELP[language],
    bindings,
    language,
  );
  bindingList.replaceChildren(
    ...BINDABLE.map((name) => {
      const row = document.createElement('div'),
        label = document.createElement('span'),
        description = document.createElement('small'),
        nameLabel = document.createElement('strong'),
        inputs = document.createElement('span'),
        change = document.createElement('button');
      row.dataset.control = name;
      nameLabel.textContent = controlName(language, name);
      description.id = `control-help-${name}`;
      description.textContent = CONTROL_ACTIONS[name][language];
      nameLabel.title = description.textContent;
      label.append(nameLabel, description);
      inputs.textContent =
        capturing === name ? t('pressKey') : controlBindingLabel(bindings, language, name);
      change.type = 'button';
      change.textContent = t('change');
      change.setAttribute('aria-label', `${controlName(language, name)}: ${t('change')}`);
      change.setAttribute('aria-describedby', description.id);
      change.addEventListener('click', () => {
        capturing = name;
        showBindings();
        bindingList.querySelector(`[data-control="${name}"] button`).focus({ preventScroll: true });
      });
      row.append(label, inputs, change);
      return row;
    }),
  );
}
function rebind(input) {
  const name = capturing;
  capturing = null;
  if (input && !RESERVED.has(input)) {
    bindings = bind(bindings, name, input);
    writeStored(BINDINGS_KEY, JSON.stringify(bindings));
  }
  held.clear();
  backKeys.clear();
  mouse.clear();
  publishPad();
  showBindings();
  bindingList.querySelector(`[data-control="${name}"] button`).focus({ preventScroll: true });
}
document.querySelector('#reset-bindings').addEventListener('click', () => {
  capturing = null;
  bindings = parseBindings(null);
  writeStored(BINDINGS_KEY, null);
  showBindings();
});
showBindings();
function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key, value) {
  try {
    value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
// Without cross-origin isolation there is no shared memory: inputs then act up to seconds later.
document.querySelector('#isolation').hidden = !!globalThis.crossOriginIsolated;
// A fault ends the session; the start button begins a new one with a new worker.
// After "ready" the worker holds a recording, so the page asks for its export first.
function showFault(message) {
  const recorded = live !== null;
  stopLive();
  start.hidden = false;
  start.disabled = false;
  status.textContent = recorded
    ? `${message.replace(/\.$/, '')}. Please export the recording (menu, Recording) before starting again.`
    : message;
  canvas.dataset.error = message;
}
function stopLive() {
  showGameplay();
  delete canvas.dataset.bugfixes;
  delete canvas.dataset.preventExploits;
  if (live) {
    cancelAnimationFrame(live.raf);
    live = null;
  }
  stopAudio();
  monitorUi.setRunning(false);
  showDebugRoom(false);
  saveNow.hidden = true;
  delete canvas.dataset.nmi;
  delete canvas.dataset.paused;
}
// The worker sends raw 32 kHz DSP pairs. Hash them before the worklet's PAL
// output approximation; device resampling remains the browser's responsibility.
function startAudio() {
  const sound = { context: null, node: null, pairs: 0, hash: FNV_OFFSET };
  audio = sound;
  try {
    sound.context = new AudioContext({ sampleRate: DSP_SAMPLE_RATE, latencyHint: 'interactive' });
  } catch (error) {
    canvas.dataset.audioError = error.message;
    return;
  }
  sound.tribute = new TributePlayer(sound.context, {
    enabled: tributeEnabled,
    sourceFor: (file) => tributeCache.source(file),
    volume: musicVolume,
    onChange: ({ active, replaceMusic, error, track, playing, paused }) => {
      if (audio !== sound) return;
      sound.replaceMusic = replaceMusic;
      sound.node?.port.postMessage({ command: 'tribute-active', active: replaceMusic });
      canvas.dataset.soundtrack = active ? 'tribute' : 'original';
      canvas.dataset.tributeTrack = active ? track.name : '';
      sound.trackState = { active, error, track, playing, paused };
      showSoundtrackStatus();
    },
  });
  sound.context.audioWorklet
    .addModule(new URL('./audio-worklet.mjs', import.meta.url))
    .then(() => {
      if (audio !== sound) return;
      sound.node = new AudioWorkletNode(sound.context, 'snes-audio', {
        numberOfInputs: 0,
        outputChannelCount: [2],
        processorOptions: {
          analogEnabled: audioSettings.enabled,
          audioProfile: audioSettings.profile,
        },
      });
      sound.node.onprocessorerror = () => {
        if (audio === sound) canvas.dataset.audioError = 'Audio output processor failed';
      };
      sound.node.connect(sound.context.destination);
      sound.node.port.postMessage({
        command: 'tribute-active',
        active: sound.replaceMusic === true,
      });
      sound.node.port.onmessage = ({ data }) => {
        canvas.dataset.audioPlayed = String(data.played);
        canvas.dataset.audioSilent = String(data.silent);
        canvas.dataset.audioDropped = String(data.dropped);
        canvas.dataset.audioUnderruns = String(data.underruns);
        canvas.dataset.audioPrebuffer = String(data.prebuffer);
        canvas.dataset.audioAnalog = String(data.analogEnabled);
        canvas.dataset.audioProfile = data.audioProfile;
        canvas.dataset.audioState = sound.context.state;
        canvas.dataset.tributeActive = String(data.tributeActive);
      };
    })
    .catch((error) => {
      canvas.dataset.audioError = error.message;
    });
}
function stopAudio() {
  audio?.tribute?.close();
  audio?.context?.close();
  audio = null;
  soundtrackStatus.textContent = '';
  for (const key of [
    'audioPairs',
    'audioHash',
    'audioPlayed',
    'audioSilent',
    'audioDropped',
    'audioAnalog',
    'audioProfile',
    'audioState',
    'audioError',
    'soundtrack',
    'tributeTrack',
    'tributeActive',
  ])
    delete canvas.dataset[key];
}
function playAudio(samples, effects, music) {
  if (!audio || !samples) return;
  audio.tribute?.update(music);
  // Over the samples as unsigned 16-bit words.
  const h = (audio.hash = fnv1a(
    new Uint16Array(samples.buffer, samples.byteOffset, samples.length),
    audio.hash,
  ));
  audio.pairs += samples.length >> 1;
  canvas.dataset.audioPairs = String(audio.pairs);
  canvas.dataset.audioHash = String(h);
  if (effects)
    audio.node?.port.postMessage({ original: samples, effects }, [samples.buffer, effects.buffer]);
  else audio.node?.port.postMessage(samples, [samples.buffer]);
}
// Schedule: picture n is due at start + n*20 ms, independent of the monitor's frame
// rate. The pictures come continuously from the worker into live.queue; each pass the
// page shows the last due picture (at most four, the sound of all is played) and reports
// the pictures shown (in shared memory there, otherwise by message with the pad word).
// If the buffer is empty or the page lags more than eight pictures (tab in the
// background), the schedule starts again instead of skipping pictures.
const FRAME_MS = 20;
function tick(now) {
  if (!live) return;
  live.raf = requestAnimationFrame(tick);
  pollGamepads();
  if (live.paused || overlayOpen()) return;
  let due = Math.floor((now - live.start) / FRAME_MS) - live.shown;
  // Waiting with an empty buffer counts once per stall (data-stalls, after the first frame).
  if (!live.queue.length && due > 0 && live.shown && !live.waiting) {
    live.waiting = true;
    canvas.dataset.stalls = String(++live.stalls);
  }
  if (due > MAX_FRAMES_BEHIND || (!live.queue.length && due > 0)) {
    live.start = now - live.shown * FRAME_MS;
    due = 0;
  }
  if (live.queue.length) live.waiting = false;
  if (due < 1) return;
  const taken = live.queue.splice(0, Math.min(due, MAX_FRAMES_PER_TICK)),
    shown = taken.at(-1);
  live.shown += taken.length;
  monitorUi.setRunning(true);
  crt.draw(shown.pixels);
  if (debugRoomAvailable !== (shown.debugRoomAvailable === true))
    showDebugRoom(shown.debugRoomAvailable);
  canvas.dataset.ready = 'true';
  canvas.dataset.nmi = String(shown.nmi);
  for (const f of taken) playAudio(f.audio, f.effects, f.music);
  if (shared) {
    Atomics.store(shared, SHARED_SHOWN, live.shown);
    Atomics.notify(shared, SHARED_SHOWN);
  } else
    worker.postMessage({
      command: 'consumed',
      consumed: live.shown,
      pad: padWord(),
      keys: keyDirections(),
      mouse: pointer,
      buttons: buttonWord(),
      wheel,
    });
  // Over the open glove the mouse pointer disappears; the glove is the pointer.
  canvas.classList.toggle('glove', !!shown.glove);
}
showLanguage();
