// Retain external report ownership checks around the ROM-only source builders.
import {readFile} from 'node:fs/promises';

export async function verifyMenuSourceReports(dependencies, romHash, {allowTransitive = false} = {}) {
  const owners = new Map();
  for (const d of dependencies) {
    if (!owners.has(d.report)) owners.set(d.report, JSON.parse(await readFile(d.report, 'utf8')));
    const owner = owners.get(d.report);
    if (owner.rom_sha256 !== romHash) throw Error('Dependency ROM drift');
    const available = [...owner.windows, ...(allowTransitive ? (owner.dependencies ?? []).flatMap(group => group.windows) : [])];
    for (const w of d.windows) if (!available.some(v => JSON.stringify(v) === JSON.stringify(w))) {
      throw Error('Dependency ownership drift: ' + d.report + ': ' + w.name);
    }
  }
}
