import { describe, it } from "node:test";
import assert from "node:assert";
import { analyzeHotspots } from "../src/analyzers/hotspots.js";
import { makeFileSummary, makeFileSummariesMap } from "./_helpers.js";

// Mock getFileLOC: returns LOC based on a lookup table
function makeLOCFn(locMap) {
  return (path) => locMap[path] || { total: 0, nonEmpty: 0 };
}

describe("Hotspots", () => {
  it("high churn + high LOC file ranks first", () => {
    const summaries = makeFileSummariesMap([
      makeFileSummary({ path: "src/big.js", churn: 20, authors: [["A", 20]] }),
      makeFileSummary({ path: "src/small.js", churn: 5, authors: [["A", 5]] }),
    ]);

    const getLOC = makeLOCFn({
      "src/big.js": { total: 500, nonEmpty: 400 },
      "src/small.js": { total: 50, nonEmpty: 40 },
    });

    const result = analyzeHotspots(summaries, getLOC);
    assert.strictEqual(result.results[0].path, "src/big.js");
    assert.ok(result.results[0].score > result.results[1].score);
  });

  it("test files get dampened scoring (0.3x)", () => {
    const summaries = makeFileSummariesMap([
      makeFileSummary({ path: "src/app.js", churn: 10, authors: [["A", 10]] }),
      makeFileSummary({
        path: "src/app.test.js",
        churn: 10,
        authors: [["A", 10]],
      }),
    ]);

    const getLOC = makeLOCFn({
      "src/app.js": { total: 100, nonEmpty: 80 },
      "src/app.test.js": { total: 100, nonEmpty: 80 },
    });

    const result = analyzeHotspots(summaries, getLOC);
    const app = result.results.find((r) => r.path === "src/app.js");
    const test = result.results.find((r) => r.path === "src/app.test.js");

    assert.ok(app.score > test.score);
    assert.strictEqual(test.isTest, true);
    assert.strictEqual(test.score, Math.round(app.score * 0.3));
  });

  it("top option limits results", () => {
    const entries = Array.from({ length: 20 }, (_, i) =>
      makeFileSummary({
        path: `src/file${i}.js`,
        churn: 10,
        authors: [["A", 10]],
      })
    );
    const summaries = makeFileSummariesMap(entries);

    const locMap = {};
    entries.forEach((e) => {
      locMap[e.path] = { total: 100, nonEmpty: 80 };
    });

    const result = analyzeHotspots(summaries, makeLOCFn(locMap), { top: 5 });
    assert.strictEqual(result.results.length, 5);
    assert.strictEqual(result.total, 20);
  });

  it("empty input returns empty results", () => {
    const result = analyzeHotspots(new Map(), () => ({ total: 0, nonEmpty: 0 }));
    assert.strictEqual(result.results.length, 0);
    assert.strictEqual(result.total, 0);
  });

  it("files with 0 LOC are skipped", () => {
    const summaries = makeFileSummariesMap([
      makeFileSummary({ path: "src/deleted.js", churn: 10, authors: [["A", 10]] }),
    ]);

    const result = analyzeHotspots(summaries, () => ({ total: 0, nonEmpty: 0 }));
    assert.strictEqual(result.results.length, 0);
  });
});
