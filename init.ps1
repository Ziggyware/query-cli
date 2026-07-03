#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Initialize git repo for query-cli and output GitHub push instructions.

.DESCRIPTION
    Stages all files, creates initial commit, and prints the git remote + push
    commands for the user to run after creating a GitHub repo.

.PARAMETER RepoName
    GitHub repo name (default: query-cli)

.PARAMETER UserName
    GitHub username (required for generating push URL)

.EXAMPLE
    .\setup.ps1 -UserName "myusername"
    .\setup.ps1 -UserName "myusername" -RepoName "my-query-tool"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $UserName,

    [Parameter()]
    [string] $RepoName = 'query-cli'
)

# [failure-mode] git not installed
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Error: git is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

$projectRoot = Split-Path -Parent $PSCommandPath
$gitDir = Join-Path $projectRoot '.git'

# [heuristic] Repo already initialized; confirm before overwriting
if (Test-Path $gitDir) {
    Write-Host ".git/ already exists. Initialize anyway? (y/n)" -ForegroundColor Yellow
    $confirm = Read-Host
    if ($confirm -ne 'y') {
        Write-Host "Cancelled."
        exit 0
    }
    Remove-Item $gitDir -Recurse -Force
}

Write-Host "Initializing git repository..." -ForegroundColor Cyan
git -C $projectRoot init

Write-Host "Staging files..." -ForegroundColor Cyan
git -C $projectRoot add .

Write-Host "Creating initial commit..." -ForegroundColor Cyan
git -C $projectRoot commit -m "Initial commit: query-cli TypeScript rewrite"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "1. Create empty repo on GitHub (https://github.com/new)"
Write-Host "   Name it: $RepoName"
Write-Host ""
Write-Host "2. Run these commands:" -ForegroundColor Cyan
Write-Host ""
Write-Host "git -C `"$projectRoot`" branch -M main" -ForegroundColor Gray
Write-Host "git -C `"$projectRoot`" remote add origin https://github.com/$UserName/$RepoName.git" -ForegroundColor Gray
Write-Host "git -C `"$projectRoot`" push -u origin main" -ForegroundColor Gray
Write-Host ""
Write-Host "Or copy-paste as one block:" -ForegroundColor Cyan
Write-Host ""
$commands = @(
    "git -C `"$projectRoot`" branch -M main"
    "git -C `"$projectRoot`" remote add origin https://github.com/$UserName/$RepoName.git"
    "git -C `"$projectRoot`" push -u origin main"
)
Write-Host ($commands -join "`n") -ForegroundColor DarkGray
Write-Host ""
Write-Host "Repo initialized at: $projectRoot" -ForegroundColor Green