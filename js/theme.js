// Hisaab Mitra — Theme Manager
// Handles dark/light mode toggle with localStorage persistence.
// Applies theme BEFORE body renders to prevent flash of wrong theme.
//
// USAGE
//   ThemeManager.init()         — call as the very first script on page load
//   ThemeManager.toggle()       — switch between light and dark
//   ThemeManager.set('light')   — set a specific theme
//   ThemeManager.get()          — returns current theme string
//   ThemeManager.renderToggle() — renders the theme toggle UI in settings
//
// ARCHITECTURE
//   Theme is stored in localStorage under key 'hm-theme'.
//   Applied via data-theme attribute on <html> element.
//   Chart.js instances are updated via a custom event.
//   All CSS uses CSS variables keyed on [data-theme] — no JS class toggling.
// ================================================================

const ThemeManager = (() => {

  const STORAGE_KEY  = 'hm-theme';
  const DEFAULT      = 'dark';
  const VALID_THEMES = ['dark', 'light'];

  // ── Apply theme immediately (no flash) ──────────────────────────
  // This runs synchronously at module evaluation time.
  // Place this script tag BEFORE any CSS link tags in <head> for
  // zero-flash guarantee. If placed in body, a brief flash may occur.
  function _applyImmediate() {
    const saved = _getSaved();
    document.documentElement.setAttribute('data-theme', saved);
    // Also set color-scheme for native browser scrollbars/inputs
    document.documentElement.style.colorScheme = saved === 'light' ? 'light' : 'dark';
  }

  function _getSaved() {
    try {
      const val = localStorage.getItem(STORAGE_KEY);
      return VALID_THEMES.includes(val) ? val : DEFAULT;
    } catch {
      return DEFAULT;
    }
  }

  function _save(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (_) {}
  }

  // ── Public: init ─────────────────────────────────────────────────
  // Call once in app.js after DOMContentLoaded.
  // Handles the settings toggle render and event wiring.
  function init() {
    _applyImmediate();
    _updateCharts();
    _dispatchChange();
  }

  // ── Public: set ──────────────────────────────────────────────────
  function set(theme) {
    if (!VALID_THEMES.includes(theme)) return;
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
    _save(theme);
    _updateSettingsToggle(theme);
    _updateCharts();
    _dispatchChange();
  }

  // ── Public: toggle ───────────────────────────────────────────────
  function toggle() {
    const current = get();
    set(current === 'dark' ? 'light' : 'dark');
  }

  // ── Public: get ──────────────────────────────────────────────────
  function get() {
    return document.documentElement.getAttribute('data-theme') || DEFAULT;
  }

  // ── Dispatch custom event ────────────────────────────────────────
  // Other modules can listen: window.addEventListener('hm:theme-change', ...)
  function _dispatchChange() {
    window.dispatchEvent(new CustomEvent('hm:theme-change', {
      detail: { theme: get() }
    }));
  }

  // ── Update Chart.js global defaults ──────────────────────────────
  // Called after theme switch so existing charts update their colors.
  function _updateCharts() {
    if (typeof Chart === 'undefined') return;

    const isDark = get() === 'dark';

    const gridColor  = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
    const tickColor  = isDark ? '#4A6080'                : '#A08060';
    const tooltipBg  = isDark ? '#001233'                : '#1A1209';

    Chart.defaults.color      = tickColor;
    Chart.defaults.borderColor = gridColor;

    Chart.defaults.plugins.tooltip.backgroundColor = tooltipBg;
    Chart.defaults.plugins.tooltip.titleColor      = isDark ? '#8BA3CC' : '#6B4C2A';
    Chart.defaults.plugins.tooltip.bodyColor       = isDark ? '#F0F4FF' : '#1A1209';
    Chart.defaults.plugins.tooltip.borderColor     = isDark
      ? 'rgba(0,106,103,0.3)'
      : 'rgba(250,129,18,0.3)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding     = 10;

    // Update all existing chart instances
    if (Chart.instances) {
      Object.values(Chart.instances).forEach(chart => {
        if (!chart || !chart.options) return;
        try {
          // Update scale colors
          ['x', 'y', 'y2'].forEach(axis => {
            const scale = chart.options.scales?.[axis];
            if (!scale) return;
            if (scale.grid)  scale.grid.color  = gridColor;
            if (scale.ticks) scale.ticks.color = tickColor;
          });
          chart.update('none'); // no animation on theme switch
        } catch (_) {}
      });
    }
  }

  // ── Render theme toggle UI ────────────────────────────────────────
  // Injects the toggle into #theme-toggle-container in settings.
  // Call from Pages.settings() after the settings page renders.
  function renderToggle() {
    const container = document.getElementById('theme-toggle-container');
    if (!container) return;

    const current = get();

    container.innerHTML = `
      <div class="toggle-row" style="border-bottom: 1px solid var(--border); padding-bottom: 14px; margin-bottom: 14px;">
        <div class="toggle-info">
          <div class="toggle-label">App Theme</div>
          <div class="toggle-desc">Choose your preferred look and feel</div>
        </div>
        <div class="theme-toggle-group" style="flex-shrink:0">
          <button
            class="theme-option ${current === 'dark' ? 'active' : ''}"
            onclick="ThemeManager.set('dark')"
            title="Dark mode"
          >
            <span class="theme-option-icon">🌙</span>
            Dark
          </button>
          <button
            class="theme-option ${current === 'light' ? 'active' : ''}"
            onclick="ThemeManager.set('light')"
            title="Light mode"
          >
            <span class="theme-option-icon">☀️</span>
            Light
          </button>
        </div>
      </div>`;
  }

  // ── Update toggle state after switch ──────────────────────────────
  function _updateSettingsToggle(theme) {
    document.querySelectorAll('.theme-option').forEach(btn => {
      const isLight = btn.textContent.trim().includes('Light');
      const isDark  = btn.textContent.trim().includes('Dark');
      btn.classList.toggle('active',
        (theme === 'light' && isLight) || (theme === 'dark' && isDark)
      );
    });

    // Also update topbar theme icon if present
    const icon = document.getElementById('topbar-theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  // ── Apply immediately on module load ────────────────────────────
  _applyImmediate();

  return { init, set, get, toggle, renderToggle };

})();
