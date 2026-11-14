// Independently declared expectations for the finite original1CF/1D2
// source branches. Native4F/50 retain full WORD indices and logical /4.
export const branchCountdownParent=s=>[0x1CF,0x1D2].includes(s.id);
export const countdownRecord=s=>s.childId===0x6F?s.instructions[s.instructions.findIndex(i=>i.opcode===0x52)-1].operand:null;
export function countdownParentHasText(s,v){return s.id===0x1CF?(v.xRaw>>>2)>540&&(v.yRaw>>>2)>490:
 s.id===0x1D2?(v.yRaw>>>2)>515:[0x161,0x18B].includes(s.id);}
export function countdownParentSelector(s,v){if(s.id===0x161)return 473;if(s.id===0x18B)return 474;
 const properties=s.id===0x1CF?[3955,3843,3920,3934]:[3458,3430,3283],n=properties.indexOf(v.property);return 435+(n<0?properties.length:n);}
export const countdownTextKey=(s,v)=>branchCountdownParent(s)?s.id+':'+countdownParentSelector(s,v):s.id;
export function branchCountdownCases(s){const props=s.id===0x1CF?[3955,3843,3920,3934,0]:[3458,3430,3283,0],
  initial={input:0xAB10,globalIndex:0x10,xRaw:2164,yRaw:s.id===0x1CF?1964:2064,flags:4},
  variants=props.map(property=>({...initial,property,name:'property-'+property}));
 if(s.id===0x1CF)variants.push(...[{name:'x-below',xRaw:2159},{name:'x-exact',xRaw:2160},
  {name:'y-below',yRaw:1959},{name:'y-exact',yRaw:1960}].map(v=>({...initial,property:3955,...v})));
 else variants.push(...[{name:'y-below',yRaw:2059},{name:'y-exact',yRaw:2060}].map(v=>({...initial,property:3458,...v})));
 variants.push({...initial,name:'full-word-index-and-coordinate-odd-local',input:0xFF11,globalIndex:0x1001,xRaw:65535,yRaw:65535,
  property:s.id===0x1CF?0x73:0x82,flags:0x81});
 return variants.flatMap(v=>[0x800,0x400].map(heap=>({...v,heap,name:v.name+'-heap-'+heap.toString(16)})));
}
export function countdownParentPCs(s,v){if(!branchCountdownParent(s))return s.instructions.map(i=>i.pc);
 const text=countdownParentHasText(s,v),pcs=s.id===0x1CF?[0,2,4,6,9,10,12,14,17,18,19]:[0,2,4,6,9,10];
 if(text){const props=s.id===0x1CF?[3955,3843,3920,3934]:[3458,3430,3283],start=s.id===0x1CF?22:13,
  base=s.id===0x1CF?35:26,finish=s.id===0x1CF?99:73;pcs.push(start,start+1,start+3,start+4,start+6,start+9,start+10);
  let matched=false;for(let n=0;n<props.length;n++){
   if(v.property===props[n]){pcs.push(base+17*n,base+3+17*n,base+5+17*n);matched=true;break;}
   if(n<props.length-1)pcs.push(base+8+17*n,base+10+17*n,base+13+17*n,base+14+17*n);
  }
  if(!matched)pcs.push(finish-5,finish-2);
  pcs.push(finish,finish+2,finish+4,finish+5,finish+7,finish+9,finish+11,finish+13);
 }
 pcs.push(...(s.id===0x1CF?[114,117,120,121,123]:[88,91,94,95,97]));return pcs;
}
