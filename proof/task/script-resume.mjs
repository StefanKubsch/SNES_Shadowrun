import { prepareTaskPlan } from './plan.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
// F495 and F509 share the pinned frame/PEI/PLB/S/result/fetch equation;
// their original full-WORD return-metadata table addresses differ.
export const prepareTaskScriptResume = (options) =>
  prepareTaskPlan(options, [0x80f495], (a) => ({
    ...runTaskNativeResume(a, options.protectedStackBytes, 0x82e623),
    scope: 'manual-later-script-resume-before-F390',
    resumeOccurrenceProven: false,
  }));
