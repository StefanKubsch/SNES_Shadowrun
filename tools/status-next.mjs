// Read current work without printing the full progress file.
// No argument: current work; <group-id>: one proof group; --history: earlier plan.
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PROJECT_STATUS_TEXT_LIMIT } from './project-status-text.mjs';

export const currentWorkReference = 'docs/PROJECT-STATUS.json';
const HISTORICAL_REASON_LIMIT = 1200;
const short = (value, limit = PROJECT_STATUS_TEXT_LIMIT) =>
  typeof value === 'string' && value.length > limit ? value.slice(0, limit) + ' …' : value;
export function summarizeProgress(progress, groupId = null, currentWork = null) {
  if (groupId && groupId !== '--history') {
    const group = progress.work_groups.find((g) => g.id === groupId);
    if (!group) throw Error('Unknown work group: ' + groupId);
    const out = {
      id: group.id,
      status: group.status,
      entries: group.entries,
      reason: short(group.reason, HISTORICAL_REASON_LIMIT),
    };
    for (const [key, value] of Object.entries(group))
      if (!(key in out))
        out[key] = Array.isArray(value)
          ? `[${value.length} entries]`
          : value && typeof value === 'object'
            ? `{${Object.keys(value).join(', ')}}`
            : short(value);
    return out;
  }
  if (currentWork && groupId !== '--history') {
    const work = currentWork;
    return {
      current_work: {
        updated: work.updated,
        focus: short(work.focus),
        next_step: short(work.next_step),
        porting_resume: short(work.porting_resume),
        open_issues: work.open_issues.map((issue) => short(issue)),
        accepted_model_assumptions: work.accepted_model_assumptions.map((note) => short(note)),
        implementation_limits: work.implementation_limits.map((note) => short(note)),
        optional_quality_checks: work.optional_quality_checks.map((note) => short(note)),
        references: work.references,
      },
      evidence_inventory: {
        supplied: progress.supplied.length,
        work_groups: progress.work_groups.length,
        group_details: 'node tools/status-next.mjs <group-id>',
        history: 'node tools/status-next.mjs --history',
      },
    };
  }
  const next = progress.next_block;
  return {
    view: 'historical-evidence',
    notice:
      'Recorded proof groups and earlier plans; these are not the current work order. Use npm run status:next for current work.',
    autonomous_batch: progress.autonomous_batch
      ? Object.fromEntries(
          Object.entries(progress.autonomous_batch).map(([key, value]) => [key, short(value)]),
        )
      : null,
    next_block: { ...next, objective: short(next.objective) },
    next_group_status: progress.work_groups.find((g) => g.id === next.group)?.status ?? null,
    open_boundaries: progress.open_boundaries.map((b) => b.id),
    counts: { supplied: progress.supplied.length, work_groups: progress.work_groups.length },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const [progress, currentWork] = await Promise.all([
    readFile(resolve(root, 'docs/PORTIERUNGSSTAND.json'), 'utf8').then(JSON.parse),
    readFile(resolve(root, currentWorkReference), 'utf8').then(JSON.parse),
  ]);
  console.log(
    JSON.stringify(summarizeProgress(progress, process.argv[2] ?? null, currentWork), null, 2),
  );
}
