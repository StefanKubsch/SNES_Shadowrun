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
  constructor(read, write) {
    this.read = read;
    this.write = write;
  }
}
// The hardware port of a task accessor (src/vm/task-accessor.mjs).
export const accessorPort = (a) =>
  new HardwarePort(
    (address, width, site) => a.busRead(address, width, site, true),
    (address, value, width, site) => a.busWrite(address, value, width, site, true),
  );
