// Only the independently proved native contracts actually reached by the
// connected boot test. No leaf admission and no arbitrary SPECIAL_NATIVES dispatch.
import {showNoticeObserved} from '../src/task/native-notice.mjs';
import {playSoundEffect} from '../src/task/native-audio-compose.mjs';
import {redrawWindowListObserved} from '../src/task/native-window-list-redraw.mjs';
import {controlPlayerObserved} from '../src/task/native-player-control.mjs';
import {runTaskActionsObserved} from '../src/task/native-actions.mjs';
import {randomBelow,randomByte} from '../src/task/native-random.mjs';
import {talkWithObjectObserved} from '../src/task/native-dialog.mjs';
import {appendToFightListReference as appendToFightList} from '../proof/game-reference/fight-list-append.mjs';
import {chooseEnemyTarget} from '../proof/game-reference/enemy-target-choice.mjs';
import {shootAtObjectObserved,shootAtGloveTargetObserved} from '../src/task/native-object-shoot.mjs';
import {removeFromFightListObserved} from '../src/task/native-fight-list-remove.mjs';

export const BOOT_NATIVE_CONTRACTS=new Map([
  [0x80FEC1,{id:0xC8,metadata:0x0007,result:false,run:(a,o)=>showNoticeObserved(a,o,false)}],
  [0x80C46E,{id:0x4C,metadata:0x0104,result:false,run:a=>playSoundEffect(a,{calls:[]},false)}],
  [0x80CDA8,{id:0xC2,metadata:0x0100,result:true,run:(a,o)=>redrawWindowListObserved(a,o,false)}],
  [0x80E014,{id:0xD0,metadata:0x0200,result:true,run:(a,o)=>controlPlayerObserved(a,o,false)}],
  [0x809BA0,{id:0x13,metadata:0x0201,result:true,run:(a,o)=>runTaskActionsObserved(a,o,0x809BA0,false)}],
  [0x80C560,{id:0x63,metadata:0x0100,result:true,run:a=>randomByte(a,false)}],
  [0x80936C,{id:0x95,metadata:0x0202,result:false,run:(a,o)=>talkWithObjectObserved(a,o,false)}],
  [0x80C51F,{id:0x3E,metadata:0x0201,result:true,run:a=>randomBelow(a,false)}],
  [0x808521,{id:0xAC,metadata:0x0101,result:false,run:a=>appendToFightList(a,false)}],
  [0x808BC5,{id:0x07,metadata:0x0101,result:true,run:a=>chooseEnemyTarget(a,false)}],
  [0x808AB5,{id:0x10,metadata:0x0006,result:true,run:(a,o)=>shootAtObjectObserved(a,o,false)}],
  [0x808A51,{id:0x58,metadata:0x0000,result:true,run:(a,o)=>shootAtGloveTargetObserved(a,o,false)}],
  [0x80855E,{id:0xC0,metadata:0x0001,result:false,run:(a,o)=>removeFromFightListObserved(a,o,false)}],
]);
