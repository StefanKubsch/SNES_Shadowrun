import { taskStop } from './task-stop.mjs';
import { waitForFrameWithInterrupts, ObservedWaitContinuation } from './main-wait-interrupt.mjs';
import { NATIVE_CALL_CONTINUATIONS } from './native-call-continuation.mjs';
import { RANDOM_STATE, WRAM, NMITIMEN_SHADOW } from '../data/wram.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';
import { HVBJOY } from '../constants/hardware-registers.mjs';
import { FLAG_MEMORY_8BIT, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';
// One explicitly observed BYTE at the original polling instruction. No inferred NMI or frame.
export function sceneWaitByte(h, events, pc, address) {
  const index = events?.waitIndex ?? 0,
    o = events?.values?.[index];
  if (
    events?.mode !== 'record-observations' ||
    !Array.isArray(events.values) ||
    !Object.isFrozen(events.values) ||
    !o ||
    !Object.isFrozen(o) ||
    o.pc !== pc ||
    o.address !== address ||
    o.width !== 1 ||
    !Number.isInteger(o.value) ||
    o.value < 0 ||
    o.value > BYTE_MASK
  )
    taskStop('task_wait_observation_required', { pc, address, width: 1, observationIndex: index });
  events.waitIndex++;
  events.waitEvents.push(o);
  h.write(address, o.value, 1);
  return h.read(address, 1);
}
// 81:EEBB: wait for the next frame: poll VBlank (NMI disabled) or wait until the NMI changes the random state byte.
export function waitForFrame(h, events) {
  if (events?.interrupts !== undefined) return waitForFrameWithInterrupts(h, events);
  const { ctx } = h;
  h.php();
  h.sep(FLAG_MEMORY_8BIT);
  h.load(h.dp(NMITIMEN_SHADOW));
  if (!(ctx.status & FLAG_NEGATIVE)) {
    do {
      h.load(h.port(HVBJOY, 1, 0x81eec2));
    } while (ctx.status & FLAG_NEGATIVE);
  } else {
    h.load(h.read(WRAM + RANDOM_STATE));
    do {
      const value = sceneWaitByte(h, events, 0x81eecd, WRAM + RANDOM_STATE);
      h.cmp(value);
    } while (ctx.status & FLAG_ZERO);
  }
  h.plp();
  return h.rtl();
}
NATIVE_CALL_CONTINUATIONS.set(0x81eebb, {
  run: waitForFrame,
  create: ({ h, events }) =>
    events?.interrupts === undefined ? null : new ObservedWaitContinuation(h, events, 0x81eebb),
});
