# query-cli — Bug Fixes, Cleanup, and Feature Spec

**Status:** Specification only. No code changes have been made.
**Date:** 2026-10-04
**Repo:** `query-cli` (root of this repository, branch `main`)
**Audience:** An AI agent implementing this. Every requirement below is stated precisely enough to execute and verify without further clarification.

---

## 1. Overview

`query-cli` is a TypeScript/Node.js CLI (`query`) that replaces a legacy PowerShell `query` script. It performs content search across files with surrounding context lines, regex support, glob-based file filtering, colored output, and clipboard export.

### 1.1 Current state (verified, not assumed)

The following was verified by reading every file in `src/` and running `npx tsc --noEmit` on 2026-10-04.

**The build is currently broken.**

```
src/index.ts(11,40): error TS2305: Module '"./render.js"' has no exported member 'renderLegend'.
```

`src/index.ts:11` imports `renderLegend` from `./render.js`, and calls it at `src/index.ts:96`. `src/render.ts` does not export it. `dist/` contains stale build output from a prior commit, so a previously-built binary may still appear to work — do not treat `dist/` as evidence the source compiles.

Module layout:

| File | Role |
|------|------|
| `src/index.ts` | Entry point. Clipboard mutex helpers, orchestration, exit codes. |
| `src/cli.ts` | Commander.js command definition, positional-arg pattern/path heuristic. |
| `src/search.ts` | Regex compilation, file resolution via globby, per-file scanning, context-block building, match location merging. |
| `src/render.ts` | Color constants, output formatting, summary, help text. |
| `src/types.ts` | Shared interfaces: `CliOptions`, `MatchLocation`, `ContextBlock`, `SearchResult`, `PatternWithRegex`. |

Dependencies: `chalk@^5.3.0`, `clipboardy@^4.0.0`, `commander@^12.1.0`, `globby@^13.2.0`. Dev: `@types/node@^22.5.0`, `typescript@^5.5.4`. Node in the dev environment: v24.16.0. ESM (`"type": "module"`), `module`/`moduleResolution` both `NodeNext`, `strict: true`, `outDir: ./dist`, `rootDir: ./src`.

### 1.2 Goal

Fix all confirmed defects, remove dead code, and land two roadmap features (gitignore support, parallel search), with a rewritten README and a real test suite. Breaking CLI changes are explicitly accepted — see §3.2.

---

## 2. Out of Scope

The following were considered and explicitly excluded. Do **not** implement them.

- **JSON output mode** (`--json`). Not selected.
- **Custom color schemes**. Not selected; the fixed 6-color cycle stays.
- **Interactive TUI (Ink + React)**. Not selected.
- **Async/await conversion of the search loop.** Not selected. `searchFile` stays synchronous (`fs.readFileSync`). Rationale: the process is short-lived and exits promptly, so blocking the event loop has no practical cost here, and keeping it synchronous keeps the worker-pool change (§4.4) simpler.
- **Preserving multi-pattern positional invocation.** A breaking change is accepted (§3.2).

---

## 3. Defects to Fix

Each item lists the current behavior with a `file:line` citation, the required behavior, and how to verify it.

### 3.1 F1 — `renderLegend` is missing (build-breaking)

**Current:** `src/index.ts:11` imports `renderLegend`; `src/render.ts` does not export it. The build fails.

**Required:** Restore the export in `src/render.ts` with this signature:

```ts
export function renderLegend(patterns: PatternWithRegex[]): string
```

It renders one line mapping each pattern index to its highlight color, so the user can decode which color corresponds to which pattern in the output. Use the existing `COLORS` array (defined at `src/render.ts:5-12`, currently six entries: green, yellow, cyan, magenta, blue, red). For each pattern at `index i`, emit a swatch using `COLORS[i % COLORS.length]` applied to the pattern text, then the original pattern string. Join entries with two or more spaces. Return an empty string for an empty `patterns` array.

**Verification:** `npx tsc --noEmit` exits 0 with no output. Running `query "alpha" "beta" src/` prints exactly one legend line above the results.

### 3.2 F2 — Flag `-a` is documented as `--after` but implemented as `--append`

**Current:** `src/cli.ts:25` registers `-f, --after <n>`. `src/cli.ts:34` registers `-a, --append`. The README options table and the example block both show `-a, --after <n>`. `renderHelp` in `src/render.ts` is already correct — it shows `-f, --after <n>` at `src/render.ts:159` and `-a, --append` at `src/render.ts:174`. So the drift is confined to the README. The implementation is authoritative.

**Required:** The code is correct. Do **not** change the flag assignment. Correct the README only:
- `README.md:52` — the options-table row `| `-a, --after <n>` | | Context lines after match |` becomes `-f, --after <n>`.
- `README.md:55-56` — the table types `<glob>` for include/exclude; §7 changes these to `<glob...>`. Fold that in here or with F5.
- `README.md` examples using `-a 2` or `-a 5` as a context flag become `-f 2` / `-f 5`. These occur in the Examples block and in the Features prose.
- Ensure `-a, --append` appears in the README options table. The current table (`README.md:47-62`) omits it entirely.
- Leave `renderHelp` alone for this item — it is already right (`src/render.ts:159` shows `-f, --after`, `src/render.ts:174` shows `-a, --append`). It still needs updating for other flags per §9.

**Verification:** `grep -n -- '-a, --after' README.md` returns zero matches (`grep -n` needs the `--` guard here, or the leading `-a` is parsed as a flag). `query "x" src/ -a 5` appends to the clipboard; `query "x" src/ -f 5` prints 5 lines of trailing context.

### 3.3 F3 — Dead `--animate` feature: flag defined, never wired

**Current:** `src/cli.ts:36` registers `--animate`. Three functions exist to serve it — `renderScanLine` (`src/render.ts:14`), `clearScanLine` (`src/render.ts:19`), `animateMatchCount` (`src/render.ts:25`). None is called from `src/index.ts`, and `CliOptions` (`src/types.ts:5-24`) has no `animate` field, so the parsed value is discarded. `renderHelp` documents `--animate` at `src/render.ts:178`.

**Required:** Delete it entirely — the user selected removal, not completion.
- Delete the `--animate` option registration from `src/cli.ts:36`.
- Delete `renderScanLine`, `clearScanLine`, and `animateMatchCount` from `src/render.ts`.
- Delete the `--animate` line from `renderHelp` (`src/render.ts:178`).
- No README change is needed for this item: `grep -n 'animate' README.md` currently returns nothing. The flag is only documented in `renderHelp`.
- Ensure no dangling references remain; `render.ts` must not import or reference `setTimeout` afterwards.

**Verification:** `grep -rn "animate\|renderScanLine\|clearScanLine" src/` returns nothing. `tsc --noEmit` passes.

### 3.4 F4 — `renderScanLine` writes to a non-TTY

**Current:** `src/render.ts:15` reads `if (!animate) return; // || !process.stdout.isTTY) return;` — the TTY guard is commented out, so a scan line is written unconditionally. `clearScanLine` at `src/render.ts:19-20` does check `process.stdout.isTTY`.

**Required:** Delete per F3, which subsumes this item. If — contrary to this spec — any animation code survives, the `process.stdout.isTTY` guard must be restored inside `renderScanLine` before the write. Do not leave a commented-out condition in the source.

**Verification:** Covered by the F3 grep check.

### 3.5 F5 — `--include` / `--exclude` use substring matching, not glob matching

**Current:** `src/search.ts:89-94`:
```ts
if (options.includeGlob !== '*') {
  files = files.filter((f) => f.includes(options.includeGlob));
}
if (options.excludeGlob) {
  files = files.filter((f) => !f.includes(options.excludeGlob));
}
```
(the two filters are at lines 90 and 93.)
The README documents these as "File filter (glob)". Because `String.includes` is a literal substring test, `-i "*.cs"` matches **nothing** — no path contains a literal asterisk. Only bare substrings like `-i ".cs"` happen to work.

**Required:** Implement real glob matching.
- Add `picomatch` as a direct dependency. It is **already installed** in `node_modules` as a transitive dependency of `globby` → `fast-glob`, and importing it will resolve at runtime without any install step — but declare it explicitly in `package.json` dependencies, since a direct import that relies on a transitive dependency is fragile across version bumps. Do not use `micromatch` — `picomatch` is the lower-level single-pattern matcher and is sufficient here.
- Match against the path **relative to `process.cwd()`**, normalized to forward slashes. Matching the absolute path makes globs like `*.cs` fail on any path containing a separator.
- Use `picomatch(glob, { dot: true })`. `dot: true` is required so `-i ".*"` and dotfile-directory globs behave as users expect.
- `-i` defaults to `*`; when the glob is `*` (or absent) skip filtering entirely, preserving current fast-path behavior.
- `-e` applies after `-i`. When both are supplied, a file must match include and not match exclude.
- Accept multiple include and exclude globs. Change both options to repeatable/variadic (`<glob...>`) and have `resolveFiles` apply all of them. A file is kept if it matches **at least one** include glob and **no** exclude glob.

**Verification:**
- `query "public" src/ -r -i "*.ts"` returns matches; before the fix it returns "no files matched".
- `query "x" src/ -r -i "*.ts" -e "*.d.ts"` excludes declaration files.
- `query "x" src/ -r -i "*.ts" -i "*.js"` searches both.

### 3.6 F6 — `--skip-blank` corrupts line numbers

**Current:** `src/search.ts:112-114`:
```ts
if (options.skipBlank) {
  lines = lines.filter((l) => l.trim().length > 0);
}
```
Filtering happens **before** line indices are assigned. Every blank line is removed, so `render.ts:56`'s `const lineNum = li + 1` reports numbers that do not correspond to the real file, and context windows (`contextBefore` / `contextAfter`) are computed against the filtered array, so a match can be shown with the wrong neighbors.

**Required:** Filter at render time instead.
- Remove the filter from `searchFile`. `lines` must always be the true file content split on `\n`, so indices stay authoritative.
- In `render.ts` `renderResults`, skip output for a line when `options.skipBlank` is set and `result.lines[li].trim().length === 0`. Apply this to both match lines and context lines, uniformly — the two push sites are `src/render.ts:73` (match lines) and `src/render.ts:75` (context lines).
- Leave `blocks` and `matchSet` untouched — they continue to index into the unfiltered array.

**Verification:** Create a fixture file with a blank line before a known match. `query "needle" fixture.txt -f 1 -k` must print the correct original line number for the match and for its context line. Compare against the same file searched without `-k`.

### 3.7 F7 — `--max` caps match counting, not just display

**Current:** `src/search.ts:126-128`:
```ts
if (options.maxPerFile > 0 && matchLineIndices.length >= options.maxPerFile) {
  break;
}
```
The scan halts the moment the cap is reached. Consequences: (a) `matchCount` in the `SearchResult` (`src/search.ts:150`) is the capped number, not the file's true total, so the summary line under-reports; (b) `buildContextBlocks` (`src/search.ts:135`, defined at `src/search.ts:154`) only ever sees the first `n` matches, so trailing matches in a dense file are never reported at all.

**Required:** Cap output only.
- Delete the early `break` from the scan loop in `searchFile`.
- Let the scan complete so `matchLineIndices` holds every matching line.
- Set `matchCount` to the **full** count (`matchLineIndices.length`) so the summary reports true totals.
- Truncate for display in `renderResults`: for each result, emit at most the first `options.maxPerFile` blocks, and within a block emit at most the first `maxPerFile` lines flagged in `matchSet`. Blocks beyond the cap are not rendered.
- `--max 0` means unlimited (current default), so the truncation logic must no-op for `0`.

**Verification:** Fixture with 10 matches on one line-region. `query "needle" fixture.txt -m 2` prints 2 highlighted lines and a summary reporting 10 matches, not 2. Without `-m`, all 10 print and the summary still reports 10.

### 3.8 F8 — `--` gap separator is documented but never emitted

**Current:** README says "Context blocks: Merges adjacent windows; `--` separates gaps". `renderHelp` repeats it at `src/render.ts:160`. `renderResults` (`src/render.ts:39-84`) iterates blocks — the `for (const block of result.blocks)` loop at `src/render.ts:54` has no separator between iterations.

**Required:** Emit the separator.
- In `renderResults`, when rendering multiple blocks for one file, insert a separator line between consecutive blocks. It must render as `--` and use `chalk.gray`, consistent with the rest of the non-match styling.
- Do not emit a separator before the first block or after the last.
- Do not emit one in `--list` mode (that mode prints only filenames).
- Do not emit one for a file with exactly one block.

**Verification:** Fixture where two matches are more than `2 * contextAfter + 1` lines apart. `query "needle" fixture.txt -f 1` output contains a `--` line between the two blocks; a single-block search contains none.

### 3.9 F9 — Binary files are read and rendered as garbage

**Current:** `src/search.ts:105-110` reads every resolved file as utf-8 and splits on `\n` with no binary check. Images, archives, and compiled binaries produce garbage lines and can match noise patterns.

**Required:** Skip binary files, using **both** checks (user selected combined detection):
1. **NUL-byte heuristic:** read the first 8192 bytes as a buffer; if it contains a `0x00` byte, treat the file as binary and skip it.
2. **Extension list:** skip files whose extension is in a binary set. Define and export a constant, e.g. `BINARY_EXTENSIONS`, covering at minimum: `png jpg jpeg gif bmp ico webp tiff svgz mp3 wav flac ogg m4a mp4 avi mkv mov wmv webm pdf zip tar gz bz2 xz 7z rar exe dll so dylib class jar pyc pdb wasm bin dat iso img dmg deb rpm`. Include the leading dot in each entry.
- A file failing either check is skipped: `searchFile` returns `null` and the file contributes nothing to results or to the files-searched count.
- Under `--trace`, log each skipped binary path as a `[trace]` line to stderr so the exclusion is observable.
- Perform the NUL check on the already-open file handle so the file is not read twice.

**Verification:** `query "MZ" . -r` over a directory containing a `.exe` returns no matches from that executable. With `-t`, stderr shows the skip reason.

### 3.10 F10 — Argument pattern/path split is heuristic and misclassifies patterns

**Current:** `src/cli.ts:48-59` defines `isPathLike`, which returns true for an argument containing `/` or `\`, any of `*?[]{}`, the literals `.` or `..`, **or anything that resolves to an existing filesystem entry relative to cwd**. `splitPatternsAndPaths` (`src/cli.ts:67-82`) uses the first path-like argument as the split boundary (the `findIndex` is at `src/cli.ts:70`).

Two failure modes follow from the `fs.existsSync` probe:
- A search pattern that collides with a filename in the cwd (e.g. `query README .`) makes `README` a path and `.` a pattern — the search runs for the literal pattern `.` against path `README`.
- A single positional arg is forced into the pattern role (`src/cli.ts:75`), so `query src/` silently searches for the literal string `src/`.

**Required:** Replace the heuristic with **first-arg-is-pattern**.
- Remove `isPathLike` and `splitPatternsAndPaths` entirely.
- Replace the single variadic `.argument('[args...]', ...)` at `src/cli.ts:18` with two explicit declarations: `.argument('<pattern>', 'Search pattern (regex, or literal with --fixed)')` and `.argument('[paths...]', 'Files, directories, or globs to search; defaults to .')`.
- The first positional is always the pattern. All remaining positionals are paths/globs.
- When no paths are supplied, default to `['.']` (preserve current behavior at `src/cli.ts:101`).
- When no pattern is supplied at all (zero positionals), print `renderHelp()` and exit 0 (preserve `src/index.ts:55-58`).
- Multiple patterns remain expressible via an explicit repeatable `--pattern` option (`-p, --pattern <regex>`); see §3.11.

**Verification:**
- `query README .` searches for the string `README` in `.`.
- `query "foo bar" src/` treats the quoted arg as one pattern.
- `query "needle" src/ -r -i "*.ts"` works — `-i` no longer collides with path detection.
- `query` with no args prints help and exits 0.

### 3.11 F11 — Multi-pattern semantics are undefined

**Current:** `compilePatterns` (`src/search.ts:12-37`) compiles every pattern, and `colorizeMatch` (`src/render.ts:86-121`) colors each pattern's hits with `COLORS[patternIndex % 6]`. But `searchFile` (`src/search.ts:118-129`) `break`s out of the inner pattern loop on the first pattern that matches a line, so a line matching patterns 1 and 2 is attributed only to pattern 1. `findMatches` (`src/search.ts:190-227`) *does* collect and merge matches from all patterns, but is only reached along the render path.

**Required:** Union semantics, explicitly.
- A line matching **any** pattern is a match, is marked with `+`, and is counted once.
- `matchCount` counts matching **lines**, not total pattern hits. A line matching three patterns counts once. (This is current behavior; make it deliberate and documented.)
- `findMatches` must continue to return **all** matches across all patterns, sorted by start offset, with overlapping ranges merged and the merged range carrying the **lowest** `patternIndex` of the merged contributors — that index selects the highlight color. This matches the current merge logic at `src/search.ts:218`; keep it.
- Provide multiple patterns through the repeatable `-p, --pattern <regex>` option (Commander variadic). When `-p` is used together with the positional pattern, the positional is patterns[0] and each `-p` occurrence appends. This replaces the old positional multi-pattern form and is the accepted breaking change.

**Verification:** Fixture with a line matching two patterns. `query -p alpha -p beta fixture.txt` shows both matches highlighted in their distinct colors, prints a `+` marker once, and the summary counts 1 match.

---

## 4. Features

### 4.1 F12 — Respect `.gitignore`

**Current:** `src/search.ts:78-84` passes `gitignore: false` (line 81) to globby and hardcodes `ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**']` (line 83).

**Required:**
- Set `gitignore: true` in the globby options at `src/search.ts:81`. `globby@13` supports this natively via its `ignore` dependency; no new dependency is needed.
- Keep the existing hardcoded `ignore` entries — `node_modules` and `.git` should stay excluded even in a non-git directory. Note that `dist` becomes redundant once gitignore is honored in a git repo, but keeping it is harmless and preserves behavior outside git; keep it.
- Add a `--no-gitignore` flag to opt out and restore the current always-search behavior.
- Reflect the flag in `CliOptions` as `respectGitignore: boolean` (Commander's `--no-` prefix yields `gitignore: false`, so map with `opts.gitignore !== false`).
- Document in the README that gitignore is honored by default and how to disable it.

**Verification:** In a git repo with an untracked-but-gitignored file containing a unique marker, `query "marker" . -r` skips it. With `--no-gitignore` it is found. In a non-git temp directory, `node_modules` is still skipped.

### 4.2 F13 — Parallel search via a worker pool

**Current:** `src/index.ts:83-85` searches every file serially and synchronously:
```ts
const results = files
  .map((file: string) => searchFile(file, compiledPatterns, options))
  .filter((r: SearchResult | null): r is SearchResult => r !== null);
```

Note: `searchFile` itself is `src/search.ts:99-152`.

**Required:** Introduce a bounded worker pool using `node:worker_threads`.
- Add `src/worker.ts`. The worker receives `{ file, patterns: PatternWithRegex[], options: CliOptions }` via `workerData`, runs the existing per-file scan, and posts back the `SearchResult` or `null`.
- Factor the scanning body of `searchFile` into a reusable function that both the main thread and the worker call, so there is one implementation of the scan logic. Put it in `src/search.ts` and export it.
- RegExp objects cannot be structured-cloned reliably across the worker boundary, so serialize patterns as `{ original, source, flags, index }` and recompile inside the worker.
- Add a pool in `src/search.ts` (e.g. `searchFiles(files, patterns, options, concurrency)`) that:
  - Sizes concurrency to `Math.max(1, Math.min(files.length, os.cpus().length - 1))`.
  - Spawns at most that many workers, refilling as each finishes.
  - Returns results **in input file order**, regardless of completion order, so output is deterministic and does not depend on filesystem enumeration order.
  - Falls back to the current in-process synchronous path when `files.length === 1`, when worker construction throws, or when an env var such as `QUERY_NO_WORKERS=1` is set. The fallback must be genuinely exercised by tests, not merely present.
- Handle worker `error` and `exit` events: on `error`, log under `--trace` and fall back to searching that file in-process so a single bad worker cannot lose results.
- Terminate workers in a `finally` block so the process never hangs.
- Do **not** add `worker_threads` to `tsconfig` `lib` — it ships with `@types/node`.

**Verification:** Search a directory of ≥50 files and confirm every matching file appears exactly once. Run twice and confirm byte-identical output (deterministic ordering). `QUERY_NO_WORKERS=1` produces identical output. Total wall-clock time on a large tree is lower than the pre-change serial path; if it is not, do not claim a speedup — report the measurement.

---

## 5. Dead Code and Cleanup

Cleanup is in scope.

1. **`src/index.ts:89`** — `const summary = renderSummary(0, files.length, 0);` is assigned and never used; the next line (`src/index.ts:90`) hand-writes its own message. Delete the assignment. Decide which path survives: prefer calling `renderSummary(0, files.length, 0)` and logging its result, so there is one implementation of the no-matches message.
2. **`src/render.ts:2`** — `MatchLocation` is imported but never referenced in the file body. Remove it from the import list.
3. **`src/render.ts:138-140`** — three stray blank lines between the end of `renderSummary` and `renderHelp`. Normalize to one.
4. **`src/cli.ts:1`** — the file opens with a stray comment `// origin -> single-pattern positional parse -> multi-pattern heuristic split (rev 1)` that describes a design this spec replaces. Delete it.
5. **`src/cli.ts:24-26`** — `-b/--before`, `-f/--after`, `-y/--symmetric` are declared with **string** defaults (`'0'`, `'0'`, `'-1'`), then converted with `parseInt` at `src/cli.ts:104-106`. Declare them with numeric defaults (`0`, `0`, `-1`) and parse with Commander's argument parser so malformed input produces a Commander error instead of silently becoming `0` via `parseInt(...) || 0`.
6. **`src/cli.ts:26`** — `-y, --symmetric` defaults to `'-1'` and `src/cli.ts:105` treats any negative value as "not set". With item 5's numeric default this becomes `symmetric: -1`; preserve the sentinel semantics.
7. **`src/index.ts:14-43`** — the three `atomic*` clipboard helpers each maintain the same `lock` chain. They are correct as written (the `.catch(() => {})` keeps the chain alive); consolidate only if it reduces duplication without changing the error behavior where a clipboard failure must still surface to the caller. Do not remove clipboard failure isolation — `src/index.ts:118-120` deliberately catches and reports.
8. **`src/index.ts:111`** — the ANSI-strip regex `/\x1b\[[0-9;]*m/g` is written inline. This is correct; leave it, but extract it to a named constant so the test suite can assert against the same expression rather than a duplicated copy.
9. **Verify no other unused imports or exports remain** after the above. Do not add lint suppressions to achieve this; fix the code.

---

## 6. Type and Interface Changes

`src/types.ts` — `CliOptions` additions and changes:

```ts
export interface CliOptions {
  pattern: string[];          // existing; now always length >= 1
  paths: string[];            // existing
  recursive: boolean;
  caseSensitive: boolean;
  fixedString: boolean;
  contextBefore: number;
  contextAfter: number;
  includeGlob: string[];       // CHANGED: string -> string[]   (F5)
  excludeGlob: string[];      // CHANGED: string -> string[]   (F5)
  skipBlank: boolean;
  listFiles: boolean;
  maxPerFile: number;
  noColor: boolean;
  noLineNumbers: boolean;
  noMatchMarker: boolean;
  clipboard: boolean;
  append: boolean;
  trace: boolean;
  respectGitignore: boolean;  // NEW   (F12)
}
```

Also add to `src/types.ts`:

```ts
export interface SerializablePattern {  // NEW — worker boundary (F13)
  original: string;
  source: string;
  flags: string;
  index: number;
}

export interface WorkerRequest {        // NEW (F13)
  file: string;
  patterns: SerializablePattern[];
  options: CliOptions;
}
```

Note: `CliOptions.pattern` and `CliOptions.paths` are populated at `src/cli.ts:108-127` but never read by `search.ts` or `render.ts` (`searchFile` takes them as separate parameters; see `src/types.ts:6-7` for the field declarations), which receive patterns and paths as separate arguments. Keep them populated for now (removing them is a wider refactor than this spec authorizes) but do not add new consumers.

Export `BINARY_EXTENSIONS` from `src/search.ts` (F9).

---

## 7. New CLI Surface

Complete flag table after this work. Anything not listed here is unchanged.

| Flag | Alias | Type | Default | Notes |
|------|-------|------|---------|-------|
| `-p, --pattern <regex>` | | repeatable | — | Additional search patterns (F11) |
| `-r, --recurse` | | boolean | `false` | |
| `-s, --sensitive` | | boolean | `false` | Case-sensitive |
| `-x, --fixed` | | boolean | `false` | Literal string, no regex |
| `-l, --list` | | boolean | `false` | Filenames only |
| `-k, --skip-blank` | | boolean | `false` | Filtered at render time (F6) |
| `-b, --before <n>` | | number | `0` | Numeric default (Cleanup 5) |
| `-f, --after <n>` | | number | `0` | **Not** `-a` (F2) |
| `-y, --symmetric <n>` | | number | `-1` | `-1` means unset |
| `-m, --max <n>` | | number | `0` | Caps display, not counts (F7) |
| `-i, --include <glob...>` | | variadic | `*` | Real glob matching (F5) |
| `-e, --exclude <glob...>` | | variadic | none | Real glob matching (F5) |
| `--no-color` | | boolean | — | |
| `-c, --clipboard` | | boolean | `false` | |
| `-a, --append` | | boolean | `false` | Clipboard append |
| `--no-line-numbers` | | boolean | — | |
| `--no-match-marker` | | boolean | — | |
| `--no-gitignore` | | boolean | gitignore **on** | Opt out of F12 |
| `-t, --trace` | | boolean | `false` | |
| `-h, --help` | | boolean | — | |
| `-V, --version` | | boolean | — | Reads version from `package.json` (F14) |

**Removed:** `--animate` (F3).

**Positionals:** `<pattern>` then `[paths...]` (F10).

### 4.3 F14 — Version string drift

`src/cli.ts:17` hardcodes `.version('1.0.0')`, duplicating `package.json`'s `version`. Derive it instead so the two cannot diverge: read `package.json` via `createRequire(import.meta.url)` and pass `pkg.version` to `.version()`. Keep `src/render.ts`'s help text free of any version string. If the JSON import fails, fall back to `'0.0.0'` rather than throwing at module load.

---

## 8. Testing

Add **vitest** as a devDependency. `npm test` currently runs `node dist/index.js --help`, which proves nothing beyond that the binary parses `--help`.

Suggested scripts in `package.json`:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit"
}
```

Put tests in `src/__tests__/` (or `tests/` — pick one and stay consistent) as `*.test.ts`. Vitest must be able to run TypeScript ESM directly; do not require a build step before `npm test`.

Required coverage:

**`cli.test.ts` — argument parsing**
- Single pattern, no paths → paths defaults to `['.']`.
- Pattern + multiple paths.
- `README` as a pattern is not treated as a path (F10 regression).
- Pattern containing `/`, e.g. `foo/bar`, is still a pattern (F10 regression).
- Zero positionals → help path, exit 0.
- `-f` sets `contextAfter`; `-a` sets `append` (F2 regression).
- `-y 3` sets both context values to 3; `-y` unset does not clobber `-b`/`-f`.
- Malformed `-b abc` produces a Commander error rather than silently becoming 0 (Cleanup 5).
- Multiple `-i` / `-e` populate arrays.
- `--no-gitignore` yields `respectGitignore: false`.

**`search.test.ts` — engine**
- `compilePatterns` honors `-x` (escapes metacharacters) and `-s` (case sensitivity).
- An invalid regex is auto-escaped rather than throwing (`src/search.ts:24-28`).
- `includeGlob` matches via picomatch against the relative path, not a substring (F5 regression) — assert `-i "*.ts"` matches `src/a.ts` and does not match `src/a.js`.
- Exclude wins over include.
- `buildContextBlocks` merges adjacent windows and splits disjoint ones.
- `--max` truncates rendered blocks but `matchCount` reflects the full count (F7 regression).
- `--skip-blank` no longer changes `lines` indices (F6 regression).
- Binary files are skipped by NUL byte and by extension (F9).
- Worker-pool path returns the same results in the same order as the serial path, and the `QUERY_NO_WORKERS=1` fallback matches (F13).

**`render.test.ts` — output**
- `renderLegend` returns one entry per pattern using the expected colors (F1 regression).
- `renderResults` emits a `--` separator only between non-adjacent blocks (F8 regression).
- `--no-line-numbers` and `--no-match-marker` suppress their prefixes.
- Match text is wrapped in the color for its pattern index.
- Clipboard output has ANSI codes stripped — assert against the `/\x1b\[[0-9;]*m/g` strip at `src/index.ts:111`.

Use fixtures written to a temp directory (`os.tmpdir()`), not committed binary blobs. Do not add `@types/node` substitutes for `setTimeout` etc.; the project already has `@types/node`.

---

## 9. Documentation

Rewrite `README.md` in full:

- **Options table** matching §7 exactly, including the `-f, --after` correction and the currently-missing `-a, --append` row.
- **Examples** — every `-a` used as a context flag becomes `-f`.
- Document that `--include`/`--exclude` accept real globs and are repeatable.
- Document that multiple patterns use `-p/--pattern`.
- Document that the **first positional is always the pattern**; paths follow. State plainly that `query public private *.cs` no longer means two patterns — it means pattern `public` searched in paths `private` and `*.cs`. Use `query public -p private "*.cs"` as the multi-pattern example.
- Document gitignore-by-default and `--no-gitignore`.
- Document that `--max` limits displayed matches while the summary reports the true total.
- Document that `--skip-blank` hides blank lines without altering reported line numbers.
- Document the `--` gap separator.
- Document binary-file skipping.
- In "Future Enhancements", strike the two now-completed items rather than leaving them unchecked. They are worded: `- [ ] Parallel search threads (Worker pool)` (completed by F13) and `- [ ] Exclude patterns from gitignore` (completed by F12, with the polarity inverted — gitignore is now honored by default, so replace the item rather than merely striking it).
- The remaining unchecked items (Interactive TUI, JSON output mode, Custom color schemes) stay. JSON output and custom colors were considered and declined during scoping; leave them listed as future work.
- Correct the "Performance Notes" section: the `[heuristic] File globbing done upfront; not streaming` and `[failure-mode] Large files (>10k lines)...` lines are speculative. Either substantiate them with a measurement or rewrite them as observed facts.
- Update "Architecture" if the file list changes — `src/worker.ts` is added by F13.

Update `renderHelp` in `src/render.ts` to match §7 exactly. It is the in-binary source of truth and currently drifts from both the README and the Commander definition.

---

## 10. Acceptance Criteria

The work is complete when **all** of the following hold.

1. `npx tsc --noEmit` exits 0 and prints nothing. *(Currently fails — F1.)*
2. `npm run build` succeeds and `dist/` is regenerated from current source.
3. `npm test` runs vitest and all suites pass.
4. `query "TODO" src/ -r -b 2 -f 2` prints context lines with correct numbers.
5. `query "^public class" src/ -r -i "*.ts"` returns matches — proving glob include works, not substring. *(F5.)*
6. `query "x" . -r -l -e "*.d.ts"` lists matching files with declaration files excluded.
7. `query README .` searches for the string `README`, not the pattern `.`. *(F10.)*
8. `query "needle" fixture.txt -f 1 -k` reports line numbers matching the same search without `-k`. *(F6.)*
9. `query "needle" fixture.txt -m 2` displays 2 matches and summarizes the full count. *(F7.)*
10. Two separated blocks in one file are divided by a `--` line. *(F8.)*
11. A `.exe` or `.png` in the search tree yields no matches and appears in `--trace` output as skipped. *(F9.)*
12. A gitignored file is skipped by default and found with `--no-gitignore`. *(F12.)*
13. Worker-pool search and `QUERY_NO_WORKERS=1` serial search produce byte-identical output. *(F13.)*
14. `query "x" src/ -a 5` appends to the clipboard; `query "x" src/ -f 5` adds 5 trailing context lines. *(F2.)*
15. `grep -rn "animate" src/` returns nothing. *(F3.)*
16. `query --version` prints the version from `package.json`. *(F14.)*
17. `README.md` and `renderHelp` agree with §7 and with each other.
18. No unused imports, unused variables, or commented-out code remain in `src/` (Cleanup 1-9).

Do not report completion on the basis of a successful build alone — criterion 1 passing is caused by fixing F1 and proves nothing about F5-F10. Each numbered criterion maps to at least one behavioral check that must be run and observed.

---

## 11. Suggested Execution Order

1. **F1** — restore `renderLegend`; get a green build first. Everything else is unverifiable until this lands.
2. **Cleanup 1-4, 9** — remove dead code now that the build compiles.
3. **F10, F11** — replace the argument heuristic and define multi-pattern semantics. These change the CLI's contract and should precede test authoring so tests target the final shape.
4. **§6, §7** — update `types.ts`, `cli.ts`, and the flag table together.
5. **F14, Cleanup 5-7** — version derivation and option-default cleanup. (Cleanup 8 folds into the §8 test work.)
6. **F5** — picomatch glob filtering (adds a dependency).
7. **F6, F7, F8** — the three rendering/scan semantics fixes.
8. **F9** — binary detection.
9. **F12** — gitignore support.
10. **F13** — worker pool; largest change, do it last against a green suite.
11. **§8** — write the vitest suite. Tests authored incrementally from step 3 onward are strongly preferred over a single pass at the end; the F5-F10 regressions listed in §8 should each be written as a failing test before the corresponding fix.
12. **§9** — rewrite README and `renderHelp`.
13. **§10** — run every acceptance criterion and record results.
