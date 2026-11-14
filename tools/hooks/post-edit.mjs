// Shared post-edit hook for Claude Code and Codex (PostToolUse after file edits).
// For every edited file it
// 1. formats the file with the project's Prettier (respects .prettierignore),
// 2. reports magic numbers on changed lines of source files in src/, proof/ and tools/,
// 3. reports German text on changed lines: comments in .mjs files and Markdown prose
//    (docs/handoff-archiv/ keeps its historical wording and is skipped),
// 4. reports relative Markdown links whose target does not exist,
// 5. checks all current-work text lengths whenever PROJECT-STATUS.json is edited,
// 6. reports ESLint findings (eslint.config.mjs) of .mjs/.js files on changed lines, and
//    findings that the HEAD version of the file does not have (such as an import whose
//    last use was removed elsewhere in the file).
// "Changed lines" are the lines added or changed relative to HEAD; new files count fully.
//
// Claude Code (.claude/settings.json): the payload names one file in tool_input.file_path;
// findings go to stderr with exit code 2, which Claude Code feeds back to the model.
// Codex (.codex/hooks.json, flag --codex): edits arrive as apply_patch with the patch text
// in tool_input.command; the file paths are read from its "*** Add/Update File:" and
// "*** Move to:" headers, and findings are returned as {"decision":"block","reason":...}.
//
// Manual check of whole files: node tools/hooks/post-edit.mjs --scan <file>...
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import * as acornPlugin from 'prettier/plugins/acorn';
import { projectStatusTextFindings } from '../project-status-text.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXIT_FEEDBACK_TO_MODEL = 2;
const MAX_REPORTED_FINDINGS = 25;
const SNIPPET_MAX_LENGTH = 100;
const GIT_OUTPUT_LIMIT = 64 * 1024 * 1024;
const ESLINT_FILE = /\.(mjs|js)$/;

// Magic numbers: files whose changed lines are checked (paths relative to the root).
const MAGIC_CHECKED_FILE = /^(src|proof|tools)\/.+\.mjs$/;
const MAGIC_EXEMPT_FILE = /\.test\.mjs$/;
// Values that carry no hidden meaning on their own.
const ALLOWED_VALUES = new Set([0, 1, -1, 2]);
// Explicit, justified exception on the same line: // magic-number-ok: <reason>
const MAGIC_EXCEPTION_MARKER = /magic-number-ok/;
const CONSTANT_NAME = /^[A-Z][A-Z0-9_]*$/;
// ROM program addresses written as six hex digits (bank:offset, e.g. 0x81d9cd) are
// source references to the original code, not magic numbers: LoROM banks $00-$1F
// and their mirrors $80-$9F, offsets $8000-$FFFF (src/constants/memory-map.mjs).
const ROM_ADDRESS_LITERAL = /^0x[0-9a-f]{6}$/i;
const LOROM_OFFSET = 0x8000;
const ROM_BANK_MASK = 0x7f;
const ROM_BANK_COUNT = 0x20;
const BANK_SHIFT = 16;
const OFFSET_MASK = 0xffff;
function isRomAddress(value, raw) {
  if (!raw || !ROM_ADDRESS_LITERAL.test(raw)) return false;
  const bank = (value >>> BANK_SHIFT) & ROM_BANK_MASK;
  return bank < ROM_BANK_COUNT && (value & OFFSET_MASK) >= LOROM_OFFSET;
}

// Language: comments in code files and prose in Markdown files must be English.
const CODE_FILE = /\.mjs$/;
const MARKDOWN_FILE = /\.md$/;
const LANGUAGE_EXEMPT_FILE = /^docs\/handoff-archiv\//;
// Explicit exception on the same line, for example a quoted German original.
const LANGUAGE_EXCEPTION_MARKER = /language-ok/;
const GERMAN_LETTER = /[äöüÄÖÜß]/;
const GERMAN_WORDS = new Set([
  'und',
  'nicht',
  'der',
  'die',
  'das',
  'ist',
  'wird',
  'werden',
  'mit',
  'auf',
  'eine',
  'einen',
  'einem',
  'einer',
  'wenn',
  'oder',
  'auch',
  'noch',
  'nach',
  'bei',
  'sind',
  'sich',
  'dass',
  'nur',
  'kein',
  'keine',
  'zum',
  'zur',
  'vom',
  'wir',
  'ich',
  'aber',
  'dann',
  'hier',
]);
// Distinct German function words needed on one line without umlauts.
const GERMAN_WORD_THRESHOLD = 2;

// Markdown links: [text](target "title") or [text](<target with spaces>).
const MARKDOWN_LINK = /\[[^\]]*\]\((?:<([^>]+)>|([^)\s]+))(?:\s+"[^"]*")?\)/g;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const INLINE_CODE = /`[^`]*`/g;
const CODE_FENCE = /^\s*(```|~~~)/;

// apply_patch headers that name a file which exists after the patch.
const PATCH_TARGET_HEADER = /^\*\*\* (?:Add File|Update File|Move to): (.+)$/;
const PATCH_UPDATE_HEADER = /^\*\*\* Update File: /;
const PATCH_MOVE_HEADER = '*** Move to: ';

function toRelative(file) {
  return path.relative(ROOT, path.resolve(file)).split(path.sep).join('/');
}

async function formatWithPrettier(file) {
  const info = await prettier.getFileInfo(file, {
    ignorePath: path.join(ROOT, '.prettierignore'),
  });
  if (info.ignored || !info.inferredParser) return;
  const config = (await prettier.resolveConfig(file)) ?? {};
  const source = readFileSync(file, 'utf8');
  const formatted = await prettier.format(source, { ...config, filepath: file });
  if (formatted !== source) writeFileSync(file, formatted);
}

const git = (args) =>
  execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: GIT_OUTPUT_LIMIT,
  });
// The HEAD version of a tracked file, or null for a new file.
function headSource(relative) {
  try {
    return git(['show', `HEAD:${relative}`]);
  } catch {
    return null;
  }
}

// Line numbers (1-based) added or changed relative to HEAD; null means every line.
function changedLines(relative) {
  try {
    git(['ls-files', '--error-unmatch', '--', relative]);
  } catch {
    return null;
  }
  const diff = git(['diff', '--no-color', '--unified=0', 'HEAD', '--', relative]);
  const lines = new Set();
  for (const match of diff.matchAll(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    for (let line = start; line < start + count; line++) lines.add(line);
  }
  return lines;
}

function lineIndex(source) {
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') lineStarts.push(i + 1);
  return (offset) => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (lineStarts[middle] <= offset) low = middle;
      else high = middle - 1;
    }
    return low + 1;
  };
}

const snippet = (text) => text.trim().slice(0, SNIPPET_MAX_LENGTH);
const isSelected = (line, onlyLines) => !onlyLines || onlyLines.has(line);

async function parseModule(source) {
  try {
    return await acornPlugin.parsers.acorn.parse(source, {});
  } catch {
    return null;
  }
}

// --- Magic numbers -------------------------------------------------------------------

function isConstantDefinition(node) {
  if (node.type === 'VariableDeclarator') {
    return node.id.type === 'Identifier' && CONSTANT_NAME.test(node.id.name);
  }
  if (node.type === 'PropertyDefinition') {
    return node.static && node.key.type === 'Identifier' && CONSTANT_NAME.test(node.key.name);
  }
  return false;
}

// Sound processor I/O (src/apu/spc-io.mjs): the optional last argument of
// io.read(address, pc) and io.write(address, value, pc) is the address of the
// original instruction (IPL ROM or sound driver), a source reference.
const SPC_IO_PC_ARGUMENT = { read: 1, write: 2 };
function isSpcIoObject(node) {
  if (node.type === 'Identifier') return node.name === 'io';
  return (
    node.type === 'MemberExpression' &&
    node.object.type === 'ThisExpression' &&
    node.property.type === 'Identifier' &&
    node.property.name === 'io'
  );
}
function spcIoPcArgument(node) {
  if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') return null;
  const { object, property } = node.callee;
  if (property.type !== 'Identifier' || !Object.hasOwn(SPC_IO_PC_ARGUMENT, property.name)) {
    return null;
  }
  if (!isSpcIoObject(object)) return null;
  return node.arguments[SPC_IO_PC_ARGUMENT[property.name]] ?? null;
}

function collectNumbers(node, insideConstant, found) {
  if (!node || typeof node.type !== 'string') return;
  // Everything below an UPPER_SNAKE_CASE definition (including tables) defines a constant.
  const isConstant = insideConstant || isConstantDefinition(node);
  const pcArgument = spcIoPcArgument(node);
  if (pcArgument?.type === 'Literal') {
    for (const argument of node.arguments) {
      if (argument !== pcArgument) collectNumbers(argument, isConstant, found);
    }
    collectNumbers(node.callee, isConstant, found);
    return;
  }
  if (
    node.type === 'UnaryExpression' &&
    node.operator === '-' &&
    node.argument.type === 'Literal' &&
    typeof node.argument.value === 'number'
  ) {
    if (!isConstant) found.push({ value: -node.argument.value, start: node.start });
    return;
  }
  if (node.type === 'Literal' && (typeof node.value === 'number' || node.bigint)) {
    if (!isConstant) found.push({ value: Number(node.value), raw: node.raw, start: node.start });
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key === 'parent' || key === 'comments' || !child || typeof child !== 'object') continue;
    if (Array.isArray(child)) for (const item of child) collectNumbers(item, isConstant, found);
    else collectNumbers(child, isConstant, found);
  }
}

function findMagicNumbers({ relative, sourceLines, ast, lineOf, onlyLines }) {
  if (!ast || !MAGIC_CHECKED_FILE.test(relative) || MAGIC_EXEMPT_FILE.test(relative)) return [];
  const found = [];
  collectNumbers(ast, false, found);
  return found
    .filter(({ value, raw }) => !ALLOWED_VALUES.has(value) && !isRomAddress(value, raw))
    .map((entry) => ({ ...entry, line: lineOf(entry.start) }))
    .filter(({ line }) => isSelected(line, onlyLines))
    .filter(({ line }) => !MAGIC_EXCEPTION_MARKER.test(sourceLines[line - 1]))
    .map(({ value, raw, line }) => ({
      line,
      text: `${raw ?? String(value)}  in: ${snippet(sourceLines[line - 1])}`,
    }));
}

// --- Language ------------------------------------------------------------------------

function looksGerman(text) {
  if (GERMAN_LETTER.test(text)) return true;
  const words = new Set(text.toLowerCase().match(/[a-z]+/g) ?? []);
  let hits = 0;
  for (const word of words) if (GERMAN_WORDS.has(word)) hits++;
  return hits >= GERMAN_WORD_THRESHOLD;
}

// Text lines to check: comment lines of code files, prose lines of Markdown files.
function languageLines({ relative, sourceLines, ast, lineOf }) {
  if (CODE_FILE.test(relative)) {
    const lines = [];
    for (const comment of ast?.comments ?? []) {
      const first = lineOf(comment.start);
      comment.value.split('\n').forEach((text, offset) => {
        lines.push({ line: first + offset, text });
      });
    }
    return lines;
  }
  if (MARKDOWN_FILE.test(relative)) {
    const lines = [];
    let insideFence = false;
    sourceLines.forEach((text, index) => {
      if (CODE_FENCE.test(text)) insideFence = !insideFence;
      else if (!insideFence) {
        // Link targets and inline code may name files or identifiers, not prose.
        const prose = text.replace(INLINE_CODE, ' ').replace(/\]\([^)]*\)/g, ']');
        lines.push({ line: index + 1, text: prose });
      }
    });
    return lines;
  }
  return [];
}

function findGermanText(context) {
  if (LANGUAGE_EXEMPT_FILE.test(context.relative)) return [];
  const { sourceLines, onlyLines } = context;
  const reported = new Set();
  const findings = [];
  for (const { line, text } of languageLines(context)) {
    if (!isSelected(line, onlyLines) || reported.has(line)) continue;
    if (LANGUAGE_EXCEPTION_MARKER.test(sourceLines[line - 1]) || !looksGerman(text)) continue;
    reported.add(line);
    findings.push({ line, text: snippet(sourceLines[line - 1]) });
  }
  return findings;
}

// --- Markdown links ------------------------------------------------------------------

function findBrokenLinks({ file, relative, sourceLines, onlyLines }) {
  if (!MARKDOWN_FILE.test(relative)) return [];
  const findings = [];
  let insideFence = false;
  sourceLines.forEach((text, index) => {
    if (CODE_FENCE.test(text)) {
      insideFence = !insideFence;
      return;
    }
    if (insideFence || !isSelected(index + 1, onlyLines)) return;
    for (const match of text.replace(INLINE_CODE, ' ').matchAll(MARKDOWN_LINK)) {
      const target = match[1] ?? match[2];
      if (URL_SCHEME.test(target) || target.startsWith('#')) continue;
      let targetPath = target.split('#')[0].split('?')[0];
      try {
        targetPath = decodeURIComponent(targetPath);
      } catch {
        // Keep the raw spelling when it is not valid percent encoding.
      }
      const resolved = targetPath.startsWith('/')
        ? path.join(ROOT, targetPath)
        : path.resolve(path.dirname(file), targetPath);
      if (!existsSync(resolved)) findings.push({ line: index + 1, text: target });
    }
  });
  return findings;
}

// --- Driver --------------------------------------------------------------------------

// One ESLint instance per hook run, with the project configuration.
let eslintInstance;
async function eslint() {
  if (eslintInstance === undefined) {
    const { ESLint } = await import('eslint');
    eslintInstance = new ESLint({ cwd: ROOT });
  }
  return eslintInstance;
}
const eslintKey = (message) => `${message.ruleId}|${message.message}`;
async function eslintMessages(linter, source, file) {
  const [result] = await linter.lintText(source, { filePath: file });
  return result?.messages ?? [];
}
// Findings of the edited text, with the HEAD findings for the comparison in findLintIssues.
async function lintContext(file, relative, source, onlyLines) {
  if (!ESLINT_FILE.test(relative)) return null;
  const linter = await eslint();
  if (await linter.isPathIgnored(file)) return null;
  const messages = await eslintMessages(linter, source, file);
  const head = onlyLines ? headSource(relative) : null;
  const headKeys = new Map();
  if (head !== null && messages.length > 0)
    for (const message of await eslintMessages(linter, head, file))
      headKeys.set(eslintKey(message), (headKeys.get(eslintKey(message)) ?? 0) + 1);
  return { messages, headKeys };
}
// A finding counts on a changed line, when it is fatal, or when HEAD has fewer of its kind.
function findLintIssues({ lint, onlyLines }) {
  if (!lint) return [];
  const remaining = new Map(lint.headKeys);
  const findings = [];
  for (const message of lint.messages) {
    const key = eslintKey(message);
    const known = remaining.get(key) ?? 0;
    if (known > 0) remaining.set(key, known - 1);
    if (message.fatal || isSelected(message.line, onlyLines) || known === 0)
      findings.push({
        line: message.line,
        text: `${message.ruleId ?? 'parse'}  ${snippet(message.message)}`,
      });
  }
  return findings;
}

const CHECKS = [
  {
    title: 'Project status text length',
    find: ({ relative, source }) =>
      relative === 'docs/PROJECT-STATUS.json' ? projectStatusTextFindings(source) : [],
    instruction: [
      'Shorten each named current-work text to the status CLI limit. Keep details in',
      'HANDOFF.md or the relevant source document; do not discard them by automatic truncation.',
    ],
  },
  {
    title: 'Magic numbers',
    find: findMagicNumbers,
    instruction: [
      'Replace each with a descriptive UPPER_SNAKE_CASE constant (module-level `const`, or',
      'reuse an existing one from a shared constants module; record the ROM or manual source',
      'in a comment where it applies). Only for a genuinely self-explanatory value add',
      '`// magic-number-ok: <reason>` on that line.',
    ],
  },
  {
    title: 'German text',
    find: findGermanText,
    instruction: [
      'Comments, documentation and filenames are written in English (AGENTS.md). Translate',
      'these lines; for a deliberately quoted German original add `language-ok` on the line.',
    ],
  },
  {
    title: 'Broken Markdown links',
    find: findBrokenLinks,
    instruction: [
      'Point each link at an existing file (paths are relative to the Markdown file), or',
      'remove it. After a rename, also update the incoming links in other files.',
    ],
  },
  {
    title: 'ESLint',
    find: findLintIssues,
    instruction: [
      'Fix each finding (eslint.config.mjs, recommended rules): remove unused names and',
      'useless assignments rather than disabling the rule; `npx eslint <file>` lists all.',
    ],
  },
];

async function checkFile(file, onlyLines) {
  const relative = toRelative(file);
  const source = readFileSync(file, 'utf8');
  const context = {
    file,
    relative,
    source,
    sourceLines: source.split('\n'),
    ast: CODE_FILE.test(relative) ? await parseModule(source) : null,
    lineOf: lineIndex(source),
    onlyLines,
    lint: await lintContext(file, relative, source, onlyLines).catch((error) => {
      process.stderr.write(`ESLint could not check ${relative}: ${error.message}\n`);
      return null;
    }),
  };
  const reports = [];
  for (const check of CHECKS) {
    const findings = check.find(context);
    if (findings.length === 0) continue;
    const shown = findings.slice(0, MAX_REPORTED_FINDINGS);
    const lines = shown.map((f) => `  ${relative}:${f.line}  ${f.text}`);
    if (findings.length > shown.length) {
      lines.push(`  ... and ${findings.length - shown.length} more`);
    }
    reports.push({ check, count: findings.length, text: [`${check.title}:`, ...lines] });
  }
  return reports;
}

function formatReports(reports) {
  const usedChecks = new Set(reports.map(({ check }) => check));
  return [
    ...reports.flatMap(({ text }) => text),
    ...CHECKS.filter((check) => usedChecks.has(check)).flatMap(({ title, instruction }) => [
      `${title}: ${instruction[0]}`,
      ...instruction.slice(1),
    ]),
  ].join('\n');
}

// Files named by an apply_patch text, resolved against the session directory.
function patchedFiles(patch, cwd) {
  const files = [];
  const lines = patch.split(/\r?\n/);
  lines.forEach((line, index) => {
    // An update followed by "*** Move to:" only leaves the moved file behind.
    if (PATCH_UPDATE_HEADER.test(line) && lines[index + 1]?.startsWith(PATCH_MOVE_HEADER)) return;
    const target = PATCH_TARGET_HEADER.exec(line);
    if (target) files.push(path.resolve(cwd, target[1].trim()));
  });
  return [...new Set(files)];
}

function editedFiles(payload, codex) {
  const input = payload.tool_input ?? {};
  if (!codex) {
    const file = input.file_path ?? payload.tool_response?.filePath;
    return file ? [file] : [];
  }
  const patch = typeof input === 'string' ? input : (input.command ?? input.input ?? '');
  return patchedFiles(String(patch), payload.cwd ?? process.cwd());
}

async function runHook(codex) {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const payload = JSON.parse(input || '{}');
  const reports = [];
  for (const file of editedFiles(payload, codex)) {
    // Files outside the repository (scratch files, settings elsewhere) are not ours.
    if (!existsSync(file) || toRelative(file).startsWith('../')) continue;
    try {
      await formatWithPrettier(file);
    } catch (error) {
      process.stderr.write(`Prettier could not format ${file}: ${error.message}\n`);
    }
    reports.push(...(await checkFile(file, changedLines(toRelative(file)))));
  }
  if (reports.length === 0) return;
  const message = formatReports(reports);
  if (codex) {
    process.stdout.write(JSON.stringify({ decision: 'block', reason: message }) + '\n');
  } else {
    process.stderr.write(message + '\n');
    process.exitCode = EXIT_FEEDBACK_TO_MODEL;
  }
}

async function runScan(files) {
  const totals = new Map();
  for (const file of files) {
    for (const report of await checkFile(file, null)) {
      console.log(report.text.join('\n'));
      totals.set(report.check.title, (totals.get(report.check.title) ?? 0) + report.count);
    }
  }
  const summary = CHECKS.map(({ title }) => `${title}: ${totals.get(title) ?? 0}`).join(', ');
  console.error(`${files.length} files checked. ${summary}`);
}

// Imported by its regression test; the hook and the scan run only as a script.
export { findLintIssues };
// Windows paths may differ in the case of the drive letter.
const samePath = (a, b) =>
  process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
if (samePath(path.resolve(process.argv[1] ?? ''), fileURLToPath(import.meta.url))) {
  const [mode, ...modeArguments] = process.argv.slice(2);
  if (mode === '--scan') await runScan(modeArguments);
  else await runHook(process.argv.includes('--codex'));
}
