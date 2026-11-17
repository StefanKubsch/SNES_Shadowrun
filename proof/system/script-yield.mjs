// Register-level script opcode with its argument prefix, used only by the task
// opcode sequence proof; the game runs scripts through src/script/.
import { taskStop } from '../../src/system/task-stop.mjs';
import { runTaskScriptYield } from '../../src/system/script-yield.mjs';
import { runTaskScriptArguments } from './script-arguments.mjs';

export function runTaskScriptOpcode(a, options) {
  const prefix = runTaskScriptArguments(a);
  if (options.expectedScriptId !== undefined && prefix.id !== options.expectedScriptId)
    taskStop('task_script_ID_required');
  return { ...prefix, ...runTaskScriptYield(a, options), argumentPrefixExecuted: true };
}
