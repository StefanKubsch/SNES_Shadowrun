// The lifted sound driver command 81:F007 (src/apu/apu-command.mjs) and music change
// 81:EF47 (src/apu/music-mode.mjs) as calls for lifted callers. Their register-level
// versions are the references in proof/apu-reference/audio-routines.mjs; the routine
// table entries of both are in proof/caller/audio-routines.mjs.
//
// Both return with RTL. Lifted callers use the call forms, which take
// the command, its parameter and the mode as parameters and leave no registers (user
// decision 2026-11-17); they read no register state either (the original's entry check
// for a 16-bit X and direct page 0 belongs to the register-level entries). The stack
// byte of the original PHP and the sample loader's direct page state
// (src/apu/music-mode.mjs) are scratch and not produced.
import { sendApuCommand } from './apu-command.mjs';
import { setMusicMode } from './music-mode.mjs';
import { accessorPort } from '../system/hardware-port.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';

// 81:F007 for lifted callers: send the command (its low byte) with the parameter word.
export function sendApuCommandCall(h, command, parameter) {
  sendApuCommand(h.a.mem.wram, accessorPort(h.a), command & BYTE_MASK, parameter);
  return h.rtl();
}

// 81:EF47 for lifted callers: switch the music to the mode.
export function setMusicModeCall(h, mode) {
  setMusicMode(h.a.mem, accessorPort(h.a), mode);
  return h.rtl();
}
