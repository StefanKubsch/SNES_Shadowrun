// Audio unit: ARAM, I/O ($F0-$FF), DSP model and the program of the
// sound processor (IPL transfer, then the native driver).
//
// Clock contract (lag-free model, docs/SOUND-DRIVER.md): the time of the unit
// is the DSP Ts (32 kHz, Book I PDF 173); every fourth Ts the 8 kHz prescaler
// clocks the timers (PDF 164). One lag-free frame (50 Hz) is 640 Ts.
// The sound processor is infinitely fast relative to these clocks: after each
// event (CPU port write, timer pulse, and with a deferred key-on every KON/KOF
// latch of the DSP) the program runs to the next wait point.
// CPU instructions therefore take effect at the next poll without driver time passing.
// The DSP latches KON/KOF only every second Ts (Book I PDF 174: consecutive
// KON/KOF at least 2 Ts apart). In the original, two writes to the same one of
// the two registers were always separated by at least two latches (Mesen,
// tools/sound-apu.test.mjs). In the infinitely fast model a new KON/KOF value
// therefore waits until the DSP has latched the previous one, and no value
// overtakes an earlier written value of the other register: at the end of a
// note the sequencer writes several KOF in a row, then KOF=0 and KON; an
// early KON would be switched off again by the later KOF.
// Echo: the DSP latches EDL only when its echo offset is 0 (at the latest after
// one old buffer length). The driver changes the echo by switching it off
// (FLG D5 = 1), writing EDL = 0, clearing the area and then setting ESA, EDL and
// FLG again; in the original the clearing takes longer than the old buffer. In
// the original the DSP therefore never wrote with an echo length other than the
// last one written (Mesen, tools/sound-apu.test.mjs). In the infinitely fast model
// an FLG value that enables echo writing waits until the DSP has latched this
// length; following FLG, ESA and EDL values wait with it in order.
//
// Sound output: enableOutput() collects the L/R pairs of the DSP (Int16, 32 kHz);
// takeOutput() returns the pairs produced since the last call.
//
// IPL (Book I appendix D, PDF 237-239): ready AA/BB on port 0/1, start
// with CC on port 0 and the target address in port 2/3, bytes with a counter in
// port 0 (echo), a new block or program start with a counter jump of 2..127
// and port 1 != 0 or = 0. The program flow of the IPL ROM (clearing
// $01-$EF, pointer in $00/$01, sign test of the counter distance) is proven by
// the Mesen comparison of the boot transfer (tools/sound-apu.test.mjs).
import { VmFault } from '../vm/memory.mjs';
import { Dsp } from './dsp.mjs';
import {
  KON,
  KOF,
  FLG,
  ESA,
  EDL,
  FLG_ECHO_OFF,
  EDL_MASK,
  EDL_BYTES_SHIFT,
} from './dsp-registers.mjs';
import {
  SpcIo,
  PORT0,
  PORT1,
  PORT2,
  PORT3,
  PORT_COUNT,
  ARAM_SIZE,
  IO_BASE,
  IO_PAGE_MASK,
} from './spc-io.mjs';
import { SoundDriver, WAIT_PORT, IDLE, IPL } from './sound-driver.mjs';
import { KEY_ON_PENDING, DRIVER_START } from './sound-driver-memory.mjs';
import { fnv1a } from '../data/fnv.mjs';
import { WORD_MASK, BYTE_MASK, BYTE_BITS, BYTE_SIGN } from '../constants/bits.mjs';

export { fnv1a };
export const SAMPLES_PER_FRAME = 640;
// The 8 kHz timer prescaler clocks once every four Ts (PDF 164).
const SAMPLES_PER_TIMER_CLOCK = 4;
const DEFAULT_OUTPUT_FRAMES = 16;
// IPL handshake (appendix D, PDF 237): ready values on port 0/1, start value
// from the CPU on port 0; the IPL ROM keeps its target pointer in $00/$01.
const IPL_READY_PORT0 = 0xaa,
  IPL_READY_PORT1 = 0xbb,
  IPL_START = 0xcc,
  IPL_POINTER = 0x00;
// FNV-1a of the 0C55 driver bytes from 97:8000 (tools/sound-driver.test.mjs).
export const DRIVER_LENGTH = 0x0c55,
  DRIVER_FNV = 0xee980dad;

// DSP coupling of the infinitely fast driver: KON ($4C) and KOF ($5C) one
// value per latch each, further ones wait in a shared write order; echo registers (FLG $6C,
// ESA $6D, EDL $7D) from an enabling FLG until the echo length is latched.
const ECHO_REGISTER = new Set([FLG, ESA, EDL]);
export class CoupledDsp extends Dsp {
  constructor(ram) {
    super(ram);
    this.keyQueue = [];
    this.fresh = [false, false];
    this.echoQueue = [];
  }
  write(address, value) {
    const k = address === KON ? 0 : address === KOF ? 1 : -1;
    if (k >= 0) {
      if (this.keyQueue.length || this.fresh[k]) {
        this.keyQueue.push(address, value);
        return;
      }
      this.fresh[k] = true;
    }
    if (
      ECHO_REGISTER.has(address) &&
      (this.echoQueue.length || (address === FLG && !(value & FLG_ECHO_OFF) && this.echoStale()))
    ) {
      this.echoQueue.push(address, value);
      return;
    }
    super.write(address, value);
  }
  echoStale() {
    return this.echoLength !== (this.regs[EDL] & EDL_MASK) << EDL_BYTES_SHIFT;
  }
  sample() {
    super.sample();
    const q = this.echoQueue;
    while (q.length && !(q[0] === FLG && !(q[1] & FLG_ECHO_OFF) && this.echoStale()))
      super.write(q.shift(), q.shift());
  }
  latched() {
    const q = this.keyQueue;
    this.fresh[0] = false;
    this.fresh[1] = false;
    while (q.length) {
      const k = q[0] === KON ? 0 : 1;
      if (this.fresh[k]) break;
      super.write(q.shift(), q.shift());
      this.fresh[k] = true;
    }
  }
}

export class Apu {
  // dsp/io/driver: replaceable for oracle comparisons (exact DSP with original timing,
  // observation device, reference interpreter).
  constructor({
    ram = new Uint8Array(ARAM_SIZE),
    dsp = (ram) => new CoupledDsp(ram),
    io = (dsp) => new SpcIo(dsp),
    driver = (ram, io) => new SoundDriver(ram, io).run(),
  } = {}) {
    this.ram = ram;
    this.dsp = dsp(ram);
    this.io = io(this.dsp);
    this.makeDriver = driver;
    this.phase = 0;
    this.state = 'ipl';
    this.waiting = 0;
    this.task = this.ipl();
    this.resume();
  }
  // IPL transfer up to the program start; returns the start address.
  // The third argument of each port access is its IPL ROM instruction address.
  *ipl() {
    const r = this.ram,
      io = this.io,
      low = IPL_POINTER,
      high = IPL_POINTER + 1;
    for (let x = IO_BASE - 1; x; x--) r[x] = 0;
    io.write(PORT0, IPL_READY_PORT0, 0xffc9);
    io.write(PORT1, IPL_READY_PORT1, 0xffcc);
    while (io.read(PORT0, 0xffcf) !== IPL_START) yield WAIT_PORT;
    for (;;) {
      r[low] = io.read(PORT2, 0xffef);
      r[high] = io.read(PORT3, 0xffef);
      const a = io.read(PORT0, 0xfff3),
        x = io.read(PORT1, 0xfff3);
      io.write(PORT0, a, 0xfff5);
      if (!x) return r[low] | (r[high] << BYTE_BITS);
      while (io.read(PORT0, 0xffd6) !== 0) yield WAIT_PORT;
      let y = 0;
      for (;;) {
        const p = io.read(PORT0, 0xffda);
        if (p === y) {
          const v = io.read(PORT1, 0xffde);
          io.write(PORT0, y, 0xffe0);
          const address = ((r[low] | (r[high] << BYTE_BITS)) + y) & WORD_MASK;
          if ((address & IO_PAGE_MASK) === IO_BASE) io.write(address, v, 0xffe2);
          else r[address] = v;
          y = (y + 1) & BYTE_MASK;
          if (y) continue;
          r[high] = (r[high] + 1) & BYTE_MASK;
          if (!(r[high] & BYTE_SIGN)) continue;
        } else if (!((y - p) & BYTE_SIGN)) {
          yield WAIT_PORT;
          continue;
        }
        if (!((y - io.read(PORT0, 0xffeb)) & BYTE_SIGN)) continue;
        break;
      }
    }
  }
  resume() {
    for (;;) {
      const { value, done } = this.task.next();
      if (!done) {
        this.waiting = value;
        return;
      }
      if (this.state === 'ipl') {
        // Only the original program has a native port.
        if (
          value !== DRIVER_START ||
          fnv1a(this.ram.subarray(DRIVER_START, DRIVER_START + DRIVER_LENGTH)) !== DRIVER_FNV
        )
          throw new VmFault('apu_program_unknown', value);
        this.state = 'driver';
        this.task = this.makeDriver(this.ram, this.io);
      } else if (value === IPL) {
        this.state = 'ipl';
        this.task = this.ipl();
      } else throw new VmFault('apu_program_ended');
    }
  }
  // CPU side: write all bytes of a command, then one poll.
  cpuWrite(port, value, width = 1) {
    for (let n = 0; n < width; n++)
      this.io.cpuWrite((port + n) % PORT_COUNT, (value >> (BYTE_BITS * n)) & BYTE_MASK);
    this.resume();
  }
  cpuRead(port) {
    return this.io.cpuRead(port % PORT_COUNT);
  }
  // Driver time in Ts.
  advance(samples) {
    for (let n = 0; n < samples; n++) {
      const latches = this.dsp.latches;
      this.dsp.sample();
      const latched = this.dsp.latches !== latches;
      if (latched) this.dsp.latched?.();
      let pulse = false;
      if (++this.phase === SAMPLES_PER_TIMER_CLOCK) {
        this.phase = 0;
        pulse = this.io.clock8k();
      }
      if (
        this.waiting === IDLE &&
        (pulse || (latched && this.state === 'driver' && this.ram[KEY_ON_PENDING]))
      )
        this.resume();
    }
  }
  frame() {
    this.advance(SAMPLES_PER_FRAME);
  }
  enableOutput(frames = DEFAULT_OUTPUT_FRAMES) {
    this.dsp.out = new Int16Array(frames * SAMPLES_PER_FRAME * 2);
    this.dsp.outCount = 0;
  }
  takeOutput() {
    const d = this.dsp,
      samples = d.out.slice(0, d.outCount);
    d.outCount = 0;
    return samples;
  }
}
