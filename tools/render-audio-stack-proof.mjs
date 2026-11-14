import { cpuLabel } from './rom.mjs';

// Source-only mode/control/typed-stack analysis. No register calculation,
// memory access, device progress or CPU execution. Data/index bytes may be
// reinterpreted by PLA/PLX, as in the original mixed-width audio helpers.
export function proveAudioStack(map, entry, rootReturn = 'RTL', { entryM = 0, menuSound = null,
  lowSoundNonzeroVoice = false, anySoundNonzeroVoice = false, cacheHitNonzeroVoice = false } = {}) {
  if (![0, 1].includes(entryM)) throw Error('Invalid audio entry mode');
  const bounded = menuSound !== null || lowSoundNonzeroVoice || anySoundNonzeroVoice || cacheHitNonzeroVoice;
  if ([menuSound !== null, lowSoundNonzeroVoice, anySoundNonzeroVoice, cacheHitNonzeroVoice].filter(Boolean).length > 1)
    throw Error('Invalid audio proof selection');
  if (bounded && (entry !== 0x80C46E || entryM !== 0 || rootReturn !== 'RTS'))
    throw Error('Renew bounded C46E entry lemma');
  if (bounded) {
    for (const [pc, op, value] of [[0x80C46E, 'PHK'], [0x80C46F, 'PLB'],
      [0x80C470, 'LDY', 2], [0x80C472, 'LDA', 0xC4B3], [0x80C475, 'PHA'],
      [0x80C476, 'CMP', 0x1CE0], [0x80C479, 'BEQ', 0x80C487], [0x80C47B, 'CMP', 0x8000],
      [0x80C47E, 'BCC', 0x80C487], [0x80C489, 'JSR', 0x80C416], [0x80C48F, 'JSL', 0x81F007],
      [0x80C493, 'LDX', 6], [0x80C495, 'BEQ', 0x80C4B2], [0x80C4A6, 'PLA'], [0x80C4B2, 'RTS']]) {
      const i = map.get(pc);
      if (i?.mnemonic !== op || value !== undefined && (i.target ?? i.value) !== value)
        throw Error('Renew bounded C46E source lemma');
    }
    if (anySoundNonzeroVoice) for (const [pc,op,value] of [[0x80C480,'STA',0x1CE0],[0x80C483,'JSL',0x81F130]]) {
      const i=map.get(pc); if(i?.mnemonic!==op || (i.target??i.value)!==value)
        throw Error('Renew full C46E loader lemma');
    }
  }
  if (menuSound !== null) {
    if (entry !== 0x80C46E || entryM !== 0 || menuSound !== 0x002D) throw Error('Renew selected menu sound lemma');
    for (const [pc, op, value] of [[0x80A805, 'LDA', 0xFFFF], [0x80A808, 'STA', 0],
      [0x80A80A, 'LDA', 0x40], [0x80A80D, 'STA', 4], [0x80A80F, 'LDA', 3], [0x80A812, 'STA', 6],
      [0x80A814, 'LDA', 0x4C], [0x80A817, 'STA', 2], [0x80A819, 'JSR', 0x80C46E],
      [0x80C470, 'LDY', 2], [0x80C472, 'LDA', 0xC4B3], [0x80C47B, 'CMP', 0x8000],
      [0x80C47E, 'BCC', 0x80C487], [0x80C493, 'LDX', 6], [0x80C495, 'BEQ', 0x80C4B2]]) {
      const i = map.get(pc);
      if (i?.mnemonic !== op || (i.target ?? i.value) !== value) throw Error('Renew selected menu caller lemma');
    }
  }
  if (bounded) {
    // All actually reachable helpers before the fresh voice reload have
    // fixed DP/abs stores disjoint from DP06 under forced DBR80/disjoint stack.
    const ranges=[[0x80C416,0x80C461],[0x81F007,0x81F024],...(anySoundNonzeroVoice
      ? [[0x81F130,0x81F1FA],[0x81F100,0x81F10A],[0x81F122,0x81F130],[0x81F03A,0x81F067]] : [])];
    for (const i of map.values()) if (ranges.some(([lo,hi])=>i.cpu>=lo&&i.cpu<hi)
      && ['STA', 'STX', 'STY', 'STZ', 'INC', 'DEC'].includes(i.mnemonic)
      && i.mode !== 'A') {
      if (!['dp', 'abs'].includes(i.mode) || i.value <= 7 && i.value + 1 >= 6)
        throw Error('Renew selected DP06 preservation lemma');
    }
  }
  const pending = [{ pc: entry, m: entryM, x: 0, dbr: 'entry', stack: [] }];
  const seen = new Set(), visited = new Set(), returns = new Set(), modes = new Map();
  let maximumLocalStackBytes = 0;
  const depth = stack => stack.reduce((n, item) => n + (item.kind === 'return' ? item.op === 'RTS' ? 2 : 3 : 1), 0);
  while (pending.length) {
    const s = pending.pop(), key = JSON.stringify(s); if (seen.has(key)) continue;
    seen.add(key); if (seen.size > 20000) throw Error('Unbounded audio source proof');
    const i = map.get(s.pc); if (!i) throw Error('Uncovered audio edge ' + cpuLabel(s.pc));
    // Decode width may differ only where the original encoding is width-neutral.
    // All immediate operands must retain their independently pinned byte width.
    if (i.mode === 'immM' && i.length !== (s.m ? 2 : 3)
      || i.mode === 'immX' && i.length !== (s.x ? 2 : 3)) throw Error('Audio immediate width mismatch ' + cpuLabel(s.pc));
    visited.add(s.pc); modes.set(`${s.pc}/${s.m}/${s.x}`, { at: cpuLabel(s.pc), m: s.m, x: s.x });
    maximumLocalStackBytes = Math.max(maximumLocalStackBytes, depth(s.stack));
    const t = { ...s, pc: i.next, stack: [...s.stack] };
    const pop = kind => {
      const item = t.stack.pop();
      if (item?.kind !== kind) throw Error('Audio stack mismatch ' + cpuLabel(s.pc)); return item;
    };
    const pushBytes = count => { for (let n = 0; n < count; n++) t.stack.push({ kind: 'byte', value: 'unknown' }); };
    switch (i.mnemonic) {
      case 'PHP': t.stack.push({ kind: 'status', m: s.m, x: s.x }); break;
      case 'PLP': { const p = pop('status'); t.m = p.m; t.x = p.x; break; }
      case 'PHK': t.stack.push({ kind: 'byte', value: i.cpu >>> 16 }); break;
      case 'PHB': t.stack.push({ kind: 'byte', value: s.dbr }); break;
      case 'PEA': t.stack.push({ kind: 'byte', value: i.value >>> 8 }, { kind: 'byte', value: i.value & 255 }); break;
      case 'PLB': t.dbr = pop('byte').value; break;
      case 'PHA': pushBytes(s.m ? 1 : 2); break;
      case 'PLA': for (let n = 0; n < (s.m ? 1 : 2); n++) pop('byte'); break;
      case 'PHX': case 'PHY': pushBytes(s.x ? 1 : 2); break;
      case 'PLX': case 'PLY': for (let n = 0; n < (s.x ? 1 : 2); n++) pop('byte'); break;
      case 'REP': case 'SEP':
        if (i.value & 32) t.m = Number(i.mnemonic === 'SEP');
        if (i.value & 16) t.x = Number(i.mnemonic === 'SEP'); break;
      case 'JSR': case 'JSL':
        if (i.target === undefined) throw Error('Unproved indirect audio call');
        t.stack.push({ kind: 'return', op: i.mnemonic === 'JSR' ? 'RTS' : 'RTL', pc: i.next }); t.pc = i.target; break;
      case 'RTS': case 'RTL':
        if (!t.stack.length) {
          if (i.mnemonic !== rootReturn) throw Error('Wrong audio root return');
          returns.add(JSON.stringify({ at: cpuLabel(s.pc), m: s.m, x: s.x, dbr: s.dbr })); continue;
        } else {
          const frame = pop('return'); if (frame.op !== i.mnemonic) throw Error('Wrong audio call return');
          t.pc = frame.pc;
        }
        break;
      case 'BRA': case 'BRL': case 'JMP':
        if (i.target === undefined) throw Error('Unproved indirect audio edge'); t.pc = i.target; break;
      case 'PEI': case 'PHD': case 'PLD': case 'XCE': case 'TCS': case 'TXS':
      case 'RTI': case 'BRK': case 'COP': case 'JML': case 'MVN': case 'MVP':
        throw Error('Unproved audio control operation ' + cpuLabel(s.pc));
      default:
        if (i.mode === 'rel8') {
          if (cacheHitNonzeroVoice && s.pc === 0x80C479) t.pc=i.target; // Fresh sound-cache equality.
          else if ((menuSound !== null || lowSoundNonzeroVoice) && s.pc === 0x80C47E) t.pc = i.target;
          else if (!(bounded && s.pc === 0x80C495))
            pending.push({ ...t, pc: i.target, stack: [...t.stack] }); // Fresh DP06 assumed nonzero, or menu0003.
        }
    }
    maximumLocalStackBytes = Math.max(maximumLocalStackBytes, depth(t.stack)); pending.push(t);
  }
  return { entry: cpuLabel(entry), entry_m: entryM, abstract_states: seen.size, reachable_instructions: visited.size,
    returns: [...returns].map(JSON.parse), maximum_local_stack_bytes: maximumLocalStackBytes,
    minimum_protected_stack_bytes: maximumLocalStackBytes + (rootReturn === 'RTS' ? 2 : 3),
    modes: [...modes.values()].sort((a, b) => a.at.localeCompare(b.at) || a.m - b.m || a.x - b.x),
    external_return_assumptions: 0, actual_device_termination_proven: false,
    ...(menuSound === null ? {} : { selected_lemmas: ['Original menuDP00=FFFF/04=0040/06=0003/02=004C',
      'Original80:C4FF WORD002D below8000; loader branch skipped', 'C416/F007 fixed stores preserve DP06 before fresh voice reload'] }),
    ...(lowSoundNonzeroVoice ? { conditional_lemmas: ['Fetched WORD sound below8000',
      'Fresh WORD DP06 nonzero after parameter handshake', 'Forced DBR80 and C416/F007 fixed stores preserve DP06'] } : {}),
    ...(anySoundNonzeroVoice ? { conditional_lemmas: ['Fresh WORD DP06 nonzero after loader/parameter handshakes',
      'Forced DBR80 and F130/F100/F007/F03A/F122/F1E8/C416 fixed stores preserve DP06',
      'Dynamic cache/gate branches and original saved WORD sound'] } : {}),
    ...(cacheHitNonzeroVoice ? { conditional_lemmas: ['Fetched WORD sound equals fresh sound-cache WORD',
      'Fresh WORD DP06 nonzero after parameter handshake', 'Forced DBR80 and C416/F007 fixed stores preserve DP06'] } : {}),
    qualification: 'Static source/mode/typed-stack only, intact disjoint stack and original code; no register/memory/CPU/device/time/interrupt or scene execution.' };
}
