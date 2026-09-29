/* Projects: project library + a per-project Control Center (tasks, milestones, applied learning, notes, activity, stats). */
(function (App) {
  'use strict';
  const U = App.U, UI = App.UI, M = App.Model, Store = App.Store;
  const t = (...a) => App.i18n.t(...a);
  const S = () => Store.state;

  const TABS = ['overview', 'tasks', 'milestones', 'applied', 'learning', 'notes', 'activity', 'stats'];
  const listFilter = { scope: 'active', status: '', tech: '', progress: '', q: '' };
  const taskFilter = { status: '', priority: '', q: '' };
  let activityMode = 'timeline';

  /* ------------------------------------------------------------------ */
  /* forms                                                               */
  /* ------------------------------------------------------------------ */

  function techList(v) { return U.unique(String(v || '').split(',').map((x) => x.trim()).filter(Boolean)); }

  function knownTech() {
    const s = S();
    return U.unique([...s.technologies, ...Object.values(s.projects).flatMap((p) => p.technologies), ...Object.values(s.skills).map((k) => k.name)]).sort();
  }

  function urlCheck(v) {
    const bad = ['repoUrl', 'liveUrl', 'docsUrl'].find((k) => v[k] && !U.isUrl(v[k]));
    return bad ? t('errors.url') : null;
  }

  async function projectForm(pid) {
    const s = S();
    const p = pid ? s.projects[pid] : null;
    const fields = [
      { name: 'name', label: t('field.projectName'), required: true, full: true },
      { name: 'description', label: t('field.description'), type: 'textarea', rows: 2, full: true },
      { name: 'type', label: t('field.projectType'), list: ['Django REST API', 'Web app', 'CLI tool', 'Library', 'Mobile backend'], placeholder: 'Django REST API' },
      { name: 'status', label: t('field.status'), type: 'select', options: UI.enumOptions(Store.PROJECT_STATUSES, 'pstatus') },
      { name: 'technologies', label: t('field.technologies'), full: true, help: t('help.technologies'), placeholder: 'Python, Django, DRF, PostgreSQL' },
      { name: 'repoUrl', label: t('field.repoUrl'), type: 'url', placeholder: 'https://github.com/…' },
      { name: 'liveUrl', label: t('field.liveUrl'), type: 'url', placeholder: 'https://' },
      { name: 'docsUrl', label: t('field.docsUrl'), type: 'url', placeholder: 'https://' },
      { name: 'startDate', label: t('field.startDate'), type: 'date' },
      { name: 'targetDate', label: t('field.targetDate'), type: 'date' },
      { name: 'notes', label: t('field.notes'), type: 'textarea', rows: 2, full: true },
    ];
    if (!p) {
      fields.push({ name: 'template', label: t('projects.template'), type: 'select', full: true, options: [{ value: '', label: t('projects.noTemplate') }, ...s.templates.map((x) => ({ value: x.id, label: x.name }))] });
      fields.push({ name: 'templateText', label: t('projects.templateEdit'), type: 'textarea', rows: 8, full: true, help: t('help.template') });
    }
    const values = p ? Object.assign({}, p, { technologies: p.technologies.join(', ') }) : { status: 'planning', startDate: U.dayKey() };
    const pending = UI.form({ title: p ? t('projects.editProject') : t('projects.newProject'), fields, values, validate: urlCheck, submitLabel: p ? t('common.save') : t('projects.create'), wide: true });
    const sel = document.getElementById('f_template');
    if (sel) {
      sel.addEventListener('change', () => {
        const tpl = s.templates.find((x) => x.id === sel.value);
        document.getElementById('f_templateText').value = tpl ? tpl.text : '';
      });
    }
    const v = await pending;
    if (!v) return null;
    const data = {
      name: v.name, description: v.description, type: v.type, status: v.status, technologies: techList(v.technologies),
      repoUrl: v.repoUrl, liveUrl: v.liveUrl, docsUrl: v.docsUrl, startDate: v.startDate, targetDate: v.targetDate, notes: v.notes,
    };
    if (p) { Store.updateProject(pid, data); UI.toast(t('toast.saved')); return pid; }
    const id = Store.addProject(data, v.templateText);
    UI.toast(t('toast.added', { name: v.name }));
    return id;
  }

  async function chooseProject() {
    const s = S();
    if (!s.projectOrder.length) { UI.toast(t('projects.needProject')); return null; }
    if (s.projectOrder.length === 1) return s.projectOrder[0];
    const v = await UI.form({
      title: t('tasks.addProject'),
      fields: [{ name: 'pid', label: t('field.project'), type: 'select', options: s.projectOrder.map((id) => ({ value: id, label: s.projects[id].name })), full: true }],
      submitLabel: t('common.next'),
    });
    return v ? v.pid : null;
  }

  async function taskForm(pid, taskId, preset = {}) {
    const s = S();
    const task = taskId ? s.ptasks[taskId] : null;
    if (!pid && task) pid = task.projectId;
    if (!pid || !s.projects[pid]) pid = await chooseProject();
    if (!pid) return;
    const p = s.projects[pid];
    const others = M.projectTasks(pid).filter((x) => !task || x.id !== task.id);
    const nodeOpts = [{ value: '', label: '—' }, ...M.order().filter((id) => ['track', 'course', 'module', 'lesson', 'task'].includes(s.nodes[id].type))
      .map((id) => ({ value: id, label: `${'· '.repeat(Math.max(0, M.info(id).depth - 1))}${s.nodes[id].title}` }))];
    const v = await UI.form({
      title: task ? t('projects.editTask') : t('projects.addTaskTo', { name: p.name }),
      wide: true,
      fields: [
        { name: 'title', label: t('field.title'), required: true, full: true },
        { name: 'description', label: t('field.description'), type: 'textarea', rows: 2, full: true },
        { name: 'groupId', label: t('field.group'), type: 'select', options: [{ value: '', label: t('projects.ungrouped') }, ...p.groups.map((g) => ({ value: g.id, label: g.name }))] },
        { name: 'newGroup', label: t('field.newGroup'), placeholder: t('projects.newGroupPh') },
        { name: 'status', label: t('field.status'), type: 'select', options: UI.enumOptions(Store.PTASK_STATUSES, 'status') },
        { name: 'priority', label: t('field.priority'), type: 'select', options: UI.enumOptions(Store.PRIORITIES, 'priority') },
        { name: 'dueDate', label: t('field.dueDate'), type: 'date' },
        { name: 'milestoneId', label: t('field.milestone'), type: 'select', options: [{ value: '', label: '—' }, ...p.milestones.map((m) => ({ value: m.id, label: m.name }))] },
        { name: 'nodeId', label: t('field.learningLink'), type: 'select', options: nodeOpts, full: true, help: t('help.learningLink') },
        { name: 'deps', label: t('field.dependsOn'), type: 'checklist', full: true, options: others.map((x) => ({ value: x.id, label: x.title, hint: t('status.' + x.status) })) },
        { name: 'notes', label: t('field.notes'), type: 'textarea', rows: 3, full: true },
      ],
      values: Object.assign({ status: 'not_started', priority: 'medium', groupId: '', milestoneId: '', nodeId: '', deps: [] }, task || {}, preset),
    });
    if (!v) return;
    let groupId = v.groupId || null;
    if (v.newGroup) {
      Store.projectList(pid, 'groups', 'add', { name: v.newGroup });
      const g = S().projects[pid].groups[S().projects[pid].groups.length - 1];
      groupId = g.id;
    }
    const data = {
      title: v.title, description: v.description, groupId, priority: v.priority, dueDate: v.dueDate,
      milestoneId: v.milestoneId || null, nodeId: v.nodeId || null, deps: v.deps, notes: v.notes,
    };
    if (task) {
      Store.updatePTask(taskId, data);
      if (v.status !== task.status) Store.setPTaskStatus(taskId, v.status);
      UI.toast(t('toast.saved'));
    } else {
      const id = Store.addPTask(pid, Object.assign(data, { order: Date.now() }));
      if (v.status !== 'not_started') Store.setPTaskStatus(id, v.status);
      UI.toast(t('toast.added', { name: v.title }));
    }
  }

  async function groupForm(pid, gid) {
    const p = S().projects[pid];
    const g = gid ? p.groups.find((x) => x.id === gid) : null;
    const v = await UI.form({ title: g ? t('projects.renameGroup') : t('projects.addGroup'), fields: [{ name: 'name', label: t('field.name'), required: true, full: true }], values: g || {} });
    if (!v) return;
    Store.projectList(pid, 'groups', g ? 'update' : 'add', g ? { id: gid, name: v.name } : { name: v.name });
  }

  async function milestoneForm(pid, mid) {
    const p = S().projects[pid];
    const m = mid ? p.milestones.find((x) => x.id === mid) : null;
    const tasks = M.projectTasks(pid);
    const v = await UI.form({
      title: m ? t('projects.editMilestone') : t('projects.addMilestone'),
      wide: true,
      fields: [
        { name: 'name', label: t('field.name'), required: true, full: true },
        { name: 'targetDate', label: t('field.targetDate'), type: 'date' },
        { name: 'description', label: t('field.description'), type: 'textarea', rows: 2, full: true },
        { name: 'tasks', label: t('projects.milestoneTasks'), type: 'checklist', full: true, options: tasks.map((x) => ({ value: x.id, label: x.title, hint: (p.groups.find((g) => g.id === x.groupId) || {}).name || '' })) },
      ],
      values: Object.assign({}, m || {}, { tasks: m ? tasks.filter((x) => x.milestoneId === m.id).map((x) => x.id) : [] }),
    });
    if (!v) return;
    let id = mid;
    if (m) Store.projectList(pid, 'milestones', 'update', { id: mid, name: v.name, targetDate: v.targetDate, description: v.description });
    else {
      Store.projectList(pid, 'milestones', 'add', { name: v.name, targetDate: v.targetDate, description: v.description });
      const list = S().projects[pid].milestones;
      id = list[list.length - 1].id;
    }
    const chosen = new Set(v.tasks);
    tasks.forEach((x) => {
      if (chosen.has(x.id) && x.milestoneId !== id) Store.updatePTask(x.id, { milestoneId: id });
      if (!chosen.has(x.id) && x.milestoneId === id) Store.updatePTask(x.id, { milestoneId: null });
    });
  }

  async function appliedForm(pid, aid) {
    const s = S();
    const p = s.projects[pid];
    const a = aid ? p.applied.find((x) => x.id === aid) : null;
    const nodeOpts = [{ value: '', label: '—' }, ...M.order().filter((id) => ['track', 'course', 'module', 'lesson'].includes(s.nodes[id].type))
      .map((id) => ({ value: id, label: `${'· '.repeat(Math.max(0, M.info(id).depth - 1))}${s.nodes[id].title}` }))];
    const v = await UI.form({
      title: a ? t('projects.editApplied') : t('projects.addApplied'),
      wide: true,
      fields: [
        { name: 'tech', label: t('field.technology'), required: true, list: U.unique([...p.technologies, ...knownTech()]), placeholder: 'Django' },
        { name: 'nodeId', label: t('field.learningLink'), type: 'select', options: nodeOpts },
        { name: 'items', label: t('projects.appliedItems'), type: 'textarea', rows: 6, full: true, help: t('help.onePerLine'), placeholder: 'Custom User Model\nPermissions\nTransactions' },
      ],
      values: a ? Object.assign({}, a, { items: (a.items || []).join('\n') }) : {},
    });
    if (!v) return;
    const payload = { tech: v.tech, nodeId: v.nodeId || null, items: v.items.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) };
    Store.projectList(pid, 'applied', a ? 'update' : 'add', a ? Object.assign({ id: aid }, payload) : payload);
    if (!p.technologies.some((x) => U.norm(x) === U.norm(v.tech))) Store.updateProject(pid, { technologies: [...p.technologies, v.tech] });
  }

  async function linkLearningForm(pid) {
    const p = S().projects[pid];
    const v = await UI.form({
      title: t('projects.linkLearning'),
      intro: t('projects.linkLearningIntro'),
      wide: true,
      fields: [{ name: 'ids', label: t('projects.learningTopics'), type: 'checklist', full: true, options: UI.nodeOptions(['track', 'course', 'module', 'lesson']) }],
      values: { ids: p.learningNodeIds },
    });
    if (v) Store.updateProject(pid, { learningNodeIds: v.ids });
  }

  async function templateForm(id) {
    const tpl = id ? S().templates.find((x) => x.id === id) : null;
    const v = await UI.form({
      title: tpl ? t('projects.editTemplate') : t('projects.newTemplate'),
      wide: true,
      fields: [
        { name: 'name', label: t('field.name'), required: true, full: true },
        { name: 'text', label: t('projects.templateEdit'), type: 'textarea', rows: 14, full: true, help: t('help.template') },
      ],
      values: tpl || { text: 'Planning\n- Write requirements\n' },
    });
    if (v) Store.saveTemplate(Object.assign({ id: tpl ? tpl.id : undefined }, v));
  }

  /* ------------------------------------------------------------------ */
  /* list page                                                           */
  /* ------------------------------------------------------------------ */

  function projectCard(p) {
    const st = M.projectStats(p.id);
    return `<article class="card project-card ps-${p.status}">
      <div class="cc-top">${UI.projectStatusBadge(p.status)}<span class="muted small">${U.esc(t('projects.lastActivity'))}: ${U.esc(U.relDay(p.lastActivityAt || p.updatedAt))}</span></div>
      <h2 class="cc-title"><a href="#/projects/${p.id}">${U.esc(p.name)}</a></h2>
      <p class="muted small clamp-2">${U.esc(p.description)}</p>
      <div class="chips tech">${p.technologies.map((x) => `<span class="chip">${U.esc(x)}</span>`).join('')}</div>
      ${UI.progress(st.pct, { size: 'sm', label: t('projects.tasksDone', { done: st.done, total: st.total }) })}
      <p class="small cur-task">${st.current ? `${UI.icon('play')} <span class="muted">${U.esc(t('projects.currentTask'))}:</span> ${U.esc(st.current.title)}`
        : st.next ? `${UI.icon('arrow')} <span class="muted">${U.esc(t('projects.nextTask'))}:</span> ${U.esc(st.next.title)}` : `<span class="muted">${U.esc(t('projects.noOpenTasks'))}</span>`}</p>
    </article>`;
  }

  function renderList(el) {
    const s = S();
    const all = s.projectOrder.map((id) => s.projects[id]);
    const techs = U.unique(all.flatMap((p) => p.technologies)).sort((a, b) => a.localeCompare(b));
    const q = U.norm(listFilter.q);
    const list = all.filter((p) => {
      if (listFilter.scope === 'active' && p.status === 'archived') return false;
      if (listFilter.scope === 'archived' && p.status !== 'archived') return false;
      if (listFilter.status && p.status !== listFilter.status) return false;
      if (listFilter.tech && !p.technologies.some((x) => U.norm(x) === U.norm(listFilter.tech))) return false;
      const pct = M.projectStats(p.id).pct;
      if (listFilter.progress === 'low' && pct >= 50) return false;
      if (listFilter.progress === 'high' && (pct < 50 || pct === 100)) return false;
      if (listFilter.progress === 'done' && pct !== 100) return false;
      if (q && !(U.norm(p.name + ' ' + p.description + ' ' + p.technologies.join(' ') + ' ' + p.notes).includes(q))) return false;
      return true;
    });
    const taskHits = q ? Object.values(s.ptasks).filter((x) => U.norm(x.title + ' ' + x.description + ' ' + x.notes).includes(q)) : [];
    const learnHits = q ? M.order().filter((id) => U.norm(s.nodes[id].title).includes(q) && ['track', 'course', 'module'].includes(s.nodes[id].type)).slice(0, 8) : [];

    el.innerHTML = `<header class="page-head">
        <div><h1>${U.esc(t('nav.projects'))}</h1><p class="muted">${U.esc(t('projects.subtitle'))}</p></div>
        <div class="btn-row">${UI.btn(t('projects.newProject'), 'project-new', { cls: 'primary', icon: 'plus' })}</div>
      </header>
      <div class="filter-bar" role="group" aria-label="${U.esc(t('filters.label'))}">
        <div class="segment" role="group" aria-label="${U.esc(t('projects.scope'))}">
          ${['active', 'archived', 'all'].map((v) => `<button class="seg-btn ${listFilter.scope === v ? 'active' : ''}" data-action="proj-scope" data-value="${v}" aria-pressed="${listFilter.scope === v}"><span>${U.esc(t('projects.scope_' + v))}</span></button>`).join('')}
        </div>
        <select data-change="proj-status" aria-label="${U.esc(t('field.status'))}">
          <option value="">${U.esc(t('filters.allStatuses'))}</option>
          ${Store.PROJECT_STATUSES.map((x) => `<option value="${x}" ${listFilter.status === x ? 'selected' : ''}>${U.esc(t('pstatus.' + x))}</option>`).join('')}
        </select>
        <select data-change="proj-tech" aria-label="${U.esc(t('field.technology'))}">
          <option value="">${U.esc(t('filters.allTech'))}</option>
          ${techs.map((x) => `<option value="${U.esc(x)}" ${listFilter.tech === x ? 'selected' : ''}>${U.esc(x)}</option>`).join('')}
        </select>
        <select data-change="proj-progress" aria-label="${U.esc(t('common.progress'))}">
          ${['', 'low', 'high', 'done'].map((x) => `<option value="${x}" ${listFilter.progress === x ? 'selected' : ''}>${U.esc(t('projects.progress_' + (x || 'any')))}</option>`).join('')}
        </select>
        <input type="search" id="proj-q" placeholder="${U.esc(t('projects.searchPh'))}" aria-label="${U.esc(t('projects.searchPh'))}" value="${U.esc(listFilter.q)}">
      </div>
      ${list.length ? `<div class="course-grid">${list.map(projectCard).join('')}</div>` : UI.empty(all.length ? t('filters.noMatch') : t('projects.empty'), all.length ? '' : UI.btn(t('projects.newProject'), 'project-new', { cls: 'primary', icon: 'plus' }))}
      ${q && (taskHits.length || learnHits.length) ? `<section class="card mt"><h2>${U.esc(t('projects.searchResults', { q: listFilter.q }))}</h2>
        ${learnHits.length ? `<h3 class="mini-h">${U.esc(t('projects.learning'))}</h3><ul class="mini-list">${learnHits.map((id) => `<li>${UI.icon('book')}<button class="link-btn" data-action="open-node" data-id="${id}">${U.esc(s.nodes[id].title)}</button></li>`).join('')}</ul>` : ''}
        ${taskHits.length ? `<h3 class="mini-h">${U.esc(t('projects.tasks'))}</h3><ul class="child-list">${taskHits.map((x) => `<li class="child-row ${x.status}">${UI.statusToggle('ptask-toggle', x.id, x.status, x.title)}<button class="link-btn" data-action="ptask-edit" data-id="${x.id}">${U.esc(x.title)}</button><a class="muted small" href="#/projects/${x.projectId}?tab=tasks">${U.esc(s.projects[x.projectId].name)}</a></li>`).join('')}</ul>` : ''}
      </section>` : ''}
      <section class="card mt" aria-labelledby="tpl-h">
        <div class="section-head"><h2 id="tpl-h">${U.esc(t('projects.templates'))}</h2>${UI.btn(t('projects.newTemplate'), 'template-new', { cls: 'sm ghost', icon: 'plus' })}</div>
        <p class="muted small">${U.esc(t('projects.templatesIntro'))}</p>
        ${s.templates.length ? `<ul class="mini-list">${s.templates.map((x) => {
          const groups = Store.parseTemplate(x.text);
          return `<li>${UI.icon('tree')}<span class="fg">${U.esc(x.name)}</span><span class="muted small">${U.esc(t('projects.templateSummary', { g: groups.length, t: groups.reduce((a, g) => a + g.tasks.length, 0) }))}</span>
            ${UI.iconBtn('edit', 'template-edit', t('common.edit'), { id: x.id }, 'sm')}${UI.iconBtn('trash', 'template-delete', t('common.delete'), { id: x.id }, 'sm danger')}</li>`;
        }).join('')}</ul>` : `<p class="muted small">${U.esc(t('projects.noTemplates'))}</p>`}
      </section>`;
    const qi = document.getElementById('proj-q');
    qi.addEventListener('input', U.debounce(() => { listFilter.q = qi.value.trim(); App.rerender(); }, 200));
  }

  /* ------------------------------------------------------------------ */
  /* workspace                                                           */
  /* ------------------------------------------------------------------ */

  function taskRow(x, p, movable) {
    const s = S();
    const blocked = M.ptaskBlocked(x);
    const ms = x.milestoneId && p.milestones.find((m) => m.id === x.milestoneId);
    const node = x.nodeId && s.nodes[x.nodeId];
    const overdue = x.dueDate && x.dueDate < U.dayKey() && x.status !== 'completed';
    return `<li class="pt-row st-${x.status} ${blocked ? 'blocked' : ''}">
      ${UI.statusToggle('ptask-toggle', x.id, x.status, x.title)}
      <div class="pt-main">
        <button class="link-btn pt-title" data-action="ptask-edit" data-id="${x.id}">${U.esc(x.title)}</button>
        <span class="pt-meta">
          ${x.status === 'in_progress' ? `<span class="badge st-in_progress">${UI.icon('half')}${U.esc(t('status.in_progress'))}</span>` : ''}
          ${UI.priorityBadge(x.priority)}
          ${ms ? `<span class="chip sm">${UI.icon('flag')}${U.esc(ms.name)}</span>` : ''}
          ${node ? `<button class="chip sm link" data-action="open-node" data-id="${node.id}" title="${U.esc(t('field.learningLink'))}">${UI.icon('book')}${U.esc(node.title)}</button>` : ''}
          ${x.dueDate ? `<span class="due mono ${overdue ? 'overdue' : ''}">${U.esc(U.fmtDate(x.dueDate, { day: 'numeric', month: 'short' }))}</span>` : ''}
          ${blocked ? `<span class="muted small" title="${U.esc(t('projects.waitingOn'))}">${UI.icon('lock')} ${U.esc(x.deps.map((d) => s.ptasks[d]).filter((d) => d && d.status !== 'completed').map((d) => d.title).join(', '))}</span>` : ''}
          ${x.notes ? `<span title="${U.esc(t('detail.notes'))}">${UI.icon('note', 'muted')}</span>` : ''}
        </span>
      </div>
      <span class="row-actions">
        ${x.status === 'not_started' ? UI.iconBtn('play', 'ptask-status', t('actions.start'), { id: x.id, value: 'in_progress' }, 'sm') : ''}
        ${x.status === 'completed' ? UI.iconBtn('reset', 'ptask-status', t('projects.reopen'), { id: x.id, value: 'not_started' }, 'sm') : ''}
        ${UI.iconBtn('plus', 'today-add-ptask', t('today.add'), { id: x.id }, 'sm')}
        ${movable ? UI.iconBtn('up', 'reorder', t('actions.moveUp'), { kind: 'ptask', id: x.id, value: -1 }, 'sm') + UI.iconBtn('down', 'reorder', t('actions.moveDown'), { kind: 'ptask', id: x.id, value: 1 }, 'sm') : ''}
        ${UI.iconBtn('edit', 'ptask-edit', t('common.edit'), { id: x.id }, 'sm')}
        ${UI.iconBtn('trash', 'ptask-delete', t('common.delete'), { id: x.id }, 'sm danger')}
      </span>
    </li>`;
  }

  function filteredTasks(pid) {
    return M.projectTasks(pid).filter((x) => {
      if (taskFilter.status && x.status !== taskFilter.status) return false;
      if (taskFilter.priority && x.priority !== taskFilter.priority) return false;
      if (taskFilter.q && !U.matches(x.title + ' ' + x.description + ' ' + x.notes, taskFilter.q)) return false;
      return true;
    });
  }

  function tabTasks(p) {
    const tasks = filteredTasks(p.id);
    const all = M.projectTasks(p.id);
    const toolbar = `<div class="filter-bar">
      <div class="segment" role="group" aria-label="${U.esc(t('projects.view'))}">
        <button class="seg-btn ${p.view === 'checklist' ? 'active' : ''}" data-action="proj-view" data-id="${p.id}" data-value="checklist" aria-pressed="${p.view === 'checklist'}">${UI.icon('list')}<span>${U.esc(t('projects.checklist'))}</span></button>
        <button class="seg-btn ${p.view === 'kanban' ? 'active' : ''}" data-action="proj-view" data-id="${p.id}" data-value="kanban" aria-pressed="${p.view === 'kanban'}">${UI.icon('kanban')}<span>${U.esc(t('projects.kanban'))}</span></button>
      </div>
      <select data-change="ptf-status" aria-label="${U.esc(t('field.status'))}"><option value="">${U.esc(t('filters.allStatuses'))}</option>${Store.PTASK_STATUSES.map((x) => `<option value="${x}" ${taskFilter.status === x ? 'selected' : ''}>${U.esc(t('status.' + x))}</option>`).join('')}</select>
      <select data-change="ptf-priority" aria-label="${U.esc(t('field.priority'))}"><option value="">${U.esc(t('filters.anyPriority'))}</option>${Store.PRIORITIES.map((x) => `<option value="${x}" ${taskFilter.priority === x ? 'selected' : ''}>${U.esc(t('priority.' + x))}</option>`).join('')}</select>
      <input type="search" id="ptf-q" placeholder="${U.esc(t('common.filter'))}" aria-label="${U.esc(t('common.filter'))}" value="${U.esc(taskFilter.q)}">
      ${p.view === 'checklist' ? `<label class="inline-field">${U.esc(t('settings.taskGrouping'))}
        <select id="ptf-grouping" data-change="set-setting" data-key="taskGrouping">${['group', 'milestone', 'priority', 'status'].map((x) => `<option value="${x}" ${S().settings.taskGrouping === x ? 'selected' : ''}>${U.esc(t('settings.group_' + x))}</option>`).join('')}</select></label>` : ''}
      <div class="btn-row push">
        ${UI.btn(t('projects.addGroup'), 'group-add', { cls: 'sm ghost', icon: 'plus', data: { id: p.id } })}
        ${UI.btn(t('projects.addTask'), 'ptask-new', { cls: 'sm primary', icon: 'plus', data: { id: p.id } })}
      </div>
    </div>`;
    if (!all.length) return toolbar + UI.empty(t('projects.noTasks'));

    if (p.view === 'kanban') {
      return toolbar + `<p class="muted small">${U.esc(t('projects.kanbanHint'))}</p><div class="kanban">${Store.PTASK_STATUSES.map((st) => {
        const col = tasks.filter((x) => x.status === st);
        return `<section class="kb-col" data-drop="${st}" aria-labelledby="kb-${st}">
          <h3 id="kb-${st}">${UI.icon(UI.STATUS_ICON[st])} ${U.esc(t('status.' + st))} <span class="mono muted">${col.length}</span></h3>
          <ul class="kb-list">${col.map((x) => {
            const g = p.groups.find((gr) => gr.id === x.groupId);
            return `<li class="kb-card st-${x.status}" draggable="true" data-drag="${x.id}">
              <div class="kb-top">${g ? `<span class="muted small">${U.esc(g.name)}</span>` : '<span></span>'}${UI.priorityBadge(x.priority)}</div>
              <button class="link-btn kb-title" data-action="ptask-edit" data-id="${x.id}">${U.esc(x.title)}</button>
              <label class="kb-move"><span class="sr-only">${U.esc(t('projects.moveTo'))}</span>
                <select data-change="ptask-status-select" data-id="${x.id}" aria-label="${U.esc(t('projects.moveTo'))}: ${U.esc(x.title)}">
                  ${Store.PTASK_STATUSES.map((o) => `<option value="${o}" ${o === x.status ? 'selected' : ''}>${U.esc(t('status.' + o))}</option>`).join('')}
                </select>
              </label>
            </li>`;
          }).join('')}</ul>
        </section>`;
      }).join('')}</div>`;
    }

    // Sections follow Settings → Projects → Task grouping (group / milestone / priority / status).
    const mode = S().settings.taskGrouping || 'group';
    let sections;
    if (mode === 'milestone') {
      sections = [...p.milestones.map((m) => ({ id: m.id, name: m.name, match: (x) => x.milestoneId === m.id })), { id: null, name: t('projects.noMilestone'), match: (x) => !x.milestoneId }];
    } else if (mode === 'priority') {
      sections = Store.PRIORITIES.slice().reverse().map((pr) => ({ id: pr, name: t('priority.' + pr), match: (x) => x.priority === pr }));
    } else if (mode === 'status') {
      sections = Store.PTASK_STATUSES.map((st) => ({ id: st, name: t('status.' + st), match: (x) => x.status === st }));
    } else {
      sections = [...p.groups.map((g, i) => ({ id: g.id, name: g.name, group: true, first: i === 0, last: i === p.groups.length - 1, match: (x) => x.groupId === g.id })),
        { id: null, name: t('projects.ungrouped'), match: (x) => !x.groupId }];
    }
    return toolbar + `<div class="checklist-sheet">${sections.map((g) => {
      const gt = tasks.filter(g.match);
      const allG = all.filter(g.match);
      if (!allG.length && (g.id === null || mode === 'priority' || mode === 'status')) return '';
      const done = allG.filter((x) => x.status === 'completed').length;
      const hid = 'g-' + (g.id || 'none');
      return `<section class="sheet-group" aria-labelledby="${hid}">
        <header class="sheet-head">
          <h3 id="${hid}">${U.esc(g.name)}</h3>
          <span class="mono small muted">${done}/${allG.length}</span>
          <span class="sheet-bar">${UI.progress(U.pct(done, allG.length), { size: 'xs', hideValue: true, aria: g.name })}</span>
          <span class="row-actions">
            ${mode === 'group' ? UI.iconBtn('plus', 'ptask-new', t('projects.addTaskIn', { name: g.name }), { id: p.id, group: g.id || '' }, 'sm') : ''}
            ${g.group && !g.first ? UI.iconBtn('up', 'reorder', t('actions.moveUp'), { kind: 'group', id: g.id, project: p.id, value: -1 }, 'sm') : ''}
            ${g.group && !g.last ? UI.iconBtn('down', 'reorder', t('actions.moveDown'), { kind: 'group', id: g.id, project: p.id, value: 1 }, 'sm') : ''}
            ${g.group ? UI.iconBtn('edit', 'group-edit', t('projects.renameGroup'), { id: p.id, group: g.id }, 'sm') : ''}
            ${g.group ? UI.iconBtn('trash', 'group-delete', t('projects.deleteGroup'), { id: p.id, group: g.id }, 'sm danger') : ''}
          </span>
        </header>
        ${gt.length ? `<ul class="pt-list">${gt.map((x) => taskRow(x, p, mode === 'group')).join('')}</ul>` : `<p class="muted small pad">${U.esc(allG.length ? t('filters.noMatch') : t('projects.emptyGroup'))}</p>`}
      </section>`;
    }).join('')}</div>`;
  }

  function tabOverview(p, st) {
    const s = S();
    const links = [['repoUrl', 'github'], ['liveUrl', 'external'], ['docsUrl', 'book']].filter(([k]) => U.safeUrl(p[k]));
    const learning = M.learningForProject(p.id).slice(0, 8);
    const groups = p.groups.map((g) => {
      const gt = M.projectTasks(p.id).filter((x) => x.groupId === g.id);
      const d = gt.filter((x) => x.status === 'completed').length;
      return { g, pct: U.pct(d, gt.length), label: `${d}/${gt.length}` };
    });
    const recent = s.activity.filter((e) => e.projectId === p.id).slice(0, 6);
    return `<div class="ws-grid">
      <div class="col">
        <section class="card"><h3>${U.esc(t('field.description'))}</h3><p class="pre">${U.esc(p.description || t('projects.noDescription'))}</p>
          <dl class="meta mt">
            ${p.type ? `<dt>${U.esc(t('field.projectType'))}</dt><dd>${U.esc(p.type)}</dd>` : ''}
            ${p.startDate ? `<dt>${U.esc(t('field.startDate'))}</dt><dd>${U.esc(U.fmtDate(p.startDate))}</dd>` : ''}
            ${p.targetDate ? `<dt>${U.esc(t('field.targetDate'))}</dt><dd>${U.esc(U.fmtDate(p.targetDate))}</dd>` : ''}
            <dt>${U.esc(t('projects.lastActivity'))}</dt><dd>${U.esc(U.relDay(p.lastActivityAt || p.updatedAt))}</dd>
          </dl>
        </section>
        <section class="card"><h3>${U.esc(t('projects.byGroup'))}</h3>
          ${groups.length ? `<ul class="bar-list">${groups.map((x) => `<li><span class="bl-label">${U.esc(x.g.name)}</span>${UI.progress(x.pct, { size: 'xs', hideValue: true, aria: x.g.name })}<span class="mono small">${x.label}</span></li>`).join('')}</ul>` : `<p class="muted small">${U.esc(t('projects.noGroups'))}</p>`}
        </section>
        <section class="card"><div class="section-head"><h3>${U.esc(t('nav.activity'))}</h3><a class="small" href="#/projects/${p.id}?tab=activity">${U.esc(t('common.viewAll'))}</a></div>${App.Activity.feed(recent)}</section>
      </div>
      <div class="col">
        <section class="card"><h3>${U.esc(t('projects.links'))}</h3>
          ${links.length ? `<ul class="res-list">${links.map(([k, ic]) => `<li>${UI.icon(ic)}<a href="${U.esc(p[k])}" target="_blank" rel="noopener noreferrer">${U.esc(t('field.' + k))}</a></li>`).join('')}</ul>` : `<p class="muted small">${U.esc(t('projects.noLinks'))}</p>`}
          <div class="section-head mt"><h3>${U.esc(t('detail.resources'))}</h3>${UI.iconBtn('plus', 'resource-add', t('actions.addResource'), { kind: 'project', id: p.id }, 'sm')}</div>
          ${UI.resourceList('project', p.id, p.resources)}
        </section>
        <section class="card"><div class="section-head"><h3>${U.esc(t('projects.milestones'))}</h3><a class="small" href="#/projects/${p.id}?tab=milestones">${U.esc(t('common.viewAll'))}</a></div>
          ${st.milestones.length ? `<ul class="bar-list">${st.milestones.map((m) => `<li><span class="bl-label">${m.complete ? UI.icon('done', 'st-completed') : UI.icon('flag')} ${U.esc(m.m.name)}</span>${UI.progress(m.pct, { size: 'xs', hideValue: true, aria: m.m.name })}<span class="mono small">${m.done}/${m.total}</span></li>`).join('')}</ul>` : `<p class="muted small">${U.esc(t('projects.noMilestones'))}</p>`}
        </section>
        <section class="card"><div class="section-head"><h3>${U.esc(t('projects.relatedLearning'))}</h3><a class="small" href="#/projects/${p.id}?tab=learning">${U.esc(t('common.viewAll'))}</a></div>
          ${learning.length ? `<div class="chips">${learning.map((id) => `<a class="chip st-${M.status(id)}" href="#/roadmap?focus=${id}">${UI.icon(UI.STATUS_ICON[M.status(id)])}${U.esc(s.nodes[id].title)}</a>`).join('')}</div>` : `<p class="muted small">${U.esc(t('projects.noLearning'))}</p>`}
        </section>
      </div>
    </div>`;
  }

  function tabMilestones(p, st) {
    return `<div class="section-head"><h2>${U.esc(t('projects.milestones'))}</h2>${UI.btn(t('projects.addMilestone'), 'milestone-add', { cls: 'sm primary', icon: 'plus', data: { id: p.id } })}</div>
      ${st.milestones.length ? `<div class="ms-grid">${st.milestones.map((m) => {
        const tasks = M.projectTasks(p.id).filter((x) => x.milestoneId === m.m.id);
        return `<article class="card ms-card ${m.complete ? 'complete' : ''}">
          <div class="section-head"><h3>${m.complete ? UI.icon('done', 'st-completed') : UI.icon('flag')} ${U.esc(m.m.name)}</h3>
            <span class="row-actions">${UI.iconBtn('up', 'reorder', t('actions.moveUp'), { kind: 'milestone', id: m.m.id, project: p.id, value: -1 }, 'sm')}${UI.iconBtn('down', 'reorder', t('actions.moveDown'), { kind: 'milestone', id: m.m.id, project: p.id, value: 1 }, 'sm')}${UI.iconBtn('edit', 'milestone-edit', t('common.edit'), { id: p.id, ms: m.m.id }, 'sm')}${UI.iconBtn('trash', 'milestone-delete', t('common.delete'), { id: p.id, ms: m.m.id }, 'sm danger')}</span></div>
          ${m.m.targetDate ? `<p class="muted small">${U.esc(t('field.targetDate'))}: ${U.esc(U.fmtDate(m.m.targetDate))}</p>` : ''}
          ${m.m.description ? `<p class="small pre">${U.esc(m.m.description)}</p>` : ''}
          ${UI.progress(m.pct, { label: t('projects.tasksDone', { done: m.done, total: m.total }) })}
          ${tasks.length ? `<ul class="child-list">${tasks.map((x) => `<li class="child-row ${x.status}">${UI.statusToggle('ptask-toggle', x.id, x.status, x.title)}<button class="link-btn" data-action="ptask-edit" data-id="${x.id}">${U.esc(x.title)}</button></li>`).join('')}</ul>` : `<p class="muted small">${U.esc(t('projects.milestoneEmpty'))}</p>`}
        </article>`;
      }).join('')}</div>` : UI.empty(t('projects.noMilestones'))}`;
  }

  function tabApplied(p) {
    const s = S();
    return `<div class="section-head"><div><h2>${U.esc(t('projects.applied'))}</h2><p class="muted small">${U.esc(t('projects.appliedIntro'))}</p></div>${UI.btn(t('projects.addApplied'), 'applied-add', { cls: 'sm primary', icon: 'plus', data: { id: p.id } })}</div>
      ${p.applied.length ? `<div class="applied-grid">${p.applied.map((a) => {
        const node = a.nodeId && s.nodes[a.nodeId];
        return `<article class="card applied-card">
          <div class="section-head"><h3>${U.esc(a.tech)}</h3><span class="row-actions">${UI.iconBtn('edit', 'applied-edit', t('common.edit'), { id: p.id, ap: a.id }, 'sm')}${UI.iconBtn('trash', 'applied-delete', t('common.delete'), { id: p.id, ap: a.id }, 'sm danger')}</span></div>
          ${node ? `<p class="small"><span class="muted">${U.esc(t('projects.learnedIn'))}</span> <button class="link-btn" data-action="open-node" data-id="${node.id}">${U.esc(node.title)}</button> ${UI.statusBadge(M.status(node.id))}</p>` : ''}
          <p class="muted small">${U.esc(t('projects.appliedLabel'))}</p>
          <ul class="applied-items">${(a.items || []).map((i) => `<li>${UI.icon('check')}${U.esc(i)}</li>`).join('')}</ul>
        </article>`;
      }).join('')}</div>` : UI.empty(t('projects.noApplied'))}`;
  }

  function tabLearning(p) {
    const s = S();
    const ids = M.learningForProject(p.id);
    const linkedTasks = M.projectTasks(p.id).filter((x) => x.nodeId && s.nodes[x.nodeId]);
    const byNode = {};
    linkedTasks.forEach((x) => { (byNode[x.nodeId] = byNode[x.nodeId] || []).push(x); });
    return `<div class="section-head"><div><h2>${U.esc(t('projects.relatedLearning'))}</h2><p class="muted small">${U.esc(t('projects.relatedIntro'))}</p></div>${UI.btn(t('projects.linkLearning'), 'learning-link', { cls: 'sm primary', icon: 'link', data: { id: p.id } })}</div>
      ${ids.length ? `<ul class="learn-list card">${ids.map((id) => {
        const n = s.nodes[id];
        const info = M.info(id);
        return `<li>
          ${UI.icon(UI.STATUS_ICON[info.status], 'st-' + info.status)}
          <div class="ll-main"><button class="link-btn" data-action="open-node" data-id="${id}">${U.esc(n.title)}</button><span class="muted small">${U.esc(t('type.' + n.type))}${M.ancestors(id).length ? ' · ' + U.esc(M.ancestors(id).slice(-1)[0].title) : ''}</span></div>
          <span class="ll-bar">${UI.progress(info.pct, { size: 'xs', aria: n.title })}</span>
          <a class="btn sm ghost" href="#/roadmap?focus=${id}">${UI.icon('map')}<span>${U.esc(t('detail.showOnMap'))}</span></a>
        </li>`;
      }).join('')}</ul>` : UI.empty(t('projects.noLearning'))}
      ${Object.keys(byNode).length ? `<h3 class="mt">${U.esc(t('projects.learningToTasks'))}</h3><div class="ltt-grid">${Object.entries(byNode).map(([nid, list]) => `
        <article class="card ltt">
          <p class="ltt-flow"><span class="chip">${UI.icon('book')}${U.esc(s.nodes[nid].title)}</span><span aria-hidden="true">↓</span><span class="chip">${UI.icon('folder')}${U.esc(p.name)}</span></p>
          <ul class="child-list">${list.map((x) => `<li class="child-row ${x.status}">${UI.statusToggle('ptask-toggle', x.id, x.status, x.title)}<button class="link-btn" data-action="ptask-edit" data-id="${x.id}">${U.esc(x.title)}</button></li>`).join('')}</ul>
        </article>`).join('')}</div>` : ''}`;
  }

  function tabNotes(p) {
    return `<section class="card"><h2><label for="proj-notes">${U.esc(t('projects.notes'))}</label></h2>
      <p class="muted small">${U.esc(t('projects.notesIntro'))}</p>
      <textarea id="proj-notes" class="notes big" data-notes-kind="project" data-notes-id="${p.id}" rows="18" placeholder="${U.esc(t('projects.notesPh'))}">${U.esc(p.notes)}</textarea>
      <p class="help" data-save-state>${U.esc(t('detail.notesAutosave'))}</p>
    </section>`;
  }

  function isMajor(e) {
    return ['project_created', 'project_status', 'milestone_done', 'tech_added'].includes(e.type)
      || (e.type === 'complete' && e.refKind === 'ptask' && ['high', 'critical'].includes(e.priority));
  }

  function timelineLabel(e) {
    if (e.type === 'project_created') return t('timeline.started');
    if (e.type === 'project_status') {
      if (e.to === 'paused') return t('timeline.paused');
      if (e.from === 'paused') return t('timeline.resumed');
      if (e.to === 'delivered' || e.to === 'ready') return t('timeline.completed');
      return t('timeline.status');
    }
    if (e.type === 'milestone_done') return t('timeline.milestone');
    if (e.type === 'tech_added') return t('timeline.tech');
    return t('timeline.importantTask');
  }

  function tabActivity(p) {
    const entries = S().activity.filter((e) => e.projectId === p.id);
    const major = entries.filter(isMajor);
    return `<div class="section-head"><h2>${U.esc(t('nav.activity'))}</h2>
      <div class="segment" role="group" aria-label="${U.esc(t('projects.view'))}">
        <button class="seg-btn ${activityMode === 'timeline' ? 'active' : ''}" data-action="proj-activity-mode" data-value="timeline" aria-pressed="${activityMode === 'timeline'}"><span>${U.esc(t('projects.timeline'))}</span></button>
        <button class="seg-btn ${activityMode === 'all' ? 'active' : ''}" data-action="proj-activity-mode" data-value="all" aria-pressed="${activityMode === 'all'}"><span>${U.esc(t('projects.allActivity'))}</span></button>
      </div></div>
      ${activityMode === 'timeline'
        ? (major.length ? `<ol class="vtimeline">${major.map((e) => `<li class="vt-${e.type}"><span class="vt-dot" aria-hidden="true"></span>
            <div><p class="vt-label">${U.esc(timelineLabel(e))}</p><p>${App.Activity.describe(e)}</p><p class="muted small">${U.esc(U.fmtDate(e.ts))} · ${U.esc(U.fmtTime(e.ts))}</p></div></li>`).join('')}</ol>`
          : UI.empty(t('projects.noTimeline')))
        : `<div class="card">${App.Activity.feed(entries.slice(0, 200))}</div>`}`;
  }

  function tabStats(p, st) {
    const learnSet = new Set(M.learningForProject(p.id).flatMap((id) => [id, ...Store.descendantsOf(id)]));
    const devMin = M.totalMinutes((x) => x.projectId === p.id);
    const learnMin = M.totalMinutes((x) => !x.projectId && x.nodeId && learnSet.has(x.nodeId));
    const appliedCount = p.applied.reduce((a, x) => a + (x.items || []).length, 0);
    const tasks = M.projectTasks(p.id);
    const tiles = [
      [t('projects.stTotal'), st.total], [t('projects.stDone'), st.done], [t('projects.stRemaining'), st.remaining], [t('projects.stPct'), st.pct + '%'],
      [t('projects.stApplied'), appliedCount], [t('projects.stTech'), p.technologies.length],
      [t('projects.stMilestones'), `${st.milestones.filter((m) => m.complete).length}/${st.milestones.length}`],
      [t('projects.stLearnHours'), U.fmtHours(learnMin)], [t('projects.stDevHours'), U.fmtHours(devMin)],
    ];
    const prio = Store.PRIORITIES.slice().reverse().map((pr) => {
      const list = tasks.filter((x) => x.priority === pr);
      const d = list.filter((x) => x.status === 'completed').length;
      return { pr, total: list.length, done: d };
    });
    return `<section class="kpis small-kpis" aria-label="${U.esc(t('nav.stats'))}">${tiles.map(([k, v]) => `<div class="kpi"><span class="kpi-label">${U.esc(k)}</span><span class="kpi-value mono">${U.esc(v)}</span></div>`).join('')}</section>
      <div class="ws-grid mt">
        <section class="card"><h3>${U.esc(t('projects.byGroup'))}</h3>
          <ul class="bar-list">${[...p.groups, { id: null, name: t('projects.ungrouped') }].map((g) => {
            const gt = tasks.filter((x) => (x.groupId || null) === g.id);
            if (!gt.length) return '';
            const d = gt.filter((x) => x.status === 'completed').length;
            return `<li><span class="bl-label">${U.esc(g.name)}</span>${UI.progress(U.pct(d, gt.length), { size: 'xs', hideValue: true, aria: g.name })}<span class="mono small">${d}/${gt.length}</span></li>`;
          }).join('')}</ul>
        </section>
        <section class="card"><h3>${U.esc(t('projects.byPriority'))}</h3>
          <ul class="bar-list">${prio.filter((x) => x.total).map((x) => `<li><span class="bl-label">${UI.priorityBadge(x.pr)}</span>${UI.progress(U.pct(x.done, x.total), { size: 'xs', hideValue: true, aria: t('priority.' + x.pr) })}<span class="mono small">${x.done}/${x.total}</span></li>`).join('')}</ul>
          ${UI.btn(t('activity.logSession'), 'log-session', { cls: 'sm ghost mt', icon: 'clock', data: { project: p.id } })}
        </section>
      </div>`;
  }

  function renderWorkspace(el, pid, params) {
    const s = S();
    const p = s.projects[pid];
    if (!p) { location.replace('#/projects'); return; }
    const tab = TABS.includes(params.tab) ? params.tab : 'overview';
    const st = M.projectStats(pid);
    const timing = s.timer && s.timer.projectId === pid;
    const repo = U.safeUrl(p.repoUrl);

    const body = {
      overview: () => tabOverview(p, st), tasks: () => tabTasks(p), milestones: () => tabMilestones(p, st),
      applied: () => tabApplied(p), learning: () => tabLearning(p), notes: () => tabNotes(p),
      activity: () => tabActivity(p), stats: () => tabStats(p, st),
    }[tab]();

    el.innerHTML = `<nav class="crumbs page-crumbs" aria-label="${U.esc(t('detail.location'))}"><a href="#/projects">${U.esc(t('nav.projects'))}</a><span aria-hidden="true">›</span><span>${U.esc(p.name)}</span></nav>
      <header class="ws-head card">
        <div class="ws-title">
          <p class="kicker">${U.esc(t('projects.controlCenter'))}</p>
          <h1>${U.esc(p.name)}</h1>
          <div class="chips tech">${p.technologies.map((x) => `<span class="chip">${U.esc(x)}</span>`).join('')}</div>
        </div>
        <div class="ws-status">
          <label class="inline-field">${U.esc(t('field.status'))}
            <select data-change="proj-status-set" data-id="${pid}">${Store.PROJECT_STATUSES.map((x) => `<option value="${x}" ${p.status === x ? 'selected' : ''}>${U.esc(t('pstatus.' + x))}</option>`).join('')}</select>
          </label>
          ${UI.progress(st.pct, { label: t('projects.tasksDone', { done: st.done, total: st.total }) })}
        </div>
        <div class="ws-now">
          <p><span class="muted small">${U.esc(t('projects.currentTask'))}</span><br>${st.current ? `<button class="link-btn fg" data-action="ptask-edit" data-id="${st.current.id}">${U.esc(st.current.title)}</button>` : `<span class="muted">—</span>`}</p>
          <p><span class="muted small">${U.esc(t('projects.nextTask'))}</span><br>${st.next ? `<button class="link-btn fg" data-action="ptask-edit" data-id="${st.next.id}">${U.esc(st.next.title)}</button>` : `<span class="muted">—</span>`}</p>
        </div>
        <div class="btn-row ws-actions">
          ${st.current ? UI.btn(t('actions.markComplete'), 'ptask-status', { cls: 'sm primary', icon: 'check', data: { id: st.current.id, value: 'completed' } }) : st.next ? UI.btn(t('projects.startNext'), 'ptask-status', { cls: 'sm primary', icon: 'play', data: { id: st.next.id, value: 'in_progress' } }) : ''}
          ${timing ? UI.btn(t('timer.stopLog'), 'timer-stop', { cls: 'sm', icon: 'stop' }) : UI.btn(t('timer.start'), 'timer-start', { cls: 'sm', icon: 'clock', data: { project: pid } })}
          ${repo ? `<a class="btn sm ghost" href="${U.esc(repo)}" target="_blank" rel="noopener noreferrer">${UI.icon('github')}<span>${U.esc(t('field.repoUrl'))}</span></a>` : ''}
          ${UI.iconBtn('edit', 'project-edit', t('projects.editProject'), { id: pid }, 'sm')}
          ${UI.iconBtn('trash', 'project-delete', t('projects.deleteProject'), { id: pid }, 'sm danger')}
        </div>
      </header>
      <nav class="tabs" role="tablist" aria-label="${U.esc(t('projects.sections'))}">
        ${TABS.map((x) => `<a role="tab" href="#/projects/${pid}?tab=${x}" class="tab ${x === tab ? 'active' : ''}" aria-selected="${x === tab}">${U.esc(t('projects.tab_' + x))}</a>`).join('')}
      </nav>
      <div class="tab-panel" role="tabpanel">${body}</div>`;

    const q = document.getElementById('ptf-q');
    if (q) q.addEventListener('input', U.debounce(() => { taskFilter.q = q.value.trim(); App.rerender(); }, 200));
    bindKanban(el);
  }

  function bindKanban(root) {
    root.querySelectorAll('[data-drag]').forEach((card) => {
      card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', card.dataset.drag); card.classList.add('dragging'); });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });
    root.querySelectorAll('[data-drop]').forEach((col) => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('over');
        const id = e.dataTransfer.getData('text/plain');
        if (id) Store.setPTaskStatus(id, col.dataset.drop);
      });
    });
  }

  function render(el, params, sub) {
    if (sub) renderWorkspace(el, sub, params); else renderList(el);
  }

  /* ------------------------------------------------------------------ */
  /* actions                                                             */
  /* ------------------------------------------------------------------ */

  UI.registerActions({
    'project-new': () => projectForm(null).then((id) => { if (id) location.hash = '#/projects/' + id; }),
    'project-edit': (el) => projectForm(el.dataset.id),
    'project-delete': async (el) => {
      const p = S().projects[el.dataset.id];
      const ok = await UI.confirm({ title: t('confirm.deleteTitle', { name: p.name }), message: t('projects.deleteMessage', { n: M.projectTasks(p.id).length }), confirmLabel: t('common.delete') });
      if (!ok) return;
      location.hash = '#/projects';
      UI.withUndo(t('toast.deleted', { name: p.name }), () => Store.deleteProject(p.id));
    },
    'proj-status-set': (el) => Store.updateProject(el.dataset.id, { status: el.value }),
    'proj-scope': (el) => { listFilter.scope = el.dataset.value; App.rerender(); },
    'proj-status': (el) => { listFilter.status = el.value; App.rerender(); },
    'proj-tech': (el) => { listFilter.tech = el.value; App.rerender(); },
    'proj-progress': (el) => { listFilter.progress = el.value; App.rerender(); },
    'proj-view': (el) => Store.updateProject(el.dataset.id, { view: el.dataset.value }),
    'proj-activity-mode': (el) => { activityMode = el.dataset.value; App.rerender(); },
    'ptf-status': (el) => { taskFilter.status = el.value; App.rerender(); },
    'ptf-priority': (el) => { taskFilter.priority = el.value; App.rerender(); },
    'ptask-new': (el) => taskForm(el.dataset.id, null, { groupId: el.dataset.group || '' }),
    'ptask-edit': (el) => taskForm(null, el.dataset.id),
    'ptask-toggle': (el) => Store.setPTaskStatus(el.dataset.id, el.dataset.value),
    'ptask-status': (el) => Store.setPTaskStatus(el.dataset.id, el.dataset.value),
    'ptask-status-select': (el) => Store.setPTaskStatus(el.dataset.id, el.value),
    'ptask-delete': async (el) => {
      const x = S().ptasks[el.dataset.id];
      const ok = await UI.confirm({ title: t('confirm.deleteTitle', { name: x.title }), message: t('confirm.deleteSimple'), confirmLabel: t('common.delete') });
      if (ok) UI.withUndo(t('toast.deleted', { name: x.title }), () => Store.deletePTask(x.id));
    },
    'group-add': (el) => groupForm(el.dataset.id, null),
    'group-edit': (el) => groupForm(el.dataset.id, el.dataset.group),
    'group-delete': async (el) => {
      const p = S().projects[el.dataset.id];
      const g = p.groups.find((x) => x.id === el.dataset.group);
      const ok = await UI.confirm({ title: t('confirm.deleteTitle', { name: g.name }), message: t('projects.deleteGroupMessage'), confirmLabel: t('common.delete') });
      if (ok) Store.projectList(p.id, 'groups', 'remove', { id: g.id });
    },
    'milestone-add': (el) => milestoneForm(el.dataset.id, null),
    'milestone-edit': (el) => milestoneForm(el.dataset.id, el.dataset.ms),
    'milestone-delete': async (el) => {
      const ok = await UI.confirm({ title: t('projects.deleteMilestone'), message: t('projects.deleteMilestoneMessage'), confirmLabel: t('common.delete') });
      if (ok) Store.projectList(el.dataset.id, 'milestones', 'remove', { id: el.dataset.ms });
    },
    'applied-add': (el) => appliedForm(el.dataset.id, null),
    'applied-edit': (el) => appliedForm(el.dataset.id, el.dataset.ap),
    'applied-delete': async (el) => {
      const ok = await UI.confirm({ title: t('projects.deleteApplied'), message: t('confirm.deleteSimple'), confirmLabel: t('common.delete') });
      if (ok) Store.projectList(el.dataset.id, 'applied', 'remove', { id: el.dataset.ap });
    },
    'learning-link': (el) => linkLearningForm(el.dataset.id),
    'template-new': () => templateForm(null),
    'template-edit': (el) => templateForm(el.dataset.id),
    'template-delete': async (el) => {
      const tpl = S().templates.find((x) => x.id === el.dataset.id);
      const ok = await UI.confirm({ title: t('confirm.deleteTitle', { name: tpl.name }), message: t('confirm.deleteSimple'), confirmLabel: t('common.delete') });
      if (ok) Store.deleteTemplate(tpl.id);
    },
  });

  UI.registerActions({
    // Generic ordering for projects, skills, groups, milestones, tasks, lists and templates.
    'reorder': (el) => Store.reorder(el.dataset.kind, el.dataset.id, Number(el.dataset.value), { projectId: el.dataset.project, listId: el.dataset.list }),
  });

  App.Projects = { taskForm, projectForm, milestoneForm, templateForm };
  App.Pages.projects = {
    render,
    nav: { icon: 'folder', order: 60 },
    title: () => { const r = App.route(); return r.sub && S().projects[r.sub] ? S().projects[r.sub].name : t('nav.projects'); },
  };
})(window.App = window.App || {});
