import fs from 'fs';
import path from 'path';
import { globbySync } from 'globby';
import {
  CliOptions,
  PatternWithRegex,
  SearchResult,
  ContextBlock,
  MatchLocation,
} from './types';

/**
 * Compile patterns into RegExp objects; auto-escape if invalid regex.
 * [heuristic] Invalid patterns fall back to literal string match.
 */
export function compilePatterns(
  patterns: string[],
  options: CliOptions
): PatternWithRegex[] {
  const regexOpts = options.caseSensitive ? '' : 'i';

  return patterns.map((original, index) => {
    let pattern = original;

    // Auto-escape if fixed string mode
    if (options.fixedString) {
      pattern = escapeRegex(pattern);
    } else {
      // Try to compile; fall back to literal if invalid
      try {
        new RegExp(pattern, regexOpts);
      } catch {
        pattern = escapeRegex(pattern);
      }
    }

    return {
      original,
      regex: new RegExp(pattern, regexOpts),
      index,
    };
  });
}

/**
 * Escape regex metacharacters for literal string matching.
 * [derived] Standard regex escape.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolve file paths from glob patterns and filters.
 * [heuristic] Globby handles most patterns; manual filtering for include/exclude.
 */
export function resolveFiles(
  paths: string[],
  options: CliOptions
): string[] {
  if (paths.length === 0) {
    paths = ['.'];
  }

  const globPatterns = paths.flatMap((p) => {
    const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
    // If directory, append glob pattern
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      return options.recursive ? `${abs}/**/*` : `${abs}/*`;
    }
    return abs;
  });

  let files: string[];
  try {
    files = globbySync(globPatterns, {
      onlyFiles: true,
      absolute: true,
      gitignore: false,
      suppressErrors: true,
    });
  } catch {
    return [];
  }

  // Apply include/exclude filters
  if (options.includeGlob !== '*') {
    files = files.filter((f) => f.includes(options.includeGlob));
  }
  if (options.excludeGlob) {
    files = files.filter((f) => !f.includes(options.excludeGlob));
  }

  return [...new Set(files)]; // Deduplicate
}

/**
 * Search a single file for all pattern matches and build context blocks.
 * [failure-mode] File encoding issues caught; defaults to UTF-8.
 */
export function searchFile(
  file: string,
  patterns: PatternWithRegex[],
  options: CliOptions
): SearchResult | null {
  let lines: string[];
  try {
    const content = fs.readFileSync(file, 'utf-8');
    lines = content.split('\n');
  } catch {
    return null;
  }

  if (options.skipBlank) {
    lines = lines.filter((l) => l.trim().length > 0);
  }

  const matchLineIndices: number[] = [];

  // Find all matching lines
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of patterns) {
      if (pattern.regex.test(lines[i])) {
        matchLineIndices.push(i);
        break;
      }
    }
    if (options.maxPerFile > 0 && matchLineIndices.length >= options.maxPerFile) {
      break;
    }
  }

  if (matchLineIndices.length === 0) {
    return null;
  }

  // Build context blocks (merge adjacent windows)
  const blocks = buildContextBlocks(
    matchLineIndices,
    lines.length,
    options.contextBefore,
    options.contextAfter
  );

  const cwd = process.cwd();
  const relPath = path.relative(cwd, file);

  return {
    file,
    relPath,
    lines,
    blocks,
    matchCount: matchLineIndices.length,
  };
}

/**
 * Build context blocks from match line indices.
 * [derived] Window merging logic: adjacent/overlapping contexts combine.
 */
function buildContextBlocks(
  matchIndices: number[],
  totalLines: number,
  ctxBefore: number,
  ctxAfter: number
): ContextBlock[] {
  if (matchIndices.length === 0) return [];

  const blocks: ContextBlock[] = [];

  let wStart = Math.max(0, matchIndices[0] - ctxBefore);
  let wEnd = Math.min(totalLines - 1, matchIndices[0] + ctxAfter);
  const wSet = new Set<number>();
  wSet.add(matchIndices[0]);

  for (let i = 1; i < matchIndices.length; i++) {
    const ml = matchIndices[i];
    const nStart = Math.max(0, ml - ctxBefore);
    const nEnd = Math.min(totalLines - 1, ml + ctxAfter);

    if (nStart <= wEnd + 1) {
      // Overlap: merge
      if (nEnd > wEnd) wEnd = nEnd;
      wSet.add(ml);
    } else {
      // Gap: finalize block and start new one
      blocks.push({ start: wStart, end: wEnd, matchSet: new Set(wSet) });
      wStart = nStart;
      wEnd = nEnd;
      wSet.clear();
      wSet.add(ml);
    }
  }

  blocks.push({ start: wStart, end: wEnd, matchSet: new Set(wSet) });
  return blocks;
}

/**
 * Find all match locations within a line (for highlighting).
 * [derived] Merge overlapping matches; preserve earliest pattern index for color.
 */
export function findMatches(
  line: string,
  patterns: PatternWithRegex[]
): MatchLocation[] {
  const matches: MatchLocation[] = [];

  for (const pattern of patterns) {
    for (const m of line.matchAll(pattern.regex)) {
      matches.push({
        start: m.index ?? 0,
        end: (m.index ?? 0) + m[0].length,
        patternIndex: pattern.index,
      });
    }
  }

  if (matches.length === 0) return [];

  // Sort by start index
  matches.sort((a, b) => a.start - b.start);

  // Merge overlaps
  const merged: MatchLocation[] = [];
  let cur = matches[0];

  for (let i = 1; i < matches.length; i++) {
    const n = matches[i];
    if (n.start <= cur.end) {
      if (n.end > cur.end) cur.end = n.end;
      if (n.patternIndex < cur.patternIndex) cur.patternIndex = n.patternIndex;
    } else {
      merged.push({ ...cur });
      cur = n;
    }
  }
  merged.push(cur);

  return merged;
}
