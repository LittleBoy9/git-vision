/**
 * Health Score Engine
 *
 * Computes a 0-100 repo health score from all analyzer outputs
 * and generates plain-English recommendations.
 */

export function calculateHealthScore(hotspots, busFactor, coupling, codeAge, contributors) {
  const scores = {};
  const recommendations = [];

  // 1. Hotspot score (30% weight)
  // Fewer high-risk hotspots = better
  const hotspotRatio = hotspots.stats.totalFilesAnalyzed > 0
    ? hotspots.stats.highRisk / hotspots.stats.totalFilesAnalyzed
    : 0;
  scores.hotspots = Math.max(0, Math.round((1 - hotspotRatio * 10) * 100));

  if (hotspots.stats.highRisk > 0) {
    const topHotspot = hotspots.results[0];
    if (topHotspot) {
      recommendations.push({
        severity: "high",
        message: `${topHotspot.path} is your #1 hotspot (changed ${topHotspot.churn} times, ${topHotspot.loc} lines). Consider splitting it into smaller modules.`,
      });
    }
    if (hotspots.stats.highRisk > 3) {
      recommendations.push({
        severity: "medium",
        message: `${hotspots.stats.highRisk} files are high-risk hotspots. Prioritize refactoring the top 3.`,
      });
    }
  }

  // 2. Bus factor score (25% weight)
  // Fewer risky files = better
  scores.busFactor = Math.max(0, 100 - busFactor.stats.riskyPercentage * 2);

  if (busFactor.stats.riskyFiles > 0) {
    const topRisk = busFactor.results[0];
    if (topRisk && topRisk.topOwner) {
      recommendations.push({
        severity: "high",
        message: `${busFactor.stats.riskyFiles} files have a bus factor of 1. Add a second maintainer to critical files like ${topRisk.path} (${Math.round(topRisk.topOwner.percentage * 100)}% owned by ${topRisk.topOwner.author}).`,
      });
    }
  }

  // 3. Coupling score (20% weight)
  // Fewer cross-module couplings = better architecture
  const crossModuleRatio = coupling.total > 0
    ? coupling.stats.crossModuleCouplings / coupling.total
    : 0;
  scores.coupling = Math.max(0, Math.round((1 - crossModuleRatio) * 100));

  if (coupling.stats.crossModuleCouplings > 0 && coupling.results.length > 0) {
    const topCoupling = coupling.results[0];
    recommendations.push({
      severity: "medium",
      message: `${topCoupling.fileA} and ${topCoupling.fileB} change together ${topCoupling.degreePercent}% of the time. Consider extracting shared logic or merging them.`,
    });
  }

  // 4. Code age score (15% weight)
  // Balance: some stale code is fine, too much is risky
  const staleRatio = codeAge.total > 0
    ? (codeAge.stats.ancient + codeAge.stats.stale) / codeAge.total
    : 0;
  scores.codeAge = Math.max(0, Math.round((1 - staleRatio) * 100));

  if (codeAge.stats.ancient > 5) {
    recommendations.push({
      severity: "low",
      message: `${codeAge.stats.ancient} files haven't been touched in over a year. Review if they're still needed or need updating.`,
    });
  }

  if (codeAge.stats.volatile > 0 && codeAge.volatileFiles.length > 0) {
    recommendations.push({
      severity: "medium",
      message: `${codeAge.volatileFiles[0].path} has a sudden spike in changes (${codeAge.volatileFiles[0].recentCommits} commits in last 30 days vs ${codeAge.volatileFiles[0].avgMonthlyChurn}/month average). Keep an eye on it.`,
    });
  }

  // 5. Contributor distribution score (10% weight)
  scores.contributors = contributors.stats.highFragmentation > 0
    ? Math.max(0, 100 - contributors.stats.highFragmentation * 15)
    : 85; // default good if no fragmentation

  if (contributors.stats.highFragmentation > 2) {
    recommendations.push({
      severity: "low",
      message: `${contributors.stats.highFragmentation} modules have high contributor fragmentation. Consider assigning clearer ownership.`,
    });
  }

  // Weighted overall score
  const overall = Math.round(
    scores.hotspots * 0.30 +
    scores.busFactor * 0.25 +
    scores.coupling * 0.20 +
    scores.codeAge * 0.15 +
    scores.contributors * 0.10
  );

  // Sort recommendations by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    overall: Math.min(100, Math.max(0, overall)),
    scores,
    grade: getGrade(overall),
    recommendations: recommendations.slice(0, 7), // top 7 recommendations
  };
}

function getGrade(score) {
  if (score >= 90) return { letter: "A", label: "Excellent", color: "green" };
  if (score >= 75) return { letter: "B", label: "Good", color: "green" };
  if (score >= 60) return { letter: "C", label: "Fair", color: "yellow" };
  if (score >= 40) return { letter: "D", label: "Needs Work", color: "red" };
  return { letter: "F", label: "Critical", color: "red" };
}
