import { readFile } from 'node:fs/promises';
import { createScriptRunner } from '../proof/script/runtime.mjs';

const [idText = '197', ...argumentTexts] = process.argv.slice(2);
if (![idText, ...argumentTexts].every((s) => /^[0-9A-Fa-f]{1,4}$/.test(s)))
  throw new Error('Use hexadecimal script ID and word arguments');
const bundle = JSON.parse(await readFile('assets/scripts.json', 'utf8'));
if (bundle.format !== 'shadowrun-e-event-scripts-v1') throw new Error('Unsupported asset format');
const script = bundle.scripts.find((s) => s.id === parseInt(idText, 16));
if (!script) throw new Error('Script ID not found');
if (argumentTexts.length * 2 !== script.argumentBytes)
  throw new Error(`Script expects ${script.argumentBytes / 2} argument words`);
const run = createScriptRunner(Uint8Array.from(script.bytecode), script);
const result = run(argumentTexts.map((s) => parseInt(s, 16)));
console.log(
  JSON.stringify(
    {
      script: idText,
      value:
        result.value === null
          ? null
          : '$' + result.value.toString(16).toUpperCase().padStart(4, '0'),
      steps: result.steps,
      remainingStack: result.stack,
    },
    null,
    2,
  ),
);
