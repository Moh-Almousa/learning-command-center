/* Dashboard: welcome, where you are, today's plan, next step, progress, recent activity. */
(function (App) {
  'use strict';
  const U = App.U, UI = App.UI, M = App.Model, Store = App.Store;
  const t = (...a) => App.i18n.t(...a);
  const S = () => Store.state;

  function breadcrumb(id) {
    return M.breadcrumb(id).map((n, i, arr) => `<button class="crumb ${i === arr.length - 1 ? 'last' : ''}" data-action="open-node" data-id="${n.id}">${U.esc(n.title)}</button>`)
      .join(`<span class="crumb-sep" aria-hidden="true">${t('common.arrow')}</span>`);
  }

  /** Overall → path → course → module → lesson → task, each with its own progress. */
  function hierarchyCard(cur) {
    const s = S();
    const pinned = s.settings.focusNodeId && s.nodes[s.settings.focusNodeId];
    const steps = [
      { key: 'overall', label: t('history.overallShort'), pct: M.overall().pct, href: '#/roadmap', title: t('dashboard.overall') },
      cur.path ? { key: 'path', node: cur.path } : null,
      cur.track ? { key: 'track', node: cur.track } : null,
      cur.course ? { key: 'course', node: cur.course } : null,
      cur.module ? { key: 'module', node: cur.module } : null,
      cur.lesson ? { key: 'lesson', node: cur.lesson } : null,
      cur.task ? { key: 'task', node: cur.task } : null,
    ].filter(Boolean);
    return `<section class="card hier-card" aria-labelledby="hier-h">
      <div class="section-head">
        <h2 id="hier-h">${UI.icon('target')} ${U.esc(t('dashboard.whereYouAre'))}</h2>
        ${pinned ? `<span class="small muted">${UI.icon('flag')} ${U.esc(t('dashboard.pinnedFocus'))}: <a href="#/learn/${pinned.id}">${U.esc(pinned.title)}</a> <span class="mono">${M.pct(pinned.id)}%</span></span>` : ''}
      </div>
      <ol class="hier-steps">${steps.map((st) => {
        if (!st.node) return `<li class="hs-step"><span class="hs-level">${U.esc(st.label)}</span><a class="hs-title" href="${st.href}">${U.esc(st.title)}</a>${UI.progress(st.pct, { size: 'xs', hideValue: true, aria: st.title })}<span class="mono small">${st.pct}%</span></li>`;
        const n = st.node, i = M.info(n.id);
        const leaf = !n.children.length;
        return `<li class="hs-step st-${i.status}"><span class="hs-level">${U.esc(t('type.' + st.key))}</span>
          <a class="hs-title" href="#/learn/${n.id}">${U.esc(n.title)}</a>
          ${leaf ? UI.statusBadge(i.status) : `${UI.progress(i.pct, { size: 'xs', hideValue: true, aria: n.title })}<span class="mono small">${i.pct}%</span>`}</li>`;
      }).join('')}</ol>
    </section>`;
  }

  function completedCoursesCard() {
    const done = M.completedCourses().slice(0, 6);
    return `<article class="card" aria-labelledby="dcc-h"><div class="section-head"><h2 id="dcc-h">${U.esc(t('history.completedCourses'))}</h2><a class="small" href="#/courses">${U.esc(t('common.viewAll'))}</a></div>
      ${done.length ? `<ul class="feed">${done.map((c) => {
        const first = M.firstCompleted(c);
        return `<li>${UI.icon('done', 'st-completed')}<div><a href="#/learn/${c.id}">${U.esc(c.title)}</a><span class="muted small">${first ? U.esc(t('history.completedOn', { date: U.fmtDate(first) })) : U.esc(t('history.dateUnknown'))}</span></div></li>`;
      }).join('')}</ul>` : `<p class="muted small">${U.esc(t('history.noCompletedCourses'))}</p>`}
    </article>`;
  }

  function todayCard(opts = {}) {
    const s = S();
    const key = U.dayKey();
    const items = s.today[key] || [];
    const done = items.filter((x) => x.done).length;
    const minutes = M.minutesBetween(key, key);
    const goal = Number(s.settings.dailyGoalMinutes) || 0;
    const prevKeys = Object.keys(s.today).filter((k) => k < key).sort();
    const carry = prevKeys.length && s.today[prevKeys[prevKeys.length - 1]].some((x) => !x.done);
    const rows = items.map((it) => {
      const link = it.kind === 'node' && s.nodes[it.refId]
        ? `<button class="link-btn" data-action="open-node" data-id="${it.refId}">${U.esc(s.nodes[it.refId].title)}</button>`
        : it.kind === 'ptask' && s.ptasks[it.refId]
          ? `<a href="#/projects/${s.ptasks[it.refId].projectId}?tab=tasks">${U.esc(s.ptasks[it.refId].title)}</a>`
          : `<span>${U.esc(it.text)}</span>`;
      const sub = it.kind === 'ptask' && s.ptasks[it.refId] ? s.projects[s.ptasks[it.refId].projectId].name
        : it.kind === 'node' && s.nodes[it.refId] ? ((M.closest(it.refId, 'course') || {}).title || '') : '';
      return `<li class="today-item ${it.done ? 'done' : ''}">
        <button class="check ${it.done ? 'on' : ''}" data-action="today-toggle" data-id="${it.id}" aria-pressed="${it.done}" aria-label="${U.esc((it.done ? t('actions.markNotDone', { name: it.text }) : t('actions.markDone', { name: it.text })))}">${UI.icon('check')}</button>
        <div class="today-text">${link}${sub ? `<span class="muted small">${U.esc(sub)}</span>` : ''}</div>
        ${UI.iconBtn('x', 'today-remove', t('today.remove', { name: it.text }), { id: it.id }, 'sm')}
      </li>`;
    }).join('');
    return `<article class="card today-card ${opts.cls || ''}" aria-labelledby="today-h">
      <div class="section-head">
        <h2 id="today-h">${U.esc(t('today.title'))}</h2>
        <div class="btn-row">
          ${carry ? UI.btn(t('today.carry'), 'today-carry', { cls: 'sm ghost' }) : ''}
          ${UI.btn(t('today.pick'), 'today-pick', { cls: 'sm', icon: 'plus' })}
        </div>
      </div>
      ${items.length ? UI.progress(U.pct(done, items.length), { label: t('today.progress', { done, total: items.length }) }) : ''}
      ${items.length ? `<ul class="today-list">${rows}</ul>` : `<p class="muted small">${U.esc(t('today.empty'))}</p>`}
      <div class="inline-add">
        <input type="text" id="today-input" placeholder="${U.esc(t('today.placeholder'))}" aria-label="${U.esc(t('today.placeholder'))}" data-enter="today-add-text">
        ${UI.btn(t('common.add'), 'today-add-text', { cls: 'sm' })}
      </div>
      <p class="muted small today-time">${UI.icon('clock')} ${U.esc(t('today.time', { time: U.fmtMinutes(minutes), goal: U.fmtMinutes(goal) }))}</p>
      ${goal ? UI.progress(Math.min(100, U.pct(minutes, goal)), { size: 'xs', hideValue: true, aria: t('today.goalAria'), tone: 'amber' }) : ''}
    </article>`;
  }

  function nextCard() {
    const s = S();
    const rec = M.recommendation();
    if (!rec) return `<article class="card"><h2>${U.esc(t('dashboard.nextUp'))}</h2><p class="muted">${U.esc(t('dashboard.allDone'))}</p></article>`;
    const n = s.nodes[rec.id];
    const reason = rec.reason === 'continue' ? t('dashboard.reasonContinue')
      : rec.reason === 'after' ? t('dashboard.reasonAfter', { name: s.nodes[rec.afterId].title })
        : t('dashboard.reasonStart');
    const info = M.info(rec.id);
    const upcoming = M.upcoming(4).slice(1);
    return `<article class="card next-card" aria-labelledby="next-h">
      <h2 id="next-h" class="card-kicker">${UI.icon('sparkle')} ${U.esc(t('dashboard.nextUp'))}</h2>
      <p class="muted small">${U.esc(reason)}</p>
      <p class="next-title"><button class="link-btn" data-action="open-node" data-id="${n.id}">${U.esc(n.title)}</button></p>
      <p class="crumb-line small">${M.ancestors(n.id).slice(1).map((a) => U.esc(a.title)).join(` ${t('common.arrow')} `)}</p>
      ${info.locked ? `<p class="lock-note small">${UI.icon('lock')} ${U.esc(t('detail.lockedBy'))} ${info.unmet.map((p) => U.esc(s.nodes[p].title)).join(', ')}</p>` : ''}
      <div class="btn-row">
        ${n.status !== 'in_progress' ? UI.btn(t('actions.start'), 'node-status', { cls: 'sm primary', icon: 'play', data: { id: n.id, value: 'in_progress' } }) : ''}
        ${UI.btn(t('actions.markComplete'), 'node-status', { cls: 'sm', icon: 'check', data: { id: n.id, value: 'completed' } })}
        ${UI.btn(t('today.add'), 'today-add-node', { cls: 'sm ghost', icon: 'plus', data: { id: n.id } })}
      </div>
      ${upcoming.length ? `<h3 class="mini-h">${U.esc(t('dashboard.thenUp'))}</h3><ol class="up-list">${upcoming.map((id) => `<li><button class="link-btn" data-action="open-node" data-id="${id}">${U.esc(s.nodes[id].title)}</button><span class="muted small">${U.esc((M.closest(id, 'course') || {}).title || '')}</span></li>`).join('')}</ol>` : ''}
    </article>`;
  }

  function recentCompleted() {
    const s = S();
    const items = [
      ...Object.values(s.nodes).filter((n) => n.status === 'completed' && n.completedAt).map((n) => ({ ts: n.completedAt, html: `<button class="link-btn" data-action="open-node" data-id="${n.id}">${U.esc(n.title)}</button>`, sub: t('type.' + n.type) })),
      ...Object.values(s.ptasks).filter((x) => x.status === 'completed' && x.completedAt).map((x) => ({ ts: x.completedAt, html: `<a href="#/projects/${x.projectId}?tab=tasks">${U.esc(x.title)}</a>`, sub: s.projects[x.projectId].name })),
    ].sort((a, b) => b.ts - a.ts).slice(0, 6);
    return `<article class="card" aria-labelledby="rc-h"><h2 id="rc-h">${U.esc(t('dashboard.recentlyCompleted'))}</h2>
      ${items.length ? `<ul class="feed">${items.map((i) => `<li>${UI.icon('done', 'st-completed')}<div>${i.html}<span class="muted small">${U.esc(i.sub)} · ${U.esc(U.relDay(i.ts))}</span></div></li>`).join('')}</ul>` : `<p class="muted small">${U.esc(t('dashboard.noneCompleted'))}</p>`}
    </article>`;
  }

  function projectsCard() {
    const s = S();
    const active = s.projectOrder.map((id) => s.projects[id]).filter((p) => ['in_progress', 'planning', 'ready'].includes(p.status)).slice(0, 4);
    return `<article class="card" aria-labelledby="ap-h">
      <div class="section-head"><h2 id="ap-h">${U.esc(t('dashboard.activeProjects'))}</h2><a class="small" href="#/projects">${U.esc(t('common.viewAll'))}</a></div>
      ${active.length ? `<ul class="proj-mini">${active.map((p) => {
        const st = M.projectStats(p.id);
        return `<li><a href="#/projects/${p.id}" class="pm-name">${U.esc(p.name)}</a>${UI.projectStatusBadge(p.status)}
          ${UI.progress(st.pct, { size: 'xs', label: t('projects.tasksDone', { done: st.done, total: st.total }) })}
          ${st.current ? `<p class="small muted">${UI.icon('play')} ${U.esc(t('projects.currentTask'))}: <span class="fg">${U.esc(st.current.title)}</span></p>` : st.next ? `<p class="small muted">${UI.icon('arrow')} ${U.esc(t('projects.nextTask'))}: <span class="fg">${U.esc(st.next.title)}</span></p>` : ''}
        </li>`;
      }).join('')}</ul>` : `<p class="muted small">${U.esc(t('dashboard.noActiveProjects'))}</p>`}
    </article>`;
  }

  function render(el) {
    const s = S();
    const o = M.overall();
    const cur = M.current();
    const counts = M.statusCounts();
    const streak = M.streaks();
    const wk = U.weekStartKey(U.dayKey(), s.settings.weekStart);
    const weekMin = M.minutesBetween(wk, U.addDays(wk, 6));
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'dashboard.morning' : hour < 18 ? 'dashboard.afternoon' : 'dashboard.evening';

    el.innerHTML = `<div class="dashboard">
      <header class="page-head hero">
        <div>
          <p class="kicker mono">${U.esc(U.fmtDate(U.dayKey(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} · ${U.esc(t(greet))}</p>
          <h1>${U.esc(t('dashboard.welcome', { name: s.settings.userName || '' }))}</h1>
          ${s.settings.learningGoal ? `<p class="goal-line">${UI.icon('flag')} ${U.esc(s.settings.learningGoal)}</p>` : ''}
          ${cur.target ? `<div class="here"><span class="here-label">${UI.icon('target')} ${U.esc(t('dashboard.youAreHere'))}</span><nav class="crumb-line" aria-label="${U.esc(t('dashboard.youAreHere'))}">${breadcrumb(cur.target)}</nav></div>` : ''}
        </div>
        <div class="hero-actions">
          ${UI.btn(t('dashboard.resume'), 'resume', { cls: 'primary lg', icon: 'resume' })}
          ${UI.btn(t('focus.enter'), 'focus-mode', { cls: 'ghost', icon: 'focus' })}
          ${UI.btn(t('activity.logSession'), 'log-session', { cls: 'ghost', icon: 'clock' })}
        </div>
      </header>

      <section class="kpis" aria-label="${U.esc(t('dashboard.summary'))}">
        <div class="kpi big">
          <span class="kpi-label">${U.esc(t('dashboard.overall'))}</span>
          <span class="kpi-value mono">${o.pct}<small>%</small></span>
          ${UI.progress(o.pct, { size: 'sm', hideValue: true, aria: t('dashboard.overall') })}
        </div>
        <div class="kpi"><span class="kpi-label">${U.esc(t('dashboard.completed'))}</span><span class="kpi-value mono">${counts.completed}</span><span class="kpi-sub">${U.esc(t('dashboard.itemsSub'))}</span></div>
        <div class="kpi"><span class="kpi-label">${U.esc(t('dashboard.inProgress'))}</span><span class="kpi-value mono">${counts.in_progress}</span><span class="kpi-sub">${U.esc(t('dashboard.itemsSub'))}</span></div>
        <div class="kpi"><span class="kpi-label">${U.esc(t('dashboard.remaining'))}</span><span class="kpi-value mono">${counts.remaining}</span><span class="kpi-sub">${U.esc(t('dashboard.itemsSub'))}</span></div>
        <div class="kpi"><span class="kpi-label">${U.esc(t('dashboard.streak'))}</span><span class="kpi-value mono">${streak.current}<small> ${U.esc(t('common.days', { n: streak.current }))}</small></span><span class="kpi-sub">${U.esc(streak.activeToday ? t('dashboard.streakToday') : t('dashboard.streakKeep'))}</span></div>
        <div class="kpi"><span class="kpi-label">${U.esc(t('dashboard.thisWeek'))}</span><span class="kpi-value mono">${U.esc(U.fmtHours(weekMin))}</span><span class="kpi-sub">${U.esc(t('dashboard.logged'))}</span></div>
      </section>

      ${hierarchyCard(cur)}

      <div class="dash-grid">
        <div class="col">
          ${todayCard()}
          ${recentCompleted()}
          ${completedCoursesCard()}
        </div>
        <div class="col">
          ${nextCard()}
          ${projectsCard()}
        </div>
      </div>

      <section class="card" aria-labelledby="rp-h">
        <div class="section-head"><h2 id="rp-h">${U.esc(t('dashboard.roadmapPreview'))}</h2><a class="small" href="#/roadmap">${U.esc(t('dashboard.openRoadmap'))} ${t('common.arrow')}</a></div>
        ${App.Roadmap.preview()}
      </section>

      <section class="card" aria-labelledby="ra-h">
        <div class="section-head"><h2 id="ra-h">${U.esc(t('dashboard.recentActivity'))}</h2><a class="small" href="#/activity">${U.esc(t('common.viewAll'))}</a></div>
        ${App.Activity.feed(S().activity.slice(0, 8))}
      </section>
    </div>`;
  }

  // Enter in "add to today" input.
  document.addEventListener('keydown', (e) => {
    const el = e.target;
    if (e.key === 'Enter' && el.dataset && el.dataset.enter) {
      e.preventDefault();
      const fn = UI.actions[el.dataset.enter];
      if (fn) fn(el, e);
    }
  });

  UI.registerActions({
    'today-add-text': () => {
      const input = document.getElementById('today-input');
      const text = input && input.value.trim();
      if (!text) { if (input) input.focus(); return; }
      Store.addTodayItem({ kind: 'text', text });
      setTimeout(() => { const i = document.getElementById('today-input'); if (i) i.focus(); }, 0);
    },
  });

  App.Dashboard = { todayCard };
  App.Pages.dashboard = { render, title: () => App.i18n.t('nav.dashboard'), nav: { icon: 'dashboard', order: 10 } };
})(window.App = window.App || {});
