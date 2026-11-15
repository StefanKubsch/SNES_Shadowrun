// Runtime-only channels shared by an observed Native and its callees. The old
// wait/input lists and their local counters retain their separate contracts.
// Forward the live cursors as well as the arrays: copying an index would replay
// interrupts or DMA transfers after returning from a nested Native adapter.
const channels = [
  'interrupts',
  'interruptIndex',
  'interruptRoutines',
  'dmaTransfers',
  'dmaIndex',
  'startupInterrupts',
];
export function withInterruptEvents(events, options) {
  const shared = options?.interruptEvents;
  if (shared?.interrupts === undefined) return events;
  for (const key of channels)
    Object.defineProperty(events, key, {
      enumerable: true,
      get: () => shared[key],
      set: (value) => {
        shared[key] = value;
      },
    });
  return events;
}
