import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { testTempDir } from './temp-dir.mjs';
import { projectStatusTextFindings, PROJECT_STATUS_TEXT_LIMIT } from './project-status-text.mjs';
import { verifyRelease } from './verify-release.mjs';

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
  const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
  assert.equal(summary.passed, false);
  assert.equal(summary.failed_step, 'project-status');
  assert.deepEqual(summary.steps, []);
  assert.deepEqual(summary.counts, {});
});
