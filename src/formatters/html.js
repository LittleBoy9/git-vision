import { writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { generateTreemapHTML } from "./treemap.js";

/**
 * HTML Formatter
 * Generates a self-contained HTML report and opens it in the browser.
 */

export function formatHTML(report) {
  const treemapSection = report.hotspots ? generateTreemapHTML(report.hotspots) : "";
  const data = JSON.stringify(report, null, 2).replace(/<\//g, '<\\/');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>git-vision Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      padding: 2rem;
      max-width: 1100px;
      margin: 0 auto;
    }
    h1 { color: #58a6ff; font-size: 1.8rem; margin-bottom: 0.3rem; }
    h2 { color: #f0f6fc; font-size: 1.2rem; margin: 2rem 0 1rem; border-bottom: 1px solid #21262d; padding-bottom: 0.5rem; }
    .subtitle { color: #8b949e; font-size: 0.9rem; margin-bottom: 2rem; }
    .score-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 1.5rem;
      text-align: center;
      margin-bottom: 2rem;
    }
    .score-big {
      font-size: 3.5rem;
      font-weight: 700;
    }
    .score-big.good { color: #3fb950; }
    .score-big.fair { color: #d29922; }
    .score-big.bad { color: #f85149; }
    .grade { font-size: 1.1rem; margin-top: 0.3rem; }
    .breakdown {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-top: 1.5rem;
    }
    .breakdown-item {
      background: #0d1117;
      border-radius: 8px;
      padding: 1rem;
      text-align: center;
    }
    .breakdown-label { color: #8b949e; font-size: 0.8rem; text-transform: uppercase; }
    .breakdown-value { font-size: 1.5rem; font-weight: 700; margin-top: 0.3rem; }
    .bar-container {
      width: 100%;
      height: 6px;
      background: #21262d;
      border-radius: 3px;
      margin-top: 0.5rem;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.5s;
    }
    .bar-fill.good { background: #3fb950; }
    .bar-fill.fair { background: #d29922; }
    .bar-fill.bad { background: #f85149; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0.5rem 0;
    }
    th {
      text-align: left;
      color: #8b949e;
      font-weight: 500;
      font-size: 0.8rem;
      text-transform: uppercase;
      padding: 0.6rem 0.8rem;
      border-bottom: 1px solid #21262d;
    }
    td {
      padding: 0.6rem 0.8rem;
      border-bottom: 1px solid #161b22;
      font-size: 0.9rem;
    }
    tr:hover td { background: #161b22; }
    .risk-bar {
      display: inline-block;
      height: 12px;
      border-radius: 2px;
      vertical-align: middle;
    }
    .risk-high { background: #f85149; }
    .risk-medium { background: #d29922; }
    .risk-low { background: #3fb950; }
    .tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .tag-high { background: #f8514922; color: #f85149; }
    .tag-medium { background: #d2992222; color: #d29922; }
    .tag-low { background: #3fb95022; color: #3fb950; }
    .tag-cross { background: #d2992233; color: #d29922; }
    .recommendation {
      padding: 0.8rem 1rem;
      border-left: 3px solid #30363d;
      margin: 0.5rem 0;
      background: #161b22;
      border-radius: 0 6px 6px 0;
    }
    .recommendation.high { border-left-color: #f85149; }
    .recommendation.medium { border-left-color: #d29922; }
    .recommendation.low { border-left-color: #3fb950; }
    .footer { margin-top: 3rem; color: #484f58; font-size: 0.8rem; text-align: center; }
    .coupling-pair {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid #161b22;
    }
    .coupling-arrow { color: #58a6ff; }
    .coupling-degree { font-weight: 600; }
    .branch-graph-container {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 1.5rem;
      overflow-x: auto;
      margin: 1rem 0;
    }
    .graph-row {
      display: flex;
      align-items: center;
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      font-size: 0.82rem;
    }
    .graph-visual { white-space: pre; min-width: 80px; flex-shrink: 0; }
    .graph-hash { color: #d29922; margin-right: 8px; flex-shrink: 0; }
    .graph-refs { margin-right: 8px; flex-shrink: 0; }
    .graph-ref {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 0.72rem;
      font-weight: 600;
      margin-right: 4px;
    }
    .graph-ref-head { background: #3fb95033; color: #3fb950; border: 1px solid #3fb95055; }
    .graph-ref-remote { background: #f8514933; color: #f85149; border: 1px solid #f8514955; }
    .graph-ref-tag { background: #d2992233; color: #d29922; border: 1px solid #d2992255; }
    .graph-ref-branch { background: #58a6ff33; color: #58a6ff; border: 1px solid #58a6ff55; }
    .graph-subject { color: #c9d1d9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .graph-subject.merge { color: #8b949e; font-style: italic; }
    .graph-author { color: #8b949e; margin-left: 12px; font-size: 0.75rem; flex-shrink: 0; }
    .graph-svg-container {
      display: flex;
      position: relative;
      overflow-x: auto;
      gap: 12px;
    }
    .graph-svg-container svg { flex-shrink: 0; }
    .graph-info-column { flex: 1; min-width: 0; padding-top: 0; }
    .branch-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.8rem;
      margin: 1rem 0;
    }
    .branch-stat {
      background: #0d1117;
      border-radius: 8px;
      padding: 0.8rem;
      text-align: center;
    }
    .branch-stat-value { font-size: 1.4rem; font-weight: 700; color: #58a6ff; }
    .branch-stat-label { font-size: 0.75rem; color: #8b949e; text-transform: uppercase; margin-top: 0.2rem; }
    .stale-badge { background: #d2992222; color: #d29922; padding: 2px 8px; border-radius: 12px; font-size: 0.72rem; }
    .active-badge { background: #3fb95022; color: #3fb950; padding: 2px 8px; border-radius: 12px; font-size: 0.72rem; }
    .merged-badge { background: #8b949e22; color: #8b949e; padding: 2px 8px; border-radius: 12px; font-size: 0.72rem; }
  </style>
</head>
<body>
  <h1>git-vision</h1>
  <div class="subtitle" id="subtitle"></div>

  <div id="score-section"></div>
  <div id="treemap-section">${treemapSection}</div>
  <div id="hotspots-section"></div>
  <div id="bus-factor-section"></div>
  <div id="coupling-section"></div>
  <div id="code-age-section"></div>
  <div id="contributors-section"></div>
  <div id="knowledge-loss-section"></div>
  <div id="blame-section"></div>
  <div id="trends-section"></div>
  <div id="monorepo-section"></div>
  <div id="branches-section"></div>
  <div id="recommendations-section"></div>

  <div class="footer">
    Generated by git-vision &middot; <a href="https://npmjs.com/package/git-vision" style="color:#58a6ff">npmjs.com/package/git-vision</a>
  </div>

  <script>
    const report = ${data};

    // Subtitle
    document.getElementById('subtitle').textContent =
      (report.repoStats?.totalCommits?.toLocaleString() || '?') + ' commits · ' +
      (report.repoStats?.totalAuthors || '?') + ' contributors · ' +
      (report.repoStats?.currentBranch || '?');

    // Health Score
    if (report.healthScore) {
      const hs = report.healthScore;
      const scoreClass = hs.overall >= 75 ? 'good' : hs.overall >= 50 ? 'fair' : 'bad';
      const breakdownHTML = Object.entries(hs.scores).map(([key, val]) => {
        const barClass = val >= 70 ? 'good' : val >= 40 ? 'fair' : 'bad';
        return '<div class="breakdown-item">' +
          '<div class="breakdown-label">' + key + '</div>' +
          '<div class="breakdown-value">' + val + '</div>' +
          '<div class="bar-container"><div class="bar-fill ' + barClass + '" style="width:' + val + '%"></div></div>' +
        '</div>';
      }).join('');

      document.getElementById('score-section').innerHTML =
        '<div class="score-card">' +
          '<div class="score-big ' + scoreClass + '">' + hs.overall + '/100</div>' +
          '<div class="grade">' + hs.grade.letter + ' — ' + hs.grade.label + '</div>' +
          '<div class="breakdown">' + breakdownHTML + '</div>' +
        '</div>';
    }

    // Hotspots
    if (report.hotspots && report.hotspots.results.length) {
      const rows = report.hotspots.results.map(r => {
        const barClass = r.normalizedScore >= 70 ? 'risk-high' : r.normalizedScore >= 30 ? 'risk-medium' : 'risk-low';
        return '<tr>' +
          '<td><span class="risk-bar ' + barClass + '" style="width:' + r.normalizedScore + 'px"></span> ' + r.normalizedScore + '</td>' +
          '<td>' + r.path + '</td>' +
          '<td>' + r.churn + '</td>' +
          '<td>' + r.loc + '</td>' +
          '<td>' + r.authors + '</td></tr>';
      }).join('');

      document.getElementById('hotspots-section').innerHTML =
        '<h2>Hotspots</h2>' +
        '<table><tr><th>Risk</th><th>File</th><th>Churn</th><th>LOC</th><th>Authors</th></tr>' +
        rows + '</table>';
    }

    // Bus Factor
    if (report.busFactor && report.busFactor.results.length) {
      const rows = report.busFactor.results.filter(r => r.isRisky).slice(0, 10).map(r => {
        const pct = r.topOwner ? Math.round(r.topOwner.percentage * 100) : 0;
        const tagClass = pct >= 90 ? 'tag-high' : pct >= 80 ? 'tag-medium' : 'tag-low';
        return '<tr>' +
          '<td>' + r.path + '</td>' +
          '<td>' + r.busFactor + '</td>' +
          '<td>' + (r.topOwner?.author || '—') + '</td>' +
          '<td><span class="tag ' + tagClass + '">' + pct + '%</span></td></tr>';
      }).join('');

      document.getElementById('bus-factor-section').innerHTML =
        '<h2>Bus Factor Risk</h2>' +
        '<table><tr><th>File</th><th>Bus Factor</th><th>Top Owner</th><th>Ownership</th></tr>' +
        rows + '</table>';
    }

    // Coupling
    if (report.coupling && report.coupling.results.length) {
      const pairs = report.coupling.results.slice(0, 10).map(c => {
        const cross = !c.sameModule ? ' <span class="tag tag-cross">CROSS-MODULE</span>' : '';
        return '<div class="coupling-pair">' +
          '<span>' + c.fileA + '</span>' +
          '<span class="coupling-arrow">&harr;</span>' +
          '<span>' + c.fileB + '</span>' +
          '<span class="coupling-degree">' + c.degreePercent + '%</span>' +
          cross + '</div>';
      }).join('');

      document.getElementById('coupling-section').innerHTML =
        '<h2>Change Coupling</h2>' + pairs;
    }

    // Code Age
    if (report.codeAge) {
      let html = '<h2>Code Age</h2>';
      const s = report.codeAge.stats;
      html += '<p style="margin:0.5rem 0;color:#8b949e">' +
        'Ancient: ' + (s.ancient||0) + ' · Stale: ' + (s.stale||0) +
        ' · Aging: ' + (s.aging||0) + ' · Active: ' + (s.active||0) +
        ' · Volatile: ' + (s.volatile||0) + '</p>';

      if (report.codeAge.volatileFiles?.length) {
        html += '<h3 style="color:#d2a8ff;margin:1rem 0 0.5rem;font-size:0.95rem">Volatile Files</h3>';
        html += report.codeAge.volatileFiles.slice(0,5).map(f =>
          '<div style="padding:0.3rem 0;border-bottom:1px solid #161b22">' +
          f.path + ' — <strong>' + f.recentCommits + ' recent</strong> (avg ' + f.avgMonthlyChurn + '/mo)</div>'
        ).join('');
      }
      document.getElementById('code-age-section').innerHTML = html;
    }

    // Contributors
    if (report.contributors && report.contributors.topContributors.length) {
      const rows = report.contributors.topContributors.slice(0, 10).map(c =>
        '<tr><td>' + c.author + '</td><td>' + c.commits + '</td><td>' + c.percentage + '%</td></tr>'
      ).join('');

      document.getElementById('contributors-section').innerHTML =
        '<h2>Contributors</h2>' +
        '<table><tr><th>Author</th><th>Commits</th><th>Share</th></tr>' +
        rows + '</table>';
    }

    // Knowledge Loss
    if (report.knowledgeLoss && report.knowledgeLoss.results?.length) {
      const atRisk = report.knowledgeLoss.results.filter(f => f.isAtRisk);
      let html = '<h2>Knowledge Loss</h2>';

      if (report.knowledgeLoss.departedContributors?.length) {
        html += '<p style="color:#8b949e;margin-bottom:1rem">' +
          report.knowledgeLoss.stats.totalDepartedAuthors + ' departed contributors · ' +
          report.knowledgeLoss.stats.filesAtRisk + ' files at risk (' + report.knowledgeLoss.stats.riskPercentage + '%)</p>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:1.5rem">';
        report.knowledgeLoss.departedContributors.slice(0, 8).forEach(d => {
          const ago = d.daysSinceLastCommit ? d.daysSinceLastCommit + 'd ago' : 'unknown';
          html += '<span class="tag tag-high" style="font-size:0.8rem">' + d.author + ' — ' + d.totalCommits + ' commits, ' + ago + '</span>';
        });
        html += '</div>';
      }

      if (atRisk.length) {
        html += '<table><tr><th>File</th><th>Knowledge Lost</th><th>Active</th><th>Departed</th></tr>';
        atRisk.slice(0, 15).forEach(f => {
          const cls = f.knowledgeLostPct >= 70 ? 'tag-high' : 'tag-medium';
          html += '<tr><td>' + f.path + '</td>' +
            '<td><span class="tag ' + cls + '">' + f.knowledgeLostPct + '%</span></td>' +
            '<td>' + f.activeAuthors + '</td>' +
            '<td>' + f.departedAuthors.length + '</td></tr>';
        });
        html += '</table>';
      }
      document.getElementById('knowledge-loss-section').innerHTML = html;
    }

    // Recommendations
    if (report.healthScore?.recommendations?.length) {
      const recs = report.healthScore.recommendations.map(r =>
        '<div class="recommendation ' + r.severity + '">' + r.message + '</div>'
      ).join('');
      document.getElementById('recommendations-section').innerHTML =
        '<h2>Recommendations</h2>' + recs;
    }

    // V2: Blame
    if (report.blame && report.blame.results?.length) {
      const rows = report.blame.results.filter(r => r.trueOwner && r.trueOwner.percentage >= 50).slice(0, 10).map(r =>
        '<tr><td>' + r.path + '</td>' +
        '<td>' + (r.trueOwner?.author || '—') + '</td>' +
        '<td><span class="tag ' + (r.trueOwner.percentage >= 80 ? 'tag-high' : 'tag-medium') + '">' + r.trueOwner.percentage + '%</span></td>' +
        '<td>' + r.busFactor + '</td></tr>'
      ).join('');
      document.getElementById('blame-section').innerHTML =
        '<h2>True Ownership (git blame)</h2>' +
        '<table><tr><th>File</th><th>True Owner</th><th>Lines Owned</th><th>Bus Factor</th></tr>' +
        rows + '</table>';
    }

    // V2: Trends
    if (report.trends) {
      const t = report.trends;
      const dirClass = t.overallDirection === 'improving' ? 'good' : t.overallDirection === 'declining' ? 'bad' : 'fair';
      let html = '<h2>Trend Analysis</h2>' +
        '<div class="score-card" style="text-align:left;padding:1.2rem">' +
        '<div style="font-size:1.3rem;font-weight:700" class="score-big ' + dirClass + '">' +
        (t.overallDirection === 'improving' ? '&#9650;' : t.overallDirection === 'declining' ? '&#9660;' : '&#9644;') +
        ' ' + t.overallDirection.toUpperCase() + '</div>' +
        '<p style="color:#8b949e;margin:0.5rem 0">' + t.description + '</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem">' +
        '<div><span style="color:#8b949e">Churn velocity:</span> <strong>' + (t.churn.changePercent > 0 ? '+' : '') + t.churn.changePercent + '%</strong></div>' +
        '<div><span style="color:#8b949e">Bus factor risk:</span> <strong>' + t.busFactor.recent + '% risky</strong> (was ' + t.busFactor.older + '%)</div>' +
        '<div><span style="color:#8b949e">Recent commits:</span> ' + t.period.recent.commits + '</div>' +
        '<div><span style="color:#8b949e">Previous commits:</span> ' + t.period.older.commits + '</div>' +
        '</div></div>';
      document.getElementById('trends-section').innerHTML = html;
    }

    // V2: Monorepo
    if (report.monorepo && report.monorepo.detected && report.monorepo.workspaces?.length) {
      const rows = report.monorepo.workspaces.map(ws => {
        if (ws.skipped) return '<tr><td>' + ws.workspace.name + '</td><td colspan="3" style="color:#8b949e">' + ws.reason + '</td></tr>';
        const scoreClass = ws.healthScore.overall >= 75 ? 'good' : ws.healthScore.overall >= 50 ? 'fair' : 'bad';
        return '<tr><td><strong>' + ws.workspace.name + '</strong></td>' +
          '<td><span class="score-big ' + scoreClass + '" style="font-size:1.1rem">' + ws.healthScore.overall + '</span></td>' +
          '<td>' + ws.healthScore.grade.letter + '</td>' +
          '<td>' + ws.stats.commits + ' commits / ' + ws.stats.files + ' files</td></tr>';
      }).join('');
      document.getElementById('monorepo-section').innerHTML =
        '<h2>Monorepo Analysis</h2>' +
        '<table><tr><th>Workspace</th><th>Score</th><th>Grade</th><th>Activity</th></tr>' +
        rows + '</table>';
    }
    // Branches
    if (report.branches) {
      const b = report.branches;
      const s = b.stats;
      let html = '<h2>Branch Graph</h2>';

      // Stats row
      html += '<div class="branch-stats">' +
        '<div class="branch-stat"><div class="branch-stat-value">' + s.totalBranches + '</div><div class="branch-stat-label">Total</div></div>' +
        '<div class="branch-stat"><div class="branch-stat-value" style="color:#3fb950">' + s.activeBranches + '</div><div class="branch-stat-label">Active</div></div>' +
        '<div class="branch-stat"><div class="branch-stat-value" style="color:#d29922">' + s.staleBranches + '</div><div class="branch-stat-label">Stale</div></div>' +
        '<div class="branch-stat"><div class="branch-stat-value" style="color:#8b949e">' + s.mergedBranches + '</div><div class="branch-stat-label">Merged</div></div>' +
        '<div class="branch-stat"><div class="branch-stat-value" style="color:#d2a8ff">' + s.totalMerges + '</div><div class="branch-stat-label">Merges</div></div>' +
        '</div>';

      // Visual graph — SVG-based GitLens-style rendering
      if (b.graphLayout && b.graphLayout.rows && b.graphLayout.rows.length) {
        const layout = b.graphLayout;
        const CELL_W = 28;
        const ROW_H = 38;
        const NODE_R = 6;
        const GLOW_R = 12;
        const colors = ['#4EC9B0','#C586C0','#CE9178','#569CD6','#DCDCAA','#D16969','#B5CEA8','#9CDCFE'];
        const getColor = (lane) => colors[lane % colors.length];

        const svgW = layout.maxLanes * CELL_W + CELL_W;
        const svgH = layout.rows.length * ROW_H;
        let svg = '';

        // Draw lane lines and connections (behind nodes)
        for (let i = 0; i < layout.rows.length; i++) {
          const row = layout.rows[i];
          const cy = i * ROW_H + ROW_H / 2;

          // Active pass-through lane lines
          for (const lane of row.activeLanes) {
            const cx = lane * CELL_W + CELL_W / 2;
            svg += '<line x1="'+cx+'" y1="'+(cy - ROW_H/2)+'" x2="'+cx+'" y2="'+(cy + ROW_H/2)+'" stroke="'+getColor(lane)+'" stroke-width="2.5" opacity="0.7"/>';
          }

          // Commit's own lane — line above
          const mx = row.lane * CELL_W + CELL_W / 2;
          if (i > 0) {
            svg += '<line x1="'+mx+'" y1="'+(cy - ROW_H/2)+'" x2="'+mx+'" y2="'+cy+'" stroke="'+getColor(row.lane)+'" stroke-width="2.5"/>';
          }
          // Line below (if lane continues)
          if (row.activeLanes.includes(row.lane) || i < layout.rows.length - 1) {
            svg += '<line x1="'+mx+'" y1="'+cy+'" x2="'+mx+'" y2="'+(cy + ROW_H/2)+'" stroke="'+getColor(row.lane)+'" stroke-width="2.5"/>';
          }

          // Branch/merge curves (bezier paths)
          for (const conn of row.connections) {
            const fromX = conn.fromLane * CELL_W + CELL_W / 2;
            const toX = conn.toLane * CELL_W + CELL_W / 2;

            if (conn.type === 'merge-in') {
              // Curve from fromLane above into commit
              const color = getColor(conn.fromLane);
              const startY = cy - ROW_H / 2;
              const endY = cy;
              const cp1y = startY + ROW_H * 0.4;
              const cp2y = endY - ROW_H * 0.2;
              svg += '<path d="M '+fromX+' '+startY+' C '+fromX+' '+cp1y+', '+toX+' '+cp2y+', '+toX+' '+endY+'" stroke="'+color+'" stroke-width="2.5" fill="none" opacity="0.9"/>';
            } else if (conn.type === 'converge') {
              // Lane converges into another lane below (first parent on different lane)
              const color = getColor(conn.fromLane);
              const startY = cy;
              const endY = cy + ROW_H / 2;
              const cp1y = startY + ROW_H * 0.3;
              const cp2y = endY - ROW_H * 0.3;
              svg += '<path d="M '+fromX+' '+startY+' C '+fromX+' '+cp1y+', '+toX+' '+cp2y+', '+toX+' '+endY+'" stroke="'+color+'" stroke-width="2.5" fill="none" opacity="0.9"/>';
            } else {
              // Branch-out: curve from commit down to new lane
              const color = getColor(conn.toLane);
              const startY = cy;
              const endY = cy + ROW_H / 2;
              const cp1y = startY + ROW_H * 0.2;
              const cp2y = endY - ROW_H * 0.4;
              svg += '<path d="M '+fromX+' '+startY+' C '+fromX+' '+cp1y+', '+toX+' '+cp2y+', '+toX+' '+endY+'" stroke="'+color+'" stroke-width="2.5" fill="none" opacity="0.9"/>';
            }
          }
        }

        // Draw nodes on top
        for (let i = 0; i < layout.rows.length; i++) {
          const row = layout.rows[i];
          const cx = row.lane * CELL_W + CELL_W / 2;
          const cy = i * ROW_H + ROW_H / 2;
          const color = getColor(row.lane);
          // Outer glow
          svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+GLOW_R+'" fill="'+color+'" opacity="0.2"/>';
          // Mid glow
          svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+(NODE_R+2)+'" fill="'+color+'" opacity="0.35"/>';
          // Node
          svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+NODE_R+'" fill="'+color+'"/>';
          // Inner highlight (gives depth)
          svg += '<circle cx="'+(cx-1.5)+'" cy="'+(cy-1.5)+'" r="2.5" fill="white" opacity="0.35"/>';
        }

        // Build layout: SVG on left, commit info on right
        html += '<div class="branch-graph-container graph-svg-container">';
        html += '<svg width="'+svgW+'" height="'+svgH+'" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">' + svg + '</svg>';
        html += '<div class="graph-info-column">';

        for (let i = 0; i < layout.rows.length; i++) {
          const row = layout.rows[i];
          let refHtml = '';
          if (row.refs && row.refs.length) {
            for (const r of row.refs) {
              const escaped = (r || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
              if (r.startsWith('HEAD ->')) {
                refHtml += '<span class="graph-ref graph-ref-head">' + escaped + '</span>';
              } else if (r.startsWith('tag:')) {
                refHtml += '<span class="graph-ref graph-ref-tag">' + escaped + '</span>';
              } else if (r.startsWith('origin/')) {
                refHtml += '<span class="graph-ref graph-ref-remote">' + escaped + '</span>';
              } else {
                refHtml += '<span class="graph-ref graph-ref-branch">' + escaped + '</span>';
              }
            }
          }
          const subClass = row.isMerge ? 'graph-subject merge' : 'graph-subject';
          const sub = (row.subject || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          const author = (row.author || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          html += '<div class="graph-row" style="height:'+ROW_H+'px">' +
            '<span class="graph-hash">' + row.hash + '</span>' +
            (refHtml ? '<span class="graph-refs">' + refHtml + '</span>' : '') +
            '<span class="' + subClass + '" style="flex:1;min-width:0">' + sub + '</span>' +
            '<span class="graph-author">' + author + '</span>' +
            '</div>';
        }

        html += '</div></div>';
      } else if (b.graphLines && b.graphLines.length) {
        // Fallback: text-based graph for older data without layout
        html += '<div class="branch-graph-container"><pre style="color:#c9d1d9;font-size:0.82rem;margin:0">';
        for (const entry of b.graphLines) {
          const g = (entry.graph || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          const sub = (entry.subject || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          if (entry.hash) {
            html += g + ' <span style="color:#d29922">' + entry.hash + '</span> ' + sub + '\\n';
          } else {
            html += g + '\\n';
          }
        }
        html += '</pre></div>';
      }

      // Branch list table
      if (b.branches && b.branches.length) {
        html += '<h3 style="color:#c9d1d9;font-size:1rem;margin:1.5rem 0 0.5rem">All Branches</h3>';
        const rows = b.branches.map(br => {
          const badge = br.isMerged ? '<span class="merged-badge">merged</span>' :
            (b.staleBranches && b.staleBranches.some(s => s.name === br.name))
              ? '<span class="stale-badge">stale</span>'
              : '<span class="active-badge">active</span>';
          const isCurrent = br.name === b.currentBranch;
          const name = isCurrent ? '<strong style="color:#3fb950">* ' + br.name + '</strong>' : br.name;
          const age = br.createdAt ? formatAgeHTML(new Date(br.createdAt)) : '—';
          const lastAct = br.lastActivity ? formatAgeHTML(new Date(br.lastActivity)) : '—';
          return '<tr><td>' + name + '</td><td>' + (br.creator || '—') + '</td>' +
            '<td>' + age + '</td><td>' + lastAct + '</td>' +
            '<td>' + (br.aheadCount > 0 ? '+' + br.aheadCount : '0') + '</td>' +
            '<td>' + badge + '</td></tr>';
        }).join('');
        html += '<table><tr><th>Branch</th><th>Creator</th><th>Created</th><th>Last Activity</th><th>Ahead</th><th>Status</th></tr>' + rows + '</table>';
      }

      // Merge history
      if (b.mergeGraph && b.mergeGraph.length) {
        html += '<h3 style="color:#c9d1d9;font-size:1rem;margin:1.5rem 0 0.5rem">Merge History</h3>';
        const rows = b.mergeGraph.slice(0, 15).map(m => {
          const dateStr = m.date ? formatAgeHTML(new Date(m.date)) : '—';
          return '<tr><td style="color:#58a6ff">' + (m.source || '?') + '</td>' +
            '<td style="color:#8b949e">&rarr;</td>' +
            '<td>' + (m.target || b.currentBranch) + '</td>' +
            '<td>' + (m.author || '—') + '</td>' +
            '<td style="color:#8b949e">' + dateStr + '</td></tr>';
        }).join('');
        html += '<table><tr><th>Source</th><th></th><th>Target</th><th>Author</th><th>When</th></tr>' + rows + '</table>';
      }

      document.getElementById('branches-section').innerHTML = html;
    }

    function formatAgeHTML(date) {
      if (!date) return '—';
      const days = Math.floor((Date.now() - date.getTime()) / 86400000);
      if (days === 0) return 'today';
      if (days === 1) return '1d ago';
      if (days < 30) return days + 'd ago';
      if (days < 365) return Math.floor(days / 30) + 'mo ago';
      return Math.floor(days / 365) + 'y ago';
    }
  </script>
</body>
</html>`;
}

export async function writeAndOpenHTML(report) {
  const html = formatHTML(report);
  const filePath = join(tmpdir(), `git-vision-report-${Date.now()}.html`);
  writeFileSync(filePath, html, "utf-8");

  // Dynamic import for `open` package
  const { default: open } = await import("open");
  await open(filePath);

  return filePath;
}
