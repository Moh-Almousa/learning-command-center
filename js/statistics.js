/* Statistics: KPIs, progress by track/skill, weekly charts and an activity heatmap (hand-drawn SVG, no libraries). */
(function (App) {
  'use strict';
  const U = App.U, UI = App.UI, M = App.Model, Store = App.Store;
  const t = (...a) => App.i18n.t(...a);
  const S = () => Store.state;

  function heatmap(weeks = 18) {
    const s = S();
    const today = U.dayKey();
    const start = U.weekStartKey(U.addDays(today, -(weeks - 1) * 7), s.settings.weekStart);
    const score = {};
    const add = (k, v, what) => { score[k] = score[k] || { v: 0, min: 0, items: 0 }; score[k].v += v; score[k][what] += what === 'min' ? v : 1; };
    s.sessions.forEach((x) => { if (x.date >= start) add(x.date, Number(x.minutes) || 0, 'min'); });
    Object.values(s.nodes).forEach((n) => { if (n.completedAt) { const k = U.dayKey(new Date(n.completedAt)); if (k >= start) { add(k, 20, 'items'); } } });
    Object.values(s.ptasks).forEach((x) => { if (x.completedAt) { const k = U.dayKey(new Date(x.completedAt)); if (k >= start) { add(k, 20, 'items'); } } });
    const max = Math.max(1, ...Object.values(score).map((x) => x.v));
    const cell = 13, gap = 3;
    let cells = '';
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const k = U.addDays(start, w * 7 + d);
        if (k > today) continue;
        const sc = score[k];
        const lv = !sc ? 0 : Math.min(4, 1 + Math.floor((sc.v / max) * 3.99));
        const tip = `${U.fmtDate(k)} — ${sc ? t('stats.heatTip', { time: U.fmtMinutes(sc.min), items: sc.items }) : t('stats.noActivity')}`;
        cells += `<rect class="hm lv${lv}" x="${w * (cell + gap)}" y="${d * (cell + gap)}" width="${cell}" height="${cell}" rx="3" tabindex="0" data-tip="${U.esc(tip)}" aria-label="${U.esc(tip)}"/>`;
      }
    }
    const W = weeks * (cell + gap), H = 7 * (cell + gap);
    return `<div class="heatmap-wrap"><svg class="heatmap" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${U.esc(t('stats.heatmap'))}">${cells}</svg>
      <div class="hm-legend small muted"><span>${U.esc(t('stats.less'))}</span>${[0, 1, 2, 3, 4].map((l) => `<i class="hm lv${l}"></i>`).join('')}<span>${U.esc(t('stats.more'))}</span></div></div>`;
  }

  function hbars(rows) {
    if (!rows.length) return `<p class="muted small">${U.esc(t('stats.nothing'))}</p>`;
    return `<ul class="bar-list">${rows.map((r) => `<li><span class="bl-label">${r.labelHtml || U.esc(r.label)}</span>${UI.progress(r.pct, { size: 'xs', hideValue: true, aria: r.label })}<span class="mono small">${r.pct}%</span></li>`).join('')}</ul>`;
  }

  /* ------------------------------------------------------------------ */
  /* page                                                                */
  /* ------------------------------------------------------------------ */

  function weekly(weeks, valueFn) {
    const s = S();
    const cur = U.weekStartKey(U.dayKey(), s.settings.weekStart);
    const out = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const from = U.addDays(cur, -7 * i);
      const to = U.addDays(from, 6);
      out.push({ from, to, label: U.fmtDate(from, { day: 'numeric', month: 'short' }), value: valueFn(from, to) });
    }
    return out;
  }

  function render(el) {
    const s = S();
    const o = M.overall();
    const streak = M.streaks();
    const courses = Object.values(s.nodes).filter((n) => n.type === 'course');
    const coursesDone = courses.filter((n) => M.status(n.id) === 'completed').length;
    const lessons = Object.values(s.nodes).filter((n) => n.type === 'lesson');
    const lessonsDone = lessons.filter((n) => M.status(n.id) === 'completed').length;
    const tasks = Object.values(s.nodes).filter((n) => n.type === 'task');
    const tasksDone = tasks.filter((n) => n.status === 'completed').length;
    const ptasks = Object.values(s.ptasks);
    const ptDone = ptasks.filter((x) => x.status === 'completed').length;
    const learnMin = M.totalMinutes((x) => x.kind !== 'project');
    const devMin = M.totalMinutes((x) => x.kind === 'project');

    const tracks = M.order().filter((id) => s.nodes[id].type === 'track').map((id) => ({ label: s.nodes[id].title, labelHtml: `<a href="#/roadmap?focus=${id}">${U.esc(s.nodes[id].title)}</a>`, pct: M.pct(id) }));
    const skills = s.skillOrder.map((id) => ({ label: s.skills[id].name, pct: M.skillStats(id).pct })).sort((a, b) => b.pct - a.pct);
    const hours = weekly(12, (a, b) => M.minutesBetween(a, b));
    const done = weekly(12, (a, b) => M.completedBetween(a, b).filter((n) => !n.children.length).length + M.ptasksCompletedBetween(a, b).length);

    const tiles = [
      [t('dashboard.overall'), o.pct + '%', t('common.itemsOf', { done: o.done, total: o.total })],
      [t('stats.courses'), coursesDone, t('stats.ofTotal', { n: courses.length })],
      [t('stats.lessons'), lessonsDone, t('stats.ofTotal', { n: lessons.length })],
      [t('stats.tasks'), tasksDone, t('stats.ofTotal', { n: tasks.length })],
      [t('stats.projectTasks'), ptDone, t('stats.ofTotal', { n: ptasks.length })],
      [t('stats.learningHours'), U.fmtHours(learnMin), t('stats.devHours', { h: U.fmtHours(devMin) })],
      [t('stats.certificates'), s.certificates.filter((c) => App.Certificates.statusOf(c) === 'earned').length, t('stats.ofTotal', { n: s.certificates.length })],
      [t('stats.sessions'), s.sessions.length, t('stats.totalTime', { time: U.fmtMinutes(learnMin + devMin) })],
      [t('stats.coursesInProgress'), courses.filter((n) => M.status(n.id) === 'in_progress').length, t('stats.ofTotal', { n: courses.length })],
      [t('stats.coursesThisMonth'), courses.filter((n) => n.completedAt && U.dayKey(new Date(n.completedAt)).slice(0, 7) === U.dayKey().slice(0, 7)).length, U.fmtDate(U.dayKey(), { month: 'long', year: 'numeric' })],
      [t('stats.currentStreak'), streak.current, t('common.days', { n: streak.current })],
      [t('stats.longestStreak'), streak.longest, t('common.days', { n: streak.longest })],
    ];

    el.innerHTML = `<header class="page-head"><div><h1>${U.esc(t('nav.stats'))}</h1><p class="muted">${U.esc(t('stats.subtitle'))}</p></div></header>
      <section class="kpis" aria-label="${U.esc(t('dashboard.summary'))}">${tiles.map(([k, v, sub]) => `<div class="kpi"><span class="kpi-label">${U.esc(k)}</span><span class="kpi-value mono">${U.esc(v)}</span><span class="kpi-sub">${U.esc(sub)}</span></div>`).join('')}</section>
      <div class="ws-grid mt">
        <section class="card"><h2>${U.esc(t('stats.byTrack'))}</h2>${hbars(tracks)}</section>
        <section class="card"><h2>${U.esc(t('stats.bySkill'))}</h2>${hbars(skills)}</section>
      </div>
      <section class="card mt"><h2>${U.esc(t('stats.overallOverTime'))}</h2>
        ${s.progressLog.some((r) => r.id === Store.OVERALL)
          ? App.Charts.lineChart(M.progressSeries(Store.OVERALL), { aria: t('stats.overallOverTime') })
          : `<p class="muted small">${U.esc(t('history.noSnapshots'))}</p>`}
      </section>
      <section class="card mt"><h2>${U.esc(t('stats.hoursPerWeek'))}</h2>
        ${App.Charts.barChart(hours.map((w) => ({ label: w.label, value: w.value / 60, tip: `${t('stats.weekOf', { date: U.fmtDate(w.from) })}: ${U.fmtMinutes(w.value)}` })), { fmt: (v) => t('time.h', { h: Math.round(v * 10) / 10 }), aria: t('stats.hoursPerWeek') })}
        ${hours.every((w) => !w.value) ? `<p class="muted small">${U.esc(t('stats.noSessions'))}</p>` : ''}
      </section>
      <section class="card mt"><h2>${U.esc(t('stats.completedPerWeek'))}</h2>
        ${App.Charts.barChart(done.map((w) => ({ label: w.label, value: w.value, tip: `${t('stats.weekOf', { date: U.fmtDate(w.from) })}: ${t('stats.nCompleted', { n: w.value })}` })), { fmt: (v) => Math.round(v), aria: t('stats.completedPerWeek') })}
      </section>
      <section class="card mt"><h2>${U.esc(t('stats.heatmap'))}</h2>${heatmap()}</section>
      <details class="card mt"><summary>${U.esc(t('stats.tableView'))}</summary>
        <table class="data-table"><thead><tr><th scope="col">${U.esc(t('stats.week'))}</th><th scope="col">${U.esc(t('stats.hours'))}</th><th scope="col">${U.esc(t('stats.completed'))}</th></tr></thead>
        <tbody>${hours.map((w, i) => `<tr><td>${U.esc(U.fmtDate(w.from))}</td><td class="mono">${U.esc(U.fmtMinutes(w.value))}</td><td class="mono">${done[i].value}</td></tr>`).join('')}</tbody></table>
      </details>`;
  }

  App.Pages.stats = { render, title: () => t('nav.stats'), nav: { icon: 'chart', order: 90 } };
})(window.App = window.App || {});
