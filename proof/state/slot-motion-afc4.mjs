import {
  BYTE_MASK,
  BYTE_BITS,
  WORD_MASK,
  WORD_SIGN,
  HEX_RADIX,
} from '../../src/constants/bits.mjs';
import { OBJECT_LAST_SLOT, OBJECT_HALTED } from '../../src/task/wram.mjs';
import { isWord } from '../script/runtime.mjs';
import { isTaskFrameAllocator } from '../script/task-frames.mjs';
import { createMotionTaskPlan } from '../script/motion-task-plan.mjs';
import { isSlotActionData } from './slot-action-data.mjs';
import { isSlotMotionDirectionData } from './slot-motion-direction-data.mjs';
import { isSlotMotionPostpassData } from './slot-motion-postpass-data.mjs';
import { isSlotMotionData, prepareMotionDataView } from './slot-motion-data.mjs';
import { prepareMotionPrelude8799, motionPreludeScratchKeys } from './slot-motion-prelude-8799.mjs';
import { prepareSlotMotion } from './slot-motion.mjs';
import {
  prepareMotionPostpassAC2F,
  motionPostpassScratchKeys,
} from './slot-motion-postpass-ac2f.mjs';
import { motionHelperScratchKeys } from './slot-motion-search.mjs';
import { createMotionScratch } from './slot-motion-scratch.mjs';

const OBJECT_SLOT_COUNT = OBJECT_LAST_SLOT / 2 + 1;
const GRAPHICS_POOL_NODE_COUNT = 120;
const DP_FRAME_BANK = 0x40;
const FRAME_DATA_BANK = 0x8c;

const scratchKeys = [
  ...new Set([
    ...motionHelperScratchKeys,
    ...motionPreludeScratchKeys,
    ...motionPostpassScratchKeys,
    '40',
  ]),
];
const slotIndex = (offset) =>
  isWord(offset) && offset <= OBJECT_LAST_SLOT && !(offset & 1) ? offset / 2 : -1;
const words = (values) =>
  Array.isArray(values) &&
  values.length === OBJECT_SLOT_COUNT &&
  Array.from(values).every((v) => v === null || isWord(v));

// Complete manual AFC4 game-data sequence from 80:AFC4..AFFC. Every callee
// sees earlier planned effects. Only data owners, no CPU/frame execution.
export function prepareMotionAFC4({
  snapshot,
  scratchBytes,
  motionData = null,
  actionData = null,
  directionData = null,
  postpassData = null,
  bank = null,
  frameAllocator = null,
}) {
  if (
    !snapshot ||
    !snapshot.columns ||
    typeof snapshot.columns !== 'object' ||
    Array.isArray(snapshot.columns) ||
    !Object.values(snapshot.columns).every(words) ||
    !['1458', '7E:40E0', '0E28', '0E80', '0ED8', '0D20', '0D78', '0DD0', '11F0'].every((key) =>
      words(snapshot.columns[key]),
    ) ||
    !words(snapshot.definitions) ||
    !words(snapshot.counts) ||
    !words(snapshot.heads) ||
    !snapshot.fieldBytes ||
    !Array.isArray(snapshot.fieldBytes['11F0']) ||
    snapshot.fieldBytes['11F0'].length !== OBJECT_SLOT_COUNT ||
    Array.from(snapshot.fieldBytes['11F0']).some(
      (pair) =>
        !Array.isArray(pair) ||
        pair.length !== 2 ||
        Array.from(pair).some(
          (v) => v !== null && (!Number.isInteger(v) || v < 0 || v > BYTE_MASK),
        ),
    ) ||
    !snapshot.activeList ||
    (snapshot.activeList.lastOffset !== null && !isWord(snapshot.activeList.lastOffset)) ||
    !Array.isArray(snapshot.activeList.entries) ||
    snapshot.activeList.entries.length !== OBJECT_SLOT_COUNT ||
    Array.from(snapshot.activeList.entries).some((v) => v !== null && !isWord(v)) ||
    !snapshot.pool ||
    !isWord(snapshot.pool.freeCount) ||
    !isWord(snapshot.pool.freeHead) ||
    !Array.isArray(snapshot.pool.links) ||
    snapshot.pool.links.length !== GRAPHICS_POOL_NODE_COUNT ||
    Array.from(snapshot.pool.links).some((v) => v !== null && !isWord(v)) ||
    (motionData !== null && !isSlotMotionData(motionData)) ||
    (actionData !== null && !isSlotActionData(actionData)) ||
    (directionData !== null && !isSlotMotionDirectionData(directionData)) ||
    (postpassData !== null && !isSlotMotionPostpassData(postpassData)) ||
    (bank !== null && (!Number.isInteger(bank) || bank < 0 || bank > BYTE_MASK)) ||
    (frameAllocator !== null && !isTaskFrameAllocator(frameAllocator))
  )
    throw Error('Invalid AFC4 context');
  const scratch = createMotionScratch(scratchKeys, scratchBytes),
    operations = [],
    visits = [];
  const columns = Object.fromEntries(
    Object.entries(snapshot.columns).map(([key, values]) => [key, [...values]]),
  );
  const fieldBytes = snapshot.fieldBytes['11F0'].map((pair) => [...pair]);
  const counts = [...snapshot.counts],
    heads = [...snapshot.heads];
  const pool = { ...snapshot.pool, links: [...snapshot.pool.links] };
  const taskPlan = frameAllocator ? createMotionTaskPlan(frameAllocator) : null;
  const taskSource = taskPlan?.source ?? null;
  const readSlotField = (offset, key) => {
    const index = slotIndex(offset);
    if (index < 0)
      return { available: false, reason: 'slot_motion_target_window_required', offset };
    const value = columns[key]?.[index];
    return value == null
      ? { available: false, reason: 'slot_motion_target_source_required', offset, field: key }
      : { available: true, value };
  };
  const fieldsAt = (index) =>
    Object.fromEntries(Object.entries(columns).map(([key, values]) => [key, values[index]]));
  const applyFields = (index, plan) => {
    for (const [key, value] of Object.entries(plan.fields)) {
      columns[key][index] = value;
      if (key === '11F0') fieldBytes[index] = [value & BYTE_MASK, value >>> BYTE_BITS];
    }
    if (Object.hasOwn(plan, 'lowByte')) {
      fieldBytes[index][0] = plan.lowByte;
      const [low, high] = fieldBytes[index];
      columns['11F0'][index] = high === null ? null : low | (high << BYTE_BITS);
    }
    if (plan.taskEventWrite) taskPlan.stageEvent(plan.taskEventWrite);
  };
  const scratchWords = (words) =>
    scratch.writeWords(
      Object.entries(words).map(([key, value]) => ({ address: parseInt(key, HEX_RADIX), value })),
    );
  const fail = (boundary, phase, cursor, slotOffset) => ({
    ...boundary,
    phase,
    ...(cursor !== undefined ? { cursor } : {}),
    ...(slotOffset !== undefined ? { slotOffset } : {}),
  });
  const prelude = prepareMotionPrelude8799({ ...snapshot.activeList, readSlotField, motionData });
  if (!prelude.handled) return fail(prelude, 'prelude');
  const view = prepareMotionDataView(motionData, prelude.dataWrites);
  if (!view.handled) return fail(view, 'prelude');
  scratchWords(prelude.scratchWords);
  operations.push({ kind: 'prelude', plan: prelude });
  // Covered callee writes cannot alias 14B0/14B2; both caller reloads use
  // the same actual list owner. Do not insert a second negative-list guard.
  let cursor = snapshot.activeList.lastOffset;
  if (cursor & WORD_SIGN) return { handled: true, outcome: 'empty', operations, visits };
  const readEntry = () => {
    if (cursor > OBJECT_LAST_SLOT || cursor & 1)
      return { handled: false, reason: 'slot_motion_active_list_window_required', offset: cursor };
    const offset = snapshot.activeList.entries[cursor / 2];
    if (offset === null)
      return {
        handled: false,
        reason: 'slot_motion_source_required',
        field: '14B2',
        offset: cursor,
      };
    const index = slotIndex(offset);
    if (index < 0) return { handled: false, reason: 'slot_window_required', offset };
    if (columns['1458'][index] === null)
      return { handled: false, reason: 'slot_motion_source_required', field: '1458', offset };
    return { handled: true, offset, index, skip: !!(columns['1458'][index] & OBJECT_HALTED) };
  };
  do {
    const entry = readEntry();
    if (!entry.handled) return fail(entry, 'body', cursor);
    const { index, offset, skip } = entry;
    visits.push({ phase: 'body', cursor, slotOffset: offset, skipped: skip });
    if (!skip) {
      const plan = prepareSlotMotion(fieldsAt(index), {
        offset,
        motionData: view.data,
        actionData,
        directionData,
        directionBank: bank,
        frameAllocator: taskSource,
        definitionWord: snapshot.definitions[index],
        lowByte: fieldBytes[index][0],
        readTargetSlot: readSlotField,
      });
      if (!plan.handled) return fail(plan, 'body', cursor, offset);
      if (plan.workspaceWrites && !frameAllocator)
        return fail(
          { handled: false, reason: 'slot_motion_workspace_required' },
          'body',
          cursor,
          offset,
        );
      applyFields(index, plan);
      if (plan.helperScratchWords) scratchWords(plan.helperScratchWords);
      operations.push({ kind: 'body', offset, plan });
    }
    cursor = (cursor - 2) & WORD_MASK;
  } while (!(cursor & WORD_SIGN));
  const callerWrites = [{ address: DP_FRAME_BANK, value: FRAME_DATA_BANK }];
  scratch.writeWords(callerWrites);
  operations.push({ kind: 'caller_scratch', writes: callerWrites });
  cursor = snapshot.activeList.lastOffset;
  do {
    const entry = readEntry();
    if (!entry.handled) return fail(entry, 'postpass', cursor);
    const { index, offset, skip } = entry;
    visits.push({ phase: 'postpass', cursor, slotOffset: offset, skipped: skip });
    if (!skip) {
      const plan = prepareMotionPostpassAC2F({
        offset,
        fields: fieldsAt(index),
        count: counts[index],
        head: heads[index],
        freeCount: pool.freeCount,
        freeHead: pool.freeHead,
        links: pool.links,
        scratchBytes: scratch.snapshot(),
        actionData,
        postpassData,
        tableBank: bank,
        frameAllocator: taskSource,
      });
      if (!plan.handled) return fail(plan, 'postpass', cursor, offset);
      applyFields(index, plan);
      scratch.writeWords(plan.scratchWrites);
      if (Object.hasOwn(plan.poolWrites, 'count')) counts[index] = plan.poolWrites.count;
      if (Object.hasOwn(plan.poolWrites, 'head')) heads[index] = plan.poolWrites.head;
      for (const key of ['freeCount', 'freeHead'])
        if (Object.hasOwn(plan.poolWrites, key)) pool[key] = plan.poolWrites[key];
      for (const { offset: node, next } of plan.linkWrites) pool.links[node / 2] = next;
      operations.push({ kind: 'postpass', offset, plan });
    }
    cursor = (cursor - 2) & WORD_MASK;
  } while (!(cursor & WORD_SIGN));
  return { handled: true, outcome: 'completed', operations, visits };
}
