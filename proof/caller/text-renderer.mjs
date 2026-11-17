// Compatibility boundary for callers that still supply a register routine table.
// Text producers receive a renderer sequence instead of knowing its dispatch table.
import { drawTextBufferSequence } from '../../src/game/text-draw.mjs';
import { taskStop } from '../../src/system/task-stop.mjs';

const TEXT_BUFFER_ENTRY = 0x80fb39;

export function textBufferRenderer(routines) {
  if (!routines) return drawTextBufferSequence;
  return function* renderBuffer(h, events) {
    const run = routines.get(TEXT_BUFFER_ENTRY);
    if (!run) taskStop('main_loop_frontier', { target: TEXT_BUFFER_ENTRY });
    return yield { target: TEXT_BUFFER_ENTRY, run, h, events, routines };
  };
}
