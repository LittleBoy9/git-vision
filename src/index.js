import { createParser, getRawCommits, buildFileSummaries } from "./git/parser.js";
import { analyzeHotspots } from "./analyzers/hotspots.js";
import { analyzeBusFactor } from "./analyzers/busFactor.js";
import { analyzeCoupling } from "./analyzers/coupling.js";
import { analyzeCodeAge } from "./analyzers/codeAge.js";
import { analyzeContributors } from "./analyzers/contributors.js";
import { calculateHealthScore } from "./scoring/healthScore.js";
import { formatTerminal } from "./formatters/terminal.js";
import { formatJSON } from "./formatters/json.js";
import { formatHTML, writeAndOpenHTML } from "./formatters/html.js";

/**
 * Main orchestrator for git-vision.
 * Runs all (or selected) analyzers and formats the output.
 */

export async function analyze(options = {}) {
  const parser = await createParser(options.repoPath);
  const repoStats = await parser.getRepoStats();

  // Get commits from git log
  const commits = await getRawCommits(parser.git, {
    since: options.since,
    ignore: options.ignore,
  });

  if (commits.length === 0) {
    throw new Error("No commits found. Make sure you're in a git repository with commit history.");
  }

  // Build shared file summaries
  const fileSummaries = buildFileSummaries(commits);

  // Determine which analyzers to run
  const module = options.module; // if specified, run only one
  const report = { repoStats };

  if (!module || module === "hotspots") {
    report.hotspots = analyzeHotspots(
      fileSummaries,
      (path) => parser.getFileLOC(path),
      { top: options.top }
    );
  }

  if (!module || module === "bus-factor") {
    report.busFactor = analyzeBusFactor(fileSummaries, { top: options.top });
  }

  if (!module || module === "coupling") {
    report.coupling = analyzeCoupling(commits, {
      top: options.top,
      minSharedCommits: options.minSharedCommits,
      minCouplingDegree: options.minCouplingDegree,
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

  // Calculate health score (only if all analyzers ran)
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
