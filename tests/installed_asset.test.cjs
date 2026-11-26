'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync, existsSync} = require('node:fs');
const {join} = require('node:path');
const root = join(__dirname, '..');
const installed = join(root, 'custom_components/ha_storage_monitor/www/ha-storage-monitor.js');

test('integration ships the current standalone card rather than a missing or stale asset', () => {
  assert.ok(existsSync(installed), 'The integration card URL must resolve to a shipped file');
  assert.deepEqual(readFileSync(installed), readFileSync(join(root, 'ha-storage-monitor.js')));
});

test('frontend diagnostic version matches the integration cache version', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'custom_components/ha_storage_monitor/manifest.json')));
  const source = readFileSync(join(root, 'ha-storage-monitor.js'), 'utf8');
  const banner = source.match(/ha-storage-monitor v([\d.]+)/);
  const diagnostic = source.match(/%c v([\d.]+) /);
  assert.equal(banner?.[1], manifest.version);
  assert.equal(diagnostic?.[1], manifest.version);
});
