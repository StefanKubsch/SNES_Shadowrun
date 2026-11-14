import { readFile } from 'node:fs/promises';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';

const [count = '5'] = process.argv.slice(2);
if (!/^\d+$/.test(count) || +count > 10000) throw new Error('Usage: node tools/run-scheduler.mjs [sweeps_0_to_10000]');
const bundle = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const scheduler = createScriptScheduler(bundle);
for (let n = 0; n < 2; n++) {
  scheduler.addTask(0x04B);
  scheduler.visitTail();
}
scheduler.sweep(); // Original initial cursor is empty; first call primes it.
let state = scheduler.snapshot();
for (let n = 0; n < +count && state.status === 'ready'; n++) state = scheduler.sweep();
console.log(JSON.stringify(state, null, 2));
