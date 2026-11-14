import {emitLeafSource} from './task-native-leaf-source.mjs';
import {taskLeafSpecs} from './task-native-leaf-specs.mjs';
await emitLeafSource(taskLeafSpecs.find(s=>s.name==='native-cc07'));
