// Reviewed fixed original body paths over explicit synthetic observations.
// Only these named templates receive branch expectations; no ROM executor.
const choices=new Set([0x21E,0x223,0x39D]),records=new Set([0x151,0x158,0x159,0x182]);
const creation=new Set([0x68,0x1B4,0x1BA,0x1BC,0x1C2]);
const selections=new Map([[0x49,[6,0]],[0xAF,[0,0]],[0x9C,[0,2]],[0x184,[0,2]],[0x2F3,[0,5]],
 [0x8C,[1,0]],[0x91,[1,0]],[0x21F,[2,0]]]);
export function expansionBodyCases(spec){
 if(choices.has(spec.id))return [0,1,2,3,4,5,6,7,0xFFFF].map(state=>({name:'state-'+state,state}));
 if(records.has(spec.id))return (spec.id===0x182?[0,2]:[0,1]).map(flag=>({name:'flag-'+flag,flag}));
 if(selections.has(spec.id))return [false,true].flatMap(selectionEqual=>[false,true].map(actionEqual=>({name:`selection-${selectionEqual?'equal':'changed'}-action-${actionEqual?'equal':'changed'}`,selectionEqual,actionEqual})));
 if([0x81,0x23A,0x30F,0x393].includes(spec.id))return ['match','sentinel'].map(list=>({name:'list-'+list,list}));
 return [{name:'original-path'}];
}
export function expansionBodyPCs(spec,variant={}){
 const pcs=[];let pc=0;
 while(true){
  const i=spec.instructions.find(i=>i.pc===pc);if(!i||pcs.length>spec.instructions.length)throw Error('Unproved expansion fixture path');pcs.push(pc);
  if(i.opcode===0x56)return pcs;
  if(i.opcode===0x48){pc=i.operand;continue;}
  if(i.opcode===0x44){
   const prev=spec.instructions[spec.instructions.indexOf(i)-2];
   const take=choices.has(spec.id)?(variant.state??0)!==prev.operand:
    records.has(spec.id)?((variant.flag??0)&(spec.id===0x182?2:1))===0:null;
   if(take===null)throw Error('Unproved branch fixture');if(take){pc=i.operand;continue;}
  }
  pc+=i.length;
 }
}
export const expansionBodyResult=(spec,variant={})=>creation.has(spec.id)?0x56:(variant.endWord??0xBEEF);
export function expandBodyFixture(spec,variant,f){
 const {data}=f,word=(a,v)=>data.seed(a,[v&255,v>>>8]),slot=variant.slot??0x10;
 if(spec.argumentBytes)word(0x800,variant.args?.[0]??slot);
 word(0x800E28+slot,12);word(0x800E80+slot,20);word(0x800ED8+slot,28);word(0x801458+slot,0xBEEF);word(0x801400+slot,0x1234);
 word(0x80150A+slot,0x2345);word(0x8001DA,variant.gate??65535);word(0x8001DE,0x20);word(0x800CC2,slot);
 word(0x8012A0+slot,0);word(0x7E3BBC+1,0x2000);word(0x7E3C1C,0);word(0x7E3C0D,variant.counterLow??0);word(0x7E3C0F,variant.counterHigh??0);
 const list=variant.list==='sentinel'?[255]:[7,27,35,20,5,18,26,6,15,37,255];data.seed(0x7E3CA3,list);
 data.seed(0xF3,[0,0x90,0x8D]);
 for(const i of spec.instructions.filter(i=>i.opcode===0x58&&[13,187].includes(i.operand))){
  const prior=spec.instructions[spec.instructions.indexOf(i)-1],lookup=spec.romReads.find(r=>r.address===0x8DB020+prior.operand);
  if(!lookup)throw Error('Missing individual field table');word(0x7E0000+lookup.value+1,0xAB00|(variant.flag??0));
 }
 if(choices.has(spec.id)){const index=spec.id===0x39D?0x20:0x22;word(0x7E3BBB+index,variant.state??0);}
 if(creation.has(spec.id)){
  word(0x7E3F7E,65535);word(0x8014B0,0);word(0x8003D2,0x800);word(0x8003D4,0);
  word(0x80024E,4);word(0x800316,65535);word(0x80024C,2);
 }
 if(selections.has(spec.id)){
  const [selection,action]=selections.get(spec.id);word(0x801038+slot,variant.selectionEqual?selection:65535);
  word(0x801198+slot,variant.actionEqual?action:(action?0:1));word(0x7E3F28+slot,11);
  word(0x8010E8+slot,1);word(0x8011F0+slot,0xAB31);
  const base=spec.romReads.find(r=>r.address===0x8CEDA0).value,record=spec.romReads.find(r=>r.address===0x8C0000+base+selection*2).value;
  word(0x801090+slot,record+8);word(0x801400+slot,0x1234);
 }
 const pcs=expansionBodyPCs(spec,variant),firstWait=pcs.findIndex(pc=>{const i=spec.instructions.find(i=>i.pc===pc);return i.opcode===0x58&&i.operand===0x9F;});
 return {...f,maxHandlers:firstWait<0?pcs.length:firstWait+1};
}
