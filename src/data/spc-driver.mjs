// SPC700 sound driver (docs/ROM-FREE.md, step 2; docs/SOUND-DRIVER.md): F07F
// sends the 0C55 bytes of ROM 97:8000 through EFA5 and the IPL to ARAM $0200.
// The native driver src/apu/sound-driver.mjs replaces the code but reads its
// tables from ARAM, and src/apu/apu.mjs accepts only this exact program
// (apu_program_unknown), so the bytes stay the original ones. Native form
// assets/vm-spc-driver.json:
// - commands: the 26 targets of the command dispatch, low bytes at $02C8,
//   high bytes at $02E2 (patched into CALL $02C2),
// - echo_registers: the DSP register list at $03B5 for the echo header of
//   $0366, which writes header bytes 2 on to the registers from $03B7 on
//   (EFB, ESA, EDL, FIR C0 to C7, FLG; Book I PDF 168/176/177); $03B5/$03B6
//   name EVOL L/R, whose header bytes go to $22/$23 instead. A zero ends the
//   list,
// - voice_bits: the bit of each voice at $0471,
// - vibrato_sine: 64 signed steps at $0E14 (vibrato $0DBF),
// - code: every other byte as one instruction per line, "address text" in
//   the form of src/data/spc700.mjs. That includes the 16 bytes at $0348, a
//   port poll no path reaches.
// Every byte keeps its address (spc_driver_layout_changed).
import { VmFault } from '../vm/memory.mjs';
import { decodeSpc700, assembleSpc700 } from './spc700.mjs';
import { hex, romWriter } from './rom-bytes.mjs';
import {
  BYTE_MASK,
  BYTE_BITS,
  HEX_RADIX,
  WORD_HEX_DIGITS,
  BYTE_SIGN,
  INT8_MAX,
  INT8_MIN,
} from '../constants/bits.mjs';
import {
  EDL,
  EFB,
  ESA,
  EVOL_L,
  EVOL_R,
  FLG,
  VOICE_COUNT,
  FIR_TAP_COUNT,
  FIR_COEFFICIENT,
  REGISTER_ROW_SHIFT,
} from '../apu/dsp-registers.mjs';
import { DRIVER_START } from '../apu/sound-driver-memory.mjs';

export const SPC_DRIVER_ROM = 0x978000,
  SPC_DRIVER_ARAM = 0x0200,
  SPC_DRIVER_LENGTH = 0x0c55;
const COMMANDS = 26,
  LOW = 0x02c8,
  HIGH = 0x02e2,
  ECHO = 0x03b5,
  ECHO_LENGTH = 15,
  BITS = 0x0471,
  SINE = 0x0e14,
  SINE_LENGTH = 64;
const SPC_DRIVER_CODE = [
  [DRIVER_START, LOW],
  [HIGH + COMMANDS, ECHO],
  [ECHO + ECHO_LENGTH, BITS],
  [BITS + VOICE_COUNT, SINE],
  [SINE + SINE_LENGTH, SPC_DRIVER_ARAM + SPC_DRIVER_LENGTH],
];
// The DSP registers the echo header list may name (src/apu/dsp-registers.mjs).
const DSP = {
  EVOL_L,
  EVOL_R,
  EFB,
  ESA,
  EDL,
  FLG,
  ...Object.fromEntries(
    Array.from({ length: FIR_TAP_COUNT }, (_, k) => [
      `C${k}`,
      (k << REGISTER_ROW_SHIFT) | FIR_COEFFICIENT,
    ]),
  ),
};
const DSP_NAMES = new Map(Object.entries(DSP).map(([name, register]) => [register, name]));

export function readSpcDriver(read8) {
  const bytes = Uint8Array.from({ length: SPC_DRIVER_LENGTH }, (_, k) => read8(SPC_DRIVER_ROM + k)),
    at = (a) => bytes[a - SPC_DRIVER_ARAM];
  const echo = Array.from({ length: ECHO_LENGTH }, (_, k) => at(ECHO + k));
  if (echo.at(-1) !== 0 || echo.slice(0, -1).some((r) => !DSP_NAMES.has(r)))
    throw new VmFault('spc_driver_layout_changed', SPC_DRIVER_ROM + ECHO - SPC_DRIVER_ARAM);
  const code = [];
  for (const [from, to] of SPC_DRIVER_CODE) {
    for (let pc = from; pc < to;) {
      const d = decodeSpc700(bytes, SPC_DRIVER_ARAM, pc);
      if (pc + d.length > to)
        throw new VmFault('spc_driver_layout_changed', SPC_DRIVER_ROM + pc - SPC_DRIVER_ARAM);
      code.push(`${hex(pc, WORD_HEX_DIGITS)} ${d.text}`);
      pc += d.length;
    }
  }
  return {
    commands: Array.from({ length: COMMANDS }, (_, y) =>
      hex(at(LOW + y) | (at(HIGH + y) << BYTE_BITS), WORD_HEX_DIGITS),
    ),
    echo_registers: echo.slice(0, -1).map((r) => DSP_NAMES.get(r)),
    voice_bits: Array.from({ length: VOICE_COUNT }, (_, k) => at(BITS + k)),
    vibrato_sine: Array.from(
      { length: SINE_LENGTH },
      (_, k) => (at(SINE + k) ^ BYTE_SIGN) - BYTE_SIGN,
    ),
    code,
  };
}

// The driver bytes from the native form, in ARAM order.
export function spcDriverBytes(file) {
  const bytes = new Uint8Array(SPC_DRIVER_LENGTH),
    set = new Uint8Array(SPC_DRIVER_LENGTH);
  const fail = (a) => {
    throw new VmFault('spc_driver_layout_changed', SPC_DRIVER_ROM + a - SPC_DRIVER_ARAM);
  };
  const put = (a, v) => {
    if (
      a < SPC_DRIVER_ARAM ||
      a >= SPC_DRIVER_ARAM + SPC_DRIVER_LENGTH ||
      set[a - SPC_DRIVER_ARAM] ||
      !Number.isInteger(v)
    )
      fail(a);
    bytes[a - SPC_DRIVER_ARAM] = v & BYTE_MASK;
    set[a - SPC_DRIVER_ARAM] = 1;
  };
  const { commands, echo_registers: echo, voice_bits: bits, vibrato_sine: sine, code } = file ?? {};
  if (
    commands?.length !== COMMANDS ||
    echo?.length !== ECHO_LENGTH - 1 ||
    bits?.length !== VOICE_COUNT ||
    sine?.length !== SINE_LENGTH ||
    !Array.isArray(code)
  )
    fail(SPC_DRIVER_ARAM);
  commands.forEach((t, y) => {
    if (!/^[0-9A-F]{4}$/.test(t)) fail(LOW + y);
    put(LOW + y, parseInt(t, HEX_RADIX) & BYTE_MASK);
    put(HIGH + y, parseInt(t, HEX_RADIX) >> BYTE_BITS);
  });
  [...echo.map((name) => DSP[name] ?? fail(ECHO)), 0].forEach((r, k) => put(ECHO + k, r));
  bits.forEach((v, k) => put(BITS + k, v >= 0 && v <= BYTE_MASK ? v : NaN));
  sine.forEach((v, k) => put(SINE + k, v >= INT8_MIN && v <= INT8_MAX ? v : NaN));
  for (const line of code) {
    const m = /^([0-9A-F]{4}) (.+)$/.exec(line ?? '');
    if (!m) fail(SPC_DRIVER_ARAM);
    const pc = parseInt(m[1], HEX_RADIX),
      instruction = assembleSpc700(m[2], pc);
    if (!instruction)
      throw new VmFault('spc_driver_line_unknown', SPC_DRIVER_ROM + pc - SPC_DRIVER_ARAM, { line });
    instruction.forEach((v, k) => put(pc + k, v));
  }
  const gap = set.indexOf(0);
  if (gap >= 0) fail(SPC_DRIVER_ARAM + gap);
  return bytes;
}

export function placeSpcDriver(rom, present, file) {
  const put = romWriter(rom, present, 'spc_driver_layout_changed');
  spcDriverBytes(file).forEach((v, k) => {
    put(SPC_DRIVER_ROM + k, v);
  });
}
