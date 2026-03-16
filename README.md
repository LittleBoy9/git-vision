# git-vision

**One command. Full picture. Actionable.**

A zero-config CLI that analyzes your Git history to surface risky files, unstable modules, knowledge silos, and hidden dependencies. Based on proven code forensics methodology.

```bash
npx git-vision
```

## Why git-vision?

Your Git history is a goldmine of insights that most teams ignore. `git-vision` mines that data to answer critical questions:

- **Where will the next bug appear?** (Hotspot analysis)
- **What happens if Sarah leaves?** (Bus factor)
- **Why do these unrelated files always break together?** (Change coupling)
- **What code has everyone forgotten about?** (Code age)
- **Who actually owns what?** (Contributor patterns + git blame)
- **Are things getting better or worse?** (Trend tracking)
- **Which package in our monorepo is the riskiest?** (Monorepo support)

No setup. No config files. No GitHub API tokens. Just run it.

## Features

### Hotspot Detection
Files that are both frequently changed AND complex are where bugs are most likely to appear. `git-vision` combines churn frequency with file complexity to rank your riskiest files.

### Bus Factor Analysis
Find files where knowledge is concentrated in one person. If they leave, those files become unmaintainable. `git-vision` flags single-owner files and modules.

### Change Coupling
Discover files that always change together — even across different modules. These hidden dependencies reveal architectural problems your import graph doesn't show.

### Code Age
Identify stale zones (ancient untouched code) and volatile files (sudden change spikes). Both are signals worth investigating.

### Contributor Patterns
See who owns what, how contributions are distributed, and where team fragmentation creates coordination overhead.

### Health Score
A single 0-100 score combining all metrics, with a letter grade and plain-English recommendations.

### True Ownership via Git Blame (V2)
Goes beyond commit counts to line-level ownership. Answers "who actually wrote the code that exists today?" — more accurate than commit history alone.

```bash
npx git-vision --blame
npx git-vision blame
```

### Trend Tracking (V2)
Compare two time periods to see if your codebase is getting healthier or worse. Tracks hotspot movement, bus factor changes, churn velocity, and contributor flow.

```bash
npx git-vision --compare 3months    # last 3 months vs previous 3 months
npx git-vision trends               # default: 3 months
npx git-vision trends --compare 6months
```

### Treemap Visualization (V2)
The HTML report includes an interactive treemap where rectangle size = complexity and color = risk. Hover for details.

```bash
npx git-vision --format html
```

### Monorepo Support (V2)
Auto-detects workspaces (npm, yarn, pnpm, lerna) and analyzes each package independently with its own health score.

```bash
npx git-vision --workspace           # auto-detect workspaces
npx git-vision --workspace packages/api  # specific workspace
npx git-vision monorepo              # full monorepo report
```

### Config File Support (V2)
Create a `.gitvisionrc` or `.gitvisionrc.json` in your repo root to set team defaults:

```json
{
  "format": "terminal",
  "top": 15,
  "ignore": ["*.test.js", "dist/**", "node_modules/**"],
  "thresholds": {
    "busFactor": { "ownershipThreshold": 0.8 },
    "coupling": { "minSharedCommits": 5, "minCouplingDegree": 0.3 },
    "healthScore": { "critical": 40 }
  },
  "blame": { "enabled": true, "maxFiles": 50 },
  "monorepo": { "enabled": false }
}
```

## Usage

```bash
# Full analysis (all modules)
npx git-vision

# Individual analyzers
npx git-vision hotspots
npx git-vision coupling
npx git-vision bus-factor
npx git-vision age
npx git-vision contributors
npx git-vision blame          # V2: line-level ownership
npx git-vision trends         # V2: period comparison
npx git-vision monorepo       # V2: per-workspace analysis

# Options
npx git-vision --format json          # CI-friendly JSON output
npx git-vision --format html          # HTML report with treemap
npx git-vision --top 20               # Show top 20 results (default: 10)
npx git-vision --since 6months        # Limit analysis window
npx git-vision --ignore "*.test.js,dist/**"  # Exclude patterns
npx git-vision --path /path/to/repo   # Analyze a different repo
npx git-vision --blame                # Enable git blame analysis
npx git-vision --compare 3months      # Compare time periods
npx git-vision --workspace            # Enable monorepo mode
```

## Output Formats

### Terminal (default)
Beautiful, color-coded tables with risk bars, health scores, and recommendations. Designed for human readability.

### JSON (`--format json`)
Structured JSON for CI/CD pipelines. Exit code 1 when health score < 40 (critical).

```json
{
  "healthScore": {
    "overall": 72,
    "grade": "B",
    "recommendations": [...]
  },
  "hotspots": { "results": [...] },
  "busFactor": { "results": [...] },
  "trends": { "overallDirection": "improving", ... }
}
```

### HTML (`--format html`)
Self-contained HTML report with dark theme, interactive treemap, and visual breakdowns. Opens automatically in your browser.

## CI/CD Integration

`git-vision` exits with code 1 when the health score drops below 40 (critical), making it easy to add as a CI check:

```yaml
# GitHub Actions
- name: Repository Health Check
  run: npx git-vision --format json
```

## How It Works

`git-vision` analyzes your `git log` data — nothing more. It doesn't need API tokens, doesn't call any external services, and works with any Git repository (GitHub, GitLab, Bitbucket, self-hosted — doesn't matter).

The analysis is based on research from Adam Tornhill's "Your Code as a Crime Scene" — using forensic techniques on version control data to predict where defects will cluster.

### Scoring

- **Hotspot score**: `churn_frequency x lines_of_code` — high churn + large file = high risk
- **Bus factor**: Files where one author owns >80% of changes
- **Coupling degree**: `shared_commits / min(total_commits_A, total_commits_B)`
- **Health score**: Weighted composite (hotspots 30%, bus factor 25%, coupling 20%, code age 15%, team 10%)

## Requirements

- Node.js >= 18
- A Git repository with commit history

## License

MIT
