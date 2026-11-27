// Talking with someone (docs/READABLE-GAME.md, dialog pilot).
//
// The glove action starts a dialog with the partner and the partner's dialog number. The
// dialog clears the colour effect, puts the glove away and closes the notices. If the
// dialog has its own music and the music option is on, that music plays and the old
// music comes back at the end. It opens the text window at the top of the screen (its
// text starting right of the portraits) and the menu window below it, shows Jake's
// portrait (his alternate one when the story says so) and the partner's, opens the
// portrait window, shows the greeting and waits a second.
//
// Then the main menu runs until Exit or until something ends the dialog: Talk shows the
// talk text, Ask about shows the text for a topic chosen from the known topics. At the
// end the dialog's screen closes, both windows are released and the old music returns.
import { setMusicModeInPlace } from '../apu/audio-routines.mjs';
import { showDialogText, GREETING_KEY, TALK_KEY } from './dialog-text.mjs';
import { chooseDialogAction, chooseDialogTopic } from './dialog-menus.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { openWindowAt } from './window-open.mjs';
import { setWindowTextArea } from './window-text.mjs';
import {
  putGloveAwaySequence,
  releaseNoticeWindowsSequence,
  releaseWindowAt,
} from './window-release.mjs';
import { openPortraitWindow } from './portrait-window.mjs';
import { clearFixedColourInPlace, closeDialog, showPortraits } from './dialog-screen.mjs';
import { waitForCounterWord } from '../system/frame-wait.mjs';
import { fixesEnabled, preparePushkinTopics } from './bugfixes.mjs';
import { dialogContent } from '../content/dialogs.mjs';
import { dialogState, NONE } from '../state/dialog.mjs';
import { FIRST_ARGUMENT, SECOND_ARGUMENT, leafArgument } from '../system/native-leaf-support.mjs';
import { JAKE_PORTRAIT_DIALOG, JAKE_ALTERNATE_PORTRAIT_DIALOG } from '../data/runners.mjs';

export { clearFixedColourInPlace, closeDialog };

// The windows in cells [left, top, columns, rows]: the text window and the menu window;
// the text starts at pixel 84, and its width is the window's less 8 pixels.
const TEXT_WINDOW = Object.freeze([1, 1, 30, 13]),
  MENU_WINDOW = Object.freeze([1, 14, 30, 13]),
  TEXT_LEFT_PIXEL = 84,
  TEXT_WIDTH_CHANGE = -8 & NONE;
// The rows of the main menu.
const EXIT = 0,
  TALK = 1;
// The greeting stays a second (61 frames) before the menu.
const GREETING_FRAMES = 61;
// The record flags: the music number, and the partner's portrait mirrored.
const MIRRORED = 0x80;
// A music word with this bit set names no music.
const MUSIC_NONE_BIT = 0x8000;

// Talk with the partner through the dialog number.
export function* talk(h, events, renderBuffer = drawTextBuffer, partner, number) {
  const { mem } = h.a,
    state = dialogState(mem),
    content = dialogContent(mem),
    dialog = content.dialogs[number];
  if (fixesEnabled(h.a)) preparePushkinTopics(h.a, number);
  yield () => clearFixedColourInPlace(h);
  yield () => {
    state.endWord = 0;
    state.partner = partner;
  };
  yield* putGloveAwaySequence(h, events);
  yield* releaseNoticeWindowsSequence(h, events);
  // The dialog's music, and the music to bring back afterwards (none if unchanged).
  let music = null,
    oldMusic = NONE;
  yield () => {
    state.recordFlags = dialog.music | (dialog.mirror ? MIRRORED : 0);
    if (dialog.music && state.musicOption) {
      const value = content.music[dialog.music - 1];
      if (value !== state.music) music = value;
    }
    if (music !== null) oldMusic = state.music;
  };
  if (music !== null) yield () => setMusicModeInPlace(h, music);
  const textWindow = yield* openWindowAt(h, events, TEXT_WINDOW);
  yield () => {
    state.textWindow = textWindow;
    setWindowTextArea(h, textWindow, TEXT_LEFT_PIXEL, TEXT_WIDTH_CHANGE);
  };
  const menuWindow = yield* openWindowAt(h, events, MENU_WINDOW);
  yield () => (state.menuWindow = menuWindow);
  const jake =
    content.dialogs[state.jakeAlternate ? JAKE_ALTERNATE_PORTRAIT_DIALOG : JAKE_PORTRAIT_DIALOG];
  yield* showPortraits(h, events, jake.portrait, dialog.portrait);
  yield* openPortraitWindow(h, events);
  yield* showDialogText(h, events, renderBuffer, GREETING_KEY, dialog);
  for (let frame = 0; frame < GREETING_FRAMES; frame++) yield* waitForCounterWord(h, events);
  for (;;) {
    const row = yield* chooseDialogAction(h, events, renderBuffer);
    if (row === EXIT || state.ended) break;
    let key = TALK_KEY;
    if (row !== TALK) {
      const place = yield* chooseDialogTopic(h, events, renderBuffer);
      if (state.ended) break;
      // With no topic to show, the original takes the byte just before the list of known
      // topics as the key (a quirk kept as it is).
      key = state.topic(place);
    }
    yield* showDialogText(h, events, renderBuffer, key, dialog);
    if (state.ended) break;
  }
  yield* closeDialog(h, events);
  yield* releaseWindowAt(h, events, menuWindow);
  yield* releaseWindowAt(h, events, textWindow);
  // A music word with its top bit set (none) is not brought back.
  if (!(oldMusic & MUSIC_NONE_BIT)) yield () => setMusicModeInPlace(h, oldMusic);
}

// The dialog as a script native: the partner and the dialog number are its arguments.
export function* talkSequence(h, events, renderBuffer = drawTextBuffer) {
  yield* talk(
    h,
    events,
    renderBuffer,
    leafArgument(h.a, FIRST_ARGUMENT),
    leafArgument(h.a, SECOND_ARGUMENT),
  );
}
