#!/usr/bin/env node

import { program } from "commander";
import ora from "ora";
import chalk from "chalk";
import { analyze, formatReport } from "../src/index.js";

const VERSION = "1.0.0";

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
  .option("-p, --path <dir>", "path to git repository (default: current directory)");

// Default command: run all analyzers
program
  .action(async (opts) => {
    await runAnalysis(null, opts);
  });

// Subcommands for individual analyzers
program
  .command("hotspots")
  .description("Show files with highest churn × complexity (most likely to contain bugs)")
  .action(async () => {
    await runAnalysis("hotspots", program.opts());
  });

program
  .command("coupling")
  .description("Detect files that frequently change together (hidden dependencies)")
  .action(async () => {
    await runAnalysis("coupling", program.opts());
  });

program
  .command("bus-factor")
  .description("Find files and modules where knowledge is concentrated in too few people")
  .action(async () => {
    await runAnalysis("bus-factor", program.opts());
  });

program
  .command("age")
  .description("Identify stale zones and volatile files")
  .action(async () => {
    await runAnalysis("age", program.opts());
  });

program
  .command("contributors")
  .description("Analyze contribution patterns across modules")
  .action(async () => {
    await runAnalysis("contributors", program.opts());
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
    };

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
  } catch (err) {
    spinner.fail(chalk.red(err.message));
    process.exit(1);
  }
}

function parseIgnore(val) {
  return val.split(",").map((p) => p.trim()).filter(Boolean);
}

program.parse();
