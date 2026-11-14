// Voice and DSP routines of the native sound driver, shared by the commands
// (src/apu/sound-driver.mjs) and the timer handlers
// (src/apu/sound-driver-sequencer.mjs): key-on, song header and echo,
// voice choice, release, reset and the start of a sound on a voice.
import {
  ADSR2,
  ENVX,
  SRCN,
  PITCH_L,
  PITCH_H,
  MVOL_L,
  MVOL_R,
  EVOL_L,
  EVOL_R,
  KOF,
  FLG,
  NON,
  EON,
  DIR,
  EDL,
  VOICE_COUNT,
  FLG_ALL,
} from './dsp-registers.mjs';
import {
  CONTROL,
  COUNTER0,
  TIMER0,
  DSP_ADDRESS,
  DSP_DATA,
  CONTROL_TIMER0,
  CONTROL_TIMER1,
} from './spc-io.mjs';
import {
  DriverMemory,
  xcn,
  spcDivide,
  ACTIVE_TRACKS,
  CANDIDATE_VOICES,
  CHOSEN_VOICE,
  DURATION_HIGH,
  DURATION_LOW,
  ECHO_FACTOR_L,
  ECHO_FACTOR_R,
  ECHO_HEADER_REGISTERS,
  GLIDE_MODE,
  GLIDE_TARGET,
  KEY_OFF_PENDING,
  KEY_ON_PENDING,
  PARAM_HIGH,
  PARAM_LOW,
  RELEASE_ADSR,
  SEQUENCE_POINTER_HIGH,
  SEQUENCE_POINTER_LOW,
  SEQUENCE_WAIT,
  SONG,
  TEMPO,
  TEMPO_LIST_WAIT,
  VOICE_BITS,
  VOICE_NOTE,
  VOICE_RANK,
  VOICE_REGISTERS,
  CHOSEN_VOICE_BIT,
  DIRECTORY_PAGE,
  ECHO_VOICES,
  FADE_ROUND,
  GLIDE_NOTE,
  LAST_SOUND_VOICE,
  NOISE_VOICES,
  NOTE_TABLE_HIGH,
  NOTE_TABLE_LOW,
  OUTPUT_MODE,
  PRIORITY_PRESET,
  SEQUENCE_CHANNEL,
  SEQUENCE_TABLE,
  SEQUENCE_VOICES,
  SEQUENCE_VOLUME_L,
  SEQUENCE_VOLUME_R,
  SONG_HEADER,
  SONG_TABLE,
  SOUND_PRIORITY,
  SOUND_TABLE,
  SOUND_VOLUME_L,
  SOUND_VOLUME_R,
  TEMPO_SCALE,
  TRACK_VOICE,
  VIBRATO_DEPTH,
  VIBRATO_PHASE_HIGH,
  VIBRATO_PHASE_LOW,
  VIBRATO_SPEED_HIGH,
  VIBRATO_SPEED_LOW,
  VIBRATO_TABLE,
  VOICE_PITCH_HIGH,
  VOICE_PITCH_LOW,
  BASE_OCTAVE,
  FADE_ROUNDS,
  FADE_STEP_L,
  FADE_STEP_R,
  FIRST_SEQUENCE_SOUND,
  NO_NOTE,
  OUTPUT_STEREO,
  PRIORITY_FROM_ENTRY,
  SONG_STATE_END,
  SONG_STATE_START,
  SOUND_ENTRY_SIZE,
  TEMPO_SCALE_UNIT,
  TRACK_COUNT,
  TRACK_DURATION,
  VOLUME_RAMP_END,
  VOLUME_RAMP_L,
  VOLUME_TARGET_L,
  VOLUME_TARGET_R,
  ALL_TRACKS,
  CHANNEL_VOLUME_L,
  ENTRY_DURATION,
  ENTRY_ECHO,
  ENTRY_FIXED_PITCH,
  ENTRY_FLAGS,
  ENTRY_GLIDE_MASK,
  ENTRY_GLIDE_SHIFT,
  ENTRY_HELD,
  ENTRY_NOISE,
  ENTRY_NOTE_TABLE,
  ENTRY_PRIORITY,
  ENTRY_REFUSE_EQUAL,
  ENTRY_RELEASE_ADSR,
  ENTRY_VIBRATO,
  ENTRY_VOLUME,
  INSTRUMENT_SOUNDS,
  NOTE_NONE,
  SONG_ENTRY_SIZE,
  SONG_SOUNDS,
  SONG_STEP,
  SONG_STEP_BEFORE_FIRST,
  SONG_VOICES,
  SONG_VOLUMES,
  SOUND_ENTRY_FLAGS,
  VIBRATO_ENTRY_DEPTH,
  VIBRATO_ENTRY_PHASE,
  VIBRATO_ENTRY_SPEED,
} from './sound-driver-memory.mjs';
import { BYTE_MASK, WORD_MASK, BYTE_BITS, NIBBLE_MASK } from '../constants/bits.mjs';

// $02FC: a voice whose ENVX is still at least $1C is not keyed on yet; the
// key-on writes the eight registers $x0-$x7 of the voice.
const KEY_ON_ENVX_LIMIT = 0x1c,
  KEY_ON_REGISTERS = 8;
// Song header ($0366): echo volume factors L/R, then the page of the echo area.
const HEADER_ECHO_PAGE = 3;
// Helper bytes of the direct page, by routine. $0366: pointer word of the echo
// area clear. $043F: remaining voices to check and the voice with the lowest
// rank so far; NO_RANK_YET is above every rank. $04AC: pointer word that walks
// the track durations. $06AC: pointer word to the song entry. $07A0: pointer
// word to the vibrato entry, later to the note table, and the pitch word of
// the note.
const ECHO_CLEAR_LOW = 0x06,
  ECHO_CLEAR_PAGE = 0x07,
  SEARCH_REMAINING = 0x0a,
  SEARCH_BEST_VOICE = 0x0b,
  NO_RANK_YET = 0xff,
  DURATION_POINTER = 0x04,
  SONG_ENTRY_POINTER = 0x02,
  TABLE_POINTER = 0x0a,
  NOTE_PITCH = 0x0c;
// Instruction addresses of the DSP data reads in $03E3 (compare, step down,
// step up), for MVOL L and MVOL R.
const FADE_L_COMPARE_PC = 0x03ef,
  FADE_L_DOWN_PC = 0x03f6,
  FADE_L_UP_PC = 0x0403,
  FADE_R_COMPARE_PC = 0x0418,
  FADE_R_DOWN_PC = 0x041f,
  FADE_R_UP_PC = 0x042c;

export class DriverVoices extends DriverMemory {
  // $02FC: key-on of the voices in A. A voice whose ENVX is still >= $1C
  // is deferred (bit in $02 cleared, bit in $49 stays).
  keyOn02FC(a) {
    const r = this.ram,
      io = this.io;
    r[0x00] = a;
    r[0x02] = a;
    let x = 0;
    do {
      const carry = r[0x00] & 1;
      r[0x00] >>= 1;
      if (carry) {
        const base = (x << 1) & BYTE_MASK;
        io.write(DSP_ADDRESS, base | ENVX);
        if (io.read(DSP_DATA, 0x030d) < KEY_ON_ENVX_LIMIT) {
          let y = base;
          r[0x01] = KEY_ON_REGISTERS;
          do {
            const v = r[VOICE_REGISTERS + x];
            io.write(DSP_ADDRESS, y);
            io.write(DSP_DATA, v);
            y = (y + 1) & BYTE_MASK;
            x = (x + 1) & BYTE_MASK;
            r[0x01] = (r[0x01] - 1) & BYTE_MASK;
          } while (r[0x01]);
          continue;
        }
        r[0x02] = (r[VOICE_BITS + xcn(base)] ^ BYTE_MASK) & r[0x02];
      }
      x = (x + KEY_ON_REGISTERS) & BYTE_MASK;
    } while (x !== VOICE_COUNT * KEY_ON_REGISTERS);
    this.dsp(NON, r[NOISE_VOICES]);
    this.dsp(EON, r[ECHO_VOICES]);
  }
  // $0366: echo off, clear the echo area from page [$12]+3, song header to the DSP.
  header0366() {
    const r = this.ram,
      io = this.io;
    this.dsp(FLG, FLG_ALL);
    this.dsp(EON, 0x00);
    this.dsp(EDL, 0x00);
    const head = this.ptr(SONG_HEADER),
      page = this.load(head + HEADER_ECHO_PAGE);
    if (page) {
      r[ECHO_CLEAR_PAGE] = page;
      r[ECHO_CLEAR_LOW] = 0;
      do {
        for (let y = 0; y <= BYTE_MASK; y++) this.put((r[ECHO_CLEAR_PAGE] << BYTE_BITS) + y, 0);
        r[ECHO_CLEAR_PAGE] = (r[ECHO_CLEAR_PAGE] + 1) & BYTE_MASK;
      } while (r[ECHO_CLEAR_PAGE]);
    }
    r[ECHO_VOICES] = 0;
    r[NOISE_VOICES] = 0;
    r[ECHO_FACTOR_L] = this.load(head);
    r[ECHO_FACTOR_R] = this.load(head + 1);
    for (let y = 2; ; y++) {
      const register = r[ECHO_HEADER_REGISTERS + y];
      if (!register) break;
      io.write(DSP_ADDRESS, register);
      io.write(DSP_DATA, this.load(head + y));
    }
    this.dsp(DIR, r[DIRECTORY_PAGE]);
    this.echoRight03D5();
    this.echoLeft03C7();
  }
  // $03C7/$03D5: echo volume = main volume * $22 or $23 / 256.
  echoLeft03C7() {
    const io = this.io;
    io.write(DSP_ADDRESS, MVOL_L);
    const a = io.read(DSP_DATA, 0x03ca);
    io.write(DSP_ADDRESS, EVOL_L);
    io.write(DSP_DATA, (a * this.ram[ECHO_FACTOR_L]) >> BYTE_BITS);
  }
  echoRight03D5() {
    const io = this.io;
    io.write(DSP_ADDRESS, MVOL_R);
    const a = io.read(DSP_DATA, 0x03d8);
    io.write(DSP_ADDRESS, EVOL_R);
    io.write(DSP_DATA, (a * this.ram[ECHO_FACTOR_R]) >> BYTE_BITS);
  }
  // $03E3: every fourth round, move the main volume $20/$21 by $24/$25.
  fade03E3() {
    const r = this.ram;
    r[FADE_ROUND] = (r[FADE_ROUND] + 1) % FADE_ROUNDS;
    if (r[FADE_ROUND]) return;
    if (
      this.fadeTo(
        MVOL_L,
        VOLUME_TARGET_L,
        FADE_STEP_L,
        FADE_L_COMPARE_PC,
        FADE_L_DOWN_PC,
        FADE_L_UP_PC,
      )
    )
      this.echoLeft03C7();
    if (
      this.fadeTo(
        MVOL_R,
        VOLUME_TARGET_R,
        FADE_STEP_R,
        FADE_R_COMPARE_PC,
        FADE_R_DOWN_PC,
        FADE_R_UP_PC,
      )
    )
      this.echoRight03D5();
  }
  fadeTo(register, goal, step, pcCompare, pcDown, pcUp) {
    const r = this.ram,
      io = this.io;
    io.write(DSP_ADDRESS, register);
    const now = io.read(DSP_DATA, pcCompare);
    if (now === r[goal]) return false;
    let a;
    if (now > r[goal]) {
      a = io.read(DSP_DATA, pcDown) - r[step];
      if (a < 0 || a < r[goal]) a = r[goal];
    } else {
      a = io.read(DSP_DATA, pcUp) + r[step];
      if (a > BYTE_MASK || a >= r[goal]) a = r[goal];
    }
    io.write(DSP_DATA, a);
    return true;
  }
  // $043F: choose a voice from the bits of $2C (round robin from $2B+1, lowest
  // rank $66+X wins, rank 0 immediately). Returns A=$2B and Y=rank.
  voice043F() {
    const r = this.ram;
    r[SEARCH_REMAINING] = VOICE_COUNT + 1;
    let x = r[CHOSEN_VOICE],
      y = NO_RANK_YET;
    for (;;) {
      r[SEARCH_REMAINING] = (r[SEARCH_REMAINING] - 1) & BYTE_MASK;
      if (!r[SEARCH_REMAINING]) break;
      x = (x + 1) % VOICE_COUNT;
      if (!(r[VOICE_BITS + x] & r[CANDIDATE_VOICES])) continue;
      if (y <= r[VOICE_RANK + x]) continue;
      r[SEARCH_BEST_VOICE] = x;
      y = r[VOICE_RANK + x];
      if (!y) break;
    }
    r[CHOSEN_VOICE] = r[SEARCH_BEST_VOICE];
    r[CHOSEN_VOICE_BIT] = r[VOICE_BITS + r[CHOSEN_VOICE]];
    return { a: r[CHOSEN_VOICE], y };
  }
  // $0479: count down duration $31/$39 of voice X; release at zero.
  duration0479(x) {
    const r = this.ram;
    if (!(r[DURATION_LOW + x] | r[DURATION_HIGH + x])) return;
    const a = (r[DURATION_LOW + x] - 1) & BYTE_MASK;
    r[DURATION_LOW + x] = a;
    if (a === BYTE_MASK) {
      r[DURATION_HIGH + x] = (r[DURATION_HIGH + x] - 1) & BYTE_MASK;
      return;
    }
    if (a | r[DURATION_HIGH + x]) return;
    this.release0491(x);
  }
  // $0491: release voice X: release ADSR $41+X or key-off via $4A.
  release0491(x) {
    const r = this.ram;
    r[VOICE_RANK + x] = 0;
    const y = r[RELEASE_ADSR + x];
    if (y) this.dsp(xcn(x) | ADSR2, y);
    else r[KEY_OFF_PENDING] |= r[VOICE_BITS + x];
  }
  // $04AC: timer 0 off, clear song state $8D-$EA, tracks with a song to duration 1.
  reset04AC() {
    const r = this.ram,
      io = this.io;
    io.write(CONTROL, CONTROL_TIMER1);
    io.read(COUNTER0, 0x04af);
    r[DURATION_POINTER + 1] = 0;
    r[DURATION_POINTER] = 0;
    r.fill(0, SONG_STATE_START, SONG_STATE_END);
    if (r[SONG]) {
      r[DURATION_POINTER + 1] = 0;
      r[DURATION_POINTER] = TRACK_DURATION;
      for (let x = TRACK_COUNT; x; x--) {
        this.put(this.ptr(DURATION_POINTER), 1);
        const w = (this.ptr(DURATION_POINTER) + 1) & WORD_MASK;
        r[DURATION_POINTER] = w & BYTE_MASK;
        r[DURATION_POINTER + 1] = w >> BYTE_BITS;
      }
    }
  }
  // $05A0 (command 0C): stop everything.
  stopAll05A0() {
    const r = this.ram;
    this.reset04AC();
    for (let x = VOICE_COUNT - 1; x >= 0; x--) {
      if (r[VOICE_BITS + x] & r[SONG_VOICES]) {
        r[VOICE_RANK + x] = 0;
        r[VIBRATO_SPEED_LOW + x] = 0;
        r[VIBRATO_SPEED_HIGH + x] = 0;
      }
      r[TRACK_VOICE + x] = 0;
      r[LAST_SOUND_VOICE] = 0;
      r[VOICE_NOTE + x] = NO_NOTE;
    }
    r[SOUND_PRIORITY] = PRIORITY_FROM_ENTRY;
    r[PRIORITY_PRESET] = PRIORITY_FROM_ENTRY;
    r[KEY_OFF_PENDING] |= r[SONG_VOICES];
    r[KEY_ON_PENDING] = (r[SONG_VOICES] ^ BYTE_MASK) & r[KEY_ON_PENDING];
  }
  start06AC() {
    const r = this.ram,
      io = this.io;
    if (!r[SONG]) return;
    for (let x = VOICE_COUNT - 1; x >= 0; x--) {
      r[GLIDE_TARGET + x] = 0;
      r[GLIDE_MODE + x] = 0;
    }
    const y = ((r[SONG] - 1) << 1) & BYTE_MASK,
      table = this.ptr(SONG_TABLE);
    r[SONG_ENTRY_POINTER] = this.load(table + y);
    r[SONG_ENTRY_POINTER + 1] = this.load(table + ((y + 1) & BYTE_MASK));
    const song = this.ptr(SONG_ENTRY_POINTER);
    for (let n = 0; n < SONG_VOLUMES; n++) r[TEMPO + n] = this.load(song + n);
    for (let n = SONG_VOLUMES; n < SONG_SOUNDS; n++)
      r[CHANNEL_VOLUME_L - SONG_VOLUMES + n] = this.load(song + n);
    for (let n = SONG_SOUNDS; n < SONG_ENTRY_SIZE; n++)
      r[INSTRUMENT_SOUNDS - SONG_SOUNDS + n] = this.load(song + n);
    const { a } = spcDivide(r[TEMPO] * r[TEMPO_SCALE], TEMPO_SCALE_UNIT);
    r[TEMPO] = a;
    io.write(TIMER0, a);
    io.write(CONTROL, CONTROL_TIMER0 | CONTROL_TIMER1);
    r[ACTIVE_TRACKS] = ALL_TRACKS;
    r[SONG_STEP] = SONG_STEP_BEFORE_FIRST;
    r[TEMPO_LIST_WAIT] = 1;
    r.fill(0, VOLUME_RAMP_L, VOLUME_RAMP_END);
  }
  // $0717 (also from $0CE0): without the MOV $10,$11 of $0714.
  sound0717() {
    const r = this.ram;
    if (this.play0776().carry) r[SONG_VOICES] = (r[CHOSEN_VOICE_BIT] ^ BYTE_MASK) & r[SONG_VOICES];
    r[PRIORITY_PRESET] = PRIORITY_FROM_ENTRY;
    r[LAST_SOUND_VOICE] = r[CHOSEN_VOICE];
  }
  // $072B: put a sound sequence ($1E >= $C0) on channel $77/$78.
  sequence072B(a) {
    const r = this.ram;
    let x = 1;
    if (r[SEQUENCE_WAIT + 1]) {
      x = 0;
      if (r[SEQUENCE_WAIT]) x = (r[SEQUENCE_CHANNEL] + 1) & 1;
    }
    r[SEQUENCE_CHANNEL] = x;
    const y = ((a - (FIRST_SEQUENCE_SOUND - 1)) << 1) & BYTE_MASK,
      list = this.ptr(SEQUENCE_TABLE);
    r[SEQUENCE_POINTER_LOW + x] = this.load(list + y);
    r[SEQUENCE_POINTER_HIGH + x] = this.load(list + ((y + 1) & BYTE_MASK));
    r[SEQUENCE_WAIT + x] = 1;
    r[SEQUENCE_VOICES + x] = r[CANDIDATE_VOICES];
    r[SEQUENCE_VOLUME_L + x] = r[SOUND_VOLUME_L];
    r[SEQUENCE_VOLUME_R + x] = r[SOUND_VOLUME_R];
    return { carry: false, x };
  }
  // $0776: put sound $1E on a voice. Carry = played, X as in the original.
  play0776() {
    const r = this.ram;
    const id = r[PARAM_LOW];
    if (id >= FIRST_SEQUENCE_SOUND) return this.sequence072B(id);
    const chosen = this.voice043F();
    r[0x02] = chosen.a;
    const x = xcn(chosen.a) >> 1;
    const entry = (id * SOUND_ENTRY_SIZE + this.ptr(SOUND_TABLE)) & WORD_MASK;
    r[0x00] = entry & BYTE_MASK;
    r[0x01] = entry >> BYTE_BITS;
    let y = r[0x01];
    if (r[SOUND_PRIORITY] === PRIORITY_FROM_ENTRY) {
      y = ENTRY_PRIORITY;
      r[SOUND_PRIORITY] = this.load(entry + ENTRY_PRIORITY);
    }
    const rank = chosen.y;
    if (rank === r[SOUND_PRIORITY]) {
      // $0765: DEC Y reads with the Y of this path (flags byte $0B or $01-1).
      if (this.load(entry + ((y - 1) & BYTE_MASK)) & ENTRY_REFUSE_EQUAL) return this.refuse076C();
    } else if (rank > r[SOUND_PRIORITY]) return this.refuse076C();
    return this.start07A0(x);
  }
  refuse076C() {
    const r = this.ram;
    r[SOUND_PRIORITY] = PRIORITY_FROM_ENTRY;
    r[SOUND_ENTRY_FLAGS] = 0;
    return { carry: false, x: r[CHOSEN_VOICE] };
  }
  // $07A0: put the sound on the voice. Each instruction rereads the pointer
  // and voice byte as in the original; an invalid voice ($043F without a hit)
  // can hit the direct page itself with $31+X and so on.
  start07A0(x) {
    const r = this.ram,
      at = (k) => this.load(this.ptr(0x00) + k);
    this.dsp(KOF, r[CHOSEN_VOICE_BIT]);
    let v = r[CHOSEN_VOICE];
    let a = at(ENTRY_VIBRATO);
    if (a) {
      const y = ((a - 1) << 1) & BYTE_MASK;
      r[TABLE_POINTER] = this.load(this.ptr(VIBRATO_TABLE) + y);
      r[TABLE_POINTER + 1] = this.load(this.ptr(VIBRATO_TABLE) + ((y + 1) & BYTE_MASK));
      const vib = (k) => this.load(this.ptr(TABLE_POINTER) + k);
      this.put(VIBRATO_PHASE_LOW + v, vib(VIBRATO_ENTRY_PHASE));
      this.put(VIBRATO_PHASE_HIGH + v, vib(VIBRATO_ENTRY_PHASE + 1));
      this.put(VIBRATO_SPEED_LOW + v, vib(VIBRATO_ENTRY_SPEED));
      this.put(VIBRATO_SPEED_HIGH + v, vib(VIBRATO_ENTRY_SPEED + 1));
      this.put(VIBRATO_DEPTH + v, vib(VIBRATO_ENTRY_DEPTH));
    } else {
      this.put(VIBRATO_SPEED_LOW + v, 0);
      this.put(VIBRATO_SPEED_HIGH + v, 0);
    }
    this.put(VOICE_REGISTERS + x, (at(ENTRY_VOLUME) * r[SOUND_VOLUME_L]) >> BYTE_BITS);
    x = (x + 1) & BYTE_MASK;
    a = (at(ENTRY_VOLUME) * r[SOUND_VOLUME_R]) >> BYTE_BITS;
    // Mono: average with the left volume just written (register $x0 of the voice).
    if (!(r[OUTPUT_MODE] & OUTPUT_STEREO)) {
      a = (a + r[VOICE_REGISTERS - 1 + x]) >> 1;
      this.put(VOICE_REGISTERS - 1 + x, a);
    }
    this.put(VOICE_REGISTERS + x, a);
    x = (x + 1) & BYTE_MASK;
    let y;
    if (!(at(ENTRY_FLAGS) & ENTRY_FIXED_PITCH) && (r[PARAM_HIGH] & NIBBLE_MASK) !== NOTE_NONE) {
      v = r[CHOSEN_VOICE];
      const m = (at(ENTRY_FLAGS) & ENTRY_GLIDE_MASK) >> ENTRY_GLIDE_SHIFT;
      this.put(GLIDE_MODE + v, m);
      if (m) {
        this.put(GLIDE_NOTE + v, this.get(GLIDE_TARGET + v));
        this.put(GLIDE_TARGET + v, r[PARAM_HIGH]);
        a = this.get(GLIDE_NOTE + v);
        if (a) r[PARAM_HIGH] = a;
        else {
          this.put(GLIDE_MODE + v, 0);
          a = r[PARAM_HIGH];
        }
      } else {
        this.put(GLIDE_TARGET + v, 0);
        this.put(GLIDE_MODE + v, 0);
        a = r[PARAM_HIGH];
      }
      const notes = (a & NIBBLE_MASK) << 1;
      r[TABLE_POINTER] = at(ENTRY_NOTE_TABLE);
      this.put(NOTE_TABLE_LOW + v, r[TABLE_POINTER]);
      r[TABLE_POINTER + 1] = at(ENTRY_NOTE_TABLE + 1);
      this.put(NOTE_TABLE_HIGH + v, r[TABLE_POINTER + 1]);
      r[NOTE_PITCH] = this.load(this.ptr(TABLE_POINTER) + notes);
      r[NOTE_PITCH + 1] = this.load(this.ptr(TABLE_POINTER) + ((notes + 1) & BYTE_MASK));
      this.octave(NOTE_PITCH, xcn(r[PARAM_HIGH]) & NIBBLE_MASK);
      this.put(VOICE_REGISTERS + x, r[NOTE_PITCH]);
      x = (x + 1) & BYTE_MASK;
      this.put(VOICE_REGISTERS + x, r[NOTE_PITCH + 1]);
      x = (x + 1) & BYTE_MASK;
      y = SRCN;
    } else {
      r[NOTE_PITCH] = at(PITCH_L);
      this.put(VOICE_REGISTERS + x, r[NOTE_PITCH]);
      x = (x + 1) & BYTE_MASK;
      r[NOTE_PITCH + 1] = at(PITCH_H);
      this.put(VOICE_REGISTERS + x, r[NOTE_PITCH + 1]);
      x = (x + 1) & BYTE_MASK;
      y = SRCN;
    }
    for (; y < KEY_ON_REGISTERS; y++) {
      this.put(VOICE_REGISTERS + x, at(y));
      x = (x + 1) & BYTE_MASK;
    }
    this.setZp(RELEASE_ADSR + r[0x02], at(ENTRY_RELEASE_ADSR));
    const voice = r[0x02];
    this.put(VOICE_PITCH_LOW + voice, r[NOTE_PITCH]);
    this.put(VOICE_PITCH_HIGH + voice, r[NOTE_PITCH + 1]);
    this.setZp(DURATION_LOW + voice, at(ENTRY_DURATION));
    this.setZp(DURATION_HIGH + voice, at(ENTRY_DURATION + 1));
    r[SOUND_ENTRY_FLAGS] = at(ENTRY_FLAGS);
    let mask = (r[CHOSEN_VOICE_BIT] ^ BYTE_MASK) & r[NOISE_VOICES];
    if (r[SOUND_ENTRY_FLAGS] & ENTRY_NOISE) mask |= r[CHOSEN_VOICE_BIT];
    r[NOISE_VOICES] = mask;
    mask = (r[CHOSEN_VOICE_BIT] ^ BYTE_MASK) & r[ECHO_VOICES];
    if (r[SOUND_ENTRY_FLAGS] & ENTRY_ECHO) mask |= r[CHOSEN_VOICE_BIT];
    r[ECHO_VOICES] = mask;
    r[KEY_ON_PENDING] |= r[CHOSEN_VOICE_BIT];
    r[SONG_VOICES] |= r[CHOSEN_VOICE_BIT];
    const w = r[CHOSEN_VOICE];
    this.setZp(VOICE_RANK + w, r[SOUND_PRIORITY]);
    r[SOUND_PRIORITY] = PRIORITY_FROM_ENTRY;
    if (
      !(
        (r[SOUND_ENTRY_FLAGS] & ENTRY_HELD) |
        this.zp(DURATION_HIGH + w) |
        this.zp(DURATION_LOW + w)
      )
    )
      this.setZp(VOICE_RANK + w, 0);
    this.setZp(VOICE_NOTE + w, NO_NOTE);
    return { carry: true, x: w };
  }
  // Shift the pitch of the word at d by the octave (5 = unchanged).
  octave(d, a) {
    const r = this.ram;
    let w = r[d] | (r[d + 1] << BYTE_BITS);
    if (a > BASE_OCTAVE)
      for (; a !== BASE_OCTAVE; a = (a - 1) & BYTE_MASK) w = (w << 1) & WORD_MASK;
    else if (a < BASE_OCTAVE) for (; a !== BASE_OCTAVE; a = (a + 1) & BYTE_MASK) w >>= 1;
    r[d] = w & BYTE_MASK;
    r[d + 1] = w >> BYTE_BITS;
  }
}
