import {emitLeafSource} from "./task-native-leaf-source.mjs";
import {smallFamilySpecs} from "./task-native-small-specs.mjs";
await emitLeafSource(smallFamilySpecs.find(s=>s.name==="native-aa4c"));
