import {proveLeafSource} from './task-native-leaf-source.mjs';
import {selectionNativeSpec} from './task-native-selection-spec.mjs';
export const prove=map=>proveLeafSource(map,selectionNativeSpec);
