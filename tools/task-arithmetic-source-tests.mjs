import test from 'node:test';import assert from 'node:assert/strict';
import {partialTaskTests} from './task-partial-source-tests.mjs';
import {arithmeticOwners} from './task-arithmetic-source.mjs';
export async function arithmeticSourceTests(spec,prove,hashes){
  const r=await partialTaskTests(spec,prove,hashes),proof=r.report.proofs[0];
  test(spec.name+' every control edge preserves explicit M width and stack depth',()=>{
    for(const e of proof.edges){const to=r.map.get(parseInt(e.to.replace(':',''),16));assert.equal(to.state.m,e.m);}
    assert.equal(proof.operand_s_delta,2);assert.equal(proof.outer_return_frames_added,0);
    assert.equal(proof.minimum_protected_stack_bytes,null);
    assert.ok(![...r.map.values()].some(i=>['JSR','JSL','TCS','RTS'].includes(i.mnemonic)));
  });
  test(spec.name+' conditional physical stack owners wrap bank00 independently of all DBRs',()=>{
    for(let bank=0;bank<256;bank++){
      const owners=arithmeticOwners(proof,{s:65535,d:65535,bank,y:65535,pointerAfter:65535});
      assert.equal(owners.output_s,1);assert.equal(owners.next_opcode.pointer_reads[1].address,'00:0000');
      for(const e of owners.conditional_events)if(e.read_offsets)for(const [kind,offsets]of [['reads',e.read_offsets],['writes',e.write_offsets]])
        assert.deepEqual(e[kind].map(o=>o.address),offsets.map(n=>'00:'+((65535+n)&65535).toString(16).toUpperCase().padStart(4,'0')));
      for(const e of owners.conditional_events)if(e.absolute!==undefined)assert.equal(e.owners[0].address,bank.toString(16).toUpperCase().padStart(2,'0')+':'+e.absolute.toString(16).toUpperCase().padStart(4,'0'));
    }
    for(const patch of [{bank:256},{s:-1},{d:undefined},{pointerAfter:65536}])assert.throws(()=>arithmeticOwners(proof,{s:0,d:0,bank:0,y:0,pointerAfter:0,...patch}));
  });
  return r;
}
