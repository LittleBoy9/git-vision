/**
 * Shared test data factories for git-vision tests.
 */

/**
 * Create a commit object matching the parser.js shape.
 */
export function makeCommit({
  hash = "abc1234",
  author = "Dev One",
  email = "dev@test.com",
  date = new Date(),
  subject = "test commit",
  files = [],
} = {}) {
  const timestamp = date instanceof Date ? date.getTime() : date;
  return {
    hash,
    author,
    email,
    timestamp,
    date: date instanceof Date ? date : new Date(date),
    subject,
    files: files.map((f) =>
      typeof f === "string"
        ? { path: f, additions: 10, deletions: 5 }
        : { additions: 0, deletions: 0, ...f }
    ),
  };
}

/**
 * Create a file summary entry matching the buildFileSummaries output shape.
 */
export function makeFileSummary({
  path = "src/index.js",
  authors = [["Dev One", 5]],
  commits = [],
  lastModified = new Date(),
  firstSeen = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  churn = null,
  totalAdditions = 100,
  totalDeletions = 50,
} = {}) {
  const authorsMap = new Map(authors);
  const computedChurn =
    churn !== null
      ? churn
      : [...authorsMap.values()].reduce((a, b) => a + b, 0);

  // Build default commits from authors if none provided
  const defaultCommits =
    commits.length > 0
      ? commits
      : authors.flatMap(([author, count]) =>
          Array.from({ length: count }, (_, i) => ({
            hash: `${author.replace(/\s/g, "")}_${i}`,
            author,
            date: lastModified,
            subject: "commit",
          }))
        );

  return {
    path,
    churn: computedChurn,
    totalAdditions,
    totalDeletions,
    authors: authorsMap,
    commits: defaultCommits,
    lastModified,
    firstSeen,
  };
}

/**
 * Build a Map<path, summary> from an array of summary objects.
 */
export function makeFileSummariesMap(entries) {
  const map = new Map();
  for (const entry of entries) {
    map.set(entry.path, entry);
  }
  return map;
}
