// Observation replay for the natives in tests and Mesen oracles; the game uses
// LiveDevices (src/vm/frame-events.mjs). Values that the original reads from devices
// (PPU counter and product, APU ports) or that an interrupt writes into WRAM during a
// wait (frame counter, joypad word) are not computed by the VM core. They come
// exclusively as observations, one set per native call in call order (test,
// later a Mesen recording or a device model). The arithmetic unit
// $4202–$4217 is part of VmMemory.
//
// Observation set: {target, io, wait, input}, all lists frozen.
// Optional: interrupts [{pc,nmi}], interruptRoutines (explicit proved Map),
// dmaTransfers (including frozen bytes), startupInterrupts for the complete
// observed SPC instructions and title-buffer MVN iterations. No elapsed time is inferred.
//   io     [{pc, address, width, value}]  device reads in read order
//   wait   [{pc, address, width: 1|2, value}] WRAM byte or word at each poll of a wait loop
//   input  [{pc, address, width: 2, value}] joypad word at $809E1A

const EMPTY = Object.freeze([]);

// Plays back given observation sets one after another. Without a matching set
// the native does not run (the call ends like a non-permitted native).
export class ObservedDevices {
  constructor(sets = EMPTY) {
    this.sets = sets;
    this.index = 0;
  }
  // Observations for the next call of target, without consuming them.
  peek(target) {
    const set = this.sets[this.index];
    return set !== undefined && set.target === target ? set : null;
  }
  take(target) {
    const set = this.peek(target);
    if (set !== null) this.index++;
    return set;
  }
  // Without a device model, device writes have no effect in the VM core.
  write() {}
}

export function observationSet(
  target,
  {
    io = EMPTY,
    wait = EMPTY,
    input = EMPTY,
    interrupts,
    interruptRoutines,
    dmaTransfers,
    startupInterrupts,
  } = {},
) {
  const freeze = (list) => Object.freeze(list.map((o) => Object.freeze({ ...o })));
  return Object.freeze({
    target,
    io: freeze(io),
    wait: freeze(wait),
    input: freeze(input),
    ...(interrupts === undefined ? {} : { interrupts: freeze(interrupts), interruptRoutines }),
    ...(startupInterrupts === undefined ? {} : { startupInterrupts }),
    ...(dmaTransfers === undefined
      ? {}
      : {
          dmaTransfers: Object.freeze(
            dmaTransfers.map((o) => Object.freeze({ ...o, bytes: Object.freeze([...o.bytes]) })),
          ),
        }),
  });
}
