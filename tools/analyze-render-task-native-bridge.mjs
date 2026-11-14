import {emitTaskPartialSource} from './task-partial-source.mjs';
import {continuationSpecs} from './task-native-continuation-specs.mjs';
import {prove} from './render-task-native-bridge-source-proof.mjs';
await emitTaskPartialSource(continuationSpecs.find(s=>s.name==='native-bridge'),prove,[]);
