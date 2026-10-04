const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');

function fixture(language = 'en') {
  const dom = new JSDOM('', { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
  dom.window.eval(readFileSync(join(__dirname, '..', 'ha-storage-monitor.js'), 'utf8'));
  const card = dom.window.document.createElement('ha-storage-monitor');
  card.setConfig({ title: 'Authored title', show_support: true });
  let reads = 0;
  card._loadStorageData = () => { reads++; };
  const hass = language => ({ language, user: { id: 'qa-admin', is_admin: true }, states: {} });
  card.hass = hass(language);
  return { dom, card, hass, reads: () => reads };
}

test('initial pl-PL localizes support caption and its accessible dismissal', () => {
  const f = fixture('pl-PL');
  try {
    assert.equal(f.card.shadowRoot.querySelector('.donate-section a').textContent, 'Opcjonalne wsparcie HA Tools');
    assert.equal(f.card.shadowRoot.querySelector('.support-dismiss').getAttribute('aria-label'), 'Ukryj link wsparcia');
  } finally { f.dom.window.close(); }
});

test('ordinary EN/pl-PL/EN support changes retain selection, authored title and read count', () => {
  const f = fixture();
  try {
    f.card.setActiveTab('files');
    const count = f.reads();
    for (const language of ['pl-PL', 'en']) {
      f.card.hass = f.hass(language);
      const support = f.card.shadowRoot.querySelector('.donate-section');
      assert.equal(support.querySelector('a').textContent, language.startsWith('pl') ? 'Opcjonalne wsparcie HA Tools' : 'Optional support for HA Tools');
      assert.equal(support.querySelector('.support-dismiss').getAttribute('aria-label'), language.startsWith('pl') ? 'Ukryj link wsparcia' : 'Dismiss support link');
      assert.equal(support.querySelector('a').getAttribute('rel'), 'noopener noreferrer');
      assert.equal(f.card._activeTab, 'files');
      assert.equal(f.card.shadowRoot.querySelector('h2').textContent, 'Authored title');
      assert.equal(f.reads(), count);
    }
  } finally { f.dom.window.close(); }
});

test('dismissed support stays hidden when persistence is denied and locale rerenders', () => {
  const f = fixture();
  try {
    Object.defineProperty(f.dom.window, 'localStorage', { get() { throw new f.dom.window.DOMException('denied', 'SecurityError'); }, configurable: true });
    f.card.shadowRoot.querySelector('.support-dismiss').click();
    assert.equal(f.card.shadowRoot.querySelector('.donate-section'), null);
    f.card.hass = f.hass('pl-PL');
    assert.equal(f.card.shadowRoot.querySelector('.donate-section'), null);
    f.card.hass = f.hass('en');
    assert.equal(f.card.shadowRoot.querySelector('.donate-section'), null);
    f.card.setConfig({ title: 'Changed authored title', show_support: true });
    assert.equal(f.card.shadowRoot.querySelector('.donate-section'), null);
  } finally { f.dom.window.close(); }
});

test('confirmed household user receives no support and no storage read', () => {
  const f = fixture();
  try {
    const count = f.reads();
    f.card.hass = { language: 'pl-PL', user: { id: 'qa-household', is_admin: false }, states: {} };
    assert.equal(f.card.shadowRoot.querySelector('.donate-section'), null);
    assert.equal(f.reads(), count);
    assert.match(f.card.shadowRoot.textContent, /Wymagane uprawnienia administratora/);
  } finally { f.dom.window.close(); }
});
