import {taskFixture} from './task-native-fixtures.mjs';
export function taskStatusReturnFixture(patch={}){
  const f=taskFixture(0x80F927,{s:0x6FF,savedOuterS:0x6FF,...patch});
  f.data.seed(f.context.d,[1,0]);
  f.data.seed(f.context.bank*65536+0x1BE,[0x12]);f.data.seed(f.context.bank*65536+0x1C0,[0x40]);
  return f;
}
