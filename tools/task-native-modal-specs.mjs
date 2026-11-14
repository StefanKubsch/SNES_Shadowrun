import {menuPins} from './render-task-native-menu-compose-source-proof.mjs';
import {inputApuWindows} from './render-task-native-input-apu-source-proof.mjs';
import {taskNativeRenderSpec} from './task-native-render-spec.mjs';
import {renderComposeWindows} from './task-native-render-compose-source.mjs';
import {textComposeWindows} from './task-native-text-compose-source.mjs';
const wholeMenu=menuPins.map(w=>w.start===0x80A6A5?{...w,start:0x80A6C7,hex:w.hex.slice((0xA6C7-0xA6A5)*2)}:w);
const unique=windows=>[...new Map(windows.map(w=>[w.start,w])).values()];
export const modalSpecs=[
 {name:'native-cd43',id:0x72,entry:0x80CD43,windows:unique([
  {start:0x80CD43,hex:'A906008504A904008506A9000085082063F9A500850EA9010085026404A902008506A991CD8508A98000850A20C7A6A500C9FFFFF00AC90100F005F4FFFF8003F40000A50E8500203EFA68850060'},
  ...wholeMenu,...taskNativeRenderSpec.windows,...renderComposeWindows(0x80FA3E),
  {start:0x809E1A,hex:inputApuWindows[0].hex.slice(0,(0x9E3D-0x9E1A)*2)}]),
  anchors:[{kind:'pointer',start:0x82D89C,hex:'43CD'},{kind:'argument-metadata',start:0x82DABE,hex:'0202'},{kind:'return-metadata',start:0x82D9E2,hex:'0202'}]},
 {name:'native-cd20',id:0xBF,entry:0x80CD20,windows:[{start:0x80CD20,hex:'38AF0D3C7EE500B00DAAAF0F3C7EF0103A8F0F3C7E8A8F0D3C7EA9FFFF850060640060'}],
  anchors:[{kind:'pointer',start:0x82D936,hex:'20CD'},{kind:'argument-metadata',start:0x82DB0B,hex:'0101'},{kind:'return-metadata',start:0x82DA2F,hex:'0200'}]},
 {name:'native-cbf7',id:0x74,entry:0x80CBF7,windows:[{start:0x80CBF7,hex:'A600BF20B08DF007AAA5029F03007E60'}],
  anchors:[{kind:'pointer',start:0x82D8A0,hex:'F7CB'},{kind:'argument-metadata',start:0x82DAC0,hex:'0202'},{kind:'return-metadata',start:0x82D9E4,hex:'0000'}]},
 {name:'native-935b',id:0xD7,entry:0x80935B,windows:[{start:0x80935B,hex:'A5000AAABDB8D98502A51485002069FE60'},...textComposeWindows(0x80FE69)],
  anchors:[{kind:'pointer',start:0x82D966,hex:'5B93'},{kind:'argument-metadata',start:0x82DB23,hex:'0100'},{kind:'return-metadata',start:0x82DA47,hex:'0002'}]}
];
export const modalTable={start:0x80CD91,hex:'4D7150710000'};
