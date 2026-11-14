import {taskFixture} from './task-native-fixtures.mjs';
import {seedTaskCreationFixture} from './task-native-create-fixtures.mjs';
import {seedTaskSmallFamilyFixture} from './task-native-small-fixtures.mjs';
import {seedTaskDistanceFixture} from './task-native-c68d-fixtures.mjs';
import {seedTaskDirectionFixture} from './task-native-d1d2-fixtures.mjs';
import {seedTaskM1dFixture} from './task-native-m1d-fixtures.mjs';
export function taskLeafFixture(entry,patch={}) {
  const f=taskFixture(entry,{d:0,s:0x6FF,savedOuterS:0x6FF,writeWindows:[[0x7E0000,0x7FFFFF]],...patch});
  const word=(address,value)=>f.data.seed(address,[value&255,value>>>8]);
  word(0,0x10);word(2,3);word(f.context.bank*65536+0x13B8,0x400);
  f.data.seed(0x7E0400,[0x12,0x34,0x56,0x78,0x9A]);
  word(0x7E3BCB,0xABCD);word(0x7E4408,0x7FFE);
  word(0x8DB030,0x400);word(0x8DB032,5);word(0x8D932D,0x3456);word(0x8CEFD0,0x5678);
  word(0x8CEFD2,0x6789);
  f.data.seed(0xF3,[0,0x90,0x8D]);f.data.seed(0x8D9013,[0x34,0x12,0x78,0x56]);
  word(4,5);word(f.context.bank*65536+0x0CC2,0x3456);
  word(f.context.bank*65536+0x1468,0x0800);
  word(0x7E3F38,5);word(0x8DB023,0x400);
  for(const offset of [0x0D30,0x0D88,0x0DE0,0x0E38])word(f.context.bank*65536+offset,0xABCD);
  for(const offset of [0x0E90,0x0EE8,0x1198+0x10,0x150A+0x10,0x1400+0x10,0x250,0x1CA,0x1CE,0x1D5,0x1D7])word(f.context.bank*65536+offset,0xBEEF);
  word(6,0x4567);
  // D15C's minimal independent equality path; other leaves do not read these.
  if(entry===0x80D15C){word(f.context.bank*65536+0x1048,3);word(f.context.bank*65536+0x11A8,5);}
  if(entry===0x80AAAF)word(f.context.bank*65536+0x11A8,3);
  if(entry===0x80D1D2)seedTaskDirectionFixture(f);
  if(entry===0x80A8F5){word(f.context.bank*65536+0x12B0,0);word(f.context.bank*65536+0x14B0,0);word(f.context.bank*65536+0x14B2,0x10);}
  if(entry===0x80A835)seedTaskCreationFixture(f);
  if(entry===0x80C68D)seedTaskDistanceFixture(f);
  if(entry===0x80CCA4)word(0x7E2DE4,0);
  seedTaskSmallFamilyFixture(f,entry);seedTaskM1dFixture(f,entry);
  return {...f,maxOutputBytes:patch.maxOutputBytes??256};
}
