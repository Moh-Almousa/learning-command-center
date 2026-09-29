/* Skills: levels computed from linked roadmap progress + real project use. */
(function (App) {
  'use strict';
  const U = App.U, UI = App.UI, M = App.Model, Store = App.Store;
  const t = (...a) => App.i18n.t(...a);
  const S = () => Store.state;

  let sort = 'progress';

  async function skillForm(id) {
    const k = id ? S().skills[id] : null;
    const v = await UI.form({
      title: k ? t('skills.edit') : t('skills.add'),
      intro: t('skills.formIntro'),
      wide: true,
      fields: [
        { name: 'name', label: t('field.name'), required: true, full: true, help: t('help.skillName') },
        { name: 'description', label: t('field.description'), type: 'textarea', rows: 2, full: true },
        { name: 'nodeIds', label: t('skills.linked'), type: 'checklist', full: true, options: UI.nodeOptions(['track', 'course', 'module', 'lesson']) },
      ],
      values: k || { nodeIds: [] },
    });
    if (!v) return;
    Store.saveSkill(Object.assign({ id: k ? k.id : undefined }, v));
    UI.toast(t('toast.saved'));
  }

  function card(k) {
    const s = S();
    const st = M.skillStats(k.id);
    const tasksDone = st.tasks.filter((x) => s.nodes[x].status === 'completed').length + st.ptasks.filter((x) => x.status === 'completed').length;
    const tasksTotal = st.tasks.length + st.ptasks.length;
    return `<article class="card skill-card">
      <div class="section-head">
        <h2>${U.esc(k.name)}</h2>
        <span class="row-actions">${UI.iconBtn('edit', 'skill-edit', t('common.edit'), { id: k.id }, 'sm')}${UI.iconBtn('trash', 'skill-delete', t('common.delete'), { id: k.id }, 'sm danger')}</span>
      </div>
      <p class="level lv-${st.level}"><span class="lv-dots" aria-hidden="true">${['beginner', 'elementary', 'intermediate', 'advanced', 'proficient'].map((l, i, arr) => `<i class="${i <= arr.indexOf(st.level) ? 'on' : ''}"></i>`).join('')}</span>${U.esc(t('level.' + st.level))}</p>
      ${UI.progress(st.pct, { label: st.total ? t('common.itemsOf', { done: st.done, total: st.total }) : t('skills.noLinked') })}
      ${k.description ? `<p class="small muted">${U.esc(k.description)}</p>` : ''}
      <dl class="skill-rel">
        <dt>${U.esc(t('skills.courses'))}</dt>
        <dd>${st.courses.length ? `<div class="chips">${st.courses.map((n) => `<button class="chip st-${M.status(n.id)}" data-action="open-node" data-id="${n.id}">${UI.icon(UI.STATUS_ICON[M.status(n.id)])}${U.esc(n.title)}</button>`).join('')}</div>` : '<span class="muted small">—</span>'}</dd>
        <dt>${U.esc(t('skills.projects'))}</dt>
        <dd>${st.projects.length ? `<div class="chips">${st.projects.map((p) => `<a class="chip" href="#/projects/${p.id}">${UI.icon('folder')}${U.esc(p.name)}</a>`).join('')}</div>` : `<span class="muted small">${U.esc(t('skills.notApplied'))}</span>`}</dd>
        <dt>${U.esc(t('skills.tasks'))}</dt>
        <dd class="mono small">${tasksTotal ? U.esc(t('common.itemsOf', { done: tasksDone, total: tasksTotal })) : '—'}</dd>
      </dl>
    </article>`;
  }

  function render(el) {
    const s = S();
    let list = s.skillOrder.map((id) => s.skills[id]);
    if (sort === 'progress') list = list.slice().sort((a, b) => M.skillStats(b.id).pct - M.skillStats(a.id).pct);
    if (sort === 'name') list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
    el.innerHTML = `<header class="page-head">
        <div><h1>${U.esc(t('nav.skills'))}</h1><p class="muted">${U.esc(t('skills.subtitle'))}</p></div>
        <div class="btn-row">
          <label class="inline-field">${U.esc(t('filters.sort'))}
            <select data-change="skills-sort">${['progress', 'name', 'custom'].map((v) => `<option value="${v}" ${sort === v ? 'selected' : ''}>${U.esc(t('skills.sort_' + v))}</option>`).join('')}</select>
          </label>
          ${UI.btn(t('skills.add'), 'skill-add', { cls: 'primary', icon: 'plus' })}
        </div>
      </header>
      <p class="muted small">${U.esc(t('skills.howLevels'))}</p>
      ${list.length ? `<div class="skill-grid">${list.map(card).join('')}</div>` : UI.empty(t('skills.empty'), UI.btn(t('skills.add'), 'skill-add', { cls: 'primary', icon: 'plus' }))}`;
  }

  UI.registerActions({
    'skill-add': () => skillForm(null),
    'skill-edit': (el) => skillForm(el.dataset.id),
    'skill-delete': async (el) => {
      const k = S().skills[el.dataset.id];
      const ok = await UI.confirm({ title: t('confirm.deleteTitle', { name: k.name }), message: t('skills.deleteMessage'), confirmLabel: t('common.delete') });
      if (ok) UI.withUndo(t('toast.deleted', { name: k.name }), () => Store.deleteSkill(k.id));
    },
    'skills-sort': (el) => { sort = el.value; App.rerender(); },
  });

  App.Pages.skills = { render, title: () => t('nav.skills'), nav: { icon: 'skills', order: 50 } };
})(window.App = window.App || {});
