/* UI kit: icons, progress bars, status controls, modal forms, confirm dialogs, toasts, action dispatch. */
(function (App) {
  'use strict';
  const U = App.U;
  const t = (...a) => App.i18n.t(...a);

  /* ------------------------------------------------------------------ */
  /* icons (inline SVG, 24px grid, stroke = currentColor)                */
  /* ------------------------------------------------------------------ */
  const P = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    map: '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M6 8l5 8.2M18 8l-5 8.2"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
    tasks: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11"/><circle cx="5" cy="18" r="1.3"/>',
    skills: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    review: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8 14l2.5 2.5L16 12"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    skip: '<path d="M5 5v14l9-7zM18 5v14"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    half: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
    done: '<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/><path d="m8 12.3 2.7 2.7L16.3 9.5" stroke="var(--on-accent)"/>',
    zoomIn: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/>',
    zoomOut: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/>',
    fit: '<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    note: '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M8 12h8M8 16h6"/>',
    focus: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="3"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.4 1.2-3.8 2.3-5 .3 1.5 1.2 2.5 2.2 2.8C11 8.5 11 5.5 12 3z"/>',
    github: '<path d="M9 19c-4 1.4-4-2-6-2.5m12 5V18a3.4 3.4 0 0 0-1-2.6c3.2-.4 6.5-1.6 6.5-7a5.5 5.5 0 0 0-1.5-3.8 5 5 0 0 0-.1-3.8s-1.2-.4-3.9 1.5a13.4 13.4 0 0 0-7 0C5.3.4 4.1.8 4.1.8A5 5 0 0 0 4 4.6a5.5 5.5 0 0 0-1.5 3.8c0 5.4 3.3 6.6 6.5 7a3.4 3.4 0 0 0-1 2.6v3.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    kanban: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    tree: '<rect x="3" y="3" width="6" height="5" rx="1"/><rect x="15" y="10" width="6" height="5" rx="1"/><rect x="15" y="17" width="6" height="4" rx="1"/><path d="M6 8v11h9M6 12.5h9"/>',
    expand: '<path d="M4 6h16M4 12h16M4 18h16"/><path d="m18 9 3 3-3 3"/>',
    collapse: '<path d="M4 6h16M4 12h10M4 18h16"/>',
    applied: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.8-2.8z"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
    resume: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5z" fill="currentColor"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="M9 14.2 7.5 22l4.5-2.5 4.5 2.5-1.5-7.8"/><path d="m10 9 1.5 1.5L14.5 7.5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  };

  function icon(name, cls = '') {
    return `<svg class="icon i-${name} ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
  }

  const STATUS_ICON = { not_started: 'circle', in_progress: 'half', completed: 'done', skipped: 'skip', locked: 'lock' };

  /* ------------------------------------------------------------------ */
  /* small render helpers                                                */
  /* ------------------------------------------------------------------ */

  function progress(pct, opts = {}) {
    const label = opts.label ? `<span class="progress-label">${U.esc(opts.label)}</span>` : '';
    const value = opts.hideValue ? '' : `<span class="progress-value mono">${pct}%</span>`;
    return `<div class="progress ${opts.size || ''} ${opts.tone || ''}">
      ${label || value ? `<div class="progress-head">${label}${value}</div>` : ''}
      <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${U.esc(opts.aria || opts.label || t('common.progress'))}">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
    </div>`;
  }

  function statusBadge(status, kind = 'status') {
    return `<span class="badge st-${U.esc(status)}">${icon(STATUS_ICON[status] || 'circle')}${U.esc(t(kind + '.' + status))}</span>`;
  }

  function typeBadge(type) {
    return `<span class="type-badge t-${U.esc(type)}">${U.esc(t('type.' + type))}</span>`;
  }

  function projectStatusBadge(status) {
    return `<span class="badge ps-${U.esc(status)}">${U.esc(t('pstatus.' + status))}</span>`;
  }

  function priorityBadge(p) {
    return `<span class="prio prio-${U.esc(p)}" title="${U.esc(t('field.priority'))}: ${U.esc(t('priority.' + p))}">${U.esc(t('priority.' + p))}</span>`;
  }

  /** Round checkbox-like toggle that cycles / sets status. */
  function statusToggle(action, id, status, label) {
    const next = status === 'completed' ? 'not_started' : 'completed';
    const aria = status === 'completed' ? t('actions.markNotDone', { name: label }) : t('actions.markDone', { name: label });
    return `<button class="status-toggle st-${status}" data-action="${action}" data-id="${U.esc(id)}" data-value="${next}" aria-label="${U.esc(aria)}" aria-pressed="${status === 'completed'}" title="${U.esc(t('status.' + status))}">${icon(STATUS_ICON[status] || 'circle')}</button>`;
  }

  /** Segmented control listing every status. */
  function statusSegment(action, id, current, statuses, prefix = 'status') {
    return `<div class="segment" role="group" aria-label="${U.esc(t('field.status'))}">
      ${statuses.map((s) => `<button class="seg-btn st-${s} ${s === current ? 'active' : ''}" data-action="${action}" data-id="${U.esc(id)}" data-value="${s}" aria-pressed="${s === current}">${icon(STATUS_ICON[s] || 'circle')}<span>${U.esc(t(prefix + '.' + s))}</span></button>`).join('')}
    </div>`;
  }

  function empty(text, extra = '') {
    return `<div class="empty"><p>${U.esc(text)}</p>${extra}</div>`;
  }

  function btn(label, action, opts = {}) {
    const attrs = Object.entries(opts.data || {}).map(([k, v]) => ` data-${k}="${U.esc(v)}"`).join('');
    return `<button class="btn ${opts.cls || ''}" data-action="${action}"${attrs}${opts.title ? ` title="${U.esc(opts.title)}"` : ''}${opts.aria ? ` aria-label="${U.esc(opts.aria)}"` : ''}>${opts.icon ? icon(opts.icon) : ''}${label ? `<span>${U.esc(label)}</span>` : ''}</button>`;
  }

  function iconBtn(iconName, action, aria, data = {}, cls = '') {
    const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${U.esc(v)}"`).join('');
    return `<button class="icon-btn ${cls}" data-action="${action}"${attrs} aria-label="${U.esc(aria)}" title="${U.esc(aria)}">${icon(iconName)}</button>`;
  }

  function resourceIcon(type) {
    return { youtube: 'play', docs: 'book', github: 'github', article: 'note', project: 'folder', exercise: 'tasks', course: 'book' }[type] || 'link';
  }

  function resourceList(kind, ownerId, resources, removable = true) {
    if (!resources || !resources.length) return `<p class="muted small">${U.esc(t('detail.noResources'))}</p>`;
    return `<ul class="res-list">${resources.map((r) => {
      const url = U.safeUrl(r.url);
      return `<li>
        ${icon(resourceIcon(r.type))}
        ${url ? `<a href="${U.esc(url)}" target="_blank" rel="noopener noreferrer">${U.esc(r.label || url)}</a>` : `<span>${U.esc(r.label)}</span>`}
        <span class="res-type">${U.esc(t('res.' + r.type))}</span>
        ${removable ? iconBtn('x', 'remove-resource', t('actions.removeResource', { name: r.label }), { kind, id: ownerId, res: r.id }, 'sm') : ''}
      </li>`;
    }).join('')}</ul>`;
  }

  /* ------------------------------------------------------------------ */
  /* modal forms                                                         */
  /* ------------------------------------------------------------------ */

  let dialog, dialogResolve = null;

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.getElementById('modal');
    dialog.addEventListener('close', () => {
      // The close event arrives asynchronously; if another dialog was opened meanwhile, leave it alone.
      if (dialog.open) return;
      if (dialogResolve) { const r = dialogResolve; dialogResolve = null; r(null); }
      dialog.innerHTML = '';
    });
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    return dialog;
  }

  function fieldHtml(f, value) {
    const id = 'f_' + f.name;
    const req = f.required ? ' required' : '';
    const label = `<label for="${id}">${U.esc(f.label)}${f.required ? ' <span aria-hidden="true" class="req">*</span>' : ''}</label>`;
    const help = f.help ? `<p class="help">${U.esc(f.help)}</p>` : '';
    const v = value == null ? '' : value;
    let input = '';
    switch (f.type) {
      case 'textarea':
        input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 4}" placeholder="${U.esc(f.placeholder || '')}"${req}>${U.esc(v)}</textarea>`;
        break;
      case 'select':
        input = `<select id="${id}" name="${f.name}"${req}>${f.options.map((o) => `<option value="${U.esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${U.esc(o.label)}</option>`).join('')}</select>`;
        break;
      case 'checklist': {
        const set = new Set(v || []);
        input = `<div class="checklist-field" id="${id}">
          ${f.options.length > 8 ? `<input type="search" class="checklist-filter" placeholder="${U.esc(t('common.filter'))}" aria-label="${U.esc(t('common.filter'))}">` : ''}
          <div class="checklist-options">${f.options.map((o) => `<label class="check-opt" style="--indent:${o.depth || 0}" data-text="${U.esc(U.norm(o.label))}"><input type="checkbox" name="${f.name}" value="${U.esc(o.value)}" ${set.has(o.value) ? 'checked' : ''}> <span>${U.esc(o.label)}</span>${o.hint ? `<small>${U.esc(o.hint)}</small>` : ''}</label>`).join('') || `<p class="muted small">${U.esc(t('common.nothingToPick'))}</p>`}</div>
        </div>`;
        return `<fieldset class="field ${f.full ? 'full' : ''}"><legend>${U.esc(f.label)}</legend>${input}${help}</fieldset>`;
      }
      default:
        input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${U.esc(v)}" placeholder="${U.esc(f.placeholder || '')}"${req}${f.min != null ? ` min="${f.min}"` : ''}${f.step ? ` step="${f.step}"` : ''}${f.list ? ` list="${id}_list"` : ''} autocomplete="off">`;
        if (f.list) input += `<datalist id="${id}_list">${f.list.map((o) => `<option value="${U.esc(o)}">`).join('')}</datalist>`;
    }
    return `<div class="field ${f.full ? 'full' : ''}">${label}${input}${help}</div>`;
  }

  /**
   * Open a form in the modal. Resolves with the values object, or null if cancelled.
   * fields: [{ name, label, type, options, required, full, help }]
   */
  function form({ title, fields, values = {}, submitLabel, intro, validate, wide }) {
    const d = ensureDialog();
    d.className = wide ? 'wide' : '';
    d.innerHTML = `<form method="dialog" class="modal-form" novalidate>
      <header class="modal-head"><h2 id="modal-title">${U.esc(title)}</h2>${iconBtn('x', 'modal-close', t('common.close'))}</header>
      ${intro ? `<p class="modal-intro">${U.esc(intro)}</p>` : ''}
      <div class="form-grid">${fields.map((f) => fieldHtml(f, values[f.name])).join('')}</div>
      <p class="form-error" role="alert" hidden></p>
      <footer class="modal-foot">
        <button type="button" class="btn ghost" data-action="modal-close">${U.esc(t('common.cancel'))}</button>
        <button type="submit" class="btn primary">${U.esc(submitLabel || t('common.save'))}</button>
      </footer>
    </form>`;
    d.setAttribute('aria-labelledby', 'modal-title');
    const formEl = d.querySelector('form');

    d.querySelectorAll('.checklist-filter').forEach((inp) => {
      inp.addEventListener('input', () => {
        const q = U.norm(inp.value);
        inp.parentElement.querySelectorAll('.check-opt').forEach((o) => { o.hidden = q && !o.dataset.text.includes(q); });
      });
    });

    return new Promise((resolve) => {
      dialogResolve = resolve;
      formEl.addEventListener('submit', (e) => {
        e.preventDefault();
        const out = {};
        fields.forEach((f) => {
          if (f.type === 'checklist') out[f.name] = U.$$(`input[name="${f.name}"]:checked`, formEl).map((i) => i.value);
          else {
            const el = formEl.elements[f.name];
            out[f.name] = el ? (f.type === 'number' ? el.value : el.value.trim()) : '';
          }
        });
        const missing = fields.find((f) => f.required && !String(out[f.name] || '').trim());
        const err = missing ? t('errors.required', { field: missing.label }) : (validate ? validate(out) : null);
        const errEl = formEl.querySelector('.form-error');
        if (err) { errEl.textContent = err; errEl.hidden = false; return; }
        const r = dialogResolve; dialogResolve = null;
        d.close();
        r(out);
      });
      d.showModal();
      const first = formEl.querySelector('input:not([type=checkbox]):not([type=search]), textarea, select');
      if (first) first.focus();
    });
  }

  /** Confirmation dialog. requireText makes the user type a word (for destructive resets). */
  function confirm({ title, message, confirmLabel, danger = true, requireText }) {
    const d = ensureDialog();
    d.className = 'narrow';
    d.innerHTML = `<form method="dialog" class="modal-form" role="alertdialog" aria-describedby="confirm-msg">
      <header class="modal-head"><h2 id="modal-title">${U.esc(title)}</h2></header>
      <p id="confirm-msg" class="modal-intro">${U.esc(message)}</p>
      ${requireText ? `<div class="field"><label for="confirm-text">${U.esc(t('common.typeToConfirm', { word: requireText }))}</label><input id="confirm-text" autocomplete="off"></div>` : ''}
      <footer class="modal-foot">
        <button type="button" class="btn ghost" data-action="modal-close">${U.esc(t('common.cancel'))}</button>
        <button type="submit" class="btn ${danger ? 'danger' : 'primary'}" ${requireText ? 'disabled' : ''}>${U.esc(confirmLabel || t('common.confirm'))}</button>
      </footer>
    </form>`;
    d.setAttribute('aria-labelledby', 'modal-title');
    const f = d.querySelector('form');
    const submit = f.querySelector('[type=submit]');
    if (requireText) {
      const inp = f.querySelector('#confirm-text');
      inp.addEventListener('input', () => { submit.disabled = inp.value.trim() !== requireText; });
    }
    return new Promise((resolve) => {
      dialogResolve = (v) => resolve(!!v);
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const r = dialogResolve; dialogResolve = null;
        d.close();
        r(true);
      });
      d.showModal();
      (requireText ? f.querySelector('#confirm-text') : f.querySelector('.btn.ghost')).focus();
    });
  }

  function closeModal() { if (dialog && dialog.open) dialog.close(); }

  /** Show arbitrary content in the shared dialog (for previews). Close with data-action="modal-close". */
  function showDialog(html, cls = '') {
    const d = ensureDialog();
    if (d.open) d.close();
    d.className = cls;
    d.innerHTML = html;
    d.removeAttribute('aria-labelledby');
    const title = d.querySelector('h2[id]');
    if (title) d.setAttribute('aria-labelledby', title.id);
    d.showModal();
    const first = d.querySelector('.modal-foot .btn, [data-autofocus]');
    if (first) first.focus();
    return d;
  }

  /* ------------------------------------------------------------------ */
  /* toasts                                                              */
  /* ------------------------------------------------------------------ */

  function toast(message, opts = {}) {
    const host = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast' + (opts.tone ? ' ' + opts.tone : '');
    el.setAttribute('role', 'status');
    el.innerHTML = `<span>${U.esc(message)}</span>`;
    if (opts.action) {
      const b = document.createElement('button');
      b.className = 'btn sm ghost';
      b.textContent = opts.action.label;
      b.addEventListener('click', () => { opts.action.fn(); el.remove(); });
      el.appendChild(b);
    }
    host.appendChild(el);
    setTimeout(() => el.remove(), opts.duration || (opts.action ? 7000 : 3200));
  }

  /** Run a destructive change with an Undo toast backed by a full snapshot. */
  function withUndo(message, fn) {
    const snap = App.Store.snapshot();
    fn();
    toast(message, { action: { label: t('common.undo'), fn: () => App.Store.restore(snap) } });
  }

  /* ------------------------------------------------------------------ */
  /* action dispatch: <button data-action="name" data-id="...">          */
  /* ------------------------------------------------------------------ */

  const actions = {};
  function registerActions(map) { Object.assign(actions, map); }

  function initActions() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el || el.disabled) return;
      const fn = actions[el.dataset.action];
      if (!fn) return;
      if (App.Public && !App.Public.allows(el.dataset.action)) { e.preventDefault(); return; }
      if (el.tagName === 'A' || el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') e.preventDefault();
      fn(el, e);
    });
    document.addEventListener('change', (e) => {
      const el = e.target.closest('[data-change]');
      if (!el) return;
      const fn = actions[el.dataset.change];
      if (App.Public && !App.Public.allows(el.dataset.change)) return;
      if (fn) fn(el, e);
    });
  }

  registerActions({ 'modal-close': () => closeModal() });

  /* ------------------------------------------------------------------ */
  /* option builders for forms                                           */
  /* ------------------------------------------------------------------ */

  function nodeOptions(filterTypes, excludeIds = []) {
    const s = App.Store.state;
    const ex = new Set(excludeIds);
    return App.Model.order()
      .filter((id) => !ex.has(id) && (!filterTypes || filterTypes.includes(s.nodes[id].type)))
      .map((id) => {
        const n = s.nodes[id];
        return { value: id, label: n.title, depth: App.Model.info(id).depth, hint: t('type.' + n.type) };
      });
  }

  function enumOptions(values, prefix) { return values.map((v) => ({ value: v, label: t(prefix + '.' + v) })); }

  App.UI = {
    icon, progress, statusBadge, typeBadge, projectStatusBadge, priorityBadge, statusToggle, statusSegment,
    empty, btn, iconBtn, resourceList, resourceIcon, form, confirm, closeModal, showDialog, toast, withUndo,
    registerActions, initActions, actions, nodeOptions, enumOptions, STATUS_ICON,
  };
})(window.App = window.App || {});
