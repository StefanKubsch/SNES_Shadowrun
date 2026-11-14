import {childBodyCases,expandChildFixture} from './task-script-body-child-fixtures.mjs';
import {recordAndCases,expandRecordAndFixture} from './task-script-body-record-and-fixtures.mjs';
import {propertyPairCases} from './task-script-body-property-pair-fixtures.mjs';
import {selectionBodyCases,expandSelectionBodyFixture} from './task-script-body-selection-fixtures.mjs';
import {localWaitBodyCases,expandLocalWaitFixture} from './task-script-body-local-wait-fixtures.mjs';
import {modalBodyCases,expandModalBodyFixture} from './task-script-body-modal-fixtures.mjs';
import {blastBodyCases,expandBlastBodyFixture} from './task-script-body-blast-fixtures.mjs';
import {recordLifecycleCases,expandRecordLifecycleFixture} from './task-script-body-record-lifecycle-fixtures.mjs';
import {recordActionsCases,expandRecordActionsFixture} from './task-script-body-record-actions-fixtures.mjs';
import {directionBodyCases,expandDirectionBodyFixture} from './task-script-body-direction-fixtures.mjs';
import {recordMaskBodyCases,expandRecordMaskBodyFixture} from './task-script-body-record-mask-fixtures.mjs';
import {createRenderData,renderAddress} from '../src/render/data.mjs';
import {scriptBodySpecs,scriptBodyNativeSources} from '../proof/task/script-body-specs.mjs';
import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
import {nativeOpcodeSpecs} from './task-native-opcode-specs.mjs';
import {expansionBodyCases,expandBodyFixture} from './task-script-body-expansion-fixtures.mjs';
import {c8BodyCases,expandC8BodyFixture} from './task-script-body-c8-fixtures.mjs';
import {actionsBodyCases,expandActionsBodyFixture} from './task-script-body-actions-fixtures.mjs';
import {actionsWaitCases,expandActionsWaitFixture} from './task-script-body-actions-wait-fixtures.mjs';
import {audioBodyCases,expandAudioBodyFixture} from './task-script-body-audio-fixtures.mjs';
import {audioWaitBodyCases,expandAudioWaitBodyFixture,audioWaitD2Settings} from './task-script-body-audio-wait-fixtures.mjs';
import {multiAudioBodyCases,expandMultiAudioBodyFixture,multiAudioD2Settings} from './task-script-body-audio-multi-fixtures.mjs';
import {randomBodyCases,expandRandomBodyFixture,randomBodyD2Settings} from './task-script-body-random-fixtures.mjs';
import {mixedBodyCases,expandMixedBodyFixture,mixedBodyD2Settings} from './task-script-body-mixed-fixtures.mjs';
import {counterBodyCases,expandCounterBodyFixture} from './task-script-body-counter-fixtures.mjs';
import {slotFieldsBodyCases,expandSlotFieldsBodyFixture} from './task-script-body-slot-fields-fixtures.mjs';
import {clearBodyCases,expandClearBodyFixture} from './task-script-body-clear-fixtures.mjs';
import {inputWaitBodyCases,expandInputWaitBodyFixture} from './task-script-body-input-wait-fixtures.mjs';
import {notice80BodyCases,expandNotice80BodyFixture} from './task-script-body-notice80-fixtures.mjs';

export const bodyFrame=0x600,bodyStack=0x7FF,bodyOuterS=0xAFF;
export const script197Values=Object.freeze([0x08B2,0x1458,0x089D,0x15D2,0x079A,0x0A4F,0x0D2E,0x1B6D,0x0B52,0x0BA6,0x078C,0x0B3D,0x098B]);
export const bodyD2Settings=new Map([[0x31,[0,5]],[0xae,[0,5]],[0xb8,[2,5]],
 [0x152,[2,0]],[0x18f,[0,4]],[0x211,[1,0]],[0x245,[0,0]],[0x32f,[8,0]]]);
export const bodyWaitD2Settings=new Map([[0x67,[1,0]],[0x94,[0,4]],[0x1D6,[0,0]],[0x201,[0,4]],
 [0xBF,[1,0]],[0x116,[0,0]],
 [0x208,[0,5]],[0x20F,[0,4]],[0x212,[0,4]],[0x216,[0,4]],[0xFA,[3,5]],[0x14B,[0,4]],[0x1B8,[0,4]],
 [0x80,[0,0]],[0xDF,[1,1]],[0xF0,[0,5]],[0x10F,[0,0]],[0x27E,[0,5]],
 [0x2E6,[1,0]],[0x332,[6,0]],[0x3A5,[0,0]],[0x3A7,[1,5]]]);
const allD2Settings=new Map([...bodyD2Settings,...bodyWaitD2Settings,...audioWaitD2Settings,...multiAudioD2Settings,...randomBodyD2Settings,...mixedBodyD2Settings]);
export const isWaitBody=spec=>spec.instructions.some(i=>i.opcode===0x58&&i.operand===0x9F);
export function bodyCases(spec){
 if(spec.recordAndWaitBody)return recordAndCases();
 if(spec.scriptChildBody)return childBodyCases(spec);
 if(spec.localWaitBody)return localWaitBodyCases(spec);
 if(spec.modalBody)return modalBodyCases(spec);
 if(spec.selectionBody)return selectionBodyCases(spec);
 if(spec.blastBody)return blastBodyCases(spec);
 if(spec.recordMaskBody)return recordMaskBodyCases(spec);
 if(spec.directionBody)return directionBodyCases(spec);
 if(spec.recordActionsBody)return recordActionsCases(spec);
 if(spec.recordLifecycleBody)return recordLifecycleCases(spec);
 if(spec.inputWaitBody)return inputWaitBodyCases(spec);
 if(spec.native80Notice)return notice80BodyCases(spec);
 if(spec.nativeA7Observations)return clearBodyCases(spec);
 if(spec.slotFieldsWait)return slotFieldsBodyCases(spec);
 if(spec.counterBody)return counterBodyCases(spec);
 if(spec.random63Observations)return mixedBodyCases(spec);
 if(spec.randomObservations)return randomBodyCases(spec);
 if(spec.multiAudioWait)return multiAudioBodyCases(spec);
 if(spec.audioWait)return audioWaitBodyCases(spec);
 if(spec.audioObservations)return audioBodyCases(spec);
 if(spec.native13Wait)return actionsWaitCases(spec);
 if(spec.native13Observations)return actionsBodyCases(spec);
 if(spec.c8Observations)return c8BodyCases(spec);
 if(spec.sourceRomGuards)return expansionBodyCases(spec);
 if([0x80,0x10F].includes(spec.id))return [0,11,12,65535].map(counter=>({name:'counter-'+counter,counter}));
 if(allD2Settings.has(spec.id))return [false,true].flatMap(selectionEqual=>[false,true].map(actionEqual=>({
  name:`selection-${selectionEqual?'equal':'changed'}-action-${actionEqual?'equal':'changed'}`,selectionEqual,actionEqual})));
 if([0x03F,0x0B2].includes(spec.id))return [0,3,5].map(state=>({name:'state-'+state,state}));
 if(spec.id===0x197)return [...script197Values.map((input,n)=>({name:'match-'+n,input})),{name:'no-match',input:0}];
 return [{name:'original-path'}];
}
export function scriptBodyFixture(spec,variant={}){
 if(spec.recordAndWaitBody)variant={...recordAndCases()[3],...variant};
 if(spec.propertyPairBody)variant={...propertyPairCases()[0],...variant};
 const data=createRenderData({writeWindows:[[0x7E0000,0x7FFFFF]]}),word=(a,v)=>data.seed(a,[v&255,v>>>8]);
 // Explicit synthetic stale local bytes, including a WORD-read highbyte
 // beyond the last declared local. Never infer zero or header capacity.
 data.seed(bodyFrame+0x13,Array(spec.header[0]+1).fill(0xA5));
 data.seed(spec.scriptEntry,[...spec.header,...spec.bytecode,...(spec.fetchTail===null?[]:[spec.fetchTail])]);
 for(const opcode of new Set(spec.instructions.map(i=>i.opcode))){const s=taskOpcodeSpecs.find(s=>s.opcode===opcode);word(0x80F2B4+opcode,s.target&65535);}
 for(const id of new Set(spec.instructions.filter(i=>i.opcode===0x58).map(i=>i.operand))){
  const s=scriptBodyNativeSources.find(s=>s.id===id);
  for(const a of s.anchors)data.seed(a.address,a.bytes);}
 for(const r of spec.romReads){word(r.address,r.value);if(!spec.sourceRomGuards&&!allD2Settings.has(spec.id))data.seed(0x7E0000+r.value+1,[variant.oldField??4]);}
 if(allD2Settings.has(spec.id)){
  const [selection,action]=allD2Settings.get(spec.id),slot=variant.slot??0x10;
  word(0x801038+slot,variant.selectionEqual?selection:65535);
  word(0x801198+slot,variant.actionEqual?action:(action?0:1));
  word(0x7E3F28+slot,11);word(0x8010E8+slot,1);word(0x8011F0+slot,0xAB31);
  const pointer=spec.romReads.find(r=>r.address===0x8CEDA0).value+selection*2;
  const record=spec.romReads.find(r=>r.address===0x8C0000+pointer).value;
  word(0x801090+slot,record+8);word(0x801458+slot,variant.flags??0xBEEF);word(0x801400+slot,variant.motion??0x1234);
 }
 const releases=spec.instructions.some(i=>i.opcode===0x58&&i.operand===0xB9);
 if(releases){const slot=variant.slot??0x10;word(0x8012A0+slot,0);word(0x8014B0,0);word(0x8014B2,slot);
  word(0x7E43F8+slot,0);word(0x801FD0,variant.counter??0);}
 const args=variant.args??(allD2Settings.has(spec.id)||spec.id===0x6F||releases?[variant.slot??0x10]:spec.id===0x197?[variant.input??0]:spec.id===0x37C?[variant.input??0x1234]:[0x1234,0x5678,0x9ABC]);
 for(let n=0;n<spec.argumentBytes/2;n++)word(bodyStack+1+2*n,args[n]);
 word(bodyStack+1+spec.argumentBytes,variant.endWord??0xBEEF);
 word(bodyFrame,(spec.scriptEntry+2)&65535);word(bodyFrame+1,(((spec.scriptEntry>>>16)&255)<<8)|(((spec.scriptEntry+2)>>>8)&255));
 word(bodyFrame+3,0);word(bodyFrame+7,bodyStack);word(bodyFrame+9,spec.id);
 word(0x8001F2,bodyOuterS);word(bodyOuterS+1,0xC20A);
 word(0x800250,2);word(0x800254,bodyFrame);word(0x7E3C06,0xAB00|(variant.state??0));
 // Explicit synthetic predecessor and outer-return bytes for each later
 // independently observed C1F9. No original initialized task list claimed.
 if(isWaitBody(spec))word(0x800314,2);
 const first=spec.bytecode[0],context=Object.freeze({a:first,x:first,y:1,s:bodyStack,d:bodyFrame,bank:spec.scriptEntry>>>16,
  status:4,e:0,programBank:0x80,pc:0xF390});
 const hit=script197Values.indexOf(variant.input??0);
 const maxHandlers=[0x80,0x10F].includes(spec.id)&&(variant.counter??0)>=12?8:
  isWaitBody(spec)?spec.instructions.findIndex(i=>i.opcode===0x58&&i.operand===0x9F)+1:
  spec.id===0x197?(hit<0?55:7+4*hit):[0x03F,0x0B2].includes(spec.id)?((variant.state??0)<=2?9:17):spec.instructions.length;
 const f={data,context,entry:0x80F390,scriptId:spec.id,protectedStackBytes:[renderAddress(bodyOuterS+1),renderAddress(bodyOuterS+2)],
  maxHandlers,maxWork:20000,maxOutputBytes:2048};
 if(spec.recordAndWaitBody)return expandRecordAndFixture(spec,variant,f);
 if(spec.scriptChildBody)return expandChildFixture(spec,variant,f);
 if(spec.localWaitBody)return expandLocalWaitFixture(spec,variant,f);
 if(spec.modalBody)return expandModalBodyFixture(spec,variant,f);
 if(spec.selectionBody)return expandSelectionBodyFixture(spec,variant,f);
 if(spec.blastBody)return expandBlastBodyFixture(spec,variant,f);
 return spec.recordMaskBody?expandRecordMaskBodyFixture(spec,variant,f):spec.directionBody?expandDirectionBodyFixture(spec,variant,f):spec.recordActionsBody?expandRecordActionsFixture(spec,variant,f):spec.recordLifecycleBody?expandRecordLifecycleFixture(spec,variant,f):spec.inputWaitBody?expandInputWaitBodyFixture(spec,variant,f):spec.native80Notice?expandNotice80BodyFixture(spec,variant,f):spec.nativeA7Observations?expandClearBodyFixture(spec,variant,f):spec.slotFieldsWait?expandSlotFieldsBodyFixture(spec,variant,f):spec.counterBody?expandCounterBodyFixture(spec,variant,f):spec.random63Observations?expandMixedBodyFixture(spec,variant,f):spec.randomObservations?expandRandomBodyFixture(spec,variant,f):spec.multiAudioWait?expandMultiAudioBodyFixture(spec,variant,f):spec.audioWait?expandAudioWaitBodyFixture(spec,variant,f):spec.audioObservations?expandAudioBodyFixture(spec,variant,f):spec.native13Wait?expandActionsWaitFixture(spec,variant,f):spec.native13Observations?expandActionsBodyFixture(spec,variant,f):spec.c8Observations?expandC8BodyFixture(spec,variant,f):spec.sourceRomGuards?expandBodyFixture(spec,variant,f):f;
}
export function bodyWord(data,address){const lo=data.readByte(address),hi=data.readByte(address+1);if(!lo.available||!hi.available)throw Error('Missing test WORD');return lo.value|(hi.value<<8);}
export function omitBodyBytes(f,...addresses){const omit=new Set(addresses.map(renderAddress)),data=createRenderData({writeWindows:f.data.snapshot().writeWindows});
 for(const [a,v]of f.data.snapshot().bytes)if(!omit.has(a))data.seed(a,[v]);return {...f,data};}
