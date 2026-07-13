/**
 * Shared types for query-cli
 */

export interface CliOptions {
  pattern: string[];
  paths: string[];
  recursive: boolean;
  caseSensitive: boolean;
  fixedString: boolean;
  contextBefore: number;
  contextAfter: number;
  includeGlob: string;
  excludeGlob: string;
  skipBlank: boolean;
  listFiles: boolean;
  maxPerFile: number;
  noColor: boolean;
  noLineNumbers: boolean;
  noMatchMarker: boolean;
  clipboard: boolean;
  trace: boolean;
}

export interface MatchLocation {
  start: number;
  end: number;
  patternIndex: number;
}

export interface ContextBlock {
  start: number;
  end: number;
  matchSet: Set<number>;
}

export interface SearchResult {
  file: string;
  relPath: string;
  lines: string[];
  blocks: ContextBlock[];
  matchCount: number;
}

export interface PatternWithRegex {
  original: string;
  regex: RegExp;
  index: number;
}
