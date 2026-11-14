import {isIoAddress} from '../src/vm/devices.mjs';

// Test-only reference: executes already decoded and pinned instructions (decodeTaskWindows) of one
// closed helper graph on a VmMemory, to check fixed native equations against the original bytes.
// Never imported by src/. Only the native-mode instructions listed in STEP exist; anything else,
// decimal mode, an uncovered PC or a step budget overrun throws. Hardware registers other than the
// arithmetic unit are not modelled. Semantics per WDC W65C816S datasheet (binary mode only).
// calls: target -> run() for routines proved elsewhere; the reference pushes the real JSR/JSL frame,
// run() executes the routine's module on the same ctx/memory and returns {rawReturnWord} after taking
// the frame back; execution continues after the call. root: 'RTL' (default), 'RTS' or 'RTI' ends at depth 0.
// io: optional array that receives the hardware accesses (shared with the modules' trace).
export function runReference(map,mem,ctx,{entry,stopDepth=0,limit=1_000_000,calls=new Map(),root='RTL',io=[],before=null,repeatBlockMoves=false}={}) {
  const visited=new Set();
  let pc=entry,depth=0,steps=0;
  const m=()=>(ctx.status&0x20)!==0,xw=()=>(ctx.status&0x10)!==0;
  const nz=(v,byte)=>{ctx.status=(ctx.status&~0x82)|(byte?v&0x80:v&0x8000?0x80:0)|((byte?v&255:v&65535)===0?2:0);return v;};
  const setA=v=>{if(m())ctx.a=(ctx.a&0xFF00)|nz(v&255,true);else ctx.a=nz(v&65535,false);};
  const setIndex=(name,v)=>{ctx[name]=nz(xw()?v&255:v&65535,xw());};
  const read8=(address,at)=>{
    const value=mem.read8(address&0xFFFFFF);
    if(isIoAddress(address&0xFFFFFF))io.push({kind:'read',pc:at,address:address&0xFFFFFF,value});
    return value;
  };
  const write8=(address,value,at)=>{
    if(isIoAddress(address&0xFFFFFF))io.push({kind:'write',pc:at,address:address&0xFFFFFF,value});
    mem.write8(address&0xFFFFFF,value&255);
  };
  // Data reads/writes of width 1 or 2; dp/stack wrap in bank 0, other modes 24-bit.
  const read=(address,width,at,bank0=false)=>{
    const lo=read8(address,at);if(width===1)return lo;
    return lo|read8(bank0?(address+1)&0xFFFF:address+1,at)<<8;
  };
  const write=(address,value,width,at,bank0=false)=>{
    write8(address,value&255,at);if(width===2)write8(bank0?(address+1)&0xFFFF:address+1,value>>>8,at);
  };
  const push8=v=>{mem.write8(ctx.s,v&255);ctx.s=(ctx.s-1)&0xFFFF;};
  const pull8=()=>{ctx.s=(ctx.s+1)&0xFFFF;return mem.read8(ctx.s);};
  const address=i=>{
    const dbr=ctx.bank<<16;
    switch(i.mode){
      case 'dp':return {a:(ctx.d+i.value)&0xFFFF,bank0:true};
      case 'dpx':return {a:(ctx.d+i.value+ctx.x)&0xFFFF,bank0:true};
      case 'abs':return {a:dbr|i.value};
      case 'absx':return {a:(dbr|i.value)+ctx.x};
      case 'absy':return {a:(dbr|i.value)+ctx.y};
      case 'long':return {a:i.value};
      // Stack relative d,S: bank 0, S + offset (E014 ORA $01,S).
      case 'sr':return {a:(ctx.s+i.value)&0xFFFF,bank0:true};
      case 'longx':return {a:i.value+ctx.x};
      case 'di':case 'diy':{
        const p=(ctx.d+i.value)&0xFFFF,pointer=mem.read8(p)|mem.read8((p+1)&0xFFFF)<<8;
        return {a:(dbr|pointer)+(i.mode==='diy'?ctx.y:0)};
      }
      case 'dil':case 'dily':{
        const p=(ctx.d+i.value)&0xFFFF,pointer=mem.read8(p)|mem.read8((p+1)&0xFFFF)<<8|mem.read8((p+2)&0xFFFF)<<16;
        return {a:pointer+(i.mode==='dily'?ctx.y:0)};
      }
    }
    throw Error('Reference addressing mode '+i.mode);
  };
  const operand=(i,width)=>{
    if(i.mode==='immM'||i.mode==='immX')return i.value;
    const t=address(i);return read(t.a,width,i.cpu,t.bank0);
  };
  const binary=()=>{if(ctx.status&8)throw Error('Reference decimal mode');};
  const compare=(left,right,width)=>{
    const mask=width===1?255:65535,r=(left&mask)-(right&mask);
    ctx.status=(ctx.status&~1)|Number(r>=0);nz(r&mask,width===1);
  };
  const add=(right,subtract)=>{
    binary();const width=m()?1:2,mask=width===1?255:65535,sign=width===1?0x80:0x8000,left=ctx.a&mask;
    if(subtract)right=~right&mask;
    const sum=left+(right&mask)+(ctx.status&1),result=sum&mask;
    ctx.status=(ctx.status&~0x41)|Number(sum>mask)|((~(left^right)&(left^result)&sign)?0x40:0);setA(result);
  };
  const branch=(i,taken)=>taken?i.target:i.next;
  for(;;){
    if(++steps>limit)throw Error('Reference step limit');
    const i=map.get(pc);if(!i)throw Error('Reference uncovered '+pc.toString(16));
    // Test: vor einem Befehl beobachtete Werte ablegen (Warteschleifen auf vom NMI geschriebene Wörter).
    if(before!==null&&before.has(pc))before.get(pc)(mem);
    // Only immediate operands change their length with M/X; other instructions may join from both modes.
    if(i.mode==='immM'&&i.state.m!==Number(m())||i.mode==='immX'&&i.state.x!==Number(xw()))throw Error('Reference mode mismatch '+pc.toString(16));
    visited.add(pc);let next=i.next;
    const wm=m()?1:2,wx=xw()?1:2;
    switch(i.mnemonic){
      case 'LDA':setA(operand(i,wm));break;
      case 'LDX':setIndex('x',operand(i,wx));break;
      case 'LDY':setIndex('y',operand(i,wx));break;
      case 'STX':{const t=address(i);write(t.a,ctx.x,wx,i.cpu,t.bank0);break;}
      case 'STY':{const t=address(i);write(t.a,ctx.y,wx,i.cpu,t.bank0);break;}
      case 'BIT':{
        const value=operand(i,wm);
        ctx.status=(ctx.status&~2)|((ctx.a&value&(wm===1?255:65535))===0?2:0);
        if(i.mode!=='immM')ctx.status=(ctx.status&~0xC0)|((value>>>(wm===1?0:8))&0xC0);
        break;
      }
      case 'BVS':next=branch(i,(ctx.status&0x40)!==0);break;
      case 'TAX':setIndex('x',xw()?ctx.a&255:ctx.a);break;
      case 'TXA':setA(ctx.x);break;
      case 'TYA':setA(ctx.y);break;
      case 'TSC':ctx.a=ctx.s;nz(ctx.a,false);break;
      case 'TCS':ctx.s=ctx.a;break;
      case 'TCD':ctx.d=ctx.a;nz(ctx.d,false);break;
      case 'PHD':push8(ctx.d>>>8);push8(ctx.d);break;
      case 'PLD':ctx.d=pull8()|pull8()<<8;nz(ctx.d,false);break;
      case 'PHB':push8(ctx.bank);break;
      case 'PHK':push8(pc>>>16);break;
      case 'SEI':ctx.status|=4;break;
      case 'CLI':ctx.status&=~4;break;
      case 'PLB':ctx.bank=pull8();nz(ctx.bank,true);break;
      case 'PEA':push8(i.value>>>8);push8(i.value);break;
      case 'MVN':case 'MVP':{
        if(xw())throw Error('Reference block move with 8-bit index');
        const destination=i.raw[1],source=i.raw[2],step=i.mnemonic==='MVN'?1:-1;let first=true;
        do{if(!first&&repeatBlockMoves&&before?.has(pc))before.get(pc)(mem);first=false;ctx.bank=destination;
          write((destination<<16)|ctx.y,read((source<<16)|ctx.x,1,i.cpu),1,i.cpu);
          ctx.x=(ctx.x+step)&0xFFFF;ctx.y=(ctx.y+step)&0xFFFF;ctx.a=(ctx.a-1)&0xFFFF;}while(ctx.a!==0xFFFF);
        break;
      }
      case 'TAY':setIndex('y',xw()?ctx.a&255:ctx.a);break;
      case 'PHA':if(wm===2)push8(ctx.a>>>8);push8(ctx.a);break;
      case 'PLA':{const lo=pull8();setA(wm===2?lo|pull8()<<8:lo);break;}
      case 'PHX':if(wx===2)push8(ctx.x>>>8);push8(ctx.x);break;
      case 'PHY':if(wx===2)push8(ctx.y>>>8);push8(ctx.y);break;
      case 'PLX':{const lo=pull8();setIndex('x',wx===2?lo|pull8()<<8:lo);break;}
      case 'PLY':{const lo=pull8();setIndex('y',wx===2?lo|pull8()<<8:lo);break;}
      case 'PHP':push8(ctx.status);break;
      case 'PLP':ctx.status=pull8();if(ctx.status&0x10){ctx.x&=255;ctx.y&=255;}break;
      case 'PEI':{const p=(ctx.d+i.value)&0xFFFF,v=mem.read8(p)|mem.read8((p+1)&0xFFFF)<<8;push8(v>>>8);push8(v);break;}
      case 'STA':{const t=address(i);write(t.a,ctx.a,wm,i.cpu,t.bank0);break;}
      case 'STZ':{const t=address(i);write(t.a,0,wm,i.cpu,t.bank0);break;}
      case 'ADC':add(operand(i,wm),false);break;
      case 'SBC':add(operand(i,wm),true);break;
      case 'AND':setA(ctx.a&operand(i,wm));break;
      case 'ORA':setA(ctx.a|operand(i,wm));break;
      case 'EOR':setA(ctx.a^operand(i,wm));break;
      case 'CMP':compare(ctx.a,operand(i,wm),wm);break;
      case 'CPX':compare(ctx.x,operand(i,wx),wx);break;
      case 'CPY':compare(ctx.y,operand(i,wx),wx);break;
      case 'ASL':case 'LSR':case 'ROL':case 'ROR':{
        const mask=wm===1?255:65535,sign=mask^(mask>>>1),t=i.mode==='A'?null:address(i);
        const v=t===null?ctx.a&mask:read(t.a,wm,i.cpu,t.bank0),c=ctx.status&1;
        const left=i.mnemonic==='ASL'||i.mnemonic==='ROL';
        ctx.status=(ctx.status&~1)|(left?Number((v&sign)!==0):v&1);
        const result=(left?(v<<1)|(i.mnemonic==='ROL'?c:0):(v>>>1)|(i.mnemonic==='ROR'&&c?sign:0))&mask;
        if(t===null)setA(result);else{nz(result,wm===1);write(t.a,result,wm,i.cpu,t.bank0);}
        break;
      }
      case 'TSB':case 'TRB':{
        const t=address(i),mask=wm===1?255:65535,v=read(t.a,wm,i.cpu,t.bank0),bits=ctx.a&mask;
        ctx.status=(ctx.status&~2)|((v&bits)===0?2:0);
        write(t.a,i.mnemonic==='TSB'?v|bits:v&~bits&mask,wm,i.cpu,t.bank0);break;
      }
      case 'INC':case 'DEC':{
        const delta=i.mnemonic==='INC'?1:-1;
        if(i.mode==='A')setA((ctx.a&(wm===1?255:65535))+delta);
        else{const t=address(i),v=(read(t.a,wm,i.cpu,t.bank0)+delta)&(wm===1?255:65535);nz(v,wm===1);write(t.a,v,wm,i.cpu,t.bank0);}
        break;
      }
      case 'INX':setIndex('x',ctx.x+1);break;
      case 'DEX':setIndex('x',ctx.x-1);break;
      case 'INY':setIndex('y',ctx.y+1);break;
      case 'DEY':setIndex('y',ctx.y-1);break;
      case 'TYX':setIndex('x',ctx.y);break;
      case 'TXY':setIndex('y',ctx.x);break;
      case 'XBA':ctx.a=((ctx.a>>>8)|(ctx.a<<8))&65535;nz(ctx.a&255,true);break;
      case 'CLC':ctx.status&=~1;break;
      case 'SEC':ctx.status|=1;break;
      case 'CLD':ctx.status&=~8;break;
      case 'XCE':{
        if(ctx.e!==0&&ctx.e!==1)throw Error('Reference explicit E mode required');
        const old=ctx.e;ctx.e=ctx.status&1;ctx.status=(ctx.status&~1)|old;
        if(ctx.e){ctx.status|=0x30;ctx.x&=255;ctx.y&=255;ctx.s=0x100|(ctx.s&255);}break;
      }
      case 'NOP':break;
      case 'REP':ctx.status&=~i.value;break;
      case 'SEP':ctx.status|=i.value;if(ctx.status&0x10){ctx.x&=255;ctx.y&=255;}break;
      case 'BCC':next=branch(i,!(ctx.status&1));break;
      case 'BCS':next=branch(i,(ctx.status&1)!==0);break;
      case 'BEQ':next=branch(i,(ctx.status&2)!==0);break;
      case 'BNE':next=branch(i,!(ctx.status&2));break;
      case 'BMI':next=branch(i,(ctx.status&0x80)!==0);break;
      case 'BPL':next=branch(i,!(ctx.status&0x80));break;
      case 'JML':{
        if(i.target!==undefined)next=i.target;
        else if(i.mode==='ind')next=mem.read8(i.value)|mem.read8((i.value+1)&0xFFFF)<<8|mem.read8((i.value+2)&0xFFFF)<<16;
        else throw Error('Reference long jump mode '+i.mode);
        ctx.programBank=next>>>16;break;
      }
      case 'BRA':case 'BRL':case 'JMP':
        if(i.target!==undefined){next=i.target;break;}
        // JMP (abs): Zeiger in Bank 0 (nicht DBR), Ziel in der Programmbank.
        if(i.mode==='indx'){
          // JMP (abs,X): Zeiger in der Programmbank.
          const p=(pc&0xFF0000)|((i.value+ctx.x)&0xFFFF);
          next=(pc&0xFF0000)|mem.read8(p)|mem.read8((pc&0xFF0000)|((i.value+ctx.x+1)&0xFFFF))<<8;break;
        }
        if(i.mode!=='ind')throw Error('Reference jump mode '+i.mode);
        next=(pc&0xFF0000)|mem.read8(i.value)|mem.read8((i.value+1)&0xFFFF)<<8;break;
      case 'JSR':case 'JSL':{
        let target=i.target;
        if(i.mnemonic==='JSR'&&i.mode==='indx'){
          const pointer=(pc&0xFF0000)|((i.value+ctx.x)&0xFFFF);
          target=(pc&0xFF0000)|read8(pointer,i.cpu)|read8((pc&0xFF0000)|((pointer+1)&0xFFFF),i.cpu)<<8;
        }
        const r=(i.next-1)&0xFFFF;
        if(i.mnemonic==='JSL')push8(pc>>>16);push8(r>>>8);push8(r);
        if(calls.has(target)){
          ctx.programBank=target>>>16;ctx.pc=target&0xFFFF;
          const result=calls.get(target)();
          if(result.rawReturnWord!==r||ctx.programBank!==pc>>>16)throw Error('Reference external return '+target.toString(16));
          break;
        }
        depth++;next=target;break;
      }
      case 'RTS':{
        const r=pull8()|pull8()<<8;
        if(depth===stopDepth&&root==='RTS'){ctx.pc=(r+1)&0xFFFF;return {visited,io,steps,rawReturnWord:r};}
        depth--;next=(pc&0xFF0000)|((r+1)&0xFFFF);break;
      }
      case 'RTL':{
        const r=pull8()|pull8()<<8,bank=pull8();
        if(depth===stopDepth&&root==='RTL'){ctx.pc=(r+1)&0xFFFF;ctx.programBank=bank;return {visited,io,steps,rawReturnWord:r};}
        depth--;next=(bank<<16)|((r+1)&0xFFFF);ctx.programBank=bank;break;
      }
      case 'BRK':case 'COP':{
        // Native mode: PB, PC behind the signature byte, P; I set, D cleared; vector in bank 0.
        const r=(pc+2)&0xFFFF;push8(pc>>>16);push8(r>>>8);push8(r);push8(ctx.status);
        ctx.status=(ctx.status|0x04)&~0x08;const vector=i.mnemonic==='BRK'?0xFFE6:0xFFE4;
        next=mem.read8(vector)|mem.read8(vector+1)<<8;ctx.programBank=0;break;
      }
      case 'RTI':{
        ctx.status=pull8();const r=pull8()|pull8()<<8,bank=pull8();
        if(ctx.status&0x10){ctx.x&=255;ctx.y&=255;}
        if(depth===stopDepth&&root==='RTI'){ctx.pc=r;ctx.programBank=bank;return {visited,io,steps};}
        next=(bank<<16)|r;ctx.programBank=bank;break;
      }
      default:throw Error('Reference instruction '+i.mnemonic);
    }
    pc=next;
  }
}
