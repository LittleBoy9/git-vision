# git-vision

## Overview
A zero-config CLI tool that analyzes Git history to surface risky files, unstable modules, knowledge silos, and hidden dependencies. Based on Adam Tornhill's "Your Code as a Crime Scene" methodology. Goal: be the best open-source git intelligence tool in the world.

## Package
- **Name**: `git-vision`
- **Version**: 2.0.0
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
│   ├── config/
│   │   ├── loader.js           # .gitvisionrc config loading & merging
│   │   ├── ignores.js          # Smart default ignore patterns
│   │   └── init.js             # Auto-detect project type & generate config
│   ├── analyzers/
│   │   ├── hotspots.js         # Churn × complexity = risk score (test-aware)
│   │   ├── coupling.js         # Files that change together
│   │   ├── busFactor.js        # Single-owner file detection
│   │   ├── codeAge.js          # Stale zones & recently volatile files
│   │   ├── contributors.js     # Per-module contributor patterns
│   │   ├── blame.js            # V2: Line-level ownership via git blame
│   │   ├── trends.js           # V2: Period comparison & trend tracking
│   │   ├── monorepo.js         # V2: Per-workspace analysis
│   │   ├── diff.js             # PR/branch risk analysis
│   │   └── branches.js         # Branch graph & lifecycle analysis
│   ├── scoring/
│   │   └── healthScore.js      # Repo health 0-100 + recommendations
│   └── formatters/
│       ├── terminal.js         # Beautiful chalk + cli-table3 output
│       ├── json.js             # CI-friendly JSON output
│       ├── html.js             # Browser-based HTML report
│       └── treemap.js          # V2: Squarified treemap visualization
├── tests/
│   ├── _helpers.js             # Shared test data factories
│   ├── hotspots.test.js        # Hotspot analyzer tests
│   ├── busFactor.test.js       # Bus factor tests
│   ├── coupling.test.js        # Coupling tests
│   ├── codeAge.test.js         # Code age tests
│   ├── contributors.test.js    # Contributors tests
│   ├── knowledgeLoss.test.js   # Knowledge loss tests
│   ├── healthScore.test.js     # Health score tests
│   └── ignores.test.js         # Ignore pattern tests
├── action.yml                  # GitHub Action (composite)
├── .github/
│   ├── scripts/format-pr-comment.js  # PR comment formatter
│   └── workflows/git-vision-pr.yml   # Example PR workflow
├── package.json
├── CLAUDE.md
└── README.md
```

## Key Design Decisions
- **ESM modules** (`"type": "module"` in package.json)
- **Zero config**: Works by running `npx git-vision` in any git repo
- **Pure git log**: No GitHub/GitLab API needed — works on any local repo
- **No build step**: Plain Node.js, no transpilation
- **Config merging**: defaults < .gitvisionrc < CLI flags (CLI always wins)

## Dependencies
- `simple-git` — git log extraction
- `commander` — CLI framework
- `chalk` — terminal colors
- `cli-table3` — table formatting
- `boxen` — box drawing for headers
- `ora` — loading spinners
- `open` — opening HTML reports in browser

## Commands
```bash
npm run dev          # Run locally: node bin/cli.js
npm link             # Link for local testing as `git-vision`
npm test             # Run tests (node:test, 46 tests across 8 suites)
```

## Analysis Modules

### V1 Core

#### 1. Hotspots (hotspots.js)
- **Formula**: `risk = churn_frequency × file_size_lines`
- Parse `git log --numstat` for change counts
- Count LOC per file for complexity proxy
- Rank by combined score, normalized 0-100

#### 2. Change Coupling (coupling.js)
- Files appearing in same commit > N times are coupled
- Default: min 5 shared commits, 30% coupling degree
- Detects hidden architectural dependencies
- Prioritizes cross-module coupling

#### 3. Bus Factor (busFactor.js)
- Per file: author ownership % from git log
- Flag files where 1 author owns >80% of changes
- Aggregate per folder/module

#### 4. Code Age (codeAge.js)
- Last modified date per file
- Categories: ancient (>1yr), stale (>6mo), aging (>3mo), active, volatile
- Identify volatile files (recent spike in changes vs historical average)

#### 5. Contributor Patterns (contributors.js)
- Top contributors per module (folder)
- Shannon entropy-based fragmentation score
- Knowledge distribution

#### 6. Health Score (healthScore.js)
- Composite 0-100 score from all analyzers
- Weights: hotspots 30%, bus factor 25%, coupling 20%, code age 15%, team 10%
- Letter grade (A-F) with plain English recommendations

### V2 Additions

#### 7. Git Blame (blame.js)
- Line-level ownership via `git blame --line-porcelain`
- More accurate than commit counting (a full rewrite > 10 typo fixes)
- Shows current code ownership, not historical
- Opt-in via `--blame` flag (slower)

#### 8. Trend Tracking (trends.js)
- Compare two equal time periods (e.g., last 3mo vs previous 3mo)
- Tracks: hotspot movement, bus factor changes, churn velocity, contributor flow
- Detects new hotspots, resolved hotspots, worsening/improving files
- Overall direction: improving / stable / declining

#### 9. Monorepo Support (monorepo.js)
- Auto-detects workspaces from package.json, pnpm-workspace.yaml, lerna.json
- Filters commits per workspace and runs full analysis independently
- Per-workspace health scores
- `--workspace` flag or `monorepo` subcommand

#### 10. Config Loader (config/loader.js)
- Reads `.gitvisionrc` or `.gitvisionrc.json` from repo root
- Deep merges with defaults
- CLI flags override everything
- Configurable thresholds for all analyzers

#### 11. Branch Graph (branches.js)
- Branch topology: who created each branch, when, lifespan
- Merge graph: visual merge history extracted from merge commits
- Stale branch detection (>90 days inactive, not merged)
- Branch creators leaderboard
- Supports local + remote branches via `git for-each-ref`
- `branches` subcommand
- **Graph Layout Engine**: `getCommitTopology()` fetches commits with parent hashes in topo order, `computeGraphLayout()` assigns lanes (columns) and computes connections (merge-in, branch-out, converge) for rendering
- **Terminal rendering**: Lane-based coloring with `●` nodes, `│` lines, `╱`/`╲` diagonals, colored ref badges
- **HTML rendering**: SVG-based graph with bezier curves, glowing nodes, per-lane colors — GitLens-style visualization

#### 12. Knowledge Loss Detection (knowledgeLoss.js)
- Detects files/modules where key contributors stopped committing
- Extends bus factor with time dimension: historical authors vs currently active
- Per-file analysis: departed authors, knowledge lost %, at-risk flag
- Global departed contributors list with last seen dates
- Configurable inactivity threshold (default: 180 days)
- `knowledge-loss` subcommand

#### 13. GitHub Action (action.yml)
- Composite GitHub Action for PR risk analysis
- Auto-runs `git-vision diff` on pull requests
- Posts formatted markdown comment with risk score, badge, details
- Updates existing comment on re-push (deduplication via HTML marker)
- Exits with code 1 on critical risk (CI gate)
- Configurable: base branch, fail-on-critical, comment toggle
- Outputs: `risk-score`, `risk-level` for downstream steps

#### 14. Treemap Visualization (formatters/treemap.js)
- Squarified treemap algorithm (pure JS, no deps)
- Rectangle size = LOC, color = risk score
- Canvas-based with hover tooltips
- Embedded in HTML report

## Output Formats
- `--format terminal` (default) — colored, box-drawn tables with V2 sections
- `--format json` — structured JSON for CI/CD (includes V2 data)
- `--format html` — browser report with treemap visualization

## CLI Flags
- `--format <type>` — output format (terminal|json|html)
- `--since <period>` — limit analysis window (e.g., 6months, 1year)
- `--top <n>` — number of results to show (default 10)
- `--ignore <patterns>` — comma-separated glob patterns to exclude
- `--path <dir>` — path to git repository
- `--blame` — enable git blame analysis (V2)
- `--compare <period>` — compare time periods (V2)
- `--workspace [path]` — enable monorepo mode (V2)
- Subcommands: hotspots, coupling, bus-factor, age, contributors, knowledge-loss, blame, trends, monorepo, branches, diff, remote, init

## Smart Defaults
- Auto-filters lock files, binaries, generated code, node_modules, dist, etc.
- Test files (.test.js, .spec.ts, etc.) are dampened in hotspot scoring (0.3x weight)
- Config files (.eslintrc, tsconfig, etc.) excluded from hotspot ranking
- Full ignore list in `src/config/ignores.js`

## Diff / PR Risk Analysis
- `git-vision diff <branch>` — scores risk of a branch/PR
- Risk factors: hotspot files touched, bus-factor-1 files, missing coupled files, diff size
- Normalized 0-100 risk score with levels: low/medium/high/critical
- Exit code 1 on critical risk (CI-friendly)

## Init / Project Detection
- `git-vision init` — auto-detects project type and generates .gitvisionrc.json
- Supports: Node.js, Next.js, Python, Go, Rust, Java, Ruby, PHP
- Auto-detects monorepo (workspaces, pnpm, lerna)

## Remote Analysis
- `git-vision remote <url> [module]` — analyze any remote repo without manual cloning
- Supports GitHub shorthand: `git-vision remote expressjs/express branches`
- Full URLs: `git-vision remote https://github.com/facebook/react.git`
- Uses blobless clone (`--filter=blob:none`) for fast download
- Auto-cleans temp directory after analysis
- All flags work: `--format`, `--top`, `--since`, `--blame`, etc.

## Future Plans (V3+)

### High Priority (Adoption Drivers)
- [x] **GitHub Action** — run on every PR, auto-comment with risk score + recommendations, exit code 1 on critical risk
- [ ] **AI-powered summary** — LLM explains repo health in plain English (Claude API integration)
- [x] **Author Knowledge Loss Detection** — flag modules where key authors stopped contributing (enhances bus factor with time dimension)

### Medium Priority (Feature Parity + Differentiation)
- [ ] **Author Activity Timeline** — commits/lines per author over time, shows ramp-up/departure patterns
- [ ] **Code Survival Analysis** — what % of original code still exists per module/author (like git-of-theseus)
- [ ] **Burndown/Velocity Chart** — lines added/removed over time in HTML report
- [ ] **Temporal Coupling** — are coupled files STILL changing together or just historically linked
- [ ] **Author Co-authorship Matrix** — who works with whom, reveals team structure/silos
- [ ] **Interactive TUI** — terminal UI to drill into hotspots, owners, commits (blessed/ink)
- [ ] Export to CSV/PDF

### Lower Priority (Nice to Have)
- [ ] Benchmark mode (compare two branches)
- [ ] Watch mode (re-run on new commits)
- [ ] Custom scoring weights via config
- [ ] Collaboration graph (force-directed author network visualization)
- [ ] Blame heatmap visualization in HTML report
- [ ] Regex-based file grouping for non-monorepo projects
