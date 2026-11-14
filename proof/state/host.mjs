import { DEFAULT_STEP_BUDGET } from '../script/runtime.mjs';
import { SCRIPT_NATIVE } from '../script/task.mjs';
import { validateStepBudget } from '../script/runtime.mjs';
import { isScriptState, isScriptStateNative } from './script-state.mjs';

const DEFAULT_NATIVE_CALL_BUDGET = 256;
const MAX_NATIVE_CALL_BUDGET = 1000000;

// Only source-derived actions supported by the supplied state can be completed.
// Missing actions/data retain the actual pending request, with a host boundary
// explaining why it was not handled. All effects are synchronous game actions.
function drive(
  state,
  begin,
  complete,
  continueSweep,
  { maxSteps = DEFAULT_STEP_BUDGET, maxNativeCalls = DEFAULT_NATIVE_CALL_BUDGET } = {},
  prepareTask = null,
  readWorkspace = null,
) {
  if (!isScriptState(state)) throw new Error('Invalid script word state');
  validateStepBudget(maxSteps);
  if (
    !Number.isInteger(maxNativeCalls) ||
    maxNativeCalls < 1 ||
    maxNativeCalls > MAX_NATIVE_CALL_BUDGET
  )
    throw new Error('Invalid native action budget');
  const options = {
    maxSteps,
    onNativeDispatch: (nativeId) => state.observeNativeDispatch?.(nativeId),
  };
  let execution = begin(options);
  let handledCalls = 0;
  let boundary = null;
  const actions = [];
  while (execution.status === 'native_call') {
    const request = execution.pending;
    if (handledCalls >= maxNativeCalls && isScriptStateNative(state, request.nativeId))
      throw new Error('Native action budget exhausted');
    const response = state.applyNative(request, {
      prepareTask,
      ...(request.nativeId === SCRIPT_NATIVE.READ_SLOT_RECORD_FLAGS
        ? { workspaceWords: readWorkspace ? readWorkspace(request) : null }
        : {}),
    });
    if (!response.handled) {
      boundary = { nativeId: request.nativeId, reason: response.reason };
      break;
    }
    execution = complete(request, response.value, {
      ...options,
      ...(response.workspaceWords ? { workspaceWords: response.workspaceWords } : {}),
      ...(response.workspaceWrites ? { workspaceWrites: response.workspaceWrites } : {}),
    });
    handledCalls++;
    actions.push({
      nativeId: request.nativeId,
      args: [...request.args],
      value: response.value,
      requestId: request.requestId,
      ...(request.taskId === undefined ? {} : { taskId: request.taskId }),
    });
    // Completing a native action does not finish a suspended reverse pass.
    // Continue its existing cursor, once, without starting a second sweep.
    if (continueSweep && request.operation === 'sweep' && execution.status !== 'native_call')
      execution = continueSweep(options);
  }
  return { execution, state: state.snapshot(), handledCalls, actions, boundary };
}

export function runTaskWithState(task, state, options = {}) {
  return drive(
    state,
    (opts) => task.run(opts),
    (request, value, opts) => task.completeNative(request.requestId, value, opts),
    null,
    options,
    null,
    (request) => task.readNativeWorkspace(request.requestId),
  );
}

export function visitTailWithState(scheduler, state, options = {}) {
  return drive(
    state,
    (opts) => scheduler.visitTail(opts),
    (request, value, opts) =>
      scheduler.completeNative(request.taskId, request.requestId, value, opts),
    (opts) => scheduler.sweep(opts),
    options,
    (request, words) => scheduler.prepareNativeTask(request, words),
    (request) => scheduler.readNativeWorkspace(request),
  );
}

export function sweepWithState(scheduler, state, options = {}) {
  return drive(
    state,
    (opts) => scheduler.sweep(opts),
    (request, value, opts) =>
      scheduler.completeNative(request.taskId, request.requestId, value, opts),
    (opts) => scheduler.sweep(opts),
    options,
    (request, words) => scheduler.prepareNativeTask(request, words),
    (request) => scheduler.readNativeWorkspace(request),
  );
}
