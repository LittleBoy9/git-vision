/**
 * Hotspot Analysis
 *
 * Identifies files that are both frequently changed (high churn) AND complex (large).
 * Based on Adam Tornhill's methodology: risk = churn × complexity.
 * These files are statistically where bugs are most likely to appear.
 */

export function analyzeHotspots(fileSummaries, getFileLOC, options = {}) {
  const top = options.top || 10;
  const results = [];

  for (const [path, summary] of fileSummaries) {
    const loc = getFileLOC(path);

    // Skip files with no LOC (deleted or binary)
    if (loc.total === 0) continue;

    // Hotspot score: churn × lines of code (non-empty)
    // Normalized later for display
    const score = summary.churn * loc.nonEmpty;

    results.push({
      path,
      score,
      churn: summary.churn,
      loc: loc.nonEmpty,
      totalLines: loc.total,
      authors: summary.authors.size,
      lastModified: summary.lastModified,
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
