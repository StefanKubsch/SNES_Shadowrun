import {taskFixture} from './task-native-fixtures.mjs';

export function arithmeticObservations(entry,bank=0x80,values=null) {
  const multiply=[0x80F581,0x80F546,0x80F556,0x80F566].includes(entry);
  const fields=multiply?[[0x80F592,0x4216,1],[0x80F5A1,0x4216,1],[0x80F5A6,0x4217,1],[0x80F5B6,0x4216,1]]
    :[[0x80F642,0x4214,1],[0x80F647,0x4215,1],[0x80F652,0x4216,1],[0x80F664,0x4214,2]];
  const synthetic=values??(multiply?[0x12,0x34,0x56,0x78]:[0x34,0x12,0x56,0x2345]);
  return Object.freeze(fields.map(([pc,offset,width],n)=>Object.freeze({pc,address:bank*65536+offset,width,value:synthetic[n]})));
}
export function taskArithmeticFixture(entry,patch={}) {
  return {...taskFixture(entry,{savedOuterS:0x6FF,...patch}),maxOutputBytes:patch.maxOutputBytes??256,
    ioMode:'record-requests',ioObservations:arithmeticObservations(entry,patch.bank??0x80)};
}
