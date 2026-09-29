/*
 * Manage (Customize): one place to add, edit, reorder and restructure everything —
 * learning plan, projects, skills, technologies, templates and lists — without touching code.
 */
(function (App) {
  'use strict';
  const U = App.U, UI = App.UI, M = App.Model, Store = App.Store;
  const t = (...a) => App.i18n.t(...a);
  const S = () => Store.state;

  const NATURAL_CHILD = { path: 'track', track: 'course', course: 'module', module: 'lesson', lesson: 'task', task: null };
  let open = null; // ids of expanded tree rows (defaults: paths & tracks)

  function openSet() {
    if (!open) open = new Set(Object.values(S().nodes).filter((n) => n.type === 'path' || n.type === 'track').map((n) => n.id));
    return open;
  }

  function treeRow(id, siblings, idx) {
    const s = S();
    const n = s.nodes[id];
    const i = M.info(id);
    const child = NATURAL_CHILD[n.type];
    const row = `<div class="mg-row st-${i.status}">
      ${UI.typeBadge(n.type)}
      <a class="mg-title" href="#/learn/${id}">${U.esc(n.title)}</a>
      <span class="mono small muted">${n.children.length ? i.pct + '%' : U.esc(t('status.' + i.status))}</span>
      <span class="row-actions always">
        ${idx > 0 ? UI.iconBtn('up', 'node-move', t('actions.moveUp'), { id, value: -1 }, 'sm') : '<span class="icon-slot"></span>'}
        ${idx < siblings.length - 1 ? UI.iconBtn('down', 'node-move', t('actions.moveDown'), { id, value: 1 }, 'sm') : '<span class="icon-slot"></span>'}
        ${child ? UI.iconBtn('plus', 'node-add-child', t('actions.addType', { type: t('type.' + child) }), { id, type: child }, 'sm') : '<span class="icon-slot"></span>'}
        ${UI.iconBtn('edit', 'node-edit', t('manage.editMove'), { id }, 'sm')}
        ${UI.iconBtn('trash', 'node-delete', t('common.delete'), { id }, 'sm danger')}
      </span>
    </div>`;
    if (!n.children.length) return `<li class="mg-leaf">${row}</li>`;
    return `<li><details data-mg="${id}" ${openSet().has(id) ? 'open' : ''}><summary>${row}</summary>
      <ul class="mg-tree">${n.children.map((c) => treeRow(c, n.children, n.children.indexOf(c))).join('')}</ul></details></li>`;
  }

  function orderedList(kind, ids, label, actions) {
    return `<ul class="mg-list">${ids.map((id, i) => `<li>
      <span class="mg-title">${label(id)}</span>
      <span class="row-actions always">
        ${i > 0 ? UI.iconBtn('up', 'reorder', t('actions.moveUp'), { kind, id, value: -1 }, 'sm') : '<span class="icon-slot"></span>'}
        ${i < ids.length - 1 ? UI.iconBtn('down', 'reorder', t('actions.moveDown'), { kind, id, value: 1 }, 'sm') : '<span class="icon-slot"></span>'}
        ${actions(id)}
      </span></li>`).join('')}</ul>`;
  }

  function render(el) {
    const s = S();
    const quick = [
      ['node-add', 'path', t('type.path')], ['node-add', 'track', t('type.track')], ['node-add', 'course', t('type.course')],
      ['node-add', 'module', t('type.module')], ['node-add', 'lesson', t('type.lesson')], ['node-add', 'task', t('type.task')],
      ['project-new', '', t('manage.project')], ['manage-milestone', '', t('manage.milestone')], ['skill-add', '', t('manage.skill')],
      ['tech-add', '', t('manage.technology')], ['cert-add', '', t('manage.certificate')], ['list-new', '', t('manage.list')], ['template-new', '', t('manage.template')],
    ];
    const techUse = (name) => Object.values(s.projects).filter((p) => p.technologies.some((x) => U.norm(x) === U.norm(name))).length;

    el.innerHTML = `<header class="page-head"><div><h1>${U.esc(t('nav.manage'))}</h1><p class="muted">${U.esc(t('manage.subtitle'))}</p></div></header>

      <section class="card" aria-labelledby="mg-add"><h2 id="mg-add">${U.esc(t('manage.quickAdd'))}</h2>
        <div class="quick-grid">${quick.map(([action, type, label]) => `<button class="quick-btn" data-action="${action}" ${type ? `data-type="${type}" data-open="no"` : ''}>${UI.icon('plus')}<span>${U.esc(label)}</span></button>`).join('')}</div>
      </section>

      <section class="card mt" aria-labelledby="mg-plan">
        <div class="section-head"><h2 id="mg-plan">${U.esc(t('manage.plan'))}</h2>
          <div class="btn-row">${UI.btn(t('manage.expandAll'), 'mg-expand', { cls: 'sm ghost', icon: 'expand' })}${UI.btn(t('manage.collapseAll'), 'mg-collapse', { cls: 'sm ghost', icon: 'collapse' })}</div></div>
        <p class="muted small">${U.esc(t('manage.planHelp'))}</p>
        ${s.rootIds.length ? `<ul class="mg-tree root">${s.rootIds.map((id, i) => treeRow(id, s.rootIds, i)).join('')}</ul>` : UI.empty(t('roadmap.empty'))}
      </section>

      <div class="ws-grid mt">
        <section class="card" aria-labelledby="mg-proj"><div class="section-head"><h2 id="mg-proj">${U.esc(t('nav.projects'))}</h2>${UI.iconBtn('plus', 'project-new', t('projects.newProject'), {}, 'sm')}</div>
          ${s.projectOrder.length ? orderedList('project', s.projectOrder, (id) => `<a href="#/projects/${id}">${U.esc(s.projects[id].name)}</a> ${UI.projectStatusBadge(s.projects[id].status)}`,
            (id) => UI.iconBtn('edit', 'project-edit', t('common.edit'), { id }, 'sm') + UI.iconBtn('trash', 'project-delete', t('common.delete'), { id }, 'sm danger')) : `<p class="muted small">${U.esc(t('projects.empty'))}</p>`}
        </section>
        <section class="card" aria-labelledby="mg-skills"><div class="section-head"><h2 id="mg-skills">${U.esc(t('nav.skills'))}</h2>${UI.iconBtn('plus', 'skill-add', t('skills.add'), {}, 'sm')}</div>
          ${s.skillOrder.length ? orderedList('skill', s.skillOrder, (id) => `${U.esc(s.skills[id].name)} <span class="mono small muted">${M.skillStats(id).pct}%</span>`,
            (id) => UI.iconBtn('edit', 'skill-edit', t('common.edit'), { id }, 'sm') + UI.iconBtn('trash', 'skill-delete', t('common.delete'), { id }, 'sm danger')) : `<p class="muted small">${U.esc(t('skills.empty'))}</p>`}
        </section>
        <section class="card" aria-labelledby="mg-tech"><div class="section-head"><h2 id="mg-tech">${U.esc(t('manage.technologies'))}</h2></div>
          <p class="muted small">${U.esc(t('manage.techHelp'))}</p>
          <ul class="tech-list">${s.technologies.slice().sort((a, b) => a.localeCompare(b)).map((name) => `<li>
            <span class="chip">${U.esc(name)}</span><span class="muted small">${U.esc(t('manage.usedIn', { n: techUse(name) }))}</span>
            <span class="row-actions always">${UI.iconBtn('edit', 'tech-rename', t('manage.rename'), { value: name }, 'sm')}${UI.iconBtn('trash', 'tech-delete', t('common.delete'), { value: name }, 'sm danger')}</span></li>`).join('')}</ul>
          <div class="inline-add mt"><input type="text" id="tech-input" placeholder="${U.esc(t('manage.techPh'))}" aria-label="${U.esc(t('manage.technology'))}" data-enter="tech-add-inline">${UI.btn(t('common.add'), 'tech-add-inline', { cls: 'sm' })}</div>
        </section>
        <section class="card" aria-labelledby="mg-tpl"><div class="section-head"><h2 id="mg-tpl">${U.esc(t('projects.templates'))}</h2>${UI.iconBtn('plus', 'template-new', t('projects.newTemplate'), {}, 'sm')}</div>
          ${s.templates.length ? orderedList('template', s.templates.map((x) => x.id), (id) => U.esc(s.templates.find((x) => x.id === id).name),
            (id) => UI.iconBtn('edit', 'template-edit', t('common.edit'), { id }, 'sm') + UI.iconBtn('trash', 'template-delete', t('common.delete'), { id }, 'sm danger')) : `<p class="muted small">${U.esc(t('projects.noTemplates'))}</p>`}
        </section>
        <section class="card" aria-labelledby="mg-lists"><div class="section-head"><h2 id="mg-lists">${U.esc(t('nav.lists'))}</h2>${UI.iconBtn('plus', 'list-new', t('lists.new'), {}, 'sm')}</div>
          ${s.lists.length ? orderedList('list', s.lists.map((x) => x.id), (id) => { const l = s.lists.find((x) => x.id === id); return `<a href="#/lists">${U.esc(l.name)}</a> <span class="mono small muted">${l.items.length}</span>`; },
            (id) => UI.iconBtn('edit', 'list-edit', t('common.edit'), { id }, 'sm') + UI.iconBtn('trash', 'list-delete', t('common.delete'), { id }, 'sm danger')) : `<p class="muted small">${U.esc(t('lists.empty'))}</p>`}
        </section>
        <section class="card" aria-labelledby="mg-files"><h2 id="mg-files">${UI.icon('database')} ${U.esc(t('manage.whereData'))}</h2>
          <p class="small">${U.esc(t('manage.whereDataText'))}</p>
          <ul class="mini-list small mono mt"><li>data/initial-roadmap.js</li><li>data/initial-projects.js</li><li>data/initial-skills.js</li><li>css/variables.css</li></ul>
          <div class="btn-row mt">${UI.btn(t('data.exportBtn'), 'data-export', { cls: 'sm', icon: 'download' })}<a class="btn sm ghost" href="#/settings">${UI.icon('settings')}<span>${U.esc(t('nav.settings'))}</span></a></div>
        </section>
      </div>`;

    el.querySelectorAll('details[data-mg]').forEach((d) => d.addEventListener('toggle', () => {
      if (d.open) openSet().add(d.dataset.mg); else openSet().delete(d.dataset.mg);
    }));
  }

  async function chooseProjectThen(fn) {
    const s = S();
    if (!s.projectOrder.length) { UI.toast(t('projects.needProject'), { tone: 'warn' }); return; }
    const v = s.projectOrder.length === 1 ? { pid: s.projectOrder[0] } : await UI.form({
      title: t('manage.milestone'),
      fields: [{ name: 'pid', label: t('field.project'), type: 'select', full: true, options: s.projectOrder.map((id) => ({ value: id, label: s.projects[id].name })) }],
      submitLabel: t('common.next'),
    });
    if (v) fn(v.pid);
  }

  async function techPrompt(current) {
    const v = await UI.form({
      title: current ? t('manage.renameTech', { name: current }) : t('manage.addTech'),
      intro: current ? t('manage.renameIntro') : '',
      fields: [{ name: 'name', label: t('field.name'), required: true, full: true }],
      values: { name: current || '' },
    });
    return v && v.name;
  }

  UI.registerActions({
    'mg-expand': () => { open = new Set(Object.values(S().nodes).filter((n) => n.children.length).map((n) => n.id)); App.rerender(); },
    'mg-collapse': () => { open = new Set(); App.rerender(); },
    'manage-milestone': () => chooseProjectThen((pid) => App.Projects.milestoneForm(pid, null)),
    'tech-add': async () => { const name = await techPrompt(null); if (name) { Store.addTechnology(name); UI.toast(t('toast.added', { name })); } },
    'tech-add-inline': () => {
      const input = document.getElementById('tech-input');
      const name = input && input.value.trim();
      if (!name) { if (input) input.focus(); return; }
      Store.addTechnology(name);
      setTimeout(() => { const i = document.getElementById('tech-input'); if (i) i.focus(); }, 0);
    },
    'tech-rename': async (el) => {
      const name = await techPrompt(el.dataset.value);
      if (name && name !== el.dataset.value) { Store.renameTechnology(el.dataset.value, name); UI.toast(t('toast.saved')); }
    },
    'tech-delete': async (el) => {
      const name = el.dataset.value;
      const n = Object.values(S().projects).filter((p) => p.technologies.some((x) => U.norm(x) === U.norm(name))).length;
      const ok = await UI.confirm({ title: t('confirm.deleteTitle', { name }), message: n ? t('manage.techDeleteUsed', { n }) : t('confirm.deleteSimple'), confirmLabel: t('common.delete') });
      if (ok) UI.withUndo(t('toast.deleted', { name }), () => Store.deleteTechnology(name));
    },
  });

  App.Pages.manage = { render, title: () => t('nav.manage'), nav: { icon: 'edit', order: 105 } };
})(window.App = window.App || {});
