// Extends the observation cursor of a register-level native or main interval with
// the interrupts and DMA transfers of a nested scheduler round (proof/vm/main-driver.mjs,
// proof/vm/native-call.mjs). The live game delivers interrupts from lag-free frames.
import { VmFault } from '../../src/vm/memory.mjs';

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
