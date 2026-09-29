/*
 * Store: the single source of truth.
 * - Holds the whole app state in one plain object.
 * - Persists it to localStorage (falls back to memory if storage is blocked).
 * - Exposes domain operations; every change goes through commit() so the UI re-renders once.
 */
(function (App) {
  'use strict';
  const U = App.U;

  const STORAGE_KEY = 'lcc.state.v1';
  const SCHEMA_VERSION = 2;
  const OVERALL = '__overall';

  const STATUSES = ['not_started', 'in_progress', 'completed', 'skipped'];
  const PTASK_STATUSES = ['not_started', 'in_progress', 'completed'];
  const PROJECT_STATUSES = ['idea', 'planning', 'in_progress', 'paused', 'ready', 'delivered', 'archived'];
  const PRIORITIES = ['low', 'medium', 'high', 'critical'];
  const NODE_TYPES = ['path', 'track', 'course', 'module', 'lesson', 'task'];
  const RESOURCE_TYPES = ['course', 'youtube', 'docs', 'github', 'article', 'project', 'exercise'];
  const PROVIDERS = ['udemy', 'youtube', 'coursera', 'docs', 'programmingadvices', 'other'];
  const LIST_STATUSES = ['todo', 'doing', 'done'];
  const CERT_STATUSES = ['earned', 'pending'];   // "expired" is derived from expiryDate
  const PARENT_TYPES = { path: [], track: ['path'], course: ['track', 'path'], module: ['course'], lesson: ['module', 'course'], task: ['lesson', 'module', 'course'] };

  let state = null;
  let rev = 0;
  let persistent = true;
  let saveError = null;
  const listeners = new Set();

  /* ------------------------------------------------------------------ */
  /* persistence                                                         */
  /* ------------------------------------------------------------------ */

  function storageAvailable() {
    try {
      const k = '__lcc_probe__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  }

  function emptyState() {
    return {
      version: SCHEMA_VERSION,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      settings: {
        userName: 'Mohammad',
        dailyGoalMinutes: 120,
        weekStart: 6,
        roadmapView: 'auto',
        roadmapDepth: 3,
        showDeps: true,
        collapsed: {},
        expanded: {},
        lang: App.i18n.detect(),
        // appearance
        theme: 'dark',            // 'dark' | 'light' | 'system'
        accent: '',               // '' = theme default
        colors: {},               // optional overrides: { bg, panel, text, line }
        density: 'comfortable',   // 'comfortable' | 'compact'
        motion: 'on',             // 'on' | 'off'
        // learning
        defaultStatus: 'not_started',
        progressMode: 'items',    // 'items' = every lesson/task counts equally; 'average' = every child counts equally
        // projects
        defaultProjectView: 'checklist',
        taskGrouping: 'group',    // 'group' | 'milestone' | 'priority' | 'status'
        // personalisation
        learningGoal: '',
        focusNodeId: null,
      },
      rootIds: [],
      nodes: {},
      projectOrder: [],
      projects: {},
      ptasks: {},
      skillOrder: [],
      skills: {},
      sessions: [],
      activity: [],
      today: {},
      reviews: {},
      templates: [],
      technologies: [],
      lists: [],
      // Certificates hold only small metadata + links. Files are never stored here (see certificates.js → asset()).
      certificates: [],
      // current derived progress of every container, used to detect changes ({ id: { pct, status } })
      progress: {},
      // historical progress snapshots: { ts, id, title, nodeType, from, to, fromStatus, toStatus }
      progressLog: [],
      position: null,
      timer: null,
    };
  }

  /** Fill in any fields missing from older/partial data so the app never crashes on import. */
  function normalize(raw) {
    const base = emptyState();
    const s = Object.assign(base, raw || {});
    s.settings = Object.assign(emptyState().settings, (raw && raw.settings) || {});
    ['nodes', 'projects', 'ptasks', 'skills', 'today', 'reviews', 'progress'].forEach((k) => {
      if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) s[k] = {};
    });
    ['rootIds', 'projectOrder', 'skillOrder', 'sessions', 'activity', 'templates', 'technologies', 'lists', 'progressLog', 'certificates'].forEach((k) => {
      if (!Array.isArray(s[k])) s[k] = [];
    });
    ['collapsed', 'expanded', 'colors'].forEach((k) => {
      if (!s.settings[k] || typeof s.settings[k] !== 'object') s.settings[k] = {};
    });

    Object.values(s.nodes).forEach((n) => {
      n.children = Array.isArray(n.children) ? n.children.filter((c) => s.nodes[c]) : [];
      n.prereqs = Array.isArray(n.prereqs) ? n.prereqs.filter((p) => s.nodes[p] && p !== n.id) : [];
      n.resources = Array.isArray(n.resources) ? n.resources : [];
      if (!STATUSES.includes(n.status)) n.status = 'not_started';
      if (!NODE_TYPES.includes(n.type)) n.type = 'lesson';
      n.notes = n.notes || '';
      n.description = n.description || '';
      n.completions = Array.isArray(n.completions) ? n.completions : [];
      // Older data: remember an existing completion as the first one.
      if (n.completedAt && !n.completions.length) n.completions.push({ at: n.completedAt, reopenedAt: null });
      n.review = !!n.review;
    });
    s.rootIds = s.rootIds.filter((id) => s.nodes[id]);

    Object.values(s.projects).forEach((p) => {
      p.technologies = Array.isArray(p.technologies) ? p.technologies : [];
      p.groups = Array.isArray(p.groups) ? p.groups : [];
      p.milestones = Array.isArray(p.milestones) ? p.milestones : [];
      p.applied = Array.isArray(p.applied) ? p.applied : [];
      p.resources = Array.isArray(p.resources) ? p.resources : [];
      p.learningNodeIds = Array.isArray(p.learningNodeIds) ? p.learningNodeIds.filter((id) => s.nodes[id]) : [];
      if (!PROJECT_STATUSES.includes(p.status)) p.status = 'planning';
      p.notes = p.notes || '';
      p.view = p.view === 'kanban' ? 'kanban' : 'checklist';
    });
    s.projectOrder = s.projectOrder.filter((id) => s.projects[id]);
    Object.keys(s.projects).forEach((id) => { if (!s.projectOrder.includes(id)) s.projectOrder.push(id); });

    Object.values(s.ptasks).forEach((t) => {
      if (!s.projects[t.projectId]) { delete s.ptasks[t.id]; return; }
      if (!PTASK_STATUSES.includes(t.status)) t.status = 'not_started';
      if (!PRIORITIES.includes(t.priority)) t.priority = 'medium';
      t.deps = Array.isArray(t.deps) ? t.deps.filter((d) => s.ptasks[d] && d !== t.id) : [];
      if (t.nodeId && !s.nodes[t.nodeId]) t.nodeId = null;
    });

    // Repair records saved without an id by v1 (sessions, templates, skills added from the UI).
    s.sessions.forEach((x) => { if (!x.id) x.id = U.uid('ss'); });
    s.templates.forEach((x) => { if (!x.id) x.id = U.uid('tpl'); });
    Object.keys(s.skills).forEach((key) => {
      const k = s.skills[key];
      if (!k.id || key !== k.id) {
        const id = k.id && k.id !== 'undefined' ? k.id : U.uid('s');
        delete s.skills[key];
        k.id = id;
        s.skills[id] = k;
        s.skillOrder = s.skillOrder.map((x) => (x === key ? id : x));
      }
    });
    Object.values(s.skills).forEach((k) => {
      k.nodeIds = Array.isArray(k.nodeIds) ? k.nodeIds.filter((id) => s.nodes[id]) : [];
    });
    s.skillOrder = s.skillOrder.filter((id) => s.skills[id]);
    Object.keys(s.skills).forEach((id) => { if (!s.skillOrder.includes(id)) s.skillOrder.push(id); });

    s.technologies = U.unique([...s.technologies, ...Object.values(s.projects).flatMap((p) => p.technologies)].filter(Boolean));
    s.lists.forEach((l) => {
      if (!l.id) l.id = U.uid('l');
      l.items = Array.isArray(l.items) ? l.items : [];
      l.items.forEach((it) => { if (!it.id) it.id = U.uid('li'); });
      l.items.forEach((it) => { if (!LIST_STATUSES.includes(it.status)) it.status = 'todo'; });
    });
    s.certificates = s.certificates.filter((c) => c && typeof c === 'object').map(normalizeCertificate);
    s.certificates.forEach((c) => { if (c.nodeId && !s.nodes[c.nodeId]) c.nodeId = null; });
    if (s.settings.focusNodeId && !s.nodes[s.settings.focusNodeId]) s.settings.focusNodeId = null;
    if (s.position && !s.nodes[s.position.nodeId]) s.position = null;
    s.version = SCHEMA_VERSION;
    return s;
  }

  function writeNow() {
    if (!persistent || !state) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      saveError = null;
    } catch (e) {
      saveError = e;
      console.error('Could not save data', e);
    }
  }

  const writeSoon = U.debounce(writeNow, 120);

  function load() {
    persistent = storageAvailable();
    let raw = null;
    if (persistent) {
      try { raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { raw = null; }
    }
    state = normalize(raw || App.Seed.create());
    rev++;
    recordProgress(state, { silent: true });
    if (!raw) writeNow();
    window.addEventListener('beforeunload', writeNow);
    document.addEventListener('visibilitychange', () => { if (document.hidden) writeNow(); });
    return state;
  }

  function commit(mutator, opts = {}) {
    const started = Date.now();
    const result = mutator(state);
    state.updatedAt = Date.now();
    rev++;
    recordProgress(state, { silent: !!opts.silentProgress, since: started });
    if (opts.immediate) writeNow(); else writeSoon();
    listeners.forEach((fn) => fn(opts));
    return result;
  }

  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  function snapshot() { return JSON.stringify(state); }

  function restore(json) {
    commit(() => { state = normalize(JSON.parse(json)); }, { immediate: true, silentProgress: true });
  }

  /* ------------------------------------------------------------------ */
  /* activity log                                                        */
  /* ------------------------------------------------------------------ */

  /* History is never trimmed automatically — it is the learning record. */
  function log(s, entry) {
    s.activity.unshift(Object.assign({ id: U.uid('act'), ts: Date.now() }, U.defined(entry)));
  }

  /* ------------------------------------------------------------------ */
  /* progress history                                                    */
  /* ------------------------------------------------------------------ */

  /** Keep a node's completion history: every completion and every reopening is remembered. */
  function trackCompletion(n, from, to, now) {
    if (to === 'completed' && from !== 'completed') {
      n.completions.push({ at: now, reopenedAt: null });
      n.completedAt = now;
    } else if (from === 'completed' && to !== 'completed') {
      const last = n.completions[n.completions.length - 1];
      if (last && !last.reopenedAt) last.reopenedAt = now;
      n.completedAt = null;
    }
    if (to !== 'not_started' && to !== 'skipped' && !n.startedAt) n.startedAt = now;
  }

  /**
   * After every change, compare each container's derived progress with the last known value.
   * Differences become permanent history: progress snapshots, and start / complete / reopen events
   * for paths, tracks, courses, modules and lessons. The event that caused the change gets an
   * "effects" list (e.g. Django 68% → 72%).
   */
  function recordProgress(s, opts = {}) {
    const M = App.Model;
    if (!M) return;
    const now = Date.now();
    const seen = new Set();
    const effects = [];
    const current = {};
    Object.values(s.nodes).forEach((n) => {
      if (!n.children.length) return;
      const i = M.info(n.id);
      current[n.id] = { pct: i.pct, status: i.status };
    });
    current[OVERALL] = { pct: M.overall().pct, status: null };

    Object.keys(current).forEach((id) => {
      seen.add(id);
      const cur = current[id];
      const prev = s.progress[id];
      s.progress[id] = cur;
      if (opts.silent || !prev) return;
      const n = s.nodes[id];
      if (prev.pct !== cur.pct) {
        s.progressLog.push({
          ts: now, id, title: n ? n.title : '', nodeType: n ? n.type : 'overall',
          from: prev.pct, to: cur.pct, fromStatus: prev.status, toStatus: cur.status,
        });
        effects.push({ id, title: n ? n.title : '', nodeType: n ? n.type : 'overall', from: prev.pct, to: cur.pct });
      }
      if (n && prev.status !== cur.status) {
        trackCompletion(n, prev.status, cur.status, now);
        const type = cur.status === 'completed' ? 'complete'
          : prev.status === 'completed' ? 'reopen'
            : prev.status === 'not_started' && cur.status === 'in_progress' ? 'start' : null;
        const already = s.activity.some((a) => a.ts >= (opts.since || now) && a.refId === id && a.type === type);
        if (type && !already) {
          log(s, { type, refKind: 'node', refId: id, nodeType: n.type, title: n.title, derived: true,
            fromStatus: prev.status, toStatus: cur.status, fromPct: prev.pct, toPct: cur.pct });
        }
      }
    });
    Object.keys(s.progress).forEach((id) => { if (!seen.has(id)) delete s.progress[id]; });

    // Attach the progress effects to the user action that caused them.
    if (effects.length && opts.since) {
      const cause = s.activity.find((a) => a.ts >= opts.since && !a.derived && !a.effects);
      if (cause) {
        const rank = { overall: 0, path: 1, track: 2, course: 3, module: 4, lesson: 5 };
        cause.effects = effects.sort((a, b) => (rank[a.nodeType] ?? 9) - (rank[b.nodeType] ?? 9));
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* learning nodes                                                      */
  /* ------------------------------------------------------------------ */

  function makeNode(type, parentId, fields = {}) {
    const now = Date.now();
    return Object.assign({
      id: U.uid('n'),
      type,
      parentId: parentId || null,
      children: [],
      title: 'Untitled',
      description: '',
      status: 'not_started',
      notes: '',
      resources: [],
      prereqs: [],
      provider: '',
      url: '',
      estHours: '',
      category: '',
      startDate: '',
      targetDate: '',
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      completions: [],   // [{ at, reopenedAt }] — every completion is kept
      review: false,     // reopened for review while everything inside stays completed
      lastActivityAt: null,
    }, fields);
  }

  function descendantsOf(s, id) {
    const out = [];
    const stack = [...(s.nodes[id] ? s.nodes[id].children : [])];
    while (stack.length) {
      const cid = stack.pop();
      const n = s.nodes[cid];
      if (!n) continue;
      out.push(cid);
      stack.push(...n.children);
    }
    return out;
  }

  /** "Last activity" for an item and everything above it. */
  function touchAncestors(s, id, now = Date.now()) {
    [id, ...ancestorsOf(s, id)].forEach((a) => { if (s.nodes[a]) s.nodes[a].lastActivityAt = now; });
  }

  function ancestorsOf(s, id) {
    const out = [];
    let n = s.nodes[id];
    while (n && n.parentId) { out.push(n.parentId); n = s.nodes[n.parentId]; }
    return out;
  }

  function addNode(type, parentId, fields) {
    return commit((s) => {
      const node = makeNode(type, parentId, fields);
      s.nodes[node.id] = node;
      if (parentId && s.nodes[parentId]) s.nodes[parentId].children.push(node.id);
      else { node.parentId = null; s.rootIds.push(node.id); }
      log(s, { type: 'add', refKind: 'node', refId: node.id, nodeType: type, title: node.title });
      return node.id;
    });
  }

  function updateNode(id, fields) {
    commit((s) => {
      const n = s.nodes[id];
      if (!n) return;
      Object.assign(n, fields, { updatedAt: Date.now() });
    });
  }

  function applyStatus(s, n, status, now) {
    if (n.status === status) return false;
    const from = n.status;
    n.status = status;
    n.updatedAt = now;
    // Leaves keep their own completion history; containers get theirs from recordProgress().
    if (!n.children.length) trackCompletion(n, from, status, now);
    else if (status === 'in_progress' && !n.startedAt) n.startedAt = now;
    return true;
  }

  /**
   * Set a learning node's status.
   * Completed / skipped / not started cascade to every descendant so containers stay consistent.
   */
  function setNodeStatus(id, status, opts = {}) {
    if (!STATUSES.includes(status)) return;
    commit((s) => {
      const n = s.nodes[id];
      if (!n) return;
      const now = Date.now();
      const allDone = n.children.length && App.Model.info(id).status === 'completed';
      // "In progress" on a finished container = reopen for review: keep every completed lesson.
      if (status === 'in_progress' && allDone) {
        n.review = true;
        n.status = 'in_progress';
        n.updatedAt = now;
        s.position = { nodeId: id, ts: now };
        touchAncestors(s, id, now);
        return;
      }
      if (n.children.length) n.review = false;
      const prevStatus = n.status;
      const changed = applyStatus(s, n, status, now);
      touchAncestors(s, id, now);
      if (status !== 'in_progress' && opts.cascade !== false) {
        descendantsOf(s, id).forEach((cid) => {
          const c = s.nodes[cid];
          if (status === 'completed' && c.status === 'skipped') return;
          applyStatus(s, c, status, now);
        });
      }
      if (status === 'in_progress' || status === 'completed') {
        ancestorsOf(s, id).forEach((aid) => {
          const a = s.nodes[aid];
          if (a.status === 'not_started') { a.status = 'in_progress'; a.startedAt = a.startedAt || now; }
        });
      }
      if (changed) {
        s.position = { nodeId: id, ts: now };
        const type = { completed: 'complete', in_progress: 'start', skipped: 'skip', not_started: 'reopen' }[status];
        log(s, { type, refKind: 'node', refId: id, nodeType: n.type, title: n.title, fromStatus: prevStatus, toStatus: status });
      }
      syncTodayFromRef(s, 'node', id, status === 'completed');
    });
  }

  function deleteNode(id) {
    commit((s) => {
      const n = s.nodes[id];
      if (!n) return;
      const doomed = new Set([id, ...descendantsOf(s, id)]);
      if (n.parentId && s.nodes[n.parentId]) {
        const p = s.nodes[n.parentId];
        p.children = p.children.filter((c) => c !== id);
      }
      s.rootIds = s.rootIds.filter((r) => r !== id);
      doomed.forEach((d) => { delete s.nodes[d]; delete s.settings.collapsed[d]; delete s.settings.expanded[d]; });
      // Scrub every reference so nothing points at a deleted node.
      Object.values(s.nodes).forEach((o) => { o.prereqs = o.prereqs.filter((p) => !doomed.has(p)); });
      Object.values(s.skills).forEach((k) => { k.nodeIds = k.nodeIds.filter((x) => !doomed.has(x)); });
      Object.values(s.projects).forEach((p) => {
        p.learningNodeIds = p.learningNodeIds.filter((x) => !doomed.has(x));
        p.applied.forEach((a) => { if (doomed.has(a.nodeId)) a.nodeId = null; });
      });
      Object.values(s.ptasks).forEach((t) => { if (doomed.has(t.nodeId)) t.nodeId = null; });
      s.sessions.forEach((x) => { if (doomed.has(x.nodeId)) x.nodeId = null; });
      Object.keys(s.today).forEach((k) => {
        s.today[k] = s.today[k].filter((it) => !(it.kind === 'node' && doomed.has(it.refId)));
      });
      if (s.position && doomed.has(s.position.nodeId)) s.position = null;
      if (doomed.has(s.settings.focusNodeId)) s.settings.focusNodeId = null;
      s.certificates.forEach((c) => { if (doomed.has(c.nodeId)) c.nodeId = null; });
      if (s.timer && doomed.has(s.timer.nodeId)) s.timer.nodeId = null;
      log(s, { type: 'delete', refKind: 'node', refId: id, nodeType: n.type, title: n.title });
    }, { immediate: true });
  }

  /** Move a node one step up/down among its siblings. */
  function moveNode(id, delta) {
    commit((s) => {
      const n = s.nodes[id];
      if (!n) return;
      const list = n.parentId ? s.nodes[n.parentId].children : s.rootIds;
      const i = list.indexOf(id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
    });
  }

  /** Returns an error key if the prerequisite would be invalid, otherwise null. */
  function prereqError(targetId, prereqId) {
    const s = state;
    if (targetId === prereqId) return 'errors.prereqSelf';
    if (ancestorsOf(s, targetId).includes(prereqId) || descendantsOf(s, targetId).includes(prereqId)) return 'errors.prereqFamily';
    // Would create a cycle if targetId is already (transitively) required by prereqId.
    const seen = new Set();
    const stack = [prereqId];
    while (stack.length) {
      const cur = stack.pop();
      if (cur === targetId) return 'errors.prereqCycle';
      if (seen.has(cur)) continue;
      seen.add(cur);
      const node = s.nodes[cur];
      if (node) stack.push(...node.prereqs);
    }
    return null;
  }

  function setPrereqs(id, prereqIds) {
    commit((s) => {
      const n = s.nodes[id];
      if (!n) return;
      n.prereqs = U.unique(prereqIds).filter((p) => s.nodes[p] && !prereqError(id, p));
    });
  }

  /* ------------------------------------------------------------------ */
  /* shared: resources + notes on any owner                              */
  /* ------------------------------------------------------------------ */

  function ownerOf(s, kind, id) {
    if (kind === 'node') return s.nodes[id];
    if (kind === 'project') return s.projects[id];
    if (kind === 'ptask') return s.ptasks[id];
    return null;
  }

  function addResource(kind, id, res) {
    commit((s) => {
      const o = ownerOf(s, kind, id);
      if (!o) return;
      o.resources = o.resources || [];
      o.resources.push(Object.assign({ id: U.uid('r') }, U.defined(res)));
    });
  }

  function removeResource(kind, id, resId) {
    commit((s) => {
      const o = ownerOf(s, kind, id);
      if (o) o.resources = (o.resources || []).filter((r) => r.id !== resId);
    });
  }

  function setNotes(kind, id, text) {
    commit((s) => {
      const o = ownerOf(s, kind, id);
      if (!o) return;
      o.notes = text;
      o.updatedAt = Date.now();
      if (kind === 'node') { s.position = { nodeId: id, ts: Date.now() }; touchAncestors(s, id); }
    }, { silent: true });
  }

  /* ------------------------------------------------------------------ */
  /* projects                                                            */
  /* ------------------------------------------------------------------ */

  function touchProject(s, pid) {
    const p = s.projects[pid];
    if (p) { p.lastActivityAt = Date.now(); p.updatedAt = Date.now(); }
  }

  function addProject(fields, template) {
    return commit((s) => {
      const now = Date.now();
      const p = Object.assign({
        id: U.uid('p'),
        name: 'Untitled project',
        description: '',
        type: '',
        status: 'planning',
        technologies: [],
        repoUrl: '', liveUrl: '', docsUrl: '',
        startDate: U.dayKey(), targetDate: '',
        notes: '',
        groups: [], milestones: [], applied: [], resources: [],
        learningNodeIds: [],
        view: s.settings.defaultProjectView === 'kanban' ? 'kanban' : 'checklist',
        createdAt: now, updatedAt: now, lastActivityAt: now,
        lastTaskId: null,
      }, fields);
      s.projects[p.id] = p;
      s.projectOrder.unshift(p.id);
      s.technologies = U.unique([...s.technologies, ...p.technologies]);
      if (template) {
        parseTemplate(template).forEach((g) => {
          const gid = U.uid('g');
          p.groups.push({ id: gid, name: g.name });
          g.tasks.forEach((title, i) => {
            const t = makePTask(p.id, { title, groupId: gid, order: i });
            s.ptasks[t.id] = t;
          });
        });
      }
      log(s, { type: 'project_created', refKind: 'project', refId: p.id, projectId: p.id, title: p.name });
      return p.id;
    });
  }

  function updateProject(pid, fields) {
    commit((s) => {
      const p = s.projects[pid];
      if (!p) return;
      const before = p.status;
      const beforeTech = new Set(p.technologies.map(U.norm));
      Object.assign(p, fields);
      touchProject(s, pid);
      if (fields.status && fields.status !== before) {
        log(s, { type: 'project_status', refKind: 'project', refId: pid, projectId: pid, title: p.name, from: before, to: fields.status });
      }
      if (fields.technologies) {
        s.technologies = U.unique([...s.technologies, ...fields.technologies]);
        fields.technologies.filter((t) => !beforeTech.has(U.norm(t))).forEach((tech) => {
          log(s, { type: 'tech_added', refKind: 'project', refId: pid, projectId: pid, title: tech });
        });
      }
    });
  }

  function deleteProject(pid) {
    commit((s) => {
      const p = s.projects[pid];
      if (!p) return;
      Object.values(s.ptasks).forEach((t) => { if (t.projectId === pid) delete s.ptasks[t.id]; });
      delete s.projects[pid];
      s.projectOrder = s.projectOrder.filter((x) => x !== pid);
      s.sessions.forEach((x) => { if (x.projectId === pid) x.projectId = null; });
      Object.keys(s.today).forEach((k) => {
        s.today[k] = s.today[k].filter((it) => !(it.kind === 'ptask' && !s.ptasks[it.refId]));
      });
      log(s, { type: 'delete', refKind: 'project', refId: pid, title: p.name });
    }, { immediate: true });
  }

  function makePTask(projectId, fields = {}) {
    const now = Date.now();
    return Object.assign({
      id: U.uid('t'),
      projectId,
      groupId: null,
      milestoneId: null,
      title: 'Untitled task',
      description: '',
      notes: '',
      status: 'not_started',
      priority: 'medium',
      dueDate: '',
      deps: [],
      nodeId: null,
      order: now,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    }, fields);
  }

  function addPTask(projectId, fields) {
    return commit((s) => {
      const t = makePTask(projectId, fields);
      s.ptasks[t.id] = t;
      touchProject(s, projectId);
      log(s, { type: 'add', refKind: 'ptask', refId: t.id, projectId, title: t.title });
      return t.id;
    });
  }

  function updatePTask(id, fields) {
    commit((s) => {
      const t = s.ptasks[id];
      if (!t) return;
      if (fields.deps) fields.deps = fields.deps.filter((d) => d !== id && s.ptasks[d] && !ptaskDepCycle(s, id, d));
      Object.assign(t, fields, { updatedAt: Date.now() });
      touchProject(s, t.projectId);
    });
  }

  function ptaskDepCycle(s, id, depId) {
    const seen = new Set();
    const stack = [depId];
    while (stack.length) {
      const cur = stack.pop();
      if (cur === id) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      const t = s.ptasks[cur];
      if (t) stack.push(...t.deps);
    }
    return false;
  }

  function milestoneDone(s, pid, mid) {
    const tasks = Object.values(s.ptasks).filter((t) => t.projectId === pid && t.milestoneId === mid);
    return tasks.length > 0 && tasks.every((t) => t.status === 'completed');
  }

  function setPTaskStatus(id, status) {
    if (!PTASK_STATUSES.includes(status)) return;
    commit((s) => {
      const t = s.ptasks[id];
      if (!t || t.status === status) return;
      const p = s.projects[t.projectId];
      const msBefore = t.milestoneId ? milestoneDone(s, t.projectId, t.milestoneId) : false;
      const now = Date.now();
      const wasCompleted = t.status === 'completed';
      t.status = status;
      t.updatedAt = now;
      t.completedAt = status === 'completed' ? now : null;
      p.lastTaskId = id;
      touchProject(s, t.projectId);
      const type = status === 'completed' ? 'complete' : status === 'in_progress' ? (wasCompleted ? 'reopen' : 'start') : 'reopen';
      log(s, { type, refKind: 'ptask', refId: id, projectId: t.projectId, title: t.title, priority: t.priority });
      if (t.milestoneId && !msBefore && milestoneDone(s, t.projectId, t.milestoneId)) {
        const m = p.milestones.find((x) => x.id === t.milestoneId);
        if (m) log(s, { type: 'milestone_done', refKind: 'project', refId: p.id, projectId: p.id, title: m.name });
      }
      if (p.status === 'idea' || p.status === 'planning') {
        if (status !== 'not_started') {
          log(s, { type: 'project_status', refKind: 'project', refId: p.id, projectId: p.id, title: p.name, from: p.status, to: 'in_progress' });
          p.status = 'in_progress';
        }
      }
      syncTodayFromRef(s, 'ptask', id, status === 'completed');
    });
  }

  function deletePTask(id) {
    commit((s) => {
      const t = s.ptasks[id];
      if (!t) return;
      delete s.ptasks[id];
      Object.values(s.ptasks).forEach((o) => { o.deps = o.deps.filter((d) => d !== id); });
      const p = s.projects[t.projectId];
      if (p && p.lastTaskId === id) p.lastTaskId = null;
      Object.keys(s.today).forEach((k) => {
        s.today[k] = s.today[k].filter((it) => !(it.kind === 'ptask' && it.refId === id));
      });
      log(s, { type: 'delete', refKind: 'ptask', refId: id, projectId: t.projectId, title: t.title });
    }, { immediate: true });
  }

  /** Generic helper for the small lists inside a project (groups, milestones, applied, resources). */
  function projectList(pid, listName, op, payload) {
    commit((s) => {
      const p = s.projects[pid];
      if (!p) return;
      const list = p[listName];
      if (op === 'add') list.push(Object.assign({ id: U.uid(listName.slice(0, 2)) }, U.defined(payload)));
      if (op === 'update') {
        const item = list.find((x) => x.id === payload.id);
        if (item) Object.assign(item, payload);
      }
      if (op === 'remove') {
        p[listName] = list.filter((x) => x.id !== payload.id);
        if (listName === 'groups') Object.values(s.ptasks).forEach((t) => { if (t.projectId === pid && t.groupId === payload.id) t.groupId = null; });
        if (listName === 'milestones') Object.values(s.ptasks).forEach((t) => { if (t.projectId === pid && t.milestoneId === payload.id) t.milestoneId = null; });
      }
      touchProject(s, pid);
    });
  }

  /* ------------------------------------------------------------------ */
  /* templates                                                           */
  /* ------------------------------------------------------------------ */

  /** Text format: a line is a group; a line starting with "-" is a task in the current group. */
  function parseTemplate(text) {
    const groups = [];
    String(text || '').split(/\r?\n/).forEach((line) => {
      const l = line.trim();
      if (!l) return;
      if (/^[-*•]/.test(l)) {
        const title = l.replace(/^[-*•]\s*/, '').trim();
        if (!title) return;
        if (!groups.length) groups.push({ name: 'General', tasks: [] });
        groups[groups.length - 1].tasks.push(title);
      } else {
        groups.push({ name: l, tasks: [] });
      }
    });
    return groups;
  }

  function saveTemplate(tpl) {
    commit((s) => {
      const existing = s.templates.find((t) => t.id === tpl.id);
      if (existing) Object.assign(existing, tpl);
      else s.templates.push(Object.assign({ id: U.uid('tpl') }, U.defined(tpl)));
    });
  }

  function deleteTemplate(id) {
    commit((s) => { s.templates = s.templates.filter((t) => t.id !== id); });
  }

  /* ------------------------------------------------------------------ */
  /* skills                                                              */
  /* ------------------------------------------------------------------ */

  function saveSkill(skill) {
    return commit((s) => {
      if (skill.id && s.skills[skill.id]) { Object.assign(s.skills[skill.id], skill); return skill.id; }
      const k = Object.assign({ id: U.uid('s'), name: 'Skill', description: '', nodeIds: [], createdAt: Date.now() }, U.defined(skill));
      s.skills[k.id] = k;
      s.skillOrder.push(k.id);
      return k.id;
    });
  }

  function deleteSkill(id) {
    commit((s) => {
      delete s.skills[id];
      s.skillOrder = s.skillOrder.filter((x) => x !== id);
    });
  }

  /* ------------------------------------------------------------------ */
  /* sessions + timer                                                    */
  /* ------------------------------------------------------------------ */

  function saveSession(sess) {
    commit((s) => {
      const existing = sess.id && s.sessions.find((x) => x.id === sess.id);
      if (existing) { Object.assign(existing, sess); return; }
      const x = Object.assign({ id: U.uid('ss'), date: U.dayKey(), minutes: 0, kind: 'learning', nodeId: null, projectId: null, note: '', createdAt: Date.now() }, U.defined(sess));
      s.sessions.push(x);
      if (x.nodeId && s.nodes[x.nodeId]) { s.position = { nodeId: x.nodeId, ts: Date.now() }; touchAncestors(s, x.nodeId); }
      if (x.projectId) touchProject(s, x.projectId);
      const title = x.nodeId && s.nodes[x.nodeId] ? s.nodes[x.nodeId].title : x.projectId && s.projects[x.projectId] ? s.projects[x.projectId].name : '';
      log(s, { type: 'session', refKind: 'session', refId: x.id, projectId: x.projectId || null, title, minutes: x.minutes });
    });
  }

  function deleteSession(id) {
    commit((s) => { s.sessions = s.sessions.filter((x) => x.id !== id); });
  }

  function startTimer(ref) {
    commit((s) => { s.timer = Object.assign({ startTs: Date.now() }, ref); }, { immediate: true });
  }

  function stopTimer() {
    const t = state.timer;
    if (!t) return 0;
    const minutes = Math.max(1, Math.round((Date.now() - t.startTs) / 60000));
    commit((s) => { s.timer = null; }, { immediate: true });
    return { minutes, nodeId: t.nodeId || null, projectId: t.projectId || null, date: U.dayKey(new Date(t.startTs)) };
  }

  function cancelTimer() { commit((s) => { s.timer = null; }, { immediate: true }); }

  /* ------------------------------------------------------------------ */
  /* today's plan                                                        */
  /* ------------------------------------------------------------------ */

  function todayList(s, key) {
    if (!s.today[key]) s.today[key] = [];
    return s.today[key];
  }

  function syncTodayFromRef(s, kind, refId, done) {
    const list = s.today[U.dayKey()];
    if (!list) return;
    list.forEach((it) => { if (it.kind === kind && it.refId === refId) it.done = done; });
  }

  function addTodayItem(item) {
    commit((s) => {
      const list = todayList(s, U.dayKey());
      if (item.refId && list.some((x) => x.kind === item.kind && x.refId === item.refId)) return;
      list.push(Object.assign({ id: U.uid('td'), done: false }, U.defined(item)));
      pruneToday(s);
    });
  }

  function removeTodayItem(id) {
    commit((s) => {
      const key = U.dayKey();
      s.today[key] = (s.today[key] || []).filter((x) => x.id !== id);
    });
  }

  /** Toggle an item; linked items also flip the real node / project task. */
  function toggleTodayItem(id) {
    const list = state.today[U.dayKey()] || [];
    const it = list.find((x) => x.id === id);
    if (!it) return;
    const done = !it.done;
    if (it.kind === 'node' && state.nodes[it.refId]) return setNodeStatus(it.refId, done ? 'completed' : 'in_progress');
    if (it.kind === 'ptask' && state.ptasks[it.refId]) return setPTaskStatus(it.refId, done ? 'completed' : 'in_progress');
    commit(() => {
      it.done = done;
      if (done) log(state, { type: 'complete', refKind: 'today', refId: it.id, title: it.text });
    });
  }

  function carryOverToday() {
    commit((s) => {
      const today = U.dayKey();
      const keys = Object.keys(s.today).filter((k) => k < today).sort();
      const prev = keys.length ? s.today[keys[keys.length - 1]] : [];
      const list = todayList(s, today);
      prev.filter((x) => !x.done).forEach((x) => {
        if (x.refId && list.some((y) => y.kind === x.kind && y.refId === x.refId)) return;
        if (!x.refId && list.some((y) => !y.refId && y.text === x.text)) return;
        list.push(Object.assign({}, x, { id: U.uid('td'), done: false }));
      });
    });
  }

  function pruneToday(s) {
    const keep = U.addDays(U.dayKey(), -120);
    Object.keys(s.today).forEach((k) => { if (k < keep) delete s.today[k]; });
  }

  /* ------------------------------------------------------------------ */
  /* restructuring: move, reorder, related items                         */
  /* ------------------------------------------------------------------ */

  /** Parents a node may be moved under (never itself or its own descendants). */
  function parentOptions(id, type) {
    const s = state;
    const blocked = id ? new Set([id, ...descendantsOf(s, id)]) : new Set();
    return Object.values(s.nodes).filter((n) => PARENT_TYPES[type].includes(n.type) && !blocked.has(n.id)).map((n) => n.id);
  }

  function moveNodeTo(id, parentId) {
    commit((s) => {
      const n = s.nodes[id];
      if (!n || n.parentId === parentId || !parentOptions(id, n.type).includes(parentId)) return;
      const from = n.parentId ? s.nodes[n.parentId].children : s.rootIds;
      from.splice(from.indexOf(id), 1);
      s.nodes[parentId].children.push(id);
      n.parentId = parentId;
      n.updatedAt = Date.now();
      // A move can create prerequisite relations between parent and child — drop those.
      [id, ...descendantsOf(s, id)].forEach((x) => {
        s.nodes[x].prereqs = s.nodes[x].prereqs.filter((p) => !ancestorsOf(s, x).includes(p) && !descendantsOf(s, x).includes(p));
      });
    });
  }

  /** Move an item one step up (-1) or down (+1) inside whatever ordered list it belongs to. */
  function reorder(kind, id, delta, ctx = {}) {
    commit((s) => {
      const swap = (list) => {
        const i = list.findIndex((x) => (x && x.id ? x.id : x) === id);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
      };
      if (kind === 'project') swap(s.projectOrder);
      else if (kind === 'skill') swap(s.skillOrder);
      else if (kind === 'list') swap(s.lists);
      else if (kind === 'template') swap(s.templates);
      else if (kind === 'group' || kind === 'milestone') swap(s.projects[ctx.projectId][kind === 'group' ? 'groups' : 'milestones']);
      else if (kind === 'listItem') { const l = s.lists.find((x) => x.id === ctx.listId); if (l) swap(l.items); }
      else if (kind === 'ptask') {
        const t = s.ptasks[id];
        const siblings = Object.values(s.ptasks)
          .filter((x) => x.projectId === t.projectId && (x.groupId || null) === (t.groupId || null))
          .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
        siblings.forEach((x, i) => { x.order = i; });
        const i = siblings.indexOf(t), j = i + delta;
        if (j < 0 || j >= siblings.length) return;
        [siblings[i].order, siblings[j].order] = [siblings[j].order, siblings[i].order];
      }
    });
  }

  /** Replace a node's resources from edited rows, keeping ids of rows that still exist. */
  function setResources(kind, id, rows) {
    commit((s) => {
      const o = ownerOf(s, kind, id);
      if (!o) return;
      const old = o.resources || [];
      o.resources = rows.map((r) => {
        const same = old.find((x) => x.url === r.url);
        return Object.assign({ id: same ? same.id : U.uid('r') }, r);
      });
    });
  }

  /** Which projects practise this learning item (edits project.learningNodeIds). */
  function setNodeProjects(nodeId, projectIds) {
    commit((s) => {
      const want = new Set(projectIds);
      Object.values(s.projects).forEach((p) => {
        const has = p.learningNodeIds.includes(nodeId);
        if (want.has(p.id) && !has) {
          p.learningNodeIds.push(nodeId);
          log(s, { type: 'linked', refKind: 'project', refId: p.id, projectId: p.id, title: s.nodes[nodeId].title, nodeId });
        }
        if (!want.has(p.id) && has) p.learningNodeIds = p.learningNodeIds.filter((x) => x !== nodeId);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* technologies registry                                               */
  /* ------------------------------------------------------------------ */

  function addTechnology(name) {
    commit((s) => {
      const n = String(name || '').trim();
      if (n && !s.technologies.some((x) => U.norm(x) === U.norm(n))) s.technologies.push(n);
    });
  }

  /** Rename everywhere: registry, project technologies and "What I Applied" entries. */
  function renameTechnology(oldName, newName) {
    commit((s) => {
      const nn = String(newName || '').trim();
      if (!nn) return;
      const same = (x) => U.norm(x) === U.norm(oldName);
      s.technologies = U.unique(s.technologies.map((x) => (same(x) ? nn : x)));
      Object.values(s.projects).forEach((p) => {
        p.technologies = U.unique(p.technologies.map((x) => (same(x) ? nn : x)));
        p.applied.forEach((a) => { if (same(a.tech)) a.tech = nn; });
      });
    });
  }

  function deleteTechnology(name) {
    commit((s) => {
      const same = (x) => U.norm(x) === U.norm(name);
      s.technologies = s.technologies.filter((x) => !same(x));
      Object.values(s.projects).forEach((p) => { p.technologies = p.technologies.filter((x) => !same(x)); });
    });
  }

  /* ------------------------------------------------------------------ */
  /* certificates                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * A certificate is metadata + links only (never Base64 files):
   *   { id, nodeId, courseTitle, title, provider, issueDate, expiryDate, credentialId, status,
   *     certificateUrl (verify / original), imageUrl (full image), thumbnailUrl (small image),
   *     file: null | { storage, key, mime, size } — reserved for a future upload backend }
   */
  function normalizeCertificate(c) {
    const out = Object.assign({
      id: U.uid('cert'), nodeId: null, courseTitle: '', title: '', provider: '', issueDate: '', expiryDate: '',
      credentialId: '', status: 'earned', certificateUrl: '', imageUrl: '', thumbnailUrl: '', notes: '',
      file: null, createdAt: Date.now(), updatedAt: Date.now(),
    }, U.defined(c));
    if (!CERT_STATUSES.includes(out.status)) out.status = 'earned';
    // Safety net: never keep embedded file data in localStorage.
    ['certificateUrl', 'imageUrl', 'thumbnailUrl'].forEach((k) => { if (!U.isUrl(out[k])) out[k] = ''; });
    return out;
  }

  function saveCertificate(cert) {
    return commit((s) => {
      const node = cert.nodeId && s.nodes[cert.nodeId];
      if (node) cert.courseTitle = node.title;
      const existing = cert.id && s.certificates.find((c) => c.id === cert.id);
      if (existing) {
        Object.assign(existing, normalizeCertificate(Object.assign({}, existing, U.defined(cert))), { updatedAt: Date.now() });
        return existing.id;
      }
      const c = normalizeCertificate(Object.assign({}, U.defined(cert), { id: undefined }));
      s.certificates.push(c);
      log(s, { type: 'certificate', refKind: 'certificate', refId: c.id, nodeId: c.nodeId, title: c.title || c.courseTitle, provider: c.provider });
      if (node) touchAncestors(s, node.id);
      return c.id;
    });
  }

  function deleteCertificate(id) {
    commit((s) => { s.certificates = s.certificates.filter((c) => c.id !== id); }, { immediate: true });
  }

  /* ------------------------------------------------------------------ */
  /* lists (reading list, certifications, interview prep…)               */
  /* ------------------------------------------------------------------ */

  function saveList(list) {
    return commit((s) => {
      const existing = list.id && s.lists.find((l) => l.id === list.id);
      if (existing) { Object.assign(existing, list); return existing.id; }
      const l = Object.assign({ id: U.uid('l'), name: 'List', description: '', items: [], createdAt: Date.now() }, U.defined(list));
      s.lists.push(l);
      return l.id;
    });
  }

  function deleteList(id) {
    commit((s) => { s.lists = s.lists.filter((l) => l.id !== id); }, { immediate: true });
  }

  function saveListItem(listId, item) {
    commit((s) => {
      const l = s.lists.find((x) => x.id === listId);
      if (!l) return;
      const existing = item.id && l.items.find((x) => x.id === item.id);
      if (existing) { Object.assign(existing, item); return; }
      l.items.push(Object.assign({ id: U.uid('li'), title: 'Item', url: '', notes: '', status: 'todo', createdAt: Date.now(), doneAt: null }, U.defined(item)));
    });
  }

  function setListItemStatus(listId, itemId, status) {
    if (!LIST_STATUSES.includes(status)) return;
    commit((s) => {
      const l = s.lists.find((x) => x.id === listId);
      const it = l && l.items.find((x) => x.id === itemId);
      if (!it || it.status === status) return;
      it.status = status;
      it.doneAt = status === 'done' ? Date.now() : null;
      if (status === 'done') log(s, { type: 'complete', refKind: 'listItem', refId: itemId, listId, title: it.title, listName: l.name });
    });
  }

  function deleteListItem(listId, itemId) {
    commit((s) => {
      const l = s.lists.find((x) => x.id === listId);
      if (l) l.items = l.items.filter((x) => x.id !== itemId);
    });
  }

  /* ------------------------------------------------------------------ */
  /* settings, reviews, data management                                  */
  /* ------------------------------------------------------------------ */

  function updateSettings(fields, opts = {}) {
    // Changing how progress is calculated is not learning progress — don't record it as history.
    const silentProgress = 'progressMode' in fields || opts.silentProgress;
    commit((s) => { Object.assign(s.settings, fields); }, Object.assign({}, opts, { silentProgress }));
  }

  function setReview(weekKey, fields) {
    commit((s) => { s.reviews[weekKey] = Object.assign({}, s.reviews[weekKey], fields); }, { silent: true });
  }

  function exportJSON() {
    return JSON.stringify({ app: 'learning-command-center', exportedAt: new Date().toISOString(), data: state }, null, 2);
  }

  /** Validate + replace everything. Throws a translated error key on bad input. */
  function importJSON(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { throw new Error('errors.importParse'); }
    const data = parsed && parsed.data ? parsed.data : parsed;
    if (!data || typeof data !== 'object' || typeof data.nodes !== 'object' || !Array.isArray(data.rootIds)) {
      throw new Error('errors.importShape');
    }
    commit(() => { state = normalize(data); }, { immediate: true, silentProgress: true });
  }

  function resetAll(mode) {
    commit(() => {
      const keepName = state.settings.userName;
      const keepLang = state.settings.lang;
      state = normalize(mode === 'demo' ? App.Seed.create() : emptyState());
      state.settings.userName = keepName;
      state.settings.lang = keepLang;
    }, { immediate: true, silentProgress: true });
  }

  function storageInfo() {
    let bytes = 0;
    try { bytes = (window.localStorage.getItem(STORAGE_KEY) || '').length * 2; } catch (e) { /* ignore */ }
    return { persistent, bytes, error: saveError };
  }

  App.Store = {
    STATUSES, PTASK_STATUSES, PROJECT_STATUSES, PRIORITIES, NODE_TYPES, RESOURCE_TYPES, PROVIDERS, LIST_STATUSES, PARENT_TYPES, OVERALL,
    load, subscribe, snapshot, restore,
    get state() { return state; },
    get rev() { return rev; },
    descendantsOf: (id) => descendantsOf(state, id),
    ancestorsOf: (id) => ancestorsOf(state, id),
    addNode, updateNode, setNodeStatus, deleteNode, moveNode, prereqError, setPrereqs,
    addResource, removeResource, setNotes,
    addProject, updateProject, deleteProject,
    addPTask, updatePTask, setPTaskStatus, deletePTask, projectList,
    parseTemplate, saveTemplate, deleteTemplate,
    saveSkill, deleteSkill,
    parentOptions, moveNodeTo, reorder, setResources, setNodeProjects,
    addTechnology, renameTechnology, deleteTechnology,
    saveList, deleteList, saveListItem, setListItemStatus, deleteListItem,
    saveCertificate, deleteCertificate, CERT_STATUSES,
    saveSession, deleteSession, startTimer, stopTimer, cancelTimer,
    addTodayItem, removeTodayItem, toggleTodayItem, carryOverToday,
    updateSettings, setReview,
    exportJSON, importJSON, resetAll, storageInfo,
    makeNode, makePTask, emptyState, normalize,
  };
})(window.App = window.App || {});
