/* Settings (appearance, learning, projects, personalisation, language, data) + the Data management page. */
(function (App) {
  'use strict';
  const U = App.U, UI = App.UI, Store = App.Store, M = App.Model;
  const t = (...a) => App.i18n.t(...a);
  const S = () => Store.state;

  const NUMERIC = ['dailyGoalMinutes', 'weekStart'];

  function select(key, options, current, label) {
    return `<div class="field"><label for="set-${key}">${U.esc(label)}</label>
      <select id="set-${key}" data-change="set-setting" data-key="${key}">${options.map(([v, l]) => `<option value="${U.esc(v)}" ${String(current) === String(v) ? 'selected' : ''}>${U.esc(l)}</option>`).join('')}</select></div>`;
  }

  function segment(key, options, current, label) {
    return `<div class="field"><span class="field-label" id="lbl-${key}">${U.esc(label)}</span>
      <div class="segment" role="group" aria-labelledby="lbl-${key}">${options.map(([v, l, icon]) => `<button class="seg-btn ${current === v ? 'active' : ''}" data-action="set-setting-btn" data-key="${key}" data-value="${v}" aria-pressed="${current === v}">${icon ? UI.icon(icon) : ''}<span>${U.esc(l)}</span></button>`).join('')}</div></div>`;
  }

  function colorField(key, label) {
    const st = S().settings;
    const cur = (st.colors && st.colors[key]) || getComputedStyle(document.documentElement).getPropertyValue('--' + key).trim();
    return `<label class="color-field"><input type="color" value="${U.esc(toHex(cur))}" data-change="set-color" data-key="${key}" aria-label="${U.esc(label)}"><span>${U.esc(label)}</span>${st.colors && st.colors[key] ? `<span class="badge">${U.esc(t('settings.custom'))}</span>` : ''}</label>`;
  }

  function toHex(v) {
    if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    if (/^#[0-9a-f]{3}$/i.test(v)) return '#' + v.slice(1).split('').map((c) => c + c).join('');
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(v || '');
    return m ? '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('') : '#000000';
  }

  function focusOptions() {
    const s = S();
    return [['', t('settings.focusAuto')], ...M.order().filter((id) => ['path', 'track', 'course', 'module'].includes(s.nodes[id].type))
      .map((id) => [id, `${s.nodes[id].title} (${t('type.' + s.nodes[id].type)})`])];
  }

  function renderSettings(el) {
    const st = S().settings;
    const theme = App.Theme.resolvedTheme(st);
    el.innerHTML = `<header class="page-head"><div><h1>${U.esc(t('nav.settings'))}</h1><p class="muted">${U.esc(t('settings.subtitle'))}</p></div></header>
      <div class="settings-grid">
        <section class="card" aria-labelledby="s-app"><h2 id="s-app">${UI.icon('sparkle')} ${U.esc(t('settings.appearance'))}</h2>
          <div class="form-grid">
            ${segment('theme', [['dark', t('settings.dark')], ['light', t('settings.light')], ['system', t('settings.system')]], st.theme, t('settings.theme'))}
            ${segment('density', [['comfortable', t('settings.comfortable')], ['compact', t('settings.compact')]], st.density, t('settings.density'))}
            <div class="field full"><span class="field-label" id="lbl-accent">${U.esc(t('settings.accent'))}</span>
              <div class="swatches" role="group" aria-labelledby="lbl-accent">
                <button class="swatch ${!st.accent ? 'active' : ''}" data-action="set-accent" data-value="" aria-pressed="${!st.accent}" title="${U.esc(t('settings.default'))}"><span style="background:${theme === 'light' ? '#0F9488' : '#4FD1C5'}"></span>${U.esc(t('settings.default'))}</button>
                ${App.Theme.ACCENTS.filter((a) => a.name !== 'teal').map((a) => `<button class="swatch ${st.accent === a.name ? 'active' : ''}" data-action="set-accent" data-value="${a.name}" aria-pressed="${st.accent === a.name}" title="${U.esc(t('settings.accent_' + a.name))}"><span style="background:${a[theme]}"></span>${U.esc(t('settings.accent_' + a.name))}</button>`).join('')}
                <label class="swatch custom ${st.accent && st.accent.startsWith('#') ? 'active' : ''}"><input type="color" value="${U.esc(st.accent && st.accent.startsWith('#') ? st.accent : '#4FD1C5')}" data-change="set-accent-custom" aria-label="${U.esc(t('settings.customAccent'))}">${U.esc(t('settings.custom'))}</label>
              </div>
            </div>
            <div class="field full"><span class="field-label">${U.esc(t('settings.colors'))}</span>
              <div class="color-row">
                ${colorField('bg', t('settings.c_bg'))}${colorField('panel', t('settings.c_panel'))}${colorField('text', t('settings.c_text'))}${colorField('line', t('settings.c_line'))}
              </div>
              <p class="help">${U.esc(t('settings.colorsHelp'))}</p>
              ${Object.keys(st.colors || {}).length || st.accent ? UI.btn(t('settings.resetColors'), 'reset-colors', { cls: 'sm ghost', icon: 'reset' }) : ''}
            </div>
            ${segment('motion', [['on', t('settings.on')], ['off', t('settings.off')]], st.motion, t('settings.animations'))}
          </div>
        </section>

        <section class="card" aria-labelledby="s-learn"><h2 id="s-learn">${UI.icon('map')} ${U.esc(t('settings.learning'))}</h2>
          <div class="form-grid">
            ${select('roadmapView', [['auto', t('settings.view_auto')], ['map', t('settings.view_map')], ['outline', t('settings.view_outline')]], st.roadmapView, t('settings.roadmapView'))}
            ${select('defaultStatus', Store.STATUSES.filter((x) => x !== 'completed').map((x) => [x, t('status.' + x)]), st.defaultStatus, t('settings.defaultStatus'))}
            ${select('progressMode', [['items', t('settings.progress_items')], ['average', t('settings.progress_average')]], st.progressMode, t('settings.progressCalc'))}
            ${select('weekStart', [[6, t('settings.saturday')], [0, t('settings.sunday')], [1, t('settings.monday')]], st.weekStart, t('settings.weekStart'))}
            <p class="help full">${U.esc(t('settings.progressHelp'))}</p>
            <label class="inline-check full"><input type="checkbox" data-change="set-setting" data-key="showDeps" ${st.showDeps ? 'checked' : ''}> ${U.esc(t('roadmap.showDeps'))}</label>
          </div>
        </section>

        <section class="card" aria-labelledby="s-proj"><h2 id="s-proj">${UI.icon('folder')} ${U.esc(t('settings.projects'))}</h2>
          <div class="form-grid">
            ${select('defaultProjectView', [['checklist', t('projects.checklist')], ['kanban', t('projects.kanban')]], st.defaultProjectView, t('settings.defaultProjectView'))}
            ${select('taskGrouping', ['group', 'milestone', 'priority', 'status'].map((x) => [x, t('settings.group_' + x)]), st.taskGrouping, t('settings.taskGrouping'))}
          </div>
        </section>

        <section class="card" aria-labelledby="s-me"><h2 id="s-me">${UI.icon('target')} ${U.esc(t('settings.personal'))}</h2>
          <div class="form-grid">
            <div class="field"><label for="set-userName">${U.esc(t('settings.name'))}</label><input id="set-userName" data-change="set-setting" data-key="userName" value="${U.esc(st.userName)}" autocomplete="given-name"></div>
            <div class="field"><label for="set-dailyGoalMinutes">${U.esc(t('settings.dailyGoal'))}</label><input id="set-dailyGoalMinutes" type="number" min="0" step="15" data-change="set-setting" data-key="dailyGoalMinutes" value="${U.esc(st.dailyGoalMinutes)}"></div>
            <div class="field full"><label for="set-learningGoal">${U.esc(t('settings.learningGoal'))}</label><input id="set-learningGoal" data-change="set-setting" data-key="learningGoal" value="${U.esc(st.learningGoal)}" placeholder="${U.esc(t('settings.learningGoalPh'))}"><p class="help">${U.esc(t('settings.learningGoalHelp'))}</p></div>
            <div class="field full"><label for="set-focusNodeId">${U.esc(t('settings.currentFocus'))}</label>
              <select id="set-focusNodeId" data-change="set-setting" data-key="focusNodeId">${focusOptions().map(([v, l]) => `<option value="${U.esc(v)}" ${(st.focusNodeId || '') === v ? 'selected' : ''}>${U.esc(l)}</option>`).join('')}</select>
              <p class="help">${U.esc(t('settings.currentFocusHelp'))}</p></div>
          </div>
        </section>

        <section class="card" aria-labelledby="s-lang"><h2 id="s-lang">${U.esc(t('settings.language'))}</h2>
          <select id="set-lang" data-change="set-lang" aria-labelledby="s-lang">${App.i18n.languages().map((code) => `<option value="${code}" lang="${code}" ${App.i18n.lang === code ? 'selected' : ''}>${U.esc(App.i18n.STRINGS[code]['lang.name'])}</option>`).join('')}</select>
        </section>

        ${App.Public.settingsSection()}

        <section class="card" aria-labelledby="s-data"><h2 id="s-data">${UI.icon('database')} ${U.esc(t('nav.data'))}</h2>
          <p class="muted small">${U.esc(t('data.subtitle'))}</p>
          <div class="btn-row mt">
            ${UI.btn(t('data.exportBtn'), 'data-export', { cls: 'sm', icon: 'download' })}
            <label class="btn sm file-btn">${UI.icon('upload')}<span>${U.esc(t('data.importBtn'))}</span><input type="file" accept="application/json,.json" class="sr-only" data-import></label>
            ${UI.btn(t('data.resetDemo'), 'data-reset', { cls: 'sm ghost danger', data: { value: 'demo' } })}
            ${UI.btn(t('data.resetEmpty'), 'data-reset', { cls: 'sm danger', data: { value: 'empty' } })}
          </div>
        </section>

        <section class="card" aria-labelledby="s-keys"><h2 id="s-keys">${U.esc(t('settings.shortcuts'))}</h2>
          <dl class="meta shortcuts">
            <dt><kbd>/</kbd></dt><dd>${U.esc(t('settings.scSearch'))}</dd>
            <dt><kbd>Esc</kbd></dt><dd>${U.esc(t('settings.scClose'))}</dd>
            <dt><kbd>+</kbd> <kbd>−</kbd> <kbd>0</kbd> <kbd>F</kbd></dt><dd>${U.esc(t('settings.scMap'))}</dd>
            <dt><kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd></dt><dd>${U.esc(t('settings.scPan'))}</dd>
            <dt><kbd>Enter</kbd></dt><dd>${U.esc(t('settings.scOpen'))}</dd>
          </dl>
        </section>
      </div>
      <p class="muted small mt">${UI.icon('check')} ${U.esc(t('settings.autosave'))}</p>`;
  }

  function renderData(el) {
    const s = S();
    const info = Store.storageInfo();
    const counts = [
      [t('data.nodes'), Object.keys(s.nodes).length], [t('data.projects'), Object.keys(s.projects).length],
      [t('data.ptasks'), Object.keys(s.ptasks).length], [t('data.skills'), Object.keys(s.skills).length],
      [t('data.sessions'), s.sessions.length], [t('data.activity'), s.activity.length],
      [t('data.progressLog'), s.progressLog.length], [t('data.lists'), s.lists.length], [t('data.certificates'), s.certificates.length],
    ];
    el.innerHTML = `<header class="page-head"><div><h1>${U.esc(t('data.title'))}</h1><p class="muted">${U.esc(t('data.subtitle'))}</p></div></header>
      <section class="card">
        <h2>${U.esc(t('data.storage'))}</h2>
        <p>${info.persistent ? `${UI.icon('check', 'st-completed')} ${U.esc(t('data.persistent', { size: (info.bytes / 1024).toFixed(1) + ' KB' }))}` : `${UI.icon('x', 'warn')} ${U.esc(t('errors.noStorage'))}`}</p>
        ${info.error ? `<p class="lock-note">${U.esc(t('data.saveError'))}</p>` : ''}
        <p class="muted small">${U.esc(t('data.lastChange', { when: U.fmtDate(s.updatedAt) + ' ' + U.fmtTime(s.updatedAt) }))}</p>
        <dl class="meta counts">${counts.map(([k, v]) => `<dt>${U.esc(k)}</dt><dd class="mono">${v}</dd>`).join('')}</dl>
      </section>
      <div class="ws-grid mt">
        <section class="card">
          <h2>${UI.icon('download')} ${U.esc(t('data.export'))}</h2>
          <p class="muted small">${U.esc(t('data.exportHelp'))}</p>
          ${UI.btn(t('data.exportBtn'), 'data-export', { cls: 'primary', icon: 'download' })}
        </section>
        <section class="card">
          <h2>${UI.icon('upload')} ${U.esc(t('data.import'))}</h2>
          <p class="muted small">${U.esc(t('data.importHelp'))}</p>
          <label class="btn file-btn">${UI.icon('upload')}<span>${U.esc(t('data.importBtn'))}</span><input type="file" id="import-file" accept="application/json,.json" class="sr-only" data-import></label>
        </section>
      </div>
      <section class="card mt danger-zone">
        <h2>${U.esc(t('data.reset'))}</h2>
        <p class="muted small">${U.esc(t('data.resetHelp'))}</p>
        <div class="btn-row">
          ${UI.btn(t('data.resetDemo'), 'data-reset', { cls: 'danger ghost', data: { value: 'demo' } })}
          ${UI.btn(t('data.resetEmpty'), 'data-reset', { cls: 'danger', data: { value: 'empty' } })}
        </div>
      </section>`;
  }

  async function importFile(file) {
    if (!file || App.Public.active) return;
    const text = await file.text();
    const ok = await UI.confirm({ title: t('data.importConfirmTitle'), message: t('data.importConfirm', { name: file.name }), confirmLabel: t('data.importBtn') });
    if (!ok) return;
    const snap = Store.snapshot();
    try {
      Store.importJSON(text);
      App.Detail.close();
      App.Roadmap.requestFit();
      App.i18n.apply(S().settings.lang);
      UI.toast(t('data.imported'), { action: { label: t('common.undo'), fn: () => Store.restore(snap) } });
    } catch (err) {
      UI.toast(t(err.message.startsWith('errors.') ? err.message : 'errors.importParse'), { tone: 'warn', duration: 6000 });
    }
  }

  // Any <input type=file data-import> on any page restores a backup.
  document.addEventListener('change', (e) => {
    const input = e.target.closest && e.target.closest('input[data-import]');
    if (!input) return;
    const file = input.files[0];
    input.value = '';
    importFile(file);
  });

  UI.registerActions({
    'set-setting': (el) => {
      const key = el.dataset.key;
      let value = el.type === 'checkbox' ? el.checked : el.value;
      if (NUMERIC.includes(key)) value = Math.max(0, Number(value) || 0);
      if (key === 'focusNodeId') value = value || null;
      if (key === 'userName' || key === 'learningGoal') value = String(value).trim();
      if (key === 'roadmapView') App.Roadmap.requestFit();
      Store.updateSettings({ [key]: value });
      UI.toast(t('toast.saved'));
    },
    'set-setting-btn': (el) => { Store.updateSettings({ [el.dataset.key]: el.dataset.value }); },
    'set-accent': (el) => Store.updateSettings({ accent: el.dataset.value }),
    'set-accent-custom': (el) => Store.updateSettings({ accent: el.value }),
    'set-color': (el) => Store.updateSettings({ colors: Object.assign({}, S().settings.colors, { [el.dataset.key]: el.value }) }),
    'reset-colors': () => Store.updateSettings({ colors: {}, accent: '' }),
    'data-export': () => {
      U.download(`learning-roadmap-backup-${U.dayKey()}.json`, Store.exportJSON());
      UI.toast(t('data.exported'));
    },
    'data-reset': async (el) => {
      const mode = el.dataset.value;
      const ok = await UI.confirm({
        title: mode === 'demo' ? t('data.resetDemo') : t('data.resetEmpty'),
        message: t('data.resetConfirm'),
        confirmLabel: t('data.resetBtn'),
        requireText: 'RESET',
      });
      if (!ok) return;
      App.Detail.close();
      App.Roadmap.requestFit();
      Store.resetAll(mode);
      UI.toast(t('data.resetDone'));
      location.hash = '#/dashboard';
    },
  });

  App.Settings = { importFile };
  App.Pages.settings = { render: renderSettings, title: () => t('nav.settings'), nav: { icon: 'settings', order: 110 } };
  App.Pages.data = { render: renderData, title: () => t('nav.data'), nav: { icon: 'database', order: 120 } };
})(window.App = window.App || {});
