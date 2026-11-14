import { cpuLabel } from './rom.mjs';

// Static control-flow and typed stack only: no register values, memory or CPU execution.
// Branch alternatives are both explored; internal calls carry real return frames.
// dataPulls: pinned 16-bit PLX/PLY sites that take a WORD pushed by a 16-bit PHA (source lemma).
// indexPulls: pinned 16-bit PLA sites that take a WORD pushed by a 16-bit PHX/PHY (source lemma).
// externalReturns: call targets proved elsewhere (target -> 'RTS'|'RTL'); the call continues at its
// own next instruction with unchanged stack, widths and DBR, counted as an external return assumption.
// indirectTargets: pinned JMP (abs)/(abs,X) sites -> every target the source tables can reach (source lemma).
// pullKinds: pinned PLA sites -> stack kinds the pulled bytes may have (joins of different pushes, source lemma).
// interruptReturns: pinned BRK/COP sites whose native vector is a plain RTI (source lemma): the four pushed bytes
// (PB, PC, P) come back, execution continues behind the signature byte with unchanged widths and DBR.
export function proveWordStack(map, entry, rootReturn = 'RTL', { wordPushes = new Map(), peiWordPushes = new Map(), measureStack = false, widthJoins = new Set(), statusRestoreJoins = new Set(), dataPulls = new Set(), externalReturns = new Map(), indexPulls = new Set(), indirectTargets = new Map(), pullKinds = new Map(), interruptReturns = new Set(), programBankPushes = new Set(), indirectCalls = new Map(), externalTailReturns = new Map(), externalTailBanks = new Map(), initialM = 0, initialX = 0, controlWidthJoins = new Set(), externalReturnBanks = new Map() } = {}) {
  if(![initialM,initialX].every(v=>v===0||v===1))throw Error('Invalid initial proof widths');
  // These pinned control/byte-stack instructions have identical operands and stack
  // effects in both widths. Each path still carries its own M/X; a callee's
  // external return contract preserves those widths. No data access or
  // immediate-operand instruction may use this opt-in lemma.
  for(const pc of controlWidthJoins)if(!['JSR','JSL','RTS','RTL','JMP','BRA','BRL','PHK','PLB'].includes(map.get(pc)?.mnemonic))
    throw Error('Invalid control width join lemma');
  for(const [target,banks]of externalReturnBanks)if(!externalReturns.has(target)
    ||!(Array.isArray(banks)?banks:[banks]).length
    ||(Array.isArray(banks)?banks:[banks]).some(bank=>bank!=='entry'&&(!Number.isInteger(bank)||bank<0||bank>255)))
      throw Error('Invalid external return bank lemma');
  // Opt-in source lemmas: PHK pushes the bank of this pinned instruction; JSR (abs,X)
  // uses only separately pinned table targets; a long tail jump owns no additional frame.
  for (const pc of programBankPushes) if (map.get(pc)?.mnemonic !== 'PHK') throw Error('Invalid program bank push lemma');
  for (const [pc, targets] of indirectCalls) if (map.get(pc)?.mnemonic !== 'JSR' || map.get(pc)?.mode !== 'indx'
    || !Array.isArray(targets) || !targets.length || targets.some(t=>!Number.isInteger(t)||(t>>>16)!==(pc>>>16))) throw Error('Invalid indirect call lemma');
  for (const [pc, target] of externalTailReturns) if (map.get(pc)?.mnemonic !== 'JML' || map.get(pc)?.target !== target
    || map.has(target) || rootReturn!=='RTL') throw Error('Invalid external tail lemma');
  // A separately proved external tail may replace DBR instead of preserving it (DFE7 -> EF63).
  for (const [pc, bank] of externalTailBanks) if (!externalTailReturns.has(pc)||!Number.isInteger(bank)||bank<0||bank>255)
    throw Error('Invalid external tail bank lemma');
  for (const pc of interruptReturns) if (!['BRK', 'COP'].includes(map.get(pc)?.mnemonic)) throw Error('Invalid interrupt return lemma');
  for (const [pc, targets] of indirectTargets) {
    const i = map.get(pc);
    if (i?.mnemonic !== 'JMP' || !['ind', 'indx'].includes(i.mode) || !Array.isArray(targets) || !targets.length) throw Error('Invalid indirect jump lemma');
  }
  for (const [pc, kinds] of pullKinds) if (map.get(pc)?.mnemonic !== 'PLA' || !Array.isArray(kinds) || !kinds.length) throw Error('Invalid pull kind lemma');
  for (const pc of indexPulls) {
    const i = map.get(pc);
    if (i?.mnemonic !== 'PLA' || i.state.m !== 0 || i.state.x !== 0) throw Error('Invalid pinned WORD index pull lemma');
  }
  for (const [pc, op] of externalReturns) if (!['RTS', 'RTL'].includes(op) || map.has(pc)) throw Error('Invalid external return lemma');
  for (const pc of dataPulls) {
    const i = map.get(pc);
    if (!['PLX', 'PLY'].includes(i?.mnemonic) || i.state.m !== 0 || i.state.x !== 0) throw Error('Invalid pinned WORD data pull lemma');
  }
  for (const [pc, offset] of peiWordPushes) {
    const i = map.get(pc);
    if (i?.mnemonic !== 'PEI' || i.value !== offset || i.state.m !== 0 || i.state.x !== 0)
      throw Error('Invalid pinned PEI WORD lemma');
  }
  for (const pc of widthJoins) {
    const i = map.get(pc);
    if (!i || !['REP', 'SEP'].includes(i.mnemonic) || i.raw.length !== 2) throw Error('Invalid width join lemma');
  }
  // PLB and PLP have width-independent encodings and stack effects. A pinned
  // epilogue may join different incoming widths only along an uninterrupted
  // PLB chain ending in PLP; the saved PHP still determines both restored widths.
  for (const pc of statusRestoreJoins) {
    let i=map.get(pc), steps=0;
    while(i?.mnemonic==='PLB' && steps++<256)i=map.get(i.next);
    if(i?.mnemonic!=='PLP')throw Error('Invalid status restore join lemma');
  }
  // Optional byte shapes require a separately checked source lemma at that PHA.
  // They describe stack bytes, not executing accumulator or memory values.
  for (const [pc, values] of wordPushes) {
    if (map.get(pc)?.mnemonic !== 'PHA' || map.get(pc)?.state.m !== 0 || !Array.isArray(values) || values.length !== 2
      || values.some(v => !(Number.isInteger(v) && v >= 0 && v <= 255) && typeof v !== 'string')) throw Error('Invalid WORD push lemma');
  }
  const pending = [{ pc: entry, m: initialM, x: initialX, dbr: 'entry', stack: [] }], seen = new Set(), visited = new Set(), returns = new Set(), external = new Set();
  let maximumLocalStackBytes = 0;
  while (pending.length) {
    const s = pending.pop(), key = JSON.stringify(s);
    if (seen.has(key)) continue;
    seen.add(key); if (seen.size > 10000) throw Error('Unbounded static proof');
    const i = map.get(s.pc); if (!i) throw Error(`Uncovered edge ${cpuLabel(s.pc)}`);
    // Only an explicitly source-checked join may accept different incoming
    // widths, and its REP/SEP must set each differing width. Default proofs
    // and all subsequent instructions retain strict decode-mode checks.
    const widthSetter = widthJoins.has(s.pc);
    const restoreJoin=statusRestoreJoins.has(s.pc);
    const controlJoin=controlWidthJoins.has(s.pc);
    if (i.state.m !== s.m && !(widthSetter && i.value & 32) && !restoreJoin && !controlJoin
      || i.state.x !== s.x && !(widthSetter && i.value & 16) && !restoreJoin && !controlJoin) throw Error(`Mode mismatch ${cpuLabel(s.pc)}`);
    visited.add(s.pc);
    if (measureStack) maximumLocalStackBytes = Math.max(maximumLocalStackBytes,
      s.stack.reduce((n, v) => n + (v.kind === 'return' ? (v.op === 'RTS' ? 2 : 3) : 1), 0));
    const t = { ...s, pc: i.next, stack: [...s.stack] };
    const pop = kind => { const v = t.stack.pop(); if (v?.kind !== kind && !(pullKinds.get(s.pc)?.includes(v?.kind))) throw Error(`Stack mismatch ${cpuLabel(s.pc)}`); return v; };
    switch (i.mnemonic) {
      case 'PHP': t.stack.push({ kind: 'p', m: s.m, x: s.x }); break;
      case 'PLP': { const p = pop('p'); t.m = p.m; t.x = p.x; break; }
      case 'PHB': t.stack.push({ kind: 'byte', value: s.dbr }); break;
      case 'PEA': t.stack.push({ kind: 'byte', value: i.value >> 8 }, { kind: 'byte', value: i.value & 255 }); break;
      case 'PLB': t.dbr = pop('byte').value; break;
      case 'PHA':
        if (wordPushes.has(s.pc)) {
          if (s.m) throw Error('WORD push lemma reached in BYTE mode');
          for (const value of wordPushes.get(s.pc)) t.stack.push({ kind: 'byte', value });
        } else for (let n = 0; n < (s.m ? 1 : 2); n++) t.stack.push({ kind: 'data' });
        break;
      case 'PLA': for (let n = 0; n < (s.m ? 1 : 2); n++) pop(indexPulls.has(s.pc) ? 'index' : 'data'); break;
      case 'PHX': case 'PHY': for (let n = 0; n < (s.x ? 1 : 2); n++) t.stack.push({ kind: 'index' }); break;
      case 'PLX': case 'PLY': for (let n = 0; n < (s.x ? 1 : 2); n++) pop(dataPulls.has(s.pc) ? 'data' : 'index'); break;
      case 'PEI':
        if (!peiWordPushes.has(s.pc)) throw Error(`Unproved stack operation ${cpuLabel(s.pc)}`);
        t.stack.push({ kind: 'data' }, { kind: 'data' }); break;
      case 'PHK':
        if (!programBankPushes.has(s.pc)) throw Error(`Unproved stack operation ${cpuLabel(s.pc)}`);
        t.stack.push({kind:'byte',value:i.cpu >>> 16}); break;
      case 'BRK': case 'COP':
        if (!interruptReturns.has(s.pc)) throw Error(`Unproved interrupt ${cpuLabel(s.pc)}`);
        if (measureStack) maximumLocalStackBytes = Math.max(maximumLocalStackBytes,
          s.stack.reduce((n, v) => n + (v.kind === 'return' ? (v.op === 'RTS' ? 2 : 3) : 1), 0) + 4);
        break;
      case 'SEP': case 'REP': {
        const v = i.mnemonic === 'SEP' ? 1 : 0;
        if (i.value & 32) t.m = v; if (i.value & 16) t.x = v; break;
      }
      case 'MVN': case 'MVP': t.dbr = i.raw[1]; break;
      case 'JSR': case 'JSL':
        if (i.target === undefined) {
          if (!indirectCalls.has(s.pc)) throw Error(`Unproved indirect call ${cpuLabel(s.pc)}`);
          for (const target of indirectCalls.get(s.pc)) pending.push({...t,pc:target,
            stack:[...t.stack,{kind:'return',pc:i.next,op:'RTS'}]});
          continue;
        }
        if (externalReturns.has(i.target)) {
          if (externalReturns.get(i.target) !== (i.mnemonic === 'JSR' ? 'RTS' : 'RTL')) throw Error(`External return kind ${cpuLabel(s.pc)}`);
          external.add(i.target);
          if(externalReturnBanks.has(i.target)){
            const banks=externalReturnBanks.get(i.target);
            for(const bank of Array.isArray(banks)?banks:[banks])pending.push({...t,dbr:bank==='entry'?s.dbr:bank});
            continue;
          }
          break;
        }
        t.stack.push({ kind: 'return', pc: i.next, op: i.mnemonic === 'JSR' ? 'RTS' : 'RTL' }); t.pc = i.target; break;
      case 'RTS': case 'RTL':
        if (!t.stack.length) {
          if (i.mnemonic !== rootReturn) throw Error('Wrong root return');
          returns.add(JSON.stringify({ at: cpuLabel(s.pc), m: s.m, x: s.x, dbr: s.dbr })); continue;
        } else { const r = pop('return'); if (r.op !== i.mnemonic) throw Error('Wrong call return'); t.pc = r.pc; }
        break;
      case 'JML':
        if (!externalTailReturns.has(s.pc) || t.stack.length) throw Error(`Unproved external tail ${cpuLabel(s.pc)}`);
        external.add(i.target); returns.add(JSON.stringify({at:cpuLabel(s.pc),m:s.m,x:s.x,dbr:externalTailBanks.get(s.pc)??s.dbr})); continue;
      case 'BRA': case 'BRL': case 'JMP':
        if (i.target === undefined) {
          if (!indirectTargets.has(s.pc)) throw Error(`Unproved indirect jump ${cpuLabel(s.pc)}`);
          for (const target of indirectTargets.get(s.pc)) pending.push({ ...t, pc: target, stack: [...t.stack] });
          continue;
        }
        t.pc = i.target; break;
      default:
        if (i.mode === 'rel8') pending.push({ ...t, pc: i.target, stack: [...t.stack] });
    }
    pending.push(t);
  }
  return { entry: cpuLabel(entry), abstract_states: seen.size, reachable_instructions: visited.size,
    returns: [...returns].map(v => JSON.parse(v)), external_return_assumptions: external.size,
    ...(externalReturns.size ? { external_returns: [...external].sort((a, b) => a - b).map(cpuLabel) } : {}),
    ...(measureStack ? { maximum_local_stack_bytes: maximumLocalStackBytes,
      minimum_protected_stack_bytes: maximumLocalStackBytes + (rootReturn === 'RTS' ? 2 : 3) } : {}),
    qualification: `Structural paths under intact stack and code, explicit binary E0M${initialM}X${initialX}/D0 entry and valid memory ownership; no input termination, stack-alias, interrupt or hardware interference proof` };
}
