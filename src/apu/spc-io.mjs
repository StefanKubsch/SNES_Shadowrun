// Input/output registers $F0-$FF of the sound processor (Nintendo Book I, sound part):
//   Table 3-3-1 (PDF 160)     register map
//   3.2 (PDF 161)             ports: the CPU writes port n r at 2140+n and the
//                             sound processor reads it at $F4+n; port n w the other way round.
//   Chapter 4 (PDF 162/163)   control register $F1: PC32/PC10 clear the input
//                             ports, ST2..ST0 start/stop the timers.
//   Chapter 5 (PDF 164-166)   timers: 8 kHz clock for T0/T1, 64 kHz for T2; an
//                             8-bit counter runs up to the timer register (0 = 256,
//                             maximum 32 ms), then a pulse to the 4-bit counter
//                             CN. Only the change ST 0 -> 1 clears both counters.
//                             Reading CN returns the value and clears it.
//   Chapter 6 (PDF 167)       DSP interface: address $F2, data $F3.
// The table does not name bit 7 of $F1 (IPL ROM visible); it is only recorded.
// Reads of the pure write registers and accesses to $F0/$F8/$F9 are limits.
import { VmFault } from '../vm/memory.mjs';
import { BYTE_MASK, BYTE_BITS, WORD_BITS } from '../constants/bits.mjs';
import { DSP_ADDRESS_MASK, DSP_REGISTER_COUNT } from './dsp-registers.mjs';

// Sound processor memory: 64 KiB ARAM; the page-0 addresses $F0-$FF are the
// I/O registers (table 3-3-1, PDF 160), selected by IO_PAGE_MASK = IO_BASE.
export const ARAM_SIZE = 0x10000,
  IO_BASE = 0xf0,
  IO_PAGE_MASK = 0xfff0,
  PORT_COUNT = 4,
  TIMER_COUNT = 3;
// Control register $F1 (chapter 4, PDF 162): ST0-ST2 in D0-D2, PC10 (D4)
// clears the input ports 0/1, PC32 (D5) the input ports 2/3.
export const CONTROL_TIMER0 = 0x01,
  CONTROL_TIMER1 = 0x02,
  CONTROL_CLEAR_PORTS_01 = 0x10,
  CONTROL_CLEAR_PORTS_23 = 0x20;
// Timers (chapter 5, PDF 164): T2 runs at 64 kHz, eight steps per 8 kHz clock;
// the counters CN are four bits wide.
const TIMER2_STEPS_PER_CLOCK = 8;
export const COUNTER_MASK = 0x0f;

export const CONTROL = 0xf1,
  DSP_ADDRESS = 0xf2,
  DSP_DATA = 0xf3,
  PORT0 = 0xf4,
  PORT1 = 0xf5,
  PORT2 = 0xf6,
  PORT3 = 0xf7,
  TIMER0 = 0xfa,
  TIMER1 = 0xfb,
  TIMER2 = 0xfc,
  COUNTER0 = 0xfd,
  COUNTER1 = 0xfe,
  COUNTER2 = 0xff;

export class SpcIo {
  constructor(dsp) {
    this.dsp = dsp;
    this.cpuIn = new Uint8Array(PORT_COUNT); // Port n r
    this.spcOut = new Uint8Array(PORT_COUNT); // Port n w
    this.control = 0; // after reset "--00-000" (PDF 162)
    this.dspAddress = 0;
    this.targets = new Uint8Array(TIMER_COUNT);
    this.stages = new Uint8Array(TIMER_COUNT);
    this.counters = new Uint8Array(TIMER_COUNT);
    this.pulses = 0; // pulses to the 4-bit counters since the start (for the clock)
    this.portWrites = 0; // writes of the sound processor to $F4
    this.counterTicks = 0; // counter values read that were not zero
    this.writeLog = null; // optional []: (address << 16 | DSP address << 8 | value)
  }
  read(address, pc) {
    switch (address) {
      case DSP_DATA:
        return this.dsp.read(this.dspAddress & DSP_ADDRESS_MASK);
      case PORT0:
      case PORT1:
      case PORT2:
      case PORT3:
        return this.cpuIn[address - PORT0];
      case COUNTER0:
      case COUNTER1:
      case COUNTER2: {
        const n = address - COUNTER0,
          value = this.counters[n];
        this.counters[n] = 0;
        if (value) this.counterTicks++;
        return value;
      }
      case DSP_ADDRESS:
        return this.dspAddress;
    }
    throw new VmFault('spc_io_read_unsupported', address, { pc });
  }
  write(address, value, pc) {
    this.writeLog?.push(
      (address << WORD_BITS) | (address === DSP_DATA ? this.dspAddress << BYTE_BITS : 0) | value,
    );
    switch (address) {
      case CONTROL: {
        for (let n = 0; n < TIMER_COUNT; n++)
          if ((value >> n) & 1 && !((this.control >> n) & 1)) {
            this.stages[n] = 0;
            this.counters[n] = 0;
          }
        if (value & CONTROL_CLEAR_PORTS_01) this.cpuIn.fill(0, 0, 2);
        if (value & CONTROL_CLEAR_PORTS_23) this.cpuIn.fill(0, 2, PORT_COUNT);
        this.control = value;
        return;
      }
      case DSP_ADDRESS:
        this.dspAddress = value;
        return;
      case DSP_DATA:
        // The register map (PDF 168) ends at $7F; a write above it is a limit.
        if (this.dspAddress & DSP_REGISTER_COUNT)
          throw new VmFault('spc_dsp_address_unsupported', address, { pc, dsp: this.dspAddress });
        this.dsp.write(this.dspAddress, value);
        return;
      case PORT0:
        this.portWrites++; // fallthrough
      case PORT1:
      case PORT2:
      case PORT3:
        this.spcOut[address - PORT0] = value;
        return;
      case TIMER0:
      case TIMER1:
      case TIMER2:
        this.targets[address - TIMER0] = value;
        return;
    }
    throw new VmFault('spc_io_write_unsupported', address, { pc, value });
  }
  // One clock of the 8 kHz prescaler: T0 and T1 one step each, T2 eight (64 kHz).
  // Returns true if a 4-bit counter received a pulse.
  clock8k() {
    const before = this.pulses;
    this.step(0);
    this.step(1);
    for (let n = 0; n < TIMER2_STEPS_PER_CLOCK; n++) this.step(2);
    return this.pulses !== before;
  }
  step(n) {
    if (!((this.control >> n) & 1)) return;
    const stage = (this.stages[n] + 1) & BYTE_MASK;
    if (stage === this.targets[n]) {
      this.stages[n] = 0;
      this.counters[n] = (this.counters[n] + 1) & COUNTER_MASK;
      this.pulses++;
    } else this.stages[n] = stage;
  }
  // CPU side (2140-2143).
  cpuWrite(port, value) {
    this.cpuIn[port] = value;
  }
  cpuRead(port) {
    return this.spcOut[port];
  }
}
