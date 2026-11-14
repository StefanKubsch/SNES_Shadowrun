import {proveLeafSource} from './task-native-leaf-source.mjs';
import {taskLeafSpecs} from './task-native-leaf-specs.mjs';
export const prove=map=>[proveLeafSource(map,taskLeafSpecs.find(s=>s.name==='native-d9a0'))];
