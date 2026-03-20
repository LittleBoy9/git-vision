<div align="center">

# git-vision

**X-ray your codebase. One command. Zero config.**

[![npm version](https://img.shields.io/npm/v/git-vision?color=f05033&label=npm&style=flat-square)](https://www.npmjs.com/package/git-vision)
[![license](https://img.shields.io/npm/l/git-vision?color=green&style=flat-square)](https://github.com/LittleBoy9/git-vision/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/git-vision?color=58a6ff&style=flat-square)](https://nodejs.org)
[![downloads](https://img.shields.io/npm/dm/git-vision?color=fb923c&style=flat-square)](https://www.npmjs.com/package/git-vision)
[![tests](https://img.shields.io/badge/tests-46%20passing-3fb950?style=flat-square)](#tests)

Surface risky files, knowledge silos, and hidden dependencies from your Git history.<br>
No API tokens. No config. Works with **any** Git repo.

### [🌐 Visit This →](https://littleboy9.github.io/git-vision/)

```bash
npx git-vision
```


</div>

---

## Why git-vision?

Your Git history is a goldmine of insights most teams ignore. `git-vision` mines that data to answer critical questions:

| Question | Module |
|----------|--------|
| Where will the next bug appear? | [Hotspots](#hotspot-detection) |
| What happens if Sarah leaves? | [Bus Factor](#bus-factor-analysis) |
| Why do these unrelated files break together? | [Change Coupling](#change-coupling) |
| What code has everyone forgotten about? | [Code Age](#code-age) |
| Who actually owns what? | [Blame](#true-ownership-via-git-blame) |
| Are things getting better or worse? | [Trends](#trend-tracking) |
| Which package is the riskiest? | [Monorepo](#monorepo-support) |
| Who stopped contributing to critical code? | [Knowledge Loss](#knowledge-loss-detection) |
| Is this PR risky? | [Diff](#pr-risk-analysis) |
| What does our branch history look like? | [Branches](#branch-analysis) |

Based on Adam Tornhill's *"Your Code as a Crime Scene"* methodology.

---

## Quick Start

```bash
# Full analysis — health score + all modules
npx git-vision

# Analyze any remote repo (no manual cloning)
npx git-vision remote facebook/react
npx git-vision remote expressjs/express branches

# HTML report with interactive treemap
npx git-vision --format html

# JSON for CI pipelines
npx git-vision --format json
```

---

## Features

### Hotspot Detection

Files with high churn AND complexity are where bugs cluster.

```bash
npx git-vision hotspots
```

**Formula:** `risk = churn_frequency x lines_of_code`<br>
Test files are automatically dampened (0.3x weight). Config files excluded.

---

### Bus Factor Analysis

Files where one person owns >80% of changes = bus-factor-1 risk.

```bash
npx git-vision bus-factor
```

---

### Change Coupling

Files that always change together reveal hidden dependencies your import graph doesn't show.

```bash
npx git-vision coupling
```

Cross-module couplings are prioritized — those are the architecture smells.

---

### Code Age

Stale zones (ancient untouched code) and volatile files (sudden change spikes).

```bash
npx git-vision age
```

Categories: `ancient` (>1yr) / `stale` (>6mo) / `aging` (>3mo) / `active` / `volatile`

---

### Contributor Patterns

Who owns what, how contributions are distributed, where team fragmentation creates overhead.

```bash
npx git-vision contributors
```

Shannon entropy-based fragmentation scoring per module.

---

### Knowledge Loss Detection

Detects files where key contributors have stopped committing. Extends bus factor with a time dimension.

```bash
npx git-vision knowledge-loss
```

> "Alice wrote 80% of payments.ts but hasn't committed in 7 months."

Configurable inactivity threshold (default: 180 days).

---

### True Ownership via Git Blame

Goes beyond commit counts to **line-level ownership**. A developer who rewrote a file owns more than someone who made 10 typo fixes.

```bash
npx git-vision blame
npx git-vision --blame          # include with full analysis
```

---

### Trend Tracking

Compare two time periods. See if your codebase is improving or rotting.

```bash
npx git-vision trends
npx git-vision trends --compare 6months
```

Tracks: hotspot movement, bus factor changes, churn velocity, new/lost contributors.

---

### PR Risk Analysis

Score any branch before merging. Catches risky PRs before review.

```bash
npx git-vision diff main
npx git-vision diff develop
```

Risk factors: hotspot files touched, bus-factor-1 files, missing coupled files, diff size.<br>
**Exit code 1 on critical risk** — perfect for CI gates.

---

### Branch Analysis

GitLens-style branch graph with topology, merge history, and stale branch detection.

```bash
npx git-vision branches
npx git-vision branches --format html   # SVG graph with bezier curves
```

---

### Monorepo Support

Auto-detects workspaces (npm, yarn, pnpm, lerna) and analyzes each independently.

```bash
npx git-vision monorepo
npx git-vision --workspace
npx git-vision --workspace packages/api
```

---

### Remote Repo Analysis

Analyze any public repo without cloning it yourself. Uses blobless clone for speed.

```bash
npx git-vision remote facebook/react
npx git-vision remote expressjs/express --format html
npx git-vision remote https://github.com/vercel/next.js.git --blame
```

---

### Health Score

A single **0-100 score** combining all metrics.

| Weight | Module |
|--------|--------|
| 30% | Hotspots |
| 25% | Bus Factor |
| 20% | Coupling |
| 15% | Code Age |
| 10% | Team Distribution |

Grade scale: **A** (90+) / **B** (75+) / **C** (60+) / **D** (40+) / **F** (<40)

---

## GitHub Action

Add `git-vision` to your CI pipeline. Auto-comments on PRs with risk analysis.

```yaml
# .github/workflows/pr-risk.yml
name: PR Risk Analysis
on:
  pull_request:
    branches: [main]
permissions:
  pull-requests: write
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required: git-vision needs full history
      - uses: LittleBoy9/git-vision@v2
        with:
          base-branch: main
```

**What you get:**
- Risk score badge on every PR
- Summary table (files changed, hotspots hit, bus-factor risks)
- Severity-grouped risk details
- Auto-updates comment on re-push
- Exit code 1 on critical risk (blocks merge)

### Action Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `base-branch` | `main` | Base branch to compare against |
| `fail-on-critical` | `true` | Exit 1 on critical risk |
| `comment-on-pr` | `true` | Post analysis as PR comment |
| `github-token` | `${{ github.token }}` | Token for PR comments |

### Action Outputs

| Output | Description |
|--------|-------------|
| `risk-score` | Numeric risk score (0-100) |
| `risk-level` | `low` / `medium` / `high` / `critical` |

---

## All Commands

```bash
npx git-vision                        # Full analysis with health score
npx git-vision hotspots               # Riskiest files by churn x complexity
npx git-vision bus-factor             # Knowledge silo detection
npx git-vision coupling               # Hidden architectural dependencies
npx git-vision age                    # Stale zones & volatile files
npx git-vision contributors           # Per-module team patterns
npx git-vision knowledge-loss         # Departed contributor detection
npx git-vision blame                  # True line-level ownership
npx git-vision trends                 # Health over time
npx git-vision monorepo               # Per-workspace analysis
npx git-vision branches               # Branch graph & lifecycle
npx git-vision diff <branch>          # PR risk scoring
npx git-vision remote <url> [module]  # Analyze any remote repo
npx git-vision init                   # Generate smart config
```

## Flags

| Flag | Description |
|------|-------------|
| `--format <type>` | `terminal` (default), `json`, `html` |
| `--top <n>` | Number of results (default: 10) |
| `--since <period>` | Limit window (e.g. `6months`, `1year`) |
| `--ignore <patterns>` | Comma-separated globs to exclude |
| `--path <dir>` | Path to git repository |
| `--blame` | Enable git blame analysis (slower) |
| `--compare <period>` | Compare time periods |
| `--workspace [path]` | Enable monorepo mode |

---

## Output Formats

### Terminal (default)
Color-coded tables, risk bars, health scores, recommendations. Designed for humans.

### JSON (`--format json`)
Structured output for CI/CD. Exit code 1 when health score < 40.

### HTML (`--format html`)
Self-contained report with dark theme, interactive treemap, SVG branch graph. Opens in browser automatically.

---

## Configuration

Generate a config file with smart defaults for your stack:

```bash
npx git-vision init
```

Or create `.gitvisionrc.json` manually:

```json
{
  "format": "terminal",
  "top": 15,
  "ignore": ["*.test.js", "dist/**"],
  "thresholds": {
    "busFactor": { "ownershipThreshold": 0.8 },
    "coupling": { "minSharedCommits": 5, "minCouplingDegree": 0.3 }
  },
  "blame": { "enabled": false, "maxFiles": 50 },
  "monorepo": { "enabled": false }
}
```

Supports: Node.js, Next.js, Python, Go, Rust, Java, Ruby, PHP. Auto-detects monorepos.

**Priority:** defaults < `.gitvisionrc` < CLI flags (CLI always wins)

---

## Tests

```bash
npm test
```

46 tests across 8 suites covering all analyzers:

| Suite | Tests |
|-------|-------|
| Hotspots | 5 |
| Bus Factor | 5 |
| Coupling | 5 |
| Code Age | 5 |
| Contributors | 4 |
| Knowledge Loss | 5 |
| Health Score | 5 |
| Ignores | 12 |

---

## How It Works

`git-vision` reads your `git log` — nothing more.

- No API tokens needed
- No external services called
- Works with GitHub, GitLab, Bitbucket, self-hosted — anything with Git
- Smart defaults filter lock files, binaries, generated code, `node_modules`, `dist`, etc.

### Scoring

- **Hotspot**: `churn x LOC` — high churn + large file = high risk
- **Bus factor**: Authors where one owns >80% of changes
- **Coupling**: `shared_commits / min(total_A, total_B)`
- **Health**: Weighted composite (hotspots 30%, bus factor 25%, coupling 20%, code age 15%, team 10%)

---

## Requirements

- **Node.js >= 18**
- A Git repository with commit history

---

## Author

**[Sounak Das](https://sounakdas.in)**

---

## License

[MIT](LICENSE) - Use it, fork it, ship it.
