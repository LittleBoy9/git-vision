/**
 * Trend Tracking (V2)
 *
 * Compares two time periods to answer: "Is our codebase getting healthier or worse?"
 *
 * Usage: git-vision --compare 3months
 *   Compares last 3 months vs the 3 months before that.
 *
 * Tracks:
 * - Hotspot movement (are risky files getting riskier?)
 * - Bus factor changes (are we spreading knowledge?)
 * - Churn velocity (are we changing more or less?)
 * - New hotspots (files that weren't risky but now are)
 */

import { getRawCommits, buildFileSummaries } from "../git/parser.js";
import { analyzeHotspots } from "./hotspots.js";
import { analyzeBusFactor } from "./busFactor.js";

export async function analyzeTrends(git, getFileLOC, options = {}) {
  const periodStr = options.compare || "3months";
  const { recentSince, olderSince, olderUntil, periodLabel } = parsePeriod(periodStr);

  // Get commits for both periods
  const [recentCommits, olderCommits] = await Promise.all([
    getRawCommits(git, { since: recentSince, ignore: options.ignore }),
    getRawCommits(git, { since: olderSince, until: olderUntil, ignore: options.ignore }),
  ]);

  const recentSummaries = buildFileSummaries(recentCommits);
  const olderSummaries = buildFileSummaries(olderCommits);

  // Run analyzers on both periods
  const recentHotspots = analyzeHotspots(recentSummaries, getFileLOC, { top: 20 });
  const olderHotspots = analyzeHotspots(olderSummaries, getFileLOC, { top: 20 });
  const recentBusFactor = analyzeBusFactor(recentSummaries, { top: 50 });
  const olderBusFactor = analyzeBusFactor(olderSummaries, { top: 50 });

  // Hotspot movement
  const hotspotTrends = trackHotspotMovement(recentHotspots, olderHotspots);

  // Churn velocity
  const recentChurn = recentCommits.reduce((sum, c) => sum + c.files.length, 0);
  const olderChurn = olderCommits.reduce((sum, c) => sum + c.files.length, 0);
  const churnChange = olderChurn > 0
    ? Math.round(((recentChurn - olderChurn) / olderChurn) * 100)
    : 0;

  // Bus factor trend
  const bfTrend = {
    recent: recentBusFactor.stats.riskyPercentage,
    older: olderBusFactor.stats.riskyPercentage,
    change: recentBusFactor.stats.riskyPercentage - olderBusFactor.stats.riskyPercentage,
    direction: recentBusFactor.stats.riskyPercentage > olderBusFactor.stats.riskyPercentage
      ? "worse" : recentBusFactor.stats.riskyPercentage < olderBusFactor.stats.riskyPercentage
        ? "better" : "stable",
  };

  // Active contributors trend
  const recentAuthors = new Set(recentCommits.map((c) => c.author));
  const olderAuthors = new Set(olderCommits.map((c) => c.author));
  const newContributors = [...recentAuthors].filter((a) => !olderAuthors.has(a));
  const lostContributors = [...olderAuthors].filter((a) => !recentAuthors.has(a));

  // Overall trend direction
  let trendScore = 0;
  if (hotspotTrends.newHotspots.length > hotspotTrends.resolvedHotspots.length) trendScore--;
  else if (hotspotTrends.resolvedHotspots.length > hotspotTrends.newHotspots.length) trendScore++;
  if (bfTrend.direction === "worse") trendScore--;
  else if (bfTrend.direction === "better") trendScore++;
  if (churnChange > 30) trendScore--;
  else if (churnChange < -10) trendScore++;

  const overallDirection = trendScore > 0 ? "improving" : trendScore < 0 ? "declining" : "stable";

  return {
    name: "trends",
    title: "Trend Analysis",
    description: `Comparing last ${periodLabel} vs previous ${periodLabel}`,
    period: {
      recent: { since: recentSince, commits: recentCommits.length },
      older: { since: olderSince, until: olderUntil, commits: olderCommits.length },
      label: periodLabel,
    },
    overallDirection,
    hotspotTrends,
    churn: {
      recent: recentChurn,
      older: olderChurn,
      changePercent: churnChange,
      direction: churnChange > 10 ? "increasing" : churnChange < -10 ? "decreasing" : "stable",
    },
    busFactor: bfTrend,
    contributors: {
      recent: recentAuthors.size,
      older: olderAuthors.size,
      newContributors,
      lostContributors,
    },
    stats: {
      recentCommits: recentCommits.length,
      olderCommits: olderCommits.length,
      recentFilesChanged: recentSummaries.size,
      olderFilesChanged: olderSummaries.size,
    },
  };
}

function trackHotspotMovement(recent, older) {
  const recentSet = new Map(recent.results.map((r) => [r.path, r]));
  const olderSet = new Map(older.results.map((r) => [r.path, r]));

  const worsening = [];
  const improving = [];
  const newHotspots = [];
  const resolvedHotspots = [];

  for (const [path, r] of recentSet) {
    if (olderSet.has(path)) {
      const o = olderSet.get(path);
      const scoreDiff = r.normalizedScore - o.normalizedScore;
      if (scoreDiff > 10) {
        worsening.push({ path, recent: r.normalizedScore, older: o.normalizedScore, change: scoreDiff });
      } else if (scoreDiff < -10) {
        improving.push({ path, recent: r.normalizedScore, older: o.normalizedScore, change: scoreDiff });
      }
    } else if (r.normalizedScore >= 30) {
      newHotspots.push({ path, score: r.normalizedScore });
    }
  }

  for (const [path, o] of olderSet) {
    if (!recentSet.has(path) && o.normalizedScore >= 30) {
      resolvedHotspots.push({ path, previousScore: o.normalizedScore });
    }
  }

  return { worsening, improving, newHotspots, resolvedHotspots };
}

/**
 * Parse period string like "3months", "6weeks", "1year" into date ranges.
 */
function parsePeriod(periodStr) {
  const match = periodStr.match(/^(\d+)\s*(day|week|month|year)s?$/i);
  if (!match) {
    throw new Error(
      `Invalid period: "${periodStr}". Use format like "3months", "6weeks", "1year".`
    );
  }

  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const now = new Date();
  const midpoint = new Date(now);
  const startpoint = new Date(now);

  switch (unit) {
    case "day":
      midpoint.setDate(midpoint.getDate() - amount);
      startpoint.setDate(startpoint.getDate() - amount * 2);
      break;
    case "week":
      midpoint.setDate(midpoint.getDate() - amount * 7);
      startpoint.setDate(startpoint.getDate() - amount * 14);
      break;
    case "month":
      midpoint.setMonth(midpoint.getMonth() - amount);
      startpoint.setMonth(startpoint.getMonth() - amount * 2);
      break;
    case "year":
      midpoint.setFullYear(midpoint.getFullYear() - amount);
      startpoint.setFullYear(startpoint.getFullYear() - amount * 2);
      break;
  }

  return {
    recentSince: midpoint.toISOString().split("T")[0],
    olderSince: startpoint.toISOString().split("T")[0],
    olderUntil: midpoint.toISOString().split("T")[0],
    periodLabel: `${amount} ${unit}${amount > 1 ? "s" : ""}`,
  };
}
