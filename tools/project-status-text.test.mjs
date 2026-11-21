import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { removeDirQuietly, testTempDir } from './temp-dir.mjs';
import { projectStatusTextFindings, PROJECT_STATUS_TEXT_LIMIT } from './project-status-text.mjs';
import { verifyRelease } from './verify-release.mjs';
import { execFileSync } from 'node:child_process';
import { checkProjectStatus } from './check-project-status.mjs';
import {
  PROJECT_STATUS_OUTPUT_LIMIT,
  serializeStatus,
  summarizeCurrentWork,
} from './project-status-text.mjs';
import { testBlock } from './test-block.mjs';

const findings = (work) => projectStatusTextFindings(JSON.stringify(work, null, 2));

test('Current-work text accepts exactly the CLI limit and reports the first excess character', () => {
  assert.deepEqual(findings({ focus: 'x'.repeat(PROJECT_STATUS_TEXT_LIMIT) }), []);
  const work = { focus: 'x'.repeat(PROJECT_STATUS_TEXT_LIMIT + 1) };
  const before = structuredClone(work);
  assert.deepEqual(findings(work), [
    { line: 2, text: 'focus: 401 characters; maximum 400. Shorten by 1.' },
  ]);
  assert.deepEqual(work, before);
});

test('Every shortened CLI field and every list entry receives a specific field path', () => {
  for (const field of ['focus', 'next_step', 'porting_resume'])
    assert.match(findings({ [field]: 'x'.repeat(450) })[0].text, new RegExp(`^${field}: 450`));
  for (const field of [
    'open_issues',
    'accepted_model_assumptions',
    'implementation_limits',
    'optional_quality_checks',
  ]) {
    const result = findings({ [field]: ['short', 'x'.repeat(401), 'x'.repeat(402)] });
    assert.equal(result.length, 2);
    assert.ok(result[0].text.startsWith(`${field}[1]: 401`));
    assert.ok(result[1].text.startsWith(`${field}[2]: 402`));
  }
  assert.deepEqual(findings({ references: ['x'.repeat(401)] }), []);
});

test('Length uses decoded JSON strings and the CLI string-length convention', () => {
  assert.deepEqual(findings({ focus: '\n'.repeat(400) }), []);
  assert.deepEqual(findings({ focus: '\u{1f600}'.repeat(200) }), []);
  assert.match(findings({ focus: '\u{1f600}'.repeat(201) })[0].text, /402 characters/);
  assert.match(projectStatusTextFindings('{')[0].text, /Invalid project status JSON/);
});

test('Complete output rejects exactly 5000 bytes even when every text fits', () => {
  const inventory = { supplied: 14, work_groups: 177 };
  const work = { open_issues: Array(10).fill('x'.repeat(390)), references: [''] };
  const base = Buffer.byteLength(serializeStatus(summarizeCurrentWork(work, inventory)));
  work.references[0] = 'x'.repeat(PROJECT_STATUS_OUTPUT_LIMIT - base - 1);
  assert.deepEqual(projectStatusTextFindings(JSON.stringify(work), inventory), []);
  work.references[0] += 'x';
  assert.match(
    projectStatusTextFindings(JSON.stringify(work), inventory)[0].text,
    /5000 UTF-8 bytes; maximum 4999.*at least 1 bytes/,
  );
  work.references[0] += 'é';
  assert.match(
    projectStatusTextFindings(JSON.stringify(work), inventory)[0].text,
    /5002 UTF-8 bytes/,
  );
});

test('Staged validation reads the index even when the working copy disagrees', async (t) => {
  const root = await testTempDir(t, 'snes-status-index-');
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  git('init', '--quiet');
  await mkdir(join(root, 'docs'));
  await writeFile(
    join(root, 'docs/PORTIERUNGSSTAND.json'),
    // Match the real archive's size, above Node's default subprocess buffer.
    JSON.stringify({ supplied: [], work_groups: [], note: 'x'.repeat(2 * 1024 * 1024) }),
  );
  const file = join(root, 'docs/PROJECT-STATUS.json');
  await writeFile(file, JSON.stringify({ focus: 'x'.repeat(401) }));
  git('add', 'docs');
  await writeFile(file, JSON.stringify({ focus: 'short' }));
  assert.deepEqual(checkProjectStatus(root), []);
  assert.match(checkProjectStatus(root, { staged: true })[0].text, /focus: 401/);
  git('add', 'docs');
  await writeFile(file, '{');
  assert.deepEqual(checkProjectStatus(root, { staged: true }), []);
  assert.match(checkProjectStatus(root)[0].text, /Invalid project status JSON/);
});

test('Aggregate overflow stops block and release checks before loading the test graph or generators', async (t) => {
  const root = await testTempDir(t, 'snes-status-aggregate-');
  await mkdir(join(root, 'docs'));
  await writeFile(
    join(root, 'docs/PROJECT-STATUS.json'),
    JSON.stringify({ open_issues: Array(15).fill('x'.repeat(390)) }),
  );
  assert.equal(await testBlock(root, []), 1);
  let summaryPath;
  await assert.rejects(verifyRelease(root), (error) => {
    summaryPath = error.message.split('\nSummary: ')[1];
    return /failed at project-status: status:next output:/.test(error.message);
  });
  t.after(() => removeDirQuietly(dirname(summaryPath)));
  const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
  assert.equal(summary.failed_step, 'project-status');
  assert.deepEqual(summary.steps, []);
});

test('Release rejects overlong status text before needing formatters, generators or tests', async (t) => {
  const root = await testTempDir(t, 'snes-status-preflight-');
  await mkdir(join(root, 'docs'));
  await writeFile(
    join(root, 'docs/PROJECT-STATUS.json'),
    JSON.stringify({ focus: 'x'.repeat(401) }),
  );
  let error;
  await assert.rejects(verifyRelease(root), (failure) => {
    error = failure;
    return /failed at project-status: focus: 401 characters/.test(failure.message);
  });
  const summaryPath = error.message.split('\nSummary: ')[1];
  // A failing release keeps its log directory; this deliberate failure removes it.
  t.after(() => removeDirQuietly(dirname(summaryPath)));
  const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
  assert.equal(summary.passed, false);
  assert.equal(summary.failed_step, 'project-status');
  assert.deepEqual(summary.steps, []);
  assert.deepEqual(summary.counts, {});
});
