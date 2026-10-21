/* Pure Storage backend DTO adapter. Unix seconds in; milliseconds in view DTOs. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HaStorageBackendAdapter = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
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
    if (f.full_in_days !== null) {
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
    return freeze({rows, entityIds: [], backendSampleIds: selected.map(s => s.sample_id), sourceKey, series, missing: [],
      start, end, invalid: 0, inspected: samples.length, orderIssues: 0,
      capped: dto.capped || samples.length > 1200 || (paged && samples.length < dto.total_rows),
      renderSubset: {policy: 'newest_1200_samples_from_supplied_page', suppliedSamples: samples.length, renderedSamples: selected.length},
      coverage: 'unknown', retention: 'unknown', continuity: 'unknown', physicalContinuity: 'unknown', confirmedIntervals: [],
      entryIdentity, revisionIdentity, rawSamples: clone(samples), requestedWindow: clone(requested), observedWindow: clone(observed),
      observationCoverage: clone(coverage), backendSegments: clone(dto.segments), observationGaps: clone(dto.gaps),
      lastSuccess: dto.last_success, pagination: paged ? {pageOffset: dto.page_offset, totalRows: dto.total_rows, nextOffset: dto.next_offset} : null});
  }
  return Object.freeze({validateStatus, selectSource, capacitySnapshot, projectHistory, forecastView});
}));
