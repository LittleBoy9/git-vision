import { describe, it } from "node:test";
import assert from "node:assert";
import { analyzeBusFactor } from "../src/analyzers/busFactor.js";
import { makeFileSummary, makeFileSummariesMap } from "./_helpers.js";

describe("Bus Factor", () => {
  it("single-author file is flagged as risky (busFactor=1)", () => {
    const summaries = makeFileSummariesMap([
      makeFileSummary({
        path: "src/critical.js",
        authors: [["Alice", 10]],
      }),
    ]);

    const result = analyzeBusFactor(summaries);
    const file = result.results.find((r) => r.path === "src/critical.js");

    assert.ok(file);
    assert.strictEqual(file.busFactor, 1);
    assert.strictEqual(file.isRisky, true);
    assert.strictEqual(file.topOwner.author, "Alice");
    assert.strictEqual(file.topOwner.percentage, 1);
  });

  it("multi-author file has higher busFactor and is not risky", () => {
    const summaries = makeFileSummariesMap([
      makeFileSummary({
        path: "src/shared.js",
        authors: [
          ["Alice", 4],
          ["Bob", 3],
          ["Charlie", 3],
        ],
      }),
    ]);

    const result = analyzeBusFactor(summaries);
    const file = result.results.find((r) => r.path === "src/shared.js");

    assert.ok(file);
    assert.strictEqual(file.busFactor, 3);
    assert.strictEqual(file.isRisky, false);
  });

  it("files with fewer than 3 commits are skipped", () => {
    const summaries = makeFileSummariesMap([
      makeFileSummary({
        path: "src/tiny.js",
        authors: [["Alice", 2]],
      }),
    ]);

    const result = analyzeBusFactor(summaries);
    assert.strictEqual(result.results.length, 0);
  });

  it("stats are correct", () => {
    const summaries = makeFileSummariesMap([
      makeFileSummary({
        path: "src/risky.js",
        authors: [["Alice", 10]],
      }),
      makeFileSummary({
        path: "src/safe.js",
        authors: [
          ["Alice", 4],
          ["Bob", 3],
          ["Charlie", 3],
        ],
      }),
    ]);

    const result = analyzeBusFactor(summaries);
    assert.strictEqual(result.stats.totalFilesAnalyzed, 2);
    assert.strictEqual(result.stats.riskyFiles, 1);
    assert.strictEqual(result.stats.riskyPercentage, 50);
    assert.ok(result.stats.avgBusFactor > 0);
  });

  it("risky files sort before non-risky files", () => {
    const summaries = makeFileSummariesMap([
      makeFileSummary({
        path: "src/safe.js",
        authors: [
          ["Alice", 5],
          ["Bob", 5],
        ],
      }),
      makeFileSummary({
        path: "src/risky.js",
        authors: [["Charlie", 10]],
      }),
    ]);

    const result = analyzeBusFactor(summaries);
    assert.strictEqual(result.results[0].path, "src/risky.js");
    assert.strictEqual(result.results[0].isRisky, true);
  });
});
