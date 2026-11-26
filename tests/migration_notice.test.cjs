const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');

function setup(language = 'en') {
  const dom = new JSDOM('', { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
  dom.window.eval(readFileSync(join(__dirname, '..', 'ha-storage-monitor.js'), 'utf8'));
  const hass = { language, user: { id: 'test', is_admin: true }, states: {} };
  const mount = () => { const card = dom.window.document.createElement('ha-storage-monitor'); card.setConfig({ show_support: false }); card._loadStorageData = () => {}; card.hass = hass; return card; };
  return { dom, hass, mount };
}

test('notice is localized and restricted to active administrators', () => {
  for (const [lang, fragments] of [['en', ['transition period', 'removed from the catalog', 'successor will be an Integration', 'settings remain', 'migration instructions']], ['pl', ['okresie przejściowym', 'wycofany z katalogu', 'następcą będzie Integracja', 'ustawienia pozostają', 'instrukcję migracji']]]) {
    const { dom, hass, mount } = setup(lang);
    try {
      const card = mount(), notice = card.shadowRoot.querySelector('.migration-notice');
      for (const fragment of fragments) assert.ok(notice.textContent.includes(fragment), fragment);
      assert.equal(notice.querySelector('a').getAttribute('href'), 'https://github.com/MacSiem/ha-storage-monitor#installation');
      for (const user of [{ id: 'test', is_admin: false }, { id: 'test', is_admin: true, is_active: false }, undefined]) {
        card.hass = { ...hass, user };
        assert.equal(card.shadowRoot.querySelector('.migration-notice'), null);
      }
    } finally { dom.window.close(); }
  }
});

test('dismissal survives language changes and card recreation', () => {
  const { dom, hass, mount } = setup();
  try {
    const card = mount(); card.shadowRoot.querySelector('.migration-dismiss').click();
    card.hass = { ...hass, language: 'pl' };
    assert.equal(card.shadowRoot.querySelector('.migration-notice'), null);
    assert.equal(mount().shadowRoot.querySelector('.migration-notice'), null);
    assert.equal(dom.window.localStorage.getItem('ha-storage-monitor-migration-notice-v1-dismissed'), '1');
  } finally { dom.window.close(); }
});

test('dismissal remains effective in session when storage is unavailable', () => {
  const { dom, hass, mount } = setup();
  try {
    const card = mount();
    Object.defineProperty(dom.window, 'localStorage', { get() { throw new dom.window.DOMException('denied', 'SecurityError'); } });
    card.shadowRoot.querySelector('.migration-dismiss').click();
    card.hass = { ...hass, language: 'pl' };
    assert.equal(card.shadowRoot.querySelector('.migration-notice'), null);
  } finally { dom.window.close(); }
});
