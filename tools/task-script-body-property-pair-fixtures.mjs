import {sampleWord} from './render-f130-fixtures.mjs';import {menuRecords} from './task-native-menu-fixtures.mjs';
import {bodyWord} from './task-script-body-fixtures.mjs';
export const propertyPairCases=()=>[[2226,2226],[2226,0],[0,2226],[0,0],[0x18B2,2226],[2226,0x18B2],[65535,2226],[2226,65535]]
 .map(([first,second])=>({name:'property-'+first.toString(16)+'-'+second.toString(16),first,second}));
export const propertyPairActive=v=>v.first===2226&&v.second===2226;
export const propertyPairPCs=(s,v)=>s.instructions.filter(i=>propertyPairActive(v)||i.pc<=17||i.pc===44).map(i=>i.pc);
export function expandPropertyPairFixture(s,v,f){
 for(const [a,n]of [[0x7E3A42,v.first],[0x7E31F5,v.second],[0x7E346B,0xABCD]])sampleWord(f.data,a,n);
 return {...f,maxHandlers:propertyPairPCs(s,v).length,ioMode:'record-requests',ioObservations:menuRecords([]),
  waitMode:'record-observations',waitObservations:menuRecords([]),inputMode:'record-observations',inputObservations:menuRecords([])};
}
export function propertyPairProbeDetails(s,v,f,p){const pointers=[0x8DC5DD,0x8DC3C2,0x8DB250],fields=[0x7E3A42,0x7E31F5,0x7E346B],args=[];
 for(let n=0;n<p.accesses.length;n++)if(p.accesses[n].kind==='write'&&p.accesses[n].label==='saved-ID-low'){
  const end=p.accesses.findIndex((a,k)=>k>n&&a.kind==='write'&&a.label==='saved-ID-low'),writes=p.accesses.slice(n,end<0?undefined:end)
   .filter(a=>a.kind==='write'&&a.label.startsWith('native-argument-workspace-'));
  args.push({id:p.accesses[n].value,arguments:writes.filter((_,k)=>k%2===0).map((a,k)=>a.value|(writes[k*2+1].value<<8))});
 }
 return {property_pair_input:[v.first,v.second],property_pair_final:fields.map(a=>bodyWord(f.data,a)),property_pair_arguments:args,
  property_pair_pointer_reads:p.accesses.flatMap((a,n)=>a.kind==='read'&&pointers.includes(a.address)
   &&['leaf-long-WORD-low','text-root-WORD-low'].includes(a.label)?[[a.address,a.value|(p.accesses[n+1].value<<8)]]:[]),
  property_pair_field_reads:p.accesses.flatMap((a,n)=>a.kind==='read'&&fields.includes(a.address)&&a.label==='leaf-long-WORD-low'?[[a.address,a.value|(p.accesses[n+1].value<<8)]]:[]),
  property_pair_result_phas:p.accesses.flatMap((a,n)=>a.kind==='write'&&a.label==='resume-result-PHA-low'?[a.value|(p.accesses[n-1].value<<8)]:[]),
  property_pair_native_calls:p.steps.filter(s=>s.calleeEntry).map(s=>({target:s.calleeEntry,word_pops:s.arguments?.wordPops??s.wordPops,return_word:s.calleeReturnWord,result_pushed:s.resultPushed})),
  property_pair_io_used:p.observationsUsed,property_pair_wait_used:p.waitObservationsUsed,property_pair_input_used:p.inputObservationsUsed};
}
