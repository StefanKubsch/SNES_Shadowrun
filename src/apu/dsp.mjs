// Sound chip (DSP) as a device model. Sources: Book I sound part, chapter 7:
//   Table 3-7-1 (PDF 168)    register map; the DSP writes ENVX/OUTX/ENDX itself;
//                            OUTX is the value after the envelope, before VOL.
//   7.2.1.1/2 (PDF 169)      VOL L/R in two's complement; pitch 14 bits, 1000H = original pitch.
//   7.2.1.3 (PDF 170)        ADSR: attack +1/64, decay/sustain *(1-1/256); times table 3-7-2.
//   7.2.1.4 (PDF 171/172)    GAIN: direct, linear +-1/64, bent line (+1/64 up to 0.75, then +1/256),
//                            exponential *(1-1/256); times table 3-7-3.
//   7.2.1.5/6 (PDF 173)      ENVX/OUTX per Ts (31.25 us, 32 kHz).
//   7.2.2.1 (PDF 174)        KON/KOF; after KOF the envelope falls by 1/256 per Ts (8 ms).
//   7.2.2.2/3 (PDF 174)      PMON: voice n is modulated by OUTX of n-1, P' = P(1+y0), not voice 0;
//                            NON: noise instead of the sample, one shared source.
//   7.2.2.4, (5) (PDF 175)   EON; FLG RES (all voices off), MUTE, ECEN (echo writes
//                            to ARAM at D5=0), NCK noise clock (table 3-7-4 = counter rates).
//   7.2.2.5-10 (PDF 176)     ENDX; MVOL/EVOL signed, output = main plus echo part;
//                            ESA*100H echo start; EDL 2 KByte per 16 ms (EDL=0: 4 bytes); EFB.
//   7.2.2.11 (PDF 177)       C0-C7: FIR with eight taps, the same for L and R.
//   7.3 (PDF 178/179)        source directory (DIR*100H, start and loop per source),
//                            BRR blocks of 9 bytes, header: range, filter, bit 1 loop, bit 0 end.
// The manual gives times, formulas and registers, not the sequence inside the chip. The
// calculation steps (phases of a Ts, rounding and clamping, rates of the shared
// counter, the chip's Gaussian table, key-on delay, KON/KOF every second Ts)
// are the known chip behaviour; tools/sound-apu.test.mjs checks them against the
// internal DSP state of the original in Mesen at every frame, against every DSP read
// and against the echo buffer in ARAM. The periods give the manual times (AR=0:
// 64 steps of 2048 Ts = 4.1 s; release 256 Ts = 8 ms; NCK as in table 3-7-4).
import { VmFault } from '../vm/memory.mjs';
import {
  VOL_L,
  PITCH_L,
  PITCH_H,
  SRCN,
  ADSR1,
  ADSR2,
  GAIN,
  ENVX,
  OUTX,
  MVOL_L,
  EVOL_L,
  KON,
  KOF,
  FLG,
  ENDX,
  EFB,
  PMON,
  NON,
  EON,
  DIR,
  ESA,
  EDL,
  FIR_COEFFICIENT,
  FLG_RESET,
  FLG_MUTE,
  FLG_ECHO_OFF,
  FLG_NOISE_CLOCK,
  MVOL_R,
  DSP_REGISTER_COUNT,
  VOICE_COUNT,
  REGISTER_ROW_SHIFT,
  REGISTER_COLUMN_MASK,
  FIR_TAP_COUNT,
  PMON_VOICES,
  PITCH_H_MASK,
  ADSR1_ENABLE,
  ADSR1_ATTACK_RATE,
  ADSR2_SUSTAIN_LEVEL_SHIFT,
  ADSR2_SUSTAIN_RATE,
  GAIN_MODE_SHIFT,
  GAIN_RATE,
  GAIN_LINEAR_DECREASE,
  GAIN_EXPONENTIAL_DECREASE,
  GAIN_LINEAR_INCREASE,
  EDL_MASK,
  EDL_BYTES_SHIFT,
  DIRECTORY_ENTRY_SHIFT,
  DIRECTORY_LOOP_OFFSET,
  BRR_BLOCK_BYTES,
  BRR_END,
  BRR_LOOP,
  BRR_FILTER_MASK,
  BRR_FILTER_2,
  BRR_RANGE_SHIFT,
} from './dsp-registers.mjs';
import { ARAM_SIZE } from './spc-io.mjs';
import { WORD_MASK, BYTE_MASK, BYTE_BITS } from '../constants/bits.mjs';

const RATES = [
  0, 2048, 1536, 1280, 1024, 768, 640, 512, 384, 320, 256, 192, 160, 128, 96, 80, 64, 48, 40, 32,
  24, 20, 16, 12, 10, 8, 6, 5, 4, 3, 2, 1,
];
const OFFSETS = [
  1, 0, 1040, 536, 0, 1040, 536, 0, 1040, 536, 0, 1040, 536, 0, 1040, 536, 0, 1040, 536, 0, 1040,
  536, 0, 1040, 536, 0, 1040, 536, 0, 1040, 0, 0,
];
export const COUNTER_RANGE = 2048 * 5 * 3;
const ATTACK = 0,
  DECAY = 1,
  SUSTAIN = 2,
  RELEASE = 3;
// Envelope: 11 bits, 0x800 = 1.0; ENVX shows its upper seven bits (PDF 173).
// Steps per counter event: 1/64 linear (attack, GAIN increase/decrease), 1/256
// above 0.75 in the bent line and in the release (PDF 170-174); the
// exponential modes multiply by 1 - 1/256. Attack rate 31 (AR = $F) steps by 1/2.
const ENVELOPE_MAX = 0x7ff,
  ENVX_SHIFT = 4,
  ENVELOPE_STEP = 0x20,
  ENVELOPE_FINE_STEP = 0x08,
  ENVELOPE_FAST_ATTACK_STEP = 0x400,
  BENT_LINE_KNEE = 0x600,
  EXPONENTIAL_SHIFT = 8,
  RELEASE_STEP = 8,
  DIRECT_GAIN_SCALE = 0x10,
  SUSTAIN_LEVEL_SHIFT = 8,
  // Counter rate index: 31 fires every Ts; AR maps to 2 * AR + 1, DR to 2 * DR + 16.
  RATE_EVERY_SAMPLE = 31,
  DECAY_RATE_BASE = 0x10,
  ADSR1_DECAY_RATE_X2 = 0x0e,
  ADSR1_DECAY_RATE_X2_SHIFT = 3;
// Key-on: five Ts until the voice starts (known chip behaviour, see above).
const KEY_ON_DELAY = 5;
// Interpolation position: 12 fraction bits per sample, so pitch $1000 plays one
// sample per Ts (PDF 169); a BRR step decodes a group of four samples into a ring
// of three groups. Bits 4-11 select the Gaussian taps.
const INTERP_SAMPLE_SHIFT = 12,
  INTERP_GAUSS_SHIFT = 4,
  INTERP_GROUP = 0x4000,
  INTERP_FRACTION_MASK = 0x3fff,
  INTERP_MAX = 0x7fff,
  BRR_GROUP_SAMPLES = 4,
  BRR_RING_SAMPLES = 12,
  BRR_NYBBLE_BITS = 4,
  // Ranges 13-15 are not valid shifts; the chip then keeps only the sign.
  BRR_RANGE_INVALID = 0xd;
const GAUSS_HALF = 256,
  GAUSS_SHIFT = 11;
// Fixed-point scales: VOL, MVOL, EVOL and EFB are signed 1.7 values, the FIR
// coefficients signed 2.6 values; the voice output is the sample times the
// 11-bit envelope.
const VOLUME_SHIFT = 7,
  FIR_SHIFT = 6,
  ENVELOPE_SHIFT = 11,
  // PMON P' = P(1 + y0): y0 as a 1.10 fraction of the previous voice output.
  PMON_OUTPUT_SHIFT = 5,
  PMON_SCALE_SHIFT = 10;
// Noise: 15-bit shift register, new top bit = bit 0 XOR bit 1.
const NOISE_TOP_BIT = 0x4000,
  NOISE_TAP0_SHIFT = 14,
  NOISE_TAP1_SHIFT = 13;
// Echo: one stereo frame of two 16-bit samples per Ts.
const ECHO_FRAME_BYTES = 4;
const PHASES_PER_SAMPLE = 32,
  CHANNELS = 2;
// Gaussian interpolation: half curve of the chip (512 values, sum of the four taps
// about 2048). A Mesen test compares it with the emulator's table.
// prettier-ignore
export const GAUSS = Int16Array.of(
     0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
     1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   2,   2,   2,   2,   2,
     2,   2,   3,   3,   3,   3,   3,   4,   4,   4,   4,   4,   5,   5,   5,   5,
     6,   6,   6,   6,   7,   7,   7,   8,   8,   8,   9,   9,   9,  10,  10,  10,
    11,  11,  11,  12,  12,  13,  13,  14,  14,  15,  15,  15,  16,  16,  17,  17,
    18,  19,  19,  20,  20,  21,  21,  22,  23,  23,  24,  24,  25,  26,  27,  27,
    28,  29,  29,  30,  31,  32,  32,  33,  34,  35,  36,  36,  37,  38,  39,  40,
    41,  42,  43,  44,  45,  46,  47,  48,  49,  50,  51,  52,  53,  54,  55,  56,
    58,  59,  60,  61,  62,  64,  65,  66,  67,  69,  70,  71,  73,  74,  76,  77,
    78,  80,  81,  83,  84,  86,  87,  89,  90,  92,  94,  95,  97,  99, 100, 102,
   104, 106, 107, 109, 111, 113, 115, 117, 118, 120, 122, 124, 126, 128, 130, 132,
   134, 137, 139, 141, 143, 145, 147, 150, 152, 154, 156, 159, 161, 163, 166, 168,
   171, 173, 175, 178, 180, 183, 186, 188, 191, 193, 196, 199, 201, 204, 207, 210,
   212, 215, 218, 221, 224, 227, 230, 233, 236, 239, 242, 245, 248, 251, 254, 257,
   260, 263, 267, 270, 273, 276, 280, 283, 286, 290, 293, 297, 300, 304, 307, 311,
   314, 318, 321, 325, 328, 332, 336, 339, 343, 347, 351, 354, 358, 362, 366, 370,
   374, 378, 381, 385, 389, 393, 397, 401, 405, 410, 414, 418, 422, 426, 430, 434,
   439, 443, 447, 451, 456, 460, 464, 469, 473, 477, 482, 486, 491, 495, 499, 504,
   508, 513, 517, 522, 527, 531, 536, 540, 545, 550, 554, 559, 563, 568, 573, 577,
   582, 587, 592, 596, 601, 606, 611, 615, 620, 625, 630, 635, 640, 644, 649, 654,
   659, 664, 669, 674, 678, 683, 688, 693, 698, 703, 708, 713, 718, 723, 728, 732,
   737, 742, 747, 752, 757, 762, 767, 772, 777, 782, 787, 792, 797, 802, 806, 811,
   816, 821, 826, 831, 836, 841, 846, 851, 855, 860, 865, 870, 875, 880, 884, 889,
   894, 899, 904, 908, 913, 918, 923, 927, 932, 937, 941, 946, 951, 955, 960, 965,
   969, 974, 978, 983, 988, 992, 997,1001,1005,1010,1014,1019,1023,1027,1032,1036,
  1040,1045,1049,1053,1057,1061,1066,1070,1074,1078,1082,1086,1090,1094,1098,1102,
  1106,1109,1113,1117,1121,1125,1128,1132,1136,1139,1143,1146,1150,1153,1157,1160,
  1164,1167,1170,1174,1177,1180,1183,1186,1190,1193,1196,1199,1202,1205,1207,1210,
  1213,1216,1219,1221,1224,1227,1229,1232,1234,1237,1239,1241,1244,1246,1248,1251,
  1253,1255,1257,1259,1261,1263,1265,1267,1269,1270,1272,1274,1275,1277,1279,1280,
  1282,1283,1284,1286,1287,1288,1290,1291,1292,1293,1294,1295,1296,1297,1297,1298,
  1299,1300,1300,1301,1302,1302,1303,1303,1303,1304,1304,1304,1304,1304,1305,1305,
);

const INT8_SHIFT = 24,
  INT16_SHIFT = 16,
  INT32_SIGN_SHIFT = 31,
  INT16_MAX = 0x7fff;
const s8 = (x) => (x << INT8_SHIFT) >> INT8_SHIFT,
  s16 = (x) => (x << INT16_SHIFT) >> INT16_SHIFT;
const clamp16 = (x) => (s16(x) === x ? x : (x >> INT32_SIGN_SHIFT) ^ INT16_MAX);

class Voice {
  constructor(n) {
    this.n = n;
    this.bit = 1 << n;
    this.base = n << REGISTER_ROW_SHIFT;
    this.mode = RELEASE;
    this.env = 0;
    this.hidden = 0;
    this.konDelay = 0;
    this.envxOut = 0;
    this.brrAddress = 0;
    this.brrOffset = 1;
    this.interpPos = 0;
    // last decoded BRR values as a ring of three groups of four
    this.buf = new Int32Array(BRR_RING_SAMPLES);
    this.bufPos = 0;
  }
}
// Sequence of a Ts in 32 phases: per voice V1 (source number, directory address of the
// previous voice), V2 (directory entry, ADSR(1), pitch L), V3 (pitch H,
// BRR header and byte, PMON, key-on, interpolation, envelope), V4 (BRR decoding,
// progress, output left), V5 (right, ENDX buffer), V6 (OUTX buffer),
// V7 (ENDX, ENVX buffer), V8 (OUTX), V9 (ENVX); in addition the shared steps
// 27-30 (PMON, NON/EON/DIR, KON/KOF every second Ts, counter and noise) and the
// echo 22-30 (FIR, output, feedback, write to ARAM).
const V1 = 1,
  V2 = 2,
  V3 = 3,
  V3A = 4,
  V3B = 5,
  V3C = 6,
  V4 = 7,
  V5 = 8,
  V6 = 9,
  V7 = 10,
  V8 = 11,
  V9 = 12,
  M27 = 13,
  M28 = 14,
  M29 = 15,
  M30 = 16,
  E22 = 17,
  E23 = 18,
  E24 = 19,
  E25 = 20,
  E26 = 21,
  E27 = 22,
  E28 = 23,
  E29 = 24,
  E30 = 25;
// Output-only mixers can reuse the echo equations without running another voice decoder.
export const ECHO_FIRST_STEP = E22,
  ECHO_LAST_STEP = E30;
const PHASES = [
  [V5, 0, V2, 1],
  [V6, 0, V3, 1],
  [V7, 0, V1, 3, V4, 1],
  [V8, 0, V5, 1, V2, 2],
  [V9, 0, V6, 1, V3, 2],
  [V7, 1, V1, 4, V4, 2],
  [V8, 1, V5, 2, V2, 3],
  [V9, 1, V6, 2, V3, 3],
  [V7, 2, V1, 5, V4, 3],
  [V8, 2, V5, 3, V2, 4],
  [V9, 2, V6, 3, V3, 4],
  [V7, 3, V1, 6, V4, 4],
  [V8, 3, V5, 4, V2, 5],
  [V9, 3, V6, 4, V3, 5],
  [V7, 4, V1, 7, V4, 5],
  [V8, 4, V5, 5, V2, 6],
  [V9, 4, V6, 5, V3, 6],
  [V1, 0, V7, 5, V4, 6],
  [V8, 5, V5, 6, V2, 7],
  [V9, 5, V6, 6, V3, 7],
  [V1, 1, V7, 6, V4, 7],
  [V8, 6, V5, 7, V2, 0],
  [V3A, 0, V9, 6, V6, 7, E22, 0],
  [V7, 7, E23, 0],
  [V8, 7, E24, 0],
  [V3B, 0, V9, 7, E25, 0],
  [E26, 0],
  [M27, 0, E27, 0],
  [M28, 0, E28, 0],
  [M29, 0, E29, 0],
  [M30, 0, V3C, 0, E30, 0],
  [V4, 0, V1, 2],
];

export class Dsp {
  constructor(ram) {
    if (!(ram instanceof Uint8Array) || ram.length !== ARAM_SIZE)
      throw new VmFault('dsp_aram_required');
    this.ram = ram;
    this.regs = new Uint8Array(DSP_REGISTER_COUNT);
    this.regs[FLG] = FLG_RESET | FLG_MUTE | FLG_ECHO_OFF; // RES, MUTE and echo writes off after power-on (PDF 175)
    this.voices = Array.from({ length: VOICE_COUNT }, (_, n) => new Voice(n));
    this.counter = 0;
    this.everyOther = 1;
    this.newKon = 0;
    this.kon = 0;
    this.koff = 0;
    this.dir = 0;
    this.noise = NOISE_TOP_BIT;
    // Intermediate values of the steps, shared by all voices as in the chip
    this.srcn = 0;
    this.dirAddress = 0;
    this.next = 0;
    this.adsr1 = 0;
    this.pitch = 0;
    this.header = 0;
    this.brrByte = 0;
    this.looped = 0;
    this.output = 0;
    this.pmon = 0;
    this.non = 0;
    this.eon = 0;
    this.endxBuf = 0;
    this.outxBuf = 0;
    this.envxBuf = 0;
    this.mainOut = new Int32Array(CHANNELS);
    this.echoOut = new Int32Array(CHANNELS);
    this.echoIn = new Int32Array(CHANNELS);
    // Echo: history (eight values per side), position in the buffer, length, start page, FLG
    this.history = new Int32Array(FIR_TAP_COUNT * CHANNELS);
    this.historyPos = 0;
    this.echoOffset = 0;
    this.echoLength = 0;
    this.esa = 0;
    this.echoPointer = 0;
    this.echoFlags = this.regs[FLG];
    this.phase = 0;
    this.clocks = 0;
    this.latches = 0;
    // Output: Int16Array with L/R pairs up to its length; null = no output.
    this.out = null;
    this.outCount = 0;
  }
  read(address) {
    return this.regs[address];
  }
  write(address, value) {
    this.regs[address] = value;
    const low = address & REGISTER_COLUMN_MASK;
    if (low === ENVX) this.envxBuf = value;
    else if (low === OUTX) this.outxBuf = value;
    else if (address === KON) this.newKon = value;
    else if (address === ENDX) {
      this.regs[ENDX] = 0;
      this.endxBuf = 0;
    }
  }
  counterFires(rate) {
    return rate !== 0 && (this.counter + OFFSETS[rate]) % RATES[rate] === 0;
  }
  sample() {
    this.clock(PHASES_PER_SAMPLE);
  }
  clock(phases) {
    for (let k = 0; k < phases; k++) {
      const steps = PHASES[this.phase];
      for (let i = 0; i < steps.length; i += 2) this.step(steps[i], this.voices[steps[i + 1]]);
      this.phase = (this.phase + 1) % PHASES_PER_SAMPLE;
      this.clocks++;
    }
  }
  step(kind, v) {
    const regs = this.regs,
      ram = this.ram;
    switch (kind) {
      case V1:
        this.dirAddress = (this.dir << BYTE_BITS) + (this.srcn << DIRECTORY_ENTRY_SHIFT);
        this.srcn = regs[v.base | SRCN];
        return;
      case V2: {
        const entry = (this.dirAddress + (v.konDelay ? 0 : DIRECTORY_LOOP_OFFSET)) & WORD_MASK;
        this.next = ram[entry] | (ram[(entry + 1) & WORD_MASK] << BYTE_BITS);
        this.adsr1 = regs[v.base | ADSR1];
        this.pitch = regs[v.base | PITCH_L];
        return;
      }
      case V3:
        this.step(V3A, v);
        this.step(V3B, v);
        this.step(V3C, v);
        return;
      case V3A:
        this.pitch += (regs[v.base | PITCH_H] & PITCH_H_MASK) << BYTE_BITS;
        return;
      case V3B:
        this.brrByte = ram[(v.brrAddress + v.brrOffset) & WORD_MASK];
        this.header = ram[v.brrAddress];
        return;
      case V3C:
        this.voiceV3c(v);
        return;
      case V4: {
        this.looped = 0;
        if (v.interpPos >= INTERP_GROUP) {
          this.decodeBrr(v);
          if ((v.brrOffset += 2) >= BRR_BLOCK_BYTES) {
            v.brrAddress = (v.brrAddress + BRR_BLOCK_BYTES) & WORD_MASK;
            if (this.header & BRR_END) {
              v.brrAddress = this.next;
              this.looped = v.bit;
            }
            v.brrOffset = 1;
          }
        }
        v.interpPos = Math.min((v.interpPos & INTERP_FRACTION_MASK) + this.pitch, INTERP_MAX);
        this.voiceOutput(v, 0);
        return;
      }
      case V5: {
        this.voiceOutput(v, 1);
        let endx = regs[ENDX] | this.looped;
        if (v.konDelay === KEY_ON_DELAY) endx &= ~v.bit;
        this.endxBuf = endx & BYTE_MASK;
        return;
      }
      case V6:
        this.outxBuf = (this.output >> BYTE_BITS) & BYTE_MASK;
        return;
      case V7:
        regs[ENDX] = this.endxBuf;
        this.envxBuf = v.envxOut;
        return;
      case V8:
        regs[v.base | OUTX] = this.outxBuf;
        return;
      case V9:
        regs[v.base | ENVX] = this.envxBuf;
        return;
      case M27:
        this.pmon = regs[PMON] & PMON_VOICES;
        return;
      case M28:
        this.non = regs[NON];
        this.eon = regs[EON];
        this.dir = regs[DIR];
        return;
      case M29:
        this.everyOther ^= 1;
        if (this.everyOther) this.newKon &= ~this.kon;
        return;
      case M30:
        if (this.everyOther) {
          this.kon = this.newKon;
          this.koff = regs[KOF];
          this.latches++;
        }
        if (--this.counter < 0) this.counter = COUNTER_RANGE - 1;
        if (this.counterFires(regs[FLG] & FLG_NOISE_CLOCK)) {
          const feedback = (this.noise << NOISE_TAP0_SHIFT) ^ (this.noise << NOISE_TAP1_SHIFT);
          this.noise = (feedback & NOISE_TOP_BIT) ^ (this.noise >> 1);
        }
        return;
      case E22: {
        this.historyPos = (this.historyPos + 1) % FIR_TAP_COUNT;
        this.echoPointer = ((this.esa << BYTE_BITS) + this.echoOffset) & WORD_MASK;
        this.echoRead(0);
        this.echoIn[0] = this.fir(0, 0);
        this.echoIn[1] = this.fir(0, 1);
        return;
      }
      case E23:
        this.echoIn[0] += this.fir(1, 0) + this.fir(2, 0);
        this.echoIn[1] += this.fir(1, 1) + this.fir(2, 1);
        this.echoRead(1);
        return;
      case E24:
        this.echoIn[0] += this.fir(3, 0) + this.fir(4, 0) + this.fir(5, 0); // magic-number-ok: FIR taps C3-C5
        this.echoIn[1] += this.fir(3, 1) + this.fir(4, 1) + this.fir(5, 1); // magic-number-ok: FIR taps C3-C5
        return;
      case E25:
        for (let ch = 0; ch < CHANNELS; ch++) {
          const s = s16(this.echoIn[ch] + this.fir(6, ch)) + s16(this.fir(7, ch)); // magic-number-ok: FIR taps C6/C7
          this.echoIn[ch] = clamp16(s) & ~1;
        }
        return;
      case E26: {
        this.mainOut[0] = this.echoOutput(0);
        const efb = s8(regs[EFB]);
        for (let ch = 0; ch < CHANNELS; ch++)
          this.echoOut[ch] =
            clamp16(this.echoOut[ch] + s16((this.echoIn[ch] * efb) >> VOLUME_SHIFT)) & ~1;
        return;
      }
      case E27: {
        let l = this.mainOut[0],
          r = this.echoOutput(1);
        this.mainOut[0] = 0;
        this.mainOut[1] = 0;
        if (regs[FLG] & FLG_MUTE) {
          l = 0;
          r = 0;
        }
        const out = this.out;
        if (out && this.outCount < out.length) {
          out[this.outCount] = l;
          out[this.outCount + 1] = r;
          this.outCount += 2;
        }
        return;
      }
      case E28:
        this.echoFlags = regs[FLG];
        return;
      case E29:
        this.esa = regs[ESA];
        if (!this.echoOffset) this.echoLength = (regs[EDL] & EDL_MASK) << EDL_BYTES_SHIFT;
        this.echoOffset += ECHO_FRAME_BYTES;
        if (this.echoOffset >= this.echoLength) this.echoOffset = 0;
        this.echoWrite(0);
        this.echoFlags = regs[FLG];
        return;
      case E30:
        this.echoWrite(1);
        return;
    }
  }
  voiceV3c(v) {
    if (this.pmon & v.bit)
      this.pitch += ((this.output >> PMON_OUTPUT_SHIFT) * this.pitch) >> PMON_SCALE_SHIFT;
    if (v.konDelay) {
      if (v.konDelay === KEY_ON_DELAY) {
        v.brrAddress = this.next;
        v.brrOffset = 1;
        v.bufPos = 0;
        this.header = 0;
      }
      v.env = 0;
      v.hidden = 0;
      v.interpPos = --v.konDelay & 3 ? INTERP_GROUP : 0; // magic-number-ok: chip key-on sequence
      this.pitch = 0;
    }
    const sample = this.non & v.bit ? s16(this.noise * 2) : this.interpolate(v);
    this.output = ((sample * v.env) >> ENVELOPE_SHIFT) & ~1;
    v.envxOut = v.env >> ENVX_SHIFT;
    // Immediate silence at the block end without a loop, or on RES.
    if (this.regs[FLG] & FLG_RESET || (this.header & (BRR_END | BRR_LOOP)) === BRR_END) {
      v.mode = RELEASE;
      v.env = 0;
    }
    if (this.everyOther) {
      if (this.koff & v.bit) v.mode = RELEASE;
      if (this.kon & v.bit) {
        v.konDelay = KEY_ON_DELAY;
        v.mode = ATTACK;
      }
    }
    if (!v.konDelay) this.envelope(v);
  }
  // Four taps of the Gaussian curve around the fractional position (bits 4-11 of interpPos).
  interpolate(v) {
    const offset = (v.interpPos >> INTERP_GAUSS_SHIFT) & BYTE_MASK,
      buf = v.buf,
      at = (v.interpPos >> INTERP_SAMPLE_SHIFT) + v.bufPos,
      tap = (k) => buf[(at + k) % BRR_RING_SAMPLES];
    let out = (GAUSS[GAUSS_HALF - 1 - offset] * tap(0)) >> GAUSS_SHIFT;
    out += (GAUSS[2 * GAUSS_HALF - 1 - offset] * tap(1)) >> GAUSS_SHIFT;
    out += (GAUSS[GAUSS_HALF + offset] * tap(2)) >> GAUSS_SHIFT;
    out = s16(out);
    out += (GAUSS[offset] * tap(BRR_GROUP_SAMPLES - 1)) >> GAUSS_SHIFT;
    return clamp16(out) & ~1;
  }
  // Four values from two BRR bytes: range (header bits 4-7), filter (bits 2/3, PDF 179).
  decodeBrr(v) {
    let nybbles =
      (this.brrByte << BYTE_BITS) | this.ram[(v.brrAddress + v.brrOffset + 1) & WORD_MASK];
    const header = this.header,
      shift = header >> BRR_RANGE_SHIFT,
      filter = header & BRR_FILTER_MASK,
      buf = v.buf;
    let pos = v.bufPos;
    const next = pos + BRR_GROUP_SAMPLES;
    v.bufPos = next >= BRR_RING_SAMPLES ? 0 : next;
    for (let k = 0; k < BRR_GROUP_SAMPLES; k++, pos++, nybbles <<= BRR_NYBBLE_BITS) {
      let s = s16(nybbles) >> (INT16_SHIFT - BRR_NYBBLE_BITS);
      s = (s << shift) >> 1;
      if (shift >= BRR_RANGE_INVALID) s = (s >> 25) << 11; // magic-number-ok: sign only, -2048 or 0
      // The two previous samples (the ring holds doubled values).
      const p1 = buf[(pos + BRR_RING_SAMPLES - 1) % BRR_RING_SAMPLES],
        p2 = buf[(pos + BRR_RING_SAMPLES - 2) % BRR_RING_SAMPLES] >> 1;
      // Filter coefficients (PDF 179) in the chip's fixed-point steps.
      if (filter >= BRR_FILTER_2) {
        s += p1;
        s -= p2;
        if (filter === BRR_FILTER_2) {
          s += p2 >> 4; // magic-number-ok: filter 2 coefficient
          s += (p1 * -3) >> 6; // magic-number-ok: filter 2 coefficient
        } else {
          s += (p1 * -13) >> 7; // magic-number-ok: filter 3 coefficient
          s += (p2 * 3) >> 4; // magic-number-ok: filter 3 coefficient
        }
      } else if (filter) {
        s += p1 >> 1;
        s += -p1 >> 5; // magic-number-ok: filter 1 coefficient
      }
      buf[pos] = s16(clamp16(s) * 2);
    }
  }
  voiceOutput(v, ch) {
    const amp = (this.output * s8(this.regs[v.base | (VOL_L + ch)])) >> VOLUME_SHIFT;
    this.mainOut[ch] = clamp16(this.mainOut[ch] + amp);
    if (this.eon & v.bit) this.echoOut[ch] = clamp16(this.echoOut[ch] + amp);
  }
  echoOutput(ch) {
    const regs = this.regs;
    return clamp16(
      s16((this.mainOut[ch] * s8(regs[MVOL_L + ch * (MVOL_R - MVOL_L)])) >> VOLUME_SHIFT) +
        s16((this.echoIn[ch] * s8(regs[EVOL_L + ch * (MVOL_R - MVOL_L)])) >> VOLUME_SHIFT),
    );
  }
  // Tap i: history value i+1 steps after the newest, coefficient Ci (PDF 177).
  fir(i, ch) {
    return (
      (this.history[((this.historyPos + i + 1) % FIR_TAP_COUNT) * CHANNELS + ch] *
        s8(this.regs[(i << REGISTER_ROW_SHIFT) | FIR_COEFFICIENT])) >>
      FIR_SHIFT
    );
  }
  echoRead(ch) {
    const a = this.echoPointer + ch * 2,
      ram = this.ram;
    this.history[this.historyPos * CHANNELS + ch] =
      s16(ram[a & WORD_MASK] | (ram[(a + 1) & WORD_MASK] << BYTE_BITS)) >> 1;
  }
  echoWrite(ch) {
    if (!(this.echoFlags & FLG_ECHO_OFF)) {
      const a = this.echoPointer + ch * 2,
        value = this.echoOut[ch];
      this.ram[a & WORD_MASK] = value & BYTE_MASK;
      this.ram[(a + 1) & WORD_MASK] = (value >> BYTE_BITS) & BYTE_MASK;
    }
    this.echoOut[ch] = 0;
  }
  envelope(v) {
    const regs = this.regs,
      base = v.base;
    let env = v.env;
    if (v.mode === RELEASE) {
      env -= RELEASE_STEP;
      if (env < 0) env = 0;
      v.env = env;
      return;
    }
    const adsr1 = this.adsr1;
    let data = regs[base | ADSR2],
      rate;
    if (adsr1 & ADSR1_ENABLE) {
      if (v.mode >= DECAY) {
        env--;
        env -= env >> EXPONENTIAL_SHIFT;
        rate = data & ADSR2_SUSTAIN_RATE;
        if (v.mode === DECAY)
          rate = ((adsr1 >> ADSR1_DECAY_RATE_X2_SHIFT) & ADSR1_DECAY_RATE_X2) + DECAY_RATE_BASE;
      } else {
        rate = (adsr1 & ADSR1_ATTACK_RATE) * 2 + 1;
        env += rate < RATE_EVERY_SAMPLE ? ENVELOPE_STEP : ENVELOPE_FAST_ATTACK_STEP;
      }
    } else {
      data = regs[base | GAIN];
      const mode = data >> GAIN_MODE_SHIFT;
      if (mode < GAIN_LINEAR_DECREASE) {
        env = data * DIRECT_GAIN_SCALE;
        rate = RATE_EVERY_SAMPLE;
      } else {
        rate = data & GAIN_RATE;
        if (mode === GAIN_LINEAR_DECREASE) env -= ENVELOPE_STEP;
        else if (mode === GAIN_EXPONENTIAL_DECREASE) {
          env--;
          env -= env >> EXPONENTIAL_SHIFT;
        } else {
          env += ENVELOPE_STEP;
          if (mode > GAIN_LINEAR_INCREASE && v.hidden >>> 0 >= BENT_LINE_KNEE)
            env += ENVELOPE_FINE_STEP - ENVELOPE_STEP;
        }
      }
    }
    // ADSR(2) and GAIN share the field position D7-D5 (SL here, mode bits for GAIN).
    if (env >> SUSTAIN_LEVEL_SHIFT === data >> ADSR2_SUSTAIN_LEVEL_SHIFT && v.mode === DECAY)
      v.mode = SUSTAIN;
    v.hidden = env;
    if (env < 0 || env > ENVELOPE_MAX) {
      env = env < 0 ? 0 : ENVELOPE_MAX;
      if (v.mode === ATTACK) v.mode = DECAY;
    }
    if (this.counterFires(rate)) v.env = env;
  }
}
