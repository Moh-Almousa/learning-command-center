/*
 * Learning-node actions (add / edit / delete / status / resources / prerequisites)
 * and the side Detail Panel that opens from any page.
 */
(function (App) {
  'use strict';
  const U = App.U, UI = App.UI, M = App.Model, Store = App.Store;
  const t = (...a) => App.i18n.t(...a);
  const S = () => Store.state;

  const CHILD_TYPES = { path: ['track'], track: ['course'], course: ['module', 'lesson', 'task'], module: ['lesson', 'task'], lesson: ['task'], task: [] };

  let openId = null;

  /* ------------------------------------------------------------------ */
  /* forms                                                               */
  /* ------------------------------------------------------------------ */

  function categories() {
    return U.unique(Object.values(S().nodes).map((n) => n.category).filter(Boolean)).sort();
  }

  function parentSelect(type, nodeId) {
    const allowed = new Set(Store.parentOptions(nodeId, type));
    const opts = M.order().filter((id) => allowed.has(id))
      .map((id) => ({ value: id, label: `${'  '.repeat(M.info(id).depth)}${S().nodes[id].title} (${t('type.' + S().nodes[id].type)})` }));
    return { name: 'parentId', label: t('field.parent'), type: 'select', options: opts, required: true, full: true };
  }

  /** Resources are edited as lines: "Label | https://link | type" (label and type optional). */
  function resourcesToText(list) {
    return (list || []).map((r) => [r.label, r.url, r.type].filter(Boolean).join(' | ')).join('\n');
  }

  function guessResourceType(url) {
    if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
    if (/github\.com/.test(url)) return 'github';
    if (/udemy|coursera|programmingadvices/.test(url)) return 'course';
    return 'docs';
  }

  function textToResources(text) {
    const rows = [];
    let bad = null;
    String(text || '').split(/\r?\n/).forEach((line) => {
      const l = line.trim();
      if (!l) return;
      const parts = l.split('|').map((x) => x.trim());
      const url = parts.find((x) => U.isUrl(x));
      if (!url) { bad = l; return; }
      const others = parts.filter((x) => x !== url);
      const type = others.find((x) => Store.RESOURCE_TYPES.includes(x.toLowerCase()));
      const label = others.find((x) => x !== type) || url;
      rows.push({ label, url, type: type ? type.toLowerCase() : guessResourceType(url) });
    });
    return { rows, bad };
  }

  function nodeFields(type, { parentChoice, nodeId } = {}) {
    const f = [];
    if (parentChoice || (nodeId && type !== 'path')) f.push(parentSelect(type, nodeId));
    f.push({ name: 'title', label: t('field.title'), required: true, full: true });
    f.push({ name: 'description', label: t('field.description'), type: 'textarea', rows: 3, full: true });
    const status = { name: 'status', label: t('field.status'), type: 'select', options: UI.enumOptions(Store.STATUSES, 'status'), help: nodeId && S().nodes[nodeId].children.length ? t('help.containerStatus') : '' };
    const url = { name: 'url', label: t('field.url'), type: 'url', placeholder: 'https://', full: true };
    const est = { name: 'estHours', label: t('field.estHours'), type: 'number', min: 0, step: '0.25' };
    const actual = { name: 'actualHours', label: t('field.actualHours'), type: 'number', min: 0, step: '0.25', help: t('help.actualHours') };
    if (type === 'course') {
      f.push({ name: 'provider', label: t('field.provider'), type: 'select', options: [{ value: '', label: '—' }, ...UI.enumOptions(Store.PROVIDERS, 'provider')] });
      f.push({ name: 'category', label: t('field.category'), list: categories() });
      f.push(url, est, status);
      f.push({ name: 'startDate', label: t('field.startDate'), type: 'date' });
      f.push({ name: 'targetDate', label: t('field.targetDate'), type: 'date' });
    } else if (type === 'module') {
      f.push(url, est, status);
    } else if (type === 'lesson') {
      f.push(url, status, est, actual);
    } else if (type === 'task') {
      f.push(status, { name: 'targetDate', label: t('field.dueDate'), type: 'date' }, est, actual);
    } else {
      f.push({ name: 'targetDate', label: t('field.targetDate'), type: 'date' });
    }
    if (type !== 'path') {
      const exclude = nodeId ? [nodeId, ...Store.descendantsOf(nodeId), ...Store.ancestorsOf(nodeId)] : [];
      f.push({
        name: 'prereqs', label: t('field.prereqs'), type: 'checklist', full: true,
        help: t('help.prereqs'),
        options: UI.nodeOptions(['track', 'course', 'module', 'lesson'], exclude),
      });
    }
    f.push({ name: 'resourcesText', label: t('field.resources'), type: 'textarea', rows: 3, full: true, help: t('help.resources'), placeholder: 'DRF docs | https://www.django-rest-framework.org/ | docs' });
    f.push({ name: 'notes', label: t('field.notes'), type: 'textarea', rows: 3, full: true });
    if (S().projectOrder.length) {
      f.push({ name: 'projects', label: t('field.relatedProjects'), type: 'checklist', full: true, help: t('help.relatedProjects'),
        options: S().projectOrder.map((pid) => ({ value: pid, label: S().projects[pid].name })) });
    }
    return f;
  }

  function validateNode(v) {
    if (v.url && !U.isUrl(v.url)) return t('errors.url');
    const r = textToResources(v.resourcesText);
    if (r.bad) return t('errors.resourceLine', { line: r.bad });
    return null;
  }

  function cleanNodeValues(v) {
    const out = Object.assign({}, v);
    ['prereqs', 'parentId', 'resourcesText', 'projects'].forEach((k) => delete out[k]);
    ['estHours', 'actualHours'].forEach((k) => { if (k in out) out[k] = out[k] === '' ? '' : Number(out[k]); });
    return out;
  }

  function revealOnMap(pid) {
    const collapsed = Object.assign({}, S().settings.collapsed);
    const expanded = Object.assign({}, S().settings.expanded);
    [pid, ...Store.ancestorsOf(pid)].forEach((a) => { delete collapsed[a]; expanded[a] = true; });
    Store.updateSettings({ collapsed, expanded });
  }

  async function addNodeFlow(type, parentId) {
    const values = { status: S().settings.defaultStatus || 'not_started', projects: [] };
    if (!parentId && type !== 'path') {
      const cur = M.current();
      const guess = { course: cur.track || cur.path, track: cur.path, module: cur.course, lesson: cur.module || cur.course, task: cur.lesson || cur.module }[type];
      if (guess && Store.parentOptions(null, type).includes(guess.id)) values.parentId = guess.id;
    }
    if (!parentId && type !== 'path' && !Store.parentOptions(null, type).length) {
      UI.toast(t('errors.noParent', { type: t('type.' + type), parents: Store.PARENT_TYPES[type].map((x) => t('type.' + x)).join(' / ') }), { tone: 'warn' });
      return null;
    }
    const v = await UI.form({
      title: t('forms.addTitle', { type: t('type.' + type) }),
      fields: nodeFields(type, { parentChoice: !parentId && type !== 'path' }),
      values,
      submitLabel: t('actions.addType', { type: t('type.' + type) }),
      validate: validateNode,
      wide: true,
    });
    if (!v) return null;
    const pid = parentId || v.parentId || null;
    if (!pid && type !== 'path') return null;
    const status = v.status || 'not_started';
    const id = Store.addNode(type, pid, Object.assign(cleanNodeValues(v), { status: 'not_started' }));
    if (v.prereqs && v.prereqs.length) Store.setPrereqs(id, v.prereqs);
    const res = textToResources(v.resourcesText).rows;
    if (res.length) Store.setResources('node', id, res);
    if (v.projects && v.projects.length) Store.setNodeProjects(id, v.projects);
    if (status !== 'not_started') Store.setNodeStatus(id, status);
    if (pid) revealOnMap(pid);
    UI.toast(t('toast.added', { name: v.title }));
    return id;
  }

  async function editNodeFlow(id) {
    const n = S().nodes[id];
    if (!n) return;
    const projects = S().projectOrder.filter((pid) => S().projects[pid].learningNodeIds.includes(id));
    const v = await UI.form({
      title: t('forms.editTitle', { type: t('type.' + n.type) }),
      fields: nodeFields(n.type, { nodeId: id }),
      values: Object.assign({}, n, { status: M.status(id), prereqs: n.prereqs, resourcesText: resourcesToText(n.resources), projects }),
      validate: validateNode,
      wide: true,
    });
    if (!v) return;
    const status = v.status;
    const fields = cleanNodeValues(v);
    delete fields.status;
    Store.updateNode(id, fields);
    if (v.parentId && v.parentId !== n.parentId) { Store.moveNodeTo(id, v.parentId); revealOnMap(v.parentId); }
    if (v.prereqs) {
      const bad = v.prereqs.map((p) => Store.prereqError(id, p)).find(Boolean);
      Store.setPrereqs(id, v.prereqs);
      if (bad) UI.toast(t(bad), { tone: 'warn' });
    }
    Store.setResources('node', id, textToResources(v.resourcesText).rows);
    if (v.projects) Store.setNodeProjects(id, v.projects);
    if (status && status !== M.status(id)) await setStatusFlow(id, status);
    UI.toast(t('toast.saved'));
  }

  /** Reopen something finished. Containers can be reviewed (keep completed lessons) or restarted. */
  async function reopenFlow(id) {
    const n = S().nodes[id];
    if (!n) return;
    if (!n.children.length) { Store.setNodeStatus(id, 'in_progress'); UI.toast(t('reopen.done', { name: n.title })); return; }
    const v = await UI.form({
      title: t('reopen.title', { name: n.title }),
      intro: t('reopen.intro'),
      fields: [{ name: 'mode', label: t('reopen.how'), type: 'select', full: true, options: [
        { value: 'review', label: t('reopen.review') },
        { value: 'restart', label: t('reopen.restart') },
      ] }],
      values: { mode: 'review' },
      submitLabel: t('reopen.action'),
    });
    if (!v) return;
    if (v.mode === 'review') Store.setNodeStatus(id, 'in_progress');
    else Store.setNodeStatus(id, 'not_started');
    UI.toast(t('reopen.done', { name: n.title }));
  }

  async function deleteNodeFlow(id) {
    const n = S().nodes[id];
    if (!n) return;
    const count = Store.descendantsOf(id).length;
    const ok = await UI.confirm({
      title: t('confirm.deleteTitle', { name: n.title }),
      message: count ? t('confirm.deleteWithChildren', { count }) : t('confirm.deleteSimple'),
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    if (openId === id || Store.descendantsOf(id).includes(openId)) close();
    UI.withUndo(t('toast.deleted', { name: n.title }), () => Store.deleteNode(id));
  }

  /** Status change that asks before wiping progress inside a container. */
  async function setStatusFlow(id, status) {
    const n = S().nodes[id];
    if (!n) return;
    const inside = Store.descendantsOf(id).filter((d) => S().nodes[d].status === 'completed').length;
    if (n.children.length && status === 'not_started' && inside) {
      const ok = await UI.confirm({
        title: t('confirm.resetTitle'),
        message: t('confirm.resetMessage', { count: inside, name: n.title }),
        confirmLabel: t('confirm.resetConfirm'),
      });
      if (!ok) return;
    }
    const before = M.status(id);
    const snap = Store.snapshot();
    Store.setNodeStatus(id, status);
    if (status === 'completed' && before !== 'completed') {
      const rec = M.recommendation();
      const next = rec && S().nodes[rec.id];
      UI.toast(next ? t('toast.completedNext', { name: n.title, next: next.title }) : t('toast.completed', { name: n.title }), {
        action: { label: t('common.undo'), fn: () => Store.restore(snap) },
      });
    }
  }

  async function addResourceFlow(kind, id) {
    const v = await UI.form({
      title: t('forms.addResource'),
      fields: [
        { name: 'label', label: t('field.label'), required: true, full: true },
        { name: 'url', label: t('field.url'), type: 'url', required: true, placeholder: 'https://', full: true },
        { name: 'type', label: t('field.type'), type: 'select', options: UI.enumOptions(Store.RESOURCE_TYPES, 'res') },
      ],
      values: { type: 'docs' },
      validate: (x) => (U.isUrl(x.url) ? null : t('errors.url')),
    });
    if (v) Store.addResource(kind, id, v);
  }

  /* ------------------------------------------------------------------ */
  /* detail panel                                                        */
  /* ------------------------------------------------------------------ */

  function panel() { return document.getElementById('detail'); }

  function open(id) {
    if (!S().nodes[id]) return;
    openId = id;
    const p = panel();
    p.hidden = false;
    document.body.classList.add('detail-open');
    render();
    requestAnimationFrame(() => { const h = p.querySelector('h2'); if (h) h.focus(); });
    if (App.Roadmap) App.Roadmap.highlight(id);
  }

  function close() {
    openId = null;
    const p = panel();
    p.hidden = true;
    p.innerHTML = '';
    document.body.classList.remove('detail-open');
    if (App.Roadmap) App.Roadmap.highlight(null);
  }

  function childRow(cid) {
    const c = S().nodes[cid];
    const st = M.status(cid);
    const info = M.info(cid);
    return `<li class="child-row ${st}">
      ${UI.statusToggle('node-toggle', cid, st, c.title)}
      <button class="link-btn" data-action="open-node" data-id="${cid}">${U.esc(c.title)}</button>
      ${info.locked ? UI.icon('lock', 'muted') : ''}
      <span class="mono small muted">${c.children.length ? `${info.done}/${info.total}` : U.esc(t('type.' + c.type))}</span>
    </li>`;
  }

  function nodeList(ids, empty) {
    if (!ids.length) return `<p class="muted small">${U.esc(empty)}</p>`;
    return `<ul class="mini-list">${ids.map((id) => {
      const n = S().nodes[id];
      return `<li>${UI.icon(UI.STATUS_ICON[M.status(id)], 'st-' + M.status(id))}<button class="link-btn" data-action="open-node" data-id="${id}">${U.esc(n.title)}</button><span class="muted small">${U.esc(t('type.' + n.type))}</span></li>`;
    }).join('')}</ul>`;
  }

  function render() {
    if (!openId) return;
    const s = S();
    const n = s.nodes[openId];
    if (!n) { close(); return; }
    const info = M.info(openId);
    const st = info.status;
    const crumbs = M.ancestors(openId);
    const projects = M.projectsForNode(openId);
    const ptasks = M.ptasksForNode(openId);
    const skills = s.skillOrder.map((k) => s.skills[k]).filter((k) => k.nodeIds.some((x) => x === openId || Store.ancestorsOf(openId).includes(x)));
    const unlocks = Object.values(s.nodes).filter((o) => o.prereqs.includes(openId)).map((o) => o.id);
    const url = U.safeUrl(n.url);
    const timer = s.timer;
    const timing = timer && timer.nodeId === openId;
    const childTypes = CHILD_TYPES[n.type];

    const logged = M.minutesFor(openId);
    const last = M.lastActivity(openId);
    const first = M.firstCompleted(n);
    const reopenings = n.completions.filter((c) => c.reopenedAt);
    const meta = [
      n.provider ? [t('field.provider'), t('provider.' + n.provider)] : null,
      n.category ? [t('field.category'), n.category] : null,
      n.estHours ? [t('field.estHours'), t('time.h', { h: n.estHours })] : null,
      n.actualHours || logged ? [t('field.actualTime'), n.actualHours ? t('time.h', { h: n.actualHours }) : U.fmtMinutes(logged)] : null,
      n.startDate ? [t('field.startDate'), U.fmtDate(n.startDate)] : null,
      n.targetDate ? [n.type === 'task' ? t('field.dueDate') : t('field.targetDate'), U.fmtDate(n.targetDate)] : null,
      n.startedAt ? [t('field.startedOn'), U.fmtDate(n.startedAt)] : null,
      first ? [t('field.firstCompleted'), U.fmtDate(first)] : null,
      reopenings.length ? [t('field.reopened'), reopenings.map((c) => U.fmtDate(c.reopenedAt)).join(', ')] : null,
      n.completedAt && first && n.completedAt !== first ? [t('field.completedOn'), U.fmtDate(n.completedAt)] : null,
      st === 'completed' && !first ? [t('field.completedOn'), t('history.dateUnknown')] : null,
      last ? [t('field.lastActivity'), U.fmtDate(last)] : null,
    ].filter(Boolean);

    panel().innerHTML = `
      <div class="detail-head">
        <div class="detail-top">
          ${UI.typeBadge(n.type)}
          <div class="detail-top-actions">
            ${UI.iconBtn('up', 'node-move', t('actions.moveUp'), { id: n.id, value: -1 }, 'sm')}
            ${UI.iconBtn('down', 'node-move', t('actions.moveDown'), { id: n.id, value: 1 }, 'sm')}
            ${UI.iconBtn('edit', 'node-edit', t('common.edit'), { id: n.id }, 'sm')}
            ${UI.iconBtn('trash', 'node-delete', t('common.delete'), { id: n.id }, 'sm danger')}
            ${UI.iconBtn('x', 'detail-close', t('common.close'), {}, 'sm')}
          </div>
        </div>
        ${crumbs.length ? `<nav class="crumbs" aria-label="${U.esc(t('detail.location'))}">${crumbs.map((a) => `<button class="link-btn" data-action="open-node" data-id="${a.id}">${U.esc(a.title)}</button>`).join('<span aria-hidden="true">›</span>')}</nav>` : ''}
        <h2 tabindex="-1">${U.esc(n.title)}</h2>
        ${info.locked ? `<p class="lock-note">${UI.icon('lock')} ${U.esc(t('detail.lockedBy'))} ${info.unmet.map((p) => `<button class="link-btn" data-action="open-node" data-id="${p}">${U.esc(s.nodes[p].title)}</button>`).join(', ')}. ${U.esc(t('detail.lockOverride'))}</p>` : ''}
        ${info.blocked && !info.locked ? `<p class="lock-note subtle">${UI.icon('lock')} ${U.esc(t('detail.blocked'))}</p>` : ''}
      </div>

      <div class="detail-body">
        <section aria-label="${U.esc(t('field.status'))}">
          ${UI.statusSegment('node-status', n.id, st, Store.STATUSES)}
          ${n.children.length ? `<div class="mt">${UI.progress(info.pct, { label: t('detail.itemsDone', { done: info.done, total: info.total }) })}</div>` : ''}
          <div class="btn-row mt">
            ${st !== 'in_progress' && st !== 'completed' ? UI.btn(t('actions.start'), 'node-status', { cls: 'sm', icon: 'play', data: { id: n.id, value: 'in_progress' } }) : ''}
            ${st !== 'completed' ? UI.btn(t('actions.markComplete'), 'node-status', { cls: 'sm primary', icon: 'check', data: { id: n.id, value: 'completed' } }) : ''}
            ${timing
              ? UI.btn(t('timer.stopLog'), 'timer-stop', { cls: 'sm', icon: 'stop' })
              : UI.btn(t('timer.start'), 'timer-start', { cls: 'sm', icon: 'clock', data: { id: n.id } })}
            ${UI.btn(t('today.add'), 'today-add-node', { cls: 'sm ghost', icon: 'plus', data: { id: n.id } })}
            ${UI.btn(t('detail.showOnMap'), 'show-on-map', { cls: 'sm ghost', icon: 'map', data: { id: n.id } })}
            ${UI.btn(t('detail.openPage'), 'node-page', { cls: 'sm ghost', icon: 'external', data: { id: n.id } })}
            ${st === 'completed' ? UI.btn(t('reopen.action'), 'node-reopen', { cls: 'sm ghost', icon: 'reset', data: { id: n.id } }) : ''}
          </div>
          ${n.review ? `<p class="lock-note subtle">${UI.icon('reset')} ${U.esc(t('reopen.reviewing'))}</p>` : ''}
        </section>

        ${n.description ? `<section><h3>${U.esc(t('field.description'))}</h3><p class="pre">${U.esc(n.description)}</p></section>` : ''}

        ${meta.length || url ? `<section><dl class="meta">${meta.map(([k, v]) => `<dt>${U.esc(k)}</dt><dd>${U.esc(v)}</dd>`).join('')}
          ${url ? `<dt>${U.esc(t('field.url'))}</dt><dd><a href="${U.esc(url)}" target="_blank" rel="noopener noreferrer">${U.esc(url.replace(/^https?:\/\//, '').slice(0, 48))} ${UI.icon('external')}</a></dd>` : ''}
        </dl></section>` : ''}

        ${childTypes.length || n.children.length ? `<section>
          <div class="section-head"><h3>${U.esc(t('detail.contents'))}</h3>
            <div class="btn-row">${childTypes.map((ct) => UI.btn(t('actions.addType', { type: t('type.' + ct) }), 'node-add-child', { cls: 'sm ghost', icon: 'plus', data: { id: n.id, type: ct } })).join('')}</div>
          </div>
          ${n.children.length ? `<ul class="child-list">${n.children.map(childRow).join('')}</ul>` : `<p class="muted small">${U.esc(t('detail.noChildren'))}</p>`}
        </section>` : ''}

        <section data-private>
          <div class="section-head"><h3>${U.esc(t('detail.resources'))}</h3>${UI.btn(t('actions.addResource'), 'resource-add', { cls: 'sm ghost', icon: 'plus', data: { kind: 'node', id: n.id } })}</div>
          ${UI.resourceList('node', n.id, n.resources)}
        </section>

        <section data-private>
          <h3><label for="node-notes">${U.esc(t('detail.notes'))}</label></h3>
          <textarea id="node-notes" class="notes" data-notes-kind="node" data-notes-id="${n.id}" rows="5" placeholder="${U.esc(t('detail.notesPlaceholder'))}">${U.esc(n.notes)}</textarea>
          <p class="help" data-save-state>${U.esc(t('detail.notesAutosave'))}</p>
        </section>

        <section>
          <h3>${U.esc(t('detail.appliedIn'))}</h3>
          ${projects.length ? `<ul class="mini-list">${projects.map((p) => `<li>${UI.icon('folder')}<a href="#/projects/${p.id}">${U.esc(p.name)}</a>${UI.projectStatusBadge(p.status)}</li>`).join('')}</ul>` : `<p class="muted small">${U.esc(t('detail.noProjects'))}</p>`}
          ${ptasks.length ? `<h4>${U.esc(t('detail.projectTasks'))}</h4><ul class="child-list">${ptasks.map((pt) => `<li class="child-row ${pt.status}">${UI.statusToggle('ptask-toggle', pt.id, pt.status, pt.title)}<a href="#/projects/${pt.projectId}?tab=tasks">${U.esc(pt.title)}</a><span class="muted small">${U.esc(s.projects[pt.projectId].name)}</span></li>`).join('')}</ul>` : ''}
        </section>

        <section class="two-col">
          <div><h3>${U.esc(t('detail.prereqs'))}</h3>${nodeList(n.prereqs, t('detail.none'))}</div>
          <div><h3>${U.esc(t('detail.unlocks'))}</h3>${nodeList(unlocks, t('detail.none'))}</div>
        </section>

        ${skills.length ? `<section><h3>${U.esc(t('detail.skills'))}</h3><div class="chips">${skills.map((k) => `<a class="chip" href="#/skills">${U.esc(k.name)}</a>`).join('')}</div></section>` : ''}
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* actions                                                             */
  /* ------------------------------------------------------------------ */

  UI.registerActions({
    'open-node': (el) => open(el.dataset.id),
    'detail-close': () => close(),
    'node-status': (el) => setStatusFlow(el.dataset.id, el.dataset.value),
    'node-toggle': (el) => setStatusFlow(el.dataset.id, el.dataset.value),
    'node-edit': (el) => editNodeFlow(el.dataset.id),
    'node-delete': (el) => deleteNodeFlow(el.dataset.id),
    'node-move': (el) => Store.moveNode(el.dataset.id, Number(el.dataset.value)),
    'node-add': (el) => addNodeFlow(el.dataset.type, el.dataset.parent || null).then((id) => { if (id && el.dataset.open !== 'no') open(id); }),
    'node-add-child': (el) => addNodeFlow(el.dataset.type, el.dataset.id),
    'node-reopen': (el) => reopenFlow(el.dataset.id),
    'node-page': (el) => { location.hash = '#/learn/' + el.dataset.id; },
    'resource-add': (el) => addResourceFlow(el.dataset.kind, el.dataset.id),
    'remove-resource': (el) => Store.removeResource(el.dataset.kind, el.dataset.id, el.dataset.res),
    'show-on-map': (el) => { const id = el.dataset.id; location.hash = '#/roadmap?focus=' + id; },
  });

  // Notes autosave (all note areas share this).
  const saveNotes = U.debounce((el) => {
    Store.setNotes(el.dataset.notesKind, el.dataset.notesId, el.value);
    const hint = el.parentElement.querySelector('[data-save-state]');
    if (hint) hint.textContent = t('detail.notesSaved');
  }, 400);
  document.addEventListener('input', (e) => {
    const el = e.target.closest('textarea[data-notes-kind]');
    if (el) {
      const hint = el.parentElement.querySelector('[data-save-state]');
      if (hint) hint.textContent = t('detail.notesSaving');
      saveNotes(el);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openId && !document.querySelector('dialog[open]')) close();
  });

  App.Detail = {
    open, close, render, addNodeFlow, editNodeFlow, deleteNodeFlow, setStatusFlow, addResourceFlow, reopenFlow,
    get openId() { return openId; }, CHILD_TYPES,
  };
})(window.App = window.App || {});
