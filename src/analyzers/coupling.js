/**
 * Change Coupling Analysis
 *
 * Detects files that frequently change together in the same commit.
 * High coupling between files in different modules reveals hidden architectural dependencies.
 */

export function analyzeCoupling(commits, options = {}) {
  const top = options.top || 10;
  const minSharedCommits = options.minSharedCommits || 5;
  const minCouplingDegree = options.minCouplingDegree || 0.3; // 30%

  // Build co-change matrix
  const pairCounts = new Map(); // "fileA|||fileB" -> count
  const fileTotalCommits = new Map(); // file -> total commits

  for (const commit of commits) {
    const files = commit.files.map((f) => f.path);
    if (files.length < 2 || files.length > 50) continue; // skip single-file and huge commits

    // Count total commits per file
    for (const file of files) {
      fileTotalCommits.set(file, (fileTotalCommits.get(file) || 0) + 1);
    }

    // Count co-changes for every pair
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const key = makePairKey(files[i], files[j]);
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  }

  // Calculate coupling degree for each pair
  const couplings = [];

  for (const [key, sharedCommits] of pairCounts) {
    if (sharedCommits < minSharedCommits) continue;

    const [fileA, fileB] = key.split("|||");
    const totalA = fileTotalCommits.get(fileA) || 0;
    const totalB = fileTotalCommits.get(fileB) || 0;
    const maxTotal = Math.max(totalA, totalB);

    if (maxTotal === 0) continue;

    const minTotal = Math.min(totalA, totalB);
    if (minTotal === 0) continue;

    const degree = sharedCommits / minTotal;

    if (degree < minCouplingDegree) continue;

    const sameModule = getModule(fileA) === getModule(fileB);

    couplings.push({
      fileA,
      fileB,
      sharedCommits,
      totalCommitsA: totalA,
      totalCommitsB: totalB,
      degree: +degree.toFixed(2),
      degreePercent: Math.round(degree * 100),
      sameModule,
      moduleA: getModule(fileA),
      moduleB: getModule(fileB),
    });
  }

  // Sort by degree descending, prioritize cross-module coupling
  couplings.sort((a, b) => {
    if (a.sameModule !== b.sameModule) return a.sameModule ? 1 : -1;
    return b.degree - a.degree;
  });

  const crossModuleCouplings = couplings.filter((c) => !c.sameModule);

  return {
    name: "coupling",
    title: "Change Coupling",
    description: "Files that frequently change together — hidden architectural dependencies",
    results: couplings.slice(0, top),
    total: couplings.length,
    stats: {
      totalPairsAnalyzed: pairCounts.size,
      significantCouplings: couplings.length,
      crossModuleCouplings: crossModuleCouplings.length,
      withinModuleCouplings: couplings.length - crossModuleCouplings.length,
    },
  };
}

function makePairKey(a, b) {
  return a < b ? `${a}|||${b}` : `${b}|||${a}`;
}

function getModule(filePath) {
  const parts = filePath.split("/");
  if (parts.length <= 1) return "(root)";
  return parts[0];
}
