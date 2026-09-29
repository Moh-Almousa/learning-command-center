/* Small, dependency-free helpers shared by every module. */
(function (App) {
  'use strict';

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  const U = {
    esc(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ESC[c]);
    },

    uid(prefix = 'id') {
      return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },

    $(selector, root = document) { return root.querySelector(selector); },
    $$(selector, root = document) { return Array.from(root.querySelectorAll(selector)); },

    debounce(fn, wait = 250) {
      let timer;
      return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
      };
    },

    clamp(n, min, max) { return Math.min(max, Math.max(min, n)); },

    pct(done, total) { return total > 0 ? Math.round((done / total) * 100) : 0; },

    /* ---------- dates (all "day keys" are local YYYY-MM-DD) ---------- */
    dayKey(date = new Date()) {
      const d = date instanceof Date ? date : new Date(date);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${d.getFullYear()}-${m}-${day}`;
    },

    parseDay(key) {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m - 1, d);
    },

    addDays(key, n) {
      const d = U.parseDay(key);
      d.setDate(d.getDate() + n);
      return U.dayKey(d);
    },

    /** Start-of-week day key; weekStart: 0=Sun, 1=Mon, 6=Sat */
    weekStartKey(key, weekStart) {
      const d = U.parseDay(key);
      const diff = (d.getDay() - weekStart + 7) % 7;
      d.setDate(d.getDate() - diff);
      return U.dayKey(d);
    },

    fmtDate(value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
      if (!value) return '';
      const d = typeof value === 'string' && value.length === 10 ? U.parseDay(value) : new Date(value);
      if (isNaN(d)) return '';
      return d.toLocaleDateString(App.i18n.locale(), opts);
    },

    fmtTime(ts) {
      return new Date(ts).toLocaleTimeString(App.i18n.locale(), { hour: '2-digit', minute: '2-digit' });
    },

    relDay(ts) {
      const t = App.i18n.t;
      const key = U.dayKey(new Date(ts));
      const today = U.dayKey();
      if (key === today) return t('common.today');
      if (key === U.addDays(today, -1)) return t('common.yesterday');
      return U.fmtDate(key, { day: 'numeric', month: 'short' });
    },

    fmtMinutes(min) {
      min = Math.round(min || 0);
      const h = Math.floor(min / 60);
      const m = min % 60;
      const t = App.i18n.t;
      if (!h) return t('time.m', { m });
      return m ? t('time.hm', { h, m }) : t('time.h', { h });
    },

    fmtHours(min) {
      const h = (min || 0) / 60;
      return App.i18n.t('time.h', { h: h >= 10 ? Math.round(h) : Math.round(h * 10) / 10 });
    },

    isUrl(value) {
      try {
        const u = new URL(value);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch (e) { return false; }
    },

    safeUrl(value) { return U.isUrl(value) ? value : ''; },

    download(filename, text, type = 'application/json') {
      const blob = new Blob([text], { type });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    },

    /** Case-insensitive "contains" with a tiny normalisation step. */
    matches(haystack, needle) {
      if (!needle) return true;
      return String(haystack || '').toLowerCase().includes(needle.toLowerCase());
    },

    norm(s) { return String(s || '').trim().toLowerCase(); },

    /** Highlight query inside escaped text. */
    mark(text, q) {
      const safe = U.esc(text);
      if (!q) return safe;
      const re = new RegExp('(' + U.esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      return safe.replace(re, '<mark>$1</mark>');
    },

    snippet(text, q, radius = 60) {
      const s = String(text || '');
      const i = s.toLowerCase().indexOf(String(q).toLowerCase());
      if (i < 0) return s.slice(0, radius * 2);
      const start = Math.max(0, i - radius);
      return (start > 0 ? '…' : '') + s.slice(start, i + q.length + radius) + (i + q.length + radius < s.length ? '…' : '');
    },

    unique(arr) { return Array.from(new Set(arr)); },

    /** Copy without undefined values, so Object.assign(defaults, U.defined(x)) never wipes a default. */
    defined(obj) {
      const out = {};
      Object.keys(obj || {}).forEach((k) => { if (obj[k] !== undefined) out[k] = obj[k]; });
      return out;
    },
  };

  App.U = U;
  App.Pages = App.Pages || {};
})(window.App = window.App || {});
