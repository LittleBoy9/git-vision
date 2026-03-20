import { describe, it } from "node:test";
import assert from "node:assert";
import { calculateHealthScore } from "../src/scoring/healthScore.js";

// Helper to create minimal analyzer outputs
function makeHotspots(overrides = {}) {
  return {
    results: [],
    stats: {
      totalFilesAnalyzed: 10,
      highRisk: 0,
      mediumRisk: 3,
      lowRisk: 7,
    },
    ...overrides,
  };
}

function makeBusFactor(overrides = {}) {
  return {
    results: [],
    stats: {
      totalFilesAnalyzed: 10,
      riskyFiles: 0,
      riskyPercentage: 0,
      avgBusFactor: 3,
    },
    ...overrides,
  };
}

function makeCoupling(overrides = {}) {
  return {
    results: [],
    total: 0,
    stats: {
      totalPairsAnalyzed: 10,
      significantCouplings: 0,
      crossModuleCouplings: 0,
      withinModuleCouplings: 0,
    },
    ...overrides,
  };
}

function makeCodeAge(overrides = {}) {
  return {
    staleFiles: [],
    volatileFiles: [],
    total: 10,
    stats: {
      totalFilesAnalyzed: 10,
      ancient: 0,
      stale: 0,
      aging: 2,
      active: 8,
      volatile: 0,
    },
    ...overrides,
  };
}

function makeContributors(overrides = {}) {
  return {
    modules: [],
    topContributors: [],
    stats: {
      totalModules: 3,
      totalContributors: 5,
      totalCommits: 100,
      highFragmentation: 0,
    },
    ...overrides,
  };
}

describe("Health Score", () => {
  it("score is between 0 and 100", () => {
    const result = calculateHealthScore(
      makeHotspots(),
      makeBusFactor(),
      makeCoupling(),
      makeCodeAge(),
      makeContributors()
    );

    assert.ok(result.overall >= 0);
    assert.ok(result.overall <= 100);
  });

  it("grade matches score range", () => {
    // Healthy repo: no risks
    const healthy = calculateHealthScore(
      makeHotspots(),
      makeBusFactor(),
      makeCoupling(),
      makeCodeAge(),
      makeContributors()
    );

    assert.ok(healthy.overall >= 75);
    assert.ok(["A", "B"].includes(healthy.grade.letter));

    // Unhealthy repo: lots of risks
    const unhealthy = calculateHealthScore(
      makeHotspots({
        results: [{ path: "bad.js", churn: 50, loc: 1000 }],
        stats: { totalFilesAnalyzed: 10, highRisk: 8, mediumRisk: 2, lowRisk: 0 },
      }),
      makeBusFactor({
        results: [{ path: "bad.js", topOwner: { author: "A", percentage: 0.95 } }],
        stats: { totalFilesAnalyzed: 10, riskyFiles: 8, riskyPercentage: 80, avgBusFactor: 1 },
      }),
      makeCoupling({
        results: [{ fileA: "a.js", fileB: "b.js", degreePercent: 90 }],
        total: 5,
        stats: {
          totalPairsAnalyzed: 20,
          significantCouplings: 5,
          crossModuleCouplings: 5,
          withinModuleCouplings: 0,
        },
      }),
      makeCodeAge({
        total: 10,
        stats: { totalFilesAnalyzed: 10, ancient: 7, stale: 2, aging: 1, active: 0, volatile: 0 },
      }),
      makeContributors({
        stats: { totalModules: 5, totalContributors: 20, totalCommits: 500, highFragmentation: 4 },
      })
    );

    assert.ok(unhealthy.overall < 50);
    assert.ok(["D", "F"].includes(unhealthy.grade.letter));
  });

  it("known healthy inputs produce score >= 80", () => {
    const result = calculateHealthScore(
      makeHotspots({ stats: { totalFilesAnalyzed: 20, highRisk: 0, mediumRisk: 2, lowRisk: 18 } }),
      makeBusFactor({ stats: { totalFilesAnalyzed: 20, riskyFiles: 0, riskyPercentage: 0, avgBusFactor: 4 } }),
      makeCoupling({ total: 2, stats: { totalPairsAnalyzed: 50, significantCouplings: 2, crossModuleCouplings: 0, withinModuleCouplings: 2 } }),
      makeCodeAge({ total: 20, stats: { totalFilesAnalyzed: 20, ancient: 0, stale: 1, aging: 3, active: 16, volatile: 0 } }),
      makeContributors({ stats: { totalModules: 4, totalContributors: 6, totalCommits: 200, highFragmentation: 0 } })
    );

    assert.ok(result.overall >= 80);
  });

  it("recommendations are generated for risky inputs", () => {
    const result = calculateHealthScore(
      makeHotspots({
        results: [{ path: "big.js", churn: 50, loc: 1000 }],
        stats: { totalFilesAnalyzed: 10, highRisk: 5, mediumRisk: 3, lowRisk: 2 },
      }),
      makeBusFactor({
        results: [{ path: "risky.js", topOwner: { author: "Alice", percentage: 0.95 } }],
        stats: { totalFilesAnalyzed: 10, riskyFiles: 3, riskyPercentage: 30, avgBusFactor: 1.5 },
      }),
      makeCoupling(),
      makeCodeAge(),
      makeContributors()
    );

    assert.ok(result.recommendations.length > 0);
  });

  it("scores object has all component keys", () => {
    const result = calculateHealthScore(
      makeHotspots(),
      makeBusFactor(),
      makeCoupling(),
      makeCodeAge(),
      makeContributors()
    );

    assert.ok("hotspots" in result.scores);
    assert.ok("busFactor" in result.scores);
    assert.ok("coupling" in result.scores);
    assert.ok("codeAge" in result.scores);
    assert.ok("contributors" in result.scores);
  });
});
