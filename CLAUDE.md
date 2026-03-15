# git-vision

## Overview
A zero-config CLI tool that analyzes Git history to surface risky files, unstable modules, knowledge silos, and hidden dependencies. Based on Adam Tornhill's "Your Code as a Crime Scene" methodology. Goal: be the best open-source git intelligence tool in the world.

## Package
- **Name**: `git-vision`
- **Registry**: npm
- **License**: MIT
- **Entry point**: `bin/cli.js`
- **Language**: Node.js (ESM modules)

## Architecture

```
git-vision/
├── bin/cli.js                  # CLI entry point (commander)
├── src/
│   ├── index.js                # Main orchestrator
│   ├── git/parser.js           # Git log extraction & parsing
│   ├── analyzers/
│   │   ├── hotspots.js         # Churn × complexity = risk score
│   │   ├── coupling.js         # Files that change together
│   │   ├── busFactor.js        # Single-owner file detection
│   │   ├── codeAge.js          # Stale zones & recently volatile files
│   │   └── contributors.js     # Per-module contributor patterns
│   ├── scoring/
│   │   └── healthScore.js      # Repo health 0-100 + recommendations
│   └── formatters/
│       ├── terminal.js         # Beautiful chalk + cli-table3 output
│       ├── json.js             # CI-friendly JSON output
│       └── html.js             # Browser-based HTML report
├── templates/
│   └── report.html             # HTML report template
├── package.json
├── CLAUDE.md
└── README.md
```

## Key Design Decisions
- **ESM modules** (`"type": "module"` in package.json)
- **Zero config**: Works by running `npx git-vision` in any git repo
- **Pure git log**: No GitHub/GitLab API needed — works on any local repo
- **No build step**: Plain Node.js, no transpilation

## Dependencies
- `simple-git` — git log extraction
- `commander` — CLI framework
- `chalk` — terminal colors
- `cli-table3` — table formatting
- `boxen` — box drawing for headers
- `ora` — loading spinners

## Commands
```bash
npm run dev          # Run locally: node bin/cli.js
npm link             # Link for local testing as `git-vision`
npm test             # Run tests (when added)
```

## Analysis Modules

### 1. Hotspots (hotspots.js)
- **Formula**: `risk = churn_frequency × file_size_lines`
- Parse `git log --numstat` for change counts
- Count LOC per file for complexity proxy
- Rank by combined score

### 2. Change Coupling (coupling.js)
- Files appearing in same commit > N times are coupled
- Default: min 5 shared commits, 30% coupling degree
- Detects hidden architectural dependencies

### 3. Bus Factor (busFactor.js)
- Per file: author ownership % from git log
- Flag files where 1 author owns >80% of changes
- Aggregate per folder/module

### 4. Code Age (codeAge.js)
- Last modified date per file
- Identify stale zones (no changes in months)
- Identify volatile files (recent spike in changes)

### 5. Contributor Patterns (contributors.js)
- Top contributors per module (folder)
- Team fragmentation score
- Knowledge distribution

### 6. Health Score (healthScore.js)
- Composite 0-100 score from all analyzers
- Plain English recommendations
- Top risks summary

## Output Formats
- `--format terminal` (default) — colored, box-drawn tables
- `--format json` — structured JSON for CI/CD
- `--format html` — opens browser with visual report

## CLI Flags
- `--format <type>` — output format (terminal|json|html)
- `--since <period>` — limit analysis window (e.g., 6months, 1year)
- `--top <n>` — number of results to show (default 10)
- `--ignore <patterns>` — comma-separated glob patterns to exclude
- Subcommands: hotspots, coupling, bus-factor, age, contributors

## Future Plans (V2+)
- [ ] AI-powered summary (LLM explains repo health in plain English)
- [ ] GitHub Action (run on every PR, comment with risk analysis)
- [ ] PR Risk Score (flag PRs that touch hotspot files)
- [ ] Trend tracking (week-over-week health comparison)
- [ ] Interactive terminal mode (drill into files/authors)
- [ ] `.gitvisionrc` config file support
- [ ] Treemap visualization in HTML report
- [ ] Git blame integration for deeper ownership analysis
- [ ] Monorepo support (analyze sub-packages independently)
- [ ] Benchmark mode (compare two branches)
