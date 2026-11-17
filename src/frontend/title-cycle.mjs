// The title cycle and the attract game (lifted from 80:A18C, 80:A168 and 80:96F3;
// register-level reference in proof/frontend-reference/title-cycle.mjs).
//
// The cycle shows the title (or, after a game, goes straight to the start menu with
// the title song) and then the start menu until the player chooses a game. A menu
// that times out plays the attract game, a demo of the game in room AB, and shows
// the menu again. The port's Credits row (src/game/credits.mjs) plays the credits
// instead of the attract game.
import { dialogCallBody, segmentSequence } from '../system/native-call-continuation.mjs';
import { titleSequence } from './title.mjs';
import { startMenuSequence } from './start-menu.mjs';
import { attractRoundsSequence } from './attract-rounds.mjs';
import { runNewGame } from '../game/game-start.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { startSceneScreen } from '../system/nmi.mjs';
import { loadSoundDirectory, setMusicMode, startSong } from '../apu/music-mode.mjs';
import { setUpGameAudio, setUpTitleAudio } from '../intro/intro-scene.mjs';
import { cutsceneSequence } from '../cutscene/cutscene-scene.mjs';
import { sendApuCommandRoutine } from '../apu/audio-routines.mjs';
import {
  CREDITS_ARGUMENT,
  CREDITS_SEQUENCE,
  endingMusic,
  markMenuCredits,
  takeCreditsRequest,
} from '../game/credits.mjs';
import { MUSIC, TIMER, TIMER_STOPPED } from '../data/wram.mjs';
import { APU_COMMAND_VOLUME_TARGET, SOUND_DIRECTORY_TITLE } from '../constants/sound-commands.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK } from '../constants/bits.mjs';

// The routines the cycle calls through their original frames: the title, the start
// menu, the attract game and its owner, the credits cutscene, the music stop, and
// the new game set-up and room start of the attract game.
const TITLE = 0x81d694,
  START_MENU = 0x81e14a,
  ATTRACT_GAME = 0x80a168,
  ATTRACT_OWNER = 0x8096f3,
  CUTSCENE = 0x81cdf8,
  MUSIC_STOP = 0x81ef94,
  NEW_GAME = 0x80960d,
  START_ROOM = 0x809699;
// Call sites (the return addresses the callees see).
const TITLE_SITE = 0x80a1b1,
  TITLE_AGAIN_SITE = 0x80a1c0,
  MENU_AFTER_TITLE_SITE = 0x80a1ba,
  MENU_SITE = 0x80a1c7,
  MENU_AGAIN_SITE = 0x80a1d6,
  ATTRACT_SITE = 0x80a1d0,
  ATTRACT_OWNER_SITE = 0x80a16c,
  NEW_GAME_SITE = 0x8096f6,
  START_ROOM_SITE = 0x8096fc;
// The title song; the start menu's answer of a cancel or timeout; the attract room.
const SONG_NONE = 0,
  SONG_TITLE = 1,
  MENU_CANCELLED = 0xfffe,
  ATTRACT_ROOM = 0xab;
// 81:DDB1 (the title's audio) leaves the data bank at 81.
const TITLE_AUDIO_BANK = 0x81;

const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// 80:A18C: the title cycle. A is zero when the cycle starts after a game (no
// title). Returns the start menu's choice in A: the save slot, or FFFF for a new
// game. X and Y are left as the menu leaves them, the status as at the entry.
export function* titleCycleSequence(h, events, routines) {
  const { ctx } = h,
    status = ctx.status,
    afterGame = (ctx.a & WORD_MASK) === 0,
    call = (site, target, sequence, long = true) =>
      dialogCallBody(h, site, target, () => sequence(h, events, routines), long);
  let m;
  // The menu times out sooner right after the whole title (A nonzero).
  const menu = function* (site, shortTimeout) {
    ctx.a = shortTimeout ? 1 : 0;
    yield* call(site, START_MENU, startMenuSequence);
    return ctx.a & WORD_MASK;
  };
  yield () => {
    m = sceneRuntime(h);
    ctx.bank = CODE_BANK;
    startSong(m.mem, m.port, SONG_NONE);
    loadSoundDirectory(m.mem, m.port, SOUND_DIRECTORY_TITLE);
  };
  let choice, titleNext;
  if (afterGame) {
    yield () => {
      setUpTitleAudio(m);
      ctx.bank = TITLE_AUDIO_BANK;
      startSong(m.mem, m.port, SONG_TITLE);
    };
    choice = yield* menu(MENU_AGAIN_SITE, false);
    titleNext = true;
  } else {
    yield* call(TITLE_SITE, TITLE, titleSequence);
    // The title returns 0 after the whole title, 1 when a button ended it.
    const wholeTitle = (ctx.a & BYTE_MASK) === 0;
    choice = yield* menu(wholeTitle ? MENU_AFTER_TITLE_SITE : MENU_SITE, wholeTitle);
    titleNext = false;
  }
  // A cancelled menu shows the attract game and the title in turn, each followed
  // by the menu; the Credits row plays the credits and shows the menu again.
  while (choice === MENU_CANCELLED) {
    if (takeCreditsRequest(h.a.vm)) {
      yield* playMenuCredits(h, events, m);
      choice = yield* menu(MENU_AGAIN_SITE, false);
      titleNext = true;
    } else if (titleNext) {
      yield* call(TITLE_AGAIN_SITE, TITLE, titleSequence);
      choice = yield* menu(MENU_SITE, false);
      titleNext = false;
    } else {
      yield* call(ATTRACT_SITE, ATTRACT_GAME, attractGameSequence, false);
      choice = yield* menu(MENU_AGAIN_SITE, false);
      titleNext = true;
    }
  }
  let result;
  yield () => {
    ctx.bank = CODE_BANK;
    ctx.a = choice;
    ctx.status = status;
    result = h.rts();
  };
  return result;
}

// The credits from the start menu's Credits row (src/game/credits.mjs), called with
// the frame of the attract game. They set up the game's sounds,
// play the ending room's music and afterwards stop it and load the title's sounds.
function* playMenuCredits(h, events, m) {
  const { ctx } = h;
  // The room music field does not describe the title audio. Always load the game
  // directory: the credits also play game sound 2E, which is invalid in the title.
  yield () => {
    setUpGameAudio(m);
    ctx.bank = CODE_BANK;
    setMusicMode(m.mem, m.port, endingMusic(m.mem));
  };
  yield () => {
    ctx.a = CREDITS_SEQUENCE;
    ctx.x = CREDITS_ARGUMENT;
    markMenuCredits(h.a.vm, true);
  };
  yield* dialogCallBody(h, ATTRACT_SITE, CUTSCENE, () => cutsceneSequence(h, events), true);
  yield () => markMenuCredits(h.a.vm, false);
  yield () => {
    ctx.bank = CODE_BANK;
  };
  yield* dialogCallBody(
    h,
    ATTRACT_SITE,
    MUSIC_STOP,
    function* () {
      yield () => {
        h.load(WORD_MASK);
        h.write(h.abs(MUSIC), ctx.a);
        h.load(APU_COMMAND_VOLUME_TARGET);
        h.index('x', 0);
        h.call(0x81efa0, 0x81f007, () => sendApuCommandRoutine(h), true);
        return h.rtl();
      };
    },
    true,
  );
  yield () => {
    startSong(m.mem, m.port, SONG_NONE);
    loadSoundDirectory(m.mem, m.port, SOUND_DIRECTORY_TITLE);
  };
}

// 80:A168: the attract game. The game's sounds, the demo, then the scene screen and
// the title's sounds again for the start menu.
export function* attractGameSequence(h, events, routines) {
  const { ctx } = h;
  let m;
  yield () => {
    m = sceneRuntime(h);
    setUpGameAudio(m);
    ctx.bank = CODE_BANK;
  };
  yield* dialogCallBody(
    h,
    ATTRACT_OWNER_SITE,
    ATTRACT_OWNER,
    () => attractDemoSequence(h, events, routines),
    true,
  );
  let result;
  yield () => {
    startSceneScreen(m.wram, m.video, m.port);
    startSong(m.mem, m.port, SONG_NONE);
    loadSoundDirectory(m.mem, m.port, SOUND_DIRECTORY_TITLE);
    setUpTitleAudio(m);
    ctx.bank = TITLE_AUDIO_BANK;
    result = h.rts();
  };
  return result;
}

// 80:96F3: the demo itself. No countdown, a new game's state, and the game's main
// loop in room AB (80:9699, register-level) until the demo ends.
export function* attractDemoSequence(h, events, routines) {
  const { ctx } = h;
  yield () => {
    ctx.bank = CODE_BANK;
    setWord(h.a.mem.wram, TIMER, TIMER_STOPPED);
  };
  yield* dialogCallBody(h, NEW_GAME_SITE, NEW_GAME, () => segmentSequence(() => runNewGame(h)));
  yield () => {
    ctx.a = ATTRACT_ROOM;
  };
  yield* dialogCallBody(h, START_ROOM_SITE, START_ROOM, () =>
    attractRoundsSequence(h, events, routines),
  );
  let result;
  yield () => {
    result = h.rtl();
  };
  return result;
}
