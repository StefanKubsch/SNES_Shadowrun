// Timer handlers of the native sound driver: the sequencer on timer 0
// ($0A0D) and the effects on timer 1 ($0C89) with glide and vibrato.
import { ADSR2, PITCH_L, VOICE_COUNT } from './dsp-registers.mjs';
import { TIMER0, DSP_ADDRESS, DSP_DATA } from './spc-io.mjs';
import {
  xcn,
  spcDivide,
  ACTIVE_TRACKS,
  BEAT,
  CANDIDATE_VOICES,
  CHANNEL_VOLUME_L,
  CHANNEL_VOLUME_R,
  CHOSEN_VOICE,
  CURRENT_TRACK,
  EFFECT_VOICE,
  GLIDE_MODE,
  GLIDE_TARGET,
  INSTRUMENT_SOUNDS,
  KEY_OFF_PENDING,
  KEY_ON_PENDING,
  PARAM_HIGH,
  PARAM_LOW,
  PATTERN_OFFSET,
  PATTERN_POINTER,
  RELEASE_ADSR,
  SEQUENCE_POINTER_HIGH,
  SEQUENCE_POINTER_LOW,
  SEQUENCE_WAIT,
  SONG_FLAGS,
  TEMPO,
  TEMPO_LIST,
  TEMPO_LIST_WAIT,
  TRACK_DURATION,
  TRACK_LIST,
  TRACK_PATTERN,
  VIBRATO_SINE,
  VOICE_BITS,
  VOICE_NOTE,
  VOICE_RANK,
  VOLUME_RAMP_L,
  VOLUME_RAMP_R,
  GLIDE_NOTE,
  NOTE_TABLE_HIGH,
  NOTE_TABLE_LOW,
  SEQUENCE_VOICES,
  SEQUENCE_VOLUME_L,
  SEQUENCE_VOLUME_R,
  SONG_VOLUME_L,
  SONG_VOLUME_R,
  SOUND_VOLUME_L,
  SOUND_VOLUME_R,
  TEMPO_SCALE,
  TRACK_VOICE,
  TRACK_VOICES,
  VIBRATO_DEPTH,
  VIBRATO_PHASE_HIGH,
  VIBRATO_PHASE_LOW,
  VIBRATO_SPEED_HIGH,
  VIBRATO_SPEED_LOW,
  VOICE_PITCH_HIGH,
  VOICE_PITCH_LOW,
  CHANNEL_COUNT,
  NO_NOTE,
  TEMPO_SCALE_UNIT,
  TRACK_COUNT,
  VIBRATO_SINE_MASK,
  BEAT_COUNT,
  BEAT_STEP,
  BEAT_STEPS,
  ENTRY_HELD,
  NOTE_OCTAVE_MASK,
  NOTES_PER_OCTAVE,
  OWNER_INSTRUMENT_MASK,
  SAVED_VOLUME_L,
  SAVED_VOLUME_R,
  SONG_STEP,
  SOUND_ENTRY_FLAGS,
  VOICE_NOTE_OWNER,
} from './sound-driver-memory.mjs';
import { DriverVoices } from './sound-driver-voices.mjs';
import { BYTE_MASK, WORD_MASK, BYTE_BITS, BYTE_SIGN, NIBBLE_MASK } from '../constants/bits.mjs';

// Tempo and volume list ($0A1C) and sound sequences ($0C9F): bytes with bit 7
// clear are waits; $FF ends the tempo list, $F8 sets the tempo; $80 plays a
// sound in a sequence.
const LIST_COMMAND = 0x80,
  TEMPO_LIST_END = 0xff,
  TEMPO_LIST_TEMPO = 0xf8,
  SEQUENCE_PLAY = 0x80;
// After the end byte the tempo list waits the longest time and then reads the
// end byte again. A volume byte names the channel in bits 0-2; any of bits 3-6
// set makes the two values ramp steps instead of volumes.
const TEMPO_LIST_END_WAIT = 0xff,
  LIST_CHANNEL_MASK = 7,
  LIST_RAMP_SHIFT = 3,
  LIST_RAMP_MASK = 15;
// $0A0D: the song step counts modulo 16; the tempo list counts down every
// fourth step and the volume ramps ($0C5E) run at step 0.
const SONG_STEP_MASK = 15,
  TEMPO_LIST_STEP_MASK = 3;
// X after a voice loop from 7 down that found nothing ($0BB1, $0C07).
const VOICE_LOOP_DONE = 0xff;
// Helper bytes of the direct page, by routine. $0B55: note and instrument
// byte of the event. $0C07: bend factor word ($07 = event bits 0-3 as the high
// byte) and the bent pitch word. $0C9F: sound volume L/R saved around the
// sequence sound. $0D1C: octave of the glide note and the pitch word.
const EVENT_INSTRUMENT = 0x08,
  EVENT_NOTE_BYTE = 0x09,
  BEND_FACTOR = 0x06,
  BEND_PITCH = 0x04,
  SEQUENCE_SAVED_VOLUME = 0x06,
  GLIDE_OCTAVE = 0x04,
  GLIDE_PITCH = 0x02;
// A channel volume that ramps up past the top stays at the maximum ($0C5E).
const CHANNEL_VOLUME_MAX = 0xff;
// $0C89: the sound sequences run on effect rounds 2 and 6 (channel 0 and 1).
const SEQUENCE_ROUND_MASK = 3,
  SEQUENCE_ROUND = 2,
  SEQUENCE_CHANNEL_SHIFT = 2;
// $0D1C: glide mode in bits 0-1: 1 moves every round, 2 every second round
// (bit 7 toggles), 0 and 3 every fourth round (bits 6-7 count). A step below
// note 0 goes to note 11 of the octave below, a step past note 11 to note 0
// of the next octave.
const GLIDE_MODE_MASK = 3,
  GLIDE_EVERY_SECOND = 2,
  GLIDE_EVERY_FOURTH = 3,
  GLIDE_ROUND_STEP = 0x40,
  GLIDE_ROUND_MASK = 0xc0,
  GLIDE_HALF_TOGGLE = 0x80,
  NEXT_OCTAVE = 0x10;
// $0DBF: high byte added to the pitch for a negative vibrato offset.
const VIBRATO_NEGATIVE_HIGH = 0xff;
// Track events ($0B1E): durations below $80, then by the top three bits a
// note ($0B55), a note release ($0BB1) or a pitch bend ($0C07); $FF ends the pattern.
const EVENT_TYPE_MASK = 0xe0,
  EVENT_NOTE = 0x80,
  EVENT_NOTE_OFF = 0xa0,
  EVENT_BEND = 0xc0,
  EVENT_END = 0xff;

export class DriverSequencer extends DriverVoices {
  // $0A0D: sequencer, one step per pulse of timer 0.
  sequencer0A0D() {
    const r = this.ram;
    r[SONG_STEP] = (r[SONG_STEP] + 1) & SONG_STEP_MASK;
    if (!(r[SONG_STEP] & TEMPO_LIST_STEP_MASK)) {
      r[TEMPO_LIST_WAIT] = (r[TEMPO_LIST_WAIT] - 1) & BYTE_MASK;
      if (!r[TEMPO_LIST_WAIT]) this.tempoList0A1C();
    }
    r[CURRENT_TRACK] = 0;
    do {
      const x = r[CURRENT_TRACK];
      r[TRACK_DURATION + x] = (r[TRACK_DURATION + x] - 1) & BYTE_MASK;
      if (!r[TRACK_DURATION + x]) this.track0A91(x);
      r[CURRENT_TRACK] = (r[CURRENT_TRACK] + 1) & BYTE_MASK;
    } while (r[CURRENT_TRACK] !== TRACK_COUNT);
    let a = (r[BEAT_STEP] + 1) & BYTE_MASK;
    if (a === BEAT_STEPS) {
      a = (r[BEAT_COUNT] + 1) & BYTE_MASK;
      r[BEAT] = a;
      r[BEAT_COUNT] = a;
      a = 0;
    }
    r[BEAT_STEP] = a;
    if (r[ACTIVE_TRACKS] === 0 && r[SONG_FLAGS] & 1) {
      this.reset04AC();
      this.start06AC();
    }
    this.ramps0C5E();
  }
  // $0A1C: tempo and volume list at [$A3].
  tempoList0A1C() {
    const r = this.ram,
      list = () => this.ptr(TEMPO_LIST);
    let y = 0;
    for (;;) {
      let a = this.load(list() + y);
      if (!(a & LIST_COMMAND)) {
        y = (y + 1) & BYTE_MASK;
        r[TEMPO_LIST_WAIT] = (a + 1) & BYTE_MASK;
        break;
      }
      if (a === TEMPO_LIST_END) {
        r[TEMPO_LIST_WAIT] = TEMPO_LIST_END_WAIT;
        break;
      }
      if (a === TEMPO_LIST_TEMPO) {
        y = (y + 1) & BYTE_MASK;
        a = this.load(list() + y);
        y = (y + 1) & BYTE_MASK;
        const { a: tempo } = spcDivide(a * r[TEMPO_SCALE], TEMPO_SCALE_UNIT);
        r[TEMPO] = tempo;
        this.io.write(TIMER0, tempo);
        continue;
      }
      const x = (r[0x00] = a & LIST_CHANNEL_MASK);
      y = (y + 1) & BYTE_MASK;
      const left = this.load(list() + y);
      y = (y + 1) & BYTE_MASK;
      const right = this.load(list() + y);
      y = (y + 1) & BYTE_MASK;
      if ((a >> LIST_RAMP_SHIFT) & LIST_RAMP_MASK) {
        r[VOLUME_RAMP_L + x] = left;
        r[VOLUME_RAMP_R + x] = right;
      } else {
        r[CHANNEL_VOLUME_L + x] = left;
        r[CHANNEL_VOLUME_R + x] = right;
        r[VOLUME_RAMP_L + x] = 0;
        r[VOLUME_RAMP_R + x] = 0;
      }
    }
    const sum = y + r[TEMPO_LIST];
    r[TEMPO_LIST] = sum & BYTE_MASK;
    r[TEMPO_LIST + 1] = (r[TEMPO_LIST + 1] + (sum >> BYTE_BITS)) & BYTE_MASK;
  }
  // $0A91: continue reading a track ($E7) whose duration has expired. Returns
  // the original's X at the end (for $0B3B, which jumps to $0A9A with the current X).
  track0A91(track) {
    const r = this.ram;
    let x = track << 1;
    if (r[TRACK_PATTERN + x] | r[TRACK_PATTERN + 1 + x]) return this.pattern0AC6(x);
    return this.list0A9A(x);
  }
  list0A9A(x) {
    const r = this.ram;
    x &= BYTE_MASK;
    r[PATTERN_POINTER] = this.zp(TRACK_LIST + x);
    r[PATTERN_POINTER + 1] = this.zp(TRACK_LIST + 1 + x);
    const p = this.ptr(PATTERN_POINTER);
    const low = this.load(p),
      high = this.load(p + 1);
    this.setZp(TRACK_PATTERN + x, low);
    r[0x00] = low;
    this.setZp(TRACK_PATTERN + 1 + x, high);
    if (!(low | high)) {
      // $0B11: track finished.
      r[ACTIVE_TRACKS] = (r[VOICE_BITS + r[CURRENT_TRACK]] ^ BYTE_MASK) & r[ACTIVE_TRACKS];
      return x;
    }
    const s = this.zp(TRACK_LIST + x) + 2;
    this.setZp(TRACK_LIST + x, s & BYTE_MASK);
    this.setZp(TRACK_LIST + 1 + x, (this.zp(TRACK_LIST + 1 + x) + (s >> BYTE_BITS)) & BYTE_MASK);
    r[BEAT_COUNT] = 0;
    r[BEAT] = 0;
    return this.pattern0AC6(x);
  }
  pattern0AC6(x) {
    const r = this.ram;
    r[PATTERN_OFFSET] = 0;
    r[PATTERN_POINTER] = this.zp(TRACK_PATTERN + x);
    r[PATTERN_POINTER + 1] = this.zp(TRACK_PATTERN + 1 + x);
    return this.events0B1E(x);
  }
  // $0B1E: events of the track up to a duration.
  events0B1E(x) {
    const r = this.ram;
    for (;;) {
      let y = r[PATTERN_OFFSET];
      const a = this.load(this.ptr(PATTERN_POINTER) + y);
      y = (y + 1) & BYTE_MASK;
      if (a === EVENT_END) return this.list0A9A(r[CURRENT_TRACK] << 1);
      if (a < EVENT_NOTE) {
        r[PATTERN_OFFSET] = y;
        this.setZp(TRACK_DURATION + r[CURRENT_TRACK], (a + 1) & BYTE_MASK);
        // $0AD3: pattern pointer += $E6.
        const t = (r[CURRENT_TRACK] << 1) & BYTE_MASK,
          sum = r[PATTERN_POINTER] + r[PATTERN_OFFSET];
        r[(TRACK_PATTERN + t) & BYTE_MASK] = sum & BYTE_MASK;
        r[(TRACK_PATTERN + 1 + t) & BYTE_MASK] =
          (r[PATTERN_POINTER + 1] + (sum >> BYTE_BITS)) & BYTE_MASK;
        return r[CURRENT_TRACK];
      }
      r[0x00] = a;
      switch (a & EVENT_TYPE_MASK) {
        case EVENT_NOTE:
          x = this.note0B55(y);
          break;
        case EVENT_NOTE_OFF:
          x = this.noteOff0BB1(y);
          break;
        case EVENT_BEND:
          this.bend0C07(y);
          x = VOICE_LOOP_DONE;
          break;
        default:
          return this.list0A9A(x);
      }
    }
  }
  // $0B55: note ($1F) with sound $AD+[instrument] and volume from a nibble.
  note0B55(y) {
    const r = this.ram,
      p = this.ptr(PATTERN_POINTER);
    r[0x00] = xcn(r[0x00]) | NIBBLE_MASK;
    const note = this.load(p + y);
    y = (y + 1) & BYTE_MASK;
    r[PARAM_HIGH] = note;
    r[EVENT_NOTE_BYTE] = note;
    const instrument = this.load(p + y);
    r[EVENT_INSTRUMENT] = instrument;
    r[PARAM_LOW] = this.zp(INSTRUMENT_SOUNDS + instrument);
    y = (y + 1) & BYTE_MASK;
    r[SAVED_VOLUME_L] = r[SOUND_VOLUME_L];
    r[SAVED_VOLUME_R] = r[SOUND_VOLUME_R];
    const t = r[CURRENT_TRACK];
    r[SOUND_VOLUME_L] =
      (((r[0x00] * r[CHANNEL_VOLUME_L + t]) >> BYTE_BITS) * r[SONG_VOLUME_L]) >> BYTE_BITS;
    r[SOUND_VOLUME_R] =
      (((r[0x00] * r[CHANNEL_VOLUME_R + t]) >> BYTE_BITS) * r[SONG_VOLUME_R]) >> BYTE_BITS;
    r[CANDIDATE_VOICES] = r[TRACK_VOICES + t];
    r[CHOSEN_VOICE] = r[TRACK_VOICE + t];
    const { x } = this.play0776();
    r[SOUND_VOLUME_L] = r[SAVED_VOLUME_L];
    r[SOUND_VOLUME_R] = r[SAVED_VOLUME_R];
    r[TRACK_VOICE + t] = x;
    if (r[SOUND_ENTRY_FLAGS] & ENTRY_HELD) {
      this.setZp(VOICE_NOTE_OWNER + x, ((xcn(t) << 1) & BYTE_MASK) | r[EVENT_INSTRUMENT]);
      this.setZp(VOICE_NOTE + x, r[EVENT_NOTE_BYTE]);
    }
    r[PATTERN_OFFSET] = y;
    return x;
  }
  // $0BB1: release a note if a voice plays it on this track.
  noteOff0BB1(y) {
    const r = this.ram;
    r[0x00] = r[0x00] & OWNER_INSTRUMENT_MASK;
    r[0x00] = ((xcn(r[CURRENT_TRACK]) << 1) & BYTE_MASK) | r[0x00];
    const a = this.load(this.ptr(PATTERN_POINTER) + y);
    r[PATTERN_OFFSET] = (y + 1) & BYTE_MASK;
    for (let x = VOICE_COUNT - 1; x >= 0; x--) {
      if (a !== r[VOICE_NOTE + x] || r[VOICE_NOTE_OWNER + x] !== r[0x00]) continue;
      r[VOICE_NOTE + x] = NO_NOTE;
      r[VOICE_RANK + x] = 0;
      const release = r[RELEASE_ADSR + x];
      if (release) {
        r[KEY_ON_PENDING] = (r[VOICE_BITS + x] ^ BYTE_MASK) & r[KEY_ON_PENDING];
        this.dsp(xcn(x) | ADSR2, release);
      } else {
        const bit = r[VOICE_BITS + x];
        r[KEY_OFF_PENDING] |= bit;
        r[KEY_ON_PENDING] = (bit ^ BYTE_MASK) & r[KEY_ON_PENDING];
      }
      return x;
    }
    return VOICE_LOOP_DONE;
  }
  // $0C07: pitch bend of the voices of this track: pitch * $07$06 / 256.
  bend0C07(y) {
    const r = this.ram,
      io = this.io;
    const a = this.load(this.ptr(PATTERN_POINTER) + y);
    r[PATTERN_OFFSET] = (y + 1) & BYTE_MASK;
    r[BEND_FACTOR] = a;
    r[BEND_FACTOR + 1] = r[0x00] & NIBBLE_MASK;
    for (let x = VOICE_COUNT - 1; x >= 0; x--) {
      if (
        r[VOICE_NOTE + x] === NO_NOTE ||
        (xcn(r[VOICE_NOTE_OWNER + x] >> 1) & (TRACK_COUNT - 1)) !== r[CURRENT_TRACK]
      )
        continue;
      const lo = r[VOICE_PITCH_LOW + x],
        hi = r[VOICE_PITCH_HIGH + x];
      r[BEND_PITCH] = (lo * r[BEND_FACTOR]) >> BYTE_BITS;
      r[BEND_PITCH + 1] = (hi * r[BEND_FACTOR + 1]) & BYTE_MASK;
      let w =
        (lo * r[BEND_FACTOR + 1] + (r[BEND_PITCH] | (r[BEND_PITCH + 1] << BYTE_BITS))) & WORD_MASK;
      r[BEND_PITCH] = w & BYTE_MASK;
      r[BEND_PITCH + 1] = w >> BYTE_BITS;
      w = (hi * r[BEND_FACTOR] + w) & WORD_MASK;
      r[BEND_PITCH] = w & BYTE_MASK;
      r[BEND_PITCH + 1] = w >> BYTE_BITS;
      const register = xcn(x) | PITCH_L;
      io.write(DSP_ADDRESS, register);
      io.write(DSP_DATA, r[BEND_PITCH]);
      io.write(DSP_ADDRESS, register + 1);
      io.write(DSP_DATA, r[BEND_PITCH + 1]);
    }
  }
  // $0C5E: volume ramps $01A2+X to $79+X (16 channels) when $EA = 0.
  ramps0C5E() {
    const r = this.ram;
    if (r[SONG_STEP]) return;
    for (let x = CHANNEL_COUNT - 1; x >= 0; x--) {
      const step = r[VOLUME_RAMP_L + x];
      if (!step) continue;
      let a = step + r[CHANNEL_VOLUME_L + x];
      if (step & BYTE_SIGN) {
        if (a > BYTE_MASK) a &= BYTE_MASK;
        else {
          r[VOLUME_RAMP_L + x] = 0;
          a = 0;
        }
      } else if (a > BYTE_MASK) {
        r[VOLUME_RAMP_L + x] = 0;
        a = CHANNEL_VOLUME_MAX;
      }
      r[CHANNEL_VOLUME_L + x] = a;
    }
  }
  // $0C89: effects, one step per pulse of timer 1; one voice per round.
  effects0C89() {
    const r = this.ram;
    const a = (r[EFFECT_VOICE] + 1) % VOICE_COUNT;
    r[EFFECT_VOICE] = a;
    if (!a) this.fade03E3();
    else if ((a & SEQUENCE_ROUND_MASK) === SEQUENCE_ROUND)
      this.sequence0C9F(r[EFFECT_VOICE] >> SEQUENCE_CHANNEL_SHIFT);
    const x = r[EFFECT_VOICE];
    if (r[VOICE_BITS + x] & r[KEY_ON_PENDING]) return;
    this.duration0479(x);
    if (r[VIBRATO_SPEED_LOW + x] | r[VIBRATO_SPEED_HIGH + x]) this.vibrato0DBF(x);
    const mode = r[GLIDE_MODE + r[EFFECT_VOICE]];
    if (mode) this.glide0D1C(r[EFFECT_VOICE], mode);
  }
  // $0C9F: sound sequence on channel X ($77+X wait counter, pointer $73/$75+X).
  sequence0C9F(x) {
    const r = this.ram;
    if (!r[SEQUENCE_WAIT + x]) return;
    r[SEQUENCE_WAIT + x] = (r[SEQUENCE_WAIT + x] - 1) & BYTE_MASK;
    if (r[SEQUENCE_WAIT + x]) return;
    r[PATTERN_POINTER] = r[SEQUENCE_POINTER_LOW + x];
    r[PATTERN_POINTER + 1] = r[SEQUENCE_POINTER_HIGH + x];
    let y = 0;
    for (;;) {
      const a = this.load(this.ptr(PATTERN_POINTER) + y);
      if (!(a & LIST_COMMAND)) {
        r[SEQUENCE_WAIT + x] = (a + 1) & BYTE_MASK;
        break;
      }
      if (a !== SEQUENCE_PLAY) break;
      y = (y + 1) & BYTE_MASK;
      r[PARAM_LOW] = this.load(this.ptr(PATTERN_POINTER) + y);
      y = (y + 1) & BYTE_MASK;
      r[PARAM_HIGH] = this.load(this.ptr(PATTERN_POINTER) + y);
      y = (y + 1) & BYTE_MASK;
      r[CANDIDATE_VOICES] = r[SEQUENCE_VOICES + x];
      r[SEQUENCE_SAVED_VOLUME] = r[SOUND_VOLUME_L];
      r[SEQUENCE_SAVED_VOLUME + 1] = r[SOUND_VOLUME_R];
      r[SOUND_VOLUME_L] = r[SEQUENCE_VOLUME_L + x];
      r[SOUND_VOLUME_R] = r[SEQUENCE_VOLUME_R + x];
      this.sound0717();
      r[SOUND_VOLUME_L] = r[SEQUENCE_SAVED_VOLUME];
      r[SOUND_VOLUME_R] = r[SEQUENCE_SAVED_VOLUME + 1];
    }
    const sum = y + r[SEQUENCE_POINTER_LOW + x] + 1;
    r[SEQUENCE_POINTER_LOW + x] = sum & BYTE_MASK;
    if (sum > BYTE_MASK)
      r[SEQUENCE_POINTER_HIGH + x] = (r[SEQUENCE_POINTER_HIGH + x] + 1) & BYTE_MASK;
  }
  // $0D1C: glide of voice X to the target note $017A+X (mode in bits 0/1).
  glide0D1C(x, a) {
    const r = this.ram,
      io = this.io;
    const mode = a & GLIDE_MODE_MASK;
    if (mode === 0 || mode === GLIDE_EVERY_FOURTH) {
      const m = (r[GLIDE_MODE + x] + GLIDE_ROUND_STEP) & BYTE_MASK;
      r[GLIDE_MODE + x] = m;
      if (m & GLIDE_ROUND_MASK) return;
    } else if (mode === GLIDE_EVERY_SECOND) {
      const m = r[GLIDE_MODE + x] ^ GLIDE_HALF_TOGGLE;
      r[GLIDE_MODE + x] = m;
      if (m & GLIDE_HALF_TOGGLE) return;
    }
    r[GLIDE_OCTAVE] = r[GLIDE_NOTE + x] & NOTE_OCTAVE_MASK;
    let note = r[GLIDE_NOTE + x];
    if (note !== r[GLIDE_TARGET + x]) {
      let n;
      if (note > r[GLIDE_TARGET + x]) {
        n = ((note & NIBBLE_MASK) - 1) & BYTE_MASK;
        if (n & BYTE_SIGN) n = 0xfb; // magic-number-ok: original operand
      } else {
        n = (note & NIBBLE_MASK) + 1;
        if (n === NOTES_PER_OCTAVE) n = NEXT_OCTAVE;
      }
      note = (n + r[GLIDE_OCTAVE]) & BYTE_MASK;
      r[GLIDE_NOTE + x] = note;
    }
    const y = (note & NIBBLE_MASK) << 1;
    r[0x00] = r[NOTE_TABLE_LOW + x];
    r[0x01] = r[NOTE_TABLE_HIGH + x];
    const table = this.ptr(0x00);
    r[GLIDE_PITCH] = this.load(table + y);
    r[GLIDE_PITCH + 1] = this.load(table + ((y + 1) & BYTE_MASK));
    this.octave(GLIDE_PITCH, xcn(r[GLIDE_NOTE + x]) & NIBBLE_MASK);
    const register = xcn(x) | PITCH_L;
    io.write(DSP_ADDRESS, register);
    io.write(DSP_DATA, r[GLIDE_PITCH]);
    io.write(DSP_ADDRESS, register + 1);
    io.write(DSP_DATA, r[GLIDE_PITCH + 1]);
    if (r[GLIDE_TARGET + x] === r[GLIDE_NOTE + x]) r[GLIDE_MODE + x] = 0;
  }
  // $0DBF: vibrato of voice X via the sine table $0E14.
  vibrato0DBF(x) {
    const r = this.ram,
      io = this.io;
    r[0x00] = 0;
    let s = r[VIBRATO_SPEED_LOW + x] + r[VIBRATO_PHASE_LOW + x];
    r[VIBRATO_PHASE_LOW + x] = s & BYTE_MASK;
    s = (r[VIBRATO_SPEED_HIGH + x] + r[VIBRATO_PHASE_HIGH + x] + (s >> BYTE_BITS)) & BYTE_MASK;
    r[VIBRATO_PHASE_HIGH + x] = s;
    let a = r[VIBRATO_SINE + (s & VIBRATO_SINE_MASK)];
    if (a & BYTE_SIGN) {
      const p = (-a & BYTE_MASK) * r[VIBRATO_DEPTH + x];
      a = -(((p >> BYTE_BITS) << 1) | ((p >> (BYTE_BITS - 1)) & 1)) & BYTE_MASK;
      if (a) r[0x00] = VIBRATO_NEGATIVE_HIGH;
    } else {
      const p = a * r[VIBRATO_DEPTH + x];
      a = (((p >> BYTE_BITS) << 1) | ((p >> (BYTE_BITS - 1)) & 1)) & BYTE_MASK;
    }
    const register = xcn(x) | PITCH_L;
    const low = a + r[VOICE_PITCH_LOW + x];
    io.write(DSP_ADDRESS, register);
    io.write(DSP_DATA, low & BYTE_MASK);
    io.write(DSP_ADDRESS, register + 1);
    io.write(DSP_DATA, (r[VOICE_PITCH_HIGH + x] + r[0x00] + (low >> BYTE_BITS)) & BYTE_MASK);
  }
}
