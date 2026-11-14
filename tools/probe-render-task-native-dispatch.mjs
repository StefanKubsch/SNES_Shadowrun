import { emitTaskNativeProbe } from './task-native-probe.mjs';
import { loadTaskNativeBlock } from './task-native-catalog.mjs';
import { writeFile } from 'node:fs/promises';
import { taskLeafSpecs } from './task-native-leaf-specs.mjs';
import { taskNativeCallFixture } from './task-native-dispatch-fixtures.mjs';
import { prepareTaskNativeCall } from '../proof/task/native-dispatch.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const report = await emitTaskNativeProbe(await loadTaskNativeBlock('native-dispatch'));
report.composition = {
  entry: '80:F4F6',
  export: 'prepareTaskNativeCall',
  source_dependencies: [
    'analysis/render-task-native-bridge.json',
    'analysis/render-task-native-dispatch.json',
    'analysis/render-task-native-resume.json',
  ],
  contract:
    'One overlay/access ledger/commit; fresh actual target, actual inner RTS must reach F509; typed leaf proves E0M0X0D0/DBR80. Fresh original resume stops BEFORE F390. No wholeTask or global stack/scene/frame proof.',
  probes: [],
};
for (const spec of taskLeafSpecs)
  for (const limits of [{}, { maxWork: 0 }, { maxOutputBytes: 0 }]) {
    const f = taskNativeCallFixture(spec),
      before = JSON.stringify(f.data.snapshot()),
      p = prepareTaskNativeCall({ ...f, ...limits });
    if (JSON.stringify(f.data.snapshot()) !== before)
      throw Error('Native composition prepare mutated owner');
    if (!Object.keys(limits).length && !p.handled)
      throw Error('Missing successful composed target ' + spec.name);
    if (Object.keys(limits).length && p.handled) throw Error('Composed budget failed to stop');
    if (p.handled && !commitTaskPlan(f.data, p).handled)
      throw Error('Composed outer commit failed');
    report.composition.probes.push({
      callee: spec.name,
      calleeEntry: spec.entry,
      synthetic: true,
      limits,
      handled: p.handled,
      ...(p.handled
        ? {
            frontier: p.frontier,
            outputContext: p.outputContext,
            work: p.work,
            outputBytes: p.outputBytes,
            tablePointerWord: p.tablePointerWord,
            dispatchPointerWord: p.dispatchPointerWord,
            calleeReturnWord: p.calleeReturnWord,
            calleeReturnTarget: p.calleeReturnTarget,
            calleeReturnTargetExecuted: p.calleeReturnTargetExecuted,
            byteWrites: p.byteWrites,
            readAddresses: p.readAddresses,
            fullTaskBinding: p.fullTaskBinding,
            globalStackMinimum: p.globalStackMinimum,
          }
        : { reason: p.reason }),
    });
  }
await writeFile(
  'analysis/render-task-native-dispatch-native.json',
  JSON.stringify(report, null, 2) + '\n',
);
