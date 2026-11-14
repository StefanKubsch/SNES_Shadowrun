import {emitLeafSource} from './task-native-leaf-source.mjs';import {m1dLeafSpecs} from './task-native-m1d-specs.mjs';
await emitLeafSource(m1dLeafSpecs.find(s=>s.name==='native-8b8a'));
