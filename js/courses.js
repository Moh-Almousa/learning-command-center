/* Courses: filterable course library + a full course page with its module/lesson/task tree. */
(function (App) {
  'use strict';
  const U = App.U, UI = App.UI, M = App.Model, Store = App.Store;
  const t = (...a) => App.i18n.t(...a);
  const S = () => Store.state;

  const filters = { status: new Set(), track: '', provider: '', q: '' };

  function courses() {
    return M.order().filter((id) => S().nodes[id].type === 'course').map((id) => S().nodes[id]);
  }

  function chip(group, value, label, active) {
    return `<button class="chip-btn ${active ? 'active' : ''}" data-action="course-filter" data-group="${group}" data-value="${U.esc(value)}" aria-pressed="${active}">${U.esc(label)}</button>`;
  }

  function courseCard(c) {
    const info = M.info(c.id);
    const track = M.closest(c.id, 'track');
    const lessons = M.leavesOf(c.id).length;
    const url = U.safeUrl(c.url);
    return `<article class="card course-card st-${info.status} ${info.locked ? 'locked' : ''}">
      <div class="cc-top">
        <span class="provider">${U.esc(c.provider ? t('provider.' + c.provider) : t('provider.none'))}</span>
        ${info.locked ? `<span class="badge st-locked">${UI.icon('lock')}${U.esc(t('status.locked'))}</span>` : UI.statusBadge(info.status)}
      </div>
      <h2 class="cc-title"><a href="#/learn/${c.id}">${U.esc(c.title)}</a></h2>
      <p class="muted small">${U.esc(track ? track.title : '')}${c.estHours ? ` · ${U.esc(t('time.h', { h: c.estHours }))}` : ''}${c.targetDate ? ` · ${U.esc(t('field.targetDate'))} ${U.esc(U.fmtDate(c.targetDate))}` : ''}</p>
      ${UI.progress(info.pct, { size: 'sm', label: lessons ? t('common.itemsOf', { done: info.done, total: info.total }) : t('courses.noItems') })}
      <div class="btn-row cc-actions">
        ${UI.btn(t('common.open'), 'go', { cls: 'sm', data: { href: '#/learn/' + c.id } })}
        ${info.status !== 'completed' && info.status !== 'in_progress' ? UI.btn(t('actions.start'), 'node-status', { cls: 'sm ghost', icon: 'play', data: { id: c.id, value: 'in_progress' } }) : ''}
        ${UI.iconBtn('map', 'show-on-map', t('detail.showOnMap'), { id: c.id }, 'sm')}
        ${url ? `<a class="icon-btn sm" href="${U.esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${U.esc(t('courses.openLink'))}" title="${U.esc(t('courses.openLink'))}">${UI.icon('external')}</a>` : ''}
      </div>
    </article>`;
  }

  /** Finished courses stay available as history, newest first. */
  function completedSection() {
    const done = M.completedCourses();
    return `<section class="card mt" aria-labelledby="cc-h">
      <div class="section-head"><h2 id="cc-h">${UI.icon('done', 'st-completed')} ${U.esc(t('history.completedCourses'))}</h2><span class="muted small">${U.esc(t('history.completedCoursesHint'))}</span></div>
      ${done.length ? `<ul class="done-courses">${done.map((c) => {
        const first = M.firstCompleted(c);
        return `<li><a href="#/learn/${c.id}">${U.esc(c.title)}</a>
          <span class="muted small">${U.esc((M.closest(c.id, 'track') || {}).title || '')}</span>
          <span class="mono small">${first ? U.esc(t('history.completedOn', { date: U.fmtDate(first) })) : U.esc(t('history.dateUnknown'))}</span>
          ${App.Certificates.forNode(c.id).length ? `<button class="badge cert-st-earned" data-action="cert-preview" data-id="${App.Certificates.forNode(c.id)[0].id}">${UI.icon('award')}${U.esc(t('certs.one'))}</button>` : UI.btn(t('certs.add'), 'cert-add', { cls: 'sm ghost', icon: 'award', data: { node: c.id } })}
          ${c.completions.filter((x) => x.reopenedAt).length ? `<span class="badge">${U.esc(t('history.timesReopened', { n: c.completions.filter((x) => x.reopenedAt).length }))}</span>` : ''}</li>`;
      }).join('')}</ul>` : `<p class="muted small">${U.esc(t('history.noCompletedCourses'))}</p>`}
    </section>`;
  }

  function renderList(el) {
    const all = courses();
    const tracks = M.order().filter((id) => S().nodes[id].type === 'track').map((id) => S().nodes[id]);
    const providers = U.unique(all.map((c) => c.provider).filter(Boolean));
    const list = all.filter((c) => {
      const info = M.info(c.id);
      const st = info.locked ? 'locked' : info.status;
      if (filters.status.size && !filters.status.has(st) && !filters.status.has(info.status)) return false;
      if (filters.track && (!M.closest(c.id, 'track') || M.closest(c.id, 'track').id !== filters.track)) return false;
      if (filters.provider && c.provider !== filters.provider) return false;
      if (filters.q && !U.matches(c.title + ' ' + c.description + ' ' + c.category, filters.q)) return false;
      return true;
    });
    const done = all.filter((c) => M.status(c.id) === 'completed').length;

    el.innerHTML = `<header class="page-head">
        <div><h1>${U.esc(t('nav.courses'))}</h1><p class="muted">${U.esc(t('courses.subtitle', { done, total: all.length }))}</p></div>
        <div class="btn-row">${UI.btn(t('actions.addType', { type: t('type.course') }), 'course-add', { cls: 'primary', icon: 'plus' })}</div>
      </header>
      <div class="filter-bar" role="group" aria-label="${U.esc(t('filters.label'))}">
        <div class="chips">
          ${chip('status', '', t('filters.all'), !filters.status.size)}
          ${['not_started', 'in_progress', 'completed', 'skipped', 'locked'].map((s) => chip('status', s, t('status.' + s), filters.status.has(s))).join('')}
        </div>
        <select data-change="course-track" aria-label="${U.esc(t('type.track'))}">
          <option value="">${U.esc(t('filters.allTracks'))}</option>
          ${tracks.map((tr) => `<option value="${tr.id}" ${filters.track === tr.id ? 'selected' : ''}>${U.esc(tr.title)}</option>`).join('')}
        </select>
        <select data-change="course-provider" aria-label="${U.esc(t('field.provider'))}">
          <option value="">${U.esc(t('filters.allProviders'))}</option>
          ${providers.map((p) => `<option value="${p}" ${filters.provider === p ? 'selected' : ''}>${U.esc(t('provider.' + p))}</option>`).join('')}
        </select>
        <input type="search" id="course-q" placeholder="${U.esc(t('common.filter'))}" aria-label="${U.esc(t('common.filter'))}" value="${U.esc(filters.q)}">
      </div>
      ${list.length ? `<div class="course-grid">${list.map(courseCard).join('')}</div>` : UI.empty(all.length ? t('filters.noMatch') : t('courses.empty'))}
      ${completedSection()}`;

    const q = document.getElementById('course-q');
    q.addEventListener('input', U.debounce(() => { filters.q = q.value.trim(); App.rerender(); }, 200));
  }

  function render(el, params, sub) {
    if (sub) App.Learn.render(el, params, sub); else renderList(el);
  }

  UI.registerActions({
    'course-add': () => App.Detail.addNodeFlow('course', null).then((id) => { if (id) location.hash = '#/learn/' + id; }),
    'course-filter': (el) => {
      const v = el.dataset.value;
      if (!v) filters.status.clear();
      else if (filters.status.has(v)) filters.status.delete(v);
      else filters.status.add(v);
      App.rerender();
    },
    'course-track': (el) => { filters.track = el.value; App.rerender(); },
    'course-provider': (el) => { filters.provider = el.value; App.rerender(); },
    'go': (el) => { location.hash = el.dataset.href; },
  });

  App.Pages.courses = { render, title: () => t('nav.courses'), nav: { icon: 'book', order: 30 } };
})(window.App = window.App || {});
