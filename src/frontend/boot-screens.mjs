// The boot screens (lifted from 81:E7BC; register-level reference `showBootScreens` in
// proof/replay/main-startup.mjs, which recorded runs keep).
//
// After the reset the game shows two screens: the first from the scene list 8A:8000,
// faded in, with the sound driver started (81:EF07) while it is shown, held for 150
// frames and faded out; then the settings' output mode and control type are kept, an
// invalid settings checksum (81:D5EC) restores the defaults (81:D5F4, both in
// settings.mjs), and the second screen from the scene list 89:EC26 is shown the same
// way for 180 frames. The output mode is sent last (81:EF36). The sound driver start is
// in src/apu/sound-driver-start.mjs.
//
// The screens use the lag-free frame model: each frame wait ends after the NMI, whose
// callback is the plain return the scene screen start installs.
//
// Registers (user decision 2026-11-17): game state only; the checksum and the output
// mode leave no A or X. Live screens (with frame jobs) take game services only and
// never touch a CPU context (docs/BOOT-SERVICE-COMPOSITION.md). Recorded callers keep
// the original status changes and its restoration by the PLP on return.
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { startSoundDriver } from '../apu/sound-driver-start.mjs';
import { disableNmi, enableNmiAndJoypad, startSceneScreen } from '../system/nmi.mjs';
import { runSceneList } from '../system/scene-list.mjs';
import { waitForFrame } from '../system/frame-wait.mjs';
import { fadeIn, fadeOut } from '../video/fades.mjs';
import { setSceneScreen } from '../video/scene-screen.mjs';
import { restoreDefaultSettings, sendOutputMode, settingsValid } from './settings.mjs';
import { SETTINGS_CONTROL_TYPE_A, SETTINGS_STEREO, SETTINGS_STEREO_ON } from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';
import { FLAG_INDEX_8BIT, FLAG_IRQ_DISABLE, FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';

// The two screens: their scene lists and the frames they are held.
const LOGO_LIST = 0x8a8000,
  LOGO_FRAMES = 0x96,
  SECOND_SCREEN_LIST = 0x89ec26,
  SECOND_SCREEN_FRAMES = 0xb4;
// The settings word keeps the output mode (low byte) and the control type (high byte).
const SETTINGS_WORD_BITS = SETTINGS_STEREO_ON | (SETTINGS_CONTROL_TYPE_A << BYTE_BITS);
// Direct page word 10, cleared at boot (no reader is known).
const CLEARED_WORD = 0x10;
// The settings checksum leaves X past its first byte.

// 81:E7BC, a sequence for a native call continuation: h is the accessor of the boot,
// events its frame events. It writes the direct page word 10 at WRAM 0010 and checks no
// direct page register (its callers run with D = 0; user decision 2026-11-17). The
// lifted startup runs it without the JSL frame (its return address lies only in free
// stack bytes). The RTL form for register-level callers is in
// proof/frontend-caller/boot-screens.mjs.
export function* bootScreensInPlace(h, events) {
  // Recorded comparisons only: their interrupt path combines the caller's status.
  const ctx = events.frameJobs ? null : h.ctx,
    status = ctx?.status;
  let m;
  const wait = () => waitForFrame(h, events, m.port),
    hold = function* (frames) {
      for (let n = 0; n < frames; n++) yield* wait();
    },
    showScreen = function* (list) {
      yield () => {
        // 81:EB97 sets the interrupt disable flag; the screen start's own PLP keeps it.
        if (ctx) ctx.status |= FLAG_IRQ_DISABLE;
        startSceneScreen(m.wram, m.video, m.port);
        runSceneList(m.mem, m.video, m.port, list);
        setSceneScreen(m.video);
        enableNmiAndJoypad(m.wram, m.port);
      };
      yield* fadeIn(m.video, wait);
    };
  yield () => {
    m = sceneRuntime(h);
    if (ctx) ctx.status &= ~(FLAG_MEMORY_8BIT | FLAG_INDEX_8BIT);
    m.wram[CLEARED_WORD] = 0;
    m.wram[CLEARED_WORD + 1] = 0;
  };
  yield* showScreen(LOGO_LIST);
  yield () => startSoundDriver(m);
  yield* hold(LOGO_FRAMES);
  yield* fadeOut(m.video, wait);
  yield () => {
    disableNmi(m.wram, m.port);
    // The settings word keeps its known bits; an invalid checksum restores the
    // defaults.
    const { mem } = m,
      kept =
        (mem.read8(SETTINGS_STEREO) | (mem.read8(SETTINGS_STEREO + 1) << BYTE_BITS)) &
        SETTINGS_WORD_BITS;
    mem.write8(SETTINGS_STEREO, kept & BYTE_MASK);
    mem.write8(SETTINGS_STEREO + 1, kept >>> BYTE_BITS);
    if (!settingsValid(mem)) restoreDefaultSettings(mem);
  };
  yield* showScreen(SECOND_SCREEN_LIST);
  yield* hold(SECOND_SCREEN_FRAMES);
  yield* fadeOut(m.video, wait);
  yield () => disableNmi(m.wram, m.port);
  yield () => {
    sendOutputMode(m);
    if (ctx) ctx.status = status;
  };
}
