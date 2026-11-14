import assert from 'node:assert/strict';

// Synthetic device observations; these bytes are not original VRAM contents.
export const textDma=(vmadd=0,seed=0,address=0x420B)=>Object.freeze({
  pc:0x81AA93,address,width:1,value:0x20,dmap:0x81,bbad:0x39,a1b:0x7E,
  a1t:0x2AE0,das:16,vmain:0x80,vmadd,
  bytes:Object.freeze(Array.from({length:16},(_,i)=>(seed*37+i*19)&255))});

// Independent test device: runReference performs the original stores. Observe
// the BYTE start write, check its preceding register writes, then deliver the
// declared bytes in alternating B-bus / incrementing A-bus order. No native
// transfer function is used on this side of the comparison.
export function referenceTextDma(v,records){
  const write=v.mem.write8.bind(v.mem);let index=0;
  v.mem.write8=(address,value)=>{
    write(address,value);
    const last=v.a.trace.at(-1);
    if(last?.kind!=='write'||last.pc!==0x81AA93||address!==last.address||value!==0x20)return;
    const o=records[index++];assert.ok(o,'reference DMA occurrence');
    assert.equal(address,o.address);
    const register=offset=>{
      const byte=v.a.trace.findLast(t=>t.kind==='write'&&(t.address&65535)===offset);
      assert.ok(byte,offset.toString(16));return byte.value;
    };
    assert.equal(register(0x2116)|(register(0x2117)<<8),o.vmadd);
    assert.equal(register(0x4352)|(register(0x4353)<<8),o.a1t);
    assert.equal(register(0x4355)|(register(0x4356)<<8),o.das);
    assert.equal(register(0x2115),o.vmain);
    for(let i=0;i<o.das;i++)write((o.a1b<<16)|((o.a1t+i)&65535),o.bytes[i]);
  };
  return ()=>index;
}
