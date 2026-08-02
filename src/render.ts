import chalk from 'chalk';
import { CliOptions, SearchResult, PatternWithRegex, MatchLocation } from './types.js';
import { findMatches } from './search.js';

const COLORS = [
  chalk.green,
  chalk.yellow,
  chalk.cyan,
  chalk.magenta,
  chalk.blue,
  chalk.red,
];

export function renderScanLine(fileName: string, animate: boolean): void {
  if (!animate) return; // || !process.stdout.isTTY) return;
  process.stdout.write(`\r${chalk.gray('Scanning')} ${chalk.dim(fileName)}...`);
}

export function clearScanLine(animate: boolean): void {
  if (!animate || !process.stdout.isTTY) return;
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
}

export async function animateMatchCount(count: number, animate: boolean): Promise<void> {
  if (!animate || !process.stdout.isTTY || count === 0) {
    if (count > 0) process.stdout.write(chalk.bold(String(count)));
    return;
  }
  const steps = Math.min(count, 12);
  for (let i = 1; i <= steps; i++) {
    const val = Math.round((i / steps) * count);
    process.stdout.write(`\r${chalk.bold(String(val))}`);
    await new Promise((r) => setTimeout(r, 18));
  }
  process.stdout.write(`\r${chalk.bold(String(count))}`);
}

export function renderResults(
  results: SearchResult[],
  patterns: PatternWithRegex[],
  options: CliOptions
): string {
  const lines: string[] = [];

  if (options.listFiles) {
    for (const result of results) {
      lines.push(chalk.cyan(result.relPath));
    }
  } else {
    for (const result of results) {
      lines.push(chalk.bold.cyan(`File: ${result.relPath}`));

      for (const block of result.blocks) {
        for (let li = block.start; li <= block.end; li++) {
          const lineNum = li + 1;
          const lineText = result.lines[li];
          const isMatch = block.matchSet.has(li);

          const lineNumStr = options.noLineNumbers
            ? ''
            : chalk.dim.gray(lineNum.toString().padStart(4));
          const marker = options.noMatchMarker
            ? ' '
            : isMatch
              ? chalk.bold('+')
              : ' ';
          const prefix = options.noLineNumbers
            ? ''
            : `${lineNumStr}${marker} `;

          if (isMatch) {
            lines.push(colorizeMatch(lineText, patterns, prefix, options));
          } else {
            lines.push(chalk.gray(`${prefix}${lineText}`));
          }
        }

      }
    }
  }

  return lines.join('\n');
}

function colorizeMatch(
  lineText: string,
  patterns: PatternWithRegex[],
  prefix: string,
  options: CliOptions
): string {
  if (options.noColor) {
    return prefix + lineText;
  }

  const matches = findMatches(lineText, patterns);

  if (matches.length === 0) {
    return prefix + chalk.white(lineText);
  }

  let result = prefix;
  let pos = 0;

  for (const match of matches) {
    if (match.start > pos) {
      result += chalk.gray(lineText.substring(pos, match.start));
    }

    const colorFn = COLORS[match.patternIndex % COLORS.length];
    result += colorFn.bold(lineText.substring(match.start, match.end));

    pos = match.end;
  }

  if (pos < lineText.length) {
    result += chalk.gray(lineText.substring(pos));
  }

  return result;
}

export function renderSummary(
  totalMatches: number,
  filesSearched: number,
  filesMatched: number
): string {
  if (totalMatches === 0) {
    return chalk.gray(
      `query: no matches found. ${filesSearched} files searched`
    );
  }

  const mw = totalMatches === 1 ? 'match' : 'matches';
  const fw = filesMatched === 1 ? 'file' : 'files';
  return `${chalk.bold(totalMatches)} ${mw} in ${chalk.bold(filesMatched)} ${fw}`;
}

export function renderLegend(patterns: PatternWithRegex[]): string {
  if (patterns.length === 0) return '';

  const lines = [chalk.white.bold('Match Color Legend:')];
  for (const pattern of patterns) {
    const colorFn = COLORS[pattern.index % COLORS.length];
    lines.push(
      `  Pattern ${pattern.index}: ${colorFn.bold(pattern.original)}`
    );
  }

  return lines.join('\n');
}

export function renderHelp(): string {
  return `
query — File Content Search with Context

  USAGE
    query [options] <pattern> [paths...]

  PATTERN
    Regex by default. Use --fixed for literal string.
    Quote patterns containing spaces or regex metacharacters.

  PATHS
    Files, directories, or glob patterns (*.cs, src/).
    Multiple paths accepted. Defaults to current directory.

  CONTEXT
    -y, --symmetric <n>         Symmetric context: n lines before and after
    -b, --before <n>            Lines of context before each match
    -a, --after <n>             Lines of context after each match
    Adjacent or overlapping windows are merged; -- separates gaps.

  SEARCH
    -r, --recurse               Recurse into subdirectories
    -s, --sensitive             Case-sensitive match
    -x, --fixed                 Literal string match (no regex)
    -l, --list                  Print only filenames with matches
    -m, --max <n>               Stop after n matches per file (0 = unlimited)
    -i, --include <glob>        Only examine files matching glob (default: *)
    -e, --exclude <glob>        Skip files matching glob

  OUTPUT
    --no-color                  Disable color output
    -c, --clipboard             Copy results to clipboard
    --no-line-numbers           Disable line numbers
    --no-match-marker           Disable match marker
    -k, --skip-blank            Skip blank lines
    --animate                   Enable scan animation and count-up (TTY only)

  MISC
    -t, --trace                 Diagnostic trace (verbose)
    -h, --help                  Show this message
    -V, --version                Show version

  EXAMPLES
    query "TODO" src/ -r -b 2 -a 2
    query "^public class" src/ -r --include "*.cs"
    query "error" logs/ -r -a 5 --include "*.log"
    query "throw" . -r -l --include "*.cs"
    query "SELECT" . -r -b 2 -a 2 --include "*.sql"
`;
}
