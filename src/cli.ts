import { Command as CommanderCommand } from 'commander';
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
    .argument('[pattern]', 'Search pattern(s) — regex by default')
    .argument('[paths...]', 'Files, directories, or glob patterns')
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
    .option('--no-color', 'Disable color output')
    .option('--no-line-numbers', 'Hide line numbers')
    .option('--no-match-marker', 'Hide match markers')
    .option('-c, --clipboard', 'Copy results to clipboard', false)
    .option('-t, --trace', 'Enable diagnostic trace', false);

  return cmd;
}

/**
 * Parse command-line arguments into CliOptions.
 * [derived] Commander.js now separates pattern (arg 0), paths (args 1+), and options automatically.
 */
export function parseArguments(argv: string[]): {
  options: CliOptions;
  patterns: string[];
  paths: string[];
} {
  const command = createCommand();
  const parsed = command.parse(argv, { from: 'user' });
  const opts = parsed.opts() as Record<string, unknown>;

  // Commander now correctly populates parsed.args with only positional args (pattern + paths)
  // pattern is args[0], paths are args[1+]
  const allArgs = parsed.args;
  const pattern = allArgs.length > 0 ? allArgs[0] : '';
  const paths = allArgs.length > 1 ? allArgs.slice(1) : [];

  const patterns = pattern ? [pattern] : [];

  // Handle symmetric context
  const symmetric = parseInt(String(opts.symmetric), 10);
  const ctxBefore = symmetric >= 0 ? symmetric : parseInt(String(opts.before), 10) || 0;
  const ctxAfter = symmetric >= 0 ? symmetric : parseInt(String(opts.after), 10) || 0;

  const options: CliOptions = {
    pattern: patterns,
    paths: paths.length > 0 ? paths : ['.'],
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
    trace: Boolean(opts.trace),
  };

  return { options, patterns, paths };
}
