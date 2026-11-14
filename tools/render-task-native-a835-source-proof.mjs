import {proveLeafSource} from './task-native-leaf-source.mjs';
import {createNativeSpec} from './task-native-create-spec.mjs';
export const prove=map=>proveLeafSource(map,createNativeSpec);
