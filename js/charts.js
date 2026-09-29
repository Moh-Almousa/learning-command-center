/* Tiny SVG charts shared by pages (no libraries): column chart, progress line chart, progress ring, hover tooltip. */
(function (App) {
  'use strict';
  const U = App.U;

  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  /** Single-series column chart. data: [{ label, value, tip }] */
  function barChart(data, { height = 180, fmt = (v) => v, aria }) {
    const W = 640, H = height, padL = 36, padB = 24, padT = 10;
    const max = niceMax(Math.max(...data.map((d) => d.value), 0));
    const plotW = W - padL - 8, plotH = H - padB - padT;
    const step = plotW / data.length;
    const bw = Math.max(4, Math.min(28, step * 0.62));
    const grid = [0, 0.5, 1].map((f) => {
      const y = padT + plotH - plotH * f;
      return `<line class="grid" x1="${padL}" x2="${W - 8}" y1="${y}" y2="${y}"/><text class="axis" x="${padL - 6}" y="${y + 4}" text-anchor="end">${U.esc(fmt(max * f))}</text>`;
    }).join('');
    const bars = data.map((d, i) => {
      const h = max ? (d.value / max) * plotH : 0;
      const x = padL + step * i + (step - bw) / 2;
      const y = padT + plotH - h;
      const r = Math.min(4, h / 2, bw / 2);
      const path = h > 0
        ? `M${x} ${padT + plotH}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + bw - r}Q${x + bw} ${y} ${x + bw} ${y + r}V${padT + plotH}Z`
        : '';
      const label = i % Math.ceil(data.length / 8) === 0 || i === data.length - 1
        ? `<text class="axis" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${U.esc(d.label)}</text>` : '';
      return `<g class="bar-g" tabindex="0" data-tip="${U.esc(d.tip)}" aria-label="${U.esc(d.tip)}">
        <rect class="hit" x="${padL + step * i}" y="${padT}" width="${step}" height="${plotH}"/>
        ${path ? `<path class="bar" d="${path}"/>` : ''}
      </g>${label}`;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${U.esc(aria)}">${grid}<line class="baseline" x1="${padL}" x2="${W - 8}" y1="${padT + plotH}" y2="${padT + plotH}"/>${bars}</svg>`;
  }

  /**
   * Progress-over-time line (0–100%). points: [{ ts, pct }] oldest first.
   * One series, so the title names it and no legend is needed.
   */
  function lineChart(points, { height = 170, aria, tip }) {
    const W = 640, H = height, padL = 38, padR = 12, padT = 12, padB = 26;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    if (!points.length) return '';
    const t0 = points[0].ts, t1 = Math.max(points[points.length - 1].ts, t0 + 1);
    const x = (ts) => padL + ((ts - t0) / (t1 - t0)) * plotW;
    const y = (p) => padT + plotH - (p / 100) * plotH;
    // Step line: progress stays flat until the next change.
    let d = `M${x(points[0].ts)} ${y(points[0].pct)}`;
    for (let i = 1; i < points.length; i++) d += `H${x(points[i].ts)}V${y(points[i].pct)}`;
    const area = `${d}V${padT + plotH}H${x(points[0].ts)}Z`;
    const grid = [0, 50, 100].map((p) => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(p)}" y2="${y(p)}"/><text class="axis" x="${padL - 6}" y="${y(p) + 4}" text-anchor="end">${p}%</text>`).join('');
    const labels = [points[0], points[points.length - 1]].map((pt, i) => `<text class="axis" x="${x(pt.ts)}" y="${H - 6}" text-anchor="${i ? 'end' : 'start'}">${U.esc(U.fmtDate(pt.ts, { day: 'numeric', month: 'short' }))}</text>`).join('');
    const dots = points.filter((p) => !p.start).map((p) => {
      const label = tip ? tip(p) : `${U.fmtDate(p.ts)}: ${p.pct}%`;
      return `<g class="pt-g" tabindex="0" data-tip="${U.esc(label)}" aria-label="${U.esc(label)}"><circle class="hit" cx="${x(p.ts)}" cy="${y(p.pct)}" r="10"/><circle class="dot" cx="${x(p.ts)}" cy="${y(p.pct)}" r="4"/></g>`;
    }).join('');
    return `<svg class="chart line-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${U.esc(aria)}">${grid}<path class="area" d="${area}"/><path class="line" d="${d}"/>${dots}${labels}</svg>`;
  }

  /** Circular progress indicator. */
  function ring(pct, size = 72, label = '') {
    const r = (size - 8) / 2, c = 2 * Math.PI * r;
    return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${U.esc(label || pct + '%')}">
      <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}"/>
      <circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
      <text x="50%" y="50%" dy=".35em" text-anchor="middle" class="ring-text">${pct}%</text>
    </svg>`;
  }

  /* shared hover tooltip for any [data-tip] */
  let tip;
  function showTip(el) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    tip.textContent = el.dataset.tip;
    const r = el.getBoundingClientRect();
    tip.style.display = 'block';
    const tw = tip.offsetWidth;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2)) + 'px';
    tip.style.top = Math.max(8, r.top - tip.offsetHeight - 8) + window.scrollY + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }
  document.addEventListener('pointerover', (e) => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) showTip(el); else hideTip(); });
  document.addEventListener('focusin', (e) => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) showTip(el); else hideTip(); });
  window.addEventListener('scroll', hideTip, true);

  App.Charts = { barChart, lineChart, ring, niceMax };
})(window.App = window.App || {});
