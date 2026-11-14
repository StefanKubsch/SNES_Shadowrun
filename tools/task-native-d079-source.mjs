import {proveExternalSource,emitExternalSource} from './task-native-external-source.mjs';
// Native20/D079 (src/task/native-runners-restore.mjs): restore loop over the 13 runner entries with the own helper
// D08A (real JSR, PHX/PLX around it, PHA record word pulled by PLX), JSL 81:AD92, RTS.
export const nativeD079Spec={name:'task-native-d079',entry:0x80D079,id:0x20,rootReturn:'RTS',maximumLocalStackBytes:6,
 instructions:47,returns:['80:D089'],dataPulls:[0x80D0C7],
 windows:[{start:0x80D079,hex:'A21800DA208AD0FACACA10F72292AD8160BD1A9718690100856BE220BD3497856DC2209BBD0097AABF20B08DF02B48984AAAE220A76B29FF0A85680A0A1865689F963C7EC22018A56B690400856BFAE220A76B9F02007EC22060'}],
 externalReturns:[
  [0x81AD92,'RTL','window list, drawWindowList in src/task/native-render-compose.mjs'],
 ],
 scope:'Original Native20 D079 own code with the helper D08A and an external return into 81:AD92; equations in src/task/native-runners-restore.mjs, differential check in tools/task-native-d079.test.mjs.',
 contract:'X = 18 down by 2 (BPL): PHX, JSR D08A (weapon record refill, BYTE counter 7E3C96+X/2 = 10 * [971A+1], record BYTE 7E0002 = [971A+5]), PLX; JSL 81:AD92, RTS. E0M0X0 D0 entry, return M0X0 with entry DBR. No result word.'};
export const proveD079Source=(map,spec=nativeD079Spec)=>proveExternalSource(map,spec);
export const emitD079Source=()=>emitExternalSource(nativeD079Spec);
