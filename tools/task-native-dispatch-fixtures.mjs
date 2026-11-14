import {taskLeafFixture} from './task-native-leaf-fixtures.mjs';
import {taskLeafSpecs} from './task-native-leaf-specs.mjs';
import {seedTaskCreationFixture} from './task-native-create-fixtures.mjs';
import {seedTaskSmallFamilyFixture} from './task-native-small-fixtures.mjs';
import {seedTaskDistanceFixture} from './task-native-c68d-fixtures.mjs';
import {seedTaskDirectionFixture} from './task-native-d1d2-fixtures.mjs';
import {seedTaskM1dFixture} from './task-native-m1d-fixtures.mjs';
export function taskDispatchFixture(entry,patch={}){
 const f=taskLeafFixture(entry,patch);f.data.seed(0xA2,[0x3A,0xCA]);return f;
}
export function taskNativeCallFixture(spec=taskLeafSpecs.find(s=>s.name==='native-ca3a')){
 const f=taskLeafFixture(0x80F4F6),word=(a,v)=>f.data.seed(a,[v&255,v>>>8]);
 f.context=Object.freeze({...f.context,a:0x6FF,x:spec.id*2});
 word(0x82D7B8+spec.id*2,spec.entry&65535);word(0x800250,0x10);word(0x800262,0x200);
 word(0x200,0x1200);word(0x201,0x8012);word(0x203,4);word(0x207,0x3F0);word(0x209,spec.id);
 const metadata=spec.anchors.find(a=>a.kind==='return-metadata');f.data.seed(metadata.start,Buffer.from(metadata.hex,'hex'));
 if(spec.entry===0x80D15C){word(0x801048,3);word(0x8011A8,5);}
 if(spec.entry===0x80AAAF)word(0x8011A8,3);
 if(spec.entry===0x80D1D2)seedTaskDirectionFixture(f);
 if(spec.entry===0x80A8F5){word(0x8012B0,0);word(0x8014B0,0);word(0x8014B2,0x10);}
 if(spec.entry===0x80A835)seedTaskCreationFixture(f);
 if(spec.entry===0x80C68D)seedTaskDistanceFixture(f);
 if(spec.entry===0x80CCA4)word(0x7E2DE4,0);
 seedTaskSmallFamilyFixture(f,spec.entry);seedTaskM1dFixture(f,spec.entry);
 word(0x801204,0xA514);return f;
}
