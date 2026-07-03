# query-cli

Modern, fast file content search with context lines and fancy TUI output. TypeScript + Node.js replacement for the PowerShell `query` script.

## Install

```bash
npm install
npm run build
npm link  # Makes 'query' available globally
```

Or run directly:
```bash
npx query "pattern" src/ -r
```

## Usage

```bash
query [options] <pattern> [paths...]
```

### Examples

```bash
# Search recursively in src/, show 2 lines before/after
query "TODO" src/ -r -b 2 -a 2

# Regex, case-insensitive (default), C# files only
query "^public class" src/ -r --include "*.cs"

# Literal string, 5 lines after
query "error" logs/ -r -a 5 --include "*.log"

# List matching files only
query "throw" . -r -l --include "*.cs"

# Copy results to clipboard
query "SELECT" . -r --include "*.sql" -c
```

### Options

| Flag | Alias | Description |
|------|-------|-------------|
| `-r, --recurse` | | Search subdirectories |
| `-s, --sensitive` | | Case-sensitive match |
| `-x, --fixed` | | Literal string (no regex) |
| `-l, --list` | | Files only (no context) |
| `-b, --before <n>` | | Context lines before match |
| `-a, --after <n>` | | Context lines after match |
| `-y, --symmetric <n>` | | Context lines (before and after) |
| `-m, --max <n>` | | Stop after n matches per file |
| `-i, --include <glob>` | | File filter (glob) |
| `-e, --exclude <glob>` | | Skip files (glob) |
| `-k, --skip-blank` | | Ignore empty lines |
| `--no-color` | | Disable ANSI colors |
| `-c, --clipboard` | | Copy to clipboard |
| `--no-line-numbers` | | Hide line numbers |
| `--no-match-marker` | | Hide `+` marker |
| `-t, --trace` | | Verbose debug output |

## Features

âœ… **Regex patterns** â€” Full ECMAScript regex support (auto-escapes invalid patterns)  
âœ… **Color output** â€” 6-color cycle for pattern highlighting  
âœ… **Context blocks** â€” Merges adjacent windows; `--` separates gaps  
âœ… **File filtering** â€” Include/exclude globs  
âœ… **Clipboard** â€” Copy full results to clipboard  
âœ… **Fast** â€” Parallel file I/O via Globby  
âœ… **Cross-platform** â€” Windows, macOS, Linux  

## Architecture

- `src/types.ts` â€” Shared interfaces
- `src/search.ts` â€” File resolution & regex engine
- `src/cli.ts` â€” Commander.js CLI setup
- `src/render.ts` â€” Color output & formatting
- `src/index.ts` â€” Main entry point

## Development

```bash
npm run build    # Compile TypeScript
npm run dev      # Watch mode
npm test         # Show help text
```

## Performance Notes

- [heuristic] File globbing done upfront; not streaming
- [derived] Context blocks built in single pass (linear time)
- [failure-mode] Large files (>10k lines) with many matches may be slow; use `--max` to cap matches

## Future Enhancements

- [ ] Interactive TUI (Ink + React) for live result navigation
- [ ] Parallel search threads (Worker pool)
- [ ] JSON output mode
- [ ] Exclude patterns from gitignore
- [ ] Custom color schemes
