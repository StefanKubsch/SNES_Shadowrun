import {proveLeafSource} from "./task-native-leaf-source.mjs";
import {smallFamilySpecs} from "./task-native-small-specs.mjs";
export const prove=map=>proveLeafSource(map,smallFamilySpecs.find(s=>s.name==="native-aa4c"));
