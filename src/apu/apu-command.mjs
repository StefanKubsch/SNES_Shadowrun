// A command to the sound driver (lifted from 81:F007, register-level version in
// src/task/native-input-apu.mjs). The driver echoes the last token on port 0;
// the CPU waits for that echo, then sends the parameter word on ports 2 and 3,
// the command on port 1 and the next token on port 0. Commands are APU_COMMAND_*
// in src/constants/sound-commands.mjs.
import { APU_COMMAND_TOKEN } from '../task/wram.mjs';
import { APUIO0, APUIO1, APUIO2 } from '../constants/hardware-registers.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';

// Original instructions, the sites of the device model.
const ECHO_SITE = 0x81f00e,
  PARAMETER_SITE = 0x81f013,
  COMMAND_SITE = 0x81f018,
  TOKEN_SITE = 0x81f01c;

export function sendApuCommand(wram, port, command, parameter) {
  const token = wram[APU_COMMAND_TOKEN];
  while (port.read(APUIO0, 1, ECHO_SITE) !== token);
  const next = (token + 1) & BYTE_MASK;
  port.write(APUIO2, parameter, 2, PARAMETER_SITE);
  port.write(APUIO1, command & BYTE_MASK, 1, COMMAND_SITE);
  port.write(APUIO0, next, 1, TOKEN_SITE);
  wram[APU_COMMAND_TOKEN] = next;
}
