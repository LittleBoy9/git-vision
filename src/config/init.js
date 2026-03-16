/**
 * git-vision init
 *
 * Auto-detects project type and generates a .gitvisionrc.json
 * with smart defaults for the specific stack.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const PROJECT_TYPES = {
  node: {
    detect: (repoPath) => existsSync(join(repoPath, "package.json")),
    ignore: ["node_modules/**", "dist/**", "build/**", "coverage/**", "*.min.js", "*.min.css"],
    label: "Node.js",
  },
  nextjs: {
    detect: (repoPath) => {
      const pkg = readPkg(repoPath);
      return pkg?.dependencies?.next || pkg?.devDependencies?.next;
    },
    ignore: [".next/**", "node_modules/**", "dist/**", "out/**", "coverage/**"],
    label: "Next.js",
  },
  python: {
    detect: (repoPath) =>
      existsSync(join(repoPath, "requirements.txt")) ||
      existsSync(join(repoPath, "setup.py")) ||
      existsSync(join(repoPath, "pyproject.toml")),
    ignore: ["__pycache__/**", "*.pyc", ".venv/**", "venv/**", "dist/**", "*.egg-info/**", ".tox/**"],
    label: "Python",
  },
  go: {
    detect: (repoPath) => existsSync(join(repoPath, "go.mod")),
    ignore: ["vendor/**", "*.exe", "*.test"],
    label: "Go",
  },
  rust: {
    detect: (repoPath) => existsSync(join(repoPath, "Cargo.toml")),
    ignore: ["target/**", "*.rlib", "*.rmeta"],
    label: "Rust",
  },
  java: {
    detect: (repoPath) =>
      existsSync(join(repoPath, "pom.xml")) ||
      existsSync(join(repoPath, "build.gradle")) ||
      existsSync(join(repoPath, "build.gradle.kts")),
    ignore: ["target/**", "build/**", "*.class", "*.jar", ".gradle/**"],
    label: "Java",
  },
  ruby: {
    detect: (repoPath) => existsSync(join(repoPath, "Gemfile")),
    ignore: ["vendor/**", ".bundle/**", "coverage/**", "tmp/**"],
    label: "Ruby",
  },
  php: {
    detect: (repoPath) => existsSync(join(repoPath, "composer.json")),
    ignore: ["vendor/**", "node_modules/**", "storage/**", "bootstrap/cache/**"],
    label: "PHP",
  },
};

// Detect order matters — more specific first
const DETECT_ORDER = ["nextjs", "rust", "go", "java", "ruby", "php", "python", "node"];

export function detectProjectType(repoPath) {
  const detected = [];
  for (const type of DETECT_ORDER) {
    try {
      if (PROJECT_TYPES[type].detect(repoPath)) {
        detected.push(type);
      }
    } catch { /* skip detection errors */ }
  }
  return detected;
}

export function generateConfig(repoPath) {
  const types = detectProjectType(repoPath);

  // Merge ignores from all detected types
  const ignoreSet = new Set();
  const labels = [];

  for (const type of types) {
    const pt = PROJECT_TYPES[type];
    labels.push(pt.label);
    for (const pattern of pt.ignore) {
      ignoreSet.add(pattern);
    }
  }

  // Check for monorepo
  const isMonorepo = checkMonorepo(repoPath);

  const config = {
    $schema: "https://raw.githubusercontent.com/git-vision/git-vision/main/schema.json",
    format: "terminal",
    top: 10,
    ignore: [...ignoreSet],
    thresholds: {
      busFactor: { ownershipThreshold: 0.8 },
      coupling: { minSharedCommits: 5, minCouplingDegree: 0.3 },
      healthScore: { critical: 40 },
    },
    blame: { enabled: false, maxFiles: 50 },
    monorepo: { enabled: isMonorepo },
  };

  return {
    config,
    detected: labels,
    isMonorepo,
  };
}

export function writeConfig(repoPath) {
  const rcPath = join(repoPath, ".gitvisionrc.json");

  if (existsSync(rcPath)) {
    return { written: false, path: rcPath, reason: ".gitvisionrc.json already exists" };
  }

  const { config, detected, isMonorepo } = generateConfig(repoPath);
  writeFileSync(rcPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

  return {
    written: true,
    path: rcPath,
    detected,
    isMonorepo,
  };
}

function readPkg(repoPath) {
  try {
    return JSON.parse(readFileSync(join(repoPath, "package.json"), "utf-8"));
  } catch {
    return null;
  }
}

function checkMonorepo(repoPath) {
  const pkg = readPkg(repoPath);
  if (pkg?.workspaces) return true;
  if (existsSync(join(repoPath, "pnpm-workspace.yaml"))) return true;
  if (existsSync(join(repoPath, "lerna.json"))) return true;
  return false;
}
