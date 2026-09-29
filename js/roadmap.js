/*
 * Interactive roadmap: path → lanes of tracks → indented trees, drawn in SVG, with zoom, pan, pinch,
 * fit/reset, level-of-detail, per-node expand/collapse, prerequisite arrows and an outline view.
 */
(function (App) {
  'use strict';
  const U = App.U, UI = App.UI, M = App.Model, Store = App.Store;
  const t = (...a) => App.i18n.t(...a);
  const S = () => Store.state;

  // [width, height, title font-size]
  const SIZE = {
    path: [300, 76, 17], track: [252, 66, 15], course: [240, 62, 14],
    module: [224, 54, 13], lesson: [214, 50, 13], task: [200, 44, 12],
  };
  const INDENT = 24, GAP_Y = 10, LANE_GAP = 56, HEAD_GAP = 64, ROOT_GAP = 90, GROUP_GAP = 8;
  const MIN_K = 0.08, MAX_K = 2.6;
  const LEVELS = [1, 2, 3, 4, 5, 6];

  let view = { x: 40, y: 40, k: 1 };
  let layout = null;       // { boxes: Map(id -> box), width, height }
  let svg = null, vp = null;
  let needsFit = true;
  let selectedId = null;
  let hlQuery = '';
  let hlStatus = '';
  let mode = null;         // 'map' | 'outline'

  /* ------------------------------------------------------------------ */
  /* visibility + layout                                                 */
  /* ------------------------------------------------------------------ */

  function childrenVisible(n, depth) {
    const st = S().settings;
    if (!n.children.length) return false;
    if (st.collapsed[n.id]) return false;
    if (st.expanded[n.id]) return true;
    return depth + 1 < st.roadmapDepth;
  }

  /**
   * "Lane" layout (like a transit map / roadmap.sh):
   * each learning path sits on top, its tracks run side by side as lanes,
   * and everything inside a track flows downwards as an indented tree.
   */
  function computeLayout() {
    const s = S();
    const boxes = new Map();
    let top = 0;
    let width = 0;

    function box(id, depth, x, y, laneX) {
      const n = s.nodes[id];
      const [w, h, fs] = SIZE[n.type];
      const b = { id, depth, x, y, w, h, fs, laneX, kids: [], lane: false };
      boxes.set(id, b);
      return b;
    }

    // Indented vertical tree inside one lane; returns the lane's right edge and bottom.
    function stack(id, depth, laneX, indent, y) {
      const n = s.nodes[id];
      const b = box(id, depth, laneX + indent * INDENT, y, laneX);
      let bottom = y + b.h;
      let right = b.x + b.w;
      if (childrenVisible(n, depth)) {
        n.children.forEach((c) => {
          if (!s.nodes[c]) return;
          const r = stack(c, depth + 1, laneX, indent + 1, bottom + GAP_Y);
          b.kids.push(c);
          bottom = r.bottom + (boxes.get(c).kids.length ? GROUP_GAP : 0);
          right = Math.max(right, r.right);
        });
      }
      return { bottom, right };
    }

    s.rootIds.forEach((rid) => {
      const root = s.nodes[rid];
      if (!root) return;
      const rb = box(rid, 0, 0, top, 0);
      let laneX = 0;
      let bottom = top + rb.h;
      if (childrenVisible(root, 0)) {
        const laneTop = top + rb.h + HEAD_GAP;
        root.children.forEach((c) => {
          if (!s.nodes[c]) return;
          const r = stack(c, 1, laneX, 0, laneTop);
          const lb = boxes.get(c);
          lb.lane = true;
          rb.kids.push(c);
          bottom = Math.max(bottom, r.bottom);
          laneX = r.right + LANE_GAP;
        });
        laneX -= LANE_GAP;
      }
      // Centre the root above its lanes.
      const lanesW = Math.max(laneX, rb.w);
      rb.x = Math.max(0, (lanesW - rb.w) / 2);
      width = Math.max(width, lanesW);
      top = bottom + ROOT_GAP;
    });

    // Arabic reads right-to-left: mirror the whole map so it starts on the right.
    if (App.i18n.isRtl()) boxes.forEach((b) => { b.x = width - b.x - b.w; });
    layout = { boxes, width, height: Math.max(0, top - ROOT_GAP) };
    return layout;
  }

  /* ------------------------------------------------------------------ */
  /* SVG rendering                                                       */
  /* ------------------------------------------------------------------ */

  function truncate(text, width, fs) {
    const max = Math.max(6, Math.floor(width / (fs * 0.62)));
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  function nodeMatches(id) {
    const n = S().nodes[id];
    if (hlStatus) {
      const i = M.info(id);
      const st = i.locked ? 'locked' : i.status;
      if (hlStatus !== st) return false;
    }
    if (hlQuery) return U.norm(n.title).includes(U.norm(hlQuery)) || U.norm(n.notes).includes(U.norm(hlQuery));
    return true;
  }

  function statusGlyph(st, locked, x, y) {
    if (locked) return `<g transform="translate(${x - 8},${y - 8}) scale(0.67)" class="glyph lock"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></g>`;
    if (st === 'completed') return `<g class="glyph done"><circle cx="${x}" cy="${y}" r="8"/><path d="M${x - 3.6} ${y + 0.2}l2.4 2.4 4.8-5"/></g>`;
    if (st === 'in_progress') return `<g class="glyph prog"><circle cx="${x}" cy="${y}" r="7"/><path d="M${x} ${y - 7}a7 7 0 0 1 0 14z"/></g>`;
    if (st === 'skipped') return `<g class="glyph skip"><circle cx="${x}" cy="${y}" r="7"/><path d="M${x - 4} ${y + 4}l8-8"/></g>`;
    return `<g class="glyph todo"><circle cx="${x}" cy="${y}" r="7"/></g>`;
  }

  const ARABIC = /[\u0600-\u06FF]/;

  /**
   * SVG text anchored to the reading edge of the card. The canvas itself stays LTR,
   * so the side is chosen explicitly: left in English, right in Arabic.
   */
  function label(cls, x, y, text, extra = '') {
    const rtlUi = App.i18n.isRtl();
    const rtlText = ARABIC.test(text);
    const anchor = rtlUi ? (rtlText ? 'start' : 'end') : (rtlText ? 'end' : 'start');
    return `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}" direction="${rtlText ? 'rtl' : 'ltr'}"${extra}>${U.esc(text)}</text>`;
  }

  function renderNode(box) {
    const s = S();
    const n = s.nodes[box.id];
    const info = M.info(box.id);
    const st = info.status;
    const locked = info.locked;
    const { w, h, fs } = box;
    const rtl = App.i18n.isRtl();
    const edge = rtl ? w - 16 : 16;           // text start edge
    const hidden = n.children.length && !box.kids.length;
    const cls = ['rm-node', 't-' + n.type, 'st-' + st, locked ? 'locked' : '', info.blocked ? 'blocked' : '',
      box.id === selectedId ? 'selected' : '', (hlQuery || hlStatus) && !nodeMatches(box.id) ? 'dim' : ''].join(' ');
    const aria = `${t('type.' + n.type)}: ${n.title}. ${t('status.' + st)}${n.children.length ? `, ${info.pct}%` : ''}${locked ? '. ' + t('status.locked') : ''}`;
    const titleY = n.type === 'task' ? h / 2 + 5 : 20 + fs + 2;
    const barW = w - 72;
    const fillW = Math.max(0, barW * info.pct / 100);
    const barX = rtl ? 56 : 16;
    const showBar = n.children.length > 0;
    const pctText = `<text class="pct" x="${rtl ? 14 : w - 14}" y="${h - 9}" text-anchor="${rtl ? 'start' : 'end'}">${info.pct}%</text>`;
    return `<g class="${cls}" data-id="${box.id}" transform="translate(${box.x},${box.y})" tabindex="0" role="button" aria-label="${U.esc(aria)}">
      <title>${U.esc(n.title)}</title>
      <rect class="bg" width="${w}" height="${h}" rx="10"/>
      <rect class="accent" width="4" height="${h - 16}" x="${rtl ? w - 4 : 0}" y="8" rx="2"/>
      ${n.type !== 'task' ? label('type', edge, 18, t('type.' + n.type).toUpperCase()) : ''}
      ${label('title', edge, titleY, truncate(n.title, w - 52, fs), ` style="font-size:${fs}px"`)}
      ${showBar ? `<rect class="bar-track" x="${barX}" y="${h - 14}" width="${barW}" height="4" rx="2"/>
        <rect class="bar-fill" x="${rtl ? barX + barW - fillW : barX}" y="${h - 14}" width="${fillW}" height="4" rx="2"/>
        ${pctText}` : ''}
      ${!showBar && n.type !== 'task' ? label('pct', edge, h - 9, t('status.' + st)) : ''}
      ${statusGlyph(st, locked, rtl ? 18 : w - 18, 18)}
    </g>
    ${n.children.length ? `<g class="rm-toggle" data-toggle="${box.id}" transform="translate(${rtl ? box.x : box.x + w},${box.y + h / 2})" tabindex="0" role="button" aria-expanded="${!hidden}" aria-label="${U.esc((hidden ? t('roadmap.expandNode') : t('roadmap.collapseNode')) + ': ' + n.title)}">
      <circle r="10"/>${hidden ? `<text y="4" text-anchor="middle">${n.children.length > 9 ? '9+' : n.children.length}</text>` : '<path d="M-4 0h8"/>'}
    </g>` : ''}`;
  }

  function edgePath(a, b) {
    if (b.lane) {
      // Root → lane head: smooth vertical S-curve.
      const x1 = a.x + a.w / 2, y1 = a.y + a.h, x2 = b.x + b.w / 2, y2 = b.y;
      const my = (y1 + y2) / 2;
      return `M${x1} ${y1}C${x1} ${my} ${x2} ${my} ${x2} ${y2}`;
    }
    // Parent → child inside a lane: rounded elbow from the parent's leading rail.
    const r = Math.min(8, (b.y + b.h / 2 - a.y - a.h) / 2);
    const y1 = a.y + a.h, y2 = b.y + b.h / 2;
    if (App.i18n.isRtl()) {
      const x1 = a.x + a.w - 12, x2 = b.x + b.w;
      return `M${x1} ${y1}V${y2 - r}Q${x1} ${y2} ${x1 - r} ${y2}H${x2}`;
    }
    const x1 = a.x + 12, x2 = b.x;
    return `M${x1} ${y1}V${y2 - r}Q${x1} ${y2} ${x1 + r} ${y2}H${x2}`;
  }

  /** Nearest visible ancestor-or-self (dependencies on hidden nodes attach to what you can see). */
  function visibleBox(id) {
    let cur = id;
    while (cur) {
      if (layout.boxes.has(cur)) return layout.boxes.get(cur);
      cur = S().nodes[cur] ? S().nodes[cur].parentId : null;
    }
    return null;
  }

  function depPath(a, b) {
    const sameLane = a.laneX === b.laneX && a.depth > 0 && b.depth > 0;
    if (sameLane && App.i18n.isRtl()) {
      // Same lane (RTL): loop out on the left side of the lane.
      const x = Math.min(a.x, b.x) - 14;
      const off = Math.min(90, 26 + Math.abs(b.y - a.y) * 0.08);
      const y1 = a.y + a.h / 2, y2 = b.y + b.h / 2;
      return `M${a.x} ${y1}C${x - off} ${y1} ${x - off} ${y2} ${b.x - 2} ${y2}`;
    }
    if (sameLane) {
      // Same lane: loop out on the right side of the lane.
      const x = Math.max(a.x + a.w, b.x + b.w) + 14;
      const off = Math.min(90, 26 + Math.abs(b.y - a.y) * 0.08);
      const y1 = a.y + a.h / 2, y2 = b.y + b.h / 2;
      return `M${a.x + a.w} ${y1}C${x + off} ${y1} ${x + off} ${y2} ${b.x + b.w + 2} ${y2}`;
    }
    const aLeft = a.x + a.w / 2 < b.x + b.w / 2;
    const x1 = aLeft ? a.x + a.w : a.x, y1 = a.y + a.h / 2;
    const x2 = aLeft ? b.x - 2 : b.x + b.w + 2, y2 = b.y + b.h / 2;
    const mx = (x1 + x2) / 2;
    return `M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
  }

  function renderSvgContent() {
    const s = S();
    computeLayout();
    const edges = [];
    const deps = [];
    const nodes = [];
    layout.boxes.forEach((box) => {
      box.kids.forEach((c) => {
        const cb = layout.boxes.get(c);
        edges.push(`<path class="edge st-${M.status(c)}" d="${edgePath(box, cb)}"/>`);
      });
      nodes.push(renderNode(box));
    });
    if (s.settings.showDeps) {
      const seen = new Set();
      Object.values(s.nodes).forEach((n) => {
        n.prereqs.forEach((p) => {
          const a = visibleBox(p), b = visibleBox(n.id);
          if (!a || !b || a === b) return;
          const key = a.id + '>' + b.id;
          if (seen.has(key)) return;
          seen.add(key);
          const met = !M.isOpen(p);
          deps.push(`<path class="dep ${met ? 'met' : ''}" d="${depPath(a, b)}" marker-end="url(#${met ? 'arrow-met' : 'arrow'})"><title>${U.esc(t('roadmap.depTitle', { a: s.nodes[p].title, b: n.title }))}</title></path>`);
        });
      });
    }
    return `<g class="edges">${edges.join('')}</g><g class="deps">${deps.join('')}</g><g class="nodes">${nodes.join('')}</g>`;
  }

  function applyView() {
    if (!vp) return;
    vp.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);
    svg.classList.toggle('lod-far', view.k < 0.5);
    svg.classList.toggle('lod-mid', view.k >= 0.5 && view.k < 0.8);
    const z = document.getElementById('rm-zoom');
    if (z) z.textContent = Math.round(view.k * 100) + '%';
  }

  function viewportSize() {
    const r = svg.getBoundingClientRect();
    return { w: r.width || 800, h: r.height || 600 };
  }

  function fit() {
    if (!layout || !svg) return;
    const { w, h } = viewportSize();
    const pad = 48;
    const lw = Math.max(1, layout.width + 30), lh = Math.max(1, layout.height + 30);
    const k = U.clamp(Math.min((w - pad * 2) / lw, (h - pad * 2) / lh), MIN_K, 1.4);
    view = { k, x: (w - layout.width * k) / 2, y: Math.max(pad, (h - layout.height * k) / 2) };
    applyView();
  }

  /** Default view: readable zoom, anchored on the top of the map around where you are. */
  function reset() {
    const { w } = viewportSize();
    const k = 0.85;
    const target = M.resumeTarget();
    const anchor = (target && visibleBox(target)) || layout.boxes.get(S().rootIds[0]);
    const fitsWidth = layout.width * k < w - 96;
    let x;
    if (fitsWidth) x = (w - layout.width * k) / 2;
    else if (App.i18n.isRtl()) x = w - 48 - (layout.width - (anchor && anchor.depth > 0 ? anchor.laneX : 0)) * k;
    else x = 48 - (anchor && anchor.depth > 0 ? anchor.laneX : 0) * k;
    view = { k, x, y: 32 };
    applyView();
  }

  function initialView() {
    const { w, h } = viewportSize();
    const kFit = Math.min((w - 96) / Math.max(1, layout.width), (h - 96) / Math.max(1, layout.height));
    if (kFit >= 0.6) fit(); else reset();
  }

  function zoomAt(factor, cx, cy) {
    const k = U.clamp(view.k * factor, MIN_K, MAX_K);
    const f = k / view.k;
    view = { k, x: cx - (cx - view.x) * f, y: cy - (cy - view.y) * f };
    applyView();
  }

  function zoomCenter(factor) {
    const { w, h } = viewportSize();
    zoomAt(factor, w / 2, h / 2);
  }

  function centerOn(id, k) {
    const box = layout && layout.boxes.get(id);
    if (!box) return;
    const { w, h } = viewportSize();
    view.k = k || Math.max(view.k, 0.9);
    view.x = w / 2 - (box.x + box.w / 2) * view.k;
    view.y = h / 2 - (box.y + box.h / 2) * view.k;
    applyView();
  }

  /** Make a node visible (expand its ancestors), then centre + pulse it. */
  function focusNode(id) {
    if (!S().nodes[id]) return;
    const anc = Store.ancestorsOf(id);
    const collapsed = Object.assign({}, S().settings.collapsed);
    const expanded = Object.assign({}, S().settings.expanded);
    let changed = false;
    anc.forEach((a) => {
      if (collapsed[a]) { delete collapsed[a]; changed = true; }
      if (!expanded[a]) { expanded[a] = true; changed = true; }
    });
    if (changed) Store.updateSettings({ collapsed, expanded });
    selectedId = id;
    if (mode === 'map') {
      if (!changed) redrawMap();
      centerOn(id, Math.max(view.k, 1));
      const g = svg && svg.querySelector(`.rm-node[data-id="${id}"]`);
      if (g) { g.classList.add('pulse'); setTimeout(() => g.classList.remove('pulse'), 1600); }
    } else {
      const row = document.querySelector(`.ol-row[data-id="${id}"]`);
      if (row) { row.scrollIntoView({ block: 'center' }); row.classList.add('pulse'); }
    }
  }

  function highlight(id) {
    selectedId = id;
    if (!svg) return;
    svg.querySelectorAll('.rm-node.selected').forEach((g) => g.classList.remove('selected'));
    if (id) { const g = svg.querySelector(`.rm-node[data-id="${id}"]`); if (g) g.classList.add('selected'); }
    document.querySelectorAll('.ol-row.selected').forEach((r) => r.classList.remove('selected'));
    if (id) { const r = document.querySelector(`.ol-row[data-id="${id}"]`); if (r) r.classList.add('selected'); }
  }

  function toggleNode(id) {
    const n = S().nodes[id];
    if (!n) return;
    const box = layout && layout.boxes.get(id);
    const open = mode === 'outline' ? !S().settings.collapsed[id] && outlineOpen(n) : !!(box && box.kids.length);
    const collapsed = Object.assign({}, S().settings.collapsed);
    const expanded = Object.assign({}, S().settings.expanded);
    if (open) { collapsed[id] = true; delete expanded[id]; } else { delete collapsed[id]; expanded[id] = true; }
    // Keep the toggled node where it is on screen.
    const before = box ? { sx: box.x * view.k + view.x, sy: box.y * view.k + view.y } : null;
    Store.updateSettings({ collapsed, expanded });
    if (before && layout) {
      const after = layout.boxes.get(id);
      if (after) { view.x = before.sx - after.x * view.k; view.y = before.sy - after.y * view.k; applyView(); }
    }
  }

  /* ------------------------------------------------------------------ */
  /* pointer / wheel / keyboard                                          */
  /* ------------------------------------------------------------------ */

  function bindCanvas() {
    const pointers = new Map();
    let start = null;      // { x, y, vx, vy, target }
    let pinch = null;      // { dist, k, cx, cy, vx, vy }
    let moved = false;

    svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      svg.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = false;
      if (pointers.size === 1) {
        start = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, target: e.target };
      } else if (pointers.size === 2) {
        const [a, b] = Array.from(pointers.values());
        const r = svg.getBoundingClientRect();
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), k: view.k, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top, vx: view.x, vy: view.y };
        start = null;
        moved = true;
      }
    });

    svg.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        const [a, b] = Array.from(pointers.values());
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const k = U.clamp(pinch.k * dist / pinch.dist, MIN_K, MAX_K);
        const f = k / pinch.k;
        view = { k, x: pinch.cx - (pinch.cx - pinch.vx) * f, y: pinch.cy - (pinch.cy - pinch.vy) * f };
        applyView();
        return;
      }
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) > 5) { moved = true; svg.classList.add('panning'); }
      if (moved) { view.x = start.vx + dx; view.y = start.vy + dy; applyView(); }
    });

    function end(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      svg.classList.remove('panning');
      if (pointers.size < 2) pinch = null;
      if (e.type === 'pointerup' && start && !moved) {
        const toggle = start.target.closest && start.target.closest('.rm-toggle');
        const node = start.target.closest && start.target.closest('.rm-node');
        if (toggle) toggleNode(toggle.dataset.toggle);
        else if (node) App.Detail.open(node.dataset.id);
      }
      if (!pointers.size) start = null;
    }
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);

    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      if (e.ctrlKey || e.deltaMode !== 0 || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
      } else {
        view.x -= e.deltaX; applyView();
      }
    }, { passive: false });

    svg.addEventListener('keydown', (e) => {
      const node = e.target.closest('.rm-node');
      const toggle = e.target.closest('.rm-toggle');
      if ((e.key === 'Enter' || e.key === ' ') && (node || toggle)) {
        e.preventDefault();
        if (toggle) toggleNode(toggle.dataset.toggle); else App.Detail.open(node.dataset.id);
        return;
      }
      const step = 60;
      const keys = {
        '+': () => zoomCenter(1.2), '=': () => zoomCenter(1.2), '-': () => zoomCenter(1 / 1.2),
        '0': reset, f: fit,
        ArrowLeft: () => { view.x += step; applyView(); }, ArrowRight: () => { view.x -= step; applyView(); },
        ArrowUp: () => { view.y += step; applyView(); }, ArrowDown: () => { view.y -= step; applyView(); },
      };
      if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
    });

    svg.addEventListener('focusin', (e) => {
      // Keep keyboard-focused nodes on screen.
      const node = e.target.closest('.rm-node');
      if (!node || !layout) return;
      const box = layout.boxes.get(node.dataset.id);
      const { w, h } = viewportSize();
      const sx = box.x * view.k + view.x, sy = box.y * view.k + view.y;
      if (sx < 0 || sy < 0 || sx + box.w * view.k > w || sy + box.h * view.k > h) centerOn(box.id, view.k);
    });

    window.addEventListener('resize', U.debounce(() => { if (svg && document.body.contains(svg)) applyView(); }, 150));
  }

  /* ------------------------------------------------------------------ */
  /* outline view                                                        */
  /* ------------------------------------------------------------------ */

  function outlineOpen(n) {
    const st = S().settings;
    if (st.collapsed[n.id]) return false;
    if (st.expanded[n.id]) return true;
    return M.info(n.id).depth + 1 < st.roadmapDepth;
  }

  function outlineRows(ids) {
    const s = S();
    return ids.map((id) => {
      const n = s.nodes[id];
      if (!n) return '';
      const info = M.info(id);
      const open = n.children.length && outlineOpen(n);
      const dim = (hlQuery || hlStatus) && !nodeMatches(id);
      return `<li class="ol-item" role="none">
        <div class="ol-row t-${n.type} st-${info.status} ${info.locked ? 'locked' : ''} ${dim ? 'dim' : ''} ${id === selectedId ? 'selected' : ''}" data-id="${id}" style="--depth:${info.depth}">
          ${n.children.length
            ? `<button class="ol-caret" data-action="rm-toggle" data-id="${id}" aria-expanded="${!!open}" aria-label="${U.esc((open ? t('roadmap.collapseNode') : t('roadmap.expandNode')) + ': ' + n.title)}">${UI.icon(open ? 'chevronDown' : 'chevronRight')}</button>`
            : '<span class="ol-caret-space"></span>'}
          ${UI.statusToggle('node-toggle', id, info.status, n.title)}
          <button class="ol-title link-btn" data-action="open-node" data-id="${id}">${U.esc(n.title)}</button>
          <span class="ol-lock">${info.locked ? UI.icon('lock', 'muted') : ''}</span>
          <span class="ol-type">${U.esc(t('type.' + n.type))}</span>
          ${n.children.length ? `<span class="ol-bar">${UI.progress(info.pct, { size: 'xs', hideValue: true, aria: n.title })}</span><span class="mono small ol-pct">${info.pct}%</span>` : '<span class="ol-bar"></span><span class="ol-pct"></span>'}
        </div>
        ${open ? `<ul class="ol-list" role="group">${outlineRows(n.children)}</ul>` : ''}
      </li>`;
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* page render                                                         */
  /* ------------------------------------------------------------------ */

  function currentMode() {
    const pref = S().settings.roadmapView;
    if (pref === 'map' || pref === 'outline') return pref;
    return window.matchMedia('(max-width: 720px)').matches ? 'outline' : 'map';
  }

  function toolbar() {
    const st = S().settings;
    return `<div class="rm-toolbar" role="toolbar" aria-label="${U.esc(t('roadmap.toolbar'))}">
      <div class="segment" role="group" aria-label="${U.esc(t('roadmap.view'))}">
        <button class="seg-btn ${mode === 'map' ? 'active' : ''}" data-action="rm-mode" data-value="map" aria-pressed="${mode === 'map'}">${UI.icon('map')}<span>${U.esc(t('roadmap.map'))}</span></button>
        <button class="seg-btn ${mode === 'outline' ? 'active' : ''}" data-action="rm-mode" data-value="outline" aria-pressed="${mode === 'outline'}">${UI.icon('list')}<span>${U.esc(t('roadmap.outline'))}</span></button>
      </div>
      ${mode === 'map' ? `<div class="btn-group">
        ${UI.iconBtn('zoomOut', 'rm-zoom-out', t('roadmap.zoomOut'))}
        <span id="rm-zoom" class="mono zoom-val" aria-live="polite">100%</span>
        ${UI.iconBtn('zoomIn', 'rm-zoom-in', t('roadmap.zoomIn'))}
        ${UI.iconBtn('fit', 'rm-fit', t('roadmap.fit'))}
        ${UI.iconBtn('reset', 'rm-reset', t('roadmap.reset'))}
      </div>` : ''}
      <label class="inline-field">${U.esc(t('roadmap.levels'))}
        <select data-change="rm-depth" aria-label="${U.esc(t('roadmap.levels'))}">
          ${LEVELS.map((l) => `<option value="${l}" ${st.roadmapDepth === l ? 'selected' : ''}>${U.esc(t('roadmap.upTo' + l))}</option>`).join('')}
        </select>
      </label>
      <div class="btn-group">
        ${UI.iconBtn('expand', 'rm-expand-all', t('roadmap.expandAll'))}
        ${UI.iconBtn('collapse', 'rm-collapse-all', t('roadmap.collapseAll'))}
      </div>
      ${mode === 'map' ? `<label class="inline-check"><input type="checkbox" data-change="rm-deps" ${st.showDeps ? 'checked' : ''}> ${U.esc(t('roadmap.showDeps'))}</label>` : ''}
      <div class="rm-find">
        ${UI.icon('search')}
        <input type="search" id="rm-find" placeholder="${U.esc(t('roadmap.highlight'))}" aria-label="${U.esc(t('roadmap.highlight'))}" value="${U.esc(hlQuery)}">
        <select data-change="rm-hl-status" aria-label="${U.esc(t('roadmap.highlightStatus'))}">
          <option value="">${U.esc(t('filters.allStatuses'))}</option>
          ${['in_progress', 'not_started', 'completed', 'skipped', 'locked'].map((x) => `<option value="${x}" ${hlStatus === x ? 'selected' : ''}>${U.esc(t('status.' + x))}</option>`).join('')}
        </select>
      </div>
      <div class="btn-group push">
        ${UI.btn(t('actions.addType', { type: t('type.track') }), 'node-add', { cls: 'sm', icon: 'plus', data: { type: 'track' } })}
        ${UI.btn(t('actions.addType', { type: t('type.course') }), 'node-add', { cls: 'sm', icon: 'plus', data: { type: 'course' } })}
        ${UI.btn(t('actions.addType', { type: t('type.path') }), 'node-add', { cls: 'sm ghost', icon: 'plus', data: { type: 'path' } })}
      </div>
    </div>`;
  }

  function legend() {
    return `<div class="rm-legend" aria-label="${U.esc(t('roadmap.legend'))}">
      ${['completed', 'in_progress', 'not_started', 'skipped'].map((s) => `<span class="lg st-${s}">${UI.icon(UI.STATUS_ICON[s])}${U.esc(t('status.' + s))}</span>`).join('')}
      <span class="lg locked">${UI.icon('lock')}${U.esc(t('status.locked'))}</span>
      ${S().settings.showDeps ? `<span class="lg dep"><svg width="26" height="8" aria-hidden="true"><path d="M1 4h22" /></svg>${U.esc(t('roadmap.prereq'))}</span>` : ''}
      <span class="lg hint">${U.esc(t('roadmap.hint'))}</span>
    </div>`;
  }

  function render(el, params = {}) {
    mode = currentMode();
    const s = S();
    if (!s.rootIds.length) {
      el.innerHTML = `<header class="page-head"><h1>${U.esc(t('nav.roadmap'))}</h1></header>
        ${UI.empty(t('roadmap.empty'), UI.btn(t('actions.addType', { type: t('type.path') }), 'node-add', { cls: 'primary', icon: 'plus', data: { type: 'path' } }))}`;
      svg = null; vp = null;
      return;
    }
    el.innerHTML = `<div class="roadmap-page">
      <header class="page-head compact"><div><h1>${U.esc(t('roadmap.title'))}</h1><p class="muted">${U.esc(t('roadmap.subtitle', { pct: M.overall().pct }))}</p></div></header>
      ${toolbar()}
      ${mode === 'map'
        ? `<div class="rm-canvas-wrap"><svg id="rm-svg" class="rm-svg" tabindex="0" aria-label="${U.esc(t('roadmap.canvasLabel'))}" aria-describedby="rm-help">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="arrow-head"/></marker>
              <marker id="arrow-met" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="arrow-head met"/></marker>
            </defs>
            <g id="rm-viewport"></g>
          </svg>
          <p id="rm-help" class="sr-only">${U.esc(t('roadmap.keyboardHelp'))}</p>
          ${legend()}</div>`
        : `<div class="outline-wrap card"><ul class="ol-list root" role="tree" aria-label="${U.esc(t('roadmap.title'))}">${outlineRows(s.rootIds)}</ul></div>`}
    </div>`;

    const find = document.getElementById('rm-find');
    find.addEventListener('input', U.debounce(() => { hlQuery = find.value.trim(); refresh(); }, 150));

    if (mode === 'map') {
      svg = document.getElementById('rm-svg');
      vp = document.getElementById('rm-viewport');
      vp.innerHTML = renderSvgContent();
      bindCanvas();
      if (needsFit) { initialView(); needsFit = false; } else applyView();
    } else {
      svg = null; vp = null;
    }
    if (params.focus) setTimeout(() => focusNode(params.focus), 0);
    else if (selectedId) highlight(selectedId);
  }

  /** Re-render only the drawing (keeps toolbar focus + view). */
  function redrawMap() {
    if (!vp) return;
    vp.innerHTML = renderSvgContent();
    applyView();
  }

  function refresh() {
    const sub = document.querySelector('.roadmap-page .page-head p');
    if (sub) sub.textContent = t('roadmap.subtitle', { pct: M.overall().pct });
    if (mode === 'map') redrawMap();
    else {
      const list = document.querySelector('.ol-list.root');
      if (list) list.innerHTML = outlineRows(S().rootIds);
    }
  }

  /* ------------------------------------------------------------------ */
  /* dashboard preview: tracks as a horizontal path                      */
  /* ------------------------------------------------------------------ */

  function preview() {
    const s = S();
    const tracks = [];
    s.rootIds.forEach((r) => {
      const root = s.nodes[r];
      const kids = root.children.filter((c) => s.nodes[c] && s.nodes[c].type === 'track');
      (kids.length ? kids : [r]).forEach((id) => tracks.push(id));
    });
    if (!tracks.length) return UI.empty(t('roadmap.empty'));
    const cur = M.current();
    return `<ol class="track-flow">${tracks.map((id, i) => {
      const n = s.nodes[id];
      const info = M.info(id);
      const here = cur.track && cur.track.id === id;
      return `<li class="tf-item st-${info.status} ${here ? 'here' : ''}">
        <a href="#/roadmap?focus=${id}" class="tf-card">
          <span class="tf-step mono">${String(i + 1).padStart(2, '0')}</span>
          <span class="tf-title">${U.esc(n.title)}</span>
          ${UI.progress(info.pct, { size: 'xs', aria: n.title })}
          ${here ? `<span class="tf-here">${UI.icon('target')} ${U.esc(t('dashboard.youAreHere'))}</span>` : ''}
        </a>
      </li>`;
    }).join('')}</ol>`;
  }

  /* ------------------------------------------------------------------ */
  /* actions                                                             */
  /* ------------------------------------------------------------------ */

  UI.registerActions({
    'rm-mode': (el) => { needsFit = true; Store.updateSettings({ roadmapView: el.dataset.value }); App.rerender(); },
    'rm-zoom-in': () => zoomCenter(1.25),
    'rm-zoom-out': () => zoomCenter(1 / 1.25),
    'rm-fit': () => fit(),
    'rm-reset': () => reset(),
    'rm-toggle': (el) => toggleNode(el.dataset.id),
    'rm-expand-all': () => { Store.updateSettings({ roadmapDepth: 6, collapsed: {}, expanded: {} }); needsFit = true; App.rerender(); },
    'rm-collapse-all': () => { Store.updateSettings({ roadmapDepth: 2, collapsed: {}, expanded: {} }); needsFit = true; App.rerender(); },
    'rm-depth': (el) => { Store.updateSettings({ roadmapDepth: Number(el.value), collapsed: {}, expanded: {} }); needsFit = true; App.rerender(); },
    'rm-deps': (el) => { Store.updateSettings({ showDeps: el.checked }); App.rerender(); },
    'rm-hl-status': (el) => { hlStatus = el.value; refresh(); },
  });

  App.Pages.roadmap = { render, title: () => t('roadmap.title'), nav: { icon: 'map', order: 20 } };

  App.Roadmap = {
    render, refresh, preview, focusNode, highlight,
    isActive: () => !!(svg && document.body.contains(svg)) || !!document.querySelector('.ol-list.root'),
    requestFit: () => { needsFit = true; },
    get view() { return Object.assign({}, view); },
    get layout() { return layout; },
  };
})(window.App = window.App || {});
