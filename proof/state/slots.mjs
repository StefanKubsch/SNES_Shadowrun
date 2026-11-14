import {
  BYTE_MASK,
  BYTE_BITS,
  WORD_MASK,
  WORD_SIGN,
  HIGH_BYTE_MASK,
  LONG_MASK,
  HEX_RADIX,
} from '../../src/constants/bits.mjs';
import { CODE_BANK } from '../../src/constants/memory-map.mjs';
import { OBJECT_LAST_SLOT, EMPTY_LIST } from '../../src/task/wram.mjs';
import { SCRIPT_NATIVE, CREATE_SLOT_WORDS } from '../script/task.mjs';
import { isWord } from '../script/runtime.mjs';
import { isSlotDefinitions } from './slot-definitions.mjs';
import { isSlotActionData } from './slot-action-data.mjs';
import { prepareSlotSelection, ACTION_FIELD, ANIMATION_CLOCK_RESTART } from './slot-selection.mjs';
import { prepareSlotAction6A } from './slot-action-6a.mjs';
import { isSlotTargetData } from './slot-target-data.mjs';
import { prepareSlotMotion } from './slot-motion.mjs';
import { isSlotMotionData } from './slot-motion-data.mjs';
import { prepareMotionHelper8133 } from './slot-motion-helper-8133.mjs';
import { prepareMotionHelper8238 } from './slot-motion-helper-8238.mjs';
import { prepareMotionHelper82BC } from './slot-motion-helper-82bc.mjs';
import { prepareMotionHelper80B2 } from './slot-motion-helper-80b2.mjs';
import { prepareMotionHelper81B4 } from './slot-motion-helper-81b4.mjs';
import { motionHelperScratchKeys } from './slot-motion-search.mjs';
import { prepareMotionHelperC9E0 } from './slot-motion-helper-c9e0.mjs';
import { isSlotMotionDirectionData } from './slot-motion-direction-data.mjs';
import { isTaskFrameAllocator } from '../script/task-frames.mjs';
import { slotTargetIndex, calculateSlotTargetMotion } from './slot-target-motion.mjs';
import { prepareMotionPrelude8799, motionPreludeScratchKeys } from './slot-motion-prelude-8799.mjs';
import { createMotionScratch } from './slot-motion-scratch.mjs';
import {
  prepareMotionPostpassAC2F,
  motionPostpassScratchKeys,
} from './slot-motion-postpass-ac2f.mjs';
import { isSlotMotionPostpassData } from './slot-motion-postpass-data.mjs';
import { prepareMotionAFC4 } from './slot-motion-afc4.mjs';
import { prepareMotionPrefixDE94, prepareMotionDE94AFC4 } from './slot-motion-prefix-de94.mjs';
import { prepareMotionPrefixReset88 } from './slot-motion-prefix-reset-88.mjs';

const OBJECT_SLOT_COUNT = OBJECT_LAST_SLOT / 2 + 1;
const GRAPHICS_POOL_NODE_COUNT = 120;
const GRAPHICS_POOL_LAST_NODE = (GRAPHICS_POOL_NODE_COUNT - 1) * 2;
const INITIAL_FREE_NODES = 0x40;
const VRAM_SLOT_LOWER_ROW = 0x10;
const DP_FRAME_BANK = 0x40;
const NO_DEFINITION = WORD_MASK;
const NO_SELECTION = WORD_MASK;
const SLOT_FLAGS_FIELD = '1458';
const AXIS_COUNT = 3;
const COORDINATE_ARGUMENT_WORDS = 4;
const COORDINATE_SCALE = 4;
const SELECTION_ARGUMENT_WORDS = 3;
const SELECTION_WORKSPACE_WORDS = 6;
const NATIVE_WORKSPACE_WORDS = 8;
const NATIVE_WORKSPACE_BYTES = NATIVE_WORKSPACE_WORDS * 2;

// Column names retain source labels until gameplay meanings are established.
// Valid even offsets come from $80:A835/$81:A779, not guessed object IDs.
const resetValues = {
  '7E:4240': 0,
  '7E:4298': 0,
  '7E:42F0': 0,
  '7E:4348': 0,
  '7E:43A0': 0,
  '7E:40E0': 0,
  [ACTION_FIELD.PICTURE_CHANGE]: 0,
  '7E:3F80': 0,
  [ACTION_FIELD.DIRECTIONS]: 0,
  [ACTION_FIELD.SELECTION]: NO_SELECTION,
  '7E:4030': ANIMATION_CLOCK_RESTART,
  '7E:3FD8': 1,
};
const creationZeros = [
  '0D20',
  '0D78',
  '0DD0',
  '0F88',
  '7E:43F8',
  '7E:4450',
  '1198',
  '13A8',
  '1400',
];
const columnNames = [
  ...Object.keys(resetValues),
  ...creationZeros,
  '0E28',
  '0E80',
  '0ED8',
  '0F30',
  '150A',
  '1458',
  '1350',
  '10E8',
  '11F0',
  '7E:4088',
  '1248',
  '7E:4138',
  '7E:4190',
  '7E:41E8',
  '0FE0',
];
const readFields = {
  [SCRIPT_NATIVE.READ_SLOT_X]: '0E28',
  [SCRIPT_NATIVE.READ_SLOT_Y]: '0E80',
  [SCRIPT_NATIVE.READ_SLOT_Z]: '0ED8',
};
const instances = new WeakSet();
export const isSlotState = (state) => instances.has(state);
const slotIndex = (offset) =>
  Number.isInteger(offset) && offset >= 0 && offset <= OBJECT_LAST_SLOT && !(offset & 1)
    ? offset / 2
    : -1;
const poolIndex = (offset) =>
  Number.isInteger(offset) && offset >= 0 && offset <= GRAPHICS_POOL_LAST_NODE && !(offset & 1)
    ? offset / 2
    : -1;

// Only the data writes in $81:A779-$A7FA are initialized here. Other slot
// fields/counts/heads and unused list entries remain unknown, not zero.
// No graphics DMA, scene loader, allocator, CPU or address bus runs here.
export function createSlotState({
  definitionData = null,
  actionData = null,
  targetData = null,
  motionData = null,
  motionDirectionData = null,
  motionPostpassData = null,
} = {}) {
  if (definitionData !== null && !isSlotDefinitions(definitionData))
    throw new Error('Invalid slot definition source');
  if (actionData !== null && !isSlotActionData(actionData))
    throw new Error('Invalid slot action source');
  if (targetData !== null && !isSlotTargetData(targetData))
    throw new Error('Invalid slot target source');
  if (motionData !== null && !isSlotMotionData(motionData))
    throw new Error('Invalid slot motion data source');
  if (motionDirectionData !== null && !isSlotMotionDirectionData(motionDirectionData))
    throw Error('Invalid slot motion direction source');
  if (motionPostpassData !== null && !isSlotMotionPostpassData(motionPostpassData))
    throw Error('Invalid slot motion postpass source');
  let pointerF3 = null;
  let motionScratchWord6B = null;
  const scratchKeys = [
    ...new Set([
      ...motionHelperScratchKeys,
      ...motionPreludeScratchKeys,
      ...motionPostpassScratchKeys,
      '40',
    ]),
  ];
  const motionScratch = createMotionScratch(scratchKeys);
  const motionHelperScratch = motionScratch.words(motionHelperScratchKeys);
  const motionPreludeScratch = motionScratch.words(motionPreludeScratchKeys);
  const motionPostpassScratch = motionScratch.words(motionPostpassScratchKeys);
  const motionScratchBytes40 = motionScratch.bytePair(DP_FRAME_BANK);
  const targetScratch = Object.fromEntries(
    ['A2', 'A5', 'A8', 'AB', 'AE', 'B1', 'B4', 'B7', 'BA'].map((key) => [key, null]),
  );
  const definitions = Array(OBJECT_SLOT_COUNT).fill(NO_DEFINITION);
  const counts = Array(OBJECT_SLOT_COUNT).fill(null);
  const heads = Array(OBJECT_SLOT_COUNT).fill(null);
  const columns = Object.fromEntries(
    columnNames.map((key) => [key, Array(OBJECT_SLOT_COUNT).fill(null)]),
  );
  // 11F0 is written both as word (A985) and low byte (6A). Each source byte
  // stays known/unknown independently; a low-byte write cannot invent high.
  const fieldBytes = Array.from({ length: OBJECT_SLOT_COUNT }, () => [null, null]);
  const writeField = (key, index, value) => {
    columns[key][index] = value;
    if (key === '11F0') fieldBytes[index] = [value & BYTE_MASK, value >>> BYTE_BITS];
  };
  const writeByte = (index, byteOffset, value) => {
    fieldBytes[index][byteOffset] = value;
    const [low, high] = fieldBytes[index];
    columns['11F0'][index] = low === null || high === null ? null : low | (high << BYTE_BITS);
  };
  const motionContext = (index, options = {}) => {
    if (!options || typeof options !== 'object' || Array.isArray(options))
      throw Error('Invalid slot motion context');
    const { directionBank = null, frameAllocator = null } = options;
    if (
      (directionBank !== null &&
        (!Number.isInteger(directionBank) || directionBank < 0 || directionBank > BYTE_MASK)) ||
      (frameAllocator !== null && !isTaskFrameAllocator(frameAllocator))
    )
      throw Error('Invalid slot motion context');
    return {
      directionBank,
      frameAllocator,
      directionData: motionDirectionData,
      actionData,
      definitionWord: definitions[index],
      lowByte: fieldBytes[index][0],
      readTargetSlot(offset, key) {
        const target = slotIndex(offset);
        if (target < 0)
          return { available: false, reason: 'slot_motion_target_window_required', offset };
        const value = columns[key][target];
        return value === null
          ? { available: false, reason: 'slot_motion_target_source_required', offset, field: key }
          : { available: true, value };
      },
    };
  };
  const commitMotionPlan = (index, plan, frameAllocator) => {
    if (!plan.handled) return plan;
    // No slot/scratch/byte/task effects if the shared workspace owner is absent.
    if (plan.workspaceWrites && !frameAllocator)
      return { handled: false, reason: 'slot_motion_workspace_required' };
    for (const [key, value] of Object.entries(plan.fields)) writeField(key, index, value);
    if (Object.hasOwn(plan, 'lowByte')) writeByte(index, 0, plan.lowByte);
    if (plan.targetScratchWords) Object.assign(targetScratch, plan.targetScratchWords);
    if (Object.hasOwn(plan, 'scratchWord6B')) motionScratchWord6B = plan.scratchWord6B;
    if (plan.helperScratchWords) Object.assign(motionHelperScratch, plan.helperScratchWords);
    for (const write of plan.workspaceWrites ?? [])
      frameAllocator.writeWorkspaceWords([write.value], write.index);
    if (plan.taskEventWrite)
      frameAllocator.writeMotionTaskEvents(plan.taskEventWrite.offset, plan.taskEventWrite.value);
    return { handled: true };
  };
  const entries = Array(OBJECT_SLOT_COUNT).fill(null);
  let lastOffset = EMPTY_LIST;
  let freeCount = INITIAL_FREE_NODES;
  let freeHead = 2;
  let links = Array.from({ length: GRAPHICS_POOL_NODE_COUNT }, (_, index) => {
    const next = index * 2 + 2;
    return next + (next & VRAM_SLOT_LOWER_ROW);
  });
  const commitPostpassPlan = (index, plan, frameAllocator) => {
    for (const [key, value] of Object.entries(plan.fields)) writeField(key, index, value);
    if (Object.hasOwn(plan.poolWrites, 'count')) counts[index] = plan.poolWrites.count;
    if (Object.hasOwn(plan.poolWrites, 'head')) heads[index] = plan.poolWrites.head;
    if (Object.hasOwn(plan.poolWrites, 'freeCount')) freeCount = plan.poolWrites.freeCount;
    if (Object.hasOwn(plan.poolWrites, 'freeHead')) freeHead = plan.poolWrites.freeHead;
    for (const { offset: node, next } of plan.linkWrites) links[poolIndex(node)] = next;
    motionScratch.writeWords(plan.scratchWrites);
    if (plan.taskEventWrite)
      frameAllocator.writeMotionTaskEvents(plan.taskEventWrite.offset, plan.taskEventWrite.value);
  };
  const commitPreludeScratch = (plan) => {
    for (const [key, value] of Object.entries(plan.scratchWords)) {
      if (Object.hasOwn(motionHelperScratch, key)) motionHelperScratch[key] = value;
      else motionPreludeScratch[key] = value;
    }
  };
  const commitPrefixPlan = (plan) => {
    if (Object.hasOwn(plan, 'counterWrite')) motionData.writePrefixCounter(plan.counterWrite);
    for (const [key, value] of Object.entries(plan.fields))
      writeField(key, slotIndex(plan.offset), value);
  };
  const commitAFC4Plan = (plan, frameAllocator) => {
    // Immutable branded providers and pure callees check complete batches.
    // No callback or source read occurs during commit.
    const dataWrites = plan.operations
      .filter((op) => op.kind === 'prelude')
      .flatMap((op) => op.plan.dataWrites);
    const outputWrites = plan.operations
      .filter((op) => op.kind === 'postpass')
      .flatMap((op) => op.plan.outputWrites);
    if (!motionData.writePreludeWords(dataWrites).handled)
      throw Error('Invalid covered AFC4 data plan');
    if (outputWrites.length && !motionPostpassData.writeOutputWords(outputWrites).handled)
      throw Error('Invalid covered AFC4 output plan');
    for (const operation of plan.operations) {
      if (operation.kind === 'prelude') commitPreludeScratch(operation.plan);
      else if (operation.kind === 'caller_scratch') motionScratch.writeWords(operation.writes);
      else if (operation.kind === 'body')
        commitMotionPlan(slotIndex(operation.offset), operation.plan, frameAllocator);
      else commitPostpassPlan(slotIndex(operation.offset), operation.plan, frameAllocator);
    }
  };
  const state = {
    // Explicit source/test-fixture hydration, not a ported in-game allocation.
    observeNativeDispatch(nativeId) {
      if (!Number.isInteger(nativeId) || nativeId < 0 || nativeId > BYTE_MASK)
        throw new Error('Invalid native dispatch ID');
      // F504 stores the native table pointer in shared A2, including 9F.
      // Script ABI assets omit those pointer words: retain unknown, not an
      // earlier D9 magnitude. A subsequent D9 body supplies its own A2.
      targetScratch.A2 = null;
    },
    seedTargetPointer(pointer) {
      if (!Number.isInteger(pointer) || pointer < 0 || pointer > LONG_MASK)
        throw new Error('Invalid slot target pointer');
      pointerF3 = pointer;
    },
    seedSlot(offset, { definitionWord, count, head, fields = {} } = {}) {
      const index = slotIndex(offset);
      if (
        index < 0 ||
        !isWord(definitionWord) ||
        !isWord(count) ||
        !isWord(head) ||
        !fields ||
        typeof fields !== 'object' ||
        Array.isArray(fields) ||
        Object.entries(fields).some(
          ([key, value]) => !Object.hasOwn(columns, key) || !isWord(value),
        )
      )
        throw new Error('Invalid slot seed');
      definitions[index] = definitionWord;
      counts[index] = count;
      heads[index] = head;
      for (const [key, value] of Object.entries(fields)) writeField(key, index, value);
    },
    seedSlotFields(offset, fields) {
      const index = slotIndex(offset);
      if (
        index < 0 ||
        !fields ||
        typeof fields !== 'object' ||
        Array.isArray(fields) ||
        Object.entries(fields).some(
          ([key, value]) => !Object.hasOwn(columns, key) || !isWord(value),
        )
      )
        throw new Error('Invalid slot field seed');
      for (const [key, value] of Object.entries(fields)) writeField(key, index, value);
    },
    seedSlotFieldByte(offset, key, byteOffset, value) {
      const index = slotIndex(offset);
      if (
        index < 0 ||
        key !== '11F0' ||
        ![0, 1].includes(byteOffset) ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > BYTE_MASK
      )
        throw new Error('Invalid slot byte seed');
      writeByte(index, byteOffset, value);
    },
    seedActiveList(offsets) {
      if (
        !Array.isArray(offsets) ||
        offsets.length > OBJECT_SLOT_COUNT ||
        Array.from(offsets).some((offset) => slotIndex(offset) < 0)
      )
        throw new Error('Invalid active-list seed');
      for (let i = 0; i < offsets.length; i++) entries[i] = offsets[i];
      lastOffset = (offsets.length * 2 - 2) & WORD_MASK;
    },
    // Explicit WORD40 hydration; byte41 is shared with the next scratch WORD.
    seedMotionScratchWord40(value) {
      if (!isWord(value)) throw Error('Invalid motion scratch word40');
      motionScratchBytes40[0] = value & BYTE_MASK;
      motionScratchBytes40[1] = value >>> BYTE_BITS;
      if (motionPreludeScratch['41'] !== null)
        motionPreludeScratch['41'] =
          (motionPreludeScratch['41'] & HIGH_BYTE_MASK) | (value >>> BYTE_BITS);
    },
    seedMotionScratchWord(key, value) {
      if (!scratchKeys.includes(key) || !isWord(value))
        throw Error('Invalid motion scratch source');
      motionScratch.writeWords([{ address: parseInt(key, HEX_RADIX), value }]);
    },
    readMotionScratchBytes: () => motionScratch.snapshot(),
    resetMotionPrefix88(options = {}) {
      if (!options || typeof options !== 'object' || Array.isArray(options))
        throw Error('Invalid motion prefix reset context');
      const plan = prepareMotionPrefixReset88({ motionData, bank: options.bank ?? null });
      if (!plan.handled) return plan;
      return motionData.writePrefixResetWords(plan.writes);
    },
    stepMotionPrefixDE94(options = {}) {
      if (!options || typeof options !== 'object' || Array.isArray(options))
        throw Error('Invalid DE94 context');
      const plan = prepareMotionPrefixDE94({ motionData, bank: options.bank ?? null });
      if (!plan.handled) return plan;
      commitPrefixPlan(plan);
      return { handled: true, outcome: plan.outcome, offset: plan.offset };
    },
    stepMotionDE94AFC4(options = {}) {
      if (!options || typeof options !== 'object' || Array.isArray(options))
        throw Error('Invalid DE94/AFC4 context');
      const { bank = null, frameAllocator = null } = options;
      const plan = prepareMotionDE94AFC4({
        snapshot: state.snapshot(),
        scratchBytes: motionScratch.snapshot(),
        motionData,
        actionData,
        directionData: motionDirectionData,
        postpassData: motionPostpassData,
        bank,
        frameAllocator,
      });
      if (!plan.handled) return plan;
      commitPrefixPlan(plan.prefix);
      commitAFC4Plan(plan.afc4, frameAllocator);
      return {
        handled: true,
        prefix: { outcome: plan.prefix.outcome, offset: plan.prefix.offset },
        outcome: plan.afc4.outcome,
        visits: plan.afc4.visits,
      };
    },
    stepMotionAFC4(options = {}) {
      if (!options || typeof options !== 'object' || Array.isArray(options))
        throw Error('Invalid AFC4 context');
      const { bank = null, frameAllocator = null } = options;
      const plan = prepareMotionAFC4({
        snapshot: state.snapshot(),
        scratchBytes: motionScratch.snapshot(),
        motionData,
        actionData,
        directionData: motionDirectionData,
        postpassData: motionPostpassData,
        bank,
        frameAllocator,
      });
      if (!plan.handled) return plan;
      commitAFC4Plan(plan, frameAllocator);
      return { handled: true, outcome: plan.outcome, visits: plan.visits };
    },
    stepMotionPostpassAC2F(offset, options = {}) {
      if (!isWord(offset)) throw Error('Invalid slot motion offset');
      const index = slotIndex(offset);
      if (index < 0) return { handled: false, reason: 'slot_window_required' };
      if (!options || typeof options !== 'object' || Array.isArray(options))
        throw Error('Invalid AC2F context');
      const { tableBank = null, frameAllocator = null } = options;
      const fields = Object.fromEntries(
        Object.entries(columns).map(([key, values]) => [key, values[index]]),
      );
      const plan = prepareMotionPostpassAC2F({
        offset,
        fields,
        count: counts[index],
        head: heads[index],
        freeCount,
        freeHead,
        links,
        scratchBytes: motionScratch.snapshot(),
        actionData,
        postpassData: motionPostpassData,
        tableBank,
        frameAllocator,
      });
      if (!plan.handled) return plan;
      if (plan.outputWrites.length) {
        const committed = motionPostpassData.writeOutputWords(plan.outputWrites);
        if (!committed.handled) return committed;
      }
      commitPostpassPlan(index, plan, frameAllocator);
      return {
        handled: true,
        outcome: plan.outcome,
        carry: plan.carry,
        ...(Object.hasOwn(plan, 'terminalTaskOffset')
          ? { terminalTaskOffset: plan.terminalTaskOffset }
          : {}),
      };
    },
    stepMotionPrelude8799() {
      const plan = prepareMotionPrelude8799({
        lastOffset,
        entries,
        motionData,
        readSlotField(offset, key) {
          const value = columns[key][slotIndex(offset)];
          return value === null ? { available: false } : { available: true, value };
        },
      });
      if (!plan.handled) return plan;
      const committed = motionData.writePreludeWords(plan.dataWrites);
      if (!committed.handled) return committed;
      commitPreludeScratch(plan);
      return { handled: true };
    },
    seedPool({ count, head, linkWords = [] } = {}) {
      if (
        !isWord(count) ||
        !isWord(head) ||
        !Array.isArray(linkWords) ||
        Array.from(linkWords).some(
          (entry) => !entry || poolIndex(entry.offset) < 0 || !isWord(entry.next),
        )
      )
        throw new Error('Invalid pool seed');
      freeCount = count;
      freeHead = head;
      for (const { offset, next } of linkWords) links[poolIndex(offset)] = next;
    },
    stepMotionHelper80B2(offset) {
      if (!isWord(offset)) throw new Error('Invalid slot motion offset');
      const index = slotIndex(offset);
      if (index < 0) return { handled: false, reason: 'slot_window_required' };
      const fields = Object.fromEntries(
        Object.entries(columns).map(([key, values]) => [key, values[index]]),
      );
      const plan = prepareMotionHelper80B2({ offset, fields, motionData });
      if (!plan.handled) return plan;
      Object.assign(motionHelperScratch, plan.scratchWords);
      return { handled: true, value: plan.value, carry: plan.carry };
    },
    stepMotionHelper8133(offset) {
      if (!isWord(offset)) throw new Error('Invalid slot motion offset');
      const index = slotIndex(offset);
      if (index < 0) return { handled: false, reason: 'slot_window_required' };
      const fields = Object.fromEntries(
        Object.entries(columns).map(([key, values]) => [key, values[index]]),
      );
      const plan = prepareMotionHelper8133({ offset, fields, motionData });
      if (!plan.handled) return plan;
      Object.assign(motionHelperScratch, plan.scratchWords);
      return { handled: true, value: plan.value, carry: plan.carry };
    },
    stepMotionHelper81B4(offset) {
      if (!isWord(offset)) throw new Error('Invalid slot motion offset');
      const index = slotIndex(offset);
      if (index < 0) return { handled: false, reason: 'slot_window_required' };
      const fields = Object.fromEntries(
        Object.entries(columns).map(([key, values]) => [key, values[index]]),
      );
      const plan = prepareMotionHelper81B4({ offset, fields, motionData });
      if (!plan.handled) return plan;
      Object.assign(motionHelperScratch, plan.scratchWords);
      return { handled: true, value: plan.value, carry: plan.carry };
    },
    stepMotionHelper8238(offset) {
      if (!isWord(offset)) throw new Error('Invalid slot motion offset');
      const index = slotIndex(offset);
      if (index < 0) return { handled: false, reason: 'slot_window_required' };
      const fields = Object.fromEntries(
        Object.entries(columns).map(([key, values]) => [key, values[index]]),
      );
      const plan = prepareMotionHelper8238({ offset, fields, motionData });
      if (!plan.handled) return plan;
      Object.assign(motionHelperScratch, plan.scratchWords);
      return { handled: true, value: plan.value, carry: plan.carry };
    },
    stepMotionHelper82BC(offset) {
      if (!isWord(offset)) throw new Error('Invalid slot motion offset');
      const index = slotIndex(offset);
      if (index < 0) return { handled: false, reason: 'slot_window_required' };
      const fields = Object.fromEntries(
        Object.entries(columns).map(([key, values]) => [key, values[index]]),
      );
      const plan = prepareMotionHelper82BC({ offset, fields, motionData });
      if (!plan.handled) return plan;
      Object.assign(motionHelperScratch, plan.scratchWords);
      return { handled: true, value: plan.value, carry: plan.carry };
    },
    stepMotionHelperC9E0(offset, options = {}) {
      if (!isWord(offset)) throw new Error('Invalid slot motion offset');
      const index = slotIndex(offset);
      if (index < 0) return { handled: false, reason: 'slot_window_required' };
      const context = motionContext(index, options);
      const fields = Object.fromEntries(
        Object.entries(columns).map(([key, values]) => [key, values[index]]),
      );
      const plan = prepareMotionHelperC9E0({ ...context, offset, fields });
      return commitMotionPlan(index, plan, context.frameAllocator);
    },
    stepMotion(offset, options = {}) {
      if (!isWord(offset)) throw new Error('Invalid slot motion offset');
      const index = slotIndex(offset);
      if (index < 0) return { handled: false, reason: 'slot_window_required' };
      const context = motionContext(index, options);
      const fields = Object.fromEntries(
        Object.entries(columns).map(([key, values]) => [key, values[index]]),
      );
      const plan = prepareSlotMotion(fields, { ...context, offset, motionData });
      return commitMotionPlan(index, plan, context.frameAllocator);
    },
    snapshot() {
      return {
        motionSource: {
          scratchWord6B: motionScratchWord6B,
          helperScratchWords: { ...motionHelperScratch },
          preludeScratchWords: { ...motionPreludeScratch },
          postpassScratchWords: { ...motionPostpassScratch },
          scratchWord40Bytes: [...motionScratchBytes40],
          scratchWord40: motionScratchBytes40.includes(null)
            ? null
            : motionScratchBytes40[0] | (motionScratchBytes40[1] << BYTE_BITS),
        },
        targetSource: { pointerF3, scratchWords: { ...targetScratch } },
        definitions: [...definitions],
        counts: [...counts],
        heads: [...heads],
        columns: Object.fromEntries(
          Object.entries(columns).map(([key, values]) => [key, [...values]]),
        ),
        fieldBytes: { '11F0': fieldBytes.map((bytes) => [...bytes]) },
        activeList: { lastOffset, entries: [...entries] },
        pool: { freeCount, freeHead, links: [...links] },
      };
    },
    applyNative(request, { prepareTask = null, workspaceWords = null } = {}) {
      if (request?.nativeId === SCRIPT_NATIVE.RESET_MOTION_PREFIX) {
        if (!Array.isArray(request.args) || request.args.length !== 0 || request.returnBytes !== 0)
          throw Error('Slot native ABI mismatch');
        const result = state.resetMotionPrefix88({ bank: CODE_BANK });
        return result.handled ? { handled: true, value: null } : result;
      }
      if (request?.nativeId === SCRIPT_NATIVE.TARGET_MOTION) {
        if (
          !Array.isArray(request.args) ||
          request.args.length !== 2 ||
          Array.from(request.args).some((value) => !isWord(value)) ||
          request.returnBytes !== 2
        )
          throw new Error('Slot native ABI mismatch');
        const index = slotIndex(request.args[0]);
        if (index < 0) return { handled: false, reason: 'slot_window_required' };
        if (!targetData) return { handled: false, reason: 'slot_target_data_source_required' };
        if (pointerF3 === null)
          return { handled: false, reason: 'slot_target_pointer_source_required' };
        const recordIndex = slotTargetIndex(request.args[1]);
        const recordWords = [];
        for (let i = 0; i < AXIS_COUNT; i++) {
          const read = targetData.readWord(pointerF3, (recordIndex + i * 2) & WORD_MASK);
          if (!read.available) return { handled: false, reason: read.reason };
          recordWords.push(read.value);
        }
        const currentWords = ['0E28', '0E80', '0ED8'].map((key) => columns[key][index]);
        if (currentWords.includes(null)) return { handled: false, reason: 'slot_source_required' };
        // Preflight every bounded source before committing game-data writes.
        // No record-count or occupancy guard exists in this original native.
        const plan = calculateSlotTargetMotion({ recordWords, currentWords });
        for (const [key, value] of Object.entries(plan.fields)) writeField(key, index, value);
        Object.assign(targetScratch, plan.scratchWords);
        return {
          handled: true,
          value: plan.value,
          workspaceWords: [plan.value, request.args[1], 1],
        };
      }
      if (request?.nativeId === SCRIPT_NATIVE.WRITE_SLOT_COORDINATES) {
        if (
          !Array.isArray(request.args) ||
          request.args.length !== COORDINATE_ARGUMENT_WORDS ||
          Array.from(request.args).some((value) => !isWord(value)) ||
          request.returnBytes !== 0
        )
          throw new Error('Slot native ABI mismatch');
        const index = slotIndex(request.args[0]);
        if (index < 0) return { handled: false, reason: 'slot_window_required' };
        // D14A-D15B copies three words verbatim. Unlike A9, no scaling,
        // 0F30 update, old-field read or occupancy test occurs here.
        ['0E28', '0E80', '0ED8'].forEach((key, i) => writeField(key, index, request.args[i + 1]));
        return { handled: true, value: null, workspaceWords: [...request.args] };
      }
      if (Object.hasOwn(readFields, request?.nativeId)) {
        if (
          !Array.isArray(request.args) ||
          request.args.length !== 1 ||
          !isWord(request.args[0]) ||
          request.returnBytes !== 2
        )
          throw new Error('Slot native ABI mismatch');
        const index = slotIndex(request.args[0]);
        if (index < 0) return { handled: false, reason: 'slot_window_required' };
        const field = columns[readFields[request.nativeId]][index];
        if (field === null) return { handled: false, reason: 'slot_source_required' };
        const value = field >>> 2;
        return { handled: true, value, workspaceWords: [value] };
      }
      if (request?.nativeId === SCRIPT_NATIVE.READ_SLOT_RECORD_FLAGS) {
        if (
          !Array.isArray(request.args) ||
          request.args.length !== 1 ||
          !isWord(request.args[0]) ||
          request.returnBytes !== 2
        )
          throw new Error('Slot native ABI mismatch');
        const index = slotIndex(request.args[0]);
        if (index < 0) return { handled: false, reason: 'slot_window_required' };
        const pointer = columns['13A8'][index];
        if (pointer === null) return { handled: false, reason: 'slot_source_required' };
        // $CA3F is a long word read at 7E:0001+X, not a byte read or a
        // wrapped 16-bit address. Initially A9's pointer=0 aliases scratch.
        const address = pointer + 1;
        if (address + 1 >= NATIVE_WORKSPACE_BYTES)
          return { handled: false, reason: 'slot_record_window_required' };
        if (workspaceWords === null)
          return { handled: false, reason: 'slot_record_workspace_required' };
        if (
          !Array.isArray(workspaceWords) ||
          workspaceWords.length !== NATIVE_WORKSPACE_WORDS ||
          Array.from(workspaceWords).some((word) => word !== null && !isWord(word)) ||
          workspaceWords[0] !== request.args[0]
        )
          throw new Error('Invalid slot record workspace source');
        if ([address, address + 1].some((byte) => workspaceWords[byte >>> 1] === null))
          return { handled: false, reason: 'slot_record_source_required' };
        const value = (workspaceWords[address >>> 1] >>> ((address & 1) * BYTE_BITS)) & BYTE_MASK;
        return { handled: true, value, workspaceWords: [value] };
      }
      if (request?.nativeId === SCRIPT_NATIVE.OR_SLOT_FLAGS) {
        if (
          !Array.isArray(request.args) ||
          request.args.length !== 2 ||
          Array.from(request.args).some((value) => !isWord(value)) ||
          request.returnBytes !== 0
        )
          throw new Error('Slot native ABI mismatch');
        const [offset, mask] = request.args;
        const index = slotIndex(offset);
        if (index < 0) return { handled: false, reason: 'slot_window_required' };
        if (columns['1458'][index] === null)
          return { handled: false, reason: 'slot_source_required' };
        columns['1458'][index] |= mask;
        return { handled: true, value: null, workspaceWords: [...request.args] };
      }
      if (
        [SCRIPT_NATIVE.SET_SLOT_INDEX, SCRIPT_NATIVE.SELECT_SLOT_AND_SET_INDEX].includes(
          request?.nativeId,
        )
      ) {
        const isD2 = request.nativeId === SCRIPT_NATIVE.SELECT_SLOT_AND_SET_INDEX;
        if (
          !Array.isArray(request.args) ||
          request.args.length !== (isD2 ? SELECTION_ARGUMENT_WORDS : 2) ||
          Array.from(request.args).some((value) => !isWord(value)) ||
          request.returnBytes !== 0
        )
          throw new Error('Slot native ABI mismatch');
        const [offset] = request.args;
        const index = slotIndex(offset);
        if (index < 0) return { handled: false, reason: 'slot_window_required' };
        const fields = Object.fromEntries(
          Object.entries(columns).map(([key, values]) => [key, values[index]]),
        );
        const definitionWord = definitions[index];
        let plan;
        if (isD2) {
          const first = prepareSlotSelection({
            selectionWord: request.args[1],
            currentSelection: fields['1038'],
            definitionWord,
            currentIndex: fields['1198'],
            actionData,
          });
          if (!first.handled) return first;
          const intermediate = { ...fields, ...first.fields };
          const lowByte = Object.hasOwn(first.fields, '11F0')
            ? first.fields['11F0'] & BYTE_MASK
            : fieldBytes[index][0];
          const second = prepareSlotAction6A({
            offset,
            nextWord: request.args[2],
            definitionWord,
            fields: intermediate,
            lowByte,
            actionData,
          });
          if (!second.handled) return second;
          // D163/D167 restore slot and original third argument only. Word 2
          // is still A985's record pointer, or the original third argument
          // when A985 returned on equality. No global scratch restoration.
          const workspaceWords = first.workspaceWords
            ? [...first.workspaceWords]
            : [...request.args];
          workspaceWords[0] = offset;
          workspaceWords[1] = request.args[2];
          for (let i = 0; i < second.workspaceWords.length; i++)
            workspaceWords[i] = second.workspaceWords[i];
          plan = { ...second, fields: { ...first.fields, ...second.fields }, workspaceWords };
          if (second.workspaceWrites && workspaceWords.length === SELECTION_WORKSPACE_WORDS) {
            for (const write of second.workspaceWrites) workspaceWords[write.index] = write.value;
            delete plan.workspaceWrites;
          }
        } else
          plan = prepareSlotAction6A({
            offset,
            nextWord: request.args[1],
            definitionWord,
            fields,
            lowByte: fieldBytes[index][0],
            actionData,
          });
        if (!plan.handled) return plan;
        // Coverage of both D2 phases is required before any host field writes.
        // This preflight is a port boundary, not original rollback semantics.
        for (const [key, value] of Object.entries(plan.fields)) writeField(key, index, value);
        if (Object.hasOwn(plan, 'lowByte')) writeByte(index, 0, plan.lowByte);
        return {
          handled: true,
          value: null,
          workspaceWords: plan.workspaceWords,
          ...(plan.workspaceWrites ? { workspaceWrites: plan.workspaceWrites } : {}),
        };
      }
      if (request?.nativeId === SCRIPT_NATIVE.CREATE_SLOT) {
        if (
          !Array.isArray(request.args) ||
          request.args.length !== CREATE_SLOT_WORDS ||
          Array.from(request.args).some((value) => !isWord(value)) ||
          request.returnBytes !== 2
        )
          throw new Error('Slot native ABI mismatch');
        const [definitionWord, first, second, third, scriptWord] = request.args;
        const index = definitions.findLastIndex((value) => value & WORD_SIGN);
        // A83C returns without writing $00: preserve the first pop argument.
        if (index < 0)
          return { handled: true, value: definitionWord, workspaceWords: [...request.args] };
        // No partial creation when its later task-spawn path is not ported.
        if (!(scriptWord & WORD_SIGN) && !prepareTask)
          return { handled: false, reason: 'slot_task_creation_required' };
        if (!definitionData) return { handled: false, reason: 'slot_definition_source_required' };
        const definition = definitionData.lookup(definitionWord);
        if (!definition.available) return { handled: false, reason: definition.reason };
        const nextOffset = (lastOffset + 2) & WORD_MASK;
        if (nextOffset > OBJECT_LAST_SLOT)
          return { handled: false, reason: 'slot_list_window_required' };
        const workspaceWords = [
          index * 2,
          (definitionWord * 2) & WORD_MASK,
          second,
          third,
          scriptWord,
        ];
        const prepared = scriptWord & WORD_SIGN ? null : prepareTask(request, workspaceWords);
        if (prepared && !prepared.prepared) return { handled: false, reason: prepared.reason };
        const scaledFirst = (first * COORDINATE_SCALE) & WORD_MASK;
        const scaledSecond = (second * COORDINATE_SCALE) & WORD_MASK;
        const values = {
          ...resetValues,
          ...Object.fromEntries(creationZeros.map((key) => [key, 0])),
          '0E28': scaledFirst,
          '0E80': scaledSecond,
          '0ED8': (third * COORDINATE_SCALE) & WORD_MASK,
          '0F30': ((scaledFirst + scaledSecond) & WORD_MASK) >>> 1,
          '150A': WORD_MASK,
          [SLOT_FLAGS_FIELD]: definition.value,
        };
        definitions[index] = definitionWord;
        counts[index] = heads[index] = 0;
        for (const [key, value] of Object.entries(values)) columns[key][index] = value;
        // BMI to A8F4 bypasses C366 and the write to 1350. Keep its old word.
        lastOffset = nextOffset;
        entries[nextOffset / 2] = index * 2;
        // A8E1/A8E4 append the game-data entry before the task allocation.
        // Genuine allocation failures retain these effects and stop at their
        // already documented continuation boundary; do not roll them back.
        if (prepared) columns['1350'][index] = prepared.spawn();
        return { handled: true, value: index * 2, workspaceWords };
      }
      if (request?.nativeId !== SCRIPT_NATIVE.RELEASE_SLOT)
        return { handled: false, reason: 'native_implementation_required' };
      if (
        !Array.isArray(request.args) ||
        request.args.length !== 1 ||
        !isWord(request.args[0]) ||
        request.returnBytes !== 0
      )
        throw new Error('Slot native ABI mismatch');
      const [offset] = request.args;
      const index = slotIndex(offset);
      if (index < 0) return { handled: false, reason: 'slot_window_required' };
      if (counts[index] === null) return { handled: false, reason: 'slot_source_required' };
      // The original reverse search has no missing-entry guard. An absent
      // entry would escape this modeled list, so retain the request instead.
      let found = -1;
      const lastIndex = lastOffset === EMPTY_LIST ? -1 : lastOffset / 2;
      for (let i = lastIndex; i >= 0; i--)
        if (entries[i] === offset) {
          found = i;
          break;
        }
      if (found < 0) return { handled: false, reason: 'slot_membership_required' };
      // Simulate just the game-data list operations on a private copy first.
      // Missing source coverage must not leave half a completed native action.
      const nextLinks = [...links];
      let head = heads[index];
      let nextFreeHead = freeHead;
      for (let remaining = counts[index]; remaining > 0; remaining--) {
        if (head === null) return { handled: false, reason: 'slot_source_required' };
        const node = poolIndex(head);
        if (node < 0) return { handled: false, reason: 'pool_window_required' };
        const next = nextLinks[node];
        nextLinks[node] = nextFreeHead;
        nextFreeHead = head;
        head = next;
      }
      for (const [key, value] of Object.entries(resetValues)) columns[key][index] = value;
      if (counts[index] !== 0) {
        freeCount = (freeCount + counts[index]) & WORD_MASK;
        freeHead = nextFreeHead;
        links = nextLinks;
        heads[index] = head; // Retain the actual final link; do not force zero.
        counts[index] = 0;
      }
      definitions[index] = NO_DEFINITION;
      lastOffset = (lastOffset - 2) & WORD_MASK;
      // Source shifts the suffix left, but never clears the stale final word.
      for (let i = found; i < lastIndex; i++) entries[i] = entries[i + 1];
      return { handled: true, value: null };
    },
  };
  instances.add(state);
  return state;
}
