/**
 * Contributor Patterns Analysis
 *
 * Analyzes how contributions are distributed across modules and identifies
 * team fragmentation (too many people touching one area = coordination overhead).
 */

export function analyzeContributors(fileSummaries, commits, options = {}) {
  const top = options.top || 10;

  // Aggregate by module
  const modules = new Map();

  for (const [path, summary] of fileSummaries) {
    const module = getModule(path);

    if (!modules.has(module)) {
      modules.set(module, {
        module,
        files: 0,
        totalCommits: 0,
        authors: new Map(),
        totalAdditions: 0,
        totalDeletions: 0,
      });
    }

    const mod = modules.get(module);
    mod.files++;
    mod.totalCommits += summary.churn;
    mod.totalAdditions += summary.totalAdditions;
    mod.totalDeletions += summary.totalDeletions;

    for (const [author, count] of summary.authors) {
      mod.authors.set(author, (mod.authors.get(author) || 0) + count);
    }
  }

  // Calculate per-module stats
  const moduleResults = [...modules.values()]
    .map((mod) => {
      const authorEntries = [...mod.authors.entries()]
        .map(([author, commits]) => ({
          author,
          commits,
          percentage: Math.round((commits / mod.totalCommits) * 100),
        }))
        .sort((a, b) => b.commits - a.commits);

      // Fragmentation: entropy-based measure of how spread out contributions are
      const fragmentation = calculateFragmentation(authorEntries, mod.totalCommits);

      return {
        module: mod.module,
        files: mod.files,
        totalCommits: mod.totalCommits,
        totalAdditions: mod.totalAdditions,
        totalDeletions: mod.totalDeletions,
        uniqueAuthors: authorEntries.length,
        topContributors: authorEntries.slice(0, 5),
        fragmentation: +fragmentation.toFixed(2),
        fragmentationLevel: getFragLevel(fragmentation, authorEntries.length),
      };
    })
    .sort((a, b) => b.totalCommits - a.totalCommits);

  // Overall top contributors
  const globalAuthors = new Map();
  for (const commit of commits) {
    globalAuthors.set(commit.author, (globalAuthors.get(commit.author) || 0) + 1);
  }

  const topContributors = [...globalAuthors.entries()]
    .map(([author, commitCount]) => ({
      author,
      commits: commitCount,
      percentage: Math.round((commitCount / commits.length) * 100),
    }))
    .sort((a, b) => b.commits - a.commits)
    .slice(0, top);

  return {
    name: "contributors",
    title: "Contributor Patterns",
    description: "How contributions are distributed across modules and contributors",
    modules: moduleResults,
    topContributors,
    total: modules.size,
    stats: {
      totalModules: modules.size,
      totalContributors: globalAuthors.size,
      totalCommits: commits.length,
      highFragmentation: moduleResults.filter((m) => m.fragmentationLevel === "high").length,
    },
  };
}

/**
 * Shannon entropy normalized to 0-1.
 * 0 = one person does everything, 1 = perfectly even distribution.
 */
function calculateFragmentation(authors, totalCommits) {
  if (authors.length <= 1) return 0;

  let entropy = 0;
  for (const a of authors) {
    const p = a.commits / totalCommits;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  const maxEntropy = Math.log2(authors.length);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

function getFragLevel(fragmentation, authorCount) {
  if (authorCount <= 2) return "low";
  if (fragmentation >= 0.8) return "high";
  if (fragmentation >= 0.5) return "medium";
  return "low";
}

function getModule(filePath) {
  const parts = filePath.split("/");
  if (parts.length <= 1) return "(root)";
  return parts[0];
}
