// Presentation-only music replacement. The original DSP, driver and ARAM still run
// unchanged, including music beats, voice allocation, ENVX/OUTX and echo writes.
// A second output mix reuses the established DSP echo equations with its own RAM;
// only voices not owned by song notes enter this mix (driver $0717/$07A0).
import { Apu, CoupledDsp } from './apu.mjs';
import { Dsp, ECHO_FIRST_STEP, ECHO_LAST_STEP } from './dsp.mjs';
import { SoundDriver } from './sound-driver.mjs';
import {
  SONG,
  SONG_FLAGS,
  SONG_TABLE,
  SONG_VOICES,
  PARAM_LOW,
  CHOSEN_VOICE_BIT,
} from './sound-driver-memory.mjs';
import { FLG, FLG_ECHO_OFF, FLG_MUTE, FLG_RESET, MVOL_L, MVOL_R } from './dsp-registers.mjs';
import { ARAM_SIZE } from './spc-io.mjs';
import { BYTE_BITS } from '../constants/bits.mjs';
import {
  TITLE_SONG_TABLE,
  TITLE_MENU_SONG,
  TITLE_MUSIC_ACCENT_LAST,
} from '../constants/sound-commands.mjs';

const SIGNED_VOLUME_MAX = 0x7f,
  BYTE_SIGN_SHIFT = 24;
const volume = (v) => Math.abs((v << BYTE_SIGN_SHIFT) >> BYTE_SIGN_SHIFT) / SIGNED_VOLUME_MAX;

export class SoundtrackDsp extends CoupledDsp {
  enableEffectsOutput(length) {
    this.effects = new Dsp(new Uint8Array(ARAM_SIZE));
    this.effects.regs = this.regs;
    this.effects.out = new Int16Array(length);
  }
  step(step, voice) {
    super.step(step, voice);
    if (this.effects && step >= ECHO_FIRST_STEP && step <= ECHO_LAST_STEP)
      this.effects.step(step, voice);
  }
  voiceOutput(voice, channel) {
    super.voiceOutput(voice, channel);
    const effects = this.effects;
    if (!effects || (this.ram[SONG_VOICES] | this.menuMusicVoices) & voice.bit) return;
    effects.output = this.output;
    effects.eon = this.eon;
    effects.voiceOutput(voice, channel);
  }
  write(address, value) {
    // The driver disables echo and clears its memory in $0366 before changing
    // headers. Clear only the private presentation buffer at the same boundary.
    if (this.effects && address === FLG && value & (FLG_ECHO_OFF | FLG_RESET)) {
      this.effects.ram.fill(0);
      this.effects.history.fill(0);
    }
    super.write(address, value);
  }
}

class SoundtrackDriver extends SoundDriver {
  constructor(ram, io, music) {
    super(ram, io);
    this.music = music;
  }
  song06A3() {
    super.song06A3();
    this.music.revision++;
  }
  stopAll05A0() {
    super.stopAll05A0();
    this.music.playing = false;
  }
  start06AC() {
    super.start06AC();
    this.music.playing = !!this.ram[SONG];
  }
  sound0717() {
    // The menu's animated pitched accents belong to the replaced music bed.
    // UI move/choose sounds 09/08 and all gameplay effects remain in the SFX mix.
    this.menuAccent =
      this.ptr(SONG_TABLE) === TITLE_SONG_TABLE &&
      this.ram[SONG] === TITLE_MENU_SONG &&
      this.ram[PARAM_LOW] <= TITLE_MUSIC_ACCENT_LAST;
    try {
      return super.sound0717();
    } finally {
      this.menuAccent = false;
    }
  }
  start07A0(x) {
    const result = super.start07A0(x),
      bit = this.ram[CHOSEN_VOICE_BIT],
      dsp = this.io.dsp;
    dsp.menuMusicVoices = this.menuAccent ? dsp.menuMusicVoices | bit : dsp.menuMusicVoices & ~bit;
    return result;
  }
}

export class SoundtrackApu extends Apu {
  constructor() {
    const music = { revision: 0, playing: false };
    super({
      dsp: (ram) => new SoundtrackDsp(ram),
      driver: (ram, io) => new SoundtrackDriver(ram, io, music).run(),
    });
    this.music = music;
  }
  enableOutput(frames) {
    super.enableOutput(frames);
    this.dsp.enableEffectsOutput(this.dsp.out.length);
  }
  takeEffectsOutput() {
    const effects = this.dsp.effects,
      samples = effects.out.slice(0, effects.outCount);
    effects.outCount = 0;
    return samples;
  }
  musicState() {
    const r = this.ram,
      regs = this.dsp.regs;
    return {
      revision: this.music.revision,
      // Album duration is independent of the original note list. Its natural
      // end does not stop a looping tribute; explicit driver stops still do.
      playing: this.state === 'driver' && this.music.playing,
      table: r[SONG_TABLE] | (r[SONG_TABLE + 1] << BYTE_BITS),
      song: r[SONG],
      repeat: !!(r[SONG_FLAGS] & 1),
      volume: regs[FLG] & FLG_MUTE ? 0 : (volume(regs[MVOL_L]) + volume(regs[MVOL_R])) / 2,
    };
  }
}
