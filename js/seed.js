/*
 * Starter-data builder: turns the plain files in /data (window.LCC_DATA) into app state.
 * There is no content here — edit /data/*.js to change what a fresh install starts with.
 */
(function (App) {
  'use strict';
  const U = App.U;

  const NATURAL_CHILD = { path: 'track', track: 'course', course: 'lesson', module: 'lesson', lesson: 'task', task: 'task' };

  function buildRoadmap(state, data, keys) {
    function add(spec, parentType, parentId) {
      const item = typeof spec === 'string' ? { title: spec } : spec;
      const type = item.type || NATURAL_CHILD[parentType] || 'path';
      const node = App.Store.makeNode(type, parentId, {
        title: item.title || 'Untitled',
        description: item.description || '',
        status: item.status || 'not_started',
        provider: item.provider || '',
        url: item.url || '',
        estHours: item.hours || '',
        resources: (item.resources || []).map((r) => ({ id: U.uid('r'), type: r.type || 'docs', label: r.label || r.url, url: r.url })),
      });
      if (node.status === 'in_progress') node.startedAt = Date.now();
      state.nodes[node.id] = node;
      if (parentId) state.nodes[parentId].children.push(node.id); else state.rootIds.push(node.id);
      if (item.key) keys[item.key] = node.id;
      (item.children || []).forEach((c) => add(c, type, node.id));
    }
    (data.roadmap || []).forEach((spec) => add(spec, null, null));
    (data.dependencies || []).forEach(([a, b]) => { if (keys[a] && keys[b]) state.nodes[keys[a]].prereqs.push(keys[b]); });
  }

  function buildProjects(state, data, keys) {
    const now = Date.now();
    (data.projects || []).forEach((spec) => {
      const milestones = (spec.milestones || []).map((name) => ({ id: U.uid('mi'), name, targetDate: '', description: '' }));
      const groups = (spec.groups || []).map((g) => ({ id: U.uid('gr'), name: g.name }));
      const p = {
        id: U.uid('p'), name: spec.name, type: spec.type || '', description: spec.description || '',
        status: spec.status || 'planning', technologies: spec.technologies || [],
        repoUrl: spec.repoUrl || '', liveUrl: spec.liveUrl || '', docsUrl: spec.docsUrl || '',
        startDate: spec.startDate || '', targetDate: spec.targetDate || '', notes: spec.notes || '',
        groups, milestones, resources: [],
        applied: (spec.applied || []).map((a) => ({ id: U.uid('ap'), tech: a.tech, nodeId: keys[a.learning] || null, items: a.items || [] })),
        learningNodeIds: (spec.learning || []).map((k) => keys[k]).filter(Boolean),
        view: state.settings.defaultProjectView || 'checklist',
        createdAt: now, updatedAt: now, lastActivityAt: now, lastTaskId: null,
      };
      state.projects[p.id] = p;
      state.projectOrder.push(p.id);

      const byTitle = {};
      const pendingDeps = [];
      let order = 0;
      (spec.groups || []).forEach((g, gi) => {
        (g.tasks || []).forEach((raw) => {
          const tk = typeof raw === 'string' ? { title: raw } : raw;
          const ms = tk.milestone ? milestones.find((m) => m.name === tk.milestone) : null;
          const t = App.Store.makePTask(p.id, {
            title: tk.title, groupId: groups[gi].id, status: tk.status || 'not_started', priority: tk.priority || 'medium',
            milestoneId: ms ? ms.id : null, nodeId: keys[tk.learning] || null, order: order++,
          });
          state.ptasks[t.id] = t;
          byTitle[tk.title] = t.id;
          if (tk.dependsOn) pendingDeps.push([t, tk.dependsOn]);
          if (tk.current) p.lastTaskId = t.id;
        });
      });
      pendingDeps.forEach(([t, titles]) => { t.deps = titles.map((x) => byTitle[x]).filter(Boolean); });
    });
  }

  function create() {
    const data = window.LCC_DATA || {};
    const state = App.Store.emptyState();
    const keys = {};
    buildRoadmap(state, data, keys);
    buildProjects(state, data, keys);
    (data.skills || []).forEach(({ name, learning }) => {
      const id = U.uid('s');
      state.skills[id] = { id, name, description: '', nodeIds: (learning || []).map((k) => keys[k]).filter(Boolean), createdAt: Date.now() };
      state.skillOrder.push(id);
    });
    state.technologies = U.unique([...(data.technologies || []), ...Object.values(state.projects).flatMap((p) => p.technologies)]);
    (data.templates || []).forEach((tpl) => state.templates.push({ id: U.uid('tpl'), name: tpl.name, text: tpl.text }));
    (data.lists || []).forEach((l) => {
      state.lists.push({
        id: U.uid('l'), name: l.name, description: l.description || '', createdAt: Date.now(),
        items: (l.items || []).map((it) => Object.assign({ id: U.uid('li'), url: '', notes: '', status: 'todo', createdAt: Date.now(), doneAt: null }, it)),
      });
    });
    state.position = data.startAt && keys[data.startAt] ? { nodeId: keys[data.startAt], ts: Date.now() } : null;
    state.projectOrder.forEach((pid) => {
      state.activity.push({ id: U.uid('act'), ts: Date.now(), type: 'project_created', refKind: 'project', refId: pid, projectId: pid, title: state.projects[pid].name });
    });
    state.activity.push({ id: U.uid('act'), ts: Date.now(), type: 'init', refKind: 'system', title: 'Roadmap created' });
    return state;
  }

  App.Seed = { create };
})(window.App = window.App || {});
