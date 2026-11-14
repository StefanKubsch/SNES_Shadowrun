import { readFile } from 'node:fs/promises';
import { createScriptTask } from '../proof/script/task.mjs';

const [idText = '04B', checksText = '5', ...argumentTexts] = process.argv.slice(2);
if (!/^[0-9A-Fa-f]{1,4}$/.test(idText) || !argumentTexts.every(s => /^[0-9A-Fa-f]{1,4}$/.test(s)) || !/^\d+$/.test(checksText) || +checksText > 1000000) throw new Error('Usage: node tools/run-task.mjs HEX_SCRIPT_ID DECIMAL_CHECKS [HEX_WORD_ARGUMENTS...]');
const bundle = JSON.parse(await readFile('assets/scripts.json', 'utf8'));
const task = createScriptTask(bundle, parseInt(idText, 16), argumentTexts.map(s => parseInt(s, 16)));
let state = task.run();
for (let n = 0; n < +checksText && state.status === 'waiting'; n++) state = task.tick();
const hex = n => '$' + n.toString(16).toUpperCase().padStart(4, '0');
console.log(JSON.stringify({
  script: hex(state.scriptId), status: state.status, steps: state.steps,
  readinessChecks: state.checks,
  wait: state.wait,
  removedFrames: state.removedFrames,
  pending: state.pending ? { ...state.pending, nativeId: hex(state.pending.nativeId), args: state.pending.args.map(hex) } : null,
  value: state.result?.value == null ? null : hex(state.result.value),
}, null, 2));
