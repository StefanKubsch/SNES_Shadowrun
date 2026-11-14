import { cpuLabel } from './rom.mjs';
import { proveAudioStack } from './render-audio-stack-proof.mjs';

// Conditional source/control/byte-stack proof only. No register arithmetic,
// memory reads, device responses or instruction execution. Real callee bodies
// are traversed; no helper is replaced by an assumed returning summary.
export function proveMenuStack(map, entry, { sound = 'all-words' } = {}) {
  if (![0x80A6A5, 0x80A6AD, 0x80A6B8, 0x80A6C7].includes(entry)
    || !['all-words', 'original-002D'].includes(sound)) throw Error('Invalid menu proof entry');
  return proveNormalMenuStack(map, entry, sound, false);
}

// Native72 retains actual PEA choice bytes across the whole FA3E graph.
// The same walker visits every real menu/allocation/removal callee.
export function proveModalStack(map,{sound='all-words'}={}){
 if(!['all-words','original-002D'].includes(sound))throw Error('Invalid modal sound profile');
 for(const [pc,op,value]of [[0x80CD52,'JSR',0x80F963],[0x80CD57,'STA',0x0E],
  [0x80CD60,'LDA',2],[0x80CD63,'STA',6],[0x80CD65,'LDA',0xCD91],[0x80CD6F,'JSR',0x80A6C7],
  [0x80CD74,'CMP',65535],[0x80CD79,'CMP',1],[0x80CD7E,'PEA',65535],[0x80CD83,'PEA',0],
  [0x80CD86,'LDA',0x0E],[0x80CD8A,'JSR',0x80FA3E],[0x80CD8D,'PLA'],[0x80CD8E,'STA',0],[0x80CD90,'RTS']]){
  const i=map.get(pc);if(i?.mnemonic!==op||value!==undefined&&(i.target??i.value)!==value)throw Error('Renew modal source lemma '+cpuLabel(pc));
 }
 const p=proveNormalMenuStack(map,0x80CD43,sound,'modal');
 return {...p,conditional_lemmas:[...p.conditional_lemmas,
  'Original CD43 root sets menu count2, fresh result FFFF/1 chooses actual PEA0000 otherwise PEAFFFF; full real FA3E precedes fresh PLA/DP00 and matching RTS. Intact disjoint data/return bytes only; aliases checked separately at runtime.']};
}

// Two original dialog callers, checked separately from the four menu roots.
// The common walk still follows every real callee; no returning summaries.
export function proveSelectionStack(map, entry, { sound = 'all-words' } = {}) {
  if (![0x8091E2, 0x809215].includes(entry)
    || !['all-words', 'original-002D'].includes(sound)) throw Error('Invalid selection proof entry');
  const expect = (pc, op, value, mode) => {
    const i = map.get(pc);
    if (i?.mnemonic !== op || value !== undefined && (i.target ?? i.value) !== value
      || mode !== undefined && i.mode !== mode) throw Error('Renew selection source lemma ' + cpuLabel(pc));
  };
  if (entry === 0x8091E2) {
    expect(0x8091FF, 'JSR', 0x80A6C7);
  } else {
    for (const [pc,op,value,mode] of [[0x809278,'JSR',0x80F963],
      [0x809298,'JSR',0x80A6C7],[0x80929B,'PEI',0,'di'],
      [0x80929D,'LDA',0x1A],[0x80929F,'STA',0],
      [0x8092A1,'JSR',0x80FA3E],[0x8092A4,'PLY']]) expect(pc,op,value,mode);
  }
  return proveNormalMenuStack(map, entry, sound, true);
}

export function proveActionsStack(map, entry, { sound = 'all-words' } = {}) {
  if (![0x8099EB,0x809BA0].includes(entry) || !['all-words','original-002D'].includes(sound))
    throw Error('Invalid actions proof entry');
  for (const [pc,op,target] of [[0x809B5B,'JSR',0x80F963],[0x809B7D,'JSR',0x80A6A5],
    [0x809B8F,'PHA'],[0x809B94,'JSR',0x80FA3E],[0x809B97,'PLA'],
    [0x809BA0,'STZ',0x1FA6],[0x809BA5,'JSR',0x8099EB]]) {
    const i=map.get(pc);
    if (i?.mnemonic!==op || target!==undefined && (i.target??i.value)!==target)
      throw Error('Renew actions source lemma '+cpuLabel(pc));
  }
  return proveNormalMenuStack(map,entry,sound,'actions');
}

function proveNormalMenuStack(map, entry, sound, selection) {
  const expect = (pc, op, value, mode) => {
    const i = map.get(pc);
    if (i?.mnemonic !== op || value !== undefined && (i.target ?? i.value) !== value
      || mode !== undefined && i.mode !== mode) throw Error('Renew menu source lemma ' + cpuLabel(pc));
  };
  // Original straight caller stores precede C46E. Its actual forced DBR80
  // and transitive writer check preserve DP06=0003 before the fresh reload.
  for (const [pc, op, value] of [[0x80A805,'LDA',0xFFFF],[0x80A808,'STA',0],
    [0x80A80A,'LDA',0x40],[0x80A80D,'STA',4],[0x80A80F,'LDA',3],[0x80A812,'STA',6],
    [0x80A814,'LDA',0x4C],[0x80A817,'STA',2],[0x80A819,'JSR',0x80C46E],
    [0x809E26,'LDA',0x1CA],[0x809E29,'STA',0x1CC],[0x809E2C,'CMP',0x3030],
    [0x809E2F,'BEQ',0x809E3D],[0x809E31,'AND',15],[0x809E3C,'RTS'],
    [0x80A77B,'PHY'],[0x80A791,'PLY'],[0x80A7CD,'PHY'],[0x80A7D4,'PLA'],
    [0x80A798,'PEI',0],[0x80A79A,'PEI',6],[0x80A7B0,'PLA'],[0x80A7B1,'STA',6],
    [0x80A7B3,'PLA'],[0x80A7B4,'STA',0]]) expect(pc,op,value);
  expect(0x80A798,'PEI',0,'di'); expect(0x80A79A,'PEI',6,'di');
  const audio = proveAudioStack(map, 0x80C46E, 'RTS', { anySoundNonzeroVoice: true });
  if (audio.returns.some(r => r.m || r.x || r.dbr !== 0x80)) throw Error('Renew menu audio return');
  const pending = [{ pc: entry, m: 0, x: 0, dbr: 'entry', stack: [] }];
  const seen = new Set(), visited = new Set(), returns = new Set(), boundaries = new Set(), modes = new Map();
  let maximumLocalStackBytes = 0, peak = null;
  const depth = stack => stack.reduce((n, item) => n + (item.kind === 'return' ? item.op === 'RTS' ? 2 : 3 : 1), 0);
  const measure = (pc, stack) => {
    const bytes = depth(stack);
    if (bytes > maximumLocalStackBytes) {
      maximumLocalStackBytes = bytes;
      peak = { at: cpuLabel(pc), local_stack_bytes: bytes,
        return_frames: stack.filter(i => i.kind === 'return').map(i => ({ kind: i.op, to: cpuLabel(i.pc) })),
        data_bytes: stack.filter(i => i.kind === 'byte').length,
        status_bytes: stack.filter(i => i.kind === 'status').length };
    }
  };
  while (pending.length) {
    const s = pending.pop(), key = JSON.stringify(s); if (seen.has(key)) continue;
    seen.add(key); if (seen.size > 40000) throw Error('Unbounded menu source proof');
    const i = map.get(s.pc); if (!i) throw Error('Uncovered menu edge ' + cpuLabel(s.pc));
    // Original text join resets M, and F007 really accepts either incoming M
    // through PHP/SEP20/PLP. Other incoming widths must match pinned source.
    const mixedA = [0x81F007,0x81F008,0x81F023].includes(s.pc);
    const byteJoin = s.pc === 0x80FC36 && i.mnemonic === 'SEP' && i.value === 32;
    const statusJoin = s.pc === 0x81F1B7 && i.mnemonic === 'PLP' && s.stack.at(-1)?.kind === 'status';
    if (i.state.x !== s.x || i.state.m !== s.m && !mixedA && !byteJoin && !statusJoin)
      throw Error('Menu source width mismatch ' + cpuLabel(s.pc));
    if (i.mode === 'immM' && i.length !== (s.m ? 2 : 3)
      || i.mode === 'immX' && i.length !== (s.x ? 2 : 3)) throw Error('Menu immediate width mismatch ' + cpuLabel(s.pc));
    visited.add(s.pc); modes.set(`${s.pc}/${s.m}/${s.x}`, { at: cpuLabel(s.pc), m: s.m, x: s.x });
    measure(s.pc,s.stack);
    const t = { ...s, pc: i.next, stack: [...s.stack] };
    const pop = kind => {
      const item = t.stack.pop(); if (item?.kind !== kind) throw Error('Menu stack mismatch ' + cpuLabel(s.pc)); return item;
    };
    const pushBytes = count => { for (let n = 0; n < count; n++) t.stack.push({ kind: 'byte', value: 'unknown' }); };
    switch (i.mnemonic) {
      case 'PHP': t.stack.push({ kind: 'status', m: s.m, x: s.x }); break;
      case 'PLP': { const p = pop('status'); t.m = p.m; t.x = p.x; break; }
      case 'PHK': t.stack.push({ kind: 'byte', value: i.cpu >>> 16 }); break;
      case 'PHB': t.stack.push({ kind: 'byte', value: s.dbr }); break;
      case 'PEA': t.stack.push({ kind: 'byte', value: i.value >>> 8 }, { kind: 'byte', value: i.value & 255 }); break;
      case 'PLB': t.dbr = pop('byte').value; break;
      case 'PEI':
        if (![0x80A798,0x80A79A,...(selection && entry === 0x809215 ? [0x80929B] : [])].includes(s.pc)
          || s.m || s.x) throw Error('Unproved menu PEI');
        pushBytes(2); break; // Fixed WORD pointer bytes, independent of M; DP00/06 source ownership is separate.
      case 'PHA': pushBytes(s.m ? 1 : 2); break;
      case 'PLA': for (let n = 0; n < (s.m ? 1 : 2); n++) pop('byte'); break;
      case 'PHX': case 'PHY': pushBytes(s.x ? 1 : 2); break;
      case 'PLX': case 'PLY': for (let n = 0; n < (s.x ? 1 : 2); n++) pop('byte'); break;
      case 'REP': case 'SEP':
        if (i.value & 32) t.m = Number(i.mnemonic === 'SEP');
        if (i.value & 16) t.x = Number(i.mnemonic === 'SEP'); break;
      case 'JSR': case 'JSL':
        if (i.target === undefined) throw Error('Unproved indirect menu call');
        t.stack.push({ kind: 'return', op: i.mnemonic === 'JSR' ? 'RTS' : 'RTL', pc: i.next }); t.pc = i.target; break;
      case 'RTS': case 'RTL':
        if (!t.stack.length) {
          if (i.mnemonic !== 'RTS' || s.m || s.x
            || s.pc === 0x80A825 && s.dbr !== 0x80 || s.pc === 0x80A834 && s.dbr !== 'entry')
            throw Error('Wrong menu root return');
          returns.add(JSON.stringify({ at: cpuLabel(s.pc), m: s.m, x: s.x, dbr: s.dbr })); continue;
        } else {
          const frame = pop('return'); if (frame.op !== i.mnemonic) throw Error('Wrong menu call return'); t.pc = frame.pc;
        }
        break;
      case 'BRA': case 'BRL': case 'JMP':
        if (i.target === undefined) throw Error('Unproved indirect menu edge'); t.pc = i.target; break;
      case 'MVN': case 'MVP':
        if (!selection) throw Error('Unproved menu control operation ' + cpuLabel(s.pc));
        t.dbr = i.raw[1]; break; // Existing unpack source: destination bank is the real DBR effect.
      case 'PHD': case 'PLD': case 'TCD': case 'XCE': case 'TCS': case 'TXS': case 'SED':
      case 'RTI': case 'BRK': case 'COP': case 'JML':
      case 'WAI': case 'STP':
        throw Error('Unproved menu control operation ' + cpuLabel(s.pc));
      default:
        if (i.mode === 'rel8') {
          if (s.pc === 0x809E2F) {
            boundaries.add(JSON.stringify({ at: cpuLabel(s.pc), to: cpuLabel(i.target),
              caller_return: cpuLabel(s.stack.at(-1).pc), reason: 'Fresh WORD01CA at9E26 equals3030',
              local_stack_bytes: depth(s.stack), qualification: 'Excluded normal-return path; full existing reset proof separate, not a returning callee.' }));
          } else if (s.pc === 0x80C495) {
            boundaries.add(JSON.stringify({ at: cpuLabel(s.pc), to: cpuLabel(i.target),
              reason: 'Fresh DP06 zero leaves saved sound on stack; excluded by original caller0003 and fixed writer lemma',
              local_stack_bytes: depth(s.stack) }));
          } else if (sound === 'original-002D' && s.pc === 0x80C47E) t.pc = i.target;
          else pending.push({ ...t, pc: i.target, stack: [...t.stack] });
        }
    }
    measure(s.pc,t.stack); pending.push(t);
  }
  // Compact contiguous source/mode intervals preserve every visited byte
  // without repeating a thousand address objects for each entry profile.
  const modeWindows = [];
  for (const m of [0,1]) for (const x of [0,1]) {
    let current = null;
    for (const v of [...modes.values()].filter(v => v.m === m && v.x === x).sort((a,b) => a.at.localeCompare(b.at))) {
      const pc = parseInt(v.at.replace(':',''),16), end = cpuLabel(map.get(pc).next);
      if (current?.end_exclusive === v.at) current.end_exclusive = end;
      else { current = { entry: v.at, end_exclusive: end, m, x }; modeWindows.push(current); }
    }
  }
  return { entry: cpuLabel(entry), sound_profile: sound, abstract_states: seen.size,
    reachable_instructions: visited.size, returns: [...returns].map(JSON.parse),
    maximum_local_stack_bytes: maximumLocalStackBytes, minimum_protected_stack_bytes: maximumLocalStackBytes + 2,
    maximum_stack_witness: peak,
    mode_windows: modeWindows.sort((a,b) => a.entry.localeCompare(b.entry) || a.m-b.m || a.x-b.x),
    excluded_boundaries: [...boundaries].map(JSON.parse), external_return_assumptions: 0,
    conditional_graph_closed: true, actual_termination_proven: false,
    conditional_lemmas: ['Every reached9E1A fresh WORD01CA at9E26 is not3030',
      'Original A805..A819 sets DP06=0003/DP02=004C before C46E; forcedDBR80 fixed transitive writers preserve DP06',
      ...(sound === 'original-002D' ? ['Original immutable WORD80C4FF=002D; no synthetic table override or refetch'] : []),
      ...(selection === true ? ['Original selection caller reaches A6C7 in WORD mode; 9215 PEI00/FA3E/PLY preserves selection as two stack bytes, independent of fresh scratch aliases'] : []),
      ...(selection === 'actions' ? ['Original99EB reaches F963/A6A5/FA3E in WORD mode; selected flag PHA/PLA spans the whole real release graph without a returning summary'] : []),
      'Intact disjoint stack, original code, E0M0X0/D0 and no interrupt/external interference with preserved parameters'],
    qualification: 'Conditional static source/mode/byte-stack graph with actual callee frames; no memory/register/CPU/device/time/interrupt or scene execution. Reset and generic zero voice are separate boundaries.' };
}
