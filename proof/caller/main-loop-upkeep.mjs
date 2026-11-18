// Shared lifted callees of the main loop and its remaining call tables.
import { runFrameWait, runPadPresses } from './input-routines.mjs';
import {
  runShowNotice,
  runPrintNumber,
  runPrintText,
  runDrawTextBuffer,
  runChooseAction,
  runTalk,
  runPutGloveAway,
  runReleaseWindow,
  runOpenWindow,
} from './upkeep-routines.mjs';
import { setTextCursorRoutine } from '../../src/game/window-text.mjs';
import { playSoundEffectRoutine } from '../../src/apu/sound-effect.mjs';
import { randomByteNative, randomBelowNative } from '../../src/script/native-script-leaves.mjs';
export const MAIN_UPKEEP_ROUTINES = new Map([
  [0x81b0a1, runFrameWait],
  [0x809e1a, runPadPresses],
  [0x80bcb2, runPutGloveAway],
  [0x80fa3e, runReleaseWindow],
  [0x80f963, runOpenWindow],
  [0x80fec1, runShowNotice],
  [0x80faac, setTextCursorRoutine],
  [0x80fd80, runPrintNumber],
  [0x80fe69, runPrintText],
  [0x80fb39, runDrawTextBuffer],
  [0x80c46e, playSoundEffectRoutine],
  [0x80c560, (h) => randomByteNative(h.a, false)],
  [0x80c51f, (h) => randomBelowNative(h.a, false)],
  [0x8099eb, runChooseAction],
  [0x80936c, runTalk],
]);
