/**
 * Monorepo Support (V2)
 *
 * Auto-detects workspaces from package.json, pnpm-workspace.yaml, or lerna.json.
 * Runs analysis independently per workspace so each package gets its own health score.
 *
 * Usage:
 *   git-vision --workspace            # auto-detect all workspaces
 *   git-vision --workspace packages/api  # analyze specific workspace
 */

import { readFileSync, existsSync } from "fs";
import { join, relative } from "path";
import { buildFileSummaries, getRawCommits } from "../git/parser.js";
import { analyzeHotspots } from "./hotspots.js";
import { analyzeBusFactor } from "./busFactor.js";
import { analyzeCoupling } from "./coupling.js";
import { analyzeCodeAge } from "./codeAge.js";
import { analyzeContributors } from "./contributors.js";
import { calculateHealthScore } from "../scoring/healthScore.js";

/**
 * Detect workspaces in the repo.
 */
export function detectWorkspaces(repoPath) {
  const workspaces = [];

  // 1. npm/yarn workspaces (package.json)
  const pkgPath = join(repoPath, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.workspaces) {
        const patterns = Array.isArray(pkg.workspaces)
          ? pkg.workspaces
          : pkg.workspaces.packages || [];
        workspaces.push(...resolveGlobPatterns(repoPath, patterns));
      }
    } catch { /* ignore parse errors */ }
  }

  // 2. pnpm-workspace.yaml
  const pnpmPath = join(repoPath, "pnpm-workspace.yaml");
  if (existsSync(pnpmPath)) {
    try {
      const content = readFileSync(pnpmPath, "utf-8");
      // Simple YAML parsing for packages array
      const matches = content.match(/packages:\s*\n((?:\s+-\s+.+\n?)*)/);
      if (matches) {
        const patterns = matches[1]
          .split("\n")
          .map((l) => l.replace(/^\s*-\s*['"]?/, "").replace(/['"]?\s*$/, ""))
          .filter(Boolean);
        workspaces.push(...resolveGlobPatterns(repoPath, patterns));
      }
    } catch { /* ignore */ }
  }

  // 3. lerna.json
  const lernaPath = join(repoPath, "lerna.json");
  if (existsSync(lernaPath)) {
    try {
      const lerna = JSON.parse(readFileSync(lernaPath, "utf-8"));
      if (lerna.packages) {
        workspaces.push(...resolveGlobPatterns(repoPath, lerna.packages));
      }
    } catch { /* ignore */ }
  }

  // Deduplicate
  const seen = new Set();
  return workspaces.filter((w) => {
    if (seen.has(w.path)) return false;
    seen.add(w.path);
    return true;
  });
}

/**
 * Resolve glob patterns to actual workspace directories.
 */
function resolveGlobPatterns(repoPath, patterns) {
  const { readdirSync, statSync } = await_import_fs();
  const workspaces = [];

  for (const pattern of patterns) {
    // Handle simple patterns like "packages/*"
    const clean = pattern.replace(/\/?\*\*?$/, "");
    const basePath = join(repoPath, clean);

    if (!existsSync(basePath)) continue;

    try {
      const stat = statSync_safe(basePath);
      if (stat && stat.isDirectory()) {
        // Check if the pattern ends with * (meaning list subdirs)
        if (pattern.includes("*")) {
          const entries = readdirSync_safe(basePath);
          for (const entry of entries) {
            const entryPath = join(basePath, entry);
            const entryStat = statSync_safe(entryPath);
            if (entryStat && entryStat.isDirectory()) {
              const pkgJson = join(entryPath, "package.json");
              const name = existsSync(pkgJson)
                ? JSON.parse(readFileSync(pkgJson, "utf-8")).name || entry
                : entry;
              workspaces.push({
                name,
                path: relative(repoPath, entryPath),
                fullPath: entryPath,
              });
            }
          }
        } else {
          // Direct path
          const pkgJson = join(basePath, "package.json");
          const name = existsSync(pkgJson)
            ? JSON.parse(readFileSync(pkgJson, "utf-8")).name || clean
            : clean;
          workspaces.push({
            name,
            path: clean,
            fullPath: basePath,
          });
        }
      }
    } catch { /* skip broken dirs */ }
  }

  return workspaces;
}

// Safe wrappers to avoid import issues
function await_import_fs() {
  return { readdirSync, statSync: statSync_safe };
}

import { readdirSync as readdirSync_safe_import, statSync as statSync_import } from "fs";

function statSync_safe(p) {
  try { return statSync_import(p); } catch { return null; }
}

function readdirSync_safe(p) {
  try { return readdirSync_safe_import(p); } catch { return []; }
}

/**
 * Analyze a monorepo: run full analysis per workspace.
 */
export async function analyzeMonorepo(git, repoPath, getFileLOC, commits, options = {}) {
  let workspaces;

  if (options.workspaces && options.workspaces.length > 0) {
    // Specific workspaces requested
    workspaces = options.workspaces.map((w) => ({
      name: w,
      path: w,
      fullPath: join(repoPath, w),
    }));
  } else {
    // Auto-detect
    workspaces = detectWorkspaces(repoPath);
  }

  if (workspaces.length === 0) {
    return {
      name: "monorepo",
      title: "Monorepo Analysis",
      description: "No workspaces detected. Add workspace config or specify --workspace <path>.",
      workspaces: [],
      detected: false,
    };
  }

  const workspaceReports = [];

  for (const ws of workspaces) {
    // Filter commits to only files in this workspace
    const wsCommits = commits
      .map((c) => ({
        ...c,
        files: c.files.filter((f) => f.path.startsWith(ws.path + "/")),
      }))
      .filter((c) => c.files.length > 0);

    if (wsCommits.length === 0) {
      workspaceReports.push({
        workspace: ws,
        skipped: true,
        reason: "No commits found for this workspace",
      });
      continue;
    }

    const wsSummaries = buildFileSummaries(wsCommits);
    const wsGetLOC = (path) => getFileLOC(path);

    const hotspots = analyzeHotspots(wsSummaries, wsGetLOC, { top: options.top || 5 });
    const busFactor = analyzeBusFactor(wsSummaries, { top: options.top || 5 });
    const coupling = analyzeCoupling(wsCommits, { top: 5 });
    const codeAge = analyzeCodeAge(wsSummaries, { top: 5 });
    const contributors = analyzeContributors(wsSummaries, wsCommits, { top: 5 });
    const healthScore = calculateHealthScore(hotspots, busFactor, coupling, codeAge, contributors);

    workspaceReports.push({
      workspace: ws,
      skipped: false,
      healthScore,
      hotspots,
      busFactor,
      coupling,
      codeAge,
      contributors,
      stats: {
        commits: wsCommits.length,
        files: wsSummaries.size,
        authors: new Set(wsCommits.map((c) => c.author)).size,
      },
    });
  }

  // Sort by health score (worst first)
  workspaceReports.sort((a, b) => {
    if (a.skipped) return 1;
    if (b.skipped) return -1;
    return a.healthScore.overall - b.healthScore.overall;
  });

  return {
    name: "monorepo",
    title: "Monorepo Analysis",
    description: `Analyzed ${workspaces.length} workspace(s) independently`,
    workspaces: workspaceReports,
    detected: true,
    total: workspaces.length,
  };
}
