import { cpuLabel } from './rom.mjs';

// Static typed frames and width/DBR transitions. No values, memory or CPU
// execution. Reset leaves the saved wrapper status and child RTS behind.
export function proveInputWrapper(map, entry, initialState) {
  if (![0x80F290, 0x80F298].includes(entry) || initialState.e !== 0
    || ![0, 1].includes(initialState.m) || ![0, 1].includes(initialState.x)) throw Error('Invalid wrapper proof entry');
  const pending = [{ pc: entry, ...initialState, c: 'entry', dbr: 'entry', stack: [], peak: 0 }];
  const seen = new Set(), visited = new Set(), returns = new Set(), terminals = new Set();
  let maxLocal = 0, maxReturning = 0;
  const abandoned = stack => entry === 0x80F298 && stack.length === 2 && stack[0].kind === 'p'
    && stack[1].kind === 'return' && stack[1].op === 'RTS' && stack[1].pc === 0x80F29E;
  while (pending.length) {
    const s = pending.pop(), key = JSON.stringify(s);
    if (seen.has(key)) continue;
    seen.add(key); if (seen.size > 1000) throw Error('Unbounded wrapper source');
    const i = map.get(s.pc);
    if (!i || i.state.e !== s.e || i.state.m !== s.m || i.state.x !== s.x) throw Error(`Wrapper edge/mode mismatch ${cpuLabel(s.pc)}`);
    visited.add(s.pc);
    const t = { ...s, pc: i.next, stack: [...s.stack] };
    const pop = kind => { const v = t.stack.pop(); if (v?.kind !== kind) throw Error('Wrapper stack mismatch'); return v; };
    switch (i.mnemonic) {
      case 'PHP': t.stack.push({ kind: 'p', m: s.m, x: s.x, c: s.c }); break;
      case 'PLP': { const p = pop('p'); Object.assign(t, { m: p.m, x: p.x, c: p.c }); break; }
      case 'REP': case 'SEP':
        if (i.value & 32) t.m = Number(i.mnemonic === 'SEP');
        if (i.value & 16) t.x = Number(i.mnemonic === 'SEP'); break;
      case 'PEA': t.stack.push({ kind: 'byte', value: i.value >>> 8 }, { kind: 'byte', value: i.value & 255 }); break;
      case 'PLB': t.dbr = pop('byte').value; break;
      case 'CMP': t.c = 'comparison'; break;
      case 'SEC': t.c = 1; break;
      case 'XCE':
        if (s.e !== 0 || s.c !== 1 || s.m !== 1 || s.x !== 1 || !abandoned(s.stack)) throw Error('Renew wrapper reset proof');
        t.e = 1; t.c = 0; break;
      case 'JSR': case 'JSL': t.stack.push({ kind: 'return', pc: i.next, op: i.mnemonic === 'JSR' ? 'RTS' : 'RTL' }); t.pc = i.target; break;
      case 'RTS': case 'RTL':
        if (s.stack.length) { const r = pop('return'); if (r.op !== i.mnemonic) throw Error('Wrong wrapper child return'); t.pc = r.pc; }
        else {
          if (i.mnemonic !== 'RTL' || s.e !== 0 || s.m !== initialState.m || s.x !== initialState.x || s.c !== 'entry' || s.dbr !== 'entry') throw Error('Wrong wrapper root return');
          returns.add(JSON.stringify({ at: cpuLabel(s.pc), e: s.e, m: s.m, x: s.x, dbr: s.dbr, carry: s.c }));
          maxReturning = Math.max(maxReturning, s.peak); continue;
        }
        break;
      case 'JML':
        if (i.target !== 0x80E382 || s.e !== 1 || s.m !== 1 || s.x !== 1 || s.c !== 0 || s.dbr !== 0x80 || !abandoned(s.stack)) throw Error('Wrong wrapper reset terminal');
        terminals.add(JSON.stringify({ at: cpuLabel(s.pc), to: cpuLabel(i.target), e: 1, m: 1, x: 1, dbr: '80', carry: 0,
          abandoned_local_bytes: 3, qualification: 'Wrapper PHP and child JSR remain unpopped; E1 forces stack page01, no wrapper return' })); continue;
      default:
        if (i.mode === 'rel8') pending.push({ ...t, pc: i.target, stack: [...t.stack] });
    }
    const depth = t.stack.reduce((n, v) => n + (v.kind === 'return' ? v.op === 'RTS' ? 2 : 3 : 1), 0);
    t.peak = Math.max(s.peak, depth); maxLocal = Math.max(maxLocal, depth); pending.push(t);
  }
  if (visited.size !== map.size) throw Error('Unvisited wrapper source');
  return { entry: cpuLabel(entry), initial_state: initialState, reachable_instructions: visited.size,
    returns: [...returns].map(JSON.parse), terminals: [...terminals].map(JSON.parse),
    returning_protected_bytes: maxReturning + 3, all_paths_protected_bytes: maxLocal + 3,
    external_return_assumptions: 0, actual_wait_termination_proven: false,
    qualification: 'Conditional RTL restores entry widths/DBR/carry with typed PHP/PLP; no device progress, full startup, interrupts or CPU execution' };
}
