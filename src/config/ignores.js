/**
 * Smart Default Ignores
 *
 * Auto-filters noise from analysis: lock files, binaries, generated code,
 * vendored dependencies. These files pollute hotspot/coupling results
 * and make the tool look amateur.
 *
 * Users can override with .gitvisionrc or --ignore flag.
 */

// Files that should ALWAYS be excluded (generated, binary, lock files)
export const DEFAULT_IGNORE_PATTERNS = [
  // Lock files (always noise in hotspot analysis)
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "Gemfile.lock",
  "Cargo.lock",
  "composer.lock",
  "poetry.lock",
  "Pipfile.lock",
  "go.sum",
  "flake.lock",

  // Dependency directories
  "node_modules/**",
  "vendor/**",
  "bower_components/**",
  ".bundle/**",

  // Build output
  "dist/**",
  "build/**",
  "out/**",
  ".next/**",
  ".nuxt/**",
  ".output/**",
  "target/**",
  "*.min.js",
  "*.min.css",
  "*.bundle.js",
  "*.chunk.js",

  // Generated / compiled
  "*.map",
  "*.d.ts",
  "*.pyc",
  "*.class",
  "*.o",
  "*.so",
  "*.dylib",
  "*.dll",
  "*.exe",

  // Binary / media (never useful in churn analysis)
  "*.png",
  "*.jpg",
  "*.jpeg",
  "*.gif",
  "*.ico",
  "*.svg",
  "*.woff",
  "*.woff2",
  "*.ttf",
  "*.eot",
  "*.mp3",
  "*.mp4",
  "*.webm",
  "*.pdf",
  "*.zip",
  "*.tar.gz",
  "*.jar",

  // IDE / OS
  ".idea/**",
  ".vscode/**",
  ".DS_Store",
  "Thumbs.db",

  // Coverage / logs
  "coverage/**",
  ".nyc_output/**",
  "*.log",
];

// Additional patterns to exclude from HOTSPOT scoring specifically
// (still tracked in coupling/contributor analysis)
export const HOTSPOT_EXCLUDE_PATTERNS = [
  // Config files (high churn but low risk)
  ".eslintrc*",
  ".prettierrc*",
  "tsconfig*.json",
  ".babelrc*",
  "webpack.config.*",
  "vite.config.*",
  "next.config.*",
  "tailwind.config.*",
  "postcss.config.*",
  "jest.config.*",
  ".env*",
];

/**
 * Check if a file path matches any of the given glob-like patterns.
 * Supports: *, **, and simple extension matching.
 */
export function matchesPattern(filePath, patterns) {
  for (const pattern of patterns) {
    if (matchSingle(filePath, pattern)) return true;
  }
  return false;
}

function matchSingle(filePath, pattern) {
  // Exact match
  if (filePath === pattern) return true;

  // Extension match: "*.json" matches "foo/bar.json"
  if (pattern.startsWith("*.")) {
    const ext = pattern.slice(1); // ".json"
    return filePath.endsWith(ext);
  }

  // Directory glob: "dist/**" matches "dist/foo/bar.js"
  if (pattern.endsWith("/**")) {
    const dir = pattern.slice(0, -3); // "dist"
    return filePath.startsWith(dir + "/") || filePath === dir;
  }

  // Simple glob: "*.min.js" matches "app.min.js"
  if (pattern.includes("*")) {
    const regex = new RegExp(
      "^" +
        pattern
          .replace(/\./g, "\\.")
          .replace(/\*\*/g, "{{GLOBSTAR}}")
          .replace(/\*/g, "[^/]*")
          .replace(/\{\{GLOBSTAR\}\}/g, ".*") +
        "$"
    );
    return regex.test(filePath);
  }

  // Basename match: "package-lock.json" matches "some/path/package-lock.json"
  const basename = filePath.split("/").pop();
  return basename === pattern;
}

/**
 * Filter an array of file paths, removing those matching ignore patterns.
 */
export function filterIgnored(filePaths, extraIgnores = []) {
  const patterns = [...DEFAULT_IGNORE_PATTERNS, ...extraIgnores];
  return filePaths.filter((f) => !matchesPattern(f, patterns));
}

/**
 * Check if a file should be excluded from hotspot scoring.
 */
export function isHotspotExcluded(filePath) {
  return matchesPattern(filePath, HOTSPOT_EXCLUDE_PATTERNS);
}
