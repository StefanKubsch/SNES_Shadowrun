import {taskFixture} from './task-native-fixtures.mjs';
export function taskPrefixFixture(entry,patch={}) {
  const f=taskFixture(entry,{savedOuterS:0x6FF,top:0x5678,left:0x1234,...patch});
  if(entry===0x80F460){f.data.seed(0x801204,[2,0]);f.data.seed(0x82E9CE,[0,0]);}
  if(entry===0x80F4CB){f.data.seed(0x801204,[2,0xAA]);f.data.seed(0x82DA4E,[0,0]);}
  return f;
}
