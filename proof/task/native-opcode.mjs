import { runTaskNativeArguments } from './native-arguments.mjs';
import { runTaskNativeCall } from './native-dispatch.mjs';
import { nativeOpcodeTargets } from '../../src/task/native-opcode-targets.mjs';

// Source-specific composition over the caller's existing overlay and ledger.
// Neither the argument ID nor the table read substitutes for fresh DP A2.
export function runTaskNativeOpcode(a, options) {
  const argumentsResult = runTaskNativeArguments(a);
  const call = runTaskNativeCall(
    a,
    options.protectedStackBytes,
    nativeOpcodeTargets,
    options.expectedNativeTarget ?? null,
  );
  return {
    ...argumentsResult,
    ...call,
    scope: 'manual-native58-arguments-bridge-leaf-resume-before-F390',
    argumentPrefixExecuted: true,
    stackMigrationExecuted: true,
    fullTaskBinding: false,
  };
}
