// origin -> single-pattern positional parse -> multi-pattern heuristic split (rev 1)
﻿import { Command as CommanderCommand } from 'commander';
import fs from 'fs';
import path from 'path';
import { CliOptions } from './types.js';

/**
 * Build Commander.js command tree.
 * Maps PowerShell flags to modern CLI conventions.
 */
export function createCommand(): CommanderCommand {
  const cmd = new CommanderCommand();

  cmd
    .name('query')
    .description('Search file content with surrounding context lines')
    .version('1.0.0')
    .argument('[args...]', 'Search pattern(s), then file/directory paths — e.g. "public private *.cs"')
    .option('-r, --recurse', 'Recurse into subdirectories', false)
    .option('-s, --sensitive', 'Case-sensitive match', false)
    .option('-x, --fixed', 'Literal string match (no regex)', false)
    .option('-l, --list', 'Print only matching filenames', false)
    .option('-k, --skip-blank', 'Skip blank lines', false)
    .option('-b, --before <n>', 'Lines of context before match', '0')
    .option('-f, --after <n>', 'Lines of context after match', '0')
    .option('-y, --symmetric <n>', 'Symmetric context (before & after)', '-1')
    .option('-m, --max <n>', 'Stop after n matches per file', '0')
    .option('-i, --include <glob>', 'Only files matching glob', '*')
    .option('-e, --exclude <glob>', 'Skip files matching glob', '')
    .option('--no-color', 'Disable color output')
    .option('--no-line-numbers', 'Hide line numbers')
    .option('--no-match-marker', 'Hide match markers')
    .option('-c, --clipboard', 'Copy results to clipboard', false)
    .option('-a, --append', 'Append to clipboard', false)
    .option('-t, --trace', 'Enable diagnostic trace', false)
    .option('--animate', 'Enable scan animation', false);

  return cmd;
}

/**
 * [heuristic] Determines whether a positional arg is a path/glob rather than
 * a search pattern: contains a path separator, a glob metacharacter, is
 * "." / "..", or resolves to an existing filesystem entry relative to cwd.
 * Failure mode: a pattern string that collides with an existing file/dir
 * name in cwd is misclassified as a path.
 */
function isPathLike(arg: string): boolean {
  if (arg.includes('/') || arg.includes('\\')) return true;
  if (/[*?[\]{}]/.test(arg)) return true;
  if (arg === '.' || arg === '..') return true;
  try {
    const abs = path.isAbsolute(arg) ? arg : path.resolve(process.cwd(), arg);
    if (fs.existsSync(abs)) return true;
  } catch {
    // unreadable path segment — not path-like by this check
  }
  return false;
}

/**
 * Splits the flat positional-arg list into (patterns, paths).
 * [derived] First path-like arg marks the boundary; everything before it
 * is a pattern. A lone positional arg is always treated as a pattern
 * (never a bare path with zero patterns) since a search requires ≥1 pattern.
 */
function splitPatternsAndPaths(allArgs: string[]): { patterns: string[]; paths: string[] } {
  if (allArgs.length === 0) return { patterns: [], paths: [] };

  let splitIndex = allArgs.findIndex(isPathLike);

  if (splitIndex === -1) {
    splitIndex = allArgs.length; // no path-like arg: everything is a pattern, default path '.'
  } else if (splitIndex === 0) {
    splitIndex = allArgs.length > 1 ? 1 : allArgs.length; // first arg forced to pattern role
  }

  return {
    patterns: allArgs.slice(0, splitIndex),
    paths: allArgs.slice(splitIndex),
  };
}

/**
 * Parse command-line arguments into CliOptions.
 * [derived] Commander's `.args` returns the flat list of raw positional
 * strings regardless of variadic grouping in the argument() definition;
 * pattern/path separation is done manually via splitPatternsAndPaths.
 */
export function parseArguments(argv: string[]): {
  options: CliOptions;
  patterns: string[];
  paths: string[];
} {
  const command = createCommand();
  const parsed = command.parse(argv, { from: 'user' });
  const opts = parsed.opts() as Record<string, unknown>;

  const allArgs = parsed.args;
  const { patterns, paths: rawPaths } = splitPatternsAndPaths(allArgs);
  const paths = rawPaths.length > 0 ? rawPaths : ['.'];

  // Handle symmetric context
  const symmetric = parseInt(String(opts.symmetric), 10);
  const ctxBefore = symmetric >= 0 ? symmetric : parseInt(String(opts.before), 10) || 0;
  const ctxAfter = symmetric >= 0 ? symmetric : parseInt(String(opts.after), 10) || 0;

  const options: CliOptions = {
    pattern: patterns,
    paths,
    recursive: Boolean(opts.recurse),
    caseSensitive: Boolean(opts.sensitive),
    fixedString: Boolean(opts.fixed),
    contextBefore: ctxBefore,
    contextAfter: ctxAfter,
    includeGlob: String(opts.include),
    excludeGlob: String(opts.exclude),
    skipBlank: Boolean(opts.skipBlank),
    listFiles: Boolean(opts.list),
    maxPerFile: parseInt(String(opts.max), 10) || 0,
    noColor: !opts.color,
    noLineNumbers: !opts.lineNumbers,
    noMatchMarker: !opts.matchMarker,
    clipboard: Boolean(opts.clipboard),
    append: Boolean(opts.append),
    trace: Boolean(opts.trace)
  };

  return { options, patterns, paths };
}
