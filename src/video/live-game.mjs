import { detachFrontend } from '../state/frontend.mjs';
import { detachMatrix } from '../state/matrix.mjs';
import { detachSceneRoom } from '../state/scene-room.mjs';
import { detachCombat } from '../state/combat.mjs';
import { detachWindowsText } from '../state/windows-text.mjs';
import { detachCameraMaps } from '../state/camera-maps.mjs';
import { detachCollisionStorage } from '../state/collision.mjs';
import { detachSprites } from '../state/sprites.mjs';
// Live cold start (user decision 2026-10-30, docs/STRATEGY.md): the
// native owner begins at reset 00:E382 and runs from the start with
// lag-free frames (src/vm/frame-events.mjs), live pad, native APU and PPU.
// No observation of the original, no adopted state. Logo,
// SPC transfer, intro, title and menu run through the same equations as
// in the original comparison (docs/BOOT-ORACLE.md); 'New Game' leads into the
// main loop.
//
// Power-on state as in the original comparison (Mesen AllZeros, tools/mesen.mjs):
// WRAM zero, registers as after reset (E=1, P=34, S=01FF). On the hardware
// the WRAM content at power-on is not defined; the boot does not clear it
// completely, and different content changes Jake's posture from the morgue
// onwards (assumption, reversible). SRAM is the saved game (8 KiB or empty).
import { detachObjectStorage } from '../state/objects.mjs';
import { VmMemory, VmFault, SRAM_SIZE, SRAM_SIZE_FOUR_SLOTS, WRAM_SIZE } from '../vm/memory.mjs';
import { installPortExtension } from '../data/port-extension.mjs';
import { installLanguage, ENGLISH } from '../data/language.mjs';
import { GameLoop } from '../script/game-loop.mjs';
import { nativeOpcodeTargets } from '../data/native-opcode-targets.mjs';
import { nativeTarget } from '../script/native-targets.mjs';
import { FRONTEND_ROUTINES } from '../system/main-frontend.mjs';
import { renderFrame } from './frame-renderer.mjs';
import { PictureVideo } from './picture-video.mjs';
import { DeviceAccess } from '../vm/device-access.mjs';
import { LagFreeFrames, LiveDevices } from '../vm/frame-events.mjs';
import { Apu } from '../apu/apu.mjs';
import { gameplaySettings, ORIGINAL_GAMEPLAY } from '../game/bugfixes.mjs';
import { serviceTextWait } from '../game/instant-text.mjs';
import { runFrameJobs } from '../system/live-frame-jobs.mjs';
// Player control 80:E014 runs every frame while the player steers freely.
const PLAYER_CONTROL = 0x80e014;
// Default work budget of one step (src/script/game-loop.mjs).
const STEP_BUDGET = 4096;
const need = (ok, reason) => {
  if (!ok) throw new VmFault(reason);
};
// Target choice with the glove (proof/replay/native-glove-target.mjs, special-natives.mjs).
const CHOOSING = new Set([0x809bc6, 0x809bb9, 0x809bd3, 0x809c33, 0x808d0b]);
// The plain game loop over the JS scheduler.
const gameLoop = (game) =>
  new GameLoop(game.vm, {
    devices: game.devices,
    routines: FRONTEND_ROUTINES,
    admitted: nativeOpcodeTargets,
    implementation: nativeTarget,
  });
export class LiveGame {
  // pad(k) returns the pad word for NMI k, onFrame({nmi,pixels}) the
  // picture at NMI entry (only from the first write to 2100; before that the
  // picture is not defined). counter replaces the H/V counter bytes of the random routine.
  // cartridge: the ROM (tools, original comparisons) or the data package
  // {rom,present} without code (src/data/cartridge.mjs, docs/ROM-FREE.md).
  // The game runs the plain game loop (src/script/game-loop.mjs) and draws through the
  // register-free picture back end (src/video/picture-video.mjs, docs/FRAME-DESCRIPTION.md).
  constructor(
    cartridge,
    {
      pad = () => 0,
      onFrame = null,
      counter,
      sram = null,
      gameplay = ORIGINAL_GAMEPLAY,
      languages = {},
      language = ENGLISH,
      apu = new Apu(),
    } = {},
  ) {
    need(
      sram === null ||
        (sram instanceof Uint8Array && [SRAM_SIZE, SRAM_SIZE_FOUR_SLOTS].includes(sram.length)),
      'live_sram_required',
    );
    const settings = gameplaySettings(gameplay);
    const { rom, present } =
      cartridge instanceof Uint8Array ? { rom: cartridge, present: null } : cartridge;
    // Four-slot option (docs/SAVING.md): 16 KiB SRAM, slots 3/4 behind the
    // original 8 KiB (empty slots fail their checksum and stay disabled);
    // without it the game sees only the original 8 KiB.
    const size = settings.fourSaveSlots ? SRAM_SIZE_FOUR_SLOTS : SRAM_SIZE,
      cart = new Uint8Array(size);
    if (sram) cart.set(sram.subarray(0, size));
    this.memory = new VmMemory(rom, new Uint8Array(WRAM_SIZE), cart, present);
    for (const detach of [
      detachObjectStorage,
      detachCollisionStorage,
      detachCameraMaps,
      detachWindowsText,
      detachFrontend,
      detachMatrix,
      detachSceneRoom,
      detachCombat,
      detachSprites,
    ])
      detach(this.memory.wram);
    this.memory.textEdits = cartridge.textEdits ?? null;
    if (settings.fourSaveSlots) installPortExtension(this.memory);
    // Text language (src/data/language.mjs): languages maps a code to buildLanguage's result.
    this.languages = languages;
    this.setLanguage(language);
    // The game's settings as the lifted code sees them through its accessors (a.vm):
    // gameplay options, the cheats mask and the start menu's credits entry, which the
    // browser port exposes as the fourth entry.
    this.vm = { mem: this.memory, gameplay: settings, startMenuCredits: true };
    this.gameplay = settings;
    this.apu = apu;
    // The register-free picture state of live play; it is also the device bus.
    const picture = (this.picture = new PictureVideo(this.memory));
    this.bus = picture;
    const frames = (this.frames = new LagFreeFrames({
      pad,
      apu: this.apu,
      onNmi: (nmi) => {
        if (onFrame && picture.displaySet)
          onFrame({ nmi, pixels: renderFrame(picture.describe()) }, picture);
      },
    }));
    // Instant text (docs/INSTANT-TEXT.md): text waits run the transfer at once.
    if (settings.instantText)
      frames.textWait = (h, events, status, pc) => serviceTextWait(frames, h, events, status, pc);
    this.devices = new LiveDevices(frames, FRONTEND_ROUTINES, {
      bus: this.bus,
      apu: this.apu,
      frameJobs: runFrameJobs,
      ...(counter ? { counter } : {}),
    });
    this.loop = gameLoop(this);
    // controlNmi: number of NMIs at the last call of the player control 80:E014
    // (runs every frame while the player steers freely; src/browser/mouse-control.mjs).
    // choosing: a target choice with the glove (9BC6 and relatives, special natives
    // D8 and so on) has begun and E014 has not run since; otherwise an open hand
    // without player control is an action list (99EB) and thus a menu.
    this.controlNmi = -1;
    this.choosing = false;
    this.loop.onNative = (target) => {
      if (target === PLAYER_CONTROL) {
        this.controlNmi = frames.nmis;
        this.choosing = false;
      } else if (CHOOSING.has(target)) this.choosing = true;
    };
    // The picture back end's CPU register writes (the scene default) reach the devices
    // as the hardware port's do. dataOutsideBlank counts the VRAM, CGRAM and OAM data
    // bytes written outside VBlank and forced blank (the tests require zero).
    const access = new DeviceAccess(this.vm);
    access.devices = this.devices;
    picture.system = (address, value, width) => access.busWrite(address, value, width);
    this.dataOutsideBlank = 0;
    picture.onData = () => {
      if (!frames.inNmi && !(picture.displaySet && picture.blank)) this.dataOutsideBlank++;
    };
  }
  // Video memory: vram, cgram (bytes) and oam.
  get screen() {
    return this.picture;
  }
  // The current picture as RGBA pixels (as onFrame receives it), or null before the
  // first display write.
  render() {
    return this.picture.displaySet ? renderFrame(this.picture.describe()) : null;
  }
  get nmis() {
    return this.frames.nmis;
  }
  // The task API of the game's script tasks (src/script/task-api.mjs).
  get tasks() {
    return this.loop.tasks;
  }
  // Switches the text language; it applies from the next decoded text.
  setLanguage(code) {
    const language = code === ENGLISH ? null : this.languages[code];
    need(language !== undefined, 'language_data_required');
    installLanguage(this.memory, language);
    this.language = code;
  }
  // Runs the game for up to `budget` work units; returns the NMI count.
  step({ budget = STEP_BUDGET } = {}) {
    this.loop.step(budget);
    return this.frames.nmis;
  }
}
