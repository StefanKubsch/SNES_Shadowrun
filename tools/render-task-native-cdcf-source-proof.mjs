import {proveLeafSource} from './task-native-leaf-source.mjs';
import {nativeCDCFSpec} from './task-native-cdcf-spec.mjs';
export const prove=map=>[proveLeafSource(map,nativeCDCFSpec)];
