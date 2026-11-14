// Hardware environment of the natives. Values that the original reads from devices
// (PPU counter and product, APU ports) or that an interrupt writes into WRAM during a
// wait (frame counter, joypad word) are not computed by the VM core. They come
// exclusively as observation sets, one per native call in call order: from
// LiveDevices in the game (src/vm/frame-events.mjs), from recordings in tests
// (proof/vm/observed-devices.mjs). The arithmetic unit $4202–$4217 is part of
// VmMemory.
//
// Observation set: {target, io, wait, input}, all lists frozen.
// Optional: interrupts [{pc,nmi}], interruptRoutines (explicit proved Map),
// dmaTransfers (including frozen bytes), startupInterrupts for the complete
// observed SPC instructions and title-buffer MVN iterations. No elapsed time is inferred.
//   io     [{pc, address, width, value}]  device reads in read order
//   wait   [{pc, address, width: 1|2, value}] WRAM byte or word at each poll of a wait loop
//   input  [{pc, address, width: 2, value}] joypad word at $809E1A
import { VmFault } from './memory.mjs';
import { WORD_BITS, WORD_MASK } from '../constants/bits.mjs';
import { RDDIVL, RDMPYH, WRDIVB, WRMPYA } from '../constants/hardware-registers.mjs';
import { BANK_WITHOUT_IO, IO_AREA_END, IO_AREA_START } from '../constants/memory-map.mjs';

// Is the address a hardware register (banks without bit 6, $2000–$7FFF)?
export function isIoAddress(address) {
  const bank = address >>> WORD_BITS,
    offset = address & WORD_MASK;
  return !(bank & BANK_WITHOUT_IO) && offset >= IO_AREA_START && offset < IO_AREA_END;
}
// Registers of the arithmetic unit that VmMemory maps itself.
export function isArithmeticRegister(address, write) {
  const offset = address & WORD_MASK;
  return write ? offset >= WRMPYA && offset <= WRDIVB : offset >= RDDIVL && offset <= RDMPYH;
}

const EMPTY = Object.freeze([]);

// Interrupt cursor of an observation set for the proven wait modules, or null
// without interrupt observations. DMA and startup observations need interrupts.
export function interruptEventsOf(set, target) {
  if ((set.dmaTransfers !== undefined || set.startupInterrupts) && set.interrupts === undefined)
    throw new VmFault('interrupt_observations_required', target);
  return set.interrupts === undefined
    ? null
    : {
        interrupts: set.interrupts,
        interruptIndex: 0,
        interruptRoutines: set.interruptRoutines,
        dmaTransfers: set.dmaTransfers,
        dmaIndex: 0,
        startupInterrupts: set.startupInterrupts,
      };
}

// A nested scheduler round may report further interrupts and DMA transfers;
// they extend the cursor of the calling native or main interval.
export function appendRoundInterrupts(events, more, target) {
  if (events.interrupts === undefined) {
    if (more.interrupts?.length || more.dmaTransfers?.length)
      throw new VmFault('interrupt_observations_required', target);
    return;
  }
  if (more.interrupts?.length)
    events.interrupts = Object.freeze([...events.interrupts, ...more.interrupts]);
  if (more.dmaTransfers?.length)
    events.dmaTransfers = Object.freeze([...(events.dmaTransfers ?? []), ...more.dmaTransfers]);
}
