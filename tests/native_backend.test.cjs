// Actual card contract for the native backend; no Supervisor/Recorder substitutes.
'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {JSDOM} = require('jsdom');
const clone = value => structuredClone(value);
function fixture({variant = 'full', source = 'auto', statusTransform, ws} = {}) {
  const dom = new JSDOM('', {runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/'});
  dom.window.eval(readFileSync(join(__dirname, '../ha-storage-monitor.js'), 'utf8'));
  const now = Math.floor(Date.now() / 1000) - 1;
  const item = {source: {kind: 'local_fs_samples', source_uuid: 'disk-a', binding_revision: '1',
    label: 'QA local filesystem', scope: 'ha_process_filesystem', identity_quality: 'process_mount_namespace'},
    current: {used_bytes: 94e9, total_bytes: 100e9, free_bytes: 4e9, reserved_bytes: 2e9,
      measured_at: now, free_semantics: 'available_to_process', free_computed: false},
    forecast: {full_in_days: null, growth_bytes_per_day: null, method: 'ols_used_bytes_actual_elapsed_days',
      sample_count: 1, quality: 'unknown', reason: 'insufficient_samples', calculated_at: now, measured_at: now,
      source_uuid: 'disk-a', segment_id: 'boot-a', window: {maximum_seconds: 604800, start: now, end: now, observed_seconds: 0},
      coverage: {successful_slots: 1, expected_slots: 1, ratio: 1, longest_gap_seconds: 0, schedule_seconds: 1800},
      confirmed_intervals: [], physical_continuity: 'unknown'}, error: null};
  const status = {schema_version: 1, entry_id: 'entry-1', read_at: now,
    permissions: {admin_only: true}, sources: [item]};
  statusTransform?.(status);
  const calls = [], listeners = new Map();
  const connection = {connected: true, addEventListener(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn);
  }, removeEventListener(type, fn) { listeners.get(type)?.delete(fn); }};
  const hass = {language: 'en', locale: {language: 'en'}, user: {id: 'admin-a', is_admin: true, is_active: true},
    connection, config: {version: '2026.9.4', components: ['ha_storage_monitor'], time_zone: 'Europe/Warsaw'}, states: {},
    callWS: async msg => { calls.push(clone(msg));
      if (ws) return ws(msg, status, now);
      if (msg.type === 'ha_storage_monitor/status') return clone(status);
      throw Object.assign(new Error('Unexpected private source request'), {code: 'unknown_command'});
    }};
  const card = dom.window.document.createElement('ha-storage-monitor');
  card.setConfig({type: 'custom:ha-storage-monitor', variant, default_tab: 'trend',
    backend_entry_id: 'entry-1', backend_source: source});
  dom.window.document.body.append(card);
  return {dom, card, hass, status, now, calls, mount() { card.hass = hass; },
    close() { card.remove(); dom.window.close(); }};
}

for (const variant of ['full', 'compact', 'tile']) test(`native ${variant} uses measured available free without Supervisor fallback`, async () => {
  const f = fixture({variant});
  try {
    f.mount(); await f.card._loadStorageData();
    assert.equal(f.card._storageData.source, 'local_fs_samples');
    assert.equal(f.card._storageData.diskUsed, 94);
    assert.equal(f.card._storageData.diskFree, 4); // total-used is 6, reserved is 2.
    assert.equal(f.card._storageData.diskReserved, 2);
    assert.equal(f.card._storageData.freeComputed, false);
    assert.ok(f.calls.every(msg => msg.type === 'ha_storage_monitor/status'));
    f.card._doUpdateContent();
    assert.match(f.card.shadowRoot.textContent, /QA local filesystem/);
    if (variant === 'tile') assert.match(f.card.shadowRoot.querySelector('#storage-open-full').getAttribute('aria-label'), /Fill forecast: unknown/);
    assert.doesNotMatch(f.card.shadowRoot.textContent, /Supervisor data|Source: Supervisor|NaN/);
  } finally { f.close(); }
});

test('auto mode requires a disk choice when several confirmed sources exist', async () => {
  const f = fixture({statusTransform(dto) {
    const other = clone(dto.sources[0]); other.source.source_uuid = 'disk-b';
    other.source.label = 'QA mounted NAS'; other.forecast.source_uuid = 'disk-b'; dto.sources.push(other);
  }});
  try {
    f.mount(); await f.card._loadStorageData();
    assert.equal(f.card._storageData?.diskTotal ?? null, null);
    assert.equal(f.card._storageResult, 'no_data');
    f.card._doUpdateContent();
    const picker = f.card.shadowRoot.querySelector('[data-storage-native-source]');
    assert.ok(picker);
    assert.ok([...picker.options].some(option => option.value === 'disk-b'));
    picker.value = 'disk-b'; picker.dispatchEvent(new f.dom.window.Event('change', {bubbles: true}));
    await f.card._loadStorageData();
    assert.equal(f.card._storageData.sourceUuid, 'disk-b');
    assert.equal(f.card._storageData.hostname, 'QA mounted NAS');
    assert.ok(f.calls.every(msg => msg.type === 'ha_storage_monitor/status'));
  } finally { f.close(); }
});

test('a missing explicit native source remains missing instead of switching to another disk', async () => {
  const f = fixture({source: 'disk-removed'});
  try {
    f.mount(); await f.card._loadStorageData();
    assert.equal(f.card._storageData?.diskTotal ?? null, null);
    assert.ok(f.calls.every(msg => msg.type === 'ha_storage_monitor/status'));
    f.card._doUpdateContent();
    assert.doesNotMatch(f.card.shadowRoot.textContent, /94\.0 GB|4\.0 GB/);
  } finally { f.close(); }
});

test('native current read keeps the wire occupied and purges late replies after role loss', async () => {
  let release;
  const f = fixture({ws: (msg, status) => msg.type === 'ha_storage_monitor/status'
    ? new Promise(resolve => { release = () => resolve(clone(status)); }) : Promise.reject(new Error('unexpected'))});
  try {
    f.mount();
    const one = f.card._loadStorageData(), two = f.card._loadStorageData();
    await Promise.resolve();
    f.card.hass = {...f.hass, user: {id: 'household', is_admin: false, is_active: true}};
    release?.(); await Promise.all([one, two]);
    assert.equal(f.calls.length, 1);
    assert.equal(f.card._nativeStatus ?? null, null);
    assert.ok(!f.card._storageData || f.card._storageData.permissionDenied);
    assert.doesNotMatch(f.card.shadowRoot.textContent, /QA local filesystem|94\.0 GB/);
  } finally { release?.(); f.close(); }
});

test('backend history works without Recorder and verifies all pages before the render subset', async () => {
  const f = fixture({ws(msg, status, now) {
    if (msg.type === 'ha_storage_monitor/status') return clone(status);
    assert.equal(msg.type, 'ha_storage_monitor/history');
    assert.equal(msg.entry_id, 'entry-1'); assert.equal(msg.source_uuid, 'disk-a'); assert.equal(msg.binding_revision, '1');
    const rows = Array.from({length: 2500}, (_, i) => ({source_uuid: 'disk-a', binding_revision: '1',
      segment_id: 'boot-a', sample_id: 'sample-' + i, measured_at: now - (2499 - i) * 600,
      used_bytes: 94e9, total_bytes: 100e9, free_bytes: 4e9, reserved_bytes: 2e9, identity_quality: 'strong'}));
    const offset = msg.offset || 0, limit = msg.limit || 2400, next = offset + limit;
    return {entry_id: 'entry-1', binding_revision: '1', source_uuid: 'disk-a',
      requested_window: {start: now - 30 * 86400, end: now, seconds: 30 * 86400},
      observed_window: {start: rows[0].measured_at, end: now, seconds: now - rows[0].measured_at},
      rows: rows.slice(offset, next), total_rows: rows.length, page_offset: offset, next_offset: next < rows.length ? next : null,
      coverage: {successful_slots: 834, expected_slots: 834, ratio: 1, longest_gap_seconds: 600, schedule_seconds: 1800},
      segments: [{segment_id: 'boot-a', binding_revision: '1', start: rows[0].measured_at, end: now, sample_count: rows.length}],
      gaps: [], last_success: now, capped: false, confirmed_intervals: [], physical_continuity: 'unknown'};
  }});
  try {
    f.mount(); await f.card._loadStorageData();
    f.card._trendDays = 30; f.card._syncTrendContext();
    await f.card._loadStorageHistory();
    assert.equal(f.card._trendResult.rawSamples.length, 2500);
    assert.equal(f.card._trendResult.rows.length, 2400);
    assert.equal(f.card._trendResult.rows[0].backendSampleId, 'sample-1300');
    assert.equal(f.card._trendResult.rows.at(-1).backendSampleId, 'sample-2499');
    assert.equal(f.card._trendResult.capped, true);
    const before = f.card.shadowRoot.querySelectorAll('.trend-recorded-state').length;
    assert.equal(before, 2);
    f.dom.window.localStorage.setItem('ha-storage-monitor-support-dismissed', '1');
    f.card._lastRenderTime = 0; f.card.hass = {...f.hass};
    assert.equal(f.card.shadowRoot.querySelectorAll('.trend-recorded-state').length, before);
    assert.equal(f.card._trendResult.rawSamples.length, 2500);
    assert.equal(f.calls.filter(msg => msg.type === 'ha_storage_monitor/history').length, 2);
    assert.ok(f.calls.every(msg => msg.type.startsWith('ha_storage_monitor/')));
  } finally { f.close(); }
});

test('native source labels stay escaped when source selection renders', async () => {
  const f = fixture({statusTransform(dto) { dto.sources[0].source.label = '<img src=x onerror="window.BAD=true">'; }});
  try {
    f.mount(); await f.card._loadStorageData(); f.card._doUpdateContent();
    assert.equal(f.card.shadowRoot.querySelector('img'), null);
    assert.equal(f.dom.window.BAD, undefined);
  } finally { f.close(); }
});

function editorFixture(f, config = {}) {
  const editor = f.dom.window.document.createElement('ha-storage-monitor-editor');
  editor.setConfig({extra: {keep: true}, measured_history: {unknown: 'keep'}, ...config});
  f.dom.window.document.body.append(editor); editor.hass = f.hass;
  return editor;
}
test('editor loads only configured native sources and saves an explicit UUID without losing legacy config', async () => {
  const f = fixture();
  try {
    const editor = editorFixture(f);
    const button = editor.shadowRoot.querySelector('[data-native-editor-load]'); assert.ok(button);
    await editor._loadNativeEditorSources();
    const source = editor.shadowRoot.querySelector('#cf_backend_source'); assert.ok(source);
    assert.match(source.textContent, /QA local filesystem/);
    source.value = 'disk-a'; source.dispatchEvent(new f.dom.window.Event('change'));
    assert.equal(editor._config.backend_source, 'disk-a');
    assert.equal(editor._config.data_source, 'native');
    assert.equal(editor._config.extra.keep, true); assert.equal(editor._config.measured_history.unknown, 'keep');
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].type, 'ha_storage_monitor/status');
  } finally { f.close(); }
});
test('editor role change clears source labels and a late reply cannot restore them', async () => {
  let resolve; const f = fixture({ws: () => new Promise(r => { resolve = r; })});
  try {
    const editor = editorFixture(f); assert.ok(editor.shadowRoot.querySelector('[data-native-editor-load]'));
    const pending = editor._loadNativeEditorSources(); await Promise.resolve();
    editor.hass = {...f.hass, user: {id: 'household', is_admin: false}};
    resolve(structuredClone(f.status)); await pending;
    assert.doesNotMatch(editor.shadowRoot.textContent, /QA local filesystem/);
    assert.equal(editor.shadowRoot.querySelector('[data-native-editor-load]'), null);
    assert.equal(editor._nativeEditorStatus, null);
  } finally { f.close(); }
});
test('editor detach discards a pending source reply and remount permits a fresh explicit read', async () => {
  let resolve; const f = fixture({ws: () => new Promise(r => { resolve = r; })});
  try {
    const editor = editorFixture(f); assert.ok(editor.shadowRoot.querySelector('[data-native-editor-load]'));
    const pending = editor._loadNativeEditorSources(); await Promise.resolve(); editor.remove();
    resolve(structuredClone(f.status)); await pending;
    assert.equal(editor._nativeEditorStatus, null);
    f.dom.window.document.body.append(editor); editor.hass = f.hass;
    const next = editor._loadNativeEditorSources(); await Promise.resolve(); resolve(structuredClone(f.status)); await next;
    assert.match(editor.shadowRoot.querySelector('#cf_backend_source').textContent, /QA local filesystem/);
    assert.equal(f.calls.length, 2);
  } finally { f.close(); }
});
test('explicit legacy mode keeps existing sources even when native backend is installed', () => {
  const f = fixture();
  try {
    f.card.setConfig({data_source: 'legacy', backend_source: 'disk-a'});
    f.card._hass = f.hass; assert.equal(f.card._usesNativeStorage(), false);
    const editor = editorFixture(f, {data_source: 'legacy', backend_source: 'removed-disk'});
    assert.ok(editor.shadowRoot.querySelector('#cf_data_source'));
    assert.equal(editor.shadowRoot.querySelector('#cf_data_source').value, 'legacy');
    assert.equal(editor.shadowRoot.querySelector('#cf_backend_source').value, 'removed-disk');
    assert.equal(editor._config.backend_source, 'removed-disk');
  } finally { f.close(); }
});

for (const tab of ['overview', 'trend']) for (const missing of [false, true]) {
  test(`shell rebuild keeps ${tab} content with ${missing ? 'missing' : 'measured'} data`, async () => {
    const f = fixture({ws: (msg, status) => {
      if (msg.type === 'ha_storage_monitor/status' && !missing) return clone(status);
      throw Object.assign(new Error('unavailable'), {code: 'unknown_command'});
    }});
    try {
      f.card.setConfig({...f.card._config, default_tab: tab});
      f.mount(); await f.card._loadStorageData();
      assert.ok(f.card.shadowRoot.querySelector('#content').textContent.trim());
      // Another card dismisses the shared support panel; an ordinary later HA
      // update changes this card's shell without changing its source or tab.
      f.dom.window.localStorage.setItem('ha-storage-monitor-support-dismissed', '1');
      f.card._lastRenderTime = 0;
      f.card.hass = {...f.hass};
      assert.ok(f.card.shadowRoot.querySelector('#content').textContent.trim());
      assert.equal(f.card._activeTab, tab);
      if (tab === 'trend') assert.ok(f.card.shadowRoot.querySelector('.storage-history'));
      else if (!missing) assert.match(f.card.shadowRoot.querySelector('#content').textContent, /94\.0 GB/);
      else assert.match(f.card.shadowRoot.querySelector('#content').textContent, /unavailable|integration/i);
    } finally { f.close(); }
  });
}

test('hass assigned before first connection starts a status read on mount', async () => {
  const f = fixture();
  try {
    f.card.remove();
    // Fresh HA card may receive config and hass before it enters the DOM.
    const card = f.dom.window.document.createElement('ha-storage-monitor');
    card.setConfig({type:'custom:ha-storage-monitor', default_tab:'overview', backend_entry_id:'entry-1'});
    card.hass = f.hass;
    assert.equal(f.calls.length, 0);
    f.dom.window.document.body.append(card);
    await Promise.resolve(); await Promise.resolve();
    if (card._nativeWire) await card._nativeWire;
    assert.equal(f.calls.filter(msg => msg.type === 'ha_storage_monitor/status').length, 1);
    assert.equal(card._loading, false);
    assert.equal(card._storageData?.diskUsed, 94);
    assert.match(card.shadowRoot.querySelector('#content').textContent, /94\.0 GB/);
    card.shadowRoot.querySelector('#refreshBtn').click();
    await card._nativeWire;
    assert.equal(f.calls.filter(msg => msg.type === 'ha_storage_monitor/status').length, 2);
    assert.equal(card._loading, false);
    card.remove();
  } finally { f.close(); }
});

test('preconnected hass with unavailable status ends loading and permits explicit retry', async () => {
  let fail = true;
  const f = fixture({ws: (msg, status) => {
    if (fail) throw Object.assign(new Error('unavailable'), {code:'unknown_command'});
    return clone(status);
  }});
  try {
    f.card.remove();
    const card = f.dom.window.document.createElement('ha-storage-monitor');
    card.setConfig({default_tab:'overview', backend_entry_id:'entry-1'});
    card.hass = f.hass;
    f.dom.window.document.body.append(card);
    await card._nativeWire;
    assert.equal(card._loading, false);
    assert.equal(card._storageResult, 'error');
    assert.equal(card._storageData, null);
    fail = false;
    card.shadowRoot.querySelector('#refreshBtn').click();
    await card._nativeWire;
    assert.equal(card._loading, false);
    assert.equal(card._storageData.diskUsed, 94);
    card.remove();
  } finally { f.close(); }
});

test('history refresh button sends a request after user selects a filesystem', async () => {
  const f = fixture({statusTransform(dto) {
    const other = clone(dto.sources[0]); other.source.source_uuid = 'disk-b'; other.source.label = 'Second';
    other.forecast.source_uuid = 'disk-b'; dto.sources.push(other);
  }, ws(msg, status) {
    if (msg.type === 'ha_storage_monitor/status') return clone(status);
    throw Object.assign(new Error('history unavailable'), {code:'unknown_command'});
  }});
  try {
    f.mount(); await f.card._nativeWire;
    const picker = f.card.shadowRoot.querySelector('[data-storage-native-source]');
    picker.value = 'disk-a'; picker.dispatchEvent(new f.dom.window.Event('change', {bubbles:true}));
    await f.card._nativeWire;
    const button = f.card.shadowRoot.querySelector('.trend-load');
    assert.equal(button.disabled, false);
    // A routine HA repaint between pointer-down and pointer-up must not
    // replace the target and suppress the browser's click.
    button.dispatchEvent(new f.dom.window.MouseEvent('mousedown', {bubbles:true}));
    f.card._doUpdateContent();
    assert.equal(f.card.shadowRoot.querySelector('.trend-load'), button);
    button.dispatchEvent(new f.dom.window.MouseEvent('mouseup', {bubbles:true}));
    button.click();
    assert.equal(f.card._trendState, 'loading');
    await f.card._trendWire;
    assert.equal(f.calls.filter(msg => msg.type === 'ha_storage_monitor/history').length, 1);
    assert.equal(f.card._trendState, 'unsupported');
  } finally { f.close(); }
});

test('unchanged HA configuration preserves both refresh controls and their click handlers', async () => {
  const f = fixture();
  try {
    f.mount(); await f.card._nativeWire;
    const header = f.card.shadowRoot.querySelector('#refreshBtn');
    const history = f.card.shadowRoot.querySelector('.trend-load');
    assert.equal(history.disabled, false);
    f.card.setConfig({...f.card._config});
    assert.equal(f.card.shadowRoot.querySelector('#refreshBtn'), header);
    assert.equal(f.card.shadowRoot.querySelector('.trend-load'), history);
    let statusClicks = 0, historyClicks = 0;
    f.card._refreshStorageData = () => { statusClicks++; };
    f.card._loadStorageHistory = () => { historyClicks++; };
    header.click(); history.click();
    assert.equal(statusClicks, 1); assert.equal(historyClicks, 1);
    f.card.setConfig({...f.card._config, variant:'compact'});
    f.card.setConfig({...f.card._config, variant:'full'});
    assert.ok(f.card.shadowRoot.querySelector('#refreshBtn'));
    assert.ok(f.card.shadowRoot.querySelector('.trend-load'));
  } finally { f.close(); }
});
