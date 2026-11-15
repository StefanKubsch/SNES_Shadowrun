// Mesen oracle window coverage: scripts, natives, and opcodes observed in matching intervals
// of the real game are compared with all 937 scripts and every native used by scripts.
// This supports planning additional Mesen cases (docs/MESEN-ORACLE.md, "Coverage" section).
// Only work executed in a matching interval is measured; paths inside a native are not counted.
// node tools/mesen-coverage.mjs [windows ...]   (with no names, all ORACLE_WINDOWS run in parallel)
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectScriptTables } from './scripts.mjs';
import { scriptReferences } from './analyze-vm-coverage.mjs';
import { SPECIAL_NATIVES } from '../proof/vm/special-natives.mjs';
import { findMesen } from './mesen.mjs';
import { ORACLE_WINDOWS, recordTrace, compareTrace } from './mesen-f390-oracle.mjs';

const hex = (value, width) => '$' + value.toString(16).toUpperCase().padStart(width, '0');
const parse = (key) => parseInt(key.slice(1), 16);

// reports: [{name, report}] from compareTrace. An interval's script base is the word at D in the task frame
// (bank DBR), pointing past the two-byte header to script address + 2. Multiple IDs can share an address.
export function summarizeCoverage(bytes, reports) {
  const tables = inspectScriptTables(bytes),
    references = scriptReferences(bytes);
  const nativeTarget = (id) => 0x800000 | bytes.readUInt16LE(0x157b8 + id * 2);
  const idsAt = new Map();
  for (const info of tables.scripts) {
    const base = parseInt(info.cpu_address.replace(':', ''), 16) + 2;
    idsAt.set(base, [...(idsAt.get(base) ?? []), parseInt(info.id, 16)]);
  }
  const scripts = new Map(),
    natives = new Map(),
    opcodes = new Map(),
    unknownBases = new Map(),
    windows = [];
  const add = (map, key, n) => map.set(key, (map.get(key) ?? 0) + n);
  for (const { name, report } of reports) {
    const before = { scripts: scripts.size, natives: natives.size };
    for (const [key, n] of Object.entries(report.scriptBases)) {
      const ids = idsAt.get(parse(key));
      if (ids) for (const id of ids) add(scripts, id, n);
      else add(unknownBases, parse(key), n);
    }
    for (const [key, n] of Object.entries(report.nativesCalled)) add(natives, parse(key), n);
    for (const [key, n] of Object.entries(report.opcodes)) add(opcodes, parse(key), n);
    windows.push({
      name,
      intervals: report.intervals,
      clean:
        report.mismatches.length === 0 &&
        report.faults.length === 0 &&
        report.selfCheck === 'equal' &&
        Object.keys(report.missingNatives).length === 0,
      new_scripts: scripts.size - before.scripts,
      new_natives: natives.size - before.natives,
    });
  }
  // Native universe: every target called by a script through opcode $58.
  const users = new Map();
  for (const s of references)
    for (const id of s.natives) {
      const target = nativeTarget(id),
        entry = users.get(target) ?? { ids: new Set(), scripts: [] };
      entry.ids.add(id);
      entry.scripts.push(s.id);
      users.set(target, entry);
    }
  const usedOpcodes = new Set(references.flatMap((s) => s.opcodes));
  const uncovered = [...users]
    .filter(([target]) => !natives.has(target))
    .map(([target, { ids, scripts: by }]) => ({
      target: hex(target, 6),
      ids: [...ids].map((id) => hex(id, 2)),
      special: SPECIAL_NATIVES.has(target),
      direct_users: by.length,
      users_already_run: by.filter((id) => scripts.has(id)).length,
      example_scripts: by.slice(0, 8).map((id) => hex(id, 3)),
    }))
    .sort(
      (a, b) =>
        b.special - a.special ||
        b.direct_users - a.direct_users ||
        a.target.localeCompare(b.target),
    );
  return {
    scope:
      'Mesen oracle: scripts, natives (opcode $58), and opcodes executed in matching intervals. Paths inside a native are not measured.',
    windows,
    scripts: {
      total: references.length,
      run: scripts.size,
      ids: [...scripts.keys()].sort((a, b) => a - b).map((id) => hex(id, 3)),
      unknown_bases: Object.fromEntries([...unknownBases].map(([b, n]) => [hex(b, 6), n])),
    },
    natives: {
      used_by_scripts: users.size,
      run: [...natives.keys()].filter((t) => users.has(t)).length,
      special_used: [...users.keys()].filter((t) => SPECIAL_NATIVES.has(t)).length,
      special_run: [...natives.keys()].filter((t) => users.has(t) && SPECIAL_NATIVES.has(t)).length,
      run_counts: Object.fromEntries(
        [...natives].sort((a, b) => a[0] - b[0]).map(([t, n]) => [hex(t, 6), n]),
      ),
      not_run: uncovered,
    },
    opcodes: {
      used_by_scripts: usedOpcodes.size,
      run: [...opcodes.keys()].filter((o) => usedOpcodes.has(o)).length,
      not_run: [...usedOpcodes]
        .filter((o) => !opcodes.has(o))
        .sort((a, b) => a - b)
        .map((o) => hex(o, 2)),
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { exe, reason } = findMesen();
  if (!exe) {
    console.log(`Mesen is unavailable: ${reason}`);
    process.exit(1);
  }
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ORACLE_WINDOWS);
  const unknown = names.filter((name) => !ORACLE_WINDOWS[name]);
  if (unknown.length) {
    console.log(`Unknown windows: ${unknown.join(', ')}`);
    process.exit(1);
  }
  const t0 = Date.now();
  const recorded = await Promise.all(names.map((name) => recordTrace(exe, ORACLE_WINDOWS[name])));
  const reports = recorded.map((trace, i) => ({ name: names[i], report: compareTrace(trace) }));
  const bytes = readFileSync(new URL('../Shadowrun (E).smc', import.meta.url));
  const summary = {
    windows_requested: names,
    seconds: Math.round((Date.now() - t0) / 1000),
    ...summarizeCoverage(bytes, reports),
  };
  writeFileSync('analysis/mesen-coverage.json', JSON.stringify(summary, null, 1) + '\n');
  const { scripts, natives, opcodes, windows } = summary;
  console.log(
    `Windows ${windows.length} (${windows.filter((w) => w.clean).length} without mismatches), ${summary.seconds} s`,
  );
  console.log(
    `Scripts ${scripts.run}/${scripts.total}, natives ${natives.run}/${natives.used_by_scripts} (special natives ${natives.special_run}/${natives.special_used}), opcodes ${opcodes.run}/${opcodes.used_by_scripts}`,
  );
  console.log('Report: analysis/mesen-coverage.json');
  if (windows.some((w) => !w.clean)) process.exitCode = 1;
}
