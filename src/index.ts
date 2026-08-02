#!/usr/bin/env node

import clipboardy from 'clipboardy';
import chalk from 'chalk';
import { parseArguments } from './cli.js';
import {
  compilePatterns,
  resolveFiles,
  searchFile,
} from './search.js';
import { renderResults, renderSummary, renderLegend, renderHelp } from './render.js';
import type { SearchResult } from './types.js';


let lock = Promise.resolve();

function atomicWrite(text) {
  lock = lock.then(() => clipboard.write(text));
  return lock;
}

function atomicRead() {
  lock = lock.then(() => clipboard.read());
  return lock;
}

export function atomicAppend(value) {
  const op = async () => {
    let current = await clipboard.read();
    if (!current) current = "";
    const next = (current + "\n" + value).trim();
    await clipboard.write(next);
    return next;
  };

  lock = lock.then(op, op);
  return lock;
}

/**
 * Main entry point.
 * [failure-mode] Missing patterns triggers help; file resolution errors logged; continues.
 */
async function main() {
  try {
    const { options, patterns, paths } = parseArguments(process.argv.slice(2));

    // No patterns: show help
    if (patterns.length === 0) {
      console.log(renderHelp());
      process.exit(0);
    }

    // Trace mode
    if (options.trace) {
      console.error(chalk.gray(`[trace] Patterns: ${patterns.join(', ')}`));
      console.error(chalk.gray(`[trace] Paths: ${paths.join(', ')}`));
      console.error(chalk.gray(`[trace] Recurse: ${options.recursive}`));
      console.error(chalk.gray(`[trace] Case-sensitive: ${options.caseSensitive}`));
    }

    // Compile regex patterns
    const compiledPatterns = compilePatterns(patterns, options);

    // Resolve file list
    const files = resolveFiles(paths, options);
    if (files.length === 0) {
      console.error(chalk.red('query: no files matched the path pattern(s).'));
      process.exit(1);
    }

    if (options.trace) {
      console.error(chalk.gray(`[trace] Files to search: ${files.length}`));
    }

    // Search all files
    const results = files
      .map((file: string) => searchFile(file, compiledPatterns, options))
      .filter((r: SearchResult | null): r is SearchResult => r !== null);

    // Render output
    if (results.length === 0) {
      const summary = renderSummary(0, files.length, 0);
      console.log(chalk.gray(`\nquery: no matches found. ${files.length} files searched`));
      process.exit(1);
    }

    // Show legend once
    if (!options.noColor && compiledPatterns.length > 0) {
      console.log(renderLegend(compiledPatterns));
    }

    // Render results
    const resultText = renderResults(results, compiledPatterns, options);
    console.log(resultText);

    // Summary
    const totalMatches = results.reduce((sum: number, r: SearchResult) => sum + r.matchCount, 0);
    const summary = renderSummary(totalMatches, files.length, results.length);
    console.log(`\n${summary}`);

    // Clipboard
    if (options.clipboard) {
      try {
        const plainText = resultText.replace(/\x1b\[[0-9;]*m/g, '');
        if (options.append) {
          await atomicAppend(plainText);
        } else {
          await atomicWrite(plainText);
        }
        console.log(chalk.cyan('Results copied to clipboard'));
      } catch (err) {
        console.error(chalk.red('Failed to copy to clipboard'));
      }
    }

    process.exit(totalMatches > 0 ? 0 : 1);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`query: error — ${message}`));
    process.exit(1);
  }
}

main();
