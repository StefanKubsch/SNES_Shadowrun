import {taskNativeOpcodeFixture} from './task-native-opcode-fixtures.mjs';import {native8E36Spec} from './task-native-8e36-spec.mjs';
import {task8E36Fixture} from './task-native-8e36-fixtures.mjs';import {sampleWord} from './render-f130-fixtures.mjs';
export function task7COpcodeFixture(v={}){
 const f=taskNativeOpcodeFixture(native8E36Spec),source=task8E36Fixture(v);
 for(const [a,n]of source.data.snapshot().bytes)f.data.seed(a,[n]);sampleWord(f.data,0x700,0xC20A);
 sampleWord(f.data,0x3F1,v.center??0x20);sampleWord(f.data,0x3F3,v.limit??1);
 return {...f,maxWork:1000000,maxOutputBytes:1000000,ioMode:source.ioMode,ioObservations:source.ioObservations,
  waitMode:source.waitMode,waitObservations:source.waitObservations,inputMode:source.inputMode,inputObservations:source.inputObservations};
}
