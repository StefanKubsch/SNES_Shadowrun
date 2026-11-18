// The lifted sound driver command 81:F007 (src/apu/apu-command.mjs) and music change
// 81:EF47 (src/apu/music-mode.mjs) as calls, and 81:F007 as the routine table entry
// that the live frontend table still binds for register-level script natives. Their
// register-level versions are the references in proof/apu-reference/audio-routines.mjs;
// the table entry of 81:EF47 is in proof/caller/audio-routines.mjs.
//
// Both return with RTL. The routine table entry leaves the registers its register-level
// callers may read: A holds the last command in its high byte and the new command
// token in its low byte. Lifted callers use the call forms, which take
// the command, its parameter and the mode as parameters and leave no registers (user
// decision 2026-11-17). The stack byte of the original PHP and the sample loader's
// direct page state (src/apu/music-mode.mjs) are scratch and not produced.
import { sendApuCommand } from './apu-command.mjs';
import { setMusicMode } from './music-mode.mjs';
import { accessorPort } from '../system/hardware-port.mjs';
import { taskStop } from '../system/task-stop.mjs';
import { APU_COMMAND_TOKEN } from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';
import { FLAG_INDEX_8BIT } from '../constants/cpu-flags.mjs';

// The original sends the parameter with a 16-bit STX and needs the direct page at 0.
export function requireApuEntry(ctx) {
  if (ctx.d !== 0 || ctx.e !== 0 || ctx.status & FLAG_INDEX_8BIT)
    taskStop('task_apu_entry_required');
}
export const commandResult = (wram, command) => (command << BYTE_BITS) | wram[APU_COMMAND_TOKEN];

// 81:F007 for lifted callers: send the command (its low byte) with the parameter word.
export function sendApuCommandCall(h, command, parameter) {
  requireApuEntry(h.ctx);
  sendApuCommand(h.a.mem.wram, accessorPort(h.a), command & BYTE_MASK, parameter);
  return h.rtl();
}

// 81:EF47 for lifted callers: switch the music to the mode.
export function setMusicModeCall(h, mode) {
  requireApuEntry(h.ctx);
  setMusicMode(h.a.mem, accessorPort(h.a), mode);
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
