/* Learning sessions + the activity log (daily timeline). */
(function (App) {
  'use strict';
  const U = App.U, UI = App.UI, M = App.Model, Store = App.Store;
  const t = (...a) => App.i18n.t(...a);
  const S = () => Store.state;

  let daysShown = 30;
  const hist = { types: new Set(), events: new Set(), sort: 'newest', limit: 150 };

  /* ------------------------------------------------------------------ */
  /* session form                                                        */
  /* ------------------------------------------------------------------ */

  async function sessionForm(prefill = {}) {
    const s = S();
    const existing = prefill.id ? s.sessions.find((x) => x.id === prefill.id) : null;
    const base = Object.assign({ date: U.dayKey(), minutes: 60, kind: 'learning', nodeId: '', projectId: '', note: '' }, existing || {}, prefill);
    const mins = Number(base.minutes) || 0;
    const nodeOpts = [{ value: '', label: '—' }, ...M.order()
      .filter((id) => ['track', 'course', 'module', 'lesson', 'task'].includes(s.nodes[id].type))
      .map((id) => ({ value: id, label: `${'· '.repeat(Math.max(0, M.info(id).depth - 1))}${s.nodes[id].title}` }))];
    const projOpts = [{ value: '', label: '—' }, ...s.projectOrder.map((id) => ({ value: id, label: s.projects[id].name }))];
    const v = await UI.form({
      title: existing ? t('activity.editSession') : t('activity.logSession'),
      fields: [
        { name: 'date', label: t('field.date'), type: 'date', required: true },
        { name: 'hours', label: t('field.hours'), type: 'number', min: 0, step: 1 },
        { name: 'mins', label: t('field.minutes'), type: 'number', min: 0, step: 5 },
        { name: 'kind', label: t('field.sessionKind'), type: 'select', options: [{ value: 'learning', label: t('activity.kindLearning') }, { value: 'project', label: t('activity.kindProject') }] },
        { name: 'nodeId', label: t('field.topic'), type: 'select', options: nodeOpts, full: true },
        { name: 'projectId', label: t('field.project'), type: 'select', options: projOpts, full: true },
        { name: 'note', label: t('field.whatDidYouDo'), type: 'textarea', rows: 3, full: true },
      ],
      values: Object.assign({}, base, { hours: Math.floor(mins / 60), mins: mins % 60, nodeId: base.nodeId || '', projectId: base.projectId || '' }),
      validate: (x) => ((Number(x.hours) || 0) * 60 + (Number(x.mins) || 0) > 0 ? null : t('errors.duration')),
      submitLabel: existing ? t('common.save') : t('activity.logIt'),
    });
    if (!v) return false;
    Store.saveSession({
      id: existing ? existing.id : undefined,
      date: v.date,
      minutes: (Number(v.hours) || 0) * 60 + (Number(v.mins) || 0),
      kind: v.kind,
      nodeId: v.nodeId || null,
      projectId: v.projectId || null,
      note: v.note,
    });
    UI.toast(t('activity.saved'));
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* feed                                                                */
  /* ------------------------------------------------------------------ */

  const ICONS = {
    complete: 'done', start: 'play', reopen: 'reset', skip: 'skip', add: 'plus', delete: 'trash', session: 'clock',
    certificate: 'award', project_created: 'folder', project_status: 'flag', milestone_done: 'flag', tech_added: 'applied', init: 'sparkle', linked: 'link',
  };

  function refLink(e) {
    const s = S();
    const title = U.esc(e.title || '');
    if (e.refKind === 'node' && s.nodes[e.refId]) return `<button class="link-btn" data-action="open-node" data-id="${e.refId}">${title}</button>`;
    if (e.refKind === 'ptask' && s.ptasks[e.refId]) return `<a href="#/projects/${e.projectId}?tab=tasks">${title}</a>`;
    if (e.refKind === 'project' && s.projects[e.refId]) return `<a href="#/projects/${e.refId}">${title}</a>`;
    return `<span class="fg">${title}</span>`;
  }

  /** "in Django" — the course (or path) an event belongs to. */
  function context(e) {
    if (e.refKind !== 'node' || !S().nodes[e.refId]) return '';
    const parent = ['lesson', 'task', 'module'].includes(e.nodeType) ? M.closest(e.refId, 'course') : ['course', 'track'].includes(e.nodeType) ? M.closest(e.refId, 'path') : null;
    return parent && parent.id !== e.refId ? ` <span class="muted">· ${U.esc(parent.title)}</span>` : '';
  }

  /** Progress this event caused, e.g. "Django 68% → 72% · Overall 15% → 16%". */
  function effectsLine(e) {
    if (!e.effects || !e.effects.length) return '';
    const shown = e.effects.filter((f) => ['overall', 'path', 'track', 'course', 'module'].includes(f.nodeType)).slice(0, 4);
    if (!shown.length) return '';
    return `<span class="effects">${shown.map((f) => `<span class="eff"><span class="eff-name">${U.esc(f.nodeType === 'overall' ? t('history.overallShort') : f.title)}</span> <span class="mono" dir="ltr">${f.from}% → ${f.to}%</span></span>`).join('')}</span>`;
  }

  function describe(e) {
    const s = S();
    const link = refLink(e);
    const what = e.nodeType ? t('type.' + e.nodeType).toLowerCase() : e.refKind === 'ptask' ? t('type.ptask').toLowerCase() : '';
    const proj = (e.projectId && s.projects[e.projectId] && e.refKind === 'ptask' ? ` <span class="muted">· ${U.esc(s.projects[e.projectId].name)}</span>` : '')
      + (e.refKind === 'listItem' && e.listName ? ` <span class="muted">· ${U.esc(e.listName)}</span>` : '') + context(e);
    switch (e.type) {
      case 'complete': return t('feed.completed', { what, link }) + proj;
      case 'start': return t('feed.started', { what, link }) + proj;
      case 'reopen': return t('feed.reopened', { what, link }) + proj;
      case 'skip': return t('feed.skipped', { what, link });
      case 'add': return t('feed.added', { what, link }) + proj;
      case 'delete': return t('feed.deleted', { link });
      case 'session': return t('feed.session', { time: U.esc(U.fmtMinutes(e.minutes)), link: link || t('feed.general') });
      case 'project_created': return t('feed.projectCreated', { link });
      case 'project_status': return t('feed.projectStatus', { link, from: U.esc(t('pstatus.' + e.from)), to: U.esc(t('pstatus.' + e.to)) });
      case 'milestone_done': return t('feed.milestone', { link: `<span class="fg">${U.esc(e.title)}</span>` }) + (e.projectId && s.projects[e.projectId] ? ` <span class="muted">· ${U.esc(s.projects[e.projectId].name)}</span>` : '');
      case 'tech_added': return t('feed.techAdded', { link: `<span class="fg">${U.esc(e.title)}</span>` }) + (e.projectId && s.projects[e.projectId] ? ` <span class="muted">· ${U.esc(s.projects[e.projectId].name)}</span>` : '');
      case 'init': return U.esc(t('feed.init'));
      case 'certificate': return t('feed.certificate', { link: s.certificates.some((c) => c.id === e.refId) ? `<button class="link-btn" data-action="cert-preview" data-id="${e.refId}">${U.esc(e.title)}</button>` : `<span class="fg">${U.esc(e.title)}</span>` })
        + (e.nodeId && s.nodes[e.nodeId] ? ` <span class="muted">· ${U.esc(s.nodes[e.nodeId].title)}</span>` : '');
      case 'linked': return t('feed.linked', { name: `<span class="fg">${U.esc(e.title)}</span>`, link: s.projects[e.projectId] ? `<a href="#/projects/${e.projectId}">${U.esc(s.projects[e.projectId].name)}</a>` : '' });
      default: return link;
    }
  }

  function feed(entries) {
    if (!entries.length) return `<p class="muted small">${U.esc(t('activity.empty'))}</p>`;
    return `<ul class="feed">${entries.map((e) => `<li class="fd-${e.type}">${UI.icon(ICONS[e.type] || 'activity', e.type === 'complete' ? 'st-completed' : '')}
      <div><span>${describe(e)}</span>${effectsLine(e)}<span class="muted small">${U.esc(U.relDay(e.ts))} · ${U.esc(U.fmtTime(e.ts))}</span></div></li>`).join('')}</ul>`;
  }

  /* ------------------------------------------------------------------ */
  /* history view (#/activity?view=history)                              */
  /* ------------------------------------------------------------------ */

  const TYPE_GROUPS = {
    paths: (k) => k === 'path' || k === 'track', courses: (k) => k === 'course', modules: (k) => k === 'module',
    lessons: (k) => k === 'lesson', tasks: (k) => k === 'task', projects: (k) => k === 'project',
  };

  function historyRows() {
    const s = S();
    const kindOf = (e) => (e.refKind === 'node' ? e.nodeType : ['ptask', 'project'].includes(e.refKind) || e.projectId ? 'project' : e.refKind);
    let rows = [];
    const wantProgress = hist.events.has('progress');
    const eventFilters = new Set([...hist.events].filter((x) => x !== 'progress'));
    if (!hist.events.size || eventFilters.size) {
      s.activity.forEach((e) => {
        if (eventFilters.size && !((eventFilters.has('completed') && e.type === 'complete') || (eventFilters.has('reopened') && e.type === 'reopen') || (eventFilters.has('started') && e.type === 'start'))) return;
        rows.push({ ts: e.ts, kind: kindOf(e), e });
      });
    }
    if (wantProgress) s.progressLog.forEach((r) => rows.push({ ts: r.ts, kind: r.nodeType, r }));
    if (hist.types.size) rows = rows.filter((row) => [...hist.types].some((g) => TYPE_GROUPS[g](row.kind)));
    rows.sort((a, b) => (hist.sort === 'oldest' ? a.ts - b.ts : b.ts - a.ts));
    return rows;
  }

  function historyRow(row) {
    if (row.e) {
      const e = row.e;
      return `<li class="fd-${e.type}">${UI.icon(ICONS[e.type] || 'activity', e.type === 'complete' ? 'st-completed' : '')}
        <div><span>${describe(e)}</span>${effectsLine(e)}
        ${e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus && e.refKind === 'node' ? `<span class="muted small">${U.esc(t('status.' + e.fromStatus))} ${t('common.arrow')} ${U.esc(t('status.' + e.toStatus))}</span>` : ''}
        <span class="muted small">${U.esc(U.fmtTime(e.ts))}</span></div></li>`;
    }
    const r = row.r;
    const n = S().nodes[r.id];
    const name = r.id === Store.OVERALL ? U.esc(t('history.overallShort')) : n ? `<a href="#/learn/${r.id}">${U.esc(n.title)}</a>` : U.esc(r.title);
    return `<li class="fd-progress">${UI.icon('chart', r.to >= r.from ? 'st-completed' : 'warn')}
      <div><span>${t('history.progressRow', { name, type: U.esc(r.nodeType === 'overall' ? '' : t('type.' + r.nodeType)), from: r.from, to: r.to })}</span>
      <span class="muted small">${U.esc(U.fmtTime(r.ts))}</span></div></li>`;
  }

  function renderHistory() {
    const rows = historyRows();
    const shown = rows.slice(0, hist.limit);
    let lastDay = null;
    const items = shown.map((row) => {
      const day = U.dayKey(new Date(row.ts));
      const head = day !== lastDay ? `<li class="feed-day" role="presentation"><h3>${U.esc(U.fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</h3></li>` : '';
      lastDay = day;
      return head + historyRow(row);
    }).join('');
    const chip = (group, value, label, active) => `<button class="chip-btn ${active ? 'active' : ''}" data-action="hist-filter" data-group="${group}" data-value="${value}" aria-pressed="${active}">${U.esc(label)}</button>`;
    return `<div class="filter-bar" role="group" aria-label="${U.esc(t('filters.label'))}">
        <div class="chips">
          ${chip('all', '', t('filters.all'), !hist.types.size && !hist.events.size)}
          ${Object.keys(TYPE_GROUPS).map((g) => chip('types', g, t('history.f_' + g), hist.types.has(g))).join('')}
        </div>
        <div class="chips">
          ${['completed', 'started', 'reopened', 'progress'].map((g) => chip('events', g, t('history.f_' + g), hist.events.has(g))).join('')}
        </div>
        <select data-change="hist-sort" aria-label="${U.esc(t('filters.sort'))}">
          <option value="newest" ${hist.sort === 'newest' ? 'selected' : ''}>${U.esc(t('history.newest'))}</option>
          <option value="oldest" ${hist.sort === 'oldest' ? 'selected' : ''}>${U.esc(t('history.oldest'))}</option>
        </select>
      </div>
      <p class="muted small">${U.esc(t('history.count', { n: rows.length }))}</p>
      ${rows.length ? `<ul class="feed history card">${items}</ul>` : UI.empty(t('filters.noMatch'))}
      ${rows.length > hist.limit ? `<div class="center mt">${UI.btn(t('activity.showMore'), 'hist-more', { cls: 'ghost' })}</div>` : ''}`;
  }

  /* ------------------------------------------------------------------ */
  /* page                                                                */
  /* ------------------------------------------------------------------ */

  function dayData(key) {
    const s = S();
    const sessions = s.sessions.filter((x) => x.date === key);
    const nodes = M.completedBetween(key, key);
    const ptasks = M.ptasksCompletedBetween(key, key);
    return { sessions, nodes, ptasks, minutes: sessions.reduce((a, x) => a + (Number(x.minutes) || 0), 0) };
  }

  function sessionTitle(x) {
    const s = S();
    if (x.nodeId && s.nodes[x.nodeId]) return `<button class="link-btn" data-action="open-node" data-id="${x.nodeId}">${U.esc(s.nodes[x.nodeId].title)}</button>`;
    if (x.projectId && s.projects[x.projectId]) return `<a href="#/projects/${x.projectId}">${U.esc(s.projects[x.projectId].name)}</a>`;
    return `<span>${U.esc(t(x.kind === 'project' ? 'activity.kindProject' : 'activity.kindLearning'))}</span>`;
  }

  function render(el, params = {}) {
    const s = S();
    const view = params.view === 'history' ? 'history' : 'days';
    const tabs = `<div class="segment" role="group" aria-label="${U.esc(t('projects.view'))}">
      <a class="seg-btn ${view === 'days' ? 'active' : ''}" href="#/activity" aria-current="${view === 'days'}">${UI.icon('clock')}<span>${U.esc(t('history.byDay'))}</span></a>
      <a class="seg-btn ${view === 'history' ? 'active' : ''}" href="#/activity?view=history" aria-current="${view === 'history'}">${UI.icon('activity')}<span>${U.esc(t('history.title'))}</span></a>
    </div>`;
    if (view === 'history') {
      el.innerHTML = `<header class="page-head"><div><h1>${U.esc(t('history.title'))}</h1><p class="muted">${U.esc(t('history.subtitle'))}</p></div>${tabs}</header>${renderHistory()}`;
      return;
    }
    const today = U.dayKey();
    const from = U.addDays(today, -(daysShown - 1));
    const days = new Set();
    s.sessions.forEach((x) => { if (x.date >= from) days.add(x.date); });
    M.completedBetween(from, today).forEach((n) => days.add(U.dayKey(new Date(n.completedAt))));
    M.ptasksCompletedBetween(from, today).forEach((x) => days.add(U.dayKey(new Date(x.completedAt))));
    const sorted = Array.from(days).sort().reverse();
    const older = s.sessions.some((x) => x.date < from) || Object.values(s.nodes).some((n) => n.completedAt && U.dayKey(new Date(n.completedAt)) < from);
    const total = M.minutesBetween(from, today);

    el.innerHTML = `<header class="page-head">
        <div><h1>${U.esc(t('activity.title'))}</h1><p class="muted">${U.esc(t('activity.subtitle', { days: daysShown, time: U.fmtMinutes(total) }))}</p></div>
        <div class="btn-row">${tabs}${UI.btn(t('activity.logSession'), 'log-session', { cls: 'primary', icon: 'plus' })}</div>
      </header>
      <div class="timeline">
      ${sorted.length ? sorted.map((key) => {
        const d = dayData(key);
        const lessons = d.nodes.filter((n) => n.type === 'lesson').length;
        const tasks = d.nodes.filter((n) => n.type === 'task').length;
        const other = d.nodes.length - lessons - tasks;
        const summary = [
          d.minutes ? U.fmtMinutes(d.minutes) : null,
          lessons ? t('activity.nLessons', { n: lessons }) : null,
          tasks ? t('activity.nTasks', { n: tasks }) : null,
          other ? t('activity.nOther', { n: other }) : null,
          d.ptasks.length ? t('activity.nProjectTasks', { n: d.ptasks.length }) : null,
        ].filter(Boolean).join(' · ');
        return `<section class="day card" aria-labelledby="d-${key}">
          <header class="day-head"><h2 id="d-${key}">${U.esc(U.fmtDate(key, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}</h2><span class="mono small muted">${U.esc(summary)}</span></header>
          ${d.sessions.length ? `<ul class="sessions">${d.sessions.map((x) => `<li>
            ${UI.icon('clock')}<span class="mono dur">${U.esc(U.fmtMinutes(x.minutes))}</span>
            <div class="sess-main">${sessionTitle(x)}${x.note ? `<p class="small muted pre">${U.esc(x.note)}</p>` : ''}</div>
            <span class="sess-kind">${U.esc(t(x.kind === 'project' ? 'activity.kindProject' : 'activity.kindLearning'))}</span>
            ${UI.iconBtn('edit', 'session-edit', t('common.edit'), { id: x.id }, 'sm')}
            ${UI.iconBtn('trash', 'session-delete', t('common.delete'), { id: x.id }, 'sm danger')}
          </li>`).join('')}</ul>` : ''}
          ${d.nodes.length || d.ptasks.length ? `<ul class="done-list">
            ${d.nodes.map((n) => `<li>${UI.icon('done', 'st-completed')}<button class="link-btn" data-action="open-node" data-id="${n.id}">${U.esc(n.title)}</button><span class="muted small">${U.esc(t('type.' + n.type))}</span></li>`).join('')}
            ${d.ptasks.map((x) => `<li>${UI.icon('done', 'st-completed')}<a href="#/projects/${x.projectId}?tab=tasks">${U.esc(x.title)}</a><span class="muted small">${U.esc(s.projects[x.projectId].name)}</span></li>`).join('')}
          </ul>` : ''}
        </section>`;
      }).join('') : UI.empty(t('activity.emptyRange'), UI.btn(t('activity.logSession'), 'log-session', { cls: 'primary', icon: 'plus' }))}
      </div>
      ${older ? `<div class="center mt">${UI.btn(t('activity.showMore'), 'activity-more', { cls: 'ghost' })}</div>` : ''}
      <section class="card mt" aria-labelledby="log-h"><h2 id="log-h">${U.esc(t('activity.log'))}</h2>${feed(s.activity.slice(0, 40))}</section>`;
  }

  UI.registerActions({
    'session-edit': (el) => sessionForm({ id: el.dataset.id }),
    'session-delete': async (el) => {
      const ok = await UI.confirm({ title: t('activity.deleteTitle'), message: t('activity.deleteMessage'), confirmLabel: t('common.delete') });
      if (ok) UI.withUndo(t('activity.deleted'), () => Store.deleteSession(el.dataset.id));
    },
    'activity-more': () => { daysShown += 60; App.rerender(); },
    'hist-filter': (el) => {
      const g = el.dataset.group, v = el.dataset.value;
      if (g === 'all') { hist.types.clear(); hist.events.clear(); }
      else { const set = hist[g]; if (set.has(v)) set.delete(v); else set.add(v); }
      hist.limit = 150;
      App.rerender();
    },
    'hist-sort': (el) => { hist.sort = el.value; App.rerender(); },
    'hist-more': () => { hist.limit += 300; App.rerender(); },
  });

  App.Activity = { sessionForm, feed, describe, effectsLine };
  App.Pages.activity = { render, title: () => t('nav.activity'), nav: { icon: 'activity', order: 80 } };
})(window.App = window.App || {});
