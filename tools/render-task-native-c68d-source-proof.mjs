import {proveLeafSource} from './task-native-leaf-source.mjs';
import {nativeC68DSpec} from './task-native-c68d-spec.mjs';
export const prove=map=>proveLeafSource(map,nativeC68DSpec);
