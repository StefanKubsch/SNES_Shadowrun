// Shared early check for edits, block tests, releases and the local Git hook.
// --staged checks exactly the index contents, never the unstaged working copy.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectStatusTextFindings } from './project-status-text.mjs';
// The historical evidence file exceeds Node's default subprocess output buffer.
const GIT_OUTPUT_LIMIT = 64 * 1024 * 1024;

export function checkProjectStatus(root, { staged = false } = {}) {
  const read = (path) =>
    staged
      ? execFileSync('git', ['show', `:${path}`], {
          cwd: root,
          encoding: 'utf8',
          windowsHide: true,
          maxBuffer: GIT_OUTPUT_LIMIT,
        })
      : readFileSync(resolve(root, path), 'utf8');
  const source = read('docs/PROJECT-STATUS.json');
  // Invalid JSON and individual text limits can be reported without the archive.
  const initial = projectStatusTextFindings(source);
  if (initial.length) return initial;
  const progress = JSON.parse(read('docs/PORTIERUNGSSTAND.json'));
  return projectStatusTextFindings(source, {
    supplied: progress.supplied.length,
    work_groups: progress.work_groups.length,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  try {
    const findings = checkProjectStatus(root, { staged: process.argv.includes('--staged') });
    if (findings.length) {
      console.error(
        findings.map(({ line, text }) => `docs/PROJECT-STATUS.json:${line}: ${text}`).join('\n'),
      );
      process.exitCode = 1;
    } else console.log('Project status: text and complete CLI output fit their limits.');
  } catch (error) {
    console.error(`Project status check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
