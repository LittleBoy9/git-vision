import { describe, it } from "node:test";
import assert from "node:assert";
import { analyzeKnowledgeLoss } from "../src/analyzers/knowledgeLoss.js";
import { makeCommit, makeFileSummary, makeFileSummariesMap } from "./_helpers.js";

describe("Knowledge Loss", () => {
  const now = new Date();
  const daysAgo = (d) => new Date(now.getTime() - d * 86400000);

  it("detects departed authors who stopped committing", () => {
    const commits = [
      makeCommit({ author: "Alice", date: daysAgo(200), files: ["src/core.js"] }),
      makeCommit({ author: "Alice", date: daysAgo(195), files: ["src/core.js"] }),
      makeCommit({ author: "Alice", date: daysAgo(190), files: ["src/core.js"] }),
      makeCommit({ author: "Bob", date: daysAgo(10), files: ["src/core.js"] }),
    ];

    const fs = makeFileSummariesMap([
      makeFileSummary({
        path: "src/core.js",
        authors: [["Alice", 3], ["Bob", 1]],
        commits: commits.map((c) => ({ hash: c.hash, author: c.author, date: c.date, subject: c.subject })),
      }),
    ]);

    const result = analyzeKnowledgeLoss(fs, commits);
    assert.ok(result.results.length > 0);
    const file = result.results[0];
    assert.strictEqual(file.departedAuthors.length, 1);
    assert.strictEqual(file.departedAuthors[0].author, "Alice");
    assert.strictEqual(file.activeAuthors, 1);
  });

  it("flags files at risk when departed authors owned significant share", () => {
    const commits = [
      makeCommit({ author: "Alice", date: daysAgo(250), files: ["src/pay.js"] }),
      makeCommit({ author: "Alice", date: daysAgo(240), files: ["src/pay.js"] }),
      makeCommit({ author: "Alice", date: daysAgo(230), files: ["src/pay.js"] }),
      makeCommit({ author: "Alice", date: daysAgo(220), files: ["src/pay.js"] }),
      makeCommit({ author: "Bob", date: daysAgo(5), files: ["src/pay.js"] }),
    ];

    const fs = makeFileSummariesMap([
      makeFileSummary({
        path: "src/pay.js",
        authors: [["Alice", 4], ["Bob", 1]],
        commits: commits.map((c) => ({ hash: c.hash, author: c.author, date: c.date, subject: c.subject })),
      }),
    ]);

    const result = analyzeKnowledgeLoss(fs, commits);
    const file = result.results.find((f) => f.path === "src/pay.js");
    assert.ok(file);
    assert.ok(file.isAtRisk);
    assert.strictEqual(file.knowledgeLostPct, 80);
  });

  it("does not flag active contributors as departed", () => {
    const commits = [
      makeCommit({ author: "Alice", date: daysAgo(30), files: ["src/ok.js"] }),
      makeCommit({ author: "Alice", date: daysAgo(20), files: ["src/ok.js"] }),
      makeCommit({ author: "Alice", date: daysAgo(10), files: ["src/ok.js"] }),
      makeCommit({ author: "Bob", date: daysAgo(5), files: ["src/ok.js"] }),
    ];

    const fs = makeFileSummariesMap([
      makeFileSummary({
        path: "src/ok.js",
        authors: [["Alice", 3], ["Bob", 1]],
        commits: commits.map((c) => ({ hash: c.hash, author: c.author, date: c.date, subject: c.subject })),
      }),
    ]);

    const result = analyzeKnowledgeLoss(fs, commits);
    assert.strictEqual(result.results.length, 0);
  });

  it("reports correct stats", () => {
    const commits = [
      makeCommit({ author: "Alice", date: daysAgo(300), files: ["a.js"] }),
      makeCommit({ author: "Alice", date: daysAgo(290), files: ["a.js"] }),
      makeCommit({ author: "Alice", date: daysAgo(280), files: ["a.js"] }),
      makeCommit({ author: "Bob", date: daysAgo(5), files: ["a.js", "b.js"] }),
      makeCommit({ author: "Bob", date: daysAgo(3), files: ["b.js"] }),
      makeCommit({ author: "Bob", date: daysAgo(1), files: ["b.js"] }),
    ];

    const fs = makeFileSummariesMap([
      makeFileSummary({
        path: "a.js",
        authors: [["Alice", 3], ["Bob", 1]],
        commits: commits.filter((c) => c.files.some((f) => f.path === "a.js"))
          .map((c) => ({ hash: c.hash, author: c.author, date: c.date, subject: c.subject })),
      }),
      makeFileSummary({
        path: "b.js",
        authors: [["Bob", 3]],
        commits: commits.filter((c) => c.files.some((f) => f.path === "b.js"))
          .map((c) => ({ hash: c.hash, author: c.author, date: c.date, subject: c.subject })),
      }),
    ]);

    const result = analyzeKnowledgeLoss(fs, commits);
    assert.strictEqual(result.stats.totalDepartedAuthors, 1);
    assert.ok(result.stats.totalActiveAuthors >= 1);
    assert.ok(result.departedContributors.some((d) => d.author === "Alice"));
  });

  it("respects custom inactivity threshold", () => {
    const commits = [
      makeCommit({ author: "Alice", date: daysAgo(100), files: ["src/x.js"] }),
      makeCommit({ author: "Alice", date: daysAgo(90), files: ["src/x.js"] }),
      makeCommit({ author: "Alice", date: daysAgo(80), files: ["src/x.js"] }),
    ];

    const fs = makeFileSummariesMap([
      makeFileSummary({
        path: "src/x.js",
        authors: [["Alice", 3]],
        commits: commits.map((c) => ({ hash: c.hash, author: c.author, date: c.date, subject: c.subject })),
      }),
    ]);

    // Default 180 days: Alice is active
    const result1 = analyzeKnowledgeLoss(fs, commits);
    assert.strictEqual(result1.results.length, 0);

    // Custom 60 days: Alice is departed
    const result2 = analyzeKnowledgeLoss(fs, commits, { inactivityThreshold: 60 });
    assert.ok(result2.results.length > 0);
  });
});
