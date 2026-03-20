import { describe, it } from "node:test";
import assert from "node:assert";
import {
  matchesPattern,
  filterIgnored,
  isHotspotExcluded,
  DEFAULT_IGNORE_PATTERNS,
  HOTSPOT_EXCLUDE_PATTERNS,
} from "../src/config/ignores.js";

describe("Ignores", () => {
  describe("matchesPattern", () => {
    it("matches exact lock file names", () => {
      assert.ok(matchesPattern("package-lock.json", DEFAULT_IGNORE_PATTERNS));
      assert.ok(matchesPattern("yarn.lock", DEFAULT_IGNORE_PATTERNS));
      assert.ok(matchesPattern("pnpm-lock.yaml", DEFAULT_IGNORE_PATTERNS));
    });

    it("matches lock files in subdirectories (basename match)", () => {
      assert.ok(matchesPattern("some/path/package-lock.json", DEFAULT_IGNORE_PATTERNS));
    });

    it("matches node_modules directory", () => {
      assert.ok(matchesPattern("node_modules/express/index.js", DEFAULT_IGNORE_PATTERNS));
    });

    it("matches dist directory", () => {
      assert.ok(matchesPattern("dist/bundle.js", DEFAULT_IGNORE_PATTERNS));
    });

    it("matches extension patterns", () => {
      assert.ok(matchesPattern("src/image.png", DEFAULT_IGNORE_PATTERNS));
      assert.ok(matchesPattern("assets/font.woff2", DEFAULT_IGNORE_PATTERNS));
      assert.ok(matchesPattern("build/app.min.js", DEFAULT_IGNORE_PATTERNS));
    });

    it("does not match normal source files", () => {
      assert.ok(!matchesPattern("src/index.js", DEFAULT_IGNORE_PATTERNS));
      assert.ok(!matchesPattern("lib/utils.ts", DEFAULT_IGNORE_PATTERNS));
      assert.ok(!matchesPattern("README.md", DEFAULT_IGNORE_PATTERNS));
    });

    it("matches .DS_Store", () => {
      assert.ok(matchesPattern(".DS_Store", DEFAULT_IGNORE_PATTERNS));
    });
  });

  describe("filterIgnored", () => {
    it("filters out ignored files from array", () => {
      const files = [
        "src/index.js",
        "package-lock.json",
        "dist/bundle.js",
        "src/utils.ts",
        "node_modules/lodash/index.js",
      ];

      const result = filterIgnored(files);
      assert.deepStrictEqual(result, ["src/index.js", "src/utils.ts"]);
    });

    it("supports extra ignore patterns", () => {
      const files = ["src/index.js", "docs/api.md"];
      const result = filterIgnored(files, ["*.md"]);
      assert.deepStrictEqual(result, ["src/index.js"]);
    });

    it("returns all files when nothing matches", () => {
      const files = ["src/a.js", "src/b.js"];
      const result = filterIgnored(files);
      assert.strictEqual(result.length, 2);
    });
  });

  describe("isHotspotExcluded", () => {
    it("excludes config files", () => {
      assert.ok(isHotspotExcluded(".eslintrc.json"));
      assert.ok(isHotspotExcluded("tsconfig.json"));
      assert.ok(isHotspotExcluded("jest.config.js"));
      assert.ok(isHotspotExcluded("vite.config.ts"));
    });

    it("does not exclude normal source files", () => {
      assert.ok(!isHotspotExcluded("src/index.js"));
      assert.ok(!isHotspotExcluded("lib/parser.ts"));
    });
  });
});
