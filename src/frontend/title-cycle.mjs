// The title cycle and the attract game (lifted from 80:A18C, 80:A168 and 80:96F3;
// register-level reference in proof/frontend-reference/title-cycle.mjs).
//
// The cycle shows the title (or, after a game, goes straight to the start menu with
// the title song) and then the start menu until the player chooses a game. A menu
// that times out plays the attract game, a demo of the game in room AB, and shows
// the menu again. The port's Credits row (src/game/credits.mjs) plays the credits
// instead of the attract game.
import { nativeCallSequence, drainNativeSequence } from '../task/native-call-continuation.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { startSceneScreen } from '../system/nmi.mjs';
import { loadSoundDirectory, setMusicMode, startSong } from '../apu/music-mode.mjs';
import { setUpGameAudio, setUpTitleAudio } from '../intro/intro-scene.mjs';
import {
  CREDITS_ARGUMENT,
  CREDITS_SEQUENCE,
  endingMusic,
  markMenuCredits,
  musicSilent,
  takeCreditsRequest,
} from '../game/credits.mjs';
import { TIMER, TIMER_STOPPED } from '../task/wram.mjs';
import { SOUND_DIRECTORY_TITLE } from '../constants/sound-commands.mjs';
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
    call = (site, target, long = true) =>
      nativeCallSequence(h, events, routines, site, target, long);
  let m;
  // The menu times out sooner right after the whole title (A nonzero).
  const menu = function* (site, shortTimeout) {
    ctx.a = shortTimeout ? 1 : 0;
    yield* call(site, START_MENU);
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
    yield* call(TITLE_SITE, TITLE);
    // The title returns 0 after the whole title, 1 when a button ended it.
    const wholeTitle = (ctx.a & BYTE_MASK) === 0;
    choice = yield* menu(wholeTitle ? MENU_AFTER_TITLE_SITE : MENU_SITE, wholeTitle);
    titleNext = false;
  }
  // A cancelled menu shows the attract game and the title in turn, each followed
  // by the menu; the Credits row plays the credits and shows the menu again.
  while (choice === MENU_CANCELLED) {
    if (takeCreditsRequest(h.a.vm)) {
      yield* playMenuCredits(h, events, routines, m);
      choice = yield* menu(MENU_AGAIN_SITE, false);
      titleNext = true;
    } else if (titleNext) {
      yield* call(TITLE_AGAIN_SITE, TITLE);
      choice = yield* menu(MENU_SITE, false);
      titleNext = false;
    } else {
      yield* call(ATTRACT_SITE, ATTRACT_GAME, false);
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
// the frame of the attract game. Without music they set up the game's sounds,
// play the ending room's music and afterwards stop it and load the title's sounds.
function* playMenuCredits(h, events, routines, m) {
  const { ctx } = h,
    call = (target) => nativeCallSequence(h, events, routines, ATTRACT_SITE, target, true),
    silent = musicSilent(m.wram);
  if (silent)
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
  yield* call(CUTSCENE);
  yield () => markMenuCredits(h.a.vm, false);
  if (!silent) return;
  yield () => {
    ctx.bank = CODE_BANK;
  };
  yield* call(MUSIC_STOP);
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
  yield* nativeCallSequence(h, events, routines, ATTRACT_OWNER_SITE, ATTRACT_OWNER, true);
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
  yield* nativeCallSequence(h, events, routines, NEW_GAME_SITE, NEW_GAME);
  yield () => {
    ctx.a = ATTRACT_ROOM;
  };
  yield* nativeCallSequence(h, events, routines, START_ROOM_SITE, START_ROOM);
  let result;
  yield () => {
    result = h.rtl();
  };
  return result;
}

// Run wrappers for the routine tables.
export function runTitleCycle(h, e, r) {
  return drainNativeSequence(titleCycleSequence(h, e, r));
}
export function runAttractGame(h, e, r) {
  return drainNativeSequence(attractGameSequence(h, e, r));
}
export function playAttractDemo(h, e, r) {
  return drainNativeSequence(attractDemoSequence(h, e, r));
}
