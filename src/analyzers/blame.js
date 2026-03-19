/**
 * Git Blame Integration (V2)
 *
 * Goes beyond commit-level ownership to line-level ownership.
 * Answers: "Who actually wrote the code that exists TODAY?"
 *
 * This is more accurate than commit counting because:
 * - A developer who rewrote a file once owns more than someone who made 10 typo fixes
 * - Shows current state of ownership, not historical
 */

export async function analyzeBlame(git, filePaths, options = {}) {
  const maxFiles = options.maxFiles || 50;
  const onProgress = options.onProgress || (() => {}); // callback for progress
  const filesToBlame = filePaths.slice(0, maxFiles);

  const results = [];
  const globalOwnership = new Map(); // author -> { lines, files }
  let failedFiles = 0;

  for (let i = 0; i < filesToBlame.length; i++) {
    const filePath = filesToBlame[i];
    onProgress({ current: i + 1, total: filesToBlame.length, file: filePath });

    try {
      const blameData = await getBlameForFile(git, filePath);
      if (!blameData) continue;

      results.push({
        path: filePath,
        ...blameData,
      });

      // Accumulate global stats
      for (const [author, lines] of blameData.authorLines) {
        if (!globalOwnership.has(author)) {
          globalOwnership.set(author, { lines: 0, files: 0 });
        }
        const entry = globalOwnership.get(author);
        entry.lines += lines;
        entry.files++;
      }
    } catch {
      // Skip files that can't be blamed (binary, deleted, etc.)
      failedFiles++;
      continue;
    }
  }

  // Calculate true ownership per file
  const fileOwnership = results.map((r) => {
    const authors = [...r.authorLines.entries()]
      .map(([author, lines]) => ({
        author,
        lines,
        percentage: Math.round((lines / r.totalLines) * 100),
      }))
      .sort((a, b) => b.lines - a.lines);

    const trueOwner = authors[0];
    const busFactor = authors.filter((a) => a.percentage >= 10).length;

    return {
      path: r.path,
      totalLines: r.totalLines,
      trueOwner: trueOwner ? { author: trueOwner.author, percentage: trueOwner.percentage } : null,
      busFactor,
      authors,
      oldestLine: r.oldestLine,
      newestLine: r.newestLine,
      avgAge: r.avgAge,
    };
  });

  // Sort by single-owner risk
  fileOwnership.sort((a, b) => {
    const aRisk = a.trueOwner ? a.trueOwner.percentage : 0;
    const bRisk = b.trueOwner ? b.trueOwner.percentage : 0;
    return bRisk - aRisk;
  });

  // Global stats
  const totalLines = [...globalOwnership.values()].reduce((sum, v) => sum + v.lines, 0);
  const globalAuthors = [...globalOwnership.entries()]
    .map(([author, data]) => ({
      author,
      lines: data.lines,
      files: data.files,
      percentage: totalLines > 0 ? Math.round((data.lines / totalLines) * 100) : 0,
    }))
    .sort((a, b) => b.lines - a.lines);

  return {
    name: "blame",
    title: "True Ownership (git blame)",
    description: "Line-level code ownership — who actually wrote the code that exists today",
    results: fileOwnership,
    globalAuthors,
    total: fileOwnership.length,
    stats: {
      filesAnalyzed: fileOwnership.length,
      failedFiles,
      totalLines,
      uniqueAuthors: globalOwnership.size,
      singleOwnerFiles: fileOwnership.filter(
        (f) => f.trueOwner && f.trueOwner.percentage >= 80
      ).length,
    },
  };
}

/**
 * Parse `git blame --line-porcelain` output for a single file.
 */
async function getBlameForFile(git, filePath) {
  const raw = await git.raw(["blame", "--line-porcelain", filePath]);
  if (!raw || !raw.trim()) return null;

  const authorLines = new Map();
  const timestamps = [];
  let totalLines = 0;

  const lines = raw.split("\n");
  let currentAuthor = null;
  let currentTimestamp = null;

  for (const line of lines) {
    if (line.startsWith("author ")) {
      currentAuthor = line.slice(7);
    } else if (line.startsWith("author-time ")) {
      currentTimestamp = parseInt(line.slice(12), 10) * 1000;
    } else if (line.startsWith("\t")) {
      // This is the actual code line — means we've finished parsing one blame entry
      if (currentAuthor && currentAuthor !== "Not Committed Yet") {
        authorLines.set(currentAuthor, (authorLines.get(currentAuthor) || 0) + 1);
        totalLines++;
        if (currentTimestamp) timestamps.push(currentTimestamp);
      }
      currentAuthor = null;
      currentTimestamp = null;
    }
  }

  if (totalLines === 0) return null;

  timestamps.sort((a, b) => a - b);

  return {
    authorLines,
    totalLines,
    oldestLine: timestamps.length > 0 ? new Date(timestamps[0]) : null,
    newestLine: timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]) : null,
    avgAge: timestamps.length > 0
      ? new Date(timestamps.reduce((s, t) => s + t, 0) / timestamps.length)
      : null,
  };
}
