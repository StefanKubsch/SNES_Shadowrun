// Device access for ordinary game services and the compatibility CPU accessor.
// Observation ordering, live fallback and arithmetic semantics share one boundary.
import { VmFault } from './memory.mjs';
import { isIoAddress, isArithmeticRegister } from './devices.mjs';
import { BYTE_MASK, WORD_MASK, LONG_WRAP } from '../constants/bits.mjs';

export class DeviceAccess {
  // The register-free picture back end of live play (src/video/picture-video.mjs), when
  // the devices draw through one; null for the SNES back end and recorded devices.
  get video() {
    return this.devices?.bus?.video ?? null;
  }
  constructor(vm) {
    this.vm = vm;
    const mem = (this.mem = vm.mem);
    this.devices = null;
    this.io = null;
    this.ioIndex = 0;
    this.trace = null;
    this.observeArithmetic = false;
    this.readWord = (address) => mem.read16(address);
    this.writeWord = (address, value) => mem.write16(address, value);
    // A read at a full bus address, independent of the data bank: the hardware
    // interface of lifted code (src/system/hardware-port.mjs) reads here with
    // anyBank set. Every bank with a system area reaches the same register
    // (Book I 21.2, src/constants/memory-map.mjs), so its reads (00:2140) match a
    // recording of the original's (80:2140) by register; register-level reads keep
    // the recorded address, which also attests their data bank.
    this.busRead = (address, width, pc = 0, anyBank = false) => {
      if (!isIoAddress(address))
        return width === 1 ? mem.read8(address) : this.readWord(address, LONG_WRAP);
      let value;
      if (isArithmeticRegister(address, false) && !this.observeArithmetic)
        value = width === 1 ? mem.read8(address) : mem.read16(address);
      else {
        const observation = this.io === null ? undefined : this.io[this.ioIndex];
        // Live devices (src/vm/frame-events.mjs) answer only after all recorded reads.
        if (observation === undefined && this.io !== null && this.devices?.read !== undefined)
          value = this.devices.read(address, width, pc);
        else if (
          observation !== undefined &&
          observation.pc === pc &&
          (observation.address === address ||
            (anyBank &&
              isIoAddress(observation.address) &&
              (observation.address & WORD_MASK) === (address & WORD_MASK))) &&
          observation.width === width
        ) {
          this.ioIndex++;
          value = observation.value;
        }
        if (value === undefined)
          throw new VmFault('device_observation_required', address, {
            pc,
            width,
            observationIndex: this.ioIndex,
          });
      }
      if (this.trace !== null) this.trace.push({ kind: 'read', pc, address, width, value });
      return value;
    };
    // A write at a full bus address, independent of the data bank: the video
    // and sound interfaces (src/video/video-port.mjs) reach the devices here.
    // anyBank marks the hardware port of lifted code, as for busRead.
    // eslint-disable-next-line no-unused-vars
    this.busWrite = (address, value, width, pc = 0, anyBank = false) => {
      if (!isIoAddress(address)) {
        if (width === 1) mem.write8(address, value & BYTE_MASK);
        else this.writeWord(address, value, LONG_WRAP);
        return;
      }
      if (this.trace !== null) this.trace.push({ kind: 'write', pc, address, width, value });
      if (isArithmeticRegister(address, true)) {
        if (width === 1) mem.write8(address, value & BYTE_MASK);
        else mem.write16(address, value);
        return;
      }
      if (this.devices === null) throw new VmFault('device_write_unbound', address, { pc, width });
      this.devices.write(pc, address, value, width);
    };
  }
}
