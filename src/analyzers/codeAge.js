/**
 * Code Age Analysis
 *
 * Identifies stale zones (untouched code) and volatile files (recent change spikes).
 * Old, untouched code isn't necessarily bad — but old, complex, untouched code
 * can be a maintenance time bomb.
 */

export function analyzeCodeAge(fileSummaries, options = {}) {
  const top = options.top || 10;
  const now = new Date();

  const results = [];

  for (const [path, summary] of fileSummaries) {
    if (!summary.lastModified || !summary.firstSeen) continue;

    const daysSinceLastChange = Math.floor(
      (now - summary.lastModified) / (1000 * 60 * 60 * 24)
    );
    const ageInDays = Math.floor(
      (now - summary.firstSeen) / (1000 * 60 * 60 * 24)
    );

    // Calculate recent activity (last 30 days vs overall)
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const recentCommits = summary.commits.filter(
      (c) => c.date >= thirtyDaysAgo
    ).length;

    // Detect volatility: recent changes vs average rate
    const monthsAlive = Math.max(ageInDays / 30, 1);
    const avgMonthlyChurn = summary.churn / monthsAlive;
    const isVolatile = recentCommits > avgMonthlyChurn * 2 && recentCommits >= 3;

    // Staleness categories
    let status;
    if (daysSinceLastChange > 365) status = "ancient";
    else if (daysSinceLastChange > 180) status = "stale";
    else if (daysSinceLastChange > 90) status = "aging";
    else if (isVolatile) status = "volatile";
    else status = "active";

    results.push({
      path,
      ageInDays,
      daysSinceLastChange,
      firstSeen: summary.firstSeen,
      lastModified: summary.lastModified,
      totalChurn: summary.churn,
      recentCommits,
      avgMonthlyChurn: +avgMonthlyChurn.toFixed(1),
      isVolatile,
      status,
      authors: summary.authors.size,
    });
  }

  // Separate into categories
  const staleFiles = results
    .filter((r) => ["ancient", "stale"].includes(r.status))
    .sort((a, b) => b.daysSinceLastChange - a.daysSinceLastChange);

  const volatileFiles = results
    .filter((r) => r.isVolatile)
    .sort((a, b) => b.recentCommits - a.recentCommits);

  const statusCounts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return {
    name: "codeAge",
    title: "Code Age",
    description: "Stale zones and volatile files — untouched code and sudden change spikes",
    staleFiles: staleFiles.slice(0, top),
    volatileFiles: volatileFiles.slice(0, top),
    total: results.length,
    stats: {
      totalFilesAnalyzed: results.length,
      ancient: statusCounts.ancient || 0,
      stale: statusCounts.stale || 0,
      aging: statusCounts.aging || 0,
      active: statusCounts.active || 0,
      volatile: statusCounts.volatile || 0,
    },
  };
}
