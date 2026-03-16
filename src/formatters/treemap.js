/**
 * Treemap Visualization (V2)
 *
 * Generates a treemap where:
 * - Rectangle SIZE = lines of code (complexity)
 * - Rectangle COLOR = churn frequency (red = hot, green = cold)
 *
 * Uses the squarified treemap algorithm for aesthetically pleasing layouts.
 * Pure JavaScript, no external dependencies. Outputs SVG embedded in HTML.
 */

export function generateTreemapData(hotspots) {
  if (!hotspots || !hotspots.results || hotspots.results.length === 0) {
    return null;
  }

  // Build a nested structure: module -> files
  const modules = new Map();

  for (const file of hotspots.results) {
    const parts = file.path.split("/");
    const module = parts.length > 1 ? parts[0] : "(root)";
    const fileName = parts[parts.length - 1];

    if (!modules.has(module)) {
      modules.set(module, { name: module, children: [], totalLoc: 0 });
    }

    const mod = modules.get(module);
    mod.children.push({
      name: fileName,
      fullPath: file.path,
      loc: file.loc,
      churn: file.churn,
      score: file.normalizedScore,
      authors: file.authors,
    });
    mod.totalLoc += file.loc;
  }

  return [...modules.values()].sort((a, b) => b.totalLoc - a.totalLoc);
}

/**
 * Generate the treemap SVG + interactive HTML.
 * This is embedded directly in the HTML report.
 */
export function generateTreemapHTML(hotspots) {
  const data = generateTreemapData(hotspots);
  if (!data) return "";

  // Flatten for treemap layout
  const allFiles = [];
  for (const mod of data) {
    for (const child of mod.children) {
      allFiles.push({
        ...child,
        module: mod.name,
        value: Math.max(child.loc, 1),
      });
    }
  }

  // Sort by value descending for better layout
  allFiles.sort((a, b) => b.value - a.value);

  const jsonData = JSON.stringify(allFiles);

  return `
    <div id="treemap-container" style="margin:1.5rem 0">
      <canvas id="treemap-canvas" width="1060" height="500" style="width:100%;border-radius:8px;cursor:pointer"></canvas>
      <div id="treemap-tooltip" style="
        display:none;position:fixed;background:#161b22;border:1px solid #30363d;
        border-radius:8px;padding:10px 14px;font-size:0.85rem;color:#c9d1d9;
        pointer-events:none;z-index:1000;max-width:320px;box-shadow:0 4px 12px rgba(0,0,0,0.4);
      "></div>
    </div>
    <script>
    (function() {
      const files = ${jsonData};
      const canvas = document.getElementById('treemap-canvas');
      const ctx = canvas.getContext('2d');
      const tooltip = document.getElementById('treemap-tooltip');
      const W = canvas.width;
      const H = canvas.height;

      // Squarified treemap layout
      const totalValue = files.reduce((s, f) => s + f.value, 0);
      const rects = squarify(files, { x: 0, y: 0, w: W, h: H }, totalValue);

      draw();

      function draw() {
        ctx.clearRect(0, 0, W, H);
        for (const r of rects) {
          // Color based on risk score
          const color = scoreToColor(r.data.score);
          ctx.fillStyle = color;
          ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);

          // Border
          ctx.strokeStyle = '#0d1117';
          ctx.lineWidth = 2;
          ctx.strokeRect(r.x, r.y, r.w, r.h);

          // Label if rect is big enough
          if (r.w > 60 && r.h > 25) {
            ctx.fillStyle = '#fff';
            ctx.font = r.w > 120 ? 'bold 11px -apple-system, sans-serif' : '10px -apple-system, sans-serif';
            const label = truncate(r.data.name, Math.floor(r.w / 7));
            ctx.fillText(label, r.x + 6, r.y + 16);

            if (r.h > 40 && r.w > 80) {
              ctx.fillStyle = 'rgba(255,255,255,0.6)';
              ctx.font = '10px -apple-system, sans-serif';
              ctx.fillText(r.data.churn + ' changes · ' + r.data.loc + ' LOC', r.x + 6, r.y + 30);
            }
          }
        }
      }

      // Hover tooltip
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = W / rect.width;
        const scaleY = H / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;

        const hit = rects.find(r => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h);
        if (hit) {
          tooltip.style.display = 'block';
          tooltip.style.left = (e.clientX + 12) + 'px';
          tooltip.style.top = (e.clientY + 12) + 'px';
          tooltip.innerHTML =
            '<strong style="color:#f0f6fc">' + hit.data.fullPath + '</strong><br>' +
            '<span style="color:#8b949e">Module:</span> ' + hit.data.module + '<br>' +
            '<span style="color:#8b949e">Risk Score:</span> <span style="color:' + scoreToColor(hit.data.score) + '">' + hit.data.score + '/100</span><br>' +
            '<span style="color:#8b949e">Churn:</span> ' + hit.data.churn + ' changes<br>' +
            '<span style="color:#8b949e">LOC:</span> ' + hit.data.loc + '<br>' +
            '<span style="color:#8b949e">Authors:</span> ' + hit.data.authors;
        } else {
          tooltip.style.display = 'none';
        }
      });

      canvas.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

      function scoreToColor(score) {
        if (score >= 70) return '#da3633';
        if (score >= 50) return '#d29922';
        if (score >= 30) return '#2ea043';
        return '#238636';
      }

      function truncate(s, max) {
        return s.length > max ? s.slice(0, max - 1) + '…' : s;
      }

      // Squarified treemap algorithm
      function squarify(items, bounds, totalVal) {
        const result = [];
        if (!items.length || bounds.w <= 0 || bounds.h <= 0) return result;

        const sorted = [...items].sort((a, b) => b.value - a.value);
        layoutRow(sorted, bounds, totalVal, result);
        return result;
      }

      function layoutRow(items, bounds, totalVal, result) {
        if (!items.length) return;

        let { x, y, w, h } = bounds;
        const isHorizontal = w >= h;
        let remaining = [...items];
        let row = [remaining.shift()];
        let rowValue = row[0].value;

        while (remaining.length > 0) {
          const next = remaining[0];
          const withNext = [...row, next];
          const withNextValue = rowValue + next.value;

          if (worstRatio(row, rowValue, totalVal, bounds) >= worstRatio(withNext, withNextValue, totalVal, bounds)) {
            row = withNext;
            rowValue = withNextValue;
            remaining.shift();
          } else {
            break;
          }
        }

        // Lay out current row
        const rowFraction = rowValue / totalVal;
        const rowSize = isHorizontal ? w * rowFraction : h * rowFraction;

        let offset = 0;
        for (const item of row) {
          const itemFraction = item.value / rowValue;
          const itemSize = (isHorizontal ? h : w) * itemFraction;

          const rect = isHorizontal
            ? { x: x, y: y + offset, w: rowSize, h: itemSize, data: item }
            : { x: x + offset, y: y, w: itemSize, h: rowSize, data: item };

          result.push(rect);
          offset += itemSize;
        }

        // Recurse with remaining items
        if (remaining.length > 0) {
          const newBounds = isHorizontal
            ? { x: x + rowSize, y, w: w - rowSize, h }
            : { x, y: y + rowSize, w, h: h - rowSize };
          const newTotal = totalVal - rowValue;
          layoutRow(remaining, newBounds, newTotal, result);
        }
      }

      function worstRatio(row, rowValue, totalVal, bounds) {
        const { w, h } = bounds;
        const isHorizontal = w >= h;
        const side = isHorizontal ? w * (rowValue / totalVal) : h * (rowValue / totalVal);
        const otherSide = isHorizontal ? h : w;

        let worst = 0;
        for (const item of row) {
          const frac = item.value / rowValue;
          const itemSide = otherSide * frac;
          const ratio = Math.max(side / itemSide, itemSide / side);
          worst = Math.max(worst, ratio);
        }
        return worst;
      }
    })();
    </script>
  `;
}
