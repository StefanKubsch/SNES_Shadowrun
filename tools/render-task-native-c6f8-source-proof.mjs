import {proveLeafSource} from './task-native-leaf-source.mjs';import {m1dLeafSpecs} from './task-native-m1d-specs.mjs';
export const prove=map=>proveLeafSource(map,m1dLeafSpecs.find(s=>s.name==='native-c6f8'));
