// DSP register map (Nintendo Book I, sound part, table 3-7-1, PDF 168).
// Voice n owns the registers n * $10 + offset; the global registers sit in
// the columns $xC, $xD and $xF.

// Voice register offsets.
export const VOL_L = 0x0,
  VOL_R = 0x1,
  PITCH_L = 0x2,
  PITCH_H = 0x3,
  SRCN = 0x4,
  ADSR1 = 0x5,
  ADSR2 = 0x6,
  GAIN = 0x7,
  ENVX = 0x8,
  OUTX = 0x9;

// Global registers.
export const MVOL_L = 0x0c,
  MVOL_R = 0x1c,
  EVOL_L = 0x2c,
  EVOL_R = 0x3c,
  KON = 0x4c,
  KOF = 0x5c,
  FLG = 0x6c,
  ENDX = 0x7c,
  EFB = 0x0d,
  PMON = 0x2d,
  NON = 0x3d,
  EON = 0x4d,
  DIR = 0x5d,
  ESA = 0x6d,
  EDL = 0x7d;
// FIR coefficient Cn at n * $10 + FIR_COEFFICIENT (PDF 177).
export const FIR_COEFFICIENT = 0x0f;

// FLG bits (7.2.2.4 (5), PDF 175): soft reset, mute, echo writes off and the
// noise clock in bits 0-4.
export const FLG_RESET = 0x80,
  FLG_MUTE = 0x40,
  FLG_ECHO_OFF = 0x20,
  FLG_NOISE_CLOCK = 0x1f;
// All FLG bits: soft reset, mute, echo writes off and the fastest noise clock.
export const FLG_ALL = FLG_RESET | FLG_MUTE | FLG_ECHO_OFF | FLG_NOISE_CLOCK;
// KON/KOF/EON/NON/PMON value with the bits of all eight voices.
export const ALL_VOICES = 0xff;

// Layout of the register map (table 3-7-1, PDF 168): 128 registers $00-$7F,
// row n ($n0-$nF) holds the registers of voice n and the coefficient Cn.
export const DSP_REGISTER_COUNT = 0x80,
  DSP_ADDRESS_MASK = 0x7f,
  VOICE_COUNT = 8,
  REGISTER_ROW_SHIFT = 4,
  REGISTER_COLUMN_MASK = 0x0f,
  FIR_TAP_COUNT = 8;
// PMON: voice 0 has no previous voice and cannot be modulated (7.2.2.2, PDF 174).
export const PMON_VOICES = 0xfe;
// PITCH H holds the upper six bits of the 14-bit pitch (7.2.1.2, PDF 169).
export const PITCH_H_MASK = 0x3f;

// ADSR(1)/ADSR(2) and GAIN (7.2.1.3/4, PDF 170/171). ADSR(1): D7 selects ADSR,
// D6-D4 DR, D3-D0 AR; ADSR(2): D7-D5 SL, D4-D0 SR. GAIN with D7 = 0 is the
// direct value D6-D0; with D7 = 1, D6/D5 select the mode and D4-D0 the rate.
export const ADSR1_ENABLE = 0x80,
  ADSR1_ATTACK_RATE = 0x0f,
  ADSR2_SUSTAIN_LEVEL_SHIFT = 5,
  ADSR2_SUSTAIN_RATE = 0x1f,
  GAIN_MODE_SHIFT = 5,
  GAIN_RATE = 0x1f;
// GAIN >> GAIN_MODE_SHIFT: below 4 direct designation, then the four modes.
export const GAIN_LINEAR_DECREASE = 4,
  GAIN_EXPONENTIAL_DECREASE = 5,
  GAIN_LINEAR_INCREASE = 6,
  GAIN_BENT_LINE_INCREASE = 7;

// EDL: echo delay in D3-D0, 2 KByte (1 << 11 bytes) per step (7.2.2.8, PDF 176).
// ESA and DIR name a page: address = value * $100 (PDF 176).
export const EDL_MASK = 0x0f,
  EDL_BYTES_SHIFT = 11;

// Source directory (table 3-7-5, PDF 178): four bytes per source, start
// address SA, then the loop start address LSA.
export const DIRECTORY_ENTRY_SHIFT = 2,
  DIRECTORY_LOOP_OFFSET = 2;
// BRR block (table 3-7-6, PDF 179): nine bytes, a header byte RF and eight
// data bytes with sixteen 4-bit values. RF: D7-D4 range, D3/D2 filter,
// D1 loop, D0 end.
export const BRR_BLOCK_BYTES = 9,
  BRR_END = 0x01,
  BRR_LOOP = 0x02,
  BRR_FILTER_MASK = 0x0c,
  BRR_FILTER_1 = 0x04,
  BRR_FILTER_2 = 0x08,
  BRR_RANGE_SHIFT = 4;
