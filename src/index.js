import { createParser, getRawCommits, buildFileSummaries } from "./git/parser.js";
import { analyzeHotspots } from "./analyzers/hotspots.js";
import { analyzeBusFactor } from "./analyzers/busFactor.js";
import { analyzeCoupling } from "./analyzers/coupling.js";
import { analyzeCodeAge } from "./analyzers/codeAge.js";
import { analyzeContributors } from "./analyzers/contributors.js";
import { analyzeBlame } from "./analyzers/blame.js";
import { analyzeKnowledgeLoss } from "./analyzers/knowledgeLoss.js";
import { analyzeTrends } from "./analyzers/trends.js";
import { analyzeMonorepo } from "./analyzers/monorepo.js";
import { analyzeDiff } from "./analyzers/diff.js";
import { analyzeBranches } from "./analyzers/branches.js";
import { calculateHealthScore } from "./scoring/healthScore.js";
import { loadConfig, mergeConfig } from "./config/loader.js";
import { formatTerminal } from "./formatters/terminal.js";
import { formatJSON } from "./formatters/json.js";
import { formatHTML, writeAndOpenHTML } from "./formatters/html.js";

/**
 * Main orchestrator for git-vision.
 * Runs all (or selected) analyzers and formats the output.
 */

export async function analyze(cliOpts = {}) {
  const repoPath = cliOpts.repoPath || process.cwd();

  // Load and merge config: defaults < .gitvisionrc < CLI flags
  const fileConfig = loadConfig(repoPath);
  const options = mergeConfig(cliOpts, fileConfig);

  const parser = await createParser(repoPath);
  const repoStats = await parser.getRepoStats();

  if (fileConfig._configFile) {
    repoStats.configFile = fileConfig._configFile;
  }

  // --- Diff mode (separate flow) ---
  if (options.module === "diff" && options.diffTarget) {
    const report = { repoStats };
    report.diff = await analyzeDiff(parser.git, (path) => parser.getFileLOC(path), {
      target: options.diffTarget,
      ignore: options.ignore,
    });
    return report;
  }

  // --- Branch graph mode (separate flow, no commit parsing needed) ---
  if (options.module === "branches") {
    const report = { repoStats };
    report.branches = await analyzeBranches(parser.git, { top: options.top });
    return report;
  }

  // Get commits from git log
  const commits = await getRawCommits(parser.git, {
    since: options.since,
    ignore: options.ignore,
  });

  if (commits.length === 0) {
    throw new Error("No commits found. Make sure you're in a git repository with commit history.");
  }

  // Build shared file summaries (with smart default ignores)
  const fileSummaries = buildFileSummaries(commits, options.ignore || []);

  const module = options.module;
  const report = { repoStats };

  // --- Core Analyzers ---

  if (!module || module === "hotspots") {
    report.hotspots = analyzeHotspots(
      fileSummaries,
      (path) => parser.getFileLOC(path),
      { top: options.top }
    );
  }

  if (!module || module === "bus-factor") {
    report.busFactor = analyzeBusFactor(fileSummaries, {
      top: options.top,
      ownershipThreshold: options.thresholds?.busFactor?.ownershipThreshold,
      minCommits: options.thresholds?.busFactor?.minCommits,
    });
  }

  if (!module || module === "coupling") {
    report.coupling = analyzeCoupling(commits, {
      top: options.top,
      minSharedCommits: options.thresholds?.coupling?.minSharedCommits,
      minCouplingDegree: options.thresholds?.coupling?.minCouplingDegree,
    });
  }

  if (!module || module === "age") {
    report.codeAge = analyzeCodeAge(fileSummaries, { top: options.top });
  }

  if (!module || module === "contributors") {
    report.contributors = analyzeContributors(fileSummaries, commits, {
      top: options.top,
    });
  }

  if (!module || module === "knowledge-loss") {
    report.knowledgeLoss = analyzeKnowledgeLoss(fileSummaries, commits, {
      top: options.top,
    });
  }

  // --- V2: Git Blame ---

  if ((!module || module === "blame") && options.blame?.enabled) {
    const filesToBlame = report.hotspots
      ? report.hotspots.results.map((r) => r.path)
      : [...fileSummaries.keys()].slice(0, options.blame.maxFiles);

    report.blame = await analyzeBlame(parser.git, filesToBlame, {
      maxFiles: options.blame.maxFiles,
      onProgress: options.onBlameProgress,
    });
  }

  // --- V2: Trend Tracking ---

  if (module === "trends" || options.compare) {
    report.trends = await analyzeTrends(parser.git, (path) => parser.getFileLOC(path), {
      compare: options.compare,
      ignore: options.ignore,
    });
  }

  // --- V2: Monorepo Analysis ---

  if (module === "monorepo" || options.monorepo?.enabled) {
    report.monorepo = await analyzeMonorepo(
      parser.git,
      repoPath,
      (path) => parser.getFileLOC(path),
      commits,
      {
        workspaces: options.monorepo?.workspaces,
        top: options.top,
      }
    );
  }

  // Calculate health score (only if all core analyzers ran)
  if (!module && report.hotspots && report.busFactor && report.coupling && report.codeAge && report.contributors) {
    report.healthScore = calculateHealthScore(
      report.hotspots,
      report.busFactor,
      report.coupling,
      report.codeAge,
      report.contributors
    );
  }

  return report;
}

export async function formatReport(report, format = "terminal") {
  switch (format) {
    case "json":
      return formatJSON(report);
    case "html": {
      const filePath = await writeAndOpenHTML(report);
      return `HTML report saved and opened: ${filePath}`;
    }
    case "terminal":
    default:
      return formatTerminal(report);
  }
}
