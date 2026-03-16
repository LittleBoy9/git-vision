import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Config loader for .gitvisionrc
 *
 * Supports: .gitvisionrc, .gitvisionrc.json, .gitvisionrc.js (in repo root)
 * Config merges with CLI flags (CLI flags take precedence).
 */

const RC_FILES = [".gitvisionrc", ".gitvisionrc.json"];

const DEFAULTS = {
  format: "terminal",
  top: 10,
  since: undefined,
  ignore: [],
  thresholds: {
    hotspot: {
      highRisk: 70,
      mediumRisk: 30,
    },
    busFactor: {
      ownershipThreshold: 0.8,
      minCommits: 3,
    },
    coupling: {
      minSharedCommits: 5,
      minCouplingDegree: 0.3,
    },
    healthScore: {
      critical: 40, // exit code 1 below this
    },
  },
  blame: {
    enabled: false, // V2: opt-in since it's slower
    maxFiles: 50, // limit blame to top N files for performance
  },
  monorepo: {
    enabled: false,
    workspaces: [], // auto-detect if empty
  },
};

export function loadConfig(repoPath = process.cwd()) {
  let fileConfig = {};

  for (const rcFile of RC_FILES) {
    const rcPath = join(repoPath, rcFile);
    if (existsSync(rcPath)) {
      try {
        const raw = readFileSync(rcPath, "utf-8");
        fileConfig = JSON.parse(raw);
        fileConfig._configFile = rcFile;
        break;
      } catch (err) {
        throw new Error(`Failed to parse ${rcFile}: ${err.message}`);
      }
    }
  }

  return fileConfig;
}

/**
 * Merge config sources: defaults < .gitvisionrc < CLI flags
 */
export function mergeConfig(cliOpts = {}, fileConfig = {}) {
  const merged = deepMerge(DEFAULTS, fileConfig);

  // CLI flags override everything (only if explicitly provided)
  if (cliOpts.format) merged.format = cliOpts.format;
  if (cliOpts.top) merged.top = cliOpts.top;
  if (cliOpts.since) merged.since = cliOpts.since;
  if (cliOpts.ignore && cliOpts.ignore.length > 0) {
    merged.ignore = [...new Set([...merged.ignore, ...cliOpts.ignore])];
  }
  if (cliOpts.blame !== undefined) merged.blame.enabled = cliOpts.blame;
  if (cliOpts.workspace) {
    merged.monorepo.enabled = true;
    merged.monorepo.workspaces = cliOpts.workspace === true ? [] : [cliOpts.workspace];
  }

  // Pass through non-config CLI opts
  merged.repoPath = cliOpts.repoPath || process.cwd();
  merged.module = cliOpts.module;
  merged.compare = cliOpts.compare;

  return merged;
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (key.startsWith("_")) continue;
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export { DEFAULTS };
