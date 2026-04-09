// Hisaab Mitra — Theme Manager
// Handles dark / light mode toggle with localStorage persistence.
// No dependencies. Attach to window so any module can call it.
// ================================================================
//
// USAGE
//   ThemeManager.toggle()          — flip between dark ↔ light
//   ThemeManager.set('light')      — force a specific theme
//   ThemeManager.get()             — returns 'dark' | 'light'
//   ThemeManager.init()            — called once on DOMContentLoaded
//
// The chosen theme is saved to localStorage under 'sf-theme'.
// A tiny inline <script> in index.html <head> reads this value
// before first paint to prevent any flash of the wrong theme.
// ================================================================

const ThemeManager = (() => {
  const KEY     = 'sf-theme';
  const DEFAULT = 'dark';

  // Apply a theme: set data-theme on <html> and persist to storage.
  function set(theme) {
    const t = (theme === 'light') ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(KEY, t); } catch (_) {}

    // Update Chart.js charts if Analytics module is loaded
    _updateCharts(t);

    // Dispatch event so other modules can react if needed
    window.dispatchEvent(new CustomEvent('sf:theme-changed', { detail: { theme: t } }));
  }

  function get() {
    try { return localStorage.getItem(KEY) || DEFAULT; } catch(_) { return DEFAULT; }
  }

  function toggle() {
    const current = document.documentElement.getAttribute('data-theme') || get();
    set(current === 'dark' ? 'light' : 'dark');
  }

  // Called once at boot — syncs HTML attribute with stored preference.
  function init() {
    const saved = get();
    document.documentElement.setAttribute('data-theme', saved);
  }

  // Re-color Chart.js canvases when theme changes.
  // Updates global Chart.defaults so new charts also pick up the colors.
  function _updateCharts(theme) {
    if (typeof Chart === 'undefined') return;
    const isDark = theme === 'dark';
    const gridColor  = isDark ? 'rgba(176, 228, 204, 0.07)' : 'rgba(174, 184, 119, 0.2)';
    const tickColor  = isDark ? '#8fb8a8'                   : '#4a5e30';
    const legendColor = isDark ? '#e8f5ef'                  : '#1e2d12';

    Chart.defaults.color = tickColor;
    Chart.defaults.borderColor = gridColor;

    // Update every registered chart instance live
    Object.values(Chart.instances || {}).forEach(chart => {
      try {
        // Grid lines
        const scales = chart.options?.scales || {};
        Object.values(scales).forEach(scale => {
          if (scale.grid)  scale.grid.color  = gridColor;
          if (scale.ticks) scale.ticks.color = tickColor;
        });
        // Legend
        if (chart.options?.plugins?.legend?.labels) {
          chart.options.plugins.legend.labels.color = legendColor;
        }
        chart.update('none'); // 'none' = no animation, instant
      } catch (_) {}
    });
  }

  return { init, set, get, toggle };
})();

// Auto-init as soon as the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
} else {
  ThemeManager.init();
}
