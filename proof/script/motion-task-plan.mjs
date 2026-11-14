import { isWord } from './runtime.mjs';
import { isTaskFrameAllocator } from './task-frames.mjs';

const views = new WeakSet();
export const isMotionTaskSource = (source) => isTaskFrameAllocator(source) || views.has(source);

// Dedicated read view for C9E0/AC2F event planning. No allocator, heap copy,
// list mutation, wait check or scheduler API is exposed by this view.
export function createMotionTaskPlan(allocator) {
  if (!isTaskFrameAllocator(allocator)) throw Error('Invalid motion task plan source');
  const events = new Map();
  const source = Object.freeze({
    readMotionTaskWord(offset, field) {
      const result = allocator.readMotionTaskWord(offset, field);
      return result.available && field === 'eventWord' && events.has(offset)
        ? { available: true, value: events.get(offset) }
        : result;
    },
  });
  views.add(source);
  return {
    source,
    stageEvent({ offset, value }) {
      if (!isWord(value)) throw Error('Invalid motion task event plan');
      const result = source.readMotionTaskWord(offset, 'eventWord');
      if (!result.available) throw Error('Uncovered motion task event plan');
      events.set(offset, value);
    },
  };
}
