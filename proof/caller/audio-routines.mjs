// The lifted music change 81:EF47 as the routine table entry for register-level callers
// (moved from src/apu/audio-routines.mjs; register-level reference in
// proof/apu-reference/audio-routines.mjs).
import { setMusicMode } from '../../src/apu/music-mode.mjs';
import { commandResult, requireApuEntry } from '../../src/apu/audio-routines.mjs';
import { accessorPort } from '../../src/system/hardware-port.mjs';
import { APU_COMMAND_VOLUME_TARGET } from '../../src/constants/sound-commands.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';

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
