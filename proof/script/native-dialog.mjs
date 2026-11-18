import { runSpriteList, runFrameWait, runPadPresses } from '../../src/game/main-upkeep.mjs';
import {
  runCloseDialog,
  runPutGloveAway,
  runUploadFirstPortrait,
  runUploadSecondPortrait,
  runOpenPortraitWindow,
  runDialogText,
  runDialogMenu,
  runDialogTopics,
  runClosePortraitWindow,
  runReloadObjectTiles,
  runReleaseNoticeWindows,
  runReleaseWindow,
  runOpenWindow,
} from '../caller/upkeep-routines.mjs';

import { clearFixedColourRoutine, setWindowTextWidthRoutine } from '../../src/game/dialog-talk.mjs';

import {
  unpackPortraitRoutine,
  shiftPortraitRowsRoutine,
} from '../../src/game/portrait-upload.mjs';

import { setMusicModeRoutine } from '../../src/apu/audio-routines.mjs';

export const TALK_ROUTINES = new Map([
  [0x8092c5, runCloseDialog],
  [0x81886a, clearFixedColourRoutine],
  [0x80bcb2, runPutGloveAway],
  [0x80fa92, setWindowTextWidthRoutine],
  [0x809f6d, unpackPortraitRoutine],
  [0x808f20, shiftPortraitRowsRoutine],
  [0x809022, runUploadFirstPortrait],
  [0x80905e, runUploadSecondPortrait],
  [0x808f3a, runOpenPortraitWindow],
  [0x809178, runDialogText],
  [0x8091e2, runDialogMenu],
  [0x809215, runDialogTopics],
  [0x808f97, runClosePortraitWindow],
  [0x80adf4, runReloadObjectTiles],
  [0x80b8de, runSpriteList],
  [0x80ff79, runReleaseNoticeWindows],
  [0x81ef47, setMusicModeRoutine],
  [0x80fa3e, runReleaseWindow],
  [0x80f963, runOpenWindow],
  [0x81b0a1, runFrameWait],
  [0x809e1a, runPadPresses],
]);
