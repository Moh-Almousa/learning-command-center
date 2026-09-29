/*
 * Lists: free-form collections you create yourself — reading list, certifications, interview prep,
 * coding practice, books, articles, monthly goals… No code needed to add a new kind of list.
 */
(function (App) {
  'use strict';
  const U = App.U, UI = App.UI, Store = App.Store;
  const t = (...a) => App.i18n.t(...a);
  const S = () => Store.state;

  const ICON = { todo: 'circle', doing: 'half', done: 'done' };

  async function listForm(id) {
    const l = id ? S().lists.find((x) => x.id === id) : null;
    const v = await UI.form({
      title: l ? t('lists.edit') : t('lists.new'),
      intro: l ? '' : t('lists.newIntro'),
      fields: [
        { name: 'name', label: t('field.name'), required: true, full: true, placeholder: t('lists.namePh') },
        { name: 'description', label: t('field.description'), type: 'textarea', rows: 2, full: true },
      ],
      values: l || {},
    });
    if (v) Store.saveList(Object.assign({ id: l ? l.id : undefined }, v));
  }

  async function itemForm(listId, itemId) {
    const l = S().lists.find((x) => x.id === listId);
    const it = itemId ? l.items.find((x) => x.id === itemId) : null;
    const v = await UI.form({
      title: it ? t('lists.editItem') : t('lists.addItemTo', { name: l.name }),
      fields: [
        { name: 'title', label: t('field.title'), required: true, full: true },
        { name: 'url', label: t('field.url'), type: 'url', placeholder: 'https://', full: true },
        { name: 'status', label: t('field.status'), type: 'select', options: Store.LIST_STATUSES.map((x) => ({ value: x, label: t('lists.s_' + x) })) },
        { name: 'notes', label: t('field.notes'), type: 'textarea', rows: 3, full: true },
      ],
      values: it || { status: 'todo' },
      validate: (x) => (!x.url || U.isUrl(x.url) ? null : t('errors.url')),
    });
    if (!v) return;
    const status = v.status;
    delete v.status;
    Store.saveListItem(listId, Object.assign({ id: it ? it.id : undefined }, v, it ? {} : { status: 'todo' }));
    const saved = it ? it.id : S().lists.find((x) => x.id === listId).items.slice(-1)[0].id;
    Store.setListItemStatus(listId, saved, status);
  }

  function listCard(l, i, all) {
    const done = l.items.filter((x) => x.status === 'done').length;
    return `<section class="card list-card" aria-labelledby="l-${l.id}">
      <div class="section-head">
        <div><h2 id="l-${l.id}">${U.esc(l.name)}</h2>${l.description ? `<p class="muted small">${U.esc(l.description)}</p>` : ''}</div>
        <span class="row-actions always">
          ${i > 0 ? UI.iconBtn('up', 'reorder', t('actions.moveUp'), { kind: 'list', id: l.id, value: -1 }, 'sm') : ''}
          ${i < all.length - 1 ? UI.iconBtn('down', 'reorder', t('actions.moveDown'), { kind: 'list', id: l.id, value: 1 }, 'sm') : ''}
          ${UI.iconBtn('edit', 'list-edit', t('common.edit'), { id: l.id }, 'sm')}
          ${UI.iconBtn('trash', 'list-delete', t('common.delete'), { id: l.id }, 'sm danger')}
        </span>
      </div>
      ${l.items.length ? UI.progress(U.pct(done, l.items.length), { size: 'xs', label: t('common.itemsOf', { done, total: l.items.length }) }) : ''}
      <ul class="list-items">${l.items.map((it, j) => {
        const url = U.safeUrl(it.url);
        const next = it.status === 'done' ? 'todo' : 'done';
        return `<li class="li-row li-${it.status}">
          <button class="status-toggle st-${it.status === 'done' ? 'completed' : it.status === 'doing' ? 'in_progress' : 'not_started'}" data-action="list-item-status" data-list="${l.id}" data-id="${it.id}" data-value="${next}" aria-pressed="${it.status === 'done'}" aria-label="${U.esc(it.status === 'done' ? t('actions.markNotDone', { name: it.title }) : t('actions.markDone', { name: it.title }))}">${UI.icon(ICON[it.status])}</button>
          <div class="li-main">
            ${url ? `<a href="${U.esc(url)}" target="_blank" rel="noopener noreferrer">${U.esc(it.title)} ${UI.icon('external')}</a>` : `<span class="li-title">${U.esc(it.title)}</span>`}
            ${it.notes ? `<span class="muted small pre">${U.esc(it.notes)}</span>` : ''}
            ${it.doneAt ? `<span class="muted small">${U.esc(t('history.completedOn', { date: U.fmtDate(it.doneAt) }))}</span>` : ''}
          </div>
          ${it.status !== 'done' ? `<button class="chip-btn sm-chip ${it.status === 'doing' ? 'active' : ''}" data-action="list-item-status" data-list="${l.id}" data-id="${it.id}" data-value="${it.status === 'doing' ? 'todo' : 'doing'}" aria-pressed="${it.status === 'doing'}">${U.esc(t('lists.s_doing'))}</button>` : ''}
          <span class="row-actions">
            ${j > 0 ? UI.iconBtn('up', 'reorder', t('actions.moveUp'), { kind: 'listItem', id: it.id, list: l.id, value: -1 }, 'sm') : ''}
            ${j < l.items.length - 1 ? UI.iconBtn('down', 'reorder', t('actions.moveDown'), { kind: 'listItem', id: it.id, list: l.id, value: 1 }, 'sm') : ''}
            ${UI.iconBtn('edit', 'list-item-edit', t('common.edit'), { list: l.id, id: it.id }, 'sm')}
            ${UI.iconBtn('trash', 'list-item-delete', t('common.delete'), { list: l.id, id: it.id }, 'sm danger')}
          </span>
        </li>`;
      }).join('')}</ul>
      <div class="inline-add">
        <input type="text" id="li-add-${l.id}" placeholder="${U.esc(t('lists.addPh'))}" aria-label="${U.esc(t('lists.addItemTo', { name: l.name }))}" data-enter="list-quick-add" data-list="${l.id}">
        ${UI.btn(t('common.add'), 'list-quick-add', { cls: 'sm', data: { list: l.id } })}
        ${UI.iconBtn('edit', 'list-item-new', t('lists.addDetailed'), { list: l.id }, 'sm')}
      </div>
    </section>`;
  }

  function render(el) {
    const lists = S().lists;
    el.innerHTML = `<header class="page-head">
        <div><h1>${U.esc(t('nav.lists'))}</h1><p class="muted">${U.esc(t('lists.subtitle'))}</p></div>
        <div class="btn-row">${UI.btn(t('lists.new'), 'list-new', { cls: 'primary', icon: 'plus' })}</div>
      </header>
      ${lists.length ? `<div class="lists-grid">${lists.map(listCard).join('')}</div>` : UI.empty(t('lists.empty'), UI.btn(t('lists.new'), 'list-new', { cls: 'primary', icon: 'plus' }))}`;
  }

  UI.registerActions({
    'list-new': () => listForm(null),
    'list-edit': (el) => listForm(el.dataset.id),
    'list-delete': async (el) => {
      const l = S().lists.find((x) => x.id === el.dataset.id);
      const ok = await UI.confirm({ title: t('confirm.deleteTitle', { name: l.name }), message: t('lists.deleteMessage', { n: l.items.length }), confirmLabel: t('common.delete') });
      if (ok) UI.withUndo(t('toast.deleted', { name: l.name }), () => Store.deleteList(l.id));
    },
    'list-item-new': (el) => itemForm(el.dataset.list, null),
    'list-item-edit': (el) => itemForm(el.dataset.list, el.dataset.id),
    'list-item-delete': (el) => {
      const l = S().lists.find((x) => x.id === el.dataset.list);
      const it = l && l.items.find((x) => x.id === el.dataset.id);
      if (it) UI.withUndo(t('toast.deleted', { name: it.title }), () => Store.deleteListItem(l.id, it.id));
    },
    'list-item-status': (el) => Store.setListItemStatus(el.dataset.list, el.dataset.id, el.dataset.value),
    'list-quick-add': (el) => {
      const listId = el.dataset.list;
      const input = document.getElementById('li-add-' + listId);
      const title = input && input.value.trim();
      if (!title) { if (input) input.focus(); return; }
      Store.saveListItem(listId, { title });
      setTimeout(() => { const i = document.getElementById('li-add-' + listId); if (i) i.focus(); }, 0);
    },
  });

  App.Lists = { listForm, itemForm };
  App.Pages.lists = { render, title: () => t('nav.lists'), nav: { icon: 'note', order: 70 } };
})(window.App = window.App || {});
