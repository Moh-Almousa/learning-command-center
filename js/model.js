/*
 * Model: read-only derived data (progress, effective status, locks, next step, streaks, search).
 * Results are cached per store revision, so every page can call these freely during a render.
 */
(function (App) {
  'use strict';
  const U = App.U;
  const S = () => App.Store.state;

  let cacheRev = -1;
  let cache = null;

  function build() {
    const s = S();
    const info = new Map();   // id -> { total, done, inprog, pct, status, locked, blocked, depth, unmet }
    const order = [];         // DFS order of every node
    const leaves = [];        // DFS order of leaves only

    const average = s.settings.progressMode === 'average';

    // Returns leaf counts plus this node's own completion fraction (used by "average" mode).
    function visit(id, depth) {
      const n = s.nodes[id];
      if (!n) return { total: 0, done: 0, inprog: 0, frac: 0, counts: false };
      order.push(id);
      let total = 0, done = 0, inprog = 0;
      if (!n.children.length) {
        leaves.push(id);
        if (n.status !== 'skipped') {
          total = 1;
          if (n.status === 'completed') done = 1;
          if (n.status === 'in_progress') inprog = 1;
        }
      }
      const fracs = [];
      n.children.forEach((c) => {
        const r = visit(c, depth + 1);
        total += r.total; done += r.done; inprog += r.inprog;
        if (r.counts) fracs.push(r.frac);
      });
      let status;
      if (!n.children.length || total === 0) status = n.status;
      else if (done === total) status = n.review ? 'in_progress' : 'completed';   // reopened for review
      else if (done > 0 || inprog > 0 || n.status === 'in_progress') status = 'in_progress';
      else status = n.status === 'skipped' ? 'skipped' : 'not_started';

      let frac;
      if (!n.children.length || total === 0) frac = n.status === 'completed' ? 1 : 0;
      else if (average) frac = fracs.length ? fracs.reduce((a, b) => a + b, 0) / fracs.length : 0;
      else frac = done / total;
      const pct = Math.round(frac * 100);
      info.set(id, { total, done, inprog, pct, status, depth, locked: false, blocked: false, unmet: [] });
      return { total, done, inprog, frac, counts: total > 0 || (!n.children.length && n.status !== 'skipped') };
    }
    const rootFracs = s.rootIds.map((r) => visit(r, 0)).filter((r) => r.counts).map((r) => r.frac);

    // Locks need every status first, then inherit top-down.
    const isDone = (id) => { const i = info.get(id); return i && (i.status === 'completed' || i.status === 'skipped'); };
    order.forEach((id) => {
      const n = s.nodes[id];
      const i = info.get(id);
      i.unmet = n.prereqs.filter((p) => !isDone(p));
      // Starting something overrides its lock — the lock is advice, never a wall.
      const untouched = i.status === 'not_started';
      i.locked = i.unmet.length > 0 && untouched;
      const parent = n.parentId ? info.get(n.parentId) : null;
      i.blocked = !!(parent && (parent.locked || parent.blocked)) && untouched;
    });

    const index = new Map(order.map((id, i) => [id, i]));
    let overall = { total: 0, done: 0, inprog: 0 };
    s.rootIds.forEach((r) => { const i = info.get(r); overall.total += i.total; overall.done += i.done; overall.inprog += i.inprog; });
    overall.pct = average
      ? (rootFracs.length ? Math.round(rootFracs.reduce((a, b) => a + b, 0) / rootFracs.length * 100) : 0)
      : U.pct(overall.done, overall.total);

    cache = { info, order, leaves, index, overall };
    cacheRev = App.Store.rev;
  }

  function data() { if (cacheRev !== App.Store.rev || !cache) build(); return cache; }

  const M = {
    info(id) { return data().info.get(id) || { total: 0, done: 0, inprog: 0, pct: 0, status: 'not_started', depth: 0, unmet: [] }; },
    status(id) { return M.info(id).status; },
    pct(id) { return M.info(id).pct; },
    order() { return data().order; },
    leaves() { return data().leaves; },
    overall() { return data().overall; },

    node(id) { return S().nodes[id]; },

    ancestors(id) { return App.Store.ancestorsOf(id).map((a) => S().nodes[a]).reverse(); },

    /** Closest ancestor-or-self of a given type. */
    closest(id, type) {
      let n = S().nodes[id];
      while (n) { if (n.type === type) return n; n = S().nodes[n.parentId]; }
      return null;
    },

    breadcrumb(id) {
      const n = S().nodes[id];
      if (!n) return [];
      return [...M.ancestors(id), n];
    },

    isOpen(id) { const st = M.status(id); return st !== 'completed' && st !== 'skipped'; },

    /** Count nodes of a type whose effective status is completed. */
    countByType(type, status = 'completed') {
      return Object.values(S().nodes).filter((n) => n.type === type && M.status(n.id) === status).length;
    },

    statusCounts() {
      const leaves = data().leaves.map((id) => S().nodes[id]);
      const c = { completed: 0, in_progress: 0, not_started: 0, skipped: 0 };
      leaves.forEach((n) => { c[n.status]++; });
      c.remaining = c.not_started + c.in_progress;
      return c;
    },

    /* ---------------- position / next step ---------------- */

    firstOpenLeaf(ids, preferUnlocked = true) {
      const open = ids.filter((id) => M.isOpen(id) && !S().nodes[id].children.length);
      if (!preferUnlocked) return open[0] || null;
      const free = open.find((id) => { const i = M.info(id); return !i.locked && !i.blocked; });
      return free || open[0] || null;
    },

    /** Leaves of a subtree, in roadmap order. */
    leavesOf(id) {
      const d = data();
      const set = new Set([id, ...App.Store.descendantsOf(id)]);
      return d.leaves.filter((l) => set.has(l));
    },

    /** Where the learner should continue from. */
    resumeTarget() {
      const s = S();
      const pos = s.position && s.nodes[s.position.nodeId] ? s.position.nodeId : null;
      if (pos) {
        const posNode = s.nodes[pos];
        if (posNode.children.length) {
          const inside = M.leavesOf(pos);
          const prog = inside.find((l) => s.nodes[l].status === 'in_progress');
          const open = prog || M.firstOpenLeaf(inside);
          if (open) return open;
        } else if (M.isOpen(pos)) return pos;
        return M.nextAfter(pos);
      }
      const inProg = data().leaves.find((l) => s.nodes[l].status === 'in_progress');
      return inProg || M.firstOpenLeaf(data().leaves);
    },

    /** First open leaf after id — inside the same course first, then anywhere. */
    nextAfter(id) {
      const d = data();
      const s = S();
      const course = M.closest(id, 'course');
      const start = d.index.has(id) ? d.index.get(id) : -1;
      const after = d.leaves.filter((l) => d.index.get(l) > start && l !== id);
      if (course) {
        const courseSet = new Set(M.leavesOf(course.id));
        const inCourse = M.firstOpenLeaf(after.filter((l) => courseSet.has(l)));
        if (inCourse) return inCourse;
      }
      return M.firstOpenLeaf(after) || M.firstOpenLeaf(d.leaves.filter((l) => l !== id && s.nodes[l]));
    },

    /** What to suggest next, with a human reason. */
    recommendation() {
      const s = S();
      const target = M.resumeTarget();
      if (!target) return null;
      const lastDone = Object.values(s.nodes)
        .filter((n) => n.status === 'completed' && n.completedAt)
        .sort((a, b) => b.completedAt - a.completedAt)[0];
      const node = s.nodes[target];
      if (node.status === 'in_progress') return { id: target, reason: 'continue' };
      if (lastDone) return { id: target, reason: 'after', afterId: lastDone.id };
      return { id: target, reason: 'start' };
    },

    upcoming(count = 3) {
      const first = M.resumeTarget();
      if (!first) return [];
      const out = [first];
      let cur = first;
      const seen = new Set(out);
      while (out.length < count) {
        const d = data();
        const idx = d.index.get(cur);
        const nxt = d.leaves.find((l) => d.index.get(l) > idx && M.isOpen(l) && !seen.has(l));
        if (!nxt) break;
        out.push(nxt); seen.add(nxt); cur = nxt;
      }
      return out;
    },

    current() {
      const target = M.resumeTarget();
      if (!target) return { target: null };
      const n = S().nodes[target];
      const lesson = M.closest(target, 'lesson');
      let task = n.type === 'task' ? n : null;
      if (!task && lesson) {
        const open = lesson.children.find((c) => S().nodes[c] && S().nodes[c].type === 'task' && M.isOpen(c));
        task = open ? S().nodes[open] : null;
      }
      return {
        target,
        node: n,
        path: M.closest(target, 'path'),
        track: M.closest(target, 'track'),
        course: M.closest(target, 'course'),
        module: M.closest(target, 'module'),
        lesson,
        task,
      };
    },

    /* ---------------- dates / streaks ---------------- */

    activeDays() {
      const s = S();
      const days = new Set();
      s.sessions.forEach((x) => { if (x.minutes > 0) days.add(x.date); });
      Object.values(s.nodes).forEach((n) => { if (n.completedAt) days.add(U.dayKey(new Date(n.completedAt))); });
      Object.values(s.ptasks).forEach((t) => { if (t.completedAt) days.add(U.dayKey(new Date(t.completedAt))); });
      return days;
    },

    streaks() {
      const days = M.activeDays();
      const today = U.dayKey();
      let current = 0;
      let cursor = days.has(today) ? today : U.addDays(today, -1);
      while (days.has(cursor)) { current++; cursor = U.addDays(cursor, -1); }
      let longest = 0;
      const sorted = Array.from(days).sort();
      let run = 0, prev = null;
      sorted.forEach((d) => {
        run = prev && U.addDays(prev, 1) === d ? run + 1 : 1;
        longest = Math.max(longest, run);
        prev = d;
      });
      return { current, longest, activeToday: days.has(today) };
    },

    minutesBetween(fromKey, toKey, filter) {
      return S().sessions
        .filter((x) => x.date >= fromKey && x.date <= toKey && (!filter || filter(x)))
        .reduce((a, x) => a + (Number(x.minutes) || 0), 0);
    },

    totalMinutes(filter) { return S().sessions.filter((x) => !filter || filter(x)).reduce((a, x) => a + (Number(x.minutes) || 0), 0); },

    /** Nodes completed in [from, to] day range (inclusive). */
    completedBetween(fromKey, toKey) {
      return Object.values(S().nodes).filter((n) => {
        if (n.status !== 'completed' || !n.completedAt) return false;
        const k = U.dayKey(new Date(n.completedAt));
        return k >= fromKey && k <= toKey;
      });
    },

    ptasksCompletedBetween(fromKey, toKey) {
      return Object.values(S().ptasks).filter((t) => {
        if (t.status !== 'completed' || !t.completedAt) return false;
        const k = U.dayKey(new Date(t.completedAt));
        return k >= fromKey && k <= toKey;
      });
    },

    /* ---------------- projects ---------------- */

    projectTasks(pid) {
      return Object.values(S().ptasks).filter((t) => t.projectId === pid).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
    },

    ptaskBlocked(t) {
      return t.deps.some((d) => S().ptasks[d] && S().ptasks[d].status !== 'completed');
    },

    projectStats(pid) {
      const p = S().projects[pid];
      const tasks = M.projectTasks(pid);
      const done = tasks.filter((t) => t.status === 'completed').length;
      const inprog = tasks.filter((t) => t.status === 'in_progress');
      const prio = { critical: 0, high: 1, medium: 2, low: 3 };
      const open = tasks.filter((t) => t.status !== 'completed');
      const byPriority = (a, b) => prio[a.priority] - prio[b.priority] || a.order - b.order;
      const last = p && p.lastTaskId && S().ptasks[p.lastTaskId];
      const current = (last && last.status === 'in_progress' ? last : null) || inprog.slice().sort(byPriority)[0] || null;
      const next = open.filter((t) => t !== current && t.status === 'not_started' && !M.ptaskBlocked(t)).sort(byPriority)[0]
        || open.filter((t) => t !== current)[0] || null;
      const milestones = (p ? p.milestones : []).map((m) => {
        const mt = tasks.filter((t) => t.milestoneId === m.id);
        const md = mt.filter((t) => t.status === 'completed').length;
        return { m, total: mt.length, done: md, pct: U.pct(md, mt.length), complete: mt.length > 0 && md === mt.length };
      });
      return {
        total: tasks.length, done, remaining: tasks.length - done, inprog: inprog.length,
        pct: U.pct(done, tasks.length), current, next, milestones,
      };
    },

    /* ---------------- learning <-> projects <-> skills ---------------- */

    /** Titles that should match project technologies ("Django REST Framework" also matches "DRF"). */
    nodeKeys(n) {
      const keys = [U.norm(n.title)];
      const m = n.title.match(/\(([^)]+)\)/);
      if (m) keys.push(U.norm(m[1]));
      const base = n.title.replace(/\s*\([^)]*\)\s*/g, '').trim();
      if (base) keys.push(U.norm(base));
      return keys;
    },

    projectsForNode(id) {
      const s = S();
      const n = s.nodes[id];
      if (!n) return [];
      const sub = new Set([id, ...App.Store.descendantsOf(id)]);
      const keys = M.nodeKeys(n);
      return s.projectOrder.map((pid) => s.projects[pid]).filter((p) => {
        if (p.learningNodeIds.some((x) => sub.has(x))) return true;
        if (p.technologies.some((t) => keys.includes(U.norm(t)))) return true;
        if (p.applied.some((a) => (a.nodeId && sub.has(a.nodeId)) || keys.includes(U.norm(a.tech)))) return true;
        return Object.values(s.ptasks).some((t) => t.projectId === p.id && t.nodeId && sub.has(t.nodeId));
      });
    },

    ptasksForNode(id) {
      const sub = new Set([id, ...App.Store.descendantsOf(id)]);
      return Object.values(S().ptasks).filter((t) => t.nodeId && sub.has(t.nodeId));
    },

    /** Learning nodes connected to a project: explicit links + matching technology names. */
    learningForProject(pid) {
      const s = S();
      const p = s.projects[pid];
      if (!p) return [];
      const ids = new Set(p.learningNodeIds);
      const techs = new Set(p.technologies.map(U.norm));
      p.applied.forEach((a) => { if (a.nodeId) ids.add(a.nodeId); if (a.tech) techs.add(U.norm(a.tech)); });
      Object.values(s.ptasks).forEach((t) => { if (t.projectId === pid && t.nodeId) ids.add(t.nodeId); });
      data().order.forEach((id) => {
        const n = s.nodes[id];
        if (['track', 'course', 'module'].includes(n.type) && M.nodeKeys(n).some((k) => techs.has(k))) ids.add(id);
      });
      return data().order.filter((id) => ids.has(id));
    },

    skillStats(sid) {
      const s = S();
      const k = s.skills[sid];
      if (!k) return null;
      const leafSet = new Set();
      k.nodeIds.forEach((id) => M.leavesOf(id).forEach((l) => leafSet.add(l)));
      let total = 0, done = 0;
      leafSet.forEach((l) => {
        const n = s.nodes[l];
        if (n.status === 'skipped') return;
        total++;
        if (n.status === 'completed') done++;
      });
      const key = U.norm(k.name);
      const projects = s.projectOrder.map((pid) => s.projects[pid]).filter((p) =>
        p.technologies.some((t) => U.norm(t) === key) || p.applied.some((a) => U.norm(a.tech) === key) ||
        k.nodeIds.some((id) => M.projectsForNode(id).includes(p)));
      const tasks = [];
      k.nodeIds.forEach((id) => {
        [id, ...App.Store.descendantsOf(id)].forEach((d) => { if (s.nodes[d].type === 'task') tasks.push(d); });
      });
      const ptasks = [];
      k.nodeIds.forEach((id) => M.ptasksForNode(id).forEach((t) => { if (!ptasks.includes(t)) ptasks.push(t); }));
      const pct = U.pct(done, total);
      const levels = ['beginner', 'elementary', 'intermediate', 'advanced', 'proficient'];
      let level = pct >= 100 ? 4 : pct >= 70 ? 3 : pct >= 40 ? 2 : pct >= 15 ? 1 : 0;
      // Applying a skill in real projects counts: bump one level (never past "advanced" without finishing).
      if (projects.length && level < 3) level++;
      const courses = k.nodeIds.map((id) => s.nodes[id]).filter(Boolean);
      return { total, done, pct, level: levels[level], projects, tasks, ptasks, courses };
    },

    /* ---------------- hierarchy & history ---------------- */

    /** The units that make up an item's progress, grouped by state ("What did I complete?"). */
    breakdown(id) {
      const s = S();
      const n = s.nodes[id];
      if (!n) return null;
      const desc = App.Store.descendantsOf(id);
      const unitType = { path: ['course'], track: ['course'], course: ['lesson', 'module'], module: ['lesson'], lesson: ['task'] }[n.type] || [];
      let units = M.order().filter((x) => desc.includes(x) && unitType.includes(s.nodes[x].type) && s.nodes[x].type === unitType[0]);
      if (!units.length) units = M.order().filter((x) => desc.includes(x) && unitType.includes(s.nodes[x].type));
      if (!units.length) units = M.leavesOf(id).filter((x) => x !== id);
      const out = { completed: [], in_progress: [], not_started: [], skipped: [], unit: units.length ? s.nodes[units[0]].type : null };
      units.forEach((u) => out[M.status(u)].push(u));
      out.completed.sort((a, b) => (s.nodes[a].completedAt || 0) - (s.nodes[b].completedAt || 0));
      return out;
    },

    /** Progress over time for one container (or '__overall'), oldest first, ending with "now". */
    progressSeries(id) {
      const s = S();
      const rows = s.progressLog.filter((r) => r.id === id);
      const nowPct = id === App.Store.OVERALL ? M.overall().pct : M.pct(id);
      const pts = [];
      if (rows.length) pts.push({ ts: rows[0].ts - 1, pct: rows[0].from, start: true });
      rows.forEach((r) => pts.push({ ts: r.ts, pct: r.to }));
      pts.push({ ts: Date.now(), pct: nowPct, now: true });
      return pts;
    },

    /** Every history event about an item or anything inside it (newest first). */
    nodeEvents(id) {
      const s = S();
      const sub = new Set([id, ...App.Store.descendantsOf(id)]);
      return s.activity.filter((e) =>
        (e.refKind === 'node' && sub.has(e.refId)) ||
        (e.type === 'session' && e.nodeId && sub.has(e.nodeId)) ||
        (e.type === 'linked' && sub.has(e.nodeId)) ||
        (e.type === 'certificate' && sub.has(e.nodeId)) ||
        (e.effects && e.effects.some((f) => f.id === id)));
    },

    lastActivity(id) {
      const s = S();
      let ts = 0;
      [id, ...App.Store.descendantsOf(id)].forEach((x) => {
        const n = s.nodes[x];
        ts = Math.max(ts, n.lastActivityAt || 0, n.completedAt || 0, n.startedAt || 0);
      });
      return ts || null;
    },

    /** Where you are inside one item: first task/lesson in progress, else the next open one. */
    currentIn(id) {
      const s = S();
      const leaves = M.leavesOf(id).filter((l) => l !== id);
      const target = leaves.find((l) => s.nodes[l].status === 'in_progress') || M.firstOpenLeaf(leaves);
      if (!target) return null;
      return {
        target,
        course: M.closest(target, 'course'),
        module: M.closest(target, 'module'),
        lesson: M.closest(target, 'lesson'),
        task: s.nodes[target].type === 'task' ? s.nodes[target] : null,
      };
    },

    completedCourses() {
      const s = S();
      return M.order().filter((id) => s.nodes[id].type === 'course' && M.status(id) === 'completed')
        .map((id) => s.nodes[id])
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    },

    firstCompleted(n) { return n.completions && n.completions.length ? n.completions[0].at : n.completedAt || null; },

    minutesFor(id) {
      const sub = new Set([id, ...App.Store.descendantsOf(id)]);
      return M.totalMinutes((x) => x.nodeId && sub.has(x.nodeId));
    },

    /* ---------------- search ---------------- */

    search(q) {
      const s = S();
      const needle = U.norm(q);
      const out = [];
      if (!needle) return out;
      const has = (v) => U.norm(v).includes(needle);
      Object.values(s.nodes).forEach((n) => {
        const inTitle = has(n.title) || has(n.description) || has(n.category) || has(n.provider);
        if (inTitle) out.push({ kind: 'node', type: n.type, id: n.id, title: n.title, text: n.description, status: M.status(n.id) });
        if (has(n.notes)) out.push({ kind: 'note', type: 'note', id: n.id, owner: 'node', title: n.title, text: U.snippet(n.notes, q), status: M.status(n.id) });
        n.resources.forEach((r) => { if (has(r.label) || has(r.url)) out.push({ kind: 'resource', type: 'resource', id: n.id, owner: 'node', title: r.label, text: n.title, url: r.url }); });
      });
      Object.values(s.projects).forEach((p) => {
        if (has(p.name) || has(p.description) || p.technologies.some(has) || has(p.type)) {
          out.push({ kind: 'project', type: 'project', id: p.id, title: p.name, text: p.description, status: p.status });
        }
        if (has(p.notes)) out.push({ kind: 'note', type: 'note', id: p.id, owner: 'project', title: p.name, text: U.snippet(p.notes, q) });
        p.applied.forEach((a) => {
          if (has(a.tech) || (a.items || []).some(has)) out.push({ kind: 'applied', type: 'project', id: p.id, title: `${a.tech} — ${p.name}`, text: (a.items || []).join(', ') });
        });
      });
      Object.values(s.ptasks).forEach((t) => {
        if (has(t.title) || has(t.description)) {
          out.push({ kind: 'ptask', type: 'ptask', id: t.id, title: t.title, text: s.projects[t.projectId].name, status: t.status });
        }
        if (has(t.notes)) out.push({ kind: 'note', type: 'note', id: t.id, owner: 'ptask', title: t.title, text: U.snippet(t.notes, q) });
      });
      Object.values(s.skills).forEach((k) => {
        if (has(k.name) || has(k.description)) out.push({ kind: 'skill', type: 'skill', id: k.id, title: k.name, text: k.description });
      });
      s.certificates.forEach((c) => {
        if (has(c.title) || has(c.provider) || has(c.credentialId) || has(c.courseTitle) || has(c.notes)) {
          out.push({ kind: 'certificate', type: 'certificate', id: c.id, title: c.title, text: [c.provider, c.courseTitle].filter(Boolean).join(' · ') });
        }
      });
      s.lists.forEach((l) => {
        if (has(l.name) || has(l.description)) out.push({ kind: 'list', type: 'list', id: l.id, title: l.name, text: l.description });
        l.items.forEach((it) => {
          if (has(it.title) || has(it.notes)) out.push({ kind: 'listItem', type: 'list', id: l.id, title: it.title, text: l.name, status: it.status === 'done' ? 'completed' : it.status === 'doing' ? 'in_progress' : 'not_started' });
        });
      });
      s.sessions.forEach((x) => {
        if (has(x.note)) out.push({ kind: 'session', type: 'session', id: x.id, title: U.fmtDate(x.date), text: U.snippet(x.note, q) });
      });
      return out;
    },
  };

  App.Model = M;
})(window.App = window.App || {});
