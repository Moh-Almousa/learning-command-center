/* Tasks: every learning task and project task in one filterable list. */
(function (App) {
  'use strict';
  const U = App.U, UI = App.UI, M = App.Model, Store = App.Store;
  const t = (...a) => App.i18n.t(...a);
  const S = () => Store.state;

  const f = { source: 'all', status: new Set(['not_started', 'in_progress']), priority: '', project: '', q: '', sort: 'order' };
  const PRIO = { critical: 0, high: 1, medium: 2, low: 3 };

  function collect() {
    const s = S();
    const out = [];
    if (f.source !== 'projects') {
      M.order().forEach((id, i) => {
        const n = s.nodes[id];
        if (n.type !== 'task') return;
        const lesson = M.closest(id, 'lesson');
        const course = M.closest(id, 'course');
        out.push({
          kind: 'node', id, title: n.title, status: n.status, priority: '', due: n.targetDate || '', order: i,
          context: [course && course.title, lesson && lesson.title].filter(Boolean).join(' › '), notes: n.notes,
          locked: M.info(id).locked || M.info(id).blocked,
        });
      });
    }
    if (f.source !== 'learning') {
      s.projectOrder.forEach((pid, pi) => {
        const p = s.projects[pid];
        M.projectTasks(pid).forEach((x, i) => {
          const g = p.groups.find((gr) => gr.id === x.groupId);
          out.push({
            kind: 'ptask', id: x.id, title: x.title, status: x.status, priority: x.priority, due: x.dueDate || '',
            order: 100000 + pi * 1000 + i, context: [p.name, g && g.name].filter(Boolean).join(' › '), projectId: pid,
            notes: x.notes, locked: M.ptaskBlocked(x),
          });
        });
      });
    }
    return out.filter((r) => {
      if (f.status.size && !f.status.has(r.status)) return false;
      if (f.priority && r.priority !== f.priority) return false;
      if (f.project && r.projectId !== f.project) return false;
      if (f.q && !U.matches(r.title + ' ' + r.context + ' ' + r.notes, f.q)) return false;
      return true;
    }).sort((a, b) => {
      if (f.sort === 'due') return (a.due || '9999') .localeCompare(b.due || '9999') || a.order - b.order;
      if (f.sort === 'priority') return (PRIO[a.priority] ?? 4) - (PRIO[b.priority] ?? 4) || a.order - b.order;
      return a.order - b.order;
    });
  }

  function row(r) {
    const today = U.dayKey();
    const overdue = r.due && r.due < today && r.status !== 'completed';
    const toggle = r.kind === 'node' ? UI.statusToggle('node-toggle', r.id, r.status, r.title) : UI.statusToggle('ptask-toggle', r.id, r.status, r.title);
    const title = r.kind === 'node'
      ? `<button class="link-btn" data-action="open-node" data-id="${r.id}">${U.esc(r.title)}</button>`
      : `<button class="link-btn" data-action="ptask-edit" data-id="${r.id}">${U.esc(r.title)}</button>`;
    return `<li class="task-row st-${r.status}">
      ${toggle}
      <div class="task-main">${title}<span class="muted small">${r.kind === 'node' ? UI.icon('book') : UI.icon('folder')} ${U.esc(r.context)}</span></div>
      ${r.locked ? `<span title="${U.esc(t('tasks.waiting'))}">${UI.icon('lock', 'muted')}</span>` : ''}
      ${r.priority ? UI.priorityBadge(r.priority) : ''}
      ${r.due ? `<span class="due ${overdue ? 'overdue' : ''} mono small">${U.esc(U.fmtDate(r.due, { day: 'numeric', month: 'short' }))}</span>` : '<span class="due"></span>'}
      <span class="row-actions">
        ${r.status === 'not_started' ? UI.iconBtn('play', r.kind === 'node' ? 'node-status' : 'ptask-status', t('actions.start'), { id: r.id, value: 'in_progress' }, 'sm') : ''}
        ${UI.iconBtn('plus', r.kind === 'node' ? 'today-add-node' : 'today-add-ptask', t('today.add'), { id: r.id }, 'sm')}
        ${UI.iconBtn('edit', r.kind === 'node' ? 'node-edit' : 'ptask-edit', t('common.edit'), { id: r.id }, 'sm')}
        ${UI.iconBtn('trash', r.kind === 'node' ? 'node-delete' : 'ptask-delete', t('common.delete'), { id: r.id }, 'sm danger')}
      </span>
    </li>`;
  }

  function chip(action, value, label, active) {
    return `<button class="chip-btn ${active ? 'active' : ''}" data-action="${action}" data-value="${value}" aria-pressed="${active}">${U.esc(label)}</button>`;
  }

  function render(el) {
    const s = S();
    const rows = collect();
    el.innerHTML = `<header class="page-head">
        <div><h1>${U.esc(t('nav.tasks'))}</h1><p class="muted">${U.esc(t('tasks.subtitle', { n: rows.length }))}</p></div>
        <div class="btn-row">
          ${UI.btn(t('tasks.addLearning'), 'node-add', { cls: '', icon: 'plus', data: { type: 'task', open: 'no' } })}
          ${UI.btn(t('tasks.addProject'), 'ptask-add', { cls: 'primary', icon: 'plus' })}
        </div>
      </header>
      <div class="filter-bar" role="group" aria-label="${U.esc(t('filters.label'))}">
        <div class="segment" role="group" aria-label="${U.esc(t('tasks.source'))}">
          ${['all', 'learning', 'projects'].map((v) => `<button class="seg-btn ${f.source === v ? 'active' : ''}" data-action="tasks-source" data-value="${v}" aria-pressed="${f.source === v}"><span>${U.esc(t('tasks.src_' + v))}</span></button>`).join('')}
        </div>
        <div class="chips">
          ${chip('tasks-status', '', t('filters.all'), !f.status.size)}
          ${Store.STATUSES.map((st) => chip('tasks-status', st, t('status.' + st), f.status.has(st))).join('')}
        </div>
        <select data-change="tasks-priority" aria-label="${U.esc(t('field.priority'))}">
          <option value="">${U.esc(t('filters.anyPriority'))}</option>
          ${Store.PRIORITIES.map((p) => `<option value="${p}" ${f.priority === p ? 'selected' : ''}>${U.esc(t('priority.' + p))}</option>`).join('')}
        </select>
        <select data-change="tasks-project" aria-label="${U.esc(t('field.project'))}">
          <option value="">${U.esc(t('filters.allProjects'))}</option>
          ${s.projectOrder.map((id) => `<option value="${id}" ${f.project === id ? 'selected' : ''}>${U.esc(s.projects[id].name)}</option>`).join('')}
        </select>
        <select data-change="tasks-sort" aria-label="${U.esc(t('filters.sort'))}">
          ${['order', 'due', 'priority'].map((v) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${U.esc(t('filters.sort_' + v))}</option>`).join('')}
        </select>
        <input type="search" id="tasks-q" placeholder="${U.esc(t('common.filter'))}" aria-label="${U.esc(t('common.filter'))}" value="${U.esc(f.q)}">
      </div>
      ${rows.length ? `<ul class="task-list card">${rows.map(row).join('')}</ul>` : UI.empty(t('filters.noMatch'))}`;
    const q = document.getElementById('tasks-q');
    q.addEventListener('input', U.debounce(() => { f.q = q.value.trim(); App.rerender(); }, 200));
  }

  UI.registerActions({
    'tasks-source': (el) => { f.source = el.dataset.value; App.rerender(); },
    'tasks-status': (el) => {
      const v = el.dataset.value;
      if (!v) f.status.clear(); else if (f.status.has(v)) f.status.delete(v); else f.status.add(v);
      App.rerender();
    },
    'tasks-priority': (el) => { f.priority = el.value; App.rerender(); },
    'tasks-project': (el) => { f.project = el.value; App.rerender(); },
    'tasks-sort': (el) => { f.sort = el.value; App.rerender(); },
    'ptask-add': () => App.Projects.taskForm(f.project || S().projectOrder[0] || null, null),
  });

  App.Pages.tasks = { render, title: () => t('nav.tasks'), nav: { icon: 'tasks', order: 40 } };
})(window.App = window.App || {});
