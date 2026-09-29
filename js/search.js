/* Global search across roadmap, notes, resources, projects, project tasks, skills and sessions — with combinable filters. */
(function (App) {
  'use strict';
  const U = App.U, UI = App.UI, M = App.Model, Store = App.Store;
  const t = (...a) => App.i18n.t(...a);

  const GROUPS = {
    tracks: (r) => r.kind === 'node' && ['path', 'track'].includes(r.type),
    courses: (r) => r.kind === 'node' && ['course', 'module'].includes(r.type),
    lessons: (r) => r.kind === 'node' && r.type === 'lesson',
    tasks: (r) => (r.kind === 'node' && r.type === 'task') || r.kind === 'ptask',
    projects: (r) => r.kind === 'project' || r.kind === 'applied',
    skills: (r) => r.kind === 'skill',
    notes: (r) => r.kind === 'note',
    resources: (r) => r.kind === 'resource' || r.kind === 'session',
    lists: (r) => r.kind === 'list' || r.kind === 'listItem',
    certificates: (r) => r.kind === 'certificate',
  };
  const types = new Set();
  const statuses = new Set();

  function statusOf(r) {
    if (r.kind === 'project') return r.status === 'delivered' || r.status === 'ready' ? 'completed' : r.status === 'in_progress' ? 'in_progress' : r.status === 'idea' || r.status === 'planning' ? 'not_started' : r.status;
    return r.status || null;
  }

  function resultRow(r, q) {
    let open, sub = '';
    switch (r.kind) {
      case 'node':
        open = `<button class="link-btn" data-action="open-node" data-id="${r.id}">${U.mark(r.title, q)}</button>`;
        sub = M.ancestors(r.id).map((a) => U.esc(a.title)).join(' › ');
        break;
      case 'note':
        open = r.owner === 'node' ? `<button class="link-btn" data-action="open-node" data-id="${r.id}">${U.esc(r.title)}</button>`
          : r.owner === 'project' ? `<a href="#/projects/${r.id}?tab=notes">${U.esc(r.title)}</a>`
            : `<button class="link-btn" data-action="ptask-edit" data-id="${r.id}">${U.esc(r.title)}</button>`;
        break;
      case 'resource':
        open = U.safeUrl(r.url) ? `<a href="${U.esc(r.url)}" target="_blank" rel="noopener noreferrer">${U.mark(r.title, q)} ${UI.icon('external')}</a>` : U.mark(r.title, q);
        sub = U.esc(r.text);
        break;
      case 'project': case 'applied':
        open = `<a href="#/projects/${r.id}${r.kind === 'applied' ? '?tab=applied' : ''}">${U.mark(r.title, q)}</a>`;
        break;
      case 'ptask':
        open = `<button class="link-btn" data-action="ptask-edit" data-id="${r.id}">${U.mark(r.title, q)}</button>`;
        sub = U.esc(r.text);
        break;
      case 'skill':
        open = `<a href="#/skills">${U.mark(r.title, q)}</a>`;
        break;
      case 'session':
        open = `<a href="#/activity">${U.esc(r.title)}</a>`;
        break;
      case 'certificate':
        open = `<button class="link-btn" data-action="cert-preview" data-id="${r.id}">${U.mark(r.title, q)}</button>`;
        break;
      case 'list': case 'listItem':
        open = `<a href="#/lists">${U.mark(r.title, q)}</a>`;
        sub = r.kind === 'listItem' ? U.esc(r.text) : '';
        break;
      default: open = U.esc(r.title);
    }
    const text = ['node', 'resource', 'ptask', 'listItem'].includes(r.kind) ? '' : r.text;
    const st = statusOf(r);
    const badge = r.kind === 'project' ? UI.projectStatusBadge(r.status) : st && Store.STATUSES.includes(st) ? UI.statusBadge(st) : '';
    const typeLabel = r.kind === 'node' ? t('type.' + r.type) : t('search.kind_' + r.kind);
    return `<li class="result"><span class="type-badge">${U.esc(typeLabel)}</span><div class="res-main">${open}${sub ? `<span class="muted small">${sub}</span>` : ''}${text ? `<p class="small muted">${U.mark(text, q)}</p>` : ''}</div>${badge}</li>`;
  }

  function render(el, params) {
    const q = (params.q || '').trim();
    const input = document.getElementById('global-search');
    if (input && document.activeElement !== input) input.value = q;
    const all = M.search(q);
    const results = all.filter((r) => {
      if (types.size && !Array.from(types).some((g) => GROUPS[g](r))) return false;
      if (statuses.size && !statuses.has(statusOf(r))) return false;
      return true;
    });
    const counts = {};
    Object.keys(GROUPS).forEach((g) => { counts[g] = all.filter(GROUPS[g]).length; });

    el.innerHTML = `<header class="page-head"><div><h1>${U.esc(t('search.title'))}</h1>
        <p class="muted">${q ? U.esc(t('search.summary', { n: results.length, q })) : U.esc(t('search.hint'))}</p></div></header>
      <form class="search-page-form" id="search-page-form" role="search">
        <input type="search" id="search-page-q" value="${U.esc(q)}" placeholder="${U.esc(t('search.placeholder'))}" aria-label="${U.esc(t('search.label'))}">
        <button class="btn primary" type="submit">${UI.icon('search')}<span>${U.esc(t('search.go'))}</span></button>
      </form>
      <div class="filter-bar" role="group" aria-label="${U.esc(t('filters.label'))}">
        <div class="chips">
          <button class="chip-btn ${!types.size && !statuses.size ? 'active' : ''}" data-action="search-clear" aria-pressed="${!types.size && !statuses.size}">${U.esc(t('filters.all'))}</button>
          ${Object.keys(GROUPS).map((g) => `<button class="chip-btn ${types.has(g) ? 'active' : ''}" data-action="search-type" data-value="${g}" aria-pressed="${types.has(g)}">${U.esc(t('search.g_' + g))} <span class="mono muted">${counts[g]}</span></button>`).join('')}
        </div>
        <div class="chips">
          ${['not_started', 'in_progress', 'completed'].map((st) => `<button class="chip-btn ${statuses.has(st) ? 'active' : ''}" data-action="search-status" data-value="${st}" aria-pressed="${statuses.has(st)}">${U.esc(t('status.' + st))}</button>`).join('')}
        </div>
      </div>
      ${!q ? '' : results.length ? `<ul class="results card">${results.slice(0, 300).map((r) => resultRow(r, q)).join('')}</ul>` : UI.empty(t('search.none', { q }))}`;

    document.getElementById('search-page-form').addEventListener('submit', (e) => {
      e.preventDefault();
      location.hash = '#/search?q=' + encodeURIComponent(document.getElementById('search-page-q').value.trim());
    });
  }

  UI.registerActions({
    'search-type': (el) => { const v = el.dataset.value; types.has(v) ? types.delete(v) : types.add(v); App.rerender(); },
    'search-status': (el) => { const v = el.dataset.value; statuses.has(v) ? statuses.delete(v) : statuses.add(v); App.rerender(); },
    'search-clear': () => { types.clear(); statuses.clear(); App.rerender(); },
  });

  App.Pages.search = { render, title: () => t('search.title') };
})(window.App = window.App || {});
