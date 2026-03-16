import { simpleGit } from "simple-git";
import { readFileSync, statSync, readdirSync } from "fs";
import { join, relative } from "path";
import { matchesPattern, DEFAULT_IGNORE_PATTERNS } from "../config/ignores.js";

/**
 * Core git log parser. Extracts structured commit data from git history.
 * Everything in git-vision depends on this module.
 */

const SEPARATOR = "---GV_SEP---";
const COMMIT_FORMAT = ["%H", "%an", "%ae", "%at", "%s"].join(SEPARATOR);

export async function createParser(repoPath = process.cwd()) {
  const git = simpleGit(repoPath);

  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    throw new Error(
      `Not a git repository: ${repoPath}\nRun git-vision inside a git repository.`
    );
  }

  return {
    git,
    repoPath,
    getCommits: (options) => getCommits(git, options),
    getFileLog: (filePath) => getFileLog(git, filePath),
    getFileLOC: (filePath) => getFileLOC(repoPath, filePath),
    getAllTrackedFiles: () => getAllTrackedFiles(git),
    getRepoStats: () => getRepoStats(git),
  };
}

/**
 * Get all commits with per-file change stats (additions/deletions).
 * This is the primary data source for most analyzers.
 */
async function getCommits(git, options = {}) {
  const args = [
    `--format=${COMMIT_FORMAT}`,
    "--numstat", // include per-file add/delete stats
  ];

  if (options.since) {
    args.push(`--since=${options.since}`);
  }

  if (options.until) {
    args.push(`--until=${options.until}`);
  }

  const raw = await git.log(args);
  return parseRawLog(raw);
}

/**
 * Parse the raw git log output into structured commit objects.
 */
function parseRawLog(raw) {
  const commits = [];

  // simple-git returns { all: [...] } with each entry having hash, message, etc.
  // But with --numstat and custom format, we need to parse the raw output.
  // Let's use raw git command instead.
  return commits;
}

/**
 * Get commits using raw git command for full control over parsing.
 */
export async function getRawCommits(git, options = {}) {
  const args = ["log", `--format=${COMMIT_FORMAT}`, "--numstat"];

  if (options.since) {
    args.push(`--since=${options.since}`);
  }

  if (options.until) {
    args.push(`--until=${options.until}`);
  }

  if (options.ignore && options.ignore.length > 0) {
    args.push("--");
    args.push(".");
    for (const pattern of options.ignore) {
      args.push(`:!${pattern}`);
    }
  }

  const raw = await git.raw(args);
  return parseRawOutput(raw);
}

/**
 * Parse raw `git log --format=... --numstat` output into structured data.
 *
 * Output format per commit:
 *   hash---GV_SEP---author---GV_SEP---email---GV_SEP---timestamp---GV_SEP---subject
 *   <blank line>
 *   additions\tdeletions\tfilepath
 *   additions\tdeletions\tfilepath
 *   <blank line>
 */
function parseRawOutput(raw) {
  if (!raw || !raw.trim()) return [];

  const commits = [];
  const lines = raw.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line || !line.includes(SEPARATOR)) {
      i++;
      continue;
    }

    const parts = line.split(SEPARATOR);
    if (parts.length < 5) {
      i++;
      continue;
    }

    const commit = {
      hash: parts[0],
      author: parts[1],
      email: parts[2],
      timestamp: parseInt(parts[3], 10) * 1000, // convert to ms
      date: new Date(parseInt(parts[3], 10) * 1000),
      subject: parts[4],
      files: [],
    };

    i++;

    // Skip blank lines between header and numstat
    while (i < lines.length && lines[i].trim() === "") {
      i++;
    }

    // Parse numstat lines (additions\tdeletions\tfilepath)
    while (i < lines.length) {
      const numstatLine = lines[i].trim();
      if (!numstatLine || numstatLine.includes(SEPARATOR)) break;

      const match = numstatLine.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
      if (match) {
        commit.files.push({
          additions: match[1] === "-" ? 0 : parseInt(match[1], 10),
          deletions: match[2] === "-" ? 0 : parseInt(match[2], 10),
          path: match[3],
        });
        i++;
      } else {
        break;
      }
    }

    commits.push(commit);
  }

  return commits;
}

/**
 * Get the git log for a specific file.
 */
async function getFileLog(git, filePath) {
  const raw = await git.raw([
    "log",
    `--format=${COMMIT_FORMAT}`,
    "--follow",
    "--",
    filePath,
  ]);
  return parseRawOutput(raw);
}

/**
 * Count lines of code for a file (used as complexity proxy).
 */
function getFileLOC(repoPath, filePath) {
  try {
    const fullPath = join(repoPath, filePath);
    const stat = statSync(fullPath);

    // Skip binary files (rough heuristic: >1MB or no extension)
    if (stat.size > 1024 * 1024) return 0;

    const content = readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");

    return {
      total: lines.length,
      nonEmpty: lines.filter((l) => l.trim().length > 0).length,
    };
  } catch {
    return { total: 0, nonEmpty: 0 };
  }
}

/**
 * Get all files currently tracked by git.
 */
async function getAllTrackedFiles(git) {
  const raw = await git.raw(["ls-files"]);
  return raw
    .trim()
    .split("\n")
    .filter((f) => f.length > 0);
}

/**
 * Get high-level repo stats.
 */
async function getRepoStats(git) {
  const [branchSummary, logCount] = await Promise.all([
    git.branch(),
    git.raw(["rev-list", "--count", "HEAD"]),
  ]);

  // Get unique authors
  const authorsRaw = await git.raw([
    "log",
    "--format=%an",
    "--no-merges",
  ]);
  const authors = [...new Set(authorsRaw.trim().split("\n").filter(Boolean))];

  return {
    currentBranch: branchSummary.current,
    totalCommits: parseInt(logCount.trim(), 10),
    totalAuthors: authors.length,
    authors,
  };
}

/**
 * Build a per-file summary from commits: churn count, unique authors, last modified, etc.
 * This is the shared data structure most analyzers consume.
 */
export function buildFileSummaries(commits, extraIgnores = []) {
  const files = new Map();
  const ignorePatterns = [...DEFAULT_IGNORE_PATTERNS, ...extraIgnores];

  for (const commit of commits) {
    for (const file of commit.files) {
      // Smart ignore: skip lock files, binaries, generated code
      if (matchesPattern(file.path, ignorePatterns)) continue;

      if (!files.has(file.path)) {
        files.set(file.path, {
          path: file.path,
          churn: 0,
          totalAdditions: 0,
          totalDeletions: 0,
          authors: new Map(), // author -> commit count
          commits: [],
          lastModified: null,
          firstSeen: null,
        });
      }

      const summary = files.get(file.path);
      summary.churn++;
      summary.totalAdditions += file.additions;
      summary.totalDeletions += file.deletions;

      // Track author contributions
      const authorCount = summary.authors.get(commit.author) || 0;
      summary.authors.set(commit.author, authorCount + 1);

      // Track commit references
      summary.commits.push({
        hash: commit.hash,
        author: commit.author,
        date: commit.date,
        subject: commit.subject,
      });

      // Track dates
      if (!summary.lastModified || commit.date > summary.lastModified) {
        summary.lastModified = commit.date;
      }
      if (!summary.firstSeen || commit.date < summary.firstSeen) {
        summary.firstSeen = commit.date;
      }
    }
  }

  return files;
}
