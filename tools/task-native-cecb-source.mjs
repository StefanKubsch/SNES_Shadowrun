import {proveExternalSource,emitExternalSource} from './task-native-external-source.mjs';
// Native27/CECB (src/task/native-state-count-raise.mjs): member search in 7E2DF0, runner entry 9700, state count capped at
// the maximum from the runner record, JSL 81:AD92, RTS; the call is an external return into its own proof.
export const nativeCECBSpec={name:'task-native-cecb',entry:0x80CECB,id:0x27,rootReturn:'RTS',maximumLocalStackBytes:0,
 instructions:43,returns:['80:CF2D'],
 windows:[{start:0x80CECB,hex:'A400AFE62D7EAAB90A15DFF02D7EF00CCACA10F6ACC20CB90A1580E6A21800DD0097F004CACA10F7BD1A9718690500856BE220BD3497856DC220A76B29FF008504BEA813F018BF02007E29FF00186502C5049002A504E2209F02007EC2202292AD8160'}],
 externalReturns:[
  [0x81AD92,'RTL','window list, drawWindowList in src/task/native-render-compose.mjs'],
 ],
 scope:'Original Native27 CECB own code with an external return into 81:AD92; equations in src/task/native-state-count-raise.mjs, differential check in tools/task-native-cecb.test.mjs.',
 contract:'Search 150A+Y in 7E2DF0 (leader 0CC2 as fallback), weapon 9700, maximum byte through [971A+5/9734], record byte 7E0002 capped, JSL 81:AD92, RTS. E0M0X0 D0 entry, return M0X0 with entry DBR. No result word.'};
export const proveCECBSource=(map,spec=nativeCECBSpec)=>proveExternalSource(map,spec);
export const emitCECBSource=()=>emitExternalSource(nativeCECBSpec);
