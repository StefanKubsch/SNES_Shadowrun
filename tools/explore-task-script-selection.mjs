import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { renderAddress } from '../src/render/data.mjs';
import {
  selectionBodySpecs,
  selectionNativeSources,
} from '../proof/task/script-body-selection-specs.mjs';
import { scriptBodyFixture, bodyCases } from './task-script-body-fixtures.mjs';
import { resumeBodyFixture } from './task-script-body-wait-fixtures.mjs';
import {
  prepareTaskScriptBody,
  prepareTaskScriptBodyResume,
} from '../proof/task/script-bodies.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { execFileSync } from 'node:child_process';
if (!process.argv.includes('--worker')) {
  for (let n = 0; n < 2000; n++) {
    const output = execFileSync(process.execPath, [process.argv[1], '--worker'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    process.stdout.write(output);
    if (output.includes('Complete selection exploration')) process.exit(0);
  }
  throw Error('Bound exceeded');
}
const { bytes } = inspectRom(await readFile('Shadowrun (E).smc'));
const save = () =>
  writeFile(
    'proof/task/script-body-selection-specs.mjs',
    '// Individually whole original0F8/194 and actual reached originalROM roots.\nexport const selectionBodySpecs=' +
      JSON.stringify(selectionBodySpecs, null, 2) +
      ';\nexport const selectionNativeSources=' +
      JSON.stringify(selectionNativeSources, null, 2) +
      ';\n',
  );
let paths = 0;
for (const s of selectionBodySpecs)
  for (const v of bodyCases(s)) {
    const f = scriptBodyFixture(s, v);
    let options = f,
      prepare = prepareTaskScriptBody,
      complete = false;
    for (let n = 0; n < 1000; n++) {
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
            throw Error('Repeated original read ' + JSON.stringify(p));
          s.romReads.push({ address, value });
          s.romReads.sort((a, b) => a.address - b.address);
          await save();
          console.log('OriginalROM root', s.id, address.toString(16), value.toString(16));
          process.exit(0);
        }
        throw Error(`Body${s.id.toString(16)}/${v.name}/entry${n}: ${JSON.stringify(p)}`);
      }
      if (!commitTaskPlan(f.data, p).handled) throw Error('Commit failed');
      if (p.bodyComplete) {
        complete = true;
        paths++;
        console.log('Whole', s.id.toString(16), v.name, n, p.handlersExecuted, p.resultWord);
        break;
      }
      options = resumeBodyFixture(s, f, p);
      prepare = prepareTaskScriptBodyResume;
      if (v.event === 0x800) f.data.seed(0x800c64, [0, 8]);
    }
    if (!complete) throw Error('Unbounded body');
  }
await save();
console.log(
  'Complete selection exploration',
  paths,
  selectionBodySpecs.map((s) => [s.id, s.romReads.length]),
);
