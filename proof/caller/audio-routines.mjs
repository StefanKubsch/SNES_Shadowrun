// The lifted sound driver command 81:F007 and music change 81:EF47 as routine table
// entries for register-level callers (moved from src/apu/audio-routines.mjs;
// register-level references in proof/apu-reference/audio-routines.mjs). The command
// entry leaves A the last command in its high byte and the new command token in its low
// byte.
import { setMusicMode } from '../../src/apu/music-mode.mjs';
import { sendApuCommand } from '../../src/apu/apu-command.mjs';
import { commandResult, requireApuEntry } from '../../src/apu/audio-routines.mjs';
import { accessorPort } from '../../src/system/hardware-port.mjs';
import { APU_COMMAND_VOLUME_TARGET } from '../../src/constants/sound-commands.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';
import { BYTE_MASK } from '../../src/constants/bits.mjs';

// EF47 ends with the volume target command and X = its left/right levels.
const MUSIC_VOLUME_TARGET = 0x7f7f;

// 81:EF47: switch the music to the mode in A (16-bit registers). X is left at the
// volume target levels; N and Z are clear (from that LDX); Y is not produced.
export function setMusicModeRoutine(h) {
  const { ctx } = h,
    { mem } = h.a;
  requireApuEntry(ctx);
  setMusicMode(mem, accessorPort(h.a), ctx.a);
  ctx.a = commandResult(mem.wram, APU_COMMAND_VOLUME_TARGET);
  ctx.x = MUSIC_VOLUME_TARGET;
  ctx.status &= ~(FLAG_NEGATIVE | FLAG_ZERO);
  return h.rtl();
}

// 81:F007: send the command in the low byte of A with the parameter word in X. The
// status flags are unchanged (PHP/PLP).
export function sendApuCommandRoutine(h) {
  const { ctx } = h,
    { wram } = h.a.mem;
  requireApuEntry(ctx);
  const command = ctx.a & BYTE_MASK;
  sendApuCommand(wram, accessorPort(h.a), command, ctx.x);
  ctx.a = commandResult(wram, command);
  return h.rtl();
}
