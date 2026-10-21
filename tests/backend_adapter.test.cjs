'use strict';
// Run by owner through the authorized FIFO wrapper; no HA imports or network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const adapter = require('../shared/ha-storage-backend-adapter.js');
const NOW = 1800000000, uuid = 'a7df27ccf195452bb9e4bc60d3bebda0', revision = 'binding-r1';
const opts = {entryId: 'entry-1', sourceUuid: uuid, bindingRevision: revision, sourceKey: 'backend:entry-1:' + uuid};
const copy = value => structuredClone(value);
function sample(i = 0, extra = {}) {
  return {source_uuid: uuid, binding_revision: revision, segment_id: 'segment-a', sample_id: 'sample-' + i,
    measured_at: NOW - 3600 + i * 1800, used_bytes: 60 + i, total_bytes: 100, free_bytes: 30 - i,
    reserved_bytes: 10, identity_quality: 'strong', ...extra};
}
function history(rows = [sample(0), sample(1), sample(2)]) {
  return {source_uuid: uuid, requested_window: {start: NOW - 7 * 86400, end: NOW, seconds: 7 * 86400},
    observed_window: {start: rows[0]?.measured_at ?? null, end: rows.at(-1)?.measured_at ?? null,
      seconds: rows.length ? rows.at(-1).measured_at - rows[0].measured_at : 0}, rows,
    coverage: {successful_slots: rows.length, expected_slots: rows.length, ratio: rows.length ? 1 : null,
      longest_gap_seconds: rows.length ? 1800 : null, schedule_seconds: 1800},
    segments: rows.length ? [{segment_id: 'segment-a', binding_revision: revision, start: rows[0].measured_at,
      end: rows.at(-1).measured_at, sample_count: rows.length}] : [], gaps: [],
    last_success: rows.at(-1)?.measured_at ?? null, capped: false, confirmed_intervals: [], physical_continuity: 'unknown',
    next_offset: null, total_rows: rows.length, page_offset: 0};
}
function status() {
  return {schema_version: 1, read_at: NOW, permissions: {admin_only: true}, sources: [{
    source: {kind: 'local_fs_samples', source_uuid: uuid, binding_revision: revision, label: '/config',
      scope: 'ha_process_filesystem', identity_quality: 'process_mount_namespace'},
    current: {used_bytes: 60, total_bytes: 100, free_bytes: 30, reserved_bytes: 10, measured_at: NOW,
      free_semantics: 'available_to_process', free_computed: false},
    forecast: {full_in_days: null, growth_bytes_per_day: null, method: 'ols_used_bytes_actual_elapsed_days',
      sample_count: 1, quality: 'unknown', reason: 'insufficient_samples', calculated_at: NOW, measured_at: NOW,
      source_uuid: uuid, segment_id: 'segment-a', window: {maximum_seconds: 7 * 86400, start: NOW, end: NOW, observed_seconds: 0},
      coverage: {successful_slots: 1, expected_slots: 1, ratio: 1, longest_gap_seconds: 0, schedule_seconds: 1800},
      confirmed_intervals: [], physical_continuity: 'unknown'}, error: null}]};
}
const validate = dto => adapter.validateStatus(dto, {entryId: 'entry-1', nowMs: NOW * 1000});
const projection = dto => adapter.projectHistory(dto, opts);
const rejected = (run, fragment) => assert.throws(run, fragment ? new RegExp(fragment) : /storage_backend:/);
function estimate(item, patch = {}) {
  Object.assign(item.forecast, {full_in_days: 2.5, growth_bytes_per_day: 12,
    quality: 'limited_estimate', reason: null, sample_count: 49,
    window: {maximum_seconds: 604800, start: NOW - 86400, end: NOW, observed_seconds: 86400},
    coverage: {successful_slots: 49, expected_slots: 49, ratio: 1, longest_gap_seconds: 1800, schedule_seconds: 1800}}, patch);
  return item;
}

test('actual runtime status schema: absent entry is explicitly unverified; deterministic immutable copy', () => {
  const dto = status(), original = copy(dto), result = validate(dto);
  assert.equal(result.entryIdentity, 'absent'); assert.equal(result.entryId, null);
  assert.equal(result.requestedEntryId, 'entry-1'); assert.deepEqual(dto, original);
  assert.ok(Object.isFrozen(result.sources[0].current));
  dto.sources[0].current.used_bytes = 999; assert.equal(result.sources[0].current.used_bytes, 60);
});
test('optional explicit status entry identity must match', () => {
  const dto = status(); dto.entry_id = 'entry-1'; assert.equal(validate(dto).entryIdentity, 'matched');
  dto.entry_id = 'entry-2'; rejected(() => validate(dto), 'entry_id_mismatch');
});
test('selection never silently switches disks', () => {
  const dto = status(); assert.equal(adapter.selectSource(validate(dto)).source.source_uuid, uuid);
  const other = copy(dto.sources[0]); other.source.source_uuid = 'disk-b'; other.forecast.source_uuid = 'disk-b';
  dto.sources.push(other); const validated = validate(dto);
  rejected(() => adapter.selectSource(validated), 'source_selection_required');
  assert.equal(adapter.selectSource(validated, {sourceUuid: 'disk-b'}).source.source_uuid, 'disk-b');
  rejected(() => adapter.selectSource(validated, {sourceUuid: 'removed'}), 'selected_source_missing');
  dto.sources = []; rejected(() => adapter.selectSource(validate(dto)), 'no_sources');
});
test('reject malformed status semantics, duplicate UUID, and primitive coercion', () => {
  for (const mutate of [d => { d.schema_version = 2; }, d => { d.permissions.admin_only = false; },
    d => { d.sources.push(copy(d.sources[0])); }, d => { d.sources[0].source.scope = 'host'; },
    d => { d.sources[0].current.used_bytes = '60'; }, d => { d.sources[0].current.free_bytes = null; },
    d => { d.sources[0].current.reserved_bytes = 0; }, d => { d.sources[0].current.total_bytes = 0; },
    d => { d.sources[0].current.used_bytes = NaN; }, d => { d.sources[0].current.free_computed = true; },
    d => { d.sources[0].current.measured_at = Infinity; }, d => { d.read_at = NOW + 1; },
    d => { d.sources[0].current.used_bytes = true; }]) {
    const dto = status(); mutate(dto); rejected(() => validate(dto));
  }
});
test('capacity retains actual reserved and available free; legacy category zeros are flagged unmeasured', () => {
  const dto = status(), item = adapter.selectSource(validate(dto));
  const view = adapter.capacitySnapshot(item, {readAt: NOW * 1000});
  assert.equal(view.diskUsed, 60 / 1e9); assert.equal(view.diskFree, 30 / 1e9);
  assert.equal(view.diskReserved, 10 / 1e9); assert.equal(view.freeComputed, false);
  assert.equal(view.measuredAt, NOW * 1000); assert.equal(view.readAt, NOW * 1000);
  assert.equal(view.source, 'local_fs_samples'); assert.equal(view.scope, 'ha_process_filesystem');
  assert.deepEqual(view.sourceEntityIds, []); assert.equal(view.noSupervisor, undefined);
  assert.ok(view.categories.every(c => c.measured === false && c.sourceUnavailable && c.size === 0));
  assert.equal(view.addonsAvailable, false);
});
test('zero used or free is valid data; unavailable and malformed are never fake zero', () => {
  const dto = status(); Object.assign(dto.sources[0].current, {used_bytes: 0, free_bytes: 90});
  let item = adapter.selectSource(validate(dto)); assert.equal(adapter.capacitySnapshot(item, {readAt: NOW * 1000}).diskUsed, 0);
  dto.sources[0].current = null; dto.sources[0].error = 'source_unavailable';
  item = adapter.selectSource(validate(dto)); const view = adapter.capacitySnapshot(item, {readAt: NOW * 1000});
  assert.equal(view.diskUsed, null); assert.equal(view.diskTotal, null); assert.equal(view.availabilityReason, 'source_unavailable');
});
test('stale and future current snapshots cannot be rendered as live capacity', () => {
  const dto = status(); dto.sources[0].current.measured_at = NOW - 3600;
  assert.ok(adapter.selectSource(validate(dto)).current);
  dto.sources[0].current.measured_at = NOW - 3600.001;
  assert.equal(adapter.selectSource(validate(dto)).current, null);
  assert.equal(adapter.selectSource(validate(dto)).error, 'stale');
  dto.sources[0].current.measured_at = NOW + 0.001;
  assert.equal(adapter.selectSource(validate(dto)).error, 'future_clock');
});
test('actual history DTO projects each atomic sample into a B pair with original time and explicit sample ID', () => {
  const dto = history(), original = copy(dto), r = projection(dto);
  assert.equal(r.entryIdentity, 'absent'); assert.equal(r.revisionIdentity, 'absent');
  assert.equal(r.rows.length, 6); assert.equal(r.start, dto.requested_window.start * 1000);
  for (let i = 0; i < dto.rows.length; i++) {
    const pair = r.rows.slice(i * 2, i * 2 + 2);
    assert.deepEqual(pair.map(x => x.kind), ['used', 'total']);
    assert.ok(pair.every(x => x.unit === 'B' && x.entityId === null && x.backendSampleId === dto.rows[i].sample_id));
    assert.ok(pair.every(x => x.recordedSeconds === dto.rows[i].measured_at && x.time === dto.rows[i].measured_at * 1000));
    assert.equal(pair[0].bytes, dto.rows[i].used_bytes); assert.equal(pair[1].bytes, dto.rows[i].total_bytes);
  }
  assert.deepEqual(r.rawSamples, dto.rows); assert.deepEqual(r.requestedWindow, dto.requested_window);
  assert.deepEqual(r.observedWindow, dto.observed_window); assert.deepEqual(dto, original);
  assert.ok(r.series.every(s => s.segments.every(x => x.continuity === 'unknown' && x.points.length === 1)));
  assert.deepEqual(r.confirmedIntervals, []); assert.equal(r.coverage, 'unknown');
  assert.ok(r.series.every(s => s.gaps.every(g => g.reason === 'unconfirmed_interval')));
});
test('empty history stays empty with unknown coverage; no synthetic endpoints', () => {
  const r = projection(history([])); assert.deepEqual(r.rows, []); assert.deepEqual(r.rawSamples, []);
  assert.equal(r.series[0].segments.length, 0); assert.equal(r.observedWindow.start, null);
});
test('fractional timestamps retained without rounding and inclusive end accepted', () => {
  const row = sample(2, {measured_at: NOW - 0.0001});
  const r = projection(history([row])); assert.equal(r.rows[0].recordedSeconds, NOW - 0.0001);
  assert.equal(r.rows[0].time, (NOW - 0.0001) * 1000);
  assert.equal(projection(history([sample(2)])).rows.length, 2);
});
test('history rejects every malformed row before render capping and never sorts away rollback', () => {
  for (const mutate of [d => { d.rows[0].used_bytes = null; }, d => { d.rows[0].total_bytes = 0; },
    d => { d.rows[0].free_bytes = -1; }, d => { d.rows[0].reserved_bytes = Infinity; },
    d => { d.rows[0].measured_at = '1800000000'; }, d => { d.rows.reverse(); },
    d => { d.rows[1].sample_id = d.rows[0].sample_id; }, d => { d.rows[1].measured_at = d.rows[0].measured_at; },
    d => { d.rows[0].source_uuid = 'wrong'; }, d => { d.rows[0].binding_revision = 'old-revision'; },
    d => { d.rows[0].identity_quality = 'certain'; }, d => { d.rows[0].segment_id = ''; },
    d => { d.rows[0].measured_at = NOW + 1; }, d => { d.rows[0].measured_at = d.requested_window.start - 1; },
    d => { d.source_uuid = 'different'; }, d => { d.requested_window.seconds = 5; },
    d => { d.confirmed_intervals = [{start: 0, end: 1}]; }, d => { d.physical_continuity = 'confirmed'; }]) {
    const dto = history(); mutate(dto); rejected(() => projection(dto));
  }
});
test('optional explicit history entry and revision identity checked independently', () => {
  const dto = history(); dto.entry_id = 'entry-1'; dto.binding_revision = revision;
  assert.equal(projection(dto).entryIdentity, 'matched'); assert.equal(projection(dto).revisionIdentity, 'matched');
  dto.entry_id = 'wrong'; rejected(() => projection(dto), 'entry_id_mismatch');
  dto.entry_id = 'entry-1'; dto.binding_revision = 'wrong'; rejected(() => projection(dto), 'binding_revision_mismatch');
});
test('segment, capacity, reservation and identity quality changes all fence comparisons', () => {
  for (const change of [{segment_id: 'restart'}, {total_bytes: 110, free_bytes: 39},
    {reserved_bytes: 11, free_bytes: 28}, {identity_quality: 'limited'}]) {
    const dto = history([sample(0), sample(1, change), sample(2)]), r = projection(dto);
    assert.equal(r.rows[2].breakBefore, true); assert.equal(r.rows[2].sourceChanged, true);
    assert.notEqual(r.rows[0].sourceIdentity, r.rows[2].sourceIdentity);
    assert.equal(r.series[0].segments.length, 3);
  }
});
test('paginated full-window metadata is retained without claiming complete history', () => {
  const dto = history(), full = copy(dto); dto.rows = dto.rows.slice(1); dto.page_offset = 1;
  const r = projection(dto); assert.deepEqual(r.observedWindow, full.observed_window);
  assert.deepEqual(r.pagination, {pageOffset: 1, totalRows: 3, nextOffset: null}); assert.equal(r.capped, true);
  dto.rows = full.rows.slice(0, 1); dto.page_offset = 0; dto.next_offset = 1;
  assert.equal(projection(dto).pagination.nextOffset, 1);
});
test('pagination and metadata inconsistencies rejected', () => {
  for (const mutate of [d => { d.page_offset = -1; }, d => { d.next_offset = 2; }, d => { d.total_rows = 2; },
    d => { delete d.page_offset; }, d => { d.next_offset = '3'; }, d => { d.total_rows = 4097; },
    d => { d.observed_window.end = NOW - 1; }, d => { d.coverage.ratio = 0.5; },
    d => { d.gaps = [{start: NOW - 1800, end: NOW, seconds: 2000}]; },
    d => { d.segments[0].sample_count = 0; }]) {
    const dto = history(); mutate(dto); rejected(() => projection(dto));
  }
});
test('newest 1200 sample render subset is explicit, raw 1201 preserved, old bad row still rejected', () => {
  const rows = Array.from({length: 1201}, (_, i) => sample(i, {measured_at: NOW - (1200 - i) * 300,
    used_bytes: 60, free_bytes: 30}));
  const dto = history(rows), r = projection(dto);
  assert.equal(r.rows.length, 2400); assert.equal(r.rawSamples.length, 1201);
  assert.equal(r.rows[0].backendSampleId, 'sample-1'); assert.equal(r.rows.at(-1).backendSampleId, 'sample-1200');
  assert.equal(r.capped, true); assert.equal(r.renderSubset.renderedSamples, 1200);
  dto.rows[0].used_bytes = '60'; rejected(() => projection(dto));
});
test('unknown forecast retains null and reason; valid limited estimate zero is distinct', () => {
  const item = status().sources[0], options = {nowMs: NOW * 1000};
  let f = adapter.forecastView(item, options); assert.equal(f.fullInDays, null); assert.equal(f.reason, 'insufficient_samples');
  estimate(item, {full_in_days: 0});
  item.current.free_bytes = 0; item.current.reserved_bytes = 40;
  f = adapter.forecastView(item, options); assert.equal(f.fullInDays, 0); assert.equal(f.quality, 'limited_estimate');
  assert.equal(f.confidence, undefined); assert.equal(f.reason, null);
});
test('forecast rejects invalid zero, negative, nonnumeric, and inconsistent unknowns', () => {
  for (const change of [{full_in_days: 0}, {full_in_days: -1}, {full_in_days: '0'},
    {full_in_days: 0, growth_bytes_per_day: 0, quality: 'limited_estimate', reason: null},
    {full_in_days: 0, growth_bytes_per_day: -1, quality: 'limited_estimate', reason: null},
    {full_in_days: 0, growth_bytes_per_day: 1, quality: 'high_confidence', reason: null},
    {full_in_days: null, reason: null}, {source_uuid: 'wrong'}, {growth_bytes_per_day: NaN}]) {
    const item = status().sources[0]; Object.assign(item.forecast, change);
    rejected(() => adapter.forecastView(item, {nowMs: NOW * 1000}));
  }
});
test('forecast age boundary, future and source errors retain machine reasons', () => {
  const item = estimate(status().sources[0]);
  assert.equal(adapter.forecastView(item, {nowMs: (NOW + 3600) * 1000}).fullInDays, 2.5);
  assert.equal(adapter.forecastView(item, {nowMs: (NOW + 3600.001) * 1000}).reason, 'stale');
  assert.equal(adapter.forecastView(item, {nowMs: (NOW - 1) * 1000}).reason, 'future_clock');
  item.error = 'source_unavailable'; assert.equal(adapter.forecastView(item, {nowMs: NOW * 1000}).reason, 'source_unavailable');
});
test('UMD browser export evaluates without DOM, I/O, HA, Date.now, or CommonJS', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../shared/ha-storage-backend-adapter.js'), 'utf8'), context);
  assert.equal(typeof context.HaStorageBackendAdapter.projectHistory, 'function');
  assert.equal(Object.keys(context.HaStorageBackendAdapter).length, 5);
});
test('estimate must carry the same minimum evidence as the backend calculator', () => {
  for (const mutate of [i => { i.forecast.sample_count = 1; },
    i => { i.forecast.window.observed_seconds = 3600; i.forecast.window.start = NOW - 3600; },
    i => { i.forecast.coverage.ratio = 0.5; },
    i => { i.forecast.coverage.longest_gap_seconds = 5401; }]) {
    const item = estimate(status().sources[0]); mutate(item);
    rejected(() => adapter.forecastView(item, {nowMs: NOW * 1000}));
  }
});
test('zero days must agree with actual zero available free in the current atomic tuple', () => {
  const item = estimate(status().sources[0], {full_in_days: 0});
  rejected(() => adapter.forecastView(item, {nowMs: NOW * 1000}));
});
test('forecast must use the same latest measurement and available-free/growth ratio', () => {
  for (const change of [{measured_at: NOW - 1}, {full_in_days: 99}]) {
    const item = estimate(status().sources[0], change);
    rejected(() => adapter.forecastView(item, {nowMs: NOW * 1000}));
  }
});
test('normalizing an expired estimate returns honest stale unknown instead of a protocol error', () => {
  const dto = status(); estimate(dto.sources[0]);
  const checked = adapter.validateStatus(dto, {entryId: 'entry-1', nowMs: (NOW + 3601) * 1000});
  const item = adapter.selectSource(checked);
  assert.equal(item.current, null);
  const result = adapter.forecastView(item, {nowMs: (NOW + 3601) * 1000});
  assert.equal(result.fullInDays, null);
  assert.equal(result.reason, 'stale');
});

// A recorded-state hold is a visual interpolation, never physical measurement.
test('recorded-state steps retain actual endpoints and a separate unknown physical contract', () => {
  const dto = history(), before = copy(dto), r = projection(dto);
  assert.ok(r.recordedStateSeries, 'native observation step projection is missing');
  assert.equal(r.recordedStateMaxGapMs, 1800000);
  for (const series of r.recordedStateSeries) {
    assert.equal(series.segments.length, 1);
    const segment = series.segments[0];
    assert.equal(segment.semantics, 'last_recorded_state');
    assert.deepEqual(segment.points.map(p => p.backendSampleId), dto.rows.map(p => p.sample_id));
    assert.equal(segment.points[0].time, dto.rows[0].measured_at * 1000);
    assert.equal(segment.points.at(-1).time, dto.rows.at(-1).measured_at * 1000);
  }
  assert.equal(r.physicalContinuity, 'unknown'); assert.deepEqual(r.confirmedIntervals, []);
  assert.ok(r.series.every(s => s.segments.every(p => p.points.length === 1)));
  assert.deepEqual(dto, before);
});
test('recorded-state steps break at a missing scheduled observation and never extend edges', () => {
  const dto = history([sample(0), sample(1), sample(2, {measured_at: NOW - 1})]);
  // This fixture is adjacent within cadence. First verify two real joins.
  let r = projection(dto); assert.ok(r.recordedStateSeries, 'native observation step projection is missing');
  assert.equal(r.recordedStateSeries[0].segments[0].points.length, 3);
  dto.rows[1].measured_at -= 1;
  r = projection(dto);
  assert.deepEqual(r.recordedStateSeries[0].segments.map(s => s.points.length), [2, 1]);
  assert.ok(r.recordedStateSeries[0].segments.every(s => s.points.every(p => p.time >= dto.observed_window.start * 1000 && p.time <= dto.observed_window.end * 1000)));
});
test('recorded-state steps never cross a segment, capacity, reservation or quality change', () => {
  for (const change of [{segment_id: 'restart'}, {total_bytes: 110, free_bytes: 39},
    {reserved_bytes: 11, free_bytes: 28}, {identity_quality: 'limited'}]) {
    const r = projection(history([sample(0), sample(1, change), sample(2)]));
    assert.ok(r.recordedStateSeries, 'native observation step projection is missing');
    assert.deepEqual(r.recordedStateSeries[0].segments.map(s => s.points.length), [1, 1, 1]);
  }
});
