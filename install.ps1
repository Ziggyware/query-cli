#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Extract all query-cli source files to current directory.

.DESCRIPTION
    Writes package.json, tsconfig.json, README.md, and reorganizes src/ structure.
    Safe to run multiple times (overwrites files).

.EXAMPLE
    .\extract.ps1
#>

[CmdletBinding()]
param()

$projectRoot = Split-Path -Parent $PSCommandPath
$srcDir = Join-Path $projectRoot 'src'

# Create src directory if missing
if (-not (Test-Path $srcDir)) {
    [void](New-Item $srcDir -ItemType Directory)
    Write-Host "Created: $srcDir" -ForegroundColor Green
}

# ─────────────────────────────────────────────────────────────────────────────
# package.json
# ─────────────────────────────────────────────────────────────────────────────
$packageJson = @'
{
  "name": "query-cli",
  "version": "1.0.0",
  "description": "Modern file content search with context, regex, and fancy CLI output",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "query": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "node dist/index.js --help"
  },
  "keywords": ["search", "grep", "cli", "context"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "chalk": "^5.3.0",
    "clipboardy": "^4.0.0",
    "commander": "^12.1.0",
    "globby": "^14.3.1"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "typescript": "^5.5.4"
  }
}
'@
Set-Content -Path (Join-Path $projectRoot 'package.json') -Value $packageJson -Encoding UTF8
Write-Host "Wrote: package.json" -ForegroundColor Cyan

# ─────────────────────────────────────────────────────────────────────────────
# tsconfig.json
# ─────────────────────────────────────────────────────────────────────────────
$tsconfigJson = @'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
'@
Set-Content -Path (Join-Path $projectRoot 'tsconfig.json') -Value $tsconfigJson -Encoding UTF8
Write-Host "Wrote: tsconfig.json" -ForegroundColor Cyan

# ─────────────────────────────────────────────────────────────────────────────
# README.md
# ─────────────────────────────────────────────────────────────────────────────
$readmeMd = @'
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

✅ **Regex patterns** — Full ECMAScript regex support (auto-escapes invalid patterns)  
✅ **Color output** — 6-color cycle for pattern highlighting  
✅ **Context blocks** — Merges adjacent windows; `--` separates gaps  
✅ **File filtering** — Include/exclude globs  
✅ **Clipboard** — Copy full results to clipboard  
✅ **Fast** — Parallel file I/O via Globby  
✅ **Cross-platform** — Windows, macOS, Linux  

## Architecture

- `src/types.ts` — Shared interfaces
- `src/search.ts` — File resolution & regex engine
- `src/cli.ts` — Commander.js CLI setup
- `src/render.ts` — Color output & formatting
- `src/index.ts` — Main entry point

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
'@
Set-Content -Path (Join-Path $projectRoot 'README.md') -Value $readmeMd -Encoding UTF8
Write-Host "Wrote: README.md" -ForegroundColor Cyan

# ─────────────────────────────────────────────────────────────────────────────
# .gitignore
# ─────────────────────────────────────────────────────────────────────────────
$gitignore = @'
node_modules/
dist/
*.log
.DS_Store
.env
.env.local
*.tsbuildinfo
'@
Set-Content -Path (Join-Path $projectRoot '.gitignore') -Value $gitignore -Encoding UTF8
Write-Host "Wrote: .gitignore" -ForegroundColor Cyan
