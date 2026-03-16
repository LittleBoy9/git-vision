/**
 * Hotspot Analysis
 *
 * Identifies files that are both frequently changed (high churn) AND complex (large).
 * Based on Adam Tornhill's methodology: risk = churn × complexity.
 * These files are statistically where bugs are most likely to appear.
 */

import { isHotspotExcluded } from "../config/ignores.js";

// Test file patterns — tracked but scored lower
const TEST_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /__tests__\//,
  /\.stories\.[jt]sx?$/,
  /\.e2e\.[jt]sx?$/,
  /test\//,
  /tests\//,
  /spec\//,
];

function isTestFile(path) {
  return TEST_PATTERNS.some((p) => p.test(path));
}

export function analyzeHotspots(fileSummaries, getFileLOC, options = {}) {
  const top = options.top || 10;
  const results = [];

  for (const [path, summary] of fileSummaries) {
    // Skip config files that are always noise in hotspot analysis
    if (isHotspotExcluded(path)) continue;

    const loc = getFileLOC(path);

    // Skip files with no LOC (deleted or binary)
    if (loc.total === 0) continue;

    // Hotspot score: churn × lines of code (non-empty)
    let score = summary.churn * loc.nonEmpty;

    // Dampen test files — they churn a lot but are low risk
    const isTest = isTestFile(path);
    if (isTest) {
      score = Math.round(score * 0.3);
    }

    results.push({
      path,
      score,
      churn: summary.churn,
      loc: loc.nonEmpty,
      totalLines: loc.total,
      authors: summary.authors.size,
      lastModified: summary.lastModified,
      isTest,
    });
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Normalize scores to 0-100 scale
  const maxScore = results.length > 0 ? results[0].score : 1;
  for (const r of results) {
    r.normalizedScore = Math.round((r.score / maxScore) * 100);
  }

  return {
    name: "hotspots",
    title: "Hotspots",
    description: "Files with highest combined churn and complexity (most likely to contain bugs)",
    results: results.slice(0, top),
    total: results.length,
    stats: {
      totalFilesAnalyzed: results.length,
      highRisk: results.filter((r) => r.normalizedScore >= 70).length,
      mediumRisk: results.filter((r) => r.normalizedScore >= 30 && r.normalizedScore < 70).length,
      lowRisk: results.filter((r) => r.normalizedScore < 30).length,
    },
  };
}
