import { Command } from 'commander';
import { CliOptions } from './types';

/**
 * Build Commander.js command tree.
 * Maps PowerShell flags to modern CLI conventions.
 */
export function createCommand(): Command {
  const cmd = new Command();

  cmd
    .name('query')
    .description('Search file content with surrounding context lines')
    .version('1.0.0')
    .argument('[pattern...]', 'Search pattern(s) — regex by default')
    .option('-r, --recurse', 'Recurse into subdirectories', false)
    .option('-s, --sensitive', 'Case-sensitive match', false)
    .option('-x, --fixed', 'Literal string match (no regex)', false)
    .option('-l, --list', 'Print only matching filenames', false)
    .option('-k, --skip-blank', 'Skip blank lines', false)
    .option('-b, --before <n>', 'Lines of context before match', '0')
    .option('-a, --after <n>', 'Lines of context after match', '0')
    .option('-y, --symmetric <n>', 'Symmetric context (before & after)', '-1')
    .option('-m, --max <n>', 'Stop after n matches per file', '0')
    .option('-i, --include <glob>', 'Only files matching glob', '*')
    .option('-e, --exclude <glob>', 'Skip files matching glob', '')
    .option('--no-color', 'Disable color output', false)
    .option('--no-line-numbers', 'Hide line numbers', false)
    .option('--no-match-marker', 'Hide match markers', false)
    .option('-c, --clipboard', 'Copy results to clipboard', false)
    .option('-t, --trace', 'Enable diagnostic trace', false)
    .allowUnknownOption() // Allow path arguments
    .passThroughOptions();

  return cmd;
}

/**
 * Parse command-line arguments into CliOptions.
 * [heuristic] Positional args after first pattern are treated as paths.
 */
export function parseArguments(argv: string[]): {
  options: CliOptions;
  patterns: string[];
  paths: string[];
} {
  const cmd = createCommand();
  const parsed = cmd.parse(argv, { from: 'user' });
  const opts = parsed.opts();

  // Extract patterns from positional args
  const patterns: string[] = parsed.args.filter(
    (arg, i) => i === 0 || !arg.startsWith('-')
  );

  // Extract paths (args after patterns)
  const paths: string[] = parsed.args.slice(patterns.length);

  // Handle symmetric context
  const symmetric = parseInt(opts.symmetric, 10);
  const ctxBefore = symmetric >= 0 ? symmetric : parseInt(opts.before, 10) || 0;
  const ctxAfter = symmetric >= 0 ? symmetric : parseInt(opts.after, 10) || 0;

  const options: CliOptions = {
    pattern: patterns,
    paths: paths.length > 0 ? paths : ['.'],
    recursive: opts.recurse,
    caseSensitive: opts.sensitive,
    fixedString: opts.fixed,
    contextBefore: ctxBefore,
    contextAfter: ctxAfter,
    includeGlob: opts.include,
    excludeGlob: opts.exclude,
    skipBlank: opts.skipBlank,
    listFiles: opts.list,
    maxPerFile: parseInt(opts.max, 10) || 0,
    noColor: !opts.color,
    noLineNumbers: !opts.lineNumbers,
    noMatchMarker: !opts.matchMarker,
    clipboard: opts.clipboard,
    trace: opts.trace,
  };

  return { options, patterns, paths };
}
