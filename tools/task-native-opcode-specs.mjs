import { taskLeafSpecs } from './task-native-leaf-specs.mjs';
import { nativeOpcodeTargets } from '../src/data/native-opcode-targets.mjs';
import { provedNativeTargets } from './retired-native-proofs.mjs';

const proved = provedNativeTargets(nativeOpcodeTargets);
export const nativeOpcodeSpecs = Object.freeze(
  [...taskLeafSpecs]
    .sort((a, b) => a.id - b.id)
    .filter((s) => nativeOpcodeTargets.includes(s.entry))
    .map((s) =>
      Object.freeze({
        ...s,
        compositionName: 'native-opcode-' + s.name.slice(7),
        exportName: 'prepareTaskNativeOpcode' + (s.entry & 65535).toString(16).toUpperCase(),
      }),
    ),
);
if (
  nativeOpcodeSpecs.length !== proved.length ||
  new Set(nativeOpcodeSpecs.map((s) => s.entry)).size !== proved.length ||
  proved.some((t) => !nativeOpcodeSpecs.some((s) => s.entry === t))
)
  throw Error('Native58 composition catalog drift');
