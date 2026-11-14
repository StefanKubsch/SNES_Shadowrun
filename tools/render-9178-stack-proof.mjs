import { cpuLabel } from './rom.mjs';

// Source/control/typed byte-stack only. Actual callees are followed; the
// post-PLP task branch is excluded explicitly, never replaced by a return.
export function proveText9178Stack(map, entry = 0x809178) {
  if (![0x809178, 0x80908C].includes(entry)) throw Error('Invalid9178 proof entry');
  const expect = (pc, op, value, mode) => {
    const i = map.get(pc);
    if (i?.mnemonic !== op || value !== undefined && (i.target ?? i.value) !== value
      || mode !== undefined && i.mode !== mode) throw Error('Renew9178 source lemma ' + cpuLabel(pc));
  };
  if (entry === 0x809178) {
    for (const [pc, op, value] of [[0x80917E,'JSR',0x80FA67],[0x809185,'JSR',0x80FAAC],
      [0x809188,'SEP',32],[0x8091AD,'PHA'],[0x8091AE,'JSR',0x80908C],[0x8091B1,'PLA'],
      [0x8091B2,'ASL'],[0x8091B3,'REP',32],[0x8091B5,'PHP'],[0x8091B6,'PHY'],
      [0x8091B7,'BCC',0x8091BB],[0x8091C3,'JSR',0x80FE69],[0x8091C6,'PLY'],
      [0x8091C7,'PLP'],[0x8091C8,'BCC',0x8091D7],[0x8091D1,'JSR',0x80C34A],
      [0x8091D4,'JSR',0x80C1CA],[0x8091D8,'REP',32]]) expect(pc,op,value);
    if (map.get(0x8091AD).state.m !== 1 || map.get(0x8091B1).state.m !== 1
      || map.get(0x8091B5).state.m !== 0) throw Error('Renew9178 saved byte/status width');
  }
  expect(0x80908C,'AND',15); expect(0x809091,'BEQ',0x8090EA); expect(0x8090EA,'RTS');
  const initialM = Number(entry === 0x80908C);
  const pending = [{pc:entry,m:initialM,x:0,dbr:'entry',stack:[],statusOrigin:null}];
  const seen = new Set(), visited = new Set(), modes = new Map(), returns = new Set(), boundaries = new Set();
  let maximum = 0, witness = null;
  const depth = stack => stack.reduce((n,v)=>n+(v.kind==='return'?(v.op==='RTS'?2:3):1),0);
  const measure = (pc,stack) => {
    const bytes = depth(stack); if (bytes <= maximum) return; maximum = bytes;
    witness = {at:cpuLabel(pc),local_stack_bytes:bytes,
      return_frames:stack.filter(v=>v.kind==='return').map(v=>({kind:v.op,to:cpuLabel(v.pc)})),
      data_bytes:stack.filter(v=>['data','index','bank'].includes(v.kind)).length,
      status_bytes:stack.filter(v=>v.kind==='status').length};
  };
  while (pending.length) {
    const s = pending.pop(), key = JSON.stringify(s); if (seen.has(key)) continue; seen.add(key);
    if (seen.size > 20000) throw Error('Unbounded9178 proof');
    const i = map.get(s.pc); if (!i) throw Error('Uncovered9178 edge ' + cpuLabel(s.pc));
    const join = s.pc === 0x80FC36 && i.mnemonic === 'SEP' && i.value === 32;
    if (i.state.x !== s.x || i.state.m !== s.m && !join) throw Error('9178 mode mismatch ' + cpuLabel(s.pc));
    if (i.mode === 'immM' && i.length !== (s.m?2:3) || i.mode === 'immX' && i.length !== (s.x?2:3))
      throw Error('9178 immediate width mismatch');
    visited.add(s.pc); modes.set(`${s.pc}/${s.m}/${s.x}`,{pc:s.pc,m:s.m,x:s.x}); measure(s.pc,s.stack);
    const t = {...s,pc:i.next,stack:[...s.stack]};
    const pop = kind => {const v=t.stack.pop();if(v?.kind!==kind)throw Error('9178 stack mismatch '+cpuLabel(s.pc));return v;};
    const push = (kind,n) => {for(let j=0;j<n;j++)t.stack.push({kind});};
    switch (i.mnemonic) {
      case 'PHP': t.stack.push({kind:'status',m:s.m,x:s.x,origin:s.pc}); break;
      case 'PLP': {const p=pop('status');t.m=p.m;t.x=p.x;t.statusOrigin=p.origin;break;}
      case 'PHB': t.stack.push({kind:'bank',value:s.dbr}); break;
      case 'PEA': t.stack.push({kind:'bank',value:i.value>>>8},{kind:'bank',value:i.value&255}); break;
      case 'PLB': t.dbr=pop('bank').value; break;
      case 'PHA': push('data',s.m?1:2);break;
      case 'PLA': for(let j=0;j<(s.m?1:2);j++)pop('data');break;
      case 'PHX': case 'PHY': push('index',s.x?1:2);break;
      case 'PLX': case 'PLY': for(let j=0;j<(s.x?1:2);j++)pop('index');break;
      case 'REP': case 'SEP': if(i.value&32)t.m=Number(i.mnemonic==='SEP');if(i.value&16)t.x=Number(i.mnemonic==='SEP');break;
      case 'JSR': case 'JSL':
        if(i.target===undefined)throw Error('Unproved9178 indirect call');
        t.stack.push({kind:'return',op:i.mnemonic==='JSR'?'RTS':'RTL',pc:i.next});t.pc=i.target;break;
      case 'RTS': case 'RTL':
        if(!t.stack.length){
          if(i.mnemonic!=='RTS'||s.m!==initialM||s.x||s.dbr!=='entry')throw Error('Wrong9178 root return');
          returns.add(JSON.stringify({at:cpuLabel(s.pc),m:s.m,x:s.x,dbr:s.dbr}));continue;
        }else{const frame=pop('return');if(frame.op!==i.mnemonic)throw Error('Wrong9178 callee return');t.pc=frame.pc;}break;
      case 'BRA': case 'BRL': case 'JMP': if(i.target===undefined)throw Error('Unproved9178 indirect edge');t.pc=i.target;break;
      case 'PEI': case 'PHK': case 'MVN': case 'MVP': case 'PHD': case 'PLD': case 'TCD': case 'XCE':
      case 'TCS': case 'TXS': case 'SED': case 'RTI': case 'BRK': case 'COP': case 'JML': case 'WAI': case 'STP':
        throw Error('Unproved9178 stack/control operation '+cpuLabel(s.pc));
      default:
        if(i.mode==='rel8') {
          if(s.pc===0x8091C8){
            if(s.statusOrigin!==0x8091B5)throw Error('Unproved9178 restored flag provenance');
            boundaries.add(JSON.stringify({at:cpuLabel(s.pc),to:cpuLabel(i.next),
              reason:'Restored BYTE flag bit7 set: separate real C34A source, C1CA dynamic task branch remains source-required',
              local_stack_bytes:depth(s.stack)}));t.pc=i.target;
          }else pending.push({...t,pc:i.target,stack:[...t.stack]});
        }
    }
    measure(s.pc,t.stack);pending.push(t);
  }
  const modeWindows=[];
  for(const m of [0,1])for(const x of [0,1]){
    let current=null;
    for(const v of [...modes.values()].filter(v=>v.m===m&&v.x===x).sort((a,b)=>a.pc-b.pc)){
      const start=cpuLabel(v.pc),end=cpuLabel(map.get(v.pc).next);
      if(current?.end_exclusive===start)current.end_exclusive=end;
      else{current={entry:start,end_exclusive:end,m,x};modeWindows.push(current);}
    }
  }
  return {entry:cpuLabel(entry),abstract_states:seen.size,reachable_instructions:visited.size,
    returns:[...returns].map(JSON.parse),maximum_local_stack_bytes:maximum,minimum_protected_stack_bytes:maximum+2,
    maximum_stack_witness:witness,mode_windows:modeWindows.sort((a,b)=>a.entry.localeCompare(b.entry)||a.m-b.m),
    excluded_boundaries:[...boundaries].map(JSON.parse),external_return_assumptions:0,
    qualification:'Static actual-callee BYTE/WORD/DBR/typed stack proof.9178 post-PLP bit7-set task branch excluded explicitly; full task graph open. Intact disjoint stack/code, E0/X0/D0, binary and actual DBR. No data-loop/wait termination, CPU/device/time/interrupt/scene/frame execution.'};
}
