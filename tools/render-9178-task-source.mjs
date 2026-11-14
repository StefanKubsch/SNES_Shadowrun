// ROM-only C34A and C1CA source results for the 9178 analyzer. The windows and
// decode policies match analyze-render-c34a.mjs and analyze-render-c1ca.mjs;
// no generated report is read. C34A closes as a fixed-callee graph; C1CA stays
// an open typed frontier with no assumed dynamic return.
import {createHash} from 'node:crypto';
import {decode} from './disassemble.mjs';
import {proveAppendC34AStack} from './render-c34a-stack-proof.mjs';
import {proveVisitC1CAFrontier} from './render-c1ca-stack-proof.mjs';

const romHash = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const appendWindows = [[0x80C34A, 0x80C366], [0x80C2C8, 0x80C34A], [0x80C242, 0x80C2BD]];
const visitWindows = [[0x80C1CA, 0x80C1E3], [0x80C1F9, 0x80C242], [0x80C3C9, 0x80C401],
  [0x80C396, 0x80C3C9], [0x80C2BD, 0x80C2C8], [0x80F378, 0x80F393], [0x80F4BE, 0x80F4CB],
  [0x80F4CB, 0x80F532], [0x80C401, 0x80C416]];

// C34A follows REP/SEP inside its windows; C1CA decodes every window as WORD.
function decodeWindows(bytes, windows, trackWidths) {
  const map = new Map();
  for (const [entry, end] of windows) {
    let state = {e: 0, m: 0, x: 0};
    for (let pc = entry; pc < end;) {
      const i = decode(bytes, pc, state);
      if (i.next > end) throw Error('Task source window overflow');
      map.set(i.cpu, i); pc = i.next;
      if (trackWidths && ['REP', 'SEP'].includes(i.mnemonic)) {
        if (i.value & 32) state = {...state, m: Number(i.mnemonic === 'SEP')};
        if (i.value & 16) state = {...state, x: Number(i.mnemonic === 'SEP')};
      }
    }
  }
  return map;
}

export function proveRender9178TaskSources(bytes) {
  if (createHash('sha256').update(bytes).digest('hex') !== romHash) throw Error('Wrong European ROM revision');
  const appendMap = decodeWindows(bytes, appendWindows, true);
  const proof = proveAppendC34AStack(appendMap);
  if (proof.external_return_assumptions !== 0 || proof.minimum_protected_stack_bytes !== 8) throw Error('C34A source drift');
  const visitMap = decodeWindows(bytes, visitWindows, false);
  const frontier = proveVisitC1CAFrontier(visitMap);
  if (frontier.external_return_assumptions !== 0) throw Error('C1CA frontier drift');
  return {
    append: {closed: true, native_binding: false, map: appendMap, proof},
    visit: {closed: false, native_binding: false, minimum_protected_stack_bytes: null, map: visitMap, frontier},
  };
}
