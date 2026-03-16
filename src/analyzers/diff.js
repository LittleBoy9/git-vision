/**
 * Diff / PR Risk Analysis
 *
 * Analyzes a branch diff against a base branch and scores the risk.
 * Answers: "How dangerous is this PR?"
 *
 * Risk factors:
 * - Touches hotspot files (high churn × complexity)
 * - Touches bus-factor-1 files (knowledge silo)
 * - Touches coupled files without their partners
 * - Large diff size
 * - Many files changed
 *
 * Usage: git-vision diff main
 *        git-vision diff main..feature-branch
 */

import { getRawCommits, buildFileSummaries } from "../git/parser.js";
import { analyzeHotspots } from "./hotspots.js";
import { analyzeBusFactor } from "./busFactor.js";
import { analyzeCoupling } from "./coupling.js";

export async function analyzeDiff(git, getFileLOC, options = {}) {
  const target = options.target || "main";

  // Parse target: could be "main", "main..feature", or just a branch name
  let base, head;
  if (target.includes("..")) {
    [base, head] = target.split("..");
  } else {
    base = target;
    head = "HEAD";
  }

  // Get files changed in this diff
  const diffRaw = await git.raw(["diff", "--numstat", `${base}...${head}`]);
  const changedFiles = parseDiffNumstat(diffRaw);

  if (changedFiles.length === 0) {
    return {
      name: "diff",
      title: "PR Risk Analysis",
      description: `No changes found between ${base} and ${head}`,
      riskScore: 0,
      riskLevel: "none",
      changedFiles: [],
      risks: [],
      stats: { filesChanged: 0, totalAdditions: 0, totalDeletions: 0 },
    };
  }

  // Get full repo history to build context
  const allCommits = await getRawCommits(git, { ignore: options.ignore });
  const fileSummaries = buildFileSummaries(allCommits, options.ignore || []);

  // Run analyzers on full history for context
  const hotspots = analyzeHotspots(fileSummaries, getFileLOC, { top: 100 });
  const busFactor = analyzeBusFactor(fileSummaries, { top: 1000 });
  const coupling = analyzeCoupling(allCommits, { top: 100 });

  // Build hotspot and bus factor lookups
  const hotspotMap = new Map(hotspots.results.map((r) => [r.path, r]));
  const busFactorMap = new Map(busFactor.results.map((r) => [r.path, r]));
  const couplingPairs = coupling.results;

  // Analyze each changed file
  const risks = [];
  let totalRiskScore = 0;

  const fileAnalysis = changedFiles.map((file) => {
    const hotspot = hotspotMap.get(file.path);
    const bf = busFactorMap.get(file.path);
    const fileRisks = [];

    // Risk: touching a hotspot
    if (hotspot && hotspot.normalizedScore >= 50) {
      fileRisks.push({
        type: "hotspot",
        severity: hotspot.normalizedScore >= 70 ? "high" : "medium",
        message: `Hotspot file (risk score ${hotspot.normalizedScore}/100, changed ${hotspot.churn} times)`,
      });
      totalRiskScore += hotspot.normalizedScore;
    }

    // Risk: touching a bus-factor-1 file
    if (bf && bf.isRisky && bf.busFactor === 1) {
      fileRisks.push({
        type: "bus-factor",
        severity: "high",
        message: `Bus factor 1 — ${bf.topOwner?.author} owns ${Math.round((bf.topOwner?.percentage || 0) * 100)}%`,
      });
      totalRiskScore += 40;
    }

    // Risk: large change to single file
    const totalLines = file.additions + file.deletions;
    if (totalLines > 300) {
      fileRisks.push({
        type: "size",
        severity: totalLines > 500 ? "high" : "medium",
        message: `Large change: +${file.additions}/-${file.deletions} lines`,
      });
      totalRiskScore += Math.min(totalLines / 10, 30);
    }

    return {
      ...file,
      hotspotScore: hotspot?.normalizedScore || 0,
      busFactor: bf?.busFactor || null,
      isHotspot: hotspot && hotspot.normalizedScore >= 50,
      isBusFactorRisk: bf?.isRisky && bf.busFactor === 1,
      risks: fileRisks,
    };
  });

  // Risk: touching coupled files without their partners
  const changedPaths = new Set(changedFiles.map((f) => f.path));
  for (const c of couplingPairs) {
    const hasA = changedPaths.has(c.fileA);
    const hasB = changedPaths.has(c.fileB);
    if ((hasA && !hasB) || (!hasA && hasB)) {
      const missing = hasA ? c.fileB : c.fileA;
      const present = hasA ? c.fileA : c.fileB;
      risks.push({
        type: "coupling",
        severity: c.degree >= 0.7 ? "high" : "medium",
        message: `${present} usually changes with ${missing} (${c.degreePercent}% coupling) — missing from this PR`,
      });
      totalRiskScore += c.degree * 30;
    }
  }

  // Risk: too many files
  if (changedFiles.length > 20) {
    risks.push({
      type: "scope",
      severity: changedFiles.length > 50 ? "high" : "medium",
      message: `Large PR: ${changedFiles.length} files changed. Consider splitting.`,
    });
    totalRiskScore += Math.min(changedFiles.length, 40);
  }

  // Collect file-level risks into global risks list
  for (const file of fileAnalysis) {
    for (const r of file.risks) {
      risks.push({ ...r, file: file.path });
    }
  }

  // Sort risks by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Normalize risk score to 0-100
  const maxPossible = changedFiles.length * 100 + 100;
  const normalizedRisk = Math.min(100, Math.round((totalRiskScore / Math.max(maxPossible, 1)) * 100));
  const riskLevel =
    normalizedRisk >= 70 ? "critical" :
    normalizedRisk >= 40 ? "high" :
    normalizedRisk >= 20 ? "medium" : "low";

  // Summary stats
  const totalAdditions = changedFiles.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = changedFiles.reduce((s, f) => s + f.deletions, 0);
  const hotspotsHit = fileAnalysis.filter((f) => f.isHotspot).length;
  const busFactorRisks = fileAnalysis.filter((f) => f.isBusFactorRisk).length;

  // Sort files: riskiest first
  fileAnalysis.sort((a, b) => b.hotspotScore - a.hotspotScore);

  return {
    name: "diff",
    title: "PR Risk Analysis",
    description: `Analyzing ${base}...${head}`,
    riskScore: normalizedRisk,
    riskLevel,
    base,
    head,
    changedFiles: fileAnalysis,
    risks,
    stats: {
      filesChanged: changedFiles.length,
      totalAdditions,
      totalDeletions,
      hotspotsHit,
      busFactorRisks,
      couplingWarnings: risks.filter((r) => r.type === "coupling").length,
    },
  };
}

function parseDiffNumstat(raw) {
  if (!raw || !raw.trim()) return [];

  return raw
    .trim()
    .split("\n")
    .map((line) => {
      const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
      if (!match) return null;
      return {
        additions: match[1] === "-" ? 0 : parseInt(match[1], 10),
        deletions: match[2] === "-" ? 0 : parseInt(match[2], 10),
        path: match[3],
      };
    })
    .filter(Boolean);
}
