import { cpuLabel } from './rom.mjs';

// Static widths, fixed calls and typed stack only. Data loops are explored
// structurally; intact code/stack and disjoint effective stores are premises.
export function proveAppendC34AStack(map, entry = 0x80C34A) {
  if (![0x80C34A,0x80C2C8,0x80C242].includes(entry)) throw Error('Invalid append proof entry');
  const expect = (pc, op, value) => {
    const i=map.get(pc);
    if(i?.mnemonic!==op || value!==undefined && (i.target??i.value)!==value)
      throw Error('Renew append source lemma '+cpuLabel(pc));
  };
  for(const [pc,op,value] of [[0x80C34A,'JSR',0x80C2C8],[0x80C2E1,'LDA',0],
    [0x80C2E4,'SEP',32],[0x80C2F0,'REP',32],[0x80C2F5,'JSR',0x80C242],
    [0x80C281,'PHA'],[0x80C29B,'PLA'],[0x80C2AD,'RTS'],[0x80C2BC,'RTS'],
    [0x80C349,'RTS'],[0x80C365,'RTS']]) expect(pc,op,value);
  const allowed=new Set(['LDA','STA','LDX','STZ','LDY','AND','TXA','ASL','TAX','CLC',
    'ADC','TAY','SEC','SBC','CMP','ORA','DEC','DEX','DEY','INC','INY',
    'SEP','REP','JSR','RTS','PHA','PLA','BPL','BMI','BEQ','BNE','BCS','BCC','BRA']);
  const pending=[{pc:entry,m:0,x:0,stack:[]}],seen=new Set(),visited=new Set(),returns=new Set();
  let maximum=0,witness=null;
  const measure=(pc,stack)=>{
    const bytes=stack.length*2;
    if(bytes>maximum){maximum=bytes;witness={at:cpuLabel(pc),local_stack_bytes:bytes,
      return_frames:stack.filter(v=>v.kind==='return').map(v=>({kind:'RTS',to:cpuLabel(v.pc)})),
      data_bytes:stack.filter(v=>v.kind==='data').length*2};}
  };
  while(pending.length){
    const s=pending.pop(),key=JSON.stringify(s);if(seen.has(key))continue;seen.add(key);
    if(seen.size>2000)throw Error('Unbounded append proof');
    const i=map.get(s.pc);if(!i)throw Error('Uncovered append edge '+cpuLabel(s.pc));
    if(i.state.e!==0||i.state.m!==s.m||i.state.x!==s.x)throw Error('Append width mismatch '+cpuLabel(s.pc));
    if(!allowed.has(i.mnemonic))throw Error('Unproved append operation '+cpuLabel(s.pc));
    if(i.mode==='immM'&&i.length!==(s.m?2:3)||i.mode==='immX'&&i.length!==3)throw Error('Append immediate width');
    visited.add(s.pc);const t={...s,pc:i.next,stack:[...s.stack]};measure(s.pc,s.stack);
    if(i.mnemonic==='JSR'){
      if(i.mode!=='abs'||i.target===undefined)throw Error('Unproved append call');
      t.stack.push({kind:'return',pc:i.next});t.pc=i.target;
    }else if(i.mnemonic==='RTS'){
      if(s.m||s.x)throw Error('Wrong append return mode');
      if(!t.stack.length){returns.add(cpuLabel(s.pc));continue;}
      const frame=t.stack.pop();if(frame.kind!=='return')throw Error('Append return stack mismatch');t.pc=frame.pc;
    }else if(i.mnemonic==='PHA'){
      if(s.m)throw Error('Append PHA must be WORD');t.stack.push({kind:'data'});
    }else if(i.mnemonic==='PLA'){
      if(s.m||t.stack.pop()?.kind!=='data')throw Error('Append data stack mismatch');
    }else if(['REP','SEP'].includes(i.mnemonic)){
      if(i.value!==32)throw Error('Unproved append status mask');t.m=Number(i.mnemonic==='SEP');
    }else if(i.mnemonic==='BRA')t.pc=i.target;
    else if(i.mode==='rel8')pending.push({...t,pc:i.target,stack:[...t.stack]});
    measure(s.pc,t.stack);pending.push(t);
  }
  const modeWindows=[];
  for(const m of [0,1]){
    let current=null;
    for(const pc of [...visited].filter(pc=>map.get(pc).state.m===m).sort((a,b)=>a-b)){
      const start=cpuLabel(pc),end=cpuLabel(map.get(pc).next);
      if(current?.end_exclusive===start)current.end_exclusive=end;
      else{current={entry:start,end_exclusive:end,m,x:0};modeWindows.push(current);}
    }
  }
  return {entry:cpuLabel(entry),abstract_states:seen.size,reachable_instructions:visited.size,
    returns:[...returns].sort().map(at=>({at,m:0,x:0,dbr:'entry',d:0})),
    maximum_local_stack_bytes:maximum,minimum_protected_stack_bytes:maximum+2,
    maximum_stack_witness:witness,mode_windows:modeWindows.sort((a,b)=>a.entry.localeCompare(b.entry)),
    external_return_assumptions:0,excluded_boundaries:[],
    qualification:'Closed static fixed-callee control/WORD-BYTE/typed stack graph. E0M0X0/D0000 binary, actual DBR preserved by every allowed operation, intact disjoint code/stack/effective stores including failure writes. No data-loop termination, allocator success, valid slot, CPU/device/interrupt/scene/frame execution.'};
}
