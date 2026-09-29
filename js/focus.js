/* Focus Mode: a distraction-free screen with just the current course, lesson, task, progress and a timer. */
(function (App) {
  'use strict';
  const U = App.U, UI = App.UI, M = App.Model, Store = App.Store;
  const t = (...a) => App.i18n.t(...a);
  const S = () => Store.state;

  function render(el) {
    const s = S();
    const cur = M.current();
    if (!cur.target) {
      el.innerHTML = `<div class="focus-wrap"><header class="focus-top">${UI.btn(t('focus.exit'), 'exit-focus', { cls: 'ghost', icon: 'x' })}</header>
        ${UI.empty(t('dashboard.allDone'))}</div>`;
      return;
    }
    const target = s.nodes[cur.target];
    // The thing to tick off right now: a task if there is one, otherwise the lesson/target itself.
    const doing = cur.task || target;
    const nextId = M.nextAfter(doing.id);
    const next = nextId && nextId !== doing.id ? s.nodes[nextId] : null;
    const scope = cur.lesson && cur.lesson.children.length ? cur.lesson : cur.course;
    const scopeInfo = scope ? M.info(scope.id) : null;
    const timer = s.timer;
    const timing = !!timer;

    el.innerHTML = `<div class="focus-wrap">
      <header class="focus-top">
        <span class="kicker">${UI.icon('focus')} ${U.esc(t('focus.title'))}</span>
        ${UI.btn(t('focus.exit'), 'exit-focus', { cls: 'ghost sm', icon: 'x' })}
      </header>
      <main class="focus-main">
        ${cur.course ? `<p class="focus-course">${U.esc(cur.course.title)}</p>` : ''}
        <h1 class="focus-lesson">${U.esc((cur.lesson || target).title)}</h1>
        ${cur.task ? `<div class="focus-task st-${cur.task.status}">
            ${UI.statusToggle('node-toggle', cur.task.id, cur.task.status, cur.task.title)}
            <div><span class="muted small">${U.esc(t('dashboard.currentTask'))}</span><p>${U.esc(cur.task.title)}</p></div>
          </div>` : ''}
        ${scopeInfo ? `<div class="focus-progress">${UI.progress(scopeInfo.pct, { label: t('focus.progressOf', { name: scope.title, done: scopeInfo.done, total: scopeInfo.total }) })}</div>` : ''}
        <div class="focus-clock ${timing ? 'on' : ''}"><span class="mono" data-timer-clock>${timing ? '' : '00:00'}</span></div>
        <div class="focus-actions">
          ${timing
            ? UI.btn(t('timer.stopLog'), 'timer-stop', { cls: 'lg', icon: 'stop' })
            : UI.btn(t('focus.start'), 'focus-start', { cls: 'lg', icon: 'play', data: { id: doing.id } })}
          ${UI.btn(t('focus.markDone'), 'node-status', { cls: 'primary lg', icon: 'check', data: { id: doing.id, value: 'completed' } })}
        </div>
        ${next ? `<p class="focus-next"><span class="muted">${U.esc(t('focus.next'))}</span> ${U.esc(next.title)} <span class="muted small">${U.esc((M.closest(next.id, 'course') || {}).title || '')}</span></p>` : ''}
        <details class="focus-notes">
          <summary>${U.esc(t('detail.notes'))} — ${U.esc(doing.title)}</summary>
          <textarea class="notes" data-notes-kind="node" data-notes-id="${doing.id}" rows="5" aria-label="${U.esc(t('detail.notes'))}" placeholder="${U.esc(t('detail.notesPlaceholder'))}">${U.esc(doing.notes)}</textarea>
          <p class="help" data-save-state>${U.esc(t('detail.notesAutosave'))}</p>
        </details>
      </main>
    </div>`;
  }

  UI.registerActions({
    'focus-start': (el) => {
      const id = el.dataset.id;
      if (S().nodes[id].status !== 'in_progress') Store.setNodeStatus(id, 'in_progress');
      if (!S().timer) Store.startTimer({ nodeId: id });
    },
  });

  App.Pages.focus = { render, title: () => t('focus.title') };
})(window.App = window.App || {});
