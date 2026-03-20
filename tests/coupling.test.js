import { describe, it } from "node:test";
import assert from "node:assert";
import { analyzeCoupling } from "../src/analyzers/coupling.js";
import { makeCommit } from "./_helpers.js";

describe("Change Coupling", () => {
  it("two files in 5+ shared commits are detected as coupled", () => {
    // Create 6 commits where fileA and fileB always change together
    const commits = Array.from({ length: 6 }, (_, i) =>
      makeCommit({
        hash: `commit${i}`,
        files: [
          { path: "src/fileA.js", additions: 5, deletions: 2 },
          { path: "lib/fileB.js", additions: 3, deletions: 1 },
        ],
      })
    );

    const result = analyzeCoupling(commits, { minSharedCommits: 5 });
    assert.ok(result.results.length > 0);
    const pair = result.results[0];
    assert.ok(
      (pair.fileA === "src/fileA.js" && pair.fileB === "lib/fileB.js") ||
        (pair.fileA === "lib/fileB.js" && pair.fileB === "src/fileA.js")
    );
    assert.ok(pair.sharedCommits >= 5);
    assert.ok(pair.degree > 0);
  });

  it("below threshold not detected", () => {
    // Only 3 shared commits, below default threshold of 5
    const commits = Array.from({ length: 3 }, (_, i) =>
      makeCommit({
        hash: `commit${i}`,
        files: [
          { path: "src/fileA.js", additions: 5, deletions: 2 },
          { path: "src/fileB.js", additions: 3, deletions: 1 },
        ],
      })
    );

    const result = analyzeCoupling(commits, { minSharedCommits: 5 });
    assert.strictEqual(result.results.length, 0);
  });

  it("large commits (50+ files) are skipped", () => {
    const manyFiles = Array.from({ length: 51 }, (_, i) => ({
      path: `src/file${i}.js`,
      additions: 1,
      deletions: 0,
    }));

    const commits = Array.from({ length: 10 }, (_, i) =>
      makeCommit({ hash: `commit${i}`, files: manyFiles })
    );

    const result = analyzeCoupling(commits);
    assert.strictEqual(result.results.length, 0);
    assert.strictEqual(result.stats.totalPairsAnalyzed, 0);
  });

  it("cross-module couplings are prioritized over same-module", () => {
    // Cross-module pair: src/a.js and lib/b.js
    // Same-module pair: src/a.js and src/c.js
    const commits = Array.from({ length: 6 }, (_, i) =>
      makeCommit({
        hash: `commit${i}`,
        files: [
          { path: "src/a.js", additions: 1, deletions: 0 },
          { path: "lib/b.js", additions: 1, deletions: 0 },
          { path: "src/c.js", additions: 1, deletions: 0 },
        ],
      })
    );

    const result = analyzeCoupling(commits, { minSharedCommits: 5 });
    // Cross-module couplings should come first
    const crossModule = result.results.filter((r) => !r.sameModule);
    const sameModule = result.results.filter((r) => r.sameModule);

    if (crossModule.length > 0 && sameModule.length > 0) {
      const firstCross = result.results.indexOf(crossModule[0]);
      const firstSame = result.results.indexOf(sameModule[0]);
      assert.ok(firstCross < firstSame);
    }
  });

  it("single-file commits produce no couplings", () => {
    const commits = Array.from({ length: 10 }, (_, i) =>
      makeCommit({
        hash: `commit${i}`,
        files: [{ path: "src/only.js", additions: 1, deletions: 0 }],
      })
    );

    const result = analyzeCoupling(commits);
    assert.strictEqual(result.results.length, 0);
  });
});
