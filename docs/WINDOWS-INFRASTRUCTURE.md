# Windows sandbox and artefact open errors, 2026-10-09

Translated from the former German `WINDOWS-INFRASTRUKTUR.md` (original wording
at git commit 20c7b6c9). The porting delivery `4f8c3c3` was finished and on
`origin/main`; Stefan then prioritised repairing the infrastructure.

## Sandbox: proven cause and repair

Even `Get-Location` failed before process start with `helper_unknown_error:
setup refresh had errors`. The daily log
`%USERPROFILE%\.codex\.sandbox\sandbox.2026-10-09.log` named
`C:\Coding\SNES_Shadowrun\.git`: `open deny ACL target for update`. The owner of
that folder was `DESKTOPSTEFAN\CodexSandboxOffline`, while the project and
`analysis` belonged to Stefan. After saving the old SDDL, only the owner of the
`.git` folder was reset to `DESKTOPSTEFAN\Stefan` with Windows UAC — no recursive
ACL reset, no permission widening, no sandbox configuration change. The next
normal run reported `applied deny ACE to protect ... .git` and `errors=[]`;
further shell starts, `git status`, `git diff --check` and `git lfs status`
work with an already fresh git index; the corrected owner persists. The
[official Windows sandbox documentation](https://learn.chatgpt.com/docs/windows/windows-sandbox)
names file system permissions as a possible cause of the old setup method; the
concrete cause here comes from local logs and ACLs. The later warning about
hiding `C:\Users\Default` does not block command execution and was no reason
for this repair.

## Open errors: reproduced separately, writes reduced

Release logs show changing files: `render-task-script-opcode-0f6-native.json`,
`...-042.json` and `...-1e4-native.json`, each at `fs.promises.writeFile`/`open`,
`UNKNOWN`, `errno=-4094`. After the sandbox repair the same error occurred again
in the seventh isolated source generator run at `...-04d.json`; a hash
comparison of all 1,878 Script52/continuation reports showed no changed
content, so the sandbox repair does not remove this error.

A controlled temporary Windows test produces the same Node error when a file
is open as a read-only memory mapping and another handle tries to truncate it
with `CREATE_ALWAYS`; the directly queried Windows error is 1224. Renaming the
locked file atomically instead also fails (`EPERM`), so that variant was not
adopted. libuv 1.51.0 uses [CREATE_ALWAYS](https://github.com/libuv/libuv/blob/v1.51.0/src/win/fs.c)
for normal truncating opens and its [error translation](https://github.com/libuv/libuv/blob/v1.51.0/src/win/error.c)
has no own case for `ERROR_USER_MAPPED_FILE`. The controlled case explains a
possible mechanism but proves no particular external reader of the real
project files: 11,268 direct native write attempts in the project hit no such
lock; Windows Defender was active without a matching block message; virus
scanner, git/editor watchers or indexers were not disabled.

`tools/task-script-opcode-artifacts.mjs` still recomputes and validates every
original source proof and native report. Only afterwards `writeArtifactIfChanged`
compares the final UTF-8 bytes with the existing file: byte-equal results are
not truncated again; missing or changed files are written; read errors other
than `ENOENT` and all write errors propagate. This removes the risky write to
unchanged reports without skipping source computation or the release double
hash. The narrow release retry stays for real Windows open errors on changed
render artefacts, with separate attempt logs and still two mandatory full
generator runs. No unknown external reader is claimed as identified; on a new
error at changed files, native file operations and readers at the time of the
error must be captured.

## Reproducible check

`pwsh -NoProfile -File tools/diagnose-windows-open.ps1` uses only a new
temporary file. It checks the real Windows error 1224, the Node error
`UNKNOWN/-4094`, keeping an identical locked file including its timestamp,
error propagation for changed locked bytes and successful writing after
release (a Windows infrastructure check, no SNES device or ROM proof).
`node --test tools/write-artifact.test.mjs tools/workflow.test.mjs` checks file
content and timestamp, shorter changed outputs, UTF-8 and line endings, error
propagation and the unchanged release/retry/double-hash limits.

After the change: eight source and eight native generator runs without retry or
error; all 1,878 contents and timestamps kept; the targeted check of Script52
sources, native paths, progress and write/release infrastructure passed
5,658/5,658 tests without skips. The first full follow-up check in the normal
sandbox passed both artefact runs, AC, 1,291 syntax modules and 10,465/10,465
tests but failed at the last step `git lfs status`: its
`git update-index -q --refresh` needs an index write for freshly written
artefacts. A deliberately changed timestamp of an unchanged report reproduced
exit 128 at the index refresh and exit 2 at LFS; after an authorised index
refresh outside the git write lock the same commands work again. This is the
effective protection limit of the managed session, not a setup failure again:
run the whole final delivery check with the already authorised git write
permission; no permanent loosening of `.git` and no change of managed rules.
The failed log `snes-release-SpdRuH/summary.json` stays marked as failed. The
following full delivery check passed: `snes-release-FEUYum/summary.json`, 535
generators in two runs, 2,824 identical artefacts, AC unchanged, 1,291 syntax
modules, 10,465/10,465 tests in 249 files without skip, diff and LFS passed, no
open-error retry; all render/analysis artefacts unchanged in content.
