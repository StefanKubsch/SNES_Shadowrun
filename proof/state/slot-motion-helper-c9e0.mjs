import { BYTE_MASK, BYTE_SIGN, WORD_MASK, WORD_SIGN } from '../../src/constants/bits.mjs';
import { CODE_BANK } from '../../src/constants/memory-map.mjs';
import { OBJECT_LAST_SLOT, OBJECT_BLOCKED } from '../../src/task/wram.mjs';
import { isWord } from '../script/runtime.mjs';
import { isMotionTaskSource } from '../script/motion-task-plan.mjs';
import { isSlotActionData } from './slot-action-data.mjs';
import { isSlotMotionDirectionData } from './slot-motion-direction-data.mjs';
import { prepareSlotAction6A } from './slot-action-6a.mjs';

// Same target-distance and signed-axis direction contracts as main-motion-target.mjs.
const ARRIVAL_DISTANCE = 0x10;
const AXIS_SWITCH_DISTANCE = 12;
const BLOCKED_DELAY = 0x1e;
const MOTION_END_EVENT = 4;
const MODE_DIRECTION_SCALE = 4;
const DIRECTION_X_PLUS_Y_PLUS = 1;
const DIRECTION_X_PLUS_Y_MINUS = 3;
const DIRECTION_Y_MINUS = 4;
const DIRECTION_X_MINUS_Y_MINUS = 5;
const DIRECTION_X_MINUS = 6;
const DIRECTION_X_MINUS_Y_PLUS = 7;

const slotOffset = (value) => isWord(value) && value <= OBJECT_LAST_SLOT && !(value & 1);
const missing = (field) => ({ handled: false, reason: 'slot_motion_source_required', field });
const unavailable = ({ available, ...boundary }) => ({ handled: false, ...boundary });

// Pure C9E0 data plan; no live writes, CPU execution or implicit frame timing.
export function prepareMotionHelperC9E0({
  offset,
  fields,
  definitionWord = null,
  lowByte = null,
  actionData = null,
  directionData = null,
  directionBank = null,
  readTargetSlot = null,
  frameAllocator = null,
}) {
  if (
    !isWord(offset) ||
    !fields ||
    typeof fields !== 'object' ||
    Array.isArray(fields) ||
    (definitionWord !== null && !isWord(definitionWord)) ||
    (lowByte !== null && (!Number.isInteger(lowByte) || lowByte < 0 || lowByte > BYTE_MASK)) ||
    (actionData !== null && !isSlotActionData(actionData)) ||
    (directionData !== null && !isSlotMotionDirectionData(directionData)) ||
    (directionBank !== null &&
      (!Number.isInteger(directionBank) || directionBank < 0 || directionBank > BYTE_MASK)) ||
    (readTargetSlot !== null && typeof readTargetSlot !== 'function') ||
    (frameAllocator !== null && !isMotionTaskSource(frameAllocator))
  )
    throw Error('Invalid C9E0 context');
  if (!slotOffset(offset)) return { handled: false, reason: 'slot_window_required' };
  for (const key of [
    '7E:40E0',
    '7E:4138',
    '7E:4190',
    '7E:41E8',
    '1458',
    '0E28',
    '0E80',
    '1350',
    '1198',
    '10E8',
    '1038',
    '1090',
  ]) {
    if (fields[key] != null && !isWord(fields[key])) throw Error('Invalid C9E0 fields');
  }
  if (fields['7E:4138'] == null) return missing('7E:4138'); // Dispatch precedes timer read.
  if (fields['7E:40E0'] == null) return missing('7E:40E0');
  const modeWord = fields['7E:4138'],
    timer = (fields['7E:40E0'] - 1) & WORD_MASK;
  const writes = { '7E:40E0': timer };
  if (timer !== 0) return { handled: true, fields: writes };
  if (fields['7E:4190'] == null) return missing('7E:4190');
  let first = fields['7E:4190'],
    second;
  if (first === 0) {
    if (fields['7E:41E8'] == null) return missing('7E:41E8');
    second = fields['7E:41E8'];
    if (!slotOffset(second))
      return { handled: false, reason: 'slot_motion_target_window_required', offset: second };
    if (!readTargetSlot)
      return { handled: false, reason: 'slot_motion_target_source_required', offset: second };
    const targetFirst = readTargetSlot(second, '0E28');
    if (!targetFirst.available) return unavailable(targetFirst);
    if (!isWord(targetFirst.value)) throw Error('Invalid C9E0 target source');
    first = targetFirst.value;
  }
  if (fields['0E28'] == null) return missing('0E28');
  const differenceFirst = (first - fields['0E28']) & WORD_MASK;
  const scratchWords = {
    A8: differenceFirst & WORD_SIGN ? differenceFirst : 0,
    AB: 0,
    A2: differenceFirst & WORD_SIGN ? -differenceFirst & WORD_MASK : differenceFirst,
  };
  if (fields['7E:4190'] === 0) {
    const targetSecond = readTargetSlot(second, '0E80');
    if (!targetSecond.available) return unavailable(targetSecond);
    if (!isWord(targetSecond.value)) throw Error('Invalid C9E0 target source');
    second = targetSecond.value;
  } else {
    if (fields['7E:41E8'] == null) return missing('7E:41E8');
    second = fields['7E:41E8'];
  }
  if (fields['0E80'] == null) return missing('0E80');
  const differenceSecond = (second - fields['0E80']) & WORD_MASK;
  scratchWords.AB = differenceSecond & WORD_SIGN ? differenceSecond : 0;
  scratchWords.A5 = differenceSecond & WORD_SIGN ? -differenceSecond & WORD_MASK : differenceSecond;
  if (((scratchWords.A2 + scratchWords.A5) & WORD_MASK) < ARRIVAL_DISTANCE) {
    writes['0D20'] = writes['0D78'] = 0;
    if (fields['1350'] == null) return missing('1350');
    if (fields['1350'] & WORD_SIGN)
      return { handled: true, fields: writes, targetScratchWords: scratchWords };
    if (!frameAllocator) return { handled: false, reason: 'slot_motion_task_source_required' };
    const seen = new Set();
    let taskOffset = fields['1350'];
    for (;;) {
      if (seen.has(taskOffset))
        return { handled: false, reason: 'slot_motion_task_cycle_required', offset: taskOffset };
      seen.add(taskOffset);
      const status = frameAllocator.readMotionTaskWord(taskOffset, 'statusWord');
      if (!status.available) return unavailable(status);
      if (!(status.value & WORD_SIGN)) {
        const event = frameAllocator.readMotionTaskWord(taskOffset, 'eventWord');
        if (!event.available) return unavailable(event);
        return {
          handled: true,
          fields: writes,
          targetScratchWords: scratchWords,
          taskEventWrite: { offset: taskOffset, value: event.value | MOTION_END_EVENT },
        };
      }
      const link = frameAllocator.readMotionTaskWord(taskOffset, 'successorWord');
      if (!link.available) return unavailable(link);
      taskOffset = link.value; // No negative-sentinel success after the first 1350.
    }
  }
  let direction, call6A;
  if (modeWord & 1) {
    if (fields['1458'] == null) return missing('1458');
    let secondAxis = !!(modeWord & 2);
    if (fields['1458'] & OBJECT_BLOCKED) {
      writes['7E:40E0'] = BLOCKED_DELAY;
      secondAxis = !secondAxis;
    } else {
      writes['7E:40E0'] = 2;
      if ((secondAxis ? scratchWords.A5 : scratchWords.A2) < AXIS_SWITCH_DISTANCE) {
        writes['7E:4138'] = modeWord ^ 2;
        secondAxis = !secondAxis;
      }
    }
    direction = secondAxis
      ? scratchWords.AB
        ? DIRECTION_Y_MINUS
        : 0
      : scratchWords.A8
        ? DIRECTION_X_MINUS
        : 2;
    call6A = true;
  } else {
    if (scratchWords.A5 >>> 1 >= scratchWords.A2)
      direction = scratchWords.AB ? DIRECTION_Y_MINUS : 0;
    else if (scratchWords.A2 >>> 1 >= scratchWords.A5)
      direction = scratchWords.A8 ? DIRECTION_X_MINUS : 2;
    else
      direction = scratchWords.A8
        ? scratchWords.AB
          ? DIRECTION_X_MINUS_Y_MINUS
          : DIRECTION_X_MINUS_Y_PLUS
        : scratchWords.AB
          ? DIRECTION_X_PLUS_Y_MINUS
          : DIRECTION_X_PLUS_Y_PLUS;
    call6A = modeWord === 0 || modeWord >>> 2 === direction;
    if (modeWord === 0 || !call6A) writes['7E:4138'] = direction * MODE_DIRECTION_SCALE + 2;
  }
  let working = { ...fields, ...writes };
  const workspace = new Map([
    [0, offset],
    [1, direction],
  ]);
  let byteWrite;
  if (call6A) {
    // A985 needs the definition only when it actually performs a data lookup.
    if (working['1198'] == null) return missing('1198');
    if (working['1198'] !== direction) {
      if (working['10E8'] == null) return missing('10E8');
      if (!(working['10E8'] > 0 && working['10E8'] < BYTE_SIGN)) {
        if (working['1038'] == null) return missing('1038');
        if (working['1038'] !== WORD_MASK && definitionWord === null)
          return { handled: false, reason: 'slot_definition_source_required' };
      } else if (actionData && working['1090'] == null) return missing('1090');
    }
    const plan = prepareSlotAction6A({
      offset,
      nextWord: direction,
      definitionWord,
      fields: working,
      lowByte,
      actionData,
    });
    if (!plan.handled) return plan;
    Object.assign(writes, plan.fields);
    working = { ...working, ...plan.fields };
    plan.workspaceWords.forEach((value, index) => workspace.set(index, value));
    for (const write of plan.workspaceWrites ?? []) workspace.set(write.index, write.value);
    if (Object.hasOwn(plan, 'lowByte')) byteWrite = plan.lowByte;
  }
  if (working['1038'] == null) return missing('1038');
  if (directionBank !== 0 && directionBank !== CODE_BANK)
    return { handled: false, reason: 'slot_motion_direction_bank_required' };
  if (!directionData)
    return { handled: false, reason: 'slot_motion_direction_data_source_required' };
  for (const [axis, key] of [
    [0, '0D20'],
    [1, '0D78'],
  ]) {
    const read = directionData.readMotionWord(direction, working['1038'], axis, directionBank);
    if (!read.available) return unavailable(read);
    writes[key] = read.value;
  }
  if (!(modeWord & 1)) writes['7E:40E0'] = 2;
  return {
    handled: true,
    fields: writes,
    targetScratchWords: scratchWords,
    workspaceWrites: [...workspace]
      .sort(([a], [b]) => a - b)
      .map(([index, value]) => ({ index, value })),
    ...(byteWrite !== undefined ? { lowByte: byteWrite } : {}),
  };
}
