/**
 * format-pr-comment.js
 *
 * Reads a git-vision JSON report and produces:
 *   /tmp/gv-comment.md     — formatted PR comment body
 *   /tmp/gv-risk-score.txt  — numeric risk score
 *   /tmp/gv-risk-level.txt  — risk level string
 *
 * Also writes GitHub Actions outputs via $GITHUB_OUTPUT.
 *
 * Usage: node format-pr-comment.js <path-to-json-report>
 *
 * No external dependencies — uses only Node.js builtins.
 */

import { readFileSync, writeFileSync, appendFileSync } from "fs";
import { resolve } from "path";

const RISK_EMOJI = {
  low: "\u2705",       // green check
  medium: "\u26A0\uFE0F",  // yellow warning
  high: "\uD83D\uDFE0",    // orange circle
  critical: "\uD83D\uDD34", // red circle
  none: "\u2705",
};

const RISK_COLOR = {
  low: "brightgreen",
  medium: "yellow",
  high: "orange",
  critical: "red",
  none: "lightgrey",
};

const SEVERITY_EMOJI = {
  high: "\uD83D\uDD34",
  medium: "\uD83D\uDFE1",
  low: "\uD83D\uDFE2",
};

function main() {
  const reportPath = process.argv[2];

  if (!reportPath) {
    writeErrorComment("No report path provided to format-pr-comment.js");
    process.exit(0);
  }

  let raw;
  try {
    raw = readFileSync(resolve(reportPath), "utf-8");
  } catch {
    writeErrorComment("Could not read the analysis report. The git-vision diff command may have failed.");
    process.exit(0);
  }

  if (!raw || !raw.trim()) {
    writeErrorComment("The analysis report is empty. The git-vision diff command may have produced no output.");
    process.exit(0);
  }

  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    writeErrorComment("The analysis report is not valid JSON. The git-vision diff command may have encountered an error.");
    process.exit(0);
  }

  const diff = report.diff;

  if (!diff) {
    writeErrorComment("No diff analysis found in the report. Make sure you are running `git-vision diff` and the branch has changes.");
    process.exit(0);
  }

  const { riskScore, riskLevel, stats, risks, changedFiles, base, head } = diff;

  // Write auxiliary files for the action
  writeFileSync("/tmp/gv-risk-score.txt", String(riskScore));
  writeFileSync("/tmp/gv-risk-level.txt", String(riskLevel));
  setOutput("risk-score", String(riskScore));
  setOutput("risk-level", String(riskLevel));

  // Build the comment
  const lines = [];

  lines.push("<!-- git-vision-analysis -->");
  lines.push("");
  lines.push(`## ${RISK_EMOJI[riskLevel] || RISK_EMOJI.low} git-vision PR Analysis`);
  lines.push("");

  // Risk badge
  const badgeLabel = encodeURIComponent("risk score");
  const badgeValue = encodeURIComponent(`${riskScore}/100 ${riskLevel}`);
  const badgeColor = RISK_COLOR[riskLevel] || "lightgrey";
  lines.push(`![Risk Score](https://img.shields.io/badge/${badgeLabel}-${badgeValue}-${badgeColor}?style=flat-square)`);
  lines.push("");

  // Summary stats table
  lines.push("### Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| **Files changed** | ${stats.filesChanged} |`);
  lines.push(`| **Lines added** | +${stats.totalAdditions} |`);
  lines.push(`| **Lines removed** | -${stats.totalDeletions} |`);
  lines.push(`| **Hotspot files touched** | ${stats.hotspotsHit || 0} |`);
  lines.push(`| **Bus-factor-1 files** | ${stats.busFactorRisks || 0} |`);
  lines.push(`| **Coupling warnings** | ${stats.couplingWarnings || 0} |`);
  lines.push(`| **Comparing** | \`${base || "main"}\` ... \`${head || "HEAD"}\` |`);
  lines.push("");

  // Risk details
  if (risks && risks.length > 0) {
    lines.push("### Risk Details");
    lines.push("");

    const highRisks = risks.filter((r) => r.severity === "high");
    const mediumRisks = risks.filter((r) => r.severity === "medium");
    const lowRisks = risks.filter((r) => r.severity === "low");

    if (highRisks.length > 0) {
      lines.push(`<details open>`);
      lines.push(`<summary>${SEVERITY_EMOJI.high} <strong>High severity (${highRisks.length})</strong></summary>`);
      lines.push("");
      for (const r of highRisks) {
        const filePart = r.file ? `\`${r.file}\` — ` : "";
        lines.push(`- ${filePart}${r.message}`);
      }
      lines.push("");
      lines.push("</details>");
      lines.push("");
    }

    if (mediumRisks.length > 0) {
      lines.push(`<details>`);
      lines.push(`<summary>${SEVERITY_EMOJI.medium} <strong>Medium severity (${mediumRisks.length})</strong></summary>`);
      lines.push("");
      for (const r of mediumRisks) {
        const filePart = r.file ? `\`${r.file}\` — ` : "";
        lines.push(`- ${filePart}${r.message}`);
      }
      lines.push("");
      lines.push("</details>");
      lines.push("");
    }

    if (lowRisks.length > 0) {
      lines.push(`<details>`);
      lines.push(`<summary>${SEVERITY_EMOJI.low} <strong>Low severity (${lowRisks.length})</strong></summary>`);
      lines.push("");
      for (const r of lowRisks) {
        const filePart = r.file ? `\`${r.file}\` — ` : "";
        lines.push(`- ${filePart}${r.message}`);
      }
      lines.push("");
      lines.push("</details>");
      lines.push("");
    }
  } else {
    lines.push("> No specific risks detected. This PR looks clean.");
    lines.push("");
  }

  // Hotspot files table (show top 5 if any)
  const hotspotFiles = (changedFiles || []).filter((f) => f.isHotspot).slice(0, 5);
  if (hotspotFiles.length > 0) {
    lines.push("### Hotspot Files in This PR");
    lines.push("");
    lines.push("| File | Hotspot Score | Bus Factor | Changes |");
    lines.push("|------|:------------:|:----------:|:-------:|");
    for (const f of hotspotFiles) {
      const bf = f.busFactor !== null ? String(f.busFactor) : "-";
      lines.push(`| \`${f.path}\` | ${f.hotspotScore}/100 | ${bf} | +${f.additions}/-${f.deletions} |`);
    }
    lines.push("");
  }

  // Footer
  lines.push("---");
  lines.push("");
  lines.push(`<sub>Analyzed by [git-vision](https://www.npmjs.com/package/git-vision) — zero-config git history intelligence</sub>`);

  const comment = lines.join("\n");
  writeFileSync("/tmp/gv-comment.md", comment);
}

function writeErrorComment(message) {
  const lines = [];
  lines.push("<!-- git-vision-analysis -->");
  lines.push("");
  lines.push("## \u26A0\uFE0F git-vision PR Analysis");
  lines.push("");
  lines.push(`> ${message}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`<sub>Analyzed by [git-vision](https://www.npmjs.com/package/git-vision) — zero-config git history intelligence</sub>`);

  writeFileSync("/tmp/gv-comment.md", lines.join("\n"));
  writeFileSync("/tmp/gv-risk-score.txt", "0");
  writeFileSync("/tmp/gv-risk-level.txt", "low");
  setOutput("risk-score", "0");
  setOutput("risk-level", "low");
}

function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${name}=${value}\n`);
  }
}

main();
