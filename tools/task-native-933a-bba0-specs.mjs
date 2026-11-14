import {requestWindows} from './render-task-native-menu-compose-source-proof.mjs';
import {taskListSpecs} from './task-native-list-specs.mjs';
import {taskTextComposeWindows} from './task-native-text-compose-spec.mjs';
import {nativeD15CSpec} from './task-native-d15c-spec.mjs';
export const selectionRoots=[
 {id:0x9A,entry:0x80933A,name:'native-933a',windows:[
  {start:0x80933A,hex:'A50048A51485002067FA6402640420ACFA680AAABDB8D98502A51485002069FE60'},
  ...requestWindows,taskListSpecs.find(s=>s.entry===0x80FAAC).window,...taskTextComposeWindows],
  anchors:[{kind:'pointer',start:0x82D8EC,hex:'3A93'},
   {kind:'argument-metadata',start:0x82DAE6,hex:'0102'},{kind:'return-metadata',start:0x82DA0A,hex:'0000'}]},
 {id:0x1A,entry:0x80BBA0,name:'native-bba0',windows:[
  {start:0x80BBA0,hex:'AFE22D7E0A0A0A6FE22D7EAABF9F928D29FF0085A2AFE62D7EAAA400B90A15DFF02D7EF004CACA10F6A5A2E00200F008E00400D0043A80011A29070085040AAABDFABB99200DBD0ABC99780DA902008003'},
  {start:0x80BBF4,hex:'8502205CD160'},...nativeD15CSpec.windows],
  anchors:[{kind:'pointer',start:0x82D7EC,hex:'A0BB'},
   {kind:'argument-metadata',start:0x82DA66,hex:'0102'},{kind:'return-metadata',start:0x82D98A,hex:'0000'}]}
];
export const directionTable={start:0x80BBFA,hex:'00000400040004000000FCFFFCFFFCFF040004000000FCFFFCFFFCFF00000400'};
