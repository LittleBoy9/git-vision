/**
 * Bus Factor Analysis
 *
 * Identifies files and modules where knowledge is concentrated in too few people.
 * A bus factor of 1 means if that person leaves, nobody else understands the code.
 */

export function analyzeBusFactor(fileSummaries, options = {}) {
  const top = options.top || 10;
  const ownershipThreshold = options.ownershipThreshold || 0.8; // 80% ownership = risk

  const fileRisks = [];
  const moduleRisks = new Map(); // folder -> aggregated stats

  for (const [path, summary] of fileSummaries) {
    const totalCommits = summary.churn;
    if (totalCommits < 3) continue; // skip rarely touched files

    // Calculate ownership percentages
    const authorEntries = [...summary.authors.entries()]
      .map(([author, commits]) => ({
        author,
        commits,
        percentage: commits / totalCommits,
      }))
      .sort((a, b) => b.percentage - a.percentage);

    const topOwner = authorEntries[0];
    const busFactor = authorEntries.length;
    const isRisky = topOwner && topOwner.percentage >= ownershipThreshold;

    const fileData = {
      path,
      busFactor,
      totalCommits,
      topOwner: topOwner
        ? { author: topOwner.author, percentage: topOwner.percentage }
        : null,
      authors: authorEntries,
      isRisky,
    };

    fileRisks.push(fileData);

    // Aggregate by module (top-level folder)
    const module = getModule(path);
    if (!moduleRisks.has(module)) {
      moduleRisks.set(module, {
        module,
        files: 0,
        riskyFiles: 0,
        authors: new Map(),
        totalCommits: 0,
      });
    }
    const mod = moduleRisks.get(module);
    mod.files++;
    mod.totalCommits += totalCommits;
    if (isRisky) mod.riskyFiles++;
    for (const [author, commits] of summary.authors) {
      mod.authors.set(author, (mod.authors.get(author) || 0) + commits);
    }
  }

  // Sort file risks: risky first, then by bus factor ascending
  fileRisks.sort((a, b) => {
    if (a.isRisky !== b.isRisky) return a.isRisky ? -1 : 1;
    return a.busFactor - b.busFactor;
  });

  // Calculate module-level bus factors
  const moduleResults = [...moduleRisks.values()]
    .map((mod) => {
      const authorEntries = [...mod.authors.entries()]
        .map(([author, commits]) => ({
          author,
          commits,
          percentage: commits / mod.totalCommits,
        }))
        .sort((a, b) => b.percentage - a.percentage);

      return {
        module: mod.module,
        busFactor: mod.authors.size,
        files: mod.files,
        riskyFiles: mod.riskyFiles,
        riskPercentage: Math.round((mod.riskyFiles / mod.files) * 100),
        topOwner: authorEntries[0] || null,
        authors: authorEntries,
      };
    })
    .sort((a, b) => b.riskPercentage - a.riskPercentage);

  const totalRiskyFiles = fileRisks.filter((f) => f.isRisky).length;

  return {
    name: "busFactor",
    title: "Bus Factor",
    description: "Files and modules with knowledge concentrated in too few people",
    results: fileRisks.slice(0, top),
    modules: moduleResults,
    total: fileRisks.length,
    stats: {
      totalFilesAnalyzed: fileRisks.length,
      riskyFiles: totalRiskyFiles,
      riskyPercentage: fileRisks.length > 0
        ? Math.round((totalRiskyFiles / fileRisks.length) * 100)
        : 0,
      avgBusFactor: fileRisks.length > 0
        ? +(fileRisks.reduce((sum, f) => sum + f.busFactor, 0) / fileRisks.length).toFixed(1)
        : 0,
    },
  };
}

function getModule(filePath) {
  const parts = filePath.split("/");
  if (parts.length <= 1) return "(root)";
  return parts[0];
}
