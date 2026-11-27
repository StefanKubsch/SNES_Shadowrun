import { writeStateByte } from '../state/objects.mjs';
// The title cycle and the attract game (lifted from 80:A18C, 80:A168 and 80:96F3;
// register-level reference retired on 2026-11-25).
//
// The cycle shows the title (or, after a game, goes straight to the start menu with
// the title song) and then the start menu until the player chooses a game. A menu
// that times out plays the attract game, a demo of the game in room AB, and shows
// the menu again. The port's Credits row (src/game/credits.mjs) plays the credits
// instead of the attract game.
import { playTitle } from './title.mjs';
import { chooseStartGame } from './start-menu.mjs';
import { runAttractRounds } from './attract-rounds.mjs';
import { startNewGame } from '../game/game-start.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { startSceneScreen } from '../system/nmi.mjs';
import { loadSoundDirectory, setMusicMode, startSong } from '../apu/music-mode.mjs';
import { setUpGameAudio, setUpTitleAudio } from '../intro/intro-scene.mjs';
import { playCutscene } from '../cutscene/cutscene-scene.mjs';
import { sendApuCommandInPlace } from '../apu/audio-routines.mjs';
import {
  CREDITS_ARGUMENT,
  CREDITS_SEQUENCE,
  endingMusic,
  markMenuCredits,
  takeCreditsRequest,
} from '../game/credits.mjs';
import { MUSIC, TIMER, TIMER_STOPPED } from '../data/wram.mjs';
import { APU_COMMAND_VOLUME_TARGET, SOUND_DIRECTORY_TITLE } from '../constants/sound-commands.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK } from '../constants/bits.mjs';

// The title song; the start menu's answer of a cancel or timeout; the attract room.
const SONG_NONE = 0,
  SONG_TITLE = 1,
  MENU_CANCELLED = 0xfffe,
  ATTRACT_ROOM = 0xab;

const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};

// 80:A18C: the title cycle. title is false when the cycle starts after a game (A zero
// in the original). The start menu's choice (the save slot, or FFFF for a new game)
// is returned directly. The title, menu, credits and demo are ordinary generator
// calls; no entry PCs, saved return words or return checks select their flow.
// Compatibility scene entries retain their original returns separately.
export function* titleCycle(h, events, title) {
  const afterGame = !title;
  let m;
  // The menu times out sooner right after the whole title.
  const menu = (shortTimeout) => chooseStartGame(h, events, shortTimeout);
  yield () => {
    m = sceneRuntime(h);
    startSong(m.mem, m.port, SONG_NONE);
    loadSoundDirectory(m.mem, m.port, SOUND_DIRECTORY_TITLE);
  };
  let choice, titleNext;
  if (afterGame) {
    yield () => {
      setUpTitleAudio(m);
      startSong(m.mem, m.port, SONG_TITLE);
    };
    choice = yield* menu(false);
    titleNext = true;
  } else {
    const key = yield* playTitle(h, events);
    // A held button ends the title early.
    const wholeTitle = !key;
    choice = yield* menu(wholeTitle);
    titleNext = false;
  }
  // A cancelled menu shows the attract game and the title in turn, each followed
  // by the menu; the Credits row plays the credits and shows the menu again.
  while (choice === MENU_CANCELLED) {
    if (takeCreditsRequest(h.a.vm)) {
      yield* playMenuCredits(h, events, m);
      choice = yield* menu(false);
      titleNext = true;
    } else if (titleNext) {
      yield* playTitle(h, events);
      choice = yield* menu(false);
      titleNext = false;
    } else {
      yield* attractGame(h, events);
      choice = yield* menu(false);
      titleNext = true;
    }
  }
  return choice;
}

// The credits from the start menu's Credits row (src/game/credits.mjs) set up the game's sounds,
// play the ending room's music and afterwards stop it and load the title's sounds.
function* playMenuCredits(h, events, m) {
  // The room music field does not describe the title audio. Always load the game
  // directory: the credits also play game sound 2E, which is invalid in the title.
  yield () => {
    setUpGameAudio(m);
    setMusicMode(m.mem, m.port, endingMusic(m.mem));
  };
  yield () => markMenuCredits(h.a.vm, true);
  yield* playCutscene(h, events, CREDITS_SEQUENCE, CREDITS_ARGUMENT);
  yield () => markMenuCredits(h.a.vm, false);
  // The music stop 81:EF94 with its sound command 81:F007.
  yield () => {
    setWord(h.a.mem.wram, MUSIC, WORD_MASK);
    sendApuCommandInPlace(h, APU_COMMAND_VOLUME_TARGET, 0);
  };
  yield () => {
    startSong(m.mem, m.port, SONG_NONE);
    loadSoundDirectory(m.mem, m.port, SOUND_DIRECTORY_TITLE);
  };
}

// 80:A168: the attract game, without the cycle's JSR frame (its return word lies only
// in free stack bytes). The game's sounds, the demo, then the scene screen and the
// title's sounds again for the start menu.
export function* attractGame(h, events) {
  let m;
  yield () => {
    m = sceneRuntime(h);
    setUpGameAudio(m);
  };
  yield* attractDemo(h, events);
  yield () => {
    startSceneScreen(m.wram, m.video, m.port);
    startSong(m.mem, m.port, SONG_NONE);
    loadSoundDirectory(m.mem, m.port, SOUND_DIRECTORY_TITLE);
    setUpTitleAudio(m);
  };
}

// 80:96F3: no countdown, a new game's state and the ordinary game rounds in room AB
// until the demo ends. The room and demo return through generator composition;
// their scheduler visits still retain the separate native compatibility adapter.
export function* attractDemo(h, events) {
  yield () => {
    setWord(h.a.mem.wram, TIMER, TIMER_STOPPED);
  };
  yield () => startNewGame(h.a);
  yield* runAttractRounds(h, events, ATTRACT_ROOM);
}
