// Memory access of the native sound driver (src/apu/sound-driver.mjs).
// Addressing as in the original: direct page+X wraps within page 0,
// $F0-$FF are registers; X and Y are 8 bits. A write into driver code that
// still runs after the start, or into the stack area, is a limit: the
// original would then execute changed instructions or returns.
import { VmFault } from '../vm/memory.mjs';
import { DSP_ADDRESS, DSP_DATA, ARAM_SIZE, IO_BASE, IO_PAGE_MASK } from './spc-io.mjs';
import { BYTE_MASK, WORD_MASK, BYTE_BITS, NIBBLE_BITS } from '../constants/bits.mjs';

export const WAIT_PORT = 1,
  IDLE = 2,
  IPL = 3;
// Driver variables whose meaning the driver code or docs/SOUND-DRIVER.md
// establishes. Other direct page bytes are helper bytes of the 1:1 ported
// routines and stay literal. A word variable keeps its high byte at +1;
// per-voice and per-track tables are indexed by the voice or track number.
// Command interface ($02A7-$02C5): last token on port 0, command byte, parameter
// bytes from port 2/3.
export const PORT_TOKEN = 0x1c,
  COMMAND = 0x1d,
  PARAM_LOW = 0x1e,
  PARAM_HIGH = 0x1f;
// Target of the main volume L/R (commands 02 and 08; $03E3 moves MVOL towards
// it by the fade steps), echo volume factors from the song header ($03C7/$03D5)
// and the fade steps.
export const VOLUME_TARGET_L = 0x20,
  VOLUME_TARGET_R = 0x21,
  ECHO_FACTOR_L = 0x22,
  ECHO_FACTOR_R = 0x23,
  FADE_STEP_L = 0x24,
  FADE_STEP_R = 0x25;
// Output mode (command 14): with bit 7 clear the driver averages L and R
// (commands 17 and $07A0). Tempo scale (command 16): tempo * scale / 10.
export const OUTPUT_MODE = 0x0e,
  OUTPUT_STEREO = 0x80,
  TEMPO_SCALE = 0x0f,
  TEMPO_SCALE_UNIT = 10;
// Priority of the sound being started ($FF: from its sound entry), preset by
// command 15; it becomes the voice rank ($07A0).
export const SOUND_PRIORITY = 0x10,
  PRIORITY_PRESET = 0x11,
  PRIORITY_FROM_ENTRY = 0xff;
// Pointers into the base list ($04E1): song header, sound entries (16 bytes
// each), vibrato table, song table and sound sequence table.
export const SONG_HEADER = 0x12,
  SOUND_TABLE = 0x14,
  VIBRATO_TABLE = 0x16,
  SONG_TABLE = 0x18,
  SEQUENCE_TABLE = 0x1a,
  SOUND_ENTRY_SIZE = 16;
// Sound volume L/R (command 06, nibbles of command 07, note volume of $0B55).
export const SOUND_VOLUME_L = 0x26,
  SOUND_VOLUME_R = 0x27;
// Echo and noise voice bits for EON/NON ($02FC) and the directory page for DIR ($0366).
export const ECHO_VOICES = 0x28,
  NOISE_VOICES = 0x29,
  DIRECTORY_PAGE = 0x2a;
// Voice choice ($043F): last chosen voice, the candidate voice bits and the
// bit of the chosen voice; the voice of the last sound (round robin start).
export const CHOSEN_VOICE = 0x2b,
  CANDIDATE_VOICES = 0x2c,
  CHOSEN_VOICE_BIT = 0x2d,
  LAST_SOUND_VOICE = 0x65;
// Fade round counter of $03E3: the volume moves every fourth round.
export const FADE_ROUND = 0x2e,
  FADE_ROUNDS = 4;
// Per voice: duration low/high ($0479), release ADSR ($0491), note played
// ($FF = none, $0BB1) and rank ($043F).
export const DURATION_LOW = 0x31,
  DURATION_HIGH = 0x39,
  RELEASE_ADSR = 0x41,
  VOICE_NOTE = 0x54,
  NO_NOTE = 0xff,
  VOICE_RANK = 0x66;
// Per track: the voice of its last note and its candidate voice bits ($0B55).
export const TRACK_VOICE = 0x5d,
  TRACK_VOICES = 0xa5;
// Song volume L/R (command 0D), applied to every note ($0B55).
export const SONG_VOLUME_L = 0x89,
  SONG_VOLUME_R = 0x8a;
// Key-on bits still pending (also read by src/apu/apu.mjs to resume the driver
// at a DSP latch) and key-off bits for the next main loop pass.
export const KEY_ON_PENDING = 0x49,
  KEY_OFF_PENDING = 0x4a;
// Tracks of the song still running ($0B11 clears a finished track's bit).
export const ACTIVE_TRACKS = 0x4b;
// Voice mask of sounds (commands 05, 0F, 17, 18).
export const SOUND_VOICES = 0x5c;
// Voices of song notes: $07A0 sets the bit of every sound it starts, $0717
// clears it again for sounds started by commands and sound sequences, so only
// notes of the song tracks ($0A91 calls $0776 directly) keep it. Command 01 sets
// all bits; $05A0 releases these voices.
export const SONG_VOICES = 0x6e;
// Sound entry (SOUND_ENTRY_SIZE bytes, $0776/$07A0): vibrato number (0 = none,
// otherwise 1-based into the vibrato table), volume, the voice registers
// $x2-$x7 at the same offsets, release ADSR, duration low/high, flags, the
// priority and the note table pointer. With ENTRY_FIXED_PITCH set, or with the
// note $xF, $07A0 takes the pitch from the entry instead of the note table.
export const ENTRY_VIBRATO = 0,
  ENTRY_VOLUME = 1,
  ENTRY_RELEASE_ADSR = 8,
  ENTRY_DURATION = 9,
  ENTRY_FLAGS = 0x0b,
  ENTRY_PRIORITY = 0x0c,
  ENTRY_NOTE_TABLE = 0x0e;
// Bits of the flags byte: noise voice, echo voice, held (the rank stays without
// a duration and the track records the note for its note-off, $0A91), refused
// at equal rank ($0765), fixed pitch, and the glide mode in bits 6-7 ($0D1C).
export const ENTRY_NOISE = 0x01,
  ENTRY_ECHO = 0x02,
  ENTRY_HELD = 0x04,
  ENTRY_REFUSE_EQUAL = 0x08,
  ENTRY_FIXED_PITCH = 0x10,
  ENTRY_GLIDE_MASK = 0xc0,
  ENTRY_GLIDE_SHIFT = 6;
// $07A0 copies the flags byte of the started sound here; $0A91 reads it after
// $0776 and $076C clears it.
export const SOUND_ENTRY_FLAGS = 0x04;
// Note byte ($1F for sounds): note in the low nibble ($F = no note, fixed
// pitch), octave in the high nibble.
export const NOTE_NONE = 0x0f,
  NOTE_OCTAVE_MASK = 0xf0,
  NOTES_PER_OCTAVE = 12;
// Sound volume L/R saved while a track note ($0B55) or command 07 ($0916)
// replaces it for one sound.
export const SAVED_VOLUME_L = 0x2f,
  SAVED_VOLUME_R = 0x30;
// Per voice: owner of the held note, the track in bits 5-7 and the instrument
// in bits 0-4 ($0B55); the note-off ($0BB1) and the bend ($0C07) match it.
export const VOICE_NOTE_OWNER = 0x4c,
  OWNER_INSTRUMENT_MASK = 0x1f;
// Vibrato entry ($07A0): phase low/high, speed low/high, depth.
export const VIBRATO_ENTRY_PHASE = 0,
  VIBRATO_ENTRY_SPEED = 2,
  VIBRATO_ENTRY_DEPTH = 4;
// Command 10 ($097F): ARAM target and remaining byte count of the transfer.
export const TRANSFER_TARGET = 0x6f,
  TRANSFER_COUNT = 0x71;
// Sound sequences on two channels ($0C9F): pointer low/high and wait counter.
export const SEQUENCE_POINTER_LOW = 0x73,
  SEQUENCE_POINTER_HIGH = 0x75,
  SEQUENCE_WAIT = 0x77;
// Channel volumes (eight left, eight right) and their ramps ($0C5E).
export const CHANNEL_VOLUME_L = 0x79,
  CHANNEL_VOLUME_R = 0x81;
// Song ($06A3): number, flags (bit 0 repeat), beat counter, tempo (timer 0
// target), and the song state $8D-$EA that $04AC clears.
export const SONG = 0x8b,
  SONG_FLAGS = 0x8c,
  BEAT = 0x8d,
  TEMPO = 0x92,
  SONG_STATE_START = 0x8d,
  SONG_STATE_END = 0xeb;
// Song step counter, last byte of the song state ($0A0D counts it modulo 16;
// $06AC sets $FF so that the first step is 0), and the active track bits of a
// started song.
export const SONG_STEP = 0xea,
  SONG_STEP_BEFORE_FIRST = 0xff,
  ALL_TRACKS = 0xff;
// The beat the main loop saw at the previous sequencer step ($0250: port 2
// gets the beat when it is unchanged).
export const PREVIOUS_BEAT = 0x8e;
// Beat ($0A0D): step within the beat (BEAT_STEPS steps per beat) and the beat
// count that BEAT reports to the CPU.
export const BEAT_STEP = 0x8f,
  BEAT_STEPS = 0x60,
  BEAT_COUNT = 0x91;
// Song entry from the song table ($06AC): tempo, track list pointers, tempo
// list pointer and track voices to $92-$AC, channel volumes from SONG_VOLUMES
// to $79-$88, instrument sounds from SONG_SOUNDS to $AD-$CC; SONG_ENTRY_SIZE
// bytes in all.
export const SONG_VOLUMES = 0x1b,
  SONG_SOUNDS = 0x2b,
  SONG_ENTRY_SIZE = 0x4b;
// Per track (word tables at track * 2): list pointer and pattern pointer;
// per track: remaining duration ($0A91).
export const TRACK_LIST = 0x93,
  TRACK_DURATION = 0xcd,
  TRACK_PATTERN = 0xd6;
// Tempo and volume list ($0A1C): pointer and wait counter.
export const TEMPO_LIST = 0xa3,
  TEMPO_LIST_WAIT = 0xd5;
// Sound number per instrument ($0B55).
export const INSTRUMENT_SOUNDS = 0xad;
// Track reader ($0A91-$0B1E): offset in the pattern, current track, pattern pointer.
export const PATTERN_OFFSET = 0xe6,
  CURRENT_TRACK = 0xe7,
  PATTERN_POINTER = 0xe8;
// Page 1: counter pulses still to handle in the main loop ($0244), the voice of
// the effect round ($0C89), and the eight DSP register values $x0-$x7 per voice
// that the key-on writes ($02FC).
export const TIMER_PULSES = 0x0100,
  EFFECT_VOICE = 0x0101,
  VOICE_REGISTERS = 0x0102;
// Per voice ($07A0, $0DBF): vibrato phase and speed (low/high) and depth.
export const VIBRATO_PHASE_LOW = 0x0142,
  VIBRATO_PHASE_HIGH = 0x014a,
  VIBRATO_SPEED_LOW = 0x0152,
  VIBRATO_SPEED_HIGH = 0x015a,
  VIBRATO_DEPTH = 0x0172;
// Per voice: pitch of the note before bend and vibrato ($0C07, $0DBF).
export const VOICE_PITCH_LOW = 0x0162,
  VOICE_PITCH_HIGH = 0x016a;
// Glide ($0D1C): target note, mode, current note and note table pointer per voice.
export const GLIDE_TARGET = 0x017a,
  GLIDE_NOTE = 0x0182,
  GLIDE_MODE = 0x018a,
  NOTE_TABLE_LOW = 0x0192,
  NOTE_TABLE_HIGH = 0x019a;
// Octave 5 leaves the pitch of the note table unchanged.
export const BASE_OCTAVE = 5;
// Volume ramp steps per channel, left and right ($0C5E), for 16 channels.
export const VOLUME_RAMP_L = 0x01a2,
  VOLUME_RAMP_R = 0x01aa,
  VOLUME_RAMP_END = 0x01b2,
  CHANNEL_COUNT = 16;
// Sound sequences ($072B): volume L/R and voice bits per sequence channel,
// the channel used last. Sound numbers from $C0 are sequences.
export const SEQUENCE_VOLUME_L = 0x01b2,
  SEQUENCE_VOLUME_R = 0x01b4,
  SEQUENCE_VOICES = 0x01b6,
  SEQUENCE_CHANNEL = 0x01b8,
  FIRST_SEQUENCE_SOUND = 0xc0;
// Tables in the driver bytes (assets/vm-spc-driver.json): command dispatch
// low/high bytes, DSP registers of the song header, voice bits 1 << n and the
// vibrato sine.
export const DISPATCH_LOW = 0x02c8,
  DISPATCH_HIGH = 0x02e2,
  ECHO_HEADER_REGISTERS = 0x03b5,
  VOICE_BITS = 0x0471,
  VIBRATO_SINE = 0x0e14,
  VIBRATO_SINE_MASK = 0x3f;
// Tracks of a song.
export const TRACK_COUNT = 8;
// XCN: exchange the two nibbles of A.
export const xcn = (a) => ((a << NIBBLE_BITS) | (a >> NIBBLE_BITS)) & BYTE_MASK;
// The IPL transfer loads the driver to ARAM $0200 and starts it there.
export const DRIVER_START = 0x0200;
// Stack used by the driver, $01E0-$01EF (lowest SP $E7).
const STACK_START = 0x01e0,
  STACK_END = 0x01f0;
// Operand of the self-modified CALL $02C2 (command dispatch).
export const PATCHED_CALL_OPERAND = 0x02c3;
// Code bytes executed after the start (disassembly tools/sound-driver-source.mjs)
// and the stack; the patched CALL operand is the intentionally modified code.
const GUARDED_RANGES = [
  [0x0244, 0x02c8],
  [0x02fc, 0x0348],
  [0x0358, 0x03b5],
  [0x03c4, 0x0471],
  [0x0479, 0x0e14],
  [STACK_START, STACK_END],
];
const GUARD = new Uint8Array(ARAM_SIZE);
for (const [from, to] of GUARDED_RANGES) GUARD.fill(1, from, to);
GUARD.fill(0, PATCHED_CALL_OPERAND, PATCHED_CALL_OPERAND + 2);

// DIV YA,X of the SPC700. Without overflow (Y < 2X) quotient to A, remainder to Y.
// The overflow branch follows the hardware behaviour; in the driver only
// $06F2/$0A34 divides, by 10 with tempo * $0F.
export function spcDivide(ya, x) {
  const y = ya >> BYTE_BITS;
  if (y < x << 1) return { a: Math.floor(ya / x) & BYTE_MASK, y: (ya % x) & BYTE_MASK };
  return {
    a: (255 - Math.floor((ya - (x << 9)) / (256 - x))) & BYTE_MASK, // magic-number-ok: DIV overflow formula
    y: (x + ((ya - (x << 9)) % (256 - x))) & BYTE_MASK, // magic-number-ok: DIV overflow formula
  };
}

export class DriverMemory {
  constructor(ram, io) {
    if (!(ram instanceof Uint8Array) || ram.length !== ARAM_SIZE)
      throw new VmFault('spc_aram_required');
    this.ram = ram;
    this.io = io;
  }
  // Computed addresses (pointer, absolute+index).
  load(address) {
    address &= WORD_MASK;
    return (address & IO_PAGE_MASK) === IO_BASE ? this.io.read(address, -1) : this.ram[address];
  }
  put(address, value) {
    address &= WORD_MASK;
    if ((address & IO_PAGE_MASK) === IO_BASE) {
      this.io.write(address, value, -1);
      return;
    }
    if (GUARD[address])
      throw new VmFault(
        address < DRIVER_START ? 'sound_driver_stack_write' : 'sound_driver_code_write',
        address,
        { value },
      );
    this.ram[address] = value;
  }
  // Absolute+index with a possibly invalid voice: in the stack area the
  // original would read return addresses, which the native driver does not have.
  get(address) {
    if (address >= STACK_START && address < STACK_END)
      throw new VmFault('sound_driver_stack_read', address);
    return this.ram[address];
  }
  // Direct page + index.
  zp(address) {
    address &= BYTE_MASK;
    return address >= IO_BASE ? this.io.read(address, -1) : this.ram[address];
  }
  setZp(address, value) {
    address &= BYTE_MASK;
    if (address >= IO_BASE) this.io.write(address, value, -1);
    else this.ram[address] = value;
  }
  ptr(d) {
    return this.ram[d] | (this.ram[d + 1] << BYTE_BITS);
  }
  dsp(register, value) {
    this.io.write(DSP_ADDRESS, register);
    this.io.write(DSP_DATA, value);
  }
}
