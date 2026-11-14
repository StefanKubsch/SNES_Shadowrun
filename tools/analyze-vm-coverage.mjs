// Statische Abdeckung des nativen Interpreters über alle Originalscripts:
// welche Scripts nur bewiesene Natives benutzen (direkt und über Scriptaufrufe)
// und welche fehlenden Natives wie viele Scripts freischalten würden.
// "Statisch geeignet" heißt: alle Opcodes haben Handler und alle erreichbaren
// Native-Ziele sind bewiesen. Laufzeitverhalten belegt erst der VM-Lauf.
import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {inspectRom} from './rom.mjs';
import {inspectScriptTables} from './scripts.mjs';
import {decodeScript} from '../src/script/codec.mjs';
import {nativeOpcodeTargets} from '../src/task/native-opcode-targets.mjs';

// Natives, die der Scriptbody-Lauf über eigene bewiesene Module bedient
// (proof/task/script-bodies.mjs). Modul -> Ziel(e) im Original.
export const specialNativeTargets = Object.freeze([
  ['native-wait.mjs', [0x80C401]], ['native-c8-opcode.mjs', [0x80FEC1]], ['native-clear-opcode.mjs', [0x80FF79]],
  ['native-input-wait-opcode.mjs', [0x80F953]], ['native13-opcode.mjs', [0x809BA0]], ['native-audio-opcode.mjs', [0x80C46E]],
  ['native-random-opcode.mjs', [0x80C51F, 0x80C560]], ['native-8e36-opcode.mjs', [0x808E36]],
  ['native-selection-root-opcode.mjs', [0x80933A, 0x80BBA0]], ['native-modal-opcode.mjs', [0x80935B, 0x80CBF7, 0x80CD20, 0x80CD43]],
  ['native-cda8-opcode.mjs', [0x80CDA8]], ['native-8ab5-opcode.mjs', [0x808AB5]],
  ['native-8bc5-opcode.mjs', [0x808BC5]], ['native-8521-opcode.mjs', [0x808521]], ['native-855e-opcode.mjs', [0x80855E]],
  ['native-936c-opcode.mjs', [0x80936C]], ['native-9bc6-opcode.mjs', [0x809BC6]],
  ['native-8a51-opcode.mjs', [0x808A51, 0x808A8C]],
  ['native-small-opcode.mjs', [0x80CD9D, 0x80E1CF, 0x80C461, 0x80CECB, 0x80F254, 0x80D079, 0x80C724, 0x80EA6E, 0x80CE6D, 0x80E014, 0x809BD3, 0x809C33, 0x809BB9]],
  ['native-combat-opcode.mjs', [0x808B43, 0x808C08, 0x808C8D, 0x808CCF, 0x808D0B, 0x808D3F, 0x808D4E, 0x808D7F]],
]);
const hex = (value, width) => value.toString(16).toUpperCase().padStart(width, '0');

// Je Script: Native-IDs (Opcode $58), gerufene Scripts (Opcode $52) und benutzte Opcodes aus dem dekodierten Bytecode.
export function scriptReferences(bytes) {
  return inspectScriptTables(bytes).scripts.map(info => {
    const offset = parseInt(info.rom_offset, 16) + 2, bound = (Math.floor(offset / 0x8000) + 1) * 0x8000;
    let decoded;
    try { decoded = decodeScript(new Uint8Array(bytes.subarray(offset, bound))); } catch { return {id: parseInt(info.id, 16), decodable: false, opcodes: [], natives: [], calls: []}; }
    const instructions = [...decoded.instructions.values?.() ?? decoded.instructions];
    return {id: parseInt(info.id, 16), decodable: true, opcodes: [...new Set(instructions.map(i => i.opcode))].sort((a, b) => a - b),
      natives: [...new Set(instructions.filter(i => i.opcode === 0x58).map(i => i.operand))].sort((a, b) => a - b),
      calls: [...new Set(instructions.filter(i => i.opcode === 0x52).map(i => i.operand))].sort((a, b) => a - b)};
  });
}

export function analyzeCoverage(bytes) {
  const proven = new Set([...nativeOpcodeTargets, ...specialNativeTargets.flatMap(([, t]) => t)]);
  const nativeTarget = id => 0x800000 | bytes.readUInt16LE(0x157B8 + id * 2);
  const scripts = scriptReferences(bytes);
  const eligibleWith = ready => {
    const memo = new Map();
    const eligible = id => {
      if (memo.has(id)) return memo.get(id);
      memo.set(id, false); // Zyklen gelten als nicht geeignet, bis alle Teile es sind
      const s = scripts[id], ok = s.decodable && s.natives.every(n => ready.has(nativeTarget(n))) && s.calls.every(eligible);
      memo.set(id, ok); return ok;
    };
    return scripts.filter(s => eligible(s.id)).map(s => s.id);
  };
  const eligible = eligibleWith(proven), used = new Set(scripts.flatMap(s => s.natives));
  const missing = [...used].filter(n => !proven.has(nativeTarget(n))).sort((a, b) => a - b).map(id => ({
    id: hex(id, 2), target: hex(nativeTarget(id), 6),
    direct_users: scripts.filter(s => s.natives.includes(id)).length,
    unlocks_alone: eligibleWith(new Set([...proven, nativeTarget(id)])).length - eligible.length,
  })).sort((a, b) => b.unlocks_alone - a.unlocks_alone || b.direct_users - a.direct_users || a.id.localeCompare(b.id));
  return {
    scope: 'Statische Eignung für den nativen Interpreter (docs/STRATEGY.md, M1). Keine Laufzeitaussage.',
    scripts: scripts.length, undecodable: scripts.filter(s => !s.decodable).map(s => hex(s.id, 3)),
    natives_used: used.size, proven_natives_used: used.size - missing.length,
    eligible_scripts: eligible.length, eligible_ids: eligible.map(id => hex(id, 3)),
    missing_natives: missing,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const {bytes, metadata} = inspectRom(await readFile('Shadowrun (E).smc'));
  const report = {rom_sha256: metadata.rom_sha256, ...analyzeCoverage(bytes)};
  await writeFile('analysis/vm-coverage.json', JSON.stringify(report, null, 2) + '\n');
  console.log(`VM-Abdeckung: ${report.eligible_scripts}/${report.scripts} Scripts statisch geeignet; ${report.missing_natives.length} Natives fehlen.`);
}
