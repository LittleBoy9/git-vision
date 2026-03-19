#!/usr/bin/env node

import { program } from "commander";
import ora from "ora";
import chalk from "chalk";
import { simpleGit } from "simple-git";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { analyze, formatReport } from "../src/index.js";
import { writeConfig } from "../src/config/init.js";

const VERSION = "2.0.0";

program
  .name("git-vision")
  .description("Analyze Git history to surface risky files, unstable modules, knowledge silos, and hidden dependencies.")
  .version(VERSION);

// Global options
program
  .option("-f, --format <type>", "output format: terminal, json, html", "terminal")
  .option("-t, --top <n>", "number of results to show", parseInt, 10)
  .option("-s, --since <period>", "limit analysis window (e.g., 6months, 1year)")
  .option("-i, --ignore <patterns>", "comma-separated glob patterns to exclude", parseIgnore)
  .option("-p, --path <dir>", "path to git repository (default: current directory)")
  .option("-b, --blame", "enable git blame for true line-level ownership (slower)")
  .option("-c, --compare <period>", "compare two time periods (e.g., 3months)")
  .option("-w, --workspace [path]", "enable monorepo mode (auto-detect or specify path)");

// Default command: run all analyzers
program
  .action(async (opts) => {
    await runAnalysis(null, opts);
  });

// Core subcommands
program
  .command("hotspots")
  .description("Files with highest churn x complexity (most likely to contain bugs)")
  .action(async () => {
    await runAnalysis("hotspots", program.opts());
  });

program
  .command("coupling")
  .description("Files that frequently change together (hidden dependencies)")
  .action(async () => {
    await runAnalysis("coupling", program.opts());
  });

program
  .command("bus-factor")
  .description("Files and modules where knowledge is concentrated in too few people")
  .action(async () => {
    await runAnalysis("bus-factor", program.opts());
  });

program
  .command("age")
  .description("Stale zones and volatile files")
  .action(async () => {
    await runAnalysis("age", program.opts());
  });

program
  .command("contributors")
  .description("Contribution patterns across modules")
  .action(async () => {
    await runAnalysis("contributors", program.opts());
  });

// V2 subcommands
program
  .command("blame")
  .description("True line-level ownership via git blame (slower, more accurate)")
  .action(async () => {
    const opts = program.opts();
    opts.blame = true;
    await runAnalysis("blame", opts);
  });

program
  .command("trends")
  .description("Compare two time periods to track health changes")
  .action(async () => {
    const opts = program.opts();
    if (!opts.compare) opts.compare = "3months";
    await runAnalysis("trends", opts);
  });

program
  .command("monorepo")
  .description("Analyze workspaces independently with per-package health scores")
  .action(async () => {
    const opts = program.opts();
    if (!opts.workspace) opts.workspace = true;
    await runAnalysis("monorepo", opts);
  });

// Branch graph command
program
  .command("branches")
  .description("Branch topology, merge history, stale branches, and lifecycle analysis")
  .action(async () => {
    await runAnalysis("branches", program.opts());
  });

// NEW: diff command
program
  .command("diff [target]")
  .description("Analyze PR/branch risk against a base branch (default: main)")
  .action(async (target) => {
    const opts = program.opts();
    opts.diffTarget = target || "main";
    await runAnalysis("diff", opts);
  });

// Remote repo analysis
program
  .command("remote <url> [module]")
  .description("Analyze any remote git repo without cloning it yourself")
  .action(async (url, module) => {
    const opts = program.opts();
    const spinner = ora({
      text: chalk.dim("Cloning repository..."),
      color: "cyan",
    }).start();

    let tempDir;
    try {
      // Normalize GitHub shorthand: user/repo -> full URL
      const repoUrl = url.includes("://") || url.includes("@")
        ? url
        : `https://github.com/${url}.git`;

      // Create temp directory
      tempDir = mkdtempSync(join(tmpdir(), "git-vision-"));

      // Blobless clone — full commit history, blobs fetched on demand
      const git = simpleGit();
      spinner.text = chalk.dim(`Cloning ${repoUrl}...`);
      await git.clone(repoUrl, tempDir, ["--filter=blob:none"]);

      spinner.text = chalk.dim("Analyzing...");

      // Build analysis options
      const analysisOpts = {
        module: module || null,
        format: opts.format,
        top: opts.top,
        since: opts.since,
        ignore: opts.ignore,
        repoPath: tempDir,
        blame: opts.blame ? { enabled: true } : undefined,
        compare: opts.compare,
        monorepo: opts.workspace
          ? { enabled: true, workspaces: typeof opts.workspace === "string" ? [opts.workspace] : [] }
          : undefined,
      };

      if (analysisOpts.blame?.enabled) {
        analysisOpts.onBlameProgress = ({ current, total, file }) => {
          spinner.text = chalk.dim(`Running git blame... ${current}/${total} — ${file}`);
        };
      }

      const report = await analyze(analysisOpts);
      const output = await formatReport(report, opts.format);

      spinner.stop();
      console.log("");
      console.log(chalk.dim(`  Remote: ${repoUrl}`));
      console.log(output);
    } catch (err) {
      spinner.fail(chalk.red(err.message));
      process.exit(1);
    } finally {
      // Clean up temp directory
      if (tempDir) {
        try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }
    }
  });

// NEW: init command
program
  .command("init")
  .description("Generate a .gitvisionrc.json with smart defaults for your project")
  .action(async () => {
    const repoPath = program.opts().path || process.cwd();
    const result = writeConfig(repoPath);

    if (!result.written) {
      console.log(chalk.yellow(`\n  ${result.reason}`));
      console.log(chalk.dim(`  Path: ${result.path}\n`));
      return;
    }

    console.log("");
    console.log(chalk.green.bold("  .gitvisionrc.json created!"));
    console.log("");

    if (result.detected.length > 0) {
      console.log(chalk.dim("  Detected:") + " " + chalk.white(result.detected.join(", ")));
    }
    if (result.isMonorepo) {
      console.log(chalk.dim("  Monorepo:") + " " + chalk.cyan("yes (auto-detected)"));
    }

    console.log(chalk.dim("  Path:    ") + " " + chalk.white(result.path));
    console.log("");
    console.log(chalk.dim("  Edit the file to customize thresholds, ignores, and features."));
    console.log("");
  });

async function runAnalysis(module, opts) {
  const spinner = ora({
    text: chalk.dim("Analyzing git history..."),
    color: "cyan",
  }).start();

  try {
    const options = {
      module,
      format: opts.format,
      top: opts.top,
      since: opts.since,
      ignore: opts.ignore,
      repoPath: opts.path || process.cwd(),
      blame: opts.blame ? { enabled: true } : undefined,
      compare: opts.compare,
      diffTarget: opts.diffTarget,
      monorepo: opts.workspace
        ? { enabled: true, workspaces: typeof opts.workspace === "string" ? [opts.workspace] : [] }
        : undefined,
    };

    // Blame progress callback
    if (options.blame?.enabled) {
      options.onBlameProgress = ({ current, total, file }) => {
        spinner.text = chalk.dim(`Running git blame... ${current}/${total} — ${file}`);
      };
    }

    spinner.text = chalk.dim("Reading commit log...");
    const report = await analyze(options);

    spinner.text = chalk.dim("Generating report...");
    const output = await formatReport(report, opts.format);

    spinner.stop();
    console.log("");
    console.log(output);

    // Exit with non-zero if health score is critical (for CI)
    if (report.healthScore && report.healthScore.overall < 40) {
      process.exit(1);
    }

    // Exit with non-zero if diff risk is critical (for CI)
    if (report.diff && report.diff.riskLevel === "critical") {
      process.exit(1);
    }
  } catch (err) {
    spinner.fail(chalk.red(err.message));
    process.exit(1);
  }
}

function parseIgnore(val) {
  return val.split(",").map((p) => p.trim()).filter(Boolean);
}

program.parse();
