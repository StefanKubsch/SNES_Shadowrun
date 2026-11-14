import {proveLeafSource} from './task-native-leaf-source.mjs';
import {nativeCCA4Spec} from './task-native-cca4-spec.mjs';
export const prove=map=>[proveLeafSource(map,nativeCCA4Spec)];
