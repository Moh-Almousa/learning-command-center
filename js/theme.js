/*
 * Theme: applies Settings → Appearance to the page by switching data-attributes on <html>
 * and overriding colour tokens from css/variables.css with inline CSS variables.
 */
(function (App) {
  'use strict';

  const ACCENTS = [
    { name: 'teal', dark: '#4FD1C5', light: '#0F9488' },
    { name: 'blue', dark: '#60A5FA', light: '#2563EB' },
    { name: 'violet', dark: '#A78BFA', light: '#7C3AED' },
    { name: 'green', dark: '#4ADE80', light: '#16A34A' },
    { name: 'rose', dark: '#FB7185', light: '#E11D48' },
    { name: 'sky', dark: '#38BDF8', light: '#0284C7' },
  ];
  const COLOR_KEYS = ['bg', 'panel', 'text', 'line'];
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

  function resolvedTheme(st) {
    if (st.theme === 'light' || st.theme === 'dark') return st.theme;
    return media && media.matches ? 'light' : 'dark';
  }

  /** Readable text colour on top of a given background. */
  function onColor(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    const n = parseInt(m[1], 16);
    const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.35 ? '#0B1120' : '#FFFFFF';
  }

  function accentValue(st, theme) {
    if (!st.accent) return '';
    const preset = ACCENTS.find((a) => a.name === st.accent);
    return preset ? preset[theme] : st.accent;
  }

  function apply(st) {
    const root = document.documentElement;
    const theme = resolvedTheme(st);
    root.dataset.theme = theme;
    root.dataset.density = st.density === 'compact' ? 'compact' : 'comfortable';
    root.dataset.motion = st.motion === 'off' ? 'off' : 'on';
    const accent = accentValue(st, theme);
    root.style.setProperty('--accent', accent || '');
    if (!accent) root.style.removeProperty('--accent');
    const on = accent ? onColor(accent) : null;
    if (on) root.style.setProperty('--on-accent', on); else root.style.removeProperty('--on-accent');
    COLOR_KEYS.forEach((k) => {
      const v = st.colors && st.colors[k];
      if (v) root.style.setProperty('--' + k, v); else root.style.removeProperty('--' + k);
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim() || '#0B1120');
  }

  if (media && media.addEventListener) {
    media.addEventListener('change', () => { if (App.Store.state && App.Store.state.settings.theme === 'system') apply(App.Store.state.settings); });
  }

  App.Theme = { apply, ACCENTS, COLOR_KEYS, resolvedTheme, accentValue };
})(window.App = window.App || {});
