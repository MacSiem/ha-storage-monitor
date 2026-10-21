/* HA Tools split — ha-storage-monitor v4.2.0 (2026-10-13) — single-tool standalone repo */
(function() {
'use strict';

// Component-local persistence retains this card's existing localStorage keys.
const haToolsPersistence = { _cache: {}, _hass: null, setHass(h) { this._hass = h; }, async save(k, d) { try { localStorage.setItem('ha-storage-monitor-' + k, JSON.stringify(d)); } catch(e) { console.debug('[ha-storage-monitor] caught:', e); } }, async load(k) { try { const r = localStorage.getItem('ha-storage-monitor-' + k); return r ? JSON.parse(r) : null; } catch(e) { return null; } }, loadSync(k) { try { const r = localStorage.getItem('ha-storage-monitor-' + k); return r ? JSON.parse(r) : null; } catch(e) { return null; } } };

const _esc = ((s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]));

/**
 * HA Storage Monitor - WinDirStat-like storage visualization for Home Assistant
 * Shows disk usage with treemap visualization, directory breakdown, and cleanup suggestions
 */
/* ===== HA Tools split — inline shared infrastructure ===== */
// Bento Design System CSS (inline copy — keeps tool standalone)
const HA_STORAGE_MONITOR_BENTO_CSS = `
/* ═══════════════════════════════════════════════
   HA Tools — Bento Design System v2.0 (Premium)
   ═══════════════════════════════════════════════ */

/* keyboard a11y */
:focus-visible { outline: 2px solid var(--bento-primary, #6366f1); outline-offset: 2px; border-radius: 3px; }

:host {
  /* Brand palette — diamond top, gradient-friendly */
  --bento-primary: #6366f1;
  --bento-primary-2: #8b5cf6;
  --bento-primary-3: #ec4899;
  --bento-primary-hover: #4f46e5;
  --bento-primary-light: rgba(99, 102, 241, 0.08);
  --bento-primary-glow: rgba(99, 102, 241, 0.35);
  --bento-success: #10B981;
  --bento-success-light: rgba(16, 185, 129, 0.10);
  --bento-success-border: rgba(16, 185, 129, 0.25);
  --bento-error: #EF4444;
  --bento-error-light: rgba(239, 68, 68, 0.10);
  --bento-error-border: rgba(239, 68, 68, 0.25);
  --bento-warning: #F59E0B;
  --bento-warning-light: rgba(245, 158, 11, 0.10);
  --bento-warning-border: rgba(245, 158, 11, 0.25);
  --bento-info: #06b6d4;
  --bento-info-light: rgba(6, 182, 212, 0.10);
  --bento-info-border: rgba(6, 182, 212, 0.25);

  /* Theme */
  --bento-bg:     var(--primary-background-color, #fafaf9);
  --bento-bg-2:   var(--card-background-color, #f5f5f4);
  --bento-card:   var(--card-background-color, #ffffff);
  --bento-glass:  rgba(255, 255, 255, 0.7);
  --bento-border: var(--divider-color, #e7e5e4);
  --bento-border-strong: rgba(0, 0, 0, 0.08);
  --bento-text:           var(--primary-text-color,   #0c0a09);
  --bento-text-secondary: var(--secondary-text-color, #57534e);
  --bento-text-muted:     var(--disabled-text-color,  #a8a29e);

  /* Radii */
  --bento-radius-xs: 8px;
  --bento-radius-sm: 12px;
  --bento-radius-md: 18px;
  --bento-radius-lg: 24px;
  --bento-radius-pill: 999px;

  /* Shadows — modern, layered */
  --bento-shadow-sm: 0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02);
  --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.03);
  --bento-shadow-lg: 0 24px 48px -12px rgba(0,0,0,0.10), 0 12px 24px -8px rgba(0,0,0,0.05);
  --bento-shadow-glow: 0 0 0 1px rgba(99,102,241,0.15), 0 8px 32px -8px rgba(99,102,241,0.25);

  /* Gradients */
  --bento-grad-primary: linear-gradient(135deg, #6366f1, #8b5cf6);
  --bento-grad-rainbow: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  --bento-grad-success: linear-gradient(135deg, #10b981, #34d399);
  --bento-grad-error:   linear-gradient(135deg, #ef4444, #f87171);
  --bento-grad-warning: linear-gradient(135deg, #f59e0b, #fbbf24);

  /* Motion */
  --bento-trans-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  --bento-trans:      0.25s cubic-bezier(0.4, 0, 0.2, 1);
  --bento-trans-slow: 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  /* Typography */
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif;
  font-feature-settings: "cv11" 1, "ss01" 1;
  letter-spacing: -0.01em;
  display: block;
  color: var(--bento-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── Dark mode ───────────────────────────────── */
:host(.bento-dark) {
    --bento-bg:     var(--primary-background-color, #0a0a0f);
    --bento-bg-2:   var(--card-background-color,    #111119);
    --bento-card:   var(--card-background-color,    #16161f);
    --bento-glass:  rgba(22, 22, 31, 0.7);
    --bento-border: var(--divider-color,            #27272f);
    --bento-border-strong: rgba(255, 255, 255, 0.08);
    --bento-text:           var(--primary-text-color,   #fafaf9);
    --bento-text-secondary: var(--secondary-text-color, #d6d3d1);
    --bento-text-muted:     var(--disabled-text-color,  #78716c);
    --bento-primary:        #818cf8;
    --bento-primary-2:      #a78bfa;
    --bento-primary-3:      #f472b6;
    --bento-primary-light:  rgba(129, 140, 248, 0.12);
    --bento-primary-glow:   rgba(129, 140, 248, 0.45);
    --bento-success: #34d399;
    --bento-success-light:  rgba(52, 211, 153, 0.12);
    --bento-success-border: rgba(52, 211, 153, 0.30);
    --bento-error:   #f87171;
    --bento-error-light:    rgba(248, 113, 113, 0.12);
    --bento-error-border:   rgba(248, 113, 113, 0.30);
    --bento-warning: #fbbf24;
    --bento-warning-light:  rgba(251, 191, 36, 0.12);
    --bento-warning-border: rgba(251, 191, 36, 0.30);
    --bento-info:    #22d3ee;
    --bento-info-light:     rgba(34, 211, 238, 0.12);
    --bento-info-border:    rgba(34, 211, 238, 0.30);
    --bento-shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
    --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.2);
    --bento-shadow-lg: 0 24px 48px -12px rgba(0,0,0,0.6), 0 12px 24px -8px rgba(0,0,0,0.3);
    --bento-shadow-glow: 0 0 0 1px rgba(129,140,248,0.2), 0 8px 32px -8px rgba(129,140,248,0.5);
    --bento-grad-primary: linear-gradient(135deg, #818cf8, #a78bfa);
    --bento-grad-rainbow: linear-gradient(135deg, #818cf8, #a78bfa 50%, #f472b6);
    color-scheme: dark !important;
  }
:host(.bento-dark) .card, :host(.bento-dark) .card-container, :host(.bento-dark) .main-card, :host(.bento-dark) .panel-card {
    background: var(--bento-card) !important; color: var(--bento-text) !important; border-color: var(--bento-border) !important;
  }
:host(.bento-dark) input, :host(.bento-dark) select, :host(.bento-dark) textarea { background: var(--bento-bg-2); color: var(--bento-text); border-color: var(--bento-border); }
:host(.bento-dark) table th { background: var(--bento-bg-2); color: var(--bento-text-secondary); border-color: var(--bento-border); }
:host(.bento-dark) table td { color: var(--bento-text); border-color: var(--bento-border); }
:host(.bento-dark) pre, :host(.bento-dark) code { background: #1e1e2e !important; color: #e2e8f0 !important; }

/* ── Reset & motion preferences ──────────────── */
* { box-sizing: border-box; }
@media (prefers-reduced-motion: reduce) { * { animation-duration: 0s !important; transition-duration: 0s !important; } }

/* ── Main Card Wrapper ───────────────────────── */
.card {
  background: var(--bento-card);
  border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-md);
  box-shadow: var(--bento-shadow-md);
  color: var(--bento-text);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
  position: relative;
  container-type: inline-size;
  transition: box-shadow var(--bento-trans), border-color var(--bento-trans);
}

/* ── Header ──────────────────────────────────── */
.header {
  padding: 20px 24px 0;
  display: flex; align-items: center; gap: 12px;
}
.header-icon { font-size: 24px; }
.header-title {
  font-size: 18px; font-weight: 700; letter-spacing: -0.02em;
  color: var(--bento-text);
}
.header-badge {
  margin-left: auto;
  background: var(--bento-grad-primary); color: #fff;
  font-size: 11px; padding: 4px 10px; border-radius: var(--bento-radius-pill);
  font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
  box-shadow: 0 4px 14px -2px var(--bento-primary-glow);
}
.content { padding: 20px 24px 24px; }

/* ── Tabs (modern pill style) ────────────────── */
.tabs, .tab-bar, .tab-nav, .tab-header {
  display: flex !important; gap: 4px !important;
  padding: 4px !important;
  background: var(--bento-bg-2) !important;
  border-radius: var(--bento-radius-pill) !important;
  margin-bottom: 20px !important;
  overflow: visible !important;
  -webkit-overflow-scrolling: touch !important;
  flex-wrap: wrap !important; border-bottom: 0 !important;
  width: 100%; max-width: 100%; box-sizing: border-box;
}
.tab, .tab-btn, .tab-button, .dtab {
  padding: 8px 16px !important;
  border: none !important; background: transparent !important; cursor: pointer !important;
  font-size: 13px !important; font-weight: 600 !important;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif !important;
  color: var(--bento-text-secondary) !important;
  border-radius: var(--bento-radius-pill) !important;
  margin-bottom: 0 !important;
  transition: all var(--bento-trans) !important;
  white-space: nowrap !important; flex: 1 1 auto !important; text-align: center !important; min-height: 40px !important;
  letter-spacing: -0.005em !important;
}
.tab:hover, .tab-btn:hover, .tab-button:hover, .dtab:hover {
  color: var(--bento-text) !important;
  background: var(--bento-card) !important;
}
.tab.active, .tab-btn.active, .tab-button.active, .dtab.active {
  background: var(--bento-card) !important;
  color: var(--bento-primary) !important;
  box-shadow: var(--bento-shadow-sm) !important;
  font-weight: 700 !important;
}
.tab-content { display: block; }
.tab-content.active { animation: bentoFadeIn 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
@keyframes bentoFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Stat / KPI cards (premium) ──────────────── */
.stat-card, .stat-item, .metric-card, .kpi-card {
  background: var(--bento-bg-2) !important;
  border: 1px solid var(--bento-border) !important;
  border-radius: var(--bento-radius-sm) !important;
  padding: 18px !important;
  text-align: left !important;
  transition: transform var(--bento-trans), box-shadow var(--bento-trans), border-color var(--bento-trans);
  position: relative; overflow: hidden;
}
.stat-card::before, .metric-card::before, .kpi-card::before {
  content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--bento-grad-primary);
  opacity: 0; transition: opacity var(--bento-trans);
}
.stat-card:hover, .stat-item:hover, .metric-card:hover, .kpi-card:hover {
  transform: translateY(-2px); box-shadow: var(--bento-shadow-lg); border-color: var(--bento-primary-light);
}
.stat-card:hover::before, .metric-card:hover::before, .kpi-card:hover::before { opacity: 1; }
.stat-icon { font-size: 22px; margin-bottom: 6px; opacity: 0.85; }
.stat-value, .stat-val, .metric-value, .kpi-val {
  font-size: 26px; font-weight: 800; line-height: 1.1;
  letter-spacing: -0.02em; color: var(--bento-text);
  font-feature-settings: "tnum" 1;
}
.stat-label, .stat-lbl, .metric-label, .kpi-lbl {
  font-size: 11px; color: var(--bento-text-secondary);
  margin-top: 4px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;
}
.stat-num {
  font-size: 24px; font-weight: 800; color: var(--bento-primary);
  font-feature-settings: "tnum" 1; letter-spacing: -0.02em;
}
.stat-sub { font-size: 12px; color: var(--bento-text-muted); font-weight: 500; }

/* ── Overview grid ───────────────────────────── */
.overview-grid, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px; margin-bottom: 20px;
}

/* ── Section headers ─────────────────────────── */
.section-header, .section-title {
  display: flex; align-items: center; justify-content: space-between;
  position: relative; padding-left: 12px;
  font-size: 12px; font-weight: 700; color: var(--bento-text-secondary);
  text-transform: uppercase; letter-spacing: 0.08em;
  margin: 16px 0 10px;
}
.section-header::before, .section-title::before {
  content: ""; width: 4px; height: 4px; border-radius: 50%; background: var(--bento-primary);
  position: absolute; left: 0; top: 50%; transform: translateY(-50%); flex-shrink: 0;
}

/* ── Loading / Empty / Info ──────────────────── */
.loading-bar {
  height: 3px; border-radius: var(--bento-radius-pill);
  background: linear-gradient(90deg, var(--bento-primary), var(--bento-primary-2), transparent);
  background-size: 200% 100%;
  animation: bentoLoad 1.5s linear infinite; margin-bottom: 12px;
}
@keyframes bentoLoad { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.empty-state, .no-data, .no-results {
  text-align: center; color: var(--bento-text-secondary);
  padding: 40px 20px; font-size: 14px;
  background: var(--bento-bg-2); border-radius: var(--bento-radius-md);
  border: 1px dashed var(--bento-border);
}
.info-note, .tip-box {
  font-size: 13px; color: var(--bento-text-secondary);
  background: var(--bento-primary-light);
  border-radius: var(--bento-radius-sm); padding: 12px 14px;
  border-left: 3px solid var(--bento-primary); margin-top: 12px;
  line-height: 1.55;
}
.last-updated {
  font-size: 11px; color: var(--bento-text-muted);
  text-align: right; margin-top: 12px; font-feature-settings: "tnum" 1;
}

/* ── Buttons (premium) ───────────────────────── */
.refresh-btn {
  background: var(--bento-bg-2); border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-pill); padding: 6px 14px;
  font-size: 12px; color: var(--bento-text-secondary);
  cursor: pointer; font-weight: 600; transition: all var(--bento-trans);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif;
}
.refresh-btn:hover {
  background: var(--bento-card); color: var(--bento-primary);
  border-color: var(--bento-primary); transform: translateY(-1px);
  box-shadow: var(--bento-shadow-sm);
}
.toggle-btn, .action-btn {
  background: var(--bento-grad-primary); border: none;
  border-radius: var(--bento-radius-xs); padding: 8px 16px;
  font-size: 13px; color: #fff; cursor: pointer; font-weight: 600;
  transition: all var(--bento-trans); font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif;
  letter-spacing: -0.005em;
  box-shadow: 0 4px 12px -2px var(--bento-primary-glow);
}
.toggle-btn:hover, .action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px -4px var(--bento-primary-glow);
}
.send-btn, .btn-primary {
  width: 100%;
  background: var(--bento-grad-primary); color: #fff;
  border: none; border-radius: var(--bento-radius-sm);
  padding: 12px 20px; font-size: 14px; font-weight: 700;
  cursor: pointer; font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif;
  letter-spacing: -0.01em;
  transition: all var(--bento-trans);
  box-shadow: 0 4px 14px -2px var(--bento-primary-glow);
}
.send-btn:hover, .btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px -6px var(--bento-primary-glow);
}
.send-btn:active, .btn-primary:active { transform: translateY(0); }
.send-btn:disabled, .btn-primary:disabled {
  opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none;
}

/* ── Badges / Status (modern pill) ───────────── */
.badge, .status-badge, .tag, .chip {
  padding: 4px 12px; border-radius: var(--bento-radius-pill);
  font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;
  letter-spacing: 0.04em; text-transform: uppercase;
  border: 1px solid;
}
.badge-ok, .badge-success { background: var(--bento-success-light); color: var(--bento-success); border-color: var(--bento-success-border); }
.badge-er, .badge-error   { background: var(--bento-error-light);   color: var(--bento-error);   border-color: var(--bento-error-border); }
.badge-warn, .badge-warning { background: var(--bento-warning-light); color: var(--bento-warning); border-color: var(--bento-warning-border); }
.badge-info { background: var(--bento-info-light); color: var(--bento-info); border-color: var(--bento-info-border); }

.count-badge {
  font-size: 11px; font-weight: 700; padding: 3px 10px;
  border-radius: var(--bento-radius-pill); display: inline-flex; align-items: center;
  font-feature-settings: "tnum" 1;
}
.error-badge { background: var(--bento-error-light); color: var(--bento-error); border: 1px solid var(--bento-error-border); }
.warn-badge  { background: var(--bento-warning-light); color: var(--bento-warning); border: 1px solid var(--bento-warning-border); }
.info-badge  { background: var(--bento-primary-light); color: var(--bento-primary); border: 1px solid var(--bento-border); }
.ok-badge    { background: var(--bento-success-light); color: var(--bento-success); border: 1px solid var(--bento-success-border); }

/* ── Tables (modern) ─────────────────────────── */
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th {
  background: var(--bento-bg-2); color: var(--bento-text-secondary);
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  padding: 12px 16px; text-align: left;
  border-bottom: 1px solid var(--bento-border);
}
th:first-child { border-top-left-radius: var(--bento-radius-sm); }
th:last-child  { border-top-right-radius: var(--bento-radius-sm); }
td {
  padding: 14px 16px; border-bottom: 1px solid var(--bento-border);
  color: var(--bento-text); font-size: 13px;
}
tr { transition: background var(--bento-trans-fast); }
tr:hover td { background: var(--bento-primary-light); }
tr:last-child td { border-bottom: 0; }

/* ── Forms / Inputs ──────────────────────────── */
input, select, textarea {
  padding: 10px 14px; border: 1.5px solid var(--bento-border);
  border-radius: var(--bento-radius-xs);
  background: var(--bento-card); color: var(--bento-text);
  font-size: 14px; font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif;
  transition: all var(--bento-trans); outline: none;
  letter-spacing: -0.005em;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--bento-primary);
  box-shadow: 0 0 0 4px var(--bento-primary-light);
}
input::placeholder, textarea::placeholder { color: var(--bento-text-muted); }

/* ── Code blocks ─────────────────────────────── */
code {
  background: var(--bento-bg-2); padding: 2px 6px;
  border-radius: 4px; font-size: 12px;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  border: 1px solid var(--bento-border);
}
pre {
  background: #1e1e2e; color: #e2e8f0;
  padding: 16px; border-radius: var(--bento-radius-sm);
  font-size: 12.5px; overflow-x: auto; line-height: 1.65;
  white-space: pre-wrap; word-break: break-word;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  box-shadow: var(--bento-shadow-md);
}

/* ── Grid layouts ────────────────────────────── */
.schedule-grid, .send-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
}
.schedule-card, .send-card, .info-card {
  background: var(--bento-bg-2); border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-sm); padding: 16px;
  transition: all var(--bento-trans);
}
.schedule-card:hover, .send-card:hover, .info-card:hover {
  border-color: var(--bento-primary-light); transform: translateY(-1px);
  box-shadow: var(--bento-shadow-md);
}

/* ── Log entries ─────────────────────────────── */
.log-entry {
  display: flex; flex-wrap: wrap; align-items: flex-start;
  gap: 4px 8px; padding: 10px 12px;
  border-radius: var(--bento-radius-sm); margin-bottom: 6px;
  font-size: 12.5px; min-width: 0; overflow: hidden;
  border: 1px solid transparent; transition: all var(--bento-trans-fast);
}
.error-entry { background: var(--bento-error-light); border-color: var(--bento-error-border); }
.warn-entry  { background: var(--bento-warning-light); border-color: var(--bento-warning-border); }
.log-time { color: var(--bento-text-muted); font-feature-settings: "tnum" 1; flex-shrink: 0; font-family: "JetBrains Mono", monospace; }
.log-domain {
  font-weight: 700; flex-shrink: 1; min-width: 0; max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; word-break: break-all;
}
.error-domain { color: var(--bento-error); }
.warn-domain  { color: var(--bento-warning); }
.log-msg {
  color: var(--bento-text-secondary); flex-basis: 100%;
  word-break: break-word; overflow-wrap: anywhere;
  white-space: pre-wrap; min-width: 0; line-height: 1.55;
}

/* ── Send status ─────────────────────────────── */
.send-status {
  padding: 12px 16px; border-radius: var(--bento-radius-sm);
  margin-top: 14px; font-size: 13px; font-weight: 600;
  text-align: center; letter-spacing: -0.005em;
  border: 1px solid;
}
.send-status.sending { background: var(--bento-primary-light); color: var(--bento-primary); border-color: var(--bento-border); }
.send-status.success { background: var(--bento-success-light); color: var(--bento-success); border-color: var(--bento-success-border); }
.send-status.error   { background: var(--bento-error-light);   color: var(--bento-error);   border-color: var(--bento-error-border); }

/* ── Scrollbar ───────────────────────────────── */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bento-border); border-radius: var(--bento-radius-pill); border: 2px solid transparent; background-clip: content-box; }
::-webkit-scrollbar-thumb:hover { background: var(--bento-text-muted); background-clip: content-box; }

/* ── Animations ──────────────────────────────── */
@keyframes bentoSpin  { to { transform: rotate(360deg); } }
@keyframes bentoPulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
@keyframes bentoSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes bentoStaggerIn { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

/* Apply stagger to grids of stat-cards */
.stats-grid > *, .overview-grid > *, .summary-grid > * {
  animation: bentoStaggerIn 0.35s cubic-bezier(0.4, 0, 0.2, 1) both;
}
.stats-grid > *:nth-child(1)  { animation-delay: 0.02s; }
.stats-grid > *:nth-child(2)  { animation-delay: 0.06s; }
.stats-grid > *:nth-child(3)  { animation-delay: 0.10s; }
.stats-grid > *:nth-child(4)  { animation-delay: 0.14s; }
.stats-grid > *:nth-child(5)  { animation-delay: 0.18s; }
.stats-grid > *:nth-child(6)  { animation-delay: 0.22s; }

/* ── Mobile — 768 px ─────────────────────────── */
@media (max-width: 768px) {
  .content { padding: 16px; }
  .header { padding: 16px 16px 0; }
  .tabs { gap: 2px !important; padding: 3px !important; }
  .tab, .tab-button, .tab-btn { padding: 6px 12px !important; font-size: 12px !important; }
  .overview-grid, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid {
    grid-template-columns: repeat(2, 1fr); gap: 10px;
  }
  .stat-value, .stat-val, .kpi-val, .metric-val { font-size: 22px; }
  .stat-label, .stat-lbl, .kpi-lbl, .metric-lbl { font-size: 10px; }
  .send-grid, .schedule-grid { grid-template-columns: 1fr; }
  .log-entry { flex-wrap: wrap; gap: 2px 6px; padding: 8px 10px; }
  .log-domain { max-width: 60%; font-size: 11.5px; }
  .log-msg { flex-basis: 100%; max-width: 100%; font-size: 11.5px; }
  pre { padding: 12px; font-size: 11.5px; }
  h2 { font-size: 18px; }
  h3 { font-size: 15px; }
  table { font-size: 12.5px; }
  th, td { padding: 10px 12px; }
}
@media (max-width: 480px) {
  .tabs { gap: 1px !important; padding: 2px !important; }
  .tab, .tab-button, .tab-btn { padding: 5px 10px !important; font-size: 11px !important; }
  .overview-grid, .stats-grid, .summary-grid { grid-template-columns: 1fr 1fr; }
  .stat-value, .stat-val, .kpi-val { font-size: 18px; }
}
`;
/* Donate content is rendered inside this card's own shadow root. */
const STORAGE_MONITOR_SUPPORT_KEY = 'ha-storage-monitor-support-dismissed';
const storageMonitorSupportDismissed = () => { try { return localStorage.getItem(STORAGE_MONITOR_SUPPORT_KEY) === '1'; } catch (_) { return false; } };
const STORAGE_MONITOR_DONATE_HTML = '<div class="donate-section" data-source="own-card" style="margin:8px 0 0;padding:4px 0;background:none;border:0;box-shadow:none;min-height:0;display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex-direction:row;justify-content:flex-start;text-align:left"><a href="https://buymeacoffee.com/macsiem" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:var(--secondary-text-color,#64748b);font-weight:400;text-decoration:underline">Optional support for HA Tools</a><button type="button" class="support-dismiss" aria-label="Dismiss support link" style="margin-left:auto;padding:2px 6px;min-height:0;line-height:1;border:0;background:none;color:var(--secondary-text-color,#64748b);cursor:pointer">×</button></div>';

// Pinned Energy bdc90f34d868e314fd7fb86480e0ca207afe1cdd; canonical sources in shared/.
// Runtime copies stay in this product closure; there is no shared Core dependency.
// BEGIN shared/ha-tools-format.js
// Localized presentation; raw values remain available to callers for details/export.
function createFormatUi(language = 'en', timeZone = 'UTC', preferences = {}) {
  const hourCycle = preferences.hourCycle || 'h23';
  const dateLanguage = preferences.dateLanguage || language;
  const clockLanguage = preferences.clockLanguage || language;
  const stamp = value => typeof value === 'number' ? (Number.isFinite(value) ? value : NaN) : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) ? Date.parse(value) : NaN;
  const localized = (value, options, locale = language) => {
    const time = stamp(value);
    if (!Number.isFinite(time)) return null;
    try { return new Intl.DateTimeFormat(locale, {timeZone, ...options}).format(time); } catch (_) { return null; }
  };
  const clock = (value, withOffset = false) => localized(value, {hour:'2-digit', minute:'2-digit', hourCycle, ...(withOffset ? {timeZoneName:'shortOffset'} : {})}, clockLanguage);
  const date = (value, short = false) => localized(value, {day:'numeric', month:'short', ...(short ? {} : {year:'numeric'})}, dateLanguage);
  // A calendar date has no instant or display zone. Use the selected date
  // locale but preserve its literal day, including historical tariff validity.
  const calendarDate = (value, short = false) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const instant = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(instant.getTime()) || instant.toISOString().slice(0, 10) !== value) return null;
    try { return new Intl.DateTimeFormat(dateLanguage, {timeZone:'UTC', day:'numeric', month:'short', ...(short ? {} : {year:'numeric'})}).format(instant); }
    catch (_) { return null; }
  };
  const pointLabel = value => localized(value, {year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hourCycle, timeZoneName:'shortOffset'}, dateLanguage);
  const chartLabels = (values, resolution = 'hour') => {
    const showDate = resolution === 'day' || values.length > 1 && stamp(values.at(-1)) - stamp(values[0]) >= 86400000;
    const labels = values.map(value => resolution === 'day' ? date(value, true) : `${showDate ? date(value, true) + ' ' : ''}${clock(value)}`);
    const counts = new Map();
    for (const label of labels) counts.set(label, (counts.get(label) || 0) + 1);
    return labels.map((label, index) => counts.get(label) < 2 ? label : resolution === 'day' ? pointLabel(values[index])
      : `${showDate ? date(values[index], true) + ' ' : ''}${clock(values[index], true)}`);
  };
  // Compact 24-hour axis notation follows the display zone; full point labels
  // keep the user's clock/date preferences. Never move or discard measurements.
  const chartTicks = (values, resolution = 'hour') => {
    const labels = chartLabels(values, resolution);
    const shortHourly = resolution === 'hour' && values.length > 1 && stamp(values.at(-1)) - stamp(values[0]) <= 26 * 3600000;
    if (!shortHourly) return [...new Set([0, Math.floor((values.length-1)/2), values.length-1])]
      .filter(index => index >= 0 && index < values.length).map(index => ({index, label:labels[index]}));
    const parts = new Intl.DateTimeFormat('en-GB-u-nu-latn', {timeZone, hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
    const ticks = [];
    values.forEach((value, index) => {
      const time = stamp(value);
      if (!Number.isFinite(time)) return;
      const fields = Object.fromEntries(parts.formatToParts(time).map(part => [part.type, part.value]));
      if (Number(fields.hour) % 3 !== 0) return;
      const label = localized(value, {hour:'2-digit', ...(fields.minute === '00' ? {} : {minute:'2-digit'}), hourCycle:'h23'});
      ticks.push({index, label});
    });
    if (!ticks.length) return values.length ? [{index:0, label:labels[0]}] : [];
    const counts = new Map();
    for (const tick of ticks) counts.set(tick.label, (counts.get(tick.label) || 0) + 1);
    return ticks.map(tick => counts.get(tick.label) === 1 ? tick : {...tick, label:clock(values[tick.index], true)});
  };
  const key = JSON.stringify([language, timeZone, hourCycle, dateLanguage, clockLanguage]);
  const numbers = new Intl.NumberFormat(language);
  // Producer Decimal strings carry exact measurement/pricing precision. Keep
  // that precision in Data/details instead of Intl's default three places.
  // Explicit display options and older numeric projections retain their rules.
  const decimals = new Intl.NumberFormat(language, {maximumFractionDigits:100});
  const plurals = new Intl.PluralRules(language);
  const count = (value, forms) => `${numbers.format(value)} ${forms[plurals.select(value)] || forms.other}`;
  // Build1 R12 display roles. The ordinary number() remains exact for Data/history.
  const reportNumber=(value,places=1,signed=false)=>{
    if (typeof value==='boolean' || value===null || !['string','number'].includes(typeof value) || typeof value==='string'&&!value.trim() || !Number.isInteger(places) || places<0 || places>6) return null;
    const parsed=Number(value);if(!Number.isFinite(parsed))return null;
    const normalized=Number(parsed.toFixed(6)),n=Object.is(normalized,-0)?0:normalized;
    const text=new Intl.NumberFormat(language,{minimumFractionDigits:places,maximumFractionDigits:places,roundingMode:'halfExpand',useGrouping:'always'}).format(Math.abs(n));
    const zero=new Intl.NumberFormat(language,{minimumFractionDigits:places,maximumFractionDigits:places,useGrouping:'always'}).format(0);
    return (text===zero?signed?'±':'':n<0?'−':signed?'+':'')+text;
  };
  const reportUnknown=()=>String(language).startsWith('pl')?'Brak danych':'No data';
  const reportEnergy=(value,{role='tile',period='day'}={})=>{const n=reportNumber(value,role==='table'&&period==='day'?2:1);return n===null?reportUnknown():n+' kWh';};
  const reportMoney=(value,currency)=>{const n=reportNumber(value,2),unit=String(language).startsWith('pl')&&currency==='PLN'?'zł':currency;return n===null||typeof unit!=='string'||!unit?reportUnknown():n+' '+unit;};
  const reportRate=(value,currency)=>{const n=reportMoney(value,currency);return n===reportUnknown()?n:n+'/kWh';};
  const reportPercent=(value,{role='share'}={})=>{const n=reportNumber(value,role==='change'?1:0,role==='change');return n===null?reportUnknown():n+'%';};
  const reportPlural=(value,forms)=>{const n=Math.abs(Number(value)),key=String(language).startsWith('pl')&&Number.isFinite(n)&&!Number.isInteger(n)?'few':plurals.select(n);return forms[key]||forms.other||forms.many;};
  const dateTime = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
    const time = Date.parse(value);
    if (!Number.isFinite(time)) return null;
    try { return new Intl.DateTimeFormat(dateLanguage, {timeZone, dateStyle:'medium', timeStyle:'short', hourCycle}).format(new Date(time)); }
    catch (_) { return null; }
  };
  const range = (from, to) => {
    const first = Date.parse(from), last = Date.parse(to);
    if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return null;
    try {
      const day = new Intl.DateTimeFormat(dateLanguage, {timeZone, dateStyle:'medium'});
      const clock = new Intl.DateTimeFormat(clockLanguage, {timeZone, hour:'2-digit', minute:'2-digit', hourCycle});
      return day.format(first) === day.format(last)
        ? `${day.format(first)} (${clock.format(first)}–${clock.format(last)})`
        : `${dateTime(from)} – ${dateTime(to)}`;
    } catch (_) { return null; }
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const periodMarkup = ({start, end, label, source, measured, expected, unit, details = '', sourceTimeZone = ''}) => {
    const local = range(start, end);
    if (!local) return '';
    const coverage = typeof measured === 'number' && Number.isFinite(measured) && typeof expected === 'number' && Number.isFinite(expected)
      ? `${numbers.format(measured)}/${numbers.format(expected)} ${unit}` : '';
    const pl = String(language).startsWith('pl');
    return `<div class="energy-period-v4" style="overflow-wrap:anywhere"><p data-energy-period-summary>${[source, label, local, coverage, timeZone].filter(Boolean).map(escape).join(' · ')}</p><details data-energy-period-details data-energy-period-key="${escape(start + '|' + end)}"><summary style="min-height:44px;box-sizing:border-box;padding:12px 0;display:list-item;list-style-position:inside;cursor:pointer">${pl ? 'Źródło i szczegóły czasu' : 'Source and time details'}</summary><p>${escape(details)}</p>${sourceTimeZone && sourceTimeZone !== timeZone ? `<p>${escape(pl ? 'Strefa pomiarów i granic okresu' : 'Measurement calendar time zone')}: ${escape(sourceTimeZone)}</p>` : ''}<p>UTC: ${escape(start)} — ${escape(end)}</p></details></div>`;
  };
  const capturePeriods = (root, previous, current) => {
    if (!previous || ['epoch','connection','user'].some(key => previous[key] !== current[key])) return [];
    return [...root.querySelectorAll('[data-energy-period-key]')].map(element => ({
      key:element.dataset.energyPeriodKey, open:element.open, focused:root.activeElement === element.querySelector('summary')
    }));
  };
  const restorePeriods = (root, records) => {
    for (const element of root.querySelectorAll('[data-energy-period-key]')) {
      const record = records.find(row => row.key === element.dataset.energyPeriodKey);
      if (!record) continue;
      element.open = record.open;
      if (record.focused) element.querySelector('summary')?.focus({preventScroll:true});
    }
  };
  return {reportNumber, reportEnergy, reportMoney, reportRate, reportPercent, reportPlural, language, dateLanguage, clockLanguage, hourCycle, timeZone, key, clock, date, calendarDate, pointLabel, chartLabels, chartTicks, number:(value, options)=>options ? new Intl.NumberFormat(language, options).format(value) : (typeof value === 'string' ? decimals : numbers).format(value), count, dateTime, range, periodMarkup, capturePeriods, restorePeriods};
}
// Presentation follows the HA profile; measurement and tariff calendars remain separate.
createFormatUi.forHass = hass => {
  const locale = hass?.locale || {};
  const systemLanguage = typeof navigator !== 'undefined' ? navigator.language : undefined;
  const language = locale.language || hass?.language || systemLanguage || 'en';
  const validZone = value => {
    if (typeof value !== 'string' || !(value === 'UTC' || value.includes('/')) || /^[+-]/.test(value)) return null;
    try { new Intl.DateTimeFormat('en', {timeZone:value}).format(0); return value; } catch (_) { return null; }
  };
  let systemZone, systemLocale;
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    systemZone = validZone(resolved.timeZone);
    // Device region can differ from navigator's preferred content language.
    systemLocale = resolved.locale;
  } catch (_) {}
  const systemRegion = systemLocale || systemLanguage || language;
  const serverZone = validZone(hass?.config?.time_zone);
  const timeZone = (locale.time_zone === 'server' ? serverZone : systemZone) || serverZone || 'UTC';
  const clockLanguage = locale.time_format === 'system' ? systemRegion : language;
  const hourCycle = locale.time_format === '12' ? 'h12' : locale.time_format === '24' ? 'h23'
    : new Intl.DateTimeFormat(clockLanguage, {hour:'numeric'}).resolvedOptions().hourCycle;
  return createFormatUi(language, timeZone, {hourCycle, clockLanguage, dateLanguage:locale.date_format === 'system' ? systemRegion : language});
};
// Node tests use the canonical factory; vendored cards keep it local.
// END shared/ha-tools-format.js
// BEGIN shared/ha-tools-ui.js
// HA Tools v3: vendored inside each consumer's own closure, never a window API.
function createUiV3({ language = 'en' } = {}) {
  const pl = String(language).startsWith('pl');
  const states = {
    success: ['Success', 'Sukces', '✓'],
    partial: ['Partial', 'Częściowo', '½'],
    unconfirmed: ['Unconfirmed', 'Niepotwierdzony', '?'],
    error: ['Error', 'Błąd', '✕'],
    not_checked: ['Not checked', 'Nie sprawdzono', '–'],
    no_data: ['No data', 'Brak danych', '∅'],
  };
  const status = (value) => {
    const code = typeof value === 'string' && Object.hasOwn(states, value) ? value : 'not_checked';
    const row = states[code];
    return { code, label: row[pl ? 1 : 0], icon: row[2], countsAsSuccess: code === 'success' };
  };
  const statusHtml = (value) => {
    const result = status(value);
    return `<span class="ht-result-state ht-result-state--${result.code}" data-result-state="${result.code}"><span aria-hidden="true">${result.icon}</span> ${result.label}</span>`;
  };
  const parseColor = value => {
    const text = typeof value === 'string' ? value.trim() : '';
    const hex = /^#([a-f0-9]{3}|[a-f0-9]{6})$/i.exec(text);
    if (hex) return (hex[1].length === 3 ? [...hex[1]].map(c=>c+c).join('') : hex[1]).match(/../g).map(c=>parseInt(c,16));
    const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*1(?:\.0+)?)?\s*\)$/i.exec(text);
    return rgb ? rgb.slice(1,4).map(c=>Math.min(255,Math.round(Number(c)))) : null;
  };
  const hexColor = rgb => '#' + rgb.map(c=>c.toString(16).padStart(2,'0')).join('');
  const luminance = rgb => rgb.map(c=>c/255).map(c=>c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4)
    .reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  const ratio = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  const primaryColors = (value, {dark = false} = {}) => {
    const original = parseColor(value) || parseColor(dark ? '#818cf8' : '#2563eb');
    const white = [255,255,255], ink = [15,23,42];
    const foreground = ratio(original,white) >= ratio(original,ink) ? white : ink;
    const target = foreground === white ? 0 : 255;
    let fill = original;
    // The nearest 5% step keeps a supplied theme color when it is readable.
    for (let step=1; ratio(fill,foreground)<4.5 && step<=20; step++)
      fill = original.map(c=>Math.round(c+(target-c)*step*.05));
    return {fill:hexColor(fill),foreground:hexColor(foreground),contrast:ratio(fill,foreground)};
  };
  const applyTheme = host => {
    const view = host?.ownerDocument?.defaultView;
    if (!host?.isConnected || !view?.getComputedStyle) return null;
    const raw = view.getComputedStyle(host).getPropertyValue('--primary-color').trim();
    let resolved = raw;
    // Resolve ordinary named colors through the browser without a persistent node.
    if (raw && !parseColor(raw) && !raw.includes('var(') && raw !== 'transparent' && view.CSS?.supports?.('color',raw)) {
      const probe = host.ownerDocument.createElement('span');
      probe.style.display = 'none'; probe.style.color = raw;
      host.append(probe);
      try { resolved = view.getComputedStyle(probe).color; } finally { probe.remove(); }
    }
    const result = primaryColors(resolved,{dark:host.classList.contains('bento-dark') || host.classList.contains('hat-dark')});
    for (const [key,value] of [['--hat-primary-fill-computed',result.fill],['--hat-on-primary-computed',result.foreground]])
      if (host.style.getPropertyValue(key) !== value) host.style.setProperty(key,value);
    return result;
  };
  // v5.3: public tokens stay inheritable; private defaults follow the HA dark flag.
  const css = `
:host, .hat {
  color-scheme: light;
  /* powierzchnie i tekst — z motywu HA, w nawiasie wartość domyślna */
  --_hat-bg:       var(--primary-background-color, #f3f4f6);
  --_hat-card:     var(--ha-card-background, var(--card-background-color, #ffffff));
  --_hat-chip:     var(--secondary-background-color, #f3f4f6);
  --_hat-border:   var(--ha-card-border-color, var(--divider-color, #e5e7eb));
  --_hat-text:     var(--primary-text-color, #111827);
  --_hat-text-2:   var(--secondary-text-color, #4b5563);
  --_hat-text-3:   var(--hat-text-3-theme, #6b7280);   /* tylko na tle karty; ≥ 12 px */
  --_hat-grid:     color-mix(in srgb, var(--hat-text, var(--_hat-text)) 6%, var(--hat-card, var(--_hat-card)));
  --_hat-radius:   var(--ha-card-border-radius, 12px);

  /* Computed values supplied by the host when available; literals are explicit fallback colors, not dynamic contrast. */
  --_hat-primary:      var(--primary-color, #2563eb);
  --_hat-primary-fill: var(--hat-primary-fill-computed, #2563eb);
  --_hat-on-primary:   var(--hat-on-primary-computed, #ffffff);

  /* stany: wypełnienie (≥ 3:1) i tekst (≥ 4,5:1) */
  --_hat-good: #0ca30c;  --_hat-good-text: #15803d;
  --_hat-warn: #fab219;  --_hat-warn-text: #a16207;  --_hat-warn-readout: #9a5b05;
  --_hat-crit: #d03b3b;  --_hat-crit-text: #b91c1c;

  /* serie (W23) */
  --_hat-s1: #2a78d6; --_hat-s2: #eb6834; --_hat-s3: #1baf7a; --_hat-s4: #eda100; --_hat-s5: #e87ba4;
  --_hat-zone-cheap: #1baf7a; --_hat-zone-exp: #2a78d6;
  --_hat-d1: #eb6834; --_hat-d2: #6250d6; --_hat-d3: #e87ba4; --_hat-d4: #eda100;
  --_hat-unmeasured: #9ca3af;

  /* typografia (W16: treść ≥ 14, metadane ≥ 12, wersaliki ≥ 11) */
  --_hat-font: var(--ha-font-family-body, Roboto, Inter, system-ui, sans-serif);
  --_hat-fs-display: 28px;  --_hat-fs-number2: 20px;  --_hat-fs-title: 16px;
  --_hat-fs-body: 14px;     --_hat-fs-meta: 12px;     --_hat-fs-caps: 11px;
  --_hat-fw-regular: 400;   --_hat-fw-medium: 500;    --_hat-fw-bold: 600;

  /* odstępy (siatka 4 px) i rozmiary */
  --_hat-space-1: 4px; --_hat-space-2: 8px; --_hat-space-3: 12px; --_hat-space-4: 16px; --_hat-space-5: 24px;
  --_hat-icon-lg: 36px; --_hat-icon-lg-glyph: 20px;   /* nagłówek, kafelek */
  --_hat-icon-md: 28px; --_hat-icon-md-glyph: 16px;   /* wiersz, launcher */
  --_hat-icon-sm: 24px; --_hat-icon-sm-glyph: 14px;   /* odznaka */
  --_hat-tint: 18%;                                   /* tło ikony = akcent 18 % */
  --_hat-pill-h: 32px;  --_hat-pill-h-mini: 28px;  --_hat-target: 44px;
  --_hat-row-h: 56px;   --_hat-gap: 8px;           /* siatka Sections HA */
  --_hat-motion: 150ms ease;
  font-family: var(--hat-font, var(--_hat-font));
  color: var(--hat-text, var(--_hat-text));
}

/* ---------- 2. Tokeny: ciemny (hass.themes.darkMode → klasa .hat-dark) ---------- */
:host(.hat-dark), :host(.bento-dark), .hat.hat-dark {
  --_hat-bg:     var(--primary-background-color, #111214);
  --_hat-card:   var(--ha-card-background, var(--card-background-color, #1c1c1e));
  --_hat-chip:   var(--secondary-background-color, #26272b);
  --_hat-border: var(--ha-card-border-color, var(--divider-color, #2e2f33));
  --_hat-text:   var(--primary-text-color, #e5e7eb);
  --_hat-text-2: var(--secondary-text-color, #a1a1aa);
  --_hat-text-3: var(--hat-text-3-theme, #8b8b93);
  --_hat-primary-fill: var(--hat-primary-fill-computed, #818cf8);
  --_hat-on-primary:   var(--hat-on-primary-computed, #0f172a);
  --_hat-good: #22c55e;  --_hat-good-text: #22c55e;
  --_hat-warn: #fab219;  --_hat-warn-text: #fab219;  --_hat-warn-readout: #fab219;
  --_hat-crit: #e05252;  --_hat-crit-text: #f87171;
  --_hat-s1: #3987e5; --_hat-s2: #d95926; --_hat-s3: #199e70; --_hat-s4: #c98500; --_hat-s5: #d55181;
  --_hat-zone-cheap: #199e70; --_hat-zone-exp: #3987e5;
  --_hat-d1: #d95926; --_hat-d2: #9085e9; --_hat-d3: #d55181; --_hat-d4: #c98500;
  --_hat-unmeasured: #6b7280;
  color-scheme: dark;
}



.ht-result-state { display:inline-flex;align-items:center;gap:var(--hat-space-1,4px);min-height:24px;padding:0 10px;border:1px solid currentColor;border-radius:999px;font-size:var(--hat-fs-meta,12px);font-weight:600;line-height:16px;white-space:normal;background:transparent; }
.ht-result-state--success { color:var(--hat-good-text, var(--_hat-good-text)); }
.ht-result-state--partial,.ht-result-state--unconfirmed { color:var(--hat-warn-text, var(--_hat-warn-text)); }
.ht-result-state--error { color:var(--hat-crit-text, var(--_hat-crit-text)); }
.ht-result-state--not_checked,.ht-result-state--no_data { color:var(--hat-text-2, var(--_hat-text-2)); }
.ht-result-state--no_data { border-style:dashed; }
`;
  return { status, statusHtml, css, primaryColors, applyTheme };
}
// Node tests use the canonical factory; this line is excluded from runtime copies.
// END shared/ha-tools-ui.js

// BEGIN STORAGE_PRESENTATION_TEXT
const STORAGE_PRESENTATION_TEXT = {
  "en": {
    "helpTitle": "Where do these numbers come from?",
    "selectedHelp": "This view shows the selected filesystem. Used space and capacity come from two confirmed sensors for the same disk.",
    "freeHelp": "Free space is calculated as capacity minus used space. It is not a separate measurement.",
    "supervisorHelp": "These measurements describe the Home Assistant host disk. Categories show only the sizes exposed by Supervisor.",
    "noCulprit": "No measurements identify what occupies the remaining space. Check the available categories and history.",
    "invalidPair": "The selected sensors are not providing valid data. Check their states and confirm that they measure the same disk.",
    "noSource": "No capacity source was found. Enable suitable System Monitor sensors or select an existing pair in the card settings.",
    "admin": "This view requires administrator permissions.",
    "noData": "No measurement",
    "sourcePartial": "Two source states, separate measurement times",
    "supervisorPartial": "Supervisor read, category coverage incomplete",
    "timeUnknown": "Measurement time unavailable",
    "offline": "Offline, refresh after reconnecting",
    "loading": "Reading the selected source",
    "used": "Used",
    "capacity": "Capacity",
    "free": "Free",
    "freeComputed": "Free (calculated)",
    "openFull": "Open full view",
    "close": "Close",
    "sourceDetails": "Source and measurement details",
    "selectedFilesystem": "Selected filesystem",
    "scopeConfirmed": "Scope confirmed by administrator",
    "refresh": "Refresh",
    "cleanup": "Review cleanup options",
    "cleanupHelp": "These suggestions do not delete anything. Open the relevant Home Assistant screen and choose the next action yourself.",
    "cleanupMoved": "The saved Cleanup tab is now the Review cleanup options action above.",
    "resources": "Resources and folders",
    "topConsumers": "Largest measured resources",
    "rankingScope": "Supervisor inventory has a different scope from the selected filesystem. It is not a complete disk breakdown.",
    "historyTitle": "Used-space history",
    "historyHelp": "Chart and Data show the same recorded events. Zero is a measurement; missing values are marked separately.",
    "retention": "Available data depends on Recorder history. Coverage and retention remain unknown. A successful read does not confirm complete coverage of the period.",
    "continuity": "Recorder stores state updates, not proof of continuous physical measurement. Grey intervals are unknown. With this source, points remain unconnected, including before the first and after the last event. No gap threshold is assumed.",
    "staircase": "Steps require confirmed measurement intervals. A last recorded state does not provide that confirmation.",
    "limits": "Client limits: 12,000 inspected records, 2,400 events, 50 rows per Data page. Daily queries have no server row limit. Coverage and retention remain unknown.",
    "noForecast": "A fill-date forecast is not available.",
    "unknownIntervals": "Grey intervals: measurement continuity unknown",
    "gaps": "Missing values",
    "capacityChanged": "Capacity changed. These segments are not combined into one trend.",
    "sourceChanged": "Source metadata or units changed",
    "ambiguous": "Conflicting records at the same time",
    "comparison": "Measured change within the selected range",
    "comparisonMissing": "At least three comparable, simultaneous used and capacity measurements are required. Missing data is not a zero change.",
    "comparisonSource": "Sources or the confirmed filesystem scope differ. Refresh history for the selected pair.",
    "comparisonOrder": "Malformed records or incorrect time order prevent an honest comparison.",
    "comparisonPartial": "Available fragment only; this is not a complete measurement of the selected 7 or 30 days.",
    "comparisonRule": "The comparison uses the latest comparable sequence in the returned records of at least three paired records with exactly matching timestamps, unchanged source metadata, units and capacity. Asynchronous states are not paired by carrying forward an old capacity. Unknown, unavailable and changed sources split the sequence. The delta compares endpoints and does not describe what happened between them. Updates explicitly marked with an older last_changed timestamp are not counted as new measurements. The filesystem relationship is the administrator's confirmation; Recorder cannot detect a reused sensor if its identity metadata is unchanged.",
    "comparisonPoints": "Comparable pairs",
    "from": "From",
    "to": "To",
    "change": "Change",
    "details": "Details",
    "variant": "Variant",
    "defaultTab": "Default full-view tab",
    "defaultTabHelp": "An explicit default overrides the saved tab when the card is created. Existing YAML without variant keeps Full. The picker creates Compact.",
    "variantUnknown": "Unsupported value preserved",
    "legacyFull": "Full (legacy default)",
    "savedDefault": "Saved tab or Overview",
    "measurementDetails": "Measurement details",
    "rawBytes": "Raw bytes",
    "time": "Time",
    "series": "Series",
    "source": "Source",
    "value": "Value",
    "records": "Recorded events",
    "serverRead": "Read time, not an independent sensor measurement",
    "critical": "Low free space",
    "warning": "Usage at least 80%",
    "accessDenied": "Home Assistant denied access to this source.",
    "sourceError": "Source unavailable. Refresh to retry.",
    "noAccess": "No access",
    "offlineShort": "Offline",
    "attributeUpdate": "Attribute update, not a new measured value"
  },
  "pl": {
    "helpTitle": "Skąd pochodzą te liczby?",
    "selectedHelp": "Ten widok pokazuje wybrany system plików. Zajęte miejsce i pojemność pochodzą z dwóch potwierdzonych czujników tego samego dysku.",
    "freeHelp": "Wolne miejsce obliczono jako pojemność minus zajęte miejsce. To nie jest osobny pomiar.",
    "supervisorHelp": "Te pomiary opisują dysk hosta Home Assistant. Kategorie pokazują tylko rozmiary udostępnione przez Supervisor.",
    "noCulprit": "Nie ma pomiarów, które wskazują, co zajmuje pozostałe miejsce. Sprawdź dostępne kategorie i historię.",
    "invalidPair": "Wybrane czujniki nie dostarczają teraz poprawnych danych. Sprawdź ich stan i przypisanie do tego samego dysku.",
    "noSource": "Nie znaleziono źródła pojemności. Włącz odpowiednie czujniki System Monitor lub wybierz istniejącą parę w ustawieniach karty.",
    "admin": "Ten widok wymaga uprawnień administratora.",
    "noData": "Brak pomiaru",
    "sourcePartial": "Dwa stany źródeł, osobne czasy pomiarów",
    "supervisorPartial": "Odczyt Supervisor, niepełne dane kategorii",
    "timeUnknown": "Czas pomiaru niedostępny",
    "offline": "Brak połączenia, odśwież po jego przywróceniu",
    "loading": "Odczyt wybranego źródła",
    "used": "Zajęte",
    "capacity": "Pojemność",
    "free": "Wolne",
    "freeComputed": "Wolne (obliczone)",
    "openFull": "Otwórz pełny widok",
    "close": "Zamknij",
    "sourceDetails": "Źródło i szczegóły pomiarów",
    "selectedFilesystem": "Wybrany system plików",
    "scopeConfirmed": "Zakres potwierdzony przez administratora",
    "refresh": "Odśwież",
    "cleanup": "Sprawdź możliwości porządkowania",
    "cleanupHelp": "Te wskazówki niczego nie usuwają. Otwórz właściwy ekran Home Assistant i samodzielnie wybierz dalsze działanie.",
    "cleanupMoved": "Zapisana zakładka Porządki jest teraz akcją Sprawdź możliwości porządkowania u góry.",
    "resources": "Zasoby i katalogi",
    "topConsumers": "Największe zmierzone zasoby",
    "rankingScope": "Inwentarz Supervisor ma inny zakres niż wybrany system plików. Nie stanowi pełnego bilansu dysku.",
    "historyTitle": "Historia zajętości",
    "historyHelp": "Wykres i Dane pokazują te same zapisane zdarzenia. Zero jest pomiarem, a brak wartości jest oznaczony osobno.",
    "retention": "Dostępne dane zależą od historii Recordera. Kompletność i retencja nieznane. Udany odczyt nie potwierdza kompletnego pokrycia całego okresu.",
    "continuity": "Recorder zapisuje aktualizacje stanu, a nie dowód ciągłego pomiaru fizycznego. Szare odcinki są nieznane. Dla tego źródła punkty pozostają niepołączone, także przed pierwszym i po ostatnim zdarzeniu. Nie przyjmujemy progu długości luki.",
    "staircase": "Schodki wymagają potwierdzonych przedziałów pomiaru. Ostatni zapisany stan nie stanowi takiego potwierdzenia.",
    "limits": "Limity klienta: 12 000 sprawdzonych rekordów, 2400 zdarzeń, 50 wierszy na stronę Danych. Zapytania dobowe nie mają serwerowego limitu wierszy. Kompletność i retencja pozostają nieznane.",
    "noForecast": "Prognoza daty zapełnienia jest niedostępna.",
    "unknownIntervals": "Szare odcinki: ciągłość pomiaru nieznana",
    "gaps": "Braki wartości",
    "capacityChanged": "Pojemność zmieniła się. Tych segmentów nie łączymy w jeden trend.",
    "sourceChanged": "Zmieniły się metadane źródła lub jednostki",
    "ambiguous": "Sprzeczne rekordy w tym samym czasie",
    "comparison": "Zmierzona zmiana w wybranym zakresie",
    "comparisonMissing": "Wymagane są co najmniej trzy porównywalne, jednoczesne pomiary użycia i pojemności. Brak danych nie oznacza zerowej zmiany.",
    "comparisonSource": "Źródła lub potwierdzony zakres systemu plików są inne. Odśwież historię wybranej pary.",
    "comparisonOrder": "Błędne rekordy lub nieprawidłowa kolejność czasu uniemożliwiają uczciwe porównanie.",
    "comparisonPartial": "Tylko dostępny fragment; to nie jest pełny pomiar wybranych 7 lub 30 dni.",
    "comparisonRule": "Porównanie wykorzystuje ostatnią porównywalną sekwencję zwróconych rekordów co najmniej trzech par rekordów z dokładnie zgodnymi czasami, niezmiennymi metadanymi źródeł, jednostkami i pojemnością. Stanów asynchronicznych nie łączymy przez przeniesienie starej pojemności. Unknown, unavailable i zmiana źródła dzielą sekwencję. Delta porównuje punkty końcowe i nie opisuje przebiegu między nimi. Aktualizacje z jawnym starszym czasem last_changed nie liczą się jako nowe pomiary. Powiązanie filesystemu jest potwierdzeniem administratora; Recorder nie wykryje ponownego użycia sensora bez zmiany jego metadanych tożsamości.",
    "comparisonPoints": "Porównywalne pary",
    "from": "Od",
    "to": "Do",
    "change": "Zmiana",
    "details": "Szczegóły",
    "variant": "Wariant",
    "defaultTab": "Domyślna zakładka pełnego widoku",
    "defaultTabHelp": "Jawna wartość domyślna zastępuje zapisaną zakładkę przy tworzeniu karty. Dotychczasowy YAML bez variant zachowuje Full. Picker tworzy Compact.",
    "variantUnknown": "Zachowano nieobsługiwaną wartość",
    "legacyFull": "Full (dotychczasowa wartość domyślna)",
    "savedDefault": "Zapisana zakładka lub Przegląd",
    "measurementDetails": "Szczegóły pomiaru",
    "rawBytes": "Surowe bajty",
    "time": "Czas",
    "series": "Seria",
    "source": "Źródło",
    "value": "Wartość",
    "records": "Zapisane zdarzenia",
    "serverRead": "Czas odczytu, nie osobny pomiar sensora",
    "critical": "Mało wolnego miejsca",
    "warning": "Zajętość co najmniej 80%",
    "accessDenied": "Home Assistant odmówił dostępu do tego źródła.",
    "sourceError": "Źródło niedostępne. Odśwież, aby ponowić.",
    "noAccess": "Brak dostępu",
    "offlineShort": "Brak połączenia",
    "attributeUpdate": "Aktualizacja atrybutów, nie nowa zmierzona wartość"
  }
};
// END STORAGE_PRESENTATION_TEXT

const STORAGE_HISTORY_UNITS = Object.freeze({B:1,kB:1000,KB:1000,MB:1e6,GB:1e9,TB:1e12,KiB:1024,MiB:2**20,GiB:2**30,TiB:2**40});
function _storageSourceIdentity(attrs) {
  const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
  return JSON.stringify(stable(Object.fromEntries(Object.entries(attrs || {})
    .filter(([key]) => !['friendly_name', 'icon', 'unit_of_measurement', 'device_class'].includes(key)))));
}
function _storageBytes(state, attrs) {
  const unit = attrs?.unit_of_measurement || '';
  if (typeof state !== 'string' || attrs?.device_class !== 'data_size' ||
      !Object.hasOwn(STORAGE_HISTORY_UNITS, unit) ||
      !/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(state.trim())) return null;
  const value = Number(state), bytes = value * STORAGE_HISTORY_UNITS[unit];
  return Number.isFinite(value) && value >= 0 && Number.isFinite(bytes) ? bytes : null;
}

const STORAGE_HISTORY_CSS = `
/* Storage history: measured events, one local SVG owner, HA theme tokens. */
.storage-history { min-width:0; color:var(--primary-text-color,#222); }
.storage-history p,.storage-history small,.trend-dates { color:var(--secondary-text-color,#555); font-size:13px; line-height:1.5; overflow-wrap:anywhere; }
.storage-history h3 { margin:12px 0; }
.trend-controls,.category-controls { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:12px 0; }
.trend-controls label { display:flex; flex-direction:column; gap:4px; }
.trend-controls button,.trend-controls select,.category-controls button,.trend-data button { min-height:44px; min-width:44px; padding:10px 12px; border:1px solid var(--divider-color,#aaa); border-radius:8px; color:var(--primary-text-color,#222); background:var(--card-background-color,#fff); font:inherit; }
.storage-history button[aria-pressed="true"],.category-controls button[aria-pressed="true"] { outline:2px solid var(--primary-color,#4263b3); outline-offset:1px; }
.storage-history :focus-visible,.category-controls :focus-visible { outline:3px solid var(--primary-color,#4263b3); outline-offset:3px; }
.trend-status { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.trend-figure { margin:12px 0; min-width:0; }
.trend-figure figcaption { font-size:14px; line-height:1.6; }
.trend-figure small { display:block; }
.trend-plot { position:relative; height:220px; margin:38px 22px 86px; color:var(--divider-color,#aaa); }
.trend-plot svg { height:100%; width:100%; overflow:visible; }
.trend-axis-top,.trend-axis-bottom { position:absolute; left:0; font-size:12px; color:var(--secondary-text-color,#555); }
.trend-axis-top { top:-28px; }.trend-axis-bottom { bottom:-24px; }
.trend-gap-label { position:absolute; top:calc(100% + 66px); left:0; font-size:11px; color:var(--secondary-text-color,#555); overflow-wrap:anywhere; }
.trend-mark { position:absolute; transform:translate(-50%,-50%); width:44px; height:44px; min-width:44px; min-height:44px; border:0; padding:0; border-radius:50%; background:transparent; font-size:18px; color:var(--primary-color,#4263b3); }
.trend-capacity { color:var(--primary-text-color,#222); font-weight:700; }
.trend-mark[aria-pressed="true"],.trend-mark:focus-visible { z-index:2; background:var(--card-background-color,#fff); }
.trend-dates { display:flex; justify-content:space-between; gap:12px; font-size:11px; }
.trend-dates span { max-width:48%; }
.trend-detail { padding:12px; border:1px solid var(--divider-color,#ddd); border-radius:8px; font-size:13px; line-height:1.6; overflow-wrap:anywhere; }
.trend-data { padding:0; margin:12px 0; list-style:none; display:grid; gap:6px; }
.trend-data button { width:100%; display:grid; grid-template-columns:1fr 1fr; gap:8px; text-align:start; font-size:13px; overflow-wrap:anywhere; }
.category-data { display:grid; gap:8px; }.category-data-row { display:grid; gap:5px; padding:12px; border:1px solid var(--divider-color,#ddd); border-radius:8px; overflow-wrap:anywhere; font-size:13px; }
.category-data-row small { color:var(--secondary-text-color,#555); }
@container (max-width:500px) { .trend-data button { grid-template-columns:1fr; } }
@media (max-width:500px) { .trend-data button { grid-template-columns:1fr; } }
:host { container-type:inline-size; }
`;

const FAMILY_NAV='.tabs',FAMILY_ATTR='data-tab',FAMILY_ACTIVE='active';

// Adapted from Config/YAML family15: options come only from current native buttons.
// Observe the actual navigation parent's content box, not the global viewport.
function _rememberFamilyFocus(card) {
  const active = card.shadowRoot?.activeElement;
  const nav = card.shadowRoot?.querySelector(FAMILY_NAV);
  if (active?.id === 'ha-tools-tab-picker') return { picker:true };
  if (nav?.contains(active)) return { tab:active.getAttribute(FAMILY_ATTR) };
  return null;
}
function _disconnectFamilyNavigation(card) {
  card._familyNavObserver?.disconnect();card._familyNavObserver=null;card._familyNavTarget=null;
}
function _bindFamilyNavigation(card, restoreFocus=null) {
  const root=card.shadowRoot, nav=root?.querySelector(FAMILY_NAV);
  if (!nav) { _disconnectFamilyNavigation(card);return; }
  let label=root.querySelector('.ht-tab-picker');
  if (!label) {
    label=card.ownerDocument.createElement('div');label.className='ht-tab-picker';
    const text=card.ownerDocument.createElement('label');text.htmlFor='ha-tools-tab-picker';label.append(text);
    const select=card.ownerDocument.createElement('select');select.id='ha-tools-tab-picker';label.append(select);nav.before(label);
    select.addEventListener('change',()=>{
      const button=Array.from(root.querySelectorAll(FAMILY_NAV+' button['+FAMILY_ATTR+']')).find(item=>item.getAttribute(FAMILY_ATTR)===select.value&&!item.disabled&&!item.hidden);
      if(button)button.click(); // The original handler owns navigation, history and guards.
      _bindFamilyNavigation(card);
    });
  }
  label.firstElementChild.textContent=card._lang==='pl'?'Zakładka':'Tab';
  const select=label.querySelector('select');
  const buttons=Array.from(nav.querySelectorAll('button['+FAMILY_ATTR+']')).filter(button=>!button.hidden&&!button.disabled);
  const options=Array.from(select.options);
  if(options.length!==buttons.length||buttons.some((button,index)=>options[index]?.value!==button.getAttribute(FAMILY_ATTR))) {
    select.replaceChildren(...buttons.map(button=>{const option=card.ownerDocument.createElement('option');option.value=button.getAttribute(FAMILY_ATTR);return option;}));
  }
  buttons.forEach((button,index)=>{select.options[index].textContent=button.getAttribute('aria-label')||button.textContent.trim();});
  const selected=buttons.find(button=>button.classList.contains(FAMILY_ACTIVE));select.value=selected?.getAttribute(FAMILY_ATTR)||'';
  const target=nav.parentElement;
  const applyWidth=width=>{
    const currentNav=root.querySelector(FAMILY_NAV),currentLabel=root.querySelector('.ht-tab-picker');if(!currentNav||!currentLabel)return;
    const input=currentLabel.querySelector('select'),active=root.activeElement;
    const style=getComputedStyle(currentNav);
    const available=width-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0)-(parseFloat(style.borderLeftWidth)||0)-(parseFloat(style.borderRightWidth)||0);
    const narrow=available>0&&available<280,fromTab=currentNav.contains(active),fromPicker=active===input;
    currentNav.hidden=narrow;currentLabel.hidden=!narrow;
    if(narrow&&fromTab)input.focus({preventScroll:true});
    else if(!narrow&&fromPicker)currentNav.querySelector('button.'+FAMILY_ACTIVE)?.focus({preventScroll:true});
  };
  if(card._familyNavTarget!==target) {
    _disconnectFamilyNavigation(card);
    const style=getComputedStyle(target);
    const measured=target.getBoundingClientRect().width-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0)-(parseFloat(style.borderLeftWidth)||0)-(parseFloat(style.borderRightWidth)||0);
    if(measured>0)card._familyNavWidth=measured;
    if(typeof ResizeObserver==='function'&&card.isConnected) {
      card._familyNavTarget=target;
      const observer=new ResizeObserver(entries=>{
        if(!card.isConnected||card._familyNavObserver!==observer||card._familyNavTarget!==target)return;
        const entry=entries.find(item=>item.target===target);if(!entry)return;
        card._familyNavWidth=entry.contentRect.width;applyWidth(card._familyNavWidth);
      });
      card._familyNavObserver=observer;
      observer.observe(target);
    }
  }
  // Use the actual container width when available, even without ResizeObserver.
  // An unknown width never enables a narrow-only picker.
  applyWidth(card._familyNavWidth || 900);
  if(restoreFocus) {
    const button=buttons.find(item=>item.getAttribute(FAMILY_ATTR)===restoreFocus.tab)||selected;
    if(nav.hidden||(restoreFocus.picker&&!label.hidden))select.focus({preventScroll:true});else button?.focus({preventScroll:true});
  }
}

const _FAMILY_CONTROL_CSS = `
/* Family15: native touch targets; checkbox indicators remain small inside labels. */
:host button,:host summary,:host a[href],:host [role=button],
:host input:not([type=checkbox]):not([type=radio]),:host select,:host textarea {
  box-sizing:border-box;min-height:44px !important;min-width:44px !important;max-width:100%;flex-shrink:0;
}
:host button,:host summary,:host a[href] { white-space:normal !important;overflow-wrap:anywhere; }
:host a[href] { display:inline-flex;align-items:center; }
:host label:has(input[type=checkbox]) { min-height:44px !important;min-width:44px;display:flex;align-items:center;gap:8px;cursor:pointer; }
:host input[type=checkbox] { width:18px !important;height:18px !important;min-width:18px !important;min-height:18px !important;flex:none; }
:host button:focus-visible,:host summary:focus-visible,:host a:focus-visible,:host input:focus-visible,:host select:focus-visible,:host textarea:focus-visible,:host [role=button]:focus-visible {
  outline:3px solid var(--primary-color,#1769aa) !important;outline-offset:2px;
}
.intro-banner { padding-right:64px !important; }
.ht-tab-picker { min-width:0;display:flex;flex-direction:column;gap:6px;padding:8px;margin:0 0 8px; }
.ht-tab-picker select { width:100%;font:inherit;color:var(--primary-text-color,inherit);background:var(--card-background-color,transparent);padding:8px;border:1px solid var(--divider-color,#aaa);border-radius:8px; }
.ht-tab-picker[hidden],.tabs[hidden],.det-tabs[hidden] { display:none !important; }
.tabs,.det-tabs { display:flex;box-sizing:border-box;flex-wrap:wrap !important;overflow:visible !important;min-width:0;max-width:100%; }
:host .tabs button,:host .det-tabs button { min-height:44px !important;min-width:44px !important;white-space:normal !important;overflow-wrap:anywhere;flex:1 1 auto; }
`;

// Values remain owned by the existing input/config handlers; retain only focus/caret.
function _rememberFamilyEditorFocus(editor) {
  const field=editor.shadowRoot.activeElement;
  return field?.id ? {id:field.id,start:field.selectionStart,end:field.selectionEnd,direction:field.selectionDirection} : null;
}
function _restoreFamilyEditorFocus(editor, saved) {
  const field=saved&&editor.shadowRoot.getElementById(saved.id);if(!field||field.disabled)return;
  field.focus({preventScroll:true});
  if(typeof saved.start==='number'&&typeof field.setSelectionRange==='function')field.setSelectionRange(saved.start,saved.end,saved.direction||'none');
}

const STORAGE_PRESENTATION_CSS = `
:host {
  --bento-bg:var(--hat-card,var(--_hat-card));--bento-card:var(--hat-card,var(--_hat-card));
  --bento-text:var(--hat-text,var(--_hat-text));--bento-text-secondary:var(--hat-text-2,var(--_hat-text-2));
  --bento-border:var(--hat-border,var(--_hat-border));--bento-primary:var(--hat-s4,var(--primary-color,#2563eb));
  --bento-radius:var(--ha-card-border-radius,12px);
  display:block;min-width:0;font-family:var(--primary-font-family,Roboto,Arial,sans-serif);font-size:14px;
  color:var(--primary-text-color,var(--_hat-text));
}
:host(.bento-dark) {
  --bento-bg:var(--hat-card,var(--_hat-card));--bento-card:var(--hat-card,var(--_hat-card));
  --bento-text:var(--hat-text,var(--_hat-text));--bento-text-secondary:var(--hat-text-2,var(--_hat-text-2));
  --bento-border:var(--hat-border,var(--_hat-border));--bento-primary:var(--hat-s4,var(--primary-color,#818cf8));
}
.card,ha-card {display:block;background:var(--ha-card-background,var(--card-background-color,var(--_hat-card)));
  color:var(--primary-text-color,var(--_hat-text));border-radius:var(--ha-card-border-radius,12px);box-sizing:border-box;}
.card {font-family:inherit;overflow:hidden;border:var(--ha-card-border-width,1px) solid var(--divider-color,var(--_hat-border));box-shadow:var(--ha-card-box-shadow,none);}
.card-header {display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 16px;}
.card-header h2 {flex:1 1 140px;font-size:18px;line-height:1.35;margin:0;overflow-wrap:anywhere;}
ha-icon {--mdc-icon-size:22px;color:var(--hat-s4,var(--primary-color,#2563eb));}
.card-header button,.storage-secondary,.trend-load {border:1px solid var(--divider-color,var(--_hat-border))!important;
  background:transparent!important;color:var(--primary-text-color,var(--_hat-text))!important;box-shadow:none!important;font:inherit;}
:host button,:host select,:host input {font:inherit!important;}
:host select,:host option,:host input {background:var(--ha-card-background,var(--card-background-color,var(--_hat-card)))!important;
  color:var(--primary-text-color,var(--_hat-text))!important;}
.tabs {flex-wrap:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:thin;padding:0 8px!important;border-radius:0!important;background:transparent!important;margin-bottom:0!important;gap:0!important;}
:host .tabs button {flex:0 0 auto!important;white-space:nowrap!important;overflow-wrap:normal;padding:10px 14px!important;font-size:14px!important;font-family:inherit!important;border-radius:0!important;box-shadow:none!important;}
:host .tabs button[aria-selected=true] {color:var(--primary-color,var(--_hat-primary))!important;border-bottom:3px solid currentColor!important;}
#content {padding:16px;}
.storage-help {border-top:1px solid var(--divider-color,var(--_hat-border));margin-top:12px;padding-top:4px;}
.storage-help summary,[data-resources] summary {cursor:pointer;padding:12px 0;overflow-wrap:anywhere;}
.storage-help p,.storage-history p {line-height:1.5;overflow-wrap:anywhere;font-size:14px;}
.storage-action-heading {display:flex;align-items:center;gap:12px;justify-content:space-between;}
.storage-action-heading h3 {margin:0;}
.storage-history h3 {font-size:18px;margin:0 0 12px;}
.storage-history h4 {font-size:14px;margin:0 0 8px;}
.trend-comparison {padding:12px;border:1px solid var(--divider-color,var(--_hat-border));border-radius:8px;margin:12px 0;}
.trend-comparison p {margin:8px 0;}
.trend-unknown {fill:var(--secondary-text-color,var(--_hat-text-2));fill-opacity:.10;}
.trend-step-used {stroke:var(--hat-s4,var(--primary-color,#2563eb));stroke-width:2;}
.trend-recorded-state {stroke-dasharray:4 3;}
.trend-recorded-note {font-size:13px;line-height:1.5;color:var(--secondary-text-color,var(--_hat-text-2));}
.trend-step-total {stroke:var(--primary-text-color,var(--_hat-text));stroke-width:2;stroke-dasharray:5 3;}
.trend-axis-top,.trend-axis-bottom,.trend-gap-label,.trend-dates,.trend-figure small {font-size:12px!important;}
.trend-data {overflow:auto;max-width:100%;padding:0;display:block;}
.trend-data table {width:100%;border-collapse:collapse;font-size:14px;}
.trend-data caption {text-align:left;padding:8px 0;}
.trend-data th,.trend-data td {padding:8px;text-align:left;vertical-align:top;border-bottom:1px solid var(--divider-color,var(--_hat-border));}
.trend-data button {display:block;width:100%;font:inherit;text-align:left;background:transparent;color:inherit;border:1px solid var(--divider-color,var(--_hat-border));border-radius:6px;}
.trend-data button[aria-pressed=true] {outline:2px solid var(--primary-color,var(--_hat-primary));}
.trend-data code {overflow-wrap:anywhere;font-size:12px;}
.category-data small,.cat-size,.note-box {font-size:12px!important;}
[hidden] {display:none!important;}
.storage-compact {padding:12px 16px;max-height:248px;overflow:auto;}
.storage-compact header {display:flex;align-items:center;gap:8px;min-width:0;}
.storage-compact header strong {flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.compact-pct {font-size:22px;font-weight:600;white-space:nowrap;}
.compact-capacity {height:6px;border-radius:3px;margin:10px 0;background:var(--divider-color,var(--_hat-border));overflow:hidden;}
.compact-capacity span {display:block;height:100%;background:var(--hat-s4,var(--primary-color,#2563eb));}
.compact-values {display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;font-size:14px;}
.compact-source {overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--secondary-text-color,var(--_hat-text-2));margin-top:6px;}
.compact-quality {font-size:12px;line-height:1.35;margin:4px 0 8px;color:var(--secondary-text-color,var(--_hat-text-2));}
.compact-actions {display:flex;gap:8px;flex-wrap:wrap;}
.compact-actions button {padding:8px 12px;border:1px solid var(--divider-color,var(--_hat-border));border-radius:8px;
  background:var(--hat-primary-fill,var(--_hat-primary-fill));color:var(--hat-on-primary,var(--_hat-on-primary));font:inherit;}
.storage-tile {height:56px;overflow:hidden;}
:host .storage-tile-button {display:flex;flex-direction:column;justify-content:center;gap:0;width:100%;height:56px;padding:3px 8px;text-align:left;
  border:0;border-radius:var(--ha-card-border-radius,12px);background:transparent;color:inherit;line-height:1.15;}
.tile-title {display:flex;align-items:center;gap:4px;width:100%;font-size:14px;}
.tile-title ha-icon {--mdc-icon-size:16px;}
.tile-title span {overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}
.tile-title strong {white-space:nowrap;}
.tile-free,.tile-quality {font-size:12px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;}
.tile-quality {color:var(--secondary-text-color,var(--_hat-text-2));}
[data-severity=warning] {color:var(--warning-color,#b26a00);}
[data-severity=critical] {color:var(--error-color,#db4437);}
.compact-capacity [data-severity=warning] {background:var(--warning-color,#b26a00);}
.compact-capacity [data-severity=critical] {background:var(--error-color,#db4437);}
button:disabled {opacity:.6;cursor:default;}
.history-editor label {font-size:14px!important;}
.history-editor p {font-size:14px!important;}
`;

// BEGIN STORAGE_BACKEND_ADAPTER (canonical source in shared/)
const _StorageBackend = (() => {
  'use strict';
  const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
  const fail = reason => { throw new Error('storage_backend:' + reason); };
  const object = (v, name) => { if (!v || typeof v !== 'object' || Array.isArray(v)) fail(name); return v; };
  const number = (v, name) => { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) fail(name); return v; };
  const integer = (v, name) => { number(v, name); if (!Number.isSafeInteger(v)) fail(name); return v; };
  const text = (v, name) => { if (typeof v !== 'string' || !v.trim() || v.length > 512) fail(name); return v; };
  const bool = (v, name) => { if (typeof v !== 'boolean') fail(name); return v; };
  const array = (v, name) => { if (!Array.isArray(v)) fail(name); return v; };
  const stamp = (v, name) => { number(v, name); if (!Number.isFinite(v * 1000) || v * 1000 > 8640000000000000) fail(name); return v; };
  const clone = v => {
    if (Array.isArray(v)) return v.map(clone);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)]));
    return v;
  };
  const freeze = v => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
  const reason = v => v === null ? null : text(v, 'reason');
  function optionalIdentity(dto, key, expected) {
    if (expected !== undefined) text(expected, key + '_expected');
    if (own(dto, key)) {
      text(dto[key], key);
      if (expected !== undefined && dto[key] !== expected) fail(key + '_mismatch');
      return expected === undefined ? 'provided_unbound' : 'matched';
    }
    return 'absent';
  }
  function tuple(v) {
    object(v, 'tuple');
    for (const key of ['used_bytes', 'total_bytes', 'free_bytes', 'reserved_bytes']) number(v[key], key);
    if (v.total_bytes <= 0) fail('total_bytes');
    const sum = v.used_bytes + v.free_bytes + v.reserved_bytes;
    const tolerance = Math.max(1e-6, Math.max(sum, v.total_bytes) * 1e-12);
    if (!Number.isFinite(sum) || Math.abs(sum - v.total_bytes) > tolerance || v.used_bytes > v.total_bytes) fail('unbalanced_tuple');
    stamp(v.measured_at, 'measured_at');
    return v;
  }
  function forecastView(item, {nowMs} = {}) {
    const now = stamp(number(nowMs, 'nowMs') / 1000, 'now');
    object(item, 'item'); const source = object(item.source, 'source');
    text(source.source_uuid, 'source_uuid');
    const f = object(item.forecast, 'forecast');
    stamp(f.calculated_at, 'calculated_at');
    if (f.method !== 'ols_used_bytes_actual_elapsed_days' || f.physical_continuity !== 'unknown' ||
        array(f.confirmed_intervals, 'forecast_intervals').length) fail('forecast_semantics');
    if (f.measured_at !== null) stamp(f.measured_at, 'forecast_measured_at');
    if (f.source_uuid !== null && f.source_uuid !== source.source_uuid) fail('forecast_source_mismatch');
    if (!['unknown', 'limited_estimate'].includes(f.quality)) fail('forecast_quality');
    reason(f.reason); integer(f.sample_count, 'sample_count');
    if (f.full_in_days !== null) number(f.full_in_days, 'full_in_days');
    if (f.growth_bytes_per_day !== null && (typeof f.growth_bytes_per_day !== 'number' || !Number.isFinite(f.growth_bytes_per_day))) fail('growth');
    let why = reason(item.error) || f.reason;
    if (f.calculated_at > now || (f.measured_at !== null && f.measured_at > now)) why = 'future_clock';
    else if (now - f.calculated_at > 3600 || (f.measured_at !== null && now - f.measured_at > 3600)) why = 'stale';
    if (f.full_in_days !== null && (f.quality !== 'limited_estimate' || f.reason !== null ||
        !(f.growth_bytes_per_day > 0) || f.measured_at === null || f.source_uuid !== source.source_uuid)) fail('invalid_estimate');
    if (f.full_in_days !== null && !why) {
      const c = tuple(item.current), w = object(f.window, 'forecast_window');
      stamp(w.start, 'forecast_window_start'); stamp(w.end, 'forecast_window_end');
      number(w.observed_seconds, 'forecast_observed_seconds');
      const coverage = object(f.coverage, 'forecast_coverage');
      if (f.sample_count < 3 || f.sample_count > 4096 || w.start === null ||
          w.maximum_seconds !== 604800 ||
          w.observed_seconds !== w.end - w.start || w.observed_seconds < 86400 ||
          w.observed_seconds > 604800 || w.end !== f.measured_at ||
          w.start < f.calculated_at - 604800 || c.measured_at !== f.measured_at ||
          c.free_semantics !== 'available_to_process' || c.free_computed !== false) fail('estimate_evidence');
      integer(coverage.successful_slots, 'forecast_successful_slots');
      integer(coverage.expected_slots, 'forecast_expected_slots');
      number(coverage.ratio, 'forecast_coverage_ratio');
      number(coverage.longest_gap_seconds, 'forecast_longest_gap');
      const expectedSlots = Math.floor(w.observed_seconds / 1800) + 1;
      if (coverage.schedule_seconds !== 1800 || coverage.expected_slots !== expectedSlots ||
          coverage.successful_slots > coverage.expected_slots || coverage.successful_slots > f.sample_count ||
          Math.abs(coverage.ratio - coverage.successful_slots / expectedSlots) > 1e-12 ||
          coverage.ratio < 0.8 || coverage.longest_gap_seconds > 5400) fail('estimate_evidence');
      const expectedDays = c.free_bytes / f.growth_bytes_per_day;
      if (!Number.isFinite(expectedDays) ||
          (c.free_bytes === 0) !== (f.full_in_days === 0) ||
          Math.abs(f.full_in_days - expectedDays) > Math.max(1e-12, expectedDays * 1e-10)) fail('estimate_current_mismatch');
    }
    if (f.quality === 'limited_estimate' && f.full_in_days === null) fail('missing_estimate');
    if (f.full_in_days === null && !why) fail('unknown_without_reason');
    return freeze({fullInDays: why ? null : f.full_in_days, growthBytesPerDay: f.growth_bytes_per_day,
      quality: why ? 'unknown' : f.quality, reason: why, calculatedAt: f.calculated_at * 1000,
      measuredAt: f.measured_at === null ? null : f.measured_at * 1000, sourceUuid: source.source_uuid,
      sampleCount: f.sample_count, raw: clone(f)});
  }
  function validateStatus(dto, {entryId, nowMs} = {}) {
    object(dto, 'status'); if (dto.schema_version !== 1) fail('schema_version');
    const now = stamp(number(nowMs, 'nowMs') / 1000, 'now'); stamp(dto.read_at, 'read_at');
    if (dto.read_at > now) fail('future_read');
    const entryIdentity = optionalIdentity(dto, 'entry_id', entryId);
    if (object(dto.permissions, 'permissions').admin_only !== true) fail('permissions');
    const ids = new Set(); const sources = array(dto.sources, 'sources');
    if (sources.length > 32) fail('source_limit');
    const validated = sources.map(item => {
      object(item, 'item'); const s = object(item.source, 'source');
      text(s.source_uuid, 'source_uuid'); text(s.binding_revision, 'binding_revision'); text(s.label, 'label');
      if (s.kind !== 'local_fs_samples' || s.scope !== 'ha_process_filesystem' || s.identity_quality !== 'process_mount_namespace') fail('source_semantics');
      if (ids.has(s.source_uuid)) fail('duplicate_source'); ids.add(s.source_uuid);
      reason(item.error); const copy = clone(item);
      if (item.current !== null) {
        tuple(item.current);
        if (item.current.free_computed !== false || item.current.free_semantics !== 'available_to_process') fail('free_semantics');
        if (item.error !== null) fail('current_with_error');
        if (item.current.measured_at > dto.read_at || item.current.measured_at > now) { copy.current = null; copy.error = 'future_clock'; }
        else if (now - item.current.measured_at > 3600 || now - dto.read_at > 3600) { copy.current = null; copy.error = 'stale'; }
      } else if (item.error === null) fail('missing_current_reason');
      forecastView(copy, {nowMs});
      return copy;
    });
    return freeze({schemaVersion: 1, entryId: dto.entry_id || null, requestedEntryId: entryId || null,
      entryIdentity, readAt: dto.read_at * 1000, sources: validated});
  }
  function selectSource(validated, {sourceUuid} = {}) {
    const sources = array(object(validated, 'validated').sources, 'sources');
    if (sourceUuid !== undefined) {
      text(sourceUuid, 'sourceUuid');
      const found = sources.find(item => item.source.source_uuid === sourceUuid);
      if (!found) fail('selected_source_missing'); return found;
    }
    if (sources.length !== 1) fail(sources.length ? 'source_selection_required' : 'no_sources');
    return sources[0];
  }
  function capacitySnapshot(item, {readAt} = {}) {
    object(item, 'item'); const s = object(item.source, 'source');
    if (s.kind !== 'local_fs_samples' || s.scope !== 'ha_process_filesystem') fail('source_semantics');
    text(s.source_uuid, 'source_uuid'); text(s.binding_revision, 'binding_revision');
    number(readAt, 'readAt'); stamp(readAt / 1000, 'readAt');
    reason(item.error); const c = item.current === null ? null : tuple(item.current);
    if (c && (c.free_computed !== false || c.free_semantics !== 'available_to_process')) fail('free_semantics');
    const valid = c !== null && item.error === null && c.measured_at * 1000 <= readAt && readAt - c.measured_at * 1000 <= 3600000;
    const categories = [
      ['Backups', '#9c27b0', '💾'], ['Database (Recorder)', '#ff9800', '🗄️'],
      ['Add-ons', '#4caf50', '🧩'], ['Integrations', '#2196f3', '🔌'], ['System & Other', '#607d8b', '🖥']
    ].map(([name, color, icon]) => ({name, color, icon, size: 0, measured: false, sourceUnavailable: true}));
    return freeze({source: 'local_fs_samples', scope: 'ha_process_filesystem', sourceUuid: s.source_uuid,
      bindingRevision: s.binding_revision, sourceEntityIds: [], backendSampleIds: [], unit: 'GB', sourceUnits: ['B'],
      sourceMeasuredAt: c ? [c.measured_at * 1000] : [], measuredAt: c ? c.measured_at * 1000 : null,
      readAt, freeComputed: false, freeSemantics: 'available_to_process',
      diskTotal: valid ? c.total_bytes / 1e9 : null, diskUsed: valid ? c.used_bytes / 1e9 : null,
      diskFree: valid ? c.free_bytes / 1e9 : null, diskReserved: valid ? c.reserved_bytes / 1e9 : null,
      usedPercent: valid ? Math.round(c.used_bytes / c.total_bytes * 100) : null, categories,
      addons: [], backups: [], integrations: [], addonsAvailable: false, backupsAvailable: false,
      integrationsAvailable: false, dbSizeMB: 0, totalAddonsMB: 0, totalBackupsMB: 0,
      addonCount: null, intCount: null, hostname: s.label, osVersion: 'N/A',
      availabilityReason: valid ? null : item.error || (c && c.measured_at * 1000 > readAt ? 'future_clock' : c ? 'stale' : 'no_sample')});
  }
  function window(v, name) {
    object(v, name); number(v.seconds, name + '_seconds');
    if (v.start === null || v.end === null) {
      if (v.start !== null || v.end !== null || v.seconds !== 0) fail(name); return v;
    }
    stamp(v.start, name + '_start'); stamp(v.end, name + '_end');
    if (v.end < v.start || v.seconds !== v.end - v.start) fail(name); return v;
  }
  function projectHistory(dto, {entryId, sourceUuid, bindingRevision, sourceKey} = {}) {
    object(dto, 'history'); text(sourceUuid, 'sourceUuid'); text(bindingRevision, 'bindingRevision'); text(sourceKey, 'sourceKey');
    if (own(dto, 'schema_version') && dto.schema_version !== 1) fail('schema_version');
    const entryIdentity = optionalIdentity(dto, 'entry_id', entryId);
    const revisionIdentity = optionalIdentity(dto, 'binding_revision', bindingRevision);
    if (dto.source_uuid !== sourceUuid) fail('source_uuid_mismatch');
    const requested = window(dto.requested_window, 'requested_window');
    if (![7 * 86400, 30 * 86400].includes(requested.seconds) || requested.start === null) fail('requested_range');
    const observed = window(dto.observed_window, 'observed_window');
    if (observed.start !== null && (observed.start < requested.start || observed.end > requested.end)) fail('observed_range');
    bool(dto.capped, 'capped');
    if (dto.physical_continuity !== 'unknown' || array(dto.confirmed_intervals, 'confirmed_intervals').length) fail('continuity_claim');
    const coverage = object(dto.coverage, 'coverage');
    integer(coverage.successful_slots, 'successful_slots'); integer(coverage.expected_slots, 'expected_slots');
    if (coverage.successful_slots > coverage.expected_slots || coverage.schedule_seconds !== 1800) fail('coverage');
    if (coverage.ratio !== null && (number(coverage.ratio, 'ratio') > 1 || coverage.expected_slots === 0 ||
        Math.abs(coverage.ratio - coverage.successful_slots / coverage.expected_slots) > 1e-12)) fail('coverage');
    if (coverage.ratio === null && coverage.expected_slots !== 0) fail('coverage');
    if (coverage.longest_gap_seconds !== null) number(coverage.longest_gap_seconds, 'longest_gap');
    for (const s of array(dto.segments, 'segments')) {
      object(s, 'segment'); text(s.segment_id, 'segment_id'); text(s.binding_revision, 'segment_binding');
      stamp(s.start, 'segment_start'); stamp(s.end, 'segment_end'); integer(s.sample_count, 'segment_count');
      if (s.end < s.start || s.start < requested.start || s.end > requested.end || s.sample_count < 1) fail('segment');
    }
    for (const gap of array(dto.gaps, 'gaps')) {
      object(gap, 'gap'); stamp(gap.start, 'gap_start'); stamp(gap.end, 'gap_end'); number(gap.seconds, 'gap_seconds');
      if (gap.seconds !== gap.end - gap.start || gap.seconds <= 1800 || gap.start < requested.start || gap.end > requested.end) fail('gap');
    }
    if (dto.last_success !== null) { stamp(dto.last_success, 'last_success'); if (dto.last_success > requested.end) fail('future_last_success'); }
    const samples = array(dto.rows, 'rows'); if (samples.length > 4096) fail('row_limit');
    const ids = new Set(); let previous = -Infinity;
    for (const row of samples) {
      tuple(row); text(row.sample_id, 'sample_id'); text(row.segment_id, 'segment_id');
      if (row.source_uuid !== sourceUuid) fail('row_source_mismatch');
      if (row.binding_revision !== bindingRevision) fail('row_revision_mismatch');
      if (!['strong', 'limited'].includes(row.identity_quality)) fail('identity_quality');
      if (ids.has(row.sample_id)) fail('duplicate_sample'); ids.add(row.sample_id);
      if (row.measured_at <= previous) fail('out_of_order'); previous = row.measured_at;
      if (row.measured_at < requested.start || row.measured_at > requested.end || observed.start === null ||
          row.measured_at < observed.start || row.measured_at > observed.end) fail('row_range');
    }
    const paged = ['page_offset', 'total_rows', 'next_offset'].some(k => own(dto, k));
    if (paged) {
      integer(dto.page_offset, 'page_offset'); integer(dto.total_rows, 'total_rows');
      if (dto.total_rows > 4096 || dto.page_offset > dto.total_rows || dto.page_offset + samples.length > dto.total_rows) fail('pagination');
      if (dto.next_offset !== null) integer(dto.next_offset, 'next_offset');
      const end = dto.page_offset + samples.length;
      if (dto.next_offset === null ? end !== dto.total_rows : dto.next_offset !== end || end >= dto.total_rows || !samples.length) fail('pagination');
    }
    if ((!paged || dto.total_rows === samples.length) && (samples.length ? observed.start !== samples[0].measured_at ||
        observed.end !== samples[samples.length - 1].measured_at : observed.start !== null)) fail('observed_rows');
    const selected = samples.slice(-1200), rows = []; let prev = null;
    for (const sample of selected) {
      const identity = JSON.stringify([sample.source_uuid, sample.binding_revision, sample.segment_id, sample.identity_quality,
        sample.total_bytes, sample.reserved_bytes]);
      const changed = !!prev && identity !== prev.identity;
      for (const kind of ['used', 'total']) rows.push({id: JSON.stringify([sample.source_uuid, sample.sample_id, kind]),
        backendSampleId: sample.sample_id, backendSourceUuid: sourceUuid, bindingRevision, segmentId: sample.segment_id,
        entityId: null, sourceIdentity: identity, sourceKey, time: sample.measured_at * 1000,
        recordedSeconds: sample.measured_at, utc: new Date(sample.measured_at * 1000).toISOString(), kind,
        state: sample[kind + '_bytes'], unit: 'B', bytes: sample[kind + '_bytes'], capacityBytes: sample.total_bytes,
        lastChangedSeconds: sample.measured_at, attributeOnly: false, ambiguous: false,
        sourceChanged: changed, capacityChanged: !!prev && sample.total_bytes !== prev.sample.total_bytes,
        unitChanged: false, breakBefore: changed});
      prev = {identity, sample};
    }
    const start = requested.start * 1000, end = requested.end * 1000;
    const boundaries = [...new Set([start, ...selected.map(s => s.measured_at * 1000), end])].sort((a, b) => a - b);
    const series = ['used', 'total'].map(kind => ({kind,
      segments: rows.filter(r => r.kind === kind).map(row => ({continuity: 'unknown', points: [row]})),
      gaps: boundaries.slice(1).map((to, i) => ({from: boundaries[i], to, reason: 'unconfirmed_interval'}))}));
    // Display interpolation of stored states, separate from physical coverage.
    // The 30-minute sampler may run late; a missing observation (>45 minutes)
    // or any source/capacity boundary starts a new visual run. No edge holding.
    const recordedStateMaxGapMs = coverage.schedule_seconds * 1500;
    const recordedStateSeries = ['used', 'total'].map(kind => {
      const segments = [];
      for (const row of rows.filter(row => row.kind === kind)) {
        const previous = segments.at(-1)?.points.at(-1);
        if (!previous || row.breakBefore || row.sourceIdentity !== previous.sourceIdentity ||
            row.time - previous.time > recordedStateMaxGapMs) {
          segments.push({semantics: 'last_recorded_state', points: []});
        }
        segments.at(-1).points.push(row);
      }
      return {kind, segments};
    });
    return freeze({rows, entityIds: [], backendSampleIds: selected.map(s => s.sample_id), sourceKey, series, recordedStateSeries, recordedStateMaxGapMs, missing: [],
      start, end, invalid: 0, inspected: samples.length, orderIssues: 0,
      capped: dto.capped || samples.length > 1200 || (paged && samples.length < dto.total_rows),
      renderSubset: {policy: 'newest_1200_samples_from_supplied_page', suppliedSamples: samples.length, renderedSamples: selected.length},
      coverage: 'unknown', retention: 'unknown', continuity: 'unknown', physicalContinuity: 'unknown', confirmedIntervals: [],
      entryIdentity, revisionIdentity, rawSamples: clone(samples), requestedWindow: clone(requested), observedWindow: clone(observed),
      observationCoverage: clone(coverage), backendSegments: clone(dto.segments), observationGaps: clone(dto.gaps),
      lastSuccess: dto.last_success, pagination: paged ? {pageOffset: dto.page_offset, totalRows: dto.total_rows, nextOffset: dto.next_offset} : null});
  }
  return Object.freeze({validateStatus, selectSource, capacitySnapshot, projectHistory, forecastView});
})();
// END STORAGE_BACKEND_ADAPTER

// BEGIN STORAGE_DASHBOARD_PLACEMENT (canonical sources in shared/)
'use strict';

// One wire fence for the card-owned host and settings editor. A public timeout
// is uncertainty, never permission to dispatch another raw operation.
function createTariffGuardV3({ getHass, getContext = () => null, browser = typeof window === 'object' ? window : null, timeoutMs = 15000 }) {
  const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
  let epoch = 0, association, connection, connectionOffline = false, browserOffline = browser?.navigator?.onLine === false;
  let raw = null, reservation = null, suspended = false;
  const listeners = new Set(), wireListeners = new Set();
  const notify = () => { epoch++; for (const listener of [...listeners]) listener(); };
  const connectionEvent = event => {
    if (event.type === 'disconnected' || event.type === 'reconnect-error') connectionOffline = true;
    else if (event.type === 'ready') connectionOffline = false;
    notify();
  };
  const types = ['disconnected', 'ready', 'reconnect-error'];
  const bind = next => {
    if (connection === next) return;
    for (const type of types) connection?.removeEventListener?.(type, connectionEvent);
    connection = next; connectionOffline = next?.connected === false;
    if (!suspended) for (const type of types) connection?.addEventListener?.(type, connectionEvent);
  };
  const browserEvent = event => { browserOffline = event.type === 'offline'; notify(); };
  browser?.addEventListener?.('offline', browserEvent);
  browser?.addEventListener?.('online', browserEvent);
  const read = h => {
    bind(h?.connection);
    return { user: h?.user?.id, admin: h?.user?.is_admin === true, owner: h?.user?.is_owner === true,
      active: h?.user?.is_active !== false, groups: canonical(h?.user?.groups || []), groupIds: canonical(h?.user?.group_ids || []),
      connection: h?.connection, callWS: h?.callWS,
      connected: h?.connection?.connected !== false && !connectionOffline,
      online: !suspended && !browserOffline && browser?.navigator?.onLine !== false,
      haConfig: canonical(h?.config || {}), context: canonical(getContext()) };
  };
  const equal = (a, b) => a && b && Object.keys(b).every(k => a[k] === b[k]);
  const observe = (...prospectiveHass) => {
    const now = read(prospectiveHass.length ? prospectiveHass[0] : getHass()), changed = association && !equal(association, now);
    association = now;
    if (changed) notify();
    return { ...now, epoch };
  };
  const available = a => !!a?.user && a.active && !!a.connection && a.connected && a.online && typeof a.callWS === 'function';
  const snapshot = () => observe();
  const current = (token, admin = false) => {
    const now = observe();
    return token?.epoch === now.epoch && equal(token, Object.fromEntries(Object.entries(now).filter(([k]) => k !== 'epoch'))) && available(now) && (!admin || now.admin);
  };
  const reserve = token => {
    if (!current(token)) throw { code: 'authority_changed' };
    if (raw || reservation) throw { code: 'wire_occupied' };
    const owner = { release: () => {
      if (reservation !== owner) return;
      reservation = null;
      if (!raw) for (const listener of [...wireListeners]) listener();
    } };
    reservation = owner; return owner;
  };
  const call = (token, payload, admin = false, owner = null) => {
    if (!current(token, admin)) return Promise.reject({ code: 'authority_changed' });
    if (raw || reservation && reservation !== owner) return Promise.reject({ code: 'wire_occupied' });
    let resolvePublic, rejectPublic, finished = false;
    const result = new Promise((resolve, reject) => { resolvePublic = resolve; rejectPublic = reject; });
    const slot = {}; raw = slot;
    const timer = setTimeout(() => { finished = true; rejectPublic({ code: 'timeout' }); }, timeoutMs);
    let request;
    try { request = Promise.resolve(token.callWS.call(getHass(), payload)); }
    catch (error) { request = Promise.reject(error); }
    // Both branches handle late settlement; no floating rejected finally promise.
    const settled = () => {
      clearTimeout(timer); if (raw === slot) raw = null;
    };
    const notifySettled = () => { for (const listener of [...wireListeners]) listener(); };
    request.then(value => {
      settled();
      if (!finished) { finished = true; current(token, admin) ? resolvePublic(value) : rejectPublic({ code: 'authority_changed' }); }
      notifySettled();
    }, error => { settled(); if (!finished) { finished = true; rejectPublic(error); } notifySettled(); });
    return result;
  };
  const suspend = () => {
    if (suspended) return;
    suspended = true;
    for (const type of types) connection?.removeEventListener?.(type, connectionEvent);
    browser?.removeEventListener?.('offline', browserEvent); browser?.removeEventListener?.('online', browserEvent);
    notify();
  };
  const resume = () => {
    if (!suspended) return;
    suspended = false; browserOffline = browser?.navigator?.onLine === false;
    for (const type of types) connection?.addEventListener?.(type, connectionEvent);
    browser?.addEventListener?.('offline', browserEvent); browser?.addEventListener?.('online', browserEvent);
    notify(); observe();
  };
  const dispose = () => {
    for (const type of types) connection?.removeEventListener?.(type, connectionEvent);
    browser?.removeEventListener?.('offline', browserEvent); browser?.removeEventListener?.('online', browserEvent);
    notify(); listeners.clear(); wireListeners.clear(); // Raw occupancy intentionally survives disposal.
  };
  observe(); // Observe typed edges before the card/editor is ever mounted.
  return { snapshot, observe, current, available, call, reserve, occupied: () => raw !== null || reservation !== null,
    subscribeWire: listener => { wireListeners.add(listener); return () => wireListeners.delete(listener); },
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); }, invalidate: notify, suspend, resume, dispose };
}


// Storage adaptation from Smart ae7b379: Energy a1d333dc3fef54e8a1fb430202d275699b65b016. Distinct tag and Storage-only allowlists.
// Native HA dialog-manager (frontend 20260826.7) owns this transient session.
// Its provideHass subscription supplies current identity after Lovelace replaces
// the initiating card. Neither an old card nor a cached hass authorizes Undo.
function createNativeDashboardPlacementV53(options) {
  const {host, getHass, getCardConfig, getSourceKey, createGuard} = options;
  let ancestor = host;
  while (ancestor && ancestor.localName !== 'home-assistant')
    ancestor = ancestor.parentElement || ancestor.getRootNode?.().host;
  if (!ancestor || typeof ancestor.provideHass !== 'function') return null;
  const doc = host.ownerDocument, win = doc.defaultView;
  const tag = 'ha-tools-storage-dashboard-placement-dialog-v53';
  const copy = value => JSON.parse(JSON.stringify(value));
  const route = () => win.location.pathname + win.location.search + win.location.hash;
  if (!win.customElements.get(tag)) {
    win.customElements.define(tag, class extends win.HTMLElement {
      set hass(value) {
        this._hass = value;
        this._guard?.observe(value);
        if (this._request && !this._sourceCurrent()) this.closeDialog();
        this._controller?.update();
      }
      get hass() { return this._hass; }
      _sourceCurrent() {
        const request = this._request;
        if (!request || request.cancelled || route() !== request.route) return false;
        return request.transferred || request.sourceCurrent();
      }
      showDialog(request) {
        this.closeDialog();
        if (request.cancelled) return;
        this._request = request; request.owner = this;
        // HA calls showDialog before appending the native element.
        win.queueMicrotask(() => this._start());
      }
      connectedCallback() { this._start(); }
      disconnectedCallback() { this.closeDialog(); }
      _start() {
        const request = this._request;
        if (!request || this._guard || !this.isConnected) return;
        if (!this._sourceCurrent() || this._hass?.connection !== request.connection ||
            this._hass?.user?.id !== request.user) { this.closeDialog(); return; }
        const guard = createGuard({getHass:() => this._hass,
          getContext:() => ({card:request.card,route:route()}),browser:win});
        this._guard = guard; this._token = guard.snapshot();
        if (!guard.current(this._token,true)) { this.closeDialog(); return; }
        this._unsubscribe = guard.subscribe(() => this.closeDialog());
        this._routeChanged = () => { if (!this._sourceCurrent()) this.closeDialog(); };
        for (const event of ['location-changed','popstate','hashchange']) win.addEventListener(event,this._routeChanged);
        this._controller ||= createDashboardPlacementV53({host:this,nativeOwned:true,
          getHass:() => this._sourceCurrent() && this._guard?.current(this._token,true) ? this._hass : null,
          getCardConfig:() => this._request?.card,
          getSourceKey:() => this._token?.epoch,
          onClose:() => { if (this._request) this.closeDialog(); }});
        if (!this._controller.open()) this.closeDialog();
      }
      transfer(request) {
        // Only a transaction already sent by the user's Add/Undo may outlive
        // a real source disconnect. A preview or unrelated teardown closes.
        if (this._request !== request || request.cancelled || route() !== request.route ||
            !this.isConnected || !this._guard?.current(this._token,true)) return false;
        // The source is already disconnected when its lifecycle callback runs.
        // Validate the sent transaction using the live native owner, rather
        // than requiring that detached source to remain connected.
        request.transferred = true;
        if (!this._controller?.acceptsOwnRemount()) { request.transferred = false; return false; }
        request.sourceCurrent = null; // Release all references to the old source.
        return true;
      }
      closeDialog() {
        const request = this._request;
        if (!request) return true;
        this._request = null; request.cancelled = true; request.owner = null;
        request.sourceCurrent = null; request.card = null; request.connection = null; request.user = null;
        this._unsubscribe?.(); this._unsubscribe = null;
        for (const event of ['location-changed','popstate','hashchange']) win.removeEventListener(event,this._routeChanged);
        this._routeChanged = null;
        const guard = this._guard; this._guard = null; this._token = null;
        this._controller?.close(); // Retain the raw lane until actual settlement.
        guard?.dispose();
        this.dispatchEvent(new win.CustomEvent('dialog-closed',{detail:{dialog:tag},bubbles:true,composed:true}));
        return true;
      }
    });
  }
  let request = null;
  function close() {
    if (!request) return;
    request.cancelled = true;
    if (request.owner?._request === request) request.owner.closeDialog();
    request.sourceCurrent = null; request.card = null; request = null;
  }
  return {
    open() {
      if (request && !request.cancelled) return true;
      const hass = getHass();
      if (!hass || !host.isConnected) return false;
      const card = copy(getCardConfig());
      const known = ['custom:ha-storage-monitor'];
      if (!known.includes(card?.type) || !options.cardTypes.includes(card.type)) return false;
      const source = JSON.stringify(getSourceKey()), signature = JSON.stringify(card);
      const next = {card,route:route(),connection:hass.connection,user:hass.user.id,cancelled:false,transferred:false,owner:null,
        sourceCurrent:() => {
          const live = getHass();
          return host.isConnected && live?.connection === next.connection && live?.user?.id === next.user &&
            JSON.stringify(getCardConfig()) === signature && JSON.stringify(getSourceKey()) === source;
        }};
      request = next;
      host.dispatchEvent(new win.CustomEvent('show-dialog',{bubbles:true,composed:true,detail:{
        dialogTag:tag,dialogImport:() => Promise.resolve(),dialogParams:next,addHistory:false}}));
      return true;
    },
    close,destroy:close,
    update() {
      if (!request || request.cancelled) return;
      if (!request.transferred && !request.sourceCurrent()) close();
      else request.owner?._controller?.update();
    },
    sourceDisconnected() {
      if (request?.owner?.transfer(request)) return true;
      close(); return false;
    }
  };
}
// Lovelace save has no CAS: compare-before-save reduces, but cannot eliminate,
// the race with another editor between the final read and the native save.
function createDashboardPlacementV53({host, getHass, getCardConfig,
  cardTypes = ['custom:ha-storage-monitor'],
  getSourceKey = () => null, createGuard, nativeOwned = false, onClose = () => {}}) {
  if (!nativeOwned) {
    const native = createNativeDashboardPlacementV53({host,getHass,getCardConfig,getSourceKey,cardTypes,createGuard});
    if (native) return native;
  }
  const known = ['custom:ha-storage-monitor'];
  const allowed = known.filter(type => cardTypes.includes(type));
  const clone = value => JSON.parse(JSON.stringify(value));
  const key = value => JSON.stringify(value);
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const pathOK = path => path === null || typeof path === 'string' && /^[a-z0-9][a-z0-9_-]*$/.test(path);
  const titleId = 'ha-tools-placement-' + Math.random().toString(36).slice(2);
  let session = null, dialog = null, destroyed = false, running = false, queued = null, returnFocus = null;
  let cancelledWrite = false;
  const text = (en, pl) => String(getHass()?.locale?.language || getHass()?.language || 'en').startsWith('pl') ? pl : en;
  function identity() {
    const hass = getHass();
    if (!host.isConnected || hass?.connected === false || !hass?.connection || hass.connection.connected === false ||
        typeof hass.callWS !== 'function' || typeof hass.user?.id !== 'string' || !hass.user.id ||
        hass.user.is_admin !== true || hass.user.is_active === false) return null;
    const card = clone(getCardConfig());
    if (!object(card) || !allowed.includes(card.type)) return null;
    return {connection:hass.connection, user:hass.user.id, card, signature:key(card), source:key(getSourceKey())};
  }
  function current(s, intent = s?.intent) {
    if (!s || session !== s || destroyed || s.intent !== intent) return false;
    if (!dialog?.isConnected) { close(); return false; }
    let live;
    try { live = identity(); } catch (_) { live = null; }
    if (!live || live.connection !== s.connection || live.user !== s.user || live.signature !== s.signature || live.source !== s.source) {
      close(); // Purge private snapshots and detached previews on identity/source revocation.
      return false;
    }
    return true;
  }
  // Single raw operation lane, including reads. Replacement intent never starts
  // another operation while a previous promise is unsettled, even after close().
  function enqueue(task) { queued = task; pump(); }
  async function pump() {
    if (running || !queued || destroyed) return;
    const task = queued; queued = null; running = true; paint();
    try { await task(); } catch (_) { /* Tasks expose localized states, never raw backend/private errors. */ }
    finally { running = false; paint(); pump(); }
  }
  async function call(s, intent, type, extra = {}) {
    if (!current(s, intent)) throw Error('cancelled');
    const message = {type, ...extra};
    if (type !== 'lovelace/dashboards/list' && s.target !== null) message.url_path = s.target;
    // Native HA performs fresh require_admin authorization independently.
    let value;
    try { value = await getHass().callWS(message); }
    catch (error) {
      if (['unauthorized','not_allowed','forbidden'].includes(error?.code) && session === s) close();
      throw error;
    }
    if (!current(s, intent)) throw Error('cancelled');
    return value;
  }
  function read(s, intent) { return call(s, intent, 'lovelace/config', {force:true}); }
  function validateConfig(config) {
    if (!object(config) || !Array.isArray(config.views) && !object(config.strategy)) throw Error('invalid_config');
    return clone(config);
  }
  function destination(s) {
    const config = s.baseline, view = config?.views?.[s.view];
    if (!object(config) || config.strategy || !object(view) || view.strategy) return null;
    const type = view.type || (view.panel === true ? 'panel' : 'masonry');
    if (type === 'sections') {
      const section = view.sections?.[s.section];
      return object(section) && !section.strategy && section.type === 'grid' &&
        (section.cards === undefined || Array.isArray(section.cards)) ? ['views',s.view,'sections',s.section,'cards'] : null;
    }
    if (type !== 'masonry' && type !== 'panel' || view.cards !== undefined && !Array.isArray(view.cards)) return null;
    if (type === 'panel' && view.cards?.length) return null;
    return ['views',s.view,'cards'];
  }
  function candidate(s) {
    const path = destination(s);
    if (!path) throw Error('readonly');
    const result = clone(s.baseline);
    let parent = result;
    for (const segment of path.slice(0,-1)) parent = parent[segment];
    parent.cards = [...(parent.cards || []), clone(s.card)];
    return result;
  }
  function clearTarget(s) {
    s.baseline = null; s.tx = null; s.previewReady = false; s.blocked = false;
    s.view = 0; s.section = 0; s.status = 'select';
    dialog?.querySelector('[data-preview]')?.replaceChildren();
  }
  function selectDashboard(value) {
    const s = session;
    if (!current(s) || s.writing) return;
    s.intent++; clearTarget(s);
    const choice = s.dashboards[Number(value)];
    if (value === '' || !choice) { s.target = undefined; paint(); return; }
    s.target = choice.url_path;
    if (choice.mode !== 'storage') { s.status = 'readonly'; paint(); return; }
    const intent = s.intent; s.status = 'loading'; paint();
    enqueue(async () => {
      if (!current(s, intent)) return;
      try {
        const config = validateConfig(await read(s, intent));
        if (!current(s, intent)) return;
        s.baseline = config; s.status = 'ready'; chooseView(0);
      } catch (_) { if (current(s, intent)) { s.status = 'error'; paint(); } }
    });
  }
  function chooseView(value) {
    const s = session;
    if (!current(s) || s.writing || !s.baseline) return;
    s.intent++; s.view = Number(value); s.tx = null; s.blocked = false; s.status = 'ready';
    const sections = s.baseline.views?.[s.view]?.sections;
    s.section = Array.isArray(sections) ? sections.findIndex(section => section?.type === 'grid' && !section.strategy) : -1;
    preview(); paint();
  }
  function chooseSection(value) {
    const s = session;
    if (!current(s) || s.writing) return;
    s.intent++; s.section = Number(value); s.tx = null; s.blocked = false; s.status = 'ready'; preview(); paint();
  }
  function preview() {
    const s = session, area = dialog?.querySelector('[data-preview]');
    if (!current(s) || !area) return;
    area.replaceChildren(); s.previewReady = false;
    if (!destination(s)) { s.status = 'readonly'; return; }
    // The allowlist is intersected with the concrete Storage type. No user HTML,
    // YAML forms, guessed dialog imports, or arbitrary custom-element names.
    const name = s.card.type.slice(7);
    if (!host.ownerDocument.defaultView.customElements.get(name)) { s.status = 'previewerror'; return; }
    try {
      const card = host.ownerDocument.createElement(name);
      // Prevent interactions in the visual preview from invoking card actions.
      card.preview = true; card.inert = true; card.setAttribute('inert',''); card.setConfig(clone(s.card)); card.hass = getHass();
      area.append(card); s.previewReady = true;
    } catch (_) { area.replaceChildren(); s.status = 'previewerror'; }
  }
  async function confirm(s, intent) {
    const value = validateConfig(await read(s, intent));
    if (!current(s, intent)) return;
    const tx = s.tx;
    if (key(value) === key(tx.expected)) {
      s.baseline = clone(value); s.blocked = true;
      if (tx.undoing) { s.tx = null; s.status = 'undone'; }
      else { tx.confirmed = clone(value); s.status = 'confirmed'; }
    } else { s.status = 'unconfirmed'; s.blocked = true; }
  }
  function write(undoing) {
    const s = session;
    if (!current(s) || running || s.writing || !s.baseline || s.target === undefined) return;
    if (undoing ? !s.tx?.confirmed : s.blocked || !s.previewReady || !destination(s)) return;
    const intent = s.intent, expectedCurrent = clone(undoing ? s.tx.confirmed : s.baseline);
    const expected = clone(undoing ? s.tx.before : candidate(s));
    const before = clone(undoing ? s.tx.before : s.baseline);
    s.writing = true; s.status = 'saving'; paint();
    enqueue(async () => {
      try {
        const latest = validateConfig(await read(s, intent));
        if (!current(s, intent)) return;
        if (key(latest) !== key(expectedCurrent)) { s.blocked = true; s.tx = null; s.status = 'conflict'; return; }
        // Private backup is detached and bound to this session's user,
        // connection and target. No persistent storage or exports.
        s.tx = {before, expected, confirmed:null, undoing}; s.blocked = true;
        // Deliberate compare-before-save, NOT atomic compare-and-swap.
        // Call exactly once, even if the response is lost or rejected.
        try { await call(s, intent, 'lovelace/config/save', {config:clone(expected)}); }
        catch (_) { if (!current(s, intent)) return; }
        if (!current(s, intent)) return;
        s.status = 'unconfirmed';
        await confirm(s, intent); // Reconcile an uncertain ACK using a read only.
      } catch (_) { if (current(s, intent)) { s.blocked = true; s.status = s.tx ? 'unconfirmed' : 'error'; } }
      finally { if (current(s, intent)) { s.writing = false; paint(); } }
    });
  }
  function reconcile() {
    const s = session;
    if (!current(s) || running || s.writing || !s.tx || s.tx.confirmed) return;
    const intent = s.intent; s.status = 'loading';
    enqueue(async () => {
      try { await confirm(s, intent); }
      catch (_) { if (current(s, intent)) s.status = 'unconfirmed'; }
    });
  }
  const messages = {
    select: ['Choose an existing dashboard.', 'Wybierz istniejący dashboard.'],
    loading: ['Loading…', 'Wczytywanie…'],
    ready: ['Preview only. Add saves this card to the selected place.', 'To podgląd. Dodaj zapisze kartę w wybranym miejscu.'],
    saving: ['Saving once and checking the result…', 'Jednorazowy zapis i sprawdzanie wyniku…'],
    confirmed: ['Save confirmed. Undo is available while nobody changes this dashboard.', 'Zapis potwierdzony. Cofnij jest dostępne, dopóki nikt nie zmieni tego dashboardu.'],
    undone: ['Original configuration restored and confirmed.', 'Przywrócenie pierwotnej konfiguracji potwierdzone.'],
    conflict: ['Dashboard changed. Nothing was overwritten. Reopen to review the current version.', 'Dashboard zmienił się. Niczego nie nadpisano. Otwórz ponownie, aby sprawdzić bieżącą wersję.'],
    unconfirmed: ['Save unconfirmed. Do not repeat Add. Check the result using read only.', 'Zapis niepotwierdzony. Nie powtarzaj Dodaj. Sprawdź wynik przez sam odczyt.'],
    error: ['Cannot load or compare the dashboard. Reopen to review it.', 'Nie można wczytać lub porównać dashboardu. Otwórz ponownie, aby go sprawdzić.'],
    readonly: ['Read-only here: YAML, strategy, occupied Panel or unsupported layout. Use the native HA editor.', 'Tutaj tylko odczyt: YAML, strategia, zajęty Panel lub nieobsługiwany układ. Użyj natywnego edytora HA.'],
    previewerror: ['Card preview unavailable. Add is disabled.', 'Podgląd karty jest niedostępny. Dodaj jest wyłączone.']
  };
  function options(select, choices, value) {
    // Preserve focused native select nodes and avoid rebuilding their options on busy changes.
    const signature = key(choices);
    if (select._choices !== signature) {
      select.replaceChildren();
      for (const [id, label] of choices) {
        const option = host.ownerDocument.createElement('option'); option.value = id; option.textContent = label; select.append(option);
      }
      select._choices = signature;
    }
    select.value = String(value);
  }
  function paint() {
    const s = session;
    if (!s || !dialog || !current(s)) return;
    const q = selector => dialog.querySelector(selector);
    q('h2').textContent = text('Add to dashboard', 'Dodaj do dashboardu');
    q('[data-label-dashboard]').textContent = text('Dashboard', 'Dashboard');
    q('[data-label-view]').textContent = text('View', 'Widok'); q('[data-label-section]').textContent = text('Section', 'Sekcja');
    q('[data-preview-label]').textContent = text('Card preview (destination layout may resize it)', 'Podgląd karty (układ miejsca docelowego może zmienić rozmiar)');
    q('[data-limit]').textContent = (cancelledWrite ? text('A previous save was cancelled while pending and may have completed. Inspect the dashboard in HA before another Add. ', 'Poprzedni zapis anulowano w trakcie i mógł się zakończyć. Przed kolejnym Dodaj sprawdź dashboard w HA. ') : '') + text('You can undo this addition until this window closes.', 'Możesz cofnąć dodanie karty do zamknięcia tego okna.');
    q('[role=status]').textContent = text(...messages[s.status]);
    const selected = s.dashboards.findIndex(d => d.url_path === s.target);
    options(q('[data-dashboard]'), [['',text('Choose…','Wybierz…')],...s.dashboards.map((d,i)=>[String(i),d.title])], selected < 0 ? '' : selected);
    options(q('[data-view]'), (s.baseline?.views || []).map((v,i)=>[String(i),v.title || v.path || text(`View ${i+1}`,`Widok ${i+1}`)]), s.view);
    const sections = s.baseline?.views?.[s.view]?.sections;
    options(q('[data-section]'), Array.isArray(sections) ? sections.flatMap((v,i)=>v?.type === 'grid' && !v.strategy ? [[String(i),v.title || text(`Section ${i+1}`,`Sekcja ${i+1}`)]] : []) : [], s.section);
    q('[data-section-label]').hidden = !Array.isArray(sections);
    q('[data-dashboard]').disabled = s.writing || !s.dashboards.length;
    q('[data-view]').disabled = s.writing || !s.baseline;
    q('[data-section]').disabled = s.writing || !s.baseline;
    q('[data-add]').textContent = text('Add','Dodaj');
    q('[data-add]').disabled = running || s.writing || s.blocked || !s.previewReady || !destination(s);
    q('[data-undo]').textContent = text('Undo','Cofnij'); q('[data-undo]').disabled = running || s.writing || !s.tx?.confirmed;
    q('[data-reconcile]').textContent = text('Check result (read only)','Sprawdź wynik (tylko odczyt)');
    q('[data-reconcile]').hidden = !s.tx || !!s.tx.confirmed; q('[data-reconcile]').disabled = running || s.writing;
    q('[data-cancel]').textContent = text('Cancel','Anuluj');
    const native = q('[data-native]'); native.textContent = text('Open dashboard in Home Assistant','Otwórz dashboard w Home Assistant');
    native.hidden = s.target === undefined;
    native.setAttribute('href', s.target === undefined ? '/lovelace' : `/${s.target || 'lovelace'}`);
  }
  function mount() {
    dialog = host.ownerDocument.createElement('dialog');
    dialog.setAttribute('data-ha-tools-placement','');
    dialog.setAttribute('aria-labelledby',titleId);
    dialog.setAttribute('aria-describedby',titleId+'-limit');
    dialog.innerHTML = `<style>
dialog[data-ha-tools-placement]{box-sizing:border-box;width:min(640px,calc(100vw - 24px));max-height:calc(100dvh - 32px);overflow:auto;padding:20px;border:1px solid var(--divider-color,#888);border-radius:var(--ha-card-border-radius,12px);background:var(--card-background-color,#fff);color:var(--primary-text-color,#202124);font:14px/1.5 var(--paper-font-body1_-_font-family,system-ui)}dialog[data-ha-tools-placement]::backdrop{background:rgba(0,0,0,.45)}dialog[data-ha-tools-placement] h2{font-size:20px;margin:0 0 16px}dialog[data-ha-tools-placement] label{display:block;margin:12px 0}dialog[data-ha-tools-placement] select,dialog[data-ha-tools-placement] button,dialog[data-ha-tools-placement] a{box-sizing:border-box;min-height:44px;font:inherit}dialog[data-ha-tools-placement] select{width:100%;padding:8px;background:var(--secondary-background-color,#eee);color:inherit;border:1px solid var(--divider-color,#888);border-radius:8px}dialog[data-ha-tools-placement] button{padding:10px 16px;background:var(--secondary-background-color,#eee);color:inherit;border:1px solid var(--divider-color,#888);border-radius:8px;cursor:pointer}dialog[data-ha-tools-placement] button:disabled{opacity:.55;cursor:default}dialog[data-ha-tools-placement] [data-add]{background:var(--primary-color,#1565c0);color:var(--text-primary-color,#fff)}dialog[data-ha-tools-placement] button:focus-visible,dialog[data-ha-tools-placement] select:focus-visible,dialog[data-ha-tools-placement] a:focus-visible{outline:3px solid var(--primary-color,#1565c0);outline-offset:2px}dialog[data-ha-tools-placement] [data-actions]{display:flex;gap:8px;flex-wrap:wrap}dialog[data-ha-tools-placement] [data-preview]{max-width:100%;overflow:hidden}dialog[data-ha-tools-placement] [data-meta]{font-size:12px;color:var(--secondary-text-color,#555)}dialog[data-ha-tools-placement] a{display:inline-flex;align-items:center;color:var(--primary-color,#1565c0)}dialog[data-ha-tools-placement] [hidden]{display:none!important}
      </style><h2 id="${titleId}"></h2>
      <label><span data-label-dashboard></span><select data-dashboard></select></label>
      <label><span data-label-view></span><select data-view></select></label>
      <label data-section-label hidden><span data-label-section></span><select data-section></select></label>
      <p data-preview-label></p><div data-preview></div><p role="status" aria-live="polite"></p>
      <p data-meta data-limit id="${titleId}-limit"></p><a data-native hidden></a>
      <div data-actions><button type="button" data-add></button><button type="button" data-undo></button><button type="button" data-reconcile hidden></button><button type="button" data-cancel></button></div>`;
    dialog.querySelector('[data-dashboard]').addEventListener('change', e => selectDashboard(e.target.value));
    dialog.querySelector('[data-view]').addEventListener('change', e => chooseView(e.target.value));
    dialog.querySelector('[data-section]').addEventListener('change', e => chooseSection(e.target.value));
    dialog.querySelector('[data-add]').addEventListener('click', () => write(false));
    dialog.querySelector('[data-undo]').addEventListener('click', () => write(true));
    dialog.querySelector('[data-reconcile]').addEventListener('click', reconcile);
    dialog.querySelector('[data-cancel]').addEventListener('click', close);
    dialog.addEventListener('cancel', e => {e.preventDefault(); close();});
    dialog.addEventListener('close', () => { if (dialog && !dialog.open) close(); });
    host.append(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.open = true;
  }
  function open() {
    if (destroyed) return false;
    if (session && current(session)) { dialog.querySelector('[data-dashboard]').focus(); return true; }
    let token;
    try { token = identity(); } catch (_) { return false; }
    if (!token) return false;
    returnFocus = host.ownerDocument.activeElement;
    while (returnFocus?.shadowRoot?.activeElement) returnFocus = returnFocus.shadowRoot.activeElement;
    const s = {...token,intent:0,dashboards:[],target:undefined,baseline:null,tx:null,view:0,section:0,writing:false,blocked:false,previewReady:false,status:'loading'};
    session = s; mount(); paint();
    dialog.querySelector('[data-cancel]').focus();
    enqueue(async () => {
      if (!current(s)) return;
      const intent = s.intent;
      try {
        const result = await call(s, intent, 'lovelace/dashboards/list');
        if (!current(s, intent)) return;
        if (!Array.isArray(result)) throw Error('invalid_dashboards');
        const mode = getHass()?.panels?.lovelace?.config?.mode;
        const list = mode === 'storage' || mode === 'yaml' ? [{url_path:null,title:text('Default dashboard','Domyślny dashboard'),mode}] : [];
        for (const d of result) if (object(d) && typeof d.url_path === 'string' && pathOK(d.url_path) && !list.some(v=>v.url_path===d.url_path)) {
          list.push({url_path:d.url_path,title:typeof d.title === 'string' ? d.title : d.url_path,mode:d.mode});
        }
        s.dashboards = list; s.status = list.length ? 'select' : 'readonly';
      } catch (_) { if (current(s, intent)) s.status = 'error'; }
    });
    return true;
  }
  function close() {
    const old = session; session = null; queued = null;
    // In-flight promise cannot be cancelled at HA. The lane remains occupied
    // until it settles; its continuation cannot render, read or write again.
    if (old) { if (old.writing && old.tx) cancelledWrite = true; old.intent++; old.baseline = null; old.tx = null; old.card = null; old.dashboards = []; }
    const node = dialog; dialog = null; node?.remove();
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
    returnFocus = null;
    if (old) onClose();
  }
  function update() {
    if (!session || !current(session)) return;
    const card = dialog.querySelector('[data-preview]')?.firstElementChild;
    if (card) card.hass = getHass();
    paint();
  }
  function destroy() { close(); destroyed = true; }
  return {open,close,destroy,update,acceptsOwnRemount:() => !!session?.tx && current(session)};
}

// END STORAGE_DASHBOARD_PLACEMENT

class HAStorageMonitor extends HTMLElement {
  static get storageBackendSchemaVersion() { return 1; }
  static getConfigElement() { return document.createElement('ha-storage-monitor-editor'); }
  getCardSize() { return this._variant() === 'tile' ? 1 : this._variant() === 'compact' ? 3 : 6; }
  // Tabs and Supervisor data make the height dynamic. Omitting rows tells
  // Home Assistant Sections to follow the card's natural content height.
  getGridOptions() { return this._variant() === 'tile' ? {columns: 6, min_columns: 6, rows: 1} : {columns: 12, min_columns: 6}; }

  static getStubConfig() { return {type: 'custom:ha-storage-monitor', title: 'Storage Monitor', variant: 'compact', default_tab: 'trend'}; }
  constructor() {
    super();
    this._toolId = this.tagName.toLowerCase().replace('ha-', '');
    this.attachShadow({ mode: 'open' });
    // --- Throttle fields ---
    this._lastRenderTime = 0;
    this._renderScheduled = false;
    this._firstHassRender = false;
    // --- Pagination ---
    this._currentPage = {};
    this._pageSize = 15;
    this._hass = null;
    this._config = {};
    this._activeTab = 'overview';
    this._storageData = null;
    this._storageResult = 'not_checked';
    this._loading = true;
    this._expandedPaths = new Set();
    this._sortBy = 'size';
    this._lang = (navigator.language || '').startsWith('pl') ? 'pl' : 'en';
    this._sortAsc = false;
    this._lastHtml = '';
    this._lastDataFetch = 0;
    this._restoreTabState();
    this._initStorageHistory();
  }

  _label(en, pl) { return this._lang === 'pl' ? pl : en; }

  _copy(key) { return STORAGE_PRESENTATION_TEXT[this._lang === 'pl' ? 'pl' : 'en'][key] || key; }

  _categoryLabel(name) {
    const labels = { 'Backups': 'Kopie zapasowe', 'Database (Recorder)': 'Baza danych (Recorder)', 'Add-ons': 'Dodatki', 'Integrations': 'Integracje', 'System & Other': 'System i inne', 'Backup': 'Kopia zapasowa', 'Add-on': 'Dodatek', 'Database': 'Baza danych' };
    return this._lang === 'pl' ? (labels[name] || name) : name;
  }

  _sanitize(str) {
    if (!str) return str;
    try { return decodeURIComponent(escape(str)); } catch(e) { return str; }
  }
  set hass(hass) {
    try {
      const previousFormat = this._formatKey;
      this._formatKey = createFormatUi.forHass(hass).key;
      this.classList.toggle('bento-dark', hass?.themes?.darkMode === true);
      createUiV3({language: this._lang}).applyTheme(this);
    const previousLanguage = this._lang;
    const admin = hass?.user?.is_admin === true && hass.user.is_active !== false;
    const userId = hass?.user?.id;
    const authorityChanged = this._authorityAdmin !== admin || this._authorityUserId !== userId;
    this._hass = hass;
    if (authorityChanged) { this._nativeStatus = null; this._nativeSourceUuid = undefined; }
    this._authorityAdmin = admin;
    this._authorityUserId = userId;
    const storageContextChanged = this._syncStorageContext();
    this._syncTrendContext();
    const language = hass?.locale?.language || hass?.language;
    if (language) this._lang = language.startsWith('pl') ? 'pl' : 'en';
    if (this._detached) return;
    if (authorityChanged || storageContextChanged || !admin) {
      this._cleanupOpen = false;
      this._storageEpoch = (this._storageEpoch || 0) + 1;
      this._storageData = admin ? null : { permissionDenied: true };
      this._storageResult = 'not_checked';
      this._loading = admin && this._storageOnline();
      this._firstHassRender = false;
      this._doUpdateContent();
    }
    if (!hass) {
      this._doUpdateContent();
      return;
    }
    if (!admin || !this._storageOnline()) {
      this._loading = false;
      this._render();
      this._doUpdateContent();
      return;
    }
    const now = Date.now();
    if (!this._firstHassRender) {
      this._firstHassRender = true;
      this._lastDataFetch = now;
      this._loadStorageData();
      this._render();
      this._lastRenderTime = now;
      return;
    }
    if (previousLanguage !== this._lang || previousFormat !== this._formatKey) {
      this._render();
      this._doUpdateContent();
    }
    // Entity capacity follows current HA states, independently of Recorder refresh.
    if (this._hasCapacitySelection() && !this._usesNativeStorage()) {
      this._loadStorageData();
      this._doUpdateContent();
      return;
    }
    // Storage data doesn't change often - only re-fetch every 2 minutes
    if (now - (this._lastDataFetch || 0) > 120000) {
      this._lastDataFetch = now;
      this._loadStorageData();
    }
    // Throttle render to 30s — storage info is static
    if (now - (this._lastRenderTime || 0) < 30000) {
      return; // Skip render entirely — no need to re-render static storage info
    }
    this._lastRenderTime = now;
    this._render();
    } finally { this._publishFullView(); this._syncDashboardPlacementV53(); }
  }


  get _t() {
    const T = {
      pl: {
        title: 'Monitor Dysku',
        loading: 'Wczytywanie...',
        noData: 'Brak danych',
        error: 'Błąd',
        refresh: 'Odśwież',
        save: 'Zapisz',
        cancel: 'Anuluj',
        locale: 'pl-PL',
        addonSizeNote: 'Rozmiary addon\u00F3w mog\u0105 nie by\u0107 dost\u0119pne na wszystkich instalacjach HA.',
        sort: 'Sortuj:',
        size: 'Rozmiar',
        haConfig: 'Konfiguracja HA',
        staticFiles: 'Pliki statyczne (karty, zasoby)',
        hacsComponents: 'Komponenty HACS',
        haInternal: 'Wewn\u0119trzna baza HA',
        backups: 'Kopie zapasowe',
        addonData: 'Dane addon\u00F3w',
        sslCerts: 'Certyfikaty SSL',
        mediaFiles: 'Pliki multimedialne',
        sharedFolder: 'Wsp\u00F3\u0142dzielone',
        recorderDatabase: 'Baza danych Recorder',
        supervisorAccessRequired: 'Wymagane uprawnienia administratora',
        supervisorAccessRequiredDesc: 'Zaloguj się na konto administratora, aby wyświetlić informacje o dysku, dodatkach i kopiach zapasowych.',
        requiresSupervisor: 'Wymaga Home Assistant OS / Supervised',
        requiresSupervisorDesc: 'Storage Monitor wymaga Supervisor API do odczytu informacji o dysku, dodatkach i kopiach zapasowych. Zainstaluj HA OS lub HA Supervised.',
        addons: 'Dodatki',
        addon: 'Dodatek',
        version: 'Wersja',
        integrations: 'Integracje',
        integrationListUnavailable: 'Lista integracji niedostępna (uprawnienia lub API).',
        estStorage: 'Szacowany rozmiar',
        integration: 'Integracja',
        source: '\u0179r\u00F3d\u0142o',
        and: 'i',
        more: 'wi\u0119cej',
        noDataAvailable: 'Brak dost\u0119pu do danych',
        name: 'Nazwa',
        dataLimited: 'Dane ograniczone do dost\u0119pnego API',
        estBreakdown: 'Szacowany rozk\u0142ad. Rzeczywiste rozmiary mog\u0105 si\u0119 r\u00F3\u017Cni\u0107 od warto\u015Bci supervisor API.',
        disk: 'Dysk:',
        integrationsDetected: 'integracji wykrytych',
        addonsText: 'addon\u00F3w',
        description: 'Opis',
      },
      en: {
        title: 'Storage Monitor',
        loading: 'Loading...',
        noData: 'No data',
        error: 'Error',
        refresh: 'Refresh',
        save: 'Save',
        cancel: 'Cancel',
        locale: 'en-US',
        addonSizeNote: 'Addon disk sizes may not be available on all HA installations.',
        sort: 'Sort:',
        size: 'Size',
        haConfig: 'HA Configuration',
        staticFiles: 'Static files (cards, resources)',
        hacsComponents: 'HACS Components',
        haInternal: 'HA Internal storage',
        backups: 'Backups',
        addonData: 'Addon data',
        sslCerts: 'SSL certificates',
        mediaFiles: 'Media files',
        sharedFolder: 'Shared folder',
        recorderDatabase: 'Recorder database',
        supervisorAccessRequired: 'Administrator access required',
        supervisorAccessRequiredDesc: 'Sign in with an administrator account to view disk, add-on and backup information.',
        requiresSupervisor: 'Requires Home Assistant OS / Supervised',
        requiresSupervisorDesc: 'Storage Monitor requires the Supervisor API to read disk, addon, and backup information. Install HA OS or HA Supervised.',
        addons: 'Add-ons',
        addon: 'Addon',
        version: 'Version',
        integrations: 'Integrations',
        integrationListUnavailable: 'Integration list unavailable (permissions or API).',
        estStorage: 'Est. storage',
        integration: 'Integration',
        source: 'Source',
        and: 'and',
        more: 'more',
        noDataAvailable: 'No data available',
        name: 'Name',
        dataLimited: 'Data limited to available API',
        estBreakdown: 'Estimated breakdown. Actual sizes may differ from supervisor API values.',
        disk: 'Disk:',
        integrationsDetected: 'integrations detected',
        addonsText: 'addons',
        description: 'Description',
      },
    };
    return T[this._lang] || T.en;
  }

  setConfig(config) {
    config = config || {};
    const previousVariant = this._variant(), previousDefault = this._config.default_tab;
    this._config = {title: 'Storage Monitor', ...config};
    this._syncTrendContext();
    if (!this._configured || previousDefault !== config.default_tab) this._restoreTabState();
    this._configured = true;
    if (previousVariant !== this._variant()) this._closeFullView();
    this._lastHtml = '';
    if (this._hass) {
      if (this._syncStorageContext()) this._loadStorageData();
      this._render(); this._doUpdateContent(); this._publishFullView(); this._syncDashboardPlacementV53();
    }
  }

  _variant() {
    return ['tile', 'compact', 'full'].includes(this._config?.variant) ? this._config.variant : 'full';
  }

  _initStorageHistory() {
    this._trendDays = 7;
    this._trendView = 'chart';
    this._categoryView = 'chart';
    this._trendState = 'not_checked';
    this._trendResult = null;
    this._trendSelected = null;
    this._trendPage = 0;
    this._trendStale = false;
    this._trendEpoch = 0;
    this._trendWire = null;
    this._trendTimer = null;
    this._trendDeadlineMs = 15000;
    this._trendConnection = null;
    this._trendListenersBound = false;
    this._trendBrowserBound = false;
    this._trendReady = false;
    this._trendOnline = navigator.onLine !== false;
    this._trendReadyHandler = () => {
      this._storageDisconnectedConnection = null;
      this._trendReady = this._hass?.connection?.connected === true;
      this._cancelStorageHistory('not_checked', false);
      this._paintTrend();
    };
    this._trendDisconnectHandler = () => {
      this._storageDisconnectedConnection = this._hass?.connection;
      this._trendReady = false;
      this._cancelStorageHistory('offline', false);
      this._invalidateStorageRead();
      this._paintTrend();
    };
    this._trendOnlineHandler = () => {
      this._trendOnline = true;
      this._cancelStorageHistory('not_checked', false);
      this._paintTrend();
    };
    this._trendOfflineHandler = () => {
      this._trendOnline = false;
      this._cancelStorageHistory('offline', false);
      this._invalidateStorageRead();
      this._paintTrend();
    };
  }

  _usesNativeStorage() {
    if (this._config.data_source === 'legacy') return false;
    if (this._config.data_source === 'native') return true;
    return typeof this._config.backend_source === 'string' ||
      (!this._hasCapacitySelection() && this._hass?.config?.components?.includes('ha_storage_monitor'));
  }

  _nativeEntryId() {
    return this._config.backend_entry_id || this._nativeStatus?.entryId || undefined;
  }

  _nativeSourceChoice() {
    const choice = this._nativeSourceUuid || this._config.backend_source;
    return choice && choice !== 'auto' ? choice : undefined;
  }

  _nativeItem() {
    if (!this._nativeStatus) return null;
    try { return _StorageBackend.selectSource(this._nativeStatus, {sourceUuid: this._nativeSourceChoice()}); }
    catch (_) { return null; }
  }

  _nativeReason() {
    let reason = this._nativeError || this._nativeItem()?.error;
    const measured = this._nativeItem()?.current?.measured_at;
    if (!reason && Number.isFinite(measured) && (measured * 1000 > Date.now() || Date.now() - measured * 1000 > 3600000)) reason = 'stale';
    if (reason === 'source_selection_required') return this._label('Choose the filesystem to display.', 'Wybierz system plików do wyświetlenia.');
    if (reason === 'selected_source_missing') return this._label('The selected filesystem is unavailable. Choose a source explicitly.', 'Wybrany system plików jest niedostępny. Wybierz źródło ponownie.');
    if (reason === 'integration_required') return this._label('Install and configure the Storage Monitor integration in Home Assistant.', 'Zainstaluj i skonfiguruj integrację Storage Monitor w Home Assistant.');
    if (reason === 'stale') return this._label('The latest filesystem measurement is too old. Refresh to check the source.', 'Ostatni pomiar systemu plików jest zbyt stary. Odśwież, aby sprawdzić źródło.');
    if (reason === 'access_denied') return this._label('Home Assistant denied access. An active administrator is required.', 'Home Assistant odmówił dostępu. Wymagany jest aktywny administrator.');
    if (reason === 'timeout') return this._label('The read timed out. Wait for the pending request, then refresh.', 'Przekroczono czas odczytu. Poczekaj na zakończenie zapytania, potem odśwież.');
    if (reason) return this._label('The filesystem measurement is unavailable. Refresh to check again.', 'Pomiar systemu plików jest niedostępny. Odśwież, aby sprawdzić ponownie.');
    return this._label('Storage Monitor measurements · filesystems visible to the HA process. Category sizes are not measured.', 'Pomiary Storage Monitor · systemy plików widoczne dla procesu HA. Rozmiary kategorii nie są mierzone.');
  }

  _nativeForecastHtml(details = false) {
    if (!this._usesNativeStorage() || this._hass?.user?.is_admin !== true || !this._storageOnline()) return '';
    const item = this._nativeItem();
    let result = null;
    try { if (item) result = _StorageBackend.forecastView(item, {nowMs: Date.now()}); } catch (_) {}
    if (!result || result.fullInDays === null) {
      const reason = result?.reason;
      const message = ['insufficient_samples', 'insufficient_span', 'no_samples', 'awaiting_sample'].includes(reason) ?
        this._label('Collecting at least 24 hours of regular measurements.', 'Zbieranie co najmniej doby regularnych pomiarów.') :
        reason === 'nonpositive_growth' ? this._label('No stable positive growth was measured.', 'Nie zmierzono stałego dodatniego przyrostu.') :
        ['gap_too_long', 'low_coverage'].includes(reason) ? this._label('Not enough regular measurements.', 'Za mało regularnych pomiarów.') :
        reason === 'stale' ? this._label('The latest measurement is too old.', 'Ostatni pomiar jest zbyt stary.') :
        reason === 'future_clock' ? this._label('Check the clocks before forecasting.', 'Sprawdź zegary przed wyznaczeniem prognozy.') :
        this._label('No sufficient measurements for an estimate.', 'Brak wystarczających pomiarów do oszacowania.');
      return '<span data-native-forecast>' + this._label('Fill forecast: unknown', 'Prognoza zapełnienia: nieznana') +
        (details ? ' · ' + _esc(message) : '') + '</span>';
    }
    const format = this._formatUi();
    const value = result.fullInDays > 0 && result.fullInDays < 0.1 ?
      '< ' + format.number(0.1, {minimumFractionDigits: 1, maximumFractionDigits: 1}) :
      format.number(result.fullInDays, {maximumFractionDigits: 1});
    const label = '<span data-native-forecast>' + this._label('Estimated time to fill: ', 'Szacowany czas do zapełnienia: ') +
      _esc(value) + ' ' + this._label('days', 'dni') + ' · ' + this._label('limited estimate', 'szacunek z ograniczeniami') + '</span>';
    if (!details) return label;
    const raw = result.raw, coverage = raw.coverage;
    return label + '<details data-storage-details="forecast"><summary>' + this._label('Forecast details', 'Szczegóły prognozy') +
      '</summary><p>' + this._label('Observed samples: ', 'Zaobserwowane próbki: ') + _esc(format.number(result.sampleCount)) +
      ' · ' + this._label('observed window: ', 'zaobserwowane okno: ') +
      _esc(format.number(raw.window.observed_seconds / 86400, {maximumFractionDigits: 1})) + ' ' + this._label('days', 'dni') + '</p><p>' +
      this._label('Observed scheduled checks: ', 'Zaobserwowane planowe odczyty: ') +
      _esc(format.number(coverage.successful_slots)) + ' / ' + _esc(format.number(coverage.expected_slots)) + '</p><p>' +
      this._label('Measured growth: ', 'Zmierzony przyrost: ') + _esc(this._trendValue({bytes: result.growthBytesPerDay})) +
      ' / ' + this._label('day', 'dzień') + '</p><p>' +
      this._label('Linear estimate from available free space. Future usage can change; observation coverage does not prove constant usage between samples.',
        'Liniowy szacunek z dostępnego wolnego miejsca. Przyszłe użycie może się zmienić; pokrycie odczytów nie potwierdza stałego użycia pomiędzy próbkami.') +
      '</p>' + this._timeMarkup(result.measuredAt) + '</details>';
  }

  _syncNativeSurface() {
    const root = this.shadowRoot, target = root.querySelector('.card');
    let surface = root.querySelector('[data-storage-native-surface]');
    if (!target || !this._usesNativeStorage() || !this._storageOnline() || this._variant() !== 'full' ||
        this._hass?.user?.is_admin !== true || this._hass.user.is_active === false) { surface?.remove(); return; }
    if (!surface) {
      surface = this.ownerDocument.createElement('section');
      surface.dataset.storageNativeSurface = '';
      target.insertBefore(surface, target.firstChild);
    }
    const sources = this._nativeStatus?.sources || [], item = this._nativeItem();
    const selected = item?.source.source_uuid || this._nativeSourceChoice() || '';
    const html = '<p role="status">' + _esc(this._nativeReason()) + '</p>' +
      (sources.length ? '<label>' + this._label('Filesystem', 'System plików') +
        '<select data-storage-native-source style="min-height:44px;max-width:100%">' +
        '<option value="" ' + (!selected ? 'selected' : '') + '>' + this._label('Choose a filesystem', 'Wybierz system plików') + '</option>' +
        sources.map(row => '<option value="' + _esc(row.source.source_uuid) + '" ' +
          (row.source.source_uuid === selected ? 'selected' : '') + '>' + _esc(row.source.label) + '</option>').join('') +
        '</select></label>' : '') + '<div>' + this._nativeForecastHtml(true) + '</div>';
    if (surface._nativeHtml === html) return;
    const focused = surface.contains(root.activeElement);
    const detailsOpen = surface.querySelector('details')?.open;
    surface.innerHTML = html; surface._nativeHtml = html;
    if (detailsOpen && surface.querySelector('details')) surface.querySelector('details').open = true;
    const picker = surface.querySelector('[data-storage-native-source]');
    picker?.addEventListener('change', () => {
      const owner = this._sourceCard || this;
      if (!picker.value || owner._hass?.user?.is_admin !== true || !owner._storageOnline()) return;
      owner._nativeSourceUuid = picker.value;
      owner._storageData = null;
      owner._storageEpoch = (owner._storageEpoch || 0) + 1;
      owner._cancelStorageHistory();
      owner._storageContext = owner._storageContextKey();
      owner._syncTrendContext();
      owner._loadStorageData();
    });
    if (focused) picker?.focus({preventScroll: true});
  }

  _loadNativeStorageData() {
    if (this._nativeWire) return this._nativeWire;
    const hass = this._hass, connection = hass?.connection, userId = hass?.user?.id;
    if (!this.isConnected || this._detached || hass?.user?.is_admin !== true || hass.user.is_active === false || !this._storageOnline()) return Promise.resolve();
    let key = this._storageContextKey();
    const epoch = this._storageEpoch = (this._storageEpoch || 0) + 1;
    const current = () => this.isConnected && !this._detached && this._storageEpoch === epoch &&
      this._hass?.connection === connection && this._hass?.user?.id === userId && this._hass.user.is_admin === true &&
      this._hass.user.is_active !== false && this._storageOnline() && this._storageContextKey() === key;
    this._loading = true; this._storageResult = 'not_checked'; this._nativeError = null;
    const timer = setTimeout(() => {
      if (!current()) return;
      this._storageEpoch++; this._nativeStatus = null; this._storageData = null;
      this._nativeError = 'timeout'; this._storageResult = 'error'; this._loading = false;
      this._doUpdateContent();
    }, this._trendDeadlineMs);
    const pending = Promise.resolve().then(async () => {
      if (!current()) return;
      const request = {type: 'ha_storage_monitor/status'};
      const entry = this._nativeEntryId(); if (entry) request.entry_id = entry;
      const raw = await hass.callWS(request);
      if (!current()) return;
      const checked = _StorageBackend.validateStatus(raw, {entryId: entry, nowMs: Date.now()});
      if (!checked.entryId) throw new Error('missing_backend_entry_identity');
      let item = null, selectionError = null;
      try { item = _StorageBackend.selectSource(checked, {sourceUuid: this._nativeSourceChoice()}); }
      catch (error) { selectionError = error.message.split(':').at(-1); }
      this._nativeStatus = checked;
      this._nativeError = selectionError;
      this._storageData = item ? {..._StorageBackend.capacitySnapshot(item, {readAt: checked.readAt}),
        forecastView: _StorageBackend.forecastView(item, {nowMs: Date.now()})} : null;
      this._storageResult = Number.isFinite(this._storageData?.diskTotal) ? 'partial' : 'no_data';
      // Binding metadata became known in this response. Rebind the cache key
      // synchronously; a later HA update must not invalidate this same response.
      this._storageContext = key = this._storageContextKey();
      this._syncTrendContext();
    }).catch(error => {
      if (!current()) return;
      this._nativeStatus = null; this._storageData = null;
      this._nativeError = error?.code === 'unknown_command' ? 'integration_required' :
        error?.code === 'unauthorized' ? 'access_denied' : 'error';
      this._storageResult = 'error';
      this._storageContext = key = this._storageContextKey();
    }).finally(() => {
      clearTimeout(timer);
      if (this._nativeWire !== pending) return;
      this._nativeWire = null;
      if (current()) { this._loading = false; this._updateContent(); this._doUpdateContent(); }
    });
    this._nativeWire = pending;
    return pending;
  }

  _loadNativeStorageHistory() {
    if (this._trendWire) return this._trendWire;
    this._syncTrendContext();
    const unsupported = this._trendSupportState();
    if (unsupported) { this._cancelStorageHistory(unsupported); this._paintTrend(); return Promise.resolve(); }
    const item = this._nativeItem(), sourceUuid = item.source.source_uuid, bindingRevision = item.source.binding_revision;
    const hass = this._hass, connection = hass.connection, key = this._trendContextKey();
    const sourceKey = this._trendConfig().sourceKey, epoch = ++this._trendEpoch;
    const entryId = this._nativeEntryId(), days = this._trendDays === 30 ? 30 : 7;
    const current = () => this.isConnected && !this._detached && this._hass?.connection === connection &&
      this._hass?.user?.id === hass.user.id && this._hass.user.is_admin === true && this._hass.user.is_active !== false &&
      this._storageOnline() && this._trendEpoch === epoch && this._trendContextKey() === key;
    this._trendState = 'loading'; this._trendStale = Boolean(this._trendResult);
    this._trendTimer = setTimeout(() => { if (current()) { this._cancelStorageHistory('timeout', false); this._paintTrend(); } }, this._trendDeadlineMs);
    const pending = Promise.resolve().then(async () => {
      let complete = null, offset = 0, queries = 0;
      const rows = [];
      do {
        if (!current()) return;
        const raw = await hass.callWS({type: 'ha_storage_monitor/history', entry_id: entryId,
          source_uuid: sourceUuid, binding_revision: bindingRevision, days, offset, limit: 2400});
        if (!current()) return;
        // Validate every page before merging. The producer only appends/prunes;
        // identical endpoints/count/revision prove a stable immutable row set.
        _StorageBackend.projectHistory(raw, {entryId, sourceUuid, bindingRevision, sourceKey});
        if (raw.entry_id !== entryId || raw.binding_revision !== bindingRevision || raw.page_offset !== offset) throw new Error('history_identity_changed');
        if (!complete) complete = raw;
        else if (JSON.stringify([raw.observed_window, raw.total_rows, raw.last_success, raw.segments, raw.coverage]) !==
          JSON.stringify([complete.observed_window, complete.total_rows, complete.last_success, complete.segments, complete.coverage])) throw new Error('history_snapshot_changed');
        rows.push(...raw.rows); queries++;
        if (rows.length > 4096 || queries > 3 || raw.next_offset !== null && raw.next_offset <= offset) throw new Error('history_limit');
        offset = raw.next_offset;
      } while (offset !== null);
      if (!current()) return;
      const projection = _StorageBackend.projectHistory({...complete, rows, page_offset: 0,
        total_rows: rows.length, next_offset: null}, {entryId, sourceUuid, bindingRevision, sourceKey});
      this._trendResult = Object.freeze({...projection, queries, completedUntil: projection.end});
      this._trendState = !projection.rows.length ? 'no_data' : projection.capped ? 'partial' : 'loaded';
      this._trendSelected = projection.rows.length ? 0 : null; this._trendPage = 0; this._trendStale = false;
    }).catch(error => {
      if (!current()) return;
      this._cancelStorageHistory(error?.code === 'unauthorized' ? 'access_denied' :
        error?.code === 'unknown_command' ? 'unsupported' : 'error', error?.code === 'unauthorized');
    }).finally(() => {
      if (this._trendWire !== pending) return;
      this._trendWire = null;
      if (this._trendTimer !== null) clearTimeout(this._trendTimer);
      this._trendTimer = null;
      if (this.isConnected) this._paintTrend();
    });
    this._trendWire = pending; this._paintTrend(); return pending;
  }

  _trendConfig() {
    if (this._usesNativeStorage()) {
      const item = this._nativeItem(), source = item?.source;
      return {entityIds: [], scope: source?.label || this._label('HA process filesystem', 'System plików procesu HA'),
        valid: Boolean(source), sourceKey: JSON.stringify(['native', this._nativeEntryId(),
          source?.source_uuid || this._nativeSourceChoice(), source?.binding_revision])};
    }
    const c = this._config.measured_history || {};
    const entityIds = [c.used_entity, c.total_entity];
    const scope = typeof c.scope === 'string' ? c.scope.trim() : '';
    const valid = !!scope && c.same_filesystem === true &&
      entityIds.every(id => typeof id === 'string' && /^sensor\.[a-z0-9_]+$/.test(id)) && entityIds[0] !== entityIds[1] &&
      entityIds.every(id => {
        const state = this._hass?.states?.[id];
        return state?.attributes?.device_class === 'data_size' &&
          Object.hasOwn(STORAGE_HISTORY_UNITS, state.attributes.unit_of_measurement || '');
      });
    const sourceMetadata = entityIds.map(id => _storageSourceIdentity(this._hass?.states?.[id]?.attributes));
    return {entityIds, scope, valid, sourceKey: JSON.stringify([entityIds, scope, c.same_filesystem === true, sourceMetadata])};
  }

  _trendContextKey() {
    const hass = this._hass, c = this._trendConfig();
    return JSON.stringify([this._storageContextKey(), c.sourceKey, c.entityIds, c.scope, c.valid, this._config.measured_history?.same_filesystem,
      this._trendDays, hass?.user?.id, hass?.user?.is_admin === true, hass?.user?.is_active !== false,
      Array.isArray(hass?.user?.group_ids) ? [...hass.user.group_ids].sort() : [], hass?.config?.version,
      hass?.config?.components, c.entityIds.map(id => [hass?.states?.[id]?.attributes?.device_class,
        hass?.states?.[id]?.attributes?.unit_of_measurement])]);
  }

  _cancelStorageHistory(state = 'not_checked', clear = true) {
    this._trendEpoch++;
    if (this._trendTimer !== null) clearTimeout(this._trendTimer);
    this._trendTimer = null;
    this._trendState = state;
    if (clear) {
      this._trendResult = null;
      this._trendSelected = null;
      this._trendPage = 0;
      this._trendStale = false;
    } else this._trendStale = Boolean(this._trendResult);
    // A deadline/context cancellation does not cancel HA's callWS. The wire
    // stays occupied until settlement; no overlapping replacements or retries.
  }

  _bindTrendConnection() {
    const connection = this._hass?.connection || null;
    if (connection !== this._trendConnection) {
      if (this._trendConnection?.removeEventListener) {
        this._trendConnection.removeEventListener('ready', this._trendReadyHandler);
        this._trendConnection.removeEventListener('disconnected', this._trendDisconnectHandler);
      }
      if (this._trendConnection) this._cancelStorageHistory();
      this._trendListenersBound = false;
      this._trendConnection = connection;
      this._trendReady = connection?.connected === true;
    }
    // Separate connection identity from binding state: hass may predate mount.
    if (this.isConnected && connection?.addEventListener && !this._trendListenersBound) {
      connection.addEventListener('ready', this._trendReadyHandler);
      connection.addEventListener('disconnected', this._trendDisconnectHandler);
      this._trendListenersBound = true;
    }
    if (this.isConnected && !this._trendBrowserBound) {
      this._trendOnline = navigator.onLine !== false;
      window.addEventListener('online', this._trendOnlineHandler);
      window.addEventListener('offline', this._trendOfflineHandler);
      this._trendBrowserBound = true;
    }
  }

  _syncTrendContext() {
    const previous = this._trendEpoch;
    this._bindTrendConnection();
    const key = this._trendContextKey();
    if ((this._trendContext !== undefined && this._trendContext !== key) ||
        (this._trendCallWS !== undefined && this._trendCallWS !== this._hass?.callWS)) this._cancelStorageHistory();
    if (this._hass?.connection?.connected !== true && this._trendReady) {
      this._trendReady = false;
      this._cancelStorageHistory('offline', false);
    }
    this._trendCallWS = this._hass?.callWS;
    this._trendContext = key;
    if (previous !== this._trendEpoch) this._paintTrend();
  }

  _trendSupportState() {
    const hass = this._hass;
    if (hass?.user?.is_admin !== true || hass.user.is_active === false || !hass.user.id) return 'denied';
    if (!this.isConnected || this._detached || !this._trendOnline || navigator.onLine === false ||
        hass.connection?.connected !== true || !this._trendReady) return 'offline';
    if (this._usesNativeStorage()) return this._trendConfig().valid ? null : 'setup';
    const v = /^(\d{4})\.(\d{1,2})\.(\d+)(?:(b|rc)\d+)?$/.exec(hass.config?.version || '');
    const version = v ? +v[1] * 10000 + +v[2] * 100 + +v[3] : 0;
    if (!v || +v[2] < 1 || +v[2] > 12 || (version < 20240100 || version === 20240100 && v[4]) || typeof hass.callWS !== 'function' ||
        !Array.isArray(hass.config?.components) || !hass.config.components.includes('history') ||
        !hass.config.components.includes('recorder')) return 'unsupported';
    return this._trendConfig().valid ? null : 'setup';
  }

  _trendProject(raw, {start, end, entityIds, sourceKey = this._trendConfig().sourceKey}) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid_history_shape');
    const rows = [], missing = [], seen = new Set();
    let invalid = 0, inspected = 0, capped = false, orderIssues = 0;
    // Recorder lu is last_updated, not evidence of measurements between writes.
    // Retain metadata changes conservatively; presentation-only attributes do not identify a disk.
    const identity = _storageSourceIdentity;
    for (let index = 0; index < entityIds.length; index++) {
      const entityId = entityIds[index];
      if (Object.hasOwn(raw, entityId) && !Array.isArray(raw[entityId])) throw new Error('invalid_history_shape');
      const states = raw[entityId] || [];
      if (!states.length) { missing.push(entityId); continue; }
      if (inspected + states.length > 12000) { capped = true; break; }
      inspected += states.length;
      let previousTime = -Infinity, previous = null;
      const stream = [];
      for (const record of states) {
        if (typeof record?.lu !== 'number' || !Number.isFinite(record.lu) || !Number.isFinite(record.lu * 1000) ||
            record.lu * 1000 < start || record.lu * 1000 >= end || Math.abs(record.lu * 1000) > 8640000000000000) { invalid++; continue; }
        const time = Math.round(record.lu * 1000);
        if (time < start || time >= end) { invalid++; continue; }
        const attrs = record.a, unit = typeof attrs?.unit_of_measurement === 'string' ? attrs.unit_of_measurement : '';
        const state = typeof record.s === 'string' ? record.s : '';
        const bytes = _storageBytes(state, attrs), sourceIdentity = identity(attrs);
        const lastChangedSeconds = Object.hasOwn(record, 'lc') ? record.lc : record.lu;
        const invalidLastChanged = typeof lastChangedSeconds !== 'number' || !Number.isFinite(lastChangedSeconds) || lastChangedSeconds > record.lu;
        if (invalidLastChanged) invalid++;
        const attributeOnly = invalidLastChanged || lastChangedSeconds !== record.lu;
        const id = JSON.stringify([entityId, record.lu, lastChangedSeconds, state, unit, attrs?.device_class, sourceIdentity]);
        if (seen.has(id)) continue;
        seen.add(id);
        if (time < previousTime) orderIssues++;
        previousTime = time;
        if (bytes === null && !['unknown', 'unavailable'].includes(state)) invalid++;
        stream.push({id, entityId, sourceIdentity, sourceKey, time, recordedSeconds: record.lu,
          utc: new Date(time).toISOString(), kind: index === 0 ? 'used' : 'total', state, unit, bytes, lastChangedSeconds, attributeOnly});
      }
      stream.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
      const times = new Map();
      for (const row of stream) times.set(row.time, (times.get(row.time) || 0) + 1);
      for (const row of stream) {
        row.ambiguous = times.get(row.time) > 1;
        row.capacityChanged = index === 1 && row.bytes !== null && previous?.bytes !== null &&
          previous?.bytes !== undefined && row.bytes !== previous.bytes;
        row.sourceChanged = !!previous && row.sourceIdentity !== previous.sourceIdentity;
        row.unitChanged = !!previous && row.unit !== previous.unit;
        row.breakBefore = row.bytes === null || row.attributeOnly || row.ambiguous || row.sourceChanged || row.unitChanged || row.capacityChanged;
        previous = row;
        if (rows.length >= 2400) { capped = true; continue; }
        rows.push(Object.freeze(row));
      }
    }
    rows.sort((a, b) => a.time - b.time || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
    // A Recorder-only stream has singleton measurement segments. No tolerance,
    // carry-forward, synthetic range endpoints or inferred heartbeat is introduced.
    const series = ['used', 'total'].map(kind => {
      const points = rows.filter(row => row.kind === kind);
      const boundaries = [...new Set([start, ...points.map(row => row.time), end])].sort((a, b) => a - b);
      return Object.freeze({kind, segments: Object.freeze(points.filter(row => row.bytes !== null && !row.ambiguous && !row.attributeOnly)
        .map(row => Object.freeze({continuity: 'unknown', points: Object.freeze([row])}))),
        gaps: Object.freeze(boundaries.slice(1).map((to, i) => Object.freeze({from: boundaries[i], to, reason: 'unconfirmed_interval'})))});
    });
    return Object.freeze({rows: Object.freeze(rows), entityIds: Object.freeze([...entityIds]), sourceKey,
      series: Object.freeze(series), missing: Object.freeze(missing), start, end, invalid, inspected, capped,
      orderIssues, coverage: 'unknown', retention: 'unknown', continuity: 'unknown'});
  }

  _trendComparison(r) {
    const unavailable = reason => ({available: false, reason, count: 0});
    if (!r || !r.rows.length) return unavailable('comparisonMissing');
    if (r.sourceKey !== this._trendConfig().sourceKey || !this._trendConfig().valid) return unavailable('comparisonSource');
    if (r.orderIssues || r.invalid) return unavailable('comparisonOrder');
    let run = [], signature = null;
    const groups = new Map();
    for (const row of r.rows) {
      if (!groups.has(row.time)) groups.set(row.time, []);
      groups.get(row.time).push(row);
    }
    for (const [time, group] of groups) {
      const used = group.filter(row => row.kind === 'used'), total = group.filter(row => row.kind === 'total');
      // No previous capacity is silently treated as a measurement at a new time.
      if (used.length !== 1 || total.length !== 1 || group.some(row => row.bytes === null || row.ambiguous || row.attributeOnly) ||
          used[0].recordedSeconds !== total[0].recordedSeconds ||
          total[0].bytes <= 0 || used[0].bytes > total[0].bytes) {
        run = []; signature = null; continue;
      }
      const u = used[0], t = total[0];
      const next = JSON.stringify([r.sourceKey, u.entityId, t.entityId, u.unit, t.unit,
        u.sourceIdentity, t.sourceIdentity, t.bytes]);
      if (next !== signature || (run.length && time <= run.at(-1).time) ||
          group.some(row => row.sourceChanged || row.unitChanged || row.capacityChanged)) run = [];
      signature = next;
      run.push({time, used: u, total: t});
    }
    if (run.length < 3) return {...unavailable('comparisonMissing'), count: run.length};
    const first = run[0], last = run.at(-1);
    return Object.freeze({available: true, count: run.length, first, last,
      deltaBytes: last.used.bytes - first.used.bytes, capacityBytes: first.total.bytes,
      elapsedMs: last.time - first.time, coverage: 'unknown', period: 'available_fragment'});
  }

  _trendStepPath(segment, x, y) {
    // Renderer contract only. Recorder projection never asserts this evidence.
    // A future producer must prove every interval with source identity and validity.
    if (segment?.continuity !== 'confirmed_measurements' || !Array.isArray(segment.points) ||
        segment.points.length < 2 || !Array.isArray(segment.intervals) ||
        segment.intervals.length !== segment.points.length - 1) return '';
    const points = segment.points, first = points[0];
    if (!first.sourceKey || !Number.isFinite(first.capacityBytes) || first.capacityBytes <= 0) return '';
    if (points.some((row, index) => row.bytes === null || !Number.isFinite(row.bytes) || row.bytes < 0 || row.ambiguous || row.attributeOnly ||
        row.capacityBytes !== first.capacityBytes ||
        row.entityId !== first.entityId || row.kind !== first.kind || row.unit !== first.unit ||
        row.sourceKey !== first.sourceKey || row.sourceIdentity !== first.sourceIdentity ||
        (index > 0 && (row.time <= points[index - 1].time || row.breakBefore ||
          segment.intervals[index - 1]?.from !== points[index - 1].time ||
          segment.intervals[index - 1]?.to !== row.time ||
          segment.intervals[index - 1]?.confirmed !== true)))) return '';
    return 'M ' + x(first) + ' ' + y(first) + points.slice(1).map(row => ' H ' + x(row) + ' V ' + y(row)).join('');
  }

  _trendRecordedStatePath(segment, x, y, maximumGapMs) {
    // These connectors describe stored observations, not continuous disk usage.
    if (segment?.semantics !== 'last_recorded_state' || !Array.isArray(segment.points) ||
        segment.points.length < 2 || maximumGapMs !== 2700000) return '';
    const first = segment.points[0], points = segment.points;
    if (!first.backendSampleId || !first.backendSourceUuid || !first.sourceIdentity || !first.sourceKey ||
        !Number.isFinite(first.capacityBytes) || first.capacityBytes <= 0) return '';
    if (points.some((row, i) => !row.backendSampleId || row.backendSourceUuid !== first.backendSourceUuid ||
        row.sourceIdentity !== first.sourceIdentity || row.sourceKey !== first.sourceKey ||
        row.kind !== first.kind || row.unit !== 'B' || row.capacityBytes !== first.capacityBytes ||
        !Number.isFinite(row.time) || !Number.isFinite(row.bytes) || row.bytes < 0 || row.bytes > row.capacityBytes ||
        row.ambiguous || row.attributeOnly || (i > 0 && (row.breakBefore || row.time <= points[i - 1].time ||
          row.time - points[i - 1].time > maximumGapMs)))) return '';
    return 'M ' + x(first) + ' ' + y(first) + points.slice(1).map(row => ' H ' + x(row) + ' V ' + y(row)).join('');
  }

  _loadStorageHistory() {
    if (this._usesNativeStorage()) return this._loadNativeStorageHistory();
    if (this._trendWire) return this._trendWire;
    this._syncTrendContext();
    const unsupported = this._trendSupportState();
    if (unsupported) {
      this._cancelStorageHistory(unsupported, unsupported !== 'offline');
      this._paintTrend();
      return Promise.resolve();
    }
    const hass = this._hass, connection = hass.connection, callWS = hass.callWS;
    const key = this._trendContextKey(), epoch = ++this._trendEpoch;
    const end = Date.now(), start = end - (this._trendDays === 30 ? 30 : 7) * 86400000;
    const c = this._trendConfig();
    const entityIds = [...c.entityIds], scope = {start, end, entityIds, sourceKey: c.sourceKey};
    this._trendState = 'loading';
    this._trendStale = Boolean(this._trendResult);
    const current = () => this.isConnected && !this._detached && this._hass?.user?.is_admin === true && this._hass.user.is_active !== false &&
      this._hass?.connection === connection && this._hass?.callWS === callWS && connection.connected === true &&
      this._trendReady && this._trendOnline && navigator.onLine !== false &&
      this._trendEpoch === epoch && this._trendContextKey() === key;
    this._trendTimer = setTimeout(() => {
      if (current()) { this._cancelStorageHistory('timeout', false); this._paintTrend(); }
    }, this._trendDeadlineMs);
    const pending = Promise.resolve().then(async () => {
      const merged = Object.fromEntries(entityIds.map(id => [id, []]));
      let count = 0, queries = 0, rejected = 0, capped = false, completedUntil = start;
      for (let cursor = start; cursor < end; cursor += 86400000) {
        if (!current()) return;
        const sliceEnd = Math.min(end, cursor + 86400000);
        const response = await callWS.call(hass, {type: 'history/history_during_period',
          start_time: new Date(cursor - 1).toISOString(), end_time: new Date(sliceEnd).toISOString(), entity_ids: entityIds,
          include_start_time_state: false, significant_changes_only: false, minimal_response: false, no_attributes: false});
        if (!current()) return;
        if (!response || typeof response !== 'object' || Array.isArray(response)) throw new Error('invalid_history_shape');
        queries++;
        for (const id of entityIds) {
          if (!Object.hasOwn(response, id)) continue;
          if (!Array.isArray(response[id])) throw new Error('invalid_history_shape');
          if (count + response[id].length > 12000) { capped = true; break; }
          count += response[id].length;
          for (const record of response[id]) {
            // Keep malformed dates for the projector's invalid count, never
            // permit valid out-of-slice dates (or unselected entity buckets).
            if (typeof record?.lu === 'number' && Number.isFinite(record.lu) &&
                (record.lu * 1000 < cursor || record.lu * 1000 >= sliceEnd)) { rejected++; continue; }
            merged[id].push(record);
          }
        }
        const projection = this._trendProject(merged, scope);
        completedUntil = sliceEnd;
        if (capped || projection.capped || projection.rows.length >= 2400) { capped = true; break; }
      }
      if (!current()) return;
      const projection = this._trendProject(merged, scope);
      this._trendResult = Object.freeze({...projection, invalid: projection.invalid + rejected,
        capped: projection.capped || capped, queries, completedUntil});
      this._trendState = !this._trendResult.rows.length && !this._trendResult.capped && !this._trendResult.invalid ? 'no_data' :
        this._trendResult.capped || this._trendResult.invalid || this._trendResult.orderIssues || this._trendResult.missing.length ||
        this._trendResult.rows.some(row => row.bytes === null) ? 'partial' : 'loaded';
      this._trendSelected = this._trendResult.rows.length ? 0 : null;
      this._trendPage = 0;
      this._trendStale = false;
    }).catch(error => {
      if (!current()) return;
      // Only documented/general code categories, never raw messages or stacks.
      const state = error?.code === 'unauthorized' ? 'access_denied' : error?.code === 'unknown_command' ? 'unsupported' : 'error';
      this._cancelStorageHistory(state, state === 'access_denied');
    }).finally(() => {
      if (this._trendWire !== pending) return;
      this._trendWire = null;
      if (this._trendTimer !== null) clearTimeout(this._trendTimer);
      this._trendTimer = null;
      if (this.isConnected) this._paintTrend();
    });
    this._trendWire = pending;
    this._paintTrend();
    return pending;
  }

  _formatUi() { return createFormatUi.forHass(this._hass); }

  _trendZone() { return this._formatUi().timeZone; }

  _trendDate(time, exact = false) {
    if (!Number.isFinite(time)) return this._copy('timeUnknown');
    const f = this._formatUi();
    return exact ? f.pointLabel(time) : f.date(time, true) + ' ' + f.clock(time);
  }

  _timeMarkup(time) {
    if (!Number.isFinite(time)) return _esc(this._copy('timeUnknown'));
    return '<time datetime="' + _esc(new Date(time).toISOString()) + '" title="' +
      _esc(this._trendDate(time, true) + ' · ' + new Date(time).toISOString()) + '">' + _esc(this._trendDate(time)) + '</time>';
  }

  _trendValue(row) {
    if (row.bytes === null) return this._label('Missing measurement', 'Brak pomiaru');
    const gib = row.bytes / 2 ** 30;
    return `${new Intl.NumberFormat(this._t.locale, {maximumSignificantDigits: 4, notation: gib > 0 && gib < 0.001 ? 'scientific' : 'standard'}).format(gib)} GiB`;
  }

  _trendText(key) {
    if (this._usesNativeStorage()) {
      if (key === 'not_checked') return this._label('Refresh the measured Storage Monitor history.', 'Odśwież historię pomiarów Storage Monitor.');
      if (key === 'setup' || key === 'unsupported') return this._nativeReason();
      if (key === 'access_denied') return this._label('Home Assistant denied history access. Check administrator permissions.', 'Home Assistant odmówił dostępu do historii. Sprawdź uprawnienia administratora.');
    }
    const labels = {
      not_checked: ['Load Recorder history for the selected sources.', 'Pobierz historię Recorder wybranych źródeł.'],
      loading: ['Loading recorded measurements…', 'Pobieranie zapisanych pomiarów…'],
      loaded: ['Recorded measurements loaded; coverage remains unknown.', 'Pobrano zapisane pomiary; kompletność pozostaje nieznana.'],
      partial: ['Partial measurements: missing, invalid or capped records.', 'Częściowe pomiary: braki, nieprawidłowe rekordy lub limit.'],
      no_data: ['No recorded measurements returned. This does not prove full retention.', 'Nie zwrócono zapisanych pomiarów. To nie potwierdza pełnej retencji.'],
      access_denied: ['Home Assistant denied access to the selected Recorder history. Check permissions, then refresh explicitly.', 'Home Assistant odmówił dostępu do wybranej historii Recorder. Sprawdź uprawnienia, potem odśwież ręcznie.'],
      denied: ['Storage history requires a Home Assistant administrator.', 'Historia dysku wymaga administratora Home Assistant.'],
      unsupported: ['History requires Recorder/History and Core 2024.1 or newer. Check the configuration; retry explicitly.', 'Historia wymaga Recorder/History oraz Core 2024.1 lub nowszego. Sprawdź konfigurację; ponów ręcznie.'],
      setup: ['In the card editor, select existing used/capacity data-size sensors, name their filesystem and confirm the same scope. Sensors must already be recorded by Recorder.', 'W edytorze karty wybierz istniejące sensory rozmiaru: użycie/pojemność, nazwij filesystem i potwierdź wspólny zakres. Sensory muszą być już zapisywane przez Recorder.'],
      offline: ['Connection unavailable. Reconnect, then refresh explicitly.', 'Połączenie niedostępne. Połącz ponownie, a potem odśwież ręcznie.'],
      timeout: ['History deadline reached. Wait for the pending request to settle, then refresh.', 'Przekroczono czas pobierania. Poczekaj na zakończenie zapytania, potem odśwież.'],
      error: ['History request failed. Refresh to retry.', 'Pobieranie historii nie powiodło się. Odśwież, aby ponowić.'],
    };
    return (labels[key] || labels.not_checked)[this._lang === 'pl' ? 1 : 0];
  }

  _renderStorageHistory() {
    const support = this._trendSupportState(), state = support || this._trendState;
    const ui = createUiV3({language: this._lang});
    // A successful transport does not upgrade the measurement's quality to success.
    const resultState = state === 'loaded' || state === 'partial' || this._trendStale ? 'partial' :
      ['error', 'timeout', 'denied', 'access_denied'].includes(state) ? 'error' : state === 'no_data' ? 'no_data' : 'not_checked';
    const header = '<h3>' + this._copy('historyTitle') + '</h3>';
    if (state === 'denied') return '<section class="storage-history">' + header +
      '<p role="status">' + ui.statusHtml('not_checked') + ' ' + this._trendText('denied') + '</p></section>';
    const c = this._trendConfig(), r = this._trendResult;
    const source = c.valid && this._usesNativeStorage() ? '<p>' + _esc(c.scope) + ' · ' + this._label('Storage Monitor atomic samples', 'Atomowe próbki Storage Monitor') + '</p>' : c.valid ? '<p>' + this._copy('scopeConfirmed') + ': <strong>' + _esc(c.scope) +
      '</strong><br>' + this._copy('used') + ': <code>' + _esc(c.entityIds[0]) + '</code> · ' +
      this._copy('capacity') + ': <code>' + _esc(c.entityIds[1]) + '</code></p>' : '';
    const controls = '<div class="trend-controls"><label>' + this._label('Recorded range', 'Zakres historii') +
      '<select class="trend-range">' + [7, 30].map(days => '<option value="' + days + '" ' +
        (this._trendDays === days ? 'selected' : '') + '>' + days + ' ' + this._label('days', 'dni') + '</option>').join('') +
      '</select></label><button type="button" class="trend-load" ' + (support || this._trendWire ? 'disabled' : '') + '>' +
      this._label('Refresh history', 'Odśwież historię') + '</button></div>';
    const status = '<p class="trend-status" role="status" aria-live="polite">' + ui.statusHtml(resultState) + ' ' +
      this._trendText(state) + (this._trendStale ? ' ' + this._label('Previous result is stale.', 'Poprzedni wynik jest nieaktualny.') : '') + '</p>';
    const limits = r ? '<p>' + this._copy('records') + ': ' + r.rows.length + ' · ' +
      this._label('Missing sources', 'Źródła bez historii') + ': ' + r.missing.length + ' · ' +
      this._label('Invalid records', 'Błędne rekordy') + ': ' + r.invalid + ' · ' +
      this._label('Incorrect time order', 'Błędna kolejność czasu') + ': ' + (r.orderIssues || 0) + ' · ' +
      this._label('Client cap reached', 'Osiągnięty limit klienta') + ': ' +
      (r.capped ? this._label('yes', 'tak') : this._label('no', 'nie')) + ' · ' +
      this._label('Queries', 'Zapytania') + ': ' + (r.queries || 0) + '</p>' : '';
    const help = '<details class="storage-help" data-storage-details="history-help"><summary>' + this._copy('helpTitle') +
      '</summary>' + source + (this._usesNativeStorage() ? '<p>' + this._label(
        'Storage Monitor stores atomic filesystem samples every 30 minutes, for up to 30 days and 4096 samples per source. This chart displays at most the newest 1200 available samples. Restart, source changes and failed observations can break the history. Recorded-state steps do not prove physical continuity. Comparisons cover the available matching fragment, not necessarily the full selected period.',
        'Storage Monitor zapisuje atomowe próbki filesystemu co 30 minut, do 30 dni i 4096 próbek na źródło. Wykres pokazuje najwyżej ostatnie 1200 dostępnych próbek. Restart, zmiana źródła i błędy obserwacji mogą przerwać historię. Schodki zapisanych stanów nie dowodzą ciągłości fizycznej. Porównanie obejmuje dostępny zgodny fragment, niekoniecznie cały wybrany okres.') + '</p>' :
        ['historyHelp', 'retention', 'continuity', 'staircase', 'comparisonRule', 'limits', 'noForecast']
          .map(key => '<p>' + this._copy(key) + '</p>').join('')) + limits + '</details>';
    if (!r) return '<section class="storage-history">' + header + controls + status + help + '</section>';
    const views = '<div class="trend-controls" role="group" aria-label="' + this._label('History view', 'Widok historii') + '">' +
      ['chart', 'data'].map(view => '<button type="button" data-trend-view="' + view + '" aria-pressed="' +
        (this._trendView === view) + '">' + (view === 'chart' ? this._label('Chart', 'Wykres') : this._label('Data', 'Dane')) + '</button>').join('') + '</div>';
    const selected = r.rows[this._trendSelected];
    const detail = selected ? '<div class="trend-detail" aria-live="polite"><strong>' +
      this._copy(selected.kind === 'used' ? 'used' : 'capacity') + ': ' + _esc(this._trendValue(selected)) + '</strong>' +
      (selected.capacityChanged ? '<p>' + this._copy('capacityChanged') + '</p>' : '') +
      (selected.sourceChanged || selected.unitChanged ? '<p>' + this._copy('sourceChanged') + '</p>' : '') +
      (selected.ambiguous ? '<p>' + this._copy('ambiguous') + '</p>' : '') +
      (selected.attributeOnly ? '<p>' + this._copy('attributeUpdate') + '</p>' : '') +
      '<br>' + this._timeMarkup(selected.time) + '<details data-storage-details="measurement"><summary>' +
      this._copy('measurementDetails') + '</summary><p>' + _esc(this._trendDate(selected.time, true)) + ' · ' +
      _esc(selected.utc) + ' · lu: ' + _esc(selected.recordedSeconds) + ' · lc: ' + _esc(selected.lastChangedSeconds) + '</p><p><code>' + _esc(selected.backendSampleId || selected.entityId) + '</code> · ' + _esc(selected.state) + ' ' +
      _esc(selected.unit) + (selected.bytes !== null ? ' · ' + _esc(selected.bytes) + ' B' : '') + '</p></details></div>' : '';
    const stepping = r.rows.length ? '<div class="trend-controls"><button type="button" class="trend-prev-record" ' +
      (this._trendSelected === 0 ? 'disabled' : '') + '>' + this._label('Previous measurement', 'Poprzedni pomiar') +
      '</button><button type="button" class="trend-next-record" ' + (this._trendSelected === r.rows.length - 1 ? 'disabled' : '') + '>' +
      this._label('Next measurement', 'Następny pomiar') + '</button></div>' : '';
    return '<section class="storage-history">' + header + controls + status + this._renderTrendComparison(r) + views +
      (this._trendView === 'data' ? this._renderTrendData(r) : this._renderTrendChart(r)) + detail + stepping + help + '</section>';
  }

  _renderTrendComparison(r) {
    const comparison = this._trendComparison(r);
    const heading = '<h4>' + this._copy('comparison') + ' (' + this._trendDays + ' ' + this._label('days', 'dni') + ')</h4>';
    if (!comparison.available) return '<section class="trend-comparison" data-comparison="unavailable">' +
      heading + '<p>' + this._copy(comparison.reason) + '</p></section>';
    const {first, last, deltaBytes, capacityBytes, count} = comparison;
    const delta = (deltaBytes < 0 ? '−' : deltaBytes > 0 ? '+' : '') + this._trendValue({bytes: Math.abs(deltaBytes)});
    return '<section class="trend-comparison" data-comparison="available-fragment">' + heading + '<strong>' +
      this._copy('change') + ': ' + _esc(delta) + '</strong><p>' + this._copy('from') + ' ' + this._timeMarkup(first.time) +
      ' · ' + this._copy('to') + ' ' + this._timeMarkup(last.time) + '</p><p>' + this._copy('comparisonPartial') +
      '</p><details data-storage-details="comparison"><summary>' + this._copy('details') + '</summary><p>' +
      this._copy('comparisonPoints') + ': ' + count + ' · ' + this._copy('capacity') + ': ' + _esc(capacityBytes) +
      ' B</p><p>' + _esc(this._trendDate(first.time, true)) + ' · ' + _esc(first.used.utc) + '<br>' +
      _esc(this._trendDate(last.time, true)) + ' · ' + _esc(last.used.utc) + '</p><p>' +
      _esc(first.used.bytes) + ' B → ' + _esc(last.used.bytes) + ' B · ' + this._copy('change') + ': ' +
      _esc(deltaBytes) + ' B</p></details></section>';
  }

  _renderTrendChart(r) {
    const max = Math.max(1, ...r.rows.map(row => row.bytes === null ? 0 : row.bytes));
    const x = row => Math.max(0, Math.min(100, (row.time - r.start) / Math.max(1, r.end - r.start) * 100));
    const y = row => row.bytes === null ? 120 : 100 - row.bytes / max * 100;
    const series = (r.series || []).map(series => '<g data-trend-series="' + series.kind + '">' +
      series.gaps.map(gap => '<rect class="trend-unknown" x="' + x({time: gap.from}) + '" y="' +
        (series.kind === 'used' ? 0 : 50) + '" width="' + Math.max(0, x({time: gap.to}) - x({time: gap.from})) +
        '" height="50"/>').join('') +
      series.segments.map(segment => {
        const path = this._trendStepPath(segment, x, y);
        return path ? '<path class="trend-step trend-step-' + series.kind + '" d="' + path +
          '" fill="none" vector-effect="non-scaling-stroke"/>' : '';
      }).join('') + '</g>').join('');
    const recorded = (r.recordedStateSeries || []).map(series => series.segments.map(segment => {
      const path = this._trendRecordedStatePath(segment, x, y, r.recordedStateMaxGapMs);
      return path ? '<path class="trend-step trend-recorded-state trend-step-' + series.kind +
        '" data-recorded-state="last_recorded_state" d="' + path +
        '" fill="none" vector-effect="non-scaling-stroke"/>' : '';
    }).join('')).join('');
    const recordedNote = r.recordedStateSeries ? '<p class="trend-recorded-note">' + this._label(
      'Dashed steps: last recorded state between observations at most 45 minutes apart. Physical changes between samples are unknown; no line extends before the first or after the last sample.',
      'Przerywane schodki: ostatni zapisany stan między obserwacjami odległymi o najwyżej 45 minut. Zmiany fizyczne między próbkami są nieznane; linia nie wychodzi przed pierwszą ani za ostatnią próbkę.') + '</p>' : '';
    const marks = r.rows.map((row, i) => '<button type="button" class="trend-mark ' +
      (row.kind === 'total' ? 'trend-capacity' : '') + '" style="left:' + x(row) + '%;top:' + y(row) +
      '%" data-trend-row="' + i + '" aria-pressed="' + (this._trendSelected === i) + '" aria-label="' +
      _esc(this._copy(row.kind === 'used' ? 'used' : 'capacity') + ': ' + this._trendValue(row) + ', ' +
        this._trendDate(row.time, true) + ', ' + row.utc + (row.capacityChanged ? ', ' + this._copy('capacityChanged') : '')) +
      '">' + (row.bytes === null ? '×' : row.attributeOnly ? '◇' : row.capacityChanged ? 'Δ' : row.kind === 'total' ? '□' : '●') + '</button>').join('');
    return '<figure class="trend-figure"><figcaption>● ' + this._copy('used') + ' · □ ' + this._copy('capacity') +
      ' · × ' + this._copy('gaps') + ' · ◇ ' + this._copy('attributeUpdate') + ' · GiB<br><small>' + this._copy('unknownIntervals') +
      '</small></figcaption><div class="trend-plot"><span class="trend-axis-top">' +
      _esc(this._trendValue({bytes: max})) + '</span><span class="trend-axis-bottom">0 GiB</span>' +
      '<span class="trend-gap-label">' + this._copy('gaps') + '</span>' +
      '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + series +
      '<line x1="0" y1="100" x2="100" y2="100" stroke="currentColor" vector-effect="non-scaling-stroke"/>' +
      r.rows.filter(row => row.capacityChanged).map(row => '<line x1="' + x(row) + '" y1="0" x2="' + x(row) +
        '" y2="100" stroke="currentColor" stroke-dasharray="2 4" vector-effect="non-scaling-stroke"/>').join('') +
      recorded + '</svg>' + marks + '</div><div class="trend-dates"><span>' + _esc(this._trendDate(r.start)) +
      '</span><span>' + _esc(this._trendDate(r.end)) + '</span></div>' + recordedNote + '</figure>';
  }

  _renderTrendData(r) {
    const pages = Math.max(1, Math.ceil(r.rows.length / 50));
    this._trendPage = Math.max(0, Math.min(this._trendPage, pages - 1));
    return '<div class="trend-data"><table><caption>' + this._copy('records') + '</caption><thead><tr>' +
      ['time', 'series', 'value', 'rawBytes', 'source'].map(key => '<th scope="col">' + this._copy(key) + '</th>').join('') +
      '</tr></thead><tbody>' + r.rows.slice(this._trendPage * 50, this._trendPage * 50 + 50).map((row, index) =>
        '<tr><td><button type="button" data-trend-row="' + (this._trendPage * 50 + index) + '" aria-pressed="' +
        (this._trendSelected === this._trendPage * 50 + index) + '" aria-label="' +
        _esc(this._copy('measurementDetails') + ': ' + this._trendDate(row.time, true) + ' · ' + row.utc + ' · ' +
          this._copy(row.kind === 'used' ? 'used' : 'capacity')) + '">' + this._timeMarkup(row.time) +
        '</button></td><td>' + this._copy(row.kind === 'used' ? 'used' : 'capacity') + (row.capacityChanged ? ' · Δ' : '') +
        (row.sourceChanged || row.unitChanged ? '<br>' + this._copy('sourceChanged') : '') +
        (row.ambiguous ? '<br>' + this._copy('ambiguous') : '') +
        (row.attributeOnly ? '<br>' + this._copy('attributeUpdate') : '') + '</td><td>' + _esc(this._trendValue(row)) +
        '</td><td>' + (row.bytes === null ? this._copy('noData') : _esc(row.bytes) + ' B') + '<br>' +
        _esc(row.state) + ' ' + _esc(row.unit) + '</td><td><code>' + _esc(row.backendSampleId || row.entityId) + '</code></td></tr>').join('') +
      '</tbody></table></div><div class="trend-controls"><button type="button" class="trend-prev-page" ' +
      (this._trendPage === 0 ? 'disabled' : '') + '>' + this._label('Previous page', 'Poprzednia strona') +
      '</button><span>' + (this._trendPage + 1) + ' / ' + pages + '</span><button type="button" class="trend-next-page" ' +
      (this._trendPage === pages - 1 ? 'disabled' : '') + '>' + this._label('Next page', 'Następna strona') + '</button></div>';
  }

  _captureDetails(root) {
    return Array.from(root.querySelectorAll('[data-storage-details]'), node => ({
      key: node.dataset.storageDetails, open: node.open,
      focused: this.shadowRoot.activeElement === node.querySelector('summary')
    }));
  }

  _restoreDetails(root, details) {
    for (const node of root.querySelectorAll('[data-storage-details]')) {
      const saved = details.find(item => item.key === node.dataset.storageDetails);
      if (!saved) continue;
      node.open = saved.open;
      if (saved.focused) node.querySelector('summary')?.focus({preventScroll: true});
    }
  }


  _paintTrend() {
    const content = this.shadowRoot.getElementById('content');
    if (!content || this._activeTab !== 'trend' || this._cleanupOpen) return;
    const active = this.shadowRoot.activeElement;
    const focus = active?.dataset?.trendRow !== undefined ? `[data-trend-row="${active.dataset.trendRow}"]` :
      active?.dataset?.trendView ? `[data-trend-view="${active.dataset.trendView}"]` :
      active?.classList ? ['trend-load','trend-range','trend-prev-record','trend-next-record','trend-prev-page','trend-next-page'].find(name => active.classList.contains(name)) : null;
    const details = this._captureDetails(content);
    content.innerHTML = this._renderStorageHistory();
    this._restoreDetails(content, details);
    this._attachTrendEvents();
    if (focus) {
      const previous = content.querySelector(focus.startsWith('[') ? focus : '.' + focus);
      const target = previous && !previous.disabled ? previous :
        content.querySelector('[data-trend-row][aria-pressed="true"]') || content.querySelector('[data-trend-row]') || content.querySelector('.trend-range');
      target?.focus({preventScroll: true});
    }
  }

  _attachTrendEvents() {
    const root = this.shadowRoot;
    root.querySelector('.trend-load')?.addEventListener('click', () => this._loadStorageHistory());
    root.querySelector('.trend-range')?.addEventListener('change', event => {
      this._trendDays = event.target.value === '30' ? 30 : 7;
      this._cancelStorageHistory(); this._syncTrendContext(); this._paintTrend();
    });
    root.querySelectorAll('[data-trend-view]').forEach(button => button.addEventListener('click', () => {
      this._trendView = button.dataset.trendView === 'data' ? 'data' : 'chart'; this._paintTrend();
    }));
    root.querySelectorAll('[data-trend-row]').forEach(button => button.addEventListener('click', () => {
      this._trendSelected = Number(button.dataset.trendRow); this._paintTrend();
    }));
    const select = index => {
      const rows = this._trendResult?.rows || [];
      if (!rows.length) return;
      this._trendSelected = Math.max(0, Math.min(index, rows.length - 1));
      if (this._trendView === 'data') this._trendPage = Math.floor(this._trendSelected / 50);
      this._paintTrend();
    };
    root.querySelector('.trend-prev-record')?.addEventListener('click', () => select((this._trendSelected ?? 0) - 1));
    root.querySelector('.trend-next-record')?.addEventListener('click', () => select((this._trendSelected ?? -1) + 1));
    root.querySelector('.trend-prev-page')?.addEventListener('click', () => { this._trendPage--; this._paintTrend(); });
    root.querySelector('.trend-next-page')?.addEventListener('click', () => { this._trendPage++; this._paintTrend(); });
    root.querySelector('.storage-history')?.addEventListener('keydown', event => {
      if (event.target.matches?.('select,input')) return;
      const indices = {ArrowLeft: (this._trendSelected ?? 0) - 1, ArrowRight: (this._trendSelected ?? -1) + 1,
        Home: 0, End: (this._trendResult?.rows.length || 1) - 1};
      if (Object.hasOwn(indices, event.key)) { event.preventDefault(); select(indices[event.key]); }
    });
  }

  _categorySource(category) {
    if (category.sourceUnavailable) return this._label('Unavailable for the selected filesystem', 'Niedostępne dla wybranego filesystemu');
    if (category.name === 'Backups' || category.name === this._categoryLabel('Backups')) return 'Supervisor /backups · size_bytes';
    if (category.name === 'Add-ons' || category.name === this._categoryLabel('Add-ons')) return 'Supervisor /addons/<slug>/info · disk_usage';
    return this._label('No measured size source', 'Brak źródła zmierzonego rozmiaru');
  }

  _categorySize(mib) {
    if (mib >= 1024) return `${(mib / 1024).toFixed(1)} GiB`;
    if (mib >= 1) return `${mib.toFixed(1)} MiB`;
    if (mib >= 1 / 1024) return `${(mib * 1024).toFixed(0)} KiB`;
    return `${(mib * 2 ** 20).toFixed(0)} B`;
  }

  _renderCategoryData(d) {
    return `<div class="category-data">${d.categories.map(c => `<div class="category-data-row"><strong>${_esc(this._categoryLabel(c.name))}</strong><span>${c.measured === false ? this._label('Not measured', 'Nie zmierzono') : this._categorySize(c.size)} · ${c.measured === false ? '—' : _esc(c.size * 2 ** 20) + ' B'}${c.partial ? ' · ' + this._label('partial: some sizes unavailable', 'częściowo: brak części rozmiarów') : ''}</span><small>${_esc(this._categorySource(c))}</small></div>`).join('')}</div>`;
  }

  _storageContextKey() {
    const h = this._hass;
    return JSON.stringify([h?.user?.id, h?.user?.is_admin === true, h?.user?.is_active !== false,
      Array.isArray(h?.user?.group_ids) ? [...h.user.group_ids].sort() : [],
      h?.config?.instance_id, h?.config?.internal_url, h?.config?.external_url,
      h?.config?.location_name, h?.config?.version,
      this._config.backend_entry_id, this._config.backend_source, this._nativeSourceUuid,
      this._config.measured_history?.used_entity, this._config.measured_history?.total_entity,
      this._config.measured_history?.scope, this._config.measured_history?.same_filesystem,
      this._trendConfig().sourceKey]);
  }

  _storageOnline() {
    // Older HA/test clients omit connection; an explicit disconnected state is authoritative.
    return this._hass?.connection?.connected !== false &&
      !(this._storageDisconnectedConnection && this._storageDisconnectedConnection === this._hass?.connection) &&
      navigator.onLine !== false && this._trendOnline !== false;
  }

  _syncStorageContext() {
    const key = this._storageContextKey(), connection = this._hass?.connection;
    const online = this._storageOnline();
    const changed = this._storageContext !== undefined &&
      (key !== this._storageContext || connection !== this._storageConnection || online !== this._storageWasOnline);
    this._storageContext = key;
    this._storageConnection = connection;
    this._storageWasOnline = online;
    if (changed) this._invalidateStorageRead();
    return changed;
  }

  _invalidateStorageRead() {
    this._nativeStatus = null; this._nativeError = null;
    this._storageEpoch = (this._storageEpoch || 0) + 1;
    this._storageData = null;
    this._storageResult = 'not_checked';
    this._loading = false;
    this._firstHassRender = false;
    this._storageContext = this._storageContextKey();
    this._doUpdateContent();
  }

  _storageResultHtml() {
    const ui = createUiV3({ language: this._lang });
    const message = this._loading ? this._t.loading : !this._storageOnline() ?
      this._label('Connection unavailable. Reconnect, then refresh.', 'Połączenie niedostępne. Połącz ponownie, potem odśwież.') : '';
    return `<p role="status" aria-live="polite" data-storage-result="${this._storageResult || 'not_checked'}">${ui.statusHtml(this._storageResult)} ${_esc(message)}</p>`;
  }

  _hasCapacitySelection() {
    const c = this._config.measured_history;
    return Boolean(c && (c.used_entity || c.total_entity));
  }

  _entityCapacitySnapshot() {
    const c = this._trendConfig();
    const states = c.entityIds.map(id => this._hass?.states?.[id]);
    const [used, total] = states.map(state => _storageBytes(state?.state, state?.attributes));
    const valid = c.valid && used !== null && total > 0 && used <= total;
    const times = states.map(state => Date.parse(state?.last_updated || ''));
    return {
      source: 'ha_entities', scope: c.scope, sourceEntityIds: [...c.entityIds], unit: 'GB',
      sourceUnits: states.map(state => state?.attributes?.unit_of_measurement || null),
      sourceMeasuredAt: times.map(time => Number.isFinite(time) ? time : null),
      // Two independent source timestamps are retained; never invent a measurement time.
      measuredAt: times.every(Number.isFinite) ? Math.min(...times) : null,
      readAt: Date.now(), freeComputed: valid,
      diskTotal: valid ? total / 1e9 : null, diskUsed: valid ? used / 1e9 : null,
      diskFree: valid ? (total - used) / 1e9 : null,
      usedPercent: valid ? Math.round(used / total * 100) : null,
      categories: [
        {name: 'Backups', color: '#9c27b0', icon: '💾'},
        {name: 'Database (Recorder)', color: '#ff9800', icon: '🗄️'},
        {name: 'Add-ons', color: '#4caf50', icon: '🧩'},
        {name: 'Integrations', color: '#2196f3', icon: '🔌'},
        {name: 'System & Other', color: '#607d8b', icon: '🖥'}
      ].map(category => ({...category, size: 0, measured: false, sourceUnavailable: true})),
      addons: [], backups: [], integrations: [], addonsAvailable: false, backupsAvailable: false,
      integrationsAvailable: false, dbSizeMB: 0, totalAddonsMB: 0, totalBackupsMB: 0,
      addonCount: null, intCount: null, hostname: c.scope || 'N/A', osVersion: 'N/A'
    };
  }

  async _loadStorageData() {
    if (this._detached) return;
    if (this._sourceCard) { this._adoptSourceSnapshot(); return; }
    if (this._hass?.user?.is_admin !== true || this._hass.user.is_active === false) {
      this._storageResult = 'not_checked';
      this._storageData = { permissionDenied: true };
      this._loading = false;
      this._doUpdateContent();
      return;
    }
    this._syncStorageContext();
    if (!this._storageOnline()) { this._invalidateStorageRead(); return; }
    if (this._usesNativeStorage()) return this._loadNativeStorageData();
    if (this._hasCapacitySelection()) {
      this._storageEpoch = (this._storageEpoch || 0) + 1;
      this._storageData = this._entityCapacitySnapshot();
      this._storageResult = this._storageData.diskTotal === null ? 'no_data' : 'partial';
      this._loading = false;
      this._updateContent();
      return;
    }
    const requestHass = this._hass;
    const requestConnection = requestHass.connection;
    const requestContext = this._storageContextKey();
    const epoch = this._storageEpoch = (this._storageEpoch || 0) + 1;
    const current = () => !this._detached && this._storageEpoch === epoch &&
      this._hass?.user?.is_admin === true && this._hass.user.is_active !== false &&
      this._hass.connection === requestConnection && this._storageContextKey() === requestContext && this._storageOnline();
    const requestWS = requestHass.callWS.bind(requestHass);
    const callWS = async message => {
      if (!current()) throw new Error('Storage request no longer belongs to current administrator');
      const result = await requestWS(message);
      if (!current()) throw new Error('Storage request no longer belongs to current administrator');
      return result;
    };
    this._loading = true;
    this._storageResult = 'not_checked';
    this._updateContent();

    try {
      // Get host info for disk usage (requires Supervisor - HA OS / Supervised)
      let hostInfo = null, osInfo = null;
      let hostPermissionDenied = false, supervisorMissing = false;
      try { hostInfo = await callWS({ type: 'supervisor/api', endpoint: '/host/info', method: 'get' }); } catch(e) { hostPermissionDenied = e?.code === 'unauthorized'; supervisorMissing = e?.code === 'unknown_command'; }
      if (!current()) return;
      try { osInfo = await callWS({ type: 'supervisor/api', endpoint: '/os/info', method: 'get' }); } catch(e) { console.debug('[ha-storage-monitor] caught:', e); }
      if (!current()) return;
      if (!hostInfo || typeof hostInfo !== 'object' || Array.isArray(hostInfo)) {
        this._storageResult = supervisorMissing ? 'no_data' : 'error';
        this._storageData = hostPermissionDenied ? { permissionDenied: true } : supervisorMissing ? { noSupervisor: true } : { error: this._label('Supervisor data unavailable. Use Refresh to retry.', 'Dane Supervisor niedostępne. Użyj Odśwież, aby ponowić.') };
        this._loading = false;
        this._updateContent();
        return;
      }

      // Get addon info — try individual endpoints for size data
      let addons = [];
      let addonsAvailable = false, addonsMalformed = false;
      try {
        const addonList = await callWS({ type: 'supervisor/api', endpoint: '/addons', method: 'get' });
        const listedAddons = addonList?.addons ?? addonList?.data?.addons;
        if (!Array.isArray(listedAddons)) throw new TypeError('Unexpected add-on response');
        addons = listedAddons.filter(a => a && typeof a === 'object' && !Array.isArray(a) && typeof a.slug === 'string' && a.slug.length > 0);
        addonsMalformed = addons.length !== listedAddons.length;
        addonsAvailable = !addonsMalformed;
        // J3: Try to get detailed info for each addon (includes disk usage when available)
        const addonDetails = await Promise.allSettled(
          addons.filter(a => a.slug && a.state && a.state !== 'unknown').slice(0, 30).map(a =>
            callWS({ type: 'supervisor/api', endpoint: '/addons/' + a.slug + '/info', method: 'get' })
              .then(info => ({ slug: a.slug, ...(info?.data || info || {}) }))
          )
        );
        const detailMap = {};
        addonDetails.forEach(r => {
          if (r.status === 'fulfilled' && r.value?.slug) {
            detailMap[r.value.slug] = r.value;
          }
        });
        addons = addons.map(a => {
          const detail = detailMap[a.slug];
          if (detail) {
            return { ...a, disk_usage: detail.disk_usage !== undefined ? detail.disk_usage : null, apparmor: detail.apparmor, auto_update: detail.auto_update };
          }
          return a;
        });
      } catch(e) { console.warn('[Storage] Could not fetch addons:', e); }

      // Get backup info (supervisor endpoint has size/size_bytes)
      let backups = [];
      let backupsAvailable = false, backupsMalformed = false;
      try {
        const backupList = await callWS({ type: 'supervisor/api', endpoint: '/backups', method: 'get' });
        const listedBackups = backupList?.backups ?? backupList?.data?.backups;
        if (!Array.isArray(listedBackups)) throw new TypeError('Unexpected backup response');
        backups = listedBackups.filter(b => b && typeof b === 'object' && !Array.isArray(b) && (typeof b.slug === 'string' || typeof b.name === 'string'));
        backupsMalformed = backups.length !== listedBackups.length;
        backupsAvailable = !backupsMalformed;
      } catch(e) { console.warn('[Storage] Could not fetch backups:', e); }

      // Recorder info — current HA recorder/info API does NOT expose db size
      // Available fields: backlog, db_in_default_location, max_backlog, migration_in_progress, migration_is_live, recording, thread_running
      let dbSize = 0;
      let recorderMeta = {};
      try {
        recorderMeta = await callWS({ type: 'recorder/info' }) || {};
        // DB size unavailable from this endpoint — UI will show "N/A" when dbSize === 0
      } catch(e) { console.warn('[Storage] No recorder info:', e); }

      // API returns numbers directly (in GB), no .data wrapper
      const measurement = value => Number.isFinite(value) && value >= 0 ? value : null;
      const diskTotal = measurement(hostInfo?.disk_total ?? hostInfo?.data?.disk_total);
      const diskUsed = measurement(hostInfo?.disk_used ?? hostInfo?.data?.disk_used);
      const diskFree = measurement(hostInfo?.disk_free ?? hostInfo?.data?.disk_free);
      const hostname = hostInfo?.hostname || hostInfo?.data?.hostname || 'homeassistant';
      const os = hostInfo?.operating_system || hostInfo?.data?.operating_system || 'N/A';

      // Build storage breakdown
      // /addons already lists installed add-ons. An unknown runtime state
      // must not remove an installed item from the inventory or its count.
      const addonSizes = addons.map(a => {
        // disk_usage from Supervisor is in bytes.
        let sizeMB = 0;
        if (Number.isFinite(a.disk_usage) && a.disk_usage >= 0) {
          // Convert bytes to MB
          sizeMB = a.disk_usage / (1024 * 1024);
        }
        return {
          name: a.name || a.slug,
          slug: a.slug,
          size: sizeMB, // in MB; availability is explicit, including a measured zero
          measured: Number.isFinite(a.disk_usage) && a.disk_usage >= 0,
          icon: a.icon ? `/api/hassio/addons/${a.slug}/icon` : null,
          state: a.state,
          version: a.version
        };
      });

      // size_bytes is the unambiguous byte measurement; size has varied units.
      const backupSizes = backups.map(b => {
        const measured = Number.isFinite(b.size_bytes) && b.size_bytes >= 0;
        const sizeMB = measured ? b.size_bytes / (1024 * 1024) : 0;
        return {
          name: b.name || b.slug,
          slug: b.slug,
          size: sizeMB, // in MB
          measured,
          date: b.date,
          type: b.type,
          compressed: b.compressed
        };
      }).sort((a, b) => b.size - a.size);

      // All size calculations use MB as the standard unit
      const totalBackupsMB = backupSizes.reduce((s, b) => s + b.size, 0); // sum of backup sizes (all in MB)
      const dbSizeMB = dbSize > 0 ? (dbSize / (1024 * 1024)) : 0; // from bytes to MB (if available)
      
      // Config entries expose their count and setup state, but not disk usage
      // or whether their integration code came from HACS.
      let integrations = [];
      let integrationsAvailable = false;
      try {
        const cfgEntries = await callWS({ type: 'config_entries/get' });
        // API returns flat array directly, not wrapped object
        const parsedEntries = Array.isArray(cfgEntries) ? cfgEntries : (cfgEntries?.config_entries || cfgEntries?.data?.config_entries);
        if (!Array.isArray(parsedEntries)) throw new TypeError('Unexpected config entry response');
        integrations = parsedEntries.filter(e => e && typeof e === 'object' && !Array.isArray(e) && typeof e.domain === 'string');
        integrationsAvailable = integrations.length === parsedEntries.length;
      } catch(e) { console.debug('[Storage] Integration list unavailable:', e?.code || e?.name || 'unknown'); }
      const intCount = integrationsAvailable ? integrations.length : null;
      // Supervisor host usage cannot be allocated to these overlapping scopes.
      // Show only measured category sizes; do not invent a residual system size.
      const totalAddonsMB = addonSizes.reduce((s, a) => s + a.size, 0);

      if (!current()) return;
      // Completeness applies to supported measurements/inventories, never Recorder size.
      const hasData = diskTotal != null || diskUsed != null || diskFree != null ||
        addonSizes.length > 0 || backupSizes.length > 0 || integrations.length > 0;
      const complete = diskTotal > 0 && diskUsed != null && diskUsed <= diskTotal &&
        diskFree != null && diskFree <= diskTotal &&
        Boolean(osInfo?.version || osInfo?.data?.version) && addonsAvailable && backupsAvailable &&
        integrationsAvailable && addonSizes.every(a => a.measured) && backupSizes.every(b => b.measured);
      this._storageResult = complete ? 'success' : hasData ? 'partial' : 'no_data';
      this._storageData = {
        source: 'supervisor', scope: hostname, unit: 'GB', freeComputed: false,
        sourceEntityIds: [], diskTotal, diskUsed, diskFree,
        usedPercent: diskTotal > 0 && diskUsed != null ? Math.round((diskUsed / diskTotal) * 100) : null,
        categories: [
          { name: 'Backups', size: totalBackupsMB, color: '#9c27b0', icon: '\u{1F4BE}', items: backupSizes, measured: backupsAvailable && (backupSizes.length === 0 || backupSizes.some(b => b.measured)), partial: backupsMalformed || backupSizes.some(b => !b.measured) },
          { name: 'Database (Recorder)', size: 0, color: '#ff9800', icon: '\u{1F5C4}\uFE0F', measured: false },
          { name: 'Add-ons', size: totalAddonsMB, color: '#4caf50', icon: '\u{1F9E9}', items: addonSizes, measured: addonsAvailable && (addonSizes.length === 0 || addonSizes.some(a => a.measured)), partial: addonsMalformed || addonSizes.some(a => !a.measured) },
          { name: 'Integrations', size: 0, color: '#2196f3', icon: '\u{1F50C}', intCount: intCount, measured: false },
          { name: 'System & Other', size: 0, color: '#607d8b', icon: '\u{1F5A5}', measured: false },
        ],
        addonsAvailable, backupsAvailable, measuredAt: Date.now(),
        addons: addonSizes,
        backups: backupSizes,
        integrations: integrations,
        integrationsAvailable,
        dbSizeMB,
        totalAddonsMB,
        totalBackupsMB,
        addonCount: addonSizes.length,
        intCount: intCount,
        osVersion: osInfo?.version || osInfo?.data?.version || 'N/A',
        hostname: hostname
      };
    } catch (e) {
      if (!current()) return;
      console.error('[Storage Monitor] Error:', e);
      this._storageResult = 'error';
      this._storageData = { error: true };
    }

    if (!current()) return;
    this._loading = false;
    this._updateContent();
  }

  _parseSizeGB(str) {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    const n = parseFloat(str);
    if (str.includes('TB')) return n * 1024;
    if (str.includes('MB')) return n / 1024;
    return n;
  }

  _parseSizeMB(str) {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    const n = parseFloat(str);
    if (str.includes('GB')) return n * 1024;
    if (str.includes('KB')) return n / 1024;
    return n;
  }

  _fmtSize(mib) {
    // Supervisor byte adapters store these inventory values in MiB.
    return this._categorySize(mib);
  }

  _formatSizeFromBytes(bytes) {
    // Convert Supervisor bytes to the inventory's MiB representation.
    const mb = (bytes || 0) / (1024 * 1024);
    return this._fmtSize(mb);
  }

  _refreshStorageData() {
    const source = this._sourceCard || this;
    if (source._hass?.user?.is_admin !== true || source._hass.user.is_active === false || !source._storageOnline()) return;
    source._lastDataFetch = Date.now();
    return source._loadStorageData();
  }

  _adoptSourceSnapshot() {
    const source = this._sourceCard;
    if (!source || this._detached) return;
    const nativeAllowed = source._hass === this._hass && this._hass?.user?.is_admin === true && this._hass.user.is_active !== false && source._storageOnline();
    this._nativeStatus = nativeAllowed ? source._nativeStatus : null;
    this._nativeSourceUuid = nativeAllowed ? source._nativeSourceUuid : undefined;
    this._nativeError = nativeAllowed ? source._nativeError : null;
    const allowed = source._hass === this._hass && this._hass?.user?.is_admin === true &&
      this._hass.user.is_active !== false && source._storageOnline() &&
      source._storageContextKey() === this._storageContextKey();
    this._storageData = allowed ? source._storageData : this._hass?.user?.is_admin === true ? null : {permissionDenied: true};
    this._storageResult = allowed ? source._storageResult : 'not_checked';
    this._loading = allowed && source._loading;
    this._doUpdateContent();
  }

  _publishFullView() { this._fullView?.syncFromOwner(); }

  _closeFullView(restoreFocus = true) { this._fullView?.close(restoreFocus); }

  _placementIdentityV53() {
    this._placementGuardV53 ||= createTariffGuardV3({getHass:()=>this._hass,
      getContext:()=>({config:this._config,variant:this._placementVariantV53||'compact',route:location.pathname+location.search+location.hash}),browser:window});
    return this._placementGuardV53;
  }
  _placementAllowedV53() {
    if (!this.isConnected || this._detached || this.preview || this._sourceCard || this._variant() !== 'full' ||
        this._hass?.user?.is_admin !== true || !this._storageOnline()) return false;
    const guard=this._placementIdentityV53(),token=guard.snapshot();
    return guard.available(token) && guard.current(token,true);
  }
  _placementConfigV53() {
    const variant=this.shadowRoot.querySelector('[data-storage-dashboard-variant]')?.value||this._placementVariantV53||'compact';
    return JSON.parse(JSON.stringify({...this._config, ...(this._usesNativeStorage() ? {backend_entry_id:this._nativeEntryId(),backend_source:this._nativeSourceChoice()||'auto'} : {}),type:'custom:ha-storage-monitor',variant,default_tab:this._config.default_tab??'trend'}));
  }
  _stopPlacementV53() {
    if (!this._dashboardPlacementV53?.sourceDisconnected?.()) this._dashboardPlacementV53?.close();
    this._placementUnsubscribeV53?.();this._placementUnsubscribeV53=null;
    this._placementGuardV53?.dispose();this._placementGuardV53=null;
    this._dashboardPlacementMountV53?.remove();
  }
  _syncDashboardPlacementV53() {
    const root=this.shadowRoot;
    if (!this._placementAllowedV53()) {
      this._dashboardPlacementV53?.close();this._dashboardPlacementMountV53?.remove();
      root.querySelector('[data-storage-dashboard-footer]')?.remove();return;
    }
    const guard=this._placementIdentityV53();
    if (!this._placementUnsubscribeV53) this._placementUnsubscribeV53=guard.subscribe(()=>{
      this._dashboardPlacementV53?.close();this._syncDashboardPlacementV53();});
    let footer=root.querySelector('[data-storage-dashboard-footer]');
    if (!footer) {
      const card=root.querySelector('.card');if(!card)return;
      footer=this.ownerDocument.createElement('footer');footer.dataset.storageDashboardFooter='';
      const css=this.ownerDocument.createElement('style');
      css.textContent='[data-storage-dashboard-footer]{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 16px}[data-storage-dashboard-footer] button,[data-storage-dashboard-footer] select{min-width:44px;min-height:44px;max-width:100%;font:inherit;font-size:14px;color:var(--primary-text-color);background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:8px;padding:8px}[data-storage-dashboard-footer] :focus-visible{outline:3px solid var(--primary-color);outline-offset:2px}';
      const label=this.ownerDocument.createElement('label'),select=this.ownerDocument.createElement('select');
      select.dataset.storageDashboardVariant='';label.append(select);
      for (const value of ['tile','compact','full']) {const option=this.ownerDocument.createElement('option');option.value=value;option.textContent=value[0].toUpperCase()+value.slice(1);select.append(option);}
      select.value=this._placementVariantV53||'compact';
      select.addEventListener('change',()=>{this._placementVariantV53=select.value;this._placementGuardV53?.observe();});
      const button=this.ownerDocument.createElement('button');button.type='button';button.dataset.storageDashboardAdd='';
      button.addEventListener('click',()=>{
        if (!this._placementAllowedV53()) {this._syncDashboardPlacementV53();return;}
        this._dashboardPlacementMountV53 ||= this.ownerDocument.createElement('div');root.append(this._dashboardPlacementMountV53);
        this._dashboardPlacementV53 ||= createDashboardPlacementV53({host:this._dashboardPlacementMountV53,
          getHass:()=>this._placementAllowedV53()?this._hass:null,getCardConfig:()=>this._placementConfigV53(),
          getSourceKey:()=>this._placementIdentityV53().snapshot().epoch,createGuard:createTariffGuardV3,cardTypes:['custom:ha-storage-monitor']});
        this._dashboardPlacementV53.open();
      });
      footer.append(css,label,button);card.append(footer);
    }
    footer.querySelector('select').setAttribute('aria-label',this._label('Dashboard card variant','Wariant karty na dashboardzie'));
    footer.querySelector('[data-storage-dashboard-add]').textContent=this._label('Add to my dashboard','Dodaj do mojego dashboardu');
    if (this._dashboardPlacementMountV53 && !this._dashboardPlacementMountV53.isConnected) root.append(this._dashboardPlacementMountV53);
    this._dashboardPlacementV53?.update();
  }

  _openFullView() {
    if (!this.isConnected || this._fullView || !this._hass) return;
    const view = this.ownerDocument.createElement('ha-storage-monitor-full-view');
    this._fullView = view;
    this.shadowRoot.getElementById('storage-full-view-host')?.append(view);
    if (!view.isConnected) { this._fullView = null; return; }
    view.open(this, 'storage-open-full');
  }

  _smallState() {
    const admin = this._hass?.user?.is_admin === true && this._hass.user.is_active !== false;
    const d = admin && this._storageOnline() ? this._storageData : null;
    const nativeFresh = d?.source !== 'local_fs_samples' || Number.isFinite(d.measuredAt) && d.measuredAt <= Date.now() && Date.now() - d.measuredAt <= 3600000;
    const valid = d && nativeFresh && !d.permissionDenied && !d.error && !d.noSupervisor &&
      Number.isFinite(d.diskUsed) && Number.isFinite(d.diskTotal) && d.diskTotal > 0 &&
      d.diskUsed >= 0 && d.diskUsed <= d.diskTotal;
    const bytes = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? (value > 0 && value < 0.1 ? '< 0.1 GB' : this._formatUi().number(value, {maximumFractionDigits: 1, minimumFractionDigits: 1}) + ' GB') : this._copy('noData');
    const status = !admin ? 'not_checked' : !this._storageOnline() ? 'not_checked' :
      this._loading ? 'not_checked' : d?.permissionDenied || d?.error ? 'error' : valid ? 'partial' : 'no_data';
    const reason = !admin ? this._copy('admin') : !this._storageOnline() ? this._copy('offline') :
      this._loading ? this._copy('loading') : d?.permissionDenied ? this._copy('accessDenied') : d?.error ? this._copy('sourceError') : !valid ?
        (this._usesNativeStorage() ? this._nativeReason() : this._copy(this._hasCapacitySelection() ? 'invalidPair' : 'noSource')) :
        (this._usesNativeStorage() ? this._nativeReason() : this._copy(d.source === 'ha_entities' ? 'sourcePartial' : 'supervisorPartial'));
    const times = d?.source === 'ha_entities' && Array.isArray(d.sourceMeasuredAt) ? d.sourceMeasuredAt : Number.isFinite(d?.measuredAt) ? [d.measuredAt] : [];
    const identity = !admin ? '' : this._usesNativeStorage() ? d?.hostname || this._nativeItem()?.source.label || this._label('HA process filesystem', 'System plików procesu HA') : this._hasCapacitySelection() ? this._trendConfig().scope : d?.hostname || 'Supervisor';
    const qualityLabel = !admin || d?.permissionDenied ? this._copy('noAccess') : !this._storageOnline() ? this._copy('offlineShort') : createUiV3({language: this._lang}).status(status).label;
    return {d, valid, status, reason, times, identity, qualityLabel, used: valid ? bytes(d.diskUsed) : this._copy('noData'),
      free: valid ? bytes(d.diskFree) : this._copy('noData'), pct: valid && Number.isFinite(d.usedPercent) ? d.usedPercent : null};
  }

  _renderSmall() {
    _disconnectFamilyNavigation(this);
    const mode = this._variant(), s = this._smallState(), ui = createUiV3({language: this._lang});
    const title = this._config.title ?? this._t.title;
    const pct = s.pct === null ? this._copy('noData') : s.pct + '%';
    const forecast = this._storageData?.forecastView?.fullInDays;
    const severity = s.pct === null ? 'unknown' : s.pct >= 90 || Number.isFinite(forecast) && forecast < 30 ? 'critical' : s.pct >= 80 || Number.isFinite(forecast) && forecast < 60 ? 'warning' : 'normal';
    const nativeForecast = this._usesNativeStorage() ? this._nativeForecastHtml() : '';
    const forecastText = this.ownerDocument.createElement('span');
    forecastText.innerHTML = nativeForecast;
    const shortTimes = s.times.map(time => Number.isFinite(time) ? this._formatUi().clock(time) : this._copy('timeUnknown')).join(' / ');
    const exactTimes = s.times.map(time => Number.isFinite(time) ? this._trendDate(time, true) + ' · ' + new Date(time).toISOString() : this._copy('timeUnknown')).join(' / ');
    const accessible = [title, s.identity, this._copy('used') + ': ' + pct + ', ' + s.used,
      this._copy(s.d?.freeComputed ? 'freeComputed' : 'free') + ': ' + s.free, s.reason,
      forecastText.textContent, exactTimes, this._copy('openFull')].filter(Boolean).join('. ');
    const disabled = this._hass?.user?.is_admin !== true || this._hass.user.is_active === false || !this._storageOnline();
    const content = mode === 'tile'
      ? '<ha-card class="storage-tile"><button type="button" id="storage-open-full" class="storage-tile-button" aria-label="' +
        _esc(accessible) + '" title="' + _esc(accessible) + '"><span class="tile-title"><ha-icon icon="mdi:harddisk" aria-hidden="true"></ha-icon>' +
        '<span>' + _esc(title) + '</span><strong data-severity="' + severity + '">' + _esc(pct) + '</strong></span><span class="tile-free">' +
        this._copy(s.d?.freeComputed ? 'freeComputed' : 'free') + ': ' + _esc(s.free) +
        '</span><span class="tile-quality">' + (this._usesNativeStorage() ? _esc(s.identity) + ' · ' : '') +
        _esc(s.qualityLabel) + (nativeForecast ? ' · ' + nativeForecast : shortTimes ? ' · ' + _esc(shortTimes) : '') + '</span></button></ha-card>'
      : '<ha-card class="storage-compact"><header><ha-icon icon="mdi:harddisk" aria-hidden="true"></ha-icon><strong>' +
        _esc(title) + '</strong><span class="compact-pct" data-severity="' + severity + '">' + _esc(pct) + '</span></header>' +
        '<div class="compact-capacity" role="img" aria-label="' + _esc(this._copy('used') + ': ' + pct) + '"><span data-severity="' +
        severity + '" style="width:' + (s.pct ?? 0) + '%"></span></div><div class="compact-values"><span>' + this._copy('used') + ': ' +
        _esc(s.used) + '</span><span>' + this._copy(s.d?.freeComputed ? 'freeComputed' : 'free') + ': ' + _esc(s.free) +
        '</span></div><div class="compact-source" title="' + _esc(exactTimes) + '">' + _esc(s.identity) +
        (shortTimes ? ' · ' + _esc(shortTimes) : '') + '</div><p class="compact-quality" role="status">' + _esc(s.reason) +
        '</p>' + (nativeForecast ? '<p class="compact-native-forecast">' + nativeForecast + '</p>' : '') + '<div class="compact-actions"><button type="button" id="storage-open-full">' + this._copy('openFull') +
        '</button><button type="button" id="storage-small-refresh" class="storage-secondary" ' + (disabled ? 'disabled' : '') + '>' +
        this._copy('refresh') + '</button></div></ha-card>';
    let surface = this.shadowRoot.getElementById('storage-small-surface');
    const focused = surface?.contains(this.shadowRoot.activeElement) ? this.shadowRoot.activeElement?.id : null;
    if (!surface) {
      this.shadowRoot.innerHTML = '<style>' + ui.css + _FAMILY_CONTROL_CSS + STORAGE_PRESENTATION_CSS +
        '</style><div id="storage-small-surface"></div><div id="storage-full-view-host"></div>';
      surface = this.shadowRoot.getElementById('storage-small-surface');
      this._smallHtml = null;
    }
    if (this._smallHtml === content) return;
    this._smallHtml = content;
    surface.innerHTML = content;
    surface.querySelector('#storage-open-full')?.addEventListener('click', () => this._openFullView());
    surface.querySelector('#storage-small-refresh')?.addEventListener('click', () => this._refreshStorageData());
    if (focused) this.shadowRoot.getElementById(focused)?.focus({preventScroll: true});
  }

  _openCleanup() {
    if (this._hass?.user?.is_admin !== true || this._hass.user.is_active === false || !this._storageOnline()) return;
    this._cleanupOpen = true;
    this._legacyTab = null;
    this._doUpdateContent();
    this.shadowRoot.getElementById('closeCleanup')?.focus({preventScroll: true});
  }

  _renderCleanupAction(d) {
    return '<section aria-labelledby="cleanup-title"><div class="storage-action-heading"><h3 id="cleanup-title">' +
      this._copy('cleanup') + '</h3><button type="button" id="closeCleanup">' + this._copy('close') +
      '</button></div><p>' + this._copy('cleanupHelp') + '</p>' + this._renderCleanup(d) + '</section>';
  }

  _renderResources(d) {
    return '<details data-resources ' + (this._resourcesOpen ? 'open' : '') + '><summary>' + this._copy('topConsumers') +
      '</summary><p>' + this._copy('rankingScope') + '</p>' + this._renderTopConsumers(d) + '</details>' + this._renderFiles(d);
  }

  _renderSourceDetails(d) {
    if (d.source === 'local_fs_samples') return '<details class="storage-help" data-storage-details="source"><summary>' + this._copy('sourceDetails') + ': ' + _esc(d.hostname) + ' · ' + this._timeMarkup(d.measuredAt) + '</summary><p>' + _esc(this._nativeReason()) + '</p><p>' + this._label('Available free and reserved space are separate measurements from the same atomic sample.', 'Wolne dostępne i zarezerwowane miejsce są osobnymi wartościami z tej samej atomowej próbki.') + '</p><p>' + this._nativeForecastHtml() + '</p><p>' + this._copy('noCulprit') + '</p></details>';
    const entity = d.source === 'ha_entities';
    const times = entity ? d.sourceMeasuredAt : [d.measuredAt];
    const labels = entity ? d.sourceEntityIds : [this._label('Last successful read:', 'Ostatni udany odczyt:')];
    const source = entity ? d.scope : 'Home Assistant / Supervisor';
    return '<details class="storage-help" data-storage-details="source"><summary>' + this._copy('sourceDetails') +
      ': ' + _esc(source || this._copy('noData')) + ' · ' + times.map(time => this._timeMarkup(time)).join(' / ') + '</summary><p>' + this._copy(entity ? 'selectedHelp' : 'supervisorHelp') +
      '</p>' + (d.freeComputed ? '<p>' + this._copy('freeHelp') + '</p>' : '') +
      (entity && (d.diskTotal === null || d.diskUsed === null) ? '<p>' + this._copy('invalidPair') + '</p>' : '') +
      times.map((time, index) => '<p><code>' + _esc(labels[index]) + '</code> · ' +
        _esc(d.sourceUnits?.[index] || 'GB') + ' · ' + this._timeMarkup(time) +
        (Number.isFinite(time) ? '<br>' + _esc(this._trendDate(time, true)) + ' · ' + _esc(new Date(time).toISOString()) : '') + '</p>').join('') +
      '<p>' + this._copy('noCulprit') + '</p>' +
      (entity ? '<p>' + this._copy('rankingScope') + '</p>' : '<p>' + this._copy('serverRead') + '</p>') + '</details>';
  }


  _render() {
    if (!this._hass) return;
    if (this._variant() !== 'full') { this._renderSmall(); return; }
    const familyFocus = _rememberFamilyFocus(this);
    const html = `
      <style>${HA_STORAGE_MONITOR_BENTO_CSS}
${createUiV3({language:this._lang}).css}
${STORAGE_HISTORY_CSS}
/* === HA Tools split — premium banners (donate / intro / prereq) === */

/* Donation footer — diamond top */
.donate-section {  margin: 24px 0 4px; padding: 20px 24px; position: relative; overflow: hidden;  background: linear-gradient(135deg, rgba(99,102,241,0.06), rgba(236,72,153,0.06));  border: 1px solid rgba(99,102,241,0.18); border-radius: var(--bento-radius-md, 18px);  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px;  font-family: 'Inter', -apple-system, sans-serif;}
.donate-section:not([data-source="own-card"])::before {  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;  background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);}
.donate-section .donate-text { flex: 1; min-width: 240px; }
.donate-section h3 {  margin: 0 0 6px; font-size: 16px; font-weight: 700; letter-spacing: -0.02em;  background: linear-gradient(135deg, #6366f1, #ec4899);  -webkit-background-clip: text; background-clip: text; color: transparent;}
.donate-section p { margin: 0; font-size: 13px; line-height: 1.55; color: var(--bento-text-secondary, #57534e); letter-spacing: -0.005em; }
.donate-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
.donate-btn {  display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px;  border-radius: 12px; font-weight: 700; font-size: 13px; letter-spacing: -0.005em;  text-decoration: none; transition: transform 0.2s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s, filter 0.2s;  border: 1px solid transparent;}
.donate-btn:hover { transform: translateY(-2px); filter: brightness(1.05); }
.donate-btn.coffee {  background: linear-gradient(135deg, #FFDD00, #FFC700); color: #000;  box-shadow: 0 4px 14px -2px rgba(255, 221, 0, 0.4);}
.donate-btn.coffee:hover { box-shadow: 0 8px 24px -4px rgba(255, 221, 0, 0.55); }
.donate-btn.paypal {  background: linear-gradient(135deg, #0070ba, #005ea6); color: #fff;  box-shadow: 0 4px 14px -2px rgba(0, 112, 186, 0.45);}
.donate-btn.paypal:hover { box-shadow: 0 8px 24px -4px rgba(0, 112, 186, 0.6); }
:host(.bento-dark) .donate-section { background: linear-gradient(135deg, rgba(129,140,248,0.10), rgba(244,114,182,0.10)); border-color: rgba(129,140,248,0.25); }
:host(.bento-dark) .donate-section h3 { background: linear-gradient(135deg, #a5b4fc, #f9a8d4); -webkit-background-clip: text; background-clip: text; color: transparent; }
:host(.bento-dark) .donate-section p { color: #d6d3d1; }
@media (max-width: 600px) {  .donate-section { flex-direction: column; text-align: center; padding: 18px; }  .donate-buttons { justify-content: center; width: 100%; } }

/* Prereq banner — premium */
.prereq-banner {  display: flex; align-items: flex-start; gap: 14px; padding: 16px 20px;  border-radius: var(--bento-radius-sm, 12px); margin: 0 0 16px;  font-size: 13px; line-height: 1.55; border: 1px solid;  font-family: 'Inter', sans-serif; letter-spacing: -0.005em;  position: relative; overflow: hidden;}
.prereq-banner::before {  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;}
.prereq-banner.prereq-error { background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.25); color: #991b1b; }
.prereq-banner.prereq-error::before { background: linear-gradient(180deg, #ef4444, #f87171); }
.prereq-banner.prereq-info  { background: rgba(99,102,241,0.06); border-color: rgba(99,102,241,0.25); color: #4338ca; }
.prereq-banner.prereq-info::before  { background: linear-gradient(180deg, #6366f1, #8b5cf6); }
.prereq-banner .prereq-icon { font-size: 22px; line-height: 1; padding-top: 2px; flex-shrink: 0; }
.prereq-banner .prereq-text { flex: 1; min-width: 0; }
.prereq-banner .prereq-text strong { font-weight: 700; letter-spacing: -0.01em; }
.prereq-banner code {  background: rgba(0,0,0,0.06); padding: 1px 7px; border-radius: 5px;  font-size: 12px; font-family: 'JetBrains Mono', ui-monospace, monospace;  border: 1px solid rgba(0,0,0,0.08);}
.prereq-banner .prereq-cta {  display: inline-flex; align-items: center; padding: 8px 16px; border-radius: 10px;  background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff !important;  text-decoration: none; font-weight: 700; font-size: 12.5px; flex-shrink: 0;  letter-spacing: -0.005em;  box-shadow: 0 4px 14px -2px rgba(99,102,241,0.45);  transition: all 0.2s cubic-bezier(0.4,0,0.2,1);}
.prereq-banner .prereq-cta:hover { transform: translateY(-1px); box-shadow: 0 8px 24px -4px rgba(99,102,241,0.6); }
:host(.bento-dark) .prereq-banner.prereq-error { background: rgba(248,113,113,0.10); border-color: rgba(248,113,113,0.30); color: #fca5a5; }
:host(.bento-dark) .prereq-banner.prereq-info { background: rgba(129,140,248,0.10); border-color: rgba(129,140,248,0.30); color: #c7d2fe; }
:host(.bento-dark) .prereq-banner code { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.10); }
@media (max-width: 600px) {  .prereq-banner { flex-direction: column; align-items: stretch; padding-left: 20px; }  .prereq-banner .prereq-cta { align-self: flex-start; } }

/* First-run intro banner — premium */
.intro-banner {  position: relative; padding: 18px 52px 18px 22px; margin: 0 0 18px;  background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(236,72,153,0.06));  border: 1px solid rgba(99,102,241,0.20);  border-radius: var(--bento-radius-sm, 12px);  font-size: 13px; line-height: 1.55; overflow: hidden;  font-family: 'Inter', sans-serif; letter-spacing: -0.005em;  animation: bentoSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);}
.intro-banner::before {  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;  background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);}
.intro-banner .intro-headline {  font-weight: 700; font-size: 14.5px; margin-bottom: 10px; letter-spacing: -0.02em;  background: linear-gradient(135deg, #6366f1, #ec4899);  -webkit-background-clip: text; background-clip: text; color: transparent;  display: flex; align-items: center; gap: 8px;}
.intro-banner .intro-steps {  margin: 8px 0 0; padding: 0; list-style: none; counter-reset: introstep;}
.intro-banner .intro-steps li {  margin-bottom: 8px; line-height: 1.55; color: var(--bento-text, #0c0a09);  padding-left: 32px; position: relative; counter-increment: introstep;  font-size: 12.5px;}
.intro-banner .intro-steps li::before {  content: counter(introstep); position: absolute; left: 0; top: -1px;  width: 22px; height: 22px; border-radius: 50%;  background: var(--bento-card, #fff); border: 1px solid rgba(99,102,241,0.25);  display: flex; align-items: center; justify-content: center;  font-size: 11px; font-weight: 800; color: #6366f1;  font-family: 'JetBrains Mono', ui-monospace, monospace;  font-feature-settings: 'tnum' 1;}
.intro-banner .intro-dismiss {  position: absolute; top: 12px; right: 14px;  background: var(--bento-card, transparent); border: 1px solid var(--bento-border, transparent);  cursor: pointer; font-size: 14px; line-height: 1;  color: var(--bento-text-secondary, #64748B);  padding: 4px 8px; border-radius: 999px;  transition: all 0.15s ease;}
.intro-banner .intro-dismiss:hover {  background: var(--bento-bg-2, #e7e5e4); color: var(--bento-text, #0c0a09);  transform: rotate(90deg);}
:host(.bento-dark) .intro-banner { background: linear-gradient(135deg, rgba(129,140,248,0.14), rgba(244,114,182,0.10)); border-color: rgba(129,140,248,0.30); }
:host(.bento-dark) .intro-banner .intro-headline { background: linear-gradient(135deg, #a5b4fc, #f9a8d4); -webkit-background-clip: text; background-clip: text; color: transparent; }
:host(.bento-dark) .intro-banner .intro-steps li { color: #fafaf9; }
:host(.bento-dark) .intro-banner .intro-steps li::before { background: #16161f; border-color: rgba(129,140,248,0.35); color: #a5b4fc; }
:host(.bento-dark) .intro-banner .intro-dismiss { background: #16161f; border-color: #27272f; color: #d6d3d1; }
:host(.bento-dark) .intro-banner .intro-dismiss:hover { background: #27272f; color: #fafaf9; }


/* ===== BENTO LIGHT MODE DESIGN SYSTEM ===== */

:host {
  --bento-primary: #3B82F6;
  --bento-primary-hover: #2563EB;
  --bento-primary-light: rgba(59, 130, 246, 0.08);
  --bento-success: #10B981;
  --bento-success-light: rgba(16, 185, 129, 0.08);
  --bento-error: #EF4444;
  --bento-error-light: rgba(239, 68, 68, 0.08);
  --bento-warning: #F59E0B;
  --bento-warning-light: rgba(245, 158, 11, 0.08);
  --bento-bg: var(--primary-background-color, #F8FAFC);
  --bento-card: var(--card-background-color, #FFFFFF);
  --bento-border: var(--divider-color, #E2E8F0);
  --bento-text: var(--primary-text-color, #1E293B);
  --bento-text-secondary: var(--secondary-text-color, #64748B);
  --bento-text-muted: var(--disabled-text-color, #94A3B8);
  --bento-radius-xs: 6px;
  --bento-radius-sm: 10px;
  --bento-radius-md: 16px;
  --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
  --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04);
  --bento-shadow-lg: 0 8px 25px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.04);
  --bento-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* Card */
.card, .ha-card, ha-card, .main-card, .exporter-card, .security-card, .reports-card, .card, .chore-card, .cry-card, .backup-card, .network-card, .sentence-card, .energy-card, .panel-card {
  background: var(--bento-card) !important;
  border: 1px solid var(--bento-border) !important;
  border-radius: var(--bento-radius-md) !important;
  box-shadow: var(--bento-shadow-sm) !important;
  font-family: 'Inter', sans-serif !important;
  color: var(--bento-text) !important;
  overflow: visible;
  padding: 20px;
}

/* Headers */
.card-header, .header, .card-title, h1, h2, h3 {
  color: var(--bento-text) !important;
  font-family: 'Inter', sans-serif !important;
}
.card-header, .header {
  border-bottom: 1px solid var(--bento-border) !important;
  padding-bottom: 12px !important;
  margin-bottom: 16px !important;
}

/* Tabs */
.tabs, .tab-bar, .tab-nav, .tab-header {
  display: flex;
  gap: 4px;
  border-bottom: 2px solid var(--bento-border);
  padding: 0 4px;
  margin-bottom: 20px;
  overflow-x: auto;
}
.tab, .tab-btn, .tab-button {
  padding: 10px 18px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  color: var(--bento-text-secondary);
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: var(--bento-transition);
  white-space: nowrap;
  border-radius: 0;
}
.tab:hover, .tab-btn:hover, .tab-btn:hover {
  color: var(--bento-primary);
  background: var(--bento-primary-light);
}
.tab.active, .tab-btn.active, .tab-btn.active {
  color: var(--bento-primary);
  border-bottom-color: var(--bento-primary);
  background: rgba(59, 130, 246, 0.04);
  font-weight: 600;
}

/* Tab content */
.tab-content { display: none; }
.tab-content.active { display: block; animation: bentoFadeIn 0.3s ease-out; }
@keyframes bentoFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

/* Buttons */
button, .btn, .action-btn {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--bento-radius-xs);
  transition: var(--bento-transition);
  cursor: pointer;
}
button.active, .btn.active, .btn-primary, .action-btn.active {
  background: var(--bento-primary) !important;
  color: white !important;
  border-color: var(--bento-primary) !important;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
}

/* Status badges */
.badge, .status-badge, .tag, .chip {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.badge-success, .status-ok, .status-good { background: var(--bento-success-light); color: var(--bento-success); }
.badge-error, .status-error, .status-critical { background: var(--bento-error-light); color: var(--bento-error); }
.badge-warning, .status-warning { background: var(--bento-warning-light); color: var(--bento-warning); }
.badge-info, .status-info { background: var(--bento-primary-light); color: var(--bento-primary); }

/* Tables */
table { width: 100%; border-collapse: separate; border-spacing: 0; font-family: 'Inter', sans-serif; }
th { background: var(--bento-bg); color: var(--bento-text-secondary); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 14px; text-align: left; border-bottom: 2px solid var(--bento-border); }
td { padding: 12px 14px; border-bottom: 1px solid var(--bento-border); color: var(--bento-text); font-size: 13px; }
tr:hover td { background: var(--bento-primary-light); }
tr:last-child td { border-bottom: none; }

/* Inputs & selects */
input, select, textarea {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  padding: 8px 12px;
  border: 1.5px solid var(--bento-border);
  border-radius: var(--bento-radius-xs);
  background: var(--bento-card);
  color: var(--bento-text);
  transition: var(--bento-transition);
  outline: none;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--bento-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Stat cards */
.stat-card, .stat, .metric-card, .stat-box, .overview-stat, .kpi-card {
  background: var(--bento-card);
  border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-sm);
  padding: 16px;
  transition: var(--bento-transition);
}
.stat-card:hover, .stat:hover, .metric-card:hover { box-shadow: var(--bento-shadow-md); transform: translateY(-1px); }
.stat-value, .metric-value, .stat-number { font-size: 28px; font-weight: 700; color: var(--bento-text); font-family: 'Inter', sans-serif; }
.stat-label, .metric-label, .stat-title { font-size: 12px; font-weight: 500; color: var(--bento-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }

/* Canvas override (prevent Bento CSS from distorting charts) */
canvas {
  max-width: 100% !important;
  height: auto !important;
  width: auto !important;
  border: none !important;
}

/* Pagination */
.pagination, .pag {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
  padding: 16px 0;
  border-top: 1px solid var(--bento-border);
}
.pagination-btn, .pag-btn {
  padding: 8px 14px;
  border: 1.5px solid var(--bento-border);
  background: var(--bento-card);
  color: var(--bento-text);
  border-radius: var(--bento-radius-xs);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  transition: var(--bento-transition);
}
.pagination-btn:hover:not(:disabled), .pag-btn:hover:not(:disabled) { background: var(--bento-primary); color: white; border-color: var(--bento-primary); }
.pagination-btn:disabled, .pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pagination-info, .pag-info { font-size: 13px; color: var(--bento-text-secondary); font-weight: 500; padding: 0 8px; }
.page-size-select { padding: 6px 10px; border: 1.5px solid var(--bento-border); border-radius: var(--bento-radius-xs); font-size: 12px; font-family: 'Inter', sans-serif; }

/* Empty state */
.empty-state, .no-data, .no-results {
  text-align: center;
  padding: 48px 24px;
  color: var(--bento-text-secondary);
  font-size: 14px;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bento-border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--bento-text-muted); }

/* ===== END BENTO LIGHT MODE ===== */

:host {
  --bento-bg: var(--primary-background-color, #F8FAFC);
  --bento-card: var(--card-background-color, #FFFFFF);
  --bento-primary: #3B82F6;
  --bento-primary-hover: #2563EB;
  --bento-text: var(--primary-text-color, #1E293B);
  --bento-text-secondary: var(--secondary-text-color, #64748B);
  --bento-border: var(--divider-color, #E2E8F0);
  --bento-success: #10B981;
  --bento-warning: #F59E0B;
  --bento-error: #EF4444;
  --bento-radius-sm: 10px;
  --bento-radius-xs: 6px;
  --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
  --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.06);
  --bento-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: block;
  color-scheme: light dark;
}
* { box-sizing: border-box; }

.card, .card-container, .reports-card, .export-card {
  background: var(--bento-card); border-radius: var(--bento-radius-sm); box-shadow: var(--bento-shadow-sm);
  padding: 28px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: var(--bento-text); border: 1px solid var(--bento-border); animation: fadeSlideIn 0.4s ease-out;
}
.card-header { font-size: 20px; font-weight: 700; margin-bottom: 20px; color: var(--bento-text); letter-spacing: -0.01em; display: flex; justify-content: space-between; align-items: center; }
.card-header h2 { font-size: 20px; font-weight: 700; color: var(--bento-text); margin: 0; letter-spacing: -0.01em; }
.card-title, .title, .header-title, .pan-title { font-size: 20px; font-weight: 700; color: var(--bento-text); letter-spacing: -0.01em; }
.header, .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.tabs { display: flex; gap: 4px; border-bottom: 2px solid var(--bento-border); margin-bottom: 24px; overflow-x: auto; padding-bottom: 0; }
.tab, .tab-btn, .tab-button { padding: 10px 20px; border: none; background: transparent; color: var(--bento-text-secondary); cursor: pointer; font-size: 14px; font-weight: 500; border-bottom: 2px solid transparent; transition: var(--bento-transition); white-space: nowrap; margin-bottom: -2px; border-radius: 8px 8px 0 0; font-family: 'Inter', sans-serif; }
.tab.active, .tab-btn.active, .tab-btn.active { color: var(--bento-primary); border-bottom-color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.tab:hover, .tab-btn:hover, .tab-btn:hover { color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.tab-icon { margin-right: 6px; }
.tab-content { display: none; }
.tab-content.active { display: block; animation: fadeSlideIn 0.3s ease-out; }

button, .btn, .btn-s { padding: 9px 16px; border: 1.5px solid var(--bento-border); background: var(--bento-card); color: var(--bento-text); border-radius: var(--bento-radius-sm); cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition); }
button:hover, .btn:hover, .btn-s:hover { background: var(--bento-bg); border-color: var(--bento-primary); color: var(--bento-primary); }
button.active, .btn.active, .btn-act { background: var(--bento-primary); color: white; border-color: var(--bento-primary); box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25); }
.btn-primary { padding: 9px 16px; background: var(--bento-primary); color: white; border: 1.5px solid var(--bento-primary); border-radius: var(--bento-radius-sm); cursor: pointer; font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif; transition: var(--bento-transition); box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25); }
.btn-primary:hover { background: var(--bento-primary-hover); border-color: var(--bento-primary-hover); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35); transform: translateY(-1px); }
.btn-secondary { padding: 9px 16px; background: var(--bento-card); color: var(--bento-text); border: 1.5px solid var(--bento-border); border-radius: var(--bento-radius-sm); cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition); }
.btn-secondary:hover { border-color: var(--bento-primary); color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.btn-danger { padding: 9px 16px; background: var(--bento-card); color: var(--bento-error); border: 1.5px solid var(--bento-error); border-radius: var(--bento-radius-sm); cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition); }
.btn-danger:hover { background: var(--bento-error); color: white; }
.btn-small { padding: 5px 12px; font-size: 12px; border: 1px solid var(--bento-border); background: var(--bento-card); color: var(--bento-text-secondary); border-radius: var(--bento-radius-xs); cursor: pointer; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition); }
.btn-small:hover { border-color: var(--bento-primary); color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }

input[type="text"], input[type="number"], input[type="date"], input[type="time"], input[type="email"], input[type="search"], select, textarea, .search-input, .sinput, .sinput-sm, .alert-search-box, .period-select { padding: 9px 14px; border: 1.5px solid var(--bento-border); border-radius: var(--bento-radius-sm); font-size: 13px; background: var(--bento-card); color: var(--bento-text); font-family: 'Inter', sans-serif; transition: var(--bento-transition); outline: none; }
input[type="text"]:focus, input[type="number"]:focus, input[type="date"]:focus, input[type="time"]:focus, select:focus, textarea:focus, .search-input:focus, .sinput:focus, .sinput-sm:focus, .alert-search-box:focus, .period-select:focus { border-color: var(--bento-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
input::placeholder, .search-input::placeholder, .sinput::placeholder, .sinput-sm::placeholder { color: var(--bento-text-secondary); opacity: 0.7; }
.form-group { margin-bottom: 16px; }
.form-group.full { grid-column: 1 / -1; }
.form-row { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
label, .cg label, .clbl { display: block; font-size: 12px; font-weight: 600; color: var(--bento-text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.03em; }
.add-form { background: var(--bento-bg); border: 1px solid var(--bento-border); border-radius: var(--bento-radius-sm); padding: 20px; margin-bottom: 20px; }
textarea { min-height: 80px; resize: vertical; }

.stats, .stats-grid, .stats-container, .summary-grid, .network-stats, .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
.stat, .stat-card, .summary-card, .network-stat, .metric-card, .kpi-card { background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 16px; border: 1px solid var(--bento-border); transition: var(--bento-transition); text-align: center; }
.stat:hover, .stat-card:hover, .summary-card:hover, .network-stat:hover, .metric-card:hover { border-color: var(--bento-primary); box-shadow: var(--bento-shadow-md); transform: translateY(-1px); }
.stat-card.online { border-left: 3px solid var(--bento-success); }
.stat-card.offline { border-left: 3px solid var(--bento-error); }
.sv, .stat-value, .summary-value, .network-stat-value, .metric-value { font-size: 24px; font-weight: 700; color: var(--bento-primary); line-height: 1.2; }
.stat.ok .sv { color: var(--bento-success); }
.stat.err .sv { color: var(--bento-error); }
.sl, .stat-label, .summary-label, .network-stat-label, .metric-label { font-size: 12px; color: var(--bento-text-secondary); font-weight: 500; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
.stat-trend { font-size: 12px; font-weight: 600; margin-top: 4px; }
.stat-trend.positive, .trend-up { color: var(--bento-success); }
.stat-trend.negative, .trend-down { color: var(--bento-error); }

.device-table, .entity-table, .table, .alert-table, .data-table, .backup-table, .history-table, .log-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 16px; }
.device-table th, .entity-table th, .table th, .alert-table th, .data-table th, .backup-table th, table th { text-align: left; padding: 12px 16px; border-bottom: 2px solid var(--bento-border); font-weight: 600; color: var(--bento-text-secondary); background: var(--bento-bg); cursor: pointer; user-select: none; white-space: nowrap; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; transition: var(--bento-transition); font-family: 'Inter', sans-serif; }
.device-table th:first-child, .entity-table th:first-child, .table th:first-child, table th:first-child { border-radius: var(--bento-radius-xs) 0 0 0; }
.device-table th:last-child, .entity-table th:last-child, .table th:last-child, table th:last-child { border-radius: 0 var(--bento-radius-xs) 0 0; }
.device-table th:hover, .entity-table th:hover, .table th:hover, table th:hover { background: rgba(59, 130, 246, 0.06); color: var(--bento-primary); }
.device-table th.sorted, .entity-table th.sorted, .table th.sorted, table th.sorted { background: rgba(59, 130, 246, 0.08); color: var(--bento-primary); }
.device-table td, .entity-table td, .table td, .alert-table td, .data-table td, .backup-table td, table td { padding: 12px 16px; border-bottom: 1px solid var(--bento-border); color: var(--bento-text); font-size: 13px; font-family: 'Inter', sans-serif; }
.device-table tr:hover, .entity-table tr:hover, .table tbody tr:hover, .alert-table tr:hover, table tr:hover { background: rgba(59, 130, 246, 0.03); }
.table-container { overflow-x: auto; border-radius: var(--bento-radius-sm); border: 1px solid var(--bento-border); }
.sort-indicator { font-size: 10px; margin-left: 4px; color: var(--bento-primary); }

.status-badge, .severity-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; }
.status-online, .status-home, .status-active, .status-ok, .status-healthy, .status-running, .status-complete, .status-completed, .status-success, .badge-success { background: rgba(16, 185, 129, 0.1); color: #059669; }
.status-offline, .status-error, .status-failed, .status-critical, .severity-critical, .badge-error, .badge-danger { background: rgba(239, 68, 68, 0.1); color: #DC2626; }
.status-away, .status-warning, .severity-warning, .badge-warning { background: rgba(245, 158, 11, 0.1); color: #B45309; }
.status-unavailable, .status-unknown, .status-idle, .status-inactive, .status-stopped, .badge-neutral { background: rgba(100, 116, 139, 0.1); color: var(--bento-text-secondary); }
.status-zone, .severity-info, .badge-info { background: rgba(59, 130, 246, 0.1); color: var(--bento-primary); }

.alert-item { padding: 14px 18px; border-left: 4px solid var(--bento-border); border-radius: 0 var(--bento-radius-sm) var(--bento-radius-sm) 0; margin-bottom: 10px; background: var(--bento-bg); display: flex; justify-content: space-between; align-items: center; transition: var(--bento-transition); }
.alert-item:hover { box-shadow: var(--bento-shadow-sm); }
.alert-critical { border-color: var(--bento-error); background: rgba(239, 68, 68, 0.04); }
.alert-warning { border-color: var(--bento-warning); background: rgba(245, 158, 11, 0.04); }
.alert-info { border-color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.alert-text { flex: 1; }
.alert-type { font-weight: 600; font-size: 13px; margin-bottom: 4px; color: var(--bento-text); }
.alert-time { font-size: 12px; color: var(--bento-text-secondary); }
.alert-actions { display: flex; gap: 8px; }
.alert-dismiss { padding: 6px 12px; font-size: 12px; background: var(--bento-card); color: var(--bento-text-secondary); border: 1px solid var(--bento-border); border-radius: var(--bento-radius-xs); cursor: pointer; font-weight: 500; transition: var(--bento-transition); }
.alert-dismiss:hover { background: var(--bento-error); color: white; border-color: var(--bento-error); }

.section { margin-bottom: 24px; }
.section h3, .section-title, .pan-head { font-size: 16px; font-weight: 600; color: var(--bento-text); margin-bottom: 12px; letter-spacing: -0.01em; }

.battery-grid, .grid, .items-grid, .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.battery-card, .item-card, .chore-card, .entry-card, .backup-card { background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 16px; border: 1px solid var(--bento-border); transition: var(--bento-transition); }
.battery-card:hover, .item-card:hover, .chore-card:hover, .entry-card:hover, .backup-card:hover { box-shadow: var(--bento-shadow-md); border-color: var(--bento-primary); transform: translateY(-1px); }
.chore-card.priority-high { border-left: 3px solid var(--bento-error); }
.chore-card.priority-medium { border-left: 3px solid var(--bento-warning); }
.chore-card.priority-low { border-left: 3px solid var(--bento-success); }
.chore-title, .entry-title, .item-title { font-weight: 600; font-size: 14px; color: var(--bento-text); margin-bottom: 6px; }
.chore-meta, .entry-meta, .item-meta { font-size: 12px; color: var(--bento-text-secondary); }
.chore-assignee { font-size: 12px; color: var(--bento-primary); font-weight: 500; }
.chore-actions, .item-actions, .entry-actions { display: flex; gap: 6px; margin-top: 10px; }

.battery-bar, .progress-bar, .bandwidth-bar-bg { width: 100%; height: 8px; background: var(--bento-border); border-radius: 4px; overflow: hidden; margin-top: 8px; }
.battery-fill, .progress-fill, .bandwidth-bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); background: var(--bento-success); }
.battery-fill.battery_critical { background: var(--bento-error) !important; }
.battery-fill.battery_warning { background: var(--bento-warning) !important; }
.battery-label, .bandwidth-label { font-size: 13px; color: var(--bento-text); font-weight: 500; display: flex; justify-content: space-between; align-items: center; }

.pagination, .pag { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 20px; padding: 16px 0; border-top: 1px solid var(--bento-border); }
.pagination-btn, .pag-btn { padding: 8px 14px; border: 1.5px solid var(--bento-border); background: var(--bento-card); color: var(--bento-text); border-radius: var(--bento-radius-xs); cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition); }
.pagination-btn:hover:not(:disabled), .pag-btn:hover:not(:disabled) { background: var(--bento-primary); color: white; border-color: var(--bento-primary); }
.pagination-btn:disabled, .pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pagination-info, .pag-info { font-size: 13px; color: var(--bento-text-secondary); font-weight: 500; padding: 0 8px; }
.page-size-selector, .pag-size { padding: 6px 10px; border: 1.5px solid var(--bento-border); border-radius: var(--bento-radius-xs); background: var(--bento-card); color: var(--bento-text); font-size: 13px; cursor: pointer; font-family: 'Inter', sans-serif; }

.col-main { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: var(--bento-text); }
.topbar-r { display: flex; gap: 8px; align-items: center; }
.panels { display: flex; gap: 12px; }
.pan-left, .pan-center, .pan-right { background: var(--bento-card); border-radius: var(--bento-radius-sm); border: 1px solid var(--bento-border); overflow: hidden; }
.cbar { display: flex; gap: 8px; align-items: center; padding: 12px; background: var(--bento-bg); border-bottom: 1px solid var(--bento-border); }
.cg { display: flex; gap: 8px; align-items: center; }
.cg-r { margin-left: auto; }

.dd { position: relative; }
.dd-menu { position: absolute; top: 100%; left: 0; background: var(--bento-card); border: 1px solid var(--bento-border); border-radius: var(--bento-radius-sm); box-shadow: var(--bento-shadow-md); min-width: 180px; z-index: 100; display: none; overflow: hidden; }
.dd.open .dd-menu { display: block; }
.dd-i { padding: 10px 16px; cursor: pointer; font-size: 13px; color: var(--bento-text); transition: var(--bento-transition); font-family: 'Inter', sans-serif; }
.dd-i:hover { background: rgba(59, 130, 246, 0.06); color: var(--bento-primary); }
.dd-div { border-top: 1px solid var(--bento-border); margin: 4px 0; }

.auto-item, .tr-item, .list-item, .automation-item { padding: 12px 16px; cursor: pointer; border-bottom: 1px solid var(--bento-border); display: flex; align-items: center; gap: 10px; transition: var(--bento-transition); font-family: 'Inter', sans-serif; }
.auto-item:hover, .tr-item:hover, .list-item:hover, .automation-item:hover { background: rgba(59, 130, 246, 0.04); }
.auto-item.sel, .tr-item.sel, .list-item.selected, .automation-item.selected { background: rgba(59, 130, 246, 0.08); border-left: 3px solid var(--bento-primary); }
.auto-item.error-item, .automation-item.error-item { border-left: 3px solid var(--bento-error); }
.auto-name { font-weight: 500; font-size: 13px; color: var(--bento-text); }
.auto-meta { font-size: 12px; color: var(--bento-text-secondary); }
.auto-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--bento-text-secondary); }
.auto-dot.s-running { background: var(--bento-success); }
.auto-dot.s-stopped { background: var(--bento-text-secondary); }
.auto-dot.s-error { background: var(--bento-error); }
.auto-count { font-size: 11px; color: var(--bento-text-secondary); margin-left: auto; }

.tgroup { border: 1px solid var(--bento-border); border-radius: var(--bento-radius-xs); margin-bottom: 8px; overflow: hidden; }
.tgroup-h { padding: 10px 14px; background: var(--bento-bg); display: flex; align-items: center; gap: 8px; cursor: pointer; transition: var(--bento-transition); font-family: 'Inter', sans-serif; }
.tgroup-h:hover { background: rgba(59, 130, 246, 0.06); }
.tg-tog { transition: transform 0.2s; font-size: 12px; color: var(--bento-text-secondary); }
.tgroup.collapsed .tg-tog { transform: rotate(-90deg); }
.tgroup.collapsed .tgroup-items { display: none; }
.tg-name { font-weight: 600; font-size: 13px; color: var(--bento-text); }
.tg-cnt { font-size: 11px; color: var(--bento-text-secondary); margin-left: auto; background: var(--bento-border); padding: 2px 8px; border-radius: 10px; }

.device-detail, .detail-panel, .details { background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 16px; border: 1px solid var(--bento-border); }
.detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--bento-border); font-size: 13px; }
.detail-row:last-child { border-bottom: none; }
.detail-label { color: var(--bento-text-secondary); font-weight: 500; }
.detail-value { color: var(--bento-text); font-weight: 600; }

.board { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 8px; }
.column { min-width: 260px; background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 12px; border: 1px solid var(--bento-border); }
.column-header { font-weight: 600; font-size: 14px; color: var(--bento-text); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
.column-count { background: var(--bento-border); color: var(--bento-text-secondary); font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }

.schedule, .calendar { margin-top: 16px; }
.week-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-top: 16px; }
.week-header { padding: 8px; text-align: center; font-size: 12px; font-weight: 600; color: var(--bento-text-secondary); text-transform: uppercase; letter-spacing: 0.03em; border-radius: var(--bento-radius-xs); }
.week-cell { padding: 8px; text-align: center; font-size: 12px; background: var(--bento-bg); border: 1px solid var(--bento-border); cursor: pointer; transition: var(--bento-transition); border-radius: var(--bento-radius-xs); }
.week-cell:hover { border-color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.chore-item { padding: 8px 12px; border-bottom: 1px solid var(--bento-border); font-size: 13px; }

.leaderboard { background: var(--bento-bg); border-radius: var(--bento-radius-sm); border: 1px solid var(--bento-border); overflow: hidden; }
.leaderboard-row { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--bento-border); gap: 12px; font-size: 13px; transition: var(--bento-transition); }
.leaderboard-row:last-child { border-bottom: none; }
.leaderboard-row:hover { background: rgba(59, 130, 246, 0.04); }
.rank { font-weight: 700; color: var(--bento-primary); font-size: 14px; min-width: 28px; }
.name { font-weight: 500; color: var(--bento-text); flex: 1; }
.streak { color: var(--bento-warning); font-weight: 600; }
.completion { color: var(--bento-success); font-weight: 600; }

.baby-selector { display: flex; gap: 8px; margin-bottom: 16px; }
.quick-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
.quick-btn, .action-btn { padding: 10px 16px; border: 1.5px solid var(--bento-border); background: var(--bento-card); border-radius: var(--bento-radius-sm); cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition); display: flex; align-items: center; gap: 6px; color: var(--bento-text); }
.quick-btn:hover, .action-btn:hover { border-color: var(--bento-primary); color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.quick-btn.active, .action-btn.active { background: var(--bento-primary); color: white; border-color: var(--bento-primary); }
.timeline { position: relative; padding-left: 24px; }
.timeline-item { padding: 12px 0; border-bottom: 1px solid var(--bento-border); position: relative; }
.timeline-time { font-size: 12px; color: var(--bento-text-secondary); font-weight: 500; }
.timeline-content { font-size: 13px; color: var(--bento-text); margin-top: 4px; }

canvas, .canvas-container canvas { width: 100%; height: 200px; border: 1px solid var(--bento-border); border-radius: var(--bento-radius-sm); margin-bottom: 16px; }
.canvas-container { position: relative; margin-bottom: 16px; }
.chart-container { background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 16px; border: 1px solid var(--bento-border); margin-bottom: 16px; }

.empty, .empty-state { text-align: center; padding: 48px 24px; color: var(--bento-text-secondary); font-size: 14px; font-family: 'Inter', sans-serif; }
.empty-ico, .empty-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.5; }
.spinner { width: 32px; height: 32px; border: 3px solid var(--bento-border); border-top: 3px solid var(--bento-primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 24px auto; }

.search-box, .search-bar, .controls, .ctrls, .filter-bar { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
.control-group { display: flex; gap: 8px; align-items: center; }

.domain-group-header { margin-top: 20px; padding: 10px 16px; background: var(--bento-bg); border-radius: var(--bento-radius-xs); font-weight: 600; font-size: 14px; color: var(--bento-text); border: 1px solid var(--bento-border); }
.domain-group-header:first-child { margin-top: 0; }
.domain-group-count { font-weight: 500; color: var(--bento-text-secondary); font-size: 12px; margin-left: 8px; }

.automation-list, .list, .item-list { border: 1px solid var(--bento-border); border-radius: var(--bento-radius-sm); overflow: hidden; }
.automation-name, .entity-name { font-weight: 500; font-size: 13px; color: var(--bento-text); }
.automation-id, .entity-id { font-size: 11px; color: var(--bento-text-secondary); }
.error-badge, .count-badge { background: var(--bento-error); color: white; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px; margin-left: 6px; }
.tab .error-badge { background: var(--bento-error); color: white; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px; margin-left: 6px; }

.health-score, .score { font-size: 48px; font-weight: 700; color: var(--bento-primary); text-align: center; margin: 16px 0; }
.emoji { font-size: 20px; line-height: 1; }
.device-icon { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: rgba(59, 130, 246, 0.08); border-radius: var(--bento-radius-xs); font-size: 16px; }

.recommendation-card, .tip-card, .suggestion-card { background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 16px; border: 1px solid var(--bento-border); margin-bottom: 12px; transition: var(--bento-transition); }
.recommendation-card:hover, .tip-card:hover, .suggestion-card:hover { border-color: var(--bento-primary); box-shadow: var(--bento-shadow-md); }

.export-options, .options-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; }
.export-option, .option-card { background: var(--bento-bg); border: 1.5px solid var(--bento-border); border-radius: var(--bento-radius-sm); padding: 16px; cursor: pointer; transition: var(--bento-transition); text-align: center; }
.export-option:hover, .option-card:hover { border-color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.export-option.selected, .option-card.selected { border-color: var(--bento-primary); background: rgba(59, 130, 246, 0.08); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

.storage-bar, .usage-bar { width: 100%; height: 24px; background: var(--bento-border); border-radius: var(--bento-radius-xs); overflow: hidden; margin-bottom: 12px; }
.storage-fill, .usage-fill { height: 100%; border-radius: var(--bento-radius-xs); transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); background: var(--bento-primary); }

.check-item, .security-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--bento-border); transition: var(--bento-transition); }
.check-item:hover, .security-item:hover { background: rgba(59, 130, 246, 0.03); }
.check-icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 16px; }
.check-icon.pass { background: rgba(16, 185, 129, 0.1); }
.check-icon.fail { background: rgba(239, 68, 68, 0.1); }
.check-icon.warn { background: rgba(245, 158, 11, 0.1); }
.check-text, .security-text { flex: 1; }
.check-title { font-weight: 600; font-size: 13px; color: var(--bento-text); }
.check-desc { font-size: 12px; color: var(--bento-text-secondary); margin-top: 2px; }

.waveform { background: var(--bento-bg); border: 1px solid var(--bento-border); border-radius: var(--bento-radius-sm); padding: 16px; margin-bottom: 16px; }
.analysis-result, .result-card { background: var(--bento-bg); border: 1px solid var(--bento-border); border-radius: var(--bento-radius-sm); padding: 20px; text-align: center; margin-bottom: 16px; }
.confidence-bar { height: 8px; background: var(--bento-border); border-radius: 4px; overflow: hidden; margin-top: 8px; }
.confidence-fill { height: 100%; border-radius: 4px; background: var(--bento-primary); transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); }

.sentence-item, .intent-item { padding: 12px 16px; border-bottom: 1px solid var(--bento-border); display: flex; justify-content: space-between; align-items: center; transition: var(--bento-transition); }
.sentence-item:hover, .intent-item:hover { background: rgba(59, 130, 246, 0.03); }
.sentence-text { font-size: 13px; color: var(--bento-text); font-family: 'Inter', sans-serif; }
.intent-badge { display: inline-flex; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background: rgba(59, 130, 246, 0.1); color: var(--bento-primary); }

.backup-item, .backup-entry { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--bento-border); transition: var(--bento-transition); }
.backup-item:hover, .backup-entry:hover { background: rgba(59, 130, 246, 0.03); }
.backup-name { font-weight: 500; font-size: 14px; color: var(--bento-text); }
.backup-date, .backup-size { font-size: 12px; color: var(--bento-text-secondary); }

.report-section { background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 20px; border: 1px solid var(--bento-border); margin-bottom: 16px; }
.insight-card { padding: 14px; border-left: 3px solid var(--bento-primary); background: rgba(59, 130, 246, 0.04); border-radius: 0 var(--bento-radius-xs) var(--bento-radius-xs) 0; margin-bottom: 10px; }

@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bento-border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--bento-text-secondary); }

@media (max-width: 768px) {
  .card, .card-container, .reports-card, .export-card { padding: 16px; }
  .stats, .stats-grid, .summary-grid { grid-template-columns: repeat(2, 1fr); }
  .panels { flex-direction: column; }
  .board { flex-direction: column; }
  .column { min-width: unset; }
}

/* ===== STORAGE MONITOR SPECIFIC ===== */
.disk-gauge { display: flex; align-items: center; gap: 24px; width: 100%; max-width: 100%; min-width: 0; overflow: hidden; margin-bottom: 20px; padding: 16px; background: var(--bento-bg); border-radius: var(--bento-radius-sm); border: 1px solid var(--bento-border); }
.gauge-ring { position: relative; width: 120px; height: 120px; flex-shrink: 0; }
.gauge-ring svg { width: 120px; height: 120px; transform: rotate(-90deg); }
.gauge-bg { fill: none; stroke: var(--bento-border); stroke-width: 8; }
.gauge-fill { fill: none; stroke-width: 8; stroke-linecap: round; transition: stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
.gauge-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
.gauge-pct { font-size: 24px; font-weight: 700; color: var(--bento-text); font-family: 'Inter', sans-serif; line-height: 1.2; }
.gauge-label { font-size: 11px; color: var(--bento-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
.gauge-info { flex: 1; min-width: 0; width: 100%; }
.gi-row { display: flex; justify-content: space-between; gap: 12px; min-width: 0; padding: 6px 0; border-bottom: 1px solid var(--bento-border); font-size: 13px; color: var(--bento-text-secondary); }
.gi-row:last-child { border-bottom: none; }
.gi-row span:first-child { min-width: 50px; }
.gi-val { min-width: 0; font-weight: 600; color: var(--bento-text); white-space: normal; overflow-wrap: anywhere; word-break: break-word; text-align: right; }

/* HA Sections can be narrow inside a wide desktop viewport. Container queries
   therefore follow the card width instead of the browser width. */
@container (max-width: 420px) {
  .disk-gauge { flex-direction: column; gap: 12px; text-align: center; }
  .gauge-ring, .gauge-ring svg { width: 100px; height: 100px; }
  .gauge-pct { font-size: 20px; }
  .gi-row { font-size: 12px; }
}

.treemap { display: flex; height: 32px; border-radius: var(--bento-radius-xs); overflow: hidden; margin-bottom: 16px; gap: 2px; }
.treemap-cell { display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.3); min-width: 4px; border-radius: 3px; padding: 0 4px; white-space: nowrap; overflow: hidden; }

.cat-list { margin-bottom: 16px; }
.cat-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--bento-border); }
.cat-item:last-child { border-bottom: none; }
.cat-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.cat-icon { font-size: 18px; flex-shrink: 0; }
.cat-info { flex: 1; min-width: 0; }
.cat-name { font-size: 13px; font-weight: 500; color: var(--bento-text); }
.cat-size { font-size: 12px; color: var(--bento-text-secondary); }
.cat-bar { width: 80px; height: 6px; background: var(--bento-border); border-radius: 3px; overflow: hidden; flex-shrink: 0; }
.cat-bar-fill { height: 100%; border-radius: 3px; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); }

.size-bar { display: inline-block; height: 8px; border-radius: 4px; vertical-align: middle; }

.table-container { overflow-x: auto; margin-bottom: 16px; }

.suggestion { padding: 16px; background: var(--bento-bg); border-radius: var(--bento-radius-sm); border: 1px solid var(--bento-border); margin-bottom: 10px; }
.suggestion.crit { border-left: 3px solid var(--bento-error); background: var(--bento-error-light); }
.suggestion.warn { border-left: 3px solid var(--bento-warning); background: var(--bento-warning-light); }
.suggestion-title { font-weight: 600; font-size: 14px; color: var(--bento-text); margin-bottom: 4px; }
.suggestion-desc { font-size: 13px; color: var(--bento-text-secondary); }
.suggestion-savings { font-size: 12px; color: var(--bento-primary); font-weight: 500; margin-top: 6px; }


:host(.bento-dark) {
    --bento-bg: var(--primary-background-color, #1a1a2e);
    --bento-card: var(--card-background-color, #16213e);
    --bento-text: var(--primary-text-color, #e2e8f0);
    --bento-text-secondary: var(--secondary-text-color, #94a3b8);
    --bento-border: var(--divider-color, #334155);
    --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
    --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  }
/* === DARK MODE ADDED - old comment below === */

        /* === MOBILE FIX === */
        @media (max-width: 768px) {
          .tabs { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; gap: 2px; }
          .tab, .tab-btn, .tab-button { padding: 6px 10px; font-size: 12px; white-space: nowrap; }
          .card, .card-container { padding: 14px; }
          .stats, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .stat-val, .kpi-val, .metric-val { font-size: 18px; }
          .stat-lbl, .kpi-lbl, .metric-lbl { font-size: 10px; }
          .panels, .board { flex-direction: column; }
          .column { min-width: unset; }
          h2 { font-size: 18px; }
          h3 { font-size: 15px; }
          .disk-gauge { gap: 16px; }
          .gauge-ring { width: 100px; height: 100px; }
          .gauge-ring svg { width: 100px; height: 100px; }
          .gi-row { font-size: 12px; }
        }
        @media (max-width: 480px) {
          .tabs { gap: 1px; }
          .tab, .tab-btn, .tab-button { padding: 5px 6px; font-size: 10px; }
          .stats, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid { grid-template-columns: 1fr 1fr; }
          .stat-val, .kpi-val, .metric-val { font-size: 16px; }
          .disk-gauge { flex-direction: column; gap: 12px; text-align: center; }
          .gauge-ring { width: 100px; height: 100px; }
          .gauge-ring svg { width: 100px; height: 100px; }
          .gauge-pct { font-size: 20px; }
        }

${_FAMILY_CONTROL_CSS}
${STORAGE_PRESENTATION_CSS}
</style>
      
        <ha-card class="card">
          <div class="card-header">
            <h2><ha-icon icon="mdi:harddisk" aria-hidden="true"></ha-icon>${_esc(this._config.title ?? this._t.title)}</h2>
            <button type="button" class="storage-secondary" id="cleanupBtn" ${this._hass?.user?.is_admin !== true || this._hass.user.is_active === false || !this._storageOnline() ? 'disabled' : ''}>${this._copy('cleanup')}</button>
            <button class="refresh-btn" id="refreshBtn" aria-label="${this._label('Refresh storage data', 'Odśwież dane dysku')}">\u{1F504} ${this._t.refresh}</button>
          </div>
          <div class="tabs" role="tablist">
            <button class="tab-button active" data-tab="overview" role="tab" aria-label="${this._label('Overview', 'Przegląd')}">${this._label('Overview', 'Przegląd')}</button>
            <button class="tab-button" data-tab="addons" role="tab" aria-label="${this._label('Addons and Integrations', 'Dodatki i integracje')}">${this._label('Addons & Integrations', 'Dodatki i integracje')}</button>
            <button class="tab-button" data-tab="backups" role="tab" aria-label="${this._label('Backups', 'Kopie zapasowe')}">${this._label('Backups', 'Kopie zapasowe')}</button>
            <button class="tab-button" data-tab="files" role="tab" aria-label="${this._copy('resources')}">${this._copy('resources')}</button>
            <button class="tab-button" data-tab="trend" role="tab" aria-label="${this._label('Measured history', 'Zmierzona historia')}">${this._label('Measured history', 'Zmierzona historia')}</button>
          </div>
          <div id="content"></div>
          ${this._hass?.user?.is_admin && this._config?.show_support !== false && !this._supportDismissed && !storageMonitorSupportDismissed() ? (this._lang === 'pl' ? STORAGE_MONITOR_DONATE_HTML.replace('Optional support for HA Tools', 'Opcjonalne wsparcie HA Tools').replace('Dismiss support link', 'Ukryj link wsparcia') : STORAGE_MONITOR_DONATE_HTML) : ''}
        
        </ha-card>
      
    `;
    if (this._lastHtml === html) {
      this._syncTabSelection();
      _bindFamilyNavigation(this);
      return;
    }
    this._lastHtml = html;
    this.shadowRoot.innerHTML = html;
    this._syncTabSelection();
    this.shadowRoot.querySelector('.support-dismiss')?.addEventListener('click', () => {
      this._supportDismissed = true;
      try { localStorage.setItem(STORAGE_MONITOR_SUPPORT_KEY, '1'); } catch (_) {}
      this.shadowRoot.querySelector('.donate-section[data-source="own-card"]')?.remove();
    });

    // Tab handlers
    this.shadowRoot.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', () => {
        this._activeTab = this._normalizeTab(btn.dataset.tab);
        this._syncTabSelection();
        this._legacyTab = null;
        this._cleanupOpen = false;
        this._saveTabState();
        if (!this._sourceCard) history.replaceState(null, '', location.pathname + '#' + this._toolId + '/' + this._activeTab);
        this._updateContent();
      });
    });

    this.shadowRoot.getElementById('refreshBtn').addEventListener('click', () => this._refreshStorageData());
    this.shadowRoot.getElementById('cleanupBtn')?.addEventListener('click', () => this._openCleanup());
    _bindFamilyNavigation(this, familyFocus);
  }

  _restoreTabState() {
    let tab = this._activeTab;
    if (Object.hasOwn(this._config, 'default_tab')) tab = this._config.default_tab;
    else {
      try {
        const saved = JSON.parse(localStorage.getItem('ha-storage-monitor-settings') || 'null');
        if (saved && typeof saved._activeTab === 'string') tab = saved._activeTab;
      } catch (_) {}
    }
    this._legacyTab = ['top', 'cleanup'].includes(tab) ? tab : null;
    if (tab === 'top') this._resourcesOpen = true;
    // Reading an old cleanup key only creates a navigation notice.
    this._cleanupOpen = false;
    this._activeTab = this._normalizeTab(tab);
  }

  _normalizeTab(tabId) {
    if (tabId === 'top') return 'files';
    if (tabId === 'cleanup') return 'overview';
    return ['overview', 'addons', 'backups', 'files', 'trend'].includes(tabId) ? tabId : 'overview';
  }

  _saveTabState() {
    if (this._sourceCard) return;
    try {
      const raw = JSON.parse(localStorage.getItem('ha-storage-monitor-settings') || '{}');
      const previous = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
      localStorage.setItem('ha-storage-monitor-settings', JSON.stringify({...previous, _activeTab: this._activeTab}));
    } catch (_) {}
  }

  _syncTabSelection() {
    this._activeTab = this._normalizeTab(this._activeTab);
    const picker = this.shadowRoot.getElementById('ha-tools-tab-picker');
    if (picker) picker.value = this._activeTab;
    this.shadowRoot.querySelectorAll('.tab-button').forEach(button => {
      const selected = button.dataset.tab === this._activeTab;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
  }

  _updateContent() {
    // J2 fix: debounce to prevent flickering
    if (this._updateContentRAF) cancelAnimationFrame(this._updateContentRAF);
    this._updateContentRAF = requestAnimationFrame(() => this._doUpdateContent());
  }

  _doUpdateContent() {
    if (this._storageData?.source === 'local_fs_samples' && (!Number.isFinite(this._storageData.measuredAt) ||
        this._storageData.measuredAt > Date.now() || Date.now() - this._storageData.measuredAt > 3600000)) {
      this._storageData = {...this._storageData, diskUsed:null,diskTotal:null,diskFree:null,diskReserved:null,usedPercent:null};
    }
    this._publishFullView(); this._syncDashboardPlacementV53(); this._syncNativeSurface();
    if (this._variant() !== 'full') { this._renderSmall(); return; }
    const content = this.shadowRoot.getElementById('content');
    if (!content) return;
    if (this._activeTab === 'trend' && !this._cleanupOpen) { this._paintTrend(); return; }

    if (this._loading) {
      content.innerHTML = `${this._storageResultHtml()}<div class="loading"><div class="spinner"></div>${this._t.loading}</div>`;
      return;
    }

    if (this._storageData?.permissionDenied || this._storageData?.noSupervisor) {
      const denied = this._storageData.permissionDenied;
      content.innerHTML = `${this._storageResultHtml()}<div style="text-align:center;padding:48px 24px;color:var(--bento-text-secondary,#64748B)">
        <div style="font-size:48px;margin-bottom:16px">\u{1F4E6}</div>
        <div style="font-size:18px;font-weight:600;color:var(--bento-text,#1E293B);margin-bottom:8px">${denied ? this._t.supervisorAccessRequired : this._t.requiresSupervisor}</div>
        <div style="max-width:400px;margin:0 auto;line-height:1.5">${denied ? this._t.supervisorAccessRequiredDesc : this._t.requiresSupervisorDesc}</div>
      </div>`;
      return;
    }
    if (!this._storageData || this._storageData.error) {
      const message = this._usesNativeStorage() ? this._nativeReason() : this._storageData?.error ? this._label('Supervisor data unavailable. Use Refresh to retry.', 'Dane Supervisor niedostępne. Użyj Odśwież, aby ponowić.') : this._t.noDataAvailable;
      content.innerHTML = `${this._storageResultHtml()}<div class="error">${_esc(message)}</div>`;
      return;
    }

    const d = this._storageData;
    const details = this._captureDetails(content);
    if (this._cleanupOpen) content.innerHTML = this._renderCleanupAction(d);
    else if (this._activeTab === 'overview') content.innerHTML = this._renderOverview(d);
    else if (this._activeTab === 'addons') content.innerHTML = this._renderAddonsAndIntegrations(d);
    else if (this._activeTab === 'backups') content.innerHTML = this._renderBackups(d);
    else if (this._activeTab === 'files') content.innerHTML = this._renderResources(d);

    content.insertAdjacentHTML('afterbegin', this._storageResultHtml());
    if (this._legacyTab === 'cleanup' && !this._cleanupOpen) content.insertAdjacentHTML('afterbegin',
      '<p class="note-box" role="status">' + this._copy('cleanupMoved') + '</p>');
    content.insertAdjacentHTML('beforeend', this._renderSourceDetails(d));
    this.shadowRoot.querySelector('#closeCleanup')?.addEventListener('click', () => {
      this._cleanupOpen = false; this._doUpdateContent();
      this.shadowRoot.getElementById('cleanupBtn')?.focus({preventScroll: true});
    });
    this.shadowRoot.querySelector('[data-resources]')?.addEventListener('toggle', event => {
      this._resourcesOpen = event.target.open;
    });
    this._restoreDetails(content, details);
    this._attachContentEvents();
    this.shadowRoot.querySelectorAll('[data-category-view]').forEach(button => button.addEventListener('click', () => {
      this._categoryView = button.dataset.categoryView === 'data' ? 'data' : 'chart'; this._doUpdateContent();
    }));
  }

  _renderOverview(d) {
    d = { ...d, categories: d.categories.map(c => ({ ...c, name: this._categoryLabel(c.name) })) };
    const circ = 2 * Math.PI * 40;
    const usedPct = d.usedPercent == null ? 0 : d.usedPercent;
    const fillColor = usedPct >= 90 ? '#f44336' : usedPct >= 80 ? '#ff9800' : 'var(--bento-primary)';
    const totalMB = d.categories.reduce((s, c) => s + c.size, 0);
    const percentageBase = totalMB > 0 ? totalMB : 1;
    const hasCategoryComparison = d.categories.filter(c => c.measured !== false && Number.isFinite(c.size) && c.size > 0).length > 1;

    return `
      <div class="disk-gauge">
        <div class="gauge-ring">
          <svg viewBox="0 0 100 100">
            <circle class="gauge-bg" cx="50" cy="50" r="40" />
            <circle class="gauge-fill" cx="50" cy="50" r="40" style="stroke:${fillColor};stroke-dasharray:${(usedPct/100)*circ} ${circ}" />
          </svg>
          <div class="gauge-text">
            <div class="gauge-pct">${d.usedPercent == null ? 'N/A' : usedPct + '%'}</div>
            <div class="gauge-label">${this._label('used', 'zajęte')}</div>
          </div>
        </div>
        <div class="gauge-info">
          <div class="gi-row"><span>${this._label('Total', 'Łącznie')}</span><span class="gi-val">${d.diskTotal == null ? 'N/A' : d.diskTotal.toFixed(1) + ' GB'}</span></div>
          <div class="gi-row"><span>${this._label('Used', 'Zajęte')}</span><span class="gi-val">${d.diskUsed == null ? 'N/A' : d.diskUsed.toFixed(1) + ' GB'}</span></div>
          <div class="gi-row"><span>${d.freeComputed ? this._label('Free (calculated)', 'Wolne (obliczone)') : this._label('Free', 'Wolne')}</span><span class="gi-val">${d.diskFree == null ? 'N/A' : d.diskFree.toFixed(1) + ' GB'}</span></div>
          <div class="gi-row"><span>${d.source === 'ha_entities' ? this._label('Filesystem', 'Filesystem') : this._label('Host', 'Host')}</span><span class="gi-val">${_esc(d.hostname)}</span></div>
          <div class="gi-row"><span>${this._label('OS', 'System')}</span><span class="gi-val">${_esc(d.osVersion)}</span></div>
        </div>
      </div>

      ${usedPct >= 90 ? `<div class="note-box" role="status">${this._label('Low free space.', 'Mało wolnego miejsca.')}</div>` : ''}
      <div class="note-box">${this._lang === 'pl' ? 'Widok pokazuje tylko zmierzone kategorie; nie sumuje się do całego dysku.' : 'This view shows measured categories only; it does not add up to total disk usage.'}</div>
      <div class="category-controls" ${hasCategoryComparison ? '' : 'hidden'} role="group" aria-label="${this._label('Category view', 'Widok kategorii')}">
        <button type="button" data-category-view="chart" aria-pressed="${this._categoryView === 'chart'}">${this._label('Chart', 'Wykres')}</button>
        <button type="button" data-category-view="data" aria-pressed="${this._categoryView === 'data'}">${this._label('Data', 'Dane')}</button>
      </div>
      ${this._categoryView === 'data' || !hasCategoryComparison ? this._renderCategoryData(d) : ''}
      <div ${this._categoryView === 'data' || !hasCategoryComparison ? 'hidden' : ''}>
      <div class="treemap">
        ${d.categories.filter(c => c.size > 0 && c.measured !== false).map(c => {
          const pct = Math.max(2, (c.size / percentageBase) * 100);
          return `<div class="treemap-cell" style="flex:${pct};background:${c.color}" title="${_esc(c.name)}: ${this._categorySize(c.size)}">${c.icon} ${pct > 10 ? _esc(String(c.name ?? '').split(' ')[0]) : ''}</div>`;
        }).join('')}
      </div>

      <div class="cat-list">
        ${d.categories.map(c => `
          <div class="cat-item">
            <div class="cat-dot" style="background:${c.color}"></div>
            <span class="cat-icon">${c.icon}</span>
            <div class="cat-info">
              <div class="cat-name">${_esc(c.name)}${c.items ? ` (${(c.name === this._categoryLabel('Backups') && d.backupsAvailable === false) || (c.name === this._categoryLabel('Add-ons') && d.addonsAvailable === false) ? 'N/A' : c.items.length})` : ''}</div>
              <div class="cat-size">${c.measured === false ? this._label('Not measured', 'Nie zmierzono') : this._categorySize(c.size)}${c.partial ? this._label(' (partial — some unavailable)', ' (częściowo — brak części pomiarów)') : (c.estimated ? this._label(' (estimated)', ' (szacunek)') : '')}</div>
            </div>
            <div class="cat-bar"><div class="cat-bar-fill" style="width:${Math.min(100, (c.size / percentageBase) * 100)}%;background:${c.color}"></div></div>
          </div>
        `).join('')}
      </div>
      </div>
    `;
  }

  _renderAddons(d) { return this._renderAddonsAndIntegrations(d); }

  _renderAddonsAndIntegrations(d) {
    const L = this._lang === 'pl';
    const hasAnySizes = d.addons.some(a => a.measured);
    const sizeNote = hasAnySizes ? '' : `<div style="padding:8px 12px;background:rgba(59,130,246,0.06);border-radius:8px;margin-bottom:12px;font-size:12px;color:var(--bento-text-secondary,#64748b);">\u{1F4A1} ${this._t.addonSizeNote}</div>`;
    const maxAddonSize = Math.max(...d.addons.map(a => a.size), 1);

    const sortedAddons = [...d.addons].sort((a, b) => this._sortAsc ? a.size - b.size : b.size - a.size);
    const sortedInts = [...(d.integrations || [])].sort((a, b) => String(a.source || '').localeCompare(String(b.source || '')));

    return `
      ${d.addonsAvailable === false ? `<div class="note-box">${this._label('Add-on inventory unavailable. Use Refresh to retry.', 'Lista dodatków niedostępna. Użyj Odśwież, aby ponowić.')}</div>` : sizeNote}
      <h3 style="margin:0 0 12px;font-size:15px;color:var(--bento-text,#1e293b);">\u{1F9E9} ${this._t.addons} (${d.addonsAvailable === false ? 'N/A' : d.addons.length})</h3>
      <div class="table-container">
        <table class="entity-table">
          <thead><tr>
            <th>${this._t.addon}</th>
            <th>${this._t.size}</th>
            <th>Status</th>
            <th>${this._t.version}</th>
            <th></th>
          </tr></thead>
          <tbody>
            ${sortedAddons.map(a => `
              <tr>
                <td title="${_esc(a.slug)}">${_esc(a.name)}</td>
                <td>${a.measured ? this._fmtSize(a.size) : 'N/A'}</td>
                <td><span style="color:${a.state === 'started' ? '#4caf50' : '#9e9e9e'}">\u25CF ${_esc(a.state || 'N/A')}</span></td>
                <td>${_esc(a.version || '-')}</td>
                <td>${a.measured && a.size > 0 ? `<span class="size-bar" style="width:${Math.max(4, (a.size / maxAddonSize) * 100)}px;background:#4caf50"></span>` : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <h3 style="margin:24px 0 12px;font-size:15px;color:var(--bento-text,#1e293b);">\u{1F50C} ${this._t.integrations} (${d.integrationsAvailable === false ? 'N/A' : (d.integrations || []).length})</h3>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
        <div style="padding:6px 12px;background:rgba(33,150,243,0.08);border-radius:8px;font-size:12px;color:var(--bento-text-secondary,#64748b);">${this._label('Config entries:', 'Wpisy integracji:')} ${d.integrationsAvailable === false ? 'N/A' : (d.integrations || []).length}</div>
        <div style="padding:6px 12px;background:rgba(76,175,80,0.08);border-radius:8px;font-size:12px;color:var(--bento-text-secondary,#64748b);">\u{1F4CA} ${this._t.estStorage}: N/A</div>
      </div>
      <div class="table-container">
        <table class="entity-table">
          <thead><tr>
            <th>${this._t.integration}</th>
            <th>${this._label('Domain', 'Domena')}</th>
            <th>${this._t.source}</th>
            <th>Status</th>
          </tr></thead>
          <tbody>
            ${d.integrationsAvailable === false ? `<tr><td colspan="4">${this._t.integrationListUnavailable}</td></tr>` : ''}
            ${sortedInts.slice(0, 60).map(i => {
              return `
              <tr>
                <td>${_esc(i.title || i.domain)}</td>
                <td><code style="font-size:11px;background:rgba(0,0,0,0.05);padding:2px 6px;border-radius:4px;">${_esc(i.domain)}</code></td>
                <td>${_esc(i.source || 'N/A')}</td>
                <td><span style="color:${i.state === 'loaded' ? '#4caf50' : i.state === 'setup_error' ? '#f44336' : '#9e9e9e'}">\u25CF ${_esc(i.state || 'unknown')}</span></td>
              </tr>`;
            }).join('')}
            ${(d.integrations || []).length > 60 ? `<tr><td colspan="4" style="text-align:center;color:var(--bento-text-secondary,#64748b);font-size:12px;">... ${this._t.and} ${(d.integrations || []).length - 60} ${this._t.more}</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    `;
  }

  _renderBackups(d) {
    if (d.backupsAvailable === false) return `<div class="note-box">${this._label('Backup inventory unavailable. Use Refresh to retry.', 'Lista kopii niedostępna. Użyj Odśwież, aby ponowić.')}</div>`;
    if (!d.backups.length) return `<div class="loading">${this._label('No backups found', 'Nie znaleziono kopii zapasowych')}</div>`;
    const maxSize = Math.max(...d.backups.map(b => b.size), 1);
    return `
      <div class="table-container">
        <table class="entity-table">
          <thead><tr>
            <th>${this._label('Backup', 'Kopia zapasowa')}</th>
            <th>${this._label('Size', 'Rozmiar')}</th>
            <th>${this._label('Date', 'Data')}</th>
            <th>${this._label('Type', 'Typ')}</th>
            <th>${this._label('Visualization', 'Wykres')}</th>
          </tr></thead>
          <tbody>
            ${d.backups.map(b => `
              <tr>
                <td title="${_esc(b.slug)}">${_esc(b.name)}</td>
                <td>${b.measured === false ? 'N/A' : this._fmtSize(b.size)}</td>
                <td>${b.date ? new Date(b.date).toLocaleDateString(this._t.locale) : '-'}</td>
                <td>${_esc(b.type || 'N/A')}</td>
                <td>${b.measured === false ? '' : `<span class="size-bar" style="width:${Math.max(4, (b.size / maxSize) * 100)}px;background:#9c27b0"></span>`}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  _renderIntegrations(d) {
    if (d.integrationsAvailable === false) return `<div class="loading" role="status">${this._t.integrationListUnavailable}</div>`;
    if (!d.integrations || !d.integrations.length) return '<div class="loading">No integrations found</div>';
    const intCount = d.integrations.length;
    return `
      <div class="table-container">
        <div style="padding:12px;background:rgba(33,150,243,0.06);border-radius:8px;margin-bottom:12px;font-size:12px;color:var(--bento-text-secondary,#64748b);">
          📊 ${intCount} integrations detected. Their disk usage is N/A because the registry does not expose file sizes.
        </div>
        <table class="entity-table">
          <thead><tr>
            <th>Integration</th>
            <th>${this._label('Domain', 'Domena')}</th>
            <th>Source</th>
          </tr></thead>
          <tbody>
            ${d.integrations.slice(0, 50).map(i => `
              <tr>
                <td>${_esc(i.title || i.domain)}</td>
                <td><code style="font-size:11px;background:rgba(0,0,0,0.05);padding:2px 6px;border-radius:4px;">${_esc(i.domain)}</code></td>
                <td>${_esc(i.source || 'N/A')}</td>
              </tr>
            `).join('')}
            ${d.integrations.length > 50 ? `<tr><td colspan="3" style="text-align:center;color:var(--bento-text-secondary,#64748b);font-size:12px;">${this._label('... and', '... oraz')} ${d.integrations.length - 50} ${this._t.more}</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    `;
  }
  _renderFiles(d) {
    const L = this._lang === 'pl';
    if (!this._hass) return `<div class="loading">${this._t.noDataAvailable}</div>`;

    // A browser card cannot stat these directories. Keep their paths useful
    // without assigning percentages of unrelated host-wide disk usage.
    const knownDirs = [
      { path: '/config/', name: 'config', size: null, type: 'dir', icon: '\u{1F4C1}', desc: this._t.haConfig },
      { path: '/config/www/', name: 'www', size: null, type: 'dir', icon: '\u{1F310}', desc: this._t.staticFiles },
      { path: '/config/custom_components/', name: 'custom_components', size: null, type: 'dir', icon: '\u{1F9E9}', desc: this._t.hacsComponents },
      { path: '/config/.storage/', name: '.storage', size: null, type: 'dir', icon: '\u{1F5C4}\uFE0F', desc: this._t.haInternal },
      { path: '/backup/', name: 'backup', size: null, type: 'dir', icon: '\u{1F4BE}', desc: this._t.backups },
      { path: '/addons/', name: 'addons', size: null, type: 'dir', icon: '\u{1F4E6}', desc: this._t.addonData },
      { path: '/ssl/', name: 'ssl', size: null, type: 'dir', icon: '\u{1F512}', desc: this._t.sslCerts },
      { path: '/media/', name: 'media', size: null, type: 'dir', icon: '\u{1F3AC}', desc: this._t.mediaFiles },
      { path: '/share/', name: 'share', size: null, type: 'dir', icon: '\u{1F4C2}', desc: this._t.sharedFolder },
    ];

    // Add recorder DB as a file entry
    if (d.dbSizeMB > 0) {
      knownDirs.push({ path: '/config/home-assistant_v2.db', name: 'home-assistant_v2.db', size: d.dbSizeMB, type: 'file', icon: '\u{1F5C3}\uFE0F', desc: this._t.recorderDatabase });
    }

    // Sort by sortBy
    const sortKey = this._sortBy;
    const sortAsc = this._sortAsc;
    const sorted = [...knownDirs].sort((a, b) => {
      if (sortKey === 'name') return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      if (a.size == null) return b.size == null ? 0 : 1;
      if (b.size == null) return -1;
      return sortAsc ? a.size - b.size : b.size - a.size;
    });

    const maxSize = Math.max(...sorted.map(e => e.size || 0), 1);

    return `
      <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center;">
        <span style="font-size:12px;color:var(--bento-text-secondary,#64748b);">${this._t.sort}</span>
        <button class="sort-btn" data-sort="size" style="padding:4px 10px;font-size:11px;border:1px solid var(--bento-border,#e2e8f0);border-radius:6px;background:${sortKey === 'size' ? 'var(--bento-primary-light,rgba(59,130,246,0.08))' : 'transparent'};color:var(--bento-text-secondary,#64748b);cursor:pointer;">${this._t.size} ${sortKey === 'size' ? (sortAsc ? '\u2191' : '\u2193') : ''}</button>
        <button class="sort-btn" data-sort="name" style="padding:4px 10px;font-size:11px;border:1px solid var(--bento-border,#e2e8f0);border-radius:6px;background:${sortKey === 'name' ? 'var(--bento-primary-light,rgba(59,130,246,0.08))' : 'transparent'};color:var(--bento-text-secondary,#64748b);cursor:pointer;">${this._t.name} ${sortKey === 'name' ? (sortAsc ? '\u2191' : '\u2193') : ''}</button>
      </div>
      <div style="padding:8px 12px;background:rgba(59,130,246,0.06);border-radius:8px;margin-bottom:12px;font-size:12px;color:var(--bento-text-secondary,#64748b);">
        \u{1F4CA} ${this._t.dataLimited} &mdash;
        ${L ? 'To lista ścieżek, nie pomiar katalogów. Rozmiary: N/A; kopie mogą znajdować się także poza lokalnym dyskiem.' : 'This is a path inventory, not a directory measurement. Sizes are N/A; backups may also be stored off the local disk.'}
        ${this._t.disk} <strong>${d.diskUsed == null ? 'N/A' : d.diskUsed.toFixed(1)} / ${d.diskTotal == null ? 'N/A' : d.diskTotal.toFixed(1)} GB (${d.usedPercent == null ? 'N/A' : d.usedPercent + '%'})</strong>
        &bull; ${d.integrationsAvailable === false ? 'N/A' : (d.integrations || []).length} ${this._t.integrationsDetected}
        &bull; ${d.addonsAvailable === false ? 'N/A' : (d.addons || []).length} ${this._t.addonsText}
      </div>
      <div class="table-container">
        <table class="entity-table">
          <thead><tr>
            <th>${this._t.name}</th>
            <th>${this._t.size}</th>
            <th>${this._t.description}</th>
            <th></th>
          </tr></thead>
          <tbody>
            ${sorted.map(e => `
              <tr>
                <td>${e.icon} <code style="font-size:12px;">${_esc(e.path)}</code></td>
                <td style="white-space:nowrap;">${e.size == null ? 'N/A' : this._fmtSize(e.size)}</td>
                <td style="font-size:12px;color:var(--bento-text-secondary,#64748b);">${_esc(e.desc)}</td>
                <td>${e.size == null ? '' : `<span class="size-bar" style="width:${Math.max(4, (e.size / maxSize) * 100)}px;background:${e.type === 'file' ? '#ff9800' : '#3b82f6'}"></span>`}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  _renderTopConsumers(d) {
    // Build unified list of all individually-sized items from the richest available datasets:
    // 1) each backup (real supervisor size in MB)
    // 2) each add-on for which Supervisor supplied a positive real size
    // 3) database category when real size is available (dbSizeMB > 0)
    const items = [];

    // Backups — always have real sizes from supervisor /backups
    (d.backups || []).forEach(function(b) {
      if (b.size > 0) {
        items.push({ name: b.name || b.slug, size: b.size, icon: '\u{1F4BE}', category: 'Backup' });
      }
    });

    // Add-ons — include every positive real size supplied by Supervisor,
    // including legitimate measurements below 0.5 MB.
    (d.addons || []).forEach(function(a) {
      if (a.measured && a.size > 0) {
        items.push({ name: a.name || a.slug, size: a.size, icon: '\u{1F9E9}', category: 'Add-on' });
      }
    });

    // Recorder DB — only when real size is available
    if (d.dbSizeMB > 0) {
      items.push({ name: 'home-assistant_v2.db', size: d.dbSizeMB, icon: '\u{1F5C3}\uFE0F', category: 'Database' });
    }

    if (!items.length) {
      return `<div class="empty-state">${this._label('No positive storage size measurements available.', 'Brak dodatnich pomiarów rozmiaru zasobów.')}<br>${this._label('Unavailable and zero-size items are not ranked.', 'Niedostępne i zerowe rozmiary nie są uwzględniane w rankingu.')}</div>`;
    }

    // Sort descending by size, take top 10
    items.sort(function(a, b) { return b.size - a.size; });
    var top = items.slice(0, 10);
    var maxSize = top[0].size; // largest item = 100% bar width

    var self = this;
    var rows = top.map(function(item, idx) {
      var barPct = Math.max(2, Math.round((item.size / maxSize) * 100));
      var rankColor = idx === 0 ? 'var(--bento-error,#ef4444)' : idx < 3 ? 'var(--bento-warning,#f59e0b)' : 'var(--bento-primary,#3b82f6)';
      var categoryBg = item.category === 'Backup' ? 'rgba(156,39,176,0.10)' :
                       item.category === 'Add-on' ? 'rgba(76,175,80,0.10)' :
                       'rgba(255,152,0,0.10)';
      var categoryColor = item.category === 'Backup' ? '#9c27b0' :
                          item.category === 'Add-on' ? '#4caf50' : '#ff9800';
      return (
        '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--bento-border,#e2e8f0);">' +
          '<span style="font-size:13px;font-weight:700;color:' + rankColor + ';min-width:22px;text-align:right;font-feature-settings:\"tnum\" 1;">' + (idx + 1) + '</span>' +
          '<span style="font-size:16px;flex-shrink:0;">' + item.icon + '</span>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;font-weight:500;color:var(--bento-text,#1e293b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + _esc(item.name) + '">' + _esc(item.name) + '</div>' +
            '<div style="margin-top:5px;height:8px;background:var(--bento-border,#e2e8f0);border-radius:4px;overflow:hidden;">' +
              '<div style="width:' + barPct + '%;height:100%;border-radius:4px;background:var(--bento-primary,#3b82f6);transition:width 0.6s cubic-bezier(0.4,0,0.2,1);"></div>' +
            '</div>' +
          '</div>' +
          '<span style="font-size:12px;font-weight:600;color:var(--bento-text,#1e293b);white-space:nowrap;min-width:60px;text-align:right;font-feature-settings:\"tnum\" 1;">' + self._fmtSize(item.size) + '</span>' +
          '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:' + categoryBg + ';color:' + categoryColor + ';text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap;flex-shrink:0;">' + _esc(self._categoryLabel(item.category)) + '</span>' +
        '</div>'
      );
    }).join('');

    var addonsHaveNoMeasurements = (d.addons || []).every(function(a) { return !a.measured; });
    var note = addonsHaveNoMeasurements
      ? '<div style="margin-top:12px;padding:10px 14px;background:rgba(59,130,246,0.06);border-radius:8px;font-size:12px;color:var(--bento-text-secondary,#64748b);border-left:3px solid var(--bento-primary,#3b82f6);">\u{1F4A1} Add-on sizes are not available on this installation — only backups are shown.</div>'
      : '';

    var dbLabel = d.dbSizeMB > 0 ? ' + database' : '';
    return (
      '<div style="margin-bottom:12px;">' +
        '<div style="font-size:12px;color:var(--bento-text-secondary,#64748b);margin-bottom:16px;">' +
          this._label('Largest measured backups and add-ons: ', 'Największe zmierzone kopie i dodatki: ') + top.length + this._label('. Bars compare with the largest item: ', '. Słupki względem największego zasobu: ') + this._fmtSize(maxSize) + '.' +
        '</div>' +
        rows +
      '</div>' +
      (note ? `<div class="note-box">${this._label('No positive add-on measurements are available; ranking is limited to measured backups.', 'Brak dodatnich pomiarów dodatków; ranking obejmuje zmierzone kopie.')}</div>` : '')
    );
  }

  _renderCleanup(d) {
    const suggestions = [];
    const source = d.source === 'ha_entities' ? this._label('Selected filesystem', 'Wybrany filesystem') : 'Supervisor';
    if (d.usedPercent >= 80) suggestions.push({title: this._label('Disk usage 80% or more', 'Zajętość dysku co najmniej 80%'), desc: this._label(`${source}: ${d.usedPercent}% used. Review storage before freeing space.`, `${source}: ${d.usedPercent}% zajętego miejsca. Sprawdź zasoby przed zwalnianiem miejsca.`)});
    if (d.backupsAvailable !== false && d.backups.length > 5) suggestions.push({title: this._label('Review backup retention', 'Sprawdź retencję kopii zapasowych'), desc: this._label(`${d.backups.length} backups are listed. Review dates, locations, protection and recovery needs in Home Assistant before changing retention.`, `Liczba kopii: ${d.backups.length}. Przed zmianą retencji sprawdź daty, lokalizacje, ochronę oraz potrzeby przywracania w Home Assistant.`)});
    const stopped = d.addons.filter(a => a.state === 'stopped' && a.measured && a.size > 10);
    if (stopped.length) suggestions.push({title: this._label('Review stopped add-ons', 'Sprawdź zatrzymane dodatki'), desc: this._label(`${stopped.length} stopped add-ons have measured disk usage. Confirm whether their data is still needed.`, `Zatrzymane dodatki ze zmierzonym rozmiarem: ${stopped.length}. Sprawdź, czy ich dane są nadal potrzebne.`), savings: this._label('Measured subtotal: ', 'Zmierzona suma częściowa: ') + this._fmtSize(stopped.reduce((sum,a) => sum+a.size,0))});
    if (!suggestions.length) suggestions.push({title: this._label('Disk capacity', 'Pojemność dysku'), desc: d.usedPercent == null || d.diskFree == null ? this._label('Disk usage data is unavailable from the selected source.', 'Brak pomiaru zajętości dysku z wybranego źródła.') : this._label(`${source}: ${d.usedPercent}% used and ${d.diskFree.toFixed(1)} GB free. Category coverage is incomplete.`, `${source}: ${d.usedPercent}% zajętego miejsca i ${d.diskFree.toFixed(1)} GB wolnego. Kategorie nie obejmują całego dysku.`)});
    return suggestions.map(s => `<div class="suggestion"><div class="suggestion-title">${_esc(s.title)}</div><div class="suggestion-desc">${_esc(s.desc)}</div>${s.savings ? `<div class="suggestion-savings">${_esc(s.savings)}</div>` : ''}</div>`).join('');
  }

  _attachContentEvents() {
    this.shadowRoot.querySelectorAll('.entity-table th').forEach(th => {
      th.addEventListener('click', () => {});
    });
    // Sort buttons for files tab
    this.shadowRoot.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const newSort = btn.dataset.sort;
        if (this._sortBy === newSort) {
          this._sortAsc = !this._sortAsc;
        } else {
          this._sortBy = newSort;
          this._sortAsc = newSort === 'name';
        }
        this._updateContent();
      });
    });
  }

// --- Pagination helper ---
  _renderPagination(tabName, totalItems) {
    if (!this._currentPage[tabName]) this._currentPage[tabName] = 1;
    const pageSize = this._pageSize;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const page = Math.min(this._currentPage[tabName], totalPages);
    this._currentPage[tabName] = page;
    return `
      <div class="pagination">
        <button class="pagination-btn" data-page-tab="${tabName}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Previous page">&#8249; Prev</button>
        <span class="pagination-info">${page} / ${totalPages} (${totalItems})</span>
        <button class="pagination-btn" data-page-tab="${tabName}" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''} aria-label="Next page">Next &#8250;</button>
        <select class="page-size-select" aria-label="${this._label('Rows per page', 'Wiersze na stronę')}" data-page-tab="${tabName}" data-action="page-size">
          ${[10,15,25,50].map(s => `<option value="${s}" ${s === pageSize ? 'selected' : ''}>${s}/page</option>`).join('')}
        </select>
      </div>`;
  }

  _paginateItems(items, tabName) {
    if (!this._currentPage[tabName]) this._currentPage[tabName] = 1;
    const start = (this._currentPage[tabName] - 1) * this._pageSize;
    return items.slice(start, start + this._pageSize);
  }

  _setupPaginationListeners() {
    if (!this.shadowRoot) return;
    this.shadowRoot.querySelectorAll('.pagination-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.pageTab;
        const page = parseInt(e.target.dataset.page);
        if (tab && page > 0) {
          this._currentPage[tab] = page;
          this._render ? this._render() : (this.render ? this.render() : this.renderCard());
        }
      });
    });
    this.shadowRoot.querySelectorAll('.page-size-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        this._pageSize = parseInt(e.target.value);
        // Reset all pages to 1
        Object.keys(this._currentPage).forEach(k => this._currentPage[k] = 1);
        this._render ? this._render() : (this.render ? this.render() : this.renderCard());
      });
    });
  }

  connectedCallback() {
    this._syncTrendContext();
    _bindFamilyNavigation(this);
    // HA can reparent this instance after editing without assigning hass again.
    // Discarded measurements stay discarded; reconnect rechecks current authority
    // and starts a fresh request using the framework's existing hass reference.
    if (!this._detached) return;
    this._detached = false;
    if (this._hass) this.hass = this._hass;
  }

  disconnectedCallback() {
    this._stopPlacementV53();
    this._closeFullView(false);
    _disconnectFamilyNavigation(this);
    this._familyNavWidth = null;
    this._cancelStorageHistory();
    if (this._trendConnection?.removeEventListener) {
      this._trendConnection.removeEventListener('ready', this._trendReadyHandler);
      this._trendConnection.removeEventListener('disconnected', this._trendDisconnectHandler);
    }
    this._trendListenersBound = false;
    this._trendReady = false;
    this._trendConnection = null;
    window.removeEventListener('online', this._trendOnlineHandler);
    window.removeEventListener('offline', this._trendOfflineHandler);
    this._trendBrowserBound = false;
    this._detached = true;
    this._nativeStatus = null; this._nativeError = null;
    this._storageResult = 'not_checked';
    this._storageEpoch = (this._storageEpoch || 0) + 1;
    if (this._updateContentRAF) cancelAnimationFrame(this._updateContentRAF);
    this._updateContentRAF = null;
    this._storageData = null;
    this._loading = false;
    this._firstHassRender = false;
    const content = this.shadowRoot.getElementById('content');
    if (content) content.replaceChildren();
  }

  setActiveTab(tabId) {
    this._legacyTab = ['top', 'cleanup'].includes(tabId) ? tabId : null;
    if (tabId === 'top') this._resourcesOpen = true;
    this._cleanupOpen = false;
    this._activeTab = this._normalizeTab(tabId);
    this._render();
    this._updateContent();
  }
}

// Product-owned full view. It never locates or rewrites another card or dashboard.
class HAStorageMonitorFullView extends HTMLElement {
  constructor() { super(); this.attachShadow({mode: 'open'}); }
  open(owner, triggerId) {
    this._owner = owner; this._triggerId = triggerId; this._ownerConfig = owner._config;
    this._context = owner._storageContextKey();
    this._connection = owner._hass?.connection;
    this._wasOnline = owner._storageOnline();
    this.shadowRoot.innerHTML = '<style>:host{color-scheme:inherit}dialog{box-sizing:border-box;width:min(960px,calc(100vw - 32px));max-height:calc(100dvh - 32px);padding:12px;border:1px solid var(--divider-color,#888);border-radius:var(--ha-card-border-radius,12px);background:var(--ha-card-background,var(--card-background-color,#fff));color:var(--primary-text-color,#111);overflow:auto}dialog::backdrop{background:rgba(0,0,0,.45)}header{display:flex;align-items:center;justify-content:space-between;gap:16px}h2{font:inherit;font-size:18px}button{font:inherit;min-width:44px;min-height:44px;padding:8px 12px;border:1px solid var(--divider-color,#888);border-radius:8px;background:transparent;color:inherit}button:focus-visible{outline:3px solid var(--primary-color,#2563eb);outline-offset:2px}</style><dialog aria-labelledby="storage-full-title"><header><h2 id="storage-full-title"></h2><button type="button" id="storage-full-close"></button></header><div id="storage-full-card"></div></dialog>';
    this._dialog = this.shadowRoot.querySelector('dialog');
    this.shadowRoot.getElementById('storage-full-title').textContent = owner._config.title ?? 'Storage Monitor';
    this.shadowRoot.getElementById('storage-full-close').textContent = owner._copy('close');
    this.shadowRoot.getElementById('storage-full-close').addEventListener('click', () => this.close());
    this._dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    this._dialog.addEventListener('close', () => { if (!this._closing) this.close(); });
    this._dialog.addEventListener('keydown', event => this._keyDown(event));
    this._card = this.ownerDocument.createElement('ha-storage-monitor');
    this._card._sourceCard = owner;
    this._card.setConfig({...owner._config, variant: 'full', default_tab: owner._config.default_tab ?? 'trend', show_support: false});
    this.shadowRoot.getElementById('storage-full-card').append(this._card);
    this.syncFromOwner();
    if (!this._owner) return;
    if (typeof this._dialog.showModal === 'function') this._dialog.showModal();
    else { this._dialog.setAttribute('open', ''); this._dialog.setAttribute('role', 'dialog'); this._dialog.setAttribute('aria-modal', 'true'); }
    this.shadowRoot.getElementById('storage-full-close').focus({preventScroll: true});
  }
  syncFromOwner() {
    const owner = this._owner;
    if (!owner || this._syncing) return;
    if (!owner.isConnected || !owner._hass || owner._storageContextKey() !== this._context ||
        owner._hass.connection !== this._connection || owner._storageOnline() !== this._wasOnline) { this.close(); return; }
    this._syncing = true;
    try {
      this.shadowRoot.getElementById('storage-full-title').textContent = owner._config.title ?? 'Storage Monitor';
      this.shadowRoot.getElementById('storage-full-close').textContent = owner._copy('close');
      if (this._ownerConfig !== owner._config) {
        this._ownerConfig = owner._config;
        this._card.setConfig({...owner._config, variant: 'full', default_tab: owner._config.default_tab ?? 'trend', show_support: false});
      }
      this._card.hass = owner._hass;
      this._card._adoptSourceSnapshot();
    } finally { this._syncing = false; }
  }
  _keyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); this.close(); return; }
    if (event.key !== 'Tab') return;
    const selector = 'button:not([disabled]),select:not([disabled]),input:not([disabled]),summary,a[href]';
    const all = [...this.shadowRoot.querySelectorAll(selector), ...this._card.shadowRoot.querySelectorAll(selector)];
    const visible = node => {
      if (node.closest('[hidden]')) return false;
      const details = node.closest('details:not([open])');
      if (details && node !== details.querySelector('summary')) return false;
      return getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden';
    };
    const focusable = all.filter(visible);
    let active = this.ownerDocument.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && active === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first?.focus(); }
  }
  close(restoreFocus = true) {
    if (this._closing) return;
    this._closing = true;
    const owner = this._owner, triggerId = this._triggerId;
    this._owner = null;
    if (owner?._fullView === this) owner._fullView = null;
    if (this._card) { this._card.hass = null; this._card.remove(); this._card._sourceCard = null; this._card = null; }
    if (this._dialog?.open && typeof this._dialog.close === 'function') this._dialog.close();
    this.remove();
    if (restoreFocus && owner?.isConnected) owner.shadowRoot.getElementById(triggerId)?.focus({preventScroll: true});
  }
  disconnectedCallback() { if (!this._closing) this.close(false); }
}
if (!customElements.get('ha-storage-monitor-full-view')) customElements.define('ha-storage-monitor-full-view', HAStorageMonitorFullView);

if (!customElements.get('ha-storage-monitor')) customElements.define('ha-storage-monitor', HAStorageMonitor);

console.info(
  '%c  HA-STORAGE-MONITOR  %c v4.2.0 ',
  'background: #4caf50; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;',
  'background: #e8f5e9; color: #4caf50; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;'
);

class HaStorageMonitorEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }
  setConfig(config) {
    this._config = { ...config };
    this._nativeEditorGuard?.observe();
    this._render(false);
  }
  set hass(hass) {
    const language = (hass?.locale?.language || hass?.language)?.startsWith('pl') ? 'pl' : 'en';
    this._hass = hass;
    this._nativeEditorGuard?.observe();
    if (this._nativeEditorStatus && Date.now() - this._nativeEditorStatus.readAt > 3600000) { this._nativeEditorStatus = null; this._render(); }
    this.classList.toggle('bento-dark', hass?.themes?.darkMode === true);
    createUiV3({language}).applyTheme(this);
    const sourceKey = JSON.stringify([hass?.user?.id, hass?.user?.is_admin === true, hass?.user?.is_active !== false, this._editorHistorySources().map(([id, state]) => [id, state.attributes.unit_of_measurement])]);
    if (this._language === language && this._sourceKey === sourceKey) return;
    this._language = language;
    this._sourceKey = sourceKey;
    this._render();
  }
  _ensureNativeEditorGuard() {
    if (!this._nativeEditorGuard) {
      this._nativeEditorGuard = createTariffGuardV3({getHass: () => this._hass,
        getContext: () => ({entry: this._config.backend_entry_id || null}), browser: window});
      this._nativeEditorGuard.subscribe(() => {
        this._nativeEditorStatus = null;
        if (this.isConnected) this._render();
      });
      this._nativeEditorGuard.subscribeWire(() => { if (this.isConnected) this._render(); });
    }
    return this._nativeEditorGuard;
  }
  _loadNativeEditorSources() {
    if (this._nativeEditorPending) return this._nativeEditorPending;
    const guard = this._ensureNativeEditorGuard(), token = guard.snapshot();
    if (!this.isConnected || !guard.current(token, true) || guard.occupied()) return Promise.resolve();
    this._nativeEditorError = false;
    const work = (async () => {
      try {
        const result = await guard.call(token, {type: 'ha_storage_monitor/status',
          ...(this._config.backend_entry_id ? {entry_id: this._config.backend_entry_id} : {})}, true);
        if (!this.isConnected || !guard.current(token, true)) return;
        this._nativeEditorStatus = _StorageBackend.validateStatus(result,
          {entryId: this._config.backend_entry_id, nowMs: Date.now()});
      } catch (_) {
        if (this.isConnected && guard.current(token, true)) { this._nativeEditorStatus = null; this._nativeEditorError = true; }
      } finally {
        if (this._nativeEditorPending === work) this._nativeEditorPending = null;
        if (this.isConnected) this._render();
      }
    })();
    this._nativeEditorPending = work;
    this._render();
    return work;
  }
  _nativeEditorFields() {
    const pl = this._language === 'pl', text = (en, polish) => pl ? polish : en;
    if (this._hass?.user?.is_admin !== true || this._hass.user.is_active === false) return '';
    const mode = this._config.data_source || 'auto', source = this._config.backend_source || 'auto';
    const items = this._nativeEditorStatus?.sources || [], selected = items.some(item => item.source.source_uuid === source);
    const option = (value, label, current) => '<option value="' + _esc(value) + '" ' + (value === current ? 'selected' : '') + '>' + _esc(label) + '</option>';
    return '<fieldset class="history-editor"><legend>' + text('Storage data source', 'Źródło danych dysku') + '</legend><label>' +
      text('Read measurements from', 'Odczytuj pomiary z') + '<select id="cf_data_source">' +
      [['auto', text('Automatic — keep an existing explicit sensor selection', 'Automatycznie — zachowaj dotychczasowy jawny wybór sensorów')],
       ['native', text('Storage Monitor integration', 'Integracja Storage Monitor')],
       ['legacy', text('Existing sensors / Supervisor', 'Istniejące sensory / Supervisor')]].map(([v,l]) => option(v,l,mode)).join('') +
      (!['auto','native','legacy'].includes(mode) ? option(mode,mode,mode) : '') + '</select></label><p>' +
      text('The integration samples filesystems visible to the HA process. It provides history and a limited fill estimate; it does not measure category sizes or remote NAS disks. Configure the available filesystems in Settings → Devices & services → Storage Monitor.',
        'Integracja próbkuje systemy plików widoczne dla procesu HA. Zapewnia historię i ograniczoną prognozę zapełnienia; nie mierzy rozmiarów kategorii ani zdalnych dysków NAS. Dostępne systemy plików skonfiguruj w Ustawienia → Urządzenia i usługi → Storage Monitor.') +
      '</p><button type="button" data-native-editor-load ' + (this._nativeEditorPending || this._nativeEditorGuard?.occupied() ? 'disabled' : '') + '>' +
      text('Load configured filesystems', 'Wczytaj skonfigurowane systemy plików') + '</button><label>' + text('Filesystem', 'System plików') +
      '<select id="cf_backend_source">' + option('auto',text('Automatic only when exactly one source is configured', 'Automatycznie tylko przy jednym skonfigurowanym źródle'),source) +
      (source !== 'auto' && !selected ? option(source,source + ' · ' + text('not loaded / unavailable','niewczytany / niedostępny'),source) : '') +
      items.map(item => option(item.source.source_uuid,item.source.label + ' · ' + item.source.source_uuid,source)).join('') + '</select></label>' +
      (this._nativeEditorError ? '<p role="status">' + text('Sources could not be loaded. Check integration setup and administrator access, then try again.',
        'Nie udało się wczytać źródeł. Sprawdź konfigurację integracji i uprawnienia administratora, potem spróbuj ponownie.') + '</p>' : '') + '</fieldset>';
  }
  _editorHistorySources() {
    if (this._hass?.user?.is_admin !== true || this._hass.user.is_active === false) return [];
    return Object.entries(this._hass?.states || {}).filter(([id, state]) => id.startsWith('sensor.') &&
      state?.attributes?.device_class === 'data_size' && Object.hasOwn(STORAGE_HISTORY_UNITS, state.attributes.unit_of_measurement || '')).sort(([a], [b]) => a.localeCompare(b));
  }
  _historyEditorFields() {
    const pl = this._language === 'pl', c = this._config.measured_history || {};
    const label = (en, polish) => pl ? polish : en;
    if (this._hass?.user?.is_admin !== true || this._hass.user.is_active === false) return `<p>${label('Storage history configuration requires a Home Assistant administrator.', 'Konfiguracja historii dysku wymaga administratora Home Assistant.')}</p>`;
    const field = (key, title) => {
      const sources = this._editorHistorySources();
      const selected = c[key] || '';
      return `<label>${title}<select id="cf_${key}"><option value="">${label('Select existing sensor', 'Wybierz istniejący sensor')}</option>${selected && !sources.some(([id]) => id === selected) ? `<option value="${_esc(selected)}" selected>${_esc(selected)} · ${label('unavailable', 'niedostępny')}</option>` : ''}${sources.map(([id, state]) => `<option value="${_esc(id)}" ${id === selected ? 'selected' : ''}>${_esc(id)} · ${_esc(state.attributes.unit_of_measurement)}</option>`).join('')}</select></label>`;
    };
    return `<fieldset class="history-editor"><legend>${label('Measured Recorder history (administrator)', 'Zmierzona historia Recorder (administrator)')}</legend><p>${label('Use two existing recorded data-size sensors for the same filesystem. This card reads them; it does not create sensors.', 'Użyj dwóch istniejących, zapisywanych sensorów rozmiaru tego samego filesystemu. Karta je odczytuje; nie tworzy sensorów.')}</p>${field('used_entity',label('Used sensor', 'Sensor użycia'))}${field('total_entity',label('Capacity sensor', 'Sensor pojemności'))}<label>${label('Filesystem / scope', 'Filesystem / zakres')}<input id="cf_scope" type="text" value="${_esc(c.scope ?? '')}"></label><label class="history-confirm"><input id="cf_same_filesystem" type="checkbox" ${c.same_filesystem === true ? 'checked' : ''}>${label('I confirm both sources measure the same filesystem', 'Potwierdzam, że oba źródła mierzą ten sam filesystem')}</label><p>${label('Loading history does not prove Recorder retention or completeness. Source pairing is your explicit confirmation.', 'Pobranie historii nie dowodzi retencji ani kompletności Recorder. Powiązanie źródeł wymaga Twojego jawnego potwierdzenia.')}</p></fieldset>`;
  }
  _presentationEditorFields() {
    const copy = key => STORAGE_PRESENTATION_TEXT[this._language === 'pl' ? 'pl' : 'en'][key];
    const pl = this._language === 'pl';
    const select = (key, choices, absent, absentLabel) => {
      const has = Object.hasOwn(this._config, key), value = has ? String(this._config[key]) : absent;
      const unknown = has && !choices.some(([id]) => id === value);
      return '<select id="cf_' + key + '"><option value="' + absent + '" ' + (!has ? 'selected' : '') + '>' +
        absentLabel + '</option>' + (unknown ? '<option value="' + _esc(value) + '" selected>' + _esc(value) +
          ' · ' + copy('variantUnknown') + '</option>' : '') +
        choices.map(([id, label]) => '<option value="' + id + '" ' + (has && value === id ? 'selected' : '') + '>' + label + '</option>').join('') +
        '</select>';
    };
    return '<fieldset class="history-editor"><legend>' + (pl ? 'Prezentacja' : 'Presentation') + '</legend>' +
      '<label>' + copy('variant') + select('variant', [['tile','Tile'],['compact','Compact'],['full','Full']], '__legacy__', copy('legacyFull')) +
      '</label><label>' + copy('defaultTab') + select('default_tab', [
        ['overview',pl ? 'Przegląd' : 'Overview'],['addons',pl ? 'Dodatki i integracje' : 'Add-ons and integrations'],
        ['backups',pl ? 'Kopie zapasowe' : 'Backups'],['files',copy('resources')],['trend',copy('historyTitle')]
      ], '__saved__', copy('savedDefault')) + '</label><p>' + copy('defaultTabHelp') + '</p></fieldset>';
  }
  _dispatch() {
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config }, bubbles: true, composed: true }));
  }
  _render(preserveDraft = true) {
    if (this._composing) { this._renderPending = true; return; }
    const active = this.shadowRoot.activeElement;
    const draft = preserveDraft && active?.matches('input[type=text]') ? {id: active.id, value: active.value} : null;
    const familyFocus = _rememberFamilyEditorFocus(this);
    this.shadowRoot.innerHTML = `
      <style>${createUiV3({language:this._language}).css}${_FAMILY_CONTROL_CSS}${STORAGE_PRESENTATION_CSS}
            :host { display:block; padding:16px; }
            h3 { margin:0 0 16px; font-size:15px; font-weight:600; color:var(--bento-text, var(--primary-text-color,#1e293b)); }
            input { outline:none; transition:border-color .2s; }
            input:focus { border-color:var(--bento-primary, var(--primary-color,#3b82f6)); }
            .history-editor { border:1px solid var(--divider-color,#ddd); border-radius:8px; margin-top:16px; min-width:0; }
            .history-editor label { display:flex; flex-direction:column; gap:5px; margin:12px 0; font-size:13px; }
            .history-editor input,.history-editor select { min-height:44px; width:100%; max-width:100%; box-sizing:border-box; background:var(--card-background-color,#fff); color:var(--primary-text-color,#222); border:1px solid var(--divider-color,#aaa); border-radius:6px; padding:8px; }
            .history-editor .history-confirm { flex-direction:row; align-items:center; }.history-confirm input { width:24px; min-width:24px; }
            .history-editor p { font-size:13px; line-height:1.5; color:var(--secondary-text-color,#555); }
        </style>
      <h3>Storage Monitor</h3>
            <div style="margin-bottom:12px;">
              <label for="cf_title" style="display:block;font-weight:500;margin-bottom:4px;font-size:13px;">${this._language?.startsWith('pl') ? 'Tytuł' : 'Title'}</label>
              <input type="text" id="cf_title" value="${_esc(this._config?.title ?? 'Storage Monitor')}"
                style="width:100%;padding:8px 12px;border:1px solid var(--divider-color,#e2e8f0);border-radius:8px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#1e293b);font-size:14px;box-sizing:border-box;">
            </div>
            ${this._presentationEditorFields()}
            ${this._nativeEditorFields()}
            ${this._historyEditorFields()}
    `;
    if (draft) { const input = this.shadowRoot.getElementById(draft.id); if (input) input.value = draft.value; }
    _restoreFamilyEditorFocus(this, familyFocus);
    for (const input of this.shadowRoot.querySelectorAll('input[type=text]')) {
      input.addEventListener('compositionstart', () => { this._composing = true; });
      input.addEventListener('compositionend', () => { this._composing = false; if (this._renderPending) { this._renderPending = false; this._render(); } });
    }
    this.shadowRoot.querySelector('[data-native-editor-load]')?.addEventListener('click', () => this._loadNativeEditorSources());
    for (const key of ['data_source', 'backend_source']) this.shadowRoot.getElementById('cf_' + key)?.addEventListener('change', event => {
      const guard = this._ensureNativeEditorGuard(), token = guard.snapshot();
      if (!this.isConnected || !guard.current(token, true)) return;
      const value = event.target.value;
      if (key === 'data_source' && !['auto','native','legacy'].includes(value)) return;
      if (key === 'backend_source' && value !== 'auto' &&
          !this._nativeEditorStatus?.sources.some(item => item.source.source_uuid === value)) return;
      this._config = {...this._config, [key]: value, ...(key === 'backend_source' ? {data_source: 'native'} : {})};
      this._dispatch(); this._render();
    });
    for (const key of ['variant', 'default_tab']) this.shadowRoot.getElementById('cf_' + key)?.addEventListener('change', event => {
      const next = {...this._config}, value = event.target.value;
      if (value === '__legacy__' || value === '__saved__') delete next[key];
      else next[key] = value;
      this._config = next; this._dispatch();
    });
        const f_title = this.shadowRoot.querySelector('#cf_title');
        if (f_title) f_title.addEventListener('input', (e) => {
          this._config = { ...this._config, title: e.target.value };
          this._dispatch();
        });
    for (const key of ['used_entity', 'total_entity', 'scope', 'same_filesystem']) {
      this.shadowRoot.querySelector('#cf_' + key)?.addEventListener(key === 'scope' ? 'input' : 'change', event => {
        this._config = {...this._config, measured_history: {...this._config.measured_history,
          [key]: key === 'same_filesystem' ? event.target.checked : event.target.value,
          ...(key === 'same_filesystem' ? {} : {same_filesystem: false})}};
        if (key !== 'same_filesystem') this.shadowRoot.querySelector('#cf_same_filesystem').checked = false;
        this._dispatch();
      });
    }
  }
  connectedCallback() { this._ensureNativeEditorGuard().resume(); this._render(); }
  disconnectedCallback() { this._nativeEditorStatus = null; this._nativeEditorGuard?.suspend(); }
}
if (!customElements.get('ha-storage-monitor-editor')) { customElements.define('ha-storage-monitor-editor', HaStorageMonitorEditor); }

})();

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'ha-storage-monitor',
  name: 'Storage Monitor',
  description: 'WinDirStat-like storage visualization for Home Assistant',
  preview: true
});
