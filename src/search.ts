import fs from 'fs';
import path from 'path';
import { globbySync } from 'globby';
import {
  CliOptions,
  PatternWithRegex,
  SearchResult,
  ContextBlock,
  MatchLocation,
} from './types.js';

export function compilePatterns(
  patterns: string[],
  options: CliOptions
): PatternWithRegex[] {
  const regexOpts = options.caseSensitive ? 'g' : 'gi';

  return patterns.map((original, index) => {
    let pattern = original;

    if (options.fixedString) {
      pattern = escapeRegex(pattern);
    } else {
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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function resolveFiles(
  paths: string[],
  options: CliOptions
): string[] {
  if (paths.length === 0) {
    paths = ['.'];
  }

  const globPatterns = paths.flatMap((p) => {
    const hasGlobChars = /[*?[\]{}]/.test(p);

    if (hasGlobChars) {
      const base = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
      if (options.recursive) {
        const dir = path.dirname(base);
        const glob = path.basename(base);
        return `${dir}/**/${glob}`;
      }
      return base;
    }

    const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      return options.recursive ? `${abs}/**/*` : `${abs}/*`;
    }

    return abs;
  });

  const normalizedPatterns = globPatterns.map((p) =>
    p.replace(/\\/g, '/')
  );

  let files: string[];
  try {
    files = globbySync(normalizedPatterns, {
      onlyFiles: true,
      absolute: true,
      gitignore: false,
      suppressErrors: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    });
  } catch {
    return [];
  }

  if (options.includeGlob !== '*') {
    files = files.filter((f) => f.includes(options.includeGlob));
  }
  if (options.excludeGlob) {
    files = files.filter((f) => !f.includes(options.excludeGlob));
  }

  return [...new Set(files)];
}

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

  for (let i = 0; i < lines.length; i++) {
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
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

  const blocks = buildContextBlocks(
    matchLineIndices,
    lines.length,
    options.contextBefore,
    options.contextAfter
  );

  const cwd = process.cwd();
  const relPath = file.replace(cwd, '').replace(/^\\/, '');

  return {
    file,
    relPath,
    lines,
    blocks,
    matchCount: matchLineIndices.length,
  };
}

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
      if (nEnd > wEnd) wEnd = nEnd;
      wSet.add(ml);
    } else {
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

export function findMatches(
  line: string,
  patterns: PatternWithRegex[]
): MatchLocation[] {
  const matches: MatchLocation[] = [];

  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    for (const m of line.matchAll(pattern.regex)) {
      matches.push({
        start: m.index ?? 0,
        end: (m.index ?? 0) + m[0].length,
        patternIndex: pattern.index,
      });
    }
  }

  if (matches.length === 0) return [];

  matches.sort((a, b) => a.start - b.start);

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
