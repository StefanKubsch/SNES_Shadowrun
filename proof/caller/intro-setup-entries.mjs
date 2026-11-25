// Register-level entries of the lifted intro and title set-up routines (src/intro,
// src/apu) for the routine tables of the frontend references and comparisons: the
// sound directory 81:F092, the intro screen 81:D60F, the window 81:D642, the title's
// and the game's audio 81:DDB1 and 81:EF63, the object clear 81:E8E5, the near object
// with its sound 81:E900, the sprite grid 81:E83A and the far object start 81:E971.
// Their register-level reference (proof/intro-reference/) was retired on 2026-11-25,
// when the golden traces attract and intro covered the lifted path
// (docs/STATE-MODEL-REBUILD.md). Each entry reads its register arguments, runs the
// lifted body on the scene runtime and returns like the original (RTL or RTS).
import '../system/recorded-scene-frames.mjs';
import { sceneRuntime } from '../../src/system/scene-runtime.mjs';
import {
  setUpIntroScene,
  setUpIntroWindow,
  setUpTitleAudio,
} from '../../src/intro/intro-scene.mjs';
import {
  addNearObject,
  clearIntroObjects,
  drawSpriteGrid,
  startFarObject,
} from '../../src/intro/intro-objects.mjs';
import { loadSoundDirectory } from '../../src/apu/music-mode.mjs';
import { setUpGameAudioRoutine } from './scene-routine-adapters.mjs';
import { AUDIO_REFERENCE_ENTRIES } from '../apu-reference/audio-routines.mjs';
import { routineCaller } from '../system/routine-call.mjs';
import { MAIN_SCENE_ROUTINES } from '../replay/main-scene.mjs';

// The sprite grid's direct page arguments: the attribute bits and the OAM byte
// offset, which 81:E83A leaves at the next free object for its caller.
const DP_SPRITE_TILE = 0x24,
  DP_OAM_OFFSET = 0x2c,
  TITLE_AUDIO_DATA_BANK = 0x81;

// Calls without a table use the live scene routines with the register-level audio
// (built on first use: the routine tables are complete only after all modules have
// loaded).
let routineTable = null;
const defaultRoutines = () =>
  (routineTable ??= new Map([...MAIN_SCENE_ROUTINES, ...AUDIO_REFERENCE_ENTRIES]));

// The sound driver command 81:F007 through the routine table.
const SEND_COMMAND = 0x81f007;

// The scene runtime of an entry. Its sound commands go through the routine table's
// 81:F007 with the original return sites (sites, in call order), so recorded
// comparisons see the driver handshake as the original makes it.
function runtime(h, events, routines = defaultRoutines(), sites = []) {
  const m = sceneRuntime(h),
    call = routineCaller(h, events, routines, true);
  let n = 0;
  m.sound = (command, parameter) => {
    if (n >= sites.length) throw new Error('intro set-up entry: unexpected sound command');
    h.load(command);
    h.index('x', parameter);
    call(sites[n++], SEND_COMMAND);
  };
  return m;
}
const long = (body, sites) => (h, events, routines) => {
  body(runtime(h, events, routines, sites), h.ctx);
  return h.rtl();
};
const near = (body) => (h, events, routines) => {
  body(runtime(h, events, routines), h.ctx);
  return h.rts();
};

// 81:E83A: draw the picture in A at X, Y from the OAM offset in the direct page.
function drawSpriteGridRoutine(h) {
  const { ctx } = h,
    at = drawSpriteGrid(
      sceneRuntime(h),
      ctx.a,
      ctx.x,
      ctx.y,
      h.dp(DP_SPRITE_TILE, 2),
      h.dp(DP_OAM_OFFSET, 2),
    );
  h.dpWrite(DP_OAM_OFFSET, at, 2);
  return h.rtl();
}

export const INTRO_SETUP_ENTRIES = [
  [0x81f092, long((m, ctx) => loadSoundDirectory(m.mem, m.port, ctx.a))],
  [0x81d60f, near((m) => setUpIntroScene(m))],
  [0x81d642, near((m) => setUpIntroWindow(m))],
  // 81:DDB1 sets the data bank to its own (PHK, PLB) before its four commands and
  // leaves it there.
  [
    0x81ddb1,
    long(
      (m, ctx) => {
        ctx.bank = TITLE_AUDIO_DATA_BANK;
        setUpTitleAudio(m);
      },
      [0x81ddb9, 0x81ddc3, 0x81ddce, 0x81ddd6],
    ),
  ],
  [0x81e8e5, long((m) => clearIntroObjects(m.wram))],
  [0x81e900, long((m, ctx) => addNearObject(m, ctx.x, ctx.y, ctx.a), [0x81e944])],
  [0x81ef63, setUpGameAudioRoutine],
  [0x81e83a, drawSpriteGridRoutine],
  [0x81e971, long((m, ctx) => startFarObject(m, ctx.x, ctx.y))],
  // The register-level audio routines the frontend references call (the song start
  // 81:F229 and the sample loader 81:F130 left the scene table).
  ...AUDIO_REFERENCE_ENTRIES,
];
