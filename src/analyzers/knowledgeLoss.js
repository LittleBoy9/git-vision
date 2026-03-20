/**
 * Author Knowledge Loss Detection
 *
 * Identifies files and modules where key contributors have stopped contributing.
 * Extends bus factor with a time dimension — a file might have 3 historical authors,
 * but if the top 2 stopped committing 6 months ago, the effective bus factor is 1.
 */

export function analyzeKnowledgeLoss(fileSummaries, commits, options = {}) {
  const top = options.top || 10;
  const inactivityThreshold = options.inactivityThreshold || 180; // days
  const minCommitShare = options.minCommitShare || 0.3; // 30% combined departed share = at risk

  const now = new Date();
  const thresholdMs = inactivityThreshold * 86400000;

  const fileResults = [];
  const globalAuthors = new Map(); // author -> { lastSeen, totalCommits, filesOwned }

  for (const [path, summary] of fileSummaries) {
    const totalCommits = summary.churn;
    if (totalCommits < 3) continue;

    // Find each author's last commit date for THIS file
    const authorLastSeen = new Map();
    const authorCommitCount = new Map();

    for (const [author, count] of summary.authors) {
      authorCommitCount.set(author, count);
    }

    // Scan commits to find per-file last activity per author
    for (const commit of commits) {
      const files = commit.files || [];
      const touchesFile = files.some((f) => f.path === path);
      if (!touchesFile) continue;

      const author = commit.author;
      const date = new Date(commit.date);
      const existing = authorLastSeen.get(author);
      if (!existing || date > existing) {
        authorLastSeen.set(author, date);
      }
    }

    // Classify authors as active or departed
    const departedAuthors = [];
    const activeAuthors = [];
    let knowledgeLostPct = 0;

    for (const [author, count] of authorCommitCount) {
      const lastSeen = authorLastSeen.get(author);
      const daysSince = lastSeen ? Math.floor((now - lastSeen) / 86400000) : Infinity;
      const commitShare = count / totalCommits;

      // Track global author stats
      if (!globalAuthors.has(author)) {
        globalAuthors.set(author, { lastSeen: null, totalCommits: 0, filesOwned: 0 });
      }
      const ga = globalAuthors.get(author);
      ga.totalCommits += count;
      if (!ga.lastSeen || (lastSeen && lastSeen > ga.lastSeen)) ga.lastSeen = lastSeen;
      if (commitShare >= 0.3) ga.filesOwned++;

      if (daysSince > inactivityThreshold) {
        departedAuthors.push({
          author,
          lastSeen: lastSeen ? lastSeen.toISOString() : null,
          commitShare: Math.round(commitShare * 100),
          daysSinceLastCommit: daysSince === Infinity ? null : daysSince,
        });
        knowledgeLostPct += commitShare;
      } else {
        activeAuthors.push({ author, commitShare: Math.round(commitShare * 100) });
      }
    }

    knowledgeLostPct = Math.round(knowledgeLostPct * 100);
    const isAtRisk = knowledgeLostPct >= minCommitShare * 100;

    if (departedAuthors.length > 0) {
      fileResults.push({
        path,
        totalAuthors: authorCommitCount.size,
        activeAuthors: activeAuthors.length,
        departedAuthors: departedAuthors.sort((a, b) => b.commitShare - a.commitShare),
        knowledgeLostPct,
        isAtRisk,
      });
    }
  }

  // Sort: at-risk first, then by knowledge lost descending
  fileResults.sort((a, b) => {
    if (a.isAtRisk !== b.isAtRisk) return a.isAtRisk ? -1 : 1;
    return b.knowledgeLostPct - a.knowledgeLostPct;
  });

  // Build departed contributors list (global)
  const departedContributors = [...globalAuthors.entries()]
    .filter(([, stats]) => {
      if (!stats.lastSeen) return true;
      return (now - stats.lastSeen) / 86400000 > inactivityThreshold;
    })
    .map(([author, stats]) => ({
      author,
      lastSeen: stats.lastSeen ? stats.lastSeen.toISOString() : null,
      filesOwned: stats.filesOwned,
      totalCommits: stats.totalCommits,
      daysSinceLastCommit: stats.lastSeen
        ? Math.floor((now - stats.lastSeen) / 86400000)
        : null,
    }))
    .sort((a, b) => b.totalCommits - a.totalCommits);

  const filesAtRisk = fileResults.filter((f) => f.isAtRisk).length;
  const totalActive = [...globalAuthors.entries()]
    .filter(([, s]) => s.lastSeen && (now - s.lastSeen) / 86400000 <= inactivityThreshold)
    .length;

  return {
    name: "knowledgeLoss",
    title: "Author Knowledge Loss",
    description: "Files and modules where key contributors have stopped contributing",
    results: fileResults.slice(0, top),
    departedContributors: departedContributors.slice(0, top),
    total: fileResults.length,
    stats: {
      totalFilesAnalyzed: fileResults.length,
      filesAtRisk,
      riskPercentage: fileResults.length > 0
        ? Math.round((filesAtRisk / fileResults.length) * 100)
        : 0,
      totalDepartedAuthors: departedContributors.length,
      totalActiveAuthors: totalActive,
    },
  };
}
