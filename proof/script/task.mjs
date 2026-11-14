import { BYTE_MASK, WORD_MASK, NIBBLE_BITS } from '../../src/constants/bits.mjs';
import { OBJECT_LAST_SLOT } from '../../src/task/wram.mjs';
import { SCRIPT_RESUME } from '../../src/vm/layout.mjs';
import { DEFAULT_STEP_BUDGET, compileScriptFrame, isWord, validateStepBudget } from './runtime.mjs';
import { isTaskFrameAllocator } from './task-frames.mjs';

// Native IDs follow proof/state/{script-words,script-state,slots,ac-state}.mjs.
// WRITE_ACTION_WORDS names the two writes of 56 without assigning scene meaning.
export const SCRIPT_NATIVE = Object.freeze({
  READ_SLOT_RECORD_FLAGS: 0x02,
  AND_STATE_WORD: 0x03,
  WRITE_STATE_WORD: 0x12,
  READ_SLOT_X: 0x4f,
  READ_SLOT_Y: 0x50,
  READ_SLOT_Z: 0x51,
  WRITE_ACTION_WORDS: 0x56,
  READ_STATE_WORD: 0x57,
  SET_SLOT_INDEX: 0x6a,
  WRITE_SLOT_COORDINATES: 0x83,
  RESET_MOTION_PREFIX: 0x88,
  OR_STATE_WORD: 0x9b,
  WAIT: 0x9f,
  CREATE_SLOT: 0xa9,
  AC_STATE: 0xac,
  RELEASE_SLOT: 0xb9,
  OR_SLOT_FLAGS: 0xcf,
  SELECT_SLOT_AND_SET_INDEX: 0xd2,
  TARGET_MOTION: 0xd9,
});
export const DEFAULT_CALL_DEPTH = 64;
const MAX_CALL_DEPTH = 1024;
const SCRIPT_CHILD_RETURN_WORD = SCRIPT_RESUME - 1;
// Completion bounds of slot-target-motion.mjs and slots.mjs, respectively.
const TARGET_MOTION_MAX_RESULT = WORD_MASK >>> NIBBLE_BITS;
const SLOT_COORDINATE_MAX_RESULT = WORD_MASK >>> 2;
const TARGET_WORKSPACE_WORDS = 3;
const COORDINATE_ARGUMENT_WORDS = 4;
const SELECTION_ARGUMENT_WORDS = 3;
const SELECTION_WORKSPACE_WORDS = 6;
export const CREATE_SLOT_WORDS = 5;
export const CREATE_ARG = Object.freeze({ THIRD: 3, SCRIPT: 4 });
// slot-selection.mjs and slot-action-6a.mjs carry action pointers in bank 8C.
const ACTION_DATA_BANK = 0x8c;
const ACTION_POINTER_WORD = 4;
const ACTION_BANK_WORD = 5;
const SELECTION_RECORD_BANK_WORD = 3;
const SELECTION_BANK_WORDS = [1, 3, 5];
// C3CE/C3D0 skip reserved blocking bits; C3D8 selects external event bits.
const WAIT_RESERVED_MASK = 0x9000;
const WAIT_EVENT_MASK = 0x6ffe;

export function validateNativeDispatchObserver(observer) {
  if (observer !== null && typeof observer !== 'function')
    throw new Error('Invalid native dispatch observer');
}

export function validateNativeResponse(pending, value, workspace = null, workspaceWrites = null) {
  if (pending.returnBytes ? !isWord(value) : value !== null)
    throw new Error('Native return value does not match profile');
  if (
    workspaceWrites !== null &&
    (![SCRIPT_NATIVE.SET_SLOT_INDEX, SCRIPT_NATIVE.SELECT_SLOT_AND_SET_INDEX].includes(
      pending.nativeId,
    ) ||
      workspace === null ||
      !Array.isArray(workspaceWrites) ||
      workspaceWrites.length !== 2 ||
      Array.from(workspaceWrites).some(
        (write, index) =>
          !write ||
          write.index !== index + ACTION_POINTER_WORD ||
          !isWord(write.value) ||
          (index === 1 && write.value !== ACTION_DATA_BANK),
      ))
  )
    throw new Error('Invalid slot completion workspace writes');
  if (workspace === null) return;
  const original = pending.args;
  if (pending.nativeId === SCRIPT_NATIVE.TARGET_MOTION) {
    if (
      pending.returnBytes !== 2 ||
      original.length !== 2 ||
      value < 1 ||
      value > TARGET_MOTION_MAX_RESULT ||
      !Array.isArray(workspace) ||
      workspace.length !== TARGET_WORKSPACE_WORDS ||
      Array.from(workspace).some(
        (word, index) => !isWord(word) || word !== [value, original[1], 1][index],
      )
    )
      throw new Error('Invalid D9 completion workspace');
    return;
  }
  if (pending.nativeId === SCRIPT_NATIVE.WRITE_SLOT_COORDINATES) {
    if (
      pending.returnBytes !== 0 ||
      original.length !== COORDINATE_ARGUMENT_WORDS ||
      !Array.isArray(workspace) ||
      workspace.length !== COORDINATE_ARGUMENT_WORDS ||
      Array.from(workspace).some((word, index) => !isWord(word) || word !== original[index])
    )
      throw new Error('Invalid slot completion workspace');
    return;
  }
  if (pending.nativeId === SCRIPT_NATIVE.AC_STATE) {
    if (
      pending.returnBytes !== 0 ||
      original.length !== 1 ||
      !Array.isArray(workspace) ||
      workspace.length !== 1 ||
      workspace[0] !== original[0]
    )
      throw new Error('Invalid AC completion workspace');
    return;
  }
  if (
    [
      SCRIPT_NATIVE.READ_SLOT_RECORD_FLAGS,
      SCRIPT_NATIVE.READ_SLOT_X,
      SCRIPT_NATIVE.READ_SLOT_Y,
      SCRIPT_NATIVE.READ_SLOT_Z,
    ].includes(pending.nativeId)
  ) {
    if (
      pending.returnBytes !== 2 ||
      original.length !== 1 ||
      value >
        (pending.nativeId === SCRIPT_NATIVE.READ_SLOT_RECORD_FLAGS
          ? BYTE_MASK
          : SLOT_COORDINATE_MAX_RESULT)
    )
      throw new Error('Invalid slot record return value');
    if (!Array.isArray(workspace) || workspace.length !== 1 || workspace[0] !== value)
      throw new Error('Invalid slot completion workspace');
    return;
  }
  if (pending.nativeId === SCRIPT_NATIVE.SELECT_SLOT_AND_SET_INDEX) {
    const restored =
      Array.isArray(workspace) &&
      workspace.length === SELECTION_ARGUMENT_WORDS &&
      Array.from(workspace).every(
        (word, index) => isWord(word) && word === (index === 0 ? original[0] : original[2]),
      );
    const full =
      Array.isArray(workspace) &&
      workspace.length === SELECTION_WORKSPACE_WORDS &&
      Array.from(workspace).every(isWord) &&
      workspace[SELECTION_RECORD_BANK_WORD] === ACTION_DATA_BANK &&
      workspace[ACTION_BANK_WORD] === ACTION_DATA_BANK &&
      workspaceWrites === null &&
      (workspace[1] === ACTION_DATA_BANK ||
        (workspace[0] === original[0] && workspace[1] === original[2]));
    if (
      pending.returnBytes !== 0 ||
      original.length !== SELECTION_ARGUMENT_WORDS ||
      !(restored || full)
    )
      throw new Error('Invalid slot completion workspace');
    return;
  }
  if ([SCRIPT_NATIVE.SET_SLOT_INDEX, SCRIPT_NATIVE.OR_SLOT_FLAGS].includes(pending.nativeId)) {
    const unchanged =
      Array.isArray(workspace) &&
      workspace.length === 2 &&
      Array.from(workspace).every((word, index) => isWord(word) && word === original[index]);
    const helper =
      pending.nativeId === SCRIPT_NATIVE.SET_SLOT_INDEX &&
      Array.isArray(workspace) &&
      workspace.length === SELECTION_WORKSPACE_WORDS &&
      Array.from(workspace).every(isWord) &&
      SELECTION_BANK_WORDS.every((index) => workspace[index] === ACTION_DATA_BANK) &&
      workspaceWrites === null;
    if (pending.returnBytes !== 0 || original.length !== 2 || !(unchanged || helper))
      throw new Error('Invalid slot completion workspace');
    return;
  }
  const success = [
    value,
    (original[0] * 2) & WORD_MASK,
    original[2],
    original[CREATE_ARG.THIRD],
    original[CREATE_ARG.SCRIPT],
  ];
  const matches = (expected) => workspace.every((word, index) => word === expected[index]);
  if (
    pending.nativeId !== SCRIPT_NATIVE.CREATE_SLOT ||
    !Array.isArray(workspace) ||
    workspace.length !== CREATE_SLOT_WORDS ||
    Array.from(workspace).some((word) => !isWord(word)) ||
    !(
      (value === original[0] && matches(original)) ||
      (value <= OBJECT_LAST_SLOT && !(value & 1) && matches(success))
    )
  )
    throw new Error('Invalid slot completion workspace');
}

// One cooperative call chain. scheduler.mjs owns the outer list and cursor;
// a readiness check here still has no implicit wall-clock duration.
export function createScriptTask(
  bundle,
  scriptId,
  args = [],
  { maxDepth = DEFAULT_CALL_DEPTH, frameAllocator = null } = {},
) {
  if (frameAllocator !== null && !isTaskFrameAllocator(frameAllocator))
    throw new Error('Invalid task frame allocator');
  if (
    bundle?.format !== 'shadowrun-e-event-scripts-v1' ||
    !Array.isArray(bundle.scripts) ||
    !Array.isArray(bundle.nativeFunctions)
  )
    throw new Error('Invalid script asset bundle');
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > MAX_CALL_DEPTH)
    throw new Error('Invalid call depth budget');
  const index = (entries, maxId) => {
    const map = new Map();
    for (const entry of entries) {
      if (
        !entry ||
        !Number.isInteger(entry.id) ||
        entry.id < 0 ||
        entry.id > maxId ||
        map.has(entry.id)
      )
        throw new Error('Invalid or duplicate asset ID');
      map.set(entry.id, { ...entry, ...(entry.bytecode ? { bytecode: [...entry.bytecode] } : {}) });
    }
    return map;
  };
  const scripts = index(bundle.scripts, WORD_MASK);
  const natives = index(bundle.nativeFunctions, BYTE_MASK);
  const compiled = new Map();
  const getScript = (id) => {
    const script = scripts.get(id);
    if (!script) throw new Error(`Script ID ${id} not found`);
    if (
      !Number.isInteger(script.argumentBytes) ||
      script.argumentBytes < 0 ||
      script.argumentBytes > BYTE_MASK ||
      script.argumentBytes % 2
    )
      throw new Error('Invalid script argument profile');
    if (!compiled.has(id)) compiled.set(id, compileScriptFrame(script.bytecode, script));
    return { profile: script, createFrame: compiled.get(id) };
  };
  const root = getScript(scriptId);
  const makeFrame = (id, script, values, parent = null) => {
    const validated = script.createFrame(values);
    if (!frameAllocator) return { id, profile: script.profile, frame: validated };
    frameAllocator.validateProfile(script.profile);
    const workspace = values.toReversed();
    frameAllocator.writeWorkspaceWords(workspace);
    const created = frameAllocator.createFrame(id, workspace);
    if (!created.created) throw new Error(created.reason);
    const frame = script.createFrame(created.frame.args, {
      storage: frameAllocator.storageFor(created.taskOffset),
    });
    if (parent) {
      frameAllocator.setCursor(parent.allocation.taskOffset);
      frameAllocator.insertChild(created.taskOffset, SCRIPT_CHILD_RETURN_WORD);
    } else frameAllocator.appendRoot(created.taskOffset);
    return {
      id,
      profile: script.profile,
      frame,
      allocation: { taskOffset: created.taskOffset, blockOffset: created.frame.blockOffset },
    };
  };
  const frames = [makeFrame(scriptId, root, args)];
  let status = 'ready';
  let pending = null;
  let wait = null;
  let result = null;
  let failure = null;
  let steps = 0;
  let checks = 0;
  let nextRequestId = 1;
  const removedFrames = [];
  const current = () => frames.at(-1);
  const resume = (value, returnBytes) => {
    try {
      current().frame.resumeCall(value, returnBytes);
    } catch (error) {
      status = 'faulted';
      failure = error.message;
      throw error;
    }
  };
  const releaseFrame = (entry) => {
    if (!frameAllocator) return;
    frameAllocator.removeFrame(entry.allocation.taskOffset);
    if (frames.length) frameAllocator.resumeParent(current().allocation.taskOffset);
  };
  const snapshot = () => ({
    status,
    scriptId,
    steps,
    checks,
    frames: frames.map(({ id, frame }) => ({ id, ...frame.snapshot() })),
    pending: pending ? { ...pending, args: [...pending.args] } : null,
    wait: wait
      ? {
          ...wait,
          events: frameAllocator
            ? frameAllocator.readWaitEvents(current().allocation.taskOffset)
            : wait.events,
        }
      : null,
    result: result ? { ...result, stack: [...result.stack], locals: result.locals.slice() } : null,
    removedFrames: removedFrames.map((removal) => ({ ...removal })),
    failure,
  });
  const run = ({ maxSteps = DEFAULT_STEP_BUDGET, onNativeDispatch = null } = {}) => {
    validateStepBudget(maxSteps);
    validateNativeDispatchObserver(onNativeDispatch);
    if (status === 'faulted') throw new Error(failure);
    if (status !== 'ready') return snapshot();
    try {
      for (let n = 0; n < maxSteps; n++) {
        if (frameAllocator) frameAllocator.setCursor(current().allocation.taskOffset);
        const { frame, profile, id } = current();
        const event = frame.step();
        if (event.kind === 'step') {
          steps++;
          continue;
        }
        if (event.kind === 'end') {
          steps++;
          if (frameAllocator) frameAllocator.writeWorkspaceWords([event.workspaceWord]);
          releaseFrame(frames.pop());
          if (frames.length) {
            current().frame.resumeCall(event.value, profile.returnBytes);
            continue; // Child END makes its parent runnable in the same pass.
          }
          const { kind, ...completed } = event;
          result = completed;
          status = 'ended';
          return snapshot();
        }
        if (event.kind === 'script_call') {
          if (frames.length >= maxDepth) throw new Error('Script call depth budget exhausted');
          const child = getScript(event.id);
          const count = child.profile.argumentBytes / 2;
          // Validate before removing the parent's arguments. Both script stacks
          // keep bottom-to-top order; the native ABI below is top-to-bottom.
          const childArgs = frame.callArguments(count);
          child.createFrame(childArgs);
          if (frameAllocator) frameAllocator.validateProfile(child.profile);
          frame.enterCall(count);
          frames.push(makeFrame(event.id, child, childArgs, current()));
          steps++;
          continue;
        }
        const native = natives.get(event.id);
        if (!native) throw new Error(`Native function ID ${event.id} not found`);
        if (
          !Number.isInteger(native.argumentWords) ||
          native.argumentWords < 0 ||
          native.argumentWords > BYTE_MASK ||
          ![0, 2].includes(native.returnBytes)
        )
          throw new Error('Invalid native function profile');
        const nativeArgs = frame.callArguments(native.argumentWords).reverse();
        if (
          event.id === SCRIPT_NATIVE.WAIT &&
          (native.argumentWords !== 2 || native.returnBytes !== 2)
        )
          throw new Error('European wait function profile mismatch');
        frame.enterCall(native.argumentWords);
        if (frameAllocator) frameAllocator.writeWorkspaceWords(nativeArgs);
        onNativeDispatch?.(event.id);
        steps++;
        if (event.id === SCRIPT_NATIVE.WAIT && nativeArgs[0] === 0) {
          // $F4E3 writes the popped mask to shared $0000. $C401 yields
          // with status zero, so $C219 removes this frame before another
          // readiness check. $C2BD/$C3A0 never overwrite that shared word.
          // The native continuation is discarded; a script caller, if any,
          // reads zero via $F4B2, according to this child's return profile.
          if (frameAllocator) frameAllocator.registerWait(current().allocation.taskOffset, 0);
          releaseFrame(frames.pop());
          removedFrames.push({
            scriptId: id,
            pc: event.pc,
            reason: 'zero_mask_wait',
            workspaceWord: 0,
            parentReturnBytes: frames.length ? profile.returnBytes : null,
          });
          if (frames.length) {
            current().frame.resumeCall(profile.returnBytes ? 0 : null, profile.returnBytes);
            continue;
          }
          status = 'removed'; // No END instruction and no root result.
          return snapshot();
        }
        if (event.id === SCRIPT_NATIVE.WAIT) {
          if (frameAllocator)
            frameAllocator.registerWait(current().allocation.taskOffset, nativeArgs[0]);
          wait = {
            scriptId: id,
            pc: event.pc,
            mask: nativeArgs[0],
            remaining: nativeArgs[1],
            events: 0,
          };
          status = 'waiting';
        } else {
          // No automatic success for missing gameplay/audio implementations.
          pending = {
            requestId: nextRequestId++,
            scriptId: id,
            pc: event.pc,
            nativeId: event.id,
            args: nativeArgs,
            returnBytes: native.returnBytes,
            reason: 'native_implementation_required',
          };
          status = 'native_call';
        }
        return snapshot();
      }
      throw new Error('Script instruction budget exhausted');
    } catch (error) {
      status = 'faulted';
      failure = error.message;
      throw error;
    }
  };
  return {
    run,
    snapshot,
    readNativeWorkspace(requestId) {
      if (status !== 'native_call' || requestId !== pending.requestId)
        throw new Error('No matching pending native request');
      return frameAllocator ? frameAllocator.snapshot().workspace : null;
    },
    signalEvents(events) {
      if (!isWord(events)) throw new Error('Invalid event word');
      if (status !== 'waiting') throw new Error('Task is not waiting');
      if (frameAllocator) frameAllocator.signalWaitEvents(current().allocation.taskOffset, events);
      else wait.events |= events;
      return snapshot();
    },
    tick(events = 0, options = {}) {
      validateStepBudget(options.maxSteps ?? DEFAULT_STEP_BUDGET);
      validateNativeDispatchObserver(options.onNativeDispatch ?? null);
      if (!isWord(events)) throw new Error('Invalid event word');
      if (status !== 'waiting') throw new Error('Task is not waiting');
      checks++;
      if (frameAllocator) frameAllocator.signalWaitEvents(current().allocation.taskOffset, events);
      else wait.events |= events;
      // $80:C3CE/C3D0: reserved blocking bits skip all readiness checks.
      if (wait.mask & WAIT_RESERVED_MASK) return snapshot();
      const eventWord = frameAllocator
        ? frameAllocator.readWaitEvents(current().allocation.taskOffset)
        : wait.events;
      let value = wait.mask & WAIT_EVENT_MASK & eventWord;
      if (wait.mask & 1) {
        wait.remaining = (wait.remaining - 1) & WORD_MASK;
        if (wait.remaining === 0) value |= 1;
      }
      if (frameAllocator) frameAllocator.writeWorkspaceWords([value]);
      if (!value) return snapshot();
      if (frameAllocator) frameAllocator.readyWait(current().allocation.taskOffset);
      resume(value, 2);
      wait = null;
      status = 'ready';
      return run(options);
    },
    completeNative(requestId, value = null, options = {}) {
      validateStepBudget(options.maxSteps ?? DEFAULT_STEP_BUDGET);
      validateNativeDispatchObserver(options.onNativeDispatch ?? null);
      if (status !== 'native_call' || requestId !== pending.requestId)
        throw new Error('No matching pending native request');
      const workspace = options.workspaceWords ?? null;
      const workspaceWrites = options.workspaceWrites ?? null;
      validateNativeResponse(pending, value, workspace, workspaceWrites);
      if (frameAllocator) {
        // Full workspace effects are known for the base state actions and 88.
        // B9 is proved to retain word 0; other unknown action effects cannot
        // be inferred merely from a return profile or a host acknowledgement.
        if (workspace) frameAllocator.writeWorkspaceWords(workspace);
        else if (
          ![
            SCRIPT_NATIVE.AND_STATE_WORD,
            SCRIPT_NATIVE.WRITE_STATE_WORD,
            SCRIPT_NATIVE.READ_STATE_WORD,
            SCRIPT_NATIVE.OR_STATE_WORD,
            SCRIPT_NATIVE.WRITE_ACTION_WORDS,
            SCRIPT_NATIVE.RESET_MOTION_PREFIX,
          ].includes(pending.nativeId)
        )
          frameAllocator.invalidateWorkspace(pending.nativeId === SCRIPT_NATIVE.RELEASE_SLOT);
        if (pending.returnBytes) frameAllocator.writeWorkspaceWords([value]);
        if (workspaceWrites)
          for (const write of workspaceWrites)
            frameAllocator.writeWorkspaceWords([write.value], write.index);
      }
      resume(value, pending.returnBytes);
      pending = null;
      status = 'ready';
      return run(options);
    },
  };
}
