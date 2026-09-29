/*
 * Learning item page (#/learn/<id>): one page for every level — path, track, course, module, lesson, task.
 * Shows current state (progress, status, where you are inside it, what's done / left)
 * and history (progress over time, completions and reopenings, every event).
 * Completed items stay here forever as part of the learning record.
 */
(function (App) {
  'use strict';
  const U = App.U, UI = App.UI, M = App.Model, Store = App.Store;
  const t = (...a) => App.i18n.t(...a);
  const S = () => Store.state;

  const openTables = new Set();

  function link(id, cls = '') {
    const n = S().nodes[id];
    return `<a class="${cls}" href="#/learn/${id}">${U.esc(n.title)}</a>`;
  }

  /* ---------------- contents ---------------- */

  function treeRows(ids) {
    const s = S();
    return ids.map((id) => {
      const n = s.nodes[id];
      if (!n) return '';
      const info = M.info(id);
      const kids = App.Detail.CHILD_TYPES[n.type];
      return `<li class="ct-item t-${n.type}">
        <div class="ct-row st-${info.status} ${info.locked ? 'locked' : ''}">
          ${UI.statusToggle('node-toggle', id, info.status, n.title)}
          <button class="link-btn ct-title" data-action="open-node" data-id="${id}">${U.esc(n.title)}</button>
          ${info.locked ? UI.icon('lock', 'muted') : ''}
          ${n.notes ? `<span class="has-note" title="${U.esc(t('detail.notes'))}">${UI.icon('note')}</span>` : ''}
          ${n.completedAt ? `<span class="small muted mono">${U.esc(U.fmtDate(n.completedAt, { day: 'numeric', month: 'short' }))}</span>` : ''}
          <span class="ct-type">${U.esc(t('type.' + n.type))}</span>
          ${n.children.length ? `<span class="mono small muted">${info.pct}%</span>` : ''}
          <span class="ct-actions">
            ${UI.iconBtn('up', 'node-move', t('actions.moveUp'), { id, value: -1 }, 'sm')}
            ${UI.iconBtn('down', 'node-move', t('actions.moveDown'), { id, value: 1 }, 'sm')}
            ${kids.includes('lesson') ? UI.iconBtn('plus', 'node-add-child', t('actions.addType', { type: t('type.lesson') }), { id, type: 'lesson' }, 'sm') : kids.includes('task') ? UI.iconBtn('plus', 'node-add-child', t('actions.addType', { type: t('type.task') }), { id, type: 'task' }, 'sm') : ''}
            ${UI.iconBtn('edit', 'node-edit', t('common.edit'), { id }, 'sm')}
            ${UI.iconBtn('trash', 'node-delete', t('common.delete'), { id }, 'sm danger')}
          </span>
        </div>
        ${n.children.length ? `<ul class="ct-list">${treeRows(n.children)}</ul>` : ''}
      </li>`;
    }).join('');
  }

  /** Paths and tracks list their children as progress cards. */
  function childCards(ids) {
    return `<div class="child-cards">${ids.map((id) => {
      const n = S().nodes[id];
      const i = M.info(id);
      return `<a class="child-card st-${i.status}" href="#/learn/${id}">
        <span class="cc-row">${UI.typeBadge(n.type)}${UI.statusBadge(i.status)}</span>
        <span class="cc-name">${U.esc(n.title)}</span>
        ${UI.progress(i.pct, { size: 'xs', label: t('common.itemsOf', { done: i.done, total: i.total }) })}
        ${n.completedAt ? `<span class="small muted">${UI.icon('done', 'st-completed')} ${U.esc(t('history.completedOn', { date: U.fmtDate(n.completedAt) }))}</span>` : ''}
      </a>`;
    }).join('')}</div>`;
  }

  /* ---------------- "What did I complete?" ---------------- */

  function breakdownCard(id) {
    const s = S();
    const b = M.breakdown(id);
    if (!b || !b.unit) return '';
    const col = (key, icon, items, withDate) => `<div class="bd-col bd-${key}">
      <h3 class="mini-h">${UI.icon(icon)} ${U.esc(t('history.' + key))} <span class="mono">${items.length}</span></h3>
      ${items.length ? `<ul>${items.map((x) => `<li><button class="link-btn" data-action="open-node" data-id="${x}">${U.esc(s.nodes[x].title)}</button>${withDate && s.nodes[x].completedAt ? `<span class="muted small mono">${U.esc(U.fmtDate(s.nodes[x].completedAt, { day: 'numeric', month: 'short' }))}</span>` : ''}${s.nodes[x].children.length ? `<span class="muted small mono">${M.pct(x)}%</span>` : ''}</li>`).join('')}</ul>` : `<p class="muted small">—</p>`}
    </div>`;
    return `<section class="card" aria-labelledby="bd-h">
      <div class="section-head"><h2 id="bd-h">${U.esc(t('history.whatCompleted'))}</h2><span class="muted small">${U.esc(t('history.countedIn', { unit: t('type.' + b.unit) }))}</span></div>
      <div class="breakdown">
        ${col('completed', 'done', b.completed, true)}
        ${col('in_progress', 'half', b.in_progress)}
        ${col('not_started', 'circle', b.not_started)}
      </div>
      ${b.skipped.length ? `<p class="muted small mt">${UI.icon('skip')} ${U.esc(t('history.skippedN', { n: b.skipped.length }))}: ${b.skipped.map((x) => U.esc(s.nodes[x].title)).join(', ')}</p>` : ''}
    </section>`;
  }

  /* ---------------- progress history ---------------- */

  function historyCard(id) {
    const s = S();
    const rows = s.progressLog.filter((r) => r.id === id);
    const series = M.progressSeries(id);
    const open = openTables.has(id);
    return `<section class="card" aria-labelledby="ph-h">
      <div class="section-head"><h2 id="ph-h">${U.esc(t('history.progressHistory'))}</h2><span class="muted small">${U.esc(t('history.changes', { n: rows.length }))}</span></div>
      ${rows.length
        ? App.Charts.lineChart(series, { aria: t('history.progressHistory'), tip: (p) => `${U.fmtDate(p.ts)} ${p.now ? '(' + t('history.now') + ')' : ''}: ${p.pct}%` })
        : `<p class="muted small">${U.esc(t('history.noSnapshots'))}</p>`}
      ${rows.length ? `<details class="mt" ${open ? 'open' : ''} data-table-for="${id}"><summary>${U.esc(t('stats.tableView'))}</summary>
        <table class="data-table"><thead><tr><th scope="col">${U.esc(t('field.date'))}</th><th scope="col">${U.esc(t('history.change'))}</th><th scope="col">${U.esc(t('field.status'))}</th></tr></thead>
        <tbody>${rows.slice().reverse().map((r) => `<tr><td>${U.esc(U.fmtDate(r.ts))} ${U.esc(U.fmtTime(r.ts))}</td><td class="mono" dir="ltr">${r.from}% → ${r.to}%</td><td>${r.fromStatus !== r.toStatus && r.toStatus ? `${U.esc(t('status.' + r.fromStatus))} ${t('common.arrow')} ${U.esc(t('status.' + r.toStatus))}` : ''}</td></tr>`).join('')}</tbody></table>
      </details>` : ''}
    </section>`;
  }

  function completionHistory(n) {
    if (!n.completions.length) return '';
    return `<section class="card"><h2>${U.esc(t('history.completions'))}</h2>
      <ol class="vtimeline compact">${n.completions.map((c, i) => `
        <li class="vt-complete"><span class="vt-dot" aria-hidden="true"></span><div><p class="vt-label">${U.esc(i ? t('history.completedAgain') : t('history.firstCompleted'))}</p><p>${U.esc(U.fmtDate(c.at))} · ${U.esc(U.fmtTime(c.at))}</p></div></li>
        ${c.reopenedAt ? `<li class="vt-project_status"><span class="vt-dot" aria-hidden="true"></span><div><p class="vt-label">${U.esc(t('history.reopenedLabel'))}</p><p>${U.esc(U.fmtDate(c.reopenedAt))} · ${U.esc(U.fmtTime(c.reopenedAt))}</p></div></li>` : ''}`).join('')}
      </ol></section>`;
  }

  /* ---------------- page ---------------- */

  function render(el, params, sub) {
    const s = S();
    const id = sub;
    const n = s.nodes[id];
    if (!n) { location.replace('#/roadmap'); return; }
    const info = M.info(id);
    const st = info.status;
    const isContainer = n.children.length > 0;
    const cur = isContainer && st !== 'completed' ? M.currentIn(id) : null;
    const url = U.safeUrl(n.url);
    const projects = M.projectsForNode(id);
    const events = M.nodeEvents(id).slice(0, 60);
    const last = M.lastActivity(id);
    const first = M.firstCompleted(n);
    const reopened = n.completions.filter((c) => c.reopenedAt);
    const logged = M.minutesFor(id);
    const childTypes = App.Detail.CHILD_TYPES[n.type];
    const cardLevel = ['path', 'track'].includes(n.type);

    const facts = [
      isContainer ? [t('history.items'), t('common.itemsOf', { done: info.done, total: info.total })] : null,
      n.startedAt ? [t('field.startedOn'), U.fmtDate(n.startedAt)] : null,
      last ? [t('field.lastActivity'), U.relDay(last)] : null,
      first ? [t('field.firstCompleted'), U.fmtDate(first)] : st === 'completed' ? [t('field.completedOn'), t('history.dateUnknown')] : null,
      reopened.length ? [t('field.reopened'), U.fmtDate(reopened[reopened.length - 1].reopenedAt)] : null,
      logged ? [t('courses.timeLogged'), U.fmtMinutes(logged)] : null,
      n.estHours ? [t('field.estHours'), t('time.h', { h: n.estHours })] : null,
      n.actualHours ? [t('field.actualHours'), t('time.h', { h: n.actualHours })] : null,
      n.targetDate ? [n.type === 'task' ? t('field.dueDate') : t('field.targetDate'), U.fmtDate(n.targetDate)] : null,
    ].filter(Boolean);

    el.innerHTML = `<nav class="crumbs page-crumbs" aria-label="${U.esc(t('detail.location'))}">
        <a href="#/roadmap">${U.esc(t('history.overall', { pct: M.overall().pct }))}</a>
        ${M.ancestors(id).map((a) => `<span aria-hidden="true">›</span><a href="#/learn/${a.id}">${U.esc(a.title)}</a> <span class="mono muted">${M.pct(a.id)}%</span>`).join('')}
      </nav>
      <header class="card learn-head st-${st}">
        <div class="lh-main">
          <p class="kicker">${UI.typeBadge(n.type)} ${n.provider ? `<span class="provider">${U.esc(t('provider.' + n.provider))}</span>` : ''} ${UI.statusBadge(st)} ${info.locked ? `<span class="badge st-locked">${UI.icon('lock')}${U.esc(t('status.locked'))}</span>` : ''}</p>
          <h1>${U.esc(n.title)}</h1>
          ${n.description ? `<p class="muted pre">${U.esc(n.description)}</p>` : ''}
          <dl class="facts">${facts.map(([k, v]) => `<div><dt>${U.esc(k)}</dt><dd>${U.esc(v)}</dd></div>`).join('')}</dl>
        </div>
        <div class="lh-ring">${App.Charts.ring(info.pct, 96, t('common.progress'))}</div>
        <div class="lh-actions">
          ${UI.statusSegment('node-status', id, st, Store.STATUSES)}
          <div class="btn-row">
            ${st === 'completed' ? UI.btn(t('reopen.action'), 'node-reopen', { cls: 'sm', icon: 'reset', data: { id } }) : ''}
            ${n.type === 'course' && st === 'completed' ? UI.btn(t('certs.add'), 'cert-add', { cls: 'sm', icon: 'award', data: { node: id } }) : ''}
            ${cur ? UI.btn(t('history.continueHere'), 'open-node', { cls: 'sm primary', icon: 'play', data: { id: cur.target } }) : ''}
            ${url ? `<a class="btn sm ghost" href="${U.esc(url)}" target="_blank" rel="noopener noreferrer">${UI.icon('external')}<span>${U.esc(t('courses.openCourse'))}</span></a>` : ''}
            ${UI.btn(t('timer.start'), 'timer-start', { cls: 'sm ghost', icon: 'clock', data: { id } })}
            ${UI.btn(t('detail.showOnMap'), 'show-on-map', { cls: 'sm ghost', icon: 'map', data: { id } })}
            ${UI.btn(t('common.edit'), 'node-edit', { cls: 'sm ghost', icon: 'edit', data: { id } })}
            ${UI.iconBtn('trash', 'node-delete', t('common.delete'), { id }, 'sm danger')}
          </div>
          ${n.review ? `<p class="lock-note subtle">${UI.icon('reset')} ${U.esc(t('reopen.reviewing'))}</p>` : ''}
          ${info.locked ? `<p class="lock-note">${UI.icon('lock')} ${U.esc(t('detail.lockedBy'))} ${info.unmet.map((p) => link(p)).join(', ')}. ${U.esc(t('detail.lockOverride'))}</p>` : ''}
        </div>
      </header>

      ${cur ? `<section class="card position-card" aria-label="${U.esc(t('dashboard.youAreHere'))}">
        <span class="here-label">${UI.icon('target')} ${U.esc(t('history.youAreHereIn', { name: n.title }))}</span>
        <ol class="pos-steps">${[['module', cur.module], ['lesson', cur.lesson], ['task', cur.task]].filter(([, x]) => x && x.id !== id && Store.descendantsOf(id).includes(x.id))
          .map(([k, x]) => `<li><span class="muted small">${U.esc(t('type.' + k))}</span><button class="link-btn" data-action="open-node" data-id="${x.id}">${U.esc(x.title)}</button>${x.children.length ? `<span class="mono small muted">${M.pct(x.id)}%</span>` : ''}</li>`).join('')
          || `<li><button class="link-btn" data-action="open-node" data-id="${cur.target}">${U.esc(s.nodes[cur.target].title)}</button></li>`}</ol>
      </section>` : ''}

      <div class="course-layout">
        <div class="col">
          ${isContainer ? breakdownCard(id) : ''}
          ${childTypes.length || isContainer ? `<section class="card">
            <div class="section-head"><h2>${U.esc(t('detail.contents'))}</h2>
              <div class="btn-row">${childTypes.map((ct) => UI.btn(t('actions.addType', { type: t('type.' + ct) }), 'node-add-child', { cls: 'sm ghost', icon: 'plus', data: { id, type: ct } })).join('')}</div>
            </div>
            ${isContainer ? (cardLevel ? childCards(n.children) : `<ul class="ct-list root">${treeRows(n.children)}</ul>`) : `<p class="muted">${U.esc(t('detail.noChildren'))}</p>`}
          </section>` : ''}
          ${isContainer ? historyCard(id) : ''}
          <section class="card" aria-labelledby="ev-h">
            <div class="section-head"><h2 id="ev-h">${U.esc(t('history.activity'))}</h2><a class="small" href="#/activity?view=history">${U.esc(t('common.viewAll'))}</a></div>
            ${App.Activity.feed(events)}
          </section>
        </div>
        <aside class="col side">
          ${n.type === 'course' ? App.Certificates.courseSection(id) : ''}
          ${completionHistory(n)}
          <section class="card">
            <div class="section-head"><h2>${U.esc(t('detail.resources'))}</h2>${UI.iconBtn('plus', 'resource-add', t('actions.addResource'), { kind: 'node', id }, 'sm')}</div>
            ${UI.resourceList('node', id, n.resources)}
          </section>
          <section class="card">
            <h2><label for="learn-notes">${U.esc(t('detail.notes'))}</label></h2>
            <textarea id="learn-notes" class="notes" data-notes-kind="node" data-notes-id="${id}" rows="6" placeholder="${U.esc(t('detail.notesPlaceholder'))}">${U.esc(n.notes)}</textarea>
            <p class="help" data-save-state>${U.esc(t('detail.notesAutosave'))}</p>
          </section>
          <section class="card">
            <h2>${U.esc(t('detail.appliedIn'))}</h2>
            ${projects.length ? `<ul class="mini-list">${projects.map((p) => `<li>${UI.icon('folder')}<a href="#/projects/${p.id}">${U.esc(p.name)}</a>${UI.projectStatusBadge(p.status)}</li>`).join('')}</ul>` : `<p class="muted small">${U.esc(t('detail.noProjects'))}</p>`}
          </section>
          <section class="card">
            <h2>${U.esc(t('detail.prereqs'))}</h2>
            ${n.prereqs.length ? `<ul class="mini-list">${n.prereqs.map((p) => `<li>${UI.icon(UI.STATUS_ICON[M.status(p)], 'st-' + M.status(p))}${link(p)}</li>`).join('')}</ul>` : `<p class="muted small">${U.esc(t('detail.none'))}</p>`}
          </section>
        </aside>
      </div>`;

    el.querySelectorAll('details[data-table-for]').forEach((d) => d.addEventListener('toggle', () => {
      if (d.open) openTables.add(d.dataset.tableFor); else openTables.delete(d.dataset.tableFor);
    }));
  }

  App.Learn = { render, treeRows };
  App.Pages.learn = {
    render,
    title: () => { const r = App.route(); return r.sub && S().nodes[r.sub] ? S().nodes[r.sub].title : t('nav.roadmap'); },
    navKey: 'roadmap',
  };
})(window.App = window.App || {});
