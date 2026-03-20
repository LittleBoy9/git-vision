import { describe, it } from "node:test";
import assert from "node:assert";
import { analyzeCodeAge } from "../src/analyzers/codeAge.js";
import { makeFileSummary, makeFileSummariesMap } from "./_helpers.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();

describe("Code Age", () => {
  it('file last modified >365 days ago is "ancient"', () => {
    const summaries = makeFileSummariesMap([
      makeFileSummary({
        path: "src/old.js",
        lastModified: new Date(now - 400 * DAY_MS),
        firstSeen: new Date(now - 800 * DAY_MS),
        churn: 5,
        authors: [["A", 5]],
        commits: [
          {
            hash: "a1",
            author: "A",
            date: new Date(now - 400 * DAY_MS),
            subject: "old change",
          },
        ],
      }),
    ]);

    const result = analyzeCodeAge(summaries);
    assert.strictEqual(result.staleFiles[0].status, "ancient");
    assert.ok(result.staleFiles[0].daysSinceLastChange > 365);
  });

  it('file last modified >180 days ago is "stale"', () => {
    const summaries = makeFileSummariesMap([
      makeFileSummary({
        path: "src/stale.js",
        lastModified: new Date(now - 250 * DAY_MS),
        firstSeen: new Date(now - 500 * DAY_MS),
        churn: 5,
        authors: [["A", 5]],
        commits: [
          {
            hash: "s1",
            author: "A",
            date: new Date(now - 250 * DAY_MS),
            subject: "stale change",
          },
        ],
      }),
    ]);

    const result = analyzeCodeAge(summaries);
    assert.strictEqual(result.staleFiles[0].status, "stale");
    assert.ok(result.staleFiles[0].daysSinceLastChange > 180);
    assert.ok(result.staleFiles[0].daysSinceLastChange <= 365);
  });

  it('recent file is "active"', () => {
    const summaries = makeFileSummariesMap([
      makeFileSummary({
        path: "src/active.js",
        lastModified: new Date(now - 10 * DAY_MS),
        firstSeen: new Date(now - 60 * DAY_MS),
        churn: 3,
        authors: [["A", 3]],
        commits: [
          {
            hash: "r1",
            author: "A",
            date: new Date(now - 10 * DAY_MS),
            subject: "recent",
          },
        ],
      }),
    ]);

    const result = analyzeCodeAge(summaries);
    // Active files won't be in staleFiles; check stats
    assert.ok(result.stats.active > 0 || result.stats.volatile > 0);
    assert.strictEqual(result.stats.ancient, 0);
    assert.strictEqual(result.stats.stale, 0);
  });

  it("stats counts are correct", () => {
    const summaries = makeFileSummariesMap([
      makeFileSummary({
        path: "src/ancient.js",
        lastModified: new Date(now - 400 * DAY_MS),
        firstSeen: new Date(now - 800 * DAY_MS),
        churn: 2,
        authors: [["A", 2]],
        commits: [
          { hash: "a", author: "A", date: new Date(now - 400 * DAY_MS), subject: "x" },
        ],
      }),
      makeFileSummary({
        path: "src/stale.js",
        lastModified: new Date(now - 250 * DAY_MS),
        firstSeen: new Date(now - 500 * DAY_MS),
        churn: 2,
        authors: [["A", 2]],
        commits: [
          { hash: "b", author: "A", date: new Date(now - 250 * DAY_MS), subject: "x" },
        ],
      }),
      makeFileSummary({
        path: "src/active.js",
        lastModified: new Date(now - 5 * DAY_MS),
        firstSeen: new Date(now - 30 * DAY_MS),
        churn: 2,
        authors: [["A", 2]],
        commits: [
          { hash: "c", author: "A", date: new Date(now - 5 * DAY_MS), subject: "x" },
        ],
      }),
    ]);

    const result = analyzeCodeAge(summaries);
    assert.strictEqual(result.stats.totalFilesAnalyzed, 3);
    assert.strictEqual(result.stats.ancient, 1);
    assert.strictEqual(result.stats.stale, 1);
    assert.ok(result.stats.active >= 1);
  });

  it("empty input returns empty results", () => {
    const result = analyzeCodeAge(new Map());
    assert.strictEqual(result.total, 0);
    assert.strictEqual(result.staleFiles.length, 0);
    assert.strictEqual(result.volatileFiles.length, 0);
  });
});
