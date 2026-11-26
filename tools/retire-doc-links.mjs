// Turn Markdown links to repository files that no longer exist into plain code text
// marked "(removed)", so documentation keeps naming a retired module without a dead
// link. Usage: node tools/retire-doc-links.mjs [--check] [files...] (default: every
// tracked .md file). --check only lists the dead links and exits 1 when there are any.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LINK = /\[([^\]\n]+)\]\(([^)\s#]+\.(?:mjs|js|json|md|lua|html))(#[^)\s]*)?\)/g;

// The text with dead links retired, and the dead targets found.
export function retireDeadLinks(text, file, root = process.cwd()) {
  const dead = [];
  const out = text.replace(LINK, (all, label, target) => {
    if (/^[a-z]+:/i.test(target)) return all;
    const path = resolve(dirname(resolve(root, file)), target);
    if (existsSync(path)) return all;
    dead.push(relative(root, path).replaceAll('\\', '/'));
    const name = label.startsWith('`') ? label : `\`${label}\``;
    return `${name} (removed)`;
  });
  return { text: out, dead };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2),
    check = args.includes('--check'),
    files = args.filter((a) => a !== '--check');
  const targets = files.length
    ? files
    : execFileSync('git', ['ls-files', '*.md']).toString().trim().split('\n');
  let total = 0;
  for (const file of targets) {
    const text = readFileSync(file, 'utf8'),
      result = retireDeadLinks(text, file);
    if (!result.dead.length) continue;
    total += result.dead.length;
    console.log(`${file}: ${result.dead.length} dead link(s)`);
    if (!check) writeFileSync(file, result.text);
  }
  if (check && total) process.exitCode = 1;
}
