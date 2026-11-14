import {proveLeafSource} from './task-native-leaf-source.mjs';
import {nativeCAB4Spec} from './task-native-cab4-spec.mjs';
export const prove=map=>[proveLeafSource(map,nativeCAB4Spec)];
