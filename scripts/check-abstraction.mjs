#!/usr/bin/env node
/**
 * Fails a commit that names a specific audio source or the external worker.
 *
 * This repository describes its music backend only as an abstracted "music worker"
 * (see docs/music-backend.md). That was a rule people were expected to apply by
 * reading, and it did not hold: a sentence naming a source shipped in the first
 * commit and stayed public for eight days before anyone noticed. This makes the
 * rule mechanical.
 *
 * WHY the word list is base64 rather than plain text: a denylist written out in the
 * open is itself the disclosure it exists to prevent — it would state, in a public
 * repository, exactly which names are being kept out. Encoding is not a secret (any
 * reader can decode it); it stops the list from being a greppable, indexable,
 * archivable assertion, which is the form the original leak took.
 *
 * Usage:
 *   node scripts/check-abstraction.mjs            # staged files (pre-commit)
 *   node scripts/check-abstraction.mjs --message <file>   # commit message
 *   node scripts/check-abstraction.mjs --range <base>..<head>   # a push or PR range
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const TERMS = Buffer.from(
  'cGlwaXQtbXVzaWMKeW91dHViZQp5b3V0dWJlaQppbm5lcnR1YmUKZ29vZ2xldmlkZW8KeXQtZGxwCnl0ZGwKaW52aWRpb3VzCnNhYnIKcG90b2tlbgpwb190b2tlbgpwby10b2tlbgpzb3VuZGNsb3VkCnNwb3RpZnk=',
  'base64',
)
  .toString('utf8')
  .split('\n')
  .filter(Boolean);

// Vendored or generated files the project does not author. The Yarn release bundle
// matches by coincidence (compiled base64 payload) and the lockfile only reflects a
// dependency's own transitive graph — rewriting either would break the toolchain.
const IGNORED = [/^\.yarn\//, /^yarn\.lock$/, /^node_modules\//, /^dist\//];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function hits(text) {
  const lower = text.toLowerCase();
  return TERMS.filter((term) => lower.includes(term));
}

function reportLines(label, text, found) {
  const lines = text.split('\n');
  const shown = [];
  for (const [index, line] of lines.entries()) {
    if (hits(line).length > 0) {
      shown.push(`  ${label}:${index + 1}  ${line.trim().slice(0, 120)}`);
    }
  }

  return shown.length > 0 ? shown : [`  ${label}  (matched: ${found.join(', ')})`];
}

function checkPaths(paths, read) {
  const problems = [];
  for (const path of paths) {
    if (IGNORED.some((pattern) => pattern.test(path))) {
      continue;
    }

    let text;
    try {
      text = read(path);
    } catch {
      continue; // deleted, or not a blob we can read
    }

    const found = hits(text);
    if (found.length > 0) {
      problems.push(...reportLines(path, text, found));
    }
  }

  return problems;
}

function checkStaged() {
  const paths = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
    .split('\n')
    .filter(Boolean);

  return checkPaths(paths, (path) => git(['show', `:${path}`]));
}

function checkRange(range) {
  const paths = git(['diff', '--name-only', '--diff-filter=ACMR', range])
    .split('\n')
    .filter(Boolean);
  const head = range.split('..').pop() || 'HEAD';
  const problems = checkPaths(paths, (path) => git(['show', `${head}:${path}`]));

  // Messages travel with the commits and are just as public as the tree — the leak
  // this guard exists for was in two commit bodies as well as in a document.
  const log = git(['log', '--format=%H%n%B%n', range]);
  if (hits(log).length > 0) {
    for (const line of log.split('\n')) {
      if (hits(line).length > 0) {
        problems.push(`  commit message  ${line.trim().slice(0, 120)}`);
      }
    }
  }

  return problems;
}

function checkMessage(file) {
  const text = readFileSync(file, 'utf8');
  const found = hits(text);
  return found.length > 0 ? reportLines('commit message', text, found) : [];
}

const [mode, argument] = process.argv.slice(2);
let problems;
if (mode === '--message') {
  problems = checkMessage(argument);
} else if (mode === '--range') {
  problems = checkRange(argument);
} else {
  problems = checkStaged();
}

if (problems.length > 0) {
  process.stderr.write(
    `${[
      '',
      'Source abstraction check failed.',
      '',
      'This repository must describe its music backend only as an external',
      '"music worker" — never a specific source, and never the worker by name.',
      'See docs/music-backend.md.',
      '',
      ...problems,
      '',
    ].join('\n')}\n`,
  );
  process.exit(1);
}
