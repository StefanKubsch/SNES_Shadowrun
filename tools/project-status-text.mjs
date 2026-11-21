// Keep current-work notes within the status CLI's existing per-text limit.
// The post-edit hook and release preflight use the same rule as the CLI.
export const PROJECT_STATUS_TEXT_LIMIT = 400;
// The CLI contract is strictly below 5000 UTF-8 bytes, including its newline.
export const PROJECT_STATUS_OUTPUT_LIMIT = 5000;
const short = (value) =>
  typeof value === 'string' && value.length > PROJECT_STATUS_TEXT_LIMIT
    ? value.slice(0, PROJECT_STATUS_TEXT_LIMIT) + ' …'
    : value;

export function summarizeCurrentWork(work, inventory) {
  return {
    current_work: {
      updated: work.updated,
      focus: short(work.focus),
      next_step: short(work.next_step),
      porting_resume: short(work.porting_resume),
      open_issues: (work.open_issues ?? []).map(short),
      accepted_model_assumptions: (work.accepted_model_assumptions ?? []).map(short),
      implementation_limits: (work.implementation_limits ?? []).map(short),
      optional_quality_checks: (work.optional_quality_checks ?? []).map(short),
      references: work.references,
    },
    evidence_inventory: {
      ...inventory,
      group_details: 'node tools/status-next.mjs <group-id>',
      history: 'node tools/status-next.mjs --history',
    },
  };
}

export const serializeStatus = (summary) => JSON.stringify(summary, null, 2) + '\n';
const TEXT_FIELDS = ['focus', 'next_step', 'porting_resume'];
const TEXT_LISTS = [
  'open_issues',
  'accepted_model_assumptions',
  'implementation_limits',
  'optional_quality_checks',
];

export function projectStatusTextFindings(source, inventory = { supplied: 0, work_groups: 0 }) {
  let work;
  try {
    work = JSON.parse(source);
  } catch (error) {
    return [{ line: 1, text: `Invalid project status JSON: ${error.message}` }];
  }
  const findings = [];
  const check = (field, value, key = field) => {
    if (typeof value !== 'string' || value.length <= PROJECT_STATUS_TEXT_LIMIT) return;
    const offset = source.indexOf(JSON.stringify(field));
    const line = source.slice(0, Math.max(0, offset)).split('\n').length;
    findings.push({
      line,
      text: `${key}: ${value.length} characters; maximum ${PROJECT_STATUS_TEXT_LIMIT}. Shorten by ${value.length - PROJECT_STATUS_TEXT_LIMIT}.`,
    });
  };
  for (const field of TEXT_FIELDS) check(field, work?.[field]);
  for (const field of TEXT_LISTS)
    if (Array.isArray(work?.[field]))
      work[field].forEach((value, index) => check(field, value, `${field}[${index}]`));
  const bytes = Buffer.byteLength(serializeStatus(summarizeCurrentWork(work ?? {}, inventory)));
  if (bytes >= PROJECT_STATUS_OUTPUT_LIMIT)
    findings.push({
      line: 1,
      text: `status:next output: ${bytes} UTF-8 bytes; maximum ${PROJECT_STATUS_OUTPUT_LIMIT - 1}. Shorten by at least ${bytes - PROJECT_STATUS_OUTPUT_LIMIT + 1} bytes. Move details to linked documents.`,
    });
  return findings;
}
