// Independent original 29A predicates and source PC walker, never a CPU/task
// interpreter. Counter/return area/currency/window/device inputs are synthetic.
export function localBodyCases(){
 return [...Array.from({length:10},(_,counter)=>({name:'counter-'+counter,counter})),
  ...[10,256,65535].map(counter=>({name:'no-local-call-'+counter,counter})),
  {name:'currency-carry',counter:0,low:65530,high:1},
  {name:'currency-high-wrap-saturation',counter:0,low:65530,high:65535}];
}
export function localBodyPCs(s,v={}){
 const pcs=[],returns=[];let pc=0;
 for(let n=0;n<1000;n++){
  const i=s.instructions.find(i=>i.pc===pc);if(!i)throw Error('Uncovered local source PC');pcs.push(pc);
  if(i.opcode===0x56){if(returns.length)throw Error('Pending expected local return');return pcs;}
  if(i.opcode===0x4C){returns.push(pc+i.length);pc=i.operand;}
  else if(i.opcode===0x50){if(!returns.length)throw Error('No expected local return');pc=returns.pop();}
  else if(i.opcode===0x44){const gate=(pc-33)/19;if(!Number.isInteger(gate)||gate<0||gate>9)throw Error('Unproved original29A condition');pc=v.counter===gate?pc+i.length:i.operand;}
  else pc=i.opcode===0x48?i.operand:pc+i.length;
 }
 throw Error('Unbounded expected local source path');
}
