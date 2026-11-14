import {mainLoopWindow} from './main-loop-motion-source.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';

// European ROM literals. The first window falls through to 96AB; its source
// proof includes the whole original main loop, rather than inventing an RTS
// at the end of the prefix. Callee assumptions retain their separate proofs.
export const mainStartWindow={start:0x809688,hex:'A5001005200D9680082298B181AFE22D7E482029966820BFA49CD81F9CDA1F22618881'};
export const mainStartSpecs=[
  {name:'main-start-9688',entry:0x809688,rootReturn:'RTS',windows:[mainStartWindow,mainLoopWindow]},
  {name:'main-new-game-960d',entry:0x80960D,rootReturn:'RTS',windows:[{start:0x80960D,hex:'20E998A9FFFF8FA33C7EA901008FE42D7EA9FEFF8FE62D7EA9030060'}]},
  {name:'main-new-game-98e9',entry:0x8098E9,rootReturn:'RTS',windows:[{start:0x8098E9,hex:'A9D2FBA08B00A2002E204D9FA23E00A900009FBB3B7ECACA10F88BA2A997A02E3CA96700547E80A29C97A0963CA90C00547E80ABE220A9038FFB3B7EA9038FFD3B7E8FFF3B7EA91E8F003C7EA9008F173C7E8F183C7E8F193C7E8F023C7E8F033C7E8F053C7E8F063C7E8FFC3B7E8F073C7E8F093C7E8F0B3C7E8F0C3C7E8F083C7E8F0A3C7EA9018F013C7E8F043C7EC220A900008F0D3C7E8F0F3C7E8F113C7E8F133C7E8F1C3C7EA92E718F153C7E60'}]},
  {name:'main-load-b198',entry:0x81B198,rootReturn:'RTL',windows:[{start:0x81B198,hex:'088B850E201AB1A0E02DA9270F547E70AB286B'},
    {start:0x81B11A,hex:'A50E0AAABF24B181AA60'}]},
];
export const mainStartDataWindows=[
  {start:0x81B124,hex:'0000FE0FFC1FFA2F'},
  {start:0x80979C,hex:'005000000000C8AA0028000032FF'},
  {start:0x8097A9,hex:'FFFF00FFFF05010088080142010006028F08014B190603016C08019601010603B11803EC0B0006027308019D01010502FFFF00FFFF050000FFFF00FFFF050000AA18043401060904570802FA1200040181080168020005026508016F02010603FFFF00FFFF050201'},
  {start:0x8BFBD2,hex:'BB0D3900'},
];
export function proveMainStart(map,s){assertPinnedTaskSource(map,s.windows);
  const external=new Map([...map.values()].filter(i=>['JSR','JSL'].includes(i.mnemonic)&&!map.has(i.target))
    .map(i=>[i.target,i.mnemonic==='JSL'?'RTL':'RTS']));
  return proveWordStack(map,s.entry,s.rootReturn,{measureStack:true,externalReturns:external});
}
