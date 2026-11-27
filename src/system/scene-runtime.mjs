// The runtime of a lifted scene (docs/MATRIX-LIFT.md): its memory and the video,
// hardware, sound and random interfaces, built on the native call accessor h of
// the running scene or NMI callback.
import { accessorPort } from './hardware-port.mjs';
import { randomBelow } from './random.mjs';
import { sendApuCommand } from '../apu/apu-command.mjs';

export function sceneRuntime(h) {
  const a = h.a,
    mem = a.mem,
    port = accessorPort(a);
  return {
    h,
    mem,
    wram: mem.wram,
    // The picture back end of the devices (src/video/picture-video.mjs), or null.
    video: a.video,
    port,
    // Sound command (APU_COMMAND_* in src/constants/sound-commands.mjs) with its word.
    sound: (command, parameter) => sendApuCommand(mem.wram, port, command, parameter),
    // A random number from 0 to range - 1.
    random: (range) => randomBelow(mem, port, range),
  };
}
