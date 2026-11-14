// Explicit synthetic field observations; original ROM pointers live in each body descriptor.
export function counterBodyCases(s){
 if(s.eventCounterBody)return [0,1,2,3,4,5,6,255,256,258,65535].flatMap(state=>
  [0,32,33,65535].map(previous=>({name:`state-${state}-previous-${previous}`,state,previous,local0:0xA5A5})));
 return (s.id===0x150?[0,1,2,3,255,256]:[0]).flatMap(flag=>[0,1,2,8,65535].map(previous=>({name:`flag-${flag}-previous-${previous}`,flag,previous})));
}
export function counterBodyPCs(s,v={}){
 if(s.eventCounterBody){
  const state=v.state??0,pcs=[0,2,4,5,7,9,10];
  if(state===2)pcs.push(13,16,18);
  else{pcs.push(21,23,25,26);if(state===3)pcs.push(29,32,34);
   else{pcs.push(37,39,41,42);if(state===4)pcs.push(45,48,50);
    else{pcs.push(53,55,57,58);if(state===5)pcs.push(61,64);}}}
  return [...pcs,66,68,70,71,...(state===2?[74,76]:[]),78,79,82,84,86,88,89,91,93];
 }
 return s.id===0x150&&!(v.flag&1)?[0,3,5,7,8,9,45]:s.instructions.map(i=>i.pc);
}
export function expandCounterBodyFixture(s,v,f){
 const word=(a,n)=>f.data.seed(a,[n&255,n>>>8]);word(0x7E2DE4,v.previous??0);
 if(s.eventCounterBody){word(0x7E3BDB,v.state??0);word(0x613,v.local0??0xA5A5);word(0x7E3996,0xABCD);}
 if(s.id===0x150){word(0x7E318A,v.flag??0);word(0x7E31B2,0xAB21);word(0x7E31B7,0xAB42);word(0x7E31BC,0xAB04);}
 return {...f,maxHandlers:counterBodyPCs(s,v).length};
}
