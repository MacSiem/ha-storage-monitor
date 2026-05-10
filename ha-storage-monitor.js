/* HA Tools split — ha-storage-monitor v4.0.0 (2026-05-10) — single-tool standalone repo */
(function() {
'use strict';

// -- HA Tools Persistence (stub -- full impl in ha-tools-panel.js) --
window._haToolsPersistence = window._haToolsPersistence || { _cache: {}, _hass: null, setHass(h) { this._hass = h; }, async save(k, d) { try { localStorage.setItem('ha-storage-monitor-' + k, JSON.stringify(d)); } catch(e) { console.debug('[ha-storage-monitor] caught:', e); } }, async load(k) { try { const r = localStorage.getItem('ha-storage-monitor-' + k); return r ? JSON.parse(r) : null; } catch(e) { return null; } }, loadSync(k) { try { const r = localStorage.getItem('ha-storage-monitor-' + k); return r ? JSON.parse(r) : null; } catch(e) { return null; } } };

const _esc = window._haToolsEsc || ((s) => typeof s === 'string' ? s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]) : (s ?? ''));

/**
 * HA Storage Monitor - WinDirStat-like storage visualization for Home Assistant
 * Shows disk usage with treemap visualization, directory breakdown, and cleanup suggestions
 */
/* ===== HA Tools split — inline shared infrastructure ===== */
// Bento Design System CSS (inline copy — keeps tool standalone)
if (typeof window !== 'undefined' && !window.HAToolsBentoCSS) {
  window.HAToolsBentoCSS = `
/* ═══════════════════════════════════════════════
   HA Tools — Bento Design System v1.0
   ═══════════════════════════════════════════════ */

/* ── CSS Custom Properties ───────────────────── */
:host {
  /* Primary palette */
  --bento-primary: #3B82F6;
  --bento-primary-hover: #2563EB;
  --bento-primary-light: rgba(59, 130, 246, 0.08);
  --bento-success: #10B981;
  --bento-success-light: rgba(16, 185, 129, 0.08);
  --bento-error: #EF4444;
  --bento-error-light: rgba(239, 68, 68, 0.08);
  --bento-warning: #F59E0B;
  --bento-warning-light: rgba(245, 158, 11, 0.08);

  /* Theme — maps to HA theme vars with light fallbacks */
  --bento-bg: var(--primary-background-color, #F8FAFC);
  --bento-card: var(--card-background-color, #FFFFFF);
  --bento-border: var(--divider-color, #E2E8F0);
  --bento-text: var(--primary-text-color, #1E293B);
  --bento-text-secondary: var(--secondary-text-color, #64748B);
  --bento-text-muted: var(--disabled-text-color, #94A3B8);

  /* Radii */
  --bento-radius-xs: 6px;
  --bento-radius-sm: 10px;
  --bento-radius-md: 16px;

  /* Shadows */
  --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
  --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04);
  --bento-shadow-lg: 0 8px 25px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.04);

  /* Transition */
  --bento-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  /* Typography */
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  display: block;
  color: var(--bento-text);
}

/* ── Dark mode ───────────────────────────────── */
@media (prefers-color-scheme: dark) {
  :host {
    --bento-bg: var(--primary-background-color, #1a1a2e);
    --bento-card: var(--card-background-color, #16213e);
    --bento-border: var(--divider-color, #2a2a4a);
    --bento-text: var(--primary-text-color, #e0e0e0);
    --bento-text-secondary: var(--secondary-text-color, #a0a0b0);
    --bento-text-muted: var(--disabled-text-color, #6a6a7a);
    --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
    --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.4);
    --bento-primary-light: rgba(59,130,246,0.15);
    --bento-success-light: rgba(16,185,129,0.15);
    --bento-error-light: rgba(239,68,68,0.15);
    --bento-warning-light: rgba(245,158,11,0.15);
    color-scheme: dark !important;
  }
  .card, .card-container, .main-card, .exporter-card, .security-card, .reports-card, .storage-card, .chore-card, .cry-card, .backup-card, .network-card, .sentence-card, .energy-card, .panel-card {
    background: var(--bento-card) !important; color: var(--bento-text) !important; border-color: var(--bento-border) !important;
  }
  input, select, textarea { background: var(--bento-bg); color: var(--bento-text); border-color: var(--bento-border); }
  .stat, .stat-card, .summary-card, .metric-card, .kpi-card, .health-card { background: var(--bento-bg); border-color: var(--bento-border); }
  .tab-content, .section { color: var(--bento-text); }
  table th { background: var(--bento-bg); color: var(--bento-text-secondary); border-color: var(--bento-border); }
  table td { color: var(--bento-text); border-color: var(--bento-border); }
  tr:hover td { background: rgba(59,130,246,0.08); }
  .empty-state, .no-data { color: var(--bento-text-secondary); }
  .schedule-section, .settings-section, .detail-panel, .details, .device-detail { background: var(--bento-bg); border-color: var(--bento-border); }
  .addon-list, .content-item { background: rgba(255,255,255,0.05); }
  .chart-container { background: var(--bento-bg); border-color: var(--bento-border); }
  pre, code { background: #1e293b !important; color: #e2e8f0 !important; }
}

/* ── Reset ───────────────────────────────────── */
* { box-sizing: border-box; }

/* ── Main Card Wrapper ───────────────────────── */
.card {
  background: var(--bento-card);
  border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-md);
  box-shadow: var(--bento-shadow-sm);
  color: var(--bento-text);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Header ──────────────────────────────────── */
.header {
  padding: 16px 20px 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.header-icon { font-size: 22px; }
.header-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--bento-text);
}
.header-badge {
  margin-left: auto;
  background: var(--bento-border);
  color: var(--bento-text-secondary);
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 20px;
  font-weight: 500;
}
.content { padding: 16px 20px 20px; }

/* ── Tabs (Bento unified) ────────────────────── */
.tabs, .tab-bar, .tab-nav, .tab-header {
  display: flex !important;
  gap: 4px !important;
  border-bottom: 2px solid var(--bento-border, var(--divider-color, #334155)) !important;
  padding: 0 4px !important;
  margin-bottom: 20px !important;
  overflow-x: auto !important; overflow-y: hidden !important; -webkit-overflow-scrolling: touch !important;
  flex-wrap: nowrap !important;
}
.tab, .tab-btn, .tab-button, .dtab {
  padding: 10px 18px !important;
  border: none !important;
  background: transparent !important;
  cursor: pointer !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  font-family: 'Inter', sans-serif !important;
  color: var(--bento-text-secondary, var(--secondary-text-color, #94A3B8)) !important;
  border-bottom: 2px solid transparent !important;
  margin-bottom: -2px !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  white-space: nowrap !important;
  border-radius: 0 !important;
  flex: none !important;
}
.tab:hover, .tab-btn:hover, .tab-button:hover, .dtab:hover {
  color: var(--bento-primary, #3B82F6) !important;
  background: rgba(59, 130, 246, 0.08) !important;
}
.tab.active, .tab-btn.active, .tab-button.active, .dtab.active {
  color: var(--bento-primary, #3B82F6) !important;
  border-bottom-color: var(--bento-primary, #3B82F6) !important;
  background: rgba(59, 130, 246, 0.04) !important;
  font-weight: 600 !important;
}

/* ── Tab content animation ───────────────────── */
.tab-content {
  display: block;
}
.tab-content.active {
  animation: bentoFadeIn 0.3s ease-out;
}
@keyframes bentoFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Stat / KPI cards ────────────────────────── */
.stat-card, .stat-item, .metric-card, .kpi-card {
  background: var(--bento-card, var(--card-background-color, #1E293B)) !important;
  border: 1px solid var(--bento-border, var(--divider-color, #334155)) !important;
  border-radius: var(--bento-radius-sm, 10px) !important;
  padding: 16px !important;
  text-align: center !important;
  transition: var(--bento-transition);
}
.stat-card:hover, .stat-item:hover, .metric-card:hover, .kpi-card:hover {
  box-shadow: var(--bento-shadow-md);
}
.stat-icon { font-size: 20px; margin-bottom: 4px; }
.stat-value, .stat-val, .metric-value, .kpi-val {
  font-size: 22px;
  font-weight: 700;
  color: var(--bento-text);
}
.stat-label, .stat-lbl, .metric-label, .kpi-lbl {
  font-size: 11px;
  color: var(--bento-text-secondary);
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
}

/* ── Overview grid (2×2 stat layout) ─────────── */
.overview-grid, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 16px;
}

/* ── Section headers ─────────────────────────── */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--bento-text-secondary);
  text-transform: uppercase;
  letter-spacing: .5px;
  margin: 12px 0 8px;
}

/* ── Loading / Empty / Info ──────────────────── */
.loading-bar {
  height: 3px;
  background: linear-gradient(90deg, var(--bento-primary), transparent);
  border-radius: 2px;
  animation: bentoLoad 1s infinite;
  margin-bottom: 8px;
}
@keyframes bentoLoad { 0% { background-position: 0; } 100% { background-position: 200px; } }

.empty-state, .no-data, .no-results {
  text-align: center;
  color: var(--bento-text-secondary);
  padding: 32px 16px;
  font-size: 13px;
  background: var(--bento-bg);
  border-radius: var(--bento-radius-sm);
}
.info-note, .tip-box {
  font-size: 12px;
  color: var(--bento-text-secondary);
  background: var(--bento-bg);
  border-radius: var(--bento-radius-sm);
  padding: 8px 10px;
  border-left: 3px solid var(--bento-primary);
  margin-top: 8px;
}
.last-updated {
  font-size: 11px;
  color: var(--bento-text-muted);
  text-align: right;
  margin-top: 8px;
}

/* ── Buttons ─────────────────────────────────── */
.refresh-btn {
  background: var(--bento-border);
  border: none;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  color: var(--bento-text-secondary);
  cursor: pointer;
  font-weight: 500;
  transition: var(--bento-transition);
}
.refresh-btn:hover { background: var(--bento-primary); color: white; }

.toggle-btn, .action-btn {
  background: var(--bento-primary);
  border: none;
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  color: white;
  cursor: pointer;
  font-weight: 500;
  transition: var(--bento-transition);
}
.toggle-btn:hover, .action-btn:hover { opacity: .85; }

.send-btn, .btn-primary {
  width: 100%;
  background: var(--bento-primary);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--bento-transition);
}
.send-btn:hover, .btn-primary:hover {
  background: var(--bento-primary-hover);
  transform: translateY(-1px);
}
.send-btn:active, .btn-primary:active { transform: translateY(0); }
.send-btn:disabled, .btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* ── Badges / Status ─────────────────────────── */
.badge, .status-badge, .tag, .chip {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  display: inline-block;
}
.badge-ok, .badge-success { background: var(--bento-success-light); color: var(--bento-success); }
.badge-er, .badge-error   { background: var(--bento-error-light);   color: var(--bento-error); }
.badge-warn, .badge-warning { background: var(--bento-warning-light); color: var(--bento-warning); }
.badge-info { background: var(--bento-primary-light); color: var(--bento-primary); }

/* ── Count badges (inline) ───────────────────── */
.count-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
}
.error-badge { background: rgba(239,68,68,0.13); color: var(--bento-error); }
.warn-badge  { background: rgba(245,158,11,0.13); color: var(--bento-warning); }
.info-badge  { background: rgba(59,130,246,0.13); color: var(--bento-primary); }
.ok-badge    { background: rgba(16,185,129,0.13); color: var(--bento-success); }

/* ── Tables ───────────────────────────────────── */
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th {
  background: var(--bento-bg);
  color: var(--bento-text-secondary);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 10px 14px;
  text-align: left;
  border-bottom: 2px solid var(--bento-border);
}
td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--bento-border);
  color: var(--bento-text);
  font-size: 13px;
}
tr:hover td { background: var(--bento-primary-light); }

/* ── Forms / Inputs ──────────────────────────── */
input, select, textarea {
  padding: 8px 12px;
  border: 1.5px solid var(--bento-border);
  border-radius: var(--bento-radius-xs);
  background: var(--bento-card);
  color: var(--bento-text);
  font-size: 13px;
  font-family: 'Inter', sans-serif;
  transition: var(--bento-transition);
  outline: none;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--bento-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* ── Code blocks ─────────────────────────────── */
code {
  background: var(--bento-border);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 12px;
}
pre {
  background: #1e293b;
  color: #e2e8f0;
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
  overflow-x: auto;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── Grid layouts ────────────────────────────── */
.schedule-grid, .send-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.schedule-card, .send-card, .info-card {
  background: var(--bento-bg);
  border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-sm);
  padding: 14px;
}

/* ── Log entries ─────────────────────────────── */
.log-entry {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 4px 6px;
  padding: 8px;
  border-radius: var(--bento-radius-sm);
  margin-bottom: 4px;
  font-size: 12px;
  min-width: 0;
  overflow: hidden;
}
.error-entry { background: var(--bento-error-light); border: 1px solid rgba(239,68,68,0.13); }
.warn-entry  { background: var(--bento-warning-light); border: 1px solid rgba(245,158,11,0.13); }
.log-time { color: var(--bento-text-muted); flex-shrink: 0; }
.log-domain {
  font-weight: 600;
  flex-shrink: 1;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
}
.error-domain { color: var(--bento-error); }
.warn-domain  { color: var(--bento-warning); }
.log-msg {
  color: var(--bento-text-secondary);
  flex-basis: 100%;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  min-width: 0;
}

/* ── Send status ─────────────────────────────── */
.send-status {
  padding: 10px 14px;
  border-radius: var(--bento-radius-sm);
  margin-top: 12px;
  font-size: 13px;
  font-weight: 500;
  text-align: center;
}
.send-status.sending { background: var(--bento-primary-light); color: var(--bento-primary); }
.send-status.success { background: var(--bento-success-light); color: var(--bento-success); }
.send-status.error   { background: var(--bento-error-light);   color: var(--bento-error); }

/* ── Scrollbar ───────────────────────────────── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bento-border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--bento-text-muted); }

/* ── Animations ──────────────────────────────── */
@keyframes bentoSpin { to { transform: rotate(360deg); } }
@keyframes bentoPulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }

/* ── Mobile — 768 px ─────────────────────────── */
@media (max-width: 768px) {
  .content { padding: 12px; }
  .tabs { flex-wrap: nowrap !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; gap: 2px !important; }
  .tab, .tab-button, .tab-btn { padding: 6px 10px !important; font-size: 12px !important; white-space: nowrap !important; }
  .overview-grid, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .stat-value, .stat-val, .kpi-val, .metric-val { font-size: 18px !important; }
  .stat-label, .stat-lbl, .kpi-lbl, .metric-lbl { font-size: 10px !important; }
  .send-grid, .schedule-grid { grid-template-columns: 1fr; }
  .log-entry { flex-wrap: wrap; gap: 2px 6px; }
  .log-domain { max-width: 60%; font-size: 11px; }
  .log-msg { flex-basis: 100%; max-width: 100%; overflow-wrap: anywhere; font-size: 11px; }
  pre { white-space: pre-wrap; word-break: break-all; max-width: calc(100vw - 80px); overflow-x: auto; }
  .panels, .board { flex-direction: column; }
  .column { min-width: unset; }
  h2 { font-size: 18px; }
  h3 { font-size: 15px; }
}

/* ── Mobile — 480 px ─────────────────────────── */
@media (max-width: 480px) {
  .tabs { gap: 1px !important; }
  .tab, .tab-button, .tab-btn { padding: 5px 8px !important; font-size: 11px !important; }
  .overview-grid, .stats-grid, .summary-grid { grid-template-columns: 1fr 1fr; }
  .stat-value, .stat-val, .kpi-val { font-size: 16px !important; }
}
`;
}
// XSS escape singleton (idempotent)
if (typeof window !== 'undefined') {
  window._haToolsEsc = window._haToolsEsc || (function(){
    var MAP = {};
    MAP[String.fromCharCode(38)] = '&amp;';
    MAP[String.fromCharCode(60)] = '&lt;';
    MAP[String.fromCharCode(62)] = '&gt;';
    MAP[String.fromCharCode(34)] = '&quot;';
    MAP[String.fromCharCode(39)] = '&#39;';
    return function(s){ return typeof s === 'string' ? s.replace(/[&<>"']/g, function(c){ return MAP[c]; }) : (s == null ? '' : s); };
  })();
}
// Universal donate footer injector — guarantees the support box appears
// on every split-tool card regardless of internal render state.
if (typeof window !== 'undefined' && !window.__haToolsSplitDonateInjector) {
  window.__haToolsSplitDonateInjector = true;
  var SPLIT_TAGS = ['ha-purge-cache','ha-yaml-checker','ha-data-exporter','ha-baby-tracker','ha-chore-tracker','ha-energy-optimizer','ha-energy-insights','ha-energy-email','ha-log-email','ha-smart-reports','ha-network-map','ha-trace-viewer','ha-automation-analyzer','ha-storage-monitor','ha-backup-manager','ha-security-check','ha-device-health','ha-sentence-manager','ha-encoding-fixer','ha-entity-renamer','ha-frigate-privacy','ha-vacuum-water-monitor'];
  var DONATE_HTML = ''
    + '<div class="donate-section" data-source="ha-tools-split-injector">'
    + '  <div class="donate-text">'
    + '    <h3>❤️ Support HA Tools Development</h3>'
    + '    <p>If this tool makes your Home Assistant life easier, consider supporting the project. Every coffee motivates further development!</p>'
    + '  </div>'
    + '  <div class="donate-buttons">'
    + '    <a class="donate-btn coffee" href="https://buymeacoffee.com/macsiem" target="_blank" rel="noopener noreferrer">☕ Buy Me a Coffee</a>'
    + '    <a class="donate-btn paypal" href="https://www.paypal.com/donate/?hosted_button_id=Y967H4PLRBN8W" target="_blank" rel="noopener noreferrer">💳 PayPal</a>'
    + '  </div>'
    + '</div>';
  function deepFindAll(tag, root) {
    var out = [];
    (function walk(node){
      if (!node || !node.querySelectorAll) return;
      var children = node.querySelectorAll('*');
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c.tagName && c.tagName.toLowerCase() === tag) out.push(c);
        if (c.shadowRoot) walk(c.shadowRoot);
      }
    })(root || document);
    return out;
  }
  // Per-tool prerequisite check + inline install banner
  var PREREQS = {
    'ha-energy-email': { service: 'ha_tools_email', repo: 'ha-tools-email-integration', label: 'HA Tools Email integration', kind: 'integration' },
    'ha-log-email':    { service: 'ha_tools_email', repo: 'ha-tools-email-integration', label: 'HA Tools Email integration', kind: 'integration' },
    'ha-encoding-fixer': { shellCommand: 'fix_encoding', label: 'shell_command.fix_encoding (optional advanced feature)', kind: 'shell_command_optional' }
  };
  var PREREQ_HTML_CACHE = {};
  function buildPrereqBanner(tag, prereq, hass) {
    if (PREREQ_HTML_CACHE[tag]) return PREREQ_HTML_CACHE[tag];
    var html = '';
    if (prereq.kind === 'integration') {
      html = '<div class="prereq-banner prereq-error" data-prereq="' + tag + '">' +
        '<div class="prereq-icon">⚠️</div>' +
        '<div class="prereq-text">' +
          '<strong>This tool requires the ' + prereq.label + '</strong><br>' +
          'Install it from HACS: <code>https://github.com/MacSiem/' + prereq.repo + '</code> ' +
          '(Category: <strong>Integration</strong>) — then add <code>' + prereq.service + ':</code> to your <code>configuration.yaml</code> and restart HA.' +
        '</div>' +
        '<a class="prereq-cta" href="https://github.com/MacSiem/' + prereq.repo + '" target="_blank" rel="noopener noreferrer">Open install guide ↗</a>' +
      '</div>';
    } else if (prereq.kind === 'shell_command_optional') {
      html = '<div class="prereq-banner prereq-info" data-prereq="' + tag + '">' +
        '<div class="prereq-icon">💡</div>' +
        '<div class="prereq-text">' +
          '<strong>Optional advanced feature: deep file scan</strong><br>' +
          'To enable scanning of <code>configuration.yaml</code> files, install the bundled <code>encoding_scanner.py</code> + add <code>shell_command:</code> entries. See README.' +
        '</div>' +
      '</div>';
    }
    PREREQ_HTML_CACHE[tag] = html;
    return html;
  }
  function injectAll() {
    SPLIT_TAGS.forEach(function(tag){
      deepFindAll(tag).forEach(function(el){
        // panel_custom auto-init: HA assigns hass/panel/narrow but does not always call setConfig.
        if (typeof el.setConfig === 'function' && !el.config && !el._config) {
          try { el.setConfig({ type: 'custom:' + tag, title: tag }); } catch(e) {}
        }
        if (!el.shadowRoot) return;
        // 1) Prereq banner — checked every poll so it disappears when prereq becomes available
        var prereq = PREREQS[tag];
        if (prereq && el._hass) {
          var hassReady = !!el._hass;
          var present = true;
          if (prereq.service) present = !!(el._hass.services && el._hass.services[prereq.service]);
          if (prereq.shellCommand) present = !!(el._hass.services && el._hass.services.shell_command && el._hass.services.shell_command[prereq.shellCommand]);
          var existing = el.shadowRoot.querySelector('.prereq-banner[data-prereq="' + tag + '"]');
          if (!present && hassReady) {
            if (!existing) {
              var top = el.shadowRoot.querySelector('.card, .card-container, .main-card, [class$="-card"]') || el.shadowRoot.firstElementChild || el.shadowRoot;
              try { top.insertAdjacentHTML('afterbegin', buildPrereqBanner(tag, prereq, el._hass)); } catch(e) {}
            }
          } else if (present && existing) {
            existing.remove();
          }
        }
        // 2) Donate footer
        if (el.shadowRoot.querySelector('.donate-section')) return;
        var target = el.shadowRoot.querySelector('.card, .card-container, .main-card, [class$="-card"]') || el.shadowRoot.firstElementChild || el.shadowRoot;
        try { target.insertAdjacentHTML('beforeend', DONATE_HTML); } catch(e) {}
      });
    });
  }
  // Run immediately, then aggressive MutationObserver for late mounts + view switches.
  injectAll();
  setTimeout(injectAll, 250);
  setTimeout(injectAll, 1000);
  setTimeout(injectAll, 3000);
  // MutationObserver catches every new node anywhere in the DOM, including shadow root attachments
  // that are deferred until the user navigates to a view.
  try {
    var obs = new MutationObserver(function(muts){
      // Debounce: schedule a microtask injection
      if (window.__haToolsDonateScheduled) return;
      window.__haToolsDonateScheduled = true;
      setTimeout(function(){ window.__haToolsDonateScheduled = false; injectAll(); }, 100);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  } catch(e) {}
  // Also re-inject on hash/path change (Lovelace view switches)
  window.addEventListener('hashchange', function(){ setTimeout(injectAll, 200); });
  window.addEventListener('popstate', function(){ setTimeout(injectAll, 200); });
  // Backup interval (every 3s for first 5min — handles cases where MutationObserver missed events)
  var pollCount = 0;
  var pollInterval = setInterval(function(){
    injectAll();
    if (++pollCount >= 100) clearInterval(pollInterval);
  }, 3000);
}
/* ============================================================ */

class HAStorageMonitor extends HTMLElement {
  static getConfigElement() { return document.createElement('ha-storage-monitor-editor'); }
  getCardSize() { return 6; }

  static getStubConfig() { return { type: 'custom:ha-storage-monitor', title: 'Storage Monitor' }; }
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
    this._loading = true;
    this._expandedPaths = new Set();
    this._sortBy = 'size';
    this._lang = (navigator.language || '').startsWith('pl') ? 'pl' : 'en';
    this._sortAsc = false;
    this._lastHtml = '';
    this._lastDataFetch = 0;
  }

  _sanitize(str) {
    if (!str) return str;
    try { return decodeURIComponent(escape(str)); } catch(e) { return str; }
  }
  set hass(hass) {
    this._hass = hass;
    if (hass?.language) this._lang = hass.language.startsWith('pl') ? 'pl' : 'en';
    if (!hass) return;
    const now = Date.now();
    if (!this._firstHassRender) {
      this._firstHassRender = true;
      this._loadStorageData();
      this._render();
      this._lastRenderTime = now;
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
        requiresSupervisor: 'Wymaga Home Assistant OS / Supervised',
        requiresSupervisorDesc: 'Storage Monitor wymaga Supervisor API do odczytu informacji o dysku, dodatkach i kopiach zapasowych. Zainstaluj HA OS lub HA Supervised.',
        addons: 'Dodatki',
        addon: 'Dodatek',
        version: 'Wersja',
        integrations: 'Integracje',
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
        requiresSupervisor: 'Requires Home Assistant OS / Supervised',
        requiresSupervisorDesc: 'Storage Monitor requires the Supervisor API to read disk, addon, and backup information. Install HA OS or HA Supervised.',
        addons: 'Add-ons',
        addon: 'Addon',
        version: 'Version',
        integrations: 'Integrations',
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
    this._config = { title: config.title || 'Storage Monitor', ...config };
    // Load persisted UI state
    try {
      const _saved = localStorage.getItem('ha-tools-storage-monitor-settings');
      if (_saved) {
        const _s = JSON.parse(_saved);
        if (_s._activeTab) this._activeTab = _s._activeTab;
      }
    } catch(e) { console.debug('[ha-storage-monitor] caught:', e); }
  }

  async _loadStorageData() {
    if (!this._hass) return;
    this._loading = true;
    this._updateContent();

    try {
      // Get host info for disk usage (requires Supervisor - HA OS / Supervised)
      let hostInfo = null, osInfo = null;
      try { hostInfo = await this._hass.callWS({ type: 'supervisor/api', endpoint: '/host/info', method: 'get' }); } catch(e) { console.debug('[ha-storage-monitor] caught:', e); }
      try { osInfo = await this._hass.callWS({ type: 'supervisor/api', endpoint: '/os/info', method: 'get' }); } catch(e) { console.debug('[ha-storage-monitor] caught:', e); }
      if (!hostInfo) {
        this._storageData = { noSupervisor: true };
        this._loading = false;
        this._updateContent();
        return;
      }

      // Get addon info — try individual endpoints for size data
      let addons = [];
      try {
        const addonList = await this._hass.callWS({ type: 'supervisor/api', endpoint: '/addons', method: 'get' });
        addons = addonList?.addons || addonList?.data?.addons || [];
        // J3: Try to get detailed info for each addon (includes disk usage when available)
        const addonDetails = await Promise.allSettled(
          addons.filter(a => a.slug && a.state && a.state !== 'unknown').slice(0, 30).map(a =>
            this._hass.callWS({ type: 'supervisor/api', endpoint: '/addons/' + a.slug + '/info', method: 'get' })
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
      try {
        const backupList = await this._hass.callWS({ type: 'supervisor/api', endpoint: '/backups', method: 'get' });
        backups = backupList?.backups || backupList?.data?.backups || [];
      } catch(e) { console.warn('[Storage] Could not fetch backups:', e); }

      // Recorder info — current HA recorder/info API does NOT expose db size
      // Available fields: backlog, db_in_default_location, max_backlog, migration_in_progress, migration_is_live, recording, thread_running
      let dbSize = 0;
      let recorderMeta = {};
      try {
        recorderMeta = await this._hass.callWS({ type: 'recorder/info' }) || {};
        // DB size unavailable from this endpoint — UI will show "N/A" when dbSize === 0
      } catch(e) { console.warn('[Storage] No recorder info:', e); }

      // API returns numbers directly (in GB), no .data wrapper
      const diskTotal = hostInfo?.disk_total || hostInfo?.data?.disk_total || 32;
      const diskUsed = hostInfo?.disk_used || hostInfo?.data?.disk_used || 10;
      const diskFree = hostInfo?.disk_free || hostInfo?.data?.disk_free || diskTotal - diskUsed;
      const hostname = hostInfo?.hostname || hostInfo?.data?.hostname || 'homeassistant';
      const os = hostInfo?.operating_system || hostInfo?.data?.operating_system || 'N/A';

      // Build storage breakdown
      // Addons: filter by state (started/stopped = installed), list API has no size
      const addonSizes = addons.filter(a => a.state && a.state !== 'unknown').map(a => {
        // disk_usage from supervisor is in bytes, default 0.5 MB for unknown
        let sizeMB = 0.5;
        if (a.disk_usage !== null && a.disk_usage !== undefined && a.disk_usage > 0) {
          // Convert bytes to MB
          sizeMB = a.disk_usage / (1024 * 1024);
        }
        return {
          name: a.name || a.slug,
          slug: a.slug,
          size: sizeMB, // in MB
          icon: a.icon ? `/api/hassio/addons/${a.slug}/icon` : null,
          state: a.state,
          version: a.version
        };
      });

      // Backups: supervisor /backups returns size in bytes (prefer size_bytes for clarity)
      const backupSizes = backups.map(b => {
        // Use size_bytes if available (explicit), fallback to size, then 0
        // Both should be in bytes from supervisor API
        const sizeBytes = b.size_bytes !== undefined ? b.size_bytes : (b.size || 0);
        const sizeMB = (sizeBytes > 0) ? (sizeBytes / (1024 * 1024)) : 0;
        return {
          name: b.name || b.slug,
          slug: b.slug,
          size: sizeMB, // in MB
          date: b.date,
          type: b.type,
          compressed: b.compressed
        };
      }).sort((a, b) => b.size - a.size);

      // All size calculations use MB as the standard unit
      const totalBackupsMB = backupSizes.reduce((s, b) => s + b.size, 0); // sum of backup sizes (all in MB)
      const dbSizeMB = dbSize > 0 ? (dbSize / (1024 * 1024)) : 0; // from bytes to MB (if available)
      const usedMB = diskUsed * 1024; // diskUsed is in GB from host/info, convert to MB
      
      // Fetch integrations for storage estimation
      let integrations = [];
      try {
        const cfgEntries = await this._hass.callWS({ type: 'config_entries/list' });
        // API returns flat array directly, not wrapped object
        integrations = Array.isArray(cfgEntries) ? cfgEntries : (cfgEntries?.config_entries || cfgEntries?.data?.config_entries || []);
      } catch(e) { console.warn('[Storage] Could not fetch integrations:', e); }
      const intCount = integrations.length;
      const integrationEstimate = intCount * 0.1; // ~100KB per integration config storage estimate
      
      // Estimate HA Core + addons as used minus backups and DB
      const systemMB = Math.max(0, usedMB - totalBackupsMB - dbSizeMB);

      // All category sizes are in MB for consistent formatting and calculations
      const totalAddonsMB = addonSizes.reduce((s, a) => s + a.size, 0);
      const displayDbSizeMB = dbSizeMB > 0 ? dbSizeMB : Math.min(systemMB * 0.2, 2048);
      const displaySystemMB = Math.max(systemMB - integrationEstimate, 100);

      this._storageData = {
        diskTotal, diskUsed, diskFree,
        usedPercent: Math.round((diskUsed / diskTotal) * 100),
        categories: [
          { name: 'Backups', size: totalBackupsMB, color: '#9c27b0', icon: '\u{1F4BE}', items: backupSizes },
          { name: 'Database (Recorder)', size: displayDbSizeMB, color: '#ff9800', icon: '\u{1F5C4}\uFE0F' },
          { name: 'Add-ons', size: totalAddonsMB, color: '#4caf50', icon: '\u{1F9E9}', items: addonSizes },
          { name: 'Integrations', size: integrationEstimate, color: '#2196f3', icon: '\u{1F50C}', intCount: intCount },
          { name: 'System & Other', size: displaySystemMB, color: '#607d8b', icon: '\u{1F5A5}' },
        ],
        addons: addonSizes,
        backups: backupSizes,
        integrations: integrations,
        dbSizeMB,
        totalAddonsMB,
        totalBackupsMB,
        addonCount: addonSizes.length,
        intCount: intCount,
        osVersion: osInfo?.version || osInfo?.data?.version || 'N/A',
        hostname: hostname
      };
    } catch (e) {
      console.error('[Storage Monitor] Error:', e);
      this._storageData = { error: e.message };
    }

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

  _fmtSize(mb) {
    // Unified size formatter - always takes input in MB and outputs consistent format
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(mb * 1024).toFixed(0)} KB`;
  }

  _formatSizeFromBytes(bytes) {
    // Helper to convert bytes to MB and format in one step
    const mb = (bytes || 0) / (1024 * 1024);
    return this._fmtSize(mb);
  }

  _render() {
    if (!this._hass) return;
    const html = `
      <style>${window.HAToolsBentoCSS || ""}
/* === Support / Donation Section (HA Tools split) === */
.donate-section { margin: 20px 0 4px; padding: 18px 20px;  background: var(--donate-bg, linear-gradient(135deg, #fff5f5 0%, #fff0f6 50%, #f8f0ff 100%));  border: 1px solid var(--donate-border, #f3d3e0); border-radius: var(--bento-radius-md, 16px);  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; }
.donate-section h3 { margin: 0 0 6px; font-size: 15px; color: var(--donate-heading, #be185d); }
.donate-section p  { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--donate-text, #6b21a8); }
.donate-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
.donate-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 10px;  font-weight: 600; font-size: 12.5px; text-decoration: none; transition: transform .15s ease, box-shadow .15s ease; }
.donate-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,0.08); }
.donate-btn.coffee { background: #FFDD00; color: #000; border: 1px solid #e6c700; }
.donate-btn.paypal { background: #0070ba; color: #fff; border: 1px solid #005ea6; }
@media (prefers-color-scheme: dark) {  .donate-section { background: linear-gradient(135deg, #2a1525 0%, #1e1530 50%, #251530 100%); border-color: #4a3555; }  .donate-section h3 { color: #f0c0d8; }  .donate-section p  { color: #d4a0b8; }  .donate-btn.coffee { background: #b8a100; color: #fff; border-color: #8a7a00; }  .donate-btn.paypal { background: #005a96; color: #e0f0ff; border-color: #004a7a; } }
@media (max-width: 600px) {  .donate-section { flex-direction: column; text-align: center; padding: 16px; }  .donate-buttons { justify-content: center; } }
/* === Prereq banner (HA Tools split injector) === */
.prereq-banner { display: flex; align-items: flex-start; gap: 12px; padding: 14px 18px;  border-radius: var(--bento-radius-sm, 10px); margin: 10px 0 14px; font-size: 13px; line-height: 1.5;  border: 1px solid; }
.prereq-banner.prereq-error { background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.3); color: #991b1b; }
.prereq-banner.prereq-info  { background: rgba(59, 130, 246, 0.06); border-color: rgba(59, 130, 246, 0.3); color: #1e40af; }
.prereq-banner .prereq-icon { font-size: 22px; flex-shrink: 0; line-height: 1; padding-top: 2px; }
.prereq-banner .prereq-text { flex: 1; min-width: 0; }
.prereq-banner code { background: rgba(0,0,0,0.06); padding: 1px 6px; border-radius: 4px; font-size: 12px; }
.prereq-banner .prereq-cta { display: inline-block; padding: 6px 12px; border-radius: 6px;  background: var(--bento-primary, #3B82F6); color: #fff !important; text-decoration: none;  font-weight: 600; font-size: 12px; flex-shrink: 0; }
.prereq-banner .prereq-cta:hover { background: var(--bento-primary-hover, #2563EB); }
@media (prefers-color-scheme: dark) {  .prereq-banner.prereq-error { background: rgba(239, 68, 68, 0.15); color: #fca5a5; border-color: rgba(239, 68, 68, 0.4); }  .prereq-banner.prereq-info  { background: rgba(59, 130, 246, 0.12); color: #93c5fd; border-color: rgba(59, 130, 246, 0.4); }  .prereq-banner code { background: rgba(255,255,255,0.08); } }
@media (max-width: 600px) {  .prereq-banner { flex-direction: column; align-items: stretch; }  .prereq-banner .prereq-cta { align-self: flex-start; } }


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
.disk-gauge { display: flex; align-items: center; gap: 24px; margin-bottom: 20px; padding: 16px; background: var(--bento-bg); border-radius: var(--bento-radius-sm); border: 1px solid var(--bento-border); }
.gauge-ring { position: relative; width: 120px; height: 120px; flex-shrink: 0; }
.gauge-ring svg { width: 120px; height: 120px; transform: rotate(-90deg); }
.gauge-bg { fill: none; stroke: var(--bento-border); stroke-width: 8; }
.gauge-fill { fill: none; stroke-width: 8; stroke-linecap: round; transition: stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
.gauge-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
.gauge-pct { font-size: 24px; font-weight: 700; color: var(--bento-text); font-family: 'Inter', sans-serif; line-height: 1.2; }
.gauge-label { font-size: 11px; color: var(--bento-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
.gauge-info { flex: 1; }
.gi-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--bento-border); font-size: 13px; color: var(--bento-text-secondary); }
.gi-row:last-child { border-bottom: none; }
.gi-row span:first-child { min-width: 50px; }
.gi-val { font-weight: 600; color: var(--bento-text); white-space: nowrap; }

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


@media (prefers-color-scheme: dark) {
  :host {
    --bento-bg: var(--primary-background-color, #1a1a2e);
    --bento-card: var(--card-background-color, #16213e);
    --bento-text: var(--primary-text-color, #e2e8f0);
    --bento-text-secondary: var(--secondary-text-color, #94a3b8);
    --bento-border: var(--divider-color, #334155);
    --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
    --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  }
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

</style>
      
        <div class="card">
          <div class="card-header">
            <h2>${_esc(this._config.title || '')}</h2>
            <button class="refresh-btn" id="refreshBtn">\u{1F504} Refresh</button>
          </div>
          <div class="tabs">
            <button class="tab-button active" data-tab="overview">Overview</button>
            <button class="tab-button" data-tab="addons">Addons & Integrations</button>
            <button class="tab-button" data-tab="backups">Backups</button>
            <button class="tab-button" data-tab="files">Files & Folders</button>
            <button class="tab-button" data-tab="cleanup">Cleanup</button>
          </div>
          <div id="content"></div>
        
        <!-- Support / Donation -->
        <div class="donate-section" data-source="ha-tools-split">
          <div class="donate-text">
            <h3>❤️ ${this._lang === 'pl' ? 'Wesprzyj rozwój HA Tools' : 'Support HA Tools Development'}</h3>
            <p>${this._lang === 'pl' ? 'Jeśli to narzędzie ułatwia Ci życie z Home Assistant, rozważ wsparcie projektu. Każda kawa motywuje do dalszego rozwoju!' : 'If this tool makes your Home Assistant life easier, consider supporting the project. Every coffee motivates further development!'}</p>
          </div>
          <div class="donate-buttons">
            <a class="donate-btn coffee" href="https://buymeacoffee.com/macsiem" target="_blank" rel="noopener noreferrer">☕ Buy Me a Coffee</a>
            <a class="donate-btn paypal" href="https://www.paypal.com/donate/?hosted_button_id=Y967H4PLRBN8W" target="_blank" rel="noopener noreferrer">💳 PayPal</a>
          </div>
        </div>
        </div>
      
    `;
    if (this._lastHtml === html) return;
    this._lastHtml = html;
    this.shadowRoot.innerHTML = html;

    // Tab handlers
    this.shadowRoot.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.shadowRoot.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._activeTab = btn.dataset.tab;
        history.replaceState(null, '', location.pathname + '#' + this._toolId + '/' + this._activeTab);
        this._updateContent();
      });
    });

    this.shadowRoot.getElementById('refreshBtn').addEventListener('click', () => this._loadStorageData());
  }

  _updateContent() {
    // J2 fix: debounce to prevent flickering
    if (this._updateContentRAF) cancelAnimationFrame(this._updateContentRAF);
    this._updateContentRAF = requestAnimationFrame(() => this._doUpdateContent());
  }

  _doUpdateContent() {
    const content = this.shadowRoot.getElementById('content');
    if (!content) return;

    if (this._loading) {
      content.innerHTML = '<div class="loading"><div class="spinner"></div>Loading storage info...</div>';
      return;
    }

    if (this._storageData?.noSupervisor) {
      const L = this._lang === 'pl';
      content.innerHTML = `<div style="text-align:center;padding:48px 24px;color:var(--bento-text-secondary,#64748B)">
        <div style="font-size:48px;margin-bottom:16px">\u{1F4E6}</div>
        <div style="font-size:18px;font-weight:600;color:var(--bento-text,#1E293B);margin-bottom:8px">${this._t.requiresSupervisor}</div>
        <div style="max-width:400px;margin:0 auto;line-height:1.5">${this._t.requiresSupervisorDesc}</div>
      </div>`;
      return;
    }
    if (!this._storageData || this._storageData.error) {
      content.innerHTML = `<div class="error">\u26A0\uFE0F ${_esc(this._storageData?.error || 'No data')}</div>`;
      return;
    }

    const d = this._storageData;
    if (this._activeTab === 'overview') content.innerHTML = this._renderOverview(d);
    else if (this._activeTab === 'addons') content.innerHTML = this._renderAddonsAndIntegrations(d);
    else if (this._activeTab === 'backups') content.innerHTML = this._renderBackups(d);
    else if (this._activeTab === 'files') content.innerHTML = this._renderFiles(d);
    else if (this._activeTab === 'cleanup') content.innerHTML = this._renderCleanup(d);

    this._attachContentEvents();
  }

  _renderOverview(d) {
    const circ = 2 * Math.PI * 40;
    const usedPct = d.usedPercent;
    const fillColor = usedPct > 90 ? '#f44336' : usedPct > 75 ? '#ff9800' : 'var(--bento-primary)';
    const totalMB = d.categories.reduce((s, c) => s + c.size, 0);

    return `
      <div class="disk-gauge">
        <div class="gauge-ring">
          <svg viewBox="0 0 100 100">
            <circle class="gauge-bg" cx="50" cy="50" r="40" />
            <circle class="gauge-fill" cx="50" cy="50" r="40" style="stroke:${fillColor};stroke-dasharray:${(usedPct/100)*circ} ${circ}" />
          </svg>
          <div class="gauge-text">
            <div class="gauge-pct">${usedPct}%</div>
            <div class="gauge-label">used</div>
          </div>
        </div>
        <div class="gauge-info">
          <div class="gi-row"><span>Total</span><span class="gi-val">${d.diskTotal.toFixed(1)} GB</span></div>
          <div class="gi-row"><span>Used</span><span class="gi-val">${d.diskUsed.toFixed(1)} GB</span></div>
          <div class="gi-row"><span>Free</span><span class="gi-val">${d.diskFree.toFixed(1)} GB</span></div>
          <div class="gi-row"><span>Host</span><span class="gi-val">${d.hostname}</span></div>
          <div class="gi-row"><span>OS</span><span class="gi-val">${d.osVersion}</span></div>
        </div>
      </div>

      <div class="treemap">
        ${d.categories.filter(c => c.size > 0).map(c => {
          const pct = Math.max(2, (c.size / totalMB) * 100);
          return `<div class="treemap-cell" style="flex:${pct};background:${c.color}" title="${c.name}: ${this._fmtSize(c.size)}">${c.icon} ${pct > 10 ? c.name.split(' ')[0] : ''}</div>`;
        }).join('')}
      </div>

      <div class="cat-list">
        ${d.categories.map(c => `
          <div class="cat-item">
            <div class="cat-dot" style="background:${c.color}"></div>
            <span class="cat-icon">${c.icon}</span>
            <div class="cat-info">
              <div class="cat-name">${c.name}${c.items ? ` (${c.items.length})` : ''}</div>
              <div class="cat-size">${this._fmtSize(c.size)}</div>
            </div>
            <div class="cat-bar"><div class="cat-bar-fill" style="width:${Math.min(100, (c.size / totalMB) * 100)}%;background:${c.color}"></div></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  _renderAddons(d) { return this._renderAddonsAndIntegrations(d); }

  _renderAddonsAndIntegrations(d) {
    const L = this._lang === 'pl';
    const hasAnySizes = d.addons.some(a => a.size > 0);
    const sizeNote = hasAnySizes ? '' : `<div style="padding:8px 12px;background:rgba(59,130,246,0.06);border-radius:8px;margin-bottom:12px;font-size:12px;color:var(--bento-text-secondary,#64748b);">\u{1F4A1} ${this._t.addonSizeNote}</div>`;
    const maxAddonSize = Math.max(...d.addons.map(a => a.size), 1);

    // Determine HACS integrations
    const hacsIntegrations = (d.integrations || []).filter(i => i.source === 'hacs' || i.source === 'custom');
    const coreIntegrations = (d.integrations || []).filter(i => i.source !== 'hacs' && i.source !== 'custom');

    const sortedAddons = [...d.addons].sort((a, b) => this._sortAsc ? a.size - b.size : b.size - a.size);
    const sortedInts = [...(d.integrations || [])].sort((a, b) => {
      const sa = a.source === 'hacs' || a.source === 'custom' ? 'HACS' : 'Core';
      const sb = b.source === 'hacs' || b.source === 'custom' ? 'HACS' : 'Core';
      return sa.localeCompare(sb);
    });

    return `
      ${sizeNote}
      <h3 style="margin:0 0 12px;font-size:15px;color:var(--bento-text,#1e293b);">\u{1F9E9} ${this._t.addons} (${d.addons.length})</h3>
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
                <td title="${a.slug}">${a.name}</td>
                <td>${a.size < 1 ? '< 1 MB' : this._fmtSize(a.size)}</td>
                <td><span style="color:${a.state === 'started' ? '#4caf50' : '#9e9e9e'}">\u25CF ${a.state || 'stopped'}</span></td>
                <td>${a.version || '-'}</td>
                <td><span class="size-bar" style="width:${Math.max(4, (a.size / maxAddonSize) * 100)}px;background:#4caf50"></span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <h3 style="margin:24px 0 12px;font-size:15px;color:var(--bento-text,#1e293b);">\u{1F50C} ${this._t.integrations} (${(d.integrations || []).length})</h3>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
        <div style="padding:6px 12px;background:rgba(33,150,243,0.08);border-radius:8px;font-size:12px;color:var(--bento-text-secondary,#64748b);">\u{1F4E6} Core: ${coreIntegrations.length}</div>
        <div style="padding:6px 12px;background:rgba(255,152,0,0.08);border-radius:8px;font-size:12px;color:var(--bento-text-secondary,#64748b);">\u{1F3EA} HACS: ${hacsIntegrations.length}</div>
        <div style="padding:6px 12px;background:rgba(76,175,80,0.08);border-radius:8px;font-size:12px;color:var(--bento-text-secondary,#64748b);">\u{1F4CA} ${this._t.estStorage}: ~${this._fmtSize((d.integrations || []).length * 0.1)}</div>
      </div>
      <div class="table-container">
        <table class="entity-table">
          <thead><tr>
            <th>${this._t.integration}</th>
            <th>Domain</th>
            <th>${this._t.source}</th>
            <th>Status</th>
          </tr></thead>
          <tbody>
            ${sortedInts.slice(0, 60).map(i => {
              const isHacs = i.source === 'hacs' || i.source === 'custom';
              return `
              <tr>
                <td>${i.title || i.domain}</td>
                <td><code style="font-size:11px;background:rgba(0,0,0,0.05);padding:2px 6px;border-radius:4px;">${i.domain}</code></td>
                <td><span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;background:${isHacs ? 'rgba(255,152,0,0.1);color:#f57c00' : 'rgba(33,150,243,0.1);color:#1976d2'}">${isHacs ? '\u{1F3EA} HACS' : '\u{1F4E6} Core'}</span></td>
                <td><span style="color:${i.state === 'loaded' ? '#4caf50' : i.state === 'setup_error' ? '#f44336' : '#9e9e9e'}">\u25CF ${i.state || 'unknown'}</span></td>
              </tr>`;
            }).join('')}
            ${(d.integrations || []).length > 60 ? `<tr><td colspan="4" style="text-align:center;color:var(--bento-text-secondary,#64748b);font-size:12px;">... ${this._t.and} ${(d.integrations || []).length - 60} ${this._t.more}</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    `;
  }

  _renderBackups(d) {
    if (!d.backups.length) return '<div class="loading">No backups found</div>';
    const maxSize = Math.max(...d.backups.map(b => b.size), 1);
    return `
      <div class="table-container">
        <table class="entity-table">
          <thead><tr>
            <th>Backup</th>
            <th>Size</th>
            <th>Date</th>
            <th>Type</th>
            <th>Visualization</th>
          </tr></thead>
          <tbody>
            ${d.backups.map(b => `
              <tr>
                <td title="${b.slug}">${b.name}</td>
                <td>${this._fmtSize(b.size)}</td>
                <td>${b.date ? new Date(b.date).toLocaleDateString() : '-'}</td>
                <td>${b.type || 'full'}</td>
                <td><span class="size-bar" style="width:${Math.max(4, (b.size / maxSize) * 100)}px;background:#9c27b0"></span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  _renderIntegrations(d) {
    if (!d.integrations || !d.integrations.length) return '<div class="loading">No integrations found</div>';
    const intCount = d.integrations.length;
    return `
      <div class="table-container">
        <div style="padding:12px;background:rgba(33,150,243,0.06);border-radius:8px;margin-bottom:12px;font-size:12px;color:var(--bento-text-secondary,#64748b);">
          📊 ${intCount} integrations detected. Estimated storage: ~${this._fmtSize(intCount * 0.1)}
        </div>
        <table class="entity-table">
          <thead><tr>
            <th>Integration</th>
            <th>Domain</th>
            <th>Source</th>
          </tr></thead>
          <tbody>
            ${d.integrations.slice(0, 50).map(i => `
              <tr>
                <td>${i.title || i.domain}</td>
                <td><code style="font-size:11px;background:rgba(0,0,0,0.05);padding:2px 6px;border-radius:4px;">${i.domain}</code></td>
                <td>${i.source || 'user'}</td>
              </tr>
            `).join('')}
            ${d.integrations.length > 50 ? `<tr><td colspan="3" style="text-align:center;color:var(--bento-text-secondary,#64748b);font-size:12px;">... and ${d.integrations.length - 50} more</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    `;
  }
  _renderFiles(d) {
    const L = this._lang === 'pl';
    if (!this._hass) return `<div class="loading">${this._t.noDataAvailable}</div>`;

    // Build a virtual directory tree from known data
    const entries = [];
    const totalMB = d.diskUsed * 1024; // GB to MB

    // Known directories with estimates
    const knownDirs = [
      { path: '/config/', name: 'config', size: Math.max(totalMB * 0.05, 50), type: 'dir', icon: '\u{1F4C1}', desc: this._t.haConfig },
      { path: '/config/www/', name: 'www', size: Math.max(totalMB * 0.01, 10), type: 'dir', icon: '\u{1F310}', desc: this._t.staticFiles },
      { path: '/config/custom_components/', name: 'custom_components', size: (d.integrations || []).filter(i => i.source === 'hacs' || i.source === 'custom').length * 2, type: 'dir', icon: '\u{1F9E9}', desc: this._t.hacsComponents },
      { path: '/config/.storage/', name: '.storage', size: Math.max(totalMB * 0.02, 20), type: 'dir', icon: '\u{1F5C4}\uFE0F', desc: this._t.haInternal },
      { path: '/backup/', name: 'backup', size: d.backups.reduce((s, b) => s + b.size, 0), type: 'dir', icon: '\u{1F4BE}', desc: this._t.backups },
      { path: '/addons/', name: 'addons', size: d.addons.reduce((s, a) => s + a.size, 0), type: 'dir', icon: '\u{1F4E6}', desc: this._t.addonData },
      { path: '/ssl/', name: 'ssl', size: 0.1, type: 'dir', icon: '\u{1F512}', desc: this._t.sslCerts },
      { path: '/media/', name: 'media', size: Math.max(totalMB * 0.01, 5), type: 'dir', icon: '\u{1F3AC}', desc: this._t.mediaFiles },
      { path: '/share/', name: 'share', size: Math.max(totalMB * 0.005, 2), type: 'dir', icon: '\u{1F4C2}', desc: this._t.sharedFolder },
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
      return sortAsc ? a.size - b.size : b.size - a.size;
    });

    const maxSize = Math.max(...sorted.map(e => e.size), 1);

    return `
      <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center;">
        <span style="font-size:12px;color:var(--bento-text-secondary,#64748b);">${this._t.sort}</span>
        <button class="sort-btn" data-sort="size" style="padding:4px 10px;font-size:11px;border:1px solid var(--bento-border,#e2e8f0);border-radius:6px;background:${sortKey === 'size' ? 'var(--bento-primary-light,rgba(59,130,246,0.08))' : 'transparent'};color:var(--bento-text-secondary,#64748b);cursor:pointer;">${this._t.size} ${sortKey === 'size' ? (sortAsc ? '\u2191' : '\u2193') : ''}</button>
        <button class="sort-btn" data-sort="name" style="padding:4px 10px;font-size:11px;border:1px solid var(--bento-border,#e2e8f0);border-radius:6px;background:${sortKey === 'name' ? 'var(--bento-primary-light,rgba(59,130,246,0.08))' : 'transparent'};color:var(--bento-text-secondary,#64748b);cursor:pointer;">${this._t.name} ${sortKey === 'name' ? (sortAsc ? '\u2191' : '\u2193') : ''}</button>
      </div>
      <div style="padding:8px 12px;background:rgba(59,130,246,0.06);border-radius:8px;margin-bottom:12px;font-size:12px;color:var(--bento-text-secondary,#64748b);">
        \u{1F4CA} ${this._t.dataLimited} &mdash;
        ${this._t.estBreakdown}
        ${this._t.disk} <strong>${d.diskUsed?.toFixed(1) || '?'} / ${d.diskTotal?.toFixed(1) || '?'} GB (${d.usedPercent || '?'}%)</strong>
        &bull; ${(d.integrations || []).length} ${this._t.integrationsDetected}
        &bull; ${(d.addons || []).length} ${this._t.addonsText}
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
                <td>${e.icon} <code style="font-size:12px;">${e.path}</code></td>
                <td style="white-space:nowrap;">${e.size < 1 ? '< 1 MB' : this._fmtSize(e.size)}</td>
                <td style="font-size:12px;color:var(--bento-text-secondary,#64748b);">${e.desc}</td>
                <td><span class="size-bar" style="width:${Math.max(4, (e.size / maxSize) * 100)}px;background:${e.type === 'file' ? '#ff9800' : '#3b82f6'}"></span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  _renderCleanup(d) {
    const suggestions = [];
    if (d.usedPercent > 80) {
      suggestions.push({ title: '\u26A0\uFE0F Disk usage above 80%', desc: `Your disk is ${d.usedPercent}% full. Consider freeing up space.`, savings: '', cls: d.usedPercent > 90 ? 'crit' : 'warn' });
    }
    if (d.backups.length > 5) {
      const oldBackups = d.backups.slice(3);
      const savings = oldBackups.reduce((s, b) => s + b.size, 0);
      suggestions.push({ title: '\u{1F4BE} Old backups can be removed', desc: `You have ${d.backups.length} backups. Keeping only the 3 most recent could free space.`, savings: `Potential savings: ${this._fmtSize(savings)}`, cls: '' });
    }
    if (d.dbSizeMB > 500) {
      suggestions.push({ title: '\u{1F5C4}\uFE0F Large database', desc: `Your recorder database is ${this._fmtSize(d.dbSizeMB)}. Consider reducing recorder history days or purging old data.`, savings: 'Tip: Set purge_keep_days in recorder config', cls: d.dbSizeMB > 2048 ? 'warn' : '' });
    }
    const stoppedAddons = d.addons.filter(a => a.state !== 'started' && a.size > 10);
    if (stoppedAddons.length > 0) {
      const savings = stoppedAddons.reduce((s, a) => s + a.size, 0);
      suggestions.push({ title: '\u{1F9E9} Stopped addons using storage', desc: `${stoppedAddons.length} stopped addon(s): ${stoppedAddons.map(a => a.name).join(', ')}`, savings: `Storage used: ${this._fmtSize(savings)}`, cls: '' });
    }
    if (suggestions.length === 0) {
      suggestions.push({ title: '\u2705 Storage looks healthy', desc: `Disk usage is at ${d.usedPercent}% with ${d.diskFree.toFixed(1)} GB free.`, savings: '', cls: '' });
    }

    return suggestions.map(s => `
      <div class="suggestion ${s.cls}">
        <div class="suggestion-title">${s.title}</div>
        <div class="suggestion-desc">${s.desc}</div>
        ${s.savings ? `<div class="suggestion-savings">${s.savings}</div>` : ''}
      </div>
    `).join('');
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
        <button class="pagination-btn" data-page-tab="${tabName}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>&#8249; Prev</button>
        <span class="pagination-info">${page} / ${totalPages} (${totalItems})</span>
        <button class="pagination-btn" data-page-tab="${tabName}" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Next &#8250;</button>
        <select class="page-size-select" data-page-tab="${tabName}" data-action="page-size">
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

  disconnectedCallback() {
    // Cleanup any active event listeners or timers
  }

  setActiveTab(tabId) {
    this._activeTab = tabId;
    this._render();
  }
}

if (!customElements.get('ha-storage-monitor')) customElements.define('ha-storage-monitor', HAStorageMonitor);

console.info(
  '%c  HA-STORAGE-MONITOR  %c v1.0.0 ',
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
    this._render();
  }
  _dispatch() {
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config }, bubbles: true, composed: true }));
  }
  _render() {
    this.shadowRoot.innerHTML = `
      <style>
            :host { display:block; padding:16px; }
            h3 { margin:0 0 16px; font-size:15px; font-weight:600; color:var(--bento-text, var(--primary-text-color,#1e293b)); }
            input { outline:none; transition:border-color .2s; }
            input:focus { border-color:var(--bento-primary, var(--primary-color,#3b82f6)); }
        </style>
      <h3>Storage Monitor</h3>
            <div style="margin-bottom:12px;">
              <label style="display:block;font-weight:500;margin-bottom:4px;font-size:13px;">Title</label>
              <input type="text" id="cf_title" value="${_esc(this._config?.title || 'Storage Monitor')}"
                style="width:100%;padding:8px 12px;border:1px solid var(--divider-color,#e2e8f0);border-radius:8px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#1e293b);font-size:14px;box-sizing:border-box;">
            </div>
    `;
        const f_title = this.shadowRoot.querySelector('#cf_title');
        if (f_title) f_title.addEventListener('input', (e) => {
          this._config = { ...this._config, title: e.target.value };
          this._dispatch();
        });
  }
  connectedCallback() { this._render(); }
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
