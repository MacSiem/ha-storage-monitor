const assert = require('node:assert/strict');
const {test} = require('node:test');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {JSDOM} = require('jsdom');

function restoredCard(savedTab) {
  const dom = new JSDOM('', {runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/'});
  dom.window.localStorage.setItem('ha-storage-monitor-settings', JSON.stringify({_activeTab: savedTab}));
  dom.window.eval(readFileSync(join(__dirname, '..', 'ha-storage-monitor.js'), 'utf8'));
  const card = dom.window.document.createElement('ha-storage-monitor');
  card._hass = {user: {is_admin: true}};
  card.setConfig({type: 'custom:ha-storage-monitor'});
  return {dom, card};
}

for (const tab of ['overview', 'addons', 'backups', 'files', 'top', 'cleanup']) {
  test(`reload restores the visible and accessible ${tab} selection`, () => {
    const {dom, card} = restoredCard(tab);
    try {
      const active = [...card.shadowRoot.querySelectorAll('.tab-button.active')];
      assert.equal(active.length, 1);
      assert.equal(active[0].dataset.tab, tab);
      const selected = [...card.shadowRoot.querySelectorAll('[role="tab"][aria-selected="true"]')];
      assert.equal(selected.length, 1);
      assert.equal(selected[0].dataset.tab, tab);
    } finally {dom.window.close();}
  });
}

test('changing tabs keeps the accessible selection after focus leaves the tab', () => {
  const {dom, card} = restoredCard('overview');
  try {
    card.shadowRoot.querySelector('[data-tab="addons"]').click();
    card.shadowRoot.getElementById('refreshBtn').focus();
    assert.equal(card.shadowRoot.querySelector('[aria-selected="true"]').dataset.tab, 'addons');
    assert.equal(card.shadowRoot.querySelector('[data-tab="overview"]').getAttribute('aria-selected'), 'false');
  } finally {dom.window.close();}
});

test('an invalid persisted tab restores Overview instead of an empty view', () => {
  const {dom, card} = restoredCard('obsolete-tab');
  try {
    assert.equal(card._activeTab, 'overview');
    assert.equal(card.shadowRoot.querySelector('[aria-selected="true"]').dataset.tab, 'overview');
  } finally {dom.window.close();}
});

for (const tab of ['overview', 'addons', 'backups', 'files', 'top', 'cleanup']) {
  test(`sidebar panel restores ${tab} without Lovelace setConfig`, () => {
    const dom = new JSDOM('', {runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/ha-storage-monitor'});
    try {
      dom.window.localStorage.setItem('ha-storage-monitor-settings', JSON.stringify({_activeTab: tab}));
      dom.window.eval(readFileSync(join(__dirname, '..', 'ha-storage-monitor.js'), 'utf8'));
      const panel = dom.window.document.createElement('ha-storage-monitor');
      panel._hass = {user: {is_admin: false}};
      panel._render();
      assert.equal(panel.shadowRoot.querySelector('[aria-selected="true"]').dataset.tab, tab);
    } finally {dom.window.close();}
  });
}
