import {proveExternalSource,emitExternalSource} from './task-native-external-source.mjs';
// Native45/CD9D (src/task/native-glove-release.mjs): STZ 1D61, JSR BCB2, JSL 81:AD92, RTS; both calls are external
// returns into their own proofs.
export const nativeCD9DSpec={name:'task-native-cd9d',entry:0x80CD9D,id:0x45,rootReturn:'RTS',maximumLocalStackBytes:0,
 instructions:4,returns:['80:CDA7'],
 windows:[{start:0x80CD9D,hex:'9C611D20B2BC2292AD8160'}],
 externalReturns:[
  [0x80BCB2,'RTS','glove off, putGloveAway in src/task/native-dialog-portrait.mjs (tools/task-native-936c-source.mjs, group bcb2)'],
  [0x81AD92,'RTL','window list, drawWindowList in src/task/native-render-compose.mjs'],
 ],
 scope:'Original Native45 CD9D own code with external returns into BCB2 and 81:AD92; equations in src/task/native-glove-release.mjs, differential check in tools/task-native-cd9d.test.mjs.',
 contract:'STZ actualDBR 1D61, JSR BCB2, JSL 81:AD92, RTS. E0M0X0 D0 entry, return M0X0 with entry DBR. No result word.'};
export const proveCD9DSource=(map,spec=nativeCD9DSpec)=>proveExternalSource(map,spec);
export const emitCD9DSource=()=>emitExternalSource(nativeCD9DSpec);
