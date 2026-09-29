/* Weekly Review: everything computed from real data for any week, plus your own focus/reflection notes. */
(function (App) {
  'use strict';
  const U = App.U, UI = App.UI, M = App.Model, Store = App.Store;
  const t = (...a) => App.i18n.t(...a);
  const S = () => Store.state;

  let offset = 0; // 0 = this week, -1 = last week …

  function render(el) {
    const s = S();
    const start = U.addDays(U.weekStartKey(U.dayKey(), s.settings.weekStart), offset * 7);
    const end = U.addDays(start, 6);
    const nodes = M.completedBetween(start, end);
    const leaves = nodes.filter((n) => !n.children.length);
    const lessons = nodes.filter((n) => n.type === 'lesson');
    const ltasks = nodes.filter((n) => n.type === 'task');
    const ptasks = M.ptasksCompletedBetween(start, end);
    const minutes = M.minutesBetween(start, end);
    const days = Array.from(M.activeDays()).filter((d) => d >= start && d <= end).length;

    // Courses that moved forward this week.
    const courseMap = new Map();
    leaves.forEach((n) => { const c = M.closest(n.id, 'course'); if (c) courseMap.set(c.id, (courseMap.get(c.id) || 0) + 1); });
    const projMap = new Map();
    ptasks.forEach((x) => projMap.set(x.projectId, (projMap.get(x.projectId) || 0) + 1));

    // Not finished: planned-for-today items left open, due dates missed, work still in progress.
    const planned = [];
    const seen = new Set();
    Object.keys(s.today).filter((k) => k >= start && k <= end).forEach((k) => s.today[k].forEach((it) => {
      const key = it.kind + ':' + (it.refId || it.text);
      if (seen.has(key)) return;
      seen.add(key);
      const done = it.kind === 'node' && s.nodes[it.refId] ? !M.isOpen(it.refId) : it.kind === 'ptask' && s.ptasks[it.refId] ? s.ptasks[it.refId].status === 'completed' : it.done;
      if (!done) planned.push(it);
    }));
    const dueMissed = [
      ...Object.values(s.ptasks).filter((x) => x.dueDate && x.dueDate <= end && x.status !== 'completed').map((x) => ({ html: `<a href="#/projects/${x.projectId}?tab=tasks">${U.esc(x.title)}</a>`, sub: s.projects[x.projectId].name, due: x.dueDate })),
      ...Object.values(s.nodes).filter((n) => n.targetDate && n.targetDate <= end && M.isOpen(n.id)).map((n) => ({ html: `<button class="link-btn" data-action="open-node" data-id="${n.id}">${U.esc(n.title)}</button>`, sub: t('type.' + n.type), due: n.targetDate })),
    ];
    const stuck = M.leaves().filter((id) => s.nodes[id].status === 'in_progress').slice(0, 8);

    const review = s.reviews[start] || {};
    const suggestions = M.upcoming(5);
    const hot = Object.values(s.ptasks).filter((x) => x.status !== 'completed' && ['critical', 'high'].includes(x.priority)).slice(0, 5);
    const isCurrent = offset === 0;

    el.innerHTML = `<header class="page-head">
        <div><h1>${U.esc(t('review.title'))}</h1><p class="muted">${U.esc(U.fmtDate(start, { day: 'numeric', month: 'short' }))} – ${U.esc(U.fmtDate(end))}${isCurrent ? ' · ' + U.esc(t('review.thisWeek')) : ''}</p></div>
        <div class="btn-row">
          ${UI.btn(t('review.prev'), 'review-week', { cls: 'ghost', data: { value: -1 } })}
          ${!isCurrent ? UI.btn(t('review.current'), 'review-week', { cls: 'ghost', data: { value: 0 } }) : ''}
          ${!isCurrent ? UI.btn(t('review.next'), 'review-week', { cls: 'ghost', data: { value: 1 } }) : ''}
        </div>
      </header>
      <section class="kpis" aria-label="${U.esc(t('dashboard.summary'))}">
        <div class="kpi"><span class="kpi-label">${U.esc(t('review.lessons'))}</span><span class="kpi-value mono">${lessons.length}</span></div>
        <div class="kpi"><span class="kpi-label">${U.esc(t('review.tasks'))}</span><span class="kpi-value mono">${ltasks.length}</span></div>
        <div class="kpi"><span class="kpi-label">${U.esc(t('review.projectTasks'))}</span><span class="kpi-value mono">${ptasks.length}</span></div>
        <div class="kpi"><span class="kpi-label">${U.esc(t('review.hours'))}</span><span class="kpi-value mono">${U.esc(U.fmtHours(minutes))}</span></div>
        <div class="kpi"><span class="kpi-label">${U.esc(t('review.activeDays'))}</span><span class="kpi-value mono">${days}<small>/7</small></span></div>
      </section>
      <div class="ws-grid mt">
        <section class="card"><h2>${U.esc(t('review.accomplished'))}</h2>
          ${nodes.length || ptasks.length ? `<ul class="feed">
            ${nodes.map((n) => `<li>${UI.icon('done', 'st-completed')}<div><button class="link-btn" data-action="open-node" data-id="${n.id}">${U.esc(n.title)}</button><span class="muted small">${U.esc(t('type.' + n.type))}${M.closest(n.id, 'course') && n.type !== 'course' ? ' · ' + U.esc(M.closest(n.id, 'course').title) : ''}</span></div></li>`).join('')}
            ${ptasks.map((x) => `<li>${UI.icon('done', 'st-completed')}<div><a href="#/projects/${x.projectId}?tab=tasks">${U.esc(x.title)}</a><span class="muted small">${U.esc(s.projects[x.projectId].name)}</span></div></li>`).join('')}
          </ul>` : `<p class="muted small">${U.esc(t('review.nothingDone'))}</p>`}
        </section>
        <section class="card"><h2>${U.esc(t('review.progressed'))}</h2>
          ${courseMap.size || projMap.size ? `<ul class="bar-list">
            ${Array.from(courseMap).map(([id, n]) => `<li><span class="bl-label"><button class="link-btn" data-action="open-node" data-id="${id}">${U.esc(s.nodes[id].title)}</button> <span class="muted small">+${n}</span></span>${UI.progress(M.pct(id), { size: 'xs', hideValue: true, aria: s.nodes[id].title })}<span class="mono small">${M.pct(id)}%</span></li>`).join('')}
            ${Array.from(projMap).map(([id, n]) => `<li><span class="bl-label"><a href="#/projects/${id}">${U.esc(s.projects[id].name)}</a> <span class="muted small">+${n}</span></span>${UI.progress(M.projectStats(id).pct, { size: 'xs', hideValue: true, aria: s.projects[id].name })}<span class="mono small">${M.projectStats(id).pct}%</span></li>`).join('')}
          </ul>` : `<p class="muted small">${U.esc(t('review.noProgress'))}</p>`}
        </section>
        <section class="card"><h2>${U.esc(t('review.notDone'))}</h2>
          ${planned.length ? `<h3 class="mini-h">${U.esc(t('review.plannedOpen'))}</h3><ul class="mini-list">${planned.map((it) => `<li>${UI.icon('circle', 'muted')}<span>${U.esc(it.text)}</span></li>`).join('')}</ul>` : ''}
          ${dueMissed.length ? `<h3 class="mini-h">${U.esc(t('review.dueMissed'))}</h3><ul class="mini-list">${dueMissed.map((d) => `<li>${UI.icon('clock', 'warn')}${d.html}<span class="muted small">${U.esc(d.sub)} · ${U.esc(U.fmtDate(d.due, { day: 'numeric', month: 'short' }))}</span></li>`).join('')}</ul>` : ''}
          ${stuck.length ? `<h3 class="mini-h">${U.esc(t('review.stillOpen'))}</h3><ul class="mini-list">${stuck.map((id) => `<li>${UI.icon('half', 'st-in_progress')}<button class="link-btn" data-action="open-node" data-id="${id}">${U.esc(s.nodes[id].title)}</button></li>`).join('')}</ul>` : ''}
          ${!planned.length && !dueMissed.length && !stuck.length ? `<p class="muted small">${U.esc(t('review.allClear'))}</p>` : ''}
        </section>
        <section class="card"><h2><label for="rv-focus">${U.esc(t('review.nextFocus'))}</label></h2>
          <textarea id="rv-focus" rows="4" data-review="${start}" data-field="focus" placeholder="${U.esc(t('review.focusPh'))}">${U.esc(review.focus || '')}</textarea>
          <h3 class="mini-h">${U.esc(t('review.suggested'))}</h3>
          <ul class="mini-list">${suggestions.map((id) => `<li>${UI.icon('arrow')}<button class="link-btn" data-action="open-node" data-id="${id}">${U.esc(s.nodes[id].title)}</button><span class="muted small">${U.esc((M.closest(id, 'course') || {}).title || '')}</span></li>`).join('')}
            ${hot.map((x) => `<li>${UI.icon('flag')}<a href="#/projects/${x.projectId}?tab=tasks">${U.esc(x.title)}</a>${UI.priorityBadge(x.priority)}</li>`).join('')}</ul>
          ${UI.btn(t('review.useSuggestions'), 'review-suggest', { cls: 'sm ghost mt', data: { week: start } })}
          <h3 class="mini-h"><label for="rv-reflect">${U.esc(t('review.reflection'))}</label></h3>
          <textarea id="rv-reflect" rows="4" data-review="${start}" data-field="reflection" placeholder="${U.esc(t('review.reflectPh'))}">${U.esc(review.reflection || '')}</textarea>
          <p class="help" data-save-state>${U.esc(t('detail.notesAutosave'))}</p>
        </section>
      </div>`;
  }

  const save = U.debounce((el) => {
    Store.setReview(el.dataset.review, { [el.dataset.field]: el.value });
    const hint = document.querySelector('[data-save-state]');
    if (hint) hint.textContent = t('detail.notesSaved');
  }, 400);
  document.addEventListener('input', (e) => { const el = e.target.closest('textarea[data-review]'); if (el) save(el); });

  UI.registerActions({
    'review-week': (el) => { const v = Number(el.dataset.value); offset = v === 0 ? 0 : Math.min(0, offset + v); App.rerender(); },
    'review-suggest': (el) => {
      const s = S();
      const lines = [...M.upcoming(5).map((id) => '- ' + s.nodes[id].title),
        ...Object.values(s.ptasks).filter((x) => x.status !== 'completed' && ['critical', 'high'].includes(x.priority)).slice(0, 5).map((x) => `- ${x.title} (${s.projects[x.projectId].name})`)];
      const cur = (s.reviews[el.dataset.week] || {}).focus || '';
      Store.setReview(el.dataset.week, { focus: (cur ? cur + '\n' : '') + lines.join('\n') });
      App.rerender();
    },
  });

  App.Pages.review = { render, title: () => t('nav.review'), nav: { icon: 'review', order: 100 } };
})(window.App = window.App || {});
