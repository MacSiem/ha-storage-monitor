'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {JSDOM} = require('jsdom');
const root = join(__dirname, '..');
const producer = spawnSync(process.env.PYTHON_BINARY || 'python3', ['tests/storage_backend_producer.py'],
  {cwd: root, encoding: 'utf8', timeout: 10000});
assert.equal(producer.status, 0, producer.stderr);
const payload = JSON.parse(producer.stdout);
for (const language of ['en', 'pl']) for (const variant of ['full', 'compact', 'tile']) {
  test(`actual Python DTO reaches ${language}/${variant} with the same free space and forecast`, async () => {
    const dom = new JSDOM('', {runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/'});
    dom.window.eval(readFileSync(join(root, 'ha-storage-monitor.js'), 'utf8'));
    const card = dom.window.document.createElement('ha-storage-monitor');
    const calls = [];
    const hass = {language, locale: {language}, user: {id: 'qa-admin', is_admin: true, is_active: true},
      states: {}, connection: {connected: true}, config: {version: '2026.9.4', components: ['ha_storage_monitor'], time_zone: 'Europe/Warsaw'},
      callWS: async msg => { calls.push(msg.type);
        if (msg.type === 'ha_storage_monitor/status') return structuredClone(payload.status);
        if (msg.type === 'ha_storage_monitor/history') return structuredClone(payload.history);
        throw new Error('Unexpected source');
      }};
    try {
      card.setConfig({variant, default_tab: 'trend', backend_entry_id: 'bridge-entry', backend_source: 'bridge-disk'});
      dom.window.document.body.append(card); card.hass = hass; await card._loadStorageData();
      card._doUpdateContent();
      assert.equal(card._storageData.diskFree, 52); assert.equal(card._storageData.diskReserved, 2);
      assert.ok(Math.abs(card._storageData.forecastView.fullInDays - 52 / 6) < 1e-9);
      assert.match(card.shadowRoot.textContent, /8[.,]7/);
      assert.match(card.shadowRoot.textContent, language === 'pl' ? /szacunek z ograniczeniami/ : /limited estimate/);
      if (variant === 'tile') {
        assert.equal(card.shadowRoot.querySelector('[data-severity]').dataset.severity, 'critical');
        assert.match(card.shadowRoot.querySelector('#storage-open-full').getAttribute('aria-label'), /8[.,]7/);
      }
      if (variant === 'full') {
        card._trendDays = 30; card._syncTrendContext(); await card._loadStorageHistory();
        assert.equal(card._trendResult.rawSamples.length, 49);
        assert.equal(card._trendResult.rows.length, 98);
        const comparison = card._trendComparison(card._trendResult);
        assert.equal(comparison.available, true); assert.equal(comparison.deltaBytes, 6e9);
        assert.equal(comparison.elapsedMs, 86400000);
        const chart = new JSDOM(card._renderTrendChart(card._trendResult));
        try {
          const steps = chart.window.document.querySelectorAll('path[data-recorded-state]');
          assert.equal(steps.length, 2);
          for (const step of steps) {
            assert.equal((step.getAttribute('d').match(/ H /g) || []).length, 48);
            assert.equal(step.getAttribute('data-recorded-state'), 'last_recorded_state');
          }
          assert.match(chart.window.document.body.textContent, language === 'pl' ? /ostatni zapisany stan/ : /last recorded state/);
        } finally { chart.window.close(); }
      }
      assert.ok(calls.every(type => type.startsWith('ha_storage_monitor/')));
    } finally { card.remove(); dom.window.close(); }
  });
}
