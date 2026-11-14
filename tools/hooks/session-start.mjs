// Shared SessionStart hook for Claude Code and Codex.
// Performs the start steps from AGENTS.md (git status, last three commits, HANDOFF.md,
// npm run status:next) and prints them to stdout, which both agents add to the model
// context. It also warns when the generated analysis/ reports are missing.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RECENT_COMMITS = 3;

function run(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trimEnd();
  } catch (error) {
    return `(failed: ${String(error.stderr || error.message).trim()})`;
  }
}

function analysisWarning() {
  const analysis = path.join(ROOT, 'analysis');
  if (existsSync(analysis) && readdirSync(analysis).length > 0) return [];
  return [
    '',
    '## Warning',
    'analysis/ is missing or empty. Run `npm run rebuild:artifacts` (about four minutes)',
    'before tests or a release check.',
  ];
}

const handoffPath = path.join(ROOT, 'HANDOFF.md');
const sections = [
  'Session start context from tools/hooks/session-start.mjs. AGENTS.md start steps 1 to 3',
  'are done below; do not repeat them unless something changes.',
  '',
  '## git status --short --branch',
  run('git', ['status', '--short', '--branch']) || '(clean)',
  '',
  `## git log -${RECENT_COMMITS} --oneline`,
  run('git', ['log', `-${RECENT_COMMITS}`, '--oneline']),
  '',
  '## HANDOFF.md',
  existsSync(handoffPath) ? readFileSync(handoffPath, 'utf8').trimEnd() : '(missing)',
  '',
  '## npm run status:next',
  run(process.execPath, [path.join(ROOT, 'tools', 'status-next.mjs')]),
  ...analysisWarning(),
];
process.stdout.write(sections.join('\n') + '\n');
