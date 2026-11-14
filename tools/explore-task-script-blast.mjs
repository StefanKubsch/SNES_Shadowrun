import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { renderAddress } from '../src/render/data.mjs';
import { blastBodySpecs, blastNativeSources } from '../proof/task/script-body-blast-specs.mjs';
import { scriptBodyFixture, bodyCases } from './task-script-body-fixtures.mjs';
import { resumeBodyFixture } from './task-script-body-wait-fixtures.mjs';
import {
  prepareTaskScriptBody,
  prepareTaskScriptBodyResume,
} from '../proof/task/script-bodies.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { execFileSync } from 'node:child_process';
if (!process.argv.includes('--worker')) {
  for (let n = 0; n < 1500; n++) {
    const output = execFileSync(process.execPath, [process.argv[1], '--worker'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    process.stdout.write(output);
    if (output.includes('Complete source exploration')) process.exit(0);
  }
  throw Error('Source exploration bound exceeded');
}
const { bytes } = inspectRom(await readFile('Shadowrun (E).smc'));
let paths = 0;
const save = () =>
  writeFile(
    'proof/task/script-body-blast-specs.mjs',
    '// Individual whole original136/1E8 bytes and actual reached original ROM roots.\nexport const blastBodySpecs=' +
      JSON.stringify(blastBodySpecs, null, 2) +
      ';\nexport const blastNativeSources=' +
      JSON.stringify(blastNativeSources, null, 2) +
      ';\n',
  );
for (const s of blastBodySpecs) {
  s.originalTextSources = true;
  for (const v of bodyCases(s)) {
    let complete = false;
    for (let attempt = 0; attempt < 2000; attempt++) {
      const f = scriptBodyFixture(s, v);
      let options = f,
        prepare = prepareTaskScriptBody,
        retry = false;
      for (let entry = 0; entry < 1000; entry++) {
        const p = prepare(options);
        if (!p.handled) {
          const address = p.address,
            owner = Number.isInteger(address) ? renderAddress(address) : null;
          if (
            ['task_script_body_ROM_read_required', 'render_source_required'].includes(p.reason) &&
            owner >= 0x800000
          ) {
            const off = cpuToOffset(address, bytes.length),
              value = bytes.readUInt16LE(off);
            if (s.romReads.some((r) => r.address === address))
              throw Error('Repeated original source failure ' + JSON.stringify(p));
            s.romReads.push({ address, value });
            console.log(
              'Pinned actual reached ROM root',
              s.id.toString(16),
              address.toString(16),
              value.toString(16),
            );
            await save();
            process.exit(0);
          }
          throw Error(`Body${s.id.toString(16)} ${v.name} entry${entry}: ${JSON.stringify(p)}`);
        }
        if (!commitTaskPlan(f.data, p).handled) throw Error('Fixture commit failed');
        if (p.bodyComplete) {
          console.log(
            'Whole original path',
            s.id.toString(16),
            v.name,
            'entries',
            entry,
            'handlers',
            p.handlersExecuted,
          );
          complete = true;
          paths++;
          break;
        }
        options = resumeBodyFixture(s, f, p);
        prepare = prepareTaskScriptBodyResume;
        // Explicit synthetic provider event at a later separately observed entry.
        // Count40 remains forty actual source countdown entries; mask8 is a fresh
        // declared event for1E8, never manufactured timing or frame progress.
        const lo = f.data.readByte(0x800ba4),
          hi = f.data.readByte(0x800ba5),
          mask = lo.value | (hi.value << 8);
        if (mask === 8) f.data.seed(0x800c64, [8, 0]);
      }
      if (complete) break;
      if (!retry) throw Error('Incomplete body path');
    }
    if (!complete) throw Error('Unbounded source admission');
  }
  s.romReads.sort((a, b) => a.address - b.address);
}
await save();
console.log(
  'Complete source exploration',
  paths,
  'individual paths;',
  blastBodySpecs.map((s) => [s.id.toString(16), s.romReads.length]),
);
