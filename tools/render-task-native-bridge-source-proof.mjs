import {proveContinuation} from './task-native-continuation-source.mjs';
import {continuationSpecs} from './task-native-continuation-specs.mjs';
export const prove=map=>proveContinuation(map,continuationSpecs.find(s=>s.name==='native-bridge'));
