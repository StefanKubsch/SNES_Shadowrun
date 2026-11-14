import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';

export const wordInterruptWindows=[
  {start:0x81ACAF,hex:'ADF801D0FB6BEEF80122AFAC816BADF601D0FB6BADFA01D0FB6BADFC01D0FB6B'},
  {start:0x81AEF4,hex:'EEFA0122C3AC816BEEFC0122C9AC816B'},
];
export const wordInterruptRoots=[0x81ACAF,0x81ACB5,0x81ACBD,0x81ACC3,0x81ACC9,0x81AEF4,0x81AEFC];
export function proveWordInterrupts(map){assertPinnedTaskSource(map,wordInterruptWindows);
  return wordInterruptRoots.map(entry=>{const p=proveWordStack(map,entry,'RTL',{measureStack:true});
    const request=[0x81ACB5,0x81AEF4,0x81AEFC].includes(entry);
    if(p.external_return_assumptions!==0||p.reachable_instructions!==(request?6:3)
      ||p.minimum_protected_stack_bytes!==(request?6:3)||p.returns.some(r=>r.m||r.x||r.dbr!=='entry'))
      throw Error('WORD interrupt wait source/stack drift');
    return p;
  });
}
