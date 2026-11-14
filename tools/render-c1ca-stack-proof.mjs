import {cpuLabel} from './rom.mjs';

// Typed source frontier, not register/memory execution. No continuation,
// interpreter or arbitrary native return is substituted by a host callback.
export function proveVisitC1CAFrontier(map,{skipReady=false}={}){
  if(typeof skipReady!=='boolean')throw Error('Explicit visit profile required');
  const expect=(pc,op,value,mode)=>{const i=map.get(pc);
    if(i?.mnemonic!==op||value!==undefined&&(i.target??i.value)!==value||mode!==undefined&&i.mode!==mode)
      throw Error('Renew visit source lemma '+cpuLabel(pc));};
  for(const [pc,op,value,mode]of [[0x80C1CA,'LDA',0x250,'abs'],[0x80C1CD,'PHA'],[0x80C1D6,'JSR',0x80C1F9],
    [0x80C1D9,'PEA',0x8080],[0x80C1DC,'PLB'],[0x80C1DD,'PLB'],[0x80C1DE,'PLA'],[0x80C1E2,'RTS'],
    [0x80C1F9,'JSR',0x80C3C9],[0x80C1FC,'BCC',0x80C22F],[0x80C1FE,'LDA',0x2B2,'absx'],
    [0x80C201,'BEQ',0x80C208],[0x80C203,'PEA',0xC20A],[0x80C206,'PHA'],[0x80C207,'RTS'],
    [0x80C208,'JSR',0x80F378],[0x80C238,'RTS'],[0x80F378,'LDA',0x252,'absx'],[0x80F37B,'TCD'],
    [0x80F37C,'PEI',1,'di'],[0x80F37E,'PLB'],[0x80F37F,'PLB'],[0x80F380,'TSC'],
    [0x80F381,'STA',0x1F2,'abs'],[0x80F384,'LDA',7,'dp'],[0x80F386,'TCS']])expect(pc,op,value,mode);
  const allowed=new Set(['LDA','LDX','STA','STX','STZ','AND','BIT','DEC','TSB','CLC','SEC',
    'BEQ','BNE','BMI','BPL','BCC','BRA','JSR','RTS','PHA','PLA','PEA','PEI','PLB','TCD','TSC','TCS']);
  const pending=[{pc:0x80C1CA,m:0,x:0,d:0,dbr:'entry',stack:[]}],seen=new Set(),visited=new Set(),returns=new Set(),boundaries=new Set();
  let maximum=0,witness=null;
  const depth=stack=>stack.reduce((n,v)=>n+v.bytes,0);
  const measure=(pc,stack)=>{const bytes=depth(stack);if(bytes>maximum){maximum=bytes;witness={at:cpuLabel(pc),local_stack_bytes:bytes,stack:stack.map(v=>({...v,...v.pc!==undefined?{pc:cpuLabel(v.pc)}:{}}))};}};
  while(pending.length){
    const s=pending.pop(),key=JSON.stringify(s);if(seen.has(key))continue;seen.add(key);if(seen.size>2000)throw Error('Unbounded visit frontier');
    const i=map.get(s.pc);if(!i)throw Error('Uncovered visit edge '+cpuLabel(s.pc));
    if(i.state.e!==0||i.state.m!==s.m||i.state.x!==s.x||s.m||s.x)throw Error('Visit WORD width mismatch '+cpuLabel(s.pc));
    if(['immM','immX'].includes(i.mode)&&i.length!==3)throw Error('Visit immediate width mismatch');
    if(!allowed.has(i.mnemonic))throw Error('Unproved visit operation '+cpuLabel(s.pc));
    visited.add(s.pc);measure(s.pc,s.stack);const t={...s,pc:i.next,stack:[...s.stack]};
    const pop=kind=>{const v=t.stack.pop();if(v?.kind!==kind)throw Error('Visit typed stack mismatch '+cpuLabel(s.pc));return v;};
    if(i.mnemonic==='JSR'){
      if(i.mode!=='abs'||i.target===undefined)throw Error('Unproved visit call');
      t.stack.push({kind:'return',bytes:2,pc:i.next});t.pc=i.target;
    }else if(i.mnemonic==='PHA'){
      if(s.pc===0x80C1CD)t.stack.push({kind:'cursor',bytes:2});
      else if(s.pc===0x80C206)t.stack.push({kind:'continuation',bytes:2});
      else throw Error('Unproved visit PHA');
    }else if(i.mnemonic==='PLA')pop('cursor');
    else if(i.mnemonic==='PEA'){
      if(s.pc===0x80C203)t.stack.push({kind:'return',bytes:2,pc:0x80C20B});
      else if(s.pc===0x80C1D9)t.stack.push({kind:'bank',bytes:1,value:128},{kind:'bank',bytes:1,value:128});
      else throw Error('Unproved visit PEA');
    }else if(i.mnemonic==='PEI'){
      if(s.pc!==0x80F37C||s.d!=='frame')throw Error('Unproved visit PEI pointer');
      t.stack.push({kind:'bank',bytes:1,value:'fresh frame byte2'},{kind:'bank',bytes:1,value:'fresh frame byte1'});
    }else if(i.mnemonic==='PLB')t.dbr=pop('bank').value;
    else if(i.mnemonic==='TCD'){
      if(s.pc!==0x80F37B)throw Error('Unproved visit D setter');t.d='frame';
    }else if(i.mnemonic==='TCS'){
      if(s.pc!==0x80F386||s.d!=='frame')throw Error('Unproved visit stack setter');
      boundaries.add(JSON.stringify({at:cpuLabel(s.pc),kind:'task-stack-switch',d:s.d,dbr:s.dbr,
        preserved_local_stack_bytes:depth(s.stack),required:'Fresh WORD frame7 becomes S. Root return/cursor/visit/F378 frames remain on saved outer stack; operand stack, opcode/native effects and return restoration unproved.'}));continue;
    }else if(i.mnemonic==='RTS'){
      if(s.pc===0x80C207){pop('continuation');
        boundaries.add(JSON.stringify({at:cpuLabel(s.pc),kind:'continuation-rts',target:'80:((fresh WORD DBR02B2+X + 1) & FFFF)',
          d:s.d,dbr:s.dbr,remaining_local_stack_bytes:depth(t.stack),return_to:'80:C20B',
          required:'Target must establish an actual compatible return to C20B with restored WORD mode, D, DBR and stack. No inferred return; target can wrap to0000.'}));continue;
      }
      if(!t.stack.length){if(s.d!==0)throw Error('Wrong visit root D');returns.add(JSON.stringify({at:cpuLabel(s.pc),m:0,x:0,d:0,dbr:s.dbr}));continue;}
      t.pc=pop('return').pc;
    }else if(i.mode==='rel8'){
      if(s.pc===0x80C1FC&&skipReady){
        boundaries.add(JSON.stringify({at:cpuLabel(s.pc),kind:'excluded-ready-task',to:cpuLabel(i.next),required:'Actual C3C9 Carry0 at each reached C1FC; no ready task dispatched.'}));t.pc=i.target;
      }else if(i.mnemonic==='BRA')t.pc=i.target;
      else pending.push({...t,pc:i.target,stack:[...t.stack]});
    }
    measure(s.pc,t.stack);pending.push(t);
  }
  return {entry:'80:C1CA',abstract_states:seen.size,reachable_instructions:visited.size,
    visited:[...visited].sort((a,b)=>a-b).map(cpuLabel),returns:[...returns].map(JSON.parse),
    maximum_local_stack_bytes:maximum,
    ...(skipReady?{minimum_protected_stack_bytes:maximum+2}:{minimum_protected_prefix_stack_bytes:maximum+2}),
    maximum_stack_witness:witness,boundaries:[...boundaries].map(JSON.parse),external_return_assumptions:0,
    qualification:skipReady?'Conditional actual-callee WORD/D0/DBR/typed-stack proof: negative tail or actual C3C9 Carry0. Ready branch excluded explicitly. Intact code/stack, binary E0M0X0/D0; no wholevisit or data/scene/frame execution.'
      :'Exhaustive source/typed outer-stack frontier through actualC3C9 to continuation RTS or task TCS. Prefix stack only, never a global stack minimum or returning task assumption. Intact code/stack, binary E0M0X0/D0; no CPU/device/scene/frame execution.'};
}
