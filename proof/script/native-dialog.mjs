import { runFrameWait, runPadPresses } from '../../tools/register-forms/input-routines.mjs';
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

import { unpackPortraitRoutine } from '../../tools/register-forms/portrait-routines.mjs';

import { setMusicModeRoutine } from '../../tools/register-forms/audio-routines.mjs';
import {
  buildSpritesJsr,
  clearFixedColourJsl,
  setWindowTextWidthJsr,
  shiftPortraitRowsJsr,
} from '../../tools/register-forms/jsr-forms.mjs';

export const TALK_ROUTINES = new Map([
  [0x8092c5, runCloseDialog],
  [0x81886a, clearFixedColourJsl],
  [0x80bcb2, runPutGloveAway],
  [0x80fa92, setWindowTextWidthJsr],
  [0x809f6d, unpackPortraitRoutine],
  [0x808f20, shiftPortraitRowsJsr],
  [0x809022, runUploadFirstPortrait],
  [0x80905e, runUploadSecondPortrait],
  [0x808f3a, runOpenPortraitWindow],
  [0x809178, runDialogText],
  [0x8091e2, runDialogMenu],
  [0x809215, runDialogTopics],
  [0x808f97, runClosePortraitWindow],
  [0x80adf4, runReloadObjectTiles],
  [0x80b8de, buildSpritesJsr],
  [0x80ff79, runReleaseNoticeWindows],
  [0x81ef47, setMusicModeRoutine],
  [0x80fa3e, runReleaseWindow],
  [0x80f963, runOpenWindow],
  [0x81b0a1, runFrameWait],
  [0x809e1a, runPadPresses],
]);
