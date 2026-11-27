// The lifted sound driver command 81:F007 and music change 81:EF47 as routine table
// entries for register-level callers (moved from src/apu/audio-routines.mjs;
// register-level references in proof/apu-reference/audio-routines.mjs). The command
// entry leaves A the last command in its high byte and the new command token in its low
// byte.
import { setMusicMode } from '../../src/apu/music-mode.mjs';
import { sendApuCommand } from '../../src/apu/apu-command.mjs';
import { accessorPort } from '../../src/system/hardware-port.mjs';
import { taskStop } from '../../src/system/task-stop.mjs';
import { APU_COMMAND_TOKEN } from '../../src/data/wram.mjs';
import { APU_COMMAND_VOLUME_TARGET } from '../../src/constants/sound-commands.mjs';
import { FLAG_INDEX_8BIT, FLAG_NEGATIVE, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';
import { BYTE_BITS, BYTE_MASK } from '../../src/constants/bits.mjs';

// The original sends the parameter with a 16-bit STX and needs the direct page at 0
// (moved from src/apu/audio-routines.mjs, whose lifted calls read no registers).
export function requireApuEntry(ctx) {
  if (ctx.d !== 0 || ctx.e !== 0 || ctx.status & FLAG_INDEX_8BIT)
    taskStop('task_apu_entry_required');
}
// A after a command: the command in its high byte, the new command token in its low byte.
export const commandResult = (wram, command) => (command << BYTE_BITS) | wram[APU_COMMAND_TOKEN];

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
