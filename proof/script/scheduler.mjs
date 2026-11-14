import { WORD_MASK, WORD_SIGN } from '../../src/constants/bits.mjs';
import { OBJECT_LAST_SLOT } from '../../src/task/wram.mjs';
import {
  createScriptTask,
  DEFAULT_CALL_DEPTH,
  SCRIPT_NATIVE,
  CREATE_SLOT_WORDS,
  CREATE_ARG,
  validateNativeResponse,
  validateNativeDispatchObserver,
} from './task.mjs';
import { DEFAULT_STEP_BUDGET, compileScriptFrame, isWord, validateStepBudget } from './runtime.mjs';
import { isTaskFrameAllocator } from './task-frames.mjs';

const NO_TASK = WORD_MASK;

// Native game scheduling, derived from $80:C1CA/C1E3/C34A. No CPU execution
// or browser/frame timer. Roots append to the list; each call chain represents
// contiguous parent/child nodes, traversed from the tail towards predecessors.
export function createScriptScheduler(
  bundle,
  { maxDepth = DEFAULT_CALL_DEPTH, frameAllocator = null } = {},
) {
  if (frameAllocator !== null && !isTaskFrameAllocator(frameAllocator))
    throw new Error('Invalid task frame allocator');
  const roots = [];
  let nextId = 1;
  let cursor = null; // $0250 is initially $FFFF, even after appending a root.
  let suspended = null;
  let failure = null;
  let visits = [];
  let slotSpawnRequest = null;
  const get = (id) => {
    const entry = roots.find((root) => root.taskId === id);
    if (!entry) throw new Error('Task ID not found');
    return entry;
  };
  const leaf = (entry) => ({
    taskId: entry.taskId,
    depth: entry.task.snapshot().frames.length - 1,
  });
  const tail = () => (roots.length ? leaf(roots.at(-1)) : null);
  const predecessor = (entry, depth) => {
    if (depth > 0) return { taskId: entry.taskId, depth: depth - 1 };
    const index = roots.indexOf(entry);
    return index > 0 ? leaf(roots[index - 1]) : null;
  };
  const snapshot = () => ({
    status: failure ? 'faulted' : suspended ? 'native_call' : roots.length ? 'ready' : 'idle',
    cursor: cursor ? { ...cursor } : null,
    pending: suspended
      ? {
          taskId: suspended.taskId,
          operation: suspended.operation,
          ...get(suspended.taskId).task.snapshot().pending,
        }
      : null,
    tasks: roots.map((entry) => ({ taskId: entry.taskId, ...entry.task.snapshot() })),
    visits: visits.map((visit) => ({
      ...visit,
      removedFrames: visit.removedFrames.map((removal) => ({ ...removal })),
    })),
    failure,
    ...(frameAllocator ? { memory: frameAllocator.snapshot() } : {}),
  });
  const syncCursor = () => {
    if (!frameAllocator) return;
    const offset = cursor
      ? get(cursor.taskId).task.snapshot().frames[cursor.depth]?.memory.taskOffset
      : NO_TASK;
    if (offset === undefined) throw new Error('Original cursor frame is missing');
    frameAllocator.setCursor(offset);
  };
  const assertHealthy = () => {
    if (failure) throw new Error(failure);
  };
  const finish = (entry, depth, state, operation) => {
    // In the machine routine any negative post-run status takes the child
    // path ($C211 -> $C239). Arbitrary bit-15 masks require a fuller model.
    if (state.wait?.mask & WORD_SIGN)
      throw new Error('Negative wait mask requires original successor execution');
    visits.push({
      taskId: entry.taskId,
      depth,
      status: state.status,
      checks: state.checks,
      value: state.result?.value ?? null,
      removedFrames: state.removedFrames,
    });
    if (state.status === 'native_call') {
      suspended = { taskId: entry.taskId, depth, operation };
      return;
    }
    // After a yielded child, $C213 selects its predecessor (the parent).
    // END already resumes blocked parents in task.mjs before returning here.
    const finished = state.status === 'ended' || state.status === 'removed';
    const next = predecessor(entry, finished ? 0 : state.frames.length - 1);
    if (finished) {
      // Keep the outer cursor valid when removing a root ($C3AC).
      if (cursor?.taskId === entry.taskId) cursor = next;
      roots.splice(roots.indexOf(entry), 1);
    }
    if (operation === 'sweep') cursor = next;
    syncCursor();
  };
  const visit = (node, operation, options) => {
    const entry = get(node.taskId);
    const state = entry.task.snapshot();
    if (frameAllocator) frameAllocator.setCursor(state.frames[node.depth].memory.taskOffset);
    if (node.depth < state.frames.length - 1) {
      // A parent waiting for its child has $FFFF status; $C3CE skips it.
      visits.push({
        taskId: entry.taskId,
        depth: node.depth,
        status: 'blocked_parent',
        checks: state.checks,
        value: null,
        removedFrames: [],
      });
      if (operation === 'sweep') cursor = predecessor(entry, node.depth);
      syncCursor();
      return;
    }
    const after =
      state.status === 'waiting' ? entry.task.tick(0, options) : entry.task.run(options);
    finish(entry, node.depth, after, operation);
  };
  const guarded = (action) => {
    try {
      return action();
    } catch (error) {
      failure = error.message;
      throw error;
    }
  };
  return {
    snapshot,
    readNativeWorkspace(request) {
      assertHealthy();
      if (!suspended || request?.taskId !== suspended.taskId)
        throw new Error('No matching suspended task');
      const task = get(request.taskId).task;
      const pending = task.snapshot().pending;
      if (
        request.requestId !== pending.requestId ||
        request.nativeId !== pending.nativeId ||
        request.returnBytes !== pending.returnBytes ||
        !Array.isArray(request.args) ||
        request.args.length !== pending.args.length ||
        Array.from(request.args).some((value, index) => value !== pending.args[index])
      )
        throw new Error('No matching pending native request');
      return task.readNativeWorkspace(request.requestId);
    },
    prepareNativeTask(request, workspaceWords) {
      assertHealthy();
      if (!suspended || request?.taskId !== suspended.taskId)
        throw new Error('No matching suspended task');
      const pending = get(request.taskId).task.snapshot().pending;
      if (
        pending.requestId !== request.requestId ||
        pending.nativeId !== SCRIPT_NATIVE.CREATE_SLOT ||
        request.nativeId !== SCRIPT_NATIVE.CREATE_SLOT ||
        request.returnBytes !== pending.returnBytes ||
        !Array.isArray(request.args) ||
        request.args.length !== pending.args.length ||
        Array.from(request.args).some((value, index) => value !== pending.args[index])
      )
        throw new Error('No matching slot creation request');
      const { taskId: callerId, requestId: callerRequestId } = request;
      const key = `${callerId}:${callerRequestId}`;
      if (slotSpawnRequest === key) throw new Error('Slot task already created for this request');
      if (!frameAllocator) return { prepared: false, reason: 'slot_task_creation_required' };
      const [definition, , second, third, scriptId] = pending.args;
      if (
        !Array.isArray(workspaceWords) ||
        workspaceWords.length !== CREATE_SLOT_WORDS ||
        !isWord(workspaceWords[0]) ||
        workspaceWords[0] > OBJECT_LAST_SLOT ||
        workspaceWords[0] & 1 ||
        workspaceWords[1] !== ((definition * 2) & WORD_MASK) ||
        workspaceWords[2] !== second ||
        workspaceWords[CREATE_ARG.THIRD] !== third ||
        workspaceWords[CREATE_ARG.SCRIPT] !== scriptId ||
        scriptId & WORD_SIGN
      )
        throw new Error('Invalid slot creation workspace');
      const prefix = [...workspaceWords];
      const workspace = frameAllocator.snapshot().workspace;
      workspace.splice(0, prefix.length, ...prefix);
      const profile = bundle.scripts.find((script) => script.id === scriptId);
      if (!profile) return { prepared: false, reason: 'task_profile_source_required' };
      let args;
      try {
        frameAllocator.validateProfile(profile);
        const count = profile.argumentBytes / 2;
        if (
          !Number.isInteger(count) ||
          count > workspace.length ||
          workspace.slice(0, count).some((value) => value === null)
        )
          return { prepared: false, reason: 'task_argument_source_required' };
        args = workspace.slice(0, count).reverse();
        compileScriptFrame(profile.bytecode, profile)(args);
      } catch (error) {
        return { prepared: false, reason: error.message };
      }
      let used = false;
      return {
        prepared: true,
        spawn: () => {
          assertHealthy();
          if (
            used ||
            slotSpawnRequest === key ||
            !suspended ||
            suspended.taskId !== callerId ||
            get(callerId).task.snapshot().pending?.requestId !== callerRequestId
          )
            throw new Error('Stale slot creation preparation');
          used = true;
          slotSpawnRequest = key;
          return guarded(() => {
            // A9 wrote $00/$02 before C366; C34A appends without a visit.
            frameAllocator.writeWorkspaceWords(prefix);
            const task = createScriptTask(bundle, scriptId, args, { maxDepth, frameAllocator });
            const taskId = nextId++;
            roots.push({ taskId, task });
            return task.snapshot().frames[0].memory.taskOffset;
          });
        },
      };
    },
    addTask(scriptId, args = []) {
      assertHealthy();
      if (suspended) throw new Error('Scheduler is suspended at a native action');
      // Asset/profile/argument validation precedes insertion. This models only
      // $C34A append, not the unimplemented in-game task-creation actions.
      const task = createScriptTask(bundle, scriptId, args, { maxDepth, frameAllocator });
      const taskId = nextId++;
      roots.push({ taskId, task });
      return taskId;
    },
    signalEvents(taskId, events) {
      assertHealthy();
      if (suspended) throw new Error('Scheduler is suspended at a native action');
      return get(taskId).task.signalEvents(events);
    },
    visitTail({ maxSteps = DEFAULT_STEP_BUDGET, onNativeDispatch = null } = {}) {
      assertHealthy();
      validateStepBudget(maxSteps);
      validateNativeDispatchObserver(onNativeDispatch);
      if (suspended) return snapshot();
      const node = tail();
      if (node && get(node.taskId).task.snapshot().status !== 'ready')
        throw new Error('Immediate tail visit requires a newly appended ready root');
      visits = [];
      return guarded(() => {
        if (node) visit(node, 'tail', { maxSteps, onNativeDispatch });
        return snapshot(); // $C1DE restores the saved outer cursor.
      });
    },
    sweep({ maxSteps = DEFAULT_STEP_BUDGET, onNativeDispatch = null } = {}) {
      assertHealthy();
      validateStepBudget(maxSteps);
      validateNativeDispatchObserver(onNativeDispatch);
      if (suspended) return snapshot();
      visits = [];
      return guarded(() => {
        while (cursor) {
          visit(cursor, 'sweep', { maxSteps, onNativeDispatch });
          if (suspended) return snapshot();
        }
        cursor = tail(); // $C1ED: prepare the next sweep, not this one.
        syncCursor();
        return snapshot();
      });
    },
    completeNative(
      taskId,
      requestId,
      value = null,
      {
        maxSteps = DEFAULT_STEP_BUDGET,
        workspaceWords = null,
        workspaceWrites = null,
        onNativeDispatch = null,
      } = {},
    ) {
      assertHealthy();
      validateStepBudget(maxSteps);
      validateNativeDispatchObserver(onNativeDispatch);
      if (!suspended || suspended.taskId !== taskId) throw new Error('No matching suspended task');
      const entry = get(taskId);
      const pending = entry.task.snapshot().pending;
      // Reject invalid host responses without faulting or modifying the list.
      if (pending.requestId !== requestId) throw new Error('No matching pending native request');
      validateNativeResponse(pending, value, workspaceWords, workspaceWrites);
      return guarded(() => {
        const { depth, operation } = suspended;
        const state = entry.task.completeNative(requestId, value, {
          maxSteps,
          workspaceWords,
          workspaceWrites,
          onNativeDispatch,
        });
        suspended = null;
        finish(entry, depth, state, operation);
        // A sweep resumes at its repaired cursor on the next sweep() call;
        // no previously visited waiter is checked again in that continuation.
        return snapshot();
      });
    },
  };
}
