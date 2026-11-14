import {proveLeafSource} from './task-native-leaf-source.mjs';
import {releaseLeafSpec} from './task-native-release-spec.mjs';
export const prove=map=>proveLeafSource(map,releaseLeafSpec);
