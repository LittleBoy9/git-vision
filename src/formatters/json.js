/**
 * JSON Formatter
 * Outputs structured JSON for CI/CD pipelines and programmatic consumption.
 */

export function formatJSON(report) {
  const output = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    repository: {
      branch: report.repoStats.currentBranch,
      totalCommits: report.repoStats.totalCommits,
      totalAuthors: report.repoStats.totalAuthors,
    },
  };

  if (report.healthScore) {
    output.healthScore = {
      overall: report.healthScore.overall,
      grade: report.healthScore.grade.letter,
      label: report.healthScore.grade.label,
      breakdown: report.healthScore.scores,
      recommendations: report.healthScore.recommendations,
    };
  }

  if (report.hotspots) {
    output.hotspots = {
      results: report.hotspots.results,
      stats: report.hotspots.stats,
    };
  }

  if (report.busFactor) {
    output.busFactor = {
      results: report.busFactor.results.map((r) => ({
        path: r.path,
        busFactor: r.busFactor,
        topOwner: r.topOwner,
        isRisky: r.isRisky,
      })),
      modules: report.busFactor.modules,
      stats: report.busFactor.stats,
    };
  }

  if (report.coupling) {
    output.coupling = {
      results: report.coupling.results,
      stats: report.coupling.stats,
    };
  }

  if (report.codeAge) {
    output.codeAge = {
      staleFiles: report.codeAge.staleFiles,
      volatileFiles: report.codeAge.volatileFiles,
      stats: report.codeAge.stats,
    };
  }

  if (report.contributors) {
    output.contributors = {
      topContributors: report.contributors.topContributors,
      modules: report.contributors.modules,
      stats: report.contributors.stats,
    };
  }

  return JSON.stringify(output, null, 2);
}
