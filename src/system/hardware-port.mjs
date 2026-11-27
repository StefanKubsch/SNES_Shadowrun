// Hardware interface for lifted game code (docs/STRATEGY.md, "Lifted code"): reads
// and writes of the system registers (joypad, counters, APU ports) at bank-0
// addresses. The SNES back end passes each access on to the device model.
//
// site is the address of the original instruction. The device model of the live
// game (src/vm/frame-events.mjs) tells some reads apart by it: the joypad latch,
// the beam counter bytes of the random draw. Another platform ignores it and
// answers by register.
export class HardwarePort {
  // read(address, width, site) and write(address, value, width, site) reach the
  // devices at a bank-0 bus address.
  // video: the register-free picture back end of live play (src/video/picture-video.mjs)
  // or null; videoOf (src/video/picture-video.mjs) hands it to the lifted code.
  constructor(read, write, video = null) {
    this.read = read;
    this.write = write;
    this.video = video;
  }
}
// The hardware port of an accessor (src/vm/device-access.mjs).
export const accessorPort = (a) =>
  new HardwarePort(
    (address, width, site) => a.busRead(address, width, site, true),
    (address, value, width, site) => a.busWrite(address, value, width, site, true),
    a.video ?? null,
  );
