// The runtime of a lifted scene (docs/MATRIX-LIFT.md): its memory and the video,
// hardware, sound and random interfaces, built on the native call accessor h of
// the running scene or NMI callback.
import { VideoPort } from '../video/video-port.mjs';
import { accessorPort } from './hardware-port.mjs';
import { randomBelow } from './random.mjs';
import { sendApuCommand } from '../apu/apu-command.mjs';
import { taskStop } from '../task/plan.mjs';
import { FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';

export function sceneRuntime(h) {
  const a = h.a,
    mem = a.mem,
    port = accessorPort(a);
  return {
    h,
    mem,
    wram: mem.wram,
    video: new VideoPort((address, value, width) => a.busWrite(address, value, width)),
    port,
    // Sound command (APU_COMMAND_* in src/constants/sound-commands.mjs) with its word.
    sound: (command, parameter) => sendApuCommand(mem.wram, port, command, parameter),
    // A random number from 0 to range - 1.
    random: (range) => randomBelow(mem, port, range),
  };
}
// The entry of a lifted scene from register-level code: 16-bit registers.
export function requireWideRegisters(ctx, reason) {
  if (ctx.status & (FLAG_MEMORY_8BIT | FLAG_INDEX_8BIT)) taskStop(reason);
}
