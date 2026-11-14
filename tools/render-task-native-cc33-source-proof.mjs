import {proveLeafSource} from './task-native-leaf-source.mjs';
import {fieldLeafSpecs} from './task-native-field-specs.mjs';
export const prove=map=>proveLeafSource(map,fieldLeafSpecs[0]);
