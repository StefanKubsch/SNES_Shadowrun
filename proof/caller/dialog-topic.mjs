// Former topic action retains independent register-level task append.
import { dialogCallBody, segmentSequence } from '../../src/system/native-call-continuation.mjs';
import { appendScriptTask } from '../../src/system/task-append.mjs';
import { appendScriptTaskCall } from '../../src/script/task-api.mjs';
const DP_DIALOG_RECORD = 0x11,
  DP_TOPIC_TASK_ARGUMENT = 0x26;
export function* dialogTopicSequence(h, events) {
  const { ctx } = h;
  yield () => {
    h.load(h.read(h.indirect(DP_DIALOG_RECORD, ctx.y)));
    h.index('x', ctx.a);
    h.load(h.dp(DP_TOPIC_TASK_ARGUMENT));
    h.dpWrite(0, ctx.a);
  };
  // On the JS scheduler the task API appends the task.
  const append = (a) => (a.tasks ? appendScriptTaskCall(a) : appendScriptTask(a, false));
  yield* dialogCallBody(h, 0x8091d1, 0x80c34a, () => segmentSequence(() => append(h.a)));
  yield* dialogCallBody(h, 0x8091d4, 0x80c1ca, function* () {
    yield { continuation: events.nestedRound(0x80c1ca) };
  });
}
