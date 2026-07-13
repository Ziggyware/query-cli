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

/**
 * Render search results to console with colors and context.
 * [heuristic] Multiple patterns cycle through color palette.
 */
export function renderResults(
  results: SearchResult[],
  patterns: PatternWithRegex[],
  options: CliOptions
): string {
  const lines: string[] = [];

  if (options.listFiles) {
    // List-only mode: filenames only
    for (const result of results) {
      lines.push(chalk.cyan(result.relPath));
    }
  } else {
    // Full mode: results with context
    for (const result of results) {
      lines.push(chalk.cyan(`File: ${result.relPath}`));

      for (const block of result.blocks) {
        for (let li = block.start; li <= block.end; li++) {
          const lineNum = li + 1;
          const lineText = result.lines[li];
          const isMatch = block.matchSet.has(li);

          const lineNumStr = options.noLineNumbers
            ? ''
            : lineNum.toString().padStart(4);
          const marker =
            options.noMatchMarker || !isMatch ? ' ' : isMatch ? '+' : ' ';
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

/**
 * Colorize a line with pattern matches highlighted.
 * [derived] Merge overlapping matches; cycle pattern colors.
 */
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
    return prefix + chalk.gray(lineText);
  }

  let result = prefix;
  let pos = 0;

  for (const match of matches) {
    // Gray text before match
    if (match.start > pos) {
      result += chalk.gray(lineText.substring(pos, match.start));
    }

    // Colored match
    const colorFn = COLORS[match.patternIndex % COLORS.length];
    result += colorFn.bold(lineText.substring(match.start, match.end));

    pos = match.end;
  }

  // Gray text after last match
  if (pos < lineText.length) {
    result += chalk.gray(lineText.substring(pos));
  }

  return result;
}

/**
 * Render summary line.
 * [derived] Pluralization logic.
 */
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
  return `${totalMatches} ${mw} in ${filesMatched} ${fw}`;
}

/**
 * Render match legend (one pattern per line with color).
 * [heuristic] Shown once at top of results.
 */
export function renderLegend(patterns: PatternWithRegex[]): string {
  if (patterns.length === 0) return '';

  const lines = [chalk.white('Match Color Legend:')];
  for (const pattern of patterns) {
    const colorFn = COLORS[pattern.index % COLORS.length];
    lines.push(
      `  Pattern ${pattern.index}: ${colorFn(pattern.original)}`
    );
  }

  return lines.join('\n');
}

/**
 * Render help text.
 */
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

  MISC
    -t, --trace                 Diagnostic trace (verbose)
    -h, --help                  Show this message
    -V, --version               Show version

  EXAMPLES
    query "TODO" src/ -r -b 2 -a 2
    query "^public class" src/ -r --include "*.cs"
    query "error" logs/ -r -a 5 --include "*.log"
    query "throw" . -r -l --include "*.cs"
    query "SELECT" . -r -b 2 -a 2 --include "*.sql"
`;
}
