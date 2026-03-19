/**
 * Branch Graph Analysis
 *
 * Analyzes branch topology: who created branches, when, lifespan,
 * merge history, stale branches, and branch-level risk overlays.
 * Uses git for-each-ref, merge commits, and reflog where available.
 */

export async function analyzeBranches(git, options = {}) {
  _defaultBranch = null;
  const top = options.top || 20;

  // Get all branches (local + remote)
  const graphLimit = options.graphLimit || 40;
  const [localRefs, remoteRefs, mergeLog, currentBranch, graphLines, topology] = await Promise.all([
    getBranchRefs(git, "refs/heads/"),
    getBranchRefs(git, "refs/remotes/").catch(() => []),
    getMergeCommits(git),
    git.branch().then((b) => b.current),
    getVisualGraph(git, graphLimit),
    getCommitTopology(git, graphLimit),
  ]);

  const graphLayout = computeGraphLayout(topology);

  // Build branch objects with metadata
  const branches = [];

  for (const ref of localRefs) {
    const branch = await buildBranchInfo(git, ref, "local", mergeLog);
    branches.push(branch);
  }

  for (const ref of remoteRefs) {
    // Skip HEAD pointers
    if (ref.name.endsWith("/HEAD")) continue;
    // Skip duplicates of local branches
    const shortName = ref.name.replace(/^[^/]+\//, "");
    if (localRefs.some((l) => l.name === shortName)) continue;

    const branch = await buildBranchInfo(git, ref, "remote", mergeLog);
    branches.push(branch);
  }

  // Detect merged branches
  let mergedBranches;
  try {
    const mergedRaw = await git.raw(["branch", "--merged", "HEAD", "--format=%(refname:short)"]);
    mergedBranches = new Set(mergedRaw.trim().split("\n").filter(Boolean));
  } catch {
    mergedBranches = new Set();
  }

  for (const b of branches) {
    b.isMerged = mergedBranches.has(b.name) || mergedBranches.has(b.fullName);
  }

  // Build merge graph
  const mergeGraph = buildMergeGraph(mergeLog, branches);

  // Identify stale branches
  const now = Date.now();
  const STALE_DAYS = 90;
  const staleBranches = branches
    .filter((b) => !b.isMerged && b.name !== currentBranch)
    .filter((b) => b.lastActivity && (now - b.lastActivity.getTime()) > STALE_DAYS * 86400000)
    .sort((a, b) => a.lastActivity - b.lastActivity);

  // Active branches (recently active, not merged)
  const activeBranches = branches
    .filter((b) => !b.isMerged && b.lastActivity)
    .filter((b) => (now - b.lastActivity.getTime()) <= STALE_DAYS * 86400000)
    .sort((a, b) => b.lastActivity - a.lastActivity);

  // Branch creators (who creates the most branches)
  const creatorMap = new Map();
  for (const b of branches) {
    if (b.creator) {
      const count = creatorMap.get(b.creator) || { author: b.creator, created: 0, active: 0, merged: 0, stale: 0 };
      count.created++;
      if (b.isMerged) count.merged++;
      else if (staleBranches.includes(b)) count.stale++;
      else count.active++;
      creatorMap.set(b.creator, count);
    }
  }
  const creators = [...creatorMap.values()].sort((a, b) => b.created - a.created);

  // Sort all branches: active first, then stale, then merged
  branches.sort((a, b) => {
    if (a.name === currentBranch) return -1;
    if (b.name === currentBranch) return 1;
    if (!a.isMerged && b.isMerged) return -1;
    if (a.isMerged && !b.isMerged) return 1;
    return (b.lastActivity || 0) - (a.lastActivity || 0);
  });

  return {
    name: "branches",
    title: "Branch Graph",
    description: "Branch topology, merge history, and branch lifecycle analysis",
    currentBranch,
    branches: branches.slice(0, top),
    mergeGraph: mergeGraph.slice(0, top),
    staleBranches: staleBranches.slice(0, top),
    activeBranches: activeBranches.slice(0, top),
    creators: creators.slice(0, 10),
    graphLines,
    graphLayout,
    total: branches.length,
    stats: {
      totalBranches: branches.length,
      localBranches: localRefs.length,
      remoteBranches: remoteRefs.filter((r) => !r.name.endsWith("/HEAD")).length,
      mergedBranches: branches.filter((b) => b.isMerged).length,
      staleBranches: staleBranches.length,
      activeBranches: activeBranches.length,
      totalMerges: mergeLog.length,
      uniqueCreators: creators.length,
    },
  };
}

/**
 * Get visual graph data from git log --graph for rendering.
 * Returns structured data: each line has graph chars, hash, refs, author, date, subject.
 */
async function getVisualGraph(git, limit) {
  try {
    const raw = await git.raw([
      "log", "--all", "--graph",
      `--format=%H\t%an\t%ai\t%D\t%s`,
      `-${limit}`,
    ]);

    if (!raw || !raw.trim()) return [];

    return raw.trim().split("\n").map((line) => {
      // Split graph characters from the format data
      // Graph chars are everything before the first hash (40 hex chars)
      const hashMatch = line.match(/([0-9a-f]{40})\t/);

      if (hashMatch) {
        const graphIdx = line.indexOf(hashMatch[1]);
        const graphChars = line.slice(0, graphIdx);
        const rest = line.slice(graphIdx);
        const [hash, author, date, refs, ...subjectParts] = rest.split("\t");

        // Parse refs (e.g., "HEAD -> main, origin/main")
        const refList = refs
          ? refs.split(",").map((r) => r.trim()).filter(Boolean)
          : [];

        return {
          type: "commit",
          graph: graphChars,
          hash: hash.slice(0, 8),
          fullHash: hash,
          author,
          date: date ? new Date(date.trim()) : null,
          refs: refList,
          subject: subjectParts.join("\t"),
          isMerge: /Merge/.test(subjectParts.join("\t")),
        };
      }

      // Pure graph line (no commit data — continuation lines)
      return {
        type: "graph",
        graph: line,
        hash: null,
        author: null,
        date: null,
        refs: [],
        subject: null,
        isMerge: false,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Get commit topology for graph layout computation.
 * Returns commits in topological order with parent hashes.
 */
async function getCommitTopology(git, limit) {
  try {
    const raw = await git.raw([
      "log", "--all", "--topo-order",
      "--format=%H\t%P\t%an\t%ai\t%D\t%s",
      `-${limit}`,
    ]);

    if (!raw || !raw.trim()) return [];

    return raw.trim().split("\n").filter(Boolean).map((line) => {
      const [hash, parents, author, date, refs, ...subjectParts] = line.split("\t");
      return {
        hash,
        parents: parents ? parents.trim().split(" ").filter(Boolean) : [],
        author: author?.trim() || null,
        date: date ? new Date(date.trim()) : null,
        refs: refs ? refs.split(",").map((r) => r.trim()).filter(Boolean) : [],
        subject: subjectParts.join("\t"),
        isMerge: parents ? parents.trim().split(" ").filter(Boolean).length > 1 : false,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Compute graph layout — assigns lanes (columns) and connections for rendering.
 * Produces structured data for GitLens-style branch graph visualization.
 */
function computeGraphLayout(commits) {
  const lanes = []; // lanes[i] = target commit hash | null
  const rows = [];

  for (const commit of commits) {
    // Find lanes targeting this commit
    const targetingLanes = [];
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] === commit.hash) {
        targetingLanes.push(i);
      }
    }

    let myLane;
    if (targetingLanes.length > 0) {
      myLane = targetingLanes[0];
      for (const l of targetingLanes) {
        lanes[l] = null;
      }
    } else {
      myLane = lanes.indexOf(null);
      if (myLane === -1) {
        myLane = lanes.length;
        lanes.push(null);
      }
    }

    const connections = [];

    // Merge-in: lines from other targeting lanes converging into this commit
    for (let i = 1; i < targetingLanes.length; i++) {
      connections.push({
        type: "merge-in",
        fromLane: targetingLanes[i],
        toLane: myLane,
      });
    }

    // Assign parents to lanes
    const parents = commit.parents || [];
    for (let p = 0; p < parents.length; p++) {
      const parentHash = parents[p];
      let parentLane = -1;
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i] === parentHash) {
          parentLane = i;
          break;
        }
      }

      if (parentLane === -1) {
        if (p === 0) {
          parentLane = myLane;
        } else {
          parentLane = lanes.indexOf(null);
          if (parentLane === -1) {
            parentLane = lanes.length;
            lanes.push(null);
          }
        }
        lanes[parentLane] = parentHash;
      }

      if (p === 0 && parentLane !== myLane) {
        // First parent is in a different lane — this lane converges into parent's lane
        connections.push({
          type: "converge",
          fromLane: myLane,
          toLane: parentLane,
        });
      } else if (p > 0) {
        connections.push({
          type: "branch-out",
          fromLane: myLane,
          toLane: parentLane,
        });
      }
    }

    const activeLanes = [];
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] !== null) activeLanes.push(i);
    }

    rows.push({
      hash: commit.hash.slice(0, 8),
      fullHash: commit.hash,
      author: commit.author,
      date: commit.date,
      refs: commit.refs,
      subject: commit.subject,
      isMerge: commit.isMerge,
      lane: myLane,
      connections,
      activeLanes,
    });
  }

  const maxLanes = rows.reduce((max, r) => {
    const all = [r.lane, ...r.activeLanes, ...r.connections.flatMap((c) => [c.fromLane, c.toLane])];
    return Math.max(max, ...all);
  }, 0) + 1;

  return { rows, maxLanes };
}

/**
 * Get branch refs with metadata via git for-each-ref
 */
async function getBranchRefs(git, prefix) {
  const format = "%(refname:short)\t%(creatordate:iso)\t%(authorname)\t%(objectname:short)\t%(upstream:short)\t%(upstream:track)";
  const raw = await git.raw(["for-each-ref", `--format=${format}`, "--sort=-creatordate", prefix]);

  if (!raw || !raw.trim()) return [];

  return raw.trim().split("\n").filter(Boolean).map((line) => {
    const [name, dateStr, author, hash, upstream, track] = line.split("\t");
    return {
      name: name.trim(),
      createdAt: dateStr ? new Date(dateStr.trim()) : null,
      author: author?.trim() || null,
      hash: hash?.trim() || null,
      upstream: upstream?.trim() || null,
      trackStatus: track?.trim() || null,
    };
  });
}

/**
 * Get merge commits for graph construction
 */
async function getMergeCommits(git) {
  try {
    const raw = await git.raw([
      "log", "--all", "--merges",
      "--format=%H\t%P\t%an\t%ai\t%s",
      "-200", // last 200 merges max
    ]);

    if (!raw || !raw.trim()) return [];

    return raw.trim().split("\n").filter(Boolean).map((line) => {
      const [hash, parents, author, date, subject] = line.split("\t");
      const parentList = parents ? parents.split(" ") : [];
      return {
        hash: hash?.slice(0, 8),
        parents: parentList.map((p) => p.slice(0, 8)),
        author: author?.trim(),
        date: date ? new Date(date.trim()) : null,
        subject: subject?.trim() || "",
        // Try to extract branch name from merge commit message
        sourceBranch: extractBranchFromMerge(subject || ""),
        targetBranch: extractTargetFromMerge(subject || ""),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Build detailed info for a single branch
 */
async function buildBranchInfo(git, ref, type, mergeLog) {
  // Get commit count on this branch (not reachable from main)
  let aheadCount = 0;
  let lastActivity = ref.createdAt;

  try {
    // Count commits ahead of the default branch
    const mainBranch = await getDefaultBranch(git);
    if (ref.name !== mainBranch) {
      const countRaw = await git.raw(["rev-list", "--count", `${mainBranch}..${ref.name}`]).catch(() => "0");
      aheadCount = parseInt(countRaw.trim(), 10) || 0;
    }

    // Get last commit date on this branch
    const lastDate = await git.raw(["log", "-1", "--format=%ai", ref.name]).catch(() => "");
    if (lastDate.trim()) {
      lastActivity = new Date(lastDate.trim());
    }
  } catch {
    // Branch may have been deleted or is unreachable
  }

  // Calculate lifespan
  const createdAt = ref.createdAt;
  const lifespan = createdAt && lastActivity
    ? Math.ceil((lastActivity.getTime() - createdAt.getTime()) / 86400000)
    : null;

  // Find merges involving this branch
  const relatedMerges = mergeLog.filter(
    (m) => m.sourceBranch === ref.name || m.subject.includes(ref.name)
  );

  return {
    name: ref.name,
    fullName: ref.name,
    type,
    creator: ref.author,
    createdAt,
    lastActivity,
    hash: ref.hash,
    upstream: ref.upstream,
    trackStatus: ref.trackStatus,
    aheadCount,
    lifespan,
    isMerged: false, // set later
    mergeCount: relatedMerges.length,
  };
}

/**
 * Build a merge graph from merge commits
 */
function buildMergeGraph(mergeLog, branches) {
  return mergeLog.map((m) => {
    // Find source/target branches
    const source = m.sourceBranch || "unknown";
    const target = m.targetBranch || "unknown";

    return {
      hash: m.hash,
      source,
      target,
      author: m.author,
      date: m.date,
      subject: m.subject,
    };
  }).filter((m) => m.source !== "unknown" || m.target !== "unknown");
}

/**
 * Extract source branch name from merge commit message
 * Handles: "Merge branch 'feature/x'", "Merge pull request #123 from user/branch"
 */
function extractBranchFromMerge(subject) {
  // "Merge branch 'branch-name'"
  const branchMatch = subject.match(/Merge branch '([^']+)'/);
  if (branchMatch) return branchMatch[1];

  // "Merge pull request #N from user/branch"
  const prMatch = subject.match(/Merge pull request #\d+ from \S+\/(.+)/);
  if (prMatch) return prMatch[1];

  // "Merge remote-tracking branch 'origin/branch'"
  const remoteMatch = subject.match(/Merge remote-tracking branch '(?:origin\/)?([^']+)'/);
  if (remoteMatch) return remoteMatch[1];

  return null;
}

/**
 * Extract target branch from merge commit message
 */
function extractTargetFromMerge(subject) {
  // "Merge branch 'x' into target"
  const intoMatch = subject.match(/into (\S+)$/);
  if (intoMatch) return intoMatch[1];

  // Default: assume merge into default branch
  return null;
}

/**
 * Get the default branch name (main or master)
 */
let _defaultBranch = null;
async function getDefaultBranch(git) {
  if (_defaultBranch) return _defaultBranch;

  try {
    const ref = await git.raw(["symbolic-ref", "refs/remotes/origin/HEAD"]).catch(() => "");
    if (ref.trim()) {
      _defaultBranch = ref.trim().replace("refs/remotes/origin/", "");
      return _defaultBranch;
    }
  } catch {
    // ignore
  }

  // Fallback: check if main or master exists
  try {
    await git.raw(["rev-parse", "--verify", "main"]);
    _defaultBranch = "main";
    return _defaultBranch;
  } catch {
    try {
      await git.raw(["rev-parse", "--verify", "master"]);
      _defaultBranch = "master";
      return _defaultBranch;
    } catch {
      _defaultBranch = "main";
      return _defaultBranch;
    }
  }
}
