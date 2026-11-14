import { cpuLabel } from './rom.mjs';

// Source-specific structural proof. Both conditional edges are explored;
// no accumulator, memory, device or instruction execution takes place.
export function proveInput9E1A(map) {
  const pending = [{ pc: 0x809E1A, e: 0, m: 0, x: 0, c: 'entry', dbr: 'entry', stack: [] }];
  const seen = new Set(), visited = new Set(), returns = new Set(), terminals = new Set();
  let maxLocalStackBytes = 0;
  while (pending.length) {
    const s = pending.pop(), key = JSON.stringify(s);
    if (seen.has(key)) continue;
    seen.add(key);
    if (seen.size > 1000) throw Error('Unbounded input source proof');
    const i = map.get(s.pc);
    if (!i || i.state.e !== s.e || i.state.m !== s.m || i.state.x !== s.x) throw Error(`Input mode/edge mismatch ${cpuLabel(s.pc)}`);
    visited.add(s.pc);
    const t = { ...s, pc: i.next, stack: [...s.stack] };
    const pop = kind => { const v = t.stack.pop(); if (v?.kind !== kind) throw Error('Input stack mismatch'); return v; };
    switch (i.mnemonic) {
      case 'PEA': t.stack.push({ kind: 'byte', value: i.value >>> 8 }, { kind: 'byte', value: i.value & 255 }); break;
      case 'PLB': t.dbr = pop('byte').value; break;
      case 'PHP': t.stack.push({ kind: 'status', e: s.e, m: s.m, x: s.x, c: s.c }); break;
      case 'PLP': { const p = pop('status'); Object.assign(t, { m: p.m, x: p.x, c: p.c }); break; }
      case 'SEP': if (i.value & 32) t.m = 1; if (i.value & 16) t.x = 1; break;
      case 'CMP': t.c = 'comparison'; break;
      case 'SEC': t.c = 1; break;
      case 'XCE':
        if (s.c !== 1 || s.e !== 0 || s.m !== 1 || s.x !== 1 || s.stack.length) throw Error('Renew reset transition proof');
        t.e = 1; t.c = 0; break;
      case 'JSL': t.stack.push({ kind: 'return', pc: i.next }); t.pc = i.target; break;
      case 'RTL': t.pc = pop('return').pc; break;
      case 'RTS':
        if (s.stack.length || s.e || s.m || s.x || s.dbr !== 'entry') throw Error('Invalid input WORD return');
        returns.add(JSON.stringify({ at: cpuLabel(s.pc), e: s.e, m: s.m, x: s.x, dbr: s.dbr })); continue;
      case 'JML':
        if (i.target !== 0x80E382 || s.e !== 1 || s.m !== 1 || s.x !== 1 || s.c !== 0 || s.dbr !== 0x80 || s.stack.length) throw Error('Invalid reset terminal');
        terminals.add(JSON.stringify({ at: cpuLabel(s.pc), to: cpuLabel(i.target), e: s.e, m: s.m, x: s.x, carry: s.c, dbr: '80', root_frame: 'abandoned; emulation forces stack page01' })); continue;
      default:
        if (i.mode === 'rel8') pending.push({ ...t, pc: i.target, stack: [...t.stack] });
    }
    const depth = t.stack.reduce((n, v) => n + (v.kind === 'return' ? 3 : 1), 0);
    maxLocalStackBytes = Math.max(maxLocalStackBytes, depth);
    pending.push(t);
  }
  if (visited.size !== map.size) throw Error('Unvisited input source');
  return { entry: '80:9E1A', abstract_states: seen.size, reachable_instructions: visited.size,
    returns: [...returns].map(JSON.parse), terminals: [...terminals].map(JSON.parse),
    max_local_stack_bytes: maxLocalStackBytes, protected_with_root_jsr_bytes: 2 + maxLocalStackBytes,
    external_return_assumptions: 0, actual_apu_termination_proven: false, startup_graph_proven: false,
    qualification: 'Structural WORDreturn or E1M1X1 nonreturn reset handoff, intact disjoint stack and explicit entry. No device progress, restart completion, CPU or frame execution.' };
}
