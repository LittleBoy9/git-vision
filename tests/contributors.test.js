import { describe, it } from "node:test";
import assert from "node:assert";
import { analyzeContributors } from "../src/analyzers/contributors.js";
import { makeCommit, makeFileSummary, makeFileSummariesMap } from "./_helpers.js";

describe("Contributors", () => {
  it("single author has fragmentation 0", () => {
    const summaries = makeFileSummariesMap([
      makeFileSummary({
        path: "src/solo.js",
        authors: [["Alice", 10]],
      }),
    ]);

    const commits = Array.from({ length: 10 }, (_, i) =>
      makeCommit({ hash: `c${i}`, author: "Alice" })
    );

    const result = analyzeContributors(summaries, commits);
    const mod = result.modules.find((m) => m.module === "src");
    assert.ok(mod);
    assert.strictEqual(mod.fragmentation, 0);
  });

  it("even distribution has higher fragmentation", () => {
    const summaries = makeFileSummariesMap([
      makeFileSummary({
        path: "src/shared.js",
        authors: [
          ["Alice", 5],
          ["Bob", 5],
          ["Charlie", 5],
        ],
      }),
    ]);

    const commits = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeCommit({ hash: `a${i}`, author: "Alice" })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeCommit({ hash: `b${i}`, author: "Bob" })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeCommit({ hash: `c${i}`, author: "Charlie" })
      ),
    ];

    const result = analyzeContributors(summaries, commits);
    const mod = result.modules.find((m) => m.module === "src");
    assert.ok(mod);
    // Perfectly even distribution among 3 authors should give fragmentation = 1.0
    assert.ok(mod.fragmentation > 0.9);
  });

  it("module aggregation works correctly", () => {
    const summaries = makeFileSummariesMap([
      makeFileSummary({
        path: "src/a.js",
        authors: [["Alice", 5]],
      }),
      makeFileSummary({
        path: "src/b.js",
        authors: [["Bob", 3]],
      }),
      makeFileSummary({
        path: "lib/c.js",
        authors: [["Charlie", 4]],
      }),
    ]);

    const commits = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeCommit({ hash: `a${i}`, author: "Alice" })
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        makeCommit({ hash: `b${i}`, author: "Bob" })
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        makeCommit({ hash: `c${i}`, author: "Charlie" })
      ),
    ];

    const result = analyzeContributors(summaries, commits);
    assert.strictEqual(result.stats.totalModules, 2);
    assert.strictEqual(result.stats.totalContributors, 3);

    const srcMod = result.modules.find((m) => m.module === "src");
    assert.ok(srcMod);
    assert.strictEqual(srcMod.files, 2);
    assert.strictEqual(srcMod.uniqueAuthors, 2);
  });

  it("topContributors are sorted by commit count", () => {
    const summaries = makeFileSummariesMap([
      makeFileSummary({ path: "src/x.js", authors: [["Alice", 10], ["Bob", 2]] }),
    ]);

    const commits = [
      ...Array.from({ length: 10 }, (_, i) =>
        makeCommit({ hash: `a${i}`, author: "Alice" })
      ),
      ...Array.from({ length: 2 }, (_, i) =>
        makeCommit({ hash: `b${i}`, author: "Bob" })
      ),
    ];

    const result = analyzeContributors(summaries, commits);
    assert.strictEqual(result.topContributors[0].author, "Alice");
    assert.ok(result.topContributors[0].commits > result.topContributors[1].commits);
  });
});
