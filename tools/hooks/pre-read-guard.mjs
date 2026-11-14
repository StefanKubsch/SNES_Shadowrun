// Shared PreToolUse hook for Claude Code and Codex that keeps large files out of the
// model context (AGENTS.md "Starting each session", steps 3 and 5):
// - docs/PORTIERUNGSSTAND.json (about 1 MB) is never read whole; use status-next.
// - Files in analysis/ and docs/handoff-archiv/ above LARGE_FILE_BYTES are read only as
//   excerpts (Read with limit, or a shell read limited by a pipe or a line count).
// Inputs: Claude Code Read (tool_input.file_path/limit) and shell commands of both agents
// (tool_input.command). A denial is printed as PreToolUse JSON, which both agents accept.
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BYTES_PER_KIBIBYTE = 1024;
const LARGE_FILE_BYTES = 64 * BYTES_PER_KIBIBYTE;

const FORBIDDEN_FILE = /^docs\/PORTIERUNGSSTAND\.json$/;
const EXCERPT_ONLY_FILE = /^(analysis|docs\/handoff-archiv)\//;
// Shell commands that print a whole file, and options that limit them to an excerpt.
const WHOLE_FILE_READER = /^(cat|type|gc|get-content|more|less|bat|nl)$/i;
const EXCERPT_OPTION = /^-(totalcount|head|tail|first|last)$/i;
const STATEMENT_SEPARATOR = /&&|\|\||;|\r?\n/;

function toRelative(file, cwd) {
  return path.relative(ROOT, path.resolve(cwd, file)).split(path.sep).join('/');
}

function fileSize(file) {
  try {
    return statSync(file).size;
  } catch {
    return 0;
  }
}

// Reason to block a whole-file read of `file`, or null.
function blockReason(file, cwd) {
  const relative = toRelative(file, cwd);
  if (FORBIDDEN_FILE.test(relative)) {
    return (
      `${relative} is about 1 MB and must not be loaded into the context (AGENTS.md). ` +
      'Use `npm run status:next`, `node tools/status-next.mjs <group-id>` or ' +
      '`node tools/status-next.mjs --history`.'
    );
  }
  const absolute = path.resolve(cwd, file);
  if (!EXCERPT_ONLY_FILE.test(relative) || !existsSync(absolute)) return null;
  const size = fileSize(absolute);
  if (size <= LARGE_FILE_BYTES) return null;
  return (
    `${relative} has ${Math.round(size / BYTES_PER_KIBIBYTE)} KiB; read only targeted ` +
    'excerpts (AGENTS.md): search first, then read a line range (Read with offset and ' +
    'limit, or a shell command limited by head, sed -n, Select-Object or a pipe).'
  );
}

function shellWords(statement) {
  const words = statement.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return words.map((word) => word.replace(/^["']|["']$/g, ''));
}

// Whole-file reads in a shell command: a single-stage statement whose command prints files.
function shellBlockReason(command, cwd) {
  for (const statement of command.split(STATEMENT_SEPARATOR)) {
    if (statement.includes('|')) continue;
    const [program, ...rest] = shellWords(statement.trim());
    if (!program || !WHOLE_FILE_READER.test(program)) continue;
    if (rest.some((word) => EXCERPT_OPTION.test(word))) continue;
    for (const word of rest) {
      if (word.startsWith('-')) continue;
      const reason = blockReason(word.replace(/\\/g, '/'), cwd);
      if (reason) return reason;
    }
  }
  return null;
}

let input = '';
for await (const chunk of process.stdin) input += chunk;
let payload = {};
try {
  payload = JSON.parse(input || '{}');
} catch {
  // An unreadable payload is not this guard's concern; let the tool call proceed.
}
const toolInput = payload.tool_input ?? {};
const cwd = payload.cwd ?? process.cwd();

let reason = null;
if (typeof toolInput.file_path === 'string' && toolInput.limit === undefined) {
  reason = blockReason(toolInput.file_path, cwd);
} else if (typeof toolInput.command === 'string') {
  reason = shellBlockReason(toolInput.command, cwd);
}
if (reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `Blocked by tools/hooks/pre-read-guard.mjs: ${reason}`,
      },
    }) + '\n',
  );
}
