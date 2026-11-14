// Test-only speculative source-contract view. Copy current WRAM once per
// visit; share only immutable ROM. No VM execution, device model, cached task
// data or partial publication. Only DEC7's independently pinned camera WORD
// at 70:1FFD is admitted as read-only SRAM; other SRAM stays a boundary.
import {renderAddress} from '../src/render/data.mjs';
import {taskStop} from '../src/task/plan.mjs';
import {rom} from './task-native-dialog-harness.mjs';
const nestedCameras=new WeakMap();

export function bootReferenceView(mem,{context,protectedStackBytes,maxWork=3e6,maxOutputBytes=1e6}){
  const wram=mem.wram.slice(),camera=nestedCameras.has(mem)?nestedCameras.get(mem)?.slice():mem.sram?.slice(0x1FFD,0x1FFF),
    ctx={...context},protectedBytes=new Set(protectedStackBytes),accesses=[];
  let work=0,outputBytes=0,cameraReads=0;
  const tick=(n=1)=>{if(work+n>maxWork)taskStop('task_work_budget_required');work+=n;};
  const owner=(address,outer=false)=>{
    const physical=renderAddress(address);
    if(physical===null)taskStop('render_address_required',{address});
    if(protectedBytes.has(physical)&&!outer)taskStop('task_stack_alias_required',{address:physical});
    if(outer&&!protectedBytes.has(physical))taskStop('task_outer_return_required',{address:physical});
    return physical;
  };
  const read=(address,label,outer=false)=>{tick();
    if(address===0x701FFD||address===0x701FFE){
      if(outer)taskStop('task_outer_return_required',{address});
      if(camera?.length!==2)taskStop('boot_camera_sram_required');
      cameraReads++;return camera[address-0x701FFD];
    }
    const physical=owner(address,outer);
    if(physical>=0x7E0000&&physical<=0x7FFFFF)return wram[physical-0x7E0000];
    const offset=((physical>>>16)&0x1F)*0x8000+(physical&0x7FFF);
    if(offset>=rom.length)taskStop('render_source_required',{address:physical});
    return rom[offset];
  };
  const write=(address,value,label)=>{tick();const physical=owner(address);
    if(physical>=0x800000&&address>>>16!==0)return; // original ineffective LoROM write
    if(physical<0x7E0000||physical>0x7FFFFF)taskStop('render_write_window_required',{address:physical});
    if(outputBytes+1>maxOutputBytes)taskStop('task_output_budget_required');outputBytes++;
    wram[physical-0x7E0000]=value;accesses.push({kind:'write',address,value});
  };
  const readWord=(address,wrap=24,label='WORD',outer=false)=>{const mask=wrap===16?65535:0xFFFFFF;
    return read(address&mask,label,outer)|read((address+1)&mask,label,outer)<<8;};
  const writeWord=(address,value,wrap=24,label='WORD')=>{const mask=wrap===16?65535:0xFFFFFF;
    write(address&mask,value&255,label);write((address+1)&mask,value>>>8,label);};
  const stackWord=(offset=1,label='stack-WORD')=>readWord((ctx.s+offset)&65535,16,label);
  const pullWord=(label='PLA')=>{const value=stackWord(1,label);ctx.s=(ctx.s+2)&65535;return value;};
  const pushWord=(value,label='PHA')=>{write(ctx.s,value>>>8,label);ctx.s=(ctx.s-1)&65535;write(ctx.s,value&255,label);ctx.s=(ctx.s-1)&65535;};
  const streamWord=(label='stream-WORD')=>readWord((ctx.bank*65536+readWord(ctx.d,16,label)+ctx.y)&0xFFFFFF,24,label);
  const fetch=()=>{const opcodeWord=streamWord('fresh-next-opcode');ctx.y=(ctx.y+1)&65535;ctx.a=ctx.x=opcodeWord&255;
    ctx.status=(ctx.status&~0x82)|(ctx.a===0?2:0);ctx.pc=0xF390;return {opcodeWord,frontier:'80:F390'};};
  const absoluteRead=(offset,width,pc,label)=>{const address=ctx.bank*65536+offset;
    return width===1?read(address,label):readWord(address,24,label);};
  const absoluteWrite=(offset,value,width,pc,label)=>{const address=ctx.bank*65536+offset;
    if(width===1)write(address,value,label);else writeWord(address,value,24,label);};
  const accessor={ctx,entry:context.programBank*65536+context.pc,read,write,readWord,writeWord,
    stackWord,pullWord,pushWord,streamWord,fetch,tick,absoluteRead,absoluteWrite};
  // Nested original rounds copy this private state, then publish their writes
  // through these same guards into the enclosing speculative visit. Nothing
  // reaches the caller's memory until that entire visit succeeds.
  const memory=Object.freeze({wram,read8:read,write8:write});nestedCameras.set(memory,camera);
  return {accessor,memory,finish:result=>({handled:true,...result,outputContext:{...ctx},accesses,work,outputBytes,cameraReads})};
}
