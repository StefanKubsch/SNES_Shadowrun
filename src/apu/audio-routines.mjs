// The lifted sound driver command 81:F007 (src/apu/apu-command.mjs) and music change
// 81:EF47 (src/apu/music-mode.mjs) as routine table entries for register-level
// callers. Their register-level versions are the references in
// proof/apu-reference/audio-routines.mjs.
//
// Both return with RTL and leave the registers their callers may read: A holds the
// last command in its high byte and the new command token in its low byte. The
// stack byte of the original PHP and the sample loader's direct page state
// (src/apu/music-mode.mjs) are scratch and not produced.
import { sendApuCommand } from './apu-command.mjs';
import { setMusicMode } from './music-mode.mjs';
import { accessorPort } from '../system/hardware-port.mjs';
import { taskStop } from '../task/plan.mjs';
import { APU_COMMAND_TOKEN } from '../task/wram.mjs';
import { APU_COMMAND_VOLUME_TARGET } from '../constants/sound-commands.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';
import { FLAG_INDEX_8BIT, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

// EF47 ends with the volume target command and X = its left/right levels.
const MUSIC_VOLUME_TARGET = 0x7f7f;

// The original sends the parameter with a 16-bit STX and needs the direct page at 0.
function requireApuEntry(ctx) {
  if (ctx.d !== 0 || ctx.e !== 0 || ctx.status & FLAG_INDEX_8BIT)
    taskStop('task_apu_entry_required');
}
const commandResult = (wram, command) => (command << BYTE_BITS) | wram[APU_COMMAND_TOKEN];

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
