// Native sound driver (user decision 2026-10-20, docs/SOUND-DRIVER.md).
// The driver that F07F/EFA5 loads from ROM 97:8000 to ARAM $0200, as
// JS equations. Each method carries the address of its original routine; the
// entire state lives in ARAM (64 KiB) as in the original, including the
// helper bytes of the direct page and the patched CALL operand $02C3/$02C4.
// Only the registers A/X/Y and the stack do not exist: results and carry
// are return values, and the return addresses on the stack are dropped.
//
// Input and output go through SpcIo ($F0-$FF) in the same order as in the
// original; each read names the address of its original instruction. Wait
// points are continuations (generator): the driver returns WAIT_PORT when it
// sees no new token at a port poll, and IDLE at the end of a main loop pass
// without effect (no counter pulses, no port writes, $49/$4A unchanged).
// Another pass would then do the same until an event occurs (port, timer
// pulse, DSP time).
//
// The driver is split along its call layers: memory access
// (sound-driver-memory.mjs), voice and DSP routines (sound-driver-voices.mjs),
// timer handlers (sound-driver-sequencer.mjs) and here the start, the main
// loop and the 26 port commands.
import { VmFault } from '../vm/memory.mjs';
import {
  VOL_L,
  PITCH_L,
  PITCH_H,
  OUTX,
  MVOL_L,
  MVOL_R,
  KON,
  KOF,
  FLG,
  PMON,
  ESA,
  EDL,
  VOICE_COUNT,
  ALL_VOICES,
  DSP_REGISTER_COUNT,
  FLG_ALL,
} from './dsp-registers.mjs';
import {
  CONTROL,
  DSP_ADDRESS,
  DSP_DATA,
  PORT0,
  PORT1,
  PORT2,
  PORT3,
  TIMER0,
  TIMER1,
  COUNTER0,
  COUNTER1,
  COUNTER2,
  COUNTER_MASK,
  CONTROL_TIMER1,
} from './spc-io.mjs';
import {
  WAIT_PORT,
  IDLE,
  IPL,
  xcn,
  BEAT,
  CANDIDATE_VOICES,
  CHANNEL_VOLUME_L,
  CHANNEL_VOLUME_R,
  CHOSEN_VOICE,
  COMMAND,
  DISPATCH_HIGH,
  DISPATCH_LOW,
  FADE_STEP_L,
  FADE_STEP_R,
  KEY_OFF_PENDING,
  KEY_ON_PENDING,
  PARAM_HIGH,
  PARAM_LOW,
  PATCHED_CALL_OPERAND,
  PORT_TOKEN,
  SEQUENCE_WAIT,
  SONG,
  SONG_FLAGS,
  SOUND_VOICES,
  TEMPO,
  TIMER_PULSES,
  TRANSFER_COUNT,
  TRANSFER_TARGET,
  VOICE_REGISTERS,
  VOLUME_TARGET_L,
  VOLUME_TARGET_R,
  DIRECTORY_PAGE,
  LAST_SOUND_VOICE,
  OUTPUT_MODE,
  PRIORITY_PRESET,
  SONG_VOLUME_L,
  SONG_VOLUME_R,
  SOUND_PRIORITY,
  SOUND_TABLE,
  SOUND_VOLUME_L,
  SOUND_VOLUME_R,
  TEMPO_SCALE,
  OUTPUT_STEREO,
  SEQUENCE_TABLE,
  SONG_HEADER,
  SONG_TABLE,
  SOUND_ENTRY_SIZE,
  TEMPO_SCALE_UNIT,
  VIBRATO_TABLE,
  PREVIOUS_BEAT,
  SAVED_VOLUME_L,
  SAVED_VOLUME_R,
  SONG_VOICES,
} from './sound-driver-memory.mjs';
import { DriverSequencer } from './sound-driver-sequencer.mjs';
import { BYTE_MASK, WORD_MASK, BYTE_BITS, BYTE_SIGN, NIBBLE_MASK } from '../constants/bits.mjs';

// Start values (docs/SOUND-DRIVER.md): timer 1 target $14 and the ready value
// $CA on port 1.
const EFFECT_TIMER_TARGET = 0x14,
  DRIVER_READY = 0xca;
// Base list ($04E1): blocks of a count word and its entries. The sample
// directory comes first (DIRECTORY_ENTRY_SIZE bytes per sample, DIR points at
// it); the second block has 9-byte entries that no driver pointer refers to.
// $04E1 adds the word $04 = 2 (the count word) to reach the directory.
const DIRECTORY_ENTRY_SIZE = 4,
  SECOND_BLOCK_ENTRY_SIZE = 9;
// Helper bytes of the direct page: the word read by $0584 ($00 is the list
// pointer), the addend of $04E1, and in $0635 the remaining byte count and the
// base list address.
const LIST_WORD = 0x02,
  DIRECTORY_ADDEND = 0x04,
  UPLOAD_COUNT = 0x02,
  BASE_LIST_ADDRESS = 0x04;
// Command 01 ($0635) points the echo area (ESA) at page $FF while echo is off.
const UPLOAD_ECHO_PAGE = 0xff;
// Command 11 ($05D0): the register row of the OUTX address gives the voice
// (row / 2 = voice * 8 voice register bytes); the level is |OUTX| * volume * 8 / 256.
const REGISTER_ROW_MASK = 0xf0,
  LEVEL_VOLUME_SHIFT = 3;
// Command 07 ($0916): left volume in the high nibble of $1F, right volume in
// the low nibble; the sound then plays with note $FF (no note, fixed pitch).
const LEFT_VOLUME_NIBBLE = 0xf0,
  FIXED_PITCH_NOTE = 0xff;
// Command 0E ($0960): bits 0-1 of $1F go to bits 6-7 of the pitch low byte,
// bits 2-7 to the pitch high byte.
const PITCH_FRACTION_SHIFT = 6;
// $098A: X before the first transfer pair (the original's value at the jump).
const TRANSFER_FIRST_X = 0x9b;

export { WAIT_PORT, IDLE, IPL, spcDivide } from './sound-driver-memory.mjs';
export class SoundDriver extends DriverSequencer {
  // $0200: start after the IPL jump, then the main loop $0244.
  *run() {
    const r = this.ram,
      io = this.io;
    this.dsp(FLG, FLG_ALL);
    this.dsp(PMON, 0x00); // CALL $0E54 is only RET
    io.write(CONTROL, 0x00);
    io.read(COUNTER0, 0x0217);
    io.read(COUNTER1, 0x0217);
    io.read(COUNTER2, 0x0219);
    io.write(TIMER1, EFFECT_TIMER_TARGET);
    io.write(CONTROL, CONTROL_TIMER1);
    io.write(PORT1, DRIVER_READY);
    while (io.read(PORT0, 0x0224) !== 0) yield WAIT_PORT;
    io.write(PORT0, 0);
    r[PORT_TOKEN] = 0;
    r[KEY_ON_PENDING] = 0;
    r[KEY_OFF_PENDING] = 0;
    r[OUTPUT_MODE] = 0;
    r[SEQUENCE_WAIT] = 0;
    r[SEQUENCE_WAIT + 1] = 0;
    r[TRANSFER_COUNT] = 0;
    r[TRANSFER_COUNT + 1] = 0;
    this.stopAll05A0();
    r[SOUND_VOICES] = ALL_VOICES;
    r[TEMPO_SCALE] = TEMPO_SCALE_UNIT;
    for (;;) {
      const keyOn = r[KEY_ON_PENDING],
        keyOff = r[KEY_OFF_PENDING],
        writes = io.portWrites,
        ticks = io.counterTicks;
      const action = yield* this.pass0244();
      if (action === IPL) return IPL;
      if (
        io.counterTicks === ticks &&
        io.portWrites === writes &&
        r[KEY_ON_PENDING] === keyOn &&
        r[KEY_OFF_PENDING] === keyOff
      )
        yield IDLE;
    }
  }
  // $0244: one pass of the main loop.
  *pass0244() {
    const r = this.ram,
      io = this.io;
    let a = io.read(COUNTER0, 0x0244) & COUNTER_MASK;
    if (a) {
      r[TIMER_PULSES] = a;
      do {
        this.sequencer0A0D();
        a = r[BEAT];
        if (a === r[PREVIOUS_BEAT]) io.write(PORT2, a);
        r[PREVIOUS_BEAT] = a;
        r[TIMER_PULSES] = (r[TIMER_PULSES] - 1) & BYTE_MASK;
      } while (r[TIMER_PULSES]);
    }
    a = io.read(COUNTER1, 0x025f) & COUNTER_MASK;
    if (a) {
      r[TIMER_PULSES] = a;
      do {
        this.effects0C89();
        r[TIMER_PULSES] = (r[TIMER_PULSES] - 1) & BYTE_MASK;
      } while (r[TIMER_PULSES]);
    }
    if (r[KEY_ON_PENDING]) {
      this.keyOn02FC(r[KEY_ON_PENDING]);
      this.dsp(KOF, 0x00);
      a = r[0x02];
      io.write(DSP_ADDRESS, KON);
      io.write(DSP_DATA, a);
      r[KEY_ON_PENDING] = a ^ r[KEY_ON_PENDING];
    } else if (r[KEY_OFF_PENDING]) {
      this.dsp(KON, 0x00);
      this.dsp(KOF, r[KEY_OFF_PENDING]);
      r[KEY_OFF_PENDING] = 0;
    }
    // $029D: an interrupted transfer of command 10 takes precedence.
    if (r[TRANSFER_COUNT] | r[TRANSFER_COUNT + 1]) {
      this.transfer098A();
      return 0;
    }
    if (io.read(PORT0, 0x02a7) === r[PORT_TOKEN]) return 0;
    r[PARAM_LOW] = io.read(PORT2, 0x02ac);
    r[PARAM_HIGH] = io.read(PORT3, 0x02ac);
    const token = io.read(PORT0, 0x02b0),
      command = io.read(PORT1, 0x02b0);
    r[PORT_TOKEN] = token;
    r[COMMAND] = command;
    io.write(PORT0, token);
    // $02B6-$02C2: self-modifying CALL, natively as a table.
    const low = r[(DISPATCH_LOW + command) & WORD_MASK],
      high = r[(DISPATCH_HIGH + command) & WORD_MASK];
    r[PATCHED_CALL_OPERAND] = low;
    r[PATCHED_CALL_OPERAND + 1] = high;
    return yield* this.command(low | (high << BYTE_BITS));
  }
  // Targets of the command dispatch $02C8/$02E2 (26 commands), see docs/SOUND-DRIVER.md.
  *command(target) {
    const r = this.ram;
    switch (target) {
      case 0x0619: // magic-number-ok: dispatch target
        this.dsp(FLG, FLG_ALL);
        this.io.write(CONTROL, 0xf0); // magic-number-ok: original value before JMP $FFC0
        return IPL; // 00: JMP $FFC0
      case 0x0635: // magic-number-ok: dispatch target
        return yield* this.upload0635(); // 01
      case 0x0688: // magic-number-ok: dispatch target
        r[VOLUME_TARGET_L] = r[PARAM_LOW];
        r[VOLUME_TARGET_R] = r[PARAM_HIGH];
        return 0; // 02
      case 0x068d: // magic-number-ok: dispatch target
        r[FADE_STEP_L] = r[PARAM_LOW];
        r[FADE_STEP_R] = r[PARAM_HIGH];
        return 0; // 03
      case 0x06a3: // magic-number-ok: dispatch target
        this.song06A3();
        return 0; // 04
      case 0x070e: // magic-number-ok: dispatch target
        this.sound070E();
        return 0; // 05
      case 0x0911: // magic-number-ok: dispatch target
        r[SOUND_VOLUME_L] = r[PARAM_LOW];
        r[SOUND_VOLUME_R] = r[PARAM_HIGH];
        return 0; // 06
      case 0x0916: // magic-number-ok: dispatch target
        this.sound0916();
        return 0; // 07
      case 0x0692: // magic-number-ok: dispatch target
        this.volume0692();
        return 0; // 08
      case 0x0956: // magic-number-ok: dispatch target
      case 0x0957: // magic-number-ok: dispatch target
      case 0x0958: // magic-number-ok: dispatch target
        return 0; // 09-0B: RET
      case 0x05a0: // magic-number-ok: dispatch target
        this.stopAll05A0();
        return 0; // 0C
      case 0x0959: // magic-number-ok: dispatch target
        r[SONG_VOLUME_L] = r[PARAM_LOW];
        r[SONG_VOLUME_R] = r[PARAM_HIGH];
        return 0; // 0D
      case 0x0960: // magic-number-ok: dispatch target
        this.pitch0960();
        return 0; // 0E
      case 0x097b: // magic-number-ok: dispatch target
        r[SOUND_VOICES] = r[PARAM_LOW];
        return 0; // 0F
      case 0x097f: // magic-number-ok: dispatch target
        return yield* this.transfer097F(); // 10
      case 0x05d0: // magic-number-ok: dispatch target
        return yield* this.levels05D0(); // 11
      case 0x09b1: // magic-number-ok: dispatch target
        this.channelVolume09B1();
        return 0; // 12
      case 0x05fe: // magic-number-ok: dispatch target
        return yield* this.tempo05FE(); // 13
      case 0x060d: // magic-number-ok: dispatch target
        r[OUTPUT_MODE] = r[PARAM_LOW];
        return 0; // 14
      case 0x0611: // magic-number-ok: dispatch target
        r[PRIORITY_PRESET] = r[PARAM_LOW];
        return 0; // 15
      case 0x0615: // magic-number-ok: dispatch target
        r[TEMPO_SCALE] = r[PARAM_LOW];
        return 0; // 16
      case 0x09ba: // magic-number-ok: dispatch target
        this.voices09BA();
        return 0; // 17
      case 0x09e3: // magic-number-ok: dispatch target
        this.voices09E3();
        return 0; // 18
      case 0x0a00: // magic-number-ok: dispatch target
        this.release0A00();
        return 0; // 19
    }
    throw new VmFault('sound_driver_command_unknown', target, { command: r[COMMAND] });
  }
  // $0358: answer A on port 1 against the next token.
  *reply0358(a) {
    const r = this.ram,
      io = this.io;
    while (io.read(PORT0, 0x0358) === r[PORT_TOKEN]) yield WAIT_PORT;
    r[PORT_TOKEN] = io.read(PORT0, 0x035d);
    io.write(PORT1, a);
    io.write(PORT0, r[PORT_TOKEN]);
    return 0;
  }
  // $04E1: pointers into the base list just loaded at YA (target of command 01).
  pointers04E1(dest) {
    const r = this.ram;
    r[DIRECTORY_ADDEND] = 2;
    r[DIRECTORY_ADDEND + 1] = 0;
    r[0x00] = dest & BYTE_MASK;
    r[0x01] = dest >> BYTE_BITS;
    r[DIRECTORY_PAGE] = ((dest + 2) & WORD_MASK) >> BYTE_BITS;
    const at = () => this.ptr(0x00);
    const set = (d, v) => {
      r[d] = v & BYTE_MASK;
      r[d + 1] = (v >> BYTE_BITS) & BYTE_MASK;
    };
    const scaled = (factor) => {
      const w = (this.ptr(LIST_WORD) * factor) & WORD_MASK;
      set(LIST_WORD, w);
    };
    if (this.word0584()) {
      scaled(DIRECTORY_ENTRY_SIZE);
      this.skip0595();
    }
    if (this.word0584()) {
      scaled(SECOND_BLOCK_ENTRY_SIZE);
      this.skip0595();
    }
    set(SONG_HEADER, at() + 2);
    this.word0584();
    this.skip0595();
    set(SOUND_TABLE, at() + 2);
    this.word0584();
    scaled(SOUND_ENTRY_SIZE);
    this.skip0595();
    set(VIBRATO_TABLE, at() + 2);
    this.word0584();
    scaled(2);
    this.skip0595();
    this.word0584();
    this.skip0595();
    set(SEQUENCE_TABLE, at());
    this.word0584();
    scaled(2);
    this.skip0595();
    this.word0584();
    this.skip0595();
    set(SONG_TABLE, at() + 2);
    if (this.word0584()) {
      scaled(2);
      this.skip0595();
    }
    this.word0584();
    this.header0366();
  }
  // $0584: word at [$00] to $02/$03, $00 += 2; true if it is not zero.
  word0584() {
    const r = this.ram;
    let p = this.ptr(0x00);
    r[LIST_WORD] = this.load(p);
    p = (p + 1) & WORD_MASK;
    r[0x00] = p & BYTE_MASK;
    r[0x01] = p >> BYTE_BITS;
    r[LIST_WORD + 1] = this.load(p);
    p = (p + 1) & WORD_MASK;
    r[0x00] = p & BYTE_MASK;
    r[0x01] = p >> BYTE_BITS;
    return (r[LIST_WORD] | r[LIST_WORD + 1]) !== 0;
  }
  skip0595() {
    const w = (this.ptr(0x00) + this.ptr(LIST_WORD)) & WORD_MASK;
    this.ram[0x00] = w & BYTE_MASK;
    this.ram[0x01] = w >> BYTE_BITS;
  }
  // $05D0 (command 11): per voice |OUTX| * 8 * VOL(L/R) / 256 as two answers.
  *levels05D0() {
    const r = this.ram,
      io = this.io;
    let a = OUTX; // voice 0
    do {
      const x = a;
      io.write(DSP_ADDRESS, a);
      const y = (a & REGISTER_ROW_MASK) >> 1;
      yield* this.level05EE(r[VOICE_REGISTERS + y], 0x05f2); // magic-number-ok: driver instruction address
      yield* this.level05EE(r[VOICE_REGISTERS + 1 + y], 0x05f2); // magic-number-ok: driver instruction address
      a = xcn((xcn(x) + 1) & BYTE_MASK);
    } while (a < DSP_REGISTER_COUNT);
    return 0;
  }
  *level05EE(volume, pc) {
    let a = this.io.read(DSP_DATA, pc);
    if (a & BYTE_SIGN) a = -a & BYTE_MASK;
    return yield* this.reply0358((((volume << LEVEL_VOLUME_SHIFT) & BYTE_MASK) * a) >> BYTE_BITS);
  }
  // $05FE (command 13): tempo $92 = $1E if not zero; the answer is the old tempo.
  *tempo05FE() {
    const r = this.ram,
      old = r[TEMPO];
    if (r[PARAM_LOW]) {
      r[TEMPO] = r[PARAM_LOW];
      this.io.write(TIMER0, r[PARAM_LOW]);
    }
    return yield* this.reply0358(old);
  }
  // $0625: wait for a new token; X = port 1, Y = port 2.
  *token0625() {
    const r = this.ram,
      io = this.io;
    while (io.read(PORT0, 0x0625) === r[PORT_TOKEN]) yield WAIT_PORT;
    const x = io.read(PORT1, 0x062a),
      y = io.read(PORT2, 0x062c),
      a = io.read(PORT0, 0x062e);
    io.write(PORT0, a);
    r[PORT_TOKEN] = a;
    return { x, y };
  }
  // $0635 (command 01): stop everything, load the base list in pairs, blocking.
  *upload0635() {
    const r = this.ram,
      io = this.io;
    r[SONG_VOICES] = ALL_VOICES;
    this.dsp(KOF, ALL_VOICES);
    this.dsp(FLG, FLG_ALL);
    this.dsp(EDL, 0x00);
    this.dsp(ESA, UPLOAD_ECHO_PAGE);
    this.stopAll05A0();
    const { x, y } = yield* this.token0625();
    r[0x00] = x;
    r[BASE_LIST_ADDRESS] = x;
    r[0x01] = y;
    r[BASE_LIST_ADDRESS + 1] = y;
    r[UPLOAD_COUNT] = r[PARAM_LOW];
    r[UPLOAD_COUNT + 1] = r[PARAM_HIGH];
    for (;;) {
      while (io.read(PORT0, 0x0663) === r[PORT_TOKEN]) yield WAIT_PORT;
      this.put(this.ptr(0x00), io.read(PORT1, 0x0668));
      const second = io.read(PORT2, 0x066c),
        token = io.read(PORT0, 0x066e);
      io.write(PORT0, token);
      r[PORT_TOKEN] = token;
      if (this.step067x()) break;
      this.put(this.ptr(0x00), second);
      if (this.step067x()) break;
    }
    this.pointers04E1(this.ptr(BASE_LIST_ADDRESS));
    return 0;
  }
  // INCW $00, DECW $02; true when the counter reaches zero.
  step067x() {
    const r = this.ram,
      p = (this.ptr(0x00) + 1) & WORD_MASK,
      n = (this.ptr(UPLOAD_COUNT) - 1) & WORD_MASK;
    r[0x00] = p & BYTE_MASK;
    r[0x01] = p >> BYTE_BITS;
    r[UPLOAD_COUNT] = n & BYTE_MASK;
    r[UPLOAD_COUNT + 1] = n >> BYTE_BITS;
    return n === 0;
  }
  // $0692 (command 08): set the main volume and update the echo volume.
  volume0692() {
    const r = this.ram;
    r[VOLUME_TARGET_L] = r[PARAM_LOW];
    r[VOLUME_TARGET_R] = r[PARAM_HIGH];
    this.dsp(MVOL_L, r[PARAM_LOW]);
    this.dsp(MVOL_R, r[PARAM_HIGH]);
    this.echoRight03D5();
    this.echoLeft03C7();
  }
  // $06A3 (command 04): start song $1E ($1F bit 0: repeat).
  song06A3() {
    const r = this.ram;
    r[SONG] = r[PARAM_LOW];
    r[SONG_FLAGS] = r[PARAM_HIGH];
    this.stopAll05A0();
    this.start06AC();
  }
  // $070E (command 05): sound $1E with voice mask $5C.
  sound070E() {
    const r = this.ram;
    r[CANDIDATE_VOICES] = r[SOUND_VOICES];
    r[CHOSEN_VOICE] = r[LAST_SOUND_VOICE];
    r[SOUND_PRIORITY] = r[PRIORITY_PRESET];
    this.sound0717();
  }
  // $0916 (command 07): sound with volume from the nibbles of $1F.
  sound0916() {
    const r = this.ram;
    r[SAVED_VOLUME_L] = r[SOUND_VOLUME_L];
    r[SAVED_VOLUME_R] = r[SOUND_VOLUME_R];
    let a = r[PARAM_HIGH] & LEFT_VOLUME_NIBBLE;
    r[SOUND_VOLUME_L] = a;
    r[SOUND_VOLUME_L] = (xcn(a) | r[SOUND_VOLUME_L]) >> 1;
    a = r[PARAM_HIGH] & NIBBLE_MASK;
    r[SOUND_VOLUME_R] = a;
    r[SOUND_VOLUME_R] = (xcn(a) | r[SOUND_VOLUME_R]) >> 1;
    r[PARAM_HIGH] = FIXED_PITCH_NOTE;
    r[CANDIDATE_VOICES] = r[SOUND_VOICES];
    r[CHOSEN_VOICE] = r[LAST_SOUND_VOICE];
    r[SOUND_PRIORITY] = r[PRIORITY_PRESET];
    this.sound0717();
    r[SOUND_VOLUME_L] = r[SAVED_VOLUME_L];
    r[SOUND_VOLUME_R] = r[SAVED_VOLUME_R];
  }
  // $0960 (command 0E): set the pitch in sound entry $1E.
  pitch0960() {
    const r = this.ram,
      entry = (r[PARAM_LOW] * SOUND_ENTRY_SIZE + this.ptr(SOUND_TABLE)) & WORD_MASK;
    r[0x00] = entry & BYTE_MASK;
    r[0x01] = entry >> BYTE_BITS;
    const v = r[PARAM_HIGH];
    r[PARAM_HIGH] = v >> 2;
    this.put(
      entry + PITCH_L,
      ((v & 1) << PITCH_FRACTION_SHIFT) | ((v & 2) << PITCH_FRACTION_SHIFT),
    );
    this.put(entry + PITCH_H, r[PARAM_HIGH]);
  }
  // $097F (command 10): target from $0625, length $1E; continuation $098A.
  *transfer097F() {
    const r = this.ram;
    const { x, y } = yield* this.token0625();
    r[TRANSFER_TARGET] = x;
    r[TRANSFER_TARGET + 1] = y;
    r[TRANSFER_COUNT] = r[PARAM_LOW];
    r[TRANSFER_COUNT + 1] = r[PARAM_HIGH];
    this.transfer098A();
    return 0;
  }
  // $098A: pairs to [$6F] until $71 is zero or no token arrives. X counts
  // down from the last received token (initially $9B); X = 0 ends at once.
  transfer098A() {
    const r = this.ram,
      io = this.io;
    let x = TRANSFER_FIRST_X;
    for (;;) {
      x = (x - 1) & BYTE_MASK;
      if (!x) return;
      // Without a new token the original counts X down to zero: time limit.
      if (io.read(PORT0, 0x0991) === r[PORT_TOKEN]) return;
      this.put(this.ptr(TRANSFER_TARGET), io.read(PORT1, 0x0996));
      const second = io.read(PORT2, 0x099a);
      x = io.read(PORT0, 0x099c);
      io.write(PORT0, x);
      r[PORT_TOKEN] = x;
      if (this.step09Ax()) return;
      this.put(this.ptr(TRANSFER_TARGET), second);
      if (this.step09Ax()) return;
    }
  }
  step09Ax() {
    const r = this.ram,
      p = (this.ptr(TRANSFER_TARGET) + 1) & WORD_MASK,
      n = (this.ptr(TRANSFER_COUNT) - 1) & WORD_MASK;
    r[TRANSFER_TARGET] = p & BYTE_MASK;
    r[TRANSFER_TARGET + 1] = p >> BYTE_BITS;
    r[TRANSFER_COUNT] = n & BYTE_MASK;
    r[TRANSFER_COUNT + 1] = n >> BYTE_BITS;
    return n === 0;
  }
  // $09B1 (command 12): volume $1F for channel $1E, left and right. X and A
  // are read once, as in the original, before either store.
  channelVolume09B1() {
    const r = this.ram,
      x = r[PARAM_LOW],
      a = r[PARAM_HIGH];
    this.setZp(CHANNEL_VOLUME_L + x, a);
    this.setZp(CHANNEL_VOLUME_R + x, a);
  }
  // $09BA (command 17): volume L/R of the voices in $5C (averaged without $0E bit 7).
  voices09BA() {
    const r = this.ram;
    if (!(r[OUTPUT_MODE] & OUTPUT_STEREO)) {
      const a = (r[PARAM_LOW] + r[PARAM_HIGH]) >> 1;
      r[PARAM_LOW] = a;
      r[PARAM_HIGH] = a;
    }
    this.voiceWords(VOL_L);
  }
  // $09E3 (command 18): pitch of the voices in $5C.
  voices09E3() {
    this.voiceWords(PITCH_L);
  }
  voiceWords(register) {
    const r = this.ram;
    r[0x00] = r[SOUND_VOICES];
    for (let y = VOICE_COUNT - 1; y >= 0; y--) {
      const carry = r[0x00] >> (BYTE_BITS - 1);
      r[0x00] = (r[0x00] << 1) & BYTE_MASK;
      if (carry) {
        const x = xcn(y) | register;
        this.dsp(x, r[PARAM_LOW]);
        this.dsp(x + 1, r[PARAM_HIGH]);
      }
    }
  }
  // $0A00 (command 19): release the voices of the bits of $1E.
  release0A00() {
    const r = this.ram;
    for (let x = VOICE_COUNT - 1; x >= 0; x--) {
      const carry = r[PARAM_LOW] >> (BYTE_BITS - 1);
      r[PARAM_LOW] = (r[PARAM_LOW] << 1) & BYTE_MASK;
      if (carry) this.release0491(x);
    }
  }
}
