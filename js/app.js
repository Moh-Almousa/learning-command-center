/* App shell: boot, hash router, sidebar, top bar, timer, Today's plan actions, re-render orchestration. */
(function (App) {
  'use strict';
  const U = App.U, UI = App.UI, M = App.Model, Store = App.Store;
  const t = (...a) => App.i18n.t(...a);
  const S = () => Store.state;

  App.Pages = App.Pages || {};

  let route = { name: 'dashboard', sub: null, params: {} };

  /* ------------------------------------------------------------------ */
  /* routing                                                             */
  /* ------------------------------------------------------------------ */

  function parseHash() {
    const raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    const [path, query = ''] = raw.split('?');
    const [name, sub] = path.split('/');
    const params = {};
    new URLSearchParams(query).forEach((v, k) => { params[k] = v; });
    return { name: App.Pages[name] ? name : 'dashboard', sub: sub ? decodeURIComponent(sub) : null, params };
  }

  function navigate() {
    const prev = route.name;
    route = parseHash();
    document.body.classList.toggle('focus-mode', route.name === 'focus');
    document.body.classList.remove('nav-open');
    renderShell();
    renderPage();
    const view = document.getElementById('view');
    if (prev !== route.name) {
      view.scrollTop = 0;
      window.scrollTo(0, 0);
      const h = view.querySelector('h1');
      if (h && route.name !== 'focus') { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
    const page = App.Pages[route.name];
    document.title = `${page && page.title ? page.title() : t('nav.' + route.name)} · ${t('app.name')}`;
  }

  function renderPage() {
    const el = document.getElementById('view');
    const page = App.Pages[route.name];
    try {
      page.render(el, route.params, route.sub);
    } catch (err) {
      console.error(err);
      el.innerHTML = UI.empty(t('errors.render'));
    }
  }

  /** Re-render the current page after a data change, preserving scroll + focus. */
  function rerender() {
    const view = document.getElementById('view');
    const scroll = view.scrollTop, winScroll = window.scrollY;
    const a = document.activeElement;
    const key = a && a !== document.body && view.contains(a) ? focusKey(a) : null;
    renderPage();
    view.scrollTop = scroll;
    window.scrollTo(0, winScroll);
    if (key) restoreFocus(key, view);
  }

  function focusKey(el) {
    if (el.id) return { id: el.id };
    const ds = el.dataset || {};
    return { action: ds.action || ds.change, id: ds.id, value: ds.value, tag: el.tagName };
  }

  function restoreFocus(key, root) {
    let el = null;
    if (key.id) el = document.getElementById(key.id);
    else if (key.action) {
      const sel = [`[data-action="${key.action}"]`, `[data-change="${key.action}"]`].map((b) =>
        b + (key.id ? `[data-id="${CSS.escape(key.id)}"]` : '')).join(',');
      const cands = U.$$(sel, root);
      el = cands.find((c) => c.dataset.value === key.value) || cands[0];
    }
    if (el) el.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------ */
  /* shell                                                               */
  /* ------------------------------------------------------------------ */

  function renderShell() {
    // The sidebar is built from every page that registered a `nav` entry (see README → Adding a feature).
    const nav = document.getElementById('nav');
    const current = (App.Pages[route.name] && App.Pages[route.name].navKey) || route.name;
    nav.innerHTML = Object.entries(App.Pages).filter(([, p]) => p.nav).sort((a, b) => a[1].nav.order - b[1].nav.order).map(([name, p]) => {
      const active = current === name;
      return `<li><a href="#/${name}" class="nav-link ${active ? 'active' : ''}" ${active ? 'aria-current="page"' : ''}>${UI.icon(p.nav.icon)}<span>${U.esc(t('nav.' + name))}</span></a></li>`;
    }).join('');
    renderSidebarProgress();
    renderTimer();
  }

  function renderSidebarProgress() {
    const o = M.overall();
    const el = document.getElementById('sidebar-progress');
    el.innerHTML = `<div class="side-progress">
      ${UI.progress(o.pct, { label: t('dashboard.overall'), size: 'sm' })}
      <p class="muted small mono">${t('common.itemsOf', { done: o.done, total: o.total })}</p>
    </div>`;
  }

  function renderTimer() {
    const slot = document.getElementById('timer-slot');
    const tm = S().timer;
    if (!tm) { slot.innerHTML = ''; return; }
    const n = tm.nodeId && S().nodes[tm.nodeId];
    const p = tm.projectId && S().projects[tm.projectId];
    slot.innerHTML = `<div class="timer-chip" role="timer" aria-live="off">
      <span class="dot" aria-hidden="true"></span>
      <span class="mono" id="timer-clock">00:00</span>
      <span class="timer-label">${U.esc(n ? n.title : p ? p.name : t('timer.session'))}</span>
      ${UI.btn(t('timer.stopLog'), 'timer-stop', { cls: 'sm', icon: 'stop' })}
      ${UI.iconBtn('x', 'timer-cancel', t('timer.cancel'), {}, 'sm')}
    </div>`;
    tickTimer();
  }

  function tickTimer() {
    const tm = S().timer;
    const clock = document.getElementById('timer-clock');
    if (!tm || !clock) return;
    const sec = Math.floor((Date.now() - tm.startTs) / 1000);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    clock.textContent = (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    document.querySelectorAll('[data-timer-clock]').forEach((x) => { x.textContent = clock.textContent; });
  }

  /* ------------------------------------------------------------------ */
  /* shared actions                                                      */
  /* ------------------------------------------------------------------ */

  /** Text that lives in index.html rather than in a rendered page. */
  function applyStaticText() {
    document.getElementById('brand-name').textContent = t('app.name');
    document.getElementById('global-search').setAttribute('placeholder', t('search.placeholder'));
    document.getElementById('global-search').setAttribute('aria-label', t('search.label'));
    document.getElementById('skip-link').textContent = t('app.skip');
    document.getElementById('detail').setAttribute('aria-label', t('detail.label'));
    U.$$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    U.$$('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); el.setAttribute('title', t(el.dataset.i18nAria)); });
    const lb = document.getElementById('lang-btn');
    lb.textContent = t('lang.switchLabel');
    lb.setAttribute('aria-label', t('lang.switchAria'));
    lb.setAttribute('title', t('lang.switchAria'));
    lb.setAttribute('lang', App.i18n.lang === 'ar' ? 'en' : 'ar');
  }

  /** Switch the whole interface language (and direction) without reloading. */
  function setLanguage(lang) {
    if (lang === App.i18n.lang) return;
    Store.updateSettings({ lang }, { silent: true, immediate: true });
    App.i18n.apply(lang);
    applyStaticText();
    App.Roadmap.requestFit();
    renderShell();
    rerender();
    App.Detail.render();
    const page = App.Pages[route.name];
    document.title = `${page && page.title ? page.title() : t('nav.' + route.name)} · ${t('app.name')}`;
    UI.toast(t('lang.changed'));
  }

  function resume() {
    const target = M.resumeTarget();
    if (!target) { UI.toast(t('dashboard.nothingToResume')); return; }
    if (S().nodes[target].status === 'not_started') Store.setNodeStatus(target, 'in_progress');
    location.hash = '#/roadmap?focus=' + target;
    setTimeout(() => App.Detail.open(target), 30);
  }

  async function stopTimer() {
    const r = Store.stopTimer();
    if (!r) return;
    const saved = await App.Activity.sessionForm({ date: r.date, minutes: r.minutes, nodeId: r.nodeId, projectId: r.projectId, kind: r.projectId ? 'project' : 'learning' });
    if (!saved) UI.toast(t('timer.discarded'));
  }

  async function pickToday() {
    const s = S();
    const nodeOpts = M.upcoming(12).map((id) => ({ value: 'node:' + id, label: s.nodes[id].title, hint: (M.closest(id, 'course') || {}).title || t('type.' + s.nodes[id].type) }));
    const taskOpts = [];
    s.projectOrder.forEach((pid) => {
      const p = s.projects[pid];
      if (['archived', 'delivered'].includes(p.status)) return;
      M.projectTasks(pid).filter((x) => x.status !== 'completed').slice(0, 8)
        .forEach((x) => taskOpts.push({ value: 'ptask:' + x.id, label: x.title, hint: p.name }));
    });
    const v = await UI.form({
      title: t('today.pickTitle'),
      intro: t('today.pickIntro'),
      fields: [
        { name: 'learning', label: t('today.fromRoadmap'), type: 'checklist', options: nodeOpts, full: true },
        { name: 'projects', label: t('today.fromProjects'), type: 'checklist', options: taskOpts, full: true },
      ],
      submitLabel: t('today.addSelected'),
      wide: true,
    });
    if (!v) return;
    [...v.learning, ...v.projects].forEach((val) => {
      const [kind, id] = val.split(':');
      const title = kind === 'node' ? s.nodes[id].title : s.ptasks[id].title;
      Store.addTodayItem({ kind, refId: id, text: title });
    });
  }

  UI.registerActions({
    'resume': () => resume(),
    'toggle-lang': () => setLanguage(App.i18n.lang === 'ar' ? 'en' : 'ar'),
    'set-lang': (el) => setLanguage(el.value),
    'focus-mode': () => { location.hash = '#/focus'; },
    'exit-focus': () => { history.length > 1 ? history.back() : (location.hash = '#/dashboard'); },
    'nav-toggle': () => document.body.classList.toggle('nav-open'),
    'timer-start': (el) => {
      if (S().timer) { UI.toast(t('timer.alreadyRunning')); return; }
      const nodeId = el.dataset.id || null;
      const projectId = el.dataset.project || null;
      if (nodeId && S().nodes[nodeId].status === 'not_started' && !S().nodes[nodeId].children.length) Store.setNodeStatus(nodeId, 'in_progress');
      Store.startTimer({ nodeId, projectId });
      UI.toast(t('timer.started'));
    },
    'timer-stop': () => stopTimer(),
    'timer-cancel': async () => {
      if (await UI.confirm({ title: t('timer.cancelTitle'), message: t('timer.cancelMessage'), confirmLabel: t('timer.cancel') })) Store.cancelTimer();
    },
    'today-add-node': (el) => { const n = S().nodes[el.dataset.id]; Store.addTodayItem({ kind: 'node', refId: n.id, text: n.title }); UI.toast(t('today.added', { name: n.title })); },
    'today-add-ptask': (el) => { const x = S().ptasks[el.dataset.id]; Store.addTodayItem({ kind: 'ptask', refId: x.id, text: x.title }); UI.toast(t('today.added', { name: x.title })); },
    'today-toggle': (el) => Store.toggleTodayItem(el.dataset.id),
    'today-remove': (el) => Store.removeTodayItem(el.dataset.id),
    'today-carry': () => Store.carryOverToday(),
    'today-pick': () => pickToday(),
    'log-session': (el) => App.Activity.sessionForm({ nodeId: el.dataset.id || null, projectId: el.dataset.project || null, kind: el.dataset.project ? 'project' : 'learning' }),
  });

  /* ------------------------------------------------------------------ */
  /* boot                                                                */
  /* ------------------------------------------------------------------ */

  function boot() {
    Store.load();
    App.i18n.apply(S().settings.lang);
    App.Theme.apply(S().settings);
    applyStaticText();

    UI.initActions();

    Store.subscribe((opts) => {
      App.Theme.apply(S().settings);
      if (opts && opts.silent) return;
      renderSidebarProgress();
      renderTimer();
      if (route.name === 'roadmap' && App.Roadmap.isActive()) App.Roadmap.refresh();
      else rerender();
      App.Detail.render();
    });

    document.getElementById('search-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = document.getElementById('global-search').value.trim();
      location.hash = '#/search?q=' + encodeURIComponent(q);
    });

    document.addEventListener('keydown', (e) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
      if (e.key === '/' && !typing && !document.querySelector('dialog[open]')) {
        e.preventDefault();
        document.getElementById('global-search').focus();
      }
    });

    window.addEventListener('hashchange', navigate);
    setInterval(tickTimer, 1000);

    if (!Store.storageInfo().persistent) {
      UI.toast(t('errors.noStorage'), { tone: 'warn', duration: 9000 });
    }
    navigate();
  }

  App.rerender = rerender;
  App.setLanguage = setLanguage;
  App.route = () => route;
  App.resume = resume;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.App = window.App || {});
