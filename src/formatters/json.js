/**
 * JSON Formatter
 * Outputs structured JSON for CI/CD pipelines and programmatic consumption.
 */

export function formatJSON(report) {
  const output = {
    version: "2.0.0",
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

  // V2 sections
  if (report.blame) {
    output.blame = {
      results: report.blame.results.map((r) => ({
        path: r.path,
        totalLines: r.totalLines,
        trueOwner: r.trueOwner,
        busFactor: r.busFactor,
        authors: r.authors,
      })),
      globalAuthors: report.blame.globalAuthors,
      stats: report.blame.stats,
    };
  }

  if (report.trends) {
    output.trends = {
      overallDirection: report.trends.overallDirection,
      period: report.trends.period,
      hotspotTrends: report.trends.hotspotTrends,
      churn: report.trends.churn,
      busFactor: report.trends.busFactor,
      contributors: report.trends.contributors,
      stats: report.trends.stats,
    };
  }

  if (report.monorepo) {
    output.monorepo = {
      detected: report.monorepo.detected,
      total: report.monorepo.total,
      workspaces: (report.monorepo.workspaces || []).map((ws) => ({
        name: ws.workspace.name,
        path: ws.workspace.path,
        skipped: ws.skipped,
        healthScore: ws.skipped ? null : ws.healthScore?.overall,
        grade: ws.skipped ? null : ws.healthScore?.grade?.letter,
        stats: ws.stats || null,
      })),
    };
  }

  if (report.branches) {
    output.branches = {
      currentBranch: report.branches.currentBranch,
      branches: report.branches.branches.map((b) => ({
        name: b.name,
        type: b.type,
        creator: b.creator,
        createdAt: b.createdAt,
        lastActivity: b.lastActivity,
        aheadCount: b.aheadCount,
        lifespan: b.lifespan,
        isMerged: b.isMerged,
      })),
      mergeGraph: report.branches.mergeGraph,
      graphLayout: report.branches.graphLayout || null,
      staleBranches: report.branches.staleBranches.map((b) => ({
        name: b.name,
        creator: b.creator,
        lastActivity: b.lastActivity,
        lifespan: b.lifespan,
      })),
      creators: report.branches.creators,
      stats: report.branches.stats,
    };
  }

  if (report.diff) {
    output.diff = {
      riskScore: report.diff.riskScore,
      riskLevel: report.diff.riskLevel,
      base: report.diff.base,
      head: report.diff.head,
      changedFiles: report.diff.changedFiles.map((f) => ({
        path: f.path,
        additions: f.additions,
        deletions: f.deletions,
        hotspotScore: f.hotspotScore,
        busFactor: f.busFactor,
        isHotspot: f.isHotspot,
        isBusFactorRisk: f.isBusFactorRisk,
        risks: f.risks,
      })),
      risks: report.diff.risks,
      stats: report.diff.stats,
    };
  }

  return JSON.stringify(output, null, 2);
}
