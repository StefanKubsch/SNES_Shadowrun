import {proveExternalSource,emitExternalSource} from './task-native-external-source.mjs';
// Hauptschleife $80:8000 mit Helfer $803B (src/task/main-zone-gate.mjs): Zonen um die Spielfigur. $C34A ist
// anderswo bewiesen (src/task/task-append.mjs); $A4BF (Szenenwechsel) ist noch nicht gebunden und im Spiel eine
// Grenze (main_loop_frontier), im Vergleich ein Stub mit echtem Rahmen.
export const mainGate8000Spec={name:'main-gate-8000',entry:0x808000,id:null,rootReturn:'RTS',maximumLocalStackBytes:4,
 instructions:103,returns:['80:802E','80:803A','80:8040'],
 windows:[{start:0x808000,hex:'ACC20C303AB9280E4A4A850EB9800E4A4A8511B9D80E4A4A8514A000006417B79DC829FF00F008851A203B80900160A5171A8517C90100F0E61860C61A10021860A50ED79D902FC8C8A511D79D902EC8C8A514D79D902DC8C8B79DC50E902CC8C8B79DC511902BC8C8B79DC514B02A98690400A880C598690E00A880BE98690C00A880B798690A00A880B098690800A880A998690600A880A2C8C8A517D00CB79DAAC8C85A204AC37A8090B79D20BFA43860'}],
 externalReturns:[
  [0x80C34A,'RTS','task append, appendScriptTask in src/task/task-append.mjs'],
  [0x80A4BF,'RTS','scene change, not bound yet: main_loop_frontier in src/task/main-zone-gate.mjs'],
 ],
 scope:'Original main loop routine 8000 with helper 803B, own code with external returns into C34A and A4BF; equations in src/task/main-zone-gate.mjs, differential check in tools/main-gate-8000.test.mjs.',
 contract:'E0M0X0 D0 entry, return M0X0 with entry DBR. Carry set only after A4BF (scene change), else clear.'};
export const proveMainGate8000Source=(map,spec=mainGate8000Spec)=>proveExternalSource(map,spec);
export const emitMainGate8000Source=()=>emitExternalSource(mainGate8000Spec);
