// Keep current-work notes within the status CLI's existing per-text limit.
// The post-edit hook and release preflight use the same rule as the CLI.
export const PROJECT_STATUS_TEXT_LIMIT = 400;
const TEXT_FIELDS = ['focus', 'next_step', 'porting_resume'];
const TEXT_LISTS = [
  'open_issues',
  'accepted_model_assumptions',
  'implementation_limits',
  'optional_quality_checks',
];

export function projectStatusTextFindings(source) {
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
  return findings;
}
