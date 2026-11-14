import {proveExternalSource,emitExternalSource} from './task-native-external-source.mjs';

// Native07/8BC5 (target choice, proof/game-reference/enemy-target-choice.mjs): own code in one window; random C51F and
// the line of sight 81:A25F are external returns into their own proofs.
export const native8BC5Spec={name:'task-native-8bc5',entry:0x808BC5,id:0x07,rootReturn:'RTS',maximumLocalStackBytes:2,
 instructions:32,returns:['80:8C07'],
 // PLA at 8BE9 takes the WORD of PHY at 8BCF (both 16 bit): the object index becomes DP00 again.
 indexPulls:[0x808BE9],
 windows:[
  {start:0x808BC5,hex:'A400B95814890400F0335AAD6B1DD011AFE62D7E4A1A8500201FC5A5000AAA8003A20000688500BCA81FB95814890010D00B5ABBA400225FA2817A9003A0FFFF840060'},
 ],
 externalReturns:[
  [0x81A25F,'RTL','line of sight, src/task/line-of-sight.mjs (tools/task-sight-a25f-source.mjs)'],
  [0x80C51F,'RTS','random below DP00, src/task/native-random.mjs'],
 ],
 scope:'Original Native07 8BC5 own code with external returns into separately proved routines; equations in proof/game-reference/enemy-target-choice.mjs, differential check in tools/task-native-8bc5.test.mjs.',
 contract:'Own 8BC5 code: DP00 object Y; without bit 0004 in 1458+Y DP00=FFFF. Otherwise PHY, candidate index 0 when 1D6B is nonzero, else JSR C51F below (7E2DE6>>1)+1 and ASL; PLA to DP00; candidate Y from 1FA8+X; bit 1000 in its 1458 gives FFFF; else PHY, TYX, LDY DP00, JSL 81:A25F, PLY: carry clear stores the candidate, set stores FFFF. E0M0X0 D0 entry, return M0X0 with entry DBR. Fresh tables.'};

export const prove8BC5Source=(map,spec=native8BC5Spec)=>proveExternalSource(map,spec);
export const emit8BC5Source=()=>emitExternalSource(native8BC5Spec);
