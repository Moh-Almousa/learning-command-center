/*
 * Certificates: a gallery of course certificates.
 * - Each certificate belongs to a course and never affects the course's completion.
 * - Only small metadata + links are stored. Images load lazily as thumbnails; the full image
 *   loads only in the preview. All file access goes through asset(), so moving files to a
 *   backend later means changing that one function, not this section.
 */
(function (App) {
  'use strict';
  const U = App.U, UI = App.UI, M = App.Model, Store = App.Store;
  const t = (...a) => App.i18n.t(...a);
  const S = () => Store.state;

  const filters = { q: '', course: '', provider: '', status: '' };
  const PROVIDER_LABEL = (p) => (Store.PROVIDERS.includes(p) ? t('provider.' + p) : p);

  /* ------------------------------------------------------------------ */
  /* data helpers                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Where a certificate's files live. Today: links you paste (https only).
   * Future upload backend: return URLs built from cert.file ({ storage, key }) here.
   */
  function asset(cert, kind) {
    if (kind === 'thumb') return U.safeUrl(cert.thumbnailUrl) || U.safeUrl(cert.imageUrl);
    if (kind === 'image') return U.safeUrl(cert.imageUrl);
    return U.safeUrl(cert.certificateUrl) || U.safeUrl(cert.imageUrl);
  }

  function statusOf(c) {
    if (c.status === 'earned' && c.expiryDate && c.expiryDate < U.dayKey()) return 'expired';
    return c.status;
  }

  function course(c) { return c.nodeId ? S().nodes[c.nodeId] : null; }
  function courseName(c) { const n = course(c); return n ? n.title : c.courseTitle || t('certs.noCourse'); }
  function forNode(id) { return S().certificates.filter((c) => c.nodeId === id); }

  function sorted() {
    return S().certificates.slice().sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || '') || b.createdAt - a.createdAt);
  }

  function initials(text) {
    return String(text || '?').split(/[\s\-—()]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  }

  /* ------------------------------------------------------------------ */
  /* form                                                                */
  /* ------------------------------------------------------------------ */

  async function certForm(certId, preset = {}) {
    const s = S();
    const c = certId ? s.certificates.find((x) => x.id === certId) : null;
    const courses = M.order().filter((id) => s.nodes[id].type === 'course');
    if (!courses.length) { UI.toast(t('certs.needCourse'), { tone: 'warn' }); return; }
    const nodeId = (c && c.nodeId) || preset.nodeId || courses.find((id) => M.status(id) === 'completed') || courses[0];
    const n = s.nodes[nodeId];
    const providers = U.unique(s.certificates.map((x) => x.provider).filter(Boolean));
    const defaults = c || {
      nodeId, title: n ? n.title : '', provider: n && n.provider ? PROVIDER_LABEL(n.provider) : '',
      issueDate: U.dayKey(), status: 'earned',
    };
    const v = await UI.form({
      title: c ? t('certs.edit') : t('certs.add'),
      intro: c ? '' : t('certs.formIntro'),
      wide: true,
      fields: [
        { name: 'nodeId', label: t('certs.course'), type: 'select', required: true, full: true,
          options: courses.map((id) => ({ value: id, label: `${s.nodes[id].title}${M.status(id) === 'completed' ? ' ✓' : ''}` })) },
        { name: 'title', label: t('certs.title'), required: true, full: true },
        { name: 'provider', label: t('certs.provider'), list: providers, placeholder: 'Coursera, Udemy, Programming Advices…' },
        { name: 'status', label: t('field.status'), type: 'select', options: Store.CERT_STATUSES.map((x) => ({ value: x, label: t('certs.s_' + x) })) },
        { name: 'issueDate', label: t('certs.issueDate'), type: 'date' },
        { name: 'expiryDate', label: t('certs.expiryDate'), type: 'date', help: t('certs.expiryHelp') },
        { name: 'credentialId', label: t('certs.credentialId'), full: true },
        { name: 'certificateUrl', label: t('certs.certificateUrl'), type: 'url', placeholder: 'https://', full: true, help: t('certs.certificateUrlHelp') },
        { name: 'imageUrl', label: t('certs.imageUrl'), type: 'url', placeholder: 'https://…/certificate.png', full: true, help: t('certs.imageUrlHelp') },
        { name: 'thumbnailUrl', label: t('certs.thumbnailUrl'), type: 'url', placeholder: 'https://…/certificate-small.png', full: true, help: t('certs.thumbnailHelp') },
        { name: 'notes', label: t('field.notes'), type: 'textarea', rows: 2, full: true },
      ],
      values: defaults,
      validate: (x) => {
        const bad = ['certificateUrl', 'imageUrl', 'thumbnailUrl'].find((k) => x[k] && !U.isUrl(x[k]));
        if (bad) return /^data:/i.test(x[bad]) ? t('certs.noEmbedded') : t('errors.url');
        if (x.expiryDate && x.issueDate && x.expiryDate < x.issueDate) return t('certs.badExpiry');
        return null;
      },
    });
    if (!v) return;
    const id = Store.saveCertificate(Object.assign({ id: c ? c.id : undefined }, v));
    UI.toast(c ? t('toast.saved') : t('certs.added', { name: v.title }));
    return id;
  }

  /* ------------------------------------------------------------------ */
  /* card + preview                                                      */
  /* ------------------------------------------------------------------ */

  /** Designed stand-in when there is no image (or it fails to load). */
  function placeholder(c) {
    return `<div class="cert-ph" aria-hidden="true">
      <span class="cert-ph-seal">${UI.icon('award')}</span>
      <span class="cert-ph-kicker">${U.esc(t('certs.ofCompletion'))}</span>
      <span class="cert-ph-title">${U.esc(c.title || courseName(c))}</span>
      <span class="cert-ph-provider">${U.esc(c.provider || initials(courseName(c)))}</span>
    </div>`;
  }

  function thumb(c, eager = false) {
    const src = asset(c, 'thumb');
    return `<div class="cert-thumb">${src
      ? `<img src="${U.esc(src)}" alt="" loading="${eager ? 'eager' : 'lazy'}" decoding="async" width="400" height="283" data-cert-img>${placeholder(c)}`
      : placeholder(c)}</div>`;
  }

  function badge(c) {
    const st = statusOf(c);
    return `<span class="badge cert-st-${st}">${UI.icon(st === 'earned' ? 'award' : st === 'expired' ? 'clock' : 'half')}${U.esc(t('certs.s_' + st))}</span>`;
  }

  function card(c) {
    const n = course(c);
    return `<article class="cert-card st-${statusOf(c)}">
      <button class="cert-open" data-action="cert-preview" data-id="${c.id}" aria-label="${U.esc(t('certs.previewOf', { name: c.title || courseName(c) }))}">
        ${thumb(c)}
      </button>
      <div class="cert-body">
        <div class="cert-top">${badge(c)}${c.issueDate ? `<time class="mono small muted" datetime="${c.issueDate}">${U.esc(U.fmtDate(c.issueDate))}</time>` : ''}</div>
        <h3 class="cert-title"><button class="link-btn" data-action="cert-preview" data-id="${c.id}">${U.esc(c.title || courseName(c))}</button></h3>
        <p class="small muted cert-course">${UI.icon('book')} ${n ? `<a href="#/learn/${n.id}">${U.esc(n.title)}</a>` : U.esc(courseName(c))}</p>
        <p class="small cert-provider">${U.esc(c.provider || '—')}</p>
        ${c.credentialId ? `<p class="mono small cert-id" title="${U.esc(t('certs.credentialId'))}">${U.esc(c.credentialId)}</p>` : ''}
      </div>
    </article>`;
  }

  function preview(id) {
    const c = S().certificates.find((x) => x.id === id);
    if (!c) return;
    const n = course(c);
    const img = asset(c, 'image');
    const original = asset(c, 'original');
    const done = n ? M.firstCompleted(n) : null;
    const rows = [
      [t('certs.course'), n ? `<a href="#/learn/${n.id}" data-action="modal-close-go" data-href="#/learn/${n.id}">${U.esc(n.title)}</a>` : U.esc(courseName(c))],
      [t('certs.provider'), U.esc(c.provider || '—')],
      [t('certs.issueDate'), U.esc(c.issueDate ? U.fmtDate(c.issueDate) : '—')],
      c.expiryDate ? [t('certs.expiryDate'), U.esc(U.fmtDate(c.expiryDate))] : null,
      c.credentialId ? [t('certs.credentialId'), `<span class="mono">${U.esc(c.credentialId)}</span>`] : null,
      n ? [t('certs.courseRecord'), done ? U.esc(t('history.completedOn', { date: U.fmtDate(done) })) : U.esc(t('status.' + M.status(n.id)))] : null,
    ].filter(Boolean);
    UI.showDialog(`<div class="cert-preview">
      <header class="modal-head"><h2 id="cert-title">${U.esc(c.title || courseName(c))}</h2>${UI.iconBtn('x', 'modal-close', t('common.close'))}</header>
      <div class="cert-stage" id="cert-stage">
        ${img ? `<img src="${U.esc(img)}" alt="${U.esc(t('certs.imageAlt', { name: c.title || courseName(c) }))}" decoding="async" data-cert-img>${placeholder(c)}` : placeholder(c)}
      </div>
      <div class="cert-meta">
        ${badge(c)}
        <dl class="meta">${rows.map(([k, v]) => `<dt>${U.esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>
        ${c.notes ? `<p class="small muted pre">${U.esc(c.notes)}</p>` : ''}
      </div>
      <footer class="modal-foot">
        ${img ? UI.btn(t('certs.view'), 'cert-zoom', { cls: 'ghost', icon: 'image' }) : ''}
        ${original ? `<a class="btn ghost" href="${U.esc(original)}" target="_blank" rel="noopener noreferrer">${UI.icon('external')}<span>${U.esc(t('certs.openOriginal'))}</span></a>` : ''}
        ${UI.btn(t('common.delete'), 'cert-delete', { cls: 'ghost danger', icon: 'trash', data: { id: c.id } })}
        ${UI.btn(t('common.edit'), 'cert-edit', { cls: 'primary', icon: 'edit', data: { id: c.id } })}
      </footer>
    </div>`, 'cert-dialog');
  }

  /* Broken or blocked image → keep the designed placeholder that sits underneath. */
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img && img.matches && img.matches('img[data-cert-img]')) img.remove();
  }, true);
  document.addEventListener('load', (e) => {
    const img = e.target;
    if (img && img.matches && img.matches('img[data-cert-img]')) img.classList.add('loaded');
  }, true);

  /* ------------------------------------------------------------------ */
  /* page                                                                */
  /* ------------------------------------------------------------------ */

  function render(el) {
    const s = S();
    const all = sorted();
    const providers = U.unique(all.map((c) => c.provider).filter(Boolean)).sort((a, b) => a.localeCompare(b));
    const coursesWith = U.unique(all.map((c) => c.nodeId).filter(Boolean));
    const q = U.norm(filters.q);
    const list = all.filter((c) => {
      if (filters.course && c.nodeId !== filters.course) return false;
      if (filters.provider && c.provider !== filters.provider) return false;
      if (filters.status && statusOf(c) !== filters.status) return false;
      if (q && !U.norm([c.title, c.provider, courseName(c), c.credentialId, c.notes].join(' ')).includes(q)) return false;
      return true;
    });
    const earned = all.filter((c) => statusOf(c) === 'earned').length;
    const completed = M.completedCourses();
    const missing = completed.filter((n) => !forNode(n.id).length);
    const year = U.dayKey().slice(0, 4);

    el.innerHTML = `<header class="page-head">
        <div><h1>${U.esc(t('nav.certificates'))}</h1><p class="muted">${U.esc(t('certs.subtitle'))}</p></div>
        <div class="btn-row">${UI.btn(t('certs.add'), 'cert-add', { cls: 'primary', icon: 'plus' })}</div>
      </header>
      <section class="kpis" aria-label="${U.esc(t('dashboard.summary'))}">
        <div class="kpi"><span class="kpi-label">${U.esc(t('certs.earned'))}</span><span class="kpi-value mono">${earned}</span><span class="kpi-sub">${U.esc(t('certs.ofTotal', { n: all.length }))}</span></div>
        <div class="kpi"><span class="kpi-label">${U.esc(t('certs.thisYear'))}</span><span class="kpi-value mono">${all.filter((c) => (c.issueDate || '').startsWith(year)).length}</span><span class="kpi-sub">${year}</span></div>
        <div class="kpi"><span class="kpi-label">${U.esc(t('certs.providers'))}</span><span class="kpi-value mono">${providers.length}</span><span class="kpi-sub">${U.esc(providers.slice(0, 3).join(' · '))}</span></div>
        <div class="kpi"><span class="kpi-label">${U.esc(t('certs.coverage'))}</span><span class="kpi-value mono">${completed.filter((n) => forNode(n.id).length).length}<small>/${completed.length}</small></span><span class="kpi-sub">${U.esc(t('certs.coverageSub'))}</span></div>
      </section>
      <div class="filter-bar mt" role="group" aria-label="${U.esc(t('filters.label'))}">
        <input type="search" id="cert-q" placeholder="${U.esc(t('certs.searchPh'))}" aria-label="${U.esc(t('certs.searchPh'))}" value="${U.esc(filters.q)}">
        <select data-change="cert-filter" data-key="course" aria-label="${U.esc(t('certs.course'))}">
          <option value="">${U.esc(t('certs.allCourses'))}</option>
          ${coursesWith.map((id) => `<option value="${id}" ${filters.course === id ? 'selected' : ''}>${U.esc(s.nodes[id].title)}</option>`).join('')}
        </select>
        <select data-change="cert-filter" data-key="provider" aria-label="${U.esc(t('certs.provider'))}">
          <option value="">${U.esc(t('certs.allProviders'))}</option>
          ${providers.map((p) => `<option value="${U.esc(p)}" ${filters.provider === p ? 'selected' : ''}>${U.esc(p)}</option>`).join('')}
        </select>
        <div class="chips">
          ${['', 'earned', 'pending', 'expired'].map((st) => `<button class="chip-btn ${filters.status === st ? 'active' : ''}" data-action="cert-status-filter" data-value="${st}" aria-pressed="${filters.status === st}">${U.esc(st ? t('certs.s_' + st) : t('filters.all'))}</button>`).join('')}
        </div>
      </div>
      ${list.length ? `<div class="cert-grid">${list.map(card).join('')}</div>`
        : UI.empty(all.length ? t('filters.noMatch') : t('certs.empty'), all.length ? '' : UI.btn(t('certs.add'), 'cert-add', { cls: 'primary', icon: 'plus' }))}
      ${missing.length ? `<section class="card mt" aria-labelledby="cm-h">
        <div class="section-head"><h2 id="cm-h">${U.esc(t('certs.missingTitle'))}</h2><span class="muted small">${U.esc(t('certs.missingHint'))}</span></div>
        <ul class="done-courses">${missing.map((n) => `<li><a href="#/learn/${n.id}">${U.esc(n.title)}</a>
          <span class="mono small muted">${M.firstCompleted(n) ? U.esc(t('history.completedOn', { date: U.fmtDate(M.firstCompleted(n)) })) : U.esc(t('history.dateUnknown'))}</span>
          ${UI.btn(t('certs.add'), 'cert-add', { cls: 'sm ghost', icon: 'award', data: { node: n.id } })}</li>`).join('')}</ul>
      </section>` : ''}`;

    const qi = document.getElementById('cert-q');
    qi.addEventListener('input', U.debounce(() => { filters.q = qi.value.trim(); App.rerender(); }, 200));
  }

  /** Small section for a course page. */
  function courseSection(nodeId) {
    const n = S().nodes[nodeId];
    const list = forNode(nodeId);
    const completed = M.status(nodeId) === 'completed';
    return `<section class="card cert-side" aria-labelledby="cs-h">
      <div class="section-head"><h2 id="cs-h">${UI.icon('award')} ${U.esc(t('nav.certificates'))}</h2>
        ${completed || list.length ? UI.iconBtn('plus', 'cert-add', t('certs.add'), { node: nodeId }, 'sm') : ''}</div>
      ${list.length ? `<ul class="cert-mini">${list.map((c) => `<li><button class="cert-mini-btn" data-action="cert-preview" data-id="${c.id}">
          <span class="cert-mini-thumb">${thumb(c)}</span>
          <span class="cert-mini-text"><span class="fg">${U.esc(c.title || n.title)}</span><span class="muted small">${U.esc([c.provider, c.issueDate ? U.fmtDate(c.issueDate) : ''].filter(Boolean).join(' · '))}</span></span>
        </button></li>`).join('')}</ul>`
        : completed ? `<p class="muted small">${U.esc(t('certs.optional'))}</p>${UI.btn(t('certs.add'), 'cert-add', { cls: 'sm', icon: 'award', data: { node: nodeId } })}`
          : `<p class="muted small">${U.esc(t('certs.afterComplete'))}</p>`}
    </section>`;
  }

  UI.registerActions({
    'cert-add': (el) => certForm(null, { nodeId: el.dataset.node || null }),
    'cert-edit': (el) => { UI.closeModal(); certForm(el.dataset.id); },
    'cert-preview': (el) => preview(el.dataset.id),
    'cert-zoom': () => { const st = document.getElementById('cert-stage'); if (st) st.classList.toggle('zoomed'); },
    'modal-close-go': (el) => { UI.closeModal(); location.hash = el.dataset.href; },
    'cert-filter': (el) => { filters[el.dataset.key] = el.value; App.rerender(); },
    'cert-status-filter': (el) => { filters.status = el.dataset.value; App.rerender(); },
    'cert-delete': async (el) => {
      const c = S().certificates.find((x) => x.id === el.dataset.id);
      UI.closeModal();
      const ok = await UI.confirm({ title: t('confirm.deleteTitle', { name: c.title }), message: t('certs.deleteMessage'), confirmLabel: t('common.delete') });
      if (ok) UI.withUndo(t('toast.deleted', { name: c.title }), () => Store.deleteCertificate(c.id));
    },
  });

  App.Certificates = { certForm, preview, courseSection, forNode, statusOf, asset };
  App.Pages.certificates = { render, title: () => t('nav.certificates'), nav: { icon: 'award', order: 35 } };
})(window.App = window.App || {});
