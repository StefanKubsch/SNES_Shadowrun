import { taskStop } from './task-stop.mjs';

export function finishTextDmaObservations(events) {
  if (events.dmaTransfers === undefined) return;
  if (!Array.isArray(events.dmaTransfers) || !Object.isFrozen(events.dmaTransfers))
    taskStop('text_dma_observation_required', { observationIndex: events.dmaIndex ?? 0 });
  if ((events.dmaIndex ?? 0) !== events.dmaTransfers.length)
    taskStop('text_dma_observation_unused', { observationIndex: events.dmaIndex ?? 0 });
}
