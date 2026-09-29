/*
 * Public read-only page.
 *
 * The owner keeps using the app normally (data in this browser's localStorage).
 * "Download public file" builds a trimmed copy of the data — only what is meant to be seen —
 * as data/public-state.js. Once that file is uploaded next to index.html, anyone who opens the
 * site sees that copy, read-only. Nothing a visitor does is ever saved.
 *
 * Modes (decided once, before the store loads):
 *   owner    — normal app (no published file, or this browser was marked as the owner's)
 *   visitor  — a published file exists and this browser is not the owner's → read-only copy
 *   preview  — the owner looking at exactly what visitors will see (this tab only)
 */
(function (App) {
  'use strict';

  const OWNER_KEY = 'lcc.owner';
  const PREVIEW_KEY = 'lcc.preview';
  const LANG_KEY = 'lcc.visitor.lang';
  const STATE_KEY = 'lcc.state.v1';
  const FILE_NAME = 'public-state.js';

  /* Pages a visitor can open. Everything else redirects to the dashboard. */
  const PAGES = new Set(['dashboard', 'roadmap', 'learn', 'courses', 'certificates', 'projects', 'skills', 'search']);
  /* Project workspace tabs a visitor can open. */
  const PROJECT_TABS = ['overview', 'tasks', 'milestones', 'applied', 'learning'];

  /* Actions that only look at data (navigate, filter, zoom, preview) — everything else is editing. */
  const ALLOW = new Set([
    'open-node', 'detail-close', 'node-page', 'show-on-map', 'go', 'nav-toggle', 'toggle-lang', 'set-lang',
    'modal-close', 'modal-close-go', 'cert-preview', 'cert-zoom', 'cert-filter', 'cert-status-filter',
    'course-filter', 'course-track', 'course-provider',
    'rm-mode', 'rm-zoom-in', 'rm-zoom-out', 'rm-fit', 'rm-reset', 'rm-toggle', 'rm-expand-all', 'rm-collapse-all',
    'rm-depth', 'rm-deps', 'rm-hl-status',
    'proj-scope', 'proj-status', 'proj-tech', 'proj-progress', 'proj-view', 'ptf-status', 'ptf-priority', 'set-setting',
    'skills-sort', 'search-type', 'search-status', 'search-clear',
    'public-owner', 'public-exit-preview',
  ]);
  /* Editing controls that also *show* a state (status toggles, status pickers): kept visible, disabled. */
  const SHOW_DISABLED = new Set(['node-status', 'node-toggle', 'ptask-toggle', 'ptask-status-select', 'proj-status-set', 'list-item-status', 'today-toggle']);

  /* ---------------- tiny storage helpers (storage may be blocked) ---------------- */
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function ssGet(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { if (v == null) window.sessionStorage.removeItem(k); else window.sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  function validPublished(p) {
    return p && typeof p === 'object' && p.data && typeof p.data === 'object'
      && p.data.nodes && typeof p.data.nodes === 'object' && Array.isArray(p.data.rootIds);
  }

  const published = validPublished(window.LCC_PUBLIC) ? window.LCC_PUBLIC : null;

  /** Has this browser really been used (not just opened once)? Then it belongs to the owner. */
  function usedLocally() {
    const raw = lsGet(STATE_KEY);
    if (!raw) return false;
    try {
      const s = JSON.parse(raw);
      return !!s && Number(s.updatedAt) - Number(s.createdAt) > 2000;
    } catch (e) { return false; }
  }

  function decide() {
    let owner = lsGet(OWNER_KEY) === '1';
    // Anyone who was already using the app before a public file existed is the owner.
    if (!owner && !published && usedLocally()) { lsSet(OWNER_KEY, '1'); owner = true; }
    if (owner && ssGet(PREVIEW_KEY) === '1') return 'preview';
    if (published && !owner) return 'visitor';
    return 'owner';
  }

  const mode = decide();
  const active = mode !== 'owner';
  let ownerMarked = lsGet(OWNER_KEY) === '1';

  /* ------------------------------------------------------------------ */
  /* the trimmed copy                                                    */
  /* ------------------------------------------------------------------ */

  function pick(obj, keys) {
    const out = {};
    keys.forEach((k) => { if (obj[k] !== undefined) out[k] = obj[k]; });
    return out;
  }

  const SETTINGS_KEYS = ['userName', 'lang', 'theme', 'accent', 'colors', 'density', 'motion', 'progressMode', 'roadmapView',
    'roadmapDepth', 'showDeps', 'weekStart', 'taskGrouping', 'defaultProjectView', 'focusNodeId'];
  const NODE_KEYS = ['id', 'type', 'parentId', 'children', 'title', 'status', 'prereqs', 'provider', 'url', 'category',
    'startDate', 'targetDate', 'createdAt', 'startedAt', 'completedAt', 'completions', 'review'];
  const PROJECT_KEYS = ['id', 'name', 'description', 'type', 'status', 'technologies', 'repoUrl', 'liveUrl', 'docsUrl',
    'startDate', 'targetDate', 'groups', 'applied', 'learningNodeIds', 'view', 'createdAt', 'updatedAt', 'lastActivityAt'];
  const MILESTONE_KEYS = ['id', 'name', 'targetDate', 'order'];
  const PTASK_KEYS = ['id', 'projectId', 'groupId', 'milestoneId', 'title', 'status', 'priority', 'dueDate', 'deps', 'nodeId',
    'order', 'createdAt', 'completedAt'];
  const SKILL_KEYS = ['id', 'name', 'description', 'nodeIds', 'createdAt'];
  const CERT_KEYS = ['id', 'nodeId', 'courseTitle', 'title', 'provider', 'issueDate', 'expiryDate', 'credentialId', 'status',
    'certificateUrl', 'imageUrl', 'thumbnailUrl', 'createdAt'];

  /**
   * Build the public copy from the owner's state. Allow-list only: a field that is not named here
   * never leaves the browser (notes, resources, sessions, activity, reviews, lists, today…).
   */
  function build(src) {
    const s = JSON.parse(JSON.stringify(src));
    const out = App.Store.emptyState();
    out.createdAt = s.createdAt;
    out.updatedAt = s.updatedAt;
    out.settings = Object.assign(out.settings, pick(s.settings || {}, SETTINGS_KEYS));
    out.settings.learningGoal = '';
    out.settings.collapsed = {};
    out.settings.expanded = {};

    out.rootIds = (s.rootIds || []).slice();
    Object.values(s.nodes || {}).forEach((n) => { out.nodes[n.id] = pick(n, NODE_KEYS); });
    out.position = s.position && s.position.nodeId ? { nodeId: s.position.nodeId, ts: s.position.ts } : null;

    out.projectOrder = (s.projectOrder || []).slice();
    Object.values(s.projects || {}).forEach((p) => {
      const q = pick(p, PROJECT_KEYS);
      q.milestones = (p.milestones || []).map((m) => pick(m, MILESTONE_KEYS));
      out.projects[p.id] = q;
    });
    Object.values(s.ptasks || {}).forEach((x) => { out.ptasks[x.id] = pick(x, PTASK_KEYS); });

    out.skillOrder = (s.skillOrder || []).slice();
    Object.values(s.skills || {}).forEach((k) => { out.skills[k.id] = pick(k, SKILL_KEYS); });
    out.technologies = (s.technologies || []).slice();

    // Only certificates actually earned.
    out.certificates = (s.certificates || []).filter((c) => c && c.status === 'earned').map((c) => pick(c, CERT_KEYS));
    return out;
  }

  function fileText(state) {
    const payload = { app: 'learning-command-center', kind: 'public', publishedAt: new Date().toISOString(), data: build(state) };
    return '/* Learning Command Center — public read-only copy.\n'
      + ' * Generated from Settings → Public page. To update what visitors see, replace this file with a newly downloaded one.\n'
      + ' * It only contains what is listed in js/public.js → build(). */\n'
      + 'window.LCC_PUBLIC = ' + JSON.stringify(payload) + ';\n';
  }

  /** Called by Store.load(): the state this tab should show, or null for the normal (owner) path. */
  function initialState() {
    if (mode === 'visitor') {
      const data = JSON.parse(JSON.stringify(published.data));
      const lang = lsGet(LANG_KEY);
      if (lang) data.settings = Object.assign({}, data.settings, { lang });
      return data;
    }
    if (mode === 'preview') {
      let raw = null;
      try { raw = JSON.parse(lsGet(STATE_KEY) || 'null'); } catch (e) { raw = null; }
      return build(App.Store.normalize(raw || App.Seed.create()));
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* read-only UI                                                        */
  /* ------------------------------------------------------------------ */

  function allows(action) { return !active || ALLOW.has(action); }

  /** Hide editing controls; keep status displays but make them inert. */
  function scrub(root) {
    if (!active || !root || root.nodeType !== 1) return;
    const els = [root, ...root.querySelectorAll('[data-action],[data-change],[draggable="true"],textarea,[data-enter],input[data-import]')];
    els.forEach((el) => {
      if (el.getAttribute('draggable') === 'true') el.setAttribute('draggable', 'false');
      if (el.matches('textarea,[data-enter],input[data-import]')) { el.readOnly = true; el.disabled = true; }
      const name = el.dataset && (el.dataset.action || el.dataset.change);
      if (!name || ALLOW.has(name)) return;
      const isText = el.classList.contains('link-btn') || el.classList.contains('crumb') || el.classList.contains('chip');
      const showsState = SHOW_DISABLED.has(name) && !el.classList.contains('btn') && !el.classList.contains('icon-btn');
      if (isText || showsState) {
        el.disabled = true;
        el.classList.add('pub-static');
      } else {
        el.classList.add('pub-hidden');
        el.setAttribute('aria-hidden', 'true');
        el.tabIndex = -1;
      }
    });
  }

  function watch() {
    if (!active) return;
    document.body.classList.add('is-public');
    scrub(document.body);
    new MutationObserver((records) => {
      records.forEach((r) => r.addedNodes.forEach((n) => scrub(n)));
    }).observe(document.body, { childList: true, subtree: true });
  }

  function publishedAt() {
    const src = mode === 'visitor' ? published : null;
    return src && src.publishedAt ? src.publishedAt : null;
  }

  function banner() {
    const U = App.U, UI = App.UI, t = App.i18n.t;
    if (!active) return '';
    const name = App.Store.state.settings.userName;
    if (mode === 'preview') {
      return `<span class="pb-text">${UI.icon('focus')} ${U.esc(t('public.previewBanner'))}</span>
        <button class="btn sm" data-action="public-exit-preview">${UI.icon('x')}<span>${U.esc(t('public.exitPreview'))}</span></button>`;
    }
    const when = publishedAt();
    return `<span class="pb-text">${UI.icon('focus')} ${U.esc(name ? t('public.banner', { name }) : t('public.bannerNoName'))}${when ? ` <span class="muted">· ${U.esc(t('public.updated', { date: U.fmtDate(when) }))}</span>` : ''}</span>
      <button class="link-btn small muted" data-action="public-owner">${U.esc(t('public.owner'))}</button>`;
  }

  /* ------------------------------------------------------------------ */
  /* owner actions                                                       */
  /* ------------------------------------------------------------------ */

  function download() {
    App.U.download(FILE_NAME, fileText(App.Store.state), 'text/javascript');
    markOwner();
    App.UI.toast(App.i18n.t('public.downloaded'), { duration: 6000 });
  }

  function startPreview() {
    markOwner();
    ssSet(PREVIEW_KEY, '1');
    location.hash = '#/dashboard';
    location.reload();
  }

  function exitPreview() {
    ssSet(PREVIEW_KEY, null);
    location.hash = '#/settings';
    location.reload();
  }

  /** Remember that this browser belongs to the owner (so a published file never hides their own data). */
  function markOwner() {
    if (ownerMarked || mode !== 'owner') return;
    lsSet(OWNER_KEY, '1');
    ownerMarked = true;
  }

  async function becomeOwner() {
    const t = App.i18n.t;
    const ok = await App.UI.confirm({ title: t('public.ownerTitle'), message: t('public.ownerMessage'), confirmLabel: t('public.ownerConfirm'), danger: false });
    if (!ok) return;
    lsSet(OWNER_KEY, '1');
    ssSet(PREVIEW_KEY, null);
    location.hash = '#/dashboard';
    location.reload();
  }

  function rememberLang(lang) { if (mode === 'visitor') lsSet(LANG_KEY, lang); }

  /** Settings → Public page card (owner only). */
  function settingsSection() {
    const U = App.U, UI = App.UI, t = App.i18n.t;
    const when = published && published.publishedAt;
    return `<section class="card public-card" aria-labelledby="s-public"><h2 id="s-public">${UI.icon('external')} ${U.esc(t('public.title'))}</h2>
      <p class="muted small">${U.esc(t('public.intro'))}</p>
      <ul class="public-list small">
        <li>${UI.icon('check', 'st-completed')} ${U.esc(t('public.includes'))}</li>
        <li>${UI.icon('lock', 'muted')} ${U.esc(t('public.excludes'))}</li>
      </ul>
      <p class="small">${U.esc(t('public.steps'))}</p>
      <p class="muted small">${U.esc(when ? t('public.published', { date: U.fmtDate(when) + ' ' + U.fmtTime(when) }) : t('public.notPublished'))}</p>
      <div class="btn-row mt">
        ${UI.btn(t('public.download'), 'public-download', { cls: 'sm primary', icon: 'download' })}
        ${UI.btn(t('public.preview'), 'public-preview', { cls: 'sm ghost', icon: 'focus' })}
      </div>
    </section>`;
  }

  App.UI.registerActions({
    'public-download': () => download(),
    'public-preview': () => startPreview(),
    'public-exit-preview': () => exitPreview(),
    'public-owner': () => becomeOwner(),
  });

  App.Public = {
    mode, active, published, PAGES, PROJECT_TABS,
    get isVisitor() { return mode === 'visitor'; },
    get isPreview() { return mode === 'preview'; },
    allows, scrub, watch, banner, build, fileText, initialState, download, startPreview, exitPreview,
    markOwner, becomeOwner, rememberLang, settingsSection, publishedAt,
    pageAllowed: (name) => !active || PAGES.has(name),
  };
})(window.App = window.App || {});
